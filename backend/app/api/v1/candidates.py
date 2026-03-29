import random
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

    # Create QuestionnaireResponse for each answer
    for idx, answer in enumerate(data.answers):
        response = QuestionnaireResponse(
            candidate_id=profile.id,
            question_number=idx + 1,
            question_text=answer.question_text,
            answer_text=answer.answer_text,
        )
        db.add(response)

    # Create CandidateAnalysis with mock data
    analysis = CandidateAnalysis(
        candidate_id=profile.id,
        vacancy_id=data.vacancy_id,
        status=AnalysisStatus.ANALYZED,
        total_score=random.randint(60, 95),
        vacancy_match=round(random.uniform(0.6, 0.95), 2),
        growth_potential=random.choice(["A", "B", "C"]),
        strengths=["Хорошие коммуникативные навыки", "Релевантный опыт"],
        weaknesses=["Требуется развитие лидерских качеств"],
        summary="Кандидат демонстрирует хороший потенциал.",
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

    # Find latest CandidateProfile for this user
    result = await db.execute(
        select(CandidateProfile)
        .where(CandidateProfile.user_id == current_user.id)
        .order_by(CandidateProfile.created_at.desc())
        .limit(1)
    )
    profile = result.scalar_one_or_none()

    if not profile:
        return MyStatusResponse(has_application=False)

    # Get analysis for this profile
    analysis_result = await db.execute(
        select(CandidateAnalysis).where(CandidateAnalysis.candidate_id == profile.id)
    )
    analysis = analysis_result.scalar_one_or_none()

    # Get vacancy title
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
