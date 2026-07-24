#!/usr/bin/env node
/**
 * Quest Chain Generator — v5.0 "Straight Links"
 * ══════════════════════════════════════════════════════════════
 *
 * Translated from Python v4 to Node.js mjs for Boss (Codex) native runtime.
 *
 * v4→v5 changes:
 *   ✅ Translated to .mjs (Boss runs Node, not Python)
 *   ✅ Codex task URLs EVERYWHERE — default https://chatgpt.com/codex/cloud
 *   ✅ "Straight link" philosophy: eliminate "find I don't know what" friction
 *   ✅ Aligned with SupaPlan operator protocol (pick-task → running → log-event → ready_for_pr → callback-auto)
 *   ✅ Agent protocol never sets "done" — only claimed/running/ready_for_pr
 *   ✅ Agent logs events via supaplan-skill.mjs log-event
 *   ✅ Final notification uses callback-auto (in addition to telegram Hollywood)
 *   ✅ PR creation instructions crystal clear: ⚡: in title = auto-merge, no scroll, no click
 *
 * USAGE:
 *   node skills/quest-chain-generator/generator.mjs
 *   node skills/quest-chain-generator/generator.mjs --output /path/to/output.csv
 *   node skills/quest-chain-generator/generator.mjs --validate-only
 */

import { writeFileSync, statSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Configuration ───
const CONFIG = {
  clientChatId: "417553377",
  commitSignature: "lera was here",
  notifyScript: "node scripts/codex-notify.mjs",
  supaplanScript: "node scripts/supaplan-skill.mjs",
  // Default Codex task URL — gets user straight to task list
  // Replace with actual task URLs when available
  codexTaskUrlBase: "https://chatgpt.com/codex/cloud",
  // Default to ./output/ in the current working directory (not a hardcoded
  // /home/z/my-project/download/ path that doesn't exist on other machines).
  // Override with --output /path/to/file.csv
  outputDir: "./output",
  outputFilename: "supaplan_tasks_ULTIMATE_v5.csv",
};

/**
 * Build Codex task URL.
 * If a specific URL is provided, use it. Otherwise fall back to base URL.
 * @param {string} taskName - e.g. "franchize-header-reflow"
 * @param {string} [specificUrl] - Override URL if known
 */
function codexUrl(taskName, specificUrl) {
  if (specificUrl) return specificUrl;
  // Default: base URL — user lands on task list, their task is first after "plan boss task"
  return CONFIG.codexTaskUrlBase;
}

// ─── Agent Executive Protocol Template ───
const agentProtocolTemplate = ({ uuid, targetTaskName, taskUrl }) => `
AGENT EXECUTIVE PROTOCOL (self-contained — no external doc needed):
When a client pastes this task's UUID (cheatcode) into your chat, follow these steps EXACTLY:

STEP 1: RECOGNIZE THE CHEATCODE
Client sends the UUID for this task: ${uuid}
This means the client has unlocked a quest. Read the polish_instructions below.

STEP 2: CLAIM THE TASK
Run: ${CONFIG.supaplanScript} pick-task --capability franchize.gamification --agentId codex-$(date +%s)
This sets the task status to "claimed" and reserves it for you.

STEP 3: SET STATUS TO RUNNING
Run: ${CONFIG.supaplanScript} update-status --taskId ${uuid} --status running
This signals you're actively working on the task.

STEP 4: EXECUTE POLISH
Perform the surgical polishing pass described in polish_instructions.
Be specific, not generic. Check every edge case listed.
This is the core work — take your time, be thorough.

STEP 5: LOG PROGRESS
Run: ${CONFIG.supaplanScript} log-event --type task_progress --payload '{"taskId":"${uuid}","step":"polished"}'

STEP 6: CREATE PR WITH ⚡: PREFIX
PR title MUST start with "⚡:" — this triggers the auto-merge GitHub workflow.
The PR will merge AUTOMATICALLY — no "View PR" click, no scroll, no manual merge.
Example: ⚡: polish ${targetTaskName}
Commit message: "${CONFIG.commitSignature}" (the champion signature)

STEP 7: INCLUDE supaplan_task IN PR BODY
Add "supaplan_task: ${uuid}" as a standalone line in the PR description.
This is REQUIRED for the merge workflow to promote the SupaPlan task status to "done".
NEVER set status to "done" yourself — the merge workflow does this automatically.

STEP 8: SET STATUS TO ready_for_pr
Run: ${CONFIG.supaplanScript} update-status --taskId ${uuid} --status ready_for_pr
(Agents may only set: claimed, running, ready_for_pr. Never "done".)

STEP 9: SEND HOLLYWOOD NOTIFICATION
After PR is created, send the victory notification (notification_part2 from metadata)
to the client's Telegram via the notification skill:
${CONFIG.notifyScript} telegram --chatId ${CONFIG.clientChatId} --text "<notification_part2>"
CRITICAL: Use REAL line breaks (not literal \\n). Telegram parse_mode is Markdown.

STEP 10: SEND CALLBACK NOTIFICATION (bridge)
Also send a callback notification for the SupaPlan bridge:
${CONFIG.notifyScript} callback-auto --status completed --summary "SupaPlan task ${uuid} moved to ready_for_pr" --taskPath "/supaplan"

CRITICAL RULES:
- ⚡: prefix in PR title is MANDATORY — no exceptions, no typos. This enables AUTO-MERGE.
- supaplan_task: ${uuid} in PR body is MANDATORY — merge automation depends on it.
- Champion signature commit "${CONFIG.commitSignature}" is MANDATORY.
- NEVER set task status to "done" — only claimed, running, ready_for_pr are agent-safe.
- notification_part2 must use REAL line breaks, never literal \\n characters.
- Send notifications AFTER PR is created, not before.
- If task is still running when client asks: "Still cooking. Come back in ~5 minutes. The cheatcode never expires."
`.trim();

// ─── Quest Definitions ───
const quests = [
  {
    id: "f3c5306d-2d8f-4cc4-bb77-26f20f7f9b11",
    title: "[QUEST][LERA] Матрица Шапки",
    chain_order: 1,
    quest_name: "Матрица Шапки",
    target_task_name: "franchize-header-reflow",
    next_quest_uuid: "be32ce57-a1f5-4401-a307-311ec56ba68f",
    next_target: "catalog-9x16-cards",
    // TODO: Replace with actual Codex task URL when available
    task_url: null,

    notification_part1: [
      "🎬 ЛЕРА, ГЛАВНАЯ ГЕРОИНЯ В ЭФИРЕ.",
      "МИССИЯ «Матрица Шапки» АКТИВИРОВАНА.",
      "",
      "Ты уже это построила: шапка витрины перезапущена как кибер-панель — логотип слева, секции по центру, профиль компактный, корзина встроена в рельс. Это уже не просто навигация — это командный центр.",
      "",
      "🏆 Ачивка открыта: «Сигнал Из Матрицы» — ты вошла в систему.",
      "",
      "Но присмотрись... есть шероховатости. Щели, выравнивание, safe-area под ТГ-кнопками — всё это ждёт твоей руки.",
      "",
      "🔓 Твой cheatcode: f3c5306d-2d8f-4cc4-bb77-26f20f7f9b11",
      "🎯 Прямая ссылка: https://chatgpt.com/codex/cloud",
      "",
      "Вставь cheatcode в чат Codex — и polishing начнётся. Ты не догоняешь миссию. Ты ЕЁ СОЗДАЁШЬ.",
    ].join("\n"),

    polish_instructions: [
      "Review and polish task: franchize-header-reflow.",
      "",
      "FOCUS: Header & rail redesign. This is the FIRST thing users see — it must be flawless.",
      "- Logo: anchored left, crisp at all sizes, no pixelation",
      "- Section tabs: centered between logo and profile, active tab visually dominant (underline or glow)",
      "- Inline cart: visible but not intrusive, badge count prominent",
      "- Profile button: compact, right-aligned, safe-area clearance for Telegram native back button",
      "",
      "EDGE CASES TO CHECK:",
      "- iPhone SE 375px: tabs must not wrap or truncate",
      "- 390px: standard mobile, touch targets 44px minimum",
      "- 768px tablet: tabs spread comfortably, cart badge visible",
      "- 1024px desktop: full rail, generous spacing",
      "- Telegram safe-area: top overlay (back button, header) must NOT overlap with header controls",
      "- Hover/focus/active states on all interactive elements",
      "- Header must be sticky/fixed without content jumping",
      "",
      "REFERENCE: compare against redesign images — header composition from image #2 is your north star. The rail structure, logo placement, and compact profile are all there.",
      "",
      "DONE WHEN: No overlapping controls, visual hierarchy is immediate in 1-second glance, zero horizontal scroll on any breakpoint, cart badge always visible.",
      "",
      "PR RULES (CRITICAL):",
      '- PR title MUST start with "⚡:" — this triggers AUTO-MERGE. No scroll, no click, no manual merge.',
      "- Example: ⚡: polish franchize-header-reflow",
      '- Commit message: "lera was here"',
      "- PR body MUST contain: supaplan_task: f3c5306d-2d8f-4cc4-bb77-26f20f7f9b11",
      "- When user clicks 'Create PR', the ⚡: prefix ensures the PR auto-merges. User never has to click 'View PR' or scroll to merge.",
      "",
      "AFTER PR IS CREATED:",
      "1. Set task status: node scripts/supaplan-skill.mjs update-status --taskId f3c5306d-2d8f-4cc4-bb77-26f20f7f9b11 --status ready_for_pr",
      "2. Send Hollywood notification: node scripts/codex-notify.mjs telegram --chatId 417553377 --text \"<notification_part2>\"",
      "   Use real line breaks. Telegram parse_mode is Markdown.",
      "3. Send bridge callback: node scripts/codex-notify.mjs callback-auto --status completed --summary \"Task ready_for_pr\" --taskPath /supaplan",
    ].join("\n"),

    notification_part2: [
      "🔥 MISSION COMPLETE: «Матрица Шапки».",
      "",
      "Полировка завершена: шапка теперь как лазерный луч — логотип на месте, табы по центру, корзина в поле зрения, safe-area чистый. Ни одного пикселя мимо.",
      "",
      "🎖 Achievement: «Неон-Хирург» — ты прооперировала хедер с точностью до пикселя.",
      "🎨 Skin dropped: «Carbon Gold Precision» — премиум-скин командного центра. Тёмный карбон, золотые акценты, хрустальная чёткость.",
      "",
      "👀 Спойлер: витрина переоденется — карточки станут вертикальными, как постеры к фильму.",
      "🔓 Next cheatcode: be32ce57-a1f5-4401-a307-311ec56ba68f",
      "🎯 Прямая ссылка: https://chatgpt.com/codex/cloud",
    ].join("\n"),

    quest_lore: "Командный центр — начало пути. Каждая империя начинается с контроля над входом. Шапка — это не навигация, это пульт управления.",
  },

  {
    id: "be32ce57-a1f5-4401-a307-311ec56ba68f",
    title: "[QUEST][LERA] Клинок Витрины",
    chain_order: 2,
    quest_name: "Клинок Витрины",
    target_task_name: "catalog-9x16-cards",
    next_quest_uuid: "bf4cb2c2-e3db-4f08-81f2-9b6e96cf5b10",
    next_target: "catalog-swipe-ticker",
    task_url: null,

    notification_part1: [
      "🎬 МИССИЯ «Клинок Витрины» АКТИВИРОВАНА.",
      "",
      "Ты уже это построила: карточки товаров перерождены в 9:16 вертикальные hero-карты — графитовый градиент-мост, компактные характеристики, нулевые цены скрыты. Витрина теперь как каталог киберпанк-журнала.",
      "",
      "🏆 Ачивка открыта: «Архитектор Референсов» — ты спроектировала новый формат.",
      "",
      "Но присмотрись... градиенты могут резать глаз, текст может наезжать, соотношение сторон на разных экранах — пока загадка.",
      "",
      "🔓 Твой cheatcode: be32ce57-a1f5-4401-a307-311ec56ba68f",
      "🎯 Прямая ссылка: https://chatgpt.com/codex/cloud",
      "",
      "Каждая карточка — клинок. Заточи его.",
    ].join("\n"),

    polish_instructions: [
      "Review and polish task: catalog-9x16-cards.",
      "",
      "FOCUS: Rebuild item cards as 9:16 hero cards. This is the CORE product experience — cards must feel premium and scannable.",
      "- Graphite gradient bridge: smooth, not harsh — transition from image to info area",
      "- Specs: concise, readable, no overflow — ellipsis for long text",
      '- Zero-price items: prices with value 0 must be HIDDEN entirely (no "0 ₽" ever)',
      "- Card aspect ratio: strict 9:16 on all breakpoints — no stretching or squishing",
      "- Image area: dominant, fills top portion, no letterboxing",
      "",
      "EDGE CASES TO CHECK:",
      "- iPhone SE 375px: single column, card fills width comfortably",
      "- 390px: standard mobile, swipe between cards should feel smooth",
      "- 768px tablet: 2-column grid, cards maintain 9:16",
      "- 1024px desktop: 3-4 columns, hover state reveals quick-action overlay",
      "- Long product names: truncate gracefully with ellipsis",
      "- Products without images: placeholder gradient, no broken image icon",
      "- Price display: always formatted, never raw number",
      "",
      "REFERENCE: Card ratio/gradient from redesign image #2 — the gradient bridge and text layout are your guide.",
      "",
      'DONE WHEN: Every card looks like a poster, gradient is buttery, zero-price items never show "0", no text overflow anywhere, 9:16 ratio maintained on all breakpoints.',
      "",
      "PR RULES (CRITICAL):",
      '- PR title MUST start with "⚡:" — this triggers AUTO-MERGE. No scroll, no click, no manual merge.',
      "- Example: ⚡: polish catalog-9x16-cards",
      '- Commit message: "lera was here"',
      "- PR body MUST contain: supaplan_task: be32ce57-a1f5-4401-a307-311ec56ba68f",
      "",
      "AFTER PR IS CREATED:",
      "1. Set task status: node scripts/supaplan-skill.mjs update-status --taskId be32ce57-a1f5-4401-a307-311ec56ba68f --status ready_for_pr",
      "2. Send Hollywood notification: node scripts/codex-notify.mjs telegram --chatId 417553377 --text \"<notification_part2>\"",
      "3. Send bridge callback: node scripts/codex-notify.mjs callback-auto --status completed --summary \"Task ready_for_pr\" --taskPath /supaplan",
    ].join("\n"),

    notification_part2: [
      "🔥 MISSION COMPLETE: «Клинок Витрины».",
      "",
      "Полировка завершена: карточки теперь как обложки — градиент мягкий, характеристики читаются с одного взгляда, нули спрятаны, 9:16 идеален на любом экране. Витрина стала журналом.",
      "",
      "🎖 Achievement: «Гладиатор Пикселей» — ты сразилась за каждый пиксель и победила.",
      "🎨 Skin dropped: «Neon Drift Overlay» — hover-оверлей с неоновым свечением на карточках. При наведении — пульс, при уходе — шёпот.",
      "",
      "👀 Спойлер: бегущая строка с пульсом — маленькие коллекции оживут.",
      "🔓 Next cheatcode: bf4cb2c2-e3db-4f08-81f2-9b6e96cf5b10",
      "🎯 Прямая ссылка: https://chatgpt.com/codex/cloud",
    ].join("\n"),

    quest_lore: "Витрина — лицо империи. Каждая карточка — афиша. Когда продукт выглядит как обложка, его хочется купить не глядя.",
  },

  {
    id: "bf4cb2c2-e3db-4f08-81f2-9b6e96cf5b10",
    title: "[QUEST][LERA] Неоновый Тикер",
    chain_order: 3,
    quest_name: "Неоновый Тикер",
    target_task_name: "catalog-swipe-ticker",
    next_quest_uuid: "7f3f6f90-6d6c-4062-b31f-8ef872746ecf",
    next_target: "item-modal-safe-close",
    task_url: null,

    notification_part1: [
      "🎬 МИССИЯ «Неоновый Тикер» АКТИВИРОВАНА.",
      "",
      "Ты уже это построила: статичная сетка для маленьких коллекций заменена на свайп-тикар — карусель с snap-поведением, точками навигации и кинетическими переходами. Теперь небольшие подборки не выглядят сиротливо — они пульсируют.",
      "",
      "🏆 Ачивка открыта: «Хранитель Импульса» — ты сохранила инерцию в интерфейсе.",
      "",
      "Но присмотрись... snap может дёргаться, точки могут сбиваться, а на узких экранах свайп может конфликтовать со скроллом.",
      "",
      "🔓 Твой cheatcode: bf4cb2c2-e3db-4f08-81f2-9b6e96cf5b10",
      "🎯 Прямая ссылка: https://chatgpt.com/codex/cloud",
      "",
      "Импульс не должен теряться.",
    ].join("\n"),

    polish_instructions: [
      "Review and polish task: catalog-swipe-ticker.",
      "",
      "FOCUS: Swipe ticker carousel for small collections. This must feel NATIVE — like iOS page dots, not a janky web carousel.",
      "- Snap behavior: precise, no overshoot, no half-card visible",
      "- Navigation dots: always synced with current card, animated transition",
      "- Kinetic transitions: smooth deceleration, not abrupt stops",
      "- Swipe vs scroll: horizontal swipe on ticker must NOT trigger vertical page scroll",
      "",
      "EDGE CASES TO CHECK:",
      "- iPhone SE 375px: single card visible, swipe to next",
      "- 390px: standard mobile, peek of next card to hint more content",
      "- 768px tablet: 2-3 cards visible, dots still useful",
      "- 1024px desktop: consider auto-play with pause-on-hover",
      "- Single item collection: hide dots, no swipe needed",
      "- Two items: dots visible, but consider if ticker is even needed",
      "- Touch: swipe velocity must map to scroll distance naturally",
      "- Mouse: drag-to-swipe should work, scroll-wheel horizontal should work",
      "",
      "REFERENCE: Ticker layout from redesign images — horizontal card strip with navigation dots.",
      "",
      "DONE WHEN: Swipe feels like butter, snap is pixel-perfect, dots always correct, no vertical scroll conflict, single-item edge case handled gracefully.",
      "",
      "PR RULES (CRITICAL):",
      '- PR title MUST start with "⚡:" — this triggers AUTO-MERGE. No scroll, no click, no manual merge.',
      "- Example: ⚡: polish catalog-swipe-ticker",
      '- Commit message: "lera was here"',
      "- PR body MUST contain: supaplan_task: bf4cb2c2-e3db-4f08-81f2-9b6e96cf5b10",
      "",
      "AFTER PR IS CREATED:",
      "1. Set task status: node scripts/supaplan-skill.mjs update-status --taskId bf4cb2c2-e3db-4f08-81f2-9b6e96cf5b10 --status ready_for_pr",
      "2. Send Hollywood notification: node scripts/codex-notify.mjs telegram --chatId 417553377 --text \"<notification_part2>\"",
      "3. Send bridge callback: node scripts/codex-notify.mjs callback-auto --status completed --summary \"Task ready_for_pr\" --taskPath /supaplan",
    ].join("\n"),

    notification_part2: [
      "🔥 MISSION COMPLETE: «Неоновый Тикер».",
      "",
      "Полировка завершена: карусель скользит как шёлк — snap точный, точки на месте, свайп не конфликтует со скроллом. Маленькие коллекции теперь выглядят как VIP-секция.",
      "",
      "🎖 Achievement: «Мастер Инерции» — ты укротила физику свайпа.",
      "🎨 Skin dropped: «Kinetic Velvet» — бархатная кинетика прокрутки. Плавность, которую чувствуешь пальцами.",
      "",
      "👀 Спойлер: тень прячется в верхнем правом углу — и её нужно приручить.",
      "🔓 Next cheatcode: 7f3f6f90-6d6c-4062-b31f-8ef872746ecf",
      "🎯 Прямая ссылка: https://chatgpt.com/codex/cloud",
    ].join("\n"),

    quest_lore: "Движение — жизнь. Статичные подборки — кладбище товаров. Тикар превращает мёртвую сетку в живую ленту.",
  },

  {
    id: "7f3f6f90-6d6c-4062-b31f-8ef872746ecf",
    title: "[QUEST][LERA] Тень Телеграма",
    chain_order: 4,
    quest_name: "Тень Телеграма",
    target_task_name: "item-modal-safe-close",
    next_quest_uuid: "8c95e4ef-fb84-4adb-8c95-4fdd6dbf6556",
    next_target: "map-riders-taxi-sheet",
    task_url: null,

    notification_part1: [
      "🎬 МИССИЯ «Тень Телеграма» АКТИВИРОВАНА.",
      "",
      "Ты уже это построила: модалка товара теперь корректно закрывается — кнопка закрытия сдвинута в safe-зону, чтобы не накрывать нативные элементы Telegram. Тень отступила.",
      "",
      "🏆 Ачивка открыта: «Призрачный Клик» — ты нашла кнопку, которую прятал Telegram.",
      "",
      "Но присмотрись... safe-area может плавать на разных устройствах, фокус-ловушки в модалке, Escape может не срабатывать.",
      "",
      "🔓 Твой cheatcode: 7f3f6f90-6d6c-4062-b31f-8ef872746ecf",
      "🎯 Прямая ссылка: https://chatgpt.com/codex/cloud",
      "",
      "Призрак должен уйти навсегда.",
    ].join("\n"),

    polish_instructions: [
      "Review and polish task: item-modal-safe-close.",
      "",
      "FOCUS: Fix modal close button overlap with Telegram native controls. This is a CRITICAL usability bug — users literally can't close the modal on some devices.",
      "- Close button: moved to safe-left position, never under Telegram's native header",
      "- Focus trap: Tab key must cycle within modal, never escape to background",
      "- Escape key: must close modal reliably",
      "- Back gesture (mobile): must close modal, not navigate back in Telegram",
      "",
      "EDGE CASES TO CHECK:",
      "- iPhone SE 375px: close button fully visible and tappable",
      "- 390px: standard mobile with Telegram top bar overlay",
      "- 768px tablet: close button position comfortable",
      "- 1024px desktop: Escape key works, click-outside-to-close works",
      "- Telegram iOS: native back button top-left must not overlap",
      "- Telegram Android: native header may differ — test safe-area",
      "- Telegram Desktop: no native overlay, but layout must not shift",
      "",
      "REFERENCE: Modal close position from redesign images — button should be in top-left or safe-zone position.",
      "",
      "DONE WHEN: Close button always visible and tappable on ALL Telegram platforms, focus never escapes modal, Escape always works, back gesture closes modal.",
      "",
      "PR RULES (CRITICAL):",
      '- PR title MUST start with "⚡:" — this triggers AUTO-MERGE. No scroll, no click, no manual merge.',
      "- Example: ⚡: polish item-modal-safe-close",
      '- Commit message: "lera was here"',
      "- PR body MUST contain: supaplan_task: 7f3f6f90-6d6c-4062-b31f-8ef872746ecf",
      "",
      "AFTER PR IS CREATED:",
      "1. Set task status: node scripts/supaplan-skill.mjs update-status --taskId 7f3f6f90-6d6c-4062-b31f-8ef872746ecf --status ready_for_pr",
      "2. Send Hollywood notification: node scripts/codex-notify.mjs telegram --chatId 417553377 --text \"<notification_part2>\"",
      "3. Send bridge callback: node scripts/codex-notify.mjs callback-auto --status completed --summary \"Task ready_for_pr\" --taskPath /supaplan",
    ].join("\n"),

    notification_part2: [
      "🔥 MISSION COMPLETE: «Тень Телеграма».",
      "",
      "Полировка завершена: модалка теперь послушная — кнопка закрытия на месте, фокус в ловушке, Escape работает, жест назад не ломает навигацию. Тень изгнана.",
      "",
      "🎖 Achievement: «Экзорцист Интерфейса» — ты изгнала призрака из модалки.",
      "🎨 Skin dropped: «Safe Zone Phantom» — модалка с подсветкой safe-zone при отладке. Невидимая защита, которая всегда на страже.",
      "",
      "👀 Спойлер: карта оживает на весь экран — и снизу поднимается панель как в такси.",
      "🔓 Next cheatcode: 8c95e4ef-fb84-4adb-8c95-4fdd6dbf6556",
      "🎯 Прямая ссылка: https://chatgpt.com/codex/cloud",
    ].join("\n"),

    quest_lore: "Telegram прячет свои элементы поверх наших — тень поверх света. Safe-zone — это граница между нашим миром и их. Очисть её.",
  },

  {
    id: "8c95e4ef-fb84-4adb-8c95-4fdd6dbf6556",
    title: "[QUEST][LERA] Орбита Райдера",
    chain_order: 5,
    quest_name: "Орбита Райдера",
    target_task_name: "map-riders-taxi-sheet",
    next_quest_uuid: "c3e24996-d123-4f7b-9da9-1ce53f2b2ec5",
    next_target: "bike-bottom-nav-routing",
    task_url: null,

    notification_part1: [
      "🎬 МИССИЯ «Орбита Райдера» АКТИВИРОВАНА.",
      "",
      "Ты уже это построила: карта райдеров развёрнута на полный экран с нижней панелью как в такси-приложениях — свайп вверх/вниз, жесты картой активны, z-index наложен правильно. Карта теперь не кусочек экрана — она и ЕСТЬ экран.",
      "",
      "🏆 Ачивка открыта: «Штурман Карты» — ты развернула навигацию на максимум.",
      "",
      "Но присмотрись... панель может дёргаться при свайпе, карта может терять жесты, на планшете всё может выглядеть иначе.",
      "",
      "🔓 Твой cheatcode: 8c95e4ef-fb84-4adb-8c95-4fdd6dbf6556",
      "🎯 Прямая ссылка: https://chatgpt.com/codex/cloud",
      "",
      "Карта — это территория. Освой её.",
    ].join("\n"),

    polish_instructions: [
      "Review and polish task: map-riders-taxi-sheet.",
      "",
      "FOCUS: Full-screen map + bottom overhang sheet (taxi-app style). This is a complex interaction pattern — map gestures and sheet drag must coexist without conflict.",
      "- Full-screen map: fills viewport, no white gaps, marker clustering clean",
      "- Bottom sheet: peek state (30%), half state (50%), full state (100%) — smooth transitions",
      "- Map gestures: drag/zoom on map must work even when sheet is partially covering it",
      "- Sheet drag: vertical drag on sheet handle must NOT trigger map pan",
      "- Z-index layering: sheet above map, map controls above sheet peek",
      "",
      "EDGE CASES TO CHECK:",
      "- iPhone SE 375px: sheet peek shows essential info, map still interactive above",
      "- 390px: standard mobile, sheet half-state reveals rider details",
      "- 768px tablet: sheet wider, maybe side-panel instead of bottom",
      "- 1024px desktop: sheet as sidebar or wide bottom panel",
      "- Drag conflict: sheet drag vs map pan — must be distinguishable by touch origin",
      "- Fast swipe: sheet should fling to nearest snap point, not stop mid-way",
      "- Background scroll: page must NOT scroll when interacting with map or sheet",
      "",
      "REFERENCE: Taxi-map + bottom sheet from redesign image #1 — the sheet peek, handle, and map interaction pattern.",
      "",
      "DONE WHEN: Map and sheet coexist peacefully, drag never conflicts, sheet snaps to states, map always interactive above sheet, no background scroll bleed.",
      "",
      "PR RULES (CRITICAL):",
      '- PR title MUST start with "⚡:" — this triggers AUTO-MERGE. No scroll, no click, no manual merge.',
      "- Example: ⚡: polish map-riders-taxi-sheet",
      '- Commit message: "lera was here"',
      "- PR body MUST contain: supaplan_task: 8c95e4ef-fb84-4adb-8c95-4fdd6dbf6556",
      "",
      "AFTER PR IS CREATED:",
      "1. Set task status: node scripts/supaplan-skill.mjs update-status --taskId 8c95e4ef-fb84-4adb-8c95-4fdd6dbf6556 --status ready_for_pr",
      "2. Send Hollywood notification: node scripts/codex-notify.mjs telegram --chatId 417553377 --text \"<notification_part2>\"",
      "3. Send bridge callback: node scripts/codex-notify.mjs callback-auto --status completed --summary \"Task ready_for_pr\" --taskPath /supaplan",
    ].join("\n"),

    notification_part2: [
      "🔥 MISSION COMPLETE: «Орбита Райдера».",
      "",
      "Полировка завершена: карта и панель живут в гармонии — свайп панели не двигает карту, карта не крадёт жесты у панели, snap-точки как в Uber. Райдеры на орбите.",
      "",
      "🎖 Achievement: «Картограф Безграничности» — ты картографировала бесконечную карту.",
      "🎨 Skin dropped: «Overhang Orbit» — панель с эффектом орбитального свечения на handle. Райдер всегда видит горизонт.",
      "",
      "👀 Спойлер: нижняя навигация прокладывает маршрут к байкам.",
      "🔓 Next cheatcode: c3e24996-d123-4f7b-9da9-1ce53f2b2ec5",
      "🎯 Прямая ссылка: https://chatgpt.com/codex/cloud",
    ].join("\n"),

    quest_lore: "Карта — окно в мир райдеров. Каждый маркер — живой человек. Нижняя панель — это мост между наблюдателем и участником.",
  },

  {
    id: "c3e24996-d123-4f7b-9da9-1ce53f2b2ec5",
    title: "[QUEST][LERA] Пульс Навигации",
    chain_order: 6,
    quest_name: "Пульс Навигации",
    target_task_name: "bike-bottom-nav-routing",
    next_quest_uuid: "66f0fc93-8f71-4a2d-9bfa-7db17d1cd8f7",
    next_target: "telegram-start-promo-capture",
    task_url: null,

    notification_part1: [
      "🎬 МИССИЯ «Пульс Навигации» АКТИВИРОВАНА.",
      "",
      "Ты уже это построила: нижняя навигация для байков включена в franchize-поверхностях, ошибочная видимость /admin/map-routes убрана, пункты выровнены. Байкер теперь видит свой маршрут, а не админку.",
      "",
      "🏆 Ачивка открыта: «Навигатор Байков» — ты проложила маршрут для райдеров.",
      "",
      "Но присмотрись... навигация может некрасиво прыгать между разделами, активный таб может не подсвечиваться, а на iPhone SE всё может сжаться.",
      "",
      "🔓 Твой cheatcode: c3e24996-d123-4f7b-9da9-1ce53f2b2ec5",
      "🎯 Прямая ссылка: https://chatgpt.com/codex/cloud",
      "",
      "Каждый таб — пульс. Настрой ритм.",
    ].join("\n"),

    polish_instructions: [
      "Review and polish task: bike-bottom-nav-routing.",
      "",
      "FOCUS: Enable bike bottom nav in franchize surfaces, remove admin route leakage, align entries. This is a NAVIGATION task — users tap this hundreds of times per session.",
      "- Bottom nav: visible on all franchize pages, correct entries for bike context",
      "- Active tab: visually distinct (filled icon + label + color), inactive = outline + dim",
      "- Admin routes: /admin/map-routes must NOT appear in user-facing nav — verify all surfaces",
      "- Alignment: icons centered in touch target, labels aligned, consistent spacing",
      "",
      "EDGE CASES TO CHECK:",
      "- iPhone SE 375px: 4-5 tabs must fit without overlap, labels may hide on overflow",
      "- 390px: standard mobile, all tabs visible with labels",
      "- 768px tablet: wider tab bar, consider side nav for landscape",
      "- 1024px desktop: bottom nav may convert to sidebar — verify transition",
      "- Tab transitions: switching tabs should be instant, no flash of wrong content",
      "- Deep links: navigating to a page should highlight the correct tab",
      "- Badge/notifications on tabs: count badges must not shift layout",
      "",
      "REFERENCE: Bottom navigation from redesign images — tab style, icon treatment, active state.",
      "",
      "DONE WHEN: Bottom nav appears correctly on all franchize surfaces, zero admin route leakage, active tab always highlighted, touch targets comfortable, no layout shift.",
      "",
      "PR RULES (CRITICAL):",
      '- PR title MUST start with "⚡:" — this triggers AUTO-MERGE. No scroll, no click, no manual merge.',
      "- Example: ⚡: polish bike-bottom-nav-routing",
      '- Commit message: "lera was here"',
      "- PR body MUST contain: supaplan_task: c3e24996-d123-4f7b-9da9-1ce53f2b2ec5",
      "",
      "AFTER PR IS CREATED:",
      "1. Set task status: node scripts/supaplan-skill.mjs update-status --taskId c3e24996-d123-4f7b-9da9-1ce53f2b2ec5 --status ready_for_pr",
      "2. Send Hollywood notification: node scripts/codex-notify.mjs telegram --chatId 417553377 --text \"<notification_part2>\"",
      "3. Send bridge callback: node scripts/codex-notify.mjs callback-auto --status completed --summary \"Task ready_for_pr\" --taskPath /supaplan",
    ].join("\n"),

    notification_part2: [
      "🔥 MISSION COMPLETE: «Пульс Навигации».",
      "",
      "Полировка завершена: нижняя панель как часовой механизм — активный таб подсвечен, админка не торчит, выравнивание идеальное, переходы мгновенные. Райдер всегда знает где он.",
      "",
      "🎖 Achievement: «Дирижёр Маршрутов» — ты дирижировала навигацией как симфонию.",
      "🎨 Skin dropped: «Route Pulse Badge» — пульсирующий бейдж на активном табе, как сердцебиение навигации.",
      "",
      "👀 Спойлер: стартовый экран получает секретный промо-код — и всё меняется.",
      "🔓 Next cheatcode: 66f0fc93-8f71-4a2d-9bfa-7db17d1cd8f7",
      "🎯 Прямая ссылка: https://chatgpt.com/codex/cloud",
    ].join("\n"),

    quest_lore: "Навигация — пульс приложения. Каждый тап — удар сердца. Если ритм сбивается, пользователь теряется. Держи пульс ровным.",
  },

  {
    id: "66f0fc93-8f71-4a2d-9bfa-7db17d1cd8f7",
    title: "[QUEST][LERA] Код Стартера",
    chain_order: 7,
    quest_name: "Код Стартера",
    target_task_name: "telegram-start-promo-capture",
    next_quest_uuid: "c2d2e8d1-f047-44de-bad3-4f4f9073de61",
    next_target: "promo-seed-and-checkout-link",
    task_url: null,

    notification_part1: [
      "🎬 МИССИЯ «Код Стартера» АКТИВИРОВАНА.",
      "",
      "Ты уже это построила: Telegram /start теперь разбирает bike-oriented payload, сохраняет промо-код и метаданные профиля для vip-bike потока. Первый контакт с ботом — уже персонализированный.",
      "",
      "🏆 Ачивка открыта: «Взломщик Промо» — ты взломала стартовый код.",
      "",
      "Но присмотрись... payload может приходить в разных форматах, данные могут теряться при перезапуске, а обработка ошибок может молчать.",
      "",
      "🔓 Твой cheatcode: 66f0fc93-8f71-4a2d-9bfa-7db17d1cd8f7",
      "🎯 Прямая ссылка: https://chatgpt.com/codex/cloud",
      "",
      "Первый шаг — самый важный. Он определяет всё.",
    ].join("\n"),

    polish_instructions: [
      "Review and polish task: telegram-start-promo-capture.",
      "",
      "FOCUS: Restore bike-oriented /start payload parsing and save promo code + survey profile metadata for vip-bike flow. This is the FRONT DOOR — first impression, zero tolerance for errors.",
      "- Payload parsing: handle multiple formats (deep_link, start_param, ref code)",
      "- Data persistence: promo code + metadata must survive app restarts",
      "- Error handling: every parse failure must have a graceful fallback, never silent",
      "- Profile metadata: save enough context for personalized onboarding",
      "",
      "EDGE CASES TO CHECK:",
      "- Empty /start (no payload): must still work, show default onboarding",
      "- Malformed payload: must not crash, must log warning",
      "- Stale promo code: expired codes must show friendly message",
      "- Multiple /start calls: must not duplicate data, must update if changed",
      "- Telegram iOS vs Android vs Desktop: payload format may differ",
      "- Very long payload: must not exceed DB column limits",
      "- Unicode in payload: must handle non-ASCII characters",
      "",
      "REFERENCE: /start flow from existing bot handlers — current implementation is the baseline.",
      "",
      "DONE WHEN: Every /start payload format is handled gracefully, data persists across restarts, zero silent errors, onboarding feels personalized from the very first tap.",
      "",
      "PR RULES (CRITICAL):",
      '- PR title MUST start with "⚡:" — this triggers AUTO-MERGE. No scroll, no click, no manual merge.',
      "- Example: ⚡: polish telegram-start-promo-capture",
      '- Commit message: "lera was here"',
      "- PR body MUST contain: supaplan_task: 66f0fc93-8f71-4a2d-9bfa-7db17d1cd8f7",
      "",
      "AFTER PR IS CREATED:",
      "1. Set task status: node scripts/supaplan-skill.mjs update-status --taskId 66f0fc93-8f71-4a2d-9bfa-7db17d1cd8f7 --status ready_for_pr",
      "2. Send Hollywood notification: node scripts/codex-notify.mjs telegram --chatId 417553377 --text \"<notification_part2>\"",
      "3. Send bridge callback: node scripts/codex-notify.mjs callback-auto --status completed --summary \"Task ready_for_pr\" --taskPath /supaplan",
    ].join("\n"),

    notification_part2: [
      "🔥 MISSION COMPLETE: «Код Стартера».",
      "",
      "Полировка завершена: /start теперь как швейцарский замок — любой payload разбирается, данные не теряются, ошибки не молчат, а каждый пользователь получает персональный вход с первой секунды.",
      "",
      "🎖 Achievement: «Мастер Ключей» — ты выковала ключ, который открывает любую дверь.",
      "🎨 Skin dropped: «Quantum Keychain» — анимация разблокировки при /start. Ключ поворачивается, замок мерцает, дверь открывается.",
      "",
      "👀 Спойлер: промо-код превращается в покупку — одна ссылка, и чек оформлен.",
      "🔓 Next cheatcode: c2d2e8d1-f047-44de-bad3-4f4f9073de61",
      "🎯 Прямая ссылка: https://chatgpt.com/codex/cloud",
    ].join("\n"),

    quest_lore: "Первый контакт — решающий. /start — это не команда, это церемония. Промо-код — приглашение, а не просто строка.",
  },

  {
    id: "c2d2e8d1-f047-44de-bad3-4f4f9073de61",
    title: "[QUEST][LERA] Печать Промо",
    chain_order: 8,
    quest_name: "Печать Промо",
    target_task_name: "promo-seed-and-checkout-link",
    next_quest_uuid: "NONE",
    next_target: "NONE",
    task_url: null,

    notification_part1: [
      "🎬 МИССИЯ «Печать Промо» АКТИВИРОВАНА — ФИНАЛЬНАЯ.",
      "",
      "Ты уже это построила: промо-ссылки нормализованы в t.me start-параметры, UI применения подключён в корзине/чекеуте, валидация через серверный экшен работает. Промо-код — это уже не просто текст, а ключ к покупке.",
      "",
      "🏆 Ачивка открыта: «Печатник Ссылок» — ты поставила печать на каждый промо-код.",
      "",
      "Но присмотрись... ссылки могут терять параметры при переходе, валидация может быть слишком строгой, а UI применения может быть незаметным.",
      "",
      "🔓 Твой cheatcode: c2d2e8d1-f047-44de-bad3-4f4f9073de61",
      "🎯 Прямая ссылка: https://chatgpt.com/codex/cloud",
      "",
      "Последняя печать. Закрой цепь.",
    ].join("\n"),

    polish_instructions: [
      "Review and polish task: promo-seed-and-checkout-link.",
      "",
      "FOCUS: Normalize promo links to t.me start param, wire apply UI in checkout/cart, and validate against existing server action. This closes the monetization loop.",
      "- Link normalization: any promo URL → t.me/bot?start=CODE format",
      "- Apply UI: visible in cart AND checkout, clear feedback on apply/fail",
      "- Server validation: validate promo code, apply discount, show updated total",
      "- Error states: expired, invalid, already-used codes must each have distinct messages",
      "",
      "EDGE CASES TO CHECK:",
      "- Link with UTM params: must strip UTM and keep promo code",
      "- Multiple promo codes: only one active at a time, clear which is applied",
      "- Cart total updates: discount must recalculate in real-time",
      "- Network errors: must not lose cart state on validation failure",
      "- Deep link from Telegram: must preserve promo through full navigation flow",
      "- Direct URL entry: must handle manually-typed promo codes",
      "- Zero-cart checkout: promo on empty cart must be handled gracefully",
      "",
      "REFERENCE: Checkout flow from existing cart implementation.",
      "",
      "DONE WHEN: Promo link survives the full navigation chain, apply UI is impossible to miss, validation is instant and clear, discount shows in real-time, zero cart state loss.",
      "",
      "PR RULES (CRITICAL):",
      '- PR title MUST start with "⚡:" — this triggers AUTO-MERGE. No scroll, no click, no manual merge.',
      "- Example: ⚡: polish promo-seed-and-checkout-link",
      '- Commit message: "lera was here"',
      "- PR body MUST contain: supaplan_task: c2d2e8d1-f047-44de-bad3-4f4f9073de61",
      "",
      "AFTER PR IS CREATED:",
      "1. Set task status: node scripts/supaplan-skill.mjs update-status --taskId c2d2e8d1-f047-44de-bad3-4f4f9073de61 --status ready_for_pr",
      "2. Send GRAND FINALE Hollywood notification: node scripts/codex-notify.mjs telegram --chatId 417553377 --text \"<notification_part2>\"",
      "3. Send bridge callback: node scripts/codex-notify.mjs callback-auto --status completed --summary \"CHAIN COMPLETE — final task ready_for_pr\" --taskPath /supaplan",
    ].join("\n"),

    notification_part2: [
      "🔥🔥🔥 CHAIN COMPLETE: «Печать Промо» — ФИНАЛЬНАЯ МИССИЯ ЗАВЕРШЕНА 🔥🔥🔥",
      "",
      "Полировка завершена: промо-коды теперь как печати — каждая ссылка ведёт к покупке, каждый код валидируется мгновенно, скидка пересчитывается на лету, корзина не теряет состояние.",
      "",
      "🎖 Achievement: «Архитект Системы» — ты построила полный конвейер от первого клика до чекаут.",
      "🎨 Skin dropped: «Golden Chain Complete» — легендарный скин. Вся цепь собрана. Каждое звено — твой PR. Каждая печать — твой код. Карбон, неон, золото, бархат, орбита, пульс, ключи, печать — коллекция полна.",
      "",
      "🏆 8 из 8 миссий завершены. 8 PR создано. 8 ачивок собрано. 8 скинов получено.",
      "Витрина перерождена. И это — ТВОЯ работа.",
      "",
      "💫 Цепь замкнута. Империя построена. Lera was here.",
    ].join("\n"),

    quest_lore: "Последнее звено цепи. Промо-код — это не скидка, это обещание. Печать превращает обещание в покупку. Без печати — нет империи.",
  },
];


// ─── Builder Functions ───

function buildBody(q) {
  const taskUrl = codexUrl(q.target_task_name, q.task_url);
  const protocol = agentProtocolTemplate({
    uuid: q.id,
    targetTaskName: q.target_task_name,
    taskUrl,
  });

  return [
    `quest_name: ${q.quest_name}`,
    `chain_order: ${q.chain_order}`,
    `next_quest_uuid: ${q.next_quest_uuid}`,
    `target_task_name: ${q.target_task_name}`,
    `client_chat_id: ${CONFIG.clientChatId}`,
    `commit_signature: ${CONFIG.commitSignature}`,
    `codex_task_url: ${taskUrl}`,
    "",
    "--- AGENT PROTOCOL (embedded) ---",
    protocol,
    "--- END AGENT PROTOCOL ---",
    "",
    `quest_lore: ${q.quest_lore}`,
    "",
    "notification_part1 (sent by Boss when quest activated):",
    q.notification_part1,
    "",
    "polish_instructions:",
    q.polish_instructions,
    "",
    "notification_part2 (sent by executive agent after PR created):",
    q.notification_part2,
  ].join("\n");
}

function buildMetadata(q) {
  const isFinale = q.chain_order === 8;
  const taskUrl = codexUrl(q.target_task_name, q.task_url);
  return {
    quest_name: q.quest_name,
    chain_order: q.chain_order,
    next_quest_uuid: q.next_quest_uuid,
    target_task_name: q.target_task_name,
    client_chat_id: CONFIG.clientChatId,
    commit_signature: CONFIG.commitSignature,
    quest_lore: q.quest_lore,
    notification_part1: q.notification_part1,
    notification_part2: q.notification_part2,
    polish_instructions: q.polish_instructions,
    agent_protocol_embedded: true,
    agent_protocol_source: "Quest Chain Generator v5.0 — Agent Executive section",
    supaplan_ref_required: `supaplan_task: ${q.id}`,
    pr_title_prefix: "⚡:",
    chain_finale: isFinale,
    notification_sender_part1: "boss",
    notification_sender_part2: "executive_agent",
    codex_task_url: taskUrl,
    // SupaPlan operator protocol alignment
    agent_safe_statuses: ["claimed", "running", "ready_for_pr"],
    status_done_by: "merge_workflow_only",
  };
}

// ─── CSV Escaping ───

function csvEscape(value) {
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  const str = String(value);
  // If contains comma, newline, or quote — wrap in quotes and escape internal quotes
  if (str.includes(",") || str.includes("\n") || str.includes('"')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return '"' + str + '"'; // Always quote for safety
}

// ─── Validation ───

function validateChain(quests) {
  const errors = [];

  // UUID uniqueness
  const uuids = quests.map(q => q.id);
  const uuidSet = new Set(uuids);
  if (uuids.length !== uuidSet.size) errors.push("DUPLICATE UUIDs detected!");

  // Chain ordering + link integrity
  for (let i = 0; i < quests.length; i++) {
    const q = quests[i];
    if (q.chain_order !== i + 1) {
      errors.push(`Quest ${q.quest_name}: chain_order=${q.chain_order}, expected=${i + 1}`);
    }
    if (q.next_quest_uuid === "NONE") {
      if (i !== quests.length - 1) errors.push(`Quest ${q.quest_name}: next=NONE but not last`);
    } else if (i + 1 < quests.length) {
      if (q.next_quest_uuid !== quests[i + 1].id) {
        errors.push(`Quest ${q.quest_name}: next_uuid mismatch`);
      }
    }
  }

  // Uniqueness Mandate
  const achievements = new Set(), skins = new Set(), spoilers = new Set();
  for (const q of quests) {
    for (const line of q.notification_part2.split("\n")) {
      if (line.includes("Achievement:")) {
        const ach = line.split("Achievement:")[1].trim();
        if (achievements.has(ach)) errors.push(`DUPLICATE achievement: ${ach}`);
        achievements.add(ach);
      }
      if (line.includes("Skin dropped:")) {
        const skin = line.split("Skin dropped:")[1].trim();
        if (skins.has(skin)) errors.push(`DUPLICATE skin: ${skin}`);
        skins.add(skin);
      }
      if (line.includes("Спойлер:")) {
        const sp = line.split("Спойлер:")[1].trim();
        if (spoilers.has(sp)) errors.push(`DUPLICATE spoiler: ${sp}`);
        spoilers.add(sp);
      }
    }
  }

  // No PR instructions in notification_part2
  for (const q of quests) {
    if (q.notification_part2.includes("Создай PR") || q.notification_part2.includes("⚡:")) {
      errors.push(`Quest ${q.quest_name}: PR instructions in notification_part2!`);
    }
  }

  // Straight links in both notifications
  for (const q of quests) {
    if (!q.notification_part1.includes("Прямая ссылка:") && !q.notification_part1.includes("codex")) {
      errors.push(`Quest ${q.quest_name}: Missing straight link in notification_part1`);
    }
  }

  return errors;
}

// ─── Main ───

function main() {
  const args = process.argv.slice(2);
  const validateOnly = args.includes("--validate-only");
  const outputArg = args.find(a => !a.startsWith("--"));
  const outputPath = outputArg || join(CONFIG.outputDir, CONFIG.outputFilename);

  console.log("⚔️ Quest Chain Generator v5.0 — Straight Links");
  console.log("=".repeat(60));

  // Validate
  const errors = validateChain(quests);
  if (errors.length) {
    console.log("❌ VALIDATION ERRORS:");
    errors.forEach(e => console.log(`   - ${e}`));
    process.exit(1);
  }
  console.log("✅ Chain validation passed");
  console.log(`   - ${quests.length} quests in chain`);
  console.log(`   - All UUIDs unique`);
  console.log(`   - All next_quest_uuid links valid`);
  console.log(`   - All achievements/skins/spoilers unique (Uniqueness Mandate)`);
  console.log(`   - No PR instructions in notification_part2`);
  console.log(`   - Straight links in all notification_part1 + notification_part2`);

  if (validateOnly) {
    console.log("\n--validate-only: skipping CSV generation");
    return;
  }

  // Generate CSV
  const header = ["id","title","body","todo_path","plugin","capability","status","created_by","created_at","updated_at","metadata","pr_url"];
  const rows = [header.map(csvEscape).join(",")];

  for (const q of quests) {
    const body = buildBody(q);
    const metadata = buildMetadata(q);
    const metadataJson = JSON.stringify(metadata, null, 0); // compact

    rows.push([
      csvEscape(q.id),
      csvEscape(q.title),
      csvEscape(body),
      csvEscape("/BOSS_QUEST.HTML"),
      csvEscape(""),
      csvEscape("franchize.gamification"),
      csvEscape("open"),
      csvEscape("boss-agent"),
      csvEscape("2026-05-19 10:51:09.65499+00"),
      csvEscape("2026-05-19 10:51:09.65499+00"),
      csvEscape(metadataJson),
      csvEscape(""),
    ].join(","));
  }

  const csvContent = rows.join("\n");
  writeFileSync(outputPath, csvContent, "utf-8");
  const size = statSync(outputPath).size;

  console.log(`\n✅ CSV written: ${outputPath}`);
  console.log(`   Size: ${size.toLocaleString()} bytes`);

  // Summary
  console.log("\n📋 QUEST CHAIN:");
  for (const q of quests) {
    const url = codexUrl(q.target_task_name, q.task_url);
    const finale = q.chain_order === 8 ? " 👑 FINALE" : "";
    console.log(`   ${q.chain_order}. ${q.quest_name} → ${q.target_task_name}${finale}`);
    console.log(`      UUID: ${q.id}`);
    console.log(`      Link: ${url}`);
  }

  console.log("\n🧭 NOTIFICATION FLOW:");
  console.log("   notification_part1 → Sent by BOSS (hook + cheatcode + STRAIGHT LINK)");
  console.log("   notification_part2 → Sent by EXECUTIVE AGENT after PR (victory + next cheatcode + STRAIGHT LINK)");
  console.log("   PR title rules     → ONLY in polish_instructions (never in notifications)");
  console.log("   Status flow        → claimed → running → ready_for_pr → done (by merge only)");

  console.log("\n🎯 CODEX STRAIGHT LINKS (placeholder — replace with actual URLs):");
  for (const q of quests) {
    console.log(`   Quest ${q.chain_order}: ${codexUrl(q.target_task_name, q.task_url)}`);
  }

  console.log("\n✨ Done. Straight links eliminate \"find I don't know what\" friction.");
}

main();
