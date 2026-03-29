import re
import statistics
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.api.v1.auth import get_current_user
from app.models.user import User, UserRole
from app.models.vacancy import Vacancy
from app.models.candidate import CandidateProfile, CandidateSource
from app.models.question import Question
from app.models.questionnaire import QuestionnaireResponse
from app.models.analysis import CandidateAnalysis, AnalysisStatus
from app.schemas.candidate import SubmitQuestionnaireRequest, MyStatusResponse

router = APIRouter()


# --------------------------------------------------------------------------- #
# Simple rule-based AI text detection (inline, no ML service call needed)
# --------------------------------------------------------------------------- #

AI_PATTERNS_RU = [
    "безусловно", "стоит отметить", "важно подчеркнуть", "в заключение",
    "таким образом", "необходимо отметить", "следует отметить",
    "в первую очередь", "в конечном итоге", "подводя итог",
    "нельзя не отметить", "в рамках данного", "на основании вышеизложенного",
]


def detect_ai_text(text: str) -> dict:
    """Rule-based AI-generated text detection."""
    indicators = []
    score = 0.0

    if not text or len(text.split()) < 10:
        return {"is_ai_generated": False, "ai_probability": 0.0, "indicators": []}

    words = text.split()
    sentences = [s.strip() for s in re.split(r'[.!?]+', text) if s.strip()]

    # 1. Sentence length uniformity
    if len(sentences) >= 3:
        lengths = [len(s.split()) for s in sentences]
        std = statistics.stdev(lengths) if len(lengths) > 1 else 0
        if std < 4:
            indicators.append("uniform_sentence_length")
            score += 0.2

    # 2. Type-token ratio (lexical diversity)
    unique = len(set(w.lower() for w in words))
    ttr = unique / len(words) if words else 0
    if len(words) > 50 and ttr > 0.75:
        indicators.append("high_lexical_diversity")
        score += 0.15

    # 3. ChatGPT patterns
    text_lower = text.lower()
    found_patterns = [p for p in AI_PATTERNS_RU if p in text_lower]
    if len(found_patterns) >= 2:
        indicators.append(f"ai_phrases:{','.join(found_patterns[:3])}")
        score += 0.25
    elif len(found_patterns) == 1:
        score += 0.1

    # 4. Structured text (bullets, numbering)
    if re.search(r'^\s*[\d]+[.)]\s', text, re.MULTILINE) or re.search(r'^\s*[-•]\s', text, re.MULTILINE):
        indicators.append("structured_formatting")
        score += 0.15

    # 5. Very long answer
    if len(words) > 300:
        indicators.append("unusually_long")
        score += 0.15

    probability = min(score, 1.0)
    return {
        "is_ai_generated": probability >= 0.5,
        "ai_probability": round(probability, 2),
        "indicators": indicators,
    }


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

        # AI detection per answer
        detection = detect_ai_text(answer.answer_text)
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

    return MyStatusResponse(
        has_application=True,
        status=analysis.status.value if analysis else None,
        vacancy_title=vacancy.title if vacancy else None,
        total_score=analysis.total_score if analysis else None,
        manager_comment=analysis.manager_comment if analysis else None,
    )
