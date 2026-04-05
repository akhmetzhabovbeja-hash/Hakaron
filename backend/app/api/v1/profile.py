import os
import uuid

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.api.v1.auth import get_current_user
from app.models.user import User
from app.models.notification import Notification
from app.schemas.auth import UserResponse
from app.schemas.profile import ProfileUpdate, AvatarResponse

router = APIRouter()

UPLOAD_DIR = "/app/uploads/avatars"


@router.get("/", response_model=UserResponse)
async def get_profile(current_user: User = Depends(get_current_user)):
    """Get current user profile."""
    return current_user


@router.put("/", response_model=UserResponse)
async def update_profile(
    data: ProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update current user profile."""
    if data.name is not None:
        current_user.name = data.name

    if data.phone is not None and data.phone != current_user.phone:
        # Check phone uniqueness
        existing = await db.execute(
            select(User).where(User.phone == data.phone, User.id != current_user.id)
        )
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Phone number already in use")
        current_user.phone = data.phone

    if data.bio is not None:
        current_user.bio = data.bio

    await db.commit()
    await db.refresh(current_user)
    return current_user


@router.post("/avatar", response_model=AvatarResponse)
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload user avatar image."""
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    # Max 5MB
    contents = await file.read()
    if len(contents) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 5MB)")

    os.makedirs(UPLOAD_DIR, exist_ok=True)

    ext = file.filename.split(".")[-1] if file.filename and "." in file.filename else "jpg"
    filename = f"{current_user.id}_{uuid.uuid4().hex[:8]}.{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)

    with open(filepath, "wb") as f:
        f.write(contents)

    avatar_url = f"/uploads/avatars/{filename}"
    current_user.avatar_url = avatar_url
    await db.commit()
    await db.refresh(current_user)

    return AvatarResponse(avatar_url=avatar_url)


@router.get("/notifications")
async def get_notifications(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get notifications for current user."""
    result = await db.execute(
        select(Notification)
        .where(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .limit(20)
    )
    notifs = result.scalars().all()

    # Mark as read
    for n in notifs:
        if not n.is_read:
            n.is_read = True
    await db.commit()

    return [
        {
            "id": n.id,
            "title": n.title,
            "message": n.message,
            "is_read": n.is_read,
            "created_at": n.created_at.isoformat() if n.created_at else None,
        }
        for n in notifs
    ]


@router.get("/notifications/count")
async def get_unread_count(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get unread notification count."""
    from sqlalchemy import func
    count = (await db.execute(
        select(func.count()).select_from(Notification)
        .where(Notification.user_id == current_user.id)
        .where(Notification.is_read == False)
    )).scalar() or 0
    return {"count": count}
