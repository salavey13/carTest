# services/security.py
"""Security utilities for Claude Telegram Bot."""
import logging
from fastapi import Request, HTTPException

import sys
from pathlib import Path

# Add parent directory to path for direct execution
sys.path.insert(0, str(Path(__file__).parent.parent))

from config import WEBHOOK_SECRET

logger = logging.getLogger(__name__)


def verify_webhook_secret(request: Request) -> bool:
    """
    Verify that the request came from Telegram using the secret token.

    When setting a webhook, Telegram sends a header: X-Telegram-Bot-Api-Secret-Token
    that matches the secret_token you provided when registering the webhook.

    Returns True if valid, raises HTTPException if invalid.
    """
    if not WEBHOOK_SECRET:
        # No secret configured - skip verification (but log a warning)
        logger.warning("Webhook received without secret verification!")
        return True

    received_secret = request.headers.get("X-Telegram-Bot-Api-Secret-Token")

    if received_secret != WEBHOOK_SECRET:
        logger.warning(
            f"Rejected webhook with invalid secret. "
            f"Received: {received_secret[:20]}..." if received_secret else "None"
        )
        raise HTTPException(status_code=403, detail="Invalid webhook secret")

    return True


def is_chat_allowed(chat_id: int, allowed_chat_ids: set) -> bool:
    """Check if a chat_id is in the allowed set."""
    is_allowed = chat_id in allowed_chat_ids

    if not is_allowed:
        logger.info(f"Rejected message from unauthorized chat_id: {chat_id}")

    return is_allowed


def is_command(text: str) -> bool:
    """Check if text is a Telegram command (starts with /)."""
    return text.startswith('/')


def sanitize_prompt(prompt: str, max_length: int) -> str:
    """Truncate prompt to maximum length to prevent DoS/injection."""
    if len(prompt) > max_length:
        logger.info(f"Truncated prompt from {len(prompt)} to {max_length} chars")
        return prompt[:max_length]
    return prompt
