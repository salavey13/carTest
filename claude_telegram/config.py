# config.py
"""Configuration for Claude Telegram Bot."""
import os
import logging
from typing import Set
from dotenv import load_dotenv

# Load .env file
load_dotenv()

# === Logging Configuration (must be first) ===
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()

# Configure logging
logging.basicConfig(
    level=LOG_LEVEL,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)

logger = logging.getLogger(__name__)

# === Telegram Configuration ===
TELEGRAM_TOKEN = os.getenv("TELEGRAM_TOKEN", "")
if not TELEGRAM_TOKEN:
    logger.warning("TELEGRAM_TOKEN not set - bot will not function!")

TELEGRAM_API_URL = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}" if TELEGRAM_TOKEN else ""

# Webhook secret for verifying Telegram requests
WEBHOOK_SECRET = os.getenv("WEBHOOK_SECRET", "")

# === Security: Allowed Users ===
ALLOWED_CHAT_IDS: Set[int] = {
    int(x) for x in os.getenv("ALLOWED_CHAT_IDS", "").split(",") if x.strip()
}

# === Claude Configuration ===
# Cross-platform Claude binary path
CLAUDE_BINARY = os.getenv("CLAUDE_BINARY", "claude")

# Maximum prompt length to prevent injection/DoS
MAX_PROMPT_LENGTH = int(os.getenv("MAX_PROMPT_LENGTH", "8000"))

# Claude process timeout (seconds)
CLAUDE_TIMEOUT = int(os.getenv("CLAUDE_TIMEOUT", "120"))

# Telegram message limits
TELEGRAM_MAX_LENGTH = 4096
MESSAGE_CHUNK_SIZE = int(os.getenv("MESSAGE_CHUNK_SIZE", "3900"))

# Log configuration on startup
if ALLOWED_CHAT_IDS:
    logger.info(f"Allowed chat IDs: {ALLOWED_CHAT_IDS}")
else:
    logger.warning("No allowed chat IDs configured - bot will reject all messages")

if WEBHOOK_SECRET:
    logger.info("Webhook secret verification enabled")
else:
    logger.warning("WEBHOOK_SECRET not set - webhook is unprotected!")

logger.info(f"Claude binary: {CLAUDE_BINARY}")
logger.info(f"Claude timeout: {CLAUDE_TIMEOUT}s")
