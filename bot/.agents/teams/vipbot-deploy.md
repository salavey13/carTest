# Team: vipbot-deploy (Шаг 6 PLAN — отдельная сессия)

## Цель
Поднять бот на VPS оператора VIP BIKE: bootstrap, рендер `CLAUDE.md`+`reference/`, systemd, проверка `/start` и флоу договоров. Запускать ТОЛЬКО когда есть боевые токены/реквизиты.

## Состав
- `vps-bootstrap` (sonnet) — `scripts/bootstrap-vps.sh <ssh>` + рендер `CLAUDE.md` из `workspace/CLAUDE.template.md` (sed-плейсхолдеры) + `reference/`.
- `tester` (sonnet) — smoke: `/start` отвечает, тест-договор end-to-end (фото→.docx) на VPS.
- `healthcheck-dev` (sonnet) — systemd active, логи чистые, рестарт-политика.

## Предусловия (от пользователя — {{уточнить}})
`TELEGRAM_BOT_TOKEN` + telegram_id операторов; `Z_AI_API_KEY`+модель; реквизиты `lessor`; тарифы; per-unit `bike_units`; VPS (SSH/ОС/домен); LibreOffice — только если нужен PDF. ⛔ Postgres НЕ нужен (SQLite-файл едет с тенантом).

## Gate
1. `systemctl is-active claudeclaw-vip-bike` = active.
2. `/start` в Telegram → welcome.
3. Тест-договор: оператор шлёт фото → бот возвращает `.docx`; запись в SQLite на VPS; `workspace/uploads/` очищен.
4. Плейсхолдеров `{{` в `CLAUDE.md`/`reference/` на VPS = 0.

## Артефакты
- `tenants/vip-bike/tenant.yaml` (+ `.env` вручную), отрендеренный `/opt/.../CLAUDE.md`, systemd-unit.
- Запись в `progress.md`.
