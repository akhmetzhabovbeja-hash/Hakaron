"""inVision U Telegram Bot — for applicants and staff."""
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

WAITING_CODE = 1


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


async def api_post(path: str, data: dict = None) -> dict | None:
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(f"{API_URL}{path}", json=data)
            if resp.status_code == 200:
                return resp.json()
    except Exception as e:
        logger.error(f"API error: {e}")
    return None


async def get_linked_user(telegram_id: int) -> dict | None:
    return await api_get("/telegram/me", {"telegram_id": telegram_id})


# ============================================================
# /start
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
    else:
        await update.message.reply_text(
            "👋 Добро пожаловать в inVision U!\n\n"
            "Чтобы связать аккаунт:\n"
            "1. Зайдите в профиль на сайте\n"
            "2. Нажмите «Код для Telegram»\n"
            "3. Введите код здесь\n\n"
            "Введите 6-значный код привязки:"
        )
        return WAITING_CODE


# ============================================================
# Link account
# ============================================================

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
        await update.message.reply_text(
            "❌ Неверный или просроченный код.\n"
            "Откройте профиль на сайте и получите новый код.\n\n"
            "Введите код:"
        )
        return WAITING_CODE


async def cancel(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text("Отменено. Используйте /start чтобы начать заново.")
    return ConversationHandler.END


# ============================================================
# /status — applicant status
# ============================================================

async def status_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = await get_linked_user(update.effective_user.id)
    if not user:
        await update.message.reply_text("❌ Аккаунт не привязан. Используйте /start")
        return

    if user["role"] != "candidate":
        await update.message.reply_text("ℹ️ Эта команда доступна только абитуриентам.")
        return

    # Get status via internal API — need to call with user context
    # We'll call the backend directly with telegram_id
    data = await api_get("/telegram/candidate-status", {"telegram_id": update.effective_user.id})

    if not data:
        await update.message.reply_text("📋 У вас пока нет заявки.\nПосетите сайт чтобы подать заявку.")
        return

    status_labels = {
        "draft": "📝 Черновик",
        "pending": "⏳ Ожидание анализа",
        "processing": "🔄 AI анализирует",
        "analyzed": "📋 На рассмотрении координатора",
        "hr_review": "📋 На рассмотрении координатора",
        "sent_to_manager": "📨 У приёмной комиссии",
        "approved": "✅ Зачислен!",
        "rejected": "❌ Отклонён",
    }

    status = data.get("status", "unknown")
    label = status_labels.get(status, status)

    text = f"📊 Статус заявки\n\n"
    text += f"📌 Программа: {data.get('vacancy_title', '—')}\n"
    text += f"📊 Статус: {label}\n"

    if data.get("total_score") and status in ("approved", "analyzed", "sent_to_manager"):
        text += f"💯 Балл: {data['total_score']}/100\n"

    if data.get("manager_comment"):
        text += f"\n💬 Комментарий комиссии:\n{data['manager_comment']}\n"

    await update.message.reply_text(text)


# ============================================================
# /profile
# ============================================================

async def profile_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = await get_linked_user(update.effective_user.id)
    if not user:
        await update.message.reply_text("❌ Аккаунт не привязан. Используйте /start")
        return

    role_labels = {"candidate": "Абитуриент", "hr": "Координатор отбора", "manager": "Приёмная комиссия"}
    await update.message.reply_text(
        f"👤 Профиль\n\n"
        f"Имя: {user['name']}\n"
        f"Email: {user['email']}\n"
        f"Роль: {role_labels.get(user['role'], user['role'])}\n"
    )


# ============================================================
# /applications — HR/Manager: new applications
# ============================================================

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

    if data["count"] > 10:
        text += f"...и ещё {data['count'] - 10}\n"

    text += "\n🔗 Подробнее на сайте"
    await update.message.reply_text(text)


# ============================================================
# /stats — HR: statistics
# ============================================================

async def stats_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = await get_linked_user(update.effective_user.id)
    if not user or user["role"] not in ("hr", "manager"):
        await update.message.reply_text("❌ Доступно только для сотрудников.")
        return

    data = await api_get("/telegram/stats", {"telegram_id": update.effective_user.id})
    if not data:
        await update.message.reply_text("📊 Статистика недоступна.")
        return

    text = f"📊 Статистика inVision U\n\n"
    text += f"👥 Всего абитуриентов: {data.get('total', 0)}\n"
    text += f"📊 Средний балл: {data.get('avg_score', 0)}\n"
    text += f"✅ Зачислено: {data.get('approved', 0)}\n"
    text += f"❌ Отклонено: {data.get('rejected', 0)}\n"
    text += f"⏳ На рассмотрении: {data.get('pending', 0)}\n"
    text += f"🤖 С AI-подозрением: {data.get('ai_flagged', 0)}\n"

    await update.message.reply_text(text)


# ============================================================
# /unlink
# ============================================================

async def unlink_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = await get_linked_user(update.effective_user.id)
    if not user:
        await update.message.reply_text("❌ Аккаунт не привязан.")
        return

    result = await api_post("/telegram/unlink", {"telegram_id": update.effective_user.id})
    if result and result.get("success"):
        await update.message.reply_text("✅ Аккаунт отвязан.")
    else:
        await update.message.reply_text("❌ Ошибка отвязки.")


# ============================================================
# Main
# ============================================================

def main():
    app = Application.builder().token(BOT_TOKEN).build()

    # Conversation for linking
    link_handler = ConversationHandler(
        entry_points=[CommandHandler("start", start)],
        states={
            WAITING_CODE: [MessageHandler(filters.TEXT & ~filters.COMMAND, receive_code)],
        },
        fallbacks=[CommandHandler("cancel", cancel)],
    )

    app.add_handler(link_handler)
    app.add_handler(CommandHandler("status", status_cmd))
    app.add_handler(CommandHandler("profile", profile_cmd))
    app.add_handler(CommandHandler("applications", applications_cmd))
    app.add_handler(CommandHandler("stats", stats_cmd))
    app.add_handler(CommandHandler("unlink", unlink_cmd))

    logger.info("Bot started")
    app.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()
