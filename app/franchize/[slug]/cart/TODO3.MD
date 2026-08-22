# 🏍️ Cart Component Implementations

> **Part 3 of 4** — Read TODO.MD + TODO2.MD first. This file contains all component code.

---

## Breadcrumb (inline, no separate file)

```tsx
<nav aria-label="Breadcrumb" className="mb-2">
  <p className="text-xs uppercase tracking-[0.2em]"
     style={{ color: crew.theme.palette.accentMain }}>
    / FRANCHIZE / {crew.header.brandName?.toUpperCase() ?? slug.toUpperCase()} / CART
  </p>
</nav>
```

## Title Section (inline, no separate file)

```tsx
<h1 className="mt-2 text-2xl font-semibold font-orbitron">Корзина</h1>
<p className="mt-2 text-sm" style={surface.mutedText}>
  Проверьте состав заказа, количество и итог перед оформлением.
</p>
```

---

## CartItemCard — Detailed Spec

```tsx
// Container
<motion.article
  layout
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  exit={{ opacity: 0, x: -100 }}   // slide-out on delete
  transition={{ duration: 0.25 }}
  className="rounded-2xl border overflow-hidden"
  style={surface.card}
>
  <div className="flex gap-4 p-4">

    {/* LEFT: Product image — 9:16 PORTRAIT (tall, like a phone screen) */}
    <div className="relative w-24 h-[170px] shrink-0 rounded-lg overflow-hidden"
         style={{ backgroundColor: withAlpha(crew.theme.palette.borderSoft, 0.15) }}>
      {line.item?.imageUrl ? (
        <Image
          src={line.item.imageUrl}
          alt={line.item.title}
          fill
          className="object-cover"
          sizes="96px"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <Bike className="h-10 w-10" style={surface.mutedText} />
        </div>
      )}
      {/* Subtle glow border on image */}
      <div className="absolute inset-0 rounded-lg pointer-events-none"
           style={{ boxShadow: `inset 0 0 12px ${withAlpha(crew.theme.palette.accentMain, 0.15)}` }} />
    </div>

    {/* RIGHT: Info */}
    <div className="flex-1 min-w-0">

      {/* Title row with delete button */}
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-base font-semibold font-orbitron truncate">
          {line.item?.title ?? "Позиция недоступна"}
        </h2>

        {/* Delete: icon + text, per megacart.png — inline confirm (NO alert!) */}
        {confirmDeleteId === line.lineId ? (
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-[10px]" style={{ color: destructiveColor }}>Удалить?</span>
            <button onClick={() => handleDelete(line.lineId)}
                    aria-label="Подтвердить удаление"
                    className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                    style={{ backgroundColor: withAlpha(destructiveColor, 0.2), color: destructiveColor }}>
              Да
            </button>
            <button onClick={() => setConfirmDeleteId(null)}
                    aria-label="Отменить удаление"
                    className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                    style={surface.mutedText}>
              Нет
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDeleteId(line.lineId)}
            aria-label="Удалить товар"
            className="shrink-0 flex items-center gap-1 text-xs transition-colors"
            style={{ color: crew.theme.palette.textSecondary }}
          >
            Удалить
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Orphaned item warning */}
      {!line.item && (
        <p className="text-xs italic mt-1" style={{ color: "#FF9500" }}>
          Товар больше недоступен в каталоге
        </p>
      )}

      {/* Short description (muted) — e.g. "Электроскутер 3000W" */}
      {line.item?.subtitle && (
        <p className="text-xs mt-0.5" style={surface.mutedText}>
          {line.item.subtitle}
        </p>
      )}

      {/* Rent/Buy badge — per megacart.png: Покупка is MUTED GRAY, Аренда uses accent */}
      <span className="mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold"
            style={line.saleAvailable ? {
              backgroundColor: withAlpha(crew.theme.palette.textSecondary, 0.15),
              color: crew.theme.palette.textSecondary,
            } : {
              backgroundColor: withAlpha(crew.theme.palette.accentMain, 0.08),
              color: crew.theme.palette.accentMain,
            }}>
        {line.saleAvailable ? "Покупка" : "Аренда"}
      </span>

      {/* Spec badges row (NEW — extract from item.specs JSONB) */}
      {line.item && <SpecBadges specs={line.item.specs} theme={crew.theme} />}

      {/* Price section — Buy price is THE BIGGEST text on the card + gold glow */}
      <div className="mt-2">
        {line.saleAvailable ? (
          // BUY flow: largest font on card + gold glow effect (Grok: "самый крупный шрифт + gold glow")
          <>
            <p className="text-xs" style={surface.mutedText}>Цена покупки</p>
            <p className="text-2xl font-bold font-orbitron"
               style={{
                 color: crew.theme.palette.accentMain,
                 textShadow: `0 0 12px ${withAlpha(crew.theme.palette.accentMain, 0.45)}`,
               }}>
              {line.item?.salePrice?.toLocaleString("ru-RU")} ₽
            </p>
          </>
        ) : (
          // RENT flow: per-day price + ВЫГОДНО badge
          <>
            <p className="text-xs" style={surface.mutedText}>Цена за 1 день</p>
            <div className="flex items-center gap-2">
              <AnimatePresence mode="popLayout">
                <motion.p
                  key={`${line.lineId}-${line.qty}`}
                  className="text-xl font-bold"
                  initial={{ scale: 1.15, opacity: 0.6 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.2 }}
                >
                  {line.item?.rentPriceLabel}
                </motion.p>
              </AnimatePresence>
              <span className="rounded px-1.5 py-0.5 text-[10px] font-bold"
                    style={{
                      backgroundColor: withAlpha("#00C853", 0.2),
                      border: `1px solid ${withAlpha("#00C853", 0.3)}`,
                      color: "#00C853",
                    }}>
                ВЫГОДНО
              </span>
            </div>
          </>
        )}
      </div>

      {/* Quantity controls (Rent ONLY, NEW with animations) */}
      {!line.saleAvailable && (
        <QuantityControl
          qty={line.qty}
          onDecrease={() => changeLineQty(line.lineId, -1)}
          onIncrease={() => changeLineQty(line.lineId, 1)}
          borderColor={crew.theme.palette.borderSoft}
          accentColor={crew.theme.palette.accentMain}
        />
      )}
    </div>
  </div>
</motion.article>
```

---

## SpecBadge Component (`/app/franchize/components/cart/SpecBadge.tsx`)

Extract spec values from `line.item?.specs` JSONB. The specs object likely contains keys like `power`, `battery_capacity`, `range`, `top_speed`, `acceleration`.

```tsx
"use client";
import type { FranchizeTheme } from "../../actions";
import { withAlpha } from "../../lib/theme";
import { Zap, Battery, Gauge, Palette } from "lucide-react";

interface SpecBadgeProps {
  icon: React.ReactNode;
  value: string;
  theme: FranchizeTheme;
}

export function SpecBadge({ icon, value, theme }: SpecBadgeProps) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium"
          style={{
            backgroundColor: withAlpha(theme.palette.bgBase, 0.6),
            border: `1px solid ${withAlpha(theme.palette.borderSoft, 0.5)}`,
            color: theme.palette.textPrimary,
          }}>
      <span style={{ color: theme.palette.accentMain }}>{icon}</span>
      {value}
    </span>
  );
}

// Convenience wrapper that renders all three spec badges
interface SpecBadgesProps {
  specs: Record<string, unknown> | undefined;
  theme: FranchizeTheme;
}

export function SpecBadges({ specs, theme }: SpecBadgesProps) {
  const extracted = extractSpecs(specs);
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      <SpecBadge icon={<Zap className="h-3 w-3" />} value={extracted.power} theme={theme} />
      <SpecBadge icon={<Battery className="h-3 w-3" />} value={extracted.battery} theme={theme} />
      <SpecBadge icon={<Gauge className="h-3 w-3" />} value={extracted.range} theme={theme} />
      {/* 4th spec: color — per megacart.png shows "Цвет: Черный" badge */}
      {extracted.color && (
        <SpecBadge icon={<Palette className="h-3 w-3" />} value={extracted.color} theme={theme} />
      )}
    </div>
  );
}

// Helper to extract specs from item.specs JSONB
// Handles multiple possible key names from different data sources
function extractSpecs(specs: Record<string, unknown> | undefined) {
  const colorVal = specs?.color ?? specs?.цвет ?? null;
  return {
    power: String(specs?.power_kw ?? specs?.power ?? "—") + " кВт",
    battery: String(specs?.battery_label ?? `${specs?.battery_v ?? ""}V ${specs?.battery_ah ?? ""}Ah`),
    range: "до " + String(specs?.range_km ?? specs?.range ?? "—") + " км",
    color: colorVal ? String(colorVal) : null,  // e.g. "Черный" — shown as 4th badge per megacart.png
  };
}
```

---

## QuantityControl Component (`/app/franchize/components/cart/QuantityControl.tsx`)

```tsx
"use client";
import { motion, AnimatePresence } from "framer-motion";
import { withAlpha } from "../../lib/theme";

interface QuantityControlProps {
  qty: number;
  onDecrease: () => void;
  onIncrease: () => void;
  borderColor: string;
  accentColor: string;
}

export function QuantityControl({ qty, onDecrease, onIncrease, borderColor, accentColor }: QuantityControlProps) {
  return (
    <div className="mt-3 flex items-center gap-3">
      {/* CIRCULAR buttons per megacart.png — not rounded rectangles */}
      <motion.button
        whileTap={{ scale: 0.9 }}
        disabled={qty <= 1}
        aria-label="Уменьшить количество"
        className="h-9 w-9 rounded-full border text-lg transition-colors disabled:opacity-40 flex items-center justify-center"
        style={{ borderColor, color: accentColor }}
        onClick={onDecrease}
      >
        −
      </motion.button>
      <AnimatePresence mode="popLayout">
        <motion.span
          key={qty}
          initial={{ scale: 1.3, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.7, opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="text-sm font-medium w-6 text-center"
        >
          {qty}
        </motion.span>
      </AnimatePresence>
      <motion.button
        whileTap={{ scale: 0.9 }}
        aria-label="Увеличить количество"
        className="h-9 w-9 rounded-full border text-lg transition-colors flex items-center justify-center"
        style={{ borderColor, color: accentColor }}
        onClick={onIncrease}
      >
        +
      </motion.button>
    </div>
  );
}
```

> **Note**: `qty <= 1` disables the decrease button. User must use delete to remove. This prevents accidental zero-qty state and keeps cart logic clean.

---

## OrderSummary Component (`/app/franchize/components/cart/OrderSummary.tsx`)

```tsx
"use client";
import { motion } from "framer-motion";
import type { FranchizeCrewVM } from "../../actions";
import type { CartLine } from "../../hooks/useFranchizeCartLines";
import { crewPaletteForSurface, withAlpha } from "../../lib/theme";
import { DiscountBanner } from "./DiscountBanner";

interface OrderSummaryProps {
  cartLines: CartLine[];
  subtotal: number;
  crew: FranchizeCrewVM;
}

export function OrderSummary({ cartLines, subtotal, crew }: OrderSummaryProps) {
  const surface = crewPaletteForSurface(crew.theme);
  const rentLines = cartLines.filter(l => !l.saleAvailable);
  const buyLines = cartLines.filter(l => l.saleAvailable);

  // Rental days from line options (NOT hardcoded!)
  const totalRentalDays = rentLines.length > 0
    ? rentLines.reduce((sum, l) => sum + (l.options.duration ?? 1), 0) / rentLines.length
    : 0;

  const rentDailyTotal = rentLines.reduce((sum, l) => sum + (l.item?.pricePerDay ?? 0) * l.qty, 0);
  const rentPeriodTotal = rentDailyTotal * Math.round(totalRentalDays);
  const buyTotal = buyLines.reduce((sum, l) => sum + (l.item?.salePrice ?? 0), 0);
  const grandTotal = rentPeriodTotal + buyTotal;

  // Discount — franchise perk (TODO: wire to crew.catalog.discountPercent when available)
  const discountPercent = 5;
  const discountAmount = Math.round(grandTotal * discountPercent / 100);

  return (
    <motion.aside
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2, duration: 0.3 }}
      className="rounded-2xl border p-4"
      style={surface.card}
    >
      <p className="text-sm" style={surface.mutedText}>Итого позиций</p>
      <p className="text-2xl font-semibold">{cartLines.length}</p>

      {rentLines.length > 0 && (
        <>
          <p className="mt-3 text-sm" style={surface.mutedText}>Сумма за 1 день аренды</p>
          <p className="text-lg font-semibold">{rentDailyTotal.toLocaleString("ru-RU")} ₽</p>
        </>
      )}

      <div className="my-3 border-t" style={{ borderColor: crew.theme.palette.borderSoft }} />

      <p className="text-sm" style={surface.mutedText}>Сумма за весь период</p>
      <p className="text-2xl font-bold" style={{ color: crew.theme.palette.accentMain }}>
        {grandTotal.toLocaleString("ru-RU")} ₽
      </p>
      {rentLines.length > 0 && totalRentalDays > 0 && (
        <span className="inline-flex items-center gap-1 mt-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
              style={{
                backgroundColor: withAlpha(crew.theme.palette.accentMain, 0.1),
                border: `1px solid ${withAlpha(crew.theme.palette.accentMain, 0.2)}`,
                color: crew.theme.palette.accentMain,
              }}>
          <Calendar className="h-3 w-3" />
          {Math.round(totalRentalDays)} {pluralizeDays(Math.round(totalRentalDays))} аренды
        </span>
      )}

      <DiscountBanner percent={discountPercent} amount={discountAmount} />
    </motion.aside>
  );
}

// Russian pluralization for days
function pluralizeDays(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return "дней";
  if (mod10 === 1) return "день";
  if (mod10 >= 2 && mod10 <= 4) return "дня";
  return "дней";
}
```

---

## DiscountBanner Component (`/app/franchize/components/cart/DiscountBanner.tsx`)

```tsx
"use client";
import { motion } from "framer-motion";
import { withAlpha } from "../../lib/theme";

interface DiscountBannerProps {
  percent: number;
  amount: number;
}

export function DiscountBanner({ percent, amount }: DiscountBannerProps) {
  if (percent <= 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="mt-3 flex items-center justify-between rounded-lg border p-3 overflow-hidden relative"
      style={{
        backgroundColor: withAlpha("#00C853", 0.08),
        borderColor: withAlpha("#00C853", 0.25),
      }}
    >
      {/* Shimmer overlay — uses CSS @keyframes defined below */}
      <div className="absolute inset-0 pointer-events-none cart-shimmer" />
      <span className="text-sm font-medium" style={{ color: "#00C853" }}>
        У вас действует скидка {percent}%
      </span>
      <span className="text-base font-bold" style={{ color: "#00C853" }}>
        −{amount.toLocaleString("ru-RU")} ₽
      </span>
    </motion.div>
  );
}
```

**Shimmer CSS** — add this to `globals.css` (or inline via `<style>` in the cart page if you can't modify globals):

```css
@keyframes cart-shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
.cart-shimmer {
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(0, 200, 83, 0.06) 50%,
    transparent 100%
  );
  background-size: 200% 100%;
  animation: cart-shimmer 3s ease-in-out infinite;
}
```

---

## ProtectionPlan Component (`/app/franchize/components/cart/ProtectionPlan.tsx`)

```tsx
"use client";
import { motion } from "framer-motion";
import { Shield } from "lucide-react";
import type { FranchizeCrewVM } from "../../actions";
import { crewPaletteForSurface, readablePaletteTextOnColor, withAlpha } from "../../lib/theme";

interface ProtectionPlanProps {
  crew: FranchizeCrewVM;
}

export function ProtectionPlan({ crew }: ProtectionPlanProps) {
  const surface = crewPaletteForSurface(crew.theme);
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className="flex items-center justify-between rounded-2xl border p-4"
      style={{
        ...surface.card,
        boxShadow: `0 0 12px ${withAlpha(crew.theme.palette.accentMain, 0.08)}`,
      }}
    >
      <div className="flex items-center gap-3">
        <Shield className="h-6 w-6" style={{ color: crew.theme.palette.accentMain }} />
        <div>
          <p className="text-sm font-semibold">Полная защита включена</p>
          <p className="text-xs" style={surface.mutedText}>
            Кража, повреждения и техподдержка 24/7
          </p>
        </div>
      </div>
      <span className="rounded px-3 py-1 text-xs font-bold"
            style={{
              backgroundColor: crew.theme.palette.accentMain,
              color: readablePaletteTextOnColor(crew.theme.palette.accentMain, crew.theme.palette),
            }}>
        Включено
      </span>
    </motion.div>
  );
}
```

---

## TrustBadges Component (`/app/franchize/components/cart/TrustBadges.tsx`)

```tsx
"use client";
import { motion } from "framer-motion";
import { Zap, Shield, Headphones } from "lucide-react";
import type { FranchizeCrewVM } from "../../actions";

interface TrustBadgesProps {
  crew: FranchizeCrewVM;
}

export function TrustBadges({ crew }: TrustBadgesProps) {
  const badges = [
    { Icon: Zap, label: "Быстрое оформление" },
    { Icon: Shield, label: "Без скрытых платежей" },
    { Icon: Headphones, label: "Поддержка 24/7" },
  ];

  return (
    <div className="flex justify-center gap-6 py-4">
      {badges.map((badge, i) => (
        <motion.div
          key={badge.label}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 + i * 0.1 }}
          className="flex flex-col items-center gap-1"
        >
          <badge.Icon className="h-4 w-4" style={{ color: crew.theme.palette.accentMain }} />
          <span className="text-[11px] text-center" style={{ color: crew.theme.palette.textSecondary }}>
            {badge.label}
          </span>
        </motion.div>
      ))}
    </div>
  );
}
```

---

## CheckoutButton Component (`/app/franchize/components/cart/CheckoutButton.tsx`)

```tsx
"use client";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import type { FranchizeCrewVM } from "../../actions";
import { readablePaletteTextOnColor, withAlpha } from "../../lib/theme";

interface CheckoutButtonProps {
  onClick: () => void;
  isLoading: boolean;
  crew: FranchizeCrewVM;
}

export function CheckoutButton({ onClick, isLoading, crew }: CheckoutButtonProps) {
  return (
    <motion.button
      whileHover={{
        scale: 1.01,
        boxShadow: `0 6px 24px ${withAlpha(crew.theme.palette.accentMain, 0.35)}`,
      }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      disabled={isLoading}
      aria-label="Перейти к оформлению"
      className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl px-6 py-4 text-base font-bold transition-shadow disabled:opacity-70"
      style={{
        backgroundColor: crew.theme.palette.accentMain,
        color: readablePaletteTextOnColor(crew.theme.palette.accentMain, crew.theme.palette),
        boxShadow: `0 4px 12px ${withAlpha(crew.theme.palette.accentMain, 0.2)}`,
      }}
    >
      {isLoading ? "Сохранение..." : "Перейти к оформлению"}
      {!isLoading && <ArrowRight className="h-5 w-5" />}
    </motion.button>
  );
}
```

---

## EmptyCartState Component (`/app/franchize/components/cart/EmptyCartState.tsx`)

```tsx
"use client";
import { motion } from "framer-motion";
import { ShoppingCart } from "lucide-react";
import type { FranchizeCrewVM } from "../../actions";
import { crewPaletteForSurface } from "../../lib/theme";

interface EmptyCartStateProps {
  crew: FranchizeCrewVM;
  slug: string;
  onNavigateToCatalog: () => void;
}

export function EmptyCartState({ crew, slug, onNavigateToCatalog }: EmptyCartStateProps) {
  const surface = crewPaletteForSurface(crew.theme);
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      className="mt-8 flex flex-col items-center gap-4 rounded-2xl border border-dashed p-8"
      style={surface.subtleCard}
    >
      <ShoppingCart className="h-16 w-16" style={{ color: crew.theme.palette.borderSoft }} />
      <h2 className="text-lg font-semibold">Корзина пуста</h2>
      <p className="text-sm" style={surface.mutedText}>Добавьте байк из каталога</p>
      <button
        onClick={onNavigateToCatalog}
        aria-label="Перейти к каталогу"
        className="rounded-xl border px-6 py-2.5 text-sm font-semibold transition hover:brightness-110"
        style={{
          borderColor: crew.theme.palette.accentMain,
          color: crew.theme.palette.accentMain,
        }}
      >
        Перейти к каталогу
      </button>
    </motion.div>
  );
}
```

---

## Easter Egg (inline in CartPageClient, no separate file)

```tsx
<div className="mt-16 text-center opacity-30 hover:opacity-100 transition-all duration-700 text-[10px] font-mono tracking-widest"
     style={{ color: crew.theme.palette.textSecondary }}>
  Easter egg for future maintainers:<br/>
  天上天下，唯我独尊 // May your code be clean and your bugs be few.<br/>
  — Built with neon &amp; spite — 2026 —
</div>
```

---

## Delete Confirmation (inline in CartItemCard, NO alert())

```tsx
// At CartPageClient level:
const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
const destructiveColor = crew.theme.mode === "dark" ? "#FF6B6B" : "#FF3B30";

const handleDelete = useCallback((lineId: string) => {
  removeLine(lineId);
  setConfirmDeleteId(null);
}, [removeLine]);

// In CartItemCard (see full code above):
// - Trash icon button → sets confirmDeleteId
// - When confirmed → calls handleDelete(line.lineId)
// - AnimatePresence on parent wraps the card for slide-out animation
```

---

## Page-Level Animation (stagger entrance with delete support)

```tsx
<AnimatePresence mode="popLayout">
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ duration: 0.4 }}
  >
    {/* Breadcrumb */}
    {/* Title */}
    {/* Cart items with stagger + delete animation */}
    <div className="space-y-3">
      {cartLines.map((line, index) => (
        <motion.div
          key={line.lineId}
          layout
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, x: -100 }}
          transition={{
            delay: index * 0.08,
            duration: 0.3,
            layout: { duration: 0.2 },
          }}
        >
          <CartItemCard line={line} ... />
        </motion.div>
      ))}
    </div>
  </motion.div>
</AnimatePresence>
```

> The `exit={{ opacity: 0, x: -100 }}` creates the **slide-out-left** animation when an item is removed. `AnimatePresence` keeps the element in the DOM during the exit animation. `layout` prop animates position changes when items above are deleted.

---

**→ Next: [TODO4.MD](./TODO4.MD) — Review checklists, integration, quality gates**
