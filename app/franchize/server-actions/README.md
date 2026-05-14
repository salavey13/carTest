# Franchize server-action boundaries

This folder is the focused server-action surface for the franchize plugin.

## Import rules

- New route/server code should import the smallest module it needs:
  - `catalog.ts` — storefront loaders and crew bike availability maintenance.
  - `config.ts` — franchize metadata load/save actions.
  - `promotions.ts` — promo-code validation.
  - `orders.ts` — order notification, checkout, invoice, and retry actions.
  - `reviews.ts` — rental review context, submission, moderation.
  - `rentals.ts` — rental contract reconciliation, availability checks, rental card loader.
  - `buy-print.ts` — PDF product-sheet generation and Telegram delivery for buy-listed bikes.
- Existing code may keep importing from `app/franchize/actions.ts`; that file is now a compatibility facade.
- Client components may import server actions only through `"use server"` modules. Never import `app/franchize/actions-runtime.ts` directly from client code.

## buy-print.ts

Generates a premium A4 product-sheet PDF and sends it to the requesting user via Telegram `sendDocument`.

### Entry point

`sendFranchizeBuyPrintPdf(input)` — validates Telegram session + crew ownership/admin role, fetches the bike, renders the PDF, delivers it. Returns `{ success, error?, fileName? }`.

### Access control

Only **admins** (`admin`, `vpradmin`) and the **crew owner** can request a PDF. Non-production environments fall back to `NEXT_PUBLIC_MOCK_USER_ID` when `NEXT_PUBLIC_USE_MOCK_USER === "true"`.

### PDF layout

```
┌──────────────────────────────────────┐
│ HEADER (near-black + gold accent)    │  ← deeper than page bg
├───────────────┬──────────────────────┤
│  Title        │                      │
│  Price        │    IMAGE PANEL       │
│  Description  │    (9:16 graphite)   │  ← same as page bg = seamless
│  ─────────    │                      │
│  Specs table  │       QR CODE        │  ← 220×220, white-on-black
│  (dark rows)  │   ──────────────     │
│               │   LINK BOX (dark)    │  ← lifted dark bg + gold border
├───────────────┴──────────────────────┤
│  ID: ...        Generated: ...       │  ← muted gray on dark
└──────────────────────────────────────┘    DARK GRAPHITE BACKGROUND
```

### Architecture decisions

- **All layout values are named module constants** — no magic numbers in the render function. Changing column widths, padding, font sizes, or spacing means editing one `const` at the top, not hunting through draw calls.
- **Colors are a typed `COLORS` constant** (`PdfColors` interface) — every `rgb()` call references `COLORS.xxx`, never inline values.
- **`PDFFont` is a type-only import** — it's used only in function signatures, not at runtime.
- **QR code fetch is wrapped in `try/catch`** with an `AbortController` timeout (8 s). A flaky QR API response will never crash the PDF pipeline — the card renders without the QR and logs a warning.
- **Hero image fetch also has an 8 s timeout** — same `AbortController` pattern in `embedImage()`. If the image fails, the panel shows centered fallback text ("Изображение недоступно") instead of an empty black box.
- **Spec table rows are vertically centered** — multiline values use `contentHeight` math (`rowHeight / 2 + contentHeight / 2`) instead of top-aligned nudges.
- **Spec rows dynamically resize** — `rowHeight = Math.max(MIN, contentHeight + padding)`. Pathological long words wrap to 2 lines max and the row grows to fit.
- **Specs section is conditionally rendered** — if `keySpecs` is empty, no orphaned "Характеристики" heading appears.
- **Timestamp is locale-stable** — `formatTimestamp()` uses manual `DD.MM.YYYY, HH:MM:SS` formatting instead of `toLocaleString("ru-RU")` to avoid host-dependent output.
- **Dark mode** — entire page uses a graphite background (`rgb(0.10, 0.11, 0.13)`), with near-white text (`rgb(0.92, 0.93, 0.95)`) and medium-gray labels. The image panel and page background are the same color, creating a seamless edge-to-edge product photo effect.
- **Header is deeper than page** — `rgb(0.05, 0.06, 0.08)` creates subtle depth separation from the graphite body without a hard contrast jump.
- **Spec table uses subtle dark borders** — `rgb(0.22, 0.23, 0.26)` lines are visible but don't fight the content.
- **Image panel uses the same graphite as the page** — the bike photo bleeds seamlessly into the background, no visible panel boundary.
- **Image panel is 9:16 portrait** — `height = width × 16/9 ≈ 430 px`, phone-screen proportions that flatter product photography.
- **QR code is 220×220** — doubled from the original 110px, fills the right column below the image. White QR on black background = maximum scan reliability + dark mode aesthetic.
- **QR code is stacked above the link box** — both in the right column only. No overlap with the left specs column.
- **Link box is dark with gold border** — `rgb(0.14, 0.15, 0.18)` background with the same gold accent as the header separator. Two-line layout: "Ссылка:" label → URL.
- **Header has a 2 px gold accent line** at its bottom edge — the only bright structural element, ties the header to the link box border.

### Things that were intentionally removed

- Bike availability status row
- "sale handoff" subtitle in header
- "Распечатайте и прикрепите…" print instruction sentence
- ID in the body area (moved to footer)

These made the card feel like an internal CRM export rather than a showroom-ready product sheet.

## Runtime note

`app/franchize/actions-runtime.ts` intentionally keeps the prior implementation intact during the boundary split. The files in this folder are the stable seams for the next extraction slices; move implementation detail behind these seams only when a focused slice has tests.
