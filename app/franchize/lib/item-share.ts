/**
 * Share links for catalog bike cards (Item modal).
 *
 * Deep-link formats handled by hooks/useStartParamRouter.ts:
 *   rent_{bikeId} → /franchize/{slug}?vehicle={bikeId}&flow=rent (catalog + bike modal pre-opened)
 *   sale_{bikeId} → /franchize/{slug}/market/{bikeId}/buy      (sale landing page)
 *   buy_{bikeId}  → legacy alias of sale_ (used by CSV exports)
 *
 * The share flow:
 *   1. one flow available  → tapping «Поделиться» opens the Telegram share
 *      dialog immediately with that link;
 *   2. both flows available → a compact choice row appears (аренда / покупка)
 *      so each shared message carries exactly one clean link.
 */

export type ItemShareFlow = "rent" | "sale";

export interface ItemShareLinks {
  rent: string;
  sale: string;
}

function sanitizeBotUsername(botUsername: string): string {
  return String(botUsername || "")
    .trim()
    .replace(/^@+/, "")
    .replace(/[^a-zA-Z0-9_]/g, "");
}

/**
 * Build the t.me/app deep-links for a bike (rent + sale).
 * Bot username falls back to oneBikePlsBot (the VIP Bike bot) when the crew
 * theme doesn't provide one.
 */
export function buildItemDeepLinks(bikeId: string, botUsername: string): ItemShareLinks {
  const bot = sanitizeBotUsername(botUsername) || "oneBikePlsBot";
  const id = String(bikeId || "").trim().toLowerCase();
  return {
    rent: `https://t.me/${bot}/app?startapp=rent_${id}`,
    sale: `https://t.me/${bot}/app?startapp=sale_${id}`,
  };
}

/**
 * Which flows the share button should offer, mirroring the modal CTA
 * visibility (hasRentPrice / hasSalePrice). Items without either price
 * (service / equipment) get no share button — there is no bike deep-link
 * for them.
 */
export function resolveItemShareFlows(input: {
  rentAvailable: boolean;
  saleAvailable: boolean;
}): ItemShareFlow[] {
  const flows: ItemShareFlow[] = [];
  if (input.rentAvailable) flows.push("rent");
  if (input.saleAvailable) flows.push("sale");
  return flows;
}

/**
 * Compose the share message text for a single flow. Kept short — Telegram
 * pre-fills it into the chat draft, and the link itself is appended by the
 * share dialog from the url param.
 *
 * Examples:
 *   «Ducati 1199 Panigale» — аренда в VIP Bike
 *   от 12 000 ₽ / день
 *
 *   «Falcon GT» — покупка в VIP Bike
 *   390 000 ₽
 */
export function buildItemShareText(input: {
  title: string;
  flow: ItemShareFlow;
  crewName?: string | null;
  rentPriceLabel?: string | null;
  salePrice?: number | null;
}): string {
  const title = String(input.title || "").trim();
  const crew = String(input.crewName || "").trim();
  const flowWord = input.flow === "rent" ? "аренда" : "покупка";
  const header = `«${title}» — ${flowWord}${crew ? ` в ${crew}` : ""}`;

  const lines: string[] = [header];

  if (input.flow === "rent") {
    const price = String(input.rentPriceLabel || "").trim();
    if (price) lines.push(price);
  } else {
    const salePrice = Number(input.salePrice);
    if (Number.isFinite(salePrice) && salePrice > 0) {
      lines.push(`${salePrice.toLocaleString("ru-RU")} ₽`);
    }
  }

  return lines.join("\n");
}

/**
 * Build the t.me/share/url href — the universal Telegram share page that
 * opens the chat picker (works in Telegram WebApp via openTelegramLink and
 * in a regular browser via window.open).
 */
export function buildTelegramShareHref(url: string, text: string): string {
  return `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
}
