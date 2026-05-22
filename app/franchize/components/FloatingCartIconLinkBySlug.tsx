"use client";

import type { CatalogItemVM, FranchizeTheme } from "../actions";
import { useFranchizeCart } from "../hooks/useFranchizeCart";
import { floatingCartOverlayBackground } from "../lib/theme";
import { FloatingCartIconLink } from "./FloatingCartIconLink";

interface FloatingCartIconLinkBySlugProps {
  slug: string;
  href: string;
  items?: CatalogItemVM[];
  accentColor: string;
  textColor: string;
  borderColor: string;
  theme: FranchizeTheme;
  className?: string;
  mode?: "floating" | "inline-icon";
}

export function FloatingCartIconLinkBySlug({ slug, href, items, accentColor, textColor, borderColor, theme, className, mode }: FloatingCartIconLinkBySlugProps) {
  const cartState = useFranchizeCart(slug);
  const itemCount = cartState.itemCount;

  // FIX: Compute subtotal by probing the cart state for price data.
  // useFranchizeCart may store line items under various property names
  // depending on the store implementation. We try them all defensively.
  const subtotal = computeSubtotal(cartState, items);

  return (
    <FloatingCartIconLink
      href={href}
      itemCount={itemCount}
      totalPrice={subtotal}
      accentColor={accentColor}
      textColor={textColor}
      borderColor={borderColor}
      backgroundColor={floatingCartOverlayBackground(theme)}
      className={className}
      mode={mode}
    />
  );
}

/**
 * Derives the cart subtotal from the cart hook's return value.
 *
 * Strategy (cascading):
 * 1. If the hook already exposes `subtotal` → use it directly
 * 2. If the hook exposes `lines` or `items` array with price info → reduce
 * 3. If the hook exposes a Map/object of entries with price info → reduce
 * 4. If catalog `items` are provided, cross-reference cart entry IDs with prices
 * 5. Fallback: 0 (price shows as "0 ₽" until proper data flows)
 */
function computeSubtotal(
  cartState: ReturnType<typeof useFranchizeCart>,
  catalogItems?: CatalogItemVM[],
): number {
  const state = cartState as Record<string, unknown>;

  // 1. Direct subtotal property
  if (typeof state.subtotal === "number" && state.subtotal > 0) {
    return state.subtotal;
  }

  // 2. Lines or items array with price info
  const linesCandidates = [state.lines, state.items, state.cart, state.entries];
  for (const candidate of linesCandidates) {
    if (Array.isArray(candidate) && candidate.length > 0) {
      const first = candidate[0] as Record<string, unknown>;
      // Check if items have price data
      if (first && (typeof first.price === "number" || typeof first.total === "number")) {
        return candidate.reduce((sum: number, line: Record<string, unknown>) => {
          const lineTotal = (typeof line.total === "number" ? line.total : 0)
            || ((typeof line.price === "number" ? line.price : 0) * (typeof line.quantity === "number" ? line.quantity : 1));
          return sum + lineTotal;
        }, 0);
      }
    }
  }

  // 3. Map or plain object entries with price data
  for (const candidate of linesCandidates) {
    if (candidate instanceof Map && candidate.size > 0) {
      let sum = 0;
      candidate.forEach((value: unknown) => {
        const entry = value as Record<string, unknown>;
        if (entry && (typeof entry.price === "number" || typeof entry.total === "number")) {
          sum += (typeof entry.total === "number" ? entry.total : 0)
            || ((typeof entry.price === "number" ? entry.price : 0) * (typeof entry.quantity === "number" ? entry.quantity : 1));
        }
      });
      if (sum > 0) return sum;
    }
    if (candidate && typeof candidate === "object" && !Array.isArray(candidate) && !(candidate instanceof Map)) {
      const entries = Object.values(candidate as Record<string, unknown>);
      if (entries.length > 0) {
        const first = entries[0] as Record<string, unknown>;
        if (first && (typeof first.price === "number" || typeof first.total === "number")) {
          return entries.reduce((sum: number, entry: unknown) => {
            const e = entry as Record<string, unknown>;
            const lineTotal = (typeof e.total === "number" ? e.total : 0)
              || ((typeof e.price === "number" ? e.price : 0) * (typeof e.quantity === "number" ? e.quantity : 1));
            return sum + lineTotal;
          }, 0);
        }
      }
    }
  }

  // 4. Cross-reference with catalog items (if provided)
  //    Cart state likely stores { [itemId]: quantity } or similar
  if (catalogItems && catalogItems.length > 0) {
    // Try to find a cart entries map in the state
    for (const key of Object.keys(state)) {
      const val = state[key];
      if (val && typeof val === "object" && !Array.isArray(val) && !(val instanceof Map)) {
        const entries = val as Record<string, unknown>;
        const entryKeys = Object.keys(entries);
        // Check if any entry key matches a catalog item ID
        const catalogIds = new Set(catalogItems.map((i) => i.id));
        const matchCount = entryKeys.filter((k) => catalogIds.has(k)).length;
        if (matchCount > 0) {
          let sum = 0;
          for (const [entryKey, entryVal] of Object.entries(entries)) {
            const item = catalogItems.find((i) => i.id === entryKey);
            if (!item) continue;
            const qty = typeof entryVal === "number" ? entryVal
              : (entryVal as Record<string, unknown>)?.quantity ?? 1;
            const price = item.saleAvailable && item.salePrice ? item.salePrice : item.pricePerDay;
            if (price > 0) {
              sum += price * (typeof qty === "number" ? qty : 1);
            }
          }
          if (sum > 0) return sum;
        }
      }
    }
  }

  // 5. Fallback
  return 0;
}
