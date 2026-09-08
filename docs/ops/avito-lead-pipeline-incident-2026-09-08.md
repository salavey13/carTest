# Инцидент 2026-09-08: лиды из Авито перестали поступать

## Симптом

Пользователь заметил: «nothing in leads for a whole day». На странице лидов
(`franchize_intents`, канал `avito`) последняя заявка —
**2026-09-05T14:30 UTC** (чат `u2i-gbH0PIx3nV0ycD7U_5Tmdg`, «Олег»,
вопрос про часы работы). После этого — тишина 2,5+ дня, при том что
ручные события в `lead_events` пишутся (note_added 2026-09-08T10:23).

## Что проверено и что доказано (диагностика 2026-09-08)

| Проверка | Результат |
|---|---|
| Последний avito-лид в БД | 2026-09-05 14:30 UTC, `lastEventId=monitor:rental:…` |
| `GET https://rental.vip-bike.ru/api/webhooks/avito` | 200 OK за ~1 с — VPS жив, роут задеплоен |
| `POST {}` на VPS (registration probe) | **401 unauthorized** — на VPS установлен `AVITO_WEBHOOK_SECRET` (ожидаемо) |
| `GET/POST {}` на Vercel (`v0-car-test.vercel.app`) | 200 — секрет НЕ задан, роут принимает |
| **Сквозная проба**: monitor-style событие → Vercel → БД | ✅ лид создался, весь enrichment (client.name/score/category) на месте, удалён после проверки |
| Изменения webhook-роута после 5.09 | 9873b2000 (7.09 17:49) — ПОСЛЕ обрыва; обрыв раньше деплоев |
| `lead_events` | только ручные события → ни одного входящего avito-сообщения после 5.09 |

**Вывод: CRM-приёмник (оба таргета) полностью рабочий. Обрыв — на стороне
VPS-монитора** (`/opt/vip-bike-avito/`, cron каждые 2 мин): сканирование
умерло целиком (монитор же шлёт и Telegram-алерты — если они тоже
прекратились 5.09, это подтверждает).

Типовые причины по коду `avito_monitor.py`:
1. cron не запускается (перезагрузка VPS без cron, съехавший crontab);
2. refresh токена Авито падает (срок client_credentials, смена пароля,
   блокировка приложения) — `get_access_token_cached` возвращает None и
   скан молча пропускается;
3. сеть/изменения API Авито — `get_chats` стабильно ошибается;
4. диск/SQLite (WAL переполнен, права 0600).

## Ранбук восстановления (выполнить на VPS по SSH)

```bash
# 1) Жив ли монитор вообще (лог cron)
tail -n 200 /opt/vip-bike-avito/scripts/cron.log
#   Ожидаем регулярные тики каждые 2 мин. Искать: Traceback, 401/403 от Авито,
#   "token", "Не удалось", GLM-ошибки.

# 2) Жив ли cron
crontab -l | grep avito
systemctl status cron 2>/dev/null || service cron status

# 3) Ручной прогон (самодиагностика)
cd /opt/vip-bike-avito
python3 scripts/avito_monitor.py --self-test     # стор + фильтры
python3 scripts/avito_monitor.py --agent-health  # доступность GLM
python3 scripts/avito_monitor.py --init-db       # схема + статистика

# 4) Токен Авито: не протух ли кэш
python3 - <<'PY'
import json, time
s = json.load(open('/opt/vip-bike-avito/state.json'))
for k, v in (s.get('token_cache') or {}).items():
    print(k, 'expires_at:', time.strftime('%Y-%m-%d %H:%M', time.localtime(v.get('expires_at', 0))))
PY
# Если expires_at в прошлом — монитор не может обновить токен: проверить
# AVITO_CLIENT_ID/SECRET в secrets.env (запрос token вручную):

curl -s -X POST https://api.avito.ru/token \
  -d "grant_type=client_credentials&client_id=$AVITO_CLIENT_ID&client_secret=$AVITO_CLIENT_SECRET" | head -c 300

# 5) Outbox CRM: не копятся ли недоставленные события
sqlite3 /opt/vip-bike-avito/scripts/lead_store.db \
  'select status, count(*) from webhook_outbox group by status;' 2>/dev/null || \
  sqlite3 /opt/vip-bike-avito/scripts/lead_store.db '.tables'
# Если недоставленные копятся — проверить AVITO_LEADS_WEBHOOK_URL/SECRET в
# secrets.env (куда реально стучится монитор) и не quarantined ли таргет.

# 6) После починки: убедиться, что события пошли
# (в CRM появится лид; в lead_events — type=avito_message / lead_created)
```

## Профилактика на будущее (рекомендации)

1. **Официальный webhook Авито — напрямую в CRM** как основной канал:
   подписка одна на аккаунт, последний `register` выигрывает. Сейчас
   всё держится на поллере — единая точка отказа. Зарегистрировать
   `https://rental.vip-bike.ru/api/webhooks/avito?secret=<AVITO_WEBHOOK_SECRET>`
   (`node scripts/avito-webhook-setup.mjs register …`), монитор оставить
   как enrichment/бэкстоп. Помнить: регистрационный POST `{}` Авито обязан
   получать 200 ≤2 с — регистрировать нужно URL с `?secret=…`.
2. Heartbeat: монитор уже пишет cron.log — добавить простую метрику
   (last_scan_at в state.json + TG-алерт, если свежих тиков нет N минут),
   чтобы «умер поллер» обнаруживался часами, а не днями.
