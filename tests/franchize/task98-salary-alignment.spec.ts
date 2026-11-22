import { describe, it, expect } from "vitest";
import { accumulateSalaryBucket, salaryBucketsToDetails, type SalaryBucketMap } from "@/lib/salary-bucket";
import { renderSalaryRentalRowsHtml, renderSalarySaleRowsHtml, renderSalaryBreakdownRowsHtml } from "@/app/franchize/lib/salary-report-template";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Task 98 — salary transparency & export alignment (boss/djorudjov 2026-10-16).
 *
 * ROOT BUG: computeCategoryBonuses mutated a fresh bucket but never wrote it
 * back into the Map — rental bonus lines vanished from EVERY breakdown
 * (profile «Детализация», docx section 3) while the total still counted them.
 * The boss: «за аренды не вижу такого красивого списочка».
 *
 * This suite pins: (1) the bucket write-back (pure), (2) the structural
 * guarantees across profile/docx/CSV so all three surfaces show ONE picture.
 */

const repoRoot = resolve(__dirname, "../..");
const read = (rel: string): string => readFileSync(resolve(repoRoot, rel), "utf8");

describe("accumulateSalaryBucket (pure — the root-bug regression)", () => {
  it("writes the bucket back into the map (the missing .set())", () => {
    const map: SalaryBucketMap = new Map();
    accumulateSalaryBucket(map, "Обычные", 1000, "doc_command");
    expect(map.size).toBe(1);
    expect(map.get("Обычные")).toEqual({
      count: 1,
      amount: 1000,
      sources: new Map([["doc_command", 1]]),
    });
  });

  it("accumulates across rentals with the same label and different sources", () => {
    const map: SalaryBucketMap = new Map();
    accumulateSalaryBucket(map, "Обычные", 1000, "doc_command");
    accumulateSalaryBucket(map, "Обычные", 400, "handout");
    accumulateSalaryBucket(map, "Премиум", 1500, "doc_command");
    const regular = map.get("Обычные")!;
    expect(regular.count).toBe(2);
    expect(regular.amount).toBe(1400);
    expect(regular.sources.get("doc_command")).toBe(1);
    expect(regular.sources.get("handout")).toBe(1);
  });

  it("salaryBucketsToDetails renders «Аренда (Обычные): 2 × бонусы · 1 /doc, 1 выдача»", () => {
    const map: SalaryBucketMap = new Map();
    accumulateSalaryBucket(map, "Обычные", 1000, "doc_command");
    accumulateSalaryBucket(map, "Обычные", 400, "handout");
    const details = salaryBucketsToDetails(map, {
      type: "rental_category_bonus",
      noun: "Аренда",
      sourceLabels: { doc_command: "/doc", handout: "выдача" },
    });
    expect(details).toHaveLength(1);
    expect(details[0].description).toBe("Аренда (Обычные): 2 × бонусы · 1 /doc, 1 выдача");
    expect(details[0].amount).toBe(1400);
  });
});

describe("docx row renderers escape user-controlled strings (task98 review)", () => {
  it("rental rows escape bike metadata / operator names (cheerio would eat a literal <)", () => {
    const html = renderSalaryRentalRowsHtml([
      {
        dateLabel: "02.10.2026",
        bikeName: '<b onclick="x">Yamaha</b>',
        equipmentFlags: "1шл",
        sourceLabel: "/doc",
        operatorsLabel: "создал <script>alert(1)</script>@x",
        priceRub: 10000,
        amountRub: 1000,
        baseRub: 1000,
        equipmentRub: 0,
        overpriceRub: 0,
      },
    ]);
    expect(html).not.toContain("<b onclick");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;b onclick=&quot;x&quot;&gt;Yamaha&lt;/b&gt;");
    expect(html).toContain("создал &lt;script&gt;");
    // empty flags/labels still render the em-dash placeholder
    const empty = renderSalaryRentalRowsHtml([
      {
        dateLabel: "02.10.2026",
        bikeName: "R7",
        equipmentFlags: "",
        sourceLabel: "/doc",
        operatorsLabel: "",
        priceRub: 1,
        amountRub: 1,
        baseRub: 1,
        equipmentRub: 0,
        overpriceRub: 0,
      },
    ]);
    expect(empty).toContain("—");
  });

  it("sale rows + breakdown rows escape too", () => {
    const sale = renderSalarySaleRowsHtml([
      { dateLabel: "10.10.2026", sourceLabel: "/doc", operatorsLabel: "A&B <C>", amountRub: 1, baseRub: 1, overpriceRub: 0 },
    ]);
    expect(sale).toContain("A&amp;B &lt;C&gt;");
    const breakdown = renderSalaryBreakdownRowsHtml([
      { description: "Комиссия: <img src=x>", amount: 5 },
    ]);
    expect(breakdown).toContain("Комиссия: &lt;img src=x&gt;");
  });
});

describe("Task 98 structural guarantees (source-grep)", () => {
  it("computeCategoryBonuses uses the bucket helper + exposes items + excludes gear/service", () => {
    const src = read("app/franchize/lib/salary-category-bonuses.ts");
    // the bugfix — bucket aggregation goes through the helper (which sets)
    expect(src).toContain("accumulateSalaryBucket(byRentalCategory");
    expect(src).toContain("accumulateSalaryBucket(bySaleCategory");
    expect(src).not.toMatch(/byRentalCategory\.get\(label\) \|\|/);
    // TL;DR items for the profile panel and the docx report
    expect(src).toContain("rentalItems: CategoryBonusRentalItem[]");
    expect(src).toContain("saleItems: CategoryBonusSaleItem[]");
    expect(src).toContain("handedByChatId");
    // standalone gear docs + service works pay no bonus (CSV СВОДКА parity)
    expect(src).toContain('meta.item_type === "equipment" || vehicle?.type === "equipment"');
    expect(src).toContain('vehicle?.type === "service"');
  });

  it("getMemberEarnings passes commissionItems with resolved operator labels", () => {
    const src = read("app/franchize/server-actions/team-earnings.ts");
    expect(src).toContain("commissionItems");
    expect(src).toContain("createdByLabel");
    expect(src).toContain("handedByLabel");
    expect(src).toContain("returnedByLabel");
  });

  it("profile panel renders the TL;DR rentals/sales lists with flags and split", () => {
    const src = read("app/franchize/[slug]/profile/components/MyEarningsPanel.tsx");
    expect(src).toContain("Аренды с моими бонусами");
    expect(src).toContain("Продажи с моими бонусами");
    expect(src).toContain("🪖 {r.equipmentFlags}");
    expect(src).toContain("техника {formatCurrency(r.base)}");
  });

  it("docx report has per-rental/per-sale detail tables + экип inclusion note", () => {
    const tpl = read("app/franchize/lib/salary-report-template.ts");
    expect(tpl).toContain("renderSalaryRentalRowsHtml");
    expect(tpl).toContain("renderSalarySaleRowsHtml");
    expect(tpl).toContain("{{rentals_table_rows}}");
    expect(tpl).toContain("{{sales_table_rows}}");
    expect(tpl).toContain("{{rentals_equipment_total_rub}}");
    // the explanation the boss asked for: экип уже внутри ЗП аренд
    expect(tpl).toContain("уже входит в суммы аренд");
    const action = read("app/franchize/server-actions/salary-report.ts");
    expect(action).toContain("commissionItems");
  });

  it("CSV export: ЗП split + equipment flags + attribution columns (rentals and sales)", () => {
    const src = read("lib/csv-builders/rentals-csv.ts");
    expect(src).toContain('"ЗП техника", "ЗП экип", "ЗП наценка", "Экип флаги"');
    expect(src).toContain('"Оператор создал", "Оператор выдал", "Оператор принял", "Оператор (ЗП)", "Атрибуция ЗП"');
    expect(src).toContain("resolveRentalOperator");
    // sales attribution uses the SAME chain as the profile math
    expect(src).toContain("resolveSaleOperator");
    // shift cross-reference context (±1 day margin) so CSV == profile
    expect(src).toContain("crew_member_shifts");
    expect(src).toContain("crewMemberIds");
    expect(src).toContain("created_by_operator_chat_id");
  });

  it("hourly rate default is 100 ₽/h everywhere (code side; DB via Paul's SQL)", () => {
    expect(read("app/franchize/lib/salary-constants.ts")).toContain("DEFAULT_HOURLY_RATE = 100");
    const shiftCmd = read("app/webhook-handlers/commands/shift.ts");
    expect(shiftCmd).toContain("DEFAULT_HOURLY_RATE");
    expect(shiftCmd).not.toMatch(/\|\| 500/);
  });

  it("Paul's SQL: hourly default 100 + djorudjov October backfill + audit block", () => {
    const sql = read("docs/crewDocs/salary-hourly-default-100-dj-october-shifts-2026-10-16.sql");
    expect(sql).toContain("ALTER COLUMN hourly_rate SET DEFAULT 100");
    expect(sql).toContain("COALESCE((metadata->>'hourly_rate')::NUMERIC, 100)");
    // 07–14 and 16–25 October (15th = day off)
    expect(sql).toContain("'2026-10-07'::date, '2026-10-14'::date");
    expect(sql).toContain("'2026-10-16'::date, '2026-10-25'::date");
    expect(sql).toContain("owner_fix_20261016_salary_defaults");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Task 100 — final code review / alignment / adaptability polish (boss 2026-10-17).
// Boss feedback: (1) «are you sure there is table for rentals in salary part of
// profile?» — the TL;DR lists vanished for members with 0 attributed rentals;
// (2) «why djorudjov is called strangrly in зарплаты команды» — full_name
// "Dmitry User" beat the recognizable @username; (3) team table not scrollable
// horizontally on mobile — w-full compressed 6 columns instead of scrolling;
// (4) «shifts are counted as 500/h still» — stored legacy rates need Paul's
// normalize SQL; (5) rentals must be visible personally for ALL members.
// ═══════════════════════════════════════════════════════════════════════════
describe("Task 100 — salary UI polish, naming, mobile scroll, rate normalize", () => {
  it("rentals/sales TL;DR sections ALWAYS render for category-model crews (empty state)", () => {
    const src = read("app/franchize/[slug]/profile/components/MyEarningsPanel.tsx");
    // the section guard is now «commissionItems present», NOT «items exist»
    expect(src).toContain("{periodEarnings.commissionItems && (");
    // old vanish-guard must be gone for the section wrappers
    expect(src).not.toContain("commissionItems?.rentals?.length ?? 0) > 0 && (");
    expect(src).not.toContain("commissionItems?.sales?.length ?? 0) > 0 && (");
    // empty states explain WHY the list can be empty (attribution rule)
    expect(src).toContain("В выбранном периоде аренд с моими бонусами нет");
    expect(src).toContain("В выбранном периоде продаж с моими бонусами нет");
  });

  it("team leaderboard names: @username first (crew handle), full_name as secondary", () => {
    const src = read("app/franchize/server-actions/team-earnings.ts");
    // both resolvers (getTeamEarnings + getOwnerSalaryOverview) — username-first
    expect(src.match(/username && `@\$\{member\.users\.username\}`/g)?.length).toBe(2);
    expect(src.match(/const memberFullName = member\.users\?\.full_name \|\| null;/g)?.length).toBe(2);
    // rows carry the full name through to the UI
    expect(src.match(/memberFullName,/g)?.length).toBe(2);
    // panel type + secondary line rendering
    const panel = read("app/franchize/[slug]/profile/components/MyEarningsPanel.tsx");
    expect(panel).toContain("memberFullName?: string | null");
    expect(panel).toContain("member.memberName.replace(/^@/, \"\")");
  });

  it("team table keeps a usable width on phones (horizontal scroll, no squeeze)", () => {
    const src = read("app/franchize/[slug]/profile/components/MyEarningsPanel.tsx");
    expect(src).toContain("overflow-x-auto");
    expect(src).toContain("min-w-[560px]");
    // the column shows HOURS, not a shift count
    expect(src).toContain(">Часы</th>");
    // bonus legend wraps instead of overflowing a 360px row
    expect(src).toContain("flex flex-wrap items-center gap-x-3 gap-y-1");
  });

  it("KPI label no longer claims «Смены» for a money number", () => {
    const src = read("app/franchize/[slug]/profile/components/MyEarningsPanel.tsx");
    expect(src).toContain(">За смены</p>");
    // KPI grid itself shows shiftIncome under the new label (not the old one)
    expect(src).not.toContain(">Смены</p>");
  });

  it("Paul's normalize SQL: 500→100 with EXPLICIT salary_amount (trigger won't fire) + audit", () => {
    const sql = read("docs/crewDocs/salary-october-shifts-normalize-100-2026-10-17.sql");
    // salary_amount recomputed from the generated duration — never written
    expect(sql).toContain("salary_amount = ROUND((duration_minutes / 60.0) * 100, 2)");
    expect(sql).not.toMatch(/SET[^;]*duration_minutes\s*=/);
    // guard makes it idempotent + scoped + completed shifts only
    expect(sql).toContain("AND hourly_rate = 500");
    expect(sql).toContain("clock_out_time IS NOT NULL");
    expect(sql).toContain("owner_fix_20261017_salary_normalize_100");
    // preview before write (Paul's runbook convention)
    expect(sql).toContain("-- ── 1. Preview (no writes)");
  });

  it("salary cache bumped v100 — warm 24h caches must not serve pre-normalize numbers", () => {
    const src = read("app/franchize/server-actions/salary-calculations.ts");
    expect(src).toContain("-v100`");
    expect(src).not.toContain("-v98`");
  });

  it("team dialog is pinned to the phone screen (no fixed-position clipping)", () => {
    const src = read("app/franchize/[slug]/profile/components/MyEarningsPanel.tsx");
    // tailwind gotcha: calc() needs underscores, or the declaration is invalid CSS
    expect(src).toContain("w-[calc(100vw_-_2rem)]");
    expect(src).toContain("max-h-[90dvh]");
    expect(src).toContain("overflow-y-auto");
    // grid item must be shrinkable, or the table's min-width escapes to the dialog
    expect(src).toContain("min-w-0 space-y-4");
  });

  it("INCIDENT GUARD: mock identity can never be upserted into the shared users table", () => {
    // server choke point: refuse writes when mock mode is on and the target IS the mock id
    const srv = read("lib/supabase-server.ts");
    expect(srv).toContain("Mock-identity upsert REFUSED");
    expect(srv).toContain('process.env.NEXT_PUBLIC_USE_MOCK_USER === "true"');
    expect(srv).toContain('process.env.NEXT_PUBLIC_MOCK_USER_ID || "413553377"');
    // client hook: mock sessions skip the upsert chain AND lead tracking entirely
    const hook = read("hooks/telegram/useTelegramAuth.ts");
    expect(hook).toContain("if (MOCK_USER && userId === String(MOCK_USER.id))");
    expect(hook).toContain("!isMockIdentity");
    // repair SQL for the 2026-10-17 clobber (djorudjov → «Mock User»), Paul runs
    const sql = read("docs/crewDocs/fix-djorudjov-identity-mockupsert-2026-10-17.sql");
    expect(sql).toContain("owner_fix_20261017_identity_restore");
    expect(sql).toContain("'djorudjov'");
    expect(sql).toContain("'Dmitry User'");
    expect(sql).toContain("IS DISTINCT FROM");
  });
});
