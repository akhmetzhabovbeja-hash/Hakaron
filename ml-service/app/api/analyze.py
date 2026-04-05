import json
import logging
import httpx
from fastapi import APIRouter
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter()

OLLAMA_URL = "http://ollama:11434"
MODEL_NAME = "qwen3:8b"

SYSTEM_PROMPT = """Ты — AI-эксперт по оценке абитуриентов программы inVision U (образовательная программа для молодых лидеров Казахстана, инициатива Арсена Томского и inDrive).

Твоя задача — проанализировать ответы абитуриента на вопросы анкеты и дать ПОЛНУЮ оценку.

## Критерии оценки (каждый 0-100):

1. **Опыт (experience)**: Реальные проекты, инициативы, достижения. Конкретные примеры важнее общих слов.
2. **Компетенции (competencies)**: Навыки, знания, способность учиться новому. Примеры применения навыков.
3. **Мотивация (motivation)**: Почему хочет в inVision U, какие цели, насколько искренне.
4. **Потенциал (potential)**: Амбиции, видение будущего, способность масштабировать идеи.
5. **Лидерство (leadership)**: Опыт вдохновения других, принятие решений, инициативность. Ищем НАСТОЯЩИХ будущих лидеров.
6. **Траектория роста (growth_path)**: Как менялся человек, чему научился, прогресс за последние годы.

## Дополнительные фокусы:
- **Лидерский потенциал**: главная цель — обнаружить настоящих будущих лидеров, а не формально сильные заявки
- **Пройденный путь**: фокус на траектории роста, а не только текущих достижениях
- **Предиктивная аналитика**: оцени вероятность успеха кандидата в программе и после неё
- **Аутентичность**: насколько ответы звучат искренне и от первого лица

## Формат ответа (СТРОГО JSON, без markdown):
{
  "total_score": число 0-100,
  "category_scores": {
    "experience": {"score": число, "explanation": "объяснение на русском"},
    "competencies": {"score": число, "explanation": "объяснение"},
    "motivation": {"score": число, "explanation": "объяснение"},
    "potential": {"score": число, "explanation": "объяснение"},
    "leadership": {"score": число, "explanation": "объяснение"},
    "growth_path": {"score": число, "explanation": "объяснение"}
  },
  "growth_potential": "A" или "B" или "C",
  "strengths": ["сильная сторона 1", "сильная сторона 2", "сильная сторона 3"],
  "weaknesses": ["зона развития 1", "зона развития 2"],
  "leadership_assessment": "детальная оценка лидерского потенциала на русском (2-3 предложения)",
  "growth_trajectory": "оценка траектории роста на русском (2-3 предложения)",
  "predictive_score": число 0-100,
  "predictive_summary": "прогноз успеха кандидата на русском (2-3 предложения)",
  "summary": "общее резюме на русском (3-5 предложений)"
}

КРИТИЧЕСКИ ВАЖНЫЕ ПРАВИЛА:
- Отвечай ТОЛЬКО JSON без ```json```, без пояснений до/после, без thinking
- Все текстовые поля на РУССКОМ языке
- Будь ОЧЕНЬ СТРОГИМ оценщиком. Не придумывай положительные качества если их нет в ответах.

ПРАВИЛА ОЦЕНКИ ОТВЕТОВ:
- Ответ короче 10 слов (точка, цифра, одно слово, "не знаю") = 0 баллов за этот вопрос
- Если ВСЕ ответы короче 10 слов — total_score = 5-10, все категории 0-10
- Если больше половины вопросов пустые/короткие — total_score НЕ МОЖЕТ быть выше 30
- Ответ "Ответ Gemini", "Ответ ChatGPT" = ШТРАФ -20 баллов + отметь в explanation
- Конкретные примеры с цифрами, именами, датами = высокий балл
- Общие слова без деталей = низкий балл

ПРАВИЛА ДЛЯ STRENGTHS:
- НЕ ПРИДУМЫВАЙ сильные стороны которых нет в ответах
- Если кандидат написал "1" или точку — у него НЕТ сильных сторон, пиши ["Не выявлены — ответы не содержат информации"]
- Strengths должны быть основаны ТОЛЬКО на том что кандидат реально написал
- weaknesses — укажи конкретные проблемы
- summary — честная оценка, если ответы пустые — так и напиши
"""


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
    category_scores: dict | None = None
    strengths: list[str]
    weaknesses: list[str]
    summary: str
    leadership_assessment: str | None = None
    growth_trajectory: str | None = None
    predictive_score: int | None = None
    predictive_summary: str | None = None


def _format_answers(answers: list[AnswerItem]) -> str:
    parts = []
    for a in answers:
        parts.append(f"**Вопрос {a.question_number}:** {a.question_text}\n**Ответ:** {a.answer_text}\n")
    return "\n".join(parts)


def _parse_llm_response(text: str) -> dict:
    """Extract JSON from LLM response, handling common issues."""
    # Remove thinking tags if present
    if "</think>" in text:
        text = text.split("</think>")[-1]

    # Strip markdown code blocks
    text = text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[-1]
    if text.endswith("```"):
        text = text.rsplit("```", 1)[0]
    text = text.strip()

    # Find JSON object
    start = text.find("{")
    end = text.rfind("}") + 1
    if start >= 0 and end > start:
        try:
            return json.loads(text[start:end])
        except json.JSONDecodeError:
            pass

    return {}


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze_candidate(data: AnalyzeRequest):
    """Analyze candidate answers using Qwen3-8B via Ollama."""

    user_message = f"/no_think\nПроанализируй ответы абитуриента:\n\n{_format_answers(data.answers)}\n\nОТВЕТЬ СТРОГО JSON. Никакого markdown, никаких пояснений. Только JSON объект."

    try:
        async with httpx.AsyncClient(timeout=300.0) as client:
            resp = await client.post(
                f"{OLLAMA_URL}/api/chat",
                json={
                    "model": MODEL_NAME,
                    "messages": [
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": user_message},
                    ],
                    "stream": False,
                    "format": "json",
                    "options": {
                        "temperature": 0.3,
                        "num_predict": 4096,
                    },
                },
            )

            if resp.status_code != 200:
                logger.error(f"Ollama error: {resp.status_code} {resp.text}")
                return _fallback_response(data)

            result = resp.json()
            msg = result.get("message", {})
            content = msg.get("content", "")
            thinking = msg.get("thinking", "")
            done_reason = result.get("done_reason", "")

            logger.info(f"Ollama done_reason={done_reason}, content_len={len(content)}, thinking_len={len(thinking)}")
            logger.info(f"Ollama content first 500 chars: {content[:500]}")

            # Try content first, then thinking, then combined
            parsed = {}
            for text_to_try in [content, thinking, content + thinking]:
                if text_to_try.strip():
                    parsed = _parse_llm_response(text_to_try)
                    if parsed and "total_score" in parsed:
                        break

            if not parsed or "total_score" not in parsed:
                logger.warning(f"Failed to parse LLM response. content={content[:200]}, thinking={thinking[:200]}")
                return _fallback_response(data)

            cat_scores = parsed.get("category_scores", {})
            # Add labels to category_scores
            labels = {
                "experience": "Опыт", "competencies": "Компетенции",
                "motivation": "Мотивация", "potential": "Потенциал",
                "leadership": "Лидерство", "growth_path": "Траектория роста",
            }
            for key, label in labels.items():
                if key in cat_scores:
                    cat_scores[key]["label"] = label
                    cat_scores[key]["max"] = 100

            # Safe extraction — LLM may return wrong types
            def safe_str(val, default=""):
                if isinstance(val, str): return val
                if isinstance(val, dict): return val.get("summary", val.get("description", str(val)))
                return str(val) if val else default

            def safe_int(val, default=50):
                if isinstance(val, (int, float)): return int(val)
                try: return int(val)
                except: return default

            def safe_list(val, default=None):
                if isinstance(val, list): return val
                return default or []

            total = safe_int(parsed.get("total_score"), 50)
            gp = parsed.get("growth_potential", "B")
            if isinstance(gp, dict):
                gp = gp.get("grade", gp.get("level", "B"))

            return AnalyzeResponse(
                candidate_id=data.candidate_id,
                total_score=total,
                vacancy_match=round(total / 100, 2),
                growth_potential=safe_str(gp, "B"),
                category_scores=cat_scores,
                strengths=safe_list(parsed.get("strengths")),
                weaknesses=safe_list(parsed.get("weaknesses")),
                summary=safe_str(parsed.get("summary")),
                leadership_assessment=safe_str(parsed.get("leadership_assessment")) or None,
                growth_trajectory=safe_str(parsed.get("growth_trajectory")) or None,
                predictive_score=safe_int(parsed.get("predictive_score"), None),
                predictive_summary=safe_str(parsed.get("predictive_summary")) or None,
            )

    except Exception as e:
        logger.error(f"Ollama call failed: {e}")
        return _fallback_response(data)


def _fallback_response(data: AnalyzeRequest) -> AnalyzeResponse:
    """Fallback when Ollama is unavailable."""
    return AnalyzeResponse(
        candidate_id=data.candidate_id,
        total_score=50,
        vacancy_match=0.50,
        growth_potential="B",
        strengths=["Подал заявку на программу"],
        weaknesses=["LLM-анализ временно недоступен"],
        summary="Автоматический анализ временно недоступен. Требуется ручная проверка координатором.",
    )
