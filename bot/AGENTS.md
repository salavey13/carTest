# Агенты бота VIP BIKE

> Две разные вещи. НЕ путать:
> 1. **Агенты бота** (в Telegram, срабатывают по триггеру) = **скиллы** в `workspace/skills/`. Бот single-agent — это персоны единого Claude, не субагенты.
> 2. **Dev-команда** (работает над кодом проекта) = `.agents/` (members + teams). Запуск через `TeamCreate`. См. `.agents/README.md`.

## Агенты бота (workspace/skills/)

| Агент | Когда срабатывает | Скилл |
|-------|-------------------|-------|
| **Агент договоров** | «новый договор», «оформить аренду», фото паспорта+ВУ | `contract-agent` (главный) |
| **Memory Recall** | «помнишь…», «что обсуждали…» | `task-recall` (из рантайма KLOD-BOX) |
| **Web Researcher** | «найди в интернете», «ресёрч» | `web-research` |
| **Voice Replier** | голосовое / «ответь голосом» | `voice-reply` |
| **Transcriber** | аудио/видео файл | `transcribe-file` |

> Состав после копии рантайма KLOD-BOX (шаг 2 PLAN). Lean-набор — без marketing-плагинов Олега.

## Как добавить нового агента бота (для управляющего)

1. Создать `workspace/skills/<name>/SKILL.md` (или `workspace/skills/<name>.md`) с YAML-frontmatter:
   ```yaml
   ---
   name: skill-name
   description: Когда применять и что делает.
   triggers: ["ключевые", "слова"]
   ---
   ```
2. В body — пошаговый алгоритм для Claude (образец: `workspace/skills/contract-agent/SKILL.md`).
3. Добавить строку в таблицу роутинга `workspace/CLAUDE.template.md` (по ней Claude понимает, когда открыть скилл).
4. Перезапустить бот (`systemctl restart claudeclaw-vip-bike` на VPS, или `npm run dev` локально).

## Как добавить dev-агента (для работы над кодом)

См. `.agents/README.md` → «Как добавить нового агента». Кратко: `.agents/members/_template.md` → новый member; запуск через `TeamCreate` + `Agent(team_name, name, subagent_type, model)`; в ШАГ 0 читает `.agents/shared-context.md`.

## Глобальные скиллы

Скиллы из `~/.claude/skills/` доступны автоматически (`settingSources='user'`) при локальной работе. На VPS тенанта ставится lean-набор через `scripts/install-default-skills.sh`.

*Адаптировано из KLOD-BOX/AGENTS.md под vip-bot, 2026-06-09.*
