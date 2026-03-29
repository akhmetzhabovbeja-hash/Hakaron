from app.tasks import celery_app


@celery_app.task
def parse_hh_candidates(vacancy_title: str, area: int = 1):
    """Background task: parse candidates from HH.ru for a given vacancy."""
    # TODO: implement async-to-sync bridge and save parsed candidates to DB
    pass
