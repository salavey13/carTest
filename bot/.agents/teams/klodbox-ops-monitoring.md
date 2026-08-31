# Team: klodbox-ops-monitoring (M6) — постоянная

## Цель
Регулярный мониторинг всех клиентских ботов с локальной машины Олега.

## Состав
- `healthcheck-dev` (sonnet) — `ops/monitoring/healthcheck.sh`
- `log-collector-dev` (sonnet) — `ops/monitoring/log-collector.sh`
- `dashboard-dev` (sonnet) — `ops/monitoring/metrics.sh` + `dashboard.sh`

## Порядок
Все 3 параллельно — независимые скрипты.

## Gate
1. `healthcheck.sh` — обходит все `tenants/*/tenant.yaml`, SSH → проверка `systemctl is-active claudeclaw`, exit code + краткий отчёт в stdout
2. `log-collector.sh` — rsync `/var/log/claudeclaw.log` + `errors.log` → `ops/logs/<tenant>/`, ротация локально
3. `metrics.sh` — собирает RAM/CPU/disk/uptime per tenant
4. `dashboard.sh` — собирает всё в `ops/reports/latest.md` (markdown-таблица)
5. cron-конфиг в `ops/monitoring/crontab.example` готов
6. Все скрипты — `set -euo pipefail`, обрабатывают недоступный VPS gracefully

## Артефакты
- `ops/monitoring/healthcheck.sh`
- `ops/monitoring/log-collector.sh`
- `ops/monitoring/metrics.sh`
- `ops/monitoring/dashboard.sh`
- `ops/monitoring/crontab.example`
- Запись в progress.md
- CHANGELOG v0.6.0
