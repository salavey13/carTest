// tests/franchize/task123-no-problemo.spec.ts
//
// Task 123 (boss 2026-10-22): «analyze october rentals from point of view of
// verification reasonability — if it looks super ok, then verification
// notification can be simpler — kinda details can be collapsed into spoiler;
// highlight such rentals as "no problemo" — that should increase speed of
// verification and overall enjoyment of the process».
//
//   1. computeVerificationReasonability — the audit grade + last-mile checks
//      (penalty/damage/deposit/formula) decide the DM layout at request time.
//   2. formatVerificationSummary — «no_problemo» collapses the whole расчёт
//      into a Telegram <blockquote expandable> under a calm 🟢 headline with
//      a short ✅ checklist; «normal» keeps the rich task-117 layout and now
//      also shows the 📸 photo presence line.
//   3. Photos before/after + rental comment travel with the DM (one state
//      photo per recipient — «ПОСЛЕ» wins, «ДО» is the fallback).
//   4. verify_100 tier: the ladder continues past 50 («Сотня без споров 🎖»).
//   5. The fake /franchize/[slug]/leaderboard page is KILLED (boss: «kill the
//      fake /leaderboard page»).

import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  formatVerificationSummary,
  photoPresenceLine,
  verifyProgressLine,
  type RentalVerificationSnapshot,
} from "@/app/franchize/lib/rental-verify-core";
import { computeRentalAuditGrade, computeVerificationReasonability } from "@/app/franchize/lib/rental-audit";

const ROOT = resolve(__dirname, "../..");
const read = (p: string) => readFileSync(resolve(ROOT, p), "utf8");
// ru-RU amounts render with narrow NBSP — normalize before substring pins.
const nbsp = (s: string) => s.replace(/[\u00a0\u202f]/g, " ");

const OP = "100200300";
const OWNER = "400500600";

// ── 1. computeVerificationReasonability ─────────────────────────────────────

describe("task123 · computeVerificationReasonability", () => {
  const FINE = { grade: "fine" as const, notes: [] };
  const base = {
    audit: FINE,
    markup: 0,
    total: 5000,
    penaltyAmount: 0,
    damageNotes: null,
    depositReturned: true,
    depositAmount: 10000,
    hasFormula: true,
  };

  it("clean rental → no_problemo with the calm checklist", () => {
    const r = computeVerificationReasonability(base);
    expect(r.mode).toBe("no_problemo");
    expect(r.checks.length).toBeGreaterThanOrEqual(3);
    expect(r.checks.some((c) => c.includes("сошёлся с эталоном"))).toBe(true);
    expect(r.checks.some((c) => c.includes("депозит возвращён"))).toBe(true);
    expect(r.checks.some((c) => c.includes("без ущерба и штрафов"))).toBe(true);
  });

  it("sus audit (books mismatch) → normal, no checklist", () => {
    const audit = computeRentalAuditGrade({
      status: "completed",
      totalCost: 3500,
      depositAmount: 0,
      depositReturned: null,
      metadata: { bike_price: 4450, equipment_price: 0 },
    });
    expect(audit.grade).toBe("sus");
    const r = computeVerificationReasonability({ ...base, audit });
    expect(r.mode).toBe("normal");
    expect(r.checks).toEqual([]);
  });

  it("almost audit (missing telemetry) → normal", () => {
    const audit = computeRentalAuditGrade({
      status: "completed",
      totalCost: 5000,
      depositAmount: 0,
      depositReturned: null,
      metadata: { bike_price: 5000, equipment_price: 0, return_confirmed_by: "u1", return_confirmed_at: "t" },
      // no odometer_after → almost
    });
    expect(audit.grade).toBe("almost");
    const r = computeVerificationReasonability({ ...base, audit });
    expect(r.mode).toBe("normal");
  });

  it("penalty withheld → normal (money left the deposit — human eyes needed)", () => {
    const r = computeVerificationReasonability({ ...base, penaltyAmount: 3000 });
    expect(r.mode).toBe("normal");
  });

  it("damage notes → normal", () => {
    const r = computeVerificationReasonability({ ...base, damageNotes: "царапина на баке" });
    expect(r.mode).toBe("normal");
  });

  it("zero/unknown total → normal", () => {
    expect(computeVerificationReasonability({ ...base, total: 0 }).mode).toBe("normal");
  });

  it("pre-task-117 row without frozen formula → normal (nothing to collapse)", () => {
    expect(computeVerificationReasonability({ ...base, hasFormula: false }).mode).toBe("normal");
  });

  it("markup > 0 does NOT block — наценка is a computed part of the deal, spelled out in the check", () => {
    const r = computeVerificationReasonability({ ...base, markup: 10000 });
    expect(r.mode).toBe("no_problemo");
    expect(r.checks.some((c) => nbsp(c).includes("наценка 10 000 ₽"))).toBe(true);
  });

  it("deposit wording covers all three states", () => {
    expect(computeVerificationReasonability({ ...base, depositReturned: true }).checks.join(" ")).toContain("депозит возвращён");
    expect(
      computeVerificationReasonability({ ...base, depositReturned: null, depositAmount: 5000 }).checks.join(" "),
    ).toContain("депозит помечен возвращённым");
    expect(
      computeVerificationReasonability({ ...base, depositReturned: null, depositAmount: 0 }).checks.join(" "),
    ).toContain("депозит не собирался");
  });
});

// ── 2. The DM layout ─────────────────────────────────────────────────────────

describe("task123 · formatVerificationSummary layouts", () => {
  const rub = (n: number) => `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(n)} ₽`;

  const snapBase = {
    bikeName: "Kawasaki EX650K",
    rentalCategory: "regular",
    rentalCategoryLabel: "Обычные",
    totalCost: 5000,
    base: 500,
    equipment: 200,
    overprice: 0,
    total: 700,
    equipmentUnits: 2,
    equipmentFlags: "1шл+1перч",
    overpricePercent: 10,
    depositReturned: true,
    damageNotes: null,
    returnNotes: null,
    penalty: null,
    attribution: { source: "request", createdByChatId: OP, handedByChatId: null, returnedByChatId: OWNER },
    requestedAtIso: "2026-10-21T09:00:00.000Z",
    formula: {
      fallback: false,
      bikeStandard: 4500,
      bikeTierLabel: "1–2 дня",
      bikeRate: 4500,
      bikeDays: 1,
      bikeHours: 24,
      gearLines: ["1 шлем — 500 ₽", "1 перчатки — 250 ₽"],
      gearStandard: 750,
      gearDays: 1,
      equipFollowupUnit: 100,
      gearDaysLabel: null,
      gearDaysLine: null,
      equipCommLine: null,
      shortRental: false,
      standardTotal: 5250,
      clientTotal: 5000,
      markup: 0,
      baseCoef: 1000,
      equipmentUnitCoef: 200,
      overpricePercent: 10,
    },
    bikePhotoUrl: "https://img.example/bike.jpg",
    photos: { before: 6, after: 7, beforeUrl: "https://img.example/before.jpg", afterUrl: "https://img.example/after.jpg" },
    reasonability: {
      mode: "no_problemo" as const,
      checks: ["расчёт сошёлся с эталоном — без наценки", "депозит возвращён", "без ущерба и штрафов"],
    },
    audit: { grade: "fine" as const, notes: [] },
  } as unknown as RentalVerificationSnapshot;

  function summary(overrides: Partial<RentalVerificationSnapshot>, operatorScore?: { sum: number; count: number }): string {
    return formatVerificationSummary({
      crewName: "vip-bike",
      snapshot: { ...snapBase, ...overrides } as RentalVerificationSnapshot,
      usersMap: new Map(),
      operatorChatId: OP,
      ownerChatId: OWNER,
      statusNote: "Ждёт подтверждения: оператор и владелец.",
      operatorScore: operatorScore ?? null,
    });
  }

  it("no_problemo → 🟢 headline + checks + expandable spoiler with the full расчёт", () => {
    const text = summary({});
    expect(text).toContain("🟢 <b>No problemo</b> — все проверки сошлись");
    expect(text).toContain("✅ расчёт сошёлся с эталоном — без наценки");
    expect(text).toContain("<blockquote expandable>");
    expect(text).toContain("</blockquote>");
    // the spoiler carries the money the two parties split
    const inner = text.split("<blockquote expandable>")[1] || "";
    expect(inner).toContain("Комиссия оператора");
    expect(inner).toContain("Откуда цифры");
    expect(inner).toContain("эталон");
    expect(inner).toContain("принял");
    expect(inner).toContain("Аудит: ✅ всё чисто");
  });

  it("no_problemo → statusNote stays OUTSIDE the spoiler (visible without a tap)", () => {
    const text = summary({});
    const tail = text.split("</blockquote>")[1] || "";
    expect(tail).toContain("Ждёт подтверждения");
  });

  it("no_problemo → photo presence + return comment stay OUTSIDE the spoiler", () => {
    const text = summary({ returnNotes: "бак полный, всё чисто" });
    const head = text.split("<blockquote expandable>")[0] || "";
    expect(head).toContain("📸 Фото: 6 до · 7 после");
    expect(head).toContain("📝 комментарий: бак полный, всё чисто");
    // and NOT duplicated inside the spoiler
    const inner = text.split("<blockquote expandable>")[1] || "";
    expect(inner).not.toContain("бак полный");
  });

  it("no_problemo → the operator's score line is inside the spoiler", () => {
    const text = summary({}, { sum: 3400, count: 7 });
    const inner = text.split("<blockquote expandable>")[1] || "";
    expect(inner).toContain("Счёт");
    expect(nbsp(inner)).toContain("3 400");
  });

  it("normal mode → rich layout, no spoiler, photo line before the status note", () => {
    const text = summary({ reasonability: { mode: "normal", checks: [] } });
    expect(text).not.toContain("<blockquote");
    expect(text).not.toContain("No problemo");
    expect(text).toContain("📊 <b>Комиссия оператора");
    const photoIdx = text.indexOf("📸 Фото: 6 до · 7 после");
    const noteIdx = text.indexOf("Ждёт подтверждения");
    expect(photoIdx).toBeGreaterThan(-1);
    expect(photoIdx).toBeLessThan(noteIdx);
  });

  it("normal mode → damage/penalty flags still visible (the rich layout keeps its job)", () => {
    const text = summary({
      reasonability: { mode: "normal", checks: [] },
      damageNotes: "царапина",
      penalty: { amount: 3000, destination: "cash", reason: "ущерб" },
    });
    expect(text).toContain("🩹 ущерб: царапина");
    expect(nbsp(text)).toContain("⚠️ штраф 3 000 ₽");
  });

  it("summary contains no raw '<' outside Telegram HTML tags (hotfix regression, incl. expandable)", () => {
    // NB: the task-120 lesson — a raw '<' kills EVERY copy with Telegram 400.
    const ALLOWED = /<\/?\s*(b|strong|i|em|u|ins|s|strike|del|span|tg-spoiler|a|code|pre|blockquote)(\s[^>]*)?>/gi;
    const naked = (t: string) => t.replace(ALLOWED, "");
    const clean = summary({});
    const messy = summary({ returnNotes: "вернул <без бензина> & <забыл шлем>" });
    expect(naked(clean)).not.toMatch(/[<>]/);
    expect(naked(messy)).not.toMatch(/[<>]/);
    expect(messy).toContain("&lt;без бензина&gt;");
  });

  it("pre-task-123 rows (no reasonability/photos) degrade to the rich layout", () => {
    const text = summary({ reasonability: null, photos: null, formula: undefined });
    expect(text).not.toContain("<blockquote");
    expect(text).not.toContain("📸 Фото");
    expect(text).toContain("📊 <b>Комиссия оператора");
  });
});

// ── 3. Photo presence line + state photo pick ───────────────────────────────

describe("task123 · photo presence", () => {
  it("photoPresenceLine: counts render; absent/zero → null", () => {
    expect(photoPresenceLine(undefined)).toBeNull();
    expect(photoPresenceLine(null)).toBeNull();
    expect(photoPresenceLine({ before: 0, after: 0 })).toBeNull();
    expect(photoPresenceLine({ before: 6, after: 7 })).toBe("📸 Фото: 6 до · 7 после");
    expect(photoPresenceLine({ before: 2, after: 0 })).toBe("📸 Фото: 2 до");
    expect(photoPresenceLine({ before: 0, after: 3 })).toBe("📸 Фото: 3 после");
  });

  it("source pin: sendVerificationStatePhoto prefers ПОСЛЕ, ДО is the fallback", () => {
    const src = read("app/franchize/lib/rental-verify.ts");
    expect(src).toContain("📸 ПОСЛЕ — состояние при возврате");
    expect(src).toContain("📸 ДО — состояние при выдаче");
    const pickOrder = src.indexOf("afterUrl\n    ? { url: afterUrl");
    expect(pickOrder).toBeGreaterThan(-1);
  });

  it("source pin: the request select carries the photo counters", () => {
    const src = read("app/franchize/lib/rental-verify.ts");
    expect(src).toContain("start_photo_count, end_photo_count");
    expect(src).toContain("statePhotos: snapshot.photos");
  });
});

// ── 4. verify_100 tier ───────────────────────────────────────────────────────

describe("task123 · verify_100 tier", () => {
  it("ladder: <10 десятка, <50 полсотни, <100 сотня, ≥100 null", () => {
    expect(verifyProgressLine(3)).toContain("Безупречная десятка");
    expect(verifyProgressLine(49)).toContain("Полсотни рукопожатий");
    const at99 = verifyProgressLine(99);
    expect(at99).toContain("Сотня без споров");
    expect(at99).toContain("ещё 1 сверку");
    expect(verifyProgressLine(100)).toBeNull();
    expect(verifyProgressLine(150)).toBeNull();
  });

  it("source pins: grant threshold + catalog entry", () => {
    const grant = read("app/franchize/lib/rental-verify.ts");
    expect(grant).toContain('grants.push({ id: "verify_100", context: { verifiedCount } })');
    const catalog = read("app/franchize/profile-actions.ts");
    expect(catalog).toContain('id: "verify_100"');
    expect(catalog).toContain("Сотня без споров 🎖");
  });
});

// ── 5. The fake /leaderboard is dead ─────────────────────────────────────────

describe("task123 · kill the fake /leaderboard page", () => {
  it("page + fake client are deleted from the repo", () => {
    expect(existsSync(resolve(ROOT, "app/franchize/[slug]/leaderboard/page.tsx"))).toBe(false);
    expect(existsSync(resolve(ROOT, "app/franchize/components/FranchizeLeaderboardClient.tsx"))).toBe(false);
  });

  it("discovery no longer links the leaderboard", () => {
    const page = read("app/franchize/discovery/page.tsx");
    expect(page).not.toContain("/leaderboard");
    expect(page).not.toContain("Рейтинг райдеров");
  });

  it("no production code imports the fake client anymore", () => {
    expect(read("app/franchize/discovery/page.tsx")).not.toContain("FranchizeLeaderboardClient");
  });
});
