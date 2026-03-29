# Hakaron -- Архитектура платформы

## Содержание

- [Обзор](#обзор)
- [Стек технологий](#стек-технологий)
- [Архитектура системы](#архитектура-системы)
- [Docker-инфраструктура](#docker-инфраструктура)
- [Схема базы данных](#схема-базы-данных)
- [Аутентификация и авторизация](#аутентификация-и-авторизация)
- [Поток данных](#поток-данных)
- [Взаимодействие сервисов](#взаимодействие-сервисов)
- [ML-сервис](#ml-сервис)
- [Роли пользователей](#роли-пользователей)
- [Ключевые функции](#ключевые-функции)

---

## Обзор

Hakaron -- платформа AI-скрининга кандидатов. Кандидат отвечает на 15 интеллектуальных
вопросов, ML-модель анализирует ответы и формирует оценку (score/100), сильные и слабые
стороны, соответствие вакансии, потенциал роста и краткое резюме. Руководитель просматривает
рейтинг, утверждает кандидатов, после чего HR получает уведомление.

---

## Стек технологий

| Слой            | Технологии                                                     |
| --------------- | -------------------------------------------------------------- |
| Frontend        | React 18, TypeScript, Vite, TailwindCSS, Zustand, React Router |
| Backend API     | Python, FastAPI, SQLAlchemy 2.0, Alembic, Pydantic v2          |
| ML Service      | Python, FastAPI, transformers, torch (GPU: RTX 3070 Ti 8GB)    |
| База данных     | PostgreSQL 16                                                   |
| Кэш / Брокер   | Redis 7 (кэш, Celery broker, Celery result backend)            |
| Фоновые задачи  | Celery                                                          |
| Аутентификация  | JWT (access + refresh), bcrypt, python-jose                     |
| Контейнеризация | Docker, Docker Compose 3.9                                      |

---

## Архитектура системы

```
                         +---------------------+
                         |      Frontend       |
                         | React + Vite + TS   |
                         |     :3000            |
                         +----------+----------+
                                    |
                                    | HTTP (REST API)
                                    v
                         +----------+----------+
                         |    Backend API      |
                         |  FastAPI + SQLAlchemy|
                         |     :8000           |
                         +--+------+-------+---+
                            |      |       |
              +-------------+      |       +-------------+
              |                    |                     |
              v                    v                     v
   +----------+---+     +----------+---+     +-----------+-------+
   |  PostgreSQL  |     |    Redis     |     |   ML Service      |
   |    :5432     |     |    :6379     |     | FastAPI + torch   |
   |              |     |              |     |     :8001          |
   +--------------+     +------+-------+     | GPU: RTX 3070 Ti  |
                               |             +-------------------+
                               |
                        +------+-------+
                        | Celery Worker|
                        | (фоновые     |
                        |  задачи)     |
                        +--------------+
```

### Связи между сервисами

```
Frontend ---[HTTP/JSON]--> Backend API ---[HTTP/JSON]--> ML Service
                              |
                              +---[asyncpg]----> PostgreSQL
                              |
                              +---[redis]------> Redis (кэш)
                              |
                              +---[redis]------> Redis (Celery broker, db=1)
                                                   |
                                            Celery Worker
                                              |        |
                                [парсинг HH.ru]   [уведомления HR]
```

---

## Docker-инфраструктура

Проект запускается через `docker-compose.yml`. Все сервисы работают в единой Docker-сети.

| Сервис          | Образ / Сборка          | Порт  | Зависимости            |
| --------------- | ----------------------- | ----- | ---------------------- |
| `postgres`      | postgres:16-alpine      | 5432  | --                     |
| `redis`         | redis:7-alpine          | 6379  | --                     |
| `backend`       | ./backend/Dockerfile    | 8000  | postgres, redis        |
| `ml-service`    | ./ml-service/Dockerfile | 8001  | --                     |
| `celery-worker` | ./backend/Dockerfile    | --    | postgres, redis        |
| `frontend`      | ./frontend/Dockerfile   | 3000  | backend                |

**Тома (volumes):**

- `postgres_data` -- персистентное хранилище PostgreSQL
- `redis_data` -- персистентное хранилище Redis

**Healthcheck:** PostgreSQL и Redis имеют проверки здоровья (`pg_isready`, `redis-cli ping`).
Backend и Celery Worker запускаются только после успешного прохождения healthcheck
зависимых сервисов (`condition: service_healthy`).

---

## Схема базы данных

### ER-диаграмма

```
+------------------+        +-------------------+
|      users       |        |     vacancies     |
+------------------+        +-------------------+
| PK id            |<---+   | PK id             |
|    email (uniq)  |    |   |    title          |
|    name          |    |   |    description    |
|    hashed_password|   |   |    requirements   |
|    role (enum)   |    |   |    is_active      |
|    is_active     |    +---| FK created_by     |
|    created_at    |        |    created_at     |
+-------+----------+        +--------+----------+
        |                            |
        | 1                          | 1
        |                            |
        | N                          | N
+-------+-------------------+--------+----------+
|        candidate_profiles                     |
+-----------------------------------------------+
| PK id                                         |
| FK user_id      --> users.id (nullable)       |
| FK vacancy_id   --> vacancies.id              |
|    full_name                                  |
|    email                                      |
|    phone                                      |
|    source (enum: platform | hh_parsed)        |
|    hh_url (nullable)                          |
|    created_at                                 |
+---+-------------------+-----------------------+
    |                   |
    | 1                 | 1
    |                   |
    | N                 | N
+---+--------------+  +-+---------------------+
|questionnaire_    |  |  candidate_analyses    |
|responses         |  +------------------------+
+------------------+  | PK id                  |
| PK id            |  | FK candidate_id        |
| FK candidate_id  |  | FK vacancy_id          |
|    question_number|  |    total_score (0-100) |
|    question_text |  |    vacancy_match (float)|
|    answer_text   |  |    growth_potential     |
|    created_at    |  |    strengths (JSON)     |
+------------------+  |    weaknesses (JSON)    |
                      |    summary             |
                      |    status (enum)       |
                      | FK approved_by (nullable)|
                      |    created_at          |
                      +------------------------+
```

### Таблица `users`

| Поле             | Тип           | Ограничения              |
| ---------------- | ------------- | ------------------------ |
| id               | INTEGER       | PK, autoincrement        |
| email            | VARCHAR(255)  | UNIQUE, INDEX            |
| name             | VARCHAR(255)  |                          |
| hashed_password  | VARCHAR(255)  |                          |
| role             | ENUM          | candidate / manager / hr |
| is_active        | BOOLEAN       | default: true            |
| created_at       | TIMESTAMPTZ   | default: now()           |

### Таблица `vacancies`

| Поле         | Тип           | Ограничения                |
| ------------ | ------------- | -------------------------- |
| id           | INTEGER       | PK, autoincrement          |
| title        | VARCHAR(255)  |                            |
| description  | TEXT          |                            |
| requirements | TEXT          | default: ""                |
| is_active    | BOOLEAN       | default: true              |
| created_by   | INTEGER       | FK -> users.id             |
| created_at   | TIMESTAMPTZ   | default: now()             |

### Таблица `candidate_profiles`

| Поле       | Тип                  | Ограничения                       |
| ---------- | -------------------- | --------------------------------- |
| id         | INTEGER              | PK, autoincrement                 |
| user_id    | INTEGER (nullable)   | FK -> users.id                    |
| vacancy_id | INTEGER              | FK -> vacancies.id                |
| full_name  | VARCHAR(255)         |                                   |
| email      | VARCHAR(255)         |                                   |
| phone      | VARCHAR(50)          | default: ""                       |
| source     | ENUM                 | platform / hh_parsed              |
| hh_url     | VARCHAR(500) (null)  |                                   |
| created_at | TIMESTAMPTZ          | default: now()                    |

`user_id` может быть NULL для кандидатов, загруженных через парсинг HH.ru (у них нет учетной
записи в системе).

### Таблица `questionnaire_responses`

| Поле            | Тип       | Ограничения                     |
| --------------- | --------- | ------------------------------- |
| id              | INTEGER   | PK, autoincrement               |
| candidate_id    | INTEGER   | FK -> candidate_profiles.id     |
| question_number | INTEGER   |                                 |
| question_text   | TEXT      |                                 |
| answer_text     | TEXT      |                                 |
| created_at      | TIMESTAMPTZ | default: now()                |

### Таблица `candidate_analyses`

| Поле             | Тип                 | Ограничения                     |
| ---------------- | -------------------- | ------------------------------- |
| id               | INTEGER              | PK, autoincrement               |
| candidate_id     | INTEGER              | FK -> candidate_profiles.id     |
| vacancy_id       | INTEGER              | FK -> vacancies.id              |
| total_score      | INTEGER              | default: 0                      |
| vacancy_match    | FLOAT                | default: 0.0                    |
| growth_potential | TEXT                 | default: ""                     |
| strengths        | JSON                 | default: []                     |
| weaknesses       | JSON                 | default: []                     |
| summary          | TEXT                 | default: ""                     |
| status           | ENUM                 | pending / processing / analyzed / approved / rejected |
| approved_by      | INTEGER (nullable)   | FK -> users.id                  |
| created_at       | TIMESTAMPTZ          | default: now()                  |

**Статусы анализа (AnalysisStatus):**

- `pending` -- ответы получены, анализ еще не начат
- `processing` -- ML-сервис обрабатывает данные
- `analyzed` -- анализ завершен, ожидает решения руководителя
- `approved` -- руководитель утвердил кандидата
- `rejected` -- руководитель отклонил кандидата

---

## Аутентификация и авторизация

### Механизм

- Хэширование паролей: **bcrypt** (passlib)
- Токены: **JWT** (python-jose), алгоритм **HS256**
- Access token: время жизни **30 минут**
- Refresh token: время жизни **7 дней**

### Поток аутентификации

```
Клиент                        Backend                      PostgreSQL
  |                              |                              |
  |--- POST /api/v1/auth/login -->                              |
  |    { email, password }       |                              |
  |                              |--- SELECT user by email ---->|
  |                              |<-- user row ----------------|
  |                              |                              |
  |                              | verify_password(plain, hash) |
  |                              |                              |
  |<-- 200 OK ------------------|                              |
  |    { access_token,           |                              |
  |      refresh_token }         |                              |
  |                              |                              |
  |--- GET /api/v1/... -------->|                              |
  |    Authorization: Bearer AT  |                              |
  |                              | decode_token(AT)             |
  |                              | sub -> user_id               |
  |<-- 200 response ------------|                              |
  |                              |                              |
  |--- POST /api/v1/auth/refresh ->                             |
  |    { refresh_token }         |                              |
  |                              | decode_token(RT)             |
  |                              | type == "refresh"            |
  |<-- 200 { new access_token,   |                              |
  |          new refresh_token } |                              |
```

### Структура JWT payload

```json
{
  "sub": "42",
  "exp": 1711700000,
  "type": "access"
}
```

Поле `type` отличает access-токен от refresh-токена (`"access"` / `"refresh"`).

---

## Поток данных

Полный жизненный цикл кандидата в системе:

```
 1. Кандидат регистрируется           POST /api/v1/auth/register
         |
         v
 2. Кандидат выбирает вакансию        GET  /api/v1/vacancies
         |
         v
 3. Кандидат проходит анкету          POST /api/v1/candidates/questionnaire
    (15 вопросов)                     -> сохранение в questionnaire_responses
         |
         v
 4. Backend отправляет ответы         POST http://ml-service:8001/api/v1/analyze
    на ML-анализ                      { candidate_id, vacancy_id, answers }
         |
         v
 5. ML Service анализирует            - Embeddings (ruBERT / sbert)
    ответы                            - Scoring (0-100)
         |                            - Cosine similarity с требованиями вакансии
         v                            - Определение strengths / weaknesses
 6. Результат сохраняется             candidate_analyses.status = "analyzed"
    в БД
         |
         v
 7. Руководитель просматривает        GET /api/v1/manager/candidates
    дашборд с рейтингом               ?vacancy_id=X&sort=score
         |
         v
 8. Руководитель утверждает           POST /api/v1/manager/candidates/{id}/approve
    или отклоняет кандидата            status -> "approved" / "rejected"
         |                            approved_by -> manager.user_id
         v
 9. HR получает уведомление           Celery task: notifications.py
    об утвержденных кандидатах         (email / внутреннее уведомление)
```

### Альтернативный поток: парсинг HH.ru

```
 Руководитель запрашивает             POST /api/v1/vacancies/{id}/parse-hh
 парсинг кандидатов из HH.ru
         |
         v
 Celery Worker выполняет задачу       tasks/parsing.py
 -> HTTP запросы к api.hh.ru          -> создание candidate_profiles
                                         с source = "hh_parsed"
         |
         v
 Кандидаты появляются                 user_id = NULL (нет аккаунта)
 в списке по вакансии                 hh_url -> ссылка на профиль HH.ru
```

---

## Взаимодействие сервисов

### Backend -> ML Service

```
Backend (analysis_service.py)
    |
    | httpx.AsyncClient
    | POST http://ml-service:8001/api/v1/analyze
    | timeout: 120s
    |
    | Request body:
    | {
    |   "candidate_id": int,
    |   "vacancy_id": int,
    |   "answers": [
    |     { "question_number": 1, "question_text": "...", "answer_text": "..." },
    |     ...15 items
    |   ]
    | }
    |
    v
ML Service
    |
    | Response body:
    | {
    |   "total_score": 78,
    |   "vacancy_match": 0.85,
    |   "growth_potential": "Высокий потенциал роста...",
    |   "strengths": ["Опыт лидерства", "Знание Python"],
    |   "weaknesses": ["Нет опыта в DevOps"],
    |   "summary": "Кандидат демонстрирует..."
    | }
```

### Backend -> Redis

- **db=0** -- кэширование (сессии, промежуточные данные)
- **db=1** -- Celery broker (очередь задач)
- **db=2** -- Celery result backend (результаты выполненных задач)

### Backend -> PostgreSQL

- Подключение: `postgresql+asyncpg` (асинхронный драйвер)
- ORM: SQLAlchemy 2.0 (mapped_column, Mapped)
- Миграции: Alembic

### Celery Worker

Celery Worker использует тот же код backend и выполняет фоновые задачи:

- `tasks/parsing.py` -- парсинг кандидатов с HH.ru через api.hh.ru
- `tasks/notifications.py` -- отправка уведомлений HR при утверждении кандидатов

---

## ML-сервис

### Аппаратные ограничения

- GPU: NVIDIA RTX 3070 Ti (8 GB VRAM)
- Модели должны помещаться в 8 GB видеопамяти

### Рекомендуемые модели

| Модель                                              | Размер   | Назначение                |
| --------------------------------------------------- | -------- | ------------------------- |
| cointegrated/rubert-tiny2                            | ~120 MB  | Быстрый, хорош для русского текста |
| ai-forever/sbert_large_nlu_ru                        | ~1.3 GB  | Более высокое качество    |
| sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2 | ~470 MB | Мультиязычный     |

### Конвейер анализа

1. **Загрузка модели** -- один раз при старте сервиса (`load_model()`)
2. **Получение ответов** -- 15 пар (вопрос + ответ) от backend
3. **Эмбеддинги** -- vectorize ответы и требования вакансии
4. **Скоринг** -- оценка качества, глубины и релевантности ответов (0-100)
5. **Vacancy match** -- cosine similarity между эмбеддингами ответов и требований
6. **Потенциал роста** -- оценка на основе паттернов в ответах
7. **Strengths / Weaknesses** -- классификация по тематическим кластерам
8. **Summary** -- генерация текстового резюме

---

## Роли пользователей

### Candidate (Кандидат)

- Регистрация и вход в систему
- Просмотр доступных вакансий
- Прохождение анкеты из 15 вопросов
- Просмотр статуса своей заявки

### Manager (Руководитель)

- Создание и управление вакансиями
- Просмотр дашборда с рейтингом кандидатов (сортировка по score)
- Фильтрация кандидатов по вакансии
- Утверждение / отклонение кандидатов
- Запуск парсинга кандидатов с HH.ru

### HR

- Получение уведомлений об утвержденных кандидатах
- Просмотр утвержденных кандидатов и их аналитики
- Дальнейшая работа с утвержденными кандидатами

---

## Ключевые функции

1. **15 интеллектуальных вопросов** -- анализируют опыт, компетенции и потенциал кандидата
2. **AI-анализ** -- score/100, сильные/слабые стороны, соответствие вакансии, потенциал роста, резюме
3. **Дашборд руководителя** -- рейтинг кандидатов по баллам, фильтрация по вакансии
4. **Workflow утверждения** -- руководитель утверждает, HR получает уведомление
5. **Парсинг HH.ru** -- поиск внешних кандидатов через API hh.ru
6. **Мульти-вакансии** -- поддержка нескольких вакансий одновременно

---

## Структура проекта

```
Hakaron/
+-- docker-compose.yml
+-- docker-compose.dev.yml
+-- .env
|
+-- frontend/
|   +-- Dockerfile
|   +-- src/
|       +-- main.tsx
|       +-- App.tsx
|       +-- api/            # HTTP-клиент к backend
|       +-- components/     # Переиспользуемые UI-компоненты
|       +-- features/       # Feature-модули
|       +-- hooks/          # Кастомные React-хуки
|       +-- layouts/        # Layout-компоненты
|       +-- pages/          # Страницы (роуты)
|       +-- store/          # Zustand-хранилища
|       +-- types/          # TypeScript типы
|       +-- utils/          # Утилиты
|
+-- backend/
|   +-- Dockerfile
|   +-- app/
|       +-- main.py             # FastAPI приложение
|       +-- core/
|       |   +-- config.py       # Pydantic Settings
|       |   +-- database.py     # SQLAlchemy engine + session
|       |   +-- security.py     # JWT + bcrypt
|       +-- models/
|       |   +-- user.py         # User, UserRole
|       |   +-- vacancy.py      # Vacancy
|       |   +-- candidate.py    # CandidateProfile, CandidateSource
|       |   +-- questionnaire.py# QuestionnaireResponse
|       |   +-- analysis.py     # CandidateAnalysis, AnalysisStatus
|       +-- schemas/
|       |   +-- auth.py         # Pydantic-схемы аутентификации
|       |   +-- candidate.py    # Pydantic-схемы кандидатов
|       |   +-- vacancy.py      # Pydantic-схемы вакансий
|       +-- api/v1/
|       |   +-- auth.py         # /api/v1/auth/*
|       |   +-- candidates.py   # /api/v1/candidates/*
|       |   +-- vacancies.py    # /api/v1/vacancies/*
|       |   +-- manager.py      # /api/v1/manager/*
|       |   +-- hr.py           # /api/v1/hr/*
|       +-- services/
|       |   +-- analysis_service.py  # HTTP-клиент к ML Service
|       |   +-- parser_service.py    # Парсинг HH.ru
|       +-- tasks/
|           +-- parsing.py      # Celery: парсинг HH.ru
|           +-- notifications.py# Celery: уведомления HR
|
+-- ml-service/
|   +-- Dockerfile
|   +-- app/
|       +-- main.py             # FastAPI приложение
|       +-- api/
|       |   +-- analyze.py      # POST /api/v1/analyze
|       +-- services/
|           +-- nlp_analyzer.py # NLP-модель, скоринг, эмбеддинги
|
+-- docs/
    +-- ARCHITECTURE.md         # Этот документ
```
