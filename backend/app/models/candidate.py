import enum
from datetime import datetime, timezone

from sqlalchemy import String, Enum, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class CandidateSource(str, enum.Enum):
    PLATFORM = "platform"
    HH_PARSED = "hh_parsed"


class CandidateProfile(Base):
    __tablename__ = "candidate_profiles"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    vacancy_id: Mapped[int] = mapped_column(ForeignKey("vacancies.id"))
    full_name: Mapped[str] = mapped_column(String(255))
    email: Mapped[str] = mapped_column(String(255))
    phone: Mapped[str] = mapped_column(String(50), default="")
    source: Mapped[CandidateSource] = mapped_column(
        Enum(CandidateSource), default=CandidateSource.PLATFORM
    )
    hh_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    id_document_url: Mapped[str | None] = mapped_column(String(500), nullable=True, default=None)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
