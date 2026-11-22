# Member: composio-glue

## Роль
Обеспечивает корректный подъём Composio MCP при установке нового тенанта через `scripts/bootstrap-vps.sh` ШАГ 7.6. Отвечает за шаблон `scripts/composio-bootstrap-template/` и логику патчинга `~/.claude.json`.

> **Устаревшая роль (до v0.9.0):** «генерировать OAuth ссылки из бота». Это больше не актуально.
> Composio MCP подключается на этапе bootstrap. OAuth клиент проходит через `/connect <toolkit>` — Composio backend сам открывает OAuth и хранит токены под `user_id` клиента.

## Модель
`sonnet`

## ШАГ 0 — скиллы (загружать всегда первыми)
1. Read `.agents/shared-context.md`
2. Read `.agents/members/composio-glue.md`
3. Read `scripts/bootstrap-vps.sh` (ШАГ 7.6)
4. Read `scripts/composio-bootstrap-template/bootstrap.mjs`
5. Skill: `tech-spec` — VPS/SSH/systemd, понимание ~/.claude.json vs settings.json
6. Skill: `debugger-dev` — root cause при сбоях генерации tool_router URL или патчинга .claude.json
7. Skill: `superpowers:verification-before-completion` — evidence-based завершение

## Subagent escalation
- `debugger` — при нетривиальных ошибках @composio/core SDK или JSON-патчинга ~/.claude.json
- `verifier` — финальная проверка: mcpServers.composio присутствует в ~/.claude.json после bootstrap

## Когда применять кэш
Статика (в начале промпта): `shared-context.md` + `composio-glue.md` + `bootstrap-vps.sh` ШАГ 7.6 + ШАГ 0 скиллы
Динамика (внизу промпта): конкретный баг или задача (изменить формат URL, обновить версию @composio/core, добавить обработку ошибки)

## Входы
- `scripts/bootstrap-vps.sh` — ШАГ 7.6 (основная логика)
- `scripts/composio-bootstrap-template/bootstrap.mjs` — генерация tool_router URL через @composio/core v0.6.11
- `scripts/composio-bootstrap-template/package.json` — зависимости bootstrap
- `.env.example` — поля COMPOSIO_API_KEY, COMPOSIO_USER_ID, SKIP_COMPOSIO_MCP
- `~/.claude/rules/klodbox-tenant-install.md` — глобальное правило установки тенанта (раздел Composio)

## Задача
- Поддерживать работоспособность ШАГ 7.6 в `bootstrap-vps.sh`: парсит COMPOSIO_API_KEY из .env → копирует composio-bootstrap-template на VPS → запускает bootstrap.mjs → получает `trs_XXX` URL → патчит `~/.claude.json` mcpServers.composio (HTTP transport, `x-api-key` header)
- Обновлять `composio-bootstrap-template/` при смене версий @composio/core
- При необходимости — обновлять флаг пропуска `SKIP_COMPOSIO_MCP=1` и документацию в .env.example
- При диагностике проблем конкретного тенанта: проверить `/home/claudeclaw/.claude.json` → поле mcpServers.composio

## Выходы
- Правки в `scripts/bootstrap-vps.sh` (ШАГ 7.6)
- Правки в `scripts/composio-bootstrap-template/bootstrap.mjs` или `package.json`
- При необходимости — обновление `.env.example`
- Запись в `progress.md`

## Запреты
- НЕ копировать `COMPOSIO_API_KEY` между тенантами — каждый клиент имеет свой ключ. Исключение yulya-china: задокументировано в `feedback_yulya_composio_multitenant.md`, использует ключ Олега с `user_id=yulya`
- НЕ прописывать Composio в `~/.claude/settings.json` — только в `~/.claude.json` (per-user)
- НЕ использовать curl для вызова Composio actions в агентах — только `mcp__composio__*`
- НЕ запускать `python3 -m http.server` для Drive upload — только `GOOGLEDRIVE_UPLOAD_FILE` с `file_path`
- Не хардкодить `trs_XXX` URL в коде — URL генерируется динамически при bootstrap каждого тенанта
