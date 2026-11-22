---
name: update-skill
description: "Обновить/отредактировать существующий скилл, упаковать .skill"
---

# Update Skill — Обновление существующего скилла

Этот скилл обновляет любой установленный скилл по железному правилу: копировать → редактировать блоки → упаковать.

## Шаг 1 — Понять что менять

Прочитай контекст диалога. Определи:
- **Какой скилл** обновляем (имя = имя папки в `.skills/skills/`)
- **Что именно меняем** — какие файлы, какие блоки

Путь к скиллам: `/sessions/sweet-great-galileo/mnt/.skills/skills/<skill-name>/`

## Шаг 2 — Скопировать в /tmp

```bash
cp -r /sessions/sweet-great-galileo/mnt/.skills/skills/<skill-name> /tmp/<skill-name>
chmod -R u+w /tmp/<skill-name>
```

## Шаг 3 — Редактировать только нужные блоки

Открой файлы в `/tmp/<skill-name>/` через Read → Edit.

**Правило:** не переписывать файл целиком. Найди нужный блок → замени только его через Edit tool.

Типичные файлы для правки:
- `SKILL.md` — основные инструкции, режимы, workflow
- `references/style-card.md` — стиль, тон, лексика
- `references/examples.md` — эталоны и антипаттерны

## Шаг 4 — Упаковать

```bash
cd /sessions/sweet-great-galileo/mnt/.skills/skills/skill-creator
python -m scripts.package_skill /tmp/<skill-name> /sessions/sweet-great-galileo/mnt/fil-ai-hub-launch/Deliverables/
```

Если ошибка `Description is too long` — сократи description в YAML frontmatter до <1024 символов.

## Шаг 5 — Отдать файл

Дать пользователю ссылку:
```
[Скачать <skill-name>.skill](computer:///sessions/sweet-great-galileo/mnt/fil-ai-hub-launch/Deliverables/<skill-name>.skill)
```

---

## Правило: обновление CHANGELOG

После каждого патча плагина/скилла — обновить CHANGELOG.

**Где:**
- Плагин: `~/.claude/plugins/<plugin-name>/CHANGELOG.md`
- Скилл: `~/.claude/skills/<skill-name>/CHANGELOG.md` (если есть)
- Проектный лог: `MARKETING DEPT/CHANGELOG-fabrika-kontenta.md` (для content-dept-fil-ai)

**Формат записи:**
```markdown
## [X.Y.Z] — YYYY-MM-DD

| # | Файл | Что сделано |
|---|------|-------------|
| P1 | `path/to/file` | Описание изменения |
```

**Правило:** запись добавляется В НАЧАЛО файла (новое сверху).

---

## Быстрый чеклист

- [ ] Прочитал оригинальный файл перед правкой?
- [ ] Использовал Edit (не Write) для изменений?
- [ ] Проверил что description < 1024 символов?
- [ ] Запустил packager из папки skill-creator?
- [ ] Дал ссылку computer:// на .skill файл?
- [ ] Обновил CHANGELOG плагина/скилла?
