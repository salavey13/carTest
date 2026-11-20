// Crew-owned parts catalogue from Supabase (2026-11-20, boss).
// The hardcoded Surge CSV in lib/parts-data.ts is vip-bike-only. Any other
// crew that "properly added" its own parts to the platform (public.cars rows
// with type="parts" and the crew's crew_id) gets THOSE on /parts instead —
// grouped by specs.category (fallback: specs.type → one «Запчасти» group).
// Server-only module: reads through supabaseAdmin like the rest of the
// hydration chain, never exposes internal spec keys (sanitizePublicRawSpecs).

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sanitizePublicRawSpecs } from "./public-specs";
import type { PartsCategory, SparePart } from "./parts-data";

interface CrewPartsRow {
  id: string | number;
  make?: string | null;
  model?: string | null;
  description?: string | null;
  image_url?: string | null;
  daily_price?: number | null;
  specs?: Record<string, unknown> | null;
}

/** Stable category id from a raw label (slug-ish, ru-safe). */
const categoryIdFor = (raw: string): string =>
  raw.toLowerCase().replace(/[^a-z0-9а-яё]+/gi, "-").replace(/^-+|-+$/g, "") || "parts";

/** "1 500.50 ₽" → 1500.5; tolerates numbers, strings, junk. */
const priceToNumber = (value: unknown): number => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = parseFloat(String(value ?? "").replace(/\s/g, "").replace(",", ".").replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
};

/**
 * Load the crew's own parts from Supabase and shape them into the same
 * PartsCategory model the hardcoded CSV loader returns, so PartsCatalogClient
 * renders either source without knowing the difference.
 */
export async function loadCrewPartsData(crewId: string): Promise<PartsCategory[]> {
  if (!crewId) return [];

  // NOTE: cars has no created_at column — keep the natural id order.
  const { data, error } = await supabaseAdmin
    .from("cars")
    .select("id, make, model, description, image_url, daily_price, specs")
    .eq("crew_id", crewId)
    .eq("type", "parts");

  if (error) {
    console.error(`[franchize] failed to load crew parts for ${crewId}:`, error.message);
    return [];
  }

  const byCategory = new Map<string, PartsCategory>();

  for (const raw of (data ?? []) as CrewPartsRow[]) {
    const specs = sanitizePublicRawSpecs((raw.specs ?? {}) as Record<string, unknown>);
    // Hidden rows stay hidden — same contract as the main catalog hydration.
    const hidden = specs.hidden;
    if (hidden === true || hidden === 1 || ["1", "true"].includes(String(hidden).toLowerCase())) continue;

    const name = String(raw.model ?? "").trim() || String(raw.make ?? "").trim() || String(raw.id);
    const categoryName =
      (typeof specs.category === "string" && specs.category.trim()) ||
      (typeof specs.type === "string" && specs.type.trim() && specs.type.trim().toLowerCase() !== "bike" && specs.type.trim()) ||
      "Запчасти";

    const category = byCategory.get(categoryName) ?? {
      id: categoryIdFor(categoryName),
      name: categoryName,
      parts: [] as SparePart[],
    };

    category.parts.push({
      itemNumber: category.parts.length + 1,
      // The parts VM reuses partNumber as the row id — keep it stable per car row.
      partNumber: String(raw.id),
      name,
      description: String(raw.description ?? "").trim(),
      basePrice: priceToNumber(raw.daily_price),
      finalPrice: priceToNumber(specs.sale_price ?? raw.daily_price),
      imagePath: raw.image_url ? String(raw.image_url) : undefined,
      sourceCategory: categoryName,
    });

    byCategory.set(categoryName, category);
  }

  return [...byCategory.values()].filter((category) => category.parts.length > 0);
}
