# Skill: send-analytics-csv-to-telegram

> Generate the analytics CSV (or XLSX) for a date range and send it to the operator's own Telegram chat via the bot.

This is the project-level skill for the **VIP BIKE ELECTRO / cartest** repo. It wraps the `sendAnalyticsCsvToTelegram` server-action + the `buildRentalsCsv` / `buildSalesCsv` shared helpers + the existing `sendTelegramDocument` capability so any page in the franchize app can offer a "Send to Telegram" button next to its CSV download.

---

## When to use

- A franchize page (analytics, sales, monthly summary) needs to deliver a CSV/XLSX file to the operator's Telegram chat.
- The operator is inside the Telegram WebApp iframe where the standard `<a download>` flow is silently blocked by the sandbox — sending via the bot is the reliable fallback.
- The same data is already being downloaded as CSV; sending to Telegram just routes the same file through the bot instead of through the browser download.

## When NOT to use

- Sending a contract artefact (PDF, DOCX) — use the existing `sendFranchizeBuyPrintPdf` pattern in `app/franchize/server-actions/buy-print.ts` instead; the CSV format here is finance-sheet shaped.
- Sending a one-off notification message — use `sendMessage` from `app/core/telegram-capability.ts`.
- Sending a photo — use `sendPhoto`.

## Building blocks (reuse, don't duplicate)

| Piece | Path | Role |
|---|---|---|
| `buildRentalsCsv` | `lib/csv-builders/rentals-csv.ts` | Builds the 17-column finance sheet CSV text for the rentals analytics page. Reads `rentals`, `sale_contract_artifacts`, and `commission_rates`. |
| `buildSalesCsv` | `lib/csv-builders/sales-csv.ts` | Builds the 5-column sales-only CSV text. |
| `resolveRentalCommissionRate` | `lib/csv-builders/rentals-csv.ts` | Resolves the crew's rental commission rate (`rental_daily` preferred, then `rental_hourly`). Drives the `ЗП Аренда` column. |
| `resolveSaleCommissionRate` | `lib/csv-builders/sales-csv.ts` | Same for `operation_type = 'sale'`. Drives `ЗП Продажа`. |
| `sendAnalyticsCsvToTelegram` | `app/franchize/server-actions/analytics-csv-send.ts` | The orchestrator. Auths via crew membership check, builds the CSV (lazy-loads ExcelJS for XLSX), calls `sendTelegramDocument`. |
| `sendTelegramDocument` | `app/actions.ts` | Multipart upload to the bot `sendDocument` endpoint. Token from `TELEGRAM_BOT_TOKEN`. |
| `verifyCrewAccess` | `app/api/franchize/_auth.ts` | Used by the CSV HTTP routes (signed-cookie primary, `x-telegram-user-id` header fallback). |

## Auth contract

- The caller passes `actorUserId` (the operator's telegram_user_id). The page must have already gated the user (signed cookie OR password auth).
- `sendAnalyticsCsvToTelegram` re-checks crew membership before sending (defense-in-depth) by querying `crews.owner_id` + `crew_members` table.
- Site admins (users with `metadata.role === "admin"` or `metadata.status === "admin"`) bypass the crew membership check.

## Signature

```ts
import { sendAnalyticsCsvToTelegram } from "@/app/franchize/server-actions/analytics-csv-send";

const result = await sendAnalyticsCsvToTelegram({
  slug: "vip-bike",          // crew slug
  from: "2026-08-01",         // ISO date — first day of period
  to: "2026-08-31",           // ISO date — last day of period
  actorUserId: "413553377",   // operator's telegram_user_id (also the chat_id)
  variant: "rentals",         // "rentals" | "sales"
  format: "csv",              // "csv" (default) | "xlsx"
});

// result: {
//   success: true,
//   filename: "vip-bike-rentals-2026-08-01-to-2026-08-31.csv",
//   messageId: 12345,           // Telegram message_id of the sent document
//   summary: {
//     rentals: 12,
//     sales: 2,
//     totalRevenue: 58000,
//     totalSalary: 5800,
//   }
// }
```

## Caption format

The sent document carries an HTML-free caption summarizing the period:

```
📊 Аренды 2026-08-01 → 2026-08-31
• Аренд: 12
• Продаж: 2
• Выручка: 58 000 ₽
• ЗП оператора: 5 800 ₽
```

For the `sales` variant the caption is shorter (only sales + revenue + ЗП).

## How to wire a new page

1. Make the page call the action with `actorUserId` from `useAppContext().dbUser.user_id` (or the password-auth owner id for password-authenticated operators).
2. On success, show a sonner toast with the row count + revenue (so the operator gets instant feedback that the file actually arrived in their chat).
3. On failure, show an error toast with the `result.error` text.

See `AnalyticsClientV2.tsx` → `sendCsvToTelegram` callback for the canonical wiring example.

## How to extend

### Different variants (e.g. services-only sheet)

Add a new builder in `lib/csv-builders/` (mirrors `buildRentalsCsv`) and a new case in `sendAnalyticsCsvToTelegram`. The route to expose it as HTTP would also need a sibling (mirror `rentals-csv-export/route.ts`).

### XLSX with multiple sheets / styling

The lazy `convertCsvToXlsx` helper in `analytics-csv-send.ts` already:
- Casts numeric-looking cells to numbers (so Excel formats them right-aligned).
- Styles the header row (bold, blue background, white text).
- Auto-sizes columns (cap 40 chars).

To add per-variant styling or a second sheet, modify the helper or branch on `variant`.

### Send to a different chat (e.g. admin)

Pass the chat id explicitly instead of using `actorUserId`:

```ts
// In a new wrapper:
const result = await sendTelegramDocument(adminChatId, csvBuffer, filename);
```

(The `sendAnalyticsCsvToTelegram` action intentionally only sends to the operator's own chat — opening it up to arbitrary chat ids would be a spam vector.)

## Limits & gotchas

- **File size**: Telegram bot API caps `sendDocument` at 50 MB. Our CSVs for a single month are well under 1 MB. For multi-year exports, switch to XLSX (ExcelJS handles big buffers fine) but watch the 50 MB ceiling.
- **Bot token**: must be set as `TELEGRAM_BOT_TOKEN` env var. The capability silently returns `{ success: false, error: "Telegram bot token not configured" }` if missing.
- **Operator's chat must be open**: a user who never started `/start` with the bot can't receive messages. The `sendTelegramDocument` call will fail with HTTP 403. Wrap the call in a user-friendly error toast.
- **First-time send**: the bot can always send the FIRST message to a user who has interacted with it at least once. After that, no rate limits apply for normal volumes.
- **Caption limit**: 1024 chars (truncated by `truncateText` in the capability).
- **Salary column depends on commission_rates table**: if a crew has no rate configured, the `ЗП Аренда` / `ЗП Продажа` columns stay empty (backwards-compat with iter3 behavior). Configure rates at `/franchize/{slug}/commissions`.

## Reusable from

- ✅ `/franchize/{slug}/rentals-analytics` — table-view modal "Send to Telegram" button (iter4)
- ✅ `/franchize/{slug}/sales-analytics` — table-view modal "Send to Telegram" button (iter4)
- 🟡 Planned — monthly summary / boss-commands evening digest (would need a cron wrapper)
