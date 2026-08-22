# Response Quality Improvement Proposals

> How to make the boss agent's responses even better for future operator
> questions. Each proposal has: problem, solution, example.

---

## Proposal 1: Streaming partial responses

**Problem:** For composite queries ("что у меня сегодня горит?"), the boss
runs 3 parallel curl calls, waits for ALL to finish, then sends one big
message. If one query is slow (e.g. Supabase under load), the operator waits
in silence for 10+ seconds.

**Solution:** Send partial messages as each query completes.
- Send "🔥 Утренняя сводка загружается..." immediately
- Replace with "📍 Горячие лиды (3): ..." as soon as leads query finishes
- Edit the same message to append "📍 Возвраты сегодня (2): ..." when returns query finishes
- Final edit appends "📍 Просроченные аренды (5): ..."

**Telegram API:** `editMessageText` supports in-place message updates.

**Example:**
```
[09:00:00] 🔥 Утренняя сводка загружается...
[09:00:02] 🔥 Утренняя сводка — 2026-07-24
           📍 Горячие лиды (3):
           • Рудометов — срочность 95
           ...
[09:00:04] (same message, edited to append)
           📍 Возвраты сегодня (2):
           • falcon-pro — до 18:00
           ...
[09:00:06] (final edit)
           📍 Просроченные аренды (5):
           ...
           🌐 Открыть дашборд
```

**Implementation:** Add `stream_telegram(initial_text, updates[])` helper to `_lib.sh` that uses `editMessageText`.

---

## Proposal 2: Inline keyboard for follow-up actions

**Problem:** Every composite answer ends with "Что дальше? 1. ... 2. ..." as
plain text. The operator has to type a response. Friction.

**Solution:** Send an inline keyboard with the suggested actions as buttons.
One tap → action executes.

**Telegram API:** `sendMessage` with `reply_markup.inline_keyboard`.

**Example:**
```
🔥 Утренняя сводка — 2026-07-24

📍 Горячие лиды (3):
• Рудометов — срочность 95
...

[📊 Открыть дашборд] [📞 Позвонить Рудометову] [📱 Написать в TG]
```

**Implementation:**
- Each boss command builds an `inline_keyboard` array based on the data it found
- The buttons use callback_data like `call:lead_<id>` or `tg:lead_<id>`
- A separate `bot-handler.sh` receives callback queries and executes the action

**Phase 2 dependency:** This requires the bot-to-chat-reply flow (Phase 2 of the roadmap).

---

## Proposal 3: Cached lookups for repeated queries

**Problem:** Every time the operator asks "аренды сегодня", the boss hits
Supabase fresh. If they ask 3 times in 5 minutes, that's 3 identical queries.

**Solution:** Add a 60-second cache to `_lib.sh`:
```bash
# Cache key = sha256 of the curl URL
# Cache file = /tmp/boss-cache/<hash>.json
# TTL = 60 seconds (configurable per-query)
```

**Example:**
```bash
# In _lib.sh:
supabase_query() {
  local table="$1"
  local query="$2"
  local profile="${3:-public}"
  local cache_key=$(echo "${table}?${query}?${profile}" | sha256sum | cut -c1-16)
  local cache_file="/tmp/boss-cache/${cache_key}.json"

  # Check cache (60s TTL)
  if [[ -f "$cache_file" ]]; then
    local age=$(( $(date +%s) - $(stat -c %Y "$cache_file") ))
    if [[ $age -lt 60 ]]; then
      cat "$cache_file"
      return
    fi
  fi

  # Cache miss — fetch
  mkdir -p /tmp/boss-cache
  local result=$(curl -s "${URL}/rest/v1/${table}?${query}" ...)
  echo "$result" > "$cache_file"
  echo "$result"
}
```

**Trade-off:** 60s staleness vs. 3x faster responses for repeated queries. Acceptable for operational dashboards.

---

## Proposal 4: Smart disambiguation

**Problem:** When the operator asks "покажи аренду Рудометова", the boss
needs to find the rental. But there might be 3 rentals with "Рудометов" in
the name. The boss currently either picks the first or asks for
clarification.

**Solution:** If 1 match → show it. If 2-5 matches → send a list with
inline buttons. If 6+ → ask for more specific query.

**Example:**
```
Operator: покажи аренду Рудометова

Boss: Найдено 3 аренды с именем "Рудометов":
[1] Рудометов М.С. — Ducati Panigale S — 24.07→25.07 — активна
[2] Рудометов М.С. — Falcon PRO — 20.07→22.07 — завершена
[3] Рудометов А.И. — Falcon Lynx — 18.07→19.07 — отменена

Нажми нужную или уточни:
[1] [2] [3]
```

**Implementation:** Add `disambiguate(matches[], formatter)` helper that sends an inline keyboard.

---

## Proposal 5: Contextual "Что дальше?" suggestions

**Problem:** The current "Что дальше?" suggestions are hardcoded per boss
command. They don't adapt to the actual data.

**Solution:** Generate suggestions based on what was found:
- If there are hot leads with phone → suggest "Позвонить"
- If there are overdue rentals → suggest "Отправить напоминание клиентам"
- If there are unclaimed QRs → suggest "Переслать QR"
- If revenue is below average → suggest "Проверить воронку лидов"

**Example:**
```
🔥 Утренняя сводка — 2026-07-24

📍 Горячие лиды (3):
• Рудометов — срочность 95 — нет контакта 2д
...

Что дальше? (на основе данных выше):
1. 📞 Позвонить Рудометову (лид остывает)
2. 📱 Отправить QR Алимову (ожидает 17ч)
3. ⚠️ Проверить Falcon PRO — просрочен 2д
```

**Implementation:** Each boss command builds suggestions from the query results, not from a hardcoded list.

---

## Proposal 6: Multi-language support

**Problem:** The boss always responds in Russian. If a non-Russian-speaking
investor or partner needs the report, they're stuck.

**Solution:** Detect language from the operator's message and respond in
the same language. Support: RU (default), EN, ES.

**Implementation:**
- Add `detect_lang(text)` helper (simple heuristic: Cyrillic → RU, else EN)
- Add `translate(text, target_lang)` for the response
- Or: maintain parallel templates for each language

**Trade-off:** Translation adds latency + potential inaccuracies. Better to keep RU as default and only translate on explicit request ("включи английский").

---

## Proposal 7: Proactive anomaly explanations

**Problem:** The `revenue-anomaly.sh` boss command alerts when revenue is
below average, but doesn't explain WHY.

**Solution:** When an anomaly is detected, automatically run a diagnostic
query to find the cause:
- Check if lead volume is down (fewer new leads today)
- Check if conversion rate is down (leads not converting)
- Check if average rental value is down (cheaper bikes rented)
- Check if cancellation rate is up (rentals cancelled)

**Example:**
```
📉 Аномалия выручки — 13:00 МСК

Сегодня: 25 000 ₽ (3 сделки)
Среднее (7 дней): 85 000 ₽ (5 сделок)
⚠️ Сегодня на 71% ниже среднего

🔍 Возможные причины (автодиагностика):
• Лидов сегодня: 2 (среднее: 8) — на 75% меньше
• Конверсия: 100% (среднее: 60%) — норма
• Средний чек: 8 333 ₽ (среднее: 17 000 ₽) — на 51% ниже
• Отмен: 0 (среднее: 1) — норма

💡 Главный фактор: мало новых лидов + низкий средний чек
```

**Implementation:** `revenue-anomaly.sh` runs 4 additional diagnostic queries when the anomaly threshold is hit.

---

## Proposal 8: Conversation memory

**Problem:** Every boss command is stateless. If the operator asks "покажи
аренду ABC123" then "кто клиент?" — the boss doesn't remember the previous
context.

**Solution:** Maintain a 5-message conversation history per chat_id:
- Store last 5 (role, text) pairs in `/tmp/boss-memory/<chat_id>.json`
- Include the history in every new request as context
- "кто клиент?" → boss looks at last message → sees "аренда ABC123" →
  queries the rental → returns client info

**Implementation:**
- `save_to_memory(chat_id, role, text)` helper
- `load_memory(chat_id)` returns last 5 messages
- Boss prepends memory to its routing context

**Phase 2 dependency:** Requires the bot-to-chat-reply flow.

---

## Proposal 9: Scheduled report customization

**Problem:** The morning-standup sends the same format every day. Some
operators want more detail, some want less.

**Solution:** Per-chat preferences stored in Supabase:
- `preferences(chat_id, format, detail_level, channels)`
- format: "brief" (one-line per section) / "detailed" (full lists)
- detail_level: "counts_only" / "top_3" / "all"
- channels: which sections to include (leads, returns, overdue, todos)

**Example:**
```
Operator: /set brief counts_only leads,overdue

Boss: Настройки сохранены. Утренняя сводка будет:
- Формат: краткий
- Детализация: только счётчики
- Разделы: лиды, просроченные

Пример:
🔥 Утренняя сводка — 2026-07-24
📍 Горячие лиды: 3
📍 Просроченные аренды: 5
```

**Implementation:** Add `preferences` table + `/set` command handler.

---

## Proposal 10: Voice message support

**Problem:** Operators on the move can't easily type "покажи аренды сегодня".
They'd rather send a voice message.

**Solution:** Bot accepts voice messages → transcribes via Whisper API →
routes as text → responds with text (or voice if operator prefers).

**Implementation:**
- Bot webhook receives voice message → downloads .ogg file
- Calls OpenAI Whisper API (or local whisper.cpp) for transcription
- Routes the transcribed text through the normal boss flow
- (Optional) Responds with voice via `sendVoice` + TTS

**Phase 3+ feature:** Requires Whisper API access + TTS integration.

---

## Summary: Priority + effort matrix

| # | Proposal | Impact | Effort | Phase |
|---|---|---|---|---|
| 1 | Streaming partial responses | High | Medium | Phase 1.5 |
| 2 | Inline keyboard follow-ups | High | Medium | Phase 2 |
| 3 | Cached lookups (60s TTL) | Medium | Low | Phase 1.5 |
| 4 | Smart disambiguation | Medium | Low | Phase 2 |
| 5 | Contextual "Что дальше?" | High | Low | Phase 1.5 |
| 6 | Multi-language support | Low | Medium | Phase 3+ |
| 7 | Proactive anomaly explanations | High | Medium | Phase 1.5 |
| 8 | Conversation memory | High | Medium | Phase 2 |
| 9 | Scheduled report customization | Medium | Medium | Phase 2 |
| 10 | Voice message support | Medium | High | Phase 3+ |

**Quick wins (Phase 1.5, low effort):** #3 (cache), #5 (contextual suggestions), #7 (anomaly explanations).

**High-impact Phase 2:** #1 (streaming), #2 (inline keyboards), #8 (memory).
