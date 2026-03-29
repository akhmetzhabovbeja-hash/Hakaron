from app.tasks import celery_app


@celery_app.task
def send_candidate_notification(candidate_id: int, message: str):
    """Background task: send notification to candidate (email, etc.)."""
    # TODO: implement email sending
    pass
