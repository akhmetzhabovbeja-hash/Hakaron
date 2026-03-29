import enum
from datetime import datetime, timezone

from sqlalchemy import Integer, Float, Text, Enum, DateTime, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class AnalysisStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    ANALYZED = "analyzed"
    HR_REVIEW = "hr_review"
    SENT_TO_MANAGER = "sent_to_manager"
    APPROVED = "approved"
    REJECTED = "rejected"


class CandidateAnalysis(Base):
    __tablename__ = "candidate_analyses"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    candidate_id: Mapped[int] = mapped_column(ForeignKey("candidate_profiles.id"))
    vacancy_id: Mapped[int] = mapped_column(ForeignKey("vacancies.id"))
    total_score: Mapped[int] = mapped_column(Integer, default=0)
    vacancy_match: Mapped[float] = mapped_column(Float, default=0.0)
    growth_potential: Mapped[str] = mapped_column(Text, default="")
    strengths: Mapped[dict] = mapped_column(JSON, default=list)
    weaknesses: Mapped[dict] = mapped_column(JSON, default=list)
    summary: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[AnalysisStatus] = mapped_column(
        Enum(AnalysisStatus), default=AnalysisStatus.PENDING
    )
    hr_reviewed_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    sent_to_manager_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    approved_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
