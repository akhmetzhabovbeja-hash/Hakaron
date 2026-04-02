from celery import Celery

from app.core.config import settings

celery_app = Celery(
    "hakaron",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
)

celery_app.autodiscover_tasks(["app.tasks"])

# Explicit imports to ensure tasks are registered
import app.tasks.analysis  # noqa: F401, E402
