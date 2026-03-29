import httpx

from app.core.config import settings


async def search_hh_candidates(query: str, area: int = 1) -> list[dict]:
    """Search for candidates on HH.ru via their public API."""
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{settings.HH_API_BASE_URL}/resumes",
            params={"text": query, "area": area, "per_page": 20},
            headers={"User-Agent": "Hakaron/0.1 (recruitment platform)"},
            timeout=30.0,
        )
        if response.status_code == 200:
            data = response.json()
            return data.get("items", [])
        return []
