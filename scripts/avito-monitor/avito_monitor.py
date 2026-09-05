#!/usr/bin/env python3
"""Avito lead monitor with GLM-5.2 analysis, SQLite CRM and reminders."""

from __future__ import annotations

import argparse
import fcntl
import hashlib
import html
import json
import logging
import os
import re
import sys
import time
from pathlib import Path
from typing import Optional

import requests

# IPv6-маршрут до api.telegram.org флапает (инцидент 2026-09-05): принудительно
# IPv4 для всех исходящих соединений этого процесса (Telegram/Avito/GLM/webhook).
import socket
import urllib3.util.connection as _urllib3_conn

_urllib3_conn.allowed_gai_family = lambda: socket.AF_INET

from lead_store import LeadStore, normalize_epoch, self_test as store_self_test


SCRIPT_DIR = Path(__file__).resolve().parent
ROOT_DIR = SCRIPT_DIR.parent
CONFIG_FILE = SCRIPT_DIR / "config.json"
STATE_FILE = SCRIPT_DIR / "state.json"
LOG_FILE = SCRIPT_DIR / "monitor.log"
LOCK_FILE = SCRIPT_DIR / ".avito_monitor.lock"
KNOWLEDGE_FILE = SCRIPT_DIR / "avito_knowledge.json"
DB_FILE = ROOT_DIR / "data/avito_leads.db"
SECRETS_FILE = ROOT_DIR / "secrets.env"
WORKSPACE = ROOT_DIR / "workspace"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE, encoding="utf-8"),
        logging.StreamHandler(sys.stdout),
    ],
)
logger = logging.getLogger(__name__)

AVITO_TOKEN_URL = "https://api.avito.ru/token"
AVITO_CHATS_URL = "https://api.avito.ru/messenger/v2/accounts/{user_id}/chats"
AVITO_MESSAGES_URL = (
    "https://api.avito.ru/messenger/v3/accounts/{user_id}/chats/{chat_id}/messages/"
)
TELEGRAM_SEND_URL = "https://api.telegram.org/bot{token}/sendMessage"

RELEVANT_KEYWORDS = [
    r"электро",
    r"мотоцикл",
    r"мото",
    r"байк",
    r"скутер",
    r"ducati",
    r"panigale",
    r"diavel",
    r"electron",
    r"79bike",
    r"falcon",
    r"прокат",
    r"аренда.*мот",
    # Модели линейки, не покрытые ранними ключами (пробел F, план 2026-09-05:
    # живые чаты аренды по своим же байкам отфильтровывались).
    r"y-?volt",
    r"surge",
    r"sequence",
    r"fsmoto",
    r"horwin",
    r"lynx",
    r"электровелосипед",
]

API_PLACEHOLDER_PATTERNS = [
    r"перейдите\s+на\s+подписку.*api\s+мессенджер",
    r"получить\s+доступ\s+к\s+чатам",
    r"messenger\s+api.*subscription",
]

# Анти-бёрст: максимум новых уведомлений на профиль за один прогон
# (первый прогон после A3 иначе выдал бы весь накопленный стейк разом).
NOTIFY_CAP_PER_RUN = 10

# B1: скан Avito — каждые 2 минуты в рабочие часы (10:00–20:00 МСК),
# каждые 5 минут в остальное время. Cron тикает каждые 2 минуты, частоту
# скана регулирует сам скрипт (экономия квот Avito и токенов GLM).
SCAN_BUSINESS_INTERVAL = 120
SCAN_OFFHOURS_INTERVAL = 300


def scan_interval_seconds() -> int:
    from datetime import datetime
    from zoneinfo import ZoneInfo

    now_msk = datetime.now(ZoneInfo("Europe/Moscow"))
    return (
        SCAN_BUSINESS_INTERVAL
        if 10 <= now_msk.hour < 20
        else SCAN_OFFHOURS_INTERVAL
    )


def should_scan(state: dict) -> bool:
    last = int(state.get("last_scan_epoch", 0) or 0)
    return time.time() - last >= scan_interval_seconds()


def get_access_token_cached(
    profile_key: str,
    client_id: str,
    client_secret: str,
    state: dict,
) -> Optional[str]:
    """Кэш client_credentials-токена в state (Avito отдаёт ~24ч).
    Экономит 2 токен-запроса на каждый скан: ~1440/день → ~2/день."""
    cache = state.setdefault("token_cache", {})
    entry = cache.get(profile_key) or {}
    token = str(entry.get("token") or "")
    if token and int(entry.get("expires_at", 0) or 0) > time.time() + 3600:
        return token
    fresh = get_access_token(client_id, client_secret)
    if fresh:
        cache[profile_key] = {
            "token": fresh,
            "expires_at": int(time.time()) + 23 * 3600,
        }
    return fresh


def load_dotenv(path: Path, env: dict[str, str]) -> None:
    if not path.exists():
        return
    for raw_line in path.read_text(errors="ignore").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        env.setdefault(key.strip(), value.strip().strip("\"'"))


def is_relevant_item(item_title: str) -> bool:
    title = item_title.lower()
    return any(re.search(pattern, title) for pattern in RELEVANT_KEYWORDS)


def is_api_placeholder(message: dict) -> bool:
    if message.get("type") == "system":
        return True
    text = str((message.get("content") or {}).get("text") or "").strip().lower()
    return bool(
        text
        and any(re.search(pattern, text) for pattern in API_PLACEHOLDER_PATTERNS)
    )


def load_config() -> dict:
    return json.loads(CONFIG_FILE.read_text(encoding="utf-8"))


def load_state() -> dict:
    if not STATE_FILE.exists():
        return {"last_check": 0, "notified_chats": {}}
    try:
        return json.loads(STATE_FILE.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        logger.exception("Не удалось прочитать старое состояние")
        return {"last_check": 0, "notified_chats": {}}


def save_state(state: dict) -> None:
    STATE_FILE.write_text(
        json.dumps(state, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )


def profile_credentials(profile_key: str, profile: dict) -> tuple[str, str]:
    """Креды профиля: только из secrets.env (A4). Легаси-алиасы:
    rental → AVITO_CLIENT_ID/SECRET, sale → AVITO_SALE_CLIENT_ID/SECRET."""
    runtime_env = os.environ.copy()
    load_dotenv(SECRETS_FILE, runtime_env)
    prefix = f"AVITO_{profile_key.upper()}"
    client_id = str(
        runtime_env.get(f"{prefix}_CLIENT_ID")
        or runtime_env.get("AVITO_CLIENT_ID")
        or ""
    ).strip()
    client_secret = str(
        runtime_env.get(f"{prefix}_CLIENT_SECRET")
        or runtime_env.get("AVITO_CLIENT_SECRET")
        or ""
    ).strip()
    if not client_id or not client_secret:
        logger.error(
            "Креды профиля %s не найдены в secrets.env (%s_CLIENT_ID)",
            profile_key,
            prefix,
        )
    return client_id, client_secret


def get_access_token(client_id: str, client_secret: str) -> Optional[str]:
    try:
        response = requests.post(
            AVITO_TOKEN_URL,
            data={
                "grant_type": "client_credentials",
                "client_id": client_id,
                "client_secret": client_secret,
            },
            timeout=15,
        )
        response.raise_for_status()
        return response.json().get("access_token")
    except requests.RequestException as error:
        logger.error("Ошибка получения токена Avito: %s", error)
        return None


def get_chats(
    access_token: str,
    user_id: int,
    *,
    unread_only: bool,
    limit: int = 100,
) -> list[dict]:
    params: dict[str, object] = {"limit": limit, "chat_types": "u2i"}
    if unread_only:
        params["unread_only"] = "true"
    try:
        response = requests.get(
            AVITO_CHATS_URL.format(user_id=user_id),
            headers={"Authorization": f"Bearer {access_token}"},
            params=params,
            timeout=20,
        )
        response.raise_for_status()
        data = response.json()
        return data.get("chats", [])
    except requests.RequestException as error:
        logger.error(
            "Ошибка получения чатов (user_id=%s, unread=%s): %s",
            user_id,
            unread_only,
            error,
        )
        return []


def get_chat_messages(
    access_token: str, user_id: int, chat_id: str, limit: int = 10
) -> tuple[list[dict], str, int]:
    try:
        response = requests.get(
            AVITO_MESSAGES_URL.format(user_id=user_id, chat_id=chat_id),
            headers={"Authorization": f"Bearer {access_token}"},
            params={"limit": limit},
            timeout=20,
        )
        if response.status_code == 402:
            return [], "Messenger API subscription required", 402
        response.raise_for_status()
        data = response.json()
        messages = data if isinstance(data, list) else data.get("messages", [])
        return messages, "", response.status_code
    except requests.RequestException as error:
        status = int(getattr(getattr(error, "response", None), "status_code", 0) or 0)
        logger.error(
            "Ошибка истории чата: status=%s type=%s",
            status or "network",
            type(error).__name__,
        )
        return [], type(error).__name__, status


def chat_context(chat: dict, seller_user_id: int) -> dict[str, str]:
    value = (chat.get("context") or {}).get("value") or {}
    client_name = "Неизвестно"
    client_id = 0
    for user in chat.get("users") or []:
        uid = int(user.get("id") or 0)
        if uid and uid != int(seller_user_id):
            client_name = str(user.get("name") or "Неизвестно")
            client_id = uid
            break
    return {
        "title": str(value.get("title") or "Неизвестно"),
        "price": str(value.get("price_string") or ""),
        "url": str(value.get("url") or ""),
        "client_name": client_name,
        "client_id": str(client_id),
    }


def fallback_messages(chat: dict) -> list[dict]:
    last_message = chat.get("last_message") or {}
    return [last_message] if last_message else []


def compact_dialog(messages: list[dict], seller_user_id: int) -> list[dict[str, object]]:
    compact: list[dict[str, object]] = []
    for message in messages[-10:]:
        if message.get("type") == "system":
            continue
        content = message.get("content") or {}
        text = str(content.get("text") or "").strip()
        if not text:
            continue
        direction = str(message.get("direction") or "")
        if not direction:
            author_id = int(message.get("author_id") or 0)
            direction = "out" if author_id == seller_user_id else "in"
        compact.append(
            {
                "direction": direction,
                "text": text[:1200],
                "created": normalize_epoch(message.get("created")),
            }
        )
    return compact


def parse_agent_json(text: str) -> dict[str, str]:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    match = re.search(r"\{.*\}", cleaned, re.DOTALL)
    if not match:
        raise ValueError("агент не вернул JSON")
    data = json.loads(match.group(0))
    category = str(data.get("category") or "Требует внимания").strip()
    reply = str(data.get("reply") or "").strip()
    reason = str(data.get("reason") or "").strip()
    context_digest = str(data.get("context_digest") or "").strip()[:500]
    if not reply:
        raise ValueError("агент вернул пустую рекомендацию")
    return {
        "category": category,
        "reply": reply,
        "reason": reason,
        "context_digest": context_digest,
    }


def relevant_knowledge(profile_name: str, item_title: str) -> dict:
    if not KNOWLEDGE_FILE.exists():
        return {}
    try:
        knowledge = json.loads(KNOWLEDGE_FILE.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        logger.exception("Не удалось прочитать базу фактов Авито")
        return {}
    section = "rental" if re.search(
        r"аренд|прокат", profile_name, re.IGNORECASE
    ) else "sale"
    title = item_title.lower()
    matches = []
    for item in knowledge.get(section) or []:
        aliases = [str(alias).lower() for alias in item.get("aliases") or []]
        if any(alias in title for alias in aliases):
            matches.append(item)
    return {
        "updated_at": knowledge.get("updated_at"),
        "general": knowledge.get("general") or {},
        "listing_facts": matches,
        "unknowns": knowledge.get("unknowns") or [],
    }


def generate_agent_reply(
    *,
    profile_name: str,
    item_title: str,
    item_price: str,
    dialog: list[dict[str, object]],
    history_error: str = "",
) -> dict[str, str]:
    runtime_env = os.environ.copy()
    load_dotenv(SECRETS_FILE, runtime_env)
    api_key = runtime_env.get("Z_AI_API_KEY", "")
    base_url = runtime_env.get("Z_AI_BASE_URL", "").rstrip("/")
    if not api_key or not base_url:
        return {
            "category": "Требует ручного ответа",
            "reply": "Не отправлять клиенту: анализ недоступен. Нужен ручной ответ.",
            "reason": "Z.ai не настроен",
            "context_digest": "",
        }
    if base_url.endswith("/v1"):
        endpoint = base_url + "/messages"
    elif base_url.endswith("/v1/messages"):
        endpoint = base_url
    else:
        endpoint = base_url + "/v1/messages"
    payload = {
        "profile": profile_name,
        "listing": {"title": item_title, "price": item_price},
        "verified_knowledge": relevant_knowledge(profile_name, item_title),
        "dialog": dialog,
        "history_complete": not bool(history_error),
    }
    system_prompt = """
Ты — серверный агент разбора лидов Авито VIP BIKE ELECTRO.
Продажа и аренда — разные сценарии.
Рекомендуемый ответ должен прямо отвечать на последний вопрос клиента.
Не выдумывай наличие, цену, характеристики, документы, доставку, скидки и условия.
Если нужного факта нет, задай один короткий уточняющий вопрос.
Не повторяй уже данный менеджером ответ.
Пиши 1–3 короткими предложениями, живым русским языком.
Не обещай бронь, скидку или подготовку техники.
Для продажи не подмешивай аренду, для аренды не подмешивай продажу.
Используй формулировку «без категории А»; не пиши «без прав А».
Если история неполная, опирайся только на доступные сообщения.
Используй только факты из verified_knowledge и самого диалога.
Статус модели в продаже не доказывает свободную дату аренды.
Если поле указано среди unknowns, не отвечай наугад — уточни у клиента нужную деталь
или предложи менеджеру проверить условие.

Правила ведения ответа (методология продаж):
- ЭХО обязательное: первый абзац reply — повтори суть последнего сообщения клиента
  своими словами (модель, даты, вопрос). Клиент не должен повторяться.
- Каждый reply заканчивай конкретным следующим шагом. Для аренды, просмотра и
  тест-райда предлагай два конкретных слота сегодня/завтра (например «14:00 или 16:30»),
  если verified_knowledge подтверждает работу в эти часы.
- Возражение или пауза («надо подумать», «дорого», «посоветуюсь») — сначала признай
  (AAA: понял → это нормально/частый вопрос), затем ОДИН короткий вопрос:
  «что главное смущает?» или «что должно произойти, чтобы это стало „да"?».
- Детальный вопрос (характеристики, комплектация, документы) — сначала встречный
  вопрос («на какие даты/для какой задачи смотрите?»), характеристики списком не вываливай.
- Цену не снижай, скидки и торг не предлагай никогда. Альтернатива скидке — другая
  модель или другой формат аренды из verified_knowledge.

Верни только JSON без markdown:
{"category":"краткая категория лида","reply":"рекомендуемый ответ клиенту","reason":"почему такой ответ","context_digest":"2-4 короткие строки фактов истории: что клиент уже спрашивал, что обещано, даты/модель/бюджет; если это первое сообщение — пустая строка"}
""".strip()
    last_error: Exception = RuntimeError("неизвестная ошибка агента")
    for attempt in range(2):
        try:
            response = requests.post(
                endpoint,
                headers={
                    "x-api-key": api_key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json={
                    "model": "glm-5.2",
                    "max_tokens": 600,
                    "temperature": 0,
                    "system": system_prompt,
                    "messages": [
                        {
                            "role": "user",
                            "content": json.dumps(payload, ensure_ascii=False),
                        }
                    ],
                },
                timeout=90,
            )
            response.raise_for_status()
            data = response.json()
            texts = [
                str(block.get("text") or "")
                for block in data.get("content") or []
                if block.get("type") == "text"
            ]
            return parse_agent_json("".join(texts))
        except Exception as error:
            last_error = error
            if attempt == 0:
                time.sleep(2)
    logger.error("GLM-5.2 анализ недоступен: %s", last_error)
    return {
        "category": "Требует ручного ответа",
        "reply": "Не отправлять клиенту: анализ недоступен. Нужен ручной ответ.",
        "reason": str(last_error)[:200],
        "context_digest": "",
    }


def escape(value: object) -> str:
    return html.escape(str(value or ""), quote=False)


def telegram_runtime(config: dict) -> tuple[str, dict[str, str]]:
    runtime_env = os.environ.copy()
    load_dotenv(SECRETS_FILE, runtime_env)
    telegram = config.get("telegram") or {}
    # A4: токен только из secrets.env; config-значение — легаси-фоллбек.
    token = str(
        runtime_env.get("TELEGRAM_BOT_TOKEN")
        or telegram.get("bot_token")
        or ""
    ).strip()
    raw = str(runtime_env.get("AVITO_TELEGRAM_CHAT_IDS") or "")
    recipients = [
        value.strip().strip("\"'[]")
        for value in re.split(r"[,;\s]+", raw)
        if value.strip().strip("\"'[]")
    ]
    configured = telegram.get("chat_ids") or []
    if isinstance(configured, list):
        recipients.extend(str(value).strip() for value in configured if str(value).strip())
    fallback = str(telegram.get("chat_id") or "").strip()
    if fallback:
        recipients.append(fallback)
    unique = list(dict.fromkeys(recipients))
    targets = {
        hashlib.sha256(chat_id.encode()).hexdigest()[:16]: chat_id
        for chat_id in unique
    }
    return token, targets


def enqueue_lead_webhook(
    store: LeadStore,
    *,
    profile_key: str,
    profile_name: str,
    chat_id: str,
    buyer_id: int,
    last_at: int,
    text: str,
    context: dict[str, str],
    analysis: dict[str, str],
) -> bool:
    """Ставит входящий лид Авито в стойкую очередь доставки в CRM
    rental-репо (franchize_intents) — план A2: вместо fire-and-forget.

    Идемпотентность по source_key = id события; приёмник дедуплицирует по
    реальному chat_id Авито. False — URL не настроен или дубликат.
    """
    runtime_env = os.environ.copy()
    load_dotenv(SECRETS_FILE, runtime_env)
    if not str(runtime_env.get("AVITO_LEADS_WEBHOOK_URL") or "").strip():
        return False
    value: dict[str, object] = {
        "chat_id": chat_id,
        "type": "text",
        "text": str(text or "")[:4000],
        "item_title": context.get("title") or None,
        "item_url": context.get("url") or None,
        "created": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(last_at)),
    }
    if buyer_id:
        value["buyer_id"] = int(buyer_id)
        value["author_id"] = int(buyer_id)
    body = {
        "id": f"monitor:{profile_key}:{chat_id}:{int(last_at)}",
        "version": "3.0.0",
        "client": {
            "name": context.get("client_name") or None,
            "url": context.get("url") or None,
            "profile": profile_name,
            "category": analysis.get("category") or None,
        },
        "payload": {"type": "message", "value": value},
    }
    inserted = store.enqueue_webhook(
        str(body["id"]),
        json.dumps(body, ensure_ascii=False),
    )
    if inserted:
        logger.info("Лид поставлен в webhook-очередь CRM: %s (%s)", chat_id, profile_name)
    return inserted


def process_webhook_outbox(store: LeadStore) -> tuple[int, int]:
    """Доставка webhook-очереди в CRM. 200 → sent; иначе backoff (15мин×n,
    потолок 6ч, 36 неудач → dead). 503 приёмника означает сбой записи лида —
    ретраим (приёмник carTest отдаёт 503 только для monitor-событий)."""
    runtime_env = os.environ.copy()
    load_dotenv(SECRETS_FILE, runtime_env)
    url = str(runtime_env.get("AVITO_LEADS_WEBHOOK_URL") or "").strip()
    secret = str(runtime_env.get("AVITO_LEADS_WEBHOOK_SECRET") or "").strip()
    if not url:
        return 0, 0
    sent = 0
    failed = 0
    for row in store.pending_webhooks():
        try:
            response = requests.post(
                url,
                params={"secret": secret} if secret else None,
                data=str(row["payload_json"]),
                headers={"Content-Type": "application/json"},
                timeout=8,
            )
            ok = response.status_code == 200
            error = (
                ""
                if ok
                else f"HTTP {response.status_code}: {response.text[:180]}"
            )
        except requests.RequestException as error_type:
            ok, error = False, type(error_type).__name__
        store.finish_webhook(int(row["id"]), ok, error)
        if ok:
            sent += 1
        else:
            failed += 1
            logger.warning("CRM webhook: задача id=%s, %s", row["id"], error)
        time.sleep(0.15)
    if sent or failed:
        logger.info(
            "CRM webhook-доставка: успешно=%s, ошибок=%s", sent, failed
        )
    return sent, failed


def format_notification(
    *,
    profile_name: str,
    context: dict[str, str],
    dialog: list[dict[str, object]],
    analysis: dict[str, str],
    history_error: str,
) -> str:
    recent = []
    for message in dialog[-5:]:
        marker = "Клиент" if message["direction"] == "in" else "Менеджер"
        recent.append(
            f"<b>{marker}:</b> {escape(str(message['text'])[:500])}"
        )
    dialog_text = "\n".join(recent) or "История сообщений недоступна"
    warning = (
        "\n<b>Важно:</b> Avito не отдал полную историю; показано последнее сообщение.\n"
        if history_error
        else ""
    )
    # B5: дайджест фактов из истории — менеджер готов за 5 секунд, клиент
    # не повторяется.
    digest = str(analysis.get("context_digest") or "").strip()
    digest_block = (
        f"\n<b>Контекст:</b>\n{escape(digest)}\n"
        if digest
        else ""
    )
    text = f"""<b>{escape(analysis["category"])}</b>

<b>Профиль:</b> {escape(profile_name)}
<b>Объявление:</b> {escape(context["title"])}
<b>Цена:</b> {escape(context["price"] or "не указана")}
<b>Клиент:</b> {escape(context["client_name"])}
{warning}{digest_block}
<b>Последние сообщения:</b>
{dialog_text}

<b>Рекомендуемый ответ (начинается с эха):</b>
<code>{escape(analysis["reply"])}</code>

<b>Почему:</b> {escape(analysis["reason"] or "по контексту диалога")}

<a href="{html.escape(context["url"], quote=True)}">Открыть объявление</a>"""
    return text[:4050]


def format_reminder(row: object) -> str:
    kind = row["kind"]
    labels = {
        "response": "Просрочен ответ клиенту",
        "follow_up": "Нужно вернуться к лиду",
        "stale": "Лид без ответа 72 часа",
    }
    actions = {
        "response": "Открой диалог и ответь клиенту.",
        "follow_up": "Проверь диалог и отправь уместный follow-up вручную.",
        "stale": "Реши: вернуть лид в работу или закрыть.",
    }
    link = html.escape(str(row["item_url"] or ""), quote=True)
    return f"""<b>Напоминание по Авито: {escape(labels.get(kind, kind))}</b>

<b>Профиль:</b> {escape(row["profile_name"])}
<b>Объявление:</b> {escape(row["item_title"])}
<b>Клиент:</b> {escape(row["client_name"])}
<b>Статус:</b> {escape(row["status"])}

{escape(actions.get(kind, "Проверь диалог."))}

<a href="{link}">Открыть объявление</a>"""


def send_telegram(bot_token: str, chat_id: str, text: str) -> tuple[bool, str]:
    try:
        response = requests.post(
            TELEGRAM_SEND_URL.format(token=bot_token),
            json={
                "chat_id": chat_id,
                "text": text,
                "parse_mode": "HTML",
                "disable_web_page_preview": True,
            },
            timeout=15,
        )
        if not response.ok:
            try:
                description = str(response.json().get("description") or "")
            except (ValueError, AttributeError):
                description = "Telegram API error"
            return False, f"HTTP {response.status_code}: {description[:200]}"
        return True, ""
    except requests.RequestException as error:
        logger.error("Ошибка отправки в Telegram: %s", type(error).__name__)
        return False, type(error).__name__


def process_profile(
    profile_key: str,
    profile: dict,
    state: dict,
    config: dict,
    store: LeadStore,
) -> int:
    logger.info(
        "Обработка профиля %s (user_id=%s)",
        profile["name"],
        profile["user_id"],
    )
    client_id, client_secret = profile_credentials(profile_key, profile)
    if not client_id or not client_secret:
        return 0
    token = get_access_token_cached(profile_key, client_id, client_secret, state)
    if not token:
        return 0

    all_chats = get_chats(token, profile["user_id"], unread_only=False)
    unread_chats = get_chats(token, profile["user_id"], unread_only=True)
    unread_ids = {str(chat.get("id")) for chat in unread_chats}
    logger.info(
        "Чатов в выборке: %s; непрочитанных: %s",
        len(all_chats),
        len(unread_ids),
    )

    notified_count = 0
    placeholder_count = 0
    subscription_degraded_count = 0
    notified_chats = state.setdefault("notified_chats", {})
    _, targets = telegram_runtime(config)

    for chat in all_chats:
        chat_id = str(chat.get("id") or "")
        if not chat_id:
            continue
        context = chat_context(chat, profile["user_id"])
        if not is_relevant_item(context["title"]):
            continue
        last_message = chat.get("last_message") or {}
        if is_api_placeholder(last_message):
            placeholder_count += 1
            continue
        last_at = normalize_epoch(last_message.get("created"))
        direction = str(last_message.get("direction") or "")
        chat_key = f"{profile_key}:{chat_id}"
        legacy_notified = normalize_epoch(notified_chats.get(chat_key, 0))

        lead_id, is_new, previous_at = store.upsert_lead(
            profile_key=profile_key,
            profile_name=profile["name"],
            avito_user_id=int(profile["user_id"]),
            chat_id=chat_id,
            item_title=context["title"],
            item_price=context["price"],
            item_url=context["url"],
            client_name=context["client_name"],
            last_message_at=last_at,
            last_direction=direction,
            legacy_notified_at=legacy_notified,
        )

        changed = last_at > previous_at
        lead = store.get_lead(profile_key, chat_id)
        already_notified = int(lead["notified_message_at"]) if lead else legacy_notified
        should_notify = (
            direction == "in"
            and last_at > already_notified
            and (chat_id in unread_ids or (changed and not is_new))
        )
        needs_history = should_notify or (changed and not is_new)
        messages: list[dict] = []
        history_error = ""
        history_status = 0
        if needs_history:
            messages, history_error, history_status = get_chat_messages(
                token, profile["user_id"], chat_id, limit=10
            )
            if history_status == 402:
                # A3: деградация вместо потери лида — работаем по последнему
                # сообщению из chats-ответа; GLM получает history_complete=false,
                # уведомление идёт с плашкой «история недоступна», CRM-форвард
                # выполняется. Полная история появится после подписки.
                history_error = "Messenger API subscription required (HTTP 402)"
                subscription_degraded_count += 1
                messages = fallback_messages(chat)
            if not messages:
                messages = fallback_messages(chat)
            if history_status != 402:
                store.store_messages(lead_id, messages)
                time.sleep(0.35)

        if (changed and not is_new) or (
            is_new and should_notify
        ):
            store.schedule_for_latest(lead_id, direction, last_at)

        if not should_notify:
            continue

        dialog = compact_dialog(messages or fallback_messages(chat), profile["user_id"])
        # B1-гард токенов: GLM вызывается ровно один раз на сообщение.
        # Если анализ этого сообщения уже сохранён — переиспользуем.
        stored_category = str(lead["category"] or "") if lead else ""
        stored_msg_at = int(lead["analyzed_message_at"] or 0) if lead else 0
        analysis: dict[str, str] | None = None
        if (
            stored_msg_at == last_at
            and stored_category
            and stored_category != "Требует ручного ответа"
        ):
            analysis = {
                "category": stored_category,
                "reply": str(lead["suggested_reply"] or ""),
                "reason": str(lead["agent_reason"] or ""),
                "context_digest": str(lead["context_digest"] or ""),
            }
            logger.info("GLM пропущен: анализ уже сохранён для %s", chat_id)
        if analysis is None:
            analysis = generate_agent_reply(
                profile_name=profile["name"],
                item_title=context["title"],
                item_price=context["price"],
                dialog=dialog,
                history_error=history_error,
            )
            store.update_analysis(
                lead_id,
                analysis["category"],
                analysis["reply"],
                analysis["reason"],
                analyzed_message_at=last_at,
                context_digest=analysis.get("context_digest", ""),
            )
        last_inbound = ""
        for message in reversed(dialog):
            if message.get("direction") == "in":
                last_inbound = str(message.get("text") or "")
                break
        enqueue_lead_webhook(
            store,
            profile_key=profile_key,
            profile_name=profile["name"],
            chat_id=chat_id,
            buyer_id=int(context.get("client_id") or 0),
            last_at=last_at,
            text=last_inbound,
            context=context,
            analysis=analysis,
        )
        notification = format_notification(
            profile_name=profile["name"],
            context=context,
            dialog=dialog,
            analysis=analysis,
            history_error=history_error,
        )
        inserted = store.enqueue_delivery(
            lead_id,
            "new_inbound",
            f"{profile_key}:{chat_id}:{last_at}",
            notification,
            list(targets),
        )
        if targets:
            store.mark_notified(lead_id, last_at)
            notified_chats[chat_key] = last_at
            notified_count += 1
            logger.info(
                "Уведомление поставлено в очередь: %s (%s), адресатов: %s, новых задач: %s",
                chat_id,
                analysis["category"],
                len(targets),
                inserted,
            )
            if notified_count >= NOTIFY_CAP_PER_RUN:
                logger.info(
                    "Лимит уведомлений на прогон (%s) достигнут — остаток на следующие запуски",
                    NOTIFY_CAP_PER_RUN,
                )
                break
        else:
            logger.error("Командные получатели Telegram не настроены")

    if placeholder_count:
        logger.warning(
            "Служебные/API-заглушки исключены: count=%s",
            placeholder_count,
        )
    if subscription_degraded_count:
        logger.warning(
            "История Messenger API недоступна по подписке — лиды обработаны "
            "по последнему сообщению: chats=%s",
            subscription_degraded_count,
        )
    return notified_count


def process_reminders(config: dict, store: LeadStore) -> int:
    _, targets = telegram_runtime(config)
    count = 0
    for row in store.due_reminders():
        text = format_reminder(row)
        inserted = store.enqueue_delivery(
            int(row["id"]),
            "reminder",
            f"reminder:{row['reminder_id']}",
            text,
            list(targets),
        )
        if targets:
            store.finish_reminder(int(row["reminder_id"]), True)
            count += 1
            logger.info(
                "Напоминание поставлено в очередь: lead=%s kind=%s адресатов=%s новых задач=%s",
                row["id"],
                row["kind"],
                len(targets),
                inserted,
            )
        else:
            store.finish_reminder(
                int(row["reminder_id"]),
                False,
                "team recipients are not configured",
            )
    return count


def process_outbox(
    config: dict,
    store: LeadStore,
    state: dict | None = None,
) -> tuple[int, int]:
    token, targets = telegram_runtime(config)
    sent = 0
    failed = 0
    quarantined_now: list[str] = []
    live_quarantine = set(store.quarantined_targets())
    for row in store.pending_outbox():
        target_hash = str(row["target_hash"])
        if target_hash in live_quarantine:
            # Карантин применён в этом же прогоне — остальные задачи адресата
            # пропускаем без попыток; из активной выборки их уберёт JOIN.
            continue
        if not token or target_hash not in targets:
            ok, error = False, "recipient or bot token is not configured"
        else:
            ok, error = send_telegram(token, targets[target_hash], str(row["text"]))
        store.finish_outbox(int(row["id"]), ok, error)
        outcome = store.record_target_result(target_hash, ok, error)
        store.record_delivery(
            int(row["lead_id"]) if row["lead_id"] is not None else None,
            str(row["delivery_type"]),
            f"{row['source_key']}:{target_hash}",
            ok,
            error,
        )
        if outcome == "quarantined":
            live_quarantine.add(target_hash)
            quarantined_now.append(target_hash)
        if ok:
            sent += 1
        else:
            failed += 1
    if quarantined_now or (state is not None and _backlog_alert_due(store, state)):
        send_outbox_alert(config, store, targets, quarantined_now, state)
    if sent or failed or quarantined_now:
        logger.info(
            "Командная Telegram-доставка: успешно=%s, ошибок=%s, карантин=%s",
            sent,
            failed,
            len(quarantined_now),
        )
    healed = probe_quarantined(store, config, targets)
    if healed:
        logger.info("Карантин снят по getChat-пробе: адресатов=%s", healed)
    return sent, failed


def probe_quarantined(store: LeadStore, config: dict, targets: dict[str, str]) -> int:
    """Закарантиненные адресаты не получают попыток доставки, поэтому
    record_target_result(ok) для них недостижим. Раз в прогон проверяем
    getChat: чат появился (например, менеджер нажал /start) — карантин
    снимается, задачи старше 24 часов гасятся как протухшие."""
    token, _ = telegram_runtime(config)
    if not token:
        return 0
    healed = 0
    for target_hash in store.quarantined_targets():
        chat_id = targets.get(target_hash)
        if not chat_id:
            continue
        try:
            response = requests.get(
                f"https://api.telegram.org/bot{token}/getChat",
                params={"chat_id": chat_id},
                timeout=10,
            )
            ok = response.ok and bool(response.json().get("ok"))
        except requests.RequestException:
            continue
        if not ok:
            continue
        store.record_target_result(target_hash, True)
        aged = store.age_out_stale_pending(target_hash, max_age_hours=24)
        logger.info(
            "Адресат вышел из карантина: pending=%s, погашено протухших=%s",
            store.pending_count_for_target(target_hash),
            aged,
        )
        healed += 1
    return healed


def _backlog_alert_due(store: LeadStore, state: dict) -> bool:
    """Не чаще раза в час: активный backlog > 30 сообщений."""
    stats = store.stats()
    if int(stats.get("pending_outbox", 0)) <= 30:
        return False
    last = int(state.get("last_outbox_alert_epoch", 0) or 0)
    if time.time() - last < 3600:
        return False
    state["last_outbox_alert_epoch"] = int(time.time())
    return True


def send_outbox_alert(
    config: dict,
    store: LeadStore,
    targets: dict[str, str],
    quarantined_now: list[str],
    state: dict | None,
) -> None:
    token, _ = telegram_runtime(config)
    if not token:
        return
    quarantined = store.quarantined_targets()
    stats = store.stats()
    lines = [
        "⚠️ Avito monitor: проблемы доставки в Telegram",
        "",
        f"Активный backlog: {stats.get('pending_outbox', 0)}",
        f"В карантине адресатов: {stats.get('quarantined_targets', 0)}",
    ]
    if quarantined_now:
        lines.append(f"Карантин сейчас: {len(quarantined_now)}")
    if quarantined:
        lines.append("")
        lines.append(
            "Часть получателей не получает лидов. Если это твой чат — "
            "нажми /start у бота, карантин снимется автоматически."
        )
    text = "\n".join(lines)[:3500]
    healthy = [targets[h] for h in targets if h not in set(quarantined)]
    delivered = 0
    for chat_id in healthy:
        ok, _ = send_telegram(token, chat_id, text)
        delivered += 1 if ok else 0
    if state is not None and quarantined_now:
        state["last_outbox_alert_epoch"] = int(time.time())
    logger.info(
        "Outbox-алерт отправлен: адресатов=%s, доставлено=%s",
        len(healthy),
        delivered,
    )


def format_sla_report(report: dict) -> str:
    def fmt(section: dict) -> str:
        if section.get("n", 0) == 0:
            return "нет данных"
        return (
            f"медиана {section['median_s']}с · p90 {section['p90_s']}с · "
            f"≤2мин {section['within_2min_pct']}% · ≤5мин {section['within_5min_pct']}% "
            f"(n={section['n']})"
        )

    weekdays = ", ".join(
        f"{key}:{value}"
        for key, value in report.get("by_weekday_first_message_msk", {}).items()
    )
    return (
        f"📊 <b>Avito speed-to-lead за {report['period_days']} дн.</b>\n\n"
        f"<b>Лидов:</b> {report['leads']}\n"
        f"<b>Детекция (сообщение → найдено):</b> {fmt(report['detection'])}\n"
        f"<b>Уведомление (сообщение → команда):</b> {fmt(report['notification'])}\n"
        f"<b>Первые сообщения по дням (МСК):</b> {weekdays or '—'}\n\n"
        "Цель по методологии: ответ клиенту ≤60 сек, обнаружение ≤2 мин."
    )


def send_sla_report(config: dict, store: LeadStore, days: int) -> str:
    """B2: еженедельный отчёт здоровым адресатам (карантинные исключены)."""
    report = store.sla_report(days)
    text = format_sla_report(report)
    token, targets = telegram_runtime(config)
    if not token or not targets:
        return text
    quarantined = set(store.quarantined_targets())
    delivered = 0
    for target_hash, chat_id in targets.items():
        if target_hash in quarantined:
            continue
        ok, _ = send_telegram(token, chat_id, text)
        delivered += 1 if ok else 0
    logger.info(
        "SLA-отчёт отправлен: адресатов=%s, доставлено=%s",
        len(targets) - len(quarantined & set(targets)),
        delivered,
    )
    return text


def agent_health() -> bool:
    result = generate_agent_reply(
        profile_name="Продажа",
        item_title="Тестовый электромотоцикл",
        item_price="",
        dialog=[
            {
                "direction": "in",
                "text": "Можно посмотреть сегодня?",
                "created": int(time.time()),
            }
        ],
    )
    ok = bool(result["reply"]) and result["category"] != "Требует ручного ответа"
    print(
        json.dumps(
            {
                "ok": ok,
                "category": result["category"],
                "reply_length": len(result["reply"]),
            },
            ensure_ascii=False,
        )
    )
    return ok


def monitor_self_test() -> dict:
    assert is_api_placeholder(
        {
            "direction": "in",
            "content": {
                "text": (
                    "Перейдите на подписку с API мессенджера, "
                    "чтобы получить доступ к чатам"
                )
            },
        }
    )
    assert is_api_placeholder({"type": "system", "content": {"text": "service"}})
    assert not is_api_placeholder(
        {"direction": "in", "content": {"text": "Можно арендовать на субботу?"}}
    )
    result = store_self_test()
    result["api_placeholder_filter"] = "ok"
    return result


def run_monitor() -> int:
    with LOCK_FILE.open("w") as lock:
        try:
            fcntl.flock(lock.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            logger.warning("Предыдущий запуск ещё работает; новый запуск пропущен")
            return 0
        logger.info("Запуск мониторинга Avito Messenger")
        config = load_config()
        state = load_state()
        store = LeadStore(DB_FILE)
        notifications = 0
        webhooks_sent = webhooks_failed = 0
        try:
            if should_scan(state):
                for profile_key, profile in (config.get("profiles") or {}).items():
                    try:
                        notifications += process_profile(
                            profile_key, profile, state, config, store
                        )
                    except Exception:
                        logger.exception("Ошибка профиля %s", profile_key)
                state["last_scan_epoch"] = int(time.time())
            else:
                logger.info(
                    "Скан Avito пропущен: интервал %ss не истёк "
                    "(очереди обрабатываются всегда)",
                    scan_interval_seconds(),
                )
            reminders = process_reminders(config, store)
            sent, failed = process_outbox(config, store, state)
            webhooks_sent, webhooks_failed = process_webhook_outbox(store)
            state["last_check"] = int(time.time())
            save_state(state)
            logger.info(
                "Завершено. Новых уведомлений: %s; напоминаний: %s; "
                "Telegram успешно=%s, ошибок=%s; CRM webhook успешно=%s, ошибок=%s; "
                "база: %s",
                notifications,
                reminders,
                sent,
                failed,
                webhooks_sent,
                webhooks_failed,
                store.stats(),
            )
        finally:
            store.close()
    return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--self-test", action="store_true")
    parser.add_argument("--agent-health", action="store_true")
    parser.add_argument("--init-db", action="store_true")
    parser.add_argument(
        "--sla-report",
        type=int,
        metavar="DAYS",
        help="speed-to-lead отчёт за N дней (печать JSON + текст)",
    )
    parser.add_argument(
        "--sla-report-send",
        action="store_true",
        help="SLA-отчёт за 7 дней команде в Telegram",
    )
    args = parser.parse_args()
    if args.self_test:
        print(json.dumps(monitor_self_test(), ensure_ascii=False, sort_keys=True))
        return 0
    if args.agent_health:
        return 0 if agent_health() else 1
    if args.sla_report is not None or args.sla_report_send:
        days = args.sla_report if args.sla_report is not None else 7
        store = LeadStore(DB_FILE)
        try:
            text = (
                send_sla_report(config := load_config(), store, days)
                if args.sla_report_send
                else format_sla_report(store.sla_report(days))
            )
            print(text)
            if args.sla_report is not None:
                print(
                    json.dumps(store.sla_report(days), ensure_ascii=False, sort_keys=True)
                )
        finally:
            store.close()
        return 0
    if args.init_db:
        store = LeadStore(DB_FILE)
        try:
            print(json.dumps(store.stats(), ensure_ascii=False, sort_keys=True))
        finally:
            store.close()
        return 0
    return run_monitor()


if __name__ == "__main__":
    raise SystemExit(main())
