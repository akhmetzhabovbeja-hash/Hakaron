from pydantic import BaseModel
from fastapi import APIRouter, HTTPException, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.api.v1.auth import get_current_user
from app.models.user import User, UserRole
from app.models.vacancy import Vacancy
from app.models.candidate import CandidateProfile
from app.models.questionnaire import QuestionnaireResponse
from app.models.analysis import CandidateAnalysis, AnalysisStatus
from app.schemas.candidate import CandidateListResponse, CandidateAnalysisResponse, CandidateDossierResponse, AnswerItem


class ManagerDecisionRequest(BaseModel):
    comment: str = ""

router = APIRouter()


def _require_manager(user: User) -> None:
    """Raise 403 if user is not a manager."""
    if user.role != UserRole.MANAGER:
        raise HTTPException(status_code=403, detail="Manager role required")


@router.get("/candidates", response_model=list[CandidateListResponse])
async def list_candidates(
    vacancy_id: int | None = Query(None),
    sort_by: str = Query("score"),
    search: str | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List candidates with status SENT_TO_MANAGER."""
    _require_manager(current_user)

    stmt = (
        select(CandidateAnalysis, CandidateProfile, Vacancy)
        .join(CandidateProfile, CandidateAnalysis.candidate_id == CandidateProfile.id)
        .join(Vacancy, CandidateAnalysis.vacancy_id == Vacancy.id)
        .where(CandidateAnalysis.status == AnalysisStatus.SENT_TO_MANAGER)
    )

    if vacancy_id is not None:
        stmt = stmt.where(CandidateAnalysis.vacancy_id == vacancy_id)

    if search:
        stmt = stmt.where(
            CandidateProfile.full_name.ilike(f"%{search}%")
            | CandidateProfile.email.ilike(f"%{search}%")
        )

    if sort_by == "score":
        stmt = stmt.order_by(CandidateAnalysis.total_score.desc())
    else:
        stmt = stmt.order_by(CandidateAnalysis.created_at.desc())

    result = await db.execute(stmt)
    rows = result.all()

    return [
        CandidateListResponse(
            id=analysis.id,
            candidate_id=profile.id,
            full_name=profile.full_name,
            email=profile.email,
            vacancy_title=vacancy.title,
            total_score=analysis.total_score,
            vacancy_match=analysis.vacancy_match,
            status=analysis.status.value,
            source=profile.source.value,
            ai_flags_count=len(analysis.ai_detection_flags or []),
            ai_suspected=any(f.get("is_ai_generated") for f in (analysis.ai_detection_flags or [])),
        )
        for analysis, profile, vacancy in rows
    ]


@router.get("/candidates/{analysis_id}/analysis", response_model=CandidateAnalysisResponse)
async def get_analysis(
    analysis_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get full candidate analysis."""
    _require_manager(current_user)

    result = await db.execute(
        select(CandidateAnalysis, CandidateProfile, Vacancy)
        .join(CandidateProfile, CandidateAnalysis.candidate_id == CandidateProfile.id)
        .join(Vacancy, CandidateAnalysis.vacancy_id == Vacancy.id)
        .where(CandidateAnalysis.id == analysis_id)
    )
    row = result.one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Analysis not found")

    analysis, profile, vacancy = row

    return CandidateAnalysisResponse(
        id=analysis.id,
        candidate_id=profile.id,
        full_name=profile.full_name,
        email=profile.email,
        vacancy_title=vacancy.title,
        total_score=analysis.total_score,
        vacancy_match=analysis.vacancy_match,
        growth_potential=analysis.growth_potential,
        growth_path_score=analysis.growth_path_score,
        strengths=analysis.strengths,
        weaknesses=analysis.weaknesses,
        summary=analysis.summary,
        status=analysis.status.value,
        ai_detection_flags=analysis.ai_detection_flags or [],
        category_scores=analysis.category_scores,
        manager_comment=analysis.manager_comment,
    )


@router.post("/candidates/{analysis_id}/approve")
async def approve_candidate(
    analysis_id: int,
    body: ManagerDecisionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Approve a candidate with optional comment."""
    _require_manager(current_user)

    result = await db.execute(
        select(CandidateAnalysis).where(CandidateAnalysis.id == analysis_id)
    )
    analysis = result.scalar_one_or_none()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")

    analysis.status = AnalysisStatus.APPROVED
    analysis.approved_by = current_user.id
    if body.comment:
        analysis.manager_comment = body.comment
    await db.commit()

    return {"message": "Candidate approved", "candidate_id": analysis.candidate_id}


@router.post("/candidates/{analysis_id}/reject")
async def reject_candidate(
    analysis_id: int,
    body: ManagerDecisionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Reject a candidate with optional comment."""
    _require_manager(current_user)

    result = await db.execute(
        select(CandidateAnalysis).where(CandidateAnalysis.id == analysis_id)
    )
    analysis = result.scalar_one_or_none()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")

    analysis.status = AnalysisStatus.REJECTED
    if body.comment:
        analysis.manager_comment = body.comment
    await db.commit()

    return {"message": "Candidate rejected", "candidate_id": analysis.candidate_id}


@router.get("/candidates/{analysis_id}/dossier", response_model=CandidateDossierResponse)
async def get_candidate_dossier(
    analysis_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get full dossier for commission review."""
    _require_manager(current_user)

    result = await db.execute(
        select(CandidateAnalysis, CandidateProfile, Vacancy)
        .join(CandidateProfile, CandidateAnalysis.candidate_id == CandidateProfile.id)
        .join(Vacancy, CandidateAnalysis.vacancy_id == Vacancy.id)
        .where(CandidateAnalysis.id == analysis_id)
    )
    row = result.one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Not found")

    analysis, profile, vacancy = row

    user_result = await db.execute(select(User).where(User.id == profile.user_id))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    answers_result = await db.execute(
        select(QuestionnaireResponse)
        .where(QuestionnaireResponse.candidate_id == profile.id)
        .order_by(QuestionnaireResponse.question_number)
    )
    answers = answers_result.scalars().all()

    return CandidateDossierResponse(
        name=user.name, email=user.email, phone=user.phone, bio=user.bio,
        avatar_url=user.avatar_url, id_document_url=profile.id_document_url,
        total_score=analysis.total_score, vacancy_match=analysis.vacancy_match,
        growth_potential=analysis.growth_potential, growth_path_score=analysis.growth_path_score,
        strengths=analysis.strengths or [], weaknesses=analysis.weaknesses or [],
        summary=analysis.summary, status=analysis.status.value, vacancy_title=vacancy.title,
        ai_detection_flags=analysis.ai_detection_flags or [],
        category_scores=analysis.category_scores, manager_comment=analysis.manager_comment,
        answers=[AnswerItem(question_number=a.question_number, question_text=a.question_text, answer_text=a.answer_text) for a in answers],
    )
