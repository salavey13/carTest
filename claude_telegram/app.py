# app.py
"""Main FastAPI application for Claude Telegram Bot."""
import asyncio
import logging
from contextlib import asynccontextmanager
from typing import Dict

from fastapi import FastAPI, Request, HTTPException, BackgroundTasks

from config import (
    ALLOWED_CHAT_IDS, MAX_PROMPT_LENGTH,
    logger
)
from services.security import (
    verify_webhook_secret,
    is_chat_allowed,
    is_command,
    sanitize_prompt
)
from services.telegram import get_telegram_client
from services.claude import get_claude_service


# Per-chat locks to prevent concurrent Claude calls
chat_locks: Dict[int, asyncio.Lock] = {}


def get_chat_lock(chat_id: int) -> asyncio.Lock:
    """Get or create a lock for a specific chat."""
    if chat_id not in chat_locks:
        chat_locks[chat_id] = asyncio.Lock()
    return chat_locks[chat_id]


async def process_message(chat_id: int, user_text: str) -> None:
    """
    Process a message in the background.

    This runs after we've already returned 200 OK to Telegram.
    """
    telegram = get_telegram_client()
    claude = get_claude_service()
    lock = get_chat_lock(chat_id)

    # Acquire lock for this chat - prevents overlapping requests
    async with lock:
        # Show typing indicator
        await telegram.send_typing(chat_id)

        # Sanitize prompt
        sanitized_prompt = sanitize_prompt(user_text, MAX_PROMPT_LENGTH)

        # Run Claude
        claude_reply = await claude.run(sanitized_prompt)

        # Send response (handles splitting if needed)
        await telegram.send_long_message(chat_id, claude_reply)

        logger.info(f"Processed message for chat {chat_id}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup/shutdown."""
    logger.info("🚀 Starting Claude Telegram Bot")
    yield
    # Cleanup: close telegram client
    telegram = get_telegram_client()
    await telegram.close()
    logger.info("👋 Shut down Claude Telegram Bot")


app = FastAPI(
    title="Claude Telegram Bot",
    description="Telegram bot that connects to Claude CLI",
    version="2.0.0",
    lifespan=lifespan
)


@app.get("/health")
async def health_check():
    """Health check endpoint for monitoring."""
    return {"status": "ok", "service": "claude-telegram-bot"}


@app.post("/api/telegramWebhook")
async def telegram_webhook(request: Request, background_tasks: BackgroundTasks):
    """
    Main Telegram webhook endpoint.

    IMPORTANT: Returns immediately to Telegram and processes in background.
    """
    # Verify webhook secret
    verify_webhook_secret(request)

    data = await request.json()

    # Only handle new messages (ignore edits, channel posts, etc.)
    if "message" not in data:
        return {"ok": True}

    message = data["message"]
    if "text" not in message:
        return {"ok": True}

    chat_id = message["chat"]["id"]
    user_text = message["text"]

    # Security: Check if user is allowed
    if not is_chat_allowed(chat_id, ALLOWED_CHAT_IDS):
        # Still return ok so Telegram doesn't retry
        return {"ok": True}

    # Ignore commands (start, help, etc.)
    if is_command(user_text):
        logger.debug(f"Ignored command from chat {chat_id}: {user_text}")
        return {"ok": True}

    # Process in background - return immediately to Telegram
    background_tasks.add_task(process_message, chat_id, user_text)

    logger.info(f"Accepted message from chat {chat_id}: {user_text[:50]}...")
    return {"ok": True}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
