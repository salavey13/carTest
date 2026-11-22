import { beforeEach, describe, expect, it, vi } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Task 77 — salary report as a TG file (subrenter-report pipeline for salary):
//   1. pure template lib: shifts rows / breakdown rows / template integrity
//   2. source guards for the wiring points (action + both UI hooks)
// ─────────────────────────────────────────────────────────────────────────────

import {
  SALARY_REPORT_TEMPLATE,
  renderSalaryShiftRowsHtml,
  renderSalaryBreakdownRowsHtml,
} from "@/app/franchize/lib/salary-report-template";

describe("salary-report-template (Task 77)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ru-RU grouping uses a NBSP/NBSP-narrow separator depending on ICU —
  // assert group separators ICU-stably.
  const grouped = (n: number) => {
    const int = Math.trunc(n).toString();
    const groupedInt = int.replace(/\B(?=(\d{3})+(?!\d))/g, "G");
    return new RegExp(groupedInt.replace("G", "[\\\u00A0\\u202F ]"));
  };

  describe("renderSalaryShiftRowsHtml", () => {
    it("renders one bordered <tr> per shift with ru-formatted money", () => {
      const html = renderSalaryShiftRowsHtml([
        { dateLabel: "25.09.2026", hoursLabel: "10 ч 00 м", rateRub: 500, amountRub: 5000 },
        { dateLabel: "28.09.2026", hoursLabel: "9 ч 30 м", rateRub: 500, amountRub: 4755.4 },
      ]);
      const rows = html.split("\n");
      expect(rows).toHaveLength(2);
      expect(rows[0]).toContain("25.09.2026");
      expect(rows[0]).toContain("10 ч 00 м");
      expect(rows[0]).toMatch(grouped(5000));
      expect(rows[1]).toMatch(grouped(4755)); // ru-RU grouping + rounding
      expect(rows[1]).not.toContain("4755.4");
    });

    it("renders nothing (empty string) for an empty period", () => {
      expect(renderSalaryShiftRowsHtml([])).toBe("");
    });

    it("every row carries the docx-table border style the converter expects", () => {
      const html = renderSalaryShiftRowsHtml([
        { dateLabel: "01.10.2026", hoursLabel: "9 ч 31 м", rateRub: 500, amountRub: 4758 },
      ]);
      expect(html).toContain('style="border: 1px solid #000');
    });
  });

  describe("renderSalaryBreakdownRowsHtml", () => {
    it("renders one row per breakdown line (shifts / category bonuses)", () => {
      const html = renderSalaryBreakdownRowsHtml([
        { description: "Смены", amount: 11575 },
        { description: "Аренда (часовые): 16 × бонусы · 16 /doc", amount: 8000 },
      ]);
      expect(html).toContain("Смены");
      expect(html).toContain("Аренда (часовые): 16 × бонусы · 16 /doc");
      expect(html).toMatch(grouped(11575));
      expect(html).toMatch(grouped(8000));
    });

    it("renders an explicit empty-state row instead of an empty table", () => {
      const html = renderSalaryBreakdownRowsHtml([]);
      expect(html).toContain("Начислений за период не было");
      expect(html).toContain('colspan="2"');
    });
  });

  describe("SALARY_REPORT_TEMPLATE", () => {
    it("declares every variable the action assembles", () => {
      for (const v of [
        "{{crew_name}}",
        "{{member_full_name}}",
        "{{member_tg}}",
        "{{date_from}}",
        "{{date_to}}",
        "{{generated_at}}",
        "{{shifts_table_rows}}",
        "{{shifts_count}}",
        "{{shifts_hours}}",
        "{{shifts_total_rub}}",
        "{{breakdown_table_rows}}",
        "{{commissions_total_rub}}",
        "{{total_rub}}",
      ]) {
        expect(SALARY_REPORT_TEMPLATE).toContain(v);
      }
    });

    it("keeps the zero-shifts conditional the shared mustache dialect expects", () => {
      expect(SALARY_REPORT_TEMPLATE).toContain("{{#if zero_shifts}}");
      expect(SALARY_REPORT_TEMPLATE).toContain("{{else}}");
    });

    it("mentions the salary explainer so crew members see the calculation rules", () => {
      expect(SALARY_REPORT_TEMPLATE).toContain("Как считаются деньги");
    });
  });

  describe("wiring guards", () => {
    const fs = require("node:fs");
    const read = (p: string) => fs.readFileSync(`app/franchize/${p}`, "utf8");

    it("server action follows the subrenter pipeline (docx → sendTelegramDocument)", () => {
      const src = read("server-actions/salary-report.ts");
      expect(src).toContain("verifyCrewAccess");
      expect(src).toContain("resolveServerActorUserId");
      expect(src).toContain("calculateSalaryForPeriod");
      expect(src).toContain("mskDayBoundsUtcIso");
      expect(src).toContain("buildFranchizeDocxFromTemplate");
      expect(src).toContain("sendTelegramDocument");
      // owner-or-self IDOR rule
      expect(src).toContain("actorUserId !== parsed.memberId");
    });

    it("member self-service button lives in MyEarningsPanel", () => {
      const src = fs.readFileSync(
        "app/franchize/[slug]/profile/components/MyEarningsPanel.tsx",
        "utf8",
      );
      expect(src).toContain("sendSalaryReportTelegramAction");
      expect(src).toContain("memberId: userId");
      expect(src).toContain("from: earningsPeriod.from");
    });

    it("owner button lives in the SalaryClient breakdown modal", () => {
      const src = fs.readFileSync("app/franchize/[slug]/salary/SalaryClient.tsx", "utf8");
      expect(src).toContain("sendSalaryReportTelegramAction");
      expect(src).toContain("sendCopyToRequester");
    });
  });
});
