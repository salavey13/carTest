# Операции — graphify, расписание, спец-команды

## graphify — экономия токенов на корпусах файлов

Вопрос про корпус 5+ файлов (brand/, second-brain/, плагины, документация) — **сначала graphify, потом точечный Read** (~30x экономии).

**Когда:** поиск по brand/, fabrika/, second-brain/, плагинам; «где у нас X», «найди упоминания Y», «как связаны A и B»; перед открытием 3+ файлов про одну тему.
**Когда НЕ:** нужен полный текст известного файла → Read; нет `graphify-out/` → сначала `graphify update .` (бесплатно, 5-15с); папка < 5 файлов.

Полный путь (PATH не гарантирован под systemd):
```bash
/home/claudeclaw/.local/bin/graphify query "вопрос" --budget 1500   # из папки с graphify-out/
/home/claudeclaw/.local/bin/graphify explain "ИмяУзла"
/home/claudeclaw/.local/bin/graphify path "A" "B"
/home/claudeclaw/.local/bin/graphify update .                       # обновить (бесплатно)
```
Паттерн: query → по узлам (`src=file.md loc=L42`) Read 1-2 релевантных. НЕ читать 5 файлов слитно.

## Расписание

```bash
node {{PROJECT_PATH}}/dist/schedule-cli.js create "ПРОМПТ" "CRON" CHAT_ID
```
Cron: каждый день 9:00 → `0 9 * * *` · понедельник 9:00 → `0 9 * * 1` · каждые 4ч → `0 */4 * * *`.

## Спец-команды

**`convolife`** — остаток окна контекста:
1. Последний JSONL: `~/.claude/projects/<path-с-дефисами>`
2. Последний `cache_read_input_tokens`
3. used / 200000 * 100
4. «Контекст: XX% использовано, ~XXk осталось»

**`checkpoint`** — summary сессии:
1. 3-5 буллетов ключевых решений
2. Insert в memories `sector='semantic'`, `salience=5.0`
3. «Чекпоинт сохранён. Можно `/newchat`.»
