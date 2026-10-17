// tests/franchize/task102-verify-hardening.spec.ts
//
// Task 102 — code-review hardening of the rental verification feature.
// The optimistic-lock retry (lib/rental-verify.ts) relies on ONE pure
// invariant: re-applying the SAME party's action against the FRESH row (the
// re-read after losing the write race) converges to «verified» instead of
// clobbering the parallel writer. These tests pin that invariant.
import { describe, expect, it } from "vitest";
import {
  applyVerificationAction,
  verificationKeyboard,
  type RentalVerificationRow,
} from "@/app/franchize/lib/rental-verify-core";

const BASE_ROW: RentalVerificationRow = {
  rental_id: "bd948bd0-e9db-44ef-8955-97933cee066f",
  crew_id: "2d5fde70-1dd3-4f0d-8d72-66ccf6908746",
  crew_slug: "vip-bike",
  operator_chat_id: "7813830016",
  owner_chat_id: "413553377",
  requested_by: "7813830016",
  requested_at: "2026-10-17T12:00:00.000Z",
  status: "pending",
  operator_confirmed_at: null,
  owner_confirmed_at: null,
  verified_at: null,
  disputed_by: null,
  dispute_reason: null,
  snapshot: {},
  source: "return_page",
};

const NOW = "2026-10-17T12:05:00.000Z";

describe("task102: both-tap race converges to verified", () => {
  it("operator wins the race; owner's STALE write is rejected and re-applied against the fresh row → verified", () => {
    // ── Interleaving as it happened in the bug: both read status=pending ──
    // Operator's callback lands first:
    const opRead = applyVerificationAction(BASE_ROW, { action: "confirm", chatId: "7813830016", nowIso: NOW });
    expect(opRead.effect).toBe("wait_other_party");
    expect(opRead.row?.status).toBe("operator_confirmed");

    // Owner's callback — STALE read (still pending), computes its own branch:
    const ownerStale = applyVerificationAction(BASE_ROW, { action: "confirm", chatId: "413553377", nowIso: NOW });
    expect(ownerStale.effect).toBe("wait_other_party");
    expect(ownerStale.row?.status).toBe("owner_confirmed");
    // BUG (pre-fix): owner's blind write would clobber operator_confirmed.

    // FIX semantics: owner's conditional write fails (status guard), the row
    // is re-read (now operator_confirmed) and the action re-applied:
    const freshRow: RentalVerificationRow = {
      ...BASE_ROW,
      status: "operator_confirmed",
      operator_confirmed_at: NOW,
    };
    const ownerRetry = applyVerificationAction(freshRow, { action: "confirm", chatId: "413553377", nowIso: NOW });
    expect(ownerRetry.effect).toBe("verified");
    expect(ownerRetry.row?.status).toBe("verified");
    expect(ownerRetry.row?.operator_confirmed_at).toBe(NOW);
    expect(ownerRetry.row?.owner_confirmed_at).toBe(NOW);
    expect(ownerRetry.row?.verified_at).toBe(NOW);
  });

  it("re-applying an already-recorded confirm is idempotent (timestamps keep the FIRST hand)", () => {
    const once = applyVerificationAction(BASE_ROW, { action: "confirm", chatId: "7813830016", nowIso: NOW });
    const twice = applyVerificationAction(once.row!, { action: "confirm", chatId: "7813830016", nowIso: "2026-10-17T12:09:00.000Z" });
    expect(twice.effect).toBe("wait_other_party");
    expect(twice.row?.operator_confirmed_at).toBe(NOW); // NOT the later stamp
  });

  it("dispute wins at any pre-verified state, from either party", () => {
    for (const chatId of ["7813830016", "413553377"]) {
      const d = applyVerificationAction(BASE_ROW, { action: "dispute", chatId, nowIso: NOW, reason: "цифры расходятся" });
      expect(d.effect).toBe("disputed");
      expect(d.row?.status).toBe("disputed");
      expect(d.row?.disputed_by).toBe(chatId);
      expect(d.row?.dispute_reason).toBe("цифры расходятся");
    }
  });

  it("foreign chat ids are refused (money-safety gate intact)", () => {
    const r = applyVerificationAction(BASE_ROW, { action: "confirm", chatId: "999999999", nowIso: NOW });
    expect(r.row).toBeNull();
    expect(r.effect).toBe("noop");
    expect(r.error).toContain("не участник");
  });

  it("verified is terminal — a late third tap cannot mutate the row", () => {
    const verified: RentalVerificationRow = {
      ...BASE_ROW,
      status: "verified",
      operator_confirmed_at: NOW,
      owner_confirmed_at: NOW,
      verified_at: NOW,
    };
    for (const action of ["confirm", "dispute"] as const) {
      for (const chatId of ["7813830016", "413553377"]) {
        const r = applyVerificationAction(verified, { action, chatId, nowIso: "2026-10-17T13:00:00.000Z" });
        expect(r.row).toBeNull();
        expect(r.effect).toBe("noop");
      }
    }
  });

  it("single-party rental (no operator) — owner alone verifies immediately", () => {
    const solo: RentalVerificationRow = { ...BASE_ROW, operator_chat_id: null };
    const r = applyVerificationAction(solo, { action: "confirm", chatId: "413553377", nowIso: NOW });
    expect(r.effect).toBe("verified");
  });
});

describe("task102: callback payload stays within Telegram limits", () => {
  it("vrf_ callback_data ≤ 64 bytes for a uuid rental id", () => {
    const kb = verificationKeyboard("bd948bd0-e9db-44ef-8955-97933cee066f");
    for (const row of kb) {
      for (const btn of row) {
        expect(Buffer.byteLength(btn.callback_data, "utf8")).toBeLessThanOrEqual(64);
      }
    }
    expect(kb[0][0].callback_data).toBe("vrf_ok_bd948bd0-e9db-44ef-8955-97933cee066f");
    expect(kb[0][1].callback_data).toBe("vrf_dis_bd948bd0-e9db-44ef-8955-97933cee066f");
  });
});
