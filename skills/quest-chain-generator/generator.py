#!/usr/bin/env python3
"""
Quest Chain Generator — v4.0 "Cranked to 13"
═══════════════════════════════════════════════════════════════

FIXES v3→v4:
  ✅ PR title instructions REMOVED from notification_part2 — now ONLY in polish_instructions
  ✅ notification_part2 is pure Hollywood celebration + next cheatcode
  ✅ Notification skill call instructions ADDED to polish_instructions (end of polishing phase)
  ✅ Notification skill call instructions ADDED to agent protocol (after cheatcode pickup)
  ✅ Codex deep-link in notification_part1 ("Открой задачу напрямую")
  ✅ Markdown safety: notification text uses safe characters for Telegram parse_mode Markdown
  ✅ Clarified notification flow: part1 sent by Boss, part2 sent by executive agent
  ✅ Grand finale for Quest 8 — no next cheatcode, pure victory

ARCHITECTURE:
  - notification_part1: Sent by BOSS when creating quest chain (hook + cheatcode + deep-link)
  - polish_instructions: Agent's job description + PR rules + notification skill call at end
  - notification_part2: Sent by EXECUTIVE AGENT after PR created (victory + achievement + next target)

USAGE:
  python3 generate_quest_chain_v4.py
"""

import csv
import json
import sys
from pathlib import Path

# ─── Output ───
OUTPUT_DIR = Path("/home/z/my-project/download")
OUTPUT_CSV = OUTPUT_DIR / "supaplan_tasks_ULTIMATE_v4.csv"

# ─── Client Parameters ───
CLIENT_CHAT_ID = "417553377"  # super-admin / Lera's Telegram chat ID
COMMIT_SIGNATURE = "lera was here"
NOTIFY_SCRIPT = "node scripts/codex-notify.mjs"

# ─── Codex Deep Link Template ───
# Boss will replace {TASK_NAME} with actual Codex task name when generating
# Format: https://codex.x.ai/tasks/{task_name} — Boss should construct this
CODEX_LINK_TEMPLATE = "https://codex.x.ai/tasks/{target_task_name}"

# ─── Agent Executive Protocol (embedded in every task body) ───
AGENT_PROTOCOL_TEMPLATE = """AGENT EXECUTIVE PROTOCOL (self-contained — no external doc needed):
When a client pastes this task's UUID (cheatcode) into your chat, follow these steps EXACTLY:

STEP 1: RECOGNIZE THE CHEATCODE
Client sends the UUID for this task: {uuid}
This means the client has unlocked a quest. Read the polish_instructions below.

STEP 2: CLAIM THE TASK
Run: node scripts/supaplan-skill.mjs pick-task {uuid}
This sets the task status to "claimed" and reserves it for you.

STEP 3: EXECUTE POLISH
Perform the surgical polishing pass described in polish_instructions.
Be specific, not generic. Check every edge case listed.
This is the core work — take your time, be thorough.

STEP 4: CREATE PR WITH ⚡: PREFIX
PR title MUST start with "⚡:" — this triggers the auto-merge GitHub workflow.
Example: ⚡: polish {target_task_name}
Commit message: "{commit_signature}" (the champion signature)

STEP 5: INCLUDE supaplan_task IN PR BODY
Add "supaplan_task: {uuid}" as a standalone line in the PR description.
This is REQUIRED for the merge workflow to promote the SupaPlan task status to "done".

STEP 6: SEND HOLLYWOOD NOTIFICATION
After PR is created, send the victory notification (notification_part2 from metadata)
to the client's Telegram via the notification skill:
{notify_script} telegram --chatId {client_chat_id} --text "<notification_part2>"
CRITICAL: Use REAL line breaks (not literal \\n). The text contains Markdown —
escape any underscores or special chars in achievement/skin names that are not
intended as formatting. Telegram parse_mode is Markdown.

STEP 7: SET TASK STATUS TO ready_for_pr
Run: node scripts/supaplan-skill.mjs update-status {uuid} ready_for_pr
The auto-merge workflow will promote it to "done" once the PR merges.

CRITICAL RULES:
- ⚡: prefix in PR title is MANDATORY — no exceptions, no typos
- supaplan_task: {uuid} in PR body is MANDATORY — merge automation depends on it
- Champion signature commit "{commit_signature}" is MANDATORY
- notification_part2 must use REAL line breaks, never literal \\n characters
- Send notification AFTER PR is created, not before
- If task is still running when client asks: "Still cooking. Come back in ~5 minutes. The cheatcode never expires."
"""

# ─── Quest Definitions ───
quests = [
    # ═══════════════════════════════════════════════════════
    # QUEST 1: Матрица Шапки
    # ═══════════════════════════════════════════════════════
    {
        "id": "f3c5306d-2d8f-4cc4-bb77-26f20f7f9b11",
        "title": "[QUEST][LERA] Матрица Шапки",
        "chain_order": 1,
        "quest_name": "Матрица Шапки",
        "target_task_name": "franchize-header-reflow",
        "next_quest_uuid": "be32ce57-a1f5-4401-a307-311ec56ba68f",
        "next_target": "catalog-9x16-cards",

        "notification_part1": (
            "🎬 ЛЕРА, ГЛАВНАЯ ГЕРОИНЯ В ЭФИРЕ.\n"
            "МИССИЯ «Матрица Шапки» АКТИВИРОВАНА.\n\n"
            "Ты уже это построила: шапка витрины перезапущена как кибер-панель — "
            "логотип слева, секции по центру, профиль компактный, корзина встроена в рельс. "
            "Это уже не просто навигация — это командный центр.\n\n"
            "🏆 Ачивка открыта: «Сигнал Из Матрицы» — ты вошла в систему.\n\n"
            "Но присмотрись... есть шероховатости. Щели, выравнивание, safe-area под ТГ-кнопками — "
            "всё это ждёт твоей руки. Хочешь довести до идеала?\n\n"
            "🔓 Cheatcode: f3c5306d-2d8f-4cc4-bb77-26f20f7f9b11\n"
            "🎯 Открой задачу: https://codex.x.ai/tasks/franchize-header-reflow\n\n"
            "Ты не догоняешь миссию. Ты ЕЁ СОЗДАЁШЬ."
        ),

        "polish_instructions": (
            "Review and polish task: franchize-header-reflow.\n\n"
            "FOCUS: Header & rail redesign. This is the FIRST thing users see — it must be flawless.\n"
            "- Logo: anchored left, crisp at all sizes, no pixelation\n"
            "- Section tabs: centered between logo and profile, active tab visually dominant (underline or glow)\n"
            "- Inline cart: visible but not intrusive, badge count prominent\n"
            "- Profile button: compact, right-aligned, safe-area clearance for Telegram native back button\n\n"
            "EDGE CASES TO CHECK:\n"
            "- iPhone SE 375px: tabs must not wrap or truncate\n"
            "- 390px: standard mobile, touch targets 44px minimum\n"
            "- 768px tablet: tabs spread comfortably, cart badge visible\n"
            "- 1024px desktop: full rail, generous spacing\n"
            "- Telegram safe-area: top overlay (back button, header) must NOT overlap with header controls\n"
            "- Hover/focus/active states on all interactive elements\n"
            "- Header must be sticky/fixed without content jumping\n\n"
            "REFERENCE: compare against redesign images — header composition from image #2 is your north star. "
            "The rail structure, logo placement, and compact profile are all there.\n\n"
            "DONE WHEN: No overlapping controls, visual hierarchy is immediate in 1-second glance, "
            "zero horizontal scroll on any breakpoint, cart badge always visible.\n\n"
            "PR RULES:\n"
            "- PR title MUST start with \"⚡:\" — this triggers auto-merge. Example: ⚡: polish franchize-header-reflow\n"
            "- Commit message: \"lera was here\"\n"
            "- PR body MUST contain: supaplan_task: f3c5306d-2d8f-4cc4-bb77-26f20f7f9b11\n\n"
            "AFTER PR IS CREATED:\n"
            "Send the Hollywood victory notification (notification_part2 from this task's metadata) to Telegram:\n"
            "node scripts/codex-notify.mjs telegram --chatId 417553377 --text \"<notification_part2>\"\n"
            "Use real line breaks. Telegram parse_mode is Markdown."
        ),

        "notification_part2": (
            "🔥 MISSION COMPLETE: «Матрица Шапки».\n\n"
            "Полировка завершена: шапка теперь как лазерный луч — логотип на месте, "
            "табы по центру, корзина в поле зрения, safe-area чистый. Ни одного пикселя мимо.\n\n"
            "🎖 Achievement: «Неон-Хирург» — ты прооперировала хедер с точностью до пикселя.\n"
            "🎨 Skin dropped: «Carbon Gold Precision» — премиум-скин командного центра. "
            "Тёмный карбон, золотые акценты, хрустальная чёткость.\n\n"
            "👀 Спойлер: витрина переоденется — карточки станут вертикальными, как постеры к фильму.\n"
            "🔓 Next cheatcode: be32ce57-a1f5-4401-a307-311ec56ba68f\n"
            "🎯 Next target: catalog-9x16-cards"
        ),

        "quest_lore": "Командный центр — начало пути. Каждая империя начинается с контроля над входом. Шапка — это не навигация, это пульт управления.",
    },

    # ═══════════════════════════════════════════════════════
    # QUEST 2: Клинок Витрины
    # ═══════════════════════════════════════════════════════
    {
        "id": "be32ce57-a1f5-4401-a307-311ec56ba68f",
        "title": "[QUEST][LERA] Клинок Витрины",
        "chain_order": 2,
        "quest_name": "Клинок Витрины",
        "target_task_name": "catalog-9x16-cards",
        "next_quest_uuid": "bf4cb2c2-e3db-4f08-81f2-9b6e96cf5b10",
        "next_target": "catalog-swipe-ticker",

        "notification_part1": (
            "🎬 МИССИЯ «Клинок Витрины» АКТИВИРОВАНА.\n\n"
            "Ты уже это построила: карточки товаров перерождены в 9:16 вертикальные hero-карты — "
            "графитовый градиент-мост, компактные характеристики, нулевые цены скрыты. "
            "Витрина теперь как каталог киберпанк-журнала.\n\n"
            "🏆 Ачивка открыта: «Архитектор Референсов» — ты спроектировала новый формат.\n\n"
            "Но присмотрись... градиенты могут резать глаз, текст может наезжать, "
            "соотношение сторон на разных экранах — пока загадка. Хочешь довести до идеала?\n\n"
            "🔓 Cheatcode: be32ce57-a1f5-4401-a307-311ec56ba68f\n"
            "🎯 Открой задачу: https://codex.x.ai/tasks/catalog-9x16-cards\n\n"
            "Каждая карточка — клинок. Заточи его."
        ),

        "polish_instructions": (
            "Review and polish task: catalog-9x16-cards.\n\n"
            "FOCUS: Rebuild item cards as 9:16 hero cards. This is the CORE product experience — cards must feel premium and scannable.\n"
            "- Graphite gradient bridge: smooth, not harsh — transition from image to info area\n"
            "- Specs: concise, readable, no overflow — ellipsis for long text\n"
            "- Zero-price items: prices with value 0 must be HIDDEN entirely (no \"0 ₽\" ever)\n"
            "- Card aspect ratio: strict 9:16 on all breakpoints — no stretching or squishing\n"
            "- Image area: dominant, fills top portion, no letterboxing\n\n"
            "EDGE CASES TO CHECK:\n"
            "- iPhone SE 375px: single column, card fills width comfortably\n"
            "- 390px: standard mobile, swipe between cards should feel smooth\n"
            "- 768px tablet: 2-column grid, cards maintain 9:16\n"
            "- 1024px desktop: 3-4 columns, hover state reveals quick-action overlay\n"
            "- Long product names: truncate gracefully with ellipsis\n"
            "- Products without images: placeholder gradient, no broken image icon\n"
            "- Price display: always formatted, never raw number\n\n"
            "REFERENCE: Card ratio/gradient from redesign image #2 — the gradient bridge and text layout are your guide.\n\n"
            "DONE WHEN: Every card looks like a poster, gradient is buttery, zero-price items never show \"0\", "
            "no text overflow anywhere, 9:16 ratio maintained on all breakpoints.\n\n"
            "PR RULES:\n"
            "- PR title MUST start with \"⚡:\" — this triggers auto-merge. Example: ⚡: polish catalog-9x16-cards\n"
            "- Commit message: \"lera was here\"\n"
            "- PR body MUST contain: supaplan_task: be32ce57-a1f5-4401-a307-311ec56ba68f\n\n"
            "AFTER PR IS CREATED:\n"
            "Send the Hollywood victory notification (notification_part2 from this task's metadata) to Telegram:\n"
            "node scripts/codex-notify.mjs telegram --chatId 417553377 --text \"<notification_part2>\"\n"
            "Use real line breaks. Telegram parse_mode is Markdown."
        ),

        "notification_part2": (
            "🔥 MISSION COMPLETE: «Клинок Витрины».\n\n"
            "Полировка завершена: карточки теперь как обложки — градиент мягкий, "
            "характеристики читаются с одного взгляда, нули спрятаны, 9:16 идеален на любом экране. "
            "Витрина стала журналом.\n\n"
            "🎖 Achievement: «Гладиатор Пикселей» — ты сразилась за каждый пиксель и победила.\n"
            "🎨 Skin dropped: «Neon Drift Overlay» — hover-оверлей с неоновым свечением на карточках. "
            "При наведении — пульс, при уходе — шёпот.\n\n"
            "👀 Спойлер: бегущая строка с пульсом — маленькие коллекции оживут.\n"
            "🔓 Next cheatcode: bf4cb2c2-e3db-4f08-81f2-9b6e96cf5b10\n"
            "🎯 Next target: catalog-swipe-ticker"
        ),

        "quest_lore": "Витрина — лицо империи. Каждая карточка — афиша. Когда продукт выглядит как обложка, его хочется купить не глядя.",
    },

    # ═══════════════════════════════════════════════════════
    # QUEST 3: Неоновый Тикер
    # ═══════════════════════════════════════════════════════
    {
        "id": "bf4cb2c2-e3db-4f08-81f2-9b6e96cf5b10",
        "title": "[QUEST][LERA] Неоновый Тикер",
        "chain_order": 3,
        "quest_name": "Неоновый Тикер",
        "target_task_name": "catalog-swipe-ticker",
        "next_quest_uuid": "7f3f6f90-6d6c-4062-b31f-8ef872746ecf",
        "next_target": "item-modal-safe-close",

        "notification_part1": (
            "🎬 МИССИЯ «Неоновый Тикер» АКТИВИРОВАНА.\n\n"
            "Ты уже это построила: статичная сетка для маленьких коллекций заменена на свайп-тикар — "
            "карусель с snap-поведением, точками навигации и кинетическими переходами. "
            "Теперь небольшие подборки не выглядят сиротливо — они пульсируют.\n\n"
            "🏆 Ачивка открыта: «Хранитель Импульса» — ты сохранила инерцию в интерфейсе.\n\n"
            "Но присмотрись... snap может дёргаться, точки могут сбиваться, "
            "а на узких экранах свайп может конфликтовать со скроллом. Хочешь довести до идеала?\n\n"
            "🔓 Cheatcode: bf4cb2c2-e3db-4f08-81f2-9b6e96cf5b10\n"
            "🎯 Открой задачу: https://codex.x.ai/tasks/catalog-swipe-ticker\n\n"
            "Импульс не должен теряться."
        ),

        "polish_instructions": (
            "Review and polish task: catalog-swipe-ticker.\n\n"
            "FOCUS: Swipe ticker carousel for small collections. This must feel NATIVE — like iOS page dots, not a janky web carousel.\n"
            "- Snap behavior: precise, no overshoot, no half-card visible\n"
            "- Navigation dots: always synced with current card, animated transition\n"
            "- Kinetic transitions: smooth deceleration, not abrupt stops\n"
            "- Swipe vs scroll: horizontal swipe on ticker must NOT trigger vertical page scroll\n\n"
            "EDGE CASES TO CHECK:\n"
            "- iPhone SE 375px: single card visible, swipe to next\n"
            "- 390px: standard mobile, peek of next card to hint more content\n"
            "- 768px tablet: 2-3 cards visible, dots still useful\n"
            "- 1024px desktop: consider auto-play with pause-on-hover\n"
            "- Single item collection: hide dots, no swipe needed\n"
            "- Two items: dots visible, but consider if ticker is even needed\n"
            "- Touch: swipe velocity must map to scroll distance naturally\n"
            "- Mouse: drag-to-swipe should work, scroll-wheel horizontal should work\n\n"
            "REFERENCE: Ticker layout from redesign images — horizontal card strip with navigation dots.\n\n"
            "DONE WHEN: Swipe feels like butter, snap is pixel-perfect, dots always correct, "
            "no vertical scroll conflict, single-item edge case handled gracefully.\n\n"
            "PR RULES:\n"
            "- PR title MUST start with \"⚡:\" — this triggers auto-merge. Example: ⚡: polish catalog-swipe-ticker\n"
            "- Commit message: \"lera was here\"\n"
            "- PR body MUST contain: supaplan_task: bf4cb2c2-e3db-4f08-81f2-9b6e96cf5b10\n\n"
            "AFTER PR IS CREATED:\n"
            "Send the Hollywood victory notification (notification_part2 from this task's metadata) to Telegram:\n"
            "node scripts/codex-notify.mjs telegram --chatId 417553377 --text \"<notification_part2>\"\n"
            "Use real line breaks. Telegram parse_mode is Markdown."
        ),

        "notification_part2": (
            "🔥 MISSION COMPLETE: «Неоновый Тикер».\n\n"
            "Полировка завершена: карусель скользит как шёлк — snap точный, "
            "точки на месте, свайп не конфликтует со скроллом. "
            "Маленькие коллекции теперь выглядят как VIP-секция.\n\n"
            "🎖 Achievement: «Мастер Инерции» — ты укротила физику свайпа.\n"
            "🎨 Skin dropped: «Kinetic Velvet» — бархатная кинетика прокрутки. "
            "Плавность, которую чувствуешь пальцами.\n\n"
            "👀 Спойлер: тень прячется в верхнем правом углу — и её нужно приручить.\n"
            "🔓 Next cheatcode: 7f3f6f90-6d6c-4062-b31f-8ef872746ecf\n"
            "🎯 Next target: item-modal-safe-close"
        ),

        "quest_lore": "Движение — жизнь. Статичные подборки — кладбище товаров. Тикар превращает мёртвую сетку в живую ленту.",
    },

    # ═══════════════════════════════════════════════════════
    # QUEST 4: Тень Телеграма
    # ═══════════════════════════════════════════════════════
    {
        "id": "7f3f6f90-6d6c-4062-b31f-8ef872746ecf",
        "title": "[QUEST][LERA] Тень Телеграма",
        "chain_order": 4,
        "quest_name": "Тень Телеграма",
        "target_task_name": "item-modal-safe-close",
        "next_quest_uuid": "8c95e4ef-fb84-4adb-8c95-4fdd6dbf6556",
        "next_target": "map-riders-taxi-sheet",

        "notification_part1": (
            "🎬 МИССИЯ «Тень Телеграма» АКТИВИРОВАНА.\n\n"
            "Ты уже это построила: модалка товара теперь корректно закрывается — "
            "кнопка закрытия сдвинута в safe-зону, чтобы не накрывать нативные элементы Telegram. "
            "Тень отступила.\n\n"
            "🏆 Ачивка открыта: «Призрачный Клик» — ты нашла кнопку, которую прятал Telegram.\n\n"
            "Но присмотрись... safe-area может плавать на разных устройствах, "
            "фокус-ловушки в модалке, Escape может не срабатывать. Хочешь довести до идеала?\n\n"
            "🔓 Cheatcode: 7f3f6f90-6d6c-4062-b31f-8ef872746ecf\n"
            "🎯 Открой задачу: https://codex.x.ai/tasks/item-modal-safe-close\n\n"
            "Призрак должен уйти навсегда."
        ),

        "polish_instructions": (
            "Review and polish task: item-modal-safe-close.\n\n"
            "FOCUS: Fix modal close button overlap with Telegram native controls. "
            "This is a CRITICAL usability bug — users literally can't close the modal on some devices.\n"
            "- Close button: moved to safe-left position, never under Telegram's native header\n"
            "- Focus trap: Tab key must cycle within modal, never escape to background\n"
            "- Escape key: must close modal reliably\n"
            "- Back gesture (mobile): must close modal, not navigate back in Telegram\n\n"
            "EDGE CASES TO CHECK:\n"
            "- iPhone SE 375px: close button fully visible and tappable\n"
            "- 390px: standard mobile with Telegram top bar overlay\n"
            "- 768px tablet: close button position comfortable\n"
            "- 1024px desktop: Escape key works, click-outside-to-close works\n"
            "- Telegram iOS: native back button top-left must not overlap\n"
            "- Telegram Android: native header may differ — test safe-area\n"
            "- Telegram Desktop: no native overlay, but layout must not shift\n\n"
            "REFERENCE: Modal close position from redesign images — button should be in top-left or safe-zone position.\n\n"
            "DONE WHEN: Close button always visible and tappable on ALL Telegram platforms, "
            "focus never escapes modal, Escape always works, back gesture closes modal.\n\n"
            "PR RULES:\n"
            "- PR title MUST start with \"⚡:\" — this triggers auto-merge. Example: ⚡: polish item-modal-safe-close\n"
            "- Commit message: \"lera was here\"\n"
            "- PR body MUST contain: supaplan_task: 7f3f6f90-6d6c-4062-b31f-8ef872746ecf\n\n"
            "AFTER PR IS CREATED:\n"
            "Send the Hollywood victory notification (notification_part2 from this task's metadata) to Telegram:\n"
            "node scripts/codex-notify.mjs telegram --chatId 417553377 --text \"<notification_part2>\"\n"
            "Use real line breaks. Telegram parse_mode is Markdown."
        ),

        "notification_part2": (
            "🔥 MISSION COMPLETE: «Тень Телеграма».\n\n"
            "Полировка завершена: модалка теперь послушная — кнопка закрытия на месте, "
            "фокус в ловушке, Escape работает, жест назад не ломает навигацию. "
            "Тень изгнана.\n\n"
            "🎖 Achievement: «Экзорцист Интерфейса» — ты изгнала призрака из модалки.\n"
            "🎨 Skin dropped: «Safe Zone Phantom» — модалка с подсветкой safe-zone при отладке. "
            "Невидимая защита, которая всегда на страже.\n\n"
            "👀 Спойлер: карта оживает на весь экран — и снизу поднимается панель как в такси.\n"
            "🔓 Next cheatcode: 8c95e4ef-fb84-4adb-8c95-4fdd6dbf6556\n"
            "🎯 Next target: map-riders-taxi-sheet"
        ),

        "quest_lore": "Telegram прячет свои элементы поверх наших — тень поверх света. Safe-zone — это граница между нашим миром и их. Очисть её.",
    },

    # ═══════════════════════════════════════════════════════
    # QUEST 5: Орбита Райдера
    # ═══════════════════════════════════════════════════════
    {
        "id": "8c95e4ef-fb84-4adb-8c95-4fdd6dbf6556",
        "title": "[QUEST][LERA] Орбита Райдера",
        "chain_order": 5,
        "quest_name": "Орбита Райдера",
        "target_task_name": "map-riders-taxi-sheet",
        "next_quest_uuid": "c3e24996-d123-4f7b-9da9-1ce53f2b2ec5",
        "next_target": "bike-bottom-nav-routing",

        "notification_part1": (
            "🎬 МИССИЯ «Орбита Райдера» АКТИВИРОВАНА.\n\n"
            "Ты уже это построила: карта райдеров развёрнута на полный экран "
            "с нижней панелью как в такси-приложениях — свайп вверх/вниз, "
            "жесты картой активны, z-index наложен правильно. "
            "Карта теперь не кусочек экрана — она и ЕСТЬ экран.\n\n"
            "🏆 Ачивка открыта: «Штурман Карты» — ты развернула навигацию на максимум.\n\n"
            "Но присмотрись... панель может дёргаться при свайпе, "
            "карта может терять жесты, на планшете всё может выглядеть иначе. Хочешь довести до идеала?\n\n"
            "🔓 Cheatcode: 8c95e4ef-fb84-4adb-8c95-4fdd6dbf6556\n"
            "🎯 Открой задачу: https://codex.x.ai/tasks/map-riders-taxi-sheet\n\n"
            "Карта — это территория. Освой её."
        ),

        "polish_instructions": (
            "Review and polish task: map-riders-taxi-sheet.\n\n"
            "FOCUS: Full-screen map + bottom overhang sheet (taxi-app style). "
            "This is a complex interaction pattern — map gestures and sheet drag must coexist without conflict.\n"
            "- Full-screen map: fills viewport, no white gaps, marker clustering clean\n"
            "- Bottom sheet: peek state (30%), half state (50%), full state (100%) — smooth transitions\n"
            "- Map gestures: drag/zoom on map must work even when sheet is partially covering it\n"
            "- Sheet drag: vertical drag on sheet handle must NOT trigger map pan\n"
            "- Z-index layering: sheet above map, map controls above sheet peek\n\n"
            "EDGE CASES TO CHECK:\n"
            "- iPhone SE 375px: sheet peek shows essential info, map still interactive above\n"
            "- 390px: standard mobile, sheet half-state reveals rider details\n"
            "- 768px tablet: sheet wider, maybe side-panel instead of bottom\n"
            "- 1024px desktop: sheet as sidebar or wide bottom panel\n"
            "- Drag conflict: sheet drag vs map pan — must be distinguishable by touch origin\n"
            "- Fast swipe: sheet should fling to nearest snap point, not stop mid-way\n"
            "- Background scroll: page must NOT scroll when interacting with map or sheet\n\n"
            "REFERENCE: Taxi-map + bottom sheet from redesign image #1 — the sheet peek, handle, and map interaction pattern.\n\n"
            "DONE WHEN: Map and sheet coexist peacefully, drag never conflicts, sheet snaps to states, "
            "map always interactive above sheet, no background scroll bleed.\n\n"
            "PR RULES:\n"
            "- PR title MUST start with \"⚡:\" — this triggers auto-merge. Example: ⚡: polish map-riders-taxi-sheet\n"
            "- Commit message: \"lera was here\"\n"
            "- PR body MUST contain: supaplan_task: 8c95e4ef-fb84-4adb-8c95-4fdd6dbf6556\n\n"
            "AFTER PR IS CREATED:\n"
            "Send the Hollywood victory notification (notification_part2 from this task's metadata) to Telegram:\n"
            "node scripts/codex-notify.mjs telegram --chatId 417553377 --text \"<notification_part2>\"\n"
            "Use real line breaks. Telegram parse_mode is Markdown."
        ),

        "notification_part2": (
            "🔥 MISSION COMPLETE: «Орбита Райдера».\n\n"
            "Полировка завершена: карта и панель живут в гармонии — "
            "свайп панели не двигает карту, карта не крадёт жесты у панели, "
            "snap-точки как в Uber. Райдеры на орбите.\n\n"
            "🎖 Achievement: «Картограф Безграничности» — ты картографировала бесконечную карту.\n"
            "🎨 Skin dropped: «Overhang Orbit» — панель с эффектом орбитального свечения на handle. "
            "Райдер всегда видит горизонт.\n\n"
            "👀 Спойлер: нижняя навигация прокладывает маршрут к байкам.\n"
            "🔓 Next cheatcode: c3e24996-d123-4f7b-9da9-1ce53f2b2ec5\n"
            "🎯 Next target: bike-bottom-nav-routing"
        ),

        "quest_lore": "Карта — окно в мир райдеров. Каждый маркер — живой человек. Нижняя панель — это мост между наблюдателем и участником.",
    },

    # ═══════════════════════════════════════════════════════
    # QUEST 6: Пульс Навигации
    # ═══════════════════════════════════════════════════════
    {
        "id": "c3e24996-d123-4f7b-9da9-1ce53f2b2ec5",
        "title": "[QUEST][LERA] Пульс Навигации",
        "chain_order": 6,
        "quest_name": "Пульс Навигации",
        "target_task_name": "bike-bottom-nav-routing",
        "next_quest_uuid": "66f0fc93-8f71-4a2d-9bfa-7db17d1cd8f7",
        "next_target": "telegram-start-promo-capture",

        "notification_part1": (
            "🎬 МИССИЯ «Пульс Навигации» АКТИВИРОВАНА.\n\n"
            "Ты уже это построила: нижняя навигация для байков включена в franchize-поверхностях, "
            "ошибочная видимость /admin/map-routes убрана, пункты выровнены. "
            "Байкер теперь видит свой маршрут, а не админку.\n\n"
            "🏆 Ачивка открыта: «Навигатор Байков» — ты проложила маршрут для райдеров.\n\n"
            "Но присмотрись... навигация может некрасиво прыгать между разделами, "
            "активный таб может не подсвечиваться, а на iPhone SE всё может сжаться. Хочешь довести до идеала?\n\n"
            "🔓 Cheatcode: c3e24996-d123-4f7b-9da9-1ce53f2b2ec5\n"
            "🎯 Открой задачу: https://codex.x.ai/tasks/bike-bottom-nav-routing\n\n"
            "Каждый таб — пульс. Настрой ритм."
        ),

        "polish_instructions": (
            "Review and polish task: bike-bottom-nav-routing.\n\n"
            "FOCUS: Enable bike bottom nav in franchize surfaces, remove admin route leakage, align entries. "
            "This is a NAVIGATION task — users tap this hundreds of times per session.\n"
            "- Bottom nav: visible on all franchize pages, correct entries for bike context\n"
            "- Active tab: visually distinct (filled icon + label + color), inactive = outline + dim\n"
            "- Admin routes: /admin/map-routes must NOT appear in user-facing nav — verify all surfaces\n"
            "- Alignment: icons centered in touch target, labels aligned, consistent spacing\n\n"
            "EDGE CASES TO CHECK:\n"
            "- iPhone SE 375px: 4-5 tabs must fit without overlap, labels may hide on overflow\n"
            "- 390px: standard mobile, all tabs visible with labels\n"
            "- 768px tablet: wider tab bar, consider side nav for landscape\n"
            "- 1024px desktop: bottom nav may convert to sidebar — verify transition\n"
            "- Tab transitions: switching tabs should be instant, no flash of wrong content\n"
            "- Deep links: navigating to a page should highlight the correct tab\n"
            "- Badge/notifications on tabs: count badges must not shift layout\n\n"
            "REFERENCE: Bottom navigation from redesign images — tab style, icon treatment, active state.\n\n"
            "DONE WHEN: Bottom nav appears correctly on all franchize surfaces, zero admin route leakage, "
            "active tab always highlighted, touch targets comfortable, no layout shift.\n\n"
            "PR RULES:\n"
            "- PR title MUST start with \"⚡:\" — this triggers auto-merge. Example: ⚡: polish bike-bottom-nav-routing\n"
            "- Commit message: \"lera was here\"\n"
            "- PR body MUST contain: supaplan_task: c3e24996-d123-4f7b-9da9-1ce53f2b2ec5\n\n"
            "AFTER PR IS CREATED:\n"
            "Send the Hollywood victory notification (notification_part2 from this task's metadata) to Telegram:\n"
            "node scripts/codex-notify.mjs telegram --chatId 417553377 --text \"<notification_part2>\"\n"
            "Use real line breaks. Telegram parse_mode is Markdown."
        ),

        "notification_part2": (
            "🔥 MISSION COMPLETE: «Пульс Навигации».\n\n"
            "Полировка завершена: нижняя панель как часовой механизм — "
            "активный таб подсвечен, админка не торчит, выравнивание идеальное, "
            "переходы мгновенные. Райдер всегда знает где он.\n\n"
            "🎖 Achievement: «Дирижёр Маршрутов» — ты дирижировала навигацией как симфонию.\n"
            "🎨 Skin dropped: «Route Pulse Badge» — пульсирующий бейдж на активном табе, "
            "как сердцебиение навигации.\n\n"
            "👀 Спойлер: стартовый экран получает секретный промо-код — и всё меняется.\n"
            "🔓 Next cheatcode: 66f0fc93-8f71-4a2d-9bfa-7db17d1cd8f7\n"
            "🎯 Next target: telegram-start-promo-capture"
        ),

        "quest_lore": "Навигация — пульс приложения. Каждый тап — удар сердца. Если ритм сбивается, пользователь теряется. Держи пульс ровным.",
    },

    # ═══════════════════════════════════════════════════════
    # QUEST 7: Код Стартера
    # ═══════════════════════════════════════════════════════
    {
        "id": "66f0fc93-8f71-4a2d-9bfa-7db17d1cd8f7",
        "title": "[QUEST][LERA] Код Стартера",
        "chain_order": 7,
        "quest_name": "Код Стартера",
        "target_task_name": "telegram-start-promo-capture",
        "next_quest_uuid": "c2d2e8d1-f047-44de-bad3-4f4f9073de61",
        "next_target": "promo-seed-and-checkout-link",

        "notification_part1": (
            "🎬 МИССИЯ «Код Стартера» АКТИВИРОВАНА.\n\n"
            "Ты уже это построила: Telegram /start теперь разбирает bike-oriented payload, "
            "сохраняет промо-код и метаданные профиля для vip-bike потока. "
            "Первый контакт с ботом — уже персонализированный.\n\n"
            "🏆 Ачивка открыта: «Взломщик Промо» — ты взломала стартовый код.\n\n"
            "Но присмотрись... payload может приходить в разных форматах, "
            "данные могут теряться при перезапуске, а обработка ошибок может молчать. Хочешь довести до идеала?\n\n"
            "🔓 Cheatcode: 66f0fc93-8f71-4a2d-9bfa-7db17d1cd8f7\n"
            "🎯 Открой задачу: https://codex.x.ai/tasks/telegram-start-promo-capture\n\n"
            "Первый шаг — самый важный. Он определяет всё."
        ),

        "polish_instructions": (
            "Review and polish task: telegram-start-promo-capture.\n\n"
            "FOCUS: Restore bike-oriented /start payload parsing and save promo code + survey profile metadata for vip-bike flow. "
            "This is the FRONT DOOR — first impression, zero tolerance for errors.\n"
            "- Payload parsing: handle multiple formats (deep_link, start_param, ref code)\n"
            "- Data persistence: promo code + metadata must survive app restarts\n"
            "- Error handling: every parse failure must have a graceful fallback, never silent\n"
            "- Profile metadata: save enough context for personalized onboarding\n\n"
            "EDGE CASES TO CHECK:\n"
            "- Empty /start (no payload): must still work, show default onboarding\n"
            "- Malformed payload: must not crash, must log warning\n"
            "- Stale promo code: expired codes must show friendly message\n"
            "- Multiple /start calls: must not duplicate data, must update if changed\n"
            "- Telegram iOS vs Android vs Desktop: payload format may differ\n"
            "- Very long payload: must not exceed DB column limits\n"
            "- Unicode in payload: must handle non-ASCII characters\n\n"
            "REFERENCE: /start flow from existing bot handlers — current implementation is the baseline.\n\n"
            "DONE WHEN: Every /start payload format is handled gracefully, data persists across restarts, "
            "zero silent errors, onboarding feels personalized from the very first tap.\n\n"
            "PR RULES:\n"
            "- PR title MUST start with \"⚡:\" — this triggers auto-merge. Example: ⚡: polish telegram-start-promo-capture\n"
            "- Commit message: \"lera was here\"\n"
            "- PR body MUST contain: supaplan_task: 66f0fc93-8f71-4a2d-9bfa-7db17d1cd8f7\n\n"
            "AFTER PR IS CREATED:\n"
            "Send the Hollywood victory notification (notification_part2 from this task's metadata) to Telegram:\n"
            "node scripts/codex-notify.mjs telegram --chatId 417553377 --text \"<notification_part2>\"\n"
            "Use real line breaks. Telegram parse_mode is Markdown."
        ),

        "notification_part2": (
            "🔥 MISSION COMPLETE: «Код Стартера».\n\n"
            "Полировка завершена: /start теперь как швейцарский замок — "
            "любой payload разбирается, данные не теряются, ошибки не молчат, "
            "а каждый пользователь получает персональный вход с первой секунды.\n\n"
            "🎖 Achievement: «Мастер Ключей» — ты выковала ключ, который открывает любую дверь.\n"
            "🎨 Skin dropped: «Quantum Keychain» — анимация разблокировки при /start. "
            "Ключ поворачивается, замок мерцает, дверь открывается.\n\n"
            "👀 Спойлер: промо-код превращается в покупку — одна ссылка, и чек оформлен.\n"
            "🔓 Next cheatcode: c2d2e8d1-f047-44de-bad3-4f4f9073de61\n"
            "🎯 Next target: promo-seed-and-checkout-link"
        ),

        "quest_lore": "Первый контакт — решающий. /start — это не команда, это церемония. Промо-код — приглашение, а не просто строка.",
    },

    # ═══════════════════════════════════════════════════════
    # QUEST 8: Печать Промо — FINALE
    # ═══════════════════════════════════════════════════════
    {
        "id": "c2d2e8d1-f047-44de-bad3-4f4f9073de61",
        "title": "[QUEST][LERA] Печать Промо",
        "chain_order": 8,
        "quest_name": "Печать Промо",
        "target_task_name": "promo-seed-and-checkout-link",
        "next_quest_uuid": "NONE",
        "next_target": "NONE",

        "notification_part1": (
            "🎬 МИССИЯ «Печать Промо» АКТИВИРОВАНА — ФИНАЛЬНАЯ.\n\n"
            "Ты уже это построила: промо-ссылки нормализованы в t.me start-параметры, "
            "UI применения подключён в корзине/чекеуте, валидация через серверный экшен работает. "
            "Промо-код — это уже не просто текст, а ключ к покупке.\n\n"
            "🏆 Ачивка открыта: «Печатник Ссылок» — ты поставила печать на каждый промо-код.\n\n"
            "Но присмотрись... ссылки могут терять параметры при переходе, "
            "валидация может быть слишком строгой, а UI применения может быть незаметным. Хочешь довести до идеала?\n\n"
            "🔓 Cheatcode: c2d2e8d1-f047-44de-bad3-4f4f9073de61\n"
            "🎯 Открой задачу: https://codex.x.ai/tasks/promo-seed-and-checkout-link\n\n"
            "Последняя печать. Закрой цепь."
        ),

        "polish_instructions": (
            "Review and polish task: promo-seed-and-checkout-link.\n\n"
            "FOCUS: Normalize promo links to t.me start param, wire apply UI in checkout/cart, "
            "and validate against existing server action. This closes the monetization loop.\n"
            "- Link normalization: any promo URL → t.me/bot?start=CODE format\n"
            "- Apply UI: visible in cart AND checkout, clear feedback on apply/fail\n"
            "- Server validation: validate promo code, apply discount, show updated total\n"
            "- Error states: expired, invalid, already-used codes must each have distinct messages\n\n"
            "EDGE CASES TO CHECK:\n"
            "- Link with UTM params: must strip UTM and keep promo code\n"
            "- Multiple promo codes: only one active at a time, clear which is applied\n"
            "- Cart total updates: discount must recalculate in real-time\n"
            "- Network errors: must not lose cart state on validation failure\n"
            "- Deep link from Telegram: must preserve promo through full navigation flow\n"
            "- Direct URL entry: must handle manually-typed promo codes\n"
            "- Zero-cart checkout: promo on empty cart must be handled gracefully\n\n"
            "REFERENCE: Checkout flow from existing cart implementation.\n\n"
            "DONE WHEN: Promo link survives the full navigation chain, apply UI is impossible to miss, "
            "validation is instant and clear, discount shows in real-time, zero cart state loss.\n\n"
            "PR RULES:\n"
            "- PR title MUST start with \"⚡:\" — this triggers auto-merge. Example: ⚡: polish promo-seed-and-checkout-link\n"
            "- Commit message: \"lera was here\"\n"
            "- PR body MUST contain: supaplan_task: c2d2e8d1-f047-44de-bad3-4f4f9073de61\n\n"
            "AFTER PR IS CREATED:\n"
            "Send the GRAND FINALE Hollywood notification (notification_part2 from this task's metadata) to Telegram:\n"
            "node scripts/codex-notify.mjs telegram --chatId 417553377 --text \"<notification_part2>\"\n"
            "Use real line breaks. Telegram parse_mode is Markdown. THIS IS THE CHAIN FINALE — make it count."
        ),

        "notification_part2": (
            "🔥🔥🔥 CHAIN COMPLETE: «Печать Промо» — ФИНАЛЬНАЯ МИССИЯ ЗАВЕРШЕНА 🔥🔥🔥\n\n"
            "Полировка завершена: промо-коды теперь как печати — "
            "каждая ссылка ведёт к покупке, каждый код валидируется мгновенно, "
            "скидка пересчитывается на лету, корзина не теряет состояние.\n\n"
            "🎖 Achievement: «Архитект Системы» — ты построила полный конвейер от первого клика до чекаут.\n"
            "🎨 Skin dropped: «Golden Chain Complete» — легендарный скин. "
            "Вся цепь собрана. Каждое звено — твой PR. Каждая печать — твой код. "
            "Карбон, неон, золото, бархат, орбита, пульс, ключи, печать — коллекция полна.\n\n"
            "🏆 8 из 8 миссий завершены. 8 PR создано. 8 ачивок собрано. 8 скинов получено.\n"
            "Витрина перерождена. И это — ТВОЯ работа.\n\n"
            "💫 Цепь замкнута. Империя построена. Lera was here."
        ),

        "quest_lore": "Последнее звено цепи. Промо-код — это не скидка, это обещание. Печать превращает обещание в покупку. Без печати — нет империи.",
    },
]


def build_body(q):
    """Build the body field with all quest data + embedded agent protocol."""
    parts = []

    # Quest metadata header
    parts.append(f"quest_name: {q['quest_name']}")
    parts.append(f"chain_order: {q['chain_order']}")
    parts.append(f"next_quest_uuid: {q['next_quest_uuid']}")
    parts.append(f"target_task_name: {q['target_task_name']}")
    parts.append(f"client_chat_id: {CLIENT_CHAT_ID}")
    parts.append(f"commit_signature: {COMMIT_SIGNATURE}")
    parts.append("")

    # Agent protocol (embedded for branches without BOSS_QUEST.HTML)
    protocol = AGENT_PROTOCOL_TEMPLATE.format(
        uuid=q["id"],
        target_task_name=q["target_task_name"],
        commit_signature=COMMIT_SIGNATURE,
        notify_script=NOTIFY_SCRIPT,
        client_chat_id=CLIENT_CHAT_ID,
    )
    parts.append("--- AGENT PROTOCOL (embedded) ---")
    parts.append(protocol)
    parts.append("--- END AGENT PROTOCOL ---")
    parts.append("")

    # Lore
    parts.append(f"quest_lore: {q['quest_lore']}")
    parts.append("")

    # Notification part 1 (sent by Boss)
    parts.append("notification_part1 (sent by Boss when quest activated):")
    parts.append(q["notification_part1"])
    parts.append("")

    # Polish instructions (the agent's job)
    parts.append("polish_instructions:")
    parts.append(q["polish_instructions"])
    parts.append("")

    # Notification part 2 (sent by executive agent after PR)
    parts.append("notification_part2 (sent by executive agent after PR created):")
    parts.append(q["notification_part2"])

    return "\n".join(parts)


def build_metadata(q):
    """Build the metadata JSON object."""
    is_finale = q["chain_order"] == 8
    return {
        "quest_name": q["quest_name"],
        "chain_order": q["chain_order"],
        "next_quest_uuid": q["next_quest_uuid"],
        "target_task_name": q["target_task_name"],
        "client_chat_id": CLIENT_CHAT_ID,
        "commit_signature": COMMIT_SIGNATURE,
        "quest_lore": q["quest_lore"],
        "notification_part1": q["notification_part1"],
        "notification_part2": q["notification_part2"],
        "polish_instructions": q["polish_instructions"],
        "agent_protocol_embedded": True,
        "agent_protocol_source": "Quest Chain Generator v4.0 — Agent Executive section",
        "supaplan_ref_required": f"supaplan_task: {q['id']}",
        "pr_title_prefix": "⚡:",
        "chain_finale": is_finale,
        "notification_sender_part1": "boss",
        "notification_sender_part2": "executive_agent",
        "codex_deep_link": f"https://codex.x.ai/tasks/{q['target_task_name']}",
    }


def validate_chain(quests):
    """Validate chain integrity: UUIDs match, no orphans, no duplicates."""
    errors = []

    # Check all UUIDs are unique
    uuids = [q["id"] for q in quests]
    if len(uuids) != len(set(uuids)):
        errors.append("DUPLICATE UUIDs detected!")

    # Check chain ordering
    for i, q in enumerate(quests):
        expected_order = i + 1
        if q["chain_order"] != expected_order:
            errors.append(f"Quest {q['quest_name']}: chain_order={q['chain_order']}, expected={expected_order}")

        # Check next_quest_uuid points to actual next quest
        if q["next_quest_uuid"] == "NONE":
            if i != len(quests) - 1:
                errors.append(f"Quest {q['quest_name']}: next_quest_uuid=NONE but not last in chain")
        else:
            if i + 1 < len(quests):
                if q["next_quest_uuid"] != quests[i + 1]["id"]:
                    errors.append(
                        f"Quest {q['quest_name']}: next_quest_uuid={q['next_quest_uuid']} "
                        f"but next quest id={quests[i + 1]['id']}"
                    )
            else:
                errors.append(f"Quest {q['quest_name']}: has next_quest_uuid but is last in array")

    # Check achievements/skins/spoilers are unique (Uniqueness Mandate)
    achievements = set()
    skins = set()
    spoilers = set()
    for q in quests:
        part2 = q["notification_part2"]
        for line in part2.split("\n"):
            if "Achievement:" in line:
                ach = line.split("Achievement:")[1].strip()
                if ach in achievements:
                    errors.append(f"DUPLICATE achievement: {ach}")
                achievements.add(ach)
            if "Skin dropped:" in line:
                skin = line.split("Skin dropped:")[1].strip()
                if skin in skins:
                    errors.append(f"DUPLICATE skin: {skin}")
                skins.add(skin)
            if "Спойлер:" in line:
                sp = line.split("Спойлер:")[1].strip()
                if sp in spoilers:
                    errors.append(f"DUPLICATE spoiler: {sp}")
                spoilers.add(sp)

    # Check no PR instructions in notification_part2
    for q in quests:
        part2 = q["notification_part2"]
        if "Создай PR" in part2 or "⚡:" in part2:
            errors.append(
                f"Quest {q['quest_name']}: notification_part2 contains PR instructions! "
                f"These should be in polish_instructions only."
            )

    # Check no literal \n in notifications
    for q in quests:
        for field in ["notification_part1", "notification_part2"]:
            text = q[field]
            if "\\n" in text and not text.startswith("\\n"):
                # Check if it's a Python raw \n (which is fine) vs literal \n string
                pass  # In Python source, \n is real newline — this is correct

    return errors


def main():
    print("⚔️ Quest Chain Generator v4.0 — Cranked to 13")
    print("=" * 60)

    # Validate
    errors = validate_chain(quests)
    if errors:
        print("❌ VALIDATION ERRORS:")
        for e in errors:
            print(f"   - {e}")
        sys.exit(1)
    else:
        print("✅ Chain validation passed")
        print(f"   - {len(quests)} quests in chain")
        print(f"   - All UUIDs unique")
        print(f"   - All next_quest_uuid links valid")
        print(f"   - All achievements/skins/spoilers unique (Uniqueness Mandate)")
        print(f"   - No PR instructions in notification_part2")

    # Generate CSV
    with open(OUTPUT_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f, quoting=csv.QUOTE_ALL)

        # Header
        writer.writerow([
            "id", "title", "body", "todo_path", "plugin",
            "capability", "status", "created_by", "created_at",
            "updated_at", "metadata", "pr_url"
        ])

        for q in quests:
            body = build_body(q)
            metadata = build_metadata(q)
            metadata_json = json.dumps(metadata, ensure_ascii=False)

            writer.writerow([
                q["id"],
                q["title"],
                body,
                "/BOSS_QUEST.HTML",
                "",
                "franchize.gamification",
                "open",
                "boss-agent",
                "2026-05-19 10:51:09.65499+00",
                "2026-05-19 10:51:09.65499+00",
                metadata_json,
                "",
            ])

    print(f"\n✅ CSV written: {OUTPUT_CSV}")
    print(f"   Size: {OUTPUT_CSV.stat().st_size:,} bytes")

    # Print quest chain summary
    print("\n📋 QUEST CHAIN:")
    for q in quests:
        is_finale = " 👑 FINALE" if q["chain_order"] == 8 else ""
        print(f"   {q['chain_order']}. {q['quest_name']} → {q['target_task_name']}{is_finale}")
        print(f"      UUID: {q['id']}")

    print("\n🧭 NOTIFICATION FLOW:")
    print("   notification_part1 → Sent by BOSS when quest chain is created/activated")
    print("   notification_part2 → Sent by EXECUTIVE AGENT after PR is created")
    print("   PR title rules     → ONLY in polish_instructions (never in notifications)")

    print("\n🎯 CODEX DEEP LINKS:")
    for q in quests:
        print(f"   Quest {q['chain_order']}: https://codex.x.ai/tasks/{q['target_task_name']}")

    print("\n✨ Done. Lera's gonna be impressed.")


if __name__ == "__main__":
    main()
