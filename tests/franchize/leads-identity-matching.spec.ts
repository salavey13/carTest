/**
 * tests/franchize/leads-identity-matching.spec.ts
 *
 * Regression tests for the 2026-09-02 identity-matching fix (chat_id pollution):
 *
 * BUG: operator-created todos/leads carried the OPERATOR's chat_id in
 * user_id/lead_id (the /doc bot writes telegram_user_id = operator), so
 * history/todos/notes loaded by that chat_id grabbed a bogus bunch of
 * unrelated leads' data. The fix:
 *   1. Leads are NEVER keyed by a crew operator's chat_id (phone → ФИО →
 *      synthetic key instead) — pipeline-stages.ts classifies those keys.
 *   2. Todo matching is MULTI-CANDIDATE: an operator-created todo carries
 *      user_id = operator AND phone = RENTER — the phone candidate must
 *      match the renter's phone-keyed lead (the old first-match-wins chain
 *      returned the operator id and the todo vanished).
 *   3. Phone-shaped 11-digit user_ids ("89960430155") normalize to E.164.
 */

import { describe, expect, it } from "vitest";
import {
  matchTodosToLead,
  computeAssignee,
  getFlowType,
  getVerificationStatus,
} from "@/app/franchize/[slug]/leads/lib/pipeline-stages";
import type { LeadRow, LeadTodoRow } from "@/app/franchize/[slug]/leads/leads-types";

const OPERATOR = "413553377";

function buildLead(overrides: Partial<LeadRow> = {}): LeadRow {
  return {
    user_id: "+79991234567",
    full_name: "Иван Иванов",
    username: null,
    phone: "+79991234567",
    source: "rent",
    bikeTitle: null,
    createdAt: "2026-09-01T10:00:00Z",
    lastSeenAt: "2026-09-01T10:00:00Z",
    verified: false,
    rentals: [],
    sales: [],
    ...overrides,
  };
}

function buildTodo(overrides: Partial<LeadTodoRow> = {}): LeadTodoRow {
  return {
    id: "todo-1",
    lead_id: null,
    user_id: null,
    phone: null,
    rental_id: null,
    title: "🔑 Принять ключи",
    description: null,
    status: "pending",
    priority: "medium",
    category: "lead_followup",
    created_at: "2026-09-01T10:05:00Z",
    completed_at: null,
    assigned_to: null,
    due_date: null,
    ...overrides,
  };
}

describe("Leads identity matching — multi-candidate todo matching", () => {
  it("matches an operator-created todo (user_id=operator, phone=renter) to the renter's phone-keyed lead", () => {
    // The exact /doc-manual write shape: user_id = operator's chat_id,
    // lead_id = operator's chat_id, phone = the RENTER's phone.
    const lead = buildLead(); // keyed by phone +79991234567
    const todo = buildTodo({ user_id: OPERATOR, lead_id: OPERATOR, phone: "+79991234567" });
    expect(matchTodosToLead(lead, [todo])).toHaveLength(1);
  });

  it("does NOT match an operator-keyed todo to an unrelated lead (no shared phone/rental)", () => {
    const lead = buildLead({ user_id: "+79001112233", phone: "+79001112233" });
    const todo = buildTodo({ user_id: OPERATOR, lead_id: OPERATOR, phone: "+79991234567" });
    expect(matchTodosToLead(lead, [todo])).toHaveLength(0);
  });

  it("still matches a claimed lead's todo keyed by the renter's real TG id", () => {
    // Legit case: renter came from the web app himself → his TG id is a valid key.
    const lead = buildLead({ user_id: "111222333", phone: null, telegramChatId: "111222333" });
    const todo = buildTodo({ user_id: "111222333" });
    expect(matchTodosToLead(lead, [todo])).toHaveLength(1);
  });

  it("matches phone-shaped 11-digit user_id todos (legacy bot rows) via E.164 normalization", () => {
    // Old bot flows stored "89960430155" in user_id — that's a PHONE.
    const lead = buildLead({ user_id: "+79960430155", phone: "+79960430155" });
    const todo = buildTodo({ user_id: "89960430155" });
    expect(matchTodosToLead(lead, [todo])).toHaveLength(1);
  });

  it("matches todos with un-normalized phone (8 999 …) against E.164 lead keys", () => {
    const lead = buildLead(); // +79991234567
    const todo = buildTodo({ phone: "89991234567" });
    expect(matchTodosToLead(lead, [todo])).toHaveLength(1);
  });

  it("matches by rental_id even when identity candidates don't match", () => {
    const lead = buildLead({
      user_id: "+79001112233",
      phone: "+79001112233",
      rentals: [{
        rentalId: "rental-abc", status: "confirmed", paymentStatus: "interest_paid",
        startDate: null, endDate: null, bikeTitle: null, totalCost: 0,
      }],
    });
    const todo = buildTodo({ rental_id: "rental-abc", user_id: OPERATOR, lead_id: OPERATOR, phone: null });
    expect(matchTodosToLead(lead, [todo])).toHaveLength(1);
  });

  it("assigns the operator (originalOperatorChatId) when a matched todo has no assignee", () => {
    const lead = buildLead({ originalOperatorChatId: OPERATOR });
    const todo = buildTodo({ user_id: OPERATOR, phone: "+79991234567" });
    expect(computeAssignee(lead, [todo])).toBe(OPERATOR);
  });
});

describe("Leads identity matching — operator-origin lead classification", () => {
  const rental = {
    rentalId: "rental-1", status: "pending_confirmation", paymentStatus: "interest_paid",
    startDate: null, endDate: null, bikeTitle: "BMW F800R", totalCost: 20000,
  };

  it("classifies synthetic opdoc/oprental/opsale/opsecret keys as doc-flow (operator origin)", () => {
    for (const key of ["opdoc:abc", "oprental:xyz", "opsale:1", "optestdrive:2", "opsecret:doc-key"]) {
      const lead = buildLead({ user_id: key, rentals: [rental] });
      expect(getFlowType(lead)).toBe("doc");
    }
  });

  it("treats a doc-flow lead (operator origin) with a pending rental as verified (RULE 2)", () => {
    const lead = buildLead({ user_id: "+79991234567", originalOperatorChatId: OPERATOR, rentals: [rental] });
    expect(getFlowType(lead)).toBe("doc");
    expect(getVerificationStatus(lead)).toBe("verified");
  });

  it("webapp-flow lead without photos is unverified (RULE 3)", () => {
    const lead = buildLead({ user_id: "111222333", rentals: [rental] });
    expect(getFlowType(lead)).toBe("webapp");
    expect(getVerificationStatus(lead)).toBe("unverified");
  });
});
