# Quest Templates — Achievements, Skins, Spoilers

## Achievement Name Patterns

Use these patterns when generating unique achievements per quest:

| Domain | Pattern | Examples |
|--------|---------|----------|
| Navigation | «{Title} Маршрутов» | «Дирижёр Маршрутов», «Штурман Пути» |
| Visual | «{Adjective} {Noun}» | «Неон-Хирург», «Гладиатор Пикселей» |
| Interaction | «{Action} {Object}» | «Мастер Инерции», «Экзорцист Интерфейса» |
| System | «{Role} {Domain}» | «Архитект Системы», «Картограф Безграничности» |
| Access | «{Noun} {Key/Code}» | «Мастер Ключей», «Взломщик Промо» |

## Achievement Description Patterns

- «ты {verb} {object} с {quality}» — e.g., «ты прооперировала хедер с точностью до пикселя»
- «ты {verb} {metaphor}» — e.g., «ты укротила физику свайпа»
- «ты {verb} {domain} как {analogy}» — e.g., «ты дирижировала навигацией как симфонию»

## Skin Name Patterns

| Tier | Pattern | Examples |
|------|---------|----------|
| Common | «{Material} {Property}» | «Carbon Gold Precision», «Neon Drift Overlay» |
| Rare | «{Concept} {Substance}» | «Kinetic Velvet», «Safe Zone Phantom» |
| Epic | «{Cosmic} {Element}» | «Overhang Orbit», «Route Pulse Badge» |
| Legendary | «{Element} Chain Complete» | «Golden Chain Complete» |

## Skin Description Patterns

- Visual: «{visual_effect} на {element}. {feeling}.»
- Kinetic: «{motion_description}. {tactile_feeling}.»
- Atmospheric: «{ambient_description}. {emotional_impact}.»
- Legendary: «Вся цепь собрана. Каждое звено — твой PR.»

## Spoiler Hint Patterns

Spoilers should:
1. Vaguely describe the NEXT quest's domain
2. Use a metaphor that makes sense only after seeing the next task
3. Create anticipation without revealing specifics

| Current Domain | Spoiler Pattern |
|----------------|-----------------|
| Header → Cards | "витрина переоденется — карточки станут вертикальными" |
| Cards → Carousel | "бегущая строка с пульсом" |
| Carousel → Modal | "тень прячется в верхнем правом углу" |
| Modal → Map | "карта оживает на весь экран — снизу поднимается панель" |
| Map → Nav | "нижняя навигация прокладывает маршрут" |
| Nav → Bot | "стартовый экран получает секретный промо-код" |
| Bot → Checkout | "промо-код превращается в покупку — одна ссылка" |

## Cinematic Notification Openers

### Part 1 (Hook — by Boss)
- 🎬 ЛЕРА, ГЛАВНАЯ ГЕРОИНЯ В ЭФИРЕ. (First quest only)
- 🎬 МИССИЯ «{Quest Name}» АКТИВИРОВАНА.
- 🎬 МИССИЯ «{Quest Name}» АКТИВИРОВАНА — ФИНАЛЬНАЯ. (Last quest)

### Part 2 (Victory — by Agent)
- 🔥 MISSION COMPLETE: «{Quest Name}».
- 🔥🔥🔥 CHAIN COMPLETE: «{Quest Name}» — ФИНАЛЬНАЯ МИССИЯ ЗАВЕРШЕНА 🔥🔥🔥 (Last quest)

## Markdown Safety for Telegram

When `parse_mode: 'Markdown'` is used, these characters MUST be escaped if not intended as formatting:
- `_` → `\_` (unless italic is intended)
- `*` → `\*` (unless bold is intended)
- `` ` `` → `` \` `` (unless code is intended)
- `[` → `\[` (unless link is intended)

For quest names in «» — safe, no escaping needed.
For achievement/skin names — check for `_`, `*`, `` ` `` and escape if present.

## Codex Deep Link Format

```
🎯 Открой задачу: https://codex.x.ai/tasks/{target_task_name}
```

Place this in notification_part1 AFTER the cheatcode line.
Boss should verify the actual URL format with the Codex team.
