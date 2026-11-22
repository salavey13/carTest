// tests/franchize/iter14-suite.spec.ts
// iter14 regression suite:
//   1. Header padding policy (resolveFranchizeHeaderPaddingTop + overlay offset)
//   2. Analytics day-page KPIs (computeAnalyticsKpis + isRentalRelevantForDate)
//   3. Rental/equipment contract signature prefills (renter + issuer names)
//   4. Subrent weekly report template (Appendix № 3, §5.5)
//   5. Checkout send-block ordering invariants (source-level)

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { applyTemplateVariables } from "@/lib/markdownTemplate";
import {
  FRANCHIZE_HEADER_TOP_FLOOR_MOBILE_PX,
  resolveFranchizeHeaderPaddingTop,
  resolveFranchizeOverlayTopOffsetPx,
} from "@/app/franchize/lib/route-cta-policy";
import {
  computeAnalyticsKpis,
  isRentalRelevantForDate,
} from "@/app/franchize/[slug]/rentals-analytics/components/lib/analytics-utils";

const DOCS = join(process.cwd(), "docs");

// ── 1. Header padding policy ────────────────────────────────────────────────

describe("iter14: crewHeader top padding policy", () => {
  it("non-Telegram context keeps the compact base padding", () => {
    expect(resolveFranchizeHeaderPaddingTop({ inTelegram: false, mobileLayout: true, contentSafeTopPx: 47 })).toBe(
      "calc(max(env(safe-area-inset-top), 0px) + 1.45rem)",
    );
  });

  it("Telegram + MOBILE layout enforces the 96px floor even with a lying client (0px report)", () => {
    const value = resolveFranchizeHeaderPaddingTop({ inTelegram: true, mobileLayout: true, contentSafeTopPx: 0 });
    expect(value).toContain(`max(`);
    expect(value).toContain(`${FRANCHIZE_HEADER_TOP_FLOOR_MOBILE_PX}px`);
  });

  it("Telegram + MOBILE with exact measurement still never drops below the floor", () => {
    const value = resolveFranchizeHeaderPaddingTop({ inTelegram: true, mobileLayout: true, contentSafeTopPx: 47 });
    expect(value).toContain("47px");
    expect(value).toContain("96px");
  });

  it("Telegram + WIDE (desktop) layout keeps the compact padding when nothing overlaps", () => {
    expect(resolveFranchizeHeaderPaddingTop({ inTelegram: true, mobileLayout: false, contentSafeTopPx: 0 })).toBe(
      "calc(max(env(safe-area-inset-top), 0px) + 1.45rem)",
    );
  });

  it("Telegram + WIDE layout trusts a real contentSafeArea measurement", () => {
    const value = resolveFranchizeHeaderPaddingTop({ inTelegram: true, mobileLayout: false, contentSafeTopPx: 52 });
    expect(value).toContain("52px");
    expect(value).not.toContain("96px");
  });

  it("overlay panels (HeaderMenu) keep a minimum clearance on mobile", () => {
    expect(resolveFranchizeOverlayTopOffsetPx({ mobileLayout: true, contentSafeTopPx: 0 })).toBeGreaterThanOrEqual(44);
    expect(resolveFranchizeOverlayTopOffsetPx({ mobileLayout: true, contentSafeTopPx: 60 })).toBe(60);
    expect(resolveFranchizeOverlayTopOffsetPx({ mobileLayout: false, contentSafeTopPx: 0 })).toBe(0);
  });
});

// ── 2. Analytics day-page KPIs ───────────────────────────────────────────────

// MSK(+03:00) fixtures — 26→27 rental starts 26th 20:00 MSK, ends 27th 20:00 MSK
const RENT_26_27 = {
  status: "completed",
  total_cost: 10000,
  agreed_start_date: "2026-08-26T17:00:00+00:00",
  agreed_end_date: "2026-08-27T17:00:00+00:00",
};
const RENT_27_SAMEDAY = {
  status: "completed",
  total_cost: 7000,
  agreed_start_date: "2026-08-27T12:30:00+00:00", // 15:30 MSK 27th
  agreed_end_date: "2026-08-27T15:30:00+00:00", // 18:30 MSK 27th
};
const RENT_27_28 = {
  status: "active",
  total_cost: 10000,
  agreed_start_date: "2026-08-27T15:30:00+00:00", // 18:30 MSK 27th
  agreed_end_date: "2026-08-28T15:30:00+00:00",
};

describe("iter14: analytics day-page KPIs (MSK calendar)", () => {
  it("Аренд сегодня counts only rentals STARTED on the selected day", () => {
    const kpis = computeAnalyticsKpis([RENT_26_27, RENT_27_SAMEDAY, RENT_27_28], "2026-08-27");
    expect(kpis.totalToday).toBe(2); // 27th-started: same-day + 27→28; NOT the 26→27
  });

  it("Выручка sums only the day's STARTED rentals (not cross-day endings)", () => {
    const kpis = computeAnalyticsKpis([RENT_26_27, RENT_27_SAMEDAY], "2026-08-27");
    expect(kpis.revenueToday).toBe(7000); // only the bmw-style same-day rental
  });

  it("Возвратов counts rentals ENDING on the selected day (any non-cancelled status)", () => {
    const kpis = computeAnalyticsKpis([RENT_26_27, RENT_27_SAMEDAY, RENT_27_28], "2026-08-27");
    expect(kpis.returnsDue).toBe(2); // the 26→27 completed + the same-day rental
  });

  it("a completed rental ending today still counts as a return (the live bug: 0 instead of 1)", () => {
    const kpis = computeAnalyticsKpis([RENT_26_27], "2026-08-27");
    expect(kpis.returnsDue).toBe(1);
    expect(kpis.totalToday).toBe(0);
    expect(kpis.revenueToday).toBe(0);
  });

  it("Активных counts only currently-active rows on the day page", () => {
    const kpis = computeAnalyticsKpis([RENT_26_27, RENT_27_28], "2026-08-27");
    expect(kpis.activeCount).toBe(1);
  });

  it("day-page relevance: a 26→27 rental is relevant on BOTH days", () => {
    expect(isRentalRelevantForDate(RENT_26_27, "2026-08-26")).toBe(true);
    expect(isRentalRelevantForDate(RENT_26_27, "2026-08-27")).toBe(true);
    expect(isRentalRelevantForDate(RENT_26_27, "2026-08-28")).toBe(false);
  });

  it("MSK boundary: a 26th 21:00Z start is 28th-less — never relevant on the 26th UTC-only logic", () => {
    // 2026-08-26T21:00:00Z == 27th 00:00 MSK → belongs to the 27th in MSK
    const row = { agreed_start_date: "2026-08-26T21:00:00+00:00", agreed_end_date: "2026-08-27T21:00:00+00:00", status: "completed", total_cost: 5000 };
    expect(isRentalRelevantForDate(row, "2026-08-27")).toBe(true);
    expect(computeAnalyticsKpis([row], "2026-08-27").totalToday).toBe(1);
    expect(computeAnalyticsKpis([row], "2026-08-26").totalToday).toBe(0);
  });
});

// ── 3. Contract signature prefills ──────────────────────────────────────────

describe("iter14: contract signature placeholders prefill names", () => {
  const rentalTpl = readFileSync(join(DOCS, "RENTAL_DEAL_TEMPLATE.html"), "utf8");
  const rentalCrew = readFileSync(join(DOCS, "crewDocs", "vip-bike_RENTAL_DEAL_TEMPLATE.html"), "utf8");
  const equipTpl = readFileSync(join(DOCS, "EQUIPMENT_RENTAL_DEAL_TEMPLATE.html"), "utf8");
  const equipCrew = readFileSync(join(DOCS, "crewDocs", "vip-bike_EQUIPMENT_RENTAL_DEAL_TEMPLATE.html"), "utf8");

  const baseVars = {
    renter_full_name: "Дровнин Евгений Васильевич",
    issuer_representative: "Молев Георгий Анатольевич",
  };

  it("all four templates prefill the renter name in the appendix signature rows", () => {
    for (const [name, tpl] of [["rental", rentalTpl], ["rental-crew", rentalCrew], ["equip", equipTpl], ["equip-crew", equipCrew]] as const) {
      expect(tpl, `${name}: appendix renter prefill`).toContain("/ {{renter_full_name}} /");
      expect(tpl, `${name}: appendix issuer prefill`).toContain("/ {{issuer_representative}} /");
    }
  });

  it("rental templates prefill names in the MAIN signature block (both branches)", () => {
    for (const [name, tpl] of [["rental", rentalTpl], ["rental-crew", rentalCrew]] as const) {
      // issuer line (always) + renter unsigned line (else-branch)
      expect(tpl, `${name}: issuer main line`).toContain("_________________ / {{issuer_representative}}");
      expect(tpl, `${name}: renter else-branch`).toContain("{{else}}<td style=\"border: none; width: 50%; text-align: center;\">_________________ / {{renter_full_name}}</td>{{/if}}");
    }
  });

  it("rendered doc shows the renter name instead of a fully blank line (unsigned ПЭП)", () => {
    const rendered = applyTemplateVariables(rentalTpl, { ...baseVars, pep_signed: "" });
    expect(rendered).toContain("_________________ / Дровнин Евгений Васильевич");
    expect(rendered).not.toContain("Подписано ПЭП:");
  });

  it("rendered doc keeps the ПЭП block (and drops the blank line) when signed", () => {
    const rendered = applyTemplateVariables(rentalTpl, {
      ...baseVars,
      pep_signed: "1",
      renter_signature: "Telegram ID 1062465800 (@KRAMSTERN)",
      signature_timestamp: "27.08.2026 18:13 (МСК)",
    });
    expect(rendered).toContain("Подписано ПЭП:");
    expect(rendered).toContain("Telegram ID 1062465800");
    // the else-branch blank line must be gone
    expect(rendered).not.toContain("_________________ / Дровнин Евгений Васильевич</td>");
  });

  it("personal-data consent line prefills the renter name", () => {
    const rendered = applyTemplateVariables(rentalTpl, baseVars);
    expect(rendered).toContain("___________________________ / Дровнин Евгений Васильевич");
  });
});

// ── 4. Subrent weekly report (Appendix № 3) ─────────────────────────────────

describe("iter14: subrent weekly report template (§5.5 / Appendix 3)", () => {
  const tpl = readFileSync(join(DOCS, "SUBRENT_WEEKLY_REPORT_TEMPLATE.html"), "utf8");
  const crewTpl = readFileSync(join(DOCS, "crewDocs", "vip-bike_SUBRENT_WEEKLY_REPORT_TEMPLATE.html"), "utf8");

  const vars = {
    owner_full_name: "Голиков Юрий Александрович",
    organization_short: "vip-bike",
    organization_name: "ИП Молев Георгий Анатольевич",
    inn: "526302993427",
    legal_address: "г. Нижний Новгород",
    issuer_representative: "Молев Георгий Анатольевич",
    owner_phone: "+79991234567",
    date_from: "24.08.2026",
    date_to: "30.08.2026",
    rental_count: "2",
    total_payments_rub: "17 000",
    owner_percentage: "50",
    owner_payout_rub: "8 500",
    generated_at: "28.08.2026 12:00",
    payment_deadline_days: "2",
    zero_report: "",
    rental_rows:
      "<tr><td>1</td><td>24.08.2026 – 25.08.2026</td><td>Yamaha R7</td><td>Иванов И.И.</td><td>10 000</td><td>Завершена</td></tr>",
  };

  it("crew copy stays in sync with the base template", () => {
    expect(crewTpl).toBe(tpl);
  });

  it("renders a filled report with rows and payout", () => {
    const rendered = applyTemplateVariables(tpl, vars);
    expect(rendered).toContain("ЕЖЕНЕДЕЛЬНЫЙ ОТЧЕТ");
    expect(rendered).toContain("24.08.2026");
    expect(rendered).toContain("Yamaha R7");
    expect(rendered).toContain("8 500");
    expect(rendered).toContain("50%");
    expect(rendered).not.toContain("{{");
  });

  it("renders the ZERO report (п. 5.6) when there were no rentals", () => {
    const rendered = applyTemplateVariables(tpl, {
      ...vars,
      zero_report: "1",
      rental_rows: "",
      rental_count: "0",
      total_payments_rub: "0",
      owner_payout_rub: "0",
    });
    expect(rendered).toContain("нулевой отчет");
    expect(rendered).not.toContain("{{");
  });

  it("signature rows prefill both party names", () => {
    const rendered = applyTemplateVariables(tpl, vars);
    expect(rendered).toContain("/ Молев Георгий Анатольевич /");
    expect(rendered).toContain("/ Голиков Юрий Александрович /");
  });
});

// ── 5. Checkout ordering invariants (source-level, the live kawasaki bug) ────

describe("iter14: checkout flow ordering (rental row before TG sends)", () => {
  const src = readFileSync(join(process.cwd(), "app/franchize/actions-runtime.ts"), "utf8");

  it("rental rows are created BEFORE the DOCX fan-out", () => {
    const createPos = src.indexOf("── Create public.rentals row");
    const sendPos = src.indexOf("── Send DOCX for each bike");
    expect(createPos).toBeGreaterThan(-1);
    expect(sendPos).toBeGreaterThan(createPos);
  });

  it("the sends fan out in parallel and never abort on partial failure", () => {
    expect(src).toContain("sendTargets.flatMap");
    expect(src).toContain("Partial DOCX delivery failure");
    expect(src).toContain("failedSends.length === sendResults.length");
  });

  it("the contract attachment runs protected (was an unprotected gap)", () => {
    expect(src).toContain("contract attachment failed (non-fatal)");
  });
});
