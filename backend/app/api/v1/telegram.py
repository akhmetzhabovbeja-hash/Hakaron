"""Telegram linking API — generates time-based codes for account binding."""
import random
import time
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.api.v1.auth import get_current_user
from app.models.user import User, UserRole
from app.models.analysis import CandidateAnalysis, AnalysisStatus
from app.models.candidate import CandidateProfile
from app.models.vacancy import Vacancy

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
