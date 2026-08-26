// lib/salary-coefficients.ts
//
// SERVER part of the salary coefficients engine: resolves the crew's
// configuration from the DB (public.salary_coefficients +
// public.bike_salary_categories), falling back to the official defaults when
// the tables are empty or the migration is not applied yet.
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
  DEFAULT_BIKE_CATEGORY_FALLBACK,
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

type CoefficientRow = {
  kind: string;
  category: string;
  amount: number | string;
  is_active: boolean;
};

function applyCoefficient(config: SalaryConfig, kind: string, category: string, amount: number): void {
  switch (kind) {
    case "rental":
      if (category === "equipment") {
        config.equipmentRentalUnit = amount;
      } else if (category in config.rental) {
        config.rental[category as RentalCategory] = amount;
      }
      break;
    case "sale":
      if (category in config.sale) {
        config.sale[category as SaleCategory] = amount;
      }
      break;
    case "equipment_sale":
      if (category in config.equipmentSale) {
        config.equipmentSale[category as EquipmentSaleCategory] = amount;
      }
      break;
    case "overprice":
      if (category === "percentage") {
        config.overpricePercent = amount;
      }
      break;
  }
}

/**
 * Load the crew's salary configuration. Table rows override official defaults;
 * if the table is missing (migration not applied) or the query fails, the
 * official defaults are returned so the feature keeps working.
 */
export async function getSalaryConfig(crewId: string): Promise<SalaryConfig> {
  const config: SalaryConfig = structuredClone(OFFICIAL_SALARY_CONFIG);

  try {
    const { data, error } = await supabaseAdmin
      .from("salary_coefficients")
      .select("kind, category, amount, is_active")
      .eq("crew_id", crewId)
      .eq("is_active", true);

    if (error) {
      // Table missing (migration not applied) or transient failure → defaults.
      logger.debug("[salary-coefficients] table unavailable, using defaults:", error.message);
      return config;
    }

    for (const row of (data || []) as CoefficientRow[]) {
      const amount = Number(row.amount);
      if (!Number.isFinite(amount) || amount < 0) continue;
      applyCoefficient(config, row.kind, row.category, amount);
    }
  } catch (e) {
    logger.warn("[salary-coefficients] getSalaryConfig exception, using defaults:", e);
  }

  return config;
}

/**
 * Load the crew's bike → category mapping. Returns a Map<bikeId, categories>.
 * Bikes absent from the map resolve via the default mapping / fallback.
 */
export async function getBikeCategoryOverrides(
  crewId: string,
): Promise<Map<string, BikeSalaryCategories>> {
  const map = new Map<string, BikeSalaryCategories>();
  try {
    const { data, error } = await supabaseAdmin
      .from("bike_salary_categories")
      .select("bike_id, rental_category, sale_category")
      .eq("crew_id", crewId);

    if (error) {
      logger.debug("[salary-coefficients] bike mapping unavailable, using defaults:", error.message);
      return map;
    }

    for (const row of (data || []) as any[]) {
      if (!row?.bike_id) continue;
      map.set(row.bike_id, {
        rental: (row.rental_category as RentalCategory) || DEFAULT_BIKE_CATEGORY_FALLBACK.rental,
        sale: (row.sale_category as SaleCategory) || DEFAULT_BIKE_CATEGORY_FALLBACK.sale,
      });
    }
  } catch (e) {
    logger.warn("[salary-coefficients] getBikeCategoryOverrides exception:", e);
  }
  return map;
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
 * Detect whether the crew has category coefficients configured (i.e. the
 * migration is applied and the seed ran). Gates the switch from the legacy
 * percentage model to the official category-bonus model in salary calculations.
 */
export async function hasSalaryCoefficients(crewId: string): Promise<boolean> {
  try {
    const { count, error } = await supabaseAdmin
      .from("salary_coefficients")
      .select("crew_id", { count: "exact", head: true })
      .eq("crew_id", crewId);
    if (error) return false; // table missing → legacy model
    return (count || 0) > 0;
  } catch {
    return false;
  }
}
