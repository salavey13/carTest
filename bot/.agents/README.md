# Agent Teams — vip-bot

> Команды агентов для автономной работы над проектом. Запуск через `TeamCreate` + `Agent(team_name=..., name=...)` (`teammateMode: tmux`).
> Команда унаследована от KLOD-BOX (vip-bot — форк рантайма) и адаптирована. Следующий человек управляет ею и добавляет своих агентов (см. «Как добавить агента»).

## Команды vip-bot (под шаги PLAN)

| Team | Задача | Тимейты | Когда |
|------|--------|---------|-------|
| `vipbot-contract-module` | Шаг 1 — порт ТРЕКа A на SQLite + `cli.ts` | `architect`(opus), `state-machine`, `test-engineer`, `security`(opus), `verifier` | Перенос `modules/contract/` с pg на better-sqlite3, CLI |
| `vipbot-runtime` | Шаг 2-3 — копия рантайма KLOD-BOX + сборка + скилл-роутинг | `bot-integrator`, `state-machine`, `code-reviewer` | rsync `src/`+`workspace/`, build, `contract-agent` в роутинг |
| `vipbot-deploy` | Шаг 6 — деплой на VPS тенанта | `vps-bootstrap`, `tester`, `healthcheck-dev` | bootstrap-vps + рендер CLAUDE.md, когда есть боевые токены |
| `vipbot-ops` | Постоянный ops после деплоя | `error-watcher`, `patcher`, `known-issues-curator`, `log-collector-dev` | Мониторинг/авто-фикс бота на VPS |

## Тимейты (members/)

**Generic coding-субагенты** (`agents/`, через `subagent_type`): `analyst, architect, code-reviewer, critic, debugger, performance-profiler, planner, security, test-engineer, test-runner, verifier`.

**Унаследованные роли KLOD-BOX** (`.agents/members/`) — релевантность для vip-bot:

| Member | Для vip-bot | Member | Для vip-bot |
|--------|-------------|--------|-------------|
| `bot-integrator` | ✅ интеграция модуля в рантайм | `vps-bootstrap` | ✅ деплой на VPS |
| `state-machine` | ✅ FSM флоу скилла договоров | `error-watcher` | ✅ ops авто-фикс |
| `patcher` | ✅ точечные патчи | `healthcheck-dev` | ✅ ops мониторинг |
| `tester` | ✅ тесты | `log-collector-dev` | ✅ сбор логов |
| `known-issues-curator` | ✅ реестр проблем | `dashboard-dev` | ◑ опц. дашборд |
| `composio-glue` | ◑ если подключат Composio | `client-question-agent` | ◑ саппорт (репурпоз) |
| `escalation-router` | ◑ эскалация оператору | `faq-writer` | ◑ доки |
| `quickstart-writer` · `selfhost-writer` · `troubleshooting-writer` · `screencast-writer` · `wizard-dev` | reference (продуктовые доки KLOD-BOX; репурпоз под vip-bot при необходимости) |

> `teams/klodbox-*.md` — оставлены как **референс** исходных команд KLOD-BOX. Рабочие команды vip-bot — в таблице выше.

## Запуск (пример — шаг 1)

```python
TeamCreate(team_name="vipbot-contract-module")
Agent(team_name="vipbot-contract-module", name="architect", subagent_type="architect", model="opus",
      prompt="""ШАГ 0: прочитай .agents/shared-context.md + PLAN-2026-06-09-vip-bot-klodbox.md.
Think hard. Спроектируй порт modules/contract/{db,contracts}.ts с pg на better-sqlite3 (sync, без await),
schema.sql → SQLite, и интерфейс cli.ts (recognize|gen-contract|migrate).""")
Agent(team_name="vipbot-contract-module", name="security", subagent_type="security", model="opus",
      prompt="""ШАГ 0: .agents/shared-context.md. Аудит ПДн/152-ФЗ: паспортные данные, очистка uploads/, секреты.""")
Agent(team_name="vipbot-contract-module", name="verifier", subagent_type="verifier", model="sonnet",
      prompt="""ШАГ 0: .agents/shared-context.md. FRESH-прогон: recognize-sample 19/19, gen-contract-sample → .docx + SQLite.""")
```

## Как добавить нового агента (для управляющего)

**Dev-тимейт (работает над кодом проекта):**
1. Скопировать `.agents/members/_template.md` → `.agents/members/<name>.md`, заполнить роль/обязанности/DoD.
2. (Опц.) добавить/расширить команду в этом README или создать `.agents/teams/<team>.md`.
3. Запускать через `TeamCreate` + `Agent(team_name=..., name="<name>", subagent_type=..., model=...)`. В ШАГ 0 тимейт читает `shared-context.md` + свой member-файл.

**Агент самого бота (срабатывает в Telegram по триггеру)** — это НЕ субагент, а **скилл**:
1. Создать `workspace/skills/<name>/SKILL.md` (или `workspace/skills/<name>.md`) с YAML-frontmatter (`name`, `description`/`triggers`).
2. Добавить строку в таблицу роутинга `workspace/CLAUDE.template.md`.
3. Перезапустить бот. См. `AGENTS.md` и образец `workspace/skills/contract-agent/SKILL.md`.

## Правила

- Каждый тимейт в ШАГ 0 читает `.agents/shared-context.md` + свой `.agents/members/<name>.md`.
- Модель явно (haiku/sonnet/opus, `~/.claude/rules/agent-model-selection.md`). Verifier ≠ автор.
- Параллельные тимейты — только TeamCreate + tmux (`~/.claude/rules/parallel-agents-rule.md`). 2+ Agent без team_name = критический баг.

*Адаптировано из KLOD-BOX/.agents/README.md под vip-bot, 2026-06-09.*
