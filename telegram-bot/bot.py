"""inVision U Telegram Bot — for applicants and staff + proactive talent search."""
import os
import logging
import httpx
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import (
    Application, CommandHandler, MessageHandler, CallbackQueryHandler,
    ContextTypes, ConversationHandler, filters,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

BOT_TOKEN = os.environ.get("BOT_TOKEN", "8657277109:AAGPSvKgPIhRd6yd2MwDlmRAtksXSfguHN8")
API_URL = os.environ.get("API_URL", "http://backend:8000/api/v1")

# Conversation states
WAITING_CODE = 1
SURVEY_Q1, SURVEY_Q2, SURVEY_Q3, SURVEY_Q4, SURVEY_Q5, SURVEY_NAME, SURVEY_PHONE = range(10, 17)

SURVEY_QUESTIONS = [
    "1/5 👑 Расскажите о ситуации, когда вы организовали что-то для других людей (проект, мероприятие, помощь). Что это было и сколько людей участвовало?",
    "2/5 🎯 Зачем вам высшее образование? Что вы хотите изменить в мире?",
    "3/5 📈 Чему вы научились за последний год, чего не умели раньше? Как именно вы это освоили?",
    "4/5 💡 Если бы у вас было 1 000 000 тенге и полгода времени — какой проект вы бы создали для своего города?",
    "5/5 🔥 Расскажите о своём главном провале. Что пошло не так и что вы из этого вынесли?",
]


# ============================================================
# Helpers
# ============================================================

async def api_get(path: str, params: dict = None) -> dict | None:
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(f"{API_URL}{path}", params=params)
            if resp.status_code == 200:
                return resp.json()
    except Exception as e:
        logger.error(f"API error: {e}")
    return None


async def api_post(path: str, data: dict = None, timeout: float = 10.0) -> dict | None:
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.post(f"{API_URL}{path}", json=data)
            if resp.status_code == 200:
                return resp.json()
    except Exception as e:
        logger.error(f"API error: {e}")
    return None


async def get_linked_user(telegram_id: int) -> dict | None:
    return await api_get("/telegram/me", {"telegram_id": telegram_id})


# ============================================================
# /start — two buttons: link account OR take survey
# ============================================================

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = await get_linked_user(update.effective_user.id)

    if user:
        role_labels = {"candidate": "Абитуриент", "hr": "Координатор отбора", "manager": "Приёмная комиссия"}
        role = role_labels.get(user["role"], user["role"])
        await update.message.reply_text(
            f"👋 Привет, {user['name']}!\n"
            f"📌 Роль: {role}\n\n"
            f"Доступные команды:\n"
            f"/status — Статус заявки\n"
            f"/profile — Мой профиль\n"
            + (f"/applications — Новые заявки\n/stats — Статистика\n" if user["role"] in ("hr", "manager") else "")
            + f"/unlink — Отвязать аккаунт"
        )
        return ConversationHandler.END

    keyboard = [
        [InlineKeyboardButton("🔗 Привязать аккаунт", callback_data="link_account")],
        [InlineKeyboardButton("📝 Пройти мини-анкету", callback_data="start_survey")],
    ]
    await update.message.reply_text(
        "👋 Добро пожаловать в inVision U!\n\n"
        "Выберите действие:",
        reply_markup=InlineKeyboardMarkup(keyboard),
    )
    return ConversationHandler.END


# ============================================================
# Link account flow
# ============================================================

async def link_account_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    await query.edit_message_text(
        "🔗 Привязка аккаунта\n\n"
        "1. Зайдите в профиль на сайте inVision U\n"
        "2. Нажмите «Получить код для Telegram»\n"
        "3. Введите 6-значный код здесь\n\n"
        "Введите код:"
    )
    return WAITING_CODE


async def receive_code(update: Update, context: ContextTypes.DEFAULT_TYPE):
    code = update.message.text.strip()

    if not code.isdigit() or len(code) != 6:
        await update.message.reply_text("❌ Код должен быть 6-значным числом. Попробуйте ещё раз:")
        return WAITING_CODE

    result = await api_post("/telegram/verify-code", {
        "code": code,
        "telegram_id": update.effective_user.id,
        "telegram_username": update.effective_user.username or "",
    })

    if result and result.get("success"):
        role_labels = {"candidate": "Абитуриент", "hr": "Координатор отбора", "manager": "Приёмная комиссия"}
        role = role_labels.get(result.get("role", ""), result.get("role", ""))
        await update.message.reply_text(
            f"✅ Аккаунт привязан!\n\n"
            f"👤 {result['name']}\n"
            f"📌 {role}\n\n"
            f"Используйте /start чтобы увидеть доступные команды."
        )
        return ConversationHandler.END
    else:
        await update.message.reply_text("❌ Неверный или просроченный код. Попробуйте ещё раз:")
        return WAITING_CODE


# ============================================================
# Survey flow (proactive talent search)
# ============================================================

async def start_survey_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()

    # Check if already completed survey
    check = await api_get("/telegram/survey-check", {"telegram_id": query.from_user.id})
    if check and check.get("completed"):
        await query.edit_message_text(
            "❌ Вы уже проходили мини-анкету.\n\n"
            f"Ваш балл: {check.get('score', '?')}/100\n"
            f"Статус: {check.get('status', '?')}\n\n"
            "Повторное прохождение невозможно."
        )
        return ConversationHandler.END

    context.user_data["survey_answers"] = []
    await query.edit_message_text(
        "📝 Мини-анкета inVision U\n\n"
        "Ответьте на 5 коротких вопросов. Это займёт 3-5 минут.\n"
        "Ваши ответы будут оценены, и если вы покажете потенциал — мы пригласим вас подать полную заявку!\n\n"
        f"{SURVEY_QUESTIONS[0]}"
    )
    return SURVEY_Q1


async def survey_q1(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data["survey_answers"].append(update.message.text)
    await update.message.reply_text(SURVEY_QUESTIONS[1])
    return SURVEY_Q2


async def survey_q2(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data["survey_answers"].append(update.message.text)
    await update.message.reply_text(SURVEY_QUESTIONS[2])
    return SURVEY_Q3


async def survey_q3(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data["survey_answers"].append(update.message.text)
    await update.message.reply_text(SURVEY_QUESTIONS[3])
    return SURVEY_Q4


async def survey_q4(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data["survey_answers"].append(update.message.text)
    await update.message.reply_text(SURVEY_QUESTIONS[4])
    return SURVEY_Q5


async def survey_q5(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data["survey_answers"].append(update.message.text)
    await update.message.reply_text("👤 Отлично! Последний шаг.\n\nВведите ваше имя и фамилию:")
    return SURVEY_NAME


async def survey_name(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data["survey_name"] = update.message.text.strip()
    await update.message.reply_text("📱 Введите ваш номер телефона (формат: +7XXXXXXXXXX):")
    return SURVEY_PHONE


async def survey_phone(update: Update, context: ContextTypes.DEFAULT_TYPE):
    phone = update.message.text.strip()
    name = context.user_data.get("survey_name", "")
    answers = context.user_data.get("survey_answers", [])
    telegram_id = update.effective_user.id
    username = update.effective_user.username or ""

    await update.message.reply_text("⏳ Анализируем ваши ответы... Это займёт ~30 секунд.")

    # Send to backend
    result = await api_post("/telegram/submit-survey", {
        "telegram_id": telegram_id,
        "telegram_username": username,
        "name": name,
        "phone": phone,
        "answers": [
            {"question": SURVEY_QUESTIONS[i].split(" ", 2)[-1], "answer": answers[i]}
            for i in range(min(len(answers), 5))
        ],
    }, timeout=120.0)

    if result and result.get("success"):
        score = result.get("score", 0)
        if score >= 70:
            emoji = "🌟"
            verdict = "Отличный потенциал! Мы рекомендуем вам подать полную заявку на сайте inVision U."
        elif score >= 50:
            emoji = "👍"
            verdict = "Хороший потенциал! Рассмотрите подачу заявки на программы inVision U."
        else:
            emoji = "💪"
            verdict = "Спасибо за интерес! Продолжайте развиваться и попробуйте подать заявку позже."

        await update.message.reply_text(
            f"{emoji} Результат анализа\n\n"
            f"👤 {name}\n"
            f"💯 Балл: {score}/100\n\n"
            f"{verdict}\n\n"
            f"🔗 Подать полную заявку: зарегистрируйтесь на сайте и привяжите Telegram через /start"
        )
    else:
        await update.message.reply_text(
            "✅ Анкета отправлена!\n\n"
            "Координатор отбора рассмотрит ваши ответы.\n"
            "Если вы покажете потенциал — мы свяжемся с вами!"
        )

    context.user_data.clear()
    return ConversationHandler.END


# ============================================================
# Commands (same as before)
# ============================================================

async def cancel(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text("Отменено. Используйте /start чтобы начать заново.")
    return ConversationHandler.END


async def status_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = await get_linked_user(update.effective_user.id)
    if not user:
        await update.message.reply_text("❌ Аккаунт не привязан. Используйте /start")
        return
    if user["role"] != "candidate":
        await update.message.reply_text("ℹ️ Эта команда доступна только абитуриентам.")
        return
    data = await api_get("/telegram/candidate-status", {"telegram_id": update.effective_user.id})
    if not data:
        await update.message.reply_text("📋 У вас пока нет заявки.\nПосетите сайт чтобы подать заявку.")
        return
    status_labels = {
        "draft": "📝 Черновик", "pending": "⏳ Ожидание", "processing": "🔄 Анализируется",
        "analyzed": "📋 На рассмотрении", "hr_review": "📋 На рассмотрении",
        "sent_to_manager": "📨 У комиссии", "approved": "✅ Зачислен!", "rejected": "❌ Отклонён",
    }
    status = data.get("status", "unknown")
    text = f"📊 Статус заявки\n\n📌 Программа: {data.get('vacancy_title', '—')}\n📊 Статус: {status_labels.get(status, status)}\n"
    if data.get("total_score") and status in ("approved", "analyzed", "sent_to_manager"):
        text += f"💯 Балл: {data['total_score']}/100\n"
    if data.get("manager_comment"):
        text += f"\n💬 Комментарий комиссии:\n{data['manager_comment']}\n"
    await update.message.reply_text(text)


async def profile_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = await get_linked_user(update.effective_user.id)
    if not user:
        await update.message.reply_text("❌ Аккаунт не привязан. Используйте /start")
        return
    role_labels = {"candidate": "Абитуриент", "hr": "Координатор отбора", "manager": "Приёмная комиссия"}
    await update.message.reply_text(f"👤 Профиль\n\nИмя: {user['name']}\nEmail: {user['email']}\nРоль: {role_labels.get(user['role'], user['role'])}\n")


async def applications_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = await get_linked_user(update.effective_user.id)
    if not user or user["role"] not in ("hr", "manager"):
        await update.message.reply_text("❌ Доступно только для сотрудников.")
        return
    data = await api_get("/telegram/applications", {"telegram_id": update.effective_user.id})
    if not data or not data.get("candidates"):
        await update.message.reply_text("📋 Нет новых заявок на рассмотрение.")
        return
    text = f"📋 Новые заявки ({data['count']})\n\n"
    for c in data["candidates"][:10]:
        ai_flag = " 🤖" if c.get("ai_suspected") else ""
        text += f"• {c['full_name']} — {c['total_score']}/100{ai_flag}\n  {c['vacancy_title']}\n\n"
    text += "\n🔗 Подробнее на сайте"
    await update.message.reply_text(text)


async def stats_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = await get_linked_user(update.effective_user.id)
    if not user or user["role"] not in ("hr", "manager"):
        await update.message.reply_text("❌ Доступно только для сотрудников.")
        return
    data = await api_get("/telegram/stats", {"telegram_id": update.effective_user.id})
    if not data:
        await update.message.reply_text("📊 Статистика недоступна.")
        return
    text = (f"📊 Статистика inVision U\n\n👥 Всего: {data.get('total', 0)}\n📊 Средний балл: {data.get('avg_score', 0)}\n"
            f"✅ Зачислено: {data.get('approved', 0)}\n❌ Отклонено: {data.get('rejected', 0)}\n"
            f"⏳ На рассмотрении: {data.get('pending', 0)}\n🔍 С подозрением: {data.get('ai_flagged', 0)}\n")
    await update.message.reply_text(text)


async def unlink_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = await get_linked_user(update.effective_user.id)
    if not user:
        await update.message.reply_text("❌ Аккаунт не привязан.")
        return
    result = await api_post("/telegram/unlink", {"telegram_id": update.effective_user.id})
    await update.message.reply_text("✅ Аккаунт отвязан." if result and result.get("success") else "❌ Ошибка.")


# ============================================================
# Main
# ============================================================

def main():
    app = Application.builder().token(BOT_TOKEN).build()

    # Main conversation handler
    conv_handler = ConversationHandler(
        entry_points=[
            CommandHandler("start", start),
            CallbackQueryHandler(link_account_callback, pattern="^link_account$"),
            CallbackQueryHandler(start_survey_callback, pattern="^start_survey$"),
        ],
        states={
            WAITING_CODE: [MessageHandler(filters.TEXT & ~filters.COMMAND, receive_code)],
            SURVEY_Q1: [MessageHandler(filters.TEXT & ~filters.COMMAND, survey_q1)],
            SURVEY_Q2: [MessageHandler(filters.TEXT & ~filters.COMMAND, survey_q2)],
            SURVEY_Q3: [MessageHandler(filters.TEXT & ~filters.COMMAND, survey_q3)],
            SURVEY_Q4: [MessageHandler(filters.TEXT & ~filters.COMMAND, survey_q4)],
            SURVEY_Q5: [MessageHandler(filters.TEXT & ~filters.COMMAND, survey_q5)],
            SURVEY_NAME: [MessageHandler(filters.TEXT & ~filters.COMMAND, survey_name)],
            SURVEY_PHONE: [MessageHandler(filters.TEXT & ~filters.COMMAND, survey_phone)],
        },
        fallbacks=[CommandHandler("cancel", cancel)],
    )

    app.add_handler(conv_handler)
    app.add_handler(CallbackQueryHandler(link_account_callback, pattern="^link_account$"))
    app.add_handler(CallbackQueryHandler(start_survey_callback, pattern="^start_survey$"))
    app.add_handler(CommandHandler("status", status_cmd))
    app.add_handler(CommandHandler("profile", profile_cmd))
    app.add_handler(CommandHandler("applications", applications_cmd))
    app.add_handler(CommandHandler("stats", stats_cmd))
    app.add_handler(CommandHandler("unlink", unlink_cmd))

    logger.info("Bot started")
    app.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()
