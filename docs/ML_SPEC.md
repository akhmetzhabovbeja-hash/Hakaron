# Hakaron ML Service -- Техническое задание

**Проект:** Hakaron -- AI-платформа скрининга кандидатов
**Сервис:** ml-service (FastAPI, порт 8001)
**Версия документа:** 1.0
**Дата:** 2026-03-29
**Оборудование:** NVIDIA RTX 3070 Ti, 8 GB VRAM

---

## Содержание

1. [Обзор ML-сервиса](#1-обзор-ml-сервиса)
2. [15 вопросов для кандидатов](#2-15-вопросов-для-кандидатов)
3. [Архитектура ML-пайплайна](#3-архитектура-ml-пайплайна)
4. [Скоринговая модель](#4-скоринговая-модель)
5. [Формат API](#5-формат-api)
6. [Ограничения GPU и оптимизация](#6-ограничения-gpu-и-оптимизация)
7. [Обучение и fine-tuning](#7-обучение-и-fine-tuning)
8. [Метрики качества](#8-метрики-качества)
9. [Приоритеты и фазы разработки](#9-приоритеты-и-фазы-разработки)

---

## 1. Обзор ML-сервиса

### 1.1 Роль в системе

ML-сервис является ядром аналитики платформы Hakaron. Основной backend (Django) принимает ответы кандидатов через веб-интерфейс и отправляет их в ML-сервис для анализа. ML-сервис возвращает структурированную оценку, которая отображается рекрутеру в дашборде.

Схема взаимодействия:

```
Кандидат -> Frontend -> Django API -> ML Service (POST /api/v1/analyze) -> Django -> Dashboard рекрутера
```

### 1.2 Вход (Input)

ML-сервис получает на вход:

- **candidate_id** -- идентификатор кандидата
- **vacancy_id** -- идентификатор вакансии
- **vacancy_title** -- название вакансии (строка)
- **vacancy_requirements** -- текстовое описание требований вакансии (навыки, опыт, обязанности)
- **answers** -- массив из 15 объектов, каждый содержит:
  - `question_number` (1..15) -- номер вопроса
  - `question_text` -- текст вопроса
  - `answer_text` -- ответ кандидата (свободный текст, от 50 до 3000 символов)

### 1.3 Выход (Output)

ML-сервис возвращает:

| Поле | Тип | Описание |
|------|-----|----------|
| `candidate_id` | int | Идентификатор кандидата |
| `total_score` | int (0..100) | Общий балл кандидата |
| `vacancy_match` | float (0.0..1.0) | Степень соответствия вакансии |
| `growth_potential` | str | Оценка потенциала роста: "A", "B+", "B", "C+", "C", "D" |
| `strengths` | list[str] | 2-5 сильных сторон кандидата |
| `weaknesses` | list[str] | 1-4 зоны для развития |
| `summary` | str | Текстовое резюме (2-4 предложения) для рекрутера |
| `category_scores` | dict | Баллы по каждой категории вопросов (0..100) |

---

## 2. 15 вопросов для кандидатов

Вопросы разделены на 4 категории. Каждый вопрос спроектирован так, чтобы выявить три аспекта: **что кандидат может сейчас**, **чего не может (осознание ограничений)** и **что сможет в будущем (потенциал роста)**.

### Категория A: Профессиональный опыт (вопросы 1-4)

**Цель:** оценить реальный практический опыт, глубину экспертизы и способность к рефлексии.

| # | Вопрос | Что выявляет |
|---|--------|-------------|
| 1 | Опишите своё главное профессиональное достижение за последние 2 года. Какую роль вы играли, какие конкретные результаты были достигнуты? | **Может:** уровень ответственности и реальный вклад. **Не может:** если примеры размытые -- слабый опыт. **Потенциал:** масштаб амбиций и стремление к значимым результатам. |
| 2 | Расскажите о самой сложной задаче, с которой вы столкнулись на работе. Как вы подошли к её решению и чему научились? | **Может:** навыки решения проблем, системное мышление. **Не может:** если избегает деталей -- поверхностный подход. **Потенциал:** способность расти через сложности. |
| 3 | Расскажите о ситуации, когда вы допустили серьёзную ошибку на работе. Как вы её обнаружили, исправили и что сделали, чтобы она не повторилась? | **Может:** self-awareness, честность, ответственность. **Не может:** если перекладывает вину -- низкая зрелость. **Потенциал:** growth mindset, способность извлекать уроки. |
| 4 | Какой проект или инициативу вы запустили самостоятельно, без прямого указания руководства? Каков был результат? | **Может:** проактивность, инициативность. **Не может:** если нет примеров -- зависимость от указаний. **Потенциал:** лидерский потенциал, предпринимательское мышление. |

### Категория B: Компетенции и навыки (вопросы 5-8)

**Цель:** оценить технические и soft skills, способность работать в команде и решать проблемы.

| # | Вопрос | Что выявляет |
|---|--------|-------------|
| 5 | Перечислите 3-5 ключевых навыков, которые делают вас эффективным в вашей профессии. Приведите конкретный пример применения каждого из них. | **Может:** осознание собственных сильных сторон с доказательствами. **Не может:** если примеры абстрактные -- слабая саморефлексия. **Потенциал:** глубина и разнообразие навыков. |
| 6 | Расскажите о ситуации, когда вам пришлось работать с трудным коллегой или в конфликтной команде. Как вы действовали? | **Может:** навыки коммуникации, эмпатия, умение решать конфликты. **Не может:** если обвиняет других -- низкий EQ. **Потенциал:** зрелость, лидерские качества. |
| 7 | Опишите случай, когда вам пришлось быстро разобраться в незнакомой теме или технологии для выполнения задачи. Как вы организовали процесс обучения? | **Может:** скорость обучения, методология самообразования. **Не может:** если нет структуры -- хаотичный подход. **Потенциал:** обучаемость, адаптивность. |
| 8 | Какие навыки или компетенции, по вашему мнению, вам сейчас не хватает для следующего карьерного шага? Что вы делаете для их развития? | **Может:** осознание своих пробелов (self-awareness). **Не может:** если "мне ничего не нужно" -- завышенная самооценка. **Потенциал:** план развития, growth mindset. |

### Категория C: Мотивация и ценности (вопросы 9-12)

**Цель:** понять внутреннюю мотивацию, ценностное соответствие компании и долгосрочные цели.

| # | Вопрос | Что выявляет |
|---|--------|-------------|
| 9 | Почему вас заинтересовала именно эта вакансия и наша компания? Что вы знаете о нас? | **Может:** подготовленность, genuine interest. **Не может:** если общие фразы -- массовая рассылка. **Потенциал:** мотивация к глубокому погружению. |
| 10 | Где вы видите себя через 3 года? Как эта позиция вписывается в ваш карьерный план? | **Может:** стратегическое мышление, планирование. **Не может:** если нет плана -- отсутствие направленности. **Потенциал:** амбиции и их реалистичность. |
| 11 | Опишите идеальную рабочую среду, в которой вы максимально продуктивны. Какие факторы для вас критически важны? | **Может:** самопонимание, честность о предпочтениях. **Не может:** если "мне всё подходит" -- отсутствие рефлексии. **Потенциал:** culture fit, адаптивность. |
| 12 | Расскажите о ситуации, когда вам пришлось делать работу, которая вам не нравилась. Как вы справились и что вынесли из этого опыта? | **Может:** стойкость, профессионализм, discipline. **Не может:** если жалуется без решений -- низкая устойчивость. **Потенциал:** зрелость, эмоциональная устойчивость. |

### Категория D: Потенциал и адаптивность (вопросы 13-15)

**Цель:** оценить способность к развитию, реакцию на изменения и амбиции.

| # | Вопрос | Что выявляет |
|---|--------|-------------|
| 13 | Расскажите о ситуации, когда условия работы или требования резко изменились (новый руководитель, смена приоритетов, реструктуризация). Как вы адаптировались? | **Может:** гибкость, устойчивость к стрессу. **Не может:** если сопротивляется изменениям -- ригидность. **Потенциал:** антихрупкость, ability to thrive in change. |
| 14 | Если бы у вас было 6 свободных месяцев и неограниченный бюджет на обучение, что бы вы изучили и почему? | **Может:** направление развития, осознанность выбора. **Не может:** если не знает -- отсутствие curiosity. **Потенциал:** интеллектуальная любопытность, стратегическое видение своего роста. |
| 15 | Представьте, что через год на этой позиции вы значительно превзошли ожидания. Как выглядит этот сценарий? Что конкретно вы сделали? | **Может:** визуализация успеха, конкретика мышления. **Не может:** если расплывчато -- слабое целеполагание. **Потенциал:** уровень амбиций, проактивность, ownership. |

### Маппинг вопросов и категорий

```
Категория A (Профессиональный опыт):  вопросы 1, 2, 3, 4
Категория B (Компетенции и навыки):   вопросы 5, 6, 7, 8
Категория C (Мотивация и ценности):   вопросы 9, 10, 11, 12
Категория D (Потенциал и адаптивность): вопросы 13, 14, 15
```

---

## 3. Архитектура ML-пайплайна

### 3.1 Общая схема

```
Входные данные (answers + vacancy)
        |
        v
[1. Text Preprocessing]
        |
        v
[2. Embedding Generation]  <--- Transformer model (ruBERT / MiniLM)
        |
        v
   +---------+-----------+------------------+
   |         |           |                  |
   v         v           v                  v
[3. Answer  [4. Vacancy  [5. Growth       [6. Quality
 Quality     Matching]    Potential         Keywords
 Scoring]                 Estimation]       Extraction]
   |         |           |                  |
   +----+----+-----------+------------------+
        |
        v
[7. Final Scoring Aggregation]
        |
        v
Выходные данные (score, match, strengths, weaknesses, ...)
```

### 3.2 Этап 1: Text Preprocessing

Задачи:
- Удаление лишних пробелов, переносов строк, спецсимволов
- Приведение к нижнему регистру (для keyword-matching; для embeddings -- оставлять как есть)
- Исправление типичных опечаток (опционально, Phase 3)
- Токенизация предложений (для анализа структуры ответа)
- Определение языка ответа (ru/en)

```python
import re
import unicodedata

def preprocess_text(text: str) -> str:
    """Базовая нормализация текста."""
    text = unicodedata.normalize("NFKC", text)
    text = re.sub(r"\s+", " ", text).strip()
    text = re.sub(r"[^\w\s.,!?;:\-()\"'/@#]", "", text)
    return text

def split_sentences(text: str) -> list[str]:
    """Разбиение на предложения для анализа полноты."""
    return re.split(r'(?<=[.!?])\s+', text)
```

### 3.3 Этап 2: Embedding Generation

#### Рекомендуемые модели (8 GB VRAM)

| Модель | Размер | Dim | Скорость | Качество (ru) | Рекомендация |
|--------|--------|-----|----------|---------------|-------------|
| `cointegrated/rubert-tiny2` | ~120 MB | 312 | Быстрая | Хорошее | Phase 2 -- быстрый старт |
| `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` | ~470 MB | 384 | Средняя | Хорошее | Phase 2 -- основная модель |
| `ai-forever/sbert_large_nlu_ru` | ~1.3 GB | 1024 | Медленная | Отличное | Phase 3 -- максимальное качество |

**Решение для Phase 2:** использовать `paraphrase-multilingual-MiniLM-L12-v2` как основную модель -- баланс между качеством и скоростью. При необходимости переключиться на `sbert_large_nlu_ru` для повышения точности.

```python
from transformers import AutoTokenizer, AutoModel
import torch

class EmbeddingService:
    def __init__(self, model_name: str = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.tokenizer = AutoTokenizer.from_pretrained(model_name)
        self.model = AutoModel.from_pretrained(model_name).to(self.device)
        self.model.eval()

    @torch.no_grad()
    def encode(self, texts: list[str]) -> torch.Tensor:
        """Получить embeddings для списка текстов."""
        encoded = self.tokenizer(
            texts,
            padding=True,
            truncation=True,
            max_length=512,
            return_tensors="pt"
        ).to(self.device)
        output = self.model(**encoded)
        # Mean pooling
        attention_mask = encoded["attention_mask"]
        token_embeddings = output.last_hidden_state
        input_mask_expanded = attention_mask.unsqueeze(-1).expand(token_embeddings.size()).float()
        embeddings = torch.sum(token_embeddings * input_mask_expanded, 1) / torch.clamp(
            input_mask_expanded.sum(1), min=1e-9
        )
        return embeddings
```

### 3.4 Этап 3: Answer Quality Scoring

Каждый ответ оценивается по 4 критериям (0..1):

| Критерий | Вес | Как измеряется |
|----------|-----|---------------|
| **Полнота (completeness)** | 0.25 | Длина ответа, количество предложений, покрытие подвопросов |
| **Конкретность (specificity)** | 0.30 | Наличие цифр, дат, названий, конкретных примеров |
| **Self-awareness** | 0.20 | Упоминание ограничений, уроков, зон роста |
| **Growth mindset** | 0.25 | Языковые маркеры обучения, развития, планов |

#### Детализация критериев

**Полнота (completeness):**
- Длина ответа: <100 символов = 0.2, 100-300 = 0.5, 300-800 = 0.8, 800+ = 1.0
- Количество предложений: <2 = 0.3, 2-4 = 0.6, 5-8 = 0.9, 8+ = 1.0
- Ответ на все части вопроса (если вопрос составной)

**Конкретность (specificity):**
- Наличие числовых данных (проценты, суммы, сроки): +0.3
- Конкретные названия (компании, инструменты, проекты): +0.3
- Описание последовательности действий (STAR-подобная структура): +0.4

Маркеры конкретности (regex-паттерны):
```python
SPECIFICITY_PATTERNS = [
    r"\d+%",                           # проценты
    r"\d+\s*(рублей|тысяч|млн|$|USD)", # суммы
    r"\d+\s*(месяц|недел|дн|год|лет)", # сроки
    r"(например|в частности|конкретно)",# конкретизация
    r"(использовал|применил|внедрил)",  # действия
]
```

**Self-awareness:**
- Признание ошибок/ограничений: +0.4
- Извлечение уроков: +0.3
- Честная оценка своих навыков: +0.3

Маркеры self-awareness:
```python
SELF_AWARENESS_MARKERS = [
    r"(ошиб|не справ|не удалось|не хватило)",
    r"(понял что|осознал|научился|урок)",
    r"(мне не хватает|нужно развить|слабая сторона)",
    r"(зона роста|работаю над|стараюсь улучшить)",
]
```

**Growth mindset:**
- Упоминание планов развития: +0.3
- Описание процесса обучения: +0.3
- Готовность к вызовам: +0.2
- Позитивное отношение к обратной связи: +0.2

Маркеры growth mindset:
```python
GROWTH_MINDSET_MARKERS = [
    r"(планирую|собираюсь|хочу научиться)",
    r"(обучение|курс|книг|менторство)",
    r"(обратная связь|фидбек|feedback)",
    r"(вызов|challenge|возможность для роста)",
    r"(улучш|развива|соверш)",
]
```

### 3.5 Этап 4: Vacancy Matching

Сравнение ответов кандидата с требованиями вакансии через cosine similarity:

```python
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np

def compute_vacancy_match(
    answer_embeddings: np.ndarray,   # shape: (15, dim)
    vacancy_embedding: np.ndarray,   # shape: (1, dim)
    category_weights: dict[str, float]
) -> float:
    """
    Вычисление соответствия кандидата вакансии.

    Стратегия:
    1. Cosine similarity каждого ответа с вакансией
    2. Взвешенная сумма с учётом весов категорий
    3. Нормализация в диапазон [0, 1]
    """
    similarities = cosine_similarity(answer_embeddings, vacancy_embedding).flatten()

    # Веса по вопросам (из category_weights)
    question_weights = []
    for i in range(15):
        if i < 4:
            question_weights.append(category_weights["experience"])
        elif i < 8:
            question_weights.append(category_weights["competencies"])
        elif i < 12:
            question_weights.append(category_weights["motivation"])
        else:
            question_weights.append(category_weights["potential"])

    weights = np.array(question_weights)
    weights = weights / weights.sum()

    weighted_match = np.dot(similarities, weights)
    # Нормализация: cosine similarity для текстов обычно в диапазоне [0.2, 0.8]
    normalized = np.clip((weighted_match - 0.2) / 0.6, 0.0, 1.0)
    return float(round(normalized, 3))
```

### 3.6 Этап 5: Growth Potential Estimation

Потенциал роста оценивается на основе ответов категорий B и D:

```
growth_score = (
    0.30 * avg_quality(вопросы 7, 8)       # обучаемость и self-awareness
  + 0.30 * avg_quality(вопросы 13, 14, 15)  # адаптивность, curiosity, визия
  + 0.20 * growth_mindset_score_avg         # средний growth mindset по всем ответам
  + 0.20 * specificity_trend                # растёт ли конкретность к финальным вопросам
)
```

Маппинг числового балла в буквенную оценку:

| Балл | Оценка | Интерпретация |
|------|--------|---------------|
| 0.85+ | A | Исключительный потенциал роста |
| 0.70-0.84 | B+ | Высокий потенциал |
| 0.55-0.69 | B | Хороший потенциал |
| 0.40-0.54 | C+ | Умеренный потенциал |
| 0.25-0.39 | C | Ограниченный потенциал |
| <0.25 | D | Низкий потенциал |

### 3.7 Этап 6: Quality Keywords Extraction

Извлечение ключевых фраз из ответов для формирования списков strengths/weaknesses:

**Strengths** -- фразы, связанные с позитивными маркерами:
- Навыки, упомянутые с примерами
- Достижения с конкретными результатами
- Позитивные паттерны поведения

**Weaknesses** -- зоны развития:
- Навыки, которые кандидат сам обозначил как недостающие
- Области, где ответы были поверхностными (низкая specificity)
- Категории с наименьшими баллами

---

## 4. Скоринговая модель

### 4.1 Веса категорий

Базовые веса (для общей оценки):

| Категория | Вес | Обоснование |
|-----------|-----|-------------|
| A: Профессиональный опыт | 0.30 | Ключевой индикатор текущих возможностей |
| B: Компетенции и навыки | 0.30 | Оценка hard и soft skills |
| C: Мотивация и ценности | 0.20 | Важно для culture fit и retention |
| D: Потенциал и адаптивность | 0.20 | Долгосрочная ценность кандидата |

**Важно:** веса могут корректироваться в зависимости от типа вакансии. Например, для junior-позиций вес категории D увеличивается до 0.30, а категории A снижается до 0.20.

### 4.2 Формула итогового балла

```
total_score = round(
    W_a * category_score_A
  + W_b * category_score_B
  + W_c * category_score_C
  + W_d * category_score_D
)
```

Где каждый `category_score_X` вычисляется как:

```
category_score = 100 * mean(
    w_completeness  * completeness_i
  + w_specificity   * specificity_i
  + w_selfawareness * selfawareness_i
  + w_growthmindset * growthmindset_i
    for i in category_questions
)
```

С весами из раздела 3.4:
- `w_completeness = 0.25`
- `w_specificity = 0.30`
- `w_selfawareness = 0.20`
- `w_growthmindset = 0.25`

### 4.3 Vacancy Match Calculation

Финальный vacancy_match комбинирует два сигнала:

```
vacancy_match = 0.60 * embedding_similarity + 0.40 * keyword_overlap
```

Где:
- `embedding_similarity` -- cosine similarity из раздела 3.5
- `keyword_overlap` -- доля ключевых требований вакансии, упомянутых в ответах кандидата

```python
def keyword_overlap(answers_text: str, vacancy_requirements: str) -> float:
    """
    Извлечь ключевые навыки из вакансии и проверить
    их упоминание в ответах.
    """
    # Извлечение навыков из вакансии (NER или regex)
    required_skills = extract_skills(vacancy_requirements)
    mentioned = sum(
        1 for skill in required_skills
        if skill.lower() in answers_text.lower()
    )
    return mentioned / max(len(required_skills), 1)
```

### 4.4 Формирование summary

Summary генерируется по шаблону на основе полученных баллов:

```
Шаблон: "{strength_phrase}. {weakness_phrase}. {recommendation_phrase}."

Пример:
"Кандидат демонстрирует сильный профессиональный опыт и хорошие навыки
коммуникации. Рекомендуется развитие технических компетенций в области X.
Подходит для позиции уровня Middle с потенциалом роста до Senior за 1-2 года."
```

Phase 3: замена шаблонов на генерацию через LLM.

---

## 5. Формат API

### 5.1 Endpoint

```
POST /api/v1/analyze
Content-Type: application/json
```

### 5.2 Request Model

```python
class AnswerItem(BaseModel):
    question_number: int            # 1..15
    question_text: str              # текст вопроса
    answer_text: str                # ответ кандидата (50..3000 символов)

class VacancyInfo(BaseModel):
    title: str                      # "Senior Python Developer"
    requirements: str               # полное описание требований
    level: str | None = None        # "junior" | "middle" | "senior" | "lead"

class AnalyzeRequest(BaseModel):
    candidate_id: int
    vacancy_id: int
    vacancy: VacancyInfo
    answers: list[AnswerItem]       # ровно 15 элементов

    @validator("answers")
    def validate_answers_count(cls, v):
        if len(v) != 15:
            raise ValueError("Expected exactly 15 answers")
        return v
```

### 5.3 Response Model

```python
class CategoryScore(BaseModel):
    category: str                   # "experience" | "competencies" | "motivation" | "potential"
    score: int                      # 0..100
    details: str                    # краткое пояснение

class AnalyzeResponse(BaseModel):
    candidate_id: int
    total_score: int                # 0..100
    vacancy_match: float            # 0.0..1.0
    growth_potential: str           # "A", "B+", "B", "C+", "C", "D"
    strengths: list[str]            # 2-5 элементов
    weaknesses: list[str]           # 1-4 элемента
    summary: str                    # 2-4 предложения
    category_scores: list[CategoryScore]  # 4 элемента
    processing_time_ms: int         # время обработки в миллисекундах
    model_version: str              # "rule-v1" | "embedding-v1" | "finetuned-v1"
```

### 5.4 Пример запроса

```json
{
  "candidate_id": 42,
  "vacancy_id": 7,
  "vacancy": {
    "title": "Middle Python Developer",
    "requirements": "Python 3+, FastAPI/Django, PostgreSQL, Docker, опыт от 2 лет, работа в команде, git",
    "level": "middle"
  },
  "answers": [
    {
      "question_number": 1,
      "question_text": "Опишите своё главное профессиональное достижение за последние 2 года...",
      "answer_text": "На прошлой работе я разработал систему автоматизации отчётности, которая сократила время формирования отчётов с 4 часов до 15 минут. Использовал Python, Pandas и FastAPI..."
    }
  ]
}
```

### 5.5 Пример ответа

```json
{
  "candidate_id": 42,
  "total_score": 74,
  "vacancy_match": 0.78,
  "growth_potential": "B+",
  "strengths": [
    "Релевантный технический опыт (Python, FastAPI)",
    "Конкретные измеримые результаты достижений",
    "Высокая обучаемость и осознанный подход к развитию"
  ],
  "weaknesses": [
    "Ограниченный опыт работы с Docker и DevOps",
    "Недостаточно примеров командной работы"
  ],
  "summary": "Кандидат демонстрирует сильные технические навыки в Python и релевантный опыт автоматизации. Отмечается потенциал к росту, подкреплённый конкретным планом развития. Рекомендуется для позиции Middle с потенциалом роста до Senior при поддержке ментора.",
  "category_scores": [
    {"category": "experience", "score": 80, "details": "Сильный опыт с конкретными результатами"},
    {"category": "competencies", "score": 72, "details": "Хорошие технические навыки, нужно усилить командные"},
    {"category": "motivation", "score": 68, "details": "Средняя подготовленность к конкретной вакансии"},
    {"category": "potential", "score": 78, "details": "Высокий growth mindset, осознанный план развития"}
  ],
  "processing_time_ms": 1240,
  "model_version": "embedding-v1"
}
```

### 5.6 Коды ошибок

| HTTP Code | Описание |
|-----------|----------|
| 200 | Успешный анализ |
| 400 | Невалидные данные (не 15 ответов, пустые тексты) |
| 422 | Ошибка валидации Pydantic |
| 500 | Внутренняя ошибка ML-сервиса |
| 503 | Модель не загружена / GPU недоступен |

---

## 6. Ограничения GPU и оптимизация

### 6.1 Бюджет VRAM (RTX 3070 Ti, 8 GB)

| Компонент | VRAM | Примечание |
|-----------|------|-----------|
| OS/CUDA overhead | ~0.5 GB | Системные нужды |
| Модель (MiniLM-L12) | ~0.5 GB | fp16 |
| Модель (sbert_large) | ~1.5 GB | fp16 |
| Batch inference | ~1.0-2.0 GB | зависит от batch_size и max_length |
| **Итого (MiniLM)** | **~2.0 GB** | остаётся запас ~6 GB |
| **Итого (sbert_large)** | **~4.0 GB** | остаётся запас ~4 GB |

### 6.2 Оптимизация inference

**FP16 (Half Precision):**
```python
model = AutoModel.from_pretrained(model_name, torch_dtype=torch.float16).to("cuda")
```
Уменьшает потребление VRAM в ~2 раза с минимальной потерей качества.

**INT8 Quantization (для Phase 3 с крупными моделями):**
```python
from transformers import BitsAndBytesConfig

quantization_config = BitsAndBytesConfig(load_in_8bit=True)
model = AutoModel.from_pretrained(model_name, quantization_config=quantization_config)
```
Уменьшает VRAM ещё в ~2 раза. Применять для `sbert_large_nlu_ru` если нужно запустить на одной GPU.

**Batch Processing:**
```python
# Обработка 15 ответов + 1 вакансия = 16 текстов
# При max_length=512 и batch_size=8:
# Память на batch ~ 8 * 512 * hidden_dim * 2 bytes (fp16)
# Для MiniLM (384): ~3 MB на batch -- укладывается свободно

BATCH_SIZE = 8  # оптимальный для 8GB VRAM
MAX_LENGTH = 512  # для ответов до 3000 символов достаточно
```

**Рекомендуемая стратегия:**
1. Все 16 текстов (15 ответов + вакансия) обрабатываются за 2 batch по 8
2. Используется fp16
3. Inference time: ~100-200ms на batch (MiniLM) или ~300-500ms (sbert_large)
4. Общее время обработки одного кандидата: 500-1500ms

### 6.3 Конкурентный доступ

При одновременных запросах от нескольких рекрутеров:

```python
import asyncio

class ModelManager:
    def __init__(self):
        self._lock = asyncio.Lock()
        self._model = None

    async def predict(self, texts: list[str]) -> np.ndarray:
        async with self._lock:
            # Только один запрос на GPU одновременно
            return self._run_inference(texts)
```

Альтернатива: очередь запросов через Redis/RabbitMQ (Phase 3).

---

## 7. Обучение и fine-tuning

### 7.1 Сбор данных

| Этап | Источник | Объём | Срок |
|------|----------|-------|------|
| 1 | Синтетические данные (GPT-генерация ответов разного качества) | 500 пар (ответ, оценка) | 1-2 недели |
| 2 | Реальные данные из продакшена (Phase 1 rule-based) | 1000+ ответов | 1-3 месяца |
| 3 | Экспертная разметка (HR-специалисты размечают качество ответов) | 300-500 размеченных ответов | параллельно с этапом 2 |

### 7.2 Разметка

Каждый ответ размечается по 4 критериям (0..5):

```json
{
  "answer_text": "...",
  "question_number": 1,
  "labels": {
    "completeness": 4,
    "specificity": 3,
    "self_awareness": 5,
    "growth_mindset": 4
  },
  "expert_total_score": 78,
  "expert_notes": "Хороший пример, но мало конкретных цифр"
}
```

Метрика inter-annotator agreement: Cohen's Kappa >= 0.7 (минимум 2 эксперта на ответ).

### 7.3 Fine-tuning план

**Phase 3A: Classification head on frozen embeddings**
- Заморозить веса трансформера
- Обучить линейный слой (embedding -> score) на размеченных данных
- Требуемый объём: 500+ примеров
- Время обучения: ~10-30 минут на RTX 3070 Ti

```python
class ScoringHead(torch.nn.Module):
    def __init__(self, embedding_dim: int = 384):
        super().__init__()
        self.layers = torch.nn.Sequential(
            torch.nn.Linear(embedding_dim, 128),
            torch.nn.ReLU(),
            torch.nn.Dropout(0.2),
            torch.nn.Linear(128, 4),  # 4 критерия
            torch.nn.Sigmoid()
        )

    def forward(self, embedding):
        return self.layers(embedding)
```

**Phase 3B: Full fine-tuning (при достаточном объёме данных)**
- Дообучение всей модели на задачу оценки ответов
- Требуемый объём: 2000+ примеров
- Использовать LoRA для экономии VRAM:
  - LoRA rank=8, alpha=16
  - VRAM: +200-400 MB к базовой модели
- Время обучения: 1-3 часа на RTX 3070 Ti

### 7.4 A/B Testing (Phase 3)

Параллельный запуск rule-based (Phase 1) и ML-модели:
- 50% запросов обрабатываются rule-based
- 50% -- ML-моделью
- Метрика сравнения: корреляция с экспертными оценками
- Критерий переключения: ML-модель показывает Pearson r >= 0.75 с экспертами

---

## 8. Метрики качества

### 8.1 Offline-метрики

| Метрика | Формула | Цель |
|---------|---------|------|
| **MAE (Mean Absolute Error)** | mean(\|predicted_score - expert_score\|) | < 10 баллов (из 100) |
| **Pearson Correlation** | corr(predicted, expert) | >= 0.70 (Phase 2), >= 0.80 (Phase 3) |
| **Spearman Rank Correlation** | rank_corr(predicted, expert) | >= 0.65 |
| **Category Accuracy** | % правильных категорий (high/medium/low) | >= 75% |
| **Vacancy Match Precision** | top-K match vs expert ranking | >= 70% |

### 8.2 Online-метрики

| Метрика | Как измерять | Цель |
|---------|-------------|------|
| **Рекрутер agreement** | % случаев, когда рекрутер согласен с оценкой | >= 80% |
| **Hire rate correlation** | корреляция score с фактическим наймом | >= 0.50 |
| **Strengths/weaknesses relevance** | оценка рекрутером (thumb up/down) | >= 75% thumbs up |
| **Processing latency (p95)** | время обработки одного кандидата | < 3 секунды |

### 8.3 Процесс валидации

1. **Регулярный аудит:** еженедельная выборка 20 случайных оценок для ручной проверки
2. **Drift detection:** мониторинг распределения баллов (если mean score сдвигается >5% за неделю -- alert)
3. **Feedback loop:** рекрутеры могут отмечать некорректные оценки -> данные уходят в retraining pipeline

---

## 9. Приоритеты и фазы разработки

### Phase 1: Rule-based Scoring (без ML)

**Цель:** система работает сразу, даёт базовые оценки на эвристиках.
**Срок:** 1-2 недели.
**model_version:** `"rule-v1"`

Реализация:
- Preprocessing текста (очистка, нормализация)
- Оценка completeness по длине и количеству предложений
- Оценка specificity по regex-паттернам (числа, даты, названия)
- Оценка self-awareness и growth mindset по словарям маркеров
- Keyword matching для vacancy_match (без embeddings)
- Шаблонная генерация strengths, weaknesses, summary
- Формула итогового балла по весам из раздела 4

Что НЕ входит:
- Никаких transformer-моделей
- Никакого GPU inference
- Работает на CPU

```python
class RuleBasedAnalyzer:
    """Phase 1: полностью rule-based, работает на CPU."""

    def analyze(self, answers: list[AnswerItem], vacancy: VacancyInfo) -> AnalyzeResponse:
        category_scores = {}
        all_answer_scores = []

        for answer in answers:
            text = preprocess_text(answer.answer_text)
            score = self._score_answer(text, answer.question_number)
            all_answer_scores.append(score)

        category_scores["experience"] = self._avg_scores(all_answer_scores, range(0, 4))
        category_scores["competencies"] = self._avg_scores(all_answer_scores, range(4, 8))
        category_scores["motivation"] = self._avg_scores(all_answer_scores, range(8, 12))
        category_scores["potential"] = self._avg_scores(all_answer_scores, range(12, 15))

        total = (
            0.30 * category_scores["experience"]
          + 0.30 * category_scores["competencies"]
          + 0.20 * category_scores["motivation"]
          + 0.20 * category_scores["potential"]
        )

        vacancy_match = self._keyword_match(answers, vacancy)
        growth = self._estimate_growth(all_answer_scores)
        strengths = self._extract_strengths(category_scores, all_answer_scores)
        weaknesses = self._extract_weaknesses(category_scores, all_answer_scores)
        summary = self._generate_summary(total, vacancy_match, growth)

        return AnalyzeResponse(...)

    def _score_answer(self, text: str, question_number: int) -> dict:
        return {
            "completeness": self._completeness(text),
            "specificity": self._specificity(text),
            "self_awareness": self._self_awareness(text),
            "growth_mindset": self._growth_mindset(text),
        }
```

### Phase 2: Embedding-based Analysis

**Цель:** улучшение качества через семантическое понимание текста.
**Срок:** 2-4 недели (после Phase 1).
**model_version:** `"embedding-v1"`
**Зависимости:** GPU доступен, модель скачана.

Реализация (поверх Phase 1):
- Загрузка `paraphrase-multilingual-MiniLM-L12-v2` при старте сервиса
- Embedding generation для всех ответов и вакансии
- Cosine similarity для vacancy_match (замена keyword-only подхода)
- Комбинированный vacancy_match: `0.6 * embedding + 0.4 * keyword`
- Улучшенная классификация strengths/weaknesses на основе embedding clusters
- Rule-based scoring остаётся как fallback при недоступности GPU

```python
class EmbeddingAnalyzer(RuleBasedAnalyzer):
    """Phase 2: rule-based + embeddings."""

    def __init__(self):
        super().__init__()
        self.embedding_service = EmbeddingService()

    def analyze(self, answers, vacancy):
        # Rule-based scores (наследуем)
        base_result = super().analyze(answers, vacancy)

        # Embedding-based enhancements
        texts = [a.answer_text for a in answers] + [vacancy.requirements]
        embeddings = self.embedding_service.encode(texts)
        answer_embs = embeddings[:15]
        vacancy_emb = embeddings[15:]

        # Улучшенный vacancy match
        embedding_match = compute_vacancy_match(answer_embs, vacancy_emb, CATEGORY_WEIGHTS)
        keyword_match = base_result.vacancy_match
        combined_match = 0.6 * embedding_match + 0.4 * keyword_match

        base_result.vacancy_match = combined_match
        base_result.model_version = "embedding-v1"
        return base_result
```

### Phase 3: Fine-tuned Model + A/B Testing

**Цель:** максимальное качество за счёт дообученной модели.
**Срок:** 2-3 месяца (после накопления данных).
**model_version:** `"finetuned-v1"`
**Зависимости:** >= 1000 размеченных примеров, результаты A/B testing.

Реализация:
- Fine-tuned scoring head поверх embeddings
- Замена rule-based scoring на ML-based scoring
- LoRA fine-tuning при >= 2000 примерах
- A/B testing с rule-based (Phase 1) для валидации
- LLM-based summary generation (опционально)
- Автоматический retraining pipeline

```
Phase 1 (rule-based)        -> Работает с первого дня
         |
Phase 2 (embeddings)        -> +2-4 недели, заметное улучшение vacancy match
         |
Phase 3 (fine-tuned + A/B)  -> +2-3 месяца, максимальное качество
```

---

## Приложение A: Структура файлов ML-сервиса

```
ml-service/
  app/
    __init__.py
    main.py                          # FastAPI app
    api/
      __init__.py
      analyze.py                     # POST /api/v1/analyze endpoint
    models/
      __init__.py
      schemas.py                     # Pydantic models (request/response)  [NEW]
    services/
      __init__.py
      nlp_analyzer.py                # NLPAnalyzer class (Phase 2+)
      rule_based_analyzer.py         # RuleBasedAnalyzer (Phase 1)         [NEW]
      embedding_service.py           # EmbeddingService (Phase 2+)         [NEW]
      scoring.py                     # Scoring functions and weights        [NEW]
      text_preprocessing.py          # Text preprocessing utilities         [NEW]
      keyword_extraction.py          # Skills/keyword extraction            [NEW]
    config/
      __init__.py
      settings.py                    # Model paths, weights, thresholds     [NEW]
      questions.py                   # 15 questions definitions              [NEW]
      markers.py                     # Regex patterns for scoring            [NEW]
  models/                            # Downloaded model files (gitignored)
  tests/
    test_rule_based.py                                                      [NEW]
    test_scoring.py                                                         [NEW]
    test_api.py                                                             [NEW]
  Dockerfile
  Dockerfile.dev
  requirements.txt
```

## Приложение B: Конфигурация по умолчанию

```python
# app/config/settings.py

ML_CONFIG = {
    # Веса категорий
    "category_weights": {
        "experience": 0.30,
        "competencies": 0.30,
        "motivation": 0.20,
        "potential": 0.20,
    },

    # Веса критериев оценки ответа
    "answer_criteria_weights": {
        "completeness": 0.25,
        "specificity": 0.30,
        "self_awareness": 0.20,
        "growth_mindset": 0.25,
    },

    # Vacancy match
    "vacancy_match_weights": {
        "embedding_similarity": 0.60,
        "keyword_overlap": 0.40,
    },

    # Модель
    "model_name": "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
    "model_max_length": 512,
    "model_batch_size": 8,
    "model_dtype": "float16",

    # Growth potential thresholds
    "growth_thresholds": {
        "A": 0.85,
        "B+": 0.70,
        "B": 0.55,
        "C+": 0.40,
        "C": 0.25,
        "D": 0.0,
    },

    # Completeness thresholds (character count)
    "completeness_thresholds": {
        100: 0.2,
        300: 0.5,
        800: 0.8,
    },
}
```
