# Team: klodbox-ops-fixer (M7) — постоянная

## Цель
Auto-fix через compromise: агент анализирует свежие логи → находит известную ошибку → готовит патч → шлёт Олегу в TG → апрув → применение.

## Состав
- `error-watcher` (sonnet) — анализатор логов, диагноз
- `patcher` (sonnet) — генератор патчей + отправка в TG owner
- `known-issues-curator` (sonnet) — поддержка базы `ops/auto-fix/known-issues.md`

## Порядок
1. error-watcher разрабатывается первым (читает `ops/logs/<tenant>/*.log`, классифицирует)
2. patcher после — пишет diff, шлёт через Telegram Bot API
3. known-issues-curator — наполняет базу типовых ошибок из существующих memory-файлов

## Gate
1. error-watcher агент-промпт готов в `ops/auto-fix/error-watcher-agent.md`
2. patcher агент-промпт + механизм отправки `notify-owner.sh` (через TG Bot API)
3. `ops/auto-fix/known-issues.md` содержит минимум 10 известных ошибок:
   - 400 Invalid signature после смены ANTHROPIC_*
   - fail2ban блокировка после неудачных SSH
   - VPS OOM при 2GB RAM
   - Notion OAuth EXPIRED
   - Z.AI quota исчерпан
   - + 5 ещё из memory-файлов
4. End-to-end тест: сымитировать ошибку в логах → агент находит → шлёт патч → апрув → применение
5. Все действия в `ops/logs/<tenant>/ops-actions.log`

## Артефакты
- `ops/auto-fix/error-watcher-agent.md`
- `ops/auto-fix/patcher-agent.md`
- `ops/auto-fix/known-issues.md`
- `ops/auto-fix/notify-owner.sh`
- `ops/auto-fix/apply-patch.sh` (применяет одобренный патч)
- Запись в progress.md
- CHANGELOG v0.7.0
