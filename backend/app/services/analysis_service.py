import httpx

from app.core.config import settings


async def request_ml_analysis(candidate_id: int, vacancy_id: int, answers: list[dict]) -> dict:
    """Send candidate answers to ML service for analysis."""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{settings.ML_SERVICE_URL}/api/v1/analyze",
            json={
                "candidate_id": candidate_id,
                "vacancy_id": vacancy_id,
                "answers": answers,
            },
            timeout=120.0,
        )
        response.raise_for_status()
        return response.json()
