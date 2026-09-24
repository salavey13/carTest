import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Task 47 — "error boundary when closing active rent".
 *
 * Root cause: all closure actions (confirmVehicleReturn / abortRental /
 * confirmVehiclePickup / …) return an object on EVERY code path, but the
 * transport can still resolve the Server Action promise with `undefined`
 * (network blip, Vercel function timeout mid-flight, stale action id after a
 * redeploy — the same failure OrderPageClient documented at iter14). The
 * client then read `result.success` on undefined → the reported TypeError.
 *
 * Fix contract (one test per guarantee):
 * 1. Lifecycle component: modal flows guard with an explicit `if (!result)`
 *    BEFORE any bare `result.success` read (pairwise order pinned below);
 *    smaller flows read through `?.`; `withAction` catches so a failed
 *    action is no longer a SILENT failure (spinner reset, zero feedback).
 * 2. The rest of the rental-page tree reads replies through `?.` only.
 * 3. The checklist (non-React promise chain) never rejects unhandled.
 *
 * Heuristic note: the comment-strip covers full-line // comments only —
 * trailing comments and string literals stay in the haystack (fine for a
 * source-grep contract).
 */

const repoRoot = resolve(__dirname, "../..");

const read = (rel: string): string =>
  readFileSync(resolve(repoRoot, rel), "utf8");

/** Strips // line comments so prose mentioning `.success` can't false-fire. */
const code = (rel: string): string =>
  read(rel).replace(/^[ \t]*\/\/.*$/gm, "");

describe("Task 47: rental action reply guards", () => {
  it("lifecycle: no bare result.success reads, withAction catches, modal flows detect a lost reply", () => {
    const rel = "app/franchize/components/FranchizeRentalLifecycleActions.tsx";
    const src = code(rel);

    // closure + abort: explicit undefined-reply branch with a check-the-card
    // message + auto refresh (the rental may already be completed server-side)
    const guards = [...src.matchAll(/if \(!result\) \{/g)].map((m) => m.index!);
    expect(guards.length).toBeGreaterThanOrEqual(2);
    expect(src).toContain("SERVER_REPLY_LOST");
    // each lost-reply branch must refresh the card itself (a bare global
    // refresh-count is trivially satisfied by the success paths)
    const lostWithRefresh = [
      ...src.matchAll(/if \(!result\) \{[\s\S]{0,260}?router\.refresh\(\);/g),
    ].length;
    expect(lostWithRefresh).toBeGreaterThanOrEqual(2);

    // bare `result.success` reads are allowed ONLY in the two modal flows,
    // each preceded by its own undefined-guard: pairwise order guard < read
    // (matchAll yields ascending indices). Migrating a flow to the strictly
    // safer `result?.success` may shrink bareReads — still fine: every
    // remaining bare read must keep a guard ahead of it.
    const bareReads = [...src.matchAll(/if \(!result\.success\)/g)].map(
      (m) => m.index!,
    );
    expect(guards.length).toBeGreaterThanOrEqual(bareReads.length);
    for (let i = 0; i < bareReads.length; i++) {
      expect(guards[i]).toBeLessThan(bareReads[i]);
    }
    expect(src).toContain("if (!result?.success)");
    expect(src).toContain("if (!result?.success || !result.deepLink)");

    // withAction catches — a failed action must give the operator feedback
    // instead of failing silently (reportError/console only)
    expect(src).toContain("catch (err) {");
    expect(src).toContain(
      "console.error(`[FranchizeRentalLifecycleActions] ${name} failed:`",
    );
  });

  it("rental-page panels and modals: replies are read through ?.", () => {
    const guarded = (rel: string, needle = "result?.success"): void => {
      expect(code(rel)).toContain(needle);
    };
    guarded(
      "app/franchize/components/RentalExtendModal.tsx",
      "if (!result?.success)",
    );
    guarded("app/franchize/components/RentalMessageInput.tsx");
    guarded("app/franchize/components/FranchizeRentalDocumentsPanel.tsx");
    guarded("app/franchize/components/RenterActionsPanel.tsx");
    guarded("app/franchize/components/RentalSetPhoneModal.tsx");
    // and none of them kept a bare read
    for (const rel of [
      "app/franchize/components/RentalExtendModal.tsx",
      "app/franchize/components/RentalMessageInput.tsx",
      "app/franchize/components/FranchizeRentalDocumentsPanel.tsx",
      "app/franchize/components/RenterActionsPanel.tsx",
      "app/franchize/components/RentalSetPhoneModal.tsx",
    ]) {
      const src = code(rel);
      expect(src).not.toContain("result.success");
      expect(src).not.toContain("result.error");
    }
  });

  it("return checklist: promise chain is guarded and never rejects unhandled", () => {
    const src = code("app/franchize/components/RentalReturnChecklist.tsx");
    expect(src).toContain("result?.success && result.data");
    expect(src).toContain(".catch((err) => {");
  });
});
