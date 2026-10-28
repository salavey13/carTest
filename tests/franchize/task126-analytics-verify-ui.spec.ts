// Task 126 — analytics modal overhaul: «Сверка комиссии» card + sectioned
// drawer + legacy sheet-X removal + verification filter chips in the table view.
//
// Layers pinned here:
//   1. Data: getVerificationStatusMap picks the FROZEN commission numbers
//      (snapshot jsonb keys) with zero extra queries; briefs degrade honestly.
//   2. Pure: buildCommissionLines / commissionStatusMeta (the card math).
//   3. Wiring: dashboard item → AnalyticsClientV2 → row → drawer card;
//      rental page loads the brief server-side and renders the same card.
//   4. UI guards: the legacy sheet X is GONE (TG top-corner overlap), the
//      drawer header X remains the single close button; dead primary actions
//      no longer render on completed rows; the table view chips filter by
//      verification tone.
//   5. Money surface safety: the card calls the same owner-gated server
//      actions; failure flags are inline, never silent.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const src = (p: string) => readFileSync(p, "utf8");

import {
  buildCommissionLines,
  commissionStatusMeta,
} from "@/app/franchize/lib/commission-card-core";

// ── 1. Data layer: frozen numbers ride with the status map ──────────────────

describe("task126 · getVerificationStatusMap commission picks", () => {
  it("selects the snapshot money keys alongside audit (jsonb picks, both column sets)", () => {
    const s = src("app/franchize/lib/rental-verify.ts");
    expect(s).toContain("com_base:snapshot->base");
    expect(s).toContain("com_equip:snapshot->equipment");
    expect(s).toContain("com_over:snapshot->overprice");
    expect(s).toContain("com_total:snapshot->total");
    expect(s).toContain("com_client:snapshot->totalCost");
    expect(s).toContain("com_cat:snapshot->rentalCategoryLabel");
    expect(s).toContain("com_units:snapshot->equipmentUnits");
    expect(s).toContain("com_formula:snapshot->formula");
    // the plain fallback (no negotiation column) carries the same picks
    expect(s.match(/com_formula:snapshot->formula/g)?.length).toBe(2);
  });

  it("reassembles the brief only when money fields survived", () => {
    const s = src("app/franchize/lib/rental-verify.ts");
    expect(s).toContain('if (row.com_base == null && row.com_total == null && row.com_equip == null) return null;');
    expect(s).toContain("...(commission ? { commission } : {}),");
  });

  it("the map stays batched + graceful on a missing table (source pins)", () => {
    const s = src("app/franchize/lib/rental-verify.ts");
    expect(s).toContain("const CHUNK = 200;");
    expect(s).toContain("isMissingRelationError(err)");
    expect(s).toContain("Map<string, VerificationBrief>");
  });
});

describe("task126 · dashboard → row wiring", () => {
  it("RentalDashboardItem carries commission + agreed split", () => {
    const s = src("app/franchize/server-actions/rentals-dashboard.ts");
    expect(s).toContain("verificationCommission?: VerificationCommissionBrief | null;");
    expect(s).toContain("verificationAgreedSplit?: SplitParts | null;");
    expect(s).toContain("verificationCommission: verificationMap.get(item.rental_id)?.commission ?? null,");
    expect(s).toContain("verificationAgreedSplit: verificationMap.get(item.rental_id)?.agreedSplit ?? null,");
  });

  it("AnalyticsClientV2 maps both into the client row", () => {
    const s = src("app/franchize/[slug]/rentals-analytics/AnalyticsClientV2.tsx");
    expect(s).toContain("verificationCommission: item.verificationCommission ?? null,");
    expect(s).toContain("verificationAgreedSplit: item.verificationAgreedSplit ?? null,");
  });
});

// ── 2. Pure card math ────────────────────────────────────────────────────────

describe("task126 · buildCommissionLines (the transparent math)", () => {
  it("full formula block: чек + эталон lines + наценка + the bold commission result", () => {
    const lines = buildCommissionLines({
      base: 1000,
      equipment: 600,
      overprice: 300,
      total: 1900,
      totalCost: 27000,
      categoryLabel: "premium",
      equipmentUnits: 3,
      formula: {
        fallback: false,
        bikeStandard: 25000,
        gearStandard: 1500,
        standardTotal: 26500,
        clientTotal: 27000,
        markup: 500,
        baseCoef: 1500,
        equipmentUnitCoef: 200,
        overpricePercent: 10,
        shortRental: false,
        bikeTierLabel: "6 суток · тариф 2–4 дня",
      },
    });
    const labels = lines.map((l) => l.label);
    expect(labels).toEqual([
      "Чек клиента",
      "Эталон: мото",
      "Эталон: экип (3 ед.)",
      "Наценка",
      "Комиссия оператора",
    ]);
    expect(lines[0].value).toBe("27\u00A0000 ₽");
    expect(lines[1].hint).toContain("6 суток");
    expect(lines[3].value).toBe("500 ₽");
    expect(lines[3].hint).toBe("комиссия 10% с наценки");
    expect(lines[4].strong).toBe(true);
    expect(lines[4].value).toBe("1\u00A0000 ₽ + 600 ₽ + 300 ₽ = 1\u00A0900 ₽");
  });

  it("pre-formula row: only чек + the frozen commission parts, no эталон fiction", () => {
    const lines = buildCommissionLines({
      base: 750,
      equipment: null,
      overprice: 0,
      total: 750,
      totalCost: 3000,
    });
    expect(lines.map((l) => l.label)).toEqual(["Чек клиента", "Комиссия оператора"]);
    expect(lines[1].value).toBe("750 ₽ + — + 0 ₽ = 750 ₽");
  });

  it("nulls render as — (honest absence, never 0)", () => {
    const lines = buildCommissionLines({
      base: null,
      equipment: null,
      overprice: null,
      total: null,
      totalCost: null,
    });
    // Чек line is skipped (nothing to show) — the commission line stays honest
    expect(lines).toHaveLength(1);
    expect(lines[0].value).toBe("— + — + — = —");
  });
});

describe("task126 · commissionStatusMeta", () => {
  it("maps every verification state to an honest chip", () => {
    expect(commissionStatusMeta("none").label).toContain("сверки ещё нет");
    expect(commissionStatusMeta("verified").label).toBe("✅ сверена");
    expect(commissionStatusMeta("verified", { adjusted: true }).label).toContain("скорректирована");
    expect(commissionStatusMeta("operator_confirmed").label).toContain("ждёт владельца");
    expect(commissionStatusMeta("owner_confirmed").label).toContain("ждёт оператора");
    expect(commissionStatusMeta("disputed").label).toBe("⚠️ спор сверки");
    expect(commissionStatusMeta("disputed", { proposalOpen: true }).label).toContain("предложение отправлено");
    expect(commissionStatusMeta("pending").label).toContain("отправлена");
  });
});

// ── 3. The drawer: sections + card ──────────────────────────────────────────

describe("task126 · drawer overhaul (source guards)", () => {
  const drawer = src("app/franchize/[slug]/rentals-analytics/components/RentalDetailDrawer.tsx");

  it("renders the сверка card FIRST with the full data bundle", () => {
    expect(drawer).toContain("<CommissionVerificationCard");
    expect(drawer).toContain("commission={rental.verificationCommission}");
    expect(drawer).toContain("verificationStatus={ver}");
    expect(drawer).toContain("agreedSplit={rental.verificationAgreedSplit}");
    expect(drawer).toContain("audit={rental.verificationAudit}");
    expect(drawer).toContain("onChanged={onChanged}");
    expect(drawer).toContain("canVerify={canVerify}");
  });

  it("the flat tile wall is split into «Аренда» + «Деньги» sections", () => {
    expect(drawer).toContain('title="Аренда"');
    expect(drawer).toContain('title="Деньги"');
    expect(drawer).toContain("rentalInfoItems");
    expect(drawer).toContain("moneyInfoItems");
    // the old single-grid render is gone
    expect(drawer).not.toContain("items={infoItems}");
  });

  it("dead primary actions don't render on completed/cancelled rows", () => {
    expect(drawer).toMatch(/rental\.status === "cancelled" \|\| rental\.status === "completed"/);
    expect(drawer).toMatch(/primaryActions\.length > 0/);
    // the close button stays — the SINGLE close affordance in the content
    expect(drawer).toContain('aria-label="Закрыть панель"');
  });

  it("old parent-owned verify props are gone (the card owns them now)", () => {
    expect(drawer).not.toContain("onVerifyRental");
    expect(drawer).not.toContain("onResendDms");
    expect(drawer).not.toContain("verifyPending");
  });
});

describe("task126 · legacy sheet X removed (TG top-corner overlap)", () => {
  const sheet = src("app/franchize/[slug]/rentals-analytics/components/AnalyticsMobileSheet.tsx");

  it("the drag handle no longer renders a close button", () => {
    expect(sheet).not.toContain('aria-label="Закрыть"');
    expect(sheet).not.toContain("<X ");
    expect(sheet).not.toContain('"lucide-react"');
  });

  it("close affordances remain: swipe-down dismiss + Esc + backdrop", () => {
    expect(sheet).toMatch(/info\.offset\.y > 120 \|\| info\.velocity\.y > 600/);
    expect(sheet).toContain('"Escape"');
    expect(sheet).toMatch(/onClick=\{onClose\}/);
  });

  it("the other two drawers keep their own header close buttons", () => {
    expect(src("app/franchize/[slug]/rentals-analytics/components/SaleDetailDrawer.tsx")).toContain(
      'aria-label="Закрыть панель"',
    );
    expect(src("app/franchize/[slug]/rentals-analytics/components/ServiceDetailDrawer.tsx")).toContain(
      'aria-label="Закрыть панель"',
    );
  });
});

// ── 4. Table view: verification filter chips ────────────────────────────────

describe("task126 · ExportCsvModal verification chips", () => {
  const modal = src("app/franchize/[slug]/rentals-analytics/components/ExportCsvModal.tsx");

  it("chips double as the legend: Все / сверены / ждут / споры / без сверки", () => {
    expect(modal).toContain('"✅ сверены"');
    expect(modal).toContain('"⏳ ждут"');
    expect(modal).toContain('"⚠️ споры"');
    expect(modal).toContain('"➕ без сверки"');
    expect(modal).toContain('VerFilterKey = "all" | Exclude<VerTone, null> | "none"');
  });

  it("counts come from the UNFILTERED rentals block; filter hides section totals", () => {
    expect(modal).toContain("const verCounts = (() => {");
    expect(modal).toMatch(/verificationToneOf\(r\[verCol\] \|\| ""\) \?\? "none"/);
    expect(modal).toMatch(/totals: null,/);
  });

  it("filter composes with the search filter, rentals block only", () => {
    expect(modal).toContain(".map(applyFilter).map(applyVerFilter)");
    expect(modal).toContain('if (verFilter === "all" || s.key !== "rentals") return s;');
  });

  it("resets with the modal open", () => {
    expect(modal).toContain('setVerFilter("all");');
  });
});

// ── 5. Rental page: the same card, server-fed ───────────────────────────────

describe("task126 · rental page сверка card", () => {
  const page = src("app/franchize/[slug]/rental/[id]/page.tsx");

  it("fetches the brief server-side (non-fatal) and renders the shared card", () => {
    expect(page).toContain("getVerificationStatusMap([rental.rentalId])");
    expect(page).toContain("<CommissionVerificationCard");
    expect(page).toContain("commission={verBrief?.commission ?? null}");
    expect(page).toContain("verificationStatus={verBrief?.status ?? null}");
  });

  it("replaces the legacy bare strip (the resend button import is gone)", () => {
    expect(page).not.toContain("VerificationResendButton");
    // the rendered strip (a <p> heading) is gone — comments may mention history
    expect(page).not.toMatch(/Сверка расчёта<\/p>/);
  });

  it("renders for completed closures only, and ONLY for crew staff or the password session (codereview #2 + task159)", () => {
    expect(page).toMatch(/status === "completed" && \(isCrewStaff \|\| passwordAuthOwnerId\)/);
    // the brief is fetched behind the same server-side gate — never embedded
    // into a renter's RSC payload (passwordAuthOwnerId is DB-gated too)
    expect(page).toMatch(/rental\.found && \(isCrewStaff \|\| passwordAuthOwnerId\)\n    \? \(await getVerificationStatusMap/);
  });

  it("the manual confirm is owner-tier gated server-side AND client-side (codereview #5)", () => {
    expect(page).toContain("canVerify={verAccess?.isOwner === true}");
  });
});

// ── 6. Money surface safety ─────────────────────────────────────────────────

describe("task126 · card actions keep the owner-gated server actions", () => {
  const card = src("app/franchize/components/CommissionVerificationCard.tsx");

  it("same actions, same confirm dialog semantics, inline failure flags", () => {
    // task151 — both actions carry the password-identity params (...verifyActorParams)
    expect(card).toContain("adminVerifyRentalAction({ slug, rentalId, ...verifyActorParams });");
    expect(card).toContain("resendVerificationDmsAction({ slug, rentalId, ...verifyActorParams });");
    expect(card).toContain("window.confirm(");
    expect(card).toContain("не сохранилось");
    expect(card).toContain("не отправилось");
    expect(card).toContain("Не доставлено");
  });

  it("no onChanged hook → router.refresh fallback; resend refetches only on create", () => {
    expect(card).toContain("router.refresh()");
    expect(card).toContain("notifyChanged({ createdOnly: !res.data?.created })");
  });

  it("confirm is hidden once verified; send stays for the proof copy", () => {
    expect(card).toMatch(/canVerify && cardStatus !== "verified"/);
  });

  it("closed-gated: «confirmed» is a booking, not a closed deal — completed only", () => {
    expect(card).toContain('const isClosed = rentalStatus === "completed";');
    expect(card).not.toContain('rentalStatus === "confirmed"');
  });
});
