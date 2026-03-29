import re
import statistics
from typing import List, Tuple

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()


class DetectAIRequest(BaseModel):
    text: str


class DetectAIResponse(BaseModel):
    is_ai_generated: bool
    ai_probability: float
    indicators: List[str]


# Common AI phrases in Russian (ChatGPT-style)
AI_PHRASES_RU = [
    "безусловно",
    "в целом",
    "стоит отметить",
    "важно подчеркнуть",
    "в заключение",
    "таким образом",
    "необходимо отметить",
    "следует отметить",
    "в первую очередь",
    "в конечном итоге",
]


def _split_sentences(text: str) -> List[str]:
    """Split text into sentences using basic punctuation rules."""
    parts = re.split(r'[.!?…]+', text)
    return [s.strip() for s in parts if s.strip()]


def _get_words(text: str) -> List[str]:
    """Extract words from text."""
    return re.findall(r'[a-zA-Zа-яА-ЯёЁ]+', text)


def _check_sentence_uniformity(sentences: List[str]) -> Tuple[float, bool]:
    """
    AI tends to write sentences of very similar length.
    Returns (score contribution, triggered).
    """
    if len(sentences) < 3:
        return 0.0, False

    lengths = [len(re.findall(r'[a-zA-Zа-яА-ЯёЁ]+', s)) for s in sentences]
    lengths = [l for l in lengths if l > 0]

    if len(lengths) < 3:
        return 0.0, False

    std = statistics.stdev(lengths)
    if std < 5:
        score = 0.25 * (1 - std / 5)
        return score, True
    return 0.0, False


def _check_type_token_ratio(words: List[str]) -> Tuple[float, bool]:
    """
    High type-token ratio in long texts is suspicious — AI uses
    diverse vocabulary unnaturally.
    Returns (score contribution, triggered).
    """
    if len(words) < 50:
        return 0.0, False

    lower_words = [w.lower() for w in words]
    unique = set(lower_words)
    ttr = len(unique) / len(lower_words)

    if ttr > 0.75:
        score = 0.2 * ((ttr - 0.75) / 0.25)
        return min(score, 0.2), True
    return 0.0, False


def _check_ai_phrases(text: str) -> Tuple[float, List[str]]:
    """
    Check for common ChatGPT-style phrases in Russian.
    Returns (score contribution, list of matched phrases).
    """
    text_lower = text.lower()
    matched = [phrase for phrase in AI_PHRASES_RU if phrase in text_lower]

    if not matched:
        return 0.0, []

    score = min(len(matched) * 0.08, 0.3)
    return score, matched


def _check_perfect_structure(text: str) -> Tuple[float, bool]:
    """
    Detect bullet points, numbered lists, or overly structured text.
    Returns (score contribution, triggered).
    """
    patterns = [
        r'^\s*[-•]\s+',       # bullet points
        r'^\s*\d+[.)]\s+',    # numbered lists
        r'^\s*[а-яa-z][.)]\s+',  # lettered lists
    ]
    lines = text.strip().split('\n')
    structured_count = 0

    for line in lines:
        for pat in patterns:
            if re.match(pat, line):
                structured_count += 1
                break

    if len(lines) > 0 and structured_count >= 3:
        ratio = structured_count / len(lines)
        score = 0.15 * min(ratio / 0.5, 1.0)
        return score, True
    return 0.0, False


def _check_text_length(words: List[str]) -> Tuple[float, bool]:
    """
    Extremely long answers (> 500 words) for a questionnaire are suspicious.
    Returns (score contribution, triggered).
    """
    if len(words) > 500:
        excess = len(words) - 500
        score = min(0.1 + excess * 0.0002, 0.2)
        return score, True
    return 0.0, False


def detect_ai_text(text: str) -> DetectAIResponse:
    """Run all heuristic checks and combine into a final probability."""
    if not text or not text.strip():
        return DetectAIResponse(
            is_ai_generated=False,
            ai_probability=0.0,
            indicators=[],
        )

    sentences = _split_sentences(text)
    words = _get_words(text)
    indicators: List[str] = []
    total_score = 0.0

    # 1. Sentence length uniformity
    score, triggered = _check_sentence_uniformity(sentences)
    if triggered:
        total_score += score
        indicators.append("sentence_length_uniformity")

    # 2. Type-token ratio
    score, triggered = _check_type_token_ratio(words)
    if triggered:
        total_score += score
        indicators.append("high_lexical_diversity")

    # 3. ChatGPT phrases
    score, matched = _check_ai_phrases(text)
    if matched:
        total_score += score
        indicators.append(f"ai_phrases_detected({len(matched)})")

    # 4. Perfect structure
    score, triggered = _check_perfect_structure(text)
    if triggered:
        total_score += score
        indicators.append("structured_formatting")

    # 5. Text length
    score, triggered = _check_text_length(words)
    if triggered:
        total_score += score
        indicators.append("excessive_length")

    ai_probability = round(min(total_score, 1.0), 2)
    is_ai_generated = ai_probability > 0.6

    return DetectAIResponse(
        is_ai_generated=is_ai_generated,
        ai_probability=ai_probability,
        indicators=indicators,
    )


@router.post("/detect-ai", response_model=DetectAIResponse)
async def detect_ai(request: DetectAIRequest):
    """Detect whether text was likely generated by AI using rule-based heuristics."""
    return detect_ai_text(request.text)
