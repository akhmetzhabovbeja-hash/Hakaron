"""Proactive talent search — survey responses from Telegram bot."""
from datetime import datetime, timezone
from sqlalchemy import Integer, BigInteger, Float, String, Text, DateTime, JSON
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class ProactiveSurvey(Base):
    __tablename__ = "proactive_surveys"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    telegram_id: Mapped[int] = mapped_column(BigInteger, index=True)
    telegram_username: Mapped[str] = mapped_column(String(255), default="")
    name: Mapped[str] = mapped_column(String(255))
    phone: Mapped[str] = mapped_column(String(50))
    answers: Mapped[dict] = mapped_column(JSON)  # [{question, answer}, ...]
    total_score: Mapped[int] = mapped_column(Integer, default=0)
    analysis: Mapped[dict | None] = mapped_column(JSON, nullable=True)  # LLM analysis result
    status: Mapped[str] = mapped_column(String(50), default="pending")  # pending, analyzed, invited
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
