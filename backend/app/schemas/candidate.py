from pydantic import BaseModel


class QuestionnaireAnswerIn(BaseModel):
    question_id: int
    question_text: str
    answer_text: str


class SubmitQuestionnaireRequest(BaseModel):
    vacancy_id: int
    answers: list[QuestionnaireAnswerIn]


class CandidateListResponse(BaseModel):
    id: int
    candidate_id: int
    full_name: str
    email: str
    vacancy_title: str
    total_score: int
    vacancy_match: float
    status: str
    source: str

    model_config = {"from_attributes": True}


class CandidateAnalysisResponse(BaseModel):
    id: int
    candidate_id: int
    full_name: str
    email: str
    vacancy_title: str
    total_score: int
    vacancy_match: float
    growth_potential: str
    strengths: list[str]
    weaknesses: list[str]
    summary: str
    status: str

    model_config = {"from_attributes": True}


class MyStatusResponse(BaseModel):
    has_application: bool
    status: str | None = None
    vacancy_title: str | None = None
    total_score: int | None = None
