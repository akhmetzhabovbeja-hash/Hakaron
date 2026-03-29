from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.auth import get_current_user
from app.core.database import get_db
from app.models.user import User, UserRole
from app.models.vacancy import Vacancy
from app.models.question import Question, QuestionCategory
from app.models.vacancy_question import VacancyQuestion
from app.models.candidate import CandidateProfile
from app.models.analysis import CandidateAnalysis, AnalysisStatus
from app.schemas.vacancy import VacancyCreate, VacancyResponse, VacancyDetailResponse, QuestionInVacancy
from app.schemas.question import QuestionResponse, QuestionCreate, VacancyQuestionAssign
from app.models.questionnaire import QuestionnaireResponse
from app.schemas.candidate import CandidateListResponse, CandidateAnalysisResponse, CandidateDossierResponse, AnswerItem

router = APIRouter()


def _require_hr(user: User) -> None:
    """Raise 403 if the user is not an HR."""
    if user.role != UserRole.HR:
        raise HTTPException(status_code=403, detail="HR role required")


# ---------------------------------------------------------------------------
# Vacancies
# ---------------------------------------------------------------------------


@router.get("/vacancies", response_model=list[VacancyResponse])
async def list_vacancies(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all vacancies (HR only)."""
    _require_hr(current_user)
    result = await db.execute(select(Vacancy).order_by(Vacancy.created_at.desc()))
    return result.scalars().all()


@router.post("/vacancies", response_model=VacancyResponse, status_code=201)
async def create_vacancy(
    data: VacancyCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new vacancy (HR only)."""
    _require_hr(current_user)
    vacancy = Vacancy(
        title=data.title,
        description=data.description,
        requirements=data.requirements,
        created_by=current_user.id,
    )
    db.add(vacancy)
    await db.commit()
    await db.refresh(vacancy)
    return vacancy


@router.get("/vacancies/{vacancy_id}", response_model=VacancyDetailResponse)
async def get_vacancy(
    vacancy_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get vacancy details with assigned questions (HR only)."""
    _require_hr(current_user)

    result = await db.execute(select(Vacancy).where(Vacancy.id == vacancy_id))
    vacancy = result.scalar_one_or_none()
    if not vacancy:
        raise HTTPException(status_code=404, detail="Vacancy not found")

    # Fetch questions joined through VacancyQuestion, ordered by VacancyQuestion.order
    q_result = await db.execute(
        select(Question, VacancyQuestion.order)
        .join(VacancyQuestion, VacancyQuestion.question_id == Question.id)
        .where(VacancyQuestion.vacancy_id == vacancy_id)
        .order_by(VacancyQuestion.order)
    )
    rows = q_result.all()

    questions = [
        QuestionInVacancy(
            id=question.id,
            text=question.text,
            category=question.category.value,
            order=order,
        )
        for question, order in rows
    ]

    return VacancyDetailResponse(
        id=vacancy.id,
        title=vacancy.title,
        description=vacancy.description,
        requirements=vacancy.requirements,
        is_active=vacancy.is_active,
        questions=questions,
    )


# ---------------------------------------------------------------------------
# Questions bank
# ---------------------------------------------------------------------------


@router.get("/questions/bank", response_model=list[QuestionResponse])
async def list_questions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all system questions and custom questions created by this HR."""
    _require_hr(current_user)
    result = await db.execute(
        select(Question).where(
            or_(
                Question.is_system == True,  # noqa: E712
                Question.created_by == current_user.id,
            )
        )
    )
    return result.scalars().all()


@router.post("/questions", response_model=QuestionResponse, status_code=201)
async def create_question(
    data: QuestionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a custom question (HR only)."""
    _require_hr(current_user)
    question = Question(
        text=data.text,
        category=QuestionCategory(data.category),
        is_system=False,
        created_by=current_user.id,
    )
    db.add(question)
    await db.commit()
    await db.refresh(question)
    return question


# ---------------------------------------------------------------------------
# Assign questions to vacancy
# ---------------------------------------------------------------------------


@router.post("/vacancies/{vacancy_id}/questions", status_code=201)
async def assign_questions_to_vacancy(
    vacancy_id: int,
    data: VacancyQuestionAssign,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Assign a list of questions to a vacancy (HR only).

    Replaces any previously assigned questions. Order is determined by list position.
    """
    _require_hr(current_user)

    # Verify vacancy exists
    result = await db.execute(select(Vacancy).where(Vacancy.id == vacancy_id))
    vacancy = result.scalar_one_or_none()
    if not vacancy:
        raise HTTPException(status_code=404, detail="Vacancy not found")

    # Remove existing assignments
    existing = await db.execute(
        select(VacancyQuestion).where(VacancyQuestion.vacancy_id == vacancy_id)
    )
    for vq in existing.scalars().all():
        await db.delete(vq)

    # Create new assignments with order based on list position
    for idx, question_id in enumerate(data.question_ids):
        # Verify question exists
        q_result = await db.execute(select(Question).where(Question.id == question_id))
        if not q_result.scalar_one_or_none():
            raise HTTPException(
                status_code=404, detail=f"Question with id {question_id} not found"
            )
        vq = VacancyQuestion(
            vacancy_id=vacancy_id,
            question_id=question_id,
            order=idx,
        )
        db.add(vq)

    await db.commit()
    return {"message": "Questions assigned", "count": len(data.question_ids)}


# ---------------------------------------------------------------------------
# Candidates review
# ---------------------------------------------------------------------------


@router.get("/candidates", response_model=list[CandidateListResponse])
async def list_analyzed_candidates(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List candidates with ANALYZED status (ready for HR review)."""
    _require_hr(current_user)
    result = await db.execute(
        select(CandidateAnalysis, CandidateProfile, Vacancy)
        .join(CandidateProfile, CandidateAnalysis.candidate_id == CandidateProfile.id)
        .join(Vacancy, CandidateAnalysis.vacancy_id == Vacancy.id)
        .where(CandidateAnalysis.status == AnalysisStatus.ANALYZED)
        .order_by(CandidateAnalysis.total_score.desc())
    )
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
        )
        for analysis, profile, vacancy in rows
    ]


@router.get("/candidates/{analysis_id}", response_model=CandidateAnalysisResponse)
async def get_candidate_analysis(
    analysis_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get full analysis details for HR review."""
    _require_hr(current_user)
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
        strengths=analysis.strengths or [],
        weaknesses=analysis.weaknesses or [],
        summary=analysis.summary,
        status=analysis.status.value,
    )


@router.post("/candidates/{analysis_id}/send-to-manager")
async def send_to_manager(
    analysis_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Send candidate analysis to manager for approval."""
    _require_hr(current_user)
    result = await db.execute(
        select(CandidateAnalysis).where(CandidateAnalysis.id == analysis_id)
    )
    analysis = result.scalar_one_or_none()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")

    if analysis.status not in (AnalysisStatus.ANALYZED, AnalysisStatus.HR_REVIEW):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot send to manager from status '{analysis.status.value}'",
        )

    analysis.status = AnalysisStatus.SENT_TO_MANAGER
    analysis.hr_reviewed_by = current_user.id
    analysis.sent_to_manager_at = datetime.now(timezone.utc)
    await db.commit()

    return {"message": "Candidate sent to manager for review", "analysis_id": analysis_id}


# ---------------------------------------------------------------------------
# Approved candidates
# ---------------------------------------------------------------------------


@router.get("/approved", response_model=list[CandidateListResponse])
async def list_approved_candidates(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List candidates approved by manager."""
    _require_hr(current_user)
    result = await db.execute(
        select(CandidateAnalysis, CandidateProfile, Vacancy)
        .join(CandidateProfile, CandidateAnalysis.candidate_id == CandidateProfile.id)
        .join(Vacancy, CandidateAnalysis.vacancy_id == Vacancy.id)
        .where(CandidateAnalysis.status == AnalysisStatus.APPROVED)
        .order_by(CandidateAnalysis.total_score.desc())
    )
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
        )
        for analysis, profile, vacancy in rows
    ]


# ---------------------------------------------------------------------------
# Invite candidate (placeholder)
# ---------------------------------------------------------------------------


@router.post("/candidates/{analysis_id}/invite")
async def invite_candidate(
    analysis_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Invite an approved candidate (placeholder for email integration)."""
    _require_hr(current_user)

    result = await db.execute(
        select(CandidateAnalysis).where(CandidateAnalysis.id == analysis_id)
    )
    analysis = result.scalar_one_or_none()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")

    if analysis.status != AnalysisStatus.APPROVED:
        raise HTTPException(
            status_code=400,
            detail="Only approved candidates can be invited",
        )

    return {"message": "Invitation sent successfully", "analysis_id": analysis_id}


# ---------------------------------------------------------------------------
# Candidates per vacancy (all statuses)
# ---------------------------------------------------------------------------


@router.get("/vacancies/{vacancy_id}/candidates", response_model=list[CandidateListResponse])
async def list_vacancy_candidates(
    vacancy_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List ALL candidates for a specific vacancy (all statuses)."""
    _require_hr(current_user)

    # Verify vacancy exists
    vac_result = await db.execute(select(Vacancy).where(Vacancy.id == vacancy_id))
    if not vac_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Vacancy not found")

    result = await db.execute(
        select(CandidateAnalysis, CandidateProfile, Vacancy)
        .join(CandidateProfile, CandidateAnalysis.candidate_id == CandidateProfile.id)
        .join(Vacancy, CandidateAnalysis.vacancy_id == Vacancy.id)
        .where(CandidateAnalysis.vacancy_id == vacancy_id)
        .order_by(CandidateAnalysis.total_score.desc())
    )
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
        )
        for analysis, profile, vacancy in rows
    ]


# ---------------------------------------------------------------------------
# Candidate dossier
# ---------------------------------------------------------------------------


@router.get("/candidates/{analysis_id}/dossier", response_model=CandidateDossierResponse)
async def get_candidate_dossier(
    analysis_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get full dossier for a candidate including user info and questionnaire answers."""
    _require_hr(current_user)

    # Get analysis + profile + vacancy
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

    # Get user info
    user_result = await db.execute(select(User).where(User.id == profile.user_id))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Get questionnaire answers
    answers_result = await db.execute(
        select(QuestionnaireResponse)
        .where(QuestionnaireResponse.candidate_id == profile.id)
        .order_by(QuestionnaireResponse.question_number)
    )
    answers = answers_result.scalars().all()

    return CandidateDossierResponse(
        name=user.name,
        email=user.email,
        phone=user.phone,
        bio=user.bio,
        avatar_url=user.avatar_url,
        total_score=analysis.total_score,
        vacancy_match=analysis.vacancy_match,
        growth_potential=analysis.growth_potential,
        strengths=analysis.strengths or [],
        weaknesses=analysis.weaknesses or [],
        summary=analysis.summary,
        status=analysis.status.value,
        vacancy_title=vacancy.title,
        answers=[
            AnswerItem(
                question_number=a.question_number,
                question_text=a.question_text,
                answer_text=a.answer_text,
            )
            for a in answers
        ],
    )
