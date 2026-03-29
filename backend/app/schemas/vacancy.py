from pydantic import BaseModel


class VacancyCreate(BaseModel):
    title: str
    description: str
    requirements: str = ""


class VacancyResponse(BaseModel):
    id: int
    title: str
    description: str
    requirements: str
    is_active: bool

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
    questions: list[QuestionInVacancy] = []

    model_config = {"from_attributes": True}
