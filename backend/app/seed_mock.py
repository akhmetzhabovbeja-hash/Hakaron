"""Seed mock data: 3 programs, 15 candidates with filled questionnaires and analyses."""
import asyncio
import random

from app.core.database import async_session
from app.models.user import User, UserRole
from app.models.vacancy import Vacancy
from app.models.question import Question
from app.models.vacancy_question import VacancyQuestion
from app.models.candidate import CandidateProfile, CandidateSource
from app.models.questionnaire import QuestionnaireResponse
from app.models.analysis import CandidateAnalysis, AnalysisStatus
from sqlalchemy import select, func
from datetime import datetime, timezone, timedelta

# bcrypt hash for "password123"
from passlib.context import CryptContext
pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")
HASH = pwd.hash("password123")

MOCK_STUDENTS = [
    {"name": "Айдана Касымова", "email": "aidana@test.kz", "phone": "87011234501"},
    {"name": "Арман Бектуров", "email": "arman@test.kz", "phone": "87011234502"},
    {"name": "Дана Мухтарова", "email": "dana@test.kz", "phone": "87011234503"},
    {"name": "Ернар Сагынбаев", "email": "ernar@test.kz", "phone": "87011234504"},
    {"name": "Камила Жунусова", "email": "kamila@test.kz", "phone": "87011234505"},
    {"name": "Нурсултан Аманов", "email": "nursultan@test.kz", "phone": "87011234506"},
    {"name": "Алия Серикова", "email": "aliya@test.kz", "phone": "87011234507"},
    {"name": "Бауыржан Тлеубаев", "email": "bauyr@test.kz", "phone": "87011234508"},
    {"name": "Гульнар Омарова", "email": "gulnar@test.kz", "phone": "87011234509"},
    {"name": "Диас Мамбетов", "email": "dias@test.kz", "phone": "87011234510"},
    {"name": "Жанна Утепова", "email": "zhanna@test.kz", "phone": "87011234511"},
    {"name": "Куаныш Рахимов", "email": "kuanysh@test.kz", "phone": "87011234512"},
    {"name": "Мадина Алтынбекова", "email": "madina@test.kz", "phone": "87011234513"},
    {"name": "Олжас Кенжебеков", "email": "olzhas@test.kz", "phone": "87011234514"},
    {"name": "Сабина Досмаганбетова", "email": "sabina@test.kz", "phone": "87011234515"},
]

MOCK_ANSWERS = {
    "experience": [
        "В прошлом году я участвовал в проекте по разработке мобильного приложения для волонтёрской организации. Я отвечал за дизайн интерфейса и координацию команды из 4 человек. В результате приложением начали пользоваться более 200 волонтёров в нашем городе.",
        "Я организовал благотворительный марафон в школе, в котором участвовали 150 учеников. Мы собрали 500 тысяч тенге для детского дома. Самым сложным было мотивировать людей, но я нашёл подход через социальные сети и личные разговоры.",
        "Участвовал в олимпиаде по математике и занял 3 место в области. Готовился 6 месяцев каждый день по 2 часа. Этот опыт научил меня дисциплине и системному подходу к сложным задачам.",
        "Был ситуация когда наш школьный проект по экологии провалился — мы не успели к дедлайну. Я понял что нужно лучше планировать время и распределять задачи. После этого я начал использовать Trello для управления проектами.",
    ],
    "competencies": [
        "Мои сильные навыки — это аналитическое мышление и программирование на Python. Например, я написал скрипт для автоматизации проверки домашних заданий, который сэкономил учителям около 10 часов в неделю.",
        "Когда мне нужно было изучить машинное обучение для школьного проекта, я за 3 месяца прошёл курс на Coursera, прочитал книгу 'Hands-On ML' и реализовал модель классификации текстов с точностью 87%.",
        "В командных проектах я обычно беру на себя роль координатора. В последнем проекте по физике я распределил задачи, организовал еженедельные встречи и мы сдали работу на неделю раньше срока.",
        "Я подхожу к новым задачам методически: сначала разбираю проблему на части, ищу аналогии с тем что знаю, затем составляю план действий. Так я за 2 дня разобрался с Arduino и собрал систему умного полива для школьной теплицы.",
    ],
    "motivation": [
        "inVision U привлекает меня подходом D.R.I.V.E. — я хочу стать лидером, который создаёт позитивные изменения. Программа Foundation Year даёт уникальную возможность развить и академические знания, и лидерские качества.",
        "Через 5 лет я хочу основать EdTech стартап, который поможет школьникам из маленьких городов получить качественное образование. inVision U — идеальная стартовая площадка для этой цели.",
        "Для меня важнее всего влияние на общество. Я вырос в небольшом ауле и знаю, как сильно людям нужны возможности для развития. Хочу вернуть долг своему сообществу.",
        "Помимо учёбы я веду кружок робототехники для младших школьников — уже 2 года, 15 учеников. Это мой способ делать мир лучше прямо сейчас, не дожидаясь диплома.",
    ],
    "potential": [
        "Если бы у меня были неограниченные ресурсы, я бы создал сеть бесплатных IT-хабов в каждом районном центре Казахстана. По моим расчётам, это потребует около 50 площадок и может охватить 100 тысяч молодых людей.",
        "Когда наш хакатон перенесли с оффлайна в онлайн за день до начала, я быстро перестроил нашу стратегию, создал Miro-доску для совместной работы и мы заняли 2 место из 30 команд.",
        "В ближайший год я хочу освоить Data Science и машинное обучение, потому что верю что анализ данных может помочь оптимизировать распределение ресурсов в образовании.",
    ],
    "leadership": [
        "Когда в нашей волонтёрской группе возник конфликт между двумя лидерами о направлении проекта, я организовал открытую дискуссию, где каждый высказался. Мы нашли компромисс и объединили обе идеи в один более сильный проект.",
        "Когда мнения расходятся, я сначала слушаю все стороны, затем помогаю группе найти общие цели. Например, в дебатном клубе я предложил голосование с аргументацией — каждый должен объяснить свою позицию за 2 минуты.",
        "Я хочу решить проблему неравного доступа к образованию в сельских районах Казахстана. У 40% школьников в аулах нет доступа к интернету и современным учебным материалам. Это несправедливо.",
    ],
    "growth_path": [
        "2 года назад я интересовался только играми. Потом попал на хакатон, увлёкся программированием, прошёл курсы по Python и JavaScript. Сейчас я разрабатываю веб-приложения и мечтаю о карьере в IT. Ключевым моментом стал менторинг от старшего разработчика.",
        "Год назад я не умел выступать публично — боялся аудитории. Начал с дебатного клуба, затем выступил на школьной конференции, а в этом году провёл воркшоп на 50 человек. Регулярная практика и обратная связь помогли преодолеть страх.",
        "Больше всего на моё развитие повлиял учитель физики Асет Кайратович. Он показал мне что наука — это не формулы в учебнике, а способ понимать мир. Благодаря ему я участвовал в научных проектах и полюбил исследования.",
    ],
}

MOCK_COMMENTS = [
    "Сильный кандидат с хорошим потенциалом. Рекомендую к зачислению.",
    "Демонстрирует отличные лидерские качества и мотивацию.",
    "Хорошие результаты, но требуется дополнительное развитие в области командной работы.",
    "Выдающиеся аналитические способности. Будет ценным участником программы.",
    "К сожалению, уровень подготовки не соответствует требованиям программы.",
]


async def seed_mock_data():
    """Create mock users, vacancies, applications and analyses."""
    async with async_session() as db:
        # Check if mock data already exists
        count = await db.execute(select(func.count()).select_from(User))
        if count.scalar() > 5:
            print("Mock data already exists, skipping seed")
            return

        # --- 1. Create HR + Manager users ---
        hr_user = User(name="Координатор", email="hr@test.com", phone="87001000001", hashed_password=HASH, role=UserRole.HR)
        manager_user = User(name="Комиссия Председатель", email="manager@test.com", phone="87001000002", hashed_password=HASH, role=UserRole.MANAGER)
        db.add(hr_user)
        db.add(manager_user)
        await db.flush()

        # --- 2. Create 3 programs ---
        programs = [
            Vacancy(
                title="Foundation Year 2026",
                description="Годовая программа для талантливых выпускников школ. Развитие лидерских качеств, академических навыков и критического мышления.",
                requirements="Выпускник 11 класса, ЕНТ от 80 баллов, мотивационное видео",
                application_deadline=datetime.now(timezone.utc) + timedelta(days=60),
                created_by=hr_user.id,
            ),
            Vacancy(
                title="IT & Digital Skills",
                description="Интенсивная программа по цифровым навыкам: программирование, анализ данных, AI и цифровая грамотность.",
                requirements="Базовые знания компьютера, мотивация к обучению IT",
                application_deadline=datetime.now(timezone.utc) + timedelta(days=30),
                created_by=hr_user.id,
            ),
            Vacancy(
                title="Social Entrepreneurship",
                description="Программа для будущих социальных предпринимателей. Бизнес-мышление, проектное управление и социальное воздействие.",
                requirements="Идея социального проекта, опыт волонтёрства приветствуется",
                application_deadline=datetime.now(timezone.utc) + timedelta(days=45),
                created_by=hr_user.id,
            ),
        ]
        for p in programs:
            db.add(p)
        await db.flush()

        # --- 3. Assign questions to programs ---
        q_result = await db.execute(select(Question).where(Question.is_system == True).order_by(Question.id))
        all_questions = q_result.scalars().all()

        for prog in programs:
            for order, q in enumerate(all_questions):
                db.add(VacancyQuestion(vacancy_id=prog.id, question_id=q.id, order=order + 1))
        await db.flush()

        # --- 4. Create 15 students with applications ---
        statuses = [
            AnalysisStatus.ANALYZED, AnalysisStatus.ANALYZED,
            AnalysisStatus.SENT_TO_MANAGER, AnalysisStatus.SENT_TO_MANAGER, AnalysisStatus.SENT_TO_MANAGER,
            AnalysisStatus.APPROVED, AnalysisStatus.APPROVED, AnalysisStatus.APPROVED, AnalysisStatus.APPROVED,
            AnalysisStatus.REJECTED, AnalysisStatus.REJECTED,
            AnalysisStatus.ANALYZED, AnalysisStatus.SENT_TO_MANAGER,
            AnalysisStatus.APPROVED, AnalysisStatus.ANALYZED,
        ]

        for i, student in enumerate(MOCK_STUDENTS):
            # Create user
            user = User(
                name=student["name"], email=student["email"],
                phone=student["phone"], hashed_password=HASH,
                role=UserRole.CANDIDATE,
                bio=f"Выпускник школы, мечтает учиться в inVision U.",
            )
            db.add(user)
            await db.flush()

            # Assign to a program
            prog = programs[i % len(programs)]

            # Create candidate profile
            profile = CandidateProfile(
                user_id=user.id, vacancy_id=prog.id,
                full_name=student["name"], email=student["email"],
                source=CandidateSource.PLATFORM,
            )
            db.add(profile)
            await db.flush()

            # Create questionnaire answers
            q_map = {}
            for order, q in enumerate(all_questions):
                cat = q.category.value
                answers_pool = MOCK_ANSWERS.get(cat, MOCK_ANSWERS["experience"])
                answer_text = answers_pool[i % len(answers_pool)]

                qr = QuestionnaireResponse(
                    candidate_id=profile.id,
                    question_number=order + 1,
                    question_text=q.text,
                    answer_text=answer_text,
                )
                db.add(qr)
                q_map[order + 1] = cat

            # Generate scores
            cat_scores = {}
            for cat_key in ["experience", "competencies", "motivation", "potential", "leadership", "growth_path"]:
                base = random.randint(45, 95)
                cat_scores[cat_key] = {
                    "score": base,
                    "max": 100,
                    "label": {"experience": "Опыт", "competencies": "Компетенции", "motivation": "Мотивация",
                              "potential": "Потенциал", "leadership": "Лидерство", "growth_path": "Траектория роста"}[cat_key],
                    "explanation": "Оценка на основе длины, релевантности и конкретности ответов",
                }

            scores = [v["score"] for v in cat_scores.values()]
            total = round(sum(scores) / len(scores))
            status = statuses[i]

            strengths = sorted(cat_scores.items(), key=lambda x: x[1]["score"], reverse=True)
            weakness = sorted(cat_scores.items(), key=lambda x: x[1]["score"])

            # AI flags for some students
            ai_flags = []
            if random.random() > 0.6:
                ai_flags.append({
                    "question_number": random.randint(1, 10),
                    "ai_probability": round(random.uniform(0.4, 0.85), 2),
                    "is_ai_generated": random.random() > 0.5,
                    "indicators": random.sample(["uniform_sentence_length", "high_lexical_diversity", "ai_phrases", "structured_formatting"], k=2),
                })

            analysis = CandidateAnalysis(
                candidate_id=profile.id,
                vacancy_id=prog.id,
                status=status,
                total_score=total,
                vacancy_match=round(total / 100, 2),
                growth_potential="A" if total >= 80 else "B" if total >= 60 else "C",
                growth_path_score=round(cat_scores["growth_path"]["score"] / 100, 2),
                strengths=[f"{v['label']}: {v['score']}/100" for _, v in strengths[:3]],
                weaknesses=[f"{v['label']}: {v['score']}/100 — требует развития" for _, v in weakness[:2]],
                summary=f"Абитуриент {student['name']} набрал {total}/100 баллов. "
                        f"Сильнейшая категория — {strengths[0][1]['label']}. "
                        f"Оценка основана на анализе 21 ответа по 6 категориям.",
                ai_detection_flags=ai_flags,
                category_scores=cat_scores,
                approved_by=manager_user.id if status in (AnalysisStatus.APPROVED, AnalysisStatus.REJECTED) else None,
                manager_comment=random.choice(MOCK_COMMENTS) if status in (AnalysisStatus.APPROVED, AnalysisStatus.REJECTED) else None,
            )
            db.add(analysis)

        await db.commit()
        print(f"Seeded: 2 staff + 15 students + 3 programs with analyses")


if __name__ == "__main__":
    asyncio.run(seed_mock_data())
