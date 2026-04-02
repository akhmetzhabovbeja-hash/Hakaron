import re
import statistics
import logging
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.api.v1.auth import get_current_user
from app.models.user import User, UserRole
from app.models.vacancy import Vacancy
from app.models.candidate import CandidateProfile, CandidateSource
from app.models.question import Question
from app.models.questionnaire import QuestionnaireResponse
from app.models.analysis import CandidateAnalysis, AnalysisStatus
from app.models.vacancy_question import VacancyQuestion
from app.schemas.candidate import (
    SubmitQuestionnaireRequest, MyStatusResponse,
    StartApplicationRequest, SaveDraftRequest, DraftResponse, DraftAnswerItem,
)
from fastapi import UploadFile, File
import os
import uuid

logger = logging.getLogger(__name__)
router = APIRouter()

# SlopTotal AI Detection service URL (Docker service name)
SLOPTOTAL_URL = "http://ai-detection:8000"


# --------------------------------------------------------------------------- #
# AI text detection: SlopTotal API with rule-based fallback
# --------------------------------------------------------------------------- #

# --- Tier 1: Strong AI signals (weight 3) - almost never used by humans ---
AI_TIER1_RU = [
    # Classic ChatGPT/Claude markers
    "стоит отметить", "важно подчеркнуть", "необходимо отметить", "следует отметить",
    "нельзя не отметить", "на основании вышеизложенного", "в рамках данного",
    "подводя итог", "резюмируя вышесказанное", "принимая во внимание",
    "представляется целесообразным", "не менее важным является",
    # Bureaucratic AI phrases
    "важным этапом моего", "профессионального становления",
    "раскрытия потенциала", "позволит мне расширить",
    "приобрести навыки необходимые", "для достижения поставленных целей",
    "позитивные изменения в обществе", "нового поколения лидеров",
    "способствует формированию", "позволяет раскрыть потенциал",
    "междисциплинарный подход", "расширить кругозор",
    # Overused AI conclusions
    "исходя из вышесказанного", "учитывая всё вышеизложенное",
    "всё это свидетельствует", "это позволяет сделать вывод",
    "можно с уверенностью сказать", "всё это подчёркивает",
]
# --- Tier 2: Medium AI signals (weight 2) - sometimes used by humans ---
AI_TIER2_RU = [
    "безусловно", "таким образом", "в заключение", "в первую очередь",
    "в конечном итоге", "ключевую роль", "значительное влияние",
    "комплексный подход", "уникальную возможность", "играет важную роль",
    "определяет успех", "в современном мире", "в условиях неопределенности",
    # Common ChatGPT fillers
    "критическое мышление", "навыки командной работы", "лидерские качества",
    "позитивные изменения", "инновационный подход", "благоприятную среду",
    "профессиональное развитие", "межличностного взаимодействия",
    "системного подхода", "аналитического мышления",
    "взвешенные решения", "раскрыть потенциал",
    "личностного роста", "устойчивое развитие",
    "образовательной программы", "социальное воздействие",
    # AI loves these constructions
    "представляет собой уникальн", "оказал значительное влияние",
    "получают возможность", "приобрести ценные навыки",
    "является основой", "не только .* но и",
]
# --- Tier 3: Weak AI signals (weight 1) - common in academic writing ---
AI_TIER3_RU = [
    "данный", "является", "осуществлять", "реализовать", "обеспечить",
    "формировать", "способствовать", "представляет собой",
    "в контексте", "в целом", "в частности",
    "эффективность", "компетенции", "потенциал",
    "оптимизация", "интеграция", "трансформация",
    "востребован", "актуальн", "релевантн",
]
# --- Hedging / connector stacking ---
HEDGING_RU = [
    "с другой стороны", "вместе с тем", "при этом", "кроме того",
    "более того", "помимо этого", "в то же время", "тем не менее",
    "однако следует", "вместе с этим", "наряду с этим",
    "в свою очередь", "не стоит забывать", "также важно",
    "помимо того", "не менее важно", "стоит также",
]
# --- Human markers (reduce score) ---
HUMAN_MARKERS_RU = [
    # Slang & informal
    "ну", "короче", "типа", "кстати", "блин", "вообще-то", "чё", "щас",
    "прикинь", "реально", "чисто", "походу", "капец", "фигня", "норм",
    "хз", "лол", "ахах", "кек",
    # Emotional / casual punctuation
    ")))", "(((",  "!!", "???", "...",
    # Personal authentic markers
    "мама сказала", "друг показал", "было обидно", "были в шоке",
    "затянуло", "прокачаться", "шарю", "угорал", "забил",
    "не зря", "по приколу", "в шоке", "офигел",
]


def _fallback_detect(text: str) -> dict:
    """Rule-based fallback when SlopTotal is unavailable."""
    ru_score, indicators = _russian_rule_score(text)
    indicators.append("fallback_rule_based")
    return {
        "is_ai_generated": ru_score >= 0.41,
        "ai_probability": round(ru_score, 2),
        "indicators": indicators,
    }


def _russian_rule_score(text: str) -> tuple[float, list[str]]:
    """Russian-specific AI detection heuristics. Returns (score 0-1, indicators)."""
    indicators: list[str] = []
    score = 0.0
    words = text.split()
    word_count = len(words)

    if word_count < 10:
        return 0.0, []

    text_lower = text.lower()
    sentences = [s.strip() for s in re.split(r'[.!?]+', text) if s.strip()]

    # === 1. Tiered phrase detection ===
    t1_found = [p for p in AI_TIER1_RU if p in text_lower]
    t2_found = [p for p in AI_TIER2_RU if p in text_lower]
    t3_found = [p for p in AI_TIER3_RU if p in text_lower]
    phrase_score = len(t1_found) * 3 + len(t2_found) * 2 + len(t3_found) * 1
    all_found = t1_found + t2_found

    if phrase_score >= 8:
        score += 0.40
        indicators.append(f"ai_phrases_strong:{','.join(all_found[:5])}")
    elif phrase_score >= 5:
        score += 0.30
        indicators.append(f"ai_phrases_medium:{','.join(all_found[:4])}")
    elif phrase_score >= 3:
        score += 0.20
        indicators.append(f"ai_phrases_light:{','.join(all_found[:3])}")
    elif phrase_score >= 1:
        score += 0.08

    # === 2. Sentence uniformity ===
    if len(sentences) >= 3:
        lengths = [len(s.split()) for s in sentences]
        std = statistics.stdev(lengths) if len(lengths) > 1 else 0
        if std < 3:
            indicators.append("very_uniform_sentences")
            score += 0.15
        elif std < 5:
            indicators.append("uniform_sentences")
            score += 0.08

    # === 3. Hedging / connector stacking ===
    hedging_count = sum(1 for h in HEDGING_RU if h in text_lower)
    if hedging_count >= 3:
        indicators.append(f"heavy_hedging:{hedging_count}")
        score += 0.18
    elif hedging_count >= 2:
        indicators.append(f"hedging:{hedging_count}")
        score += 0.12

    # === 4. Formality analysis (AI is overly formal in Russian) ===
    human_count = sum(1 for m in HUMAN_MARKERS_RU if m in text_lower)
    # Detect if text is Russian (has Cyrillic)
    has_cyrillic = bool(re.search(r'[а-яёА-ЯЁ]', text))

    if human_count >= 3:
        score -= 0.20
        indicators.append(f"human_informal:{human_count}")
    elif human_count >= 2:
        score -= 0.10
        indicators.append(f"human_marker:{human_count}")
    elif human_count == 1 and phrase_score < 5:
        # Only reduce for 1 marker if few AI phrases (otherwise the AI phrases win)
        score -= 0.05
    elif human_count == 0 and word_count > 40 and has_cyrillic:
        # No informal markers in long Russian text = suspicious
        indicators.append("too_formal")
        score += 0.10

    # === 5. Sentence opener patterns (AI repeats similar starters) ===
    if len(sentences) >= 4:
        starters = [s.split()[0].lower() if s.split() else "" for s in sentences]
        unique_starters = len(set(starters))
        starter_ratio = unique_starters / len(starters)
        if starter_ratio < 0.5:
            indicators.append("repetitive_starters")
            score += 0.10

    # === 6. Comma density (AI uses many commas in Russian) ===
    comma_count = text.count(",")
    if word_count > 30:
        comma_per_word = comma_count / word_count
        if comma_per_word > 0.12:
            indicators.append(f"high_comma_density:{round(comma_per_word, 2)}")
            score += 0.08

    # === 7. Structured text ===
    if re.search(r'^\s*[\d]+[.)]\s', text, re.MULTILINE) or re.search(r'^\s*[-•]\s', text, re.MULTILINE):
        indicators.append("structured_formatting")
        score += 0.08

    # === 8. Very long answer ===
    if word_count > 300:
        indicators.append("unusually_long")
        score += 0.08
    elif word_count > 150:
        score += 0.04

    # === 9. No first-person / personal details ===
    ru_first = sum(1 for w in ["я ", "мне ", "мой ", "моя ", "мои ", "меня "] if w in text_lower)
    en_first = sum(1 for w in [" i ", "i ", " my ", " me ", " mine "] if w in text_lower.replace("\n", " "))
    first_person = ru_first + en_first
    if first_person == 0 and word_count > 50 and has_cyrillic:
        # Only flag for Russian — English casual text often omits "I" at start
        indicators.append("no_first_person")
        score += 0.08

    # === 10. Paragraph consistency (AI paragraphs are very even) ===
    paragraphs = [p.strip() for p in text.split("\n") if p.strip()]
    if len(paragraphs) >= 3:
        p_lengths = [len(p.split()) for p in paragraphs]
        p_std = statistics.stdev(p_lengths) if len(p_lengths) > 1 else 0
        if p_std < 5:
            indicators.append("uniform_paragraphs")
            score += 0.06

    # === 11. Word repetition density (AI repeats key words excessively) ===
    # Habr article: "модели ИИ лишены способности распознавать и избегать избыточности"
    if word_count > 30:
        word_list = [w.lower().strip(".,!?;:()\"'") for w in words if len(w) > 4]
        if word_list:
            from collections import Counter
            freq = Counter(word_list)
            top_words = freq.most_common(5)
            # If any content word appears > 3% of total, it's repetitive
            max_freq = top_words[0][1] / len(word_list) if top_words else 0
            if max_freq > 0.06:
                indicators.append(f"word_repetition:{top_words[0][0]}={top_words[0][1]}")
                score += 0.10
            elif max_freq > 0.04:
                score += 0.05

    # === 12. Burstiness (human text has uneven word distribution; AI is smooth) ===
    # Habr article: burstiness — "насколько скачкообразно появляются слова"
    if len(sentences) >= 4:
        sent_lengths = [len(s.split()) for s in sentences]
        mean_len = sum(sent_lengths) / len(sent_lengths)
        # Calculate variance of sentence lengths relative to mean
        if mean_len > 0:
            deviations = [abs(l - mean_len) / mean_len for l in sent_lengths]
            avg_deviation = sum(deviations) / len(deviations)
            # Low burstiness = AI (all sentences ~same length relative to mean)
            if avg_deviation < 0.15:
                indicators.append(f"low_burstiness:{round(avg_deviation, 2)}")
                score += 0.12
            elif avg_deviation < 0.25:
                indicators.append(f"medium_burstiness:{round(avg_deviation, 2)}")
                score += 0.05
            # High burstiness = human (some very short, some very long)
            elif avg_deviation > 0.5:
                score -= 0.05

    # === 13. Abstractness — lack of concrete details (AI writes generically) ===
    # Habr article: "общие определения без деталей"
    has_numbers = len(re.findall(r'\b\d+\b', text))
    has_proper_names = len(re.findall(r'[A-ZА-ЯЁ][a-zа-яё]{2,}', text))
    has_specific = any(w in text_lower for w in [
        "например", "конкретно", "случай", "ситуаци", "помню", "однажды",
        "прошлом году", "в школе", "в университет", "мой друг", "моя мама",
        "лет назад", "тысяч", "процент", "штук", "человек", "раз",
    ])

    concreteness = has_numbers + (1 if has_specific else 0) + min(has_proper_names, 3)
    if concreteness == 0 and word_count > 40:
        indicators.append("abstract_no_details")
        score += 0.12
    elif concreteness <= 1 and word_count > 60:
        indicators.append("low_concreteness")
        score += 0.06
    elif concreteness >= 4:
        # Very concrete = likely human
        score -= 0.05

    # === 14. Monotonous vocabulary (low type-token ratio = AI) ===
    if word_count > 40:
        unique_words = len(set(w.lower() for w in words))
        ttr = unique_words / word_count
        if ttr < 0.55:
            indicators.append(f"low_vocabulary_diversity:{round(ttr, 2)}")
            score += 0.08
        elif ttr > 0.80:
            # Very diverse = more likely human (or very short text)
            score -= 0.03

    return round(min(max(score, 0), 1.0), 2), indicators


async def detect_ai_text_async(text: str) -> dict:
    """Hybrid AI detection: SlopTotal ML engines + Russian rule-based heuristics.

    SlopTotal's calibrated score is Fakespot-dominant (English-only).
    For Russian text we use raw ML scores (BERT-RAID, E5) + our Russian heuristics.
    """
    if not text or len(text.strip()) < 50:
        return {"is_ai_generated": False, "ai_probability": 0.0, "indicators": []}

    # Step 1: Russian rule-based score
    ru_score, ru_indicators = _russian_rule_score(text)

    # Step 2: Try SlopTotal ML engines
    ml_scores = {}
    sloptotal_engines = []
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                f"{SLOPTOTAL_URL}/api/quick-score",
                json={"text": text},
            )
            if resp.status_code == 200:
                data = resp.json()
                sloptotal_engines = data.get("engines", [])
                for eng in sloptotal_engines:
                    name = eng.get("engine", "")
                    eng_score = eng.get("score", 0) / 100.0  # 0-100 → 0-1
                    ml_scores[name] = eng_score
    except Exception as e:
        logger.warning(f"SlopTotal unavailable: {e}")

    # Step 3: Hybrid scoring (Russian-optimized)
    # Use raw ML scores, NOT SlopTotal's Fakespot-calibrated score
    bert_raid = ml_scores.get("classifier_bert_raid", 0)
    e5 = ml_scores.get("classifier_e5", 0)
    tmr = ml_scores.get("classifier_tmr", 0)
    linguistic = ml_scores.get("linguistic", 0)

    indicators = list(ru_indicators)

    if ml_scores:
        # Detect language: if Russian rules found AI phrases → likely Russian text
        is_russian = ru_score > 0.15

        if is_russian:
            # Russian text: ML engines are weaker → give more weight to Russian rules
            # BERT-RAID (20%) + E5 (20%) + Russian rules (45%) + TMR (5%) + Linguistic (10%)
            ml_component = bert_raid * 0.20 + e5 * 0.20 + tmr * 0.05 + linguistic * 0.10
            hybrid_score = ml_component + ru_score * 0.45
        else:
            # English text: ML engines are strong → standard weighting
            # BERT-RAID (30%) + E5 (25%) + TMR (15%) + Linguistic (10%) + Russian rules (20%)
            ml_component = bert_raid * 0.30 + e5 * 0.25 + tmr * 0.15 + linguistic * 0.10
            hybrid_score = ml_component + ru_score * 0.20

        # Add ML engine indicators
        if bert_raid > 0.3:
            indicators.append(f"BERT-RAID:{round(bert_raid * 100)}%")
        if e5 > 0.3:
            indicators.append(f"E5:{round(e5 * 100)}%")
        if tmr > 0.3:
            indicators.append(f"TMR:{round(tmr * 100)}%")
        if linguistic > 0.2:
            indicators.append(f"Linguistic:{round(linguistic * 100)}%")

        # Confidence boost: if ML and rules agree → boost
        if (ml_component > 0.25 and ru_score > 0.25):
            hybrid_score = min(hybrid_score * 1.25, 1.0)  # Both flagged → strong boost
            indicators.append("ml+rules_agree")
        elif not is_russian and ml_component > 0.4 and ru_score == 0:
            hybrid_score = hybrid_score * 0.85  # English ML flagged but no markers → reduce
            indicators.append("no_ru_markers")

        indicators.append("hybrid_ml+ru")
    else:
        # No ML available — use Russian rules only (boosted)
        hybrid_score = min(ru_score * 1.3, 1.0)
        indicators.append("fallback_ru_only")

    hybrid_score = round(min(max(hybrid_score, 0), 1.0), 2)

    return {
        "is_ai_generated": hybrid_score >= 0.41,
        "ai_probability": hybrid_score,
        "indicators": indicators,
        "sloptotal_engines": sloptotal_engines,
        "ml_scores": {k: round(v, 3) for k, v in ml_scores.items()} if ml_scores else None,
        "russian_rule_score": round(ru_score, 2),
    }


def detect_ai_text(text: str) -> dict:
    """Sync wrapper — used in places that don't need async."""
    return _fallback_detect(text)


# --------------------------------------------------------------------------- #
# Explainable AI scoring per category
# --------------------------------------------------------------------------- #

# Keywords per category used for relevance scoring
CATEGORY_KEYWORDS: dict[str, list[str]] = {
    "experience": [
        "проект", "работал", "опыт", "стажировк", "практик", "реализов",
        "участвовал", "разработ", "создал", "внедр", "результат", "команд",
    ],
    "competencies": [
        "навык", "умени", "владею", "знани", "технолог", "инструмент",
        "программирован", "анализ", "решени", "метод", "подход", "систем",
    ],
    "motivation": [
        "хочу", "стремлюсь", "интересу", "мечт", "цель", "вдохновля",
        "развива", "учить", "расти", "достич", "амбици", "passion",
    ],
    "potential": [
        "план", "будущ", "перспектив", "рост", "развити", "карьер",
        "стратег", "виде", "стремл", "достиж", "масштаб", "возможност",
    ],
    "leadership": [
        "команд", "лидер", "руковод", "организов", "координ", "инициатив",
        "ответственн", "управл", "мотивир", "делегир", "наставн", "вдохновл",
    ],
    "growth_path": [
        "обучени", "курс", "сертификат", "книг", "менторств", "самообразован",
        "прогресс", "улучш", "освоил", "изучил", "тренинг", "практик",
    ],
}

CATEGORY_LABELS: dict[str, str] = {
    "experience": "Опыт",
    "competencies": "Компетенции",
    "motivation": "Мотивация",
    "potential": "Потенциал",
    "leadership": "Лидерство",
    "growth_path": "Траектория роста",
}


def _score_answer(text: str, category: str, is_ai: bool) -> dict:
    """Score a single answer with explanation.

    Returns {"score": int, "max": 100, "factors": [...]}
    """
    words = text.split()
    word_count = len(words)
    factors: list[str] = []
    score = 50  # base

    # --- Length factor ---
    if word_count < 20:
        score -= 20
        factors.append("Очень короткий ответ (-20)")
    elif word_count < 50:
        score -= 5
        factors.append("Краткий ответ (-5)")
    elif word_count > 100:
        score += 10
        factors.append("Развёрнутый ответ (+10)")
    elif word_count > 200:
        score += 15
        factors.append("Очень подробный ответ (+15)")

    # --- Relevance: category keywords ---
    text_lower = text.lower()
    kw = CATEGORY_KEYWORDS.get(category, [])
    matches = sum(1 for k in kw if k in text_lower)
    if matches >= 4:
        score += 20
        factors.append(f"Высокая релевантность ({matches} совпадений) (+20)")
    elif matches >= 2:
        score += 10
        factors.append(f"Средняя релевантность ({matches} совпадений) (+10)")
    elif matches == 0:
        score -= 10
        factors.append("Нет ключевых слов по теме (-10)")

    # --- Concreteness: numbers, examples ---
    has_numbers = bool(re.search(r'\d+', text))
    has_examples = any(w in text_lower for w in ["например", "пример", "случай", "ситуаци", "конкретно"])
    if has_numbers and has_examples:
        score += 15
        factors.append("Конкретные примеры и цифры (+15)")
    elif has_numbers or has_examples:
        score += 8
        factors.append("Есть примеры или цифры (+8)")

    # --- Structure ---
    sentences = [s.strip() for s in re.split(r'[.!?]+', text) if s.strip()]
    if len(sentences) >= 3:
        score += 5
        factors.append("Структурированный ответ (+5)")

    # --- AI penalty ---
    if is_ai:
        score -= 15
        factors.append("Подозрение на AI-текст (-15)")

    score = max(0, min(100, score))
    return {"score": score, "max": 100, "factors": factors}


def compute_category_scores(
    answers: list[dict], ai_flags: list[dict]
) -> tuple[dict, int, list[str], list[str], str]:
    """Compute per-category scores from answers.

    Returns (category_scores, total_score, strengths, weaknesses, summary).
    """
    ai_map = {f["question_number"]: f for f in ai_flags}
    cat_results: dict[str, list[dict]] = {}

    for ans in answers:
        cat = ans.get("category", "experience")
        qnum = ans["question_number"]
        is_ai = ai_map.get(qnum, {}).get("is_ai_generated", False)
        result = _score_answer(ans["answer_text"], cat, is_ai)
        cat_results.setdefault(cat, []).append(result)

    category_scores = {}
    for cat, results in cat_results.items():
        avg = round(sum(r["score"] for r in results) / len(results)) if results else 0
        all_factors = []
        for r in results:
            all_factors.extend(r["factors"])
        category_scores[cat] = {
            "score": avg,
            "max": 100,
            "label": CATEGORY_LABELS.get(cat, cat),
            "explanation": "; ".join(dict.fromkeys(all_factors)),  # unique, ordered
        }

    # Total = weighted average
    scores = [v["score"] for v in category_scores.values()]
    total_score = round(sum(scores) / len(scores)) if scores else 0

    # Strengths / weaknesses
    sorted_cats = sorted(category_scores.items(), key=lambda x: x[1]["score"], reverse=True)
    strengths = [
        f"{v['label']}: {v['score']}/100"
        for _, v in sorted_cats if v["score"] >= 65
    ][:4]
    weaknesses = [
        f"{v['label']}: {v['score']}/100 — требует развития"
        for _, v in sorted_cats if v["score"] < 65
    ][:3]

    # Summary
    top = sorted_cats[0][1]["label"] if sorted_cats else ""
    summary = (
        f"Абитуриент набрал {total_score}/100 баллов. "
        f"Сильнейшая категория — {top}. "
        f"Оценка основана на анализе {len(answers)} ответов по {len(category_scores)} категориям."
    )

    return category_scores, total_score, strengths, weaknesses, summary


# --------------------------------------------------------------------------- #
# Endpoints
# --------------------------------------------------------------------------- #


async def _get_draft(user_id: int, db) -> tuple:
    """Get draft profile + analysis for user, or (None, None)."""
    result = await db.execute(
        select(CandidateProfile, CandidateAnalysis)
        .join(CandidateAnalysis, CandidateAnalysis.candidate_id == CandidateProfile.id)
        .where(CandidateProfile.user_id == user_id)
        .where(CandidateAnalysis.status == AnalysisStatus.DRAFT)
    )
    row = result.one_or_none()
    return (row[0], row[1]) if row else (None, None)


@router.post("/start-application")
async def start_application(
    data: StartApplicationRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a draft application. Blocks other programs."""
    if current_user.role != UserRole.CANDIDATE:
        raise HTTPException(status_code=403, detail="Only candidates")

    # Check no existing draft or submitted application
    existing_draft, _ = await _get_draft(current_user.id, db)
    if existing_draft:
        raise HTTPException(status_code=400, detail="У вас уже есть незавершённая заявка")

    # Check no submitted application
    submitted = await db.execute(
        select(CandidateProfile)
        .join(CandidateAnalysis, CandidateAnalysis.candidate_id == CandidateProfile.id)
        .where(CandidateProfile.user_id == current_user.id)
        .where(CandidateAnalysis.status != AnalysisStatus.DRAFT)
    )
    if submitted.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Вы уже подали заявку")

    # Check vacancy
    vacancy = (await db.execute(select(Vacancy).where(Vacancy.id == data.vacancy_id))).scalar_one_or_none()
    if not vacancy:
        raise HTTPException(status_code=404, detail="Программа не найдена")
    if vacancy.application_deadline and datetime.now(timezone.utc) > vacancy.application_deadline:
        raise HTTPException(status_code=400, detail="Срок подачи заявок истёк")

    profile = CandidateProfile(
        user_id=current_user.id, vacancy_id=data.vacancy_id,
        full_name=current_user.name, email=current_user.email,
        source=CandidateSource.PLATFORM,
    )
    db.add(profile)
    await db.flush()

    analysis = CandidateAnalysis(
        candidate_id=profile.id, vacancy_id=data.vacancy_id,
        status=AnalysisStatus.DRAFT,
    )
    db.add(analysis)
    await db.commit()

    return {"message": "Черновик создан", "candidate_id": profile.id, "vacancy_id": data.vacancy_id}


@router.get("/draft", response_model=DraftResponse)
async def get_draft(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get current draft with saved answers."""
    if current_user.role != UserRole.CANDIDATE:
        raise HTTPException(status_code=403, detail="Only candidates")

    profile, analysis = await _get_draft(current_user.id, db)
    if not profile:
        raise HTTPException(status_code=404, detail="Нет черновика")

    vacancy = (await db.execute(select(Vacancy).where(Vacancy.id == profile.vacancy_id))).scalar_one_or_none()

    # Count total questions for this vacancy
    q_count = (await db.execute(
        select(func.count()).select_from(VacancyQuestion).where(VacancyQuestion.vacancy_id == profile.vacancy_id)
    )).scalar() or 0

    # Get saved answers
    answers_result = await db.execute(
        select(QuestionnaireResponse)
        .where(QuestionnaireResponse.candidate_id == profile.id)
        .order_by(QuestionnaireResponse.question_number)
    )
    saved = answers_result.scalars().all()

    return DraftResponse(
        vacancy_id=profile.vacancy_id,
        vacancy_title=vacancy.title if vacancy else "",
        total_questions=q_count,
        answered_count=len(saved),
        id_document_url=profile.id_document_url,
        answers=[
            DraftAnswerItem(question_id=a.question_number, question_text=a.question_text, answer_text=a.answer_text)
            for a in saved
        ],
    )


@router.put("/save-draft")
async def save_draft(
    data: SaveDraftRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Save partial answers to draft (upsert)."""
    if current_user.role != UserRole.CANDIDATE:
        raise HTTPException(status_code=403, detail="Only candidates")

    profile, _ = await _get_draft(current_user.id, db)
    if not profile:
        raise HTTPException(status_code=404, detail="Нет черновика")

    # Delete existing answers and re-insert
    existing = await db.execute(
        select(QuestionnaireResponse).where(QuestionnaireResponse.candidate_id == profile.id)
    )
    for row in existing.scalars().all():
        await db.delete(row)

    for idx, answer in enumerate(data.answers):
        if answer.answer_text.strip():
            db.add(QuestionnaireResponse(
                candidate_id=profile.id,
                question_number=idx + 1,
                question_text=answer.question_text,
                answer_text=answer.answer_text,
            ))

    await db.commit()
    return {"message": "Черновик сохранён", "saved_count": len(data.answers)}


@router.post("/upload-id")
async def upload_id_document(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload ID document photo."""
    if current_user.role != UserRole.CANDIDATE:
        raise HTTPException(status_code=403, detail="Only candidates")

    profile, _ = await _get_draft(current_user.id, db)
    if not profile:
        raise HTTPException(status_code=404, detail="Нет черновика")

    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Файл должен быть изображением")

    contents = await file.read()
    if len(contents) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Файл слишком большой (макс. 10MB)")

    upload_dir = "/app/uploads/documents"
    os.makedirs(upload_dir, exist_ok=True)
    ext = (file.filename or "doc.jpg").split(".")[-1]
    filename = f"{current_user.id}_{uuid.uuid4().hex[:8]}.{ext}"
    filepath = os.path.join(upload_dir, filename)

    with open(filepath, "wb") as f:
        f.write(contents)

    profile.id_document_url = f"/uploads/documents/{filename}"
    await db.commit()

    return {"id_document_url": profile.id_document_url}


@router.delete("/draft")
async def delete_draft(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete draft application — frees up program selection."""
    if current_user.role != UserRole.CANDIDATE:
        raise HTTPException(status_code=403, detail="Only candidates")

    profile, analysis = await _get_draft(current_user.id, db)
    if not profile:
        raise HTTPException(status_code=404, detail="Нет черновика")

    # Delete answers first (FK constraint)
    answers = await db.execute(
        select(QuestionnaireResponse).where(QuestionnaireResponse.candidate_id == profile.id)
    )
    for a in answers.scalars().all():
        await db.delete(a)
    await db.flush()

    # Delete analysis (FK to profile)
    await db.delete(analysis)
    await db.flush()

    # Delete profile
    await db.delete(profile)
    await db.commit()

    return {"message": "Черновик удалён"}


@router.post("/submit-application")
async def submit_application(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Submit draft → run AI detection → create full analysis."""
    if current_user.role != UserRole.CANDIDATE:
        raise HTTPException(status_code=403, detail="Only candidates")

    profile, analysis = await _get_draft(current_user.id, db)
    if not profile:
        raise HTTPException(status_code=404, detail="Нет черновика")

    # Get answers
    answers_result = await db.execute(
        select(QuestionnaireResponse)
        .where(QuestionnaireResponse.candidate_id == profile.id)
        .order_by(QuestionnaireResponse.question_number)
    )
    saved_answers = answers_result.scalars().all()

    # Count expected questions
    q_count = (await db.execute(
        select(func.count()).select_from(VacancyQuestion).where(VacancyQuestion.vacancy_id == profile.vacancy_id)
    )).scalar() or 0

    if len(saved_answers) < q_count:
        raise HTTPException(status_code=400, detail=f"Заполнено {len(saved_answers)} из {q_count} вопросов")

    if not profile.id_document_url:
        raise HTTPException(status_code=400, detail="Загрузите удостоверение личности")

    # Resolve question categories
    vq_result = await db.execute(
        select(VacancyQuestion, Question)
        .join(Question, VacancyQuestion.question_id == Question.id)
        .where(VacancyQuestion.vacancy_id == profile.vacancy_id)
        .order_by(VacancyQuestion.order)
    )
    vq_rows = vq_result.all()
    q_by_order = {vq.order: q for vq, q in vq_rows}

    # AI detection + scoring
    ai_flags = []
    answer_data_for_scoring = []
    for ans in saved_answers:
        detection = await detect_ai_text_async(ans.answer_text)
        if detection["is_ai_generated"] or detection["ai_probability"] > 0.3:
            ai_flags.append({
                "question_number": ans.question_number,
                "ai_probability": detection["ai_probability"],
                "is_ai_generated": detection["is_ai_generated"],
                "indicators": detection["indicators"],
            })

        q = q_by_order.get(ans.question_number)
        answer_data_for_scoring.append({
            "question_number": ans.question_number,
            "answer_text": ans.answer_text,
            "category": q.category.value if q else "experience",
        })

    category_scores, total_score, strengths, weaknesses, summary = compute_category_scores(
        answer_data_for_scoring, ai_flags
    )

    vacancy_match = round(total_score / 100, 2)
    gp_score = category_scores.get("growth_path", {}).get("score", 50)
    growth_potential = "A" if total_score >= 80 else "B" if total_score >= 60 else "C"

    # Update analysis from DRAFT → ANALYZED
    analysis.status = AnalysisStatus.ANALYZED
    analysis.total_score = total_score
    analysis.vacancy_match = vacancy_match
    analysis.growth_potential = growth_potential
    analysis.growth_path_score = round(gp_score / 100, 2)
    analysis.strengths = strengths
    analysis.weaknesses = weaknesses
    analysis.summary = summary
    analysis.ai_detection_flags = ai_flags
    analysis.category_scores = category_scores

    await db.commit()

    return {"message": "Заявка отправлена на AI-проверку", "analysis_id": analysis.id, "total_score": total_score}


@router.post("/submit-questionnaire")
async def submit_questionnaire(
    data: SubmitQuestionnaireRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Submit questionnaire answers. Auth required (candidate role)."""
    if current_user.role != UserRole.CANDIDATE:
        raise HTTPException(status_code=403, detail="Only candidates can submit questionnaires")

    # Check vacancy exists
    result = await db.execute(select(Vacancy).where(Vacancy.id == data.vacancy_id))
    vacancy = result.scalar_one_or_none()
    if not vacancy:
        raise HTTPException(status_code=404, detail="Vacancy not found")

    # Check deadline
    if vacancy.application_deadline and datetime.now(timezone.utc) > vacancy.application_deadline:
        raise HTTPException(status_code=400, detail="Срок подачи заявок истёк")

    # Create CandidateProfile
    profile = CandidateProfile(
        user_id=current_user.id,
        vacancy_id=data.vacancy_id,
        full_name=current_user.name,
        email=current_user.email,
        source=CandidateSource.PLATFORM,
    )
    db.add(profile)
    await db.flush()

    # Resolve question categories for scoring
    question_ids = [a.question_id for a in data.answers]
    q_result = await db.execute(select(Question).where(Question.id.in_(question_ids)))
    question_map = {q.id: q for q in q_result.scalars().all()}

    # Create QuestionnaireResponse for each answer + run AI detection
    ai_flags = []
    answer_data_for_scoring = []
    for idx, answer in enumerate(data.answers):
        response = QuestionnaireResponse(
            candidate_id=profile.id,
            question_number=idx + 1,
            question_text=answer.question_text,
            answer_text=answer.answer_text,
        )
        db.add(response)

        # AI detection per answer (async — calls SlopTotal ML service)
        detection = await detect_ai_text_async(answer.answer_text)
        if detection["is_ai_generated"] or detection["ai_probability"] > 0.3:
            ai_flags.append({
                "question_number": idx + 1,
                "ai_probability": detection["ai_probability"],
                "is_ai_generated": detection["is_ai_generated"],
                "indicators": detection["indicators"],
            })

        # Collect data for scoring
        q = question_map.get(answer.question_id)
        answer_data_for_scoring.append({
            "question_number": idx + 1,
            "answer_text": answer.answer_text,
            "category": q.category.value if q else "experience",
        })

    # Explainable AI scoring
    category_scores, total_score, strengths, weaknesses, summary = compute_category_scores(
        answer_data_for_scoring, ai_flags
    )

    # Derived metrics
    vacancy_match = round(total_score / 100, 2)
    gp_score = category_scores.get("growth_path", {}).get("score", 50)
    growth_potential = "A" if total_score >= 80 else "B" if total_score >= 60 else "C"

    analysis = CandidateAnalysis(
        candidate_id=profile.id,
        vacancy_id=data.vacancy_id,
        status=AnalysisStatus.ANALYZED,
        total_score=total_score,
        vacancy_match=vacancy_match,
        growth_potential=growth_potential,
        growth_path_score=round(gp_score / 100, 2),
        strengths=strengths,
        weaknesses=weaknesses,
        summary=summary,
        ai_detection_flags=ai_flags,
        category_scores=category_scores,
    )
    db.add(analysis)
    await db.commit()
    await db.refresh(profile)
    await db.refresh(analysis)

    return {
        "message": "Questionnaire submitted successfully",
        "candidate_id": profile.id,
        "analysis_id": analysis.id,
    }


@router.get("/my-status", response_model=MyStatusResponse)
async def my_status(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get current candidate application status. Auth required (candidate role)."""
    if current_user.role != UserRole.CANDIDATE:
        raise HTTPException(status_code=403, detail="Only candidates can view their status")

    result = await db.execute(
        select(CandidateProfile)
        .where(CandidateProfile.user_id == current_user.id)
        .order_by(CandidateProfile.created_at.desc())
        .limit(1)
    )
    profile = result.scalar_one_or_none()

    if not profile:
        return MyStatusResponse(has_application=False)

    analysis_result = await db.execute(
        select(CandidateAnalysis).where(CandidateAnalysis.candidate_id == profile.id)
    )
    analysis = analysis_result.scalar_one_or_none()

    vacancy_result = await db.execute(
        select(Vacancy).where(Vacancy.id == profile.vacancy_id)
    )
    vacancy = vacancy_result.scalar_one_or_none()

    is_draft = analysis and analysis.status == AnalysisStatus.DRAFT

    # Count progress for drafts
    draft_progress = None
    if is_draft:
        ans_count = (await db.execute(
            select(func.count()).select_from(QuestionnaireResponse)
            .where(QuestionnaireResponse.candidate_id == profile.id)
        )).scalar() or 0
        q_count = (await db.execute(
            select(func.count()).select_from(VacancyQuestion)
            .where(VacancyQuestion.vacancy_id == profile.vacancy_id)
        )).scalar() or 0
        draft_progress = f"{ans_count}/{q_count}"

    return MyStatusResponse(
        has_application=not is_draft,
        status=analysis.status.value if analysis and not is_draft else None,
        vacancy_title=vacancy.title if vacancy and not is_draft else None,
        total_score=analysis.total_score if analysis and not is_draft else None,
        manager_comment=analysis.manager_comment if analysis and not is_draft else None,
        draft_exists=is_draft,
        draft_vacancy_id=profile.vacancy_id if is_draft else None,
        draft_vacancy_title=vacancy.title if vacancy and is_draft else None,
        draft_progress=draft_progress,
    )
