// Task 129 — «подтвердить все видимые» bulk button in the table view.
//
// Boss: "a «подтвердить все видимые» bulk button when both the operator
// filter and «без сверки» are active — one confirm, N rows. Want it?" → yes.
//
// Layers pinned here:
//   • Gating: the button exists ONLY when BOTH scoping filters are on —
//     effectiveOpFilter (the pill) AND verFilter === "none" («без сверки»),
//     owner-tier + rentals variant + slug (canQuickVerify).
//   • Candidates: exactly the VISIBLE АРЕНДЫ rows with a uuid, excluding
//     just-verified and in-flight ids — the count always matches the screen.
//   • One confirm for N rows (count + operator + honest «незакрытые пропустит»
//     note), then the SAME per-row adminVerifyRentalAction — the server
//     re-gates every call (owner tier + completed + idempotent), so a stale
//     row fails its own count instead of poisoning the batch.
//   • Progress: {total, done} label, per-row spinners ride verifyingIds,
//     ref-run guard (state + ref) with the reopen reset.
//   • Aggregated summary toast (full / partial / zero) + ONE silent refetch
//     for the whole batch.
//   • Review fixes: justVerified pruned once canonical rows land (tints follow
//     the CSV label, not session optimism); disputed-row ✓ discloses that a
//     confirm overrides the dispute.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const src = (p: string) => readFileSync(p, "utf8");

describe("task129 · bulk «подтвердить все видимые»", () => {
  const modal = src("app/franchize/[slug]/rentals-analytics/components/ExportCsvModal.tsx");

  it("progress state + re-run guard exist; both reset when the modal opens", () => {
    expect(modal).toContain(
      "const [bulkVerify, setBulkVerify] = useState<{ total: number; done: number } | null>(null);",
    );
    expect(modal).toContain("const bulkRunRef = useRef(false);");
    // reopen reset — a batch from before the close keeps running server-side,
    // but a fresh open must allow a new batch (not no-op on the stale flag)
    expect(modal).toContain("bulkRunRef.current = false;");
    expect(modal).toContain("setBulkVerify(null);");
  });

  it("gated on BOTH filters: operator pill AND «без сверки» chip", () => {
    expect(modal).toContain(
      'canQuickVerify && !!effectiveOpFilter && verFilter === "none" && !loading && !error',
    );
    // the render gate keeps the button visible while a batch is running
    expect(modal).toContain(
      'canQuickVerify && !!effectiveOpFilter && verFilter === "none" &&\n    (bulkActive || bulkTargetIds.length > 0)',
    );
  });

  it("candidates = visible АРЕНДЫ rows with a uuid, minus optimistic/in-flight ids", () => {
    expect(modal).toContain("(rentSec?.data ?? [])");
    expect(modal).toContain(
      ".filter((id) => id && !justVerified.has(id) && !verifyingIds.has(id))",
    );
  });

  it("ONE confirm names the count + the operator and discloses the skip rule", () => {
    expect(modal).toContain("Подтвердить сверку сразу по ${n} ${dative} оператора «${effectiveOpFilter}»?");
    expect(modal).toContain("Незакрытые аренды сервер пропустит — по ним сверка не заводится.");
  });

  it("the batch reuses the SAME per-row action — server re-gates every call", () => {
    const bulkFn = modal.slice(
      modal.indexOf("const handleBulkVerify = async () => {"),
      modal.indexOf("  useEffect(() => {\n    if (isOpen) {"),
    );
    // task151/152 — the call carries the password-identity params
    expect(bulkFn).toContain("adminVerifyRentalAction({ slug, rentalId, ...verifyActorParams });");
    // sequential loop with per-row bookkeeping
    expect(bulkFn).toContain("for (const rentalId of ids) {");
    expect(bulkFn).toContain("setVerifyingIds((prev) => new Set(prev).add(rentalId));");
    expect(bulkFn).toContain("setJustVerified((prev) => new Set(prev).add(rentalId));");
    // exactly ONE canonical refetch for the whole batch (not per row) —
    // task152: it rides expectVerified for the honest stale-read warning
    expect(bulkFn.match(/loadTable\(/g)?.length).toBe(1);
    expect(bulkFn).toContain(
      "const stuck = await loadTable({ silent: true, expectVerified: new Set(succeededIds) });",
    );
  });

  it("aggregated summary toast: full success / zero / partial with first error", () => {
    const bulkFn = modal.slice(
      modal.indexOf("const handleBulkVerify = async () => {"),
      modal.indexOf("  useEffect(() => {\n    if (isOpen) {"),
    );
    expect(bulkFn).toContain("toast.success(");
    expect(bulkFn).toContain("toast.error(");
    expect(bulkFn).toContain("toast.warning(");
    expect(bulkFn).toContain("firstError = firstError || res.error || null;");
  });

  it("button counts up while running and is disabled during the batch", () => {
    expect(modal).toContain("disabled={bulkActive}");
    expect(modal).toContain("`Подтверждаю ${bulkVerify.done}/${bulkVerify.total}…`");
    expect(modal).toContain("`Подтвердить все видимые (${bulkTargetIds.length})`");
  });

  it("russian plurals for the confirm/toast counts", () => {
    expect(modal).toContain("function pluralRuNoun(");
    expect(modal).toContain('pluralRuNoun(done, "аренда", "аренды", "аренд")');
  });
});

describe("task129 · codereview gap fixes", () => {
  const modal = src("app/franchize/[slug]/rentals-analytics/components/ExportCsvModal.tsx");

  it("session optimism is pruned once canonical rows land (tints follow the CSV)", () => {
    expect(modal).toContain(
      "setJustVerified((prev) => (prev.size > 0 ? new Set<string>() : prev));",
    );
    // …but only on SUCCESS — a silent refetch failure must keep the tint
    const load = modal.slice(modal.indexOf("const loadTable = useCallback"), modal.indexOf("  // Task 128 — quick verify"));
    const tryIdx = load.indexOf("const parsed = parseCsv(text);");
    const pruneIdx = load.indexOf("setJustVerified((prev)");
    const catchIdx = load.indexOf("} catch (e) {");
    expect(tryIdx).toBeGreaterThan(-1);
    expect(pruneIdx).toBeGreaterThan(tryIdx);
    expect(pruneIdx).toBeLessThan(catchIdx);
    // task152 — the just-verified ids ride as expectVerified: a fresh label
    // that is NOT «подтверждено» yet keeps its tint (honest stale-read
    // handling) instead of being pruned into the revert illusion.
    expect(load).toContain("if (verificationToneOf(verLabelForId(parsed, id)) !== \"verified\") stuck.add(id);");
  });

  it("the ✓ on a disputed row discloses that confirming overrides the dispute", () => {
    expect(modal).toContain(
      "verTone === \"disputed\"\n                                  ? \"Подтвердить сверку — снимет статус спора (после личного разбора с оператором)\"",
    );
  });
});
