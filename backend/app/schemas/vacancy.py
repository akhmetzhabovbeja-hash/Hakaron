from datetime import datetime
from pydantic import BaseModel


class VacancyCreate(BaseModel):
    title: str
    description: str
    requirements: str = ""
    application_deadline: datetime | None = None


class VacancyUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    requirements: str | None = None
    application_deadline: datetime | None = None


class VacancyResponse(BaseModel):
    id: int
    title: str
    description: str
    requirements: str
    is_active: bool
    application_deadline: datetime | None = None

    model_config = {"from_attributes": True}


class QuestionInVacancy(BaseModel):
    id: int
    text: str
    category: str
    order: int

    model_config = {"from_attributes": True}


class VacancyDetailResponse(BaseModel):
    id: int
    title: str
    description: str
    requirements: str
    is_active: bool
    application_deadline: datetime | None = None
    questions: list[QuestionInVacancy] = []

    model_config = {"from_attributes": True}
