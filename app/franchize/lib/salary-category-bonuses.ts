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
//
// Task 98 (2026-10-16, djorudjov report):
//   • BUGFIX: the rental bucket was never .set() back into the Map — rental
//     bonus lines vanished from every breakdown while the total included
//     them (boss: «за аренды не вижу такого красивого списочка»). Buckets
//     now go through the pure lib/salary-bucket.ts aggregator.
//   • Standalone gear docs (cars.type=equipment / metadata.item_type) and
//     service works (type=service) are EXCLUDED from the rental bonus pool —
//     the CSV СВОДКА pays them 0 («бонус за экип уже учтён в ЗП аренд»), so
//     counting them here made the profile disagree with the analytics export.
//   • New rentalItems / saleItems — the per-rental/per-sale TL;DR lists the
//     profile «Мои доходы» panel and the docx salary report render, with
//     equipment flags, the ₽ split (техника/экип/наценка) and the full
//     operator roles (created / handed out / returned) for multi-operator
//     authoring/assisting transparency.

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
  equipmentFlagsLabel,
  type RentalEquipment,
} from "@/lib/salary-coefficients";
import {
  accumulateSalaryBucket,
  salaryBucketsToDetails,
  type SalaryBucketMap,
} from "@/lib/salary-bucket";
import {
  resolveRentalOperator,
  resolveSaleOperator,
  ATTRIBUTION_SOURCE_LABELS,
  type ShiftLike,
  type AttributionSource,
} from "@/app/franchize/lib/operator-attribution";
import { getVerificationStatusMap, type RentalVerificationStatus } from "@/app/franchize/lib/rental-verify";

/** One credited rental in the member's TL;DR list (profile + docx report). */
export interface CategoryBonusRentalItem {
  rentalId: string;
  /** Rental start as stored (requested_start_date, MSK-local). */
  dateIso: string | null;
  bikeName: string;
  /** Client-paid price (moto + gear), ₽. */
  totalCost: number;
  /** Operator bonus credited for this rental (= base + equipment + overprice). */
  amount: number;
  base: number;
  equipment: number;
  overprice: number;
  equipmentUnits: number;
  /** Compact ru flags, e.g. «1шл+1перч» (matches the CSV «Экип» column style). */
  equipmentFlags: string;
  /** How this rental was credited to the member (operator-attribution chain). */
  source: AttributionSource;
  /** Operator who created the rental (/doc) — null for self-service web orders. */
  createdByChatId: string | null;
  /** Operator who handed the bike out / activated the web order («Фиксация выдачи»). */
  handedByChatId: string | null;
  /** Operator who confirmed the return. */
  returnedByChatId: string | null;
  /** Task 101: operator+owner commission confirmation state (null = no data yet). */
  verificationStatus: RentalVerificationStatus | null;
  /** Task 106: true when the numbers above are the NEGOTIATED (agreed) split
   *  — an accepted proposal corrected them after the frozen snapshot. */
  verificationAdjusted?: boolean;
  /** Task 102: rentals.status — the manual «✓ подтвердить» stamp must only
   *  render for COMPLETED rentals (verifying a bike that is still in rent
   *  makes no sense). Always present for rental rows. */
  status: string;
}

/** One credited sale in the member's TL;DR list. */
export interface CategoryBonusSaleItem {
  saleId: string;
  dateIso: string | null;
  amount: number;
  base: number;
  overprice: number;
  source: AttributionSource;
  /** Bot-session chat id that created the sale artifact (when known). */
  createdByChatId: string | null;
}

/**
 * Compact ru equipment flags — pure helper now LIVES in
 * lib/salary-coefficients-shared.ts (task101: shared with rental-verify
 * without a circular import). Re-exported here for back-compat.
 */
export { equipmentFlagsLabel };

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
  rentalItems: CategoryBonusRentalItem[];
  saleItems: CategoryBonusSaleItem[];
}> {
  const { crewId, memberId, periodStart, periodEnd } = params;
  const details: Array<{ type: string; amount: number; description: string }> = [];
  const rentalItems: CategoryBonusRentalItem[] = [];
  const saleItems: CategoryBonusSaleItem[] = [];

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
      vehicle:cars!inner(id, make, model, crew_id, specs, daily_price, type)
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
  // Task 98: standalone gear docs (item_type=equipment / cars.type=equipment)
  // and service works (type=service) are NOT bonus-bearing — the CSV pays
  // them 0 (СВОДКА: «бонус за экип уже учтён в ЗП аренд») — so they must not
  // enter the rental pool here either (alignment with the analytics export).
  const attributedRentals: Array<{ rental: any; source: AttributionSource }> = [];
  for (const r of (rentals || []) as any[]) {
    const meta = (r.metadata || {}) as Record<string, unknown>;
    const vehicle = Array.isArray(r.vehicle) ? r.vehicle[0] : r.vehicle;
    if (meta.item_type === "equipment" || vehicle?.type === "equipment") continue;
    if (vehicle?.type === "service") continue;
    const attribution = resolveRentalOperator(r, shifts);
    if (attribution.operatorId === memberId) {
      attributedRentals.push({ rental: r, source: attribution.source });
    }
  }

  const byRentalCategory: SalaryBucketMap = new Map();
  let rentalTotal = 0;
  // Task 106: parallel to rentalItems — where each item's bucket lives, so
  // the agreed-split correction can adjust the breakdown amounts in place.
  const rentalItemBuckets: Array<{ label: string; source: AttributionSource }> = [];
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
    // Task 98: accumulateSalaryBucket performs the missing .set() — this is
    // the bugfix that makes rental lines visible again.
    accumulateSalaryBucket(byRentalCategory, label, salary.total, source);
    const md = meta as Record<string, unknown>;
    const freeze = md.pickup_freeze as Record<string, unknown> | undefined;
    rentalItems.push({
      rentalId: String(r.rental_id || ""),
      dateIso: r.requested_start_date || r.agreed_start_date || null,
      bikeName: `${vehicle?.make || ""} ${vehicle?.model || ""}`.trim(),
      status: String(r.status || ""),
      totalCost: price,
      amount: salary.total,
      base: salary.base,
      equipment: salary.equipment,
      overprice: salary.overprice,
      equipmentUnits: countEquipmentUnits(eq),
      equipmentFlags: equipmentFlagsLabel(eq),
      source,
      createdByChatId:
        typeof r.created_by_operator_chat_id === "string" && r.created_by_operator_chat_id.trim()
          ? r.created_by_operator_chat_id.trim()
          : null,
      handedByChatId:
        freeze && typeof freeze.frozen_by === "string" && freeze.frozen_by.trim()
          ? freeze.frozen_by.trim()
          : null,
      returnedByChatId:
        typeof md.return_confirmed_by === "string" && md.return_confirmed_by.trim()
          ? md.return_confirmed_by.trim()
          : null,
      // Task 101: batch-filled right below from rental_verifications.
      verificationStatus: null,
    });
    rentalItemBuckets.push({ label, source });
  }

  // Task 101: batch-fetch the operator+owner verification state for the
  // credited rentals (one chunked query; empty map when the table is not
  // applied yet — badges then simply do not render).
  // Task 106: when the row carries an AGREED (corrected) split — the pair
  // settled a dispute through the negotiation flow — the corrected numbers
  // are THE truth: item amounts, the bucket breakdown and rentalTotal all
  // move to them, so the profile pays what was actually agreed.
  const verificationMap = await getVerificationStatusMap(rentalItems.map((i) => i.rentalId));
  for (let idx = 0; idx < rentalItems.length; idx += 1) {
    const item = rentalItems[idx];
    const brief = verificationMap.get(item.rentalId);
    item.verificationStatus = brief?.status ?? null;
    if (brief?.agreedSplit) {
      const agreed = brief.agreedSplit;
      const agreedTotal = agreed.base + agreed.equipment + agreed.overprice;
      const delta = agreedTotal - item.amount;
      if (delta !== 0) {
        const bucket = byRentalCategory.get(rentalItemBuckets[idx]?.label || "");
        if (bucket) bucket.amount += delta;
        rentalTotal += delta;
      }
      item.base = agreed.base;
      item.equipment = agreed.equipment;
      item.overprice = agreed.overprice;
      item.amount = agreedTotal;
      item.verificationAdjusted = true;
    }
  }

  if (rentalTotal > 0 || byRentalCategory.size > 0) {
    details.push(...salaryBucketsToDetails(byRentalCategory, {
      type: "rental_category_bonus",
      noun: "Аренда",
      sourceLabels: ATTRIBUTION_SOURCE_LABELS as unknown as Record<string, string>,
    }));
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

    const bySaleCategory: SalaryBucketMap = new Map();
    for (const s of ((sales || []) as any[])) {
      const attribution = resolveSaleOperator(s, memberIds, shifts);
      if (attribution.operatorId !== memberId) continue;
      const categories = resolveBikeCategories(s.resolved_bike_id || "", bikeOverrides);
      const salary = computeSaleSalary({
        config,
        saleCategory: categories.sale,
        salePrice: Number(s.sale_price) || 0,
      });
      saleTotal += salary.total;
      const label = categories.sale === "enduro_moped" ? "эндуро/мопеды" : categories.sale === "premium" ? "премиум" : "обычные";
      accumulateSalaryBucket(bySaleCategory, label, salary.total, attribution.source);
      saleItems.push({
        saleId: String(s.id || ""),
        dateIso: s.created_at || null,
        amount: salary.total,
        base: salary.base,
        overprice: salary.overprice,
        source: attribution.source,
        createdByChatId:
          typeof s.telegram_chat_id === "string" && s.telegram_chat_id.trim()
            ? s.telegram_chat_id.trim()
            : null,
      });
    }

    details.push(...salaryBucketsToDetails(bySaleCategory, {
      type: "sale_category_bonus",
      noun: "Продажа",
      sourceLabels: ATTRIBUTION_SOURCE_LABELS as unknown as Record<string, string>,
    }));
  }

  return { total: rentalTotal + saleTotal, details, rentalItems, saleItems };
}
