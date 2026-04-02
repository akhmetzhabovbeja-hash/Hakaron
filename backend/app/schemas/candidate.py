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
    ai_flags_count: int = 0
    ai_suspected: bool = False

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
    growth_path_score: float = 0.0
    strengths: list[str]
    weaknesses: list[str]
    summary: str
    status: str
    ai_detection_flags: list[dict] = []
    category_scores: dict | None = None
    manager_comment: str | None = None

    model_config = {"from_attributes": True}


class StartApplicationRequest(BaseModel):
    vacancy_id: int


class SaveDraftRequest(BaseModel):
    answers: list[QuestionnaireAnswerIn]


class DraftAnswerItem(BaseModel):
    question_id: int
    question_text: str
    answer_text: str


class DraftResponse(BaseModel):
    vacancy_id: int
    vacancy_title: str
    total_questions: int
    answered_count: int
    id_document_url: str | None = None
    answers: list[DraftAnswerItem]


class MyStatusResponse(BaseModel):
    has_application: bool
    status: str | None = None
    vacancy_title: str | None = None
    total_score: int | None = None
    manager_comment: str | None = None
    # Draft info
    draft_exists: bool = False
    draft_vacancy_id: int | None = None
    draft_vacancy_title: str | None = None
    draft_progress: str | None = None  # e.g. "5/21"


class AnswerItem(BaseModel):
    question_number: int
    question_text: str
    answer_text: str


class AiFlag(BaseModel):
    question_number: int
    ai_probability: float
    is_ai_generated: bool
    indicators: list[str]


class CandidateDossierResponse(BaseModel):
    # User info
    name: str
    email: str
    phone: str
    bio: str
    avatar_url: str | None = None
    id_document_url: str | None = None
    # Analysis
    total_score: int
    vacancy_match: float
    growth_potential: str
    growth_path_score: float = 0.0
    strengths: list[str]
    weaknesses: list[str]
    summary: str
    status: str
    vacancy_title: str
    ai_detection_flags: list[dict] = []
    category_scores: dict | None = None
    manager_comment: str | None = None
    # Answers
    answers: list[AnswerItem]
