from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()


class AnswerItem(BaseModel):
    question_number: int
    question_text: str
    answer_text: str


class AnalyzeRequest(BaseModel):
    candidate_id: int
    vacancy_id: int
    answers: list[AnswerItem]


class AnalyzeResponse(BaseModel):
    candidate_id: int
    total_score: int
    vacancy_match: float
    growth_potential: str
    strengths: list[str]
    weaknesses: list[str]
    summary: str


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze_candidate(data: AnalyzeRequest):
    """
    Analyze candidate answers using ML models.
    Currently returns mock data — ML team will implement real analysis.
    """
    # TODO: ML team implements real NLP analysis here
    return AnalyzeResponse(
        candidate_id=data.candidate_id,
        total_score=78,
        vacancy_match=0.82,
        growth_potential="B+",
        strengths=[
            "Strong communication skills",
            "Relevant industry experience",
            "Problem-solving ability",
        ],
        weaknesses=[
            "Limited leadership experience",
            "Needs improvement in technical depth",
        ],
        summary="Candidate shows solid foundational skills with good growth potential. "
        "Recommended for junior-to-mid level positions with mentorship support.",
    )
