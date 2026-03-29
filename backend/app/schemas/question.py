from pydantic import BaseModel


class QuestionResponse(BaseModel):
    id: int
    text: str
    category: str
    is_system: bool

    model_config = {"from_attributes": True}


class QuestionCreate(BaseModel):
    text: str
    category: str


class VacancyQuestionAssign(BaseModel):
    question_ids: list[int]
