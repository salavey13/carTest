// app/franchize/server-actions/salary-coefficients.ts
"use server";

import { supabaseAdmin } from "@/lib/supabase-server";
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
  getBikeCategoryOverrides,
  resolveBikeCategories,
  OFFICIAL_SALARY_CONFIG,
  type SalaryConfig,
  type RentalCategory,
  type SaleCategory,
  type EquipmentSaleCategory,
  type BikeSalaryCategories,
} from "@/lib/salary-coefficients";

/**
 * Salary coefficients server actions (official bonus scheme).
 * PRD: docs/PRD_SALARY_COEFFICIENTS.md
 *
 * getSalaryCoefficientsConfig — crew members can read (transparency);
 * saveSalaryCoefficientsConfig — owner / co_owner / admin only.
 */

export interface SalaryBikeRow {
  bikeId: string;
  name: string;
  rentalCategory: RentalCategory;
  saleCategory: SaleCategory;
  /** true when the categories come from the crew's own override (not defaults) */
  isOverridden: boolean;
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

    const [config, overrides, bikesResult] = await Promise.all([
      getSalaryConfig(crewId),
      getBikeCategoryOverrides(crewId),
      supabaseAdmin
        .from("cars")
        .select("id, make, model")
        .eq("crew_id", crewId)
        .order("make", { ascending: true }),
    ]);

    if (bikesResult.error) {
      logger.warn("[salary-coefficients] bikes query failed:", bikesResult.error);
    }

    const bikes: SalaryBikeRow[] = ((bikesResult.data || []) as any[]).map((b) => {
      const resolved = resolveBikeCategories(b.id, overrides);
      return {
        bikeId: b.id,
        name: `${b.make || ""} ${b.model || ""}`.trim() || b.id,
        rentalCategory: resolved.rental,
        saleCategory: resolved.sale,
        isOverridden: overrides.has(b.id),
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
  bikeCategories: Array<{ bikeId: string; rentalCategory: RentalCategory; saleCategory: SaleCategory }>;
}): Promise<ActionResponse<{ savedAt: string }>> {
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

    // ── Upsert salary_coefficients ──
    const rows: Array<{ crew_id: string; kind: string; category: string; amount: number; is_active: boolean }> = [];
    for (const cat of RENTAL_CATEGORIES) {
      rows.push({ crew_id: crewId, kind: "rental", category: cat, amount: Math.round(Number(config.rental[cat])), is_active: true });
    }
    rows.push({ crew_id: crewId, kind: "rental", category: "equipment", amount: Math.round(Number(config.equipmentRentalUnit)), is_active: true });
    for (const cat of SALE_CATEGORIES) {
      rows.push({ crew_id: crewId, kind: "sale", category: cat, amount: Math.round(Number(config.sale[cat])), is_active: true });
    }
    for (const cat of EQUIPMENT_SALE_CATEGORIES) {
      rows.push({ crew_id: crewId, kind: "equipment_sale", category: cat, amount: Math.round(Number(config.equipmentSale[cat])), is_active: true });
    }
    rows.push({ crew_id: crewId, kind: "overprice", category: "percentage", amount: Math.round(op), is_active: true });

    const { error: coefError } = await supabaseAdmin
      .from("salary_coefficients")
      .upsert(rows, { onConflict: "crew_id,kind,category" });

    if (coefError) {
      logger.error("[salary-coefficients] upsert salary_coefficients failed:", coefError);
      return {
        success: false,
        error: "Не удалось сохранить коэффициенты. Возможно, миграция ещё не применена — попробуйте позже.",
      };
    }

    // ── Upsert bike categories ──
    const seenBikes = new Set<string>();
    const bikeRows = bikeCategories
      .filter((b) => {
        if (!b?.bikeId || seenBikes.has(b.bikeId)) return false;
        if (!RENTAL_CATEGORIES.includes(b.rentalCategory)) return false;
        if (!SALE_CATEGORIES.includes(b.saleCategory)) return false;
        seenBikes.add(b.bikeId);
        return true;
      })
      .map((b) => ({
        crew_id: crewId,
        bike_id: b.bikeId,
        rental_category: b.rentalCategory,
        sale_category: b.saleCategory,
      }));

    if (bikeRows.length > 0) {
      const { error: bikeError } = await supabaseAdmin
        .from("bike_salary_categories")
        .upsert(bikeRows, { onConflict: "crew_id,bike_id" });

      if (bikeError) {
        logger.error("[salary-coefficients] upsert bike_salary_categories failed:", bikeError);
        return { success: false, error: "Коэффициенты сохранены, но категории техники — нет: " + bikeError.message };
      }
    }

    logger.info("[salary-coefficients] saved config", {
      crewId,
      coefficientRows: rows.length,
      bikeRows: bikeRows.length,
    });

    return successResponse({ savedAt: new Date().toISOString() });
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
    const rows: Array<{ crew_id: string; kind: string; category: string; amount: number; is_active: boolean }> = [];
    for (const cat of RENTAL_CATEGORIES) {
      rows.push({ crew_id: crewId, kind: "rental", category: cat, amount: OFFICIAL_SALARY_CONFIG.rental[cat], is_active: true });
    }
    rows.push({ crew_id: crewId, kind: "rental", category: "equipment", amount: OFFICIAL_SALARY_CONFIG.equipmentRentalUnit, is_active: true });
    for (const cat of SALE_CATEGORIES) {
      rows.push({ crew_id: crewId, kind: "sale", category: cat, amount: OFFICIAL_SALARY_CONFIG.sale[cat], is_active: true });
    }
    for (const cat of EQUIPMENT_SALE_CATEGORIES) {
      rows.push({ crew_id: crewId, kind: "equipment_sale", category: cat, amount: OFFICIAL_SALARY_CONFIG.equipmentSale[cat], is_active: true });
    }
    rows.push({ crew_id: crewId, kind: "overprice", category: "percentage", amount: OFFICIAL_SALARY_CONFIG.overpricePercent, is_active: true });

    const { error } = await supabaseAdmin
      .from("salary_coefficients")
      .upsert(rows, { onConflict: "crew_id,kind,category" });

    if (error) {
      logger.error("[salary-coefficients] reset failed:", error);
      return { success: false, error: "Не удалось сбросить коэффициенты: " + error.message };
    }

    return successResponse({ config: OFFICIAL_SALARY_CONFIG });
  } catch (err) {
    logger.error("[salary-coefficients] resetSalaryCoefficientsToOfficial exception:", err);
    return errorResponse(handleError(err, "resetSalaryCoefficientsToOfficial"));
  }
}

/** Type re-exports for the client VM. */
export type { SalaryConfig, BikeSalaryCategories, RentalCategory, SaleCategory };
