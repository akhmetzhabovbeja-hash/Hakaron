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
    ("Расскажите о проекте или инициативе, которой вы больше всего гордитесь. Что именно вы сделали?", QuestionCategory.EXPERIENCE),
    ("Опишите ситуацию, когда вам пришлось преодолеть серьёзное препятствие. Как вы с этим справились?", QuestionCategory.EXPERIENCE),
    ("Был ли у вас опыт, который не удался? Чему он вас научил?", QuestionCategory.EXPERIENCE),
    ("Расскажите о ситуации, когда вы взяли на себя ответственность, хотя этого от вас не требовали.", QuestionCategory.EXPERIENCE),
    # Competencies (5-8)
    ("Какие навыки вы считаете своими сильнейшими? Приведите пример, когда они помогли вам.", QuestionCategory.COMPETENCIES),
    ("Расскажите о моменте, когда вам пришлось быстро разобраться в чём-то совершенно новом.", QuestionCategory.COMPETENCIES),
    ("Как вы работаете в команде? Опишите свою роль в последнем групповом проекте.", QuestionCategory.COMPETENCIES),
    ("Как вы подходите к решению задач, с которыми никогда раньше не сталкивались?", QuestionCategory.COMPETENCIES),
    # Motivation (9-12)
    ("Почему вы хотите учиться в inVision U? Что привлекает вас в этой программе?", QuestionCategory.MOTIVATION),
    ("Какие у вас цели на ближайшие 5 лет? Кем вы видите себя?", QuestionCategory.MOTIVATION),
    ("Что для вас важнее — финансовый успех, влияние на общество или личное развитие? Почему?", QuestionCategory.MOTIVATION),
    ("Расскажите о моменте, когда вы проявили инициативу за пределами учёбы или работы.", QuestionCategory.MOTIVATION),
    # Potential (13-15)
    ("Если бы у вас были неограниченные ресурсы, какой проект вы бы создали для своего сообщества?", QuestionCategory.POTENTIAL),
    ("Как вы реагируете на неожиданные изменения в планах? Приведите конкретный пример.", QuestionCategory.POTENTIAL),
    ("Какой навык или область знаний вы хотите освоить в ближайший год и почему?", QuestionCategory.POTENTIAL),
    # Leadership (16-18)
    ("Опишите ситуацию, когда вы вдохновили других людей на действие. Что вы сделали?", QuestionCategory.LEADERSHIP),
    ("Как вы принимаете решения, когда мнения в группе расходятся?", QuestionCategory.LEADERSHIP),
    ("Какую социальную проблему вы хотели бы решить и почему именно её?", QuestionCategory.LEADERSHIP),
    # Growth Path (19-21)
    ("Расскажите, как изменились ваши интересы и цели за последние 2-3 года. Что повлияло на эти изменения?", QuestionCategory.GROWTH_PATH),
    ("Опишите навык, которым вы сейчас владеете, но год назад не умели. Как вы его освоили?", QuestionCategory.GROWTH_PATH),
    ("Какое событие или человек больше всего повлияли на ваше личное развитие? Почему?", QuestionCategory.GROWTH_PATH),
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

    # Seed HR + Manager accounts only
    from app.seed_staff import seed_staff
    await seed_staff()

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
os.makedirs("/app/uploads/documents", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="/app/uploads"), name="uploads")


@app.get("/health")
async def health():
    return {"status": "ok", "service": "hakaron-backend"}
