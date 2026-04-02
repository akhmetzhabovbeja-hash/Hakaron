from fastapi import APIRouter

from app.api.v1 import auth, candidates, vacancies, manager, hr, profile, telegram

router = APIRouter(prefix="/v1")

router.include_router(auth.router, prefix="/auth", tags=["Auth"])
router.include_router(candidates.router, prefix="/candidates", tags=["Candidates"])
router.include_router(vacancies.router, prefix="/vacancies", tags=["Vacancies"])
router.include_router(manager.router, prefix="/manager", tags=["Manager"])
router.include_router(hr.router, prefix="/hr", tags=["HR"])
router.include_router(profile.router, prefix="/profile", tags=["Profile"])
router.include_router(telegram.router, prefix="/telegram", tags=["Telegram"])
