// tests/franchize/task79-salary-consistency.spec.ts
//
// Task 79 (2026-10-07): «djorudjov sees the same salary picture as the crew
// owner» — every salary surface must show the same number for category-model
// crews (crews.metadata.franchize.salaryCoefficients):
//   • calculateSalaryForPeriod («Детали расчёта» /salary) — the canonical
//   • getMemberEarnings  («Мои доходы» in the profile)
//   • getTeamEarnings    («Зарплаты команды» owner modal)
//   • getOwnerSalaryOverview (/salary overview table)
//   • getMyEarnings      (legacy monthly «Начислено» on the profile)
// Under the category model recorded expense_commission rows are SKIPPED and
// fixed rental/sale category bonuses attributed via the operator chain are
// used INSTEAD (mirroring calculateSalaryForPeriod; no double counting).
//
// Also pins the boss-review profile TABS refactor (lazy keep-mounted tabs,
// panels untouched).

import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";

const read = (p: string) => readFileSync(p, "utf8");

describe("task 79: salary surfaces are category-model consistent", () => {
  const lib = read("app/franchize/lib/salary-category-bonuses.ts");
  const team = read("app/franchize/server-actions/team-earnings.ts");
  const calc = read("app/franchize/server-actions/salary-calculations.ts");

  it("computeCategoryBonuses is a plain server lib (NOT a use-server action export)", () => {
    // A "use server" export becomes a client-callable server action with no
    // auth guard — the extraction must stay a plain lib module.
    expect(lib).not.toMatch(/^"use server"/m);
    expect(lib).toContain("export async function computeCategoryBonuses");
    // the full operator attribution chain stays inside
    expect(lib).toContain("resolveRentalOperator");
    expect(lib).toContain("resolveSaleOperator");
    expect(lib).toContain('from("rentals")');
    expect(lib).toContain('from("sale_contract_artifacts")');
  });

  it("calculateSalaryForPeriod imports the shared lib (behavior unchanged)", () => {
    expect(calc).toContain('from "@/app/franchize/lib/salary-category-bonuses"');
    expect(calc).toContain("computeCategoryBonuses(");
    // no local copy left behind (single source of truth)
    expect(calc).not.toContain("export async function computeCategoryBonuses");
  });

  it("getMemberEarnings uses category bonuses under the category model", () => {
    const section = team.slice(team.indexOf("export async function getMemberEarnings"));
    expect(section).toContain("hasSalaryCoefficients(crewId)");
    expect(section).toContain("computeCategoryBonuses({");
    // recorded commissions only in the legacy branch
    expect(section).toContain('transaction_type", "expense_commission"');
    // breakdown carries the attribution lines («Аренда (Стандарт): 16 × бонусы · 16 /doc»)
    expect(section).toContain("bonuses.details");
  });

  it("getTeamEarnings computes category bonuses for the whole team", () => {
    const section = team.slice(team.indexOf("export async function getTeamEarnings"));
    expect(section).toContain("hasSalaryCoefficients(crewId)");
    expect(section).toContain("categoryBonusesByMember.set(member.user_id, bonuses.total)");
    expect(section).toContain("categoryBonusesByMember.get(memberId)");
  });

  it("getOwnerSalaryOverview accrued includes category bonuses (payout math)", () => {
    const section = team.slice(team.indexOf("export async function getOwnerSalaryOverview"));
    expect(section).toContain("hasSalaryCoefficients(crewId)");
    expect(section).toContain("categoryBonusesByMember.set(member.user_id, bonuses.total)");
    // accrued = shifts + commissionIncome (now category-aware)
    expect(section).toContain("Math.round(shiftIncome + commissionIncome)");
  });

  it("getMyEarnings monthly «Начислено» is category-aware too", () => {
    const section = calc.slice(calc.indexOf("export async function getMyEarnings"));
    expect(section).toContain("hasSalaryCoefficients");
    expect(section).toContain("computeCategoryBonuses({");
    expect(section).toContain("dynamicCommissionAccrued = bonuses.total");
  });
});

describe("task 79: profile tabs (boss-review refactor)", () => {
  const client = read("app/franchize/[slug]/profile/ProfileClient.tsx");
  const bar = read("app/franchize/[slug]/profile/components/ProfileTabBar.tsx");

  it("composition renders the tab rail and role-filtered tabs", () => {
    expect(client).toContain("ProfileTabBar");
    expect(client).toContain("visibleTabIds.includes");
    expect(client).toContain('label: "Аренды"');
    expect(client).toContain('label: "Доходы"');
    expect(client).toContain('label: "Партнёры"');
    expect(client).toContain('label: "Документы"');
    expect(client).toContain('label: "Достижения"');
    expect(client).toContain('label: "Инструменты"');
  });

  it("tabs are lazy keep-mounted (draft state survives switching)", () => {
    // hidden tabs stay mounted via display:none; active tab always renders
    expect(client).toContain("mountedTabs.has(tab.id)");
    expect(client).toContain('display: "none"');
    // NOT a naive conditional unmount of the whole tab panel
    expect(client).not.toContain("{activeTab === ");
  });

  it("role defaults: partners for owners, earnings for crew/subrenter", () => {
    expect(client).toContain('partnersAvailable\n    ? "partners"');
    expect(client).toContain('? "earnings"');
  });

  it("tab bar is an accessible tablist with themable tokens", () => {
    expect(bar).toContain('role="tablist"');
    expect(bar).toContain('role="tab"');
    expect(bar).toContain("aria-selected");
    expect(bar).toContain("ProfileTabId");
  });

  it("all 10 panel files untouched by the composition refactor (no imports moved)", () => {
    // the panels stay self-contained — the refactor only re-composes them
    for (const p of [
      "app/franchize/[slug]/profile/components/MyEarningsPanel.tsx",
      "app/franchize/[slug]/profile/components/MyWorkPanel.tsx",
      "app/franchize/[slug]/profile/components/OwnerCashWalletPanel.tsx",
      "app/franchize/[slug]/profile/components/SubrentersOverviewPanel.tsx",
      "app/franchize/[slug]/profile/components/SubrenterMyBikesPanel.tsx",
      "app/franchize/[slug]/profile/components/RentalsPurchasesPanel.tsx",
      "app/franchize/[slug]/profile/components/AchievementsPanel.tsx",
      "app/franchize/[slug]/profile/components/CrewOperationsPanel.tsx",
      "app/franchize/[slug]/profile/components/ProfileHeaderPanel.tsx",
      "app/franchize/[slug]/profile/components/ProfileDocumentsPanels.tsx",
    ]) {
      const src = read(p);
      expect(src).not.toContain("ProfileTabBar");
      expect(src).not.toContain("activeTab");
    }
  });
});
