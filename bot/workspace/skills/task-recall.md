---
name: task-recall
description: Найти что-то в долговременной памяти (memories table)
triggers: ["помнишь", "что мы обсуждали", "напомни", "ты говорил"]
---

Используй FTS5 поиск по таблице `memories` в SQLite (`store/claudeclaw.db`).

Шаги:
1. Запусти SQL через Bash: `sqlite3 store/claudeclaw.db "SELECT content, sector, datetime(created_at, 'unixepoch') FROM memories_fts JOIN memories ON memories_fts.rowid=memories.id WHERE memories_fts MATCH '<query>*' ORDER BY rank LIMIT 5"`
2. Сформулируй ответ на основе найденного
3. Если ничего не найдено — скажи прямо: "Не помню чтобы мы это обсуждали"

Не выдумывай. Если в памяти нет — нет.
