// Task 106 — the verification NEGOTIATION («дил»): dispute → live split
// editor → proposal → accept/counter/decline → verified with corrected
// numbers. Pure-half matrix (callback grammar, split math, reducers,
// keyboards, formatters) + source-level pins for the wiring (routing,
// degradation, agreed-split override, catalog).
//
// Money-safety invariants pinned here:
//   • every callback parses back to exactly one action, ≤ 64 bytes;
//   • amounts clamp ≥ 0 — a correction can zero a part but never go negative;
//   • an open proposal can only be answered by the OTHER party;
//   • accepting runs through the SAME applyVerificationAction state machine.

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  acceptOpenProposal,
  applySplitDelta,
  adjustPartKeyboard,
  declineOpenProposal,
  disputeEditorKeyboard,
  encodeAdjustCallback,
  encodePartCallback,
  encodeProposalCallback,
  escapeVerifyHtml,
  formatDealDoneText,
  formatDisputeEditor,
  formatProposalMessage,
  otherPartyChatId,
  parseNegotiation,
  parseProposalCallback,
  partyRole,
  proposalResponseKeyboard,
  resetSplitPart,
  sendProposalFromDraft,
  setDraftComment,
  setDraftSplit,
  snapshotSplitOf,
  splitChanges,
  splitTotal,
  splitsEqual,
  startDraft,
  SPLIT_PART_ORDER,
  type NegotiationState,
  type SplitParts,
} from "@/app/franchize/lib/rental-verify-core";

const repo = (...p: string[]) => path.resolve(process.cwd(), ...p);
const src = (p: string) => readFileSync(repo(p), "utf8");

const UUID = "bd948bd0-e9db-44ef-8955-97933cee066f";
const original: SplitParts = { base: 500, equipment: 250, overprice: 150 };
const row2p = {
  operator_chat_id: "7813830016",
  owner_chat_id: "356282674",
};

// ── Callback grammar ────────────────────────────────────────────────────────

describe("task106 · vrfp_ callback grammar", () => {
  it("round-trips every simple action and stays ≤ 64 bytes with a full uuid", () => {
    const kinds = ["view", "comment", "send", "confirm", "accept", "decline", "counter"] as const;
    for (const kind of kinds) {
      const data = encodeProposalCallback(kind, UUID);
      expect(data.length).toBeLessThanOrEqual(64);
      expect(data.startsWith("vrfp_")).toBe(true);
      const parsed = parseProposalCallback(data);
      expect(parsed).not.toBeNull();
      expect(parsed!.rentalId).toBe(UUID);
      const expectAction: Record<(typeof kinds)[number], string> = {
        view: "view", comment: "comment", send: "send", confirm: "confirm",
        accept: "accept", decline: "decline", counter: "counter",
      };
      expect(parsed!.action).toBe(expectAction[kind]);
    }
  });

  it("round-trips part + adjust callbacks (the stepper buttons)", () => {
    for (const part of ["base", "equipment", "overprice"] as const) {
      const partData = encodePartCallback(part, UUID);
      expect(partData.length).toBeLessThanOrEqual(64);
      const parsedPart = parseProposalCallback(partData);
      expect(parsedPart).toMatchObject({ action: "part", part, rentalId: UUID });

      for (const op of ["d1", "d2", "i1", "i2", "z"] as const) {
        const adjData = encodeAdjustCallback(part, op, UUID);
        expect(adjData.length).toBeLessThanOrEqual(64);
        const parsed = parseProposalCallback(adjData);
        expect(parsed).not.toBeNull();
        expect(parsed!.action).toBe("adjust");
        expect(parsed!.part).toBe(part);
        expect(parsed!.rentalId).toBe(UUID);
        const expectedDelta = { d1: -100, d2: -500, i1: 500, i2: 100, z: 0 }[op];
        expect(parsed!.delta).toBe(expectedDelta);
      }
    }
  });

  it("disambiguates «cm» (comment) from «c» (counter) — both start with c", () => {
    expect(parseProposalCallback(`vrfp_cm_${UUID}`)?.action).toBe("comment");
    expect(parseProposalCallback(`vrfp_c_${UUID}`)?.action).toBe("counter");
  });

  it("returns null for foreign data and malformed heads (router falls through)", () => {
    expect(parseProposalCallback("vrf_ok_x")).toBeNull();
    expect(parseProposalCallback("vrfp_")).toBeNull();
    expect(parseProposalCallback(`vrfp_v_`)).toBeNull(); // no rental id
    expect(parseProposalCallback(`vrfp_pq_${UUID}`)).toBeNull(); // unknown part
    expect(parseProposalCallback(`vrfp_ab9_${UUID}`)).toBeNull(); // unknown delta op
    expect(parseProposalCallback("")).toBeNull();
  });
});

// ── Split math ──────────────────────────────────────────────────────────────

describe("task106 · split math", () => {
  it("clamps adjustments at zero — a part can be zeroed but never negative", () => {
    expect(applySplitDelta({ base: 500, equipment: 250, overprice: 150 }, "base", -100)).toMatchObject({ base: 400 });
    expect(applySplitDelta({ base: 30, equipment: 250, overprice: 150 }, "base", -100).base).toBe(0);
    expect(applySplitDelta({ base: 0, equipment: 250, overprice: 150 }, "base", -50).base).toBe(0);
  });

  it("reset returns exactly the frozen value for that part only", () => {
    const edited = applySplitDelta(original, "equipment", 100);
    const reset = resetSplitPart(edited, "equipment", original);
    expect(splitsEqual(reset, original)).toBe(true);
    const partially = resetSplitPart(edited, "base", original);
    expect(partially.equipment).toBe(350);
    expect(partially.base).toBe(500);
  });

  it("splitChanges reports exactly the edited parts", () => {
    expect(splitChanges(original, original)).toEqual([]);
    const edited = { ...original, equipment: 350 };
    expect(splitChanges(edited, original)).toEqual(["equipment"]);
    expect(splitChanges({ base: 0, equipment: 0, overprice: 0 }, original)).toEqual(["base", "equipment", "overprice"]);
  });

  it("totals sum all three parts", () => {
    expect(splitTotal(original)).toBe(900);
    expect(splitTotal({ base: 0, equipment: 0, overprice: 0 })).toBe(0);
  });

  it("snapshotSplitOf survives garbage snapshots (null / strings / negatives)", () => {
    expect(snapshotSplitOf(null)).toEqual({ base: 0, equipment: 0, overprice: 0 });
    expect(snapshotSplitOf({ base: "700" as unknown as number, equipment: -5, overprice: undefined as unknown as number }))
      .toEqual({ base: 700, equipment: 0, overprice: 0 });
  });
});

// ── Reducers ────────────────────────────────────────────────────────────────

describe("task106 · negotiation reducers", () => {
  it("partyRole / otherPartyChatId resolve the two-sided row", () => {
    expect(partyRole(row2p, "7813830016")).toBe("operator");
    expect(partyRole(row2p, "356282674")).toBe("owner");
    expect(partyRole(row2p, "42")).toBeNull();
    expect(otherPartyChatId(row2p, "7813830016")).toBe("356282674");
    expect(otherPartyChatId(row2p, "356282674")).toBe("7813830016");
    expect(otherPartyChatId(row2p, "42")).toBeNull();
    // single-party row: owner === operator → no other party
    expect(otherPartyChatId({ operator_chat_id: "1", owner_chat_id: "1" }, "1")).toBeNull();
    expect(otherPartyChatId({ operator_chat_id: null, owner_chat_id: "1" }, "1")).toBeNull();
  });

  it("sendProposalFromDraft refuses a no-change no-comment draft", () => {
    const nego = startDraft(parseNegotiation({}), "7813830016", "operator", original);
    const res = sendProposalFromDraft(nego, { chatId: "7813830016", role: "operator", nowIso: "t0", original });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/Изменений нет/);
  });

  it("sendProposalFromDraft requires the actor's OWN draft", () => {
    const nego = startDraft(parseNegotiation({}), "7813830016", "operator", original);
    const res = sendProposalFromDraft(nego, { chatId: "356282674", role: "owner", nowIso: "t0", original });
    expect(res.ok).toBe(false);
  });

  it("a proposal with changes lands as open + round, draft cleared", () => {
    let nego = startDraft(parseNegotiation({}), "7813830016", "operator", original);
    nego = setDraftSplit(nego, applySplitDelta(original, "equipment", 100));
    nego = setDraftComment(nego, "два шлема");
    const res = sendProposalFromDraft(nego, { chatId: "7813830016", role: "operator", nowIso: "t0", original });
    expect(res.ok).toBe(true);
    expect(res.state.open).toMatchObject({ by: "7813830016", role: "operator", split: { base: 500, equipment: 350, overprice: 150 }, comment: "два шлема" });
    expect(res.state.draft).toBeNull();
    expect(res.state.rounds).toHaveLength(1);
    expect(res.state.rounds![0].action).toBe("propose");
  });

  it("a comment-only proposal is allowed (numbers fine, words explain)", () => {
    let nego = startDraft(parseNegotiation({}), "356282674", "owner", original);
    nego = setDraftComment(nego, "проверьте наценку по чеку");
    const res = sendProposalFromDraft(nego, { chatId: "356282674", role: "owner", nowIso: "t0", original });
    expect(res.ok).toBe(true);
    expect(res.state.open!.split).toEqual(original);
    expect(res.state.open!.comment).toBe("проверьте наценку по чеку");
  });

  it("cannot send twice while an open proposal waits", () => {
    let nego = startDraft(parseNegotiation({}), "7813830016", "operator", original);
    nego = setDraftSplit(nego, applySplitDelta(original, "base", 100));
    const first = sendProposalFromDraft(nego, { chatId: "7813830016", role: "operator", nowIso: "t0", original });
    expect(first.ok).toBe(true);
    // The handler always re-reads the row: the next send attempt starts from
    // the SAVED state (which now carries the open proposal).
    const again = startDraft(first.state, "7813830016", "operator", original, first.state.open?.split);
    const editedAgain = setDraftSplit(again, applySplitDelta(original, "base", 100));
    const second = sendProposalFromDraft(editedAgain, { chatId: "7813830016", role: "operator", nowIso: "t1", original });
    expect(second.ok).toBe(false);
    expect(second.error).toMatch(/уже отправлено/);
  });

  it("a counter round is tagged after the first propose", () => {
    let nego = startDraft(parseNegotiation({}), "7813830016", "operator", original);
    nego = setDraftSplit(nego, applySplitDelta(original, "base", 100));
    const first = sendProposalFromDraft(nego, { chatId: "7813830016", role: "operator", nowIso: "t0", original });
    // counter: the handler withdraws the open proposal (open: null) and
    // opens the editor prefilled with the counterparty's numbers.
    let nego2 = startDraft({ ...first.state, open: null }, "356282674", "owner", original, first.state.open!.split);
    nego2 = setDraftSplit(nego2, applySplitDelta(first.state.open!.split, "equipment", -50));
    const second = sendProposalFromDraft(nego2, { chatId: "356282674", role: "owner", nowIso: "t1", original });
    expect(second.ok).toBe(true);
    expect(second.state.rounds!.map((r) => r.action)).toEqual(["propose", "counter"]);
    expect(second.state.open!.by).toBe("356282674");
  });

  it("accept: only the OTHER party, moves open → agreed, logs the round", () => {
    let nego = startDraft(parseNegotiation({}), "7813830016", "operator", original);
    nego = setDraftSplit(nego, applySplitDelta(original, "overprice", 50));
    const sent = sendProposalFromDraft(nego, { chatId: "7813830016", role: "operator", nowIso: "t0", original });

    // self-accept is refused
    const self = acceptOpenProposal(sent.state, { chatId: "7813830016", role: "operator" });
    expect(self.ok).toBe(false);
    expect(self.error).toMatch(/своим предложением/);

    const acc = acceptOpenProposal(sent.state, { chatId: "356282674", role: "owner" });
    expect(acc.ok).toBe(true);
    expect(acc.state.open).toBeNull();
    expect(acc.state.agreed).toMatchObject({ proposedBy: "7813830016", acceptedBy: "356282674", split: { base: 500, equipment: 250, overprice: 200 } });
    expect(acc.state.rounds!.at(-1)!.action).toBe("accept");
  });

  it("accept without an open proposal is a no-op error", () => {
    const res = acceptOpenProposal({} as NegotiationState, { chatId: "356282674", role: "owner" });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/Открытого предложения нет/);
  });

  it("decline: other party only, clears open, keeps history, no agreed", () => {
    let nego = startDraft(parseNegotiation({}), "7813830016", "operator", original);
    nego = setDraftSplit(nego, applySplitDelta(original, "base", -100));
    const sent = sendProposalFromDraft(nego, { chatId: "7813830016", role: "operator", nowIso: "t0", original });

    const self = declineOpenProposal(sent.state, { chatId: "7813830016", role: "operator", nowIso: "t1" });
    expect(self.ok).toBe(false);

    const dec = declineOpenProposal(sent.state, { chatId: "356282674", role: "owner", nowIso: "t1" });
    expect(dec.ok).toBe(true);
    expect(dec.state.open).toBeNull();
    expect(dec.state.agreed).toBeUndefined();
    expect(dec.state.rounds!.at(-1)!.action).toBe("decline");
  });

  it("rounds are capped at 20 (jsonb never bloats)", async () => {
    const { ROUNDS_CAP, pushRound } = await import("@/app/franchize/lib/rental-verify-core");
    let nego: NegotiationState = { rounds: [] };
    for (let i = 0; i < 30; i += 1) {
      nego = pushRound(nego, { action: "propose", by: "x", role: "operator", at: `t${i}`, split: original });
    }
    expect(nego.rounds).toHaveLength(ROUNDS_CAP);
    expect(nego.rounds![0].at).toBe("t10"); // oldest trimmed
  });
});

// ── Keyboards ───────────────────────────────────────────────────────────────

describe("task106 · editor keyboards", () => {
  it("main editor: 5 rows, changed parts get the ✏️ prefix, live values", () => {
    const edited: SplitParts = { ...original, equipment: 350 };
    const kb = disputeEditorKeyboard(UUID, edited, original);
    expect(kb).toHaveLength(5);
    expect(kb[0][0].text).toContain("техника: 500");
    expect(kb[1][0].text).toContain("экипировка: 350");
    expect(kb[1][0].text.startsWith("✏️")).toBe(true);
    expect(kb[0][0].text.startsWith("✏️")).toBe(false);
    expect(kb[2][0].text).toContain("наценка: 150");
    expect(kb[3].map((b) => b.text)).toEqual(["✍️ Комментарий", "📤 Отправить"]);
    expect(kb[4][0].text).toContain("Расчёт верный");
    for (const row of kb) for (const b of row) expect(b.callback_data.length).toBeLessThanOrEqual(64);
  });

  it("adjuster: deltas + reset + back + send, every callback parses", () => {
    const kb = adjustPartKeyboard("base", UUID);
    expect(kb[0].map((b) => b.text)).toEqual(["−100", "−500", "+500", "+100"]);
    const ops = kb[0].map((b) => parseProposalCallback(b.callback_data));
    expect(ops.map((p) => p!.delta)).toEqual([-100, -500, 500, 100]);
    expect(parseProposalCallback(kb[1][0].callback_data)).toMatchObject({ action: "adjust", delta: 0 });
    expect(parseProposalCallback(kb[1][1].callback_data)?.action).toBe("view");
    expect(parseProposalCallback(kb[2][0].callback_data)?.action).toBe("send");
  });

  it("proposal answer keyboard carries accept / counter / decline", () => {
    const kb = proposalResponseKeyboard(UUID);
    const actions = kb.flat().map((b) => parseProposalCallback(b.callback_data)?.action);
    expect(actions).toEqual(["accept", "counter", "decline"]);
  });

  it("SPLIT_PART_ORDER covers exactly the three commission parts", () => {
    expect(SPLIT_PART_ORDER).toEqual(["base", "equipment", "overprice"]);
  });
});

// ru-RU Intl groups thousands with a NO-BREAK SPACE — normalize before
// matching so the assertions read with plain spaces.
const flat = (s: string): string => s.replace(/[\u00A0\u202F]/g, " ");

// ── Formatters ──────────────────────────────────────────────────────────────

describe("task106 · editor / proposal / done formatters", () => {
  const snapshot = { bikeName: "BMW F800R", totalCost: 6500, base: 500, equipment: 250, overprice: 150 };

  it("editor shows frozen → draft totals and changed lines with arrows", () => {
    const edited: SplitParts = { ...original, equipment: 350 };
    const text = flat(formatDisputeEditor({ snapshot, draft: edited, actorLabel: "@djorudjov" }));
    expect(text).toContain("Редактор расчёта");
    expect(text).toContain("BMW F800R");
    expect(text).toContain("6 500 ₽");
    expect(text).toContain("900 ₽ → 1 000 ₽");
    expect(text).toContain("экипировка: 250 ₽ → <b>350 ₽</b> (+100");
    expect(text).toContain("техника: 500 ₽"); // unchanged → plain line
    expect(text).not.toContain("@djorudjov"); // actor label only in header variants
  });

  it("editor activePart view tells the user which part is being tuned", () => {
    const text = flat(formatDisputeEditor({ snapshot, draft: original, actorLabel: "@x", activePart: "overprice" }));
    expect(text).toContain("📈 <b>наценка</b> — жмите кнопки");
  });

  it("proposal message addresses the other party with old → new numbers", () => {
    const text = flat(formatProposalMessage({
      snapshot,
      proposal: { by: "7813830016", role: "operator", at: "t0", split: { base: 500, equipment: 350, overprice: 150 }, comment: "два шлема" },
      proposerLabel: "@djorudjov",
      forChatId: "356282674",
    }));
    expect(text).toContain("Предложение по сверке");
    expect(text).toContain("@djorudjov предлагает скорректировать расчёт");
    expect(text).toContain("экипировка: 250 ₽ → <b>350 ₽</b>");
    expect(text).toContain("900 ₽ → <b>1 000 ₽</b>");
    expect(text).toContain("два шлема");
    expect(text).toContain("Предложить своё");
  });

  it("done text shows the agreed numbers and the verified stamp", () => {
    const text = flat(formatDealDoneText({
      snapshot,
      agreedSplit: { base: 500, equipment: 350, overprice: 150 },
      proposerLabel: "@djorudjov",
      acceptorLabel: "@salavey13",
    }));
    expect(text).toContain("Расчёт скорректирован и подтверждён");
    expect(text).toContain("@djorudjov → @salavey13");
    expect(text).toContain("(было 900 ₽)");
    expect(text).toContain("проверенная");
  });

  it("user-controlled strings are escaped in every formatter", () => {
    const evil = "<script>alert(1)</script>";
    const esc = escapeVerifyHtml(evil);
    expect(esc).not.toContain("<script>");
    const text = formatProposalMessage({
      snapshot: { ...snapshot, bikeName: evil },
      proposal: { by: "1", role: "operator", at: "t", split: original, comment: evil },
      proposerLabel: evil,
      forChatId: "2",
    });
    expect(text).not.toContain("<script>");
  });
});

// ── parseNegotiation hardening ──────────────────────────────────────────────

describe("task106 · parseNegotiation safe-parse", () => {
  it("garbage in → clean state out (jsonb never throws the flow)", () => {
    for (const garbage of [null, undefined, 42, "str", [], { draft: 5 }, { rounds: "no" }]) {
      expect(parseNegotiation(garbage)).toEqual({});
    }
  });

  it("keeps known keys, drops unknown ones", () => {
    const state = parseNegotiation({
      draft: { by: "1", role: "operator", split: original },
      open: { by: "1", role: "operator", at: "t", split: original },
      agreed: { split: original, proposedBy: "1", acceptedBy: "2", at: "t" },
      rounds: [],
      junk: "ignored",
    });
    expect(state.draft).toBeDefined();
    expect(state.open).toBeDefined();
    expect(state.agreed).toBeDefined();
    expect((state as Record<string, unknown>).junk).toBeUndefined();
  });
});

// ── Source pins: the server wiring ──────────────────────────────────────────

describe("task106 · wiring pins (source-level)", () => {
  it("command-handler routes vrfp_ BEFORE doc/ekip and captures comment text first", () => {
    const s = src("app/webhook-handlers/commands/command-handler.ts");
    expect(s).toContain('text.startsWith("vrfp_")');
    expect(s).toContain("handleRentalVerifyProposalCallbackCommand");
    // the text hook must run before handleDocText (comment cannot leak into /doc)
    const vrfHook = s.indexOf("handleRentalVerifyTextCommand({ userIdStr, chatId, text })");
    const docHook = s.indexOf("const docHandled = await handleDocText(userIdStr, chatId, text)");
    expect(vrfHook).toBeGreaterThan(-1);
    expect(docHook).toBeGreaterThan(vrfHook);
  });

  it("dispute no longer dead-ends: the editor opens right after the disputed write", () => {
    const s = src("app/franchize/lib/rental-verify.ts");
    expect(s).toContain("openDisputeEditorAfterDispute(rentalId, current_");
    expect(s).toContain("singleParty) return; // no second human");
  });

  it("accept path runs through applyVerificationAction with the optimistic lock", () => {
    const s = src("app/franchize/lib/rental-verify.ts");
    expect(s).toMatch(/case "accept": \{[\s\S]*?applyVerificationAction\(current, \{ action: "confirm"[\s\S]*?\.eq\("status", current\.status\)/);
  });

  it("every negotiation write degrades when the column is missing (PGRST204)", () => {
    const s = src("app/franchize/lib/rental-verify.ts");
    expect(s).toContain('error.code === "PGRST204"');
    expect(s).toMatch(/isMissingNegotiationError\(upErr\)/);
    // status-map falls back to the negotiation-free select
    expect(s).toContain("COLS_WITH_NEGO");
    expect(s).toContain("COLS_PLAIN");
  });

  it("agreed split overrides the REAL salary items (profile pays the deal)", () => {
    const s = src("app/franchize/lib/salary-category-bonuses.ts");
    expect(s).toContain("brief?.agreedSplit");
    expect(s).toContain("item.verificationAdjusted = true");
    expect(s).toContain("rentalTotal += delta");
  });

  it("deal achievements are registered in the catalog", () => {
    const s = src("app/franchize/profile-actions.ts");
    expect(s).toContain('id: "deal_first"');
    expect(s).toContain('id: "deal_5"');
    expect(s).toContain('triggerSources: ["rental:deal"]');
  });

  it("SQL migration for Paul exists, idempotent single statement + audit", () => {
    const sql = src("docs/crewDocs/rental-verifications-negotiation-2026-10-18.sql");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS negotiation jsonb NOT NULL DEFAULT '{}'::jsonb");
    expect(sql).toContain("COMMENT ON COLUMN");
    expect(sql).not.toMatch(/#>\s*'/); // no bare-string jsonb paths (22P02 lesson)
    expect(sql).not.toMatch(/\?\s*ARRAY\[/); // no text[] overload (42883 lesson)
  });

  it("CSV «Верификация» gains the corrected marker without new columns", () => {
    const s = src("lib/csv-builders/rentals-csv.ts");
    expect(s).toContain("скорректировано (");
    const cols = src("lib/csv-builders/rentals-csv.ts");
    expect((cols.match(/"Верификация"/g) || []).length).toBe(1); // header count unchanged
  });
});
