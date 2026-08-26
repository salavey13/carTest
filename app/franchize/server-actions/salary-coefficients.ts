// app/franchize/server-actions/salary-coefficients.ts
"use server";

import { logger } from "@/lib/logger";
import {
  verifyCrewAccess,
  handleError,
  successResponse,
  errorResponse,
  type ActionResponse,
} from "./shared/auth-helpers";
import {
  getSalaryConfig,
  getCrewBikeSalaryRows,
  saveSalaryConfigToMetadata,
  saveBikeSalarySpecs,
  OFFICIAL_SALARY_CONFIG,
  deriveCategoriesFromPrice,
  type SalaryConfig,
  type RentalCategory,
  type SaleCategory,
  type EquipmentSaleCategory,
  type BikeSalaryCategories,
  type PriceTier,
} from "@/lib/salary-coefficients";

/**
 * Salary coefficients server actions (official bonus scheme).
 * PRD: docs/PRD_SALARY_COEFFICIENTS.md
 *
 * REWORK (iter6): storage moved off new tables →
 *   • rates       → crews.metadata.franchize.salaryCoefficients (jsonb)
 *   • bike class  → cars.specs.salary (jsonb), derived from price by default
 *
 * getSalaryCoefficientsConfig — crew members can read (transparency);
 * saveSalaryCoefficientsConfig — owner / co_owner / admin only.
 */

export interface SalaryBikeRow {
  bikeId: string;
  name: string;
  dailyPrice: number;
  rentalCategory: RentalCategory;
  saleCategory: SaleCategory;
  /** "specs" = explicit cars.specs.salary override; "price" = derived from price */
  source: "specs" | "price" | "fallback";
  /** subrented (partner) bike — Ducati Aero / R7 / Suzuki 1000 */
  subrented: boolean;
  /** price tier before the partner prefix */
  tier: PriceTier;
  /** what the current price WOULD derive (mismatch ⇒ price changed since set) */
  priceDerived: { rental: RentalCategory; sale: SaleCategory };
}

export interface SalaryCoefficientsConfigVM {
  config: SalaryConfig;
  bikes: SalaryBikeRow[];
  isOwner: boolean;
}

const RENTAL_CATEGORIES: RentalCategory[] = [
  "budget",
  "regular",
  "partner_regular",
  "premium",
  "partner_premium",
];
const SALE_CATEGORIES: SaleCategory[] = ["enduro_moped", "regular", "premium"];
const EQUIPMENT_SALE_CATEGORIES: EquipmentSaleCategory[] = [
  "helmet",
  "balaclava",
  "jacket",
  "pants",
  "gloves",
];
const PRICE_TIERS: PriceTier[] = ["budget", "regular", "premium"];

export async function getSalaryCoefficientsConfig(params: {
  slug: string;
}): Promise<ActionResponse<SalaryCoefficientsConfigVM>> {
  const { slug } = params;

  try {
    const access = await verifyCrewAccess(slug);
    if (!access.allowed) {
      return { success: false, error: access.error };
    }

    const crewId = access.crewId!;

    const [config, bikeRows] = await Promise.all([
      getSalaryConfig(crewId),
      getCrewBikeSalaryRows(crewId),
    ]);

    const bikes: SalaryBikeRow[] = bikeRows.map((row) => {
      const subrented = Boolean(row.categories.subrented);
      const derived = deriveCategoriesFromPrice(row.dailyPrice, subrented);
      return {
        bikeId: row.bikeId,
        name: row.name,
        dailyPrice: row.dailyPrice,
        rentalCategory: row.categories.rental,
        saleCategory: row.categories.sale,
        source: row.categories.source || "price",
        subrented,
        tier: row.categories.tier || derived.tier,
        priceDerived: { rental: derived.rental, sale: derived.sale },
      };
    });

    return successResponse({
      config,
      bikes,
      isOwner: access.isOwner === true,
    });
  } catch (err) {
    logger.error("[salary-coefficients] getSalaryCoefficientsConfig exception:", err);
    return errorResponse(handleError(err, "getSalaryCoefficientsConfig"));
  }
}

export async function saveSalaryCoefficientsConfig(params: {
  slug: string;
  config: SalaryConfig;
  bikeCategories: Array<{
    bikeId: string;
    rentalCategory: RentalCategory;
    saleCategory: SaleCategory;
    subrented?: boolean;
    tier?: PriceTier;
    dailyPrice?: number;
  }>;
}): Promise<ActionResponse<{ savedAt: string; bikesUpdated: number }>> {
  const { slug, config, bikeCategories } = params;

  try {
    const access = await verifyCrewAccess(slug);
    if (!access.allowed) {
      return { success: false, error: access.error };
    }
    if (!access.isOwner) {
      return {
        success: false,
        error: "Только владелец, со-владелец или администратор может изменять коэффициенты ЗП.",
      };
    }

    const crewId = access.crewId!;

    // ── Validate config values ──
    const problems: string[] = [];
    for (const cat of RENTAL_CATEGORIES) {
      const v = Number(config.rental?.[cat]);
      if (!Number.isFinite(v) || v < 0) problems.push(`Аренда: ${cat}`);
    }
    for (const cat of SALE_CATEGORIES) {
      const v = Number(config.sale?.[cat]);
      if (!Number.isFinite(v) || v < 0) problems.push(`Продажа: ${cat}`);
    }
    for (const cat of EQUIPMENT_SALE_CATEGORIES) {
      const v = Number(config.equipmentSale?.[cat]);
      if (!Number.isFinite(v) || v < 0) problems.push(`Экип: ${cat}`);
    }
    if (!Number.isFinite(Number(config.equipmentRentalUnit)) || Number(config.equipmentRentalUnit) < 0) {
      problems.push("Экип (аренда)");
    }
    const op = Number(config.overpricePercent);
    if (!Number.isFinite(op) || op < 0 || op > 100) {
      problems.push("Оверпрайс %");
    }
    if (problems.length > 0) {
      return { success: false, error: `Некорректные значения: ${problems.join(", ")}` };
    }

    // ── Validate bike categories ──
    const seenBikes = new Set<string>();
    const validBikeEntries = (bikeCategories || []).filter((b) => {
      if (!b?.bikeId || seenBikes.has(b.bikeId)) return false;
      if (!RENTAL_CATEGORIES.includes(b.rentalCategory)) return false;
      if (!SALE_CATEGORIES.includes(b.saleCategory)) return false;
      if (b.tier && !PRICE_TIERS.includes(b.tier)) return false;
      seenBikes.add(b.bikeId);
      return true;
    });

    // ── Save rates → crews.metadata.franchize.salaryCoefficients ──
    const configResult = await saveSalaryConfigToMetadata(crewId, {
      rental: config.rental,
      equipmentRentalUnit: Math.round(Number(config.equipmentRentalUnit)),
      sale: config.sale,
      equipmentSale: config.equipmentSale,
      overpricePercent: Math.round(op),
    });
    if (!configResult.ok) {
      logger.error("[salary-coefficients] saveSalaryConfigToMetadata failed:", configResult.error);
      return { success: false, error: "Не удалось сохранить коэффициенты: " + configResult.error };
    }

    // ── Save bike categories → cars.specs.salary ──
    let bikesUpdated = 0;
    if (validBikeEntries.length > 0) {
      const bikesResult = await saveBikeSalarySpecs(crewId, validBikeEntries);
      if (!bikesResult.ok) {
        logger.error("[salary-coefficients] saveBikeSalarySpecs failed:", bikesResult.error);
        return {
          success: false,
          error: `Коэффициенты сохранены, но категории техники — нет: ${bikesResult.error}`,
        };
      }
      bikesUpdated = bikesResult.updated;
    }

    logger.info("[salary-coefficients] saved config", {
      crewId,
      bikesUpdated,
    });

    return successResponse({ savedAt: new Date().toISOString(), bikesUpdated });
  } catch (err) {
    logger.error("[salary-coefficients] saveSalaryCoefficientsConfig exception:", err);
    return errorResponse(handleError(err, "saveSalaryCoefficientsConfig"));
  }
}

/** Reset crew coefficients to the official defaults (owner-only). */
export async function resetSalaryCoefficientsToOfficial(params: {
  slug: string;
}): Promise<ActionResponse<{ config: SalaryConfig }>> {
  const { slug } = params;

  try {
    const access = await verifyCrewAccess(slug);
    if (!access.allowed) {
      return { success: false, error: access.error };
    }
    if (!access.isOwner) {
      return { success: false, error: "Только владелец или администратор может сбрасывать коэффициенты." };
    }

    const crewId = access.crewId!;
    const result = await saveSalaryConfigToMetadata(crewId, OFFICIAL_SALARY_CONFIG);
    if (!result.ok) {
      logger.error("[salary-coefficients] reset failed:", result.error);
      return { success: false, error: "Не удалось сбросить коэффициенты: " + result.error };
    }

    return successResponse({ config: OFFICIAL_SALARY_CONFIG });
  } catch (err) {
    logger.error("[salary-coefficients] resetSalaryCoefficientsToOfficial exception:", err);
    return errorResponse(handleError(err, "resetSalaryCoefficientsToOfficial"));
  }
}

/** Type re-exports for the client VM. */
export type { SalaryConfig, BikeSalaryCategories, RentalCategory, SaleCategory };
