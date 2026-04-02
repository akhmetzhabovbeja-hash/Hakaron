# inVision U — AI-платформа скрининга кандидатов

> Проект для **Decentrathon 5.0** by inDrive
> Initiative of Arsen Tomsky powered by inDrive

AI-платформа автоматизированного отбора абитуриентов для образовательной программы inVision U. Система анализирует эссе кандидатов с помощью LLM (Qwen3:8B), детектирует AI-сгенерированный текст (23 ML-движка), оценивает лидерский потенциал и траекторию роста.

---

## Ключевые возможности

- **Explainable AI** — оценка по 6 категориям с объяснением каждого балла
- **AI-детекция текста** — гибридная система: SlopTotal (23 ML-движка) + 14 русских эвристик, 82% accuracy
- **LLM-анализ** — Qwen3:8B через Ollama анализирует эссе, оценивает лидерство и прогнозирует успех
- **Полный пайплайн** — Абитуриент → AI-проверка → HR → Комиссия → Зачисление
- **Черновики** — автосохранение анкеты, возможность продолжить позже
- **PDF/Excel экспорт** — отчёты по абитуриентам и программам
- **Telegram бот** — привязка аккаунта по коду, статус заявки, уведомления
- **Дизайн inVision U** — стиль оригинального сайта (чёрный/белый + лайм)

---

## Архитектура

```
9 Docker-сервисов:

[Browser]  [Telegram Bot]
     \         /
      [Nginx :3000]
          |
    [FastAPI Backend :8000]
       /     |      \
  [Celery] [Redis] [PostgreSQL]
     |
  [ML Service :8001]
     |
  [Ollama + Qwen3:8B :11434]

  [SlopTotal AI Detection :8002]
     23 ML engines (BERT-RAID, E5, Fakespot, TMR...)
```

---

## Технологии

| Слой | Стек |
|------|------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Zustand |
| Backend | FastAPI, SQLAlchemy 2.0 (async), Pydantic v2, JWT |
| Database | PostgreSQL 16, Redis 7 |
| Async | Celery + Redis broker |
| LLM | Ollama + Qwen3:8B (Q4_K_M, 5.2GB, GPU) |
| AI Detection | SlopTotal (23 engines) + русские эвристики |
| Telegram | python-telegram-bot 21.x |
| PDF/Excel | ReportLab, OpenPyXL |
| DevOps | Docker Compose, Nginx |

---

## Быстрый старт

### Требования
- Docker + Docker Compose
- NVIDIA GPU 8GB+ (для Ollama/SlopTotal)
- 25GB+ свободного места

### Запуск

```bash
# 1. Клонировать
git clone https://github.com/akhmetzhabovbeja-hash/Hakaron.git
cd Hakaron

# 2. Скопировать .env
cp .env.example .env

# 3. Запустить все сервисы
docker-compose up -d --build

# 4. Скачать LLM модель (первый раз, ~5GB)
docker exec hakaron-ollama-1 ollama pull qwen3:8b

# 5. Открыть
# Frontend: http://localhost:3000
# Backend API: http://localhost:8000/docs
# SlopTotal UI: http://localhost:8002
```

### Тестовые аккаунты

| Роль | Email | Пароль |
|------|-------|--------|
| HR (Координатор) | hr@test.com | password123 |
| Комиссия | manager@test.com | password123 |
| Абитуриент | Регистрация через UI | — |

---

## Сервисы

| Сервис | Порт | Назначение |
|--------|------|-----------|
| Frontend (Nginx) | 3000 | React SPA + API proxy |
| Backend API | 8000 | FastAPI, 50+ endpoints |
| ML Service | 8001 | Оркестратор LLM-анализа |
| AI Detection | 8002 | SlopTotal, 23 ML-движка |
| Ollama | 11434 | Qwen3:8B LLM |
| PostgreSQL | 5432 | Основная БД |
| Redis | 6379 | Кэш + Celery broker |
| Celery Worker | — | Async LLM задачи |
| Telegram Bot | — | Бот для абитуриентов/HR |

---

## Поток обработки заявки

```
1. Абитуриент регистрируется → выбирает программу
2. Заполняет анкету (21 вопрос, 6 категорий) → автосохранение черновика
3. Загружает удостоверение личности → отправляет заявку
4. AI Detection (SlopTotal) → проверяет каждый ответ на AI-генерацию
5. Celery → ML Service → Ollama (Qwen3:8B) → LLM анализирует эссе
6. Результат: баллы по 6 категориям + strengths/weaknesses + AI-резюме
7. HR видит заявку с AI-флагами → отправляет в комиссию или отказывает
8. Комиссия одобряет/отклоняет с комментарием
9. Абитуриент видит результат на сайте и в Telegram
```

---

## AI-система

### Детекция AI-текста (гибридная)

**ML-движки (SlopTotal):**
- BERT-RAID, E5, Fakespot, TMR — нейросетевые классификаторы
- Linguistic, Formulaic — лингвистический анализ
- Калиброванный scoring с весами

**Русские эвристики (14 правил):**
- 3 тьера AI-фраз (50+ паттернов: "стоит отметить", "безусловно"...)
- Burstiness (равномерность длин предложений)
- Abstractness (отсутствие конкретных деталей)
- Comma density, vocabulary diversity, sentence uniformity
- Human markers (сленг, неформальная речь → снижение подозрения)

**Результаты тестирования:** 82% accuracy на 44 тестах, 0% false positives

### LLM-анализ (Qwen3:8B)

**6 категорий оценки (0-100):**
1. Опыт — реальные проекты и достижения
2. Компетенции — навыки и способность учиться
3. Мотивация — цели и искренность
4. Потенциал — амбиции и видение
5. Лидерство — вдохновение других, инициативность
6. Траектория роста — прогресс за последние годы

**Дополнительно:** лидерский потенциал, прогноз успеха, штраф за пустые/AI ответы

---

## Telegram бот

**Привязка аккаунта:**
1. Пользователь в профиле на сайте → "Получить код для Telegram"
2. 6-значный код (действует 60 сек)
3. В боте `/start` → ввести код → привязка

**Команды:**
- `/status` — статус заявки (абитуриент)
- `/applications` — новые заявки (HR/комиссия)
- `/stats` — статистика (HR/комиссия)
- `/profile` — информация профиля
- `/unlink` — отвязать аккаунт

---

## Структура проекта

```
Hakaron/
├── frontend/           — React + TypeScript + Tailwind CSS
│   ├── src/pages/      — 22 страницы
│   ├── src/components/ — CategoryScores, ProtectedRoute
│   ├── nginx.conf      — Nginx с dynamic DNS resolver
│   └── Dockerfile      — Multi-stage build (node → nginx)
├── backend/            — FastAPI + SQLAlchemy
│   ├── app/api/v1/     — 7 роутеров, 50+ endpoints
│   ├── app/models/     — 7 моделей данных
│   ├── app/tasks/      — Celery задачи (LLM analysis)
│   ├── app/schemas/    — Pydantic схемы
│   └── Dockerfile      — Python 3.11 + DejaVu fonts
├── ml-service/         — Оркестратор Ollama
│   ├── app/api/        — analyze.py (system prompt + JSON parsing)
│   └── Dockerfile      — Lightweight Python
├── AI-detection/       — SlopTotal (23 engines)
│   ├── app/engines/    — 17+ detection engines
│   └── Dockerfile      — Python + ML models
├── telegram-bot/       — Telegram бот
│   └── bot.py          — python-telegram-bot
├── docker-compose.yml  — 9 сервисов
└── .env                — Конфигурация
```

---

## Соответствие ТЗ

| Требование | Реализация |
|-----------|-----------|
| Выявление лидерского потенциала | LLM оценивает leadership + leadership_assessment |
| Оценка пройденного пути | Категория growth_path + growth_trajectory |
| Детектирование AI | SlopTotal (23 engines) + 14 русских эвристик |
| Предиктивная аналитика | predictive_score + predictive_summary от LLM |
| Explainable AI | Баллы по 6 категориям с explanation + модалка "Почему AI?" |
| Многомодальная оценка | Анкета + эссе + удостоверение + Telegram |

---

## Команда

Decentrathon 5.0 by inDrive

---

## Лицензия

MIT
