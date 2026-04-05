"""Telegram linking API — generates time-based codes for account binding."""
import random
import time
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.api.v1.auth import get_current_user
import httpx
import logging

logger = logging.getLogger(__name__)
from app.models.user import User, UserRole
from app.models.analysis import CandidateAnalysis, AnalysisStatus
from app.models.candidate import CandidateProfile
from app.models.vacancy import Vacancy
from app.models.proactive import ProactiveSurvey

router = APIRouter()

# In-memory code store: {user_id: (code, expires_at)}
_link_codes: dict[int, tuple[str, float]] = {}


class LinkCodeResponse(BaseModel):
    code: str
    expires_in: int  # seconds


class VerifyCodeRequest(BaseModel):
    code: str
    telegram_id: int
    telegram_username: str | None = None


class VerifyCodeResponse(BaseModel):
    success: bool
    user_id: int | None = None
    name: str | None = None
    role: str | None = None


@router.get("/link-status")
async def get_link_status(
    current_user: User = Depends(get_current_user),
):
    """Check if current user has Telegram linked."""
    return {
        "linked": current_user.telegram_id is not None,
        "telegram_id": current_user.telegram_id,
        "telegram_username": current_user.telegram_username,
    }


@router.post("/generate-code", response_model=LinkCodeResponse)
async def generate_link_code(
    current_user: User = Depends(get_current_user),
):
    """Generate 6-digit code for Telegram linking. Valid for 60 seconds."""
    code = f"{random.randint(100000, 999999)}"
    expires_at = time.time() + 60
    _link_codes[current_user.id] = (code, expires_at)
    return LinkCodeResponse(code=code, expires_in=60)


@router.post("/verify-code", response_model=VerifyCodeResponse)
async def verify_link_code(
    data: VerifyCodeRequest,
    db: AsyncSession = Depends(get_db),
):
    """Verify code and link Telegram account. Called by the bot."""
    # Find user with this code
    now = time.time()
    matched_user_id = None

    for user_id, (code, expires_at) in list(_link_codes.items()):
        if expires_at < now:
            del _link_codes[user_id]  # cleanup expired
            continue
        if code == data.code:
            matched_user_id = user_id
            break

    if not matched_user_id:
        return VerifyCodeResponse(success=False)

    # Link telegram_id to user
    result = await db.execute(select(User).where(User.id == matched_user_id))
    user = result.scalar_one_or_none()
    if not user:
        return VerifyCodeResponse(success=False)

    user.telegram_id = data.telegram_id
    if data.telegram_username:
        user.telegram_username = data.telegram_username
    await db.commit()

    # Remove used code
    _link_codes.pop(matched_user_id, None)

    return VerifyCodeResponse(
        success=True,
        user_id=user.id,
        name=user.name,
        role=user.role.value,
    )


@router.get("/me")
async def get_telegram_user(
    telegram_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Get user info by telegram_id. Called by the bot."""
    result = await db.execute(select(User).where(User.telegram_id == telegram_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Not linked")
    return {
        "user_id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role.value,
    }


@router.get("/candidate-status")
async def get_candidate_status(
    telegram_id: int = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """Get candidate application status. Called by bot."""
    user = (await db.execute(select(User).where(User.telegram_id == telegram_id))).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Not linked")

    profile = (await db.execute(
        select(CandidateProfile).where(CandidateProfile.user_id == user.id)
        .order_by(CandidateProfile.created_at.desc()).limit(1)
    )).scalar_one_or_none()
    if not profile:
        return None

    analysis = (await db.execute(
        select(CandidateAnalysis).where(CandidateAnalysis.candidate_id == profile.id)
    )).scalar_one_or_none()

    vacancy = (await db.execute(
        select(Vacancy).where(Vacancy.id == profile.vacancy_id)
    )).scalar_one_or_none()

    return {
        "status": analysis.status.value if analysis else "draft",
        "vacancy_title": vacancy.title if vacancy else None,
        "total_score": analysis.total_score if analysis else None,
        "manager_comment": analysis.manager_comment if analysis else None,
    }


@router.get("/applications")
async def get_applications(
    telegram_id: int = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """Get new applications for HR/Manager. Called by bot."""
    user = (await db.execute(select(User).where(User.telegram_id == telegram_id))).scalar_one_or_none()
    if not user or user.role not in (UserRole.HR, UserRole.MANAGER):
        raise HTTPException(status_code=403, detail="Staff only")

    if user.role == UserRole.HR:
        status_filter = AnalysisStatus.ANALYZED
    else:
        status_filter = AnalysisStatus.SENT_TO_MANAGER

    result = await db.execute(
        select(CandidateAnalysis, CandidateProfile, Vacancy)
        .join(CandidateProfile, CandidateAnalysis.candidate_id == CandidateProfile.id)
        .join(Vacancy, CandidateAnalysis.vacancy_id == Vacancy.id)
        .where(CandidateAnalysis.status == status_filter)
        .order_by(CandidateAnalysis.total_score.desc())
    )
    rows = result.all()

    candidates = []
    for analysis, profile, vacancy in rows:
        flags = analysis.ai_detection_flags or []
        candidates.append({
            "full_name": profile.full_name,
            "vacancy_title": vacancy.title,
            "total_score": analysis.total_score,
            "ai_suspected": any(f.get("is_ai_generated") for f in flags),
        })

    return {"count": len(candidates), "candidates": candidates}


@router.get("/stats")
async def get_stats(
    telegram_id: int = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """Get statistics for HR. Called by bot."""
    user = (await db.execute(select(User).where(User.telegram_id == telegram_id))).scalar_one_or_none()
    if not user or user.role not in (UserRole.HR, UserRole.MANAGER):
        raise HTTPException(status_code=403, detail="Staff only")

    total = (await db.execute(select(func.count()).select_from(CandidateAnalysis))).scalar() or 0
    approved = (await db.execute(select(func.count()).select_from(CandidateAnalysis).where(CandidateAnalysis.status == AnalysisStatus.APPROVED))).scalar() or 0
    rejected = (await db.execute(select(func.count()).select_from(CandidateAnalysis).where(CandidateAnalysis.status == AnalysisStatus.REJECTED))).scalar() or 0
    pending = (await db.execute(select(func.count()).select_from(CandidateAnalysis).where(CandidateAnalysis.status.in_([AnalysisStatus.ANALYZED, AnalysisStatus.SENT_TO_MANAGER])))).scalar() or 0

    avg_result = await db.execute(select(func.avg(CandidateAnalysis.total_score)).where(CandidateAnalysis.status != AnalysisStatus.DRAFT))
    avg_score = round(avg_result.scalar() or 0, 1)

    # AI flagged
    all_analyses = (await db.execute(select(CandidateAnalysis))).scalars().all()
    ai_flagged = sum(1 for a in all_analyses if a.ai_detection_flags and any(f.get("is_ai_generated") for f in a.ai_detection_flags))

    return {
        "total": total,
        "avg_score": avg_score,
        "approved": approved,
        "rejected": rejected,
        "pending": pending,
        "ai_flagged": ai_flagged,
    }


class UnlinkRequest(BaseModel):
    telegram_id: int


@router.post("/unlink")
async def unlink_telegram(
    data: UnlinkRequest,
    db: AsyncSession = Depends(get_db),
):
    """Unlink Telegram account."""
    user = (await db.execute(select(User).where(User.telegram_id == data.telegram_id))).scalar_one_or_none()
    if not user:
        return {"success": False}
    user.telegram_id = None
    await db.commit()
    return {"success": True}


# ============================================================
# Proactive Talent Search — Survey from Telegram Bot
# ============================================================

ML_SERVICE_URL = "http://ml-service:8001"

PROACTIVE_SYSTEM_PROMPT_QUESTIONS = [
    "leadership",    # Q1: organized something
    "motivation",    # Q2: why higher education
    "growth_path",   # Q3: learned something new
    "potential",     # Q4: project with 1M tenge
    "experience",    # Q5: main failure
]


class SurveyAnswerItem(BaseModel):
    question: str
    answer: str


class SubmitSurveyRequest(BaseModel):
    telegram_id: int
    telegram_username: str = ""
    name: str
    phone: str
    answers: list[SurveyAnswerItem]


@router.get("/survey-check")
async def check_survey(
    telegram_id: int = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """Check if user already completed a survey."""
    result = await db.execute(
        select(ProactiveSurvey).where(ProactiveSurvey.telegram_id == telegram_id)
    )
    survey = result.scalar_one_or_none()
    if survey:
        return {"completed": True, "score": survey.total_score, "status": survey.status}
    return {"completed": False}


@router.post("/submit-survey")
async def submit_survey(
    data: SubmitSurveyRequest,
    db: AsyncSession = Depends(get_db),
):
    """Submit proactive survey from Telegram bot → LLM analysis."""

    # Save survey
    survey = ProactiveSurvey(
        telegram_id=data.telegram_id,
        telegram_username=data.telegram_username,
        name=data.name,
        phone=data.phone,
        answers=[{"question": a.question, "answer": a.answer} for a in data.answers],
    )
    db.add(survey)
    await db.flush()

    # Call ML service for quick analysis
    try:
        ml_answers = [
            {
                "question_number": i + 1,
                "question_text": a.question,
                "answer_text": a.answer,
            }
            for i, a in enumerate(data.answers)
        ]

        async with httpx.AsyncClient(timeout=300.0) as client:
            resp = await client.post(
                f"{ML_SERVICE_URL}/api/v1/analyze",
                json={
                    "candidate_id": survey.id,
                    "vacancy_id": 0,
                    "answers": ml_answers,
                    "mode": "mini",
                },
            )

            if resp.status_code == 200:
                result = resp.json()
                score = result.get("total_score", 50)
                # Check if it's a real analysis (not fallback)
                has_categories = bool(result.get("category_scores"))
                survey.total_score = score
                survey.analysis = {
                    "category_scores": result.get("category_scores"),
                    "strengths": result.get("strengths", []),
                    "weaknesses": result.get("weaknesses", []),
                    "summary": result.get("summary", ""),
                    "leadership_assessment": result.get("leadership_assessment"),
                    "growth_trajectory": result.get("growth_trajectory"),
                    "predictive_score": result.get("predictive_score"),
                    "predictive_summary": result.get("predictive_summary"),
                }
                survey.status = "analyzed" if has_categories else "pending"
            else:
                logger.error(f"ML service returned {resp.status_code}")
                survey.total_score = 0
                survey.status = "pending"

    except Exception as e:
        logger.error(f"ML analysis for survey failed: {e}")
        survey.total_score = 0
        survey.status = "pending"

    await db.commit()

    return {
        "success": True,
        "score": survey.total_score,
        "status": survey.status,
    }


@router.post("/proactive-surveys/{survey_id}/analyze")
async def analyze_proactive_survey(
    survey_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Manually trigger LLM analysis for a proactive survey."""
    if current_user.role != UserRole.HR:
        raise HTTPException(status_code=403, detail="HR only")

    survey = (await db.execute(select(ProactiveSurvey).where(ProactiveSurvey.id == survey_id))).scalar_one_or_none()
    if not survey:
        raise HTTPException(status_code=404, detail="Survey not found")

    # Call ML service
    ml_answers = [
        {"question_number": i + 1, "question_text": a["question"], "answer_text": a["answer"]}
        for i, a in enumerate(survey.answers or [])
    ]

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(
                f"{ML_SERVICE_URL}/api/v1/analyze",
                json={"candidate_id": survey.id, "vacancy_id": 0, "answers": ml_answers, "mode": "mini"},
            )
            if resp.status_code == 200:
                result = resp.json()
                survey.total_score = result.get("total_score", 50)
                survey.analysis = {
                    "category_scores": result.get("category_scores"),
                    "strengths": result.get("strengths", []),
                    "weaknesses": result.get("weaknesses", []),
                    "summary": result.get("summary", ""),
                    "leadership_assessment": result.get("leadership_assessment"),
                    "predictive_score": result.get("predictive_score"),
                }
                survey.status = "analyzed"
                await db.commit()
                return {"success": True, "score": survey.total_score}
    except Exception as e:
        logger.error(f"Proactive analysis failed: {e}")

    raise HTTPException(status_code=500, detail="Анализ не удался")


@router.post("/proactive-surveys/{survey_id}/approve")
async def approve_proactive(
    survey_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Approve proactive candidate — notify via Telegram."""
    if current_user.role != UserRole.HR:
        raise HTTPException(status_code=403, detail="HR only")
    survey = (await db.execute(select(ProactiveSurvey).where(ProactiveSurvey.id == survey_id))).scalar_one_or_none()
    if not survey:
        raise HTTPException(status_code=404, detail="Not found")
    survey.status = "approved"
    await db.commit()

    # Notify via Telegram bot
    try:
        bot_token = "8657277109:AAGPSvKgPIhRd6yd2MwDlmRAtksXSfguHN8"
        msg = (
            f"🎉 Поздравляем, {survey.name}!\n\n"
            f"Координатор отбора inVision U одобрил вашу мини-анкету!\n"
            f"Ваш балл: {survey.total_score}/100\n\n"
            f"Теперь вы можете подать полную заявку на программу:\n"
            f"👉 http://localhost:3000/auth\n\n"
            f"Зарегистрируйтесь и выберите программу. Удачи!"
        )
        async with httpx.AsyncClient(timeout=10.0) as client:
            await client.post(
                f"https://api.telegram.org/bot{bot_token}/sendMessage",
                json={"chat_id": survey.telegram_id, "text": msg},
            )
    except Exception as e:
        logger.warning(f"Failed to notify via Telegram: {e}")

    return {"success": True}


@router.post("/proactive-surveys/{survey_id}/reject")
async def reject_proactive(
    survey_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Reject proactive candidate — remove from list."""
    if current_user.role != UserRole.HR:
        raise HTTPException(status_code=403, detail="HR only")
    survey = (await db.execute(select(ProactiveSurvey).where(ProactiveSurvey.id == survey_id))).scalar_one_or_none()
    if not survey:
        raise HTTPException(status_code=404, detail="Not found")
    survey.status = "rejected"
    await db.commit()
    return {"success": True}


@router.get("/proactive-surveys")
async def list_proactive_surveys(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List proactive survey results for HR."""
    if current_user.role != UserRole.HR:
        raise HTTPException(status_code=403, detail="HR only")

    result = await db.execute(
        select(ProactiveSurvey).order_by(ProactiveSurvey.total_score.desc())
    )
    surveys = result.scalars().all()

    return [
        {
            "id": s.id,
            "name": s.name,
            "phone": s.phone,
            "telegram_username": s.telegram_username,
            "total_score": s.total_score,
            "status": s.status,
            "analysis": s.analysis,
            "answers": s.answers,
            "created_at": s.created_at.isoformat() if s.created_at else None,
        }
        for s in surveys
    ]
