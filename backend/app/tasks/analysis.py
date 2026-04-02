"""Celery task: LLM analysis of candidate answers via ml-service → Ollama."""
import logging
import os
import httpx
from app.tasks import celery_app

logger = logging.getLogger(__name__)

ML_SERVICE_URL = "http://ml-service:8001"


def _get_sync_engine():
    from sqlalchemy import create_engine
    db_url = os.environ.get(
        "DATABASE_URL",
        "postgresql://hakaron:hakaron@postgres:5432/hakaron"
    ).replace("+asyncpg", "").replace("postgresql://", "postgresql+psycopg2://")
    if "+psycopg2" not in db_url:
        db_url = db_url.replace("postgresql://", "postgresql+psycopg2://")
    return create_engine(db_url, echo=False)


@celery_app.task(name="analyze_candidate", bind=True, max_retries=3)
def analyze_candidate_task(self, analysis_id: int):
    """Run LLM analysis on candidate answers.

    Flow: Celery → ml-service → Ollama (Qwen3-8B) → save results to DB.
    """
    logger.info(f"Starting LLM analysis for analysis_id={analysis_id}")

    from sqlalchemy.orm import Session
    from app.models.analysis import CandidateAnalysis, AnalysisStatus
    from app.models.candidate import CandidateProfile
    from app.models.questionnaire import QuestionnaireResponse

    sync_engine = _get_sync_engine()

    with Session(sync_engine) as db:
        # Get analysis
        analysis = db.query(CandidateAnalysis).filter(CandidateAnalysis.id == analysis_id).first()
        if not analysis:
            logger.error(f"Analysis {analysis_id} not found")
            return

        # Update status to PROCESSING
        analysis.status = AnalysisStatus.PROCESSING
        db.commit()

        # Get profile
        profile = db.query(CandidateProfile).filter(CandidateProfile.id == analysis.candidate_id).first()
        if not profile:
            logger.error(f"Profile not found for analysis {analysis_id}")
            return

        # Get answers
        answers = (
            db.query(QuestionnaireResponse)
            .filter(QuestionnaireResponse.candidate_id == profile.id)
            .order_by(QuestionnaireResponse.question_number)
            .all()
        )

        if not answers:
            logger.warning(f"No answers for analysis {analysis_id}")
            analysis.status = AnalysisStatus.ANALYZED
            analysis.summary = "Нет ответов для анализа"
            db.commit()
            return

        # Call ml-service
        payload = {
            "candidate_id": profile.id,
            "vacancy_id": analysis.vacancy_id,
            "answers": [
                {
                    "question_number": a.question_number,
                    "question_text": a.question_text,
                    "answer_text": a.answer_text,
                }
                for a in answers
            ],
        }

        try:
            resp = httpx.post(
                f"{ML_SERVICE_URL}/api/v1/analyze",
                json=payload,
                timeout=300.0,  # 5 min — LLM can be slow
            )

            if resp.status_code == 200:
                data = resp.json()

                analysis.total_score = data.get("total_score", 50)
                analysis.vacancy_match = data.get("vacancy_match", 0.5)
                analysis.growth_potential = data.get("growth_potential", "B")

                # Fix category_scores: normalize keys
                cat_scores = data.get("category_scores") or {}
                # Normalize LLM key variations
                for alt_key in ["growth", "trajectory", "growth_trajectory"]:
                    if alt_key in cat_scores and "growth_path" not in cat_scores:
                        cat_scores["growth_path"] = cat_scores.pop(alt_key)
                labels = {
                    "experience": "Опыт", "competencies": "Компетенции",
                    "motivation": "Мотивация", "potential": "Потенциал",
                    "leadership": "Лидерство", "growth_path": "Траектория роста",
                }
                for key, label in labels.items():
                    if key in cat_scores:
                        cat_scores[key].setdefault("label", label)
                        cat_scores[key].setdefault("max", 100)
                analysis.category_scores = cat_scores

                # Growth path score
                gp = cat_scores.get("growth_path", {}).get("score", 0)
                analysis.growth_path_score = round(gp / 100, 2)

                # Strengths/weaknesses: use LLM data or generate from scores
                strengths = data.get("strengths", [])
                weaknesses = data.get("weaknesses", [])

                if not strengths and cat_scores:
                    sorted_cats = sorted(cat_scores.items(), key=lambda x: x[1].get("score", 0), reverse=True)
                    # Always pick top 2-3 even if scores are low
                    strengths = [
                        f"{v.get('label', k)}: {v.get('score', 0)}/100 — {v.get('explanation', '')[:80]}"
                        for k, v in sorted_cats[:3]
                    ]
                if not weaknesses and cat_scores:
                    sorted_cats = sorted(cat_scores.items(), key=lambda x: x[1].get("score", 0))
                    weaknesses = [
                        f"{v.get('label', k)}: {v.get('score', 0)}/100 — требует развития"
                        for k, v in sorted_cats if v.get("score", 0) < 65
                    ][:3]

                analysis.strengths = strengths
                analysis.weaknesses = weaknesses

                # Build structured summary
                summary_parts = []

                # Section 1: Overview
                if data.get("summary"):
                    summary_parts.append(f"📋 Общая оценка\n{data['summary']}")
                else:
                    sorted_cats = sorted(cat_scores.items(), key=lambda x: x[1].get("score", 0), reverse=True)
                    top_cat = sorted_cats[0][1].get("label", "?") if sorted_cats else "?"
                    summary_parts.append(
                        f"📋 Общая оценка\nАбитуриент набрал {analysis.total_score}/100 баллов. "
                        f"Сильнейшая категория — {top_cat}."
                    )

                # Section 2: Leadership
                if data.get("leadership_assessment"):
                    summary_parts.append(f"👑 Лидерский потенциал\n{data['leadership_assessment']}")
                elif cat_scores.get("leadership", {}).get("explanation"):
                    summary_parts.append(f"👑 Лидерский потенциал\n{cat_scores['leadership']['explanation']}")

                # Section 3: Growth
                if data.get("growth_trajectory"):
                    summary_parts.append(f"📈 Траектория роста\n{data['growth_trajectory']}")
                elif cat_scores.get("growth_path", {}).get("explanation"):
                    summary_parts.append(f"📈 Траектория роста\n{cat_scores['growth_path']['explanation']}")

                # Section 4: Prediction
                if data.get("predictive_summary"):
                    ps = data.get("predictive_score", "?")
                    summary_parts.append(f"🔮 Прогноз успеха ({ps}/100)\n{data['predictive_summary']}")

                # Section 5: Key findings per category
                cat_notes = []
                for key in ["experience", "competencies", "motivation", "potential", "leadership", "growth_path"]:
                    cat = cat_scores.get(key, {})
                    if cat.get("explanation"):
                        cat_notes.append(f"• {cat.get('label', key)} ({cat.get('score', 0)}): {cat['explanation']}")
                if cat_notes:
                    summary_parts.append("📊 По категориям\n" + "\n".join(cat_notes))

                analysis.summary = "\n\n".join(summary_parts)

                analysis.status = AnalysisStatus.ANALYZED
                logger.info(f"LLM analysis complete for {analysis_id}: score={analysis.total_score}")
            else:
                logger.error(f"ML service error: {resp.status_code}")
                analysis.status = AnalysisStatus.ANALYZED
                analysis.summary = f"Ошибка ML-сервиса: {resp.status_code}"

        except Exception as e:
            logger.error(f"ML service call failed: {e}")
            if self.request.retries < self.max_retries:
                raise self.retry(countdown=30)
            analysis.status = AnalysisStatus.ANALYZED
            analysis.summary = f"LLM-анализ недоступен: {e}"

        db.commit()
