// lib/salary-coefficients.ts
//
// SERVER part of the salary coefficients engine.
//
// REWORK (iter6, owner feedback): NO new tables. Storage is:
//   • Crew-level ₽ rates   → crews.metadata.franchize.salaryCoefficients (jsonb)
//   • Per-bike categories  → cars.specs.salary (jsonb), derived from PRICE
//     (premium ≥ 14 000 ₽/сутки, regular ≥ 7 000, budget below) + subrented
//     flag (Ducati Aero, Yamaha R7, Suzuki GSX-S1000F).
//   The iter5 migration (salary_coefficients + bike_salary_categories tables)
//   was REMOVED — it was never applied to production.
//
// Pure types / constants / calculators live in lib/salary-coefficients-shared.ts
// (client-safe). This module re-exports them for server-side consumers.
//
// PRD: docs/PRD_SALARY_COEFFICIENTS.md

import { supabaseAdmin } from "@/lib/supabase-server";
import { logger } from "@/lib/logger";
import { calculatePrice, type BikePricingSpecs } from "@/lib/rental-pricing-calculator";
import {
  OFFICIAL_SALARY_CONFIG,
  DEFAULT_PRICE_TIERS,
  resolveCategoriesForBike,
  type SalaryConfig,
  type RentalCategory,
  type SaleCategory,
  type EquipmentSaleCategory,
  type BikeSalaryCategories,
  type RentalEquipment,
} from "./salary-coefficients-shared";

// Re-export the client-safe surface so server consumers can import everything
// from a single module.
export * from "./salary-coefficients-shared";

// ─────────────────────────────────────────────────────────────────────────────
// Config (crews.metadata.franchize.salaryCoefficients)
// ─────────────────────────────────────────────────────────────────────────────

/** Where the crew's salary config lives inside the crews.metadata jsonb. */
const SALARY_CONFIG_METADATA_PATH = ["franchize", "salaryCoefficients"] as const;

function readSalaryConfigFromMetadata(metadata: unknown): SalaryConfig | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  let node: unknown = metadata;
  for (const key of SALARY_CONFIG_METADATA_PATH) {
    if (!node || typeof node !== "object" || Array.isArray(node)) return null;
    node = (node as Record<string, unknown>)[key];
  }
  if (!node || typeof node !== "object" || Array.isArray(node)) return null;
  const raw = node as Record<string, unknown>;

  const config: SalaryConfig = structuredClone(OFFICIAL_SALARY_CONFIG);
  let touched = false;

  if (raw.rental && typeof raw.rental === "object") {
    for (const cat of Object.keys(config.rental) as RentalCategory[]) {
      const v = Number((raw.rental as Record<string, unknown>)[cat]);
      if (Number.isFinite(v) && v >= 0) {
        config.rental[cat] = Math.round(v);
        touched = true;
      }
    }
  }
  const equipUnit = Number(raw.equipmentRentalUnit);
  if (Number.isFinite(equipUnit) && equipUnit >= 0) {
    config.equipmentRentalUnit = Math.round(equipUnit);
    touched = true;
  }
  if (raw.sale && typeof raw.sale === "object") {
    for (const cat of Object.keys(config.sale) as SaleCategory[]) {
      const v = Number((raw.sale as Record<string, unknown>)[cat]);
      if (Number.isFinite(v) && v >= 0) {
        config.sale[cat] = Math.round(v);
        touched = true;
      }
    }
  }
  if (raw.equipmentSale && typeof raw.equipmentSale === "object") {
    for (const cat of Object.keys(config.equipmentSale) as EquipmentSaleCategory[]) {
      const v = Number((raw.equipmentSale as Record<string, unknown>)[cat]);
      if (Number.isFinite(v) && v >= 0) {
        config.equipmentSale[cat] = Math.round(v);
        touched = true;
      }
    }
  }
  const op = Number(raw.overpricePercent);
  if (Number.isFinite(op) && op >= 0 && op <= 100) {
    config.overpricePercent = Math.round(op);
    touched = true;
  }
  return touched ? config : null;
}

/** Read the crew's price-tier thresholds from metadata (falls back to defaults). */
function readPriceTiersFromMetadata(metadata: unknown): {
  premiumThreshold: number;
  regularThreshold: number;
} {
  const fallback = { ...DEFAULT_PRICE_TIERS };
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return fallback;
  const franchize = (metadata as Record<string, unknown>).franchize;
  if (!franchize || typeof franchize !== "object") return fallback;
  const raw = (franchize as Record<string, unknown>).salaryCoefficients;
  if (!raw || typeof raw !== "object") return fallback;
  const thresholds = (raw as Record<string, unknown>).priceThresholds;
  if (!thresholds || typeof thresholds !== "object") return fallback;
  const t = thresholds as Record<string, unknown>;
  const premium = Number(t.premiumThreshold);
  const regular = Number(t.regularThreshold);
  if (Number.isFinite(premium) && premium > 0 && Number.isFinite(regular) && regular > 0 && regular < premium) {
    return { premiumThreshold: premium, regularThreshold: regular };
  }
  return fallback;
}

/**
 * Load the crew's salary configuration. Metadata overrides official defaults;
 * when nothing is stored (or the read fails) the official defaults are
 * returned so the feature keeps working everywhere.
 */
export async function getSalaryConfig(crewId: string): Promise<SalaryConfig> {
  const config: SalaryConfig = structuredClone(OFFICIAL_SALARY_CONFIG);
  try {
    const { data, error } = await supabaseAdmin
      .from("crews")
      .select("metadata")
      .eq("id", crewId)
      .maybeSingle();

    if (error || !data) {
      logger.debug("[salary-coefficients] crew metadata unavailable, using defaults:", error?.message);
      return config;
    }

    const fromMetadata = readSalaryConfigFromMetadata(data.metadata);
    return fromMetadata || config;
  } catch (e) {
    logger.warn("[salary-coefficients] getSalaryConfig exception, using defaults:", e);
    return config;
  }
}

/** Merge a validated config into crews.metadata.franchize.salaryCoefficients (read-merge-write). */
export async function saveSalaryConfigToMetadata(
  crewId: string,
  config: SalaryConfig,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { data, error } = await supabaseAdmin
      .from("crews")
      .select("metadata")
      .eq("id", crewId)
      .maybeSingle();
    if (error || !data) {
      return { ok: false, error: error?.message || "crew not found" };
    }

    const metadata =
      data.metadata && typeof data.metadata === "object" && !Array.isArray(data.metadata)
        ? (data.metadata as Record<string, unknown>)
        : {};
    const franchize =
      metadata.franchize && typeof metadata.franchize === "object"
        ? { ...(metadata.franchize as Record<string, unknown>) }
        : {};

    // Preserve existing priceThresholds when saving rates.
    const existing = (franchize.salaryCoefficients || {}) as Record<string, unknown>;
    franchize.salaryCoefficients = {
      ...existing,
      rental: { ...config.rental },
      equipmentRentalUnit: config.equipmentRentalUnit,
      sale: { ...config.sale },
      equipmentSale: { ...config.equipmentSale },
      overpricePercent: config.overpricePercent,
      updatedAt: new Date().toISOString(),
    };
    metadata.franchize = franchize;

    const { error: updateError } = await supabaseAdmin
      .from("crews")
      .update({ metadata, updated_at: new Date().toISOString() })
      .eq("id", crewId);
    if (updateError) {
      return { ok: false, error: updateError.message };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Bike categories (cars.specs.salary, price-derived)
// ─────────────────────────────────────────────────────────────────────────────

export interface CrewBikeSalaryRow {
  bikeId: string;
  name: string;
  dailyPrice: number;
  categories: BikeSalaryCategories;
}

/**
 * Load salary categories for every rentable bike of the crew.
 *
 * Resolution per bike (resolveCategoriesForBike):
 *   1. cars.specs.salary.rentalCategory / saleCategory — explicit override
 *   2. else derive from daily_price + subrented flag (specs.salary.subrented,
 *      defaulting to the known subrented trio)
 *
 * The returned Map is COMPLETE for the crew's bikes, so consumers
 * (CSV builders, salary calculations) need no extra fallback logic beyond
 * the regular/regular default for unknown ids.
 */
export async function getBikeCategoryOverrides(
  crewId: string,
): Promise<Map<string, BikeSalaryCategories>> {
  const map = new Map<string, BikeSalaryCategories>();
  try {
    const { data, error } = await supabaseAdmin
      .from("crews")
      .select("metadata")
      .eq("id", crewId)
      .maybeSingle();
    const tiers = error || !data ? { ...DEFAULT_PRICE_TIERS } : readPriceTiersFromMetadata(data.metadata);

    const { data: bikes, error: bikesError } = await supabaseAdmin
      .from("cars")
      .select("id, make, model, daily_price, specs")
      .eq("crew_id", crewId)
      .order("daily_price", { ascending: false });

    if (bikesError) {
      logger.debug("[salary-coefficients] bikes query unavailable:", bikesError.message);
      return map;
    }

    for (const bike of (bikes || []) as any[]) {
      if (!bike?.id) continue;
      map.set(
        bike.id,
        resolveCategoriesForBike({
          bikeId: bike.id,
          specs: bike.specs,
          dailyPrice: bike.daily_price,
          tiers,
        }),
      );
    }
  } catch (e) {
    logger.warn("[salary-coefficients] getBikeCategoryOverrides exception:", e);
  }
  return map;
}

/**
 * Detailed bike rows for the admin UI (price + classification + source).
 * Only includes bikes that look rentable (specs.rent present or daily_price > 0
 * and the id doesn't start with an equipment/service prefix).
 */
export async function getCrewBikeSalaryRows(crewId: string): Promise<CrewBikeSalaryRow[]> {
  const rows: CrewBikeSalaryRow[] = [];
  try {
    const { data: crewData } = await supabaseAdmin
      .from("crews")
      .select("metadata")
      .eq("id", crewId)
      .maybeSingle();
    const tiers = crewData ? readPriceTiersFromMetadata(crewData.metadata) : { ...DEFAULT_PRICE_TIERS };

    const { data: bikes, error } = await supabaseAdmin
      .from("cars")
      .select("id, make, model, daily_price, specs")
      .eq("crew_id", crewId)
      .order("daily_price", { ascending: false });

    if (error) {
      logger.warn("[salary-coefficients] getCrewBikeSalaryRows query failed:", error.message);
      return rows;
    }

    for (const bike of (bikes || []) as any[]) {
      if (!bike?.id) continue;
      const specs = bike.specs && typeof bike.specs === "object" ? (bike.specs as Record<string, unknown>) : null;
      // Rentable bikes carry a specs.rent block; everything else (equipment,
      // services, merch) is out of scope for salary classification.
      if (!specs || specs.rent === undefined) continue;

      rows.push({
        bikeId: bike.id,
        name: `${bike.make || ""} ${bike.model || ""}`.trim() || bike.id,
        dailyPrice: Number(bike.daily_price) || 0,
        categories: resolveCategoriesForBike({
          bikeId: bike.id,
          specs: bike.specs,
          dailyPrice: bike.daily_price,
          tiers,
        }),
      });
    }
  } catch (e) {
    logger.warn("[salary-coefficients] getCrewBikeSalaryRows exception:", e);
  }
  return rows;
}

/**
 * Persist per-bike classification into cars.specs.salary (read-merge-write
 * per bike — the specs jsonb is replaced wholesale by PostgREST, so we must
 * merge to keep the other spec keys intact).
 */
export async function saveBikeSalarySpecs(
  crewId: string,
  entries: Array<{ bikeId: string; rentalCategory: RentalCategory; saleCategory: SaleCategory; subrented?: boolean; tier?: "budget" | "regular" | "premium"; dailyPrice?: number }>,
): Promise<{ ok: true; updated: number } | { ok: false; error: string; updated: number }> {
  let updated = 0;
  try {
    for (const entry of entries) {
      if (!entry?.bikeId) continue;
      // Fetch fresh specs (avoid clobbering concurrent edits).
      const { data: bike, error: fetchError } = await supabaseAdmin
        .from("cars")
        .select("id, specs, daily_price, crew_id")
        .eq("id", entry.bikeId)
        .maybeSingle();
      if (fetchError || !bike) {
        logger.warn("[salary-coefficients] saveBikeSalarySpecs: bike not found:", entry.bikeId, fetchError?.message);
        continue;
      }
      // Only touch bikes that belong to this crew.
      if (bike.crew_id !== crewId) continue;

      const specs =
        bike.specs && typeof bike.specs === "object" && !Array.isArray(bike.specs)
          ? { ...(bike.specs as Record<string, unknown>) }
          : {};

      specs.salary = {
        ...(typeof specs.salary === "object" && specs.salary && !Array.isArray(specs.salary)
          ? (specs.salary as Record<string, unknown>)
          : {}),
        tier: entry.tier,
        subrented: Boolean(entry.subrented),
        rentalCategory: entry.rentalCategory,
        saleCategory: entry.saleCategory,
        dailyPriceAtSet: Number(entry.dailyPrice ?? bike.daily_price) || 0,
        setAt: new Date().toISOString(),
      };

      const { error: updateError } = await supabaseAdmin
        .from("cars")
        .update({ specs })
        .eq("id", entry.bikeId);
      if (updateError) {
        return { ok: false, error: `Bike ${entry.bikeId}: ${updateError.message}`, updated };
      }
      updated += 1;
    }
    return { ok: true, updated };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e), updated };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Standard-price helpers (shared by CSV builders and salary calculations).
// The overprice baseline must be identical everywhere: canonical catalog price
// from lib/rental-pricing-calculator.ts + standard equipment cost.
// ─────────────────────────────────────────────────────────────────────────────

/** Split an ISO timestamp into Moscow-local date + time strings (for calculatePrice). */
export function splitIsoToMoscow(iso: string): { date: string; time: string } | null {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return null;
    const fmt = new Intl.DateTimeFormat("ru-RU", {
      timeZone: "Europe/Moscow",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hour12: false,
    });
    const parts: Record<string, string> = {};
    for (const p of fmt.formatToParts(d)) parts[p.type] = p.value;
    return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
  } catch {
    return null;
  }
}

/** Standard equipment cost (matches the CSV «Экип» column: charger free). */
export function equipmentStandardCost(eq: RentalEquipment | null | undefined): number {
  if (!eq) return 0;
  let c = 0;
  if (Number(eq.helmets) > 0) c += Number(eq.helmets) * 1000;
  if (Number(eq.gloves) > 0) c += Number(eq.gloves) * 500;
  if (eq.jacket) c += 500;
  if (eq.pants) c += 500;
  if (eq.boots) c += 500;
  if (eq.net) c += 500;
  if (eq.backpack) c += 500;
  return c;
}

/**
 * Canonical catalog price for the rental period (без экипа) — the overprice
 * baseline. Falls back to `totalCost` (→ markup 0) when dates/specs are unusable.
 */
export function standardRentalPrice(params: {
  specs: BikePricingSpecs | null | undefined;
  startIso: string | null;
  endIso: string | null;
  dailyPrice: number | null | undefined;
  fallbackTotalCost: number;
}): number {
  const { specs, startIso, endIso, dailyPrice, fallbackTotalCost } = params;
  try {
    if (!startIso || !endIso) return fallbackTotalCost;
    const start = splitIsoToMoscow(startIso);
    const end = splitIsoToMoscow(endIso);
    if (!start || !end) return fallbackTotalCost;
    const pricing = calculatePrice(
      {
        ...(specs || {}),
        dailyPrice: dailyPrice ?? undefined,
      } as BikePricingSpecs,
      start.date,
      end.date,
      start.time,
      end.time,
      0,
    );
    if (!Number.isFinite(pricing.basePriceRub) || pricing.basePriceRub <= 0) return fallbackTotalCost;
    return pricing.basePriceRub;
  } catch (e) {
    logger.debug("[salary-coefficients] standardRentalPrice failed, markup = 0:", e);
    return fallbackTotalCost;
  }
}

/**
 * Detect whether the crew has salary coefficients configured (i.e. the
 * metadata.franchize.salaryCoefficients block exists). Gates the switch from
 * the legacy percentage model to the official category-bonus model in salary
 * calculations.
 */
export async function hasSalaryCoefficients(crewId: string): Promise<boolean> {
  try {
    const { data, error } = await supabaseAdmin
      .from("crews")
      .select("metadata")
      .eq("id", crewId)
      .maybeSingle();
    if (error || !data) return false;
    return readSalaryConfigFromMetadata(data.metadata) !== null;
  } catch {
    return false;
  }
}
