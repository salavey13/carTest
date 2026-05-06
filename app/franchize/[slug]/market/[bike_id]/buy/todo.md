# 🏎️ Franchise Engine Enhancements: V2 Upgrade 

**Context:** 
We are building a premium e-moto franchise SaaS (`/app/franchize/`). Dark-themed (`crew.theme.palette`), `surface.subtleCard`, `font-orbitron`. 
**CRITICAL:** All React hooks and useMemo/useEffect calls MUST remain inside the component function body. Do NOT append hooks at the module scope.

---

## Task 1: Inline "VS" Comparison (No Separate Page)

**Goal:** Instead of a dedicated compare page, allow users to tap a "VS" icon on another bike to instantly overlay a side-by-side spec comparison directly on the current Sale Landing Page or Item Modal. 

### 1.1 Create the VS UI Primitive (`/components/franchize/VsSpecRow.tsx`)
A tiny, reusable component for a single spec row.
**Props:** 
- `label: string` (e.g., "Запас хода")
- `valueA: string | number` (Current bike)
- `valueB: string | number` (VS bike)
- `unit?: string` (e.g., "км/ч")
- `lowerIsBetter?: boolean` (default: false)
**Logic:**
- Parse `valueA` and `valueB` to numbers for comparison. If parsing fails, just display them as text (no colors).
- Determine winner based on `lowerIsBetter`.
- **Styling:** 
  - Left side (Current): `text-white`
  - Right side (VS): `text-white`
  - Apply `text-emerald-400 font-bold` to the winning value. Apply `text-white/40` to the losing value.

### 1.2 Update Server Components to fetch the VS Bike
**Sale Page (`app/franchize/[slug]/market/[bike_id]/buy/page.tsx`):**
- Read `vs` from `searchParams`.
- If `vs` exists, query the database for the bike with that ID (using your existing Supabase logic from `actions.ts`).
- Pass it as `vsItem: CatalogItemVM | null` to `<SaleBikeLandingClient>`.

**Rent Modal (`/app/franchize/modals/Item.tsx`):**
- It already receives the full `items` array.
- No server changes needed; we will handle the logic client-side.

### 1.3 Integrate VS into Sale Landing (`/app/franchize/components/SaleBikeLandingClient.tsx`)
**New Props:** `vsItem: CatalogItemVM | null`
**Trigger UI (Top right of the hero section):**
- If `!vsItem`, render a small dropdown/popover using standard UI components (or just a simple absolute div) listing `otherSaleBikes` (you can pass a subset of sale bikes as a prop, e.g., `otherSaleBikes: CatalogItemVM[]`).
- Next to each bike name, put a `Swords` icon (from lucide-react).
- Clicking it appends `?vs=${bike.id}` to the URL (use `router.push` or `window.history.pushState`).
**The Comparison Overlay:**
- If `vsItem` IS present, render a section right under the main specs grid.
- Header: Two columns. Left: Current bike title. Right: VS bike title. A massive `Swords` icon in the middle.
- Body: Map over an array of specs: `[{ label: 'Мощность', key: 'power_kw', lowerIsBetter: false }, { label: 'Запас хода', key: 'range_km', lowerIsBetter: false }, { label: 'Вес', key: 'weight_kg', lowerIsBetter: true }]`.
- Render `<VsSpecRow>` for each.
- **Close button:** A small "X" that calls `router.push(window.location.pathname, { scroll: false })` to strip the `?vs=` param.

### 1.4 Integrate VS into Rent Modal (`/app/franchize/modals/Item.tsx`)
- Add local state: `const [vsBike, setVsBike] = useState<CatalogItemVM | null>(null);`
- At the bottom of the modal (before the Add to Cart buttons), add a collapsed section: "Сравнить с другой моделью".
- Show a mini-grid of other available bikes (filter out the currently viewed `selectedItem`).
- Each mini-card has a `Swords` icon. Clicking it sets `vsBike`.
- If `vsBike` is set, render the exact same `<VsSpecRow>` layout inside the modal.
- This keeps the user inside the modal flow without losing their rental configuration options.

### 1.5 Styling Rules for VS
- The VS container should use `surface.subtleCard` and `border-white/10`.
- Do NOT make it look like a boring HTML table. Use a clean CSS Grid (`grid-cols-[1fr_auto_1fr]`) for the spec rows.
- Use `text-xs` or `text-sm` to keep it compact so it doesn't push the main CTA buttons off the screen on mobile.
- Add a subtle `bg-white/5` background to the column of the "winning" bike to subconsciously guide the user's eye.

---

## Task 2: "Sale" Flow XTR Interest Invoice (Autotestdrive)

**Goal:** Stop asking for full price via Telegram Stars (XTR) for sales. Instead, request a micro-payment (e.g., 100-500 XTR) framed as an "Autotestdrive Reservation" to capture intent, exactly like the rental flow.

### 2.1 Backend: Modify XTR Calculation (`/app/franchize/actions.ts`)
- Locate the `createFranchizeOrderInvoiceInternal` function.
- Currently, it calculates: `const amountXtr = Math.max(1, Math.ceil(effectiveTotal * 0.01));`
- **Change:** Add a condition for `flowType`.
  ```typescript
  let amountXtr: number;
  let invoiceTitle = "Franchize: подтверждение намерения";
  let invoiceDescriptionPrefix = "Подтверждение аренды";

  if (payload.flowType === "sale") {
    // Fixed small amount for sale test-drive reservation (e.g., 100 XTR = ~100 rubles)
    // Or make it 0.1% of the bike price, capped at 500 XTR.
    amountXtr = Math.min(500, Math.max(100, Math.ceil(effectiveTotal * 0.001))); 
    invoiceTitle = "Franchize: Бронь тест-драйва";
    invoiceDescriptionPrefix = "Резерв на тест-драйв и получение спеццены на";
  } else {
    amountXtr = Math.max(1, Math.ceil(effectiveTotal * 0.01));
  }
  ```
- Update the `sendTelegramInvoice` call to use the dynamic `invoiceTitle`.
- Update the `description` string builder to use `invoiceDescriptionPrefix` instead of hardcoding "Экипаж:".

### 2.2 Frontend: Modify Sale Landing CTA (`/app/franchize/components/SaleBikeLandingClient.tsx`)
- Currently, the primary gold button triggers `handleAddToCart` (which puts a 520k item in the cart).
- **Change the Primary Action:** Replace the "Добавить в корзину" button with a "Забронировать тест-драйв (100 ₽)" button.
- This button should call a new function `handleReserveTestDrive()`.
- `handleReserveTestDrive()` logic:
  1. Check if `isHydrated`.
  2. Call `createFranchizeOrderInvoice` via a Server Action (you may need to expose it or create a thin wrapper server action if it isn't already).
  3. Payload must include `flowType: "sale"`, `payment: "telegram_xtr"`, and the cart lines.
  4. Set local state `cartState` to "loading", then "success".
- **Secondary Action:** Move the old "Оформить покупку" to a secondary outline button. This can just link to Telegram (`https://t.me/oneBikePlsBot`) or trigger the DOCX contract flow, but it should NOT trigger the XTR invoice.
- **Update Copy:** Above the buttons, add a small trust text: 
  ```tsx
  <p className="text-xs opacity-70">Оплата 100 ₽ через Telegram — гарантия вашей брони на тест-драйв. Остаток суммы при покупке на базе.</p>
  ```

### 2.3 Mobile Sticky Bar Update (`SaleBikeLandingClient.tsx`)
- Update the bottom fixed bar to match the new primary CTA.
- Change text to "Тест-драйв 100 ₽" and trigger `handleReserveTestDrive`.

---

## 🛑 Anti-Hallucination Rules for Codex:
1. Do NOT create new files in `/lib/` unless explicitly instructed. Put React components in `/components/` or `/app/franchize/components/`.
2. Do NOT modify `map-riders-reducer.ts` or any map files for this task.
3. Ensure all new UI text is in Russian.
4. When using `crew.theme.palette.accentMain`, always wrap it in inline styles: `style={{ color: crew.theme.palette.accentMain }}`. Do not try to pass it as a Tailwind class dynamically.
5. Keep the `safeGallery` and `useEffect` logic inside the component body!
