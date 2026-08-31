# Member: vps-bootstrap

## Роль
Пишет `scripts/bootstrap-vps.sh` (свой VPS) и `scripts/spawn-tenant.sh` (multi-tenant на VPS Олега).

## Модель
`sonnet`

## ШАГ 0 — скиллы (загружать всегда первыми)
1. Read `.agents/shared-context.md`
2. Read `.agents/members/vps-bootstrap.md`
3. Skill: `tech-spec` — VPS/SSH/systemd/nginx, apt, rsync, user management
4. Skill: `superpowers:verification-before-completion` — evidence-based проверка перед DoD
5. Skill: `debugger-dev` — для диагностики сбоев деплоя (systemd FATAL, apt lock, rsync errors)
6. Skill: `qa` — smoke-тест: systemd active, /start отвечает
7. Skill: `backuper` — понимание rollback/cleanup при half-installed state

## Subagent escalation (если задача требует глубины)
- `debugger` — при необъяснимом сбое bootstrap на чистом VPS (нет FATAL в журнале, но бот не отвечает)
- `verifier` — финальная независимая проверка перед маркировкой gate M2

## Когда применять кэш
Статика (повторяется между сессиями): shared-context.md + этот member.md + ШАГ 0
Динамика (только в конце промпта): конкретная задача — bootstrap-vps.sh или spawn-tenant.sh, конкретный блокер/шаг

## Входы
- `scripts/preflight.sh`, `scripts/install-default-skills.sh` (для понимания текущей логики)
- `SETUP-FROM-SCRATCH.md` (полный сценарий ручной установки)
- `tenants/README.md` (формат tenant.yaml)

## Задача (M2)

### `bootstrap-vps.sh`
1. Вход: SSH-target (root@IP), путь к `.env`, путь к `tenant.yaml`
2. На VPS: `apt-get update`, ставит Node 20 + `claude` CLI
3. Создаёт user `claudeclaw` (non-root, sudo для systemd)
4. `mkdir /opt/claudeclaw/` + chown
5. rsync KLOD-BOX → `/opt/claudeclaw/` (исключая `tenants/`, `ops/`, `.agents/`, `node_modules/`)
6. На VPS: `npm install` + `npm run build`
7. Playwright Chromium + apt deps
8. `~claudeclaw/.claude/settings.json` с MCP-серверами (playwright, zai-vision, kie-ai и т.д. из bundled-plugins)
9. **ШАГ 7.6 — Composio MCP**: если `COMPOSIO_API_KEY` непуст в `.env` (и `SKIP_COMPOSIO_MCP` не задан), копирует `scripts/composio-bootstrap-template/` на VPS → `npm install` → `node bootstrap.mjs` → получает `trs_XXX` URL → патчит `/home/claudeclaw/.claude.json` mcpServers.composio (HTTP transport, `x-api-key` header). **НЕ в settings.json.**
10. **Рендер CLAUDE.md**: рендерится из `workspace/CLAUDE.template.md` через sed с подстановкой `{{CLIENT_NAME}}`, `{{CLIENT_ROLE}}` и др. → кладётся в `/opt/claudeclaw/<slug>/CLAUDE.md`. Минимум 280 строк, минимум 12 секций.
11. **Добавляет ключ `klod-box-ops` в authorized_keys** для будущего auto-fix доступа
12. systemd unit `claudeclaw.service` → enable + start
13. Smoke test: `journalctl -u claudeclaw -n 50` без FATAL, бот отвечает на /start

### `spawn-tenant.sh`
1. Локально на маке Олега, SSH на klod.fil-ai.ru
2. Создаёт user `claudeclaw_<slug>` + директорию `/opt/claudeclaw-<slug>/`
3. rsync код + персональные `.env` + `workspace/CLAUDE.md`
4. systemd unit `claudeclaw-<slug>.service`
5. Создаёт запись `tenants/<slug>/tenant.yaml`
6. enable + start, smoke test

## Выходы
- `scripts/bootstrap-vps.sh`
- `scripts/spawn-tenant.sh`
- `~/.ssh/klod-box-ops` ключ (один раз — `ssh-keygen` отдельно, не в скрипте)
- systemd unit templates в `scripts/systemd/`

## Запреты
- `set -euo pipefail` обязательно
- Никогда не хардкодить пароли/токены — только из env
- При ошибке VPS — НЕ оставлять half-installed state, чистить
- Не использовать `rm -rf` без проверки переменной
- **НЕ писать `/opt/claudeclaw/<slug>/CLAUDE.md` вручную** — всегда рендерить из `workspace/CLAUDE.template.md` через sed (шаблон 283+ строк, весь MCP routing, rules, agent quality rules уже там)
- **НЕ копировать `COMPOSIO_API_KEY` между тенантами** — у каждого клиента свой (исключение yulya-china задокументировано)
