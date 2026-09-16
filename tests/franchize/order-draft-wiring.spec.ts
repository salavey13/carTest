// tests/franchize/order-draft-wiring.spec.ts
// iter36: source-level wiring assertions for the order-page draft.
// OrderPageClient drags the whole server-action graph into any mount attempt,
// so (per repo convention, see iter17-suite) the wiring is asserted on the
// component SOURCE, while the draft lib itself is covered by
// tests/franchize/order-draft.spec.ts.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..");

const read = (rel: string) => readFileSync(join(repoRoot, rel), "utf8");

describe("order draft wiring (OrderPageClient)", () => {
  const src = read("app/franchize/components/OrderPageClient.tsx");

  it("restore effect runs BEFORE the server prefill effects (declaration order)", () => {
    const restoreIdx = src.indexOf("RESTORE the locally saved draft");
    const prefillIdx = src.indexOf("const loadPrefill = async () => {");
    const secretsIdx = src.indexOf("const loadRentalSecrets = async () => {");
    expect(restoreIdx).toBeGreaterThan(-1);
    expect(prefillIdx).toBeGreaterThan(restoreIdx);
    expect(secretsIdx).toBeGreaterThan(restoreIdx);
  });

  it("a restored draft makes the prefill chain back off (draft wins)", () => {
    const prefillBody = src.slice(src.indexOf("const loadPrefill"), src.indexOf("const loadRentalSecrets"));
    const secretsBody = src.slice(src.indexOf("const loadRentalSecrets"), src.indexOf("PHONE-based returning-renter prefill"));
    expect((prefillBody.match(/draftRestoredRef\.current/g) ?? []).length).toBeGreaterThan(0);
    expect((secretsBody.match(/draftRestoredRef\.current/g) ?? []).length).toBeGreaterThan(0);
  });

  it("persists via debounced watch subscription + pagehide flush", () => {
    expect(src.includes("watch((values) => {")).toBe(true);
    expect(src.includes("setTimeout(flushDraft, 400)")).toBe(true);
    expect(src.includes('window.addEventListener("pagehide", handlePageHide)')).toBe(true);
  });

  it("clears the draft after successful checkout and on explicit reset", () => {
    expect(src.includes("clearOrderDraft(window.localStorage, slug);")).toBe(true);
    expect(src.includes("// iter36: the order is in — the draft has served its purpose.")).toBe(true);
    expect(src.includes("const clearAllPrefillFields")).toBe(true);
    expect(src.includes("setDraftRestored(false)")).toBe(true);
  });

  it("no render-time todayISO() left on the date input (hydration fix)", () => {
    // the only allowed occurrence is the documentation comment describing
    // the old bug; a JSX attribute at line start must be gone
    expect((src.match(/^\s*min=\{todayISO\(\)\}/gm) ?? [])).toHaveLength(0);
    expect(src.includes("min={minVisitDate || undefined}")).toBe(true);
  });

  it("reservationHold + promoBanners are accessed defensively", () => {
    expect(src.includes("crew.reservationHold?.amountRub")).toBe(true);
    expect(src.includes("crew.catalog.promoBanners?.length")).toBe(true);
    expect(src.includes("crew.reservationHold.amountRub")).toBe(false);
  });

  it("order page wraps OrderPageClient in FranchizeErrorBoundary", () => {
    const pageSrc = read("app/franchize/[slug]/order/[id]/page.tsx");
    expect(pageSrc.includes("<FranchizeErrorBoundary")).toBe(true);
    expect((pageSrc.match(/<OrderPageClient/g) ?? []).length).toBe(1);
  });

  it("segment error screen offers in-place reset", () => {
    const errSrc = read("app/franchize/error.tsx");
    expect(errSrc.includes("reset: () => void")).toBe(true);
    expect(errSrc.includes("Попробовать ещё раз")).toBe(true);
  });
});
