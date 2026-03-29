from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select

from app.core.config import settings
from app.core.database import engine, Base, async_session
from app.api.v1 import router as api_v1_router
from app.models.question import Question, QuestionCategory

# Import all models so Base.metadata knows about them
import app.models  # noqa: F401

SYSTEM_QUESTIONS = [
    # Experience (1-4)
    ("Расскажите о своём самом значимом профессиональном достижении. Что именно вы сделали и каков был результат?", QuestionCategory.EXPERIENCE),
    ("Опишите ситуацию, когда вы столкнулись с серьёзной проблемой на работе. Как вы её решили?", QuestionCategory.EXPERIENCE),
    ("Расскажите о проекте, который не удался. Какие уроки вы извлекли?", QuestionCategory.EXPERIENCE),
    ("Опишите самую сложную техническую задачу, которую вам приходилось решать.", QuestionCategory.EXPERIENCE),
    # Competencies (5-8)
    ("Какие ваши ключевые профессиональные навыки? Приведите примеры их применения.", QuestionCategory.COMPETENCIES),
    ("Расскажите о ситуации, когда вам нужно было быстро освоить новую технологию или область.", QuestionCategory.COMPETENCIES),
    ("Как вы работаете в команде? Опишите свою роль в последнем командном проекте.", QuestionCategory.COMPETENCIES),
    ("Как вы подходите к решению задач, с которыми раньше не сталкивались?", QuestionCategory.COMPETENCIES),
    # Motivation (9-12)
    ("Почему вас заинтересовала эта вакансия? Что привлекает в компании?", QuestionCategory.MOTIVATION),
    ("Какие у вас карьерные цели на ближайшие 3-5 лет?", QuestionCategory.MOTIVATION),
    ("Что для вас важнее всего в работе — деньги, развитие, команда или что-то другое?", QuestionCategory.MOTIVATION),
    ("Расскажите о моменте, когда вы проявили инициативу сверх своих обязанностей.", QuestionCategory.MOTIVATION),
    # Potential (13-15)
    ("Если бы вам дали полную свободу, какой проект вы бы создали и почему?", QuestionCategory.POTENTIAL),
    ("Как вы реагируете на серьёзные изменения в рабочих процессах? Приведите пример.", QuestionCategory.POTENTIAL),
    ("Какой навык вы хотите развить в ближайший год и почему именно его?", QuestionCategory.POTENTIAL),
]


async def seed_system_questions():
    """Seed the database with system questions if they don't exist."""
    async with async_session() as db:
        result = await db.execute(select(Question).where(Question.is_system == True))
        existing = result.scalars().all()
        if len(existing) >= len(SYSTEM_QUESTIONS):
            return

        for text, category in SYSTEM_QUESTIONS:
            question = Question(text=text, category=category, is_system=True, created_by=None)
            db.add(question)
        await db.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await seed_system_questions()
    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_v1_router, prefix="/api")

# Serve uploaded files (avatars, etc.)
import os
os.makedirs("/app/uploads/avatars", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="/app/uploads"), name="uploads")


@app.get("/health")
async def health():
    return {"status": "ok", "service": "hakaron-backend"}
