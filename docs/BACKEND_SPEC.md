# Hakaron Backend -- Техническая спецификация (ТЗ)

> **Версия:** 0.1.0
> **Дата:** 2026-03-29
> **Стек:** Python 3.11+ | FastAPI | SQLAlchemy 2.0 (async) | Alembic | PostgreSQL 16 | Redis 7 | Celery | httpx
> **Базовый URL API:** `http://localhost:8000/api/v1`

---

## 1. Обзор

### 1.1 Назначение

Hakaron -- платформа AI-скрининга кандидатов. Бекенд выполняет роль центрального звена системы:

- Предоставляет REST API для фронтенда (React, порт 3000)
- Управляет пользователями, вакансиями, анкетами и результатами анализа
- Оркестрирует взаимодействие с ML-сервисом (порт 8001) для AI-анализа кандидатов
- Запускает фоновые задачи (Celery) для парсинга HH.ru и отправки уведомлений

### 1.2 Архитектура взаимодействия

```
Frontend (React :3000)
    |
    | HTTP REST (JSON)
    v
Backend (FastAPI :8000) ---httpx---> ML Service (FastAPI :8001)
    |                                       |
    | SQLAlchemy async                      | (внутренняя ML-логика)
    v                                       v
PostgreSQL :5432                    (возвращает JSON-анализ)
    ^
    |
Celery Worker ----> Redis :6379 (broker + result backend)
```

### 1.3 Структура кода

```
backend/
  app/
    main.py                       # FastAPI application, CORS, роутеры
    core/
      config.py                   # Settings (pydantic-settings)
      database.py                 # AsyncEngine, async_sessionmaker, Base, get_db
      security.py                 # bcrypt, JWT (access/refresh), encode/decode
    models/
      user.py                     # User, UserRole enum
      vacancy.py                  # Vacancy
      candidate.py                # CandidateProfile, CandidateSource enum
      questionnaire.py            # QuestionnaireResponse
      analysis.py                 # CandidateAnalysis, AnalysisStatus enum
    schemas/
      auth.py                     # RegisterRequest, LoginRequest, TokenResponse, UserResponse
      candidate.py                # SubmitQuestionnaireRequest, CandidateListResponse, CandidateAnalysisResponse
      vacancy.py                  # VacancyCreate, VacancyResponse
    api/v1/
      __init__.py                 # APIRouter prefix=/v1, подключение sub-routers
      auth.py                     # /auth/*
      candidates.py               # /candidates/*
      vacancies.py                # /vacancies/*
      manager.py                  # /manager/*
      hr.py                       # /hr/*
    services/
      analysis_service.py         # HTTP-клиент к ML-сервису
      parser_service.py           # HTTP-клиент к HH.ru API
    tasks/
      __init__.py                 # Celery app instance
      parsing.py                  # Task: parse_hh_candidates
      notifications.py            # Task: send_candidate_notification
```

---

## 2. Модели базы данных

### 2.1 Перечисления (Enums)

| Enum              | Значения                                            | Описание                              |
|-------------------|-----------------------------------------------------|---------------------------------------|
| `UserRole`        | `candidate`, `manager`, `hr`                        | Роль пользователя в системе           |
| `CandidateSource` | `platform`, `hh_parsed`                             | Источник кандидата                     |
| `AnalysisStatus`  | `pending`, `processing`, `analyzed`, `approved`, `rejected` | Статус AI-анализа и решения |

Все enum-ы наследуются от `(str, enum.Enum)` и хранятся в PostgreSQL как тип `VARCHAR` через `sqlalchemy.Enum`.

### 2.2 Таблица `users`

Модель: `app.models.user.User`

| Поле              | Тип                      | Ограничения                  | Описание                    |
|-------------------|--------------------------|------------------------------|-----------------------------|
| `id`              | `INTEGER`                | PK, autoincrement            | Идентификатор               |
| `email`           | `VARCHAR(255)`           | UNIQUE, INDEX                | Email (логин)               |
| `name`            | `VARCHAR(255)`           | NOT NULL                     | Имя пользователя            |
| `hashed_password` | `VARCHAR(255)`           | NOT NULL                     | Хеш пароля (bcrypt)         |
| `role`            | `ENUM(UserRole)`         | DEFAULT `candidate`          | Роль                        |
| `is_active`       | `BOOLEAN`                | DEFAULT `true`               | Активность аккаунта         |
| `created_at`      | `TIMESTAMPTZ`            | DEFAULT `now()`              | Дата создания               |

**Индексы:**
- `ix_users_email` -- уникальный индекс по `email`

### 2.3 Таблица `vacancies`

Модель: `app.models.vacancy.Vacancy`

| Поле          | Тип              | Ограничения          | Описание                        |
|---------------|------------------|----------------------|---------------------------------|
| `id`          | `INTEGER`        | PK, autoincrement    | Идентификатор                   |
| `title`       | `VARCHAR(255)`   | NOT NULL             | Название вакансии               |
| `description` | `TEXT`           | NOT NULL             | Описание вакансии               |
| `requirements`| `TEXT`           | DEFAULT `""`         | Требования                      |
| `is_active`   | `BOOLEAN`        | DEFAULT `true`       | Активна ли вакансия             |
| `created_by`  | `INTEGER`        | FK -> `users.id`     | Кто создал (manager)            |
| `created_at`  | `TIMESTAMPTZ`    | DEFAULT `now()`      | Дата создания                   |

**Индексы (рекомендуемые):**
- `ix_vacancies_created_by` -- индекс по `created_by` для фильтрации по автору
- `ix_vacancies_is_active` -- индекс по `is_active` для выборки активных

### 2.4 Таблица `candidate_profiles`

Модель: `app.models.candidate.CandidateProfile`

| Поле         | Тип                        | Ограничения                  | Описание                                |
|--------------|----------------------------|------------------------------|-----------------------------------------|
| `id`         | `INTEGER`                  | PK, autoincrement            | Идентификатор                           |
| `user_id`    | `INTEGER` or `NULL`        | FK -> `users.id`, NULLABLE   | Связь с аккаунтом (NULL для hh_parsed)  |
| `vacancy_id` | `INTEGER`                  | FK -> `vacancies.id`         | На какую вакансию откликнулся           |
| `full_name`  | `VARCHAR(255)`             | NOT NULL                     | ФИО                                     |
| `email`      | `VARCHAR(255)`             | NOT NULL                     | Email кандидата                          |
| `phone`      | `VARCHAR(50)`              | DEFAULT `""`                 | Телефон                                 |
| `source`     | `ENUM(CandidateSource)`    | DEFAULT `platform`           | Источник кандидата                      |
| `hh_url`     | `VARCHAR(500)` or `NULL`   | NULLABLE                     | Ссылка на резюме на HH.ru              |
| `created_at` | `TIMESTAMPTZ`              | DEFAULT `now()`              | Дата создания                           |

**Индексы (рекомендуемые):**
- `ix_candidate_profiles_vacancy_id` -- для выборки кандидатов по вакансии
- `ix_candidate_profiles_user_id` -- для поиска профиля по пользователю
- `ix_candidate_profiles_source` -- для фильтрации по источнику

### 2.5 Таблица `questionnaire_responses`

Модель: `app.models.questionnaire.QuestionnaireResponse`

| Поле              | Тип          | Ограничения                          | Описание              |
|-------------------|--------------|--------------------------------------|-----------------------|
| `id`              | `INTEGER`    | PK, autoincrement                    | Идентификатор         |
| `candidate_id`    | `INTEGER`    | FK -> `candidate_profiles.id`        | Кандидат              |
| `question_number` | `INTEGER`    | NOT NULL                             | Номер вопроса         |
| `question_text`   | `TEXT`       | NOT NULL                             | Текст вопроса         |
| `answer_text`     | `TEXT`       | NOT NULL                             | Ответ кандидата       |
| `created_at`      | `TIMESTAMPTZ`| DEFAULT `now()`                      | Дата создания         |

**Индексы (рекомендуемые):**
- `ix_questionnaire_responses_candidate_id` -- для выборки всех ответов кандидата

### 2.6 Таблица `candidate_analyses`

Модель: `app.models.analysis.CandidateAnalysis`

| Поле              | Тип                      | Ограничения                   | Описание                              |
|-------------------|--------------------------|-------------------------------|---------------------------------------|
| `id`              | `INTEGER`                | PK, autoincrement             | Идентификатор                         |
| `candidate_id`    | `INTEGER`                | FK -> `candidate_profiles.id` | Кандидат                              |
| `vacancy_id`      | `INTEGER`                | FK -> `vacancies.id`          | Вакансия                              |
| `total_score`     | `INTEGER`                | DEFAULT `0`                   | Общий балл (0-100)                    |
| `vacancy_match`   | `FLOAT`                  | DEFAULT `0.0`                 | Совпадение с вакансией (0.0-1.0)      |
| `growth_potential` | `TEXT`                  | DEFAULT `""`                  | Описание потенциала роста             |
| `strengths`       | `JSON`                   | DEFAULT `[]`                  | Массив сильных сторон                 |
| `weaknesses`      | `JSON`                   | DEFAULT `[]`                  | Массив слабых сторон                  |
| `summary`         | `TEXT`                   | DEFAULT `""`                  | Краткое резюме AI-анализа             |
| `status`          | `ENUM(AnalysisStatus)`   | DEFAULT `pending`             | Текущий статус                        |
| `approved_by`     | `INTEGER` or `NULL`      | FK -> `users.id`, NULLABLE    | Кто одобрил (manager)                 |
| `created_at`      | `TIMESTAMPTZ`            | DEFAULT `now()`               | Дата создания                         |

**Индексы (рекомендуемые):**
- `ix_candidate_analyses_candidate_id` -- для поиска анализа по кандидату
- `ix_candidate_analyses_vacancy_id` -- для выборки анализов по вакансии
- `ix_candidate_analyses_status` -- для фильтрации по статусу (approved, pending и т.д.)

### 2.7 Диаграмма связей (ER)

```
users (1) ---< vacancies (N)           [created_by -> users.id]
users (1) ---< candidate_profiles (N)  [user_id -> users.id, NULLABLE]
vacancies (1) ---< candidate_profiles (N)  [vacancy_id -> vacancies.id]
candidate_profiles (1) ---< questionnaire_responses (N)  [candidate_id -> candidate_profiles.id]
candidate_profiles (1) ---< candidate_analyses (N)       [candidate_id -> candidate_profiles.id]
vacancies (1) ---< candidate_analyses (N)                [vacancy_id -> vacancies.id]
users (1) ---< candidate_analyses (N)                    [approved_by -> users.id, NULLABLE]
```

---

## 3. API эндпоинты

Все эндпоинты имеют префикс `/api/v1`. Формат обмена -- JSON.

### 3.1 Auth (`/api/v1/auth`)

| Метод  | Path        | Описание                      | Auth   | Роли     | Request Body                                              | Response                                                |
|--------|-------------|-------------------------------|--------|----------|-----------------------------------------------------------|---------------------------------------------------------|
| `POST` | `/register` | Регистрация нового пользователя | Нет  | Все      | `RegisterRequest`                                         | `TokenResponse` (200) / 400 "Email already registered"  |
| `POST` | `/login`    | Авторизация                   | Нет    | Все      | `LoginRequest`                                            | `TokenResponse` (200) / 401 "Invalid credentials"       |
| `GET`  | `/me`       | Получить текущего пользователя | JWT   | Все      | --                                                        | `UserResponse` (200) / 401                              |

**Схемы:**

```python
# RegisterRequest
{
    "email": "user@example.com",
    "name": "Иван Иванов",
    "password": "securepassword123",
    "role": "candidate"  # "candidate" | "manager" | "hr"
}

# LoginRequest
{
    "email": "user@example.com",
    "password": "securepassword123"
}

# TokenResponse
{
    "access_token": "eyJhbGciOi...",
    "refresh_token": "eyJhbGciOi...",
    "token_type": "bearer"
}

# UserResponse
{
    "id": 1,
    "email": "user@example.com",
    "name": "Иван Иванов",
    "role": "candidate"
}
```

### 3.2 Candidates (`/api/v1/candidates`)

| Метод  | Path                       | Описание                         | Auth | Роли        | Request Body                   | Response                                     |
|--------|----------------------------|----------------------------------|------|-------------|--------------------------------|----------------------------------------------|
| `POST` | `/submit-questionnaire`    | Отправить заполненную анкету     | JWT  | candidate   | `SubmitQuestionnaireRequest`   | `{"message": "...", "candidate_id": int}`    |
| `GET`  | `/{candidate_id}/status`   | Получить статус анализа кандидата | JWT | candidate   | --                             | `{"candidate_id": int, "status": str}`       |

**Схемы:**

```python
# SubmitQuestionnaireRequest
{
    "vacancy_id": 1,
    "full_name": "Иван Иванов",
    "email": "ivan@example.com",
    "phone": "+7-999-123-45-67",
    "answers": [
        {
            "question_number": 1,
            "question_text": "Расскажите о вашем опыте...",
            "answer_text": "Имею 5 лет опыта..."
        }
    ]
}
```

### 3.3 Vacancies (`/api/v1/vacancies`)

| Метод  | Path | Описание                  | Auth | Роли              | Request Body     | Response               |
|--------|------|---------------------------|------|--------------------|------------------|------------------------|
| `GET`  | `/`  | Список активных вакансий  | Нет  | Все                | --               | `list[VacancyResponse]`|
| `POST` | `/`  | Создать вакансию          | JWT  | manager            | `VacancyCreate`  | `VacancyResponse`      |

**Схемы:**

```python
# VacancyCreate
{
    "title": "Backend Developer",
    "description": "Разработка серверной части...",
    "requirements": "Python 3+, FastAPI, SQL..."
}

# VacancyResponse
{
    "id": 1,
    "title": "Backend Developer",
    "description": "Разработка серверной части...",
    "requirements": "Python 3+, FastAPI, SQL...",
    "is_active": true
}
```

### 3.4 Manager (`/api/v1/manager`)

| Метод  | Path                                   | Описание                          | Auth | Роли    | Query Params                        | Response                      |
|--------|----------------------------------------|-----------------------------------|------|---------|-------------------------------------|-------------------------------|
| `GET`  | `/candidates`                          | Список кандидатов с анализом      | JWT  | manager | `vacancy_id?: int`, `sort_by?: str` | `list[CandidateListResponse]` |
| `GET`  | `/candidates/{candidate_id}/analysis`  | Полный AI-анализ кандидата        | JWT  | manager | --                                  | `CandidateAnalysisResponse`   |
| `POST` | `/candidates/{candidate_id}/approve`   | Одобрить кандидата                | JWT  | manager | --                                  | `{"message": str, "candidate_id": int}` |
| `POST` | `/candidates/{candidate_id}/reject`    | Отклонить кандидата               | JWT  | manager | --                                  | `{"message": str, "candidate_id": int}` |
| `GET`  | `/external-candidates`                 | Список кандидатов с HH.ru         | JWT  | manager | --                                  | `list[CandidateListResponse]` |

**Схемы:**

```python
# CandidateListResponse
{
    "id": 1,
    "full_name": "Иван Иванов",
    "vacancy_title": "Backend Developer",
    "total_score": 85,
    "status": "analyzed",
    "source": "platform"
}

# CandidateAnalysisResponse
{
    "id": 1,
    "candidate_id": 1,
    "total_score": 85,
    "vacancy_match": 0.92,
    "growth_potential": "Высокий потенциал роста...",
    "strengths": ["Python", "System Design"],
    "weaknesses": ["Нет опыта с Kubernetes"],
    "summary": "Сильный кандидат с отличным знанием...",
    "status": "analyzed"
}
```

### 3.5 HR (`/api/v1/hr`)

| Метод  | Path                     | Описание                                | Auth | Роли | Response                                  |
|--------|--------------------------|------------------------------------------|------|------|-------------------------------------------|
| `GET`  | `/approved`              | Список одобренных кандидатов для связи   | JWT  | hr   | `list[CandidateListResponse]`             |
| `POST` | `/notify/{candidate_id}` | Отправить уведомление кандидату           | JWT  | hr   | `{"message": str, "candidate_id": int}`   |

### 3.6 Health Check

| Метод | Path      | Описание               | Auth | Response                                      |
|-------|-----------|------------------------|------|-----------------------------------------------|
| `GET` | `/health` | Проверка состояния     | Нет  | `{"status": "ok", "service": "hakaron-backend"}` |

### 3.7 Сводная таблица всех эндпоинтов

| #  | Метод  | Полный path                                       | Роли      |
|----|--------|---------------------------------------------------|-----------|
| 1  | GET    | `/health`                                         | Все       |
| 2  | POST   | `/api/v1/auth/register`                           | Все       |
| 3  | POST   | `/api/v1/auth/login`                              | Все       |
| 4  | GET    | `/api/v1/auth/me`                                 | JWT       |
| 5  | POST   | `/api/v1/candidates/submit-questionnaire`         | candidate |
| 6  | GET    | `/api/v1/candidates/{candidate_id}/status`        | candidate |
| 7  | GET    | `/api/v1/vacancies/`                              | Все       |
| 8  | POST   | `/api/v1/vacancies/`                              | manager   |
| 9  | GET    | `/api/v1/manager/candidates`                      | manager   |
| 10 | GET    | `/api/v1/manager/candidates/{candidate_id}/analysis` | manager |
| 11 | POST   | `/api/v1/manager/candidates/{candidate_id}/approve`  | manager |
| 12 | POST   | `/api/v1/manager/candidates/{candidate_id}/reject`   | manager |
| 13 | GET    | `/api/v1/manager/external-candidates`             | manager   |
| 14 | GET    | `/api/v1/hr/approved`                             | hr        |
| 15 | POST   | `/api/v1/hr/notify/{candidate_id}`                | hr        |

---

## 4. Аутентификация и авторизация

### 4.1 JWT-токены

Система использует два типа токенов (библиотека `python-jose`):

| Токен          | Время жизни | Поле `type` | Назначение                         |
|----------------|-------------|-------------|------------------------------------|
| Access Token   | 30 минут    | `access`    | Авторизация запросов к API         |
| Refresh Token  | 7 дней      | `refresh`   | Получение нового access token      |

**Структура payload:**

```json
{
    "sub": "42",
    "exp": 1711700000,
    "type": "access"
}
```

- `sub` -- строковое представление `user.id`
- `exp` -- timestamp истечения
- `type` -- `"access"` или `"refresh"`

Алгоритм: `HS256`. Секрет: `settings.SECRET_KEY`.

### 4.2 Хеширование паролей

Используется `passlib` с бекендом `bcrypt`:

- `hash_password(password) -> str` -- хеширование при регистрации
- `verify_password(plain, hashed) -> bool` -- проверка при логине

### 4.3 Dependency Injection для авторизации

Необходимо реализовать следующие зависимости FastAPI:

```python
# app/core/security.py (добавить)

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Извлекает пользователя из JWT access token.

    Raises:
        HTTPException(401) -- если токен невалиден или пользователь не найден
    """
    payload = decode_token(token)
    if payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="Invalid token type")
    user_id = int(payload["sub"])
    user = await db.get(User, user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")
    return user


def require_role(*roles: UserRole):
    """Фабрика зависимостей для проверки роли.

    Использование:
        @router.get("/candidates", dependencies=[Depends(require_role(UserRole.MANAGER))])
    """
    async def role_checker(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user
    return role_checker
```

### 4.4 Матрица доступа

| Эндпоинт группа | candidate | manager | hr  |
|------------------|-----------|---------|-----|
| Auth (register, login) | +   | +       | +   |
| Auth (me)        | +         | +       | +   |
| Candidates       | +         | -       | -   |
| Vacancies (GET)  | +         | +       | +   |
| Vacancies (POST) | -         | +       | -   |
| Manager          | -         | +       | -   |
| HR               | -         | -       | +   |

---

## 5. Бизнес-логика

### 5.1 Регистрация и логин

**Регистрация (`POST /api/v1/auth/register`):**

1. Проверить, что email не занят (SELECT по `users.email`)
2. Если занят -- вернуть `400 "Email already registered"`
3. Хешировать пароль (`bcrypt`)
4. Создать запись `User` с указанной ролью (по умолчанию `candidate`)
5. Сохранить в БД (`commit`)
6. Сгенерировать `access_token` + `refresh_token`
7. Вернуть `TokenResponse`

**Логин (`POST /api/v1/auth/login`):**

1. Найти пользователя по email
2. Проверить пароль через `verify_password`
3. Если не совпадает -- `401 "Invalid credentials"`
4. Сгенерировать и вернуть пару токенов

### 5.2 Отправка анкеты и AI-анализ

**Полный flow:**

```
Кандидат                Backend                    ML Service
   |                       |                           |
   |--POST /submit-------->|                           |
   |  questionnaire        |                           |
   |                       |--1. Создать CandidateProfile
   |                       |--2. Сохранить QuestionnaireResponse (N записей)
   |                       |--3. Создать CandidateAnalysis (status=pending)
   |                       |--4. commit                |
   |<---200 candidate_id---|                           |
   |                       |                           |
   |                       |--5. POST /api/v1/analyze->|
   |                       |   (httpx, async)          |
   |                       |                           |--ML обработка
   |                       |<--JSON analysis result----|
   |                       |                           |
   |                       |--6. Обновить CandidateAnalysis:
   |                       |    total_score, vacancy_match,
   |                       |    growth_potential, strengths,
   |                       |    weaknesses, summary,
   |                       |    status=analyzed
   |                       |--7. commit                |
```

**Детали шага POST /submit-questionnaire:**

1. Создать `CandidateProfile`:
   - `user_id` = текущий пользователь (из JWT)
   - `vacancy_id` = из request body
   - `full_name`, `email`, `phone` = из request body
   - `source` = `platform`
2. Для каждого элемента `answers` создать `QuestionnaireResponse`:
   - `candidate_id` = id созданного профиля
   - `question_number`, `question_text`, `answer_text` = из элемента
3. Создать `CandidateAnalysis`:
   - `candidate_id` = id профиля
   - `vacancy_id` = из request body
   - `status` = `pending`
4. `commit` все в одной транзакции
5. Вернуть `{"message": "Questionnaire submitted successfully", "candidate_id": profile.id}`
6. **Асинхронно** (после ответа клиенту) вызвать ML-анализ через `analysis_service.request_ml_analysis`
7. По получении ответа от ML -- обновить `CandidateAnalysis` полями из ответа, установить `status = analyzed`

> **Примечание:** Шаги 6-7 могут выполняться либо через `BackgroundTasks` FastAPI, либо через Celery task для надежности.

### 5.3 Workflow руководителя

1. **Просмотр кандидатов** (`GET /manager/candidates`):
   - JOIN `candidate_profiles` + `candidate_analyses` + `vacancies`
   - Опциональная фильтрация по `vacancy_id`
   - Сортировка по `total_score` (desc) или по другому полю (`sort_by`)
   - Возвращается `CandidateListResponse`

2. **Просмотр анализа** (`GET /manager/candidates/{id}/analysis`):
   - Выборка `CandidateAnalysis` по `candidate_id`
   - Если не найден -- `404`
   - Возвращается `CandidateAnalysisResponse`

3. **Одобрение** (`POST /manager/candidates/{id}/approve`):
   - Найти `CandidateAnalysis` по `candidate_id`
   - Проверить, что `status` = `analyzed` (нельзя одобрить `pending` или уже `approved`)
   - Установить `status` = `approved`, `approved_by` = текущий `user.id`
   - `commit`
   - Кандидат теперь виден HR в `/hr/approved`

4. **Отклонение** (`POST /manager/candidates/{id}/reject`):
   - Аналогично одобрению, но `status` = `rejected`

### 5.4 Workflow HR

1. **Список одобренных** (`GET /hr/approved`):
   - Выборка `candidate_analyses` WHERE `status = approved`
   - JOIN с `candidate_profiles` и `vacancies` для полной информации

2. **Уведомление** (`POST /hr/notify/{candidate_id}`):
   - Найти кандидата по id
   - Запустить Celery task `send_candidate_notification` с данными кандидата
   - Вернуть подтверждение

---

## 6. Интеграция с ML-сервисом

### 6.1 Конфигурация

```python
# settings
ML_SERVICE_URL = "http://ml-service:8001"
```

### 6.2 HTTP-вызов

Файл: `app/services/analysis_service.py`

Библиотека: `httpx` (async).

**Запрос:**

```http
POST http://ml-service:8001/api/v1/analyze
Content-Type: application/json

{
    "candidate_id": 42,
    "vacancy_id": 7,
    "answers": [
        {
            "question_number": 1,
            "question_text": "Расскажите о вашем опыте...",
            "answer_text": "Имею 5 лет опыта..."
        }
    ]
}
```

**Ожидаемый ответ от ML-сервиса:**

```json
{
    "candidate_id": 42,
    "total_score": 85,
    "vacancy_match": 0.92,
    "growth_potential": "Высокий потенциал роста в направлении backend-разработки",
    "strengths": ["Python", "System Design", "Коммуникация"],
    "weaknesses": ["Нет опыта с Kubernetes", "Мало опыта с NoSQL"],
    "summary": "Сильный кандидат с отличным знанием Python и проектирования систем..."
}
```

### 6.3 Таймауты и обработка ошибок

| Параметр              | Значение   | Описание                                   |
|-----------------------|------------|---------------------------------------------|
| `timeout`             | 120 сек    | ML-анализ может занимать время              |
| Retry-стратегия       | 3 попытки  | С экспоненциальной задержкой (2, 4, 8 сек)  |
| Fallback при ошибке   | --         | `CandidateAnalysis.status` остается `pending`; записать ошибку в лог |

**Рекомендуемая реализация retry:**

```python
import httpx
from tenacity import retry, stop_after_attempt, wait_exponential

@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=2, min=2, max=8))
async def request_ml_analysis(candidate_id: int, vacancy_id: int, answers: list[dict]) -> dict:
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{settings.ML_SERVICE_URL}/api/v1/analyze",
            json={
                "candidate_id": candidate_id,
                "vacancy_id": vacancy_id,
                "answers": answers,
            },
            timeout=120.0,
        )
        response.raise_for_status()
        return response.json()
```

---

## 7. Парсинг HH.ru

### 7.1 Назначение

Система позволяет руководителям просматривать кандидатов с HH.ru -- для этого используется публичный HH.ru API.

### 7.2 Сервис парсинга

Файл: `app/services/parser_service.py`

```python
async def search_hh_candidates(query: str, area: int = 1) -> list[dict]:
    """
    Поиск кандидатов на HH.ru.

    Args:
        query: поисковый запрос (например, название вакансии)
        area: ID региона HH.ru (1 = Москва)

    Returns:
        list[dict] -- список резюме с HH.ru
    """
```

**API HH.ru:**

```http
GET https://api.hh.ru/resumes?text={query}&area={area}&per_page=20
User-Agent: Hakaron/0.1 (recruitment platform)
```

- Таймаут: 30 секунд
- Результат: `response.json()["items"]`

### 7.3 Сохранение в БД

Для каждого найденного резюме создается `CandidateProfile`:

| Поле         | Значение                                 |
|--------------|------------------------------------------|
| `user_id`    | `NULL`                                   |
| `vacancy_id` | ID вакансии, для которой ищем            |
| `full_name`  | Из ответа HH API                        |
| `email`      | Из ответа HH API (если доступен)        |
| `phone`      | `""`                                     |
| `source`     | `CandidateSource.HH_PARSED`             |
| `hh_url`     | URL резюме на HH.ru                     |

### 7.4 Celery task

Файл: `app/tasks/parsing.py`

```python
@celery_app.task
def parse_hh_candidates(vacancy_title: str, area: int = 1):
    """
    Фоновая задача: парсинг кандидатов с HH.ru.

    1. Вызывает search_hh_candidates (через async-to-sync bridge)
    2. Для каждого результата создает CandidateProfile (source=hh_parsed)
    3. Опционально: создает CandidateAnalysis (status=pending) для дальнейшего ML-анализа
    """
```

> **Важно:** Celery работает синхронно. Для вызова async-функций из Celery task используйте `asyncio.run()` или `asgiref.sync.async_to_sync`.

---

## 8. Celery задачи

### 8.1 Конфигурация

Файл: `app/tasks/__init__.py`

```python
celery_app = Celery(
    "hakaron",
    broker="redis://redis:6379/1",     # Redis DB 1 для broker
    backend="redis://redis:6379/2",    # Redis DB 2 для results
)
celery_app.autodiscover_tasks(["app.tasks"])
```

### 8.2 Список задач

| Task                            | Файл              | Аргументы                           | Описание                                           |
|---------------------------------|--------------------|-------------------------------------|-----------------------------------------------------|
| `parse_hh_candidates`           | `tasks/parsing.py` | `vacancy_title: str, area: int = 1` | Парсинг резюме с HH.ru, сохранение в БД            |
| `send_candidate_notification`   | `tasks/notifications.py` | `candidate_id: int, message: str` | Отправка уведомления кандидату (email/другой канал) |

### 8.3 Рекомендуемые дополнительные задачи

| Task                            | Описание                                                    |
|---------------------------------|-------------------------------------------------------------|
| `run_ml_analysis`               | Вызов ML-сервиса для анализа кандидата (альтернатива BackgroundTasks) |
| `periodic_hh_sync`              | Периодическая синхронизация с HH.ru по активным вакансиям   |

### 8.4 Запуск воркера

```bash
celery -A app.tasks worker --loglevel=info
```

В Docker Compose это отдельный сервис `celery-worker`, использующий тот же образ, что и `backend`.

---

## 9. Миграции (Alembic)

### 9.1 Инициализация

```bash
cd backend
alembic init alembic
```

### 9.2 Конфигурация `alembic/env.py`

```python
from app.core.database import Base
from app.models import *  # noqa -- чтобы все модели были зарегистрированы

target_metadata = Base.metadata

# Для async:
from sqlalchemy.ext.asyncio import create_async_engine

def run_migrations_online():
    connectable = create_async_engine(settings.DATABASE_URL)
    # ... async migration runner
```

### 9.3 Команды

| Команда                                    | Описание                            |
|---------------------------------------------|-------------------------------------|
| `alembic revision --autogenerate -m "msg"`  | Создать миграцию автоматически      |
| `alembic upgrade head`                      | Применить все миграции              |
| `alembic downgrade -1`                      | Откатить последнюю миграцию        |
| `alembic history`                           | Показать историю миграций          |
| `alembic current`                           | Показать текущую версию            |

### 9.4 Важные замечания

- Используйте `--autogenerate` для генерации миграций на основе изменений в моделях
- Всегда проверяйте сгенерированный файл миграции перед применением
- При использовании async-движка необходимо настроить `env.py` для работы с `asyncpg`
- Enum-типы PostgreSQL: при изменении значений enum требуется ручная миграция (`ALTER TYPE ... ADD VALUE`)

---

## 10. Безопасность

### 10.1 Хеширование паролей

- Библиотека: `passlib[bcrypt]`
- Алгоритм: `bcrypt`
- Настройка: `CryptContext(schemes=["bcrypt"], deprecated="auto")`
- Пароли никогда не хранятся в открытом виде

### 10.2 CORS

Настроено в `app/main.py`:

| Параметр             | Значение                       | Описание                            |
|----------------------|--------------------------------|-------------------------------------|
| `allow_origins`      | `["http://localhost:3000"]`    | Фронтенд (настраивается через env) |
| `allow_credentials`  | `true`                         | Разрешить cookies/auth headers      |
| `allow_methods`      | `["*"]`                        | Все HTTP-методы                     |
| `allow_headers`      | `["*"]`                        | Все заголовки                       |

> **Для продакшена:** Ограничить `allow_origins` конкретными доменами, `allow_methods` только необходимыми методами.

### 10.3 Rate Limiting (рекомендуемое)

Рекомендуется добавить rate limiting через `slowapi` или middleware:

| Эндпоинт группа | Лимит          | Описание                        |
|------------------|----------------|---------------------------------|
| `/auth/login`    | 5 req/min      | Защита от brute-force           |
| `/auth/register` | 3 req/min      | Защита от массовой регистрации  |
| Остальные        | 60 req/min     | Общий лимит                     |

### 10.4 Дополнительные рекомендации

- **Валидация входных данных** -- Pydantic схемы обеспечивают автоматическую валидацию
- **SQL Injection** -- SQLAlchemy ORM защищает от инъекций
- **SECRET_KEY** -- обязательно сменить в продакшене (через `.env`)
- **HTTPS** -- настроить на уровне reverse proxy (nginx)
- **Sanitization** -- экранировать пользовательский ввод перед записью в JSON-поля

---

## 11. Docker

### 11.1 Сервисы (docker-compose.yml)

| Сервис          | Образ / Сборка    | Порт  | Описание                  |
|-----------------|--------------------|-------|---------------------------|
| `postgres`      | `postgres:16-alpine` | 5432 | База данных               |
| `redis`         | `redis:7-alpine`    | 6379  | Кеш + Celery broker       |
| `backend`       | `./backend`         | 8000  | FastAPI приложение         |
| `ml-service`    | `./ml-service`      | 8001  | ML-сервис анализа          |
| `celery-worker` | `./backend`         | --    | Celery worker (фоновые задачи) |
| `frontend`      | `./frontend`        | 3000  | React приложение           |

### 11.2 Переменные окружения (.env)

```env
# PostgreSQL
POSTGRES_USER=hakaron
POSTGRES_PASSWORD=hakaron_secret
POSTGRES_DB=hakaron

# Backend
DATABASE_URL=postgresql+asyncpg://hakaron:hakaron_secret@postgres:5432/hakaron
REDIS_URL=redis://redis:6379/0
SECRET_KEY=<CHANGE_IN_PRODUCTION>
ML_SERVICE_URL=http://ml-service:8001
BACKEND_CORS_ORIGINS=["http://localhost:3000"]

# Celery
CELERY_BROKER_URL=redis://redis:6379/1
CELERY_RESULT_BACKEND=redis://redis:6379/2

# HH.ru
HH_API_BASE_URL=https://api.hh.ru
```

### 11.3 Healthcheck

- **PostgreSQL:** `pg_isready -U ${POSTGRES_USER}` (interval 5s, retries 5)
- **Redis:** `redis-cli ping` (interval 5s, retries 5)
- **Backend:** `GET /health` -> `{"status": "ok"}`

### 11.4 Зависимости запуска

```
backend       -> postgres (healthy), redis (healthy)
celery-worker -> postgres (healthy), redis (healthy)
frontend      -> backend (started)
```

### 11.5 Команды запуска

```bash
# Запуск всех сервисов
docker compose up -d

# Запуск только инфраструктуры (для локальной разработки)
docker compose up -d postgres redis

# Пересборка после изменений
docker compose up -d --build backend celery-worker

# Логи конкретного сервиса
docker compose logs -f backend

# Применить миграции (внутри контейнера)
docker compose exec backend alembic upgrade head
```

---

## 12. Приоритеты реализации

### Phase 1 -- Фундамент (Auth, Models, Basic CRUD)

**Цель:** Рабочий API с авторизацией и базовыми CRUD-операциями.

| #  | Задача                                          | Файлы                                          |
|----|--------------------------------------------------|-------------------------------------------------|
| 1  | Настроить Alembic, создать начальную миграцию    | `alembic/`, `alembic.ini`                       |
| 2  | Реализовать `get_current_user` dependency        | `app/core/security.py`                          |
| 3  | Реализовать `require_role` dependency            | `app/core/security.py`                          |
| 4  | Доработать `GET /auth/me`                        | `app/api/v1/auth.py`                            |
| 5  | Реализовать `GET /vacancies/` (полная выборка)   | `app/api/v1/vacancies.py`                       |
| 6  | Реализовать `POST /vacancies/` (с ролевой защитой) | `app/api/v1/vacancies.py`                     |
| 7  | Реализовать `GET /candidates/{id}/status`        | `app/api/v1/candidates.py`                      |

**Критерий завершения:** Регистрация, логин, создание вакансий, получение текущего пользователя -- все работает через JWT.

### Phase 2 -- AI-интеграция (ML, Анкеты, Manager flow)

**Цель:** Полный цикл от отправки анкеты до одобрения/отклонения руководителем.

| #  | Задача                                              | Файлы                                            |
|----|------------------------------------------------------|--------------------------------------------------|
| 1  | Реализовать `POST /submit-questionnaire` (полный flow) | `app/api/v1/candidates.py`                     |
| 2  | Добавить retry-логику в `analysis_service`           | `app/services/analysis_service.py`               |
| 3  | Реализовать вызов ML + сохранение результата         | `app/services/analysis_service.py`, `candidates.py` |
| 4  | Реализовать `GET /manager/candidates`                | `app/api/v1/manager.py`                          |
| 5  | Реализовать `GET /manager/candidates/{id}/analysis`  | `app/api/v1/manager.py`                          |
| 6  | Реализовать `POST .../approve` и `POST .../reject`   | `app/api/v1/manager.py`                          |
| 7  | Реализовать `GET /hr/approved`                       | `app/api/v1/hr.py`                               |

**Критерий завершения:** Кандидат заполняет анкету -> ML анализирует -> руководитель видит результат и одобряет/отклоняет -> HR видит одобренных.

### Phase 3 -- HH.ru парсинг и уведомления

**Цель:** Расширение источников кандидатов, система уведомлений.

| #  | Задача                                              | Файлы                                            |
|----|------------------------------------------------------|--------------------------------------------------|
| 1  | Реализовать `parse_hh_candidates` Celery task        | `app/tasks/parsing.py`                           |
| 2  | Реализовать `GET /manager/external-candidates`       | `app/api/v1/manager.py`                          |
| 3  | Реализовать `send_candidate_notification` task       | `app/tasks/notifications.py`                     |
| 4  | Реализовать `POST /hr/notify/{id}`                   | `app/api/v1/hr.py`                               |
| 5  | Добавить rate limiting                               | `app/main.py` или middleware                     |
| 6  | Добавить Celery task для ML (альтернатива BackgroundTasks) | `app/tasks/`                               |
| 7  | Настроить periodic tasks (Celery Beat) для HH-синхронизации | `app/tasks/`, celery config                |

**Критерий завершения:** HH.ru кандидаты видны руководителю, HR может отправлять уведомления, все фоновые задачи работают стабильно.

---

## Приложение А. Коды ошибок HTTP

| Код | Описание                        | Когда используется                              |
|-----|---------------------------------|-------------------------------------------------|
| 200 | OK                              | Успешный запрос                                 |
| 201 | Created                         | Ресурс создан (опционально для POST)            |
| 400 | Bad Request                     | Невалидные данные, дубликат email               |
| 401 | Unauthorized                    | Невалидный/истекший токен, неверные credentials |
| 403 | Forbidden                       | Недостаточно прав (роль не совпадает)           |
| 404 | Not Found                       | Ресурс не найден                                |
| 422 | Unprocessable Entity            | Ошибка валидации Pydantic                       |
| 500 | Internal Server Error           | Внутренняя ошибка сервера                       |
| 501 | Not Implemented                 | Эндпоинт еще не реализован (заглушка)           |
| 502 | Bad Gateway                     | ML-сервис недоступен                            |

## Приложение Б. Зависимости Python (requirements.txt)

```
fastapi>=0.110.0
uvicorn[standard]>=0.27.0
sqlalchemy[asyncio]>=2.0.0
asyncpg>=0.29.0
alembic>=1.13.0
pydantic>=2.5.0
pydantic-settings>=2.1.0
python-jose[cryptography]>=3.3.0
passlib[bcrypt]>=1.7.4
httpx>=0.27.0
celery>=5.3.0
redis>=5.0.0
python-multipart>=0.0.6
```
