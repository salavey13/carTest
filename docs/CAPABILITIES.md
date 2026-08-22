# Project capabilities map

This repo now treats reusable integration powers as **capabilities** instead of one-off code hidden inside a route.

## Telegram capability

**Purpose:** one Telegram-first surface for native WebApp UX, bot notifications, Telegram Stars invoices, printable/shareable documents, and deep links.

**Runtime pieces**
- WebApp context + native controls live in `hooks/telegram/*` and are re-exported by legacy compatibility hooks where needed.
- Native BackButton must stay SPA-safe: a pending native-back navigation keeps its guard until the committed route changes, so async auth/context refreshes cannot recreate same-URL stale history guards.
- Deep links use `https://t.me/<bot>/app?startapp=<payload>`; franchize buy cards use `buy_<bikeId>` and are routed by `hooks/useStartParamRouter.ts`.

**Server/bot pieces**
- Telegram transport lives in `app/core/telegram_actions.ts` and is re-exported by `app/actions.ts`.
- `sendTelegramMessage` is for chat/admin notifications and recovery nudges.
- `sendTelegramDocument` is for generated docs/PDFs that should land in a user or operator chat.
- Telegram Stars invoices are created through domain server actions (for example franchize order/test-drive invoices) and handled by webhook handlers after payment.

**Integration guidance**
- Client code may call server actions, but it must not import service-role Supabase clients or bot secrets directly.
- Always re-check permissions server-side before sending Telegram documents or invoices.
- Prefer capability payloads that are stable and domain-readable, e.g. `buy_sequence-zero`, `mapriders_vip-bike`, `lobby_<id>`.

## PDF + QR capability

**Purpose:** generate a printable artifact with human-readable data plus a QR/deep-link back into the Telegram WebApp.

**Current examples**
- Strikeball tactical PDFs generate lobby/operator sheets and QR codes from `app/strikeball/actions/service.ts`.
- Franchize buy pages generate a sale handoff PDF with bike data, image, and a `buy_<bikeId>` QR link via `app/franchize/server-actions/buy-print.ts`.

**Default recipe**
1. Collect domain data on the server.
2. Generate PDF with `pdf-lib` + embedded DejaVu font for RU text.
3. Generate QR as a PNG image from a stable Telegram WebApp deep link.
4. Attach the QR and any product image to the PDF.
5. Send the PDF through `sendTelegramDocument`.
6. Keep the client button visible only to authorized users; enforce the same policy again in the server action.

**Franchize reuse pattern**
- Buy page printable sheet: owner/admin presses **Распечатать** → PDF is sent to their Telegram DM → operator prints and attaches it to the sale bike.
- Share path: inside Telegram WebApp, **Поделиться** forwards the same `buy_<bikeId>` WebApp link; outside Telegram, **Открыть в Telegram** is the fallback.
