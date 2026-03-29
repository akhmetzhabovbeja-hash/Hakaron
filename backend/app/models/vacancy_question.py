from sqlalchemy import Integer, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class VacancyQuestion(Base):
    __tablename__ = "vacancy_questions"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    vacancy_id: Mapped[int] = mapped_column(ForeignKey("vacancies.id"))
    question_id: Mapped[int] = mapped_column(ForeignKey("questions.id"))
    order: Mapped[int] = mapped_column(Integer, default=0)
