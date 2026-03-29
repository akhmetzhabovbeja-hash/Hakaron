from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.vacancy import Vacancy
from app.models.vacancy_question import VacancyQuestion
from app.models.question import Question
from app.schemas.vacancy import VacancyResponse, VacancyDetailResponse, QuestionInVacancy

router = APIRouter()


@router.get("/", response_model=list[VacancyResponse])
async def list_vacancies(db: AsyncSession = Depends(get_db)):
    """List all active vacancies. No auth required."""
    result = await db.execute(
        select(Vacancy).where(Vacancy.is_active == True).order_by(Vacancy.created_at.desc())
    )
    vacancies = result.scalars().all()
    return vacancies


@router.get("/{vacancy_id}", response_model=VacancyDetailResponse)
async def get_vacancy(vacancy_id: int, db: AsyncSession = Depends(get_db)):
    """Get vacancy detail with questions. No auth required."""
    result = await db.execute(select(Vacancy).where(Vacancy.id == vacancy_id))
    vacancy = result.scalar_one_or_none()
    if not vacancy:
        raise HTTPException(status_code=404, detail="Vacancy not found")

    # Join VacancyQuestion + Question, order by VacancyQuestion.order
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
        application_deadline=vacancy.application_deadline,
        questions=questions,
    )
