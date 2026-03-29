import random
import re
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.api.v1.auth import get_current_user
from app.models.user import User, UserRole
from app.models.vacancy import Vacancy
from app.models.candidate import CandidateProfile, CandidateSource
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
        import statistics
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

    # Create QuestionnaireResponse for each answer + run AI detection
    ai_flags = []
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

    # Create CandidateAnalysis with mock data + AI detection + growth path
    analysis = CandidateAnalysis(
        candidate_id=profile.id,
        vacancy_id=data.vacancy_id,
        status=AnalysisStatus.ANALYZED,
        total_score=random.randint(60, 95),
        vacancy_match=round(random.uniform(0.6, 0.95), 2),
        growth_potential=random.choice(["A", "B", "C"]),
        growth_path_score=round(random.uniform(0.4, 0.95), 2),
        strengths=[
            "Хорошие коммуникативные навыки",
            "Высокая мотивация к обучению",
            "Релевантный опыт проектной работы",
        ],
        weaknesses=[
            "Требуется развитие лидерских качеств",
            "Ограниченный опыт командной работы",
        ],
        summary="Абитуриент демонстрирует хороший потенциал для обучения в inVision U. "
        "Выраженная мотивация и способность к самостоятельному обучению.",
        ai_detection_flags=ai_flags,
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
    )
