# services/telegram.py
"""Telegram API client using async httpx."""
import logging
from typing import List

import httpx

import sys
from pathlib import Path

# Add parent directory to path for direct execution
sys.path.insert(0, str(Path(__file__).parent.parent))

from config import TELEGRAM_API_URL, MESSAGE_CHUNK_SIZE

logger = logging.getLogger(__name__)


class TelegramClient:
    """Async Telegram API client."""

    def __init__(self, api_url: str = TELEGRAM_API_URL):
        self.api_url = api_url
        self._client: httpx.AsyncClient | None = None

    async def _get_client(self) -> httpx.AsyncClient:
        """Get or create the async httpx client."""
        if self._client is None:
            self._client = httpx.AsyncClient(timeout=30.0)
        return self._client

    async def close(self) -> None:
        """Close the httpx client."""
        if self._client:
            await self._client.aclose()
            self._client = None

    async def _api_call(self, method: str, payload: dict) -> dict:
        """Make an async API call to Telegram."""
        client = await self._get_client()
        url = f"{self.api_url}/{method}"

        try:
            response = await client.post(url, json=payload)
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as e:
            logger.error(f"Telegram API error ({method}): {e}")
            return {"ok": False, "error": str(e)}

    async def send_message(self, chat_id: int, text: str) -> dict:
        """Send a text message to a chat."""
        payload = {
            "chat_id": chat_id,
            "text": text
        }
        return await self._api_call("sendMessage", payload)

    async def send_typing(self, chat_id: int) -> dict:
        """Send a typing action indicator."""
        payload = {
            "chat_id": chat_id,
            "action": "typing"
        }
        return await self._api_call("sendChatAction", payload)

    def split_message(self, text: str, chunk_size: int = MESSAGE_CHUNK_SIZE) -> List[str]:
        """
        Split a long message into chunks that fit Telegram's size limit.

        Tries to split at newlines when possible to avoid breaking sentences.
        """
        if len(text) <= chunk_size:
            return [text]

        chunks = []
        remaining = text

        while remaining:
            # If we can fit it all, add it and we're done
            if len(remaining) <= chunk_size:
                chunks.append(remaining)
                break

            # Try to find a nice break point (newline)
            chunk = remaining[:chunk_size]
            newline_pos = chunk.rfind('\n')

            if newline_pos > chunk_size * 0.7:  # If newline is in last 30%, use it
                split_pos = newline_pos + 1
            else:
                # No good newline, just split at chunk_size
                split_pos = chunk_size

            chunks.append(remaining[:split_pos].rstrip())
            remaining = remaining[split_pos:].lstrip()

        return chunks

    async def send_long_message(self, chat_id: int, text: str) -> List[dict]:
        """
        Send a long message, automatically splitting if needed.

        Returns a list of response dicts from each sendMessage call.
        """
        chunks = self.split_message(text)
        responses = []

        for i, chunk in enumerate(chunks, 1):
            response = await self.send_message(chat_id, chunk)
            responses.append(response)

            if i > 1:
                logger.debug(f"Sent chunk {i}/{len(chunks)} to chat {chat_id}")

        return responses


# Global client instance
_telegram_client: TelegramClient | None = None


def get_telegram_client() -> TelegramClient:
    """Get or create the global Telegram client."""
    global _telegram_client
    if _telegram_client is None:
        _telegram_client = TelegramClient()
    return _telegram_client
