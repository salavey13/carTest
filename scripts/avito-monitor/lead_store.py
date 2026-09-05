#!/usr/bin/env python3
"""SQLite storage and reminder scheduling for Avito leads."""

from __future__ import annotations

import hashlib
import json
import os
import sqlite3
import tempfile
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo


MOSCOW = ZoneInfo("Europe/Moscow")
UTC = timezone.utc


def normalize_epoch(value: object) -> int:
    try:
        epoch = int(value or 0)
    except (TypeError, ValueError):
        return 0
    if epoch > 10_000_000_000:
        epoch //= 1000
    return epoch


def iso_utc(epoch: int | None = None) -> str:
    value = normalize_epoch(epoch) if epoch is not None else int(time.time())
    return datetime.fromtimestamp(value, UTC).replace(microsecond=0).isoformat()


def reminder_due(epoch: int, delay: timedelta) -> int:
    due = datetime.fromtimestamp(normalize_epoch(epoch), UTC).astimezone(MOSCOW) + delay
    if due.hour >= 20:
        due = (due + timedelta(days=1)).replace(
            hour=10, minute=0, second=0, microsecond=0
        )
    elif due.hour < 10:
        due = due.replace(hour=10, minute=0, second=0, microsecond=0)
    return int(due.astimezone(UTC).timestamp())


class LeadStore:
    def __init__(self, path: str | Path):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.conn = sqlite3.connect(self.path)
        self.conn.row_factory = sqlite3.Row
        self.conn.execute("PRAGMA journal_mode=WAL")
        self.conn.execute("PRAGMA foreign_keys=ON")
        self.migrate()
        # B1: отметка «анализ GLM уже сделан для этого сообщения» —
        # экономия токенов на повторных прогонах.
        try:
            self.conn.execute(
                "ALTER TABLE leads ADD COLUMN analyzed_message_at INTEGER NOT NULL DEFAULT 0"
            )
        except sqlite3.OperationalError:
            pass  # колонка уже существует
        self.conn.commit()
        os.chmod(self.path, 0o600)

    def close(self) -> None:
        self.conn.close()

    def migrate(self) -> None:
        self.conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS leads (
                id INTEGER PRIMARY KEY,
                profile_key TEXT NOT NULL,
                profile_name TEXT NOT NULL,
                avito_user_id INTEGER NOT NULL,
                chat_id TEXT NOT NULL,
                item_title TEXT NOT NULL DEFAULT '',
                item_price TEXT NOT NULL DEFAULT '',
                item_url TEXT NOT NULL DEFAULT '',
                client_name TEXT NOT NULL DEFAULT '',
                status TEXT NOT NULL DEFAULT 'new',
                category TEXT NOT NULL DEFAULT '',
                suggested_reply TEXT NOT NULL DEFAULT '',
                agent_reason TEXT NOT NULL DEFAULT '',
                last_message_at INTEGER NOT NULL DEFAULT 0,
                last_direction TEXT NOT NULL DEFAULT '',
                last_inbound_at INTEGER NOT NULL DEFAULT 0,
                last_outbound_at INTEGER NOT NULL DEFAULT 0,
                notified_message_at INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                UNIQUE(profile_key, chat_id)
            );

            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY,
                lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
                avito_message_id TEXT NOT NULL,
                direction TEXT NOT NULL DEFAULT '',
                author_id TEXT NOT NULL DEFAULT '',
                message_type TEXT NOT NULL DEFAULT '',
                text TEXT NOT NULL DEFAULT '',
                created_at INTEGER NOT NULL DEFAULT 0,
                stored_at TEXT NOT NULL,
                UNIQUE(lead_id, avito_message_id)
            );

            CREATE TABLE IF NOT EXISTS reminders (
                id INTEGER PRIMARY KEY,
                lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
                kind TEXT NOT NULL,
                based_on_message_at INTEGER NOT NULL,
                due_at INTEGER NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                attempts INTEGER NOT NULL DEFAULT 0,
                last_error TEXT NOT NULL DEFAULT '',
                delivered_at TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                UNIQUE(lead_id, kind, based_on_message_at)
            );

            CREATE TABLE IF NOT EXISTS deliveries (
                id INTEGER PRIMARY KEY,
                lead_id INTEGER REFERENCES leads(id) ON DELETE SET NULL,
                delivery_type TEXT NOT NULL,
                source_key TEXT NOT NULL,
                status TEXT NOT NULL,
                error TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL,
                UNIQUE(delivery_type, source_key)
            );

            CREATE TABLE IF NOT EXISTS delivery_outbox (
                id INTEGER PRIMARY KEY,
                lead_id INTEGER REFERENCES leads(id) ON DELETE SET NULL,
                delivery_type TEXT NOT NULL,
                source_key TEXT NOT NULL,
                target_hash TEXT NOT NULL,
                text TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                attempts INTEGER NOT NULL DEFAULT 0,
                next_attempt_at INTEGER NOT NULL DEFAULT 0,
                last_error TEXT NOT NULL DEFAULT '',
                sent_at TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                UNIQUE(delivery_type, source_key, target_hash)
            );

            CREATE INDEX IF NOT EXISTS idx_reminders_due
                ON reminders(status, due_at);
            CREATE INDEX IF NOT EXISTS idx_messages_lead_created
                ON messages(lead_id, created_at);
            CREATE INDEX IF NOT EXISTS idx_delivery_outbox_pending
                ON delivery_outbox(status, next_attempt_at);

            CREATE TABLE IF NOT EXISTS target_health (
                target_hash TEXT PRIMARY KEY,
                fail_count INTEGER NOT NULL DEFAULT 0,
                quarantined_at INTEGER,
                quarantine_reason TEXT NOT NULL DEFAULT '',
                last_error TEXT NOT NULL DEFAULT '',
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS webhook_outbox (
                id INTEGER PRIMARY KEY,
                source_key TEXT NOT NULL UNIQUE,
                payload_json TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                attempts INTEGER NOT NULL DEFAULT 0,
                next_attempt_at INTEGER NOT NULL DEFAULT 0,
                last_error TEXT NOT NULL DEFAULT '',
                sent_at TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_webhook_outbox_pending
                ON webhook_outbox(status, next_attempt_at);
            """
        )
        self.conn.commit()

    def get_lead(self, profile_key: str, chat_id: str) -> sqlite3.Row | None:
        return self.conn.execute(
            "SELECT * FROM leads WHERE profile_key=? AND chat_id=?",
            (profile_key, chat_id),
        ).fetchone()

    def upsert_lead(
        self,
        *,
        profile_key: str,
        profile_name: str,
        avito_user_id: int,
        chat_id: str,
        item_title: str,
        item_price: str,
        item_url: str,
        client_name: str,
        last_message_at: int,
        last_direction: str,
        legacy_notified_at: int = 0,
    ) -> tuple[int, bool, int]:
        existing = self.get_lead(profile_key, chat_id)
        now = iso_utc()
        epoch = normalize_epoch(last_message_at)
        direction = last_direction or ""
        if existing is None:
            inbound = epoch if direction == "in" else 0
            outbound = epoch if direction == "out" else 0
            cursor = self.conn.execute(
                """
                INSERT INTO leads (
                    profile_key, profile_name, avito_user_id, chat_id,
                    item_title, item_price, item_url, client_name,
                    last_message_at, last_direction, last_inbound_at,
                    last_outbound_at, notified_message_at, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    profile_key,
                    profile_name,
                    avito_user_id,
                    chat_id,
                    item_title,
                    item_price,
                    item_url,
                    client_name,
                    epoch,
                    direction,
                    inbound,
                    outbound,
                    normalize_epoch(legacy_notified_at),
                    now,
                    now,
                ),
            )
            lead_id = int(cursor.lastrowid)
            previous_epoch = 0
            is_new = True
        else:
            lead_id = int(existing["id"])
            previous_epoch = int(existing["last_message_at"])
            inbound = max(
                int(existing["last_inbound_at"]),
                epoch if direction == "in" else 0,
            )
            outbound = max(
                int(existing["last_outbound_at"]),
                epoch if direction == "out" else 0,
            )
            notified = max(
                int(existing["notified_message_at"]),
                normalize_epoch(legacy_notified_at),
            )
            self.conn.execute(
                """
                UPDATE leads SET
                    profile_name=?, avito_user_id=?, item_title=?, item_price=?,
                    item_url=?, client_name=?, last_message_at=?,
                    last_direction=?, last_inbound_at=?, last_outbound_at=?,
                    notified_message_at=?, updated_at=?
                WHERE id=?
                """,
                (
                    profile_name,
                    avito_user_id,
                    item_title,
                    item_price,
                    item_url,
                    client_name,
                    max(previous_epoch, epoch),
                    direction if epoch >= previous_epoch else existing["last_direction"],
                    inbound,
                    outbound,
                    notified,
                    now,
                    lead_id,
                ),
            )
            is_new = False
        self.conn.commit()
        return lead_id, is_new, previous_epoch

    def store_messages(self, lead_id: int, messages: list[dict]) -> None:
        stored_at = iso_utc()
        for index, message in enumerate(messages):
            created = normalize_epoch(message.get("created", 0))
            message_id = str(
                message.get("id")
                or f"fallback:{created}:{message.get('direction', '')}:{index}"
            )
            content = message.get("content") or {}
            self.conn.execute(
                """
                INSERT OR IGNORE INTO messages (
                    lead_id, avito_message_id, direction, author_id,
                    message_type, text, created_at, stored_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    lead_id,
                    message_id,
                    str(message.get("direction", "")),
                    str(message.get("author_id", "")),
                    str(message.get("type", "")),
                    str(content.get("text", "")),
                    created,
                    stored_at,
                ),
            )
        self.conn.commit()

    def update_analysis(
        self,
        lead_id: int,
        category: str,
        reply: str,
        reason: str,
        analyzed_message_at: int = 0,
    ) -> None:
        self.conn.execute(
            """
            UPDATE leads SET category=?, suggested_reply=?, agent_reason=?,
                analyzed_message_at=?, updated_at=? WHERE id=?
            """,
            (category, reply, reason, normalize_epoch(analyzed_message_at),
             iso_utc(), lead_id),
        )
        self.conn.commit()

    def mark_notified(self, lead_id: int, message_at: int) -> None:
        self.conn.execute(
            """
            UPDATE leads SET notified_message_at=?, updated_at=? WHERE id=?
            """,
            (normalize_epoch(message_at), iso_utc(), lead_id),
        )
        self.conn.commit()

    def cancel_pending(self, lead_id: int, except_kind: str = "") -> None:
        query = """
            UPDATE reminders SET status='cancelled', updated_at=?
            WHERE lead_id=? AND status='pending'
        """
        params: list[object] = [iso_utc(), lead_id]
        if except_kind:
            query += " AND kind<>?"
            params.append(except_kind)
        self.conn.execute(query, params)
        self.conn.commit()

    def schedule_for_latest(
        self, lead_id: int, direction: str, message_at: int
    ) -> None:
        epoch = normalize_epoch(message_at)
        if not epoch or direction not in {"in", "out"}:
            return
        now = iso_utc()
        self.cancel_pending(lead_id)
        schedules: list[tuple[str, int]] = []
        if direction == "in":
            schedules.append(("response", reminder_due(epoch, timedelta(minutes=15))))
        else:
            schedules.extend(
                [
                    ("follow_up", reminder_due(epoch, timedelta(hours=24))),
                    ("stale", reminder_due(epoch, timedelta(hours=72))),
                ]
            )
        for kind, due_at in schedules:
            self.conn.execute(
                """
                INSERT OR IGNORE INTO reminders (
                    lead_id, kind, based_on_message_at, due_at,
                    status, created_at, updated_at
                ) VALUES (?, ?, ?, ?, 'pending', ?, ?)
                """,
                (lead_id, kind, epoch, due_at, now, now),
            )
        self.conn.commit()

    def due_reminders(self, now_epoch: int | None = None) -> list[sqlite3.Row]:
        now_value = normalize_epoch(now_epoch) if now_epoch is not None else int(time.time())
        return self.conn.execute(
            """
            SELECT
                r.id AS reminder_id, r.kind, r.due_at, r.attempts,
                l.*
            FROM reminders r
            JOIN leads l ON l.id=r.lead_id
            WHERE r.status='pending' AND r.due_at<=?
            ORDER BY r.due_at, r.id
            """,
            (now_value,),
        ).fetchall()

    def finish_reminder(self, reminder_id: int, ok: bool, error: str = "") -> None:
        now = iso_utc()
        if ok:
            self.conn.execute(
                """
                UPDATE reminders SET status='delivered', attempts=attempts+1,
                    delivered_at=?, last_error='', updated_at=? WHERE id=?
                """,
                (now, now, reminder_id),
            )
        else:
            self.conn.execute(
                """
                UPDATE reminders SET attempts=attempts+1, last_error=?,
                    due_at=due_at+900, updated_at=? WHERE id=?
                """,
                (error[:500], now, reminder_id),
            )
        self.conn.commit()

    def record_delivery(
        self,
        lead_id: int | None,
        delivery_type: str,
        source_key: str,
        ok: bool,
        error: str = "",
    ) -> None:
        self.conn.execute(
            """
            INSERT OR REPLACE INTO deliveries (
                lead_id, delivery_type, source_key, status, error, created_at
            ) VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                lead_id,
                delivery_type,
                source_key,
                "sent" if ok else "failed",
                error[:500],
                iso_utc(),
            ),
        )
        self.conn.commit()

    def enqueue_delivery(
        self,
        lead_id: int | None,
        delivery_type: str,
        source_key: str,
        text: str,
        target_hashes: list[str],
    ) -> int:
        now = iso_utc()
        inserted = 0
        for target_hash in target_hashes:
            cursor = self.conn.execute(
                """
                INSERT OR IGNORE INTO delivery_outbox (
                    lead_id, delivery_type, source_key, target_hash, text,
                    status, next_attempt_at, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, 'pending', 0, ?, ?)
                """,
                (
                    lead_id,
                    delivery_type,
                    source_key,
                    target_hash,
                    text,
                    now,
                    now,
                ),
            )
            inserted += int(cursor.rowcount > 0)
        self.conn.commit()
        return inserted

    def pending_outbox(self, now_epoch: int | None = None) -> list[sqlite3.Row]:
        now_value = normalize_epoch(now_epoch) if now_epoch is not None else int(time.time())
        return self.conn.execute(
            """
            SELECT o.* FROM delivery_outbox o
            LEFT JOIN target_health h ON h.target_hash=o.target_hash
            WHERE o.status='pending' AND o.next_attempt_at<=?
              AND h.quarantined_at IS NULL
            ORDER BY o.id
            """,
            (now_value,),
        ).fetchall()

    def finish_outbox(self, outbox_id: int, ok: bool, error: str = "") -> None:
        now = iso_utc()
        if ok:
            self.conn.execute(
                """
                UPDATE delivery_outbox SET status='sent', attempts=attempts+1,
                    last_error='', sent_at=?, updated_at=? WHERE id=?
                """,
                (now, now, outbox_id),
            )
        else:
            self.conn.execute(
                """
                UPDATE delivery_outbox SET attempts=attempts+1, last_error=?,
                    next_attempt_at=?, updated_at=? WHERE id=?
                """,
                (error[:500], int(time.time()) + 900, now, outbox_id),
            )
        self.conn.commit()

    # Адресаты Telegram: карантин и восстановление (A1 плана 2026-09-05).

    @staticmethod
    def target_error_is_fatal(error: str) -> bool:
        markers = (
            "chat not found",
            "bot was blocked",
            "bot was kicked",
            "chat not participant",
            "user is deactivated",
            "group chat was migrated",
            "upgraded to a supergroup",
        )
        value = str(error or "").lower()
        return any(marker in value for marker in markers)

    def record_target_result(self, target_hash: str, ok: bool, error: str = "") -> str:
        """Учёт результата доставки адресату.

        Возвращает 'ok' | 'fail' | 'quarantined'. Фатальные ошибки Telegram
        (чат не найден, бот заблокирован) карантинят сразу; транспортные —
        после 8 неудач подряд. Успех снимает карантин (самовосстановление
        после /start у бота).
        """
        now = iso_utc()
        value = str(error or "")
        if ok:
            self.conn.execute(
                """
                INSERT INTO target_health
                    (target_hash, fail_count, quarantined_at, quarantine_reason,
                     last_error, updated_at)
                VALUES (?, 0, NULL, '', '', ?)
                ON CONFLICT(target_hash) DO UPDATE SET
                    fail_count=0, quarantined_at=NULL, quarantine_reason='',
                    last_error='', updated_at=excluded.updated_at
                """,
                (target_hash, now),
            )
            self.conn.commit()
            return "ok"
        if self.target_error_is_fatal(value):
            reason = "fatal: " + value[:200]
        else:
            self.conn.execute(
                """
                INSERT INTO target_health
                    (target_hash, fail_count, last_error, updated_at)
                VALUES (?, 1, ?, ?)
                ON CONFLICT(target_hash) DO UPDATE SET
                    fail_count=fail_count+1, last_error=excluded.last_error,
                    updated_at=excluded.updated_at
                """,
                (target_hash, value[:200], now),
            )
            row = self.conn.execute(
                "SELECT fail_count FROM target_health WHERE target_hash=?",
                (target_hash,),
            ).fetchone()
            if int(row["fail_count"] if row else 0) < 8:
                self.conn.commit()
                return "fail"
            reason = f"transport x{row['fail_count']}: {value[:160]}"
        self.conn.execute(
            """
            INSERT INTO target_health
                (target_hash, fail_count, quarantined_at, quarantine_reason,
                 last_error, updated_at)
            VALUES (?, 0, ?, ?, ?, ?)
            ON CONFLICT(target_hash) DO UPDATE SET
                quarantined_at=excluded.quarantined_at,
                quarantine_reason=excluded.quarantine_reason,
                updated_at=excluded.updated_at
            """,
            (target_hash, int(time.time()), reason, value[:200], now),
        )
        self.conn.commit()
        return "quarantined"

    def quarantined_targets(self) -> list[str]:
        return [
            str(row["target_hash"])
            for row in self.conn.execute(
                "SELECT target_hash FROM target_health WHERE quarantined_at IS NOT NULL"
            )
        ]

    def pending_count_for_target(self, target_hash: str) -> int:
        row = self.conn.execute(
            "SELECT COUNT(*) AS n FROM delivery_outbox"
            " WHERE target_hash=? AND status='pending'",
            (target_hash,),
        ).fetchone()
        return int(row["n"] if row else 0)

    def age_out_stale_pending(self, target_hash: str, max_age_hours: int = 24) -> int:
        """After quarantine clears, drop pending rows stuck longer than the
        window — reviving a chat must not replay days-old notifications."""
        cutoff = int(time.time()) - max_age_hours * 3600
        cursor = self.conn.execute(
            """
            UPDATE delivery_outbox SET status='dead',
                last_error='stale: pending during target quarantine >'
                           || ? || 'h',
                updated_at=?
            WHERE target_hash=? AND status='pending' AND next_attempt_at<?
            """,
            (max_age_hours, iso_utc(), target_hash, cutoff),
        )
        self.conn.commit()
        return cursor.rowcount

    # CRM webhook-outbox (A2 плана 2026-09-05): доставка лидов в rental CRM
    # через стойкую очередь вместо fire-and-forget.

    def enqueue_webhook(self, source_key: str, payload_json: str) -> bool:
        """True — новая задача; False — дубликат (idempotency по source_key)."""
        now = iso_utc()
        cursor = self.conn.execute(
            """
            INSERT OR IGNORE INTO webhook_outbox
                (source_key, payload_json, created_at, updated_at)
            VALUES (?, ?, ?, ?)
            """,
            (source_key, payload_json, now, now),
        )
        self.conn.commit()
        return cursor.rowcount > 0

    def pending_webhooks(self) -> list[sqlite3.Row]:
        return self.conn.execute(
            """
            SELECT * FROM webhook_outbox
            WHERE status='pending' AND next_attempt_at<=?
            ORDER BY id
            """,
            (int(time.time()),),
        ).fetchall()

    def finish_webhook(self, webhook_id: int, ok: bool, error: str = "") -> None:
        """Успех → sent; неудача → backoff 15мин×попытка (потолок 6ч),
        после 36 неудач (~двое суток) → dead."""
        now = iso_utc()
        if ok:
            self.conn.execute(
                """
                UPDATE webhook_outbox SET status='sent', attempts=attempts+1,
                    last_error='', sent_at=?, updated_at=? WHERE id=?
                """,
                (now, now, webhook_id),
            )
        else:
            row = self.conn.execute(
                "SELECT attempts FROM webhook_outbox WHERE id=?", (webhook_id,)
            ).fetchone()
            attempts = int(row["attempts"] if row else 0) + 1
            if attempts >= 36:
                self.conn.execute(
                    """
                    UPDATE webhook_outbox SET status='dead', attempts=?,
                        last_error=?, updated_at=? WHERE id=?
                    """,
                    (attempts, error[:500], now, webhook_id),
                )
            else:
                delay = min(900 * attempts, 21600)
                self.conn.execute(
                    """
                    UPDATE webhook_outbox SET attempts=?, last_error=?,
                        next_attempt_at=?, updated_at=? WHERE id=?
                    """,
                    (attempts, error[:500], int(time.time()) + delay, now, webhook_id),
                )
        self.conn.commit()

    def stats(self) -> dict[str, int]:
        result: dict[str, int] = {}
        for name, query in {
            "leads": "SELECT COUNT(*) FROM leads",
            "messages": "SELECT COUNT(*) FROM messages",
            "pending_reminders": (
                "SELECT COUNT(*) FROM reminders WHERE status='pending'"
            ),
            "delivered_reminders": (
                "SELECT COUNT(*) FROM reminders WHERE status='delivered'"
            ),
            "pending_outbox": (
                "SELECT COUNT(*) FROM delivery_outbox o"
                " LEFT JOIN target_health h ON h.target_hash=o.target_hash"
                " WHERE o.status='pending' AND h.quarantined_at IS NULL"
            ),
            "sent_outbox": (
                "SELECT COUNT(*) FROM delivery_outbox WHERE status='sent'"
            ),
            "quarantined_targets": (
                "SELECT COUNT(*) FROM target_health WHERE quarantined_at IS NOT NULL"
            ),
            "pending_outbox_quarantined": (
                "SELECT COUNT(*) FROM delivery_outbox o"
                " JOIN target_health h ON h.target_hash=o.target_hash"
                " WHERE o.status='pending' AND h.quarantined_at IS NOT NULL"
            ),
            "pending_webhooks": (
                "SELECT COUNT(*) FROM webhook_outbox WHERE status='pending'"
            ),
            "sent_webhooks": (
                "SELECT COUNT(*) FROM webhook_outbox WHERE status='sent'"
            ),
            "dead_webhooks": (
                "SELECT COUNT(*) FROM webhook_outbox WHERE status='dead'"
            ),
        }.items():
            result[name] = int(self.conn.execute(query).fetchone()[0])
        return result


def self_test() -> dict[str, int]:
    with tempfile.TemporaryDirectory() as directory:
        store = LeadStore(Path(directory) / "test.db")
        lead_id, is_new, previous = store.upsert_lead(
            profile_key="sale",
            profile_name="Продажа",
            avito_user_id=1,
            chat_id="test-chat",
            item_title="Test bike",
            item_price="",
            item_url="",
            client_name="Test",
            last_message_at=1_800_000_000,
            last_direction="in",
        )
        assert is_new and previous == 0
        store.store_messages(
            lead_id,
            [
                {
                    "id": "m1",
                    "direction": "in",
                    "content": {"text": "Есть в наличии?"},
                    "created": 1_800_000_000,
                }
            ],
        )
        store.schedule_for_latest(lead_id, "in", 1_800_000_000)
        assert store.stats()["pending_reminders"] == 1
        store.schedule_for_latest(lead_id, "out", 1_800_000_100)
        assert store.stats()["pending_reminders"] == 2
        store.update_analysis(lead_id, "Тест", "ответ", "причина", 1_800_000_000)
        row = store.conn.execute(
            "SELECT analyzed_message_at FROM leads WHERE id=?", (lead_id,)
        ).fetchone()
        assert int(row["analyzed_message_at"]) == 1_800_000_000
        store.enqueue_delivery(
            lead_id,
            "test",
            "source-1",
            "test message",
            ["target-a", "target-b"],
        )
        assert store.stats()["pending_outbox"] == 2
        first_outbox = store.pending_outbox()[0]
        store.finish_outbox(int(first_outbox["id"]), True)
        assert store.stats()["sent_outbox"] == 1
        # Карантин: фатальная ошибка одного адресата исключает его задачи.
        # В проде enqueue получает уже хэшированные ключи из telegram_runtime.
        dead_hash = hashlib.sha256(b"target-dead").hexdigest()[:16]
        store.enqueue_delivery(
            lead_id,
            "test",
            "source-2",
            "dead target message",
            [dead_hash],
        )
        dead_row = [
            row
            for row in store.pending_outbox()
            if str(row["source_key"]) == "source-2"
        ][0]
        assert str(dead_row["target_hash"]) == dead_hash
        assert (
            store.record_target_result(
                str(dead_row["target_hash"]), False, "HTTP 400: Bad Request: chat not found"
            )
            == "quarantined"
        )
        assert not [
            row
            for row in store.pending_outbox()
            if str(row["source_key"]) == "source-2"
        ]
        assert store.stats()["quarantined_targets"] == 1
        assert store.stats()["pending_outbox_quarantined"] == 1
        # Самовосстановление: успех снимает карантин.
        assert store.record_target_result(str(dead_row["target_hash"]), True) == "ok"
        assert (
            len(
                [
                    row
                    for row in store.pending_outbox()
                    if str(row["source_key"]) == "source-2"
                ]
            )
            == 1
        )
        # CRM webhook-outbox: idempotency, backoff, успех.
        assert store.enqueue_webhook("monitor:sale:c1:111", "{}") is True
        assert store.enqueue_webhook("monitor:sale:c1:111", "{}") is False
        hook = store.pending_webhooks()[0]
        store.finish_webhook(int(hook["id"]), False, "HTTP 503")
        stored = store.conn.execute(
            "SELECT * FROM webhook_outbox WHERE source_key=?",
            ("monitor:sale:c1:111",),
        ).fetchone()
        assert stored["status"] == "pending" and int(stored["attempts"]) == 1
        assert int(stored["next_attempt_at"]) > int(time.time())
        store.conn.execute(
            "UPDATE webhook_outbox SET next_attempt_at=0 WHERE id=?",
            (int(stored["id"]),),
        )
        store.conn.commit()
        again = store.pending_webhooks()[0]
        store.finish_webhook(int(again["id"]), True)
        assert store.pending_webhooks() == []
        assert store.stats()["sent_webhooks"] == 1
        assert store.stats()["quarantined_targets"] == 0
        stats = store.stats()
        store.close()
        return stats


if __name__ == "__main__":
    print(json.dumps(self_test(), ensure_ascii=False, sort_keys=True))
