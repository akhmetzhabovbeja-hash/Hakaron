import enum
from datetime import datetime, timezone

from sqlalchemy import String, Text, Enum, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class QuestionCategory(str, enum.Enum):
    EXPERIENCE = "experience"
    COMPETENCIES = "competencies"
    MOTIVATION = "motivation"
    POTENTIAL = "potential"
    LEADERSHIP = "leadership"
    GROWTH_PATH = "growth_path"


class Question(Base):
    __tablename__ = "questions"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    text: Mapped[str] = mapped_column(Text)
    category: Mapped[QuestionCategory] = mapped_column(Enum(QuestionCategory))
    is_system: Mapped[bool] = mapped_column(Boolean, default=False)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
