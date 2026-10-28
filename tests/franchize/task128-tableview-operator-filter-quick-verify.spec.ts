// Task 128 — table view modal, round two:
//   1. Tap a split pill → the table filters to that operator's rows
//      (АРЕНДЫ + ПРОДАЖИ, the blocks that both pay and attribute ЗП). The
//      split itself reads the PRE-op-filter sections so the pills stay
//      tappable — you can hop between operators without unfiltering.
//   2. Quick verify right in the table: owner-tier viewers get an inline ✓
//      on every unverified АРЕНДЫ row — confirm → adminVerifyRentalAction
//      (the same owner-gated action as the rental-page card) → optimistic
//      «подтверждено» tint + silent CSV refetch for the canonical label.
//   3. Server hardening: adminVerifyRentalAction refuses non-completed
//      rentals — the CSV АРЕНДЫ block carries in-progress rows too, and a
//      сверка on those would be fiction (mirrors the resend action's gate).
//
// Layers pinned here:
//   • Filter wiring: opFilter state → effectiveOpFilter guard (stale labels)
//     → applyOpFilter in the section pipeline → pills as toggle buttons.
//   • Split stability: opSplit/opGrandTotal computed over preOpSections.
//   • Quick verify: canVerify threading V2 → AnalyticsClient → modal →
//     SectionTable; confirm + action + optimistic justVerified + silent
//     refetch; ✓ hidden on verified rows; stopPropagation vs tap-through.
//   • Server gate: status === "completed" (both verify actions).

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const src = (p: string) => readFileSync(p, "utf8");

describe("task128 · operator filter (tap a pill → filter rows)", () => {
  const modal = src("app/franchize/[slug]/rentals-analytics/components/ExportCsvModal.tsx");

  it("opFilter state exists and resets when the modal opens", () => {
    expect(modal).toContain("const [opFilter, setOpFilter] = useState<string | null>(null);");
    expect(modal).toContain("setOpFilter(null);");
  });

  it("stale labels are guarded — a date-range change can't blank the table", () => {
    expect(modal).toContain(
      "opFilter && opSplit.some((o) => o.label === opFilter) ? opFilter : null",
    );
  });

  it("the filter composes AFTER text search + ver filter, matching the op attribution cell", () => {
    expect(modal).toContain(
      'const preOpSections = isSectioned\n    ? parsedSections.sections.map(applyFilter).map(applyVerFilter)\n    : [];',
    );
    expect(modal).toContain(
      'const visibleSections = preOpSections.map(applyOpFilter).filter((s) => s.data.length > 0);',
    );
    // task129 review fix: opCol hoisted to a local const — property narrowing
    // doesn't survive into the filter closure (the bare r[cfg.opCol] was TS2538)
    expect(modal).toContain(
      'data: s.data.filter((r) => (r[opIdx] || "").trim() === effectiveOpFilter),',
    );
  });

  it("only paying+attributed blocks are filtered (ЭКИП/СЕРВИС/СВОДКА pass through)", () => {
    expect(modal).toMatch(
      /const applyOpFilter = \(s: ParsedCsvSection\): ParsedCsvSection => \{[\s\S]*?if \(opIdx == null \|\| s\.key === "summary"\) return s;/,
    );
  });

  it("filtered blocks hide their «Итого» (sums would contradict the СВОДКА block)", () => {
    const applyOp = modal.slice(modal.indexOf("const applyOpFilter"), modal.indexOf("const visibleSections"));
    expect(applyOp).toContain("totals: null,");
  });

  it("the split reads PRE-op-filter sections — pills stay tappable while filtered", () => {
    expect(modal).toContain("for (const s of preOpSections) {");
    expect(modal).toContain("return buildOperatorSplit(entries, opGrandTotal);");
    // grand total also pre-op (rentPre/salesPre), NOT the visible-section sums
    expect(modal).toContain("const opGrandTotal = sumCell(rentPre, 1) + sumCell(salesPre, 1);");
    expect(modal).not.toContain("buildOperatorSplit(entries, sumRentSalary + sumSalesSalary)");
  });

  it("pills are real toggle buttons (aria-pressed, re-tap resets)", () => {
    expect(modal).toContain('onClick={() => setOpFilter((cur) => (cur === op.label ? null : op.label))}');
    expect(modal).toContain("aria-pressed={opActive}");
  });

  it("an explicit «показать всех» reset chip renders while a filter is on", () => {
    expect(modal).toContain("{effectiveOpFilter && (");
    expect(modal).toContain("✕ показать всех");
    expect(modal).toContain('title="Показать строки всех операторов"');
  });

  it("the active pill gets a firm ring (visible on both themes)", () => {
    expect(modal).toContain("backgroundColor: `color-mix(in srgb, ${op.color} ${opActive ? 26 : 14}%, ${T.bgCard})`");
    expect(modal).toContain("boxShadow: opActive ? `0 0 0 1.5px color-mix(in srgb, ${op.color} 55%, transparent)` : undefined,");
  });
});

describe("task128 · quick verify right in the table view", () => {
  const modal = src("app/franchize/[slug]/rentals-analytics/components/ExportCsvModal.tsx");
  const client = src("app/franchize/[slug]/rentals-analytics/components/AnalyticsClient.tsx");
  const v2 = src("app/franchize/[slug]/rentals-analytics/AnalyticsClientV2.tsx");

  it("canVerify threads owner-tier flag V2 → AnalyticsClient → modal", () => {
    expect(v2).toContain("viewerIsOwnerTier={viewerIsOwnerTier}");
    expect(client).toContain("canVerify={viewerIsOwnerTier}");
    expect(modal).toContain("canVerify?: boolean;");
    expect(modal).toContain("canVerify = false,");
  });

  it("the ✓ renders only for owner-tier + rentals variant + a slug to act through", () => {
    expect(modal).toContain(
      'const canQuickVerify = canVerify && variant === "rentals" && !!slug;',
    );
    expect(modal).toContain("onQuickVerify={canQuickVerify ? handleQuickVerify : undefined}");
  });

  it("uses the SAME owner-gated action + confirm pattern as the rental-page card", () => {
    // task152 — the modal now imports the verify action AND the resend action
    // (the per-row «выслать сверку» button) from the same owner-gated module.
    // task157 re-baseline — the roster + reassign actions joined the import
    // block (the «Оператор (ЗП)» dropdown), so the closing brace moved.
    expect(modal).toContain(
      "adminVerifyRentalAction,\n  getSalaryOperatorsAction,\n  reassignRentalOperatorAction,\n  resendVerificationDmsAction,\n  type SalaryOperatorOption,\n} from \"@/app/franchize/server-actions/rental-verify-actions\";",
    );
    expect(modal).toContain("adminVerifyRentalAction({ slug, rentalId, ...verifyActorParams });");
    expect(modal).toContain("window.confirm(");
    expect(modal).toContain("Подтвердить сверку по этой аренде?");
  });

  it("success = optimistic verified tint + silent CSV refetch (no loading flash)", () => {
    expect(modal).toContain("setJustVerified((prev) => new Set(prev).add(rentalId));");
    // task152 — the silent refetch now rides expectVerified: when the fresh
    // CSV does not reflect the just-verified id yet, the tint is KEPT and an
    // honest warning fires (no more silent revert illusion).
    // task157 re-baseline: loadTable returns { stuckVer, operatorStuck } —
    // the composite carries the operator-reassignment expectation too.
    expect(modal).toContain(
      "const result = await loadTable({ silent: true, expectVerified: new Set([rentalId]) });",
    );
    expect(modal).toContain("if (result?.stuckVer?.has(rentalId)) {");
    expect(modal).toContain("const silent = opts?.silent === true;");
    // silent mode skips the loading state entirely
    expect(modal).toMatch(/if \(!silent\) \{\s*setLoading\(true\);\s*setError\(null\);\s*\}/);
    // a silent failure keeps the old rows (the verify itself DID succeed)
    expect(modal).toContain('console.warn("[ExportCsvModal] silent refetch failed:", detail);');
  });

  it("the ✓ shows only on unverified rows with a uuid, spins while in-flight", () => {
    // task152 — the ✓ ALSO stays visible (disabled) on a row verified THIS
    // session, so the button never vanishes under the finger mid-batch.
    expect(modal).toContain('(verTone !== "verified" || verifiedThisSession);');
    expect(modal).toContain("disabled={verifyPending || verifiedThisSession}");
    expect(modal).toContain('<Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />');
    expect(modal).toContain('<Check className="h-3.5 w-3.5" aria-hidden />');
  });

  it("optimistic tone: a just-verified row renders verified before the refetch lands", () => {
    expect(modal).toContain(
      'forceVerified\n                  ? ("verified" as const)\n                  : verificationToneOf(r[cfg.verification] || "")',
    );
    expect(modal).toContain('{cell || (forceVerified ? "подтверждено" : "\\u00A0")}');
  });

  it("the ✓ stops propagation — no accidental tap-through to the rental page", () => {
    expect(modal).toContain("e.stopPropagation();");
  });

  it("SectionTable carries the verify bookkeeping props", () => {
    expect(modal).toContain("verifyingIds?: Set<string>;");
    expect(modal).toContain("justVerified?: Set<string>;");
    // task152 — row context for the confirm dialogs + the send-request props.
    expect(modal).toContain("onQuickVerify?: (rentalId: string, ctx?: QuickRowCtx) => Promise<void> | void;");
    expect(modal).toContain("sendingIds?: Set<string>;");
    expect(modal).toContain("onSendRequest?: (rentalId: string, ctx?: QuickRowCtx) => Promise<void> | void;");
  });

  it("verify state resets when the modal opens", () => {
    expect(modal).toContain("setVerifyingIds(new Set());");
    expect(modal).toContain("setJustVerified(new Set());");
  });
});

describe("task128 · server-side hardening of adminVerifyRentalAction", () => {
  const actions = src("app/franchize/server-actions/rental-verify-actions.ts");

  it("admin manual verify refuses non-completed rentals (same gate as resend)", () => {
    // both actions now gate on completed — the admin one is the task128 addition
    expect(actions).toContain(
      "Сверка заводится только по закрытым арендам (текущий статус: ",
    );
    expect(actions).toContain("Сверка отправляется по закрытым арендам.");
    expect(actions.match(/rental\.status !== "completed"/g)?.length).toBe(2);
  });

  it("the gate sits before any verification row is loaded or mutated", () => {
    const adminFn = actions.slice(
      actions.indexOf("export async function adminVerifyRentalAction"),
      actions.indexOf("export interface ResendDmsResult"),
    );
    const gateIdx = adminFn.indexOf('rental.status !== "completed"');
    const rowLoadIdx = adminFn.indexOf("loadOrCreateVerificationRow(");
    expect(gateIdx).toBeGreaterThan(-1);
    expect(rowLoadIdx).toBeGreaterThan(gateIdx);
  });
});
