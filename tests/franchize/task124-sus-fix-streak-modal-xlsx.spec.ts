// tests/franchize/task124-sus-fix-streak-modal-xlsx.spec.ts
//
// Task 124 (boss 2026-10-22): four fronts at once.
//
//   1. October sus-разбор follow-up: the C4 paper-vs-books rule gained an
//      operational tolerance — «договор на бумаге X против книг Y» within
//      max(500 ₽, 5% of the paper) is almost (доставка/правка цены после
//      печати), a real gap stays sus. Plus the legacy-deposit backfill SQL
//      (docs/crewDocs/october-deposit-backfill-2026-10-22.sql).
//   2. Achievement «🕶️ 13 no problemo подряд» — a real streak: verified rows
//      newest-first walked while snapshot.reasonability.mode = no_problemo.
//   3. Closure modal: commissions summary (canon preview) + «расчёт сходится»
//      checkbox checked BY DEFAULT + odometer input ditched (mini line) +
//      fixed footer + floating quick bar hides while the modal is open.
//   4. Analytics export: XLSX with verification-tinted rows (download route
//      ?format=xlsx, Telegram send format "xlsx", colored modal preview).

import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  computeNoProblemoStreak,
  streakProgressLine,
  verifyProgressLine,
  type StreakRow,
} from "@/app/franchize/lib/rental-verify-core";
import { computeRentalAuditGrade } from "@/app/franchize/lib/rental-audit";
import { verificationToneOf, classifyCsvRow } from "@/lib/csv-builders/csv-to-xlsx";

const ROOT = resolve(__dirname, "../..");
const read = (p: string) => readFileSync(resolve(ROOT, p), "utf8");

// ── 1. C4 tolerance (October sus-разбор) ─────────────────────────────────────

describe("task124: C4 paper-vs-books tolerance", () => {
  const base = {
    status: "completed",
    depositReturned: true,
    metadata: { source: "doc_command", renter_name: "Сидоров", return_confirmed_by: "100200300", return_confirmed_at: "2026-10-11T10:00:00+03:00", odometer_after: 12345 },
    requestedStartDate: "2026-10-10T10:00:00+03:00",
    requestedEndDate: "2026-10-10T20:00:00+03:00",
    agreedStartDate: "2026-10-10T10:00:00+03:00",
    agreedEndDate: "2026-10-10T20:00:00+03:00",
    createdByOperatorChatId: "100200300",
    vehicleType: "bike",
    isTestResult: false,
  };

  it("paper == books (new template) → fine", () => {
    const r = computeRentalAuditGrade({ ...base, totalCost: 12000, depositAmount: 0, artifact: { totalSum: 12000, depositRub: 20000 } });
    expect(r.grade).toBe("fine");
  });

  it("paper == books + deposit (old template) → fine", () => {
    const r = computeRentalAuditGrade({ ...base, totalCost: 12000, depositAmount: 20000, artifact: { totalSum: 32000, depositRub: 20000 } });
    expect(r.grade).toBe("fine");
  });

  it("small divergence (≤ max(500, 5%)) downgrades to almost with a tolerance note", () => {
    // paper 28000 vs books 7000 + dep 20000 = 27000 → gap 1000 ≤ 5% of 28000 (1400)
    const r = computeRentalAuditGrade({ ...base, totalCost: 7000, depositAmount: 20000, artifact: { totalSum: 28000, depositRub: 20000 } });
    expect(r.grade).toBe("almost");
    expect(r.notes.join(" ")).toContain("в пределах допуска");
  });

  it("floor: 500 ₽ tolerance even on tiny papers", () => {
    // paper 3500 vs books 3750 (rent-only new template, small edit) → gap 250 ≤ 500
    const r = computeRentalAuditGrade({ ...base, totalCost: 3750, depositAmount: 20000, artifact: { totalSum: 3500, depositRub: 20000 } });
    expect(r.grade).toBe("almost");
  });

  it("big divergence stays sus (real бумага/книги gap)", () => {
    // paper 34500 vs books 12000 + 20000 = 32000 → gap 2500 > 5% (1725)
    const r = computeRentalAuditGrade({ ...base, totalCost: 12000, depositAmount: 20000, artifact: { totalSum: 34500, depositRub: 20000 } });
    expect(r.grade).toBe("sus");
    expect(r.notes.join(" ")).toContain("расхождение бумага/учёт");
  });

  it("audit notes never carry a raw '<' (Telegram HTML safety)", () => {
    const r = computeRentalAuditGrade({ ...base, totalCost: 7000, depositAmount: 20000, artifact: { totalSum: 28000, depositRub: 20000 } });
    expect(r.notes.join(" ")).not.toMatch(/[<>]/);
  });

  it("the legacy deposit backfill SQL exists for Paul", () => {
    const p = "docs/crewDocs/october-deposit-backfill-2026-10-22.sql";
    expect(existsSync(resolve(ROOT, p))).toBe(true);
    const sql = read(p);
    expect(sql).toContain("rental_contract_artifacts");
    expect(sql).toContain("deposit_amount");
    expect(sql).toContain("2026-09-15");
  });
});

// ── 2. The no-problemo streak (achievement «🕶️ 13 no problemo подряд») ──────

const clean = (id: string): StreakRow => ({ snapshot: { reasonability: { mode: "no_problemo", checks: [] } } });
const normal = (id: string): StreakRow => ({ snapshot: { reasonability: { mode: "normal", checks: [] } } });
const noReason = (id: string): StreakRow => ({ snapshot: {} });

describe("task124: computeNoProblemoStreak (pure)", () => {
  it("empty history → 0", () => {
    expect(computeNoProblemoStreak([])).toBe(0);
  });

  it("walks the newest-first clean run", () => {
    expect(computeNoProblemoStreak([clean("a"), clean("b"), clean("c")])).toBe(3);
  });

  it("stops at the first normal row", () => {
    expect(computeNoProblemoStreak([clean("a"), normal("b"), clean("c")])).toBe(1);
  });

  it("missing reasonability (pre-task123 rows) breaks the streak — unknown ≠ clean", () => {
    expect(computeNoProblemoStreak([clean("a"), noReason("b"), clean("c")])).toBe(1);
  });

  it("a non-clean NEWEST row → 0 (streak not started)", () => {
    expect(computeNoProblemoStreak([normal("a"), clean("b")])).toBe(0);
  });

  it("null/undefined rows are safe", () => {
    expect(computeNoProblemoStreak([null, undefined, clean("a")])).toBe(0);
  });
});

describe("task124: streakProgressLine (pure)", () => {
  it("quiet below 3 (no noise on fresh accounts)", () => {
    expect(streakProgressLine(0)).toBeNull();
    expect(streakProgressLine(2)).toBeNull();
  });

  it("counts up toward 13", () => {
    const l = streakProgressLine(7);
    expect(l).toContain("🕶️");
    expect(l).toContain("7 подряд");
    expect(l).toContain("ещё 6");
  });

  it("celebrates at 13 and keeps counting", () => {
    expect(streakProgressLine(13)).toContain("13 no problemo подряд");
    expect(streakProgressLine(14)).toContain("14 no problemo подряд");
  });

  it("streak lines are Telegram-HTML safe (no raw angle brackets)", () => {
    for (const s of [3, 7, 12, 13, 20].map((n) => streakProgressLine(n))) {
      if (s) expect(s).not.toMatch(/[<>]/);
    }
  });
});

describe("task124: streak wiring (source pins)", () => {
  it("catalog carries «🕶️ 13 no problemo подряд»", () => {
    const catalog = read("app/franchize/profile-actions.ts");
    expect(catalog).toContain('id: "verify_streak_13"');
    expect(catalog).toContain("🕶️ 13 no problemo подряд");
  });

  it("grant path: streak walked per party + grant pushed at 13", () => {
    const grant = read("app/franchize/lib/rental-verify.ts");
    expect(grant).toContain("loadNoProblemoStreakFor");
    expect(grant).toContain('grants.push({ id: "verify_streak_13", context: { streak } })');
    // newest-first, verified-only walk
    expect(grant).toContain('.eq("status", "verified")');
    expect(grant).toContain('.order("verified_at", { ascending: false, nullsFirst: false })');
    // the done-DM shows the streak line
    expect(grant).toContain("streakProgressLine(await loadNoProblemoStreakFor(chatId)");
  });

  it("the ladder line still ends at 100 (task123 behavior intact)", () => {
    expect(verifyProgressLine(100)).toBeNull();
  });
});

// ── 3. Closure modal: commissions summary + ok-checkbox + quick-bar hide ────

describe("task124: closure modal", () => {
  const modal = () => read("app/franchize/components/FranchizeRentalLifecycleActions.tsx");

  it("renders the canon commissions preview + pre-checked ok checkbox", () => {
    const s = modal();
    // Lazy: fetched once per modal open through the crew-gated action.
    expect(s).toContain("getClosureCommissionPreviewAction({ slug: crewSlug, rentalId })");
    expect(s).toContain("🧮 Считаем расчёт сверки…");
    expect(s).toContain("🧮 Расчёт сверки");
    expect(s).toContain("const [calcOk, setCalcOk] = useState(true)");
    expect(s).toContain("checked={calcOk}");
    expect(s).toContain("<b>Расчёт сходится</b>");
  });

  it("operatorAgreed travels: modal → action → snapshot", () => {
    // (the bare "operatorAgreed: calcOk," pin replaced: the vote is conditional)
    const actions = read("app/rentals/actions.ts");
    expect(actions).toContain("operatorAgreed?: boolean;");
    expect(actions).toContain("operatorAgreed: closureData?.operatorAgreed,");
    // no invisible agreement: the vote is sent only when the checkbox rendered
    expect(modal()).toContain("operatorAgreed: commissionPreview ? calcOk : undefined,");
    const verify = read("app/franchize/lib/rental-verify.ts");
    expect(verify).toContain("оператор сверил расчёт при закрытии");
    expect(verify).toContain('checks: ["оператор снял отметку «расчёт ок» при закрытии — проверьте внимательнее"]');
  });

  it("odometer input ditched → mini line with warning when missing", () => {
    const s = modal();
    expect(s).not.toContain('placeholder="например, 12345"');
    expect(s).toContain("🛞 Одометр:");
    expect(s).toContain("⚠️ Одометр не указан");
  });

  it("fixed safe-area footer (buttons never at the very screen bottom)", () => {
    const s = modal();
    expect(s).toContain("max(0.75rem, env(safe-area-inset-bottom))");
    expect(s).toContain("min-h-0 flex-1 overflow-y-auto overscroll-contain");
  });

  it("the floating quick bar hides itself while the modal is open", () => {
    const s = modal();
    expect(s).toContain('new CustomEvent("rental-closure-modal"');
    const bar = read("app/franchize/components/RentalQuickActionBar.tsx");
    expect(bar).toContain('addEventListener("rental-closure-modal"');
    expect(bar).toContain("if (modalOpen) return null;");
  });

  it("the preview is crew-gated and lazy (no RSC leak, no per-render cost)", () => {
    const action = read("app/franchize/server-actions/rental-verify-actions.ts");
    expect(action).toContain("getClosureCommissionPreviewAction");
    expect(action).toContain("verifyCrewAccess(params.slug)");
    expect(action).toContain("buildClosureCommissionPreview(params.rentalId, String(access.crewId || \"\"))");
    // the page must NOT compute the preview for every viewer anymore
    const page = read("app/franchize/[slug]/rental/[id]/page.tsx");
    expect(page).not.toContain("buildClosureCommissionPreview");
  });
});

// ── 4. Analytics export: XLSX + verification coloring ────────────────────────

describe("task124: analytics XLSX export", () => {
  it("tone classifier mirrors the exported labels", () => {
    expect(verificationToneOf("подтверждено")).toBe("verified");
    expect(verificationToneOf("ожидает")).toBe("waiting");
    expect(verificationToneOf("ждёт владельца")).toBe("waiting");
    expect(verificationToneOf("спор")).toBe("disputed");
    expect(verificationToneOf("подтверждено · скорректировано (1 000 ₽)")).toBe("verified");
    expect(verificationToneOf("")).toBeNull();
    expect(verificationToneOf("что-то иное")).toBeNull();
  });

  it("row classification survives the lib move", () => {
    expect(classifyCsvRow(["АРЕНДЫ"])).toBe("banner");
    expect(classifyCsvRow(["Итого по блоку", "12", "3 400"])).toBe("totals");
    expect(classifyCsvRow(["01.10.2026", "700"])).toBe("data");
    expect(classifyCsvRow(["", ""])).toBe("empty");
  });

  it("download route accepts ?format=xlsx and returns the workbook", () => {
    const route = read("app/api/franchize/rentals-csv-export/route.ts");
    expect(route).toContain('searchParams.get("format") === "xlsx"');
    expect(route).toContain("csvToXlsxBuffer");
    expect(route).toContain(".xlsx");
  });

  it("the client downloads xlsx and sends the bot an xlsx", () => {
    const client = read("app/franchize/[slug]/rentals-analytics/AnalyticsClientV2.tsx");
    expect(client).toContain("&format=xlsx");
    expect(client).toContain(".xlsx`");
    expect(client).toContain('format: "xlsx"');
  });

  it("the modal preview colors the verification column + tints rows", () => {
    const modal = read("app/franchize/[slug]/rentals-analytics/components/ExportCsvModal.tsx");
    // task 156 moved «Верификация» to col 27 (Способ оплаты/Имя/Телефон split)
    expect(modal).toContain("verification: 27");
    expect(modal).toContain("verificationToneOf");
    // Task 127 renamed the hardcoded pastels to theme-derived tints
    // (color-mix into the theme bg — dark theme no longer washes out).
    expect(modal).toContain("verToneBg");
    expect(modal).toContain("VER_TONE_TINT_PCT");
  });

  it("CSV column layout untouched (task101 pin still holds)", () => {
    const csv = read("lib/csv-builders/rentals-csv.ts");
    expect(csv).toContain('"Верификация"');
  });
});
