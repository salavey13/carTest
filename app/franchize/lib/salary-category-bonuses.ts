// app/franchize/lib/salary-category-bonuses.ts
//
// Task 79 (2026-10-07): category-bonus computation extracted from
// server-actions/salary-calculations.ts into a plain server lib.
//
// WHY: «use server» modules turn every export into a client-callable server
// action, so computeCategoryBonuses could not simply be exported from
// salary-calculations.ts (it enforces no auth and must not be reachable from
// the browser). Moving it here lets team-earnings.ts (getMemberEarnings /
// getTeamEarnings / getOwnerSalaryOverview) reuse the EXACT canonical math —
// so «Мои доходы», «Зарплаты команды», the /salary overview table and the
// «Детали расчёта» breakdown all show the same picture for category-model
// crews (vip-bike), including the rental/sale operator attribution
// (lib/operator-attribution.ts).
//
// Logic is MOVED verbatim (2026-10-07) — same queries, same attribution
// chain, same calculators. calculateSalaryForPeriod imports this instead of
// its local copy; behavior unchanged.

import { supabaseAdmin } from "@/lib/supabase-server";
import { logger } from "@/lib/logger";
import {
  getSalaryConfig,
  getBikeCategoryOverrides,
  resolveBikeCategories,
  countEquipmentUnits,
  computeRentalSalary,
  computeSaleSalary,
  equipmentStandardCost,
  standardRentalPrice,
  RENTAL_CATEGORY_LABELS,
  type RentalEquipment,
} from "@/lib/salary-coefficients";
import {
  resolveRentalOperator,
  resolveSaleOperator,
  ATTRIBUTION_SOURCE_LABELS,
  type ShiftLike,
  type AttributionSource,
} from "@/app/franchize/lib/operator-attribution";

/**
 * Category-bonus method (official scheme, docs/PRD_SALARY_COEFFICIENTS.md):
 * rental + sale bonuses computed directly from rentals / sale_contract_artifacts
 * credited to the member. Used by calculateSalaryForPeriod when the crew has
 * salary coefficients configured (crews.metadata.franchize.salaryCoefficients);
 * replaces the percentage commission for rental/sale income (prevents double counting).
 *
 * iter20 — OPERATOR ATTRIBUTION: rentals are credited to the member via the
 * chain in lib/operator-attribution.ts (/doc creator → pickup-freeze operator
 * → return confirmer → shift covering created_at). Web self-service orders
 * used to be attributed to NOBODY, so operators' rental counts showed 0.
 * Sales cross-reference shifts the same way when telegram_chat_id is absent
 * from the member roster.
 */
export async function computeCategoryBonuses(params: {
  crewId: string;
  memberId: string;
  periodStart: string;
  periodEnd: string;
}): Promise<{
  total: number;
  details: Array<{ type: string; amount: number; description: string }>;
}> {
  const { crewId, memberId, periodStart, periodEnd } = params;
  const details: Array<{ type: string; amount: number; description: string }> = [];

  const [config, bikeOverrides] = await Promise.all([
    getSalaryConfig(crewId),
    getBikeCategoryOverrides(crewId),
  ]);

  // ── Crew context for attribution: member roster + shifts ──
  // Shifts are fetched with a ±1 day margin around the period so a rental
  // created at 23:50 still matches an operator clocked in the previous day.
  const [{ data: crewMembers }, { data: shiftRows }] = await Promise.all([
    supabaseAdmin
      .from("crew_members")
      .select("user_id")
      .eq("crew_id", crewId),
    supabaseAdmin
      .from("crew_member_shifts")
      .select("member_id, clock_in_time, clock_out_time")
      .eq("crew_id", crewId)
      .gte("clock_in_time", new Date(Date.parse(periodStart) - 24 * 3600 * 1000).toISOString())
      .lte("clock_in_time", new Date(Date.parse(periodEnd) + 24 * 3600 * 1000).toISOString()),
  ]);
  const memberIds = new Set<string>((crewMembers || []).map((m: { user_id: string }) => m.user_id));
  const shifts: ShiftLike[] = (shiftRows || []).map((s: {
    member_id: string;
    clock_in_time: string;
    clock_out_time: string | null;
  }) => ({
    member_id: s.member_id,
    clock_in_time: s.clock_in_time,
    clock_out_time: s.clock_out_time ?? null,
  }));

  // ── Rental bonuses: ALL crew rentals in the period, then attribute ──
  const { data: rentals, error: rentalsError } = await supabaseAdmin
    .from("rentals")
    .select(`
      rental_id, total_cost, metadata, created_at,
      created_by_operator_chat_id,
      requested_start_date, requested_end_date, agreed_start_date, agreed_end_date,
      vehicle:cars!inner(id, make, model, crew_id, specs, daily_price)
    `)
    .eq("vehicle.crew_id", crewId)
    .neq("status", "cancelled")
    .gte("requested_start_date", periodStart)
    .lt("requested_start_date", periodEnd);

  if (rentalsError) {
    logger.warn("[computeCategoryBonuses] category rentals query failed:", rentalsError);
  }

  // Keep only rentals attributed to THIS member; remember WHY so the
  // breakdown can show the operator exactly how each rental was credited.
  const attributedRentals: Array<{ rental: any; source: AttributionSource }> = [];
  for (const r of (rentals || []) as any[]) {
    const attribution = resolveRentalOperator(r, shifts);
    if (attribution.operatorId === memberId) {
      attributedRentals.push({ rental: r, source: attribution.source });
    }
  }

  const byRentalCategory = new Map<string, { count: number; amount: number; sources: Map<AttributionSource, number> }>();
  let rentalTotal = 0;
  for (const { rental: r, source } of attributedRentals) {
    const meta = r.metadata || {};
    const vehicle = Array.isArray(r.vehicle) ? r.vehicle[0] : r.vehicle;
    const categories = resolveBikeCategories(vehicle?.id || "", bikeOverrides);
    const eq = (meta.equipment || {}) as RentalEquipment;
    const price = Number(r.total_cost) || 0;
    const stdPrice =
      standardRentalPrice({
        specs: vehicle?.specs,
        startIso: r.requested_start_date || r.agreed_start_date,
        endIso: r.requested_end_date || r.agreed_end_date,
        dailyPrice: vehicle?.daily_price,
        fallbackTotalCost: price,
      }) + equipmentStandardCost(eq);
    const salary = computeRentalSalary({
      config,
      rentalCategory: categories.rental,
      equipmentUnits: countEquipmentUnits(eq),
      totalCost: price,
      standardPrice: stdPrice,
    });
    rentalTotal += salary.total;
    const label = RENTAL_CATEGORY_LABELS[categories.rental];
    const bucket = byRentalCategory.get(label) || { count: 0, amount: 0, sources: new Map<AttributionSource, number>() };
    bucket.count += 1;
    bucket.amount += salary.total;
    bucket.sources.set(source, (bucket.sources.get(source) ?? 0) + 1);
  }

  if (rentalTotal > 0 || byRentalCategory.size > 0) {
    for (const [label, agg] of byRentalCategory) {
      // iter20: attribution transparency — how each rental was credited
      // ("4 /doc, 2 выдача, 1 смена") so the owner can audit the counts.
      const sourceParts = Array.from(agg.sources.entries())
        .map(([src, n]) => `${n} ${ATTRIBUTION_SOURCE_LABELS[src]}`)
        .join(", ");
      details.push({
        type: "rental_category_bonus",
        amount: agg.amount,
        description: `Аренда (${label}): ${agg.count} × бонусы${sourceParts ? ` · ${sourceParts}` : ""}`,
      });
    }
  }

  // ── Sale bonuses: sale contracts created in the member's chat ──
  const { data: crewBikes } = await supabaseAdmin
    .from("cars")
    .select("id")
    .eq("crew_id", crewId);
  const crewBikeIds = (crewBikes || []).map((b: any) => b.id);

  let saleTotal = 0;
  if (crewBikeIds.length > 0) {
    // iter20: fetch ALL crew sales in the period, then attribute — direct
    // telegram_chat_id (the member whose bot session created the sale) with
    // the shift cross-reference as fallback, mirroring rentals.
    const { data: sales, error: salesError } = await (supabaseAdmin as any)
      .schema("private")
      .from("sale_contract_artifacts")
      .select("id, sale_price, resolved_bike_id, created_at, telegram_chat_id")
      .in("resolved_bike_id", crewBikeIds)
      .gte("created_at", periodStart)
      .lt("created_at", periodEnd);

    if (salesError) {
      logger.warn("[computeCategoryBonuses] category sales query failed:", salesError);
    }

    const attributedSales = ((sales || []) as any[]).filter((s) => {
      const attribution = resolveSaleOperator(s, memberIds, shifts);
      return attribution.operatorId === memberId;
    });

    const bySaleCategory = new Map<string, { count: number; amount: number }>();
    for (const s of attributedSales) {
      const categories = resolveBikeCategories(s.resolved_bike_id || "", bikeOverrides);
      const salary = computeSaleSalary({
        config,
        saleCategory: categories.sale,
        salePrice: Number(s.sale_price) || 0,
      });
      saleTotal += salary.total;
      const label = categories.sale === "enduro_moped" ? "эндуро/мопеды" : categories.sale === "premium" ? "премиум" : "обычные";
      const bucket = bySaleCategory.get(label) || { count: 0, amount: 0 };
      bucket.count += 1;
      bucket.amount += salary.total;
      bySaleCategory.set(label, bucket);
    }

    for (const [label, agg] of bySaleCategory) {
      details.push({
        type: "sale_category_bonus",
        amount: agg.amount,
        description: `Продажа (${label}): ${agg.count} × бонусы`,
      });
    }
  }

  return { total: rentalTotal + saleTotal, details };
}
