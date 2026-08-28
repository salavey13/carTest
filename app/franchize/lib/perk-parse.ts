/**
 * Perk-string parsing shared by the cart hook and the server-side order
 * sanitizer. Pure functions — no React / server-action imports, safe for
 * both client bundles and vitest.
 *
 * The Item modal stores the extras selection in the cart line's `perk`
 * field via extrasSummary(), which emits e.g. "Шлем ×2, Перчатки" —
 * note the SPACE before the × multiplier.
 */

/**
 * Cart pricing parser: counts helmets for the price calculator.
 * STRICT — only ×N / xN forms count; a bare "шлем" (e.g. legacy perk
 * "Шлем + GoPro", whose helmet is covered by the flat perk surcharge)
 * prices as 0 helmets.
 *
 * HOTFIX (2026-08-28): the old regex /шлем×(\d+)/ was NOT space-tolerant,
 * so "Шлем ×2" never matched and helmets were silently NOT priced in the
 * cart/order (the modal showed 12 000 ₽ while the cart charged 10 000 ₽).
 */
export function parseHelmetCount(perk: string): number {
  const match = perk.match(/шлем\s*[×x]\s*(\d+)/i);
  if (!match) return 0;
  const count = Number(match[1]);
  return Math.max(0, Math.min(2, Number.isFinite(count) ? count : 0));
}

/**
 * Server-side parser (equipment parity with actions-runtime's
 * rentalEquipment): like parseHelmetCount, but a bare "шлем" mention
 * counts as 1 helmet — the /doc flow always assumes at least the helmet
 * when the perk mentions one.
 */
export function parseHelmetCountFromPerk(perk: unknown): number {
  const perkStr = String(perk ?? "");
  const m = perkStr.match(/шлем\s*[×x]\s*(\d+)/i);
  if (m) {
    const n = Number(m[1]);
    return Math.max(0, Math.min(2, Number.isFinite(n) ? n : 0));
  }
  return /шлем/i.test(perkStr) ? 1 : 0;
}

/**
 * FIX (2026-08-29, "gloves not priced"): parse the NON-helmet extras from
 * the cart line's perk string into a selection object for the pricing
 * calculator. Label regexes mirror actions-runtime's rentalEquipment parse
 * and the Item modal's extrasSummary() output ("Шлем ×1, Перчатки, Куртка").
 *
 * The perk string is the ONLY channel the extras selection travels through
 * (modal → cart line options.perk), so this is the single parse point for
 * both the cart hook (client) and the order-money sanitizer (server).
 */
export type PerkExtras = {
  gloves: boolean;
  jacket: boolean;
  pants: boolean;
  boots: boolean;
  net: boolean;
  backpack: boolean;
  bag: boolean;
  charger: boolean;
};

export function parseExtrasFromPerk(perk: unknown): PerkExtras {
  const perkStr = String(perk ?? "").toLowerCase();
  return {
    gloves: /перчатк/.test(perkStr),
    jacket: /куртк/.test(perkStr),
    pants: /штан/.test(perkStr),
    boots: /бот[аы]|сапог/.test(perkStr),
    net: /сетк/.test(perkStr),
    backpack: /рюкзак/.test(perkStr),
    bag: /сумк|багажн/.test(perkStr),
    charger: /зарядк/.test(perkStr),
  };
}
