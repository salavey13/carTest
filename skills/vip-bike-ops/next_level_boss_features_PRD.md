# Next-Level Boss Features — PRD

> 5 features that transform the boss from "notification spammer" to "trusted
> co-pilot that respects your attention and actually does work."
>
> Status: Phase 1 (dedup) implemented in _lib.sh. Phases 2-5 are PRD.

---

## Phase 1: State-Aware Alert Dedup ✅ IMPLEMENTED

**What:** `already_alerted` / `record_alert` functions in `_lib.sh`. Uses a JSON state file to track which entities have been alerted about recently.

**How it works:**
```bash
# In overdue-alert.sh:
for rental_id in $OVERDUE_IDS; do
  if ! already_alerted "overdue" "$rental_id" 21600; then  # 6h cooldown
    # ... add to alert message ...
    record_alert "overdue" "$rental_id"
  fi
done
```

**State file:** `/tmp/boss-alerts-state.json` — entries auto-pruned after 48h.

**Next step:** Wire `already_alerted` + `record_alert` into all 4 watchdog scripts (overdue-alert, returns-reminder, qr-claim-watchdog, lead-stuck-watchdog).

---

## Phase 2: Inline Keyboard Actions

**What:** Replace text "Что дальше?" blocks with tappable Telegram inline buttons.

**Implementation:** `send_telegram_keyboard` is already in `_lib.sh`. Usage:
```bash
send_telegram_keyboard "🔴 Просрочен: Falcon PRO" '[
  [{"text":"📞 Позвонить","callback_data":"call:+79991234567"},
   {"text":"💬 TG","url":"https://t.me/username"}],
  [{"text":"✅ Решено","callback_data":"ack:overdue:rental_abc"},
   {"text":"👁 Открыть","url":"https://t.me/oneBikePlsBot/app?startapp=rental_rental_abc"}]
]'
```

**Buttons per alert type:**
| Alert | Buttons |
|---|---|
| Overdue rental | 📞 Позвонить · 💬 Написать · ✅ Решено · 👁 Открыть |
| Return due | 📋 Подготовить · ✅ Принят · 👁 Открыть |
| QR not claimed | 🔄 Переслать QR · ✅ Решено · 👁 Открыть |
| Lead stuck | 📞 Позвонить · 💬 Написать · 🗑 Закрыть · 👁 Открыть |
| Hot lead | 📞 Позвонить · 💬 Написать · 👁 Открыть |
| Revenue anomaly | 📊 Открыть дашборд · 🔍 Детали |

**Requires:** Bot-reply flow (Phase 2 of boss roadmap) to handle `callback_data`.

---

## Phase 3: Boss Brain — Cross-Command Synthesizer

**What:** Instead of 6 independent alerts, ONE daily brief that correlates signals.

**Example morning brief (AI-synthesized):**
```
🌅 Доброе утро, Павел. Вот что важно сегодня:

🔴 КРИТИЧНО (1):
• Falcon PRO просрочен 15 дней — клиент не отвечает 5 дней.
  [📞 Позвонить] [✅ Закрыть] [👁 Открыть]

🟡 ВНИМАНИЕ (3):
• 2 возврата сегодня до 18:00 (BMW F800R, Yamaha R7)
• 1 QR не принят 8 дней (Комков Алексей)
• Выручка вчера -32% от среднего (12к vs 18к среднее)

🟢 ХОРОШО (2):
• 3 новых лида вчера (Рыжаков, Кривенышев, Гусев)
• 2 аренды завершены без проблем

📊 Прогноз на завтра: 35-45к ₽ (2 подтверждённых возврата + 3 активных аренды)

🤖 Я могу: отправить напоминания 3 просроченным клиентам. Разрешить?
```

**How it works:**
1. `boss-brain.sh` runs at 09:00 — calls all 6 watchdogs internally
2. Collects outputs, correlates (e.g., overdue + no contact = critical)
3. Categorizes: 🔴 act now / 🟡 monitor / 🟢 fyi
4. Synthesizes into ONE message with inline keyboards
5. Offers auto-remediation (Phase 5)

**Correlation rules:**
- Overdue + lead_stuck → "Критично: клиент не отвечает + байк просрочен"
- Revenue_anomaly + lead_stuck → "Выручка падает, {N} лидов застряли в воронке"
- Returns_today + active_rentals → "Сегодня {N} возвратов из {M} активных"
- QR_not_claimed + rental_active → "Аренда активна но QR не принят — нет документов"

---

## Phase 4: Predictive Forecasting

**What:** The boss predicts tomorrow before it happens.

**Daily forecast at 08:00:**
```
📊 Прогноз на 27 июля:

💰 Ожидаемая выручка: 35-45к ₽
  • 2 возврата (24к подтверждено)
  • 5 активных аренд продолжаются (~15к/день)
  • 3 новых лида в воронке × 30% конверсия × 12к чек = ~11к

🌡 Погода: +24°C, ясно — хороший день для аренд (+15% к базовому прогнозу)

🔧 Обслуживание:
  • BMW F800R: одометр 1,847 км, сервис на 2,000 км
    При текущем темпе (120 км/день) → сервис через ~1 день

⚠️ Риски:
  • Yamaha R7: возврат завтра, но документов нет → задержка возврата
  • 3 просроченных аренды → нагрузка на оператора
```

**Data sources:**
- Rentals table (active + returns) → revenue forecast
- OpenWeatherMap API → weather factor
- `rentals.metadata.odometer_after` → maintenance prediction
- `franchize_intents` → lead pipeline conversion forecast

**Implementation:** `forecaster.sh` — runs at 08:00, sends ONE message.

---

## Phase 5: Auto-Remediation with Audit Log

**What:** The boss doesn't just notify — it ACTS, then reports.

**Auto-actions (with caps):**
| Trigger | Action | Cap |
|---|---|---|
| Rental overdue > 2h | Send polite reminder to client via Telegram | 5/day |
| QR not claimed > 17h | Resend QR with "need help?" message | 3/day |
| Lead stuck > 72h | Send "can I help?" follow-up to lead | 5/day |
| Rental status = active but end_date < today | Auto-suggest "mark as completed?" to operator | Unlimited |

**Daily summary:**
```
🤖 Я поработал пока ты спал:

✅ Отправил 3 напоминания клиентам:
  • Рудометову (просрочка 2д) — прочитано
  • Алимову (QR 18ч) — доставлено
  • Киргинцеву (follow-up) — прочитано

🔄 Регенерировал 1 QR (Комкову, истёк старый)

📊 Результат:
  • 1 клиент ответил (Рудометов: "верну завтра")
  • 0 QR приняты (ждём)
  • 0 лидов ответили на follow-up

Все действия в логе: /boss-actions
Отменить любое: /undo <action_id>
```

**Audit table:** `boss_actions(id, agent_id, action_type, target_id, payload, outcome, created_at, reversed)`

**Safety:**
- Max 10 client-facing messages per day (configurable)
- Max 3 QR regenerations per day
- Never modify rental status automatically
- Never send messages to operators (only to clients)
- All actions reversible via `/undo`
- Daily cap reset at 00:00 Moscow

---

## Implementation priority

1. ✅ Phase 1 (dedup) — implemented in _lib.sh, needs wiring into watchdogs
2. Phase 3 (boss-brain) — highest impact, replaces 6 messages with 1
3. Phase 2 (inline keyboards) — requires bot-reply flow
4. Phase 5 (auto-remediation) — the "wow" factor, needs audit table
5. Phase 4 (forecasting) — nice-to-have, needs weather API
