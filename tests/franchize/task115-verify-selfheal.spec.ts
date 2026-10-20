// Task 115 — SELF-HEAL: «we should be able to "сверять" already closed rentals»
// (boss 2026-10-20). Tapping ✅/⚠️ on an old DM or a hub card whose сверка row
// is gone used to dead-end with «Сверка не найдена (аренда закрыта до ввода
// сверки)». Now the tap re-creates the сверка on the fly and the game
// continues. Pinned here:
//   • selfHealErrorText maps every requestRentalVerification rejection to a
//     human answer; unknown/exception → null (caller keeps the classic text);
//   • the vrf_ok_/vrf_dis_ handler self-heals BEFORE answering the classic
//     dead-end, and a healed row joins the normal state machine;
//   • buildCardFor (payo_open_) heals too — a stale hub entry becomes a REAL
//     card, svc/equipment docs get the polite refusal;
//   • self-heal only converts COMPLETED rentals (active/cancelled stay dead);
//   • the payout hub conversion list now reaches July closures: window 92d
//     (was 45), limit 500 (was 30 — only ~2 weeks deep), cap 10 (was 5);
//   • service/equipment docs are still never converted (boss rule, task 114);
//   • synthetic fixtures only — no real ids / tokens in this file.

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { selfHealErrorText } from "@/app/franchize/lib/rental-verify-core";

const repo = (...p: string[]) => path.resolve(process.cwd(), ...p);
const src = (p: string) => readFileSync(repo(p), "utf8");

const verifySrc = src("app/franchize/lib/rental-verify.ts");
const payoutSrc = src("app/franchize/lib/rental-payout.ts");

// ── Pure: rejection → human answer ───────────────────────────────────────────

describe("task115 · selfHealErrorText", () => {
  it("maps every known rejection to a human answer", () => {
    expect(selfHealErrorText("rental not found")).toBe("Аренда не найдена.");
    expect(selfHealErrorText("no crew — personal rental")).toBe("Личная аренда без экипажа — сверка не нужна.");
    expect(selfHealErrorText("equipment/service doc — no operator bonus")).toBe(
      "По этой позиции нет комиссии оператора — сверка не нужна.",
    );
    expect(selfHealErrorText("no parties to verify")).toBe("Нет участников сверки — оператор и владелец не найдены.");
  });

  it("unknown / exception reasons → null (caller keeps the classic text)", () => {
    expect(selfHealErrorText("exception")).toBeNull();
    expect(selfHealErrorText("table missing")).toBeNull();
    expect(selfHealErrorText(undefined)).toBeNull();
  });
});

// ── vrf_ok_/vrf_dis_ self-heal ───────────────────────────────────────────────

describe("task115 · verify callback self-heal", () => {
  it("the vrf_ handler heals a missing row BEFORE the classic dead-end", () => {
    const handler = verifySrc.slice(verifySrc.indexOf("export async function handleRentalVerifyCallback"));
    const body = handler.slice(0, handler.indexOf("let current_ = current;"));
    // self-heal runs inside the `if (!current)` branch…
    expect(body).toContain("if (!current)");
    expect(body.indexOf("selfHealVerificationRow")).toBeGreaterThan(-1);
    // …the healed row is re-read and joins the state machine…
    expect(body).toContain("Сверка не была заведена — создал заново ✅");
    expect(body).toContain("current = fresh as RentalVerificationRow;");
    // …and the classic text is only the last-resort fallback.
    expect(body).toContain('heal.message || "Сверка не найдена (аренда закрыта до ввода сверки)."');
  });

  it("self-heal converts ONLY completed rentals — status gate before requestRentalVerification", () => {
    const helper = verifySrc.slice(verifySrc.indexOf("export async function selfHealVerificationRow"));
    const body = helper.slice(0, helper.indexOf("requestRentalVerification("));
    expect(body).toContain('from("rentals")');
    expect(body).toContain('status !== "completed"');
  });

  it("self-heal marks its source for the audit trail", () => {
    expect(verifySrc).toContain('source: "self-heal"');
  });
});

// ── payo_open_ card self-heal ────────────────────────────────────────────────

describe("task115 · payout card self-heal", () => {
  it("buildCardFor heals a rowless rental into a REAL card instead of a dead-end", () => {
    const fn = payoutSrc.slice(payoutSrc.indexOf("async function buildCardFor"));
    const body = fn.slice(0, fn.indexOf("const item = buildPayoutItem(row, chatId);"));
    expect(body).toContain("selfHealVerificationRow(rentalId, chatId)");
    // after healing the row is re-read for the real card…
    expect(body).toContain("const fresh = await loadRowById(rentalId);");
    // …the polite refusal is returned as the card error…
    expect(body).toContain("return { error: heal.message };");
    // …and the classic text remains the last-resort fallback.
    expect(body).toContain('if (!row) return { error: "Сверка не найдена (аренда закрыта до ввода сверки)." };');
  });
});

// ── Convertibles: July-era closures must surface ─────────────────────────────

describe("task115 · payout hub conversion window", () => {
  it("window is 92 days so pre-system July closures are convertible", () => {
    expect(payoutSrc).toContain("92 * 24 * 3600 * 1000");
    expect(payoutSrc).not.toContain("45 * 24 * 3600 * 1000");
  });

  it("the completed-rentals scan is no longer capped at 30 rows (~2 weeks)", () => {
    const conv = payoutSrc.slice(payoutSrc.indexOf("async function loadConvertibles"));
    const body = conv.slice(0, conv.indexOf("const out: PayoutConvertible[]"));
    expect(body).not.toContain(".limit(30)");
    expect((body.match(/\.limit\(500\)/g) || []).length).toBe(2); // personal + crew scans
  });

  it("up to 10 conversion buttons per hub render (July backlog alone is 13)", () => {
    const conv = payoutSrc.slice(payoutSrc.indexOf("async function loadConvertibles"));
    expect(conv).toContain("out.slice(0, 10)");
  });
});

// ── Invariants that must survive ─────────────────────────────────────────────

describe("task115 · invariants", () => {
  it("service/equipment docs are still never converted (boss rule, task 114)", () => {
    expect(verifySrc).toContain('vehicle?.type === "equipment" || vehicle?.type === "service"');
  });

  it("the one-tap conversion (payo_conv_) still routes through requestRentalVerification", () => {
    expect(payoutSrc).toContain('source: "payout_hub"');
  });

  it("no real ids / tokens in this task's fixtures (Task 93-b)", () => {
    expect(verifySrc).not.toMatch(/7813830016|356282674|413553377/);
    expect(payoutSrc).not.toMatch(/7813830016|356282674|413553377/);
  });
});
