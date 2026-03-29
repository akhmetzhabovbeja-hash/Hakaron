# Hakaron Frontend -- Техническое задание

**Версия:** 1.0
**Дата:** 2026-03-29
**Стек:** React 18 + TypeScript + Vite + TailwindCSS + Zustand + React Router v6 + Axios
**Базовый URL API:** `/api/v1`

---

## Содержание

1. [Обзор проекта](#1-обзор-проекта)
2. [Роли пользователей](#2-роли-пользователей)
3. [Страницы и маршруты](#3-страницы-и-маршруты)
4. [Детальное описание каждой страницы](#4-детальное-описание-каждой-страницы)
5. [Компоненты](#5-компоненты)
6. [State management](#6-state-management)
7. [API-интеграция](#7-api-интеграция)
8. [Аутентификация](#8-аутентификация)
9. [Адаптивность](#9-адаптивность)
10. [Приоритеты реализации](#10-приоритеты-реализации)

---

## 1. Обзор проекта

**Hakaron** -- AI-платформа для автоматизированного отбора кандидатов. Кандидат заполняет анкету из 15 вопросов, ML-сервис анализирует ответы и формирует объективную оценку (балл, процент соответствия вакансии, потенциал роста, сильные/слабые стороны, AI-резюме). Руководитель просматривает рейтинг кандидатов, принимает решение об одобрении или отклонении. HR-менеджер видит список одобренных кандидатов и связывается с ними.

Дополнительно платформа поддерживает импорт кандидатов с внешних площадок (HH.ru) через парсер.

**Роль фронтенда:** предоставить интерфейс для всех трёх ролей, обеспечить пошаговое заполнение анкеты, визуализацию AI-аналитики и управление воронкой кандидатов.

### Структура проекта

```
frontend/src/
  api/            -- Axios-клиент и функции вызова API
  assets/         -- Статические ресурсы (иконки, изображения)
  components/ui/  -- Переиспользуемые UI-компоненты
  features/
    auth/         -- Компоненты и логика аутентификации
    candidate/    -- Компоненты кандидатского интерфейса
    manager/      -- Компоненты интерфейса руководителя
    hr/           -- Компоненты интерфейса HR
  hooks/          -- Кастомные React-хуки
  layouts/        -- Компоненты-обёртки (MainLayout, DashboardLayout)
  pages/          -- Страницы (привязаны к маршрутам)
  store/          -- Zustand-хранилища
  types/          -- TypeScript-типы и интерфейсы
  utils/          -- Вспомогательные функции
```

---

## 2. Роли пользователей

| Роль | Тип `UserRole` | Что видит и может делать |
|------|----------------|--------------------------|
| **Кандидат** | `"candidate"` | Главная страница, регистрация/вход, заполнение анкеты (выбор вакансии + 15 вопросов), просмотр статуса рассмотрения |
| **Руководитель** | `"manager"` | Панель со списком кандидатов (сортировка по рейтингу, фильтр по вакансии), детальная карточка кандидата с AI-аналитикой, кнопки одобрить/отклонить, раздел кандидатов с HH.ru |
| **HR** | `"hr"` | Список одобренных руководителем кандидатов, кнопка "Написать кандидату" (отправка уведомления) |

Неаутентифицированный пользователь видит: главную страницу, страницы входа и регистрации.

---

## 3. Страницы и маршруты

| Маршрут | Страница | Компонент | Доступ | Описание |
|---------|----------|-----------|--------|----------|
| `/` | Главная | `HomePage` | Все | Лендинг с описанием платформы и CTA |
| `/login` | Вход | `LoginPage` | Гости | Форма входа (email + пароль) |
| `/register` | Регистрация | `RegisterPage` | Гости | Форма регистрации (имя, email, пароль, роль) |
| `/questionnaire` | Анкета | `CandidateQuestionnairePage` | `candidate` | Пошаговая форма из 15 вопросов с выбором вакансии |
| `/status` | Статус | `CandidateStatusPage` | `candidate` | Текущий статус рассмотрения анкеты |
| `/manager` | Панель руководителя | `ManagerDashboardPage` | `manager` | Список кандидатов с сортировкой и фильтрами |
| `/manager/candidate/:id` | Детали кандидата | `ManagerCandidateDetailPage` | `manager` | Полная AI-аналитика кандидата, действия |
| `/hr/approved` | Одобренные | `HrApprovedPage` | `hr` | Список одобренных кандидатов для HR |

### Защита маршрутов

Реализовать компонент `ProtectedRoute`, который:
- Проверяет наличие JWT-токена и данных пользователя в `authStore`
- Проверяет соответствие роли пользователя разрешённым ролям маршрута
- При отсутствии авторизации -- редирект на `/login`
- При несоответствии роли -- редирект на `/` (или страницу 403)

```tsx
// Пример использования в App.tsx
<Route path="manager" element={
  <ProtectedRoute allowedRoles={["manager"]}>
    <ManagerDashboardPage />
  </ProtectedRoute>
} />
```

---

## 4. Детальное описание каждой страницы

### 4.1. HomePage (Главная)

**Маршрут:** `/`
**Доступ:** Все пользователи

**Описание:**
Лендинг-страница с описанием платформы и призывами к действию.

**Содержимое:**
- Заголовок: "AI-платформа для отбора кандидатов"
- Подзаголовок: краткое описание процесса (анкета 15 вопросов, AI-анализ, аналитика)
- Две CTA-кнопки:
  - "Пройти анкету" -- ведёт на `/questionnaire` (primary)
  - "Панель руководителя" -- ведёт на `/manager` (outline)
- Для авторизованного пользователя CTA адаптируются:
  - Кандидат видит: "Пройти анкету" / "Мой статус"
  - Руководитель видит: "Панель руководителя"
  - HR видит: "Одобренные кандидаты"

**Поведение:**
- CTA-кнопки на защищённые страницы перенаправляют на `/login`, если пользователь не авторизован

---

### 4.2. LoginPage (Вход)

**Маршрут:** `/login`
**Доступ:** Только неавторизованные (авторизованных редиректить на `/`)

**Поля формы:**

| Поле | Тип | Валидация |
|------|-----|-----------|
| Email | `email` | Обязательное, формат email |
| Пароль | `password` | Обязательное, минимум 1 символ |

**Поведение:**
1. При сабмите отправить `POST /api/v1/auth/login` с `{ email, password }`
2. При успехе:
   - Сохранить `access_token` и `refresh_token` в `localStorage`
   - Запросить `GET /api/v1/auth/me` для получения данных пользователя
   - Записать пользователя в `authStore`
   - Редирект: `candidate` -> `/questionnaire`, `manager` -> `/manager`, `hr` -> `/hr/approved`
3. При ошибке:
   - 401 -- показать "Неверный email или пароль"
   - Сетевая ошибка -- показать "Ошибка соединения с сервером"

**UI-элементы:**
- Ссылка "Нет аккаунта? Зарегистрироваться" -> `/register`
- Индикатор загрузки на кнопке при отправке
- Inline-сообщение об ошибке над формой

---

### 4.3. RegisterPage (Регистрация)

**Маршрут:** `/register`
**Доступ:** Только неавторизованные

**Поля формы:**

| Поле | Тип | Валидация |
|------|-----|-----------|
| Имя | `text` | Обязательное, 2-100 символов |
| Email | `email` | Обязательное, формат email |
| Пароль | `password` | Обязательное, минимум 8 символов |
| Роль | `select` | Значения: `candidate`, `manager`, `hr` |

**Поведение:**
1. При сабмите отправить `POST /api/v1/auth/register` с `{ email, name, password, role }`
2. При успехе -- аналогично LoginPage (сохранить токены, получить `/me`, редирект по роли)
3. При ошибке:
   - 400 "Email already registered" -- показать "Этот email уже зарегистрирован"
   - Показать валидационные ошибки под соответствующими полями

**UI-элементы:**
- Ссылка "Уже есть аккаунт? Войти" -> `/login`
- Подсказка под полем пароля: "Минимум 8 символов"

---

### 4.4. CandidateQuestionnairePage (Анкета кандидата)

**Маршрут:** `/questionnaire`
**Доступ:** `candidate`

**Описание:**
Пошаговая форма из 15 вопросов. На экране отображается один вопрос за раз. Перед началом анкеты кандидат выбирает вакансию, на которую претендует.

**Этап 0 -- Выбор вакансии и контактные данные:**

| Поле | Тип | Валидация |
|------|-----|-----------|
| Вакансия | `select` | Обязательное, загружается из `GET /api/v1/vacancies/` |
| ФИО | `text` | Обязательное, предзаполняется из `authStore.user.name` |
| Email | `email` | Обязательное, предзаполняется из `authStore.user.email` |
| Телефон | `tel` | Необязательное |

**Этапы 1-15 -- Вопросы:**

Каждый этап содержит:
- Номер вопроса: "Вопрос N из 15"
- Прогресс-бар: визуальная полоса заполнения (`width: (N/15)*100%`)
- Текст вопроса (заголовок)
- Текстовое поле для ответа (`textarea`, минимум 50 символов для валидации)
- Кнопка "Назад" (неактивна на первом вопросе)
- Кнопка "Далее" / "Отправить" (на последнем вопросе)

**Список вопросов (15 штук):**

1. Расскажите о своём самом значимом профессиональном достижении.
2. Опишите ситуацию, когда вам пришлось решать сложную техническую проблему.
3. Как вы подходите к изучению новых технологий?
4. Расскажите о вашем опыте работы в команде.
5. Как вы справляетесь с конфликтами на рабочем месте?
6. Опишите проект, которым вы гордитесь больше всего.
7. Как вы расставляете приоритеты при множестве задач?
8. Расскажите о случае, когда вы допустили ошибку. Как вы её исправили?
9. Какие ваши профессиональные цели на ближайшие 3 года?
10. Как вы относитесь к code review и обратной связи?
11. Опишите свой опыт с методологиями разработки (Agile, Scrum и т.д.).
12. Как вы обеспечиваете качество своего кода?
13. Расскажите о вашем опыте менторства или обучения коллег.
14. Как вы справляетесь с дедлайнами и давлением?
15. Почему вы заинтересованы в этой позиции?

**Сохранение прогресса:**
- Ответы сохраняются в `candidateStore` при переходе между вопросами
- При перезагрузке страницы прогресс восстанавливается из `localStorage` (ключ `questionnaire_draft`)
- При навигации назад -- ответ подставляется из сохранённого состояния

**Отправка:**
- При нажатии "Отправить" (на 15-м вопросе) -- `POST /api/v1/candidates/submit-questionnaire`
- Тело запроса:
  ```json
  {
    "vacancy_id": 1,
    "full_name": "Иван Петров",
    "email": "ivan@example.com",
    "phone": "+79001234567",
    "answers": [
      { "question_number": 1, "question_text": "...", "answer_text": "..." },
      ...
    ]
  }
  ```
- При успехе -- очистить черновик из `localStorage`, редирект на `/status`
- При ошибке -- показать toast-уведомление, остаться на странице

---

### 4.5. CandidateStatusPage (Статус рассмотрения)

**Маршрут:** `/status`
**Доступ:** `candidate`

**Описание:**
Страница отображает текущий статус рассмотрения анкеты кандидата.

**Логика:**
- При загрузке запросить `GET /api/v1/candidates/{candidateId}/status`
- `candidateId` берётся из `candidateStore` (сохраняется после отправки анкеты)

**Статусы и их отображение:**

| Статус | Иконка | Цвет бейджа | Текст |
|--------|--------|-------------|-------|
| `pending` | Песочные часы | Жёлтый (`yellow`) | "На рассмотрении" |
| `analyzed` | Лупа | Синий (`blue`) | "Анализ завершён, ожидает решения руководителя" |
| `approved` | Галочка | Зелёный (`green`) | "Одобрено! С вами свяжется HR-менеджер" |
| `rejected` | Крестик | Красный (`red`) | "К сожалению, ваша кандидатура не подошла" |

**Поведение:**
- Автоматический polling каждые 30 секунд (пока статус `pending`)
- При смене статуса -- обновить UI без перезагрузки страницы
- Показывать дату подачи анкеты и выбранную вакансию

---

### 4.6. ManagerDashboardPage (Панель руководителя)

**Маршрут:** `/manager`
**Доступ:** `manager`

**Описание:**
Список всех кандидатов с возможностью сортировки и фильтрации. Включает раздел с кандидатами, найденными парсером на HH.ru.

**Основной список кандидатов:**
- Загрузка: `GET /api/v1/manager/candidates?vacancy_id=X&sort_by=score`
- Каждая карточка кандидата отображает:
  - Имя
  - Название вакансии
  - Балл (цветовая индикация: >=85 зелёный, >=60 жёлтый, <60 красный)
  - Статус (бейдж)
  - Источник (`platform` / `hh_parsed`) -- метка для внешних кандидатов
- Клик по карточке -> переход на `/manager/candidate/:id`

**Фильтры и сортировка:**

| Элемент | Тип | Варианты |
|---------|-----|----------|
| Фильтр по вакансии | `select` | "Все вакансии" + список из `GET /api/v1/vacancies/` |
| Сортировка | `select` | "По рейтингу" (score desc), "По дате" (created_at desc), "По имени" (name asc) |

**Раздел "Кандидаты с HH.ru":**
- Загрузка: `GET /api/v1/manager/external-candidates`
- Визуально выделенный блок (синий фон, иконка HH.ru)
- Карточки внешних кандидатов с тем же набором полей
- Если список пуст -- показать placeholder: "Нет кандидатов из внешних источников"

**Пустое состояние:**
- Если нет кандидатов вообще -- показать иллюстрацию и текст "Пока нет кандидатов"

---

### 4.7. ManagerCandidateDetailPage (Детали кандидата)

**Маршрут:** `/manager/candidate/:id`
**Доступ:** `manager`

**Описание:**
Полная аналитическая карточка кандидата с результатами AI-анализа.

**Загрузка данных:** `GET /api/v1/manager/candidates/{id}/analysis`

**Блоки информации:**

**Блок 1 -- Метрики (три карточки в ряд):**

| Метрика | Поле API | Формат отображения |
|---------|----------|--------------------|
| Общий балл | `total_score` | Число 0-100, цвет по шкале (зелёный/жёлтый/красный) |
| Соответствие вакансии | `vacancy_match` | Процент, например "92%" |
| Потенциал роста | `growth_potential` | Буквенная оценка (A/B/C/D), цвет: A-зелёный, B-синий, C-жёлтый, D-красный |

**Блок 2 -- Сильные стороны и зоны развития (две колонки):**

| Колонка | Поле API | Оформление |
|---------|----------|------------|
| Сильные стороны | `strengths: string[]` | Зелёная иконка "+", зелёный заголовок |
| Зоны развития | `weaknesses: string[]` | Красная иконка "-", красный заголовок |

**Блок 3 -- AI-резюме:**
- Поле API: `summary`
- Текстовый блок с резюме, сформированным ML-сервисом

**Блок 4 -- Кнопки действий:**

| Кнопка | Действие | API-вызов | Поведение после |
|--------|----------|-----------|-----------------|
| "Одобрить" | Одобрить кандидата | `POST /api/v1/manager/candidates/{id}/approve` | Показать toast "Кандидат одобрен", редирект на `/manager` |
| "Отклонить" | Отклонить кандидата | `POST /api/v1/manager/candidates/{id}/reject` | Показать toast "Кандидат отклонён", редирект на `/manager` |

**Дополнительно:**
- Кнопка "Назад к списку" в верхней части страницы
- При уже принятом решении (статус `approved`/`rejected`) -- кнопки неактивны, показать текущий статус
- Модальное окно подтверждения перед отклонением: "Вы уверены, что хотите отклонить кандидата?"

---

### 4.8. HrApprovedPage (Одобренные кандидаты)

**Маршрут:** `/hr/approved`
**Доступ:** `hr`

**Описание:**
Список кандидатов, одобренных руководителем, для дальнейшей связи со стороны HR.

**Загрузка данных:** `GET /api/v1/hr/approved`

**Карточка кандидата:**
- Имя
- Название вакансии
- Балл (цветной бейдж)
- Дата одобрения
- Кнопка "Написать кандидату"

**Кнопка "Написать кандидату":**
- При нажатии: `POST /api/v1/hr/notify/{candidateId}`
- После успеха -- кнопка меняется на "Уведомление отправлено" (неактивна, серый цвет)
- При ошибке -- toast "Не удалось отправить уведомление"

**Пустое состояние:**
- "Нет одобренных кандидатов" с иконкой

---

## 5. Компоненты

### 5.1. Переиспользуемые UI-компоненты (`components/ui/`)

| Компонент | Props | Описание |
|-----------|-------|----------|
| `Button` | `variant: "primary" \| "secondary" \| "danger" \| "outline" \| "ghost"`, `size: "sm" \| "md" \| "lg"`, `loading: boolean`, `disabled: boolean`, `onClick`, `type`, `children` | Универсальная кнопка с вариантами стилей и состоянием загрузки |
| `Input` | `label: string`, `type`, `placeholder`, `error: string`, `value`, `onChange`, `required` | Текстовое поле с подписью и отображением ошибки валидации |
| `Select` | `label: string`, `options: {value, label}[]`, `value`, `onChange`, `placeholder` | Выпадающий список |
| `Textarea` | `label: string`, `placeholder`, `error: string`, `value`, `onChange`, `rows` | Многострочное поле ввода |
| `Card` | `children`, `className` | Контейнер-карточка с тенью и скруглёнными углами (`bg-white rounded-xl shadow p-6`) |
| `Modal` | `isOpen: boolean`, `onClose`, `title: string`, `children`, `footer` | Модальное окно с затемнением фона |
| `Badge` | `variant: "green" \| "yellow" \| "red" \| "blue" \| "gray"`, `children` | Цветной бейдж для статусов |
| `ScoreBadge` | `score: number` | Бейдж с баллом, автоматически выбирает цвет по значению (>=85 зелёный, >=60 жёлтый, <60 красный) |
| `ProgressBar` | `current: number`, `total: number` | Полоса прогресса для анкеты |
| `Toast` | `message: string`, `type: "success" \| "error" \| "info"` | Всплывающее уведомление (верхний правый угол, автоскрытие через 5 секунд) |
| `Spinner` | `size: "sm" \| "md" \| "lg"` | Индикатор загрузки (анимированный спиннер) |
| `EmptyState` | `icon`, `title: string`, `description: string` | Заглушка для пустых списков |
| `PageHeader` | `title: string`, `backLink?: string`, `actions?: ReactNode` | Заголовок страницы с опциональной кнопкой "Назад" и действиями |

### 5.2. Feature-компоненты

**`features/auth/`:**
- `LoginForm` -- форма входа с валидацией и обработкой ошибок
- `RegisterForm` -- форма регистрации
- `ProtectedRoute` -- HOC для защиты маршрутов по ролям

**`features/candidate/`:**
- `VacancySelector` -- выбор вакансии + контактные данные (этап 0 анкеты)
- `QuestionStep` -- один шаг анкеты (текст вопроса + textarea)
- `QuestionnaireProgress` -- прогресс-бар + счётчик "Вопрос N из 15"
- `StatusCard` -- карточка с текущим статусом и иконкой

**`features/manager/`:**
- `CandidateCard` -- карточка кандидата в списке (имя, вакансия, балл, статус)
- `CandidateFilters` -- панель фильтров (вакансия, сортировка)
- `MetricsRow` -- три метрики в ряд (балл, match%, потенциал)
- `StrengthsWeaknesses` -- две колонки: сильные стороны и зоны развития
- `AiSummary` -- блок AI-резюме
- `CandidateActions` -- кнопки одобрить/отклонить с модальным подтверждением
- `ExternalCandidatesSection` -- раздел кандидатов с HH.ru

**`features/hr/`:**
- `ApprovedCandidateCard` -- карточка одобренного кандидата с кнопкой уведомления

### 5.3. Layout-компоненты (`layouts/`)

| Компонент | Описание |
|-----------|----------|
| `MainLayout` | Обёртка: хедер с логотипом и навигацией + `<Outlet />` + (опционально) футер |
| `Sidebar` | Боковая навигация для авторизованных пользователей (manager, hr). Пункты меню зависят от роли |

**Навигация в хедере (MainLayout):**
- Неавторизованный: "Войти" / "Регистрация"
- Кандидат: "Анкета" / "Мой статус" / кнопка "Выйти"
- Руководитель: "Панель" / кнопка "Выйти"
- HR: "Одобренные" / кнопка "Выйти"

---

## 6. State management

Все хранилища реализуются через Zustand. Файлы в `src/store/`.

### 6.1. `authStore`

```typescript
interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  setUser: (user: User) => void;
  logout: () => void;
  checkAuth: () => Promise<void>;  // GET /auth/me при инициализации
}
```

**Логика:**
- `checkAuth()` вызывается при монтировании `App` -- если в `localStorage` есть `access_token`, запросить `/auth/me` и заполнить `user`
- `logout()` -- удалить токены из `localStorage`, обнулить `user`, редирект на `/`

### 6.2. `candidateStore`

```typescript
interface CandidateState {
  vacancyId: number | null;
  contactInfo: { fullName: string; email: string; phone: string } | null;
  answers: Record<number, string>;  // questionNumber -> answerText
  currentStep: number;              // 0 = выбор вакансии, 1-15 = вопросы
  candidateId: number | null;       // после отправки анкеты
  status: "pending" | "analyzed" | "approved" | "rejected" | null;

  setVacancy: (id: number) => void;
  setContactInfo: (info: { fullName: string; email: string; phone: string }) => void;
  setAnswer: (questionNumber: number, answer: string) => void;
  setStep: (step: number) => void;
  setCandidateId: (id: number) => void;
  setStatus: (status: string) => void;
  submitQuestionnaire: () => Promise<void>;
  loadDraft: () => void;            // из localStorage
  saveDraft: () => void;            // в localStorage
  clearDraft: () => void;
}
```

### 6.3. `managerStore`

```typescript
interface ManagerState {
  candidates: CandidateListItem[];
  externalCandidates: CandidateListItem[];
  currentAnalysis: CandidateAnalysis | null;
  vacancies: Vacancy[];
  isLoading: boolean;
  filters: {
    vacancyId: number | null;
    sortBy: "score" | "date" | "name";
  };

  fetchCandidates: () => Promise<void>;
  fetchExternalCandidates: () => Promise<void>;
  fetchAnalysis: (candidateId: number) => Promise<void>;
  fetchVacancies: () => Promise<void>;
  setFilter: (key: string, value: any) => void;
  approveCandidate: (candidateId: number) => Promise<void>;
  rejectCandidate: (candidateId: number) => Promise<void>;
}
```

### 6.4. `hrStore`

```typescript
interface HrState {
  approvedCandidates: ApprovedCandidate[];
  isLoading: boolean;
  notifiedIds: Set<number>;          // ID кандидатов, которым уже отправлено уведомление

  fetchApproved: () => Promise<void>;
  notifyCandidate: (candidateId: number) => Promise<void>;
}
```

### 6.5. `uiStore`

```typescript
interface UiState {
  toasts: { id: string; message: string; type: "success" | "error" | "info" }[];
  addToast: (message: string, type: string) => void;
  removeToast: (id: string) => void;
}
```

---

## 7. API-интеграция

Базовый URL: `/api/v1` (настроен в Axios-клиенте `src/api/client.ts`).

### 7.1. Аутентификация (`/auth`)

#### `POST /auth/register`

Запрос:
```json
{
  "email": "user@example.com",
  "name": "Иван Петров",
  "password": "securepassword",
  "role": "candidate"
}
```

Ответ (200):
```json
{
  "access_token": "eyJhbG...",
  "refresh_token": "eyJhbG...",
  "token_type": "bearer"
}
```

Ошибки: `400` -- email уже занят.

#### `POST /auth/login`

Запрос:
```json
{
  "email": "user@example.com",
  "password": "securepassword"
}
```

Ответ (200): аналогичен `/register`.

Ошибки: `401` -- неверные учётные данные.

#### `GET /auth/me`

Заголовок: `Authorization: Bearer <access_token>`

Ответ (200):
```json
{
  "id": 1,
  "email": "user@example.com",
  "name": "Иван Петров",
  "role": "candidate"
}
```

Ошибки: `401` -- невалидный токен.

---

### 7.2. Вакансии (`/vacancies`)

#### `GET /vacancies/`

Ответ (200):
```json
[
  {
    "id": 1,
    "title": "Frontend-разработчик",
    "description": "Описание вакансии",
    "requirements": "React, TypeScript",
    "is_active": true
  }
]
```

#### `POST /vacancies/`

Запрос:
```json
{
  "title": "ML-инженер",
  "description": "Описание",
  "requirements": "Python, PyTorch"
}
```

Ответ (200): объект вакансии.

---

### 7.3. Кандидаты (`/candidates`)

#### `POST /candidates/submit-questionnaire`

Запрос:
```json
{
  "vacancy_id": 1,
  "full_name": "Иван Петров",
  "email": "ivan@example.com",
  "phone": "+79001234567",
  "answers": [
    {
      "question_number": 1,
      "question_text": "Расскажите о своём самом значимом профессиональном достижении.",
      "answer_text": "Текст ответа кандидата..."
    }
  ]
}
```

Ответ (200):
```json
{
  "message": "Questionnaire submitted successfully",
  "candidate_id": 1
}
```

#### `GET /candidates/{candidate_id}/status`

Ответ (200):
```json
{
  "candidate_id": 1,
  "status": "pending"
}
```

Возможные значения `status`: `"pending"`, `"analyzed"`, `"approved"`, `"rejected"`.

---

### 7.4. Руководитель (`/manager`)

#### `GET /manager/candidates?vacancy_id=1&sort_by=score`

Параметры запроса:
- `vacancy_id` (optional) -- фильтр по вакансии
- `sort_by` (optional, default `"score"`) -- поле сортировки

Ответ (200):
```json
[
  {
    "id": 1,
    "full_name": "Иван Петров",
    "vacancy_title": "Frontend-разработчик",
    "total_score": 87,
    "status": "analyzed",
    "source": "platform"
  }
]
```

#### `GET /manager/candidates/{candidate_id}/analysis`

Ответ (200):
```json
{
  "id": 1,
  "candidate_id": 1,
  "total_score": 87,
  "vacancy_match": 0.92,
  "growth_potential": "A",
  "strengths": [
    "Глубокие технические знания",
    "Опыт работы в команде",
    "Высокая мотивация к обучению"
  ],
  "weaknesses": [
    "Недостаточный опыт с CI/CD",
    "Ограниченный опыт менторства"
  ],
  "summary": "Кандидат демонстрирует сильные технические навыки...",
  "status": "analyzed"
}
```

#### `POST /manager/candidates/{candidate_id}/approve`

Ответ (200):
```json
{ "message": "Candidate approved", "candidate_id": 1 }
```

#### `POST /manager/candidates/{candidate_id}/reject`

Ответ (200):
```json
{ "message": "Candidate rejected", "candidate_id": 1 }
```

#### `GET /manager/external-candidates`

Ответ (200): массив объектов `CandidateListItem` с `source: "hh_parsed"`.

---

### 7.5. HR (`/hr`)

#### `GET /hr/approved`

Ответ (200):
```json
[
  {
    "id": 1,
    "full_name": "Мария Сидорова",
    "vacancy_title": "Backend-разработчик",
    "total_score": 92,
    "approved_at": "2026-03-28T10:00:00",
    "email": "maria@example.com"
  }
]
```

#### `POST /hr/notify/{candidate_id}`

Ответ (200):
```json
{ "message": "Notification sent", "candidate_id": 1 }
```

---

### 7.6. Функции API-клиента (`src/api/`)

Рекомендуется создать отдельные модули для каждой группы endpoints:

```
src/api/
  client.ts       -- Axios instance с interceptors (уже существует)
  auth.ts         -- login(), register(), getMe()
  candidates.ts   -- submitQuestionnaire(), getStatus()
  vacancies.ts    -- getVacancies(), createVacancy()
  manager.ts      -- getCandidates(), getAnalysis(), approve(), reject(), getExternalCandidates()
  hr.ts           -- getApproved(), notifyCandidate()
```

---

## 8. Аутентификация

### 8.1. JWT Flow

1. Пользователь входит/регистрируется -> получает `access_token` + `refresh_token`
2. `access_token` сохраняется в `localStorage` под ключом `access_token`
3. `refresh_token` сохраняется в `localStorage` под ключом `refresh_token`
4. Каждый API-запрос добавляет заголовок `Authorization: Bearer <access_token>` (через Axios request interceptor)
5. При получении ответа `401` -- удалить токены, редирект на `/login`

### 8.2. Axios Interceptors (уже реализовано в `client.ts`)

**Request interceptor:** добавляет `Authorization` заголовок из `localStorage`.

**Response interceptor:** при ошибке `401` -- очистка `localStorage` и редирект на `/login`.

**Доработка (рекомендация):** реализовать refresh-логику:
1. При получении `401` -- попробовать обновить токен через `POST /auth/refresh` с `refresh_token`
2. Если обновление успешно -- повторить оригинальный запрос с новым `access_token`
3. Если обновление неуспешно -- logout и редирект на `/login`

### 8.3. Protected Routes

Компонент `ProtectedRoute`:
```tsx
interface ProtectedRouteProps {
  allowedRoles: UserRole[];
  children: React.ReactNode;
}
```

Логика:
1. Если `authStore.isLoading` -- показать Spinner (пока загружается `/auth/me`)
2. Если `!authStore.isAuthenticated` -- `<Navigate to="/login" />`
3. Если роль пользователя не входит в `allowedRoles` -- `<Navigate to="/" />`
4. Иначе -- рендерить `children`

### 8.4. Инициализация при загрузке

В корневом компоненте `App` (или `MainLayout`):
- При монтировании вызвать `authStore.checkAuth()`
- `checkAuth()` проверяет наличие `access_token` в `localStorage`
- Если токен есть -- запрашивает `GET /auth/me`
- При успехе -- заполняет `user` в store
- При ошибке -- очищает `localStorage`

---

## 9. Адаптивность

### 9.1. Breakpoints (TailwindCSS)

| Префикс | Минимальная ширина | Устройства |
|---------|--------------------|------------|
| (по умолчанию) | 0px | Мобильные телефоны |
| `sm` | 640px | Большие телефоны |
| `md` | 768px | Планшеты |
| `lg` | 1024px | Ноутбуки |
| `xl` | 1280px | Десктопы |

### 9.2. Правила адаптивности по страницам

**Общие правила:**
- Максимальная ширина контента: `max-w-7xl` (1280px) с `mx-auto`
- Отступы контейнера: `px-4` (мобильный) / `px-6` (md+)
- Шрифт: base `16px`, заголовки масштабируются от `text-2xl` (моб.) до `text-5xl` (десктоп)

**Навигация (MainLayout):**
- Десктоп: горизонтальное меню в хедере
- Мобильный (< `md`): бургер-меню с выезжающей боковой панелью

**CandidateQuestionnairePage:**
- Всегда одноколоночная, `max-w-3xl`
- Textarea: на мобильном `h-24`, на десктопе `h-32`

**ManagerDashboardPage:**
- Фильтры: на десктопе -- в ряд справа от заголовка; на мобильном -- стек, полная ширина
- Карточки кандидатов: одна колонка на всех устройствах (список)

**ManagerCandidateDetailPage:**
- Метрики: `grid-cols-1` (мобильный) -> `grid-cols-3` (md+)
- Сильные/слабые стороны: `grid-cols-1` (мобильный) -> `grid-cols-2` (md+)
- Кнопки действий: на мобильном -- полная ширина, стек

**HrApprovedPage:**
- Карточки: на мобильном кнопка "Написать" под информацией (стек); на десктопе -- справа

---

## 10. Приоритеты реализации

### Phase 1 -- Ядро (MVP)

**Цель:** Минимально работающий продукт, позволяющий пройти полный цикл от анкеты до решения.

| Задача | Описание |
|--------|----------|
| UI-компоненты | `Button`, `Input`, `Select`, `Textarea`, `Card`, `Badge`, `Spinner`, `Toast` |
| `authStore` + API | Регистрация, вход, `/me`, хранение токенов |
| `LoginPage` | Форма входа с валидацией и обработкой ошибок |
| `RegisterPage` | Форма регистрации |
| `ProtectedRoute` | Защита маршрутов по ролям |
| Навигация | Адаптивный хедер с меню по роли |
| `CandidateQuestionnairePage` | Пошаговая форма (15 вопросов), выбор вакансии, отправка |
| `CandidateStatusPage` | Отображение статуса с polling |
| `ManagerDashboardPage` | Список кандидатов с фильтрами |
| `ManagerCandidateDetailPage` | Аналитика + кнопки одобрить/отклонить |
| `HrApprovedPage` | Список одобренных + кнопка уведомления |

**Срок:** ~2 недели

### Phase 2 -- Улучшения UX

| Задача | Описание |
|--------|----------|
| Сохранение черновика анкеты | `localStorage` persistence для `candidateStore` |
| Модальные окна | Подтверждение отклонения кандидата |
| `EmptyState` | Заглушки для пустых списков |
| `ProgressBar` | Компонент прогресса анкеты |
| `ScoreBadge` | Компонент цветного бейджа с баллом |
| Refresh token | Автоматическое обновление `access_token` |
| Мобильный бургер-меню | Адаптивная навигация для телефонов |
| `PageHeader` | Единообразные заголовки страниц |
| Валидация форм | Минимум 50 символов для ответов, inline-ошибки |

**Срок:** ~1 неделя

### Phase 3 -- Расширения

| Задача | Описание |
|--------|----------|
| Раздел "Кандидаты с HH.ru" | Полноценная секция с внешними кандидатами |
| Адаптивная HomePage | CTA-кнопки по роли, улучшенный лендинг |
| Пагинация | Для списков кандидатов (при количестве > 20) |
| Анимации | Плавные переходы между шагами анкеты, skeleton-loading |
| Темная тема | Переключатель темы через TailwindCSS dark mode |
| Уведомления | WebSocket/SSE для обновления статуса в реальном времени вместо polling |
| Экспорт аналитики | Кнопка скачивания PDF-отчёта по кандидату (manager) |

**Срок:** ~2 недели

---

## Приложение A. Типы TypeScript

Файл: `src/types/index.ts`

```typescript
export type UserRole = "candidate" | "manager" | "hr";

export interface User {
  id: number;
  email: string;
  name: string;
  role: UserRole;
}

export interface Vacancy {
  id: number;
  title: string;
  description: string;
  requirements: string;
  isActive: boolean;
}

export interface QuestionnaireAnswer {
  questionNumber: number;
  questionText: string;
  answerText: string;
}

export interface SubmitQuestionnairePayload {
  vacancyId: number;
  fullName: string;
  email: string;
  phone: string;
  answers: QuestionnaireAnswer[];
}

export interface CandidateAnalysis {
  id: number;
  candidateId: number;
  totalScore: number;
  vacancyMatch: number;
  growthPotential: string;
  strengths: string[];
  weaknesses: string[];
  summary: string;
  status: "pending" | "analyzed" | "approved" | "rejected";
}

export interface CandidateListItem {
  id: number;
  fullName: string;
  vacancyTitle: string;
  totalScore: number;
  status: string;
  source: "platform" | "hh_parsed";
}

export interface ApprovedCandidate {
  id: number;
  fullName: string;
  vacancyTitle: string;
  totalScore: number;
  approvedAt: string;
  email: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
}
```

## Приложение B. Цветовая схема

| Назначение | Tailwind-класс | Использование |
|------------|---------------|---------------|
| Primary | `primary-600` / `primary-700` | Кнопки, ссылки, логотип |
| Success (зелёный) | `green-100` / `green-600` | Балл >= 85, статус approved, сильные стороны |
| Warning (жёлтый) | `yellow-100` / `yellow-600` / `yellow-800` | Балл 60-84, статус pending |
| Danger (красный) | `red-100` / `red-600` | Балл < 60, статус rejected, зоны развития |
| Info (синий) | `blue-50` / `blue-200` / `blue-800` | Статус analyzed, раздел HH.ru |
| Neutral (серый) | `gray-50` / `gray-400` / `gray-600` | Фон, текст, неактивные элементы |
