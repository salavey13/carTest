// task156 — verification COMMENTS surface everywhere + bot edge cases.
//
// Boss's live case: owner disputed сверка d7b4d4dc and typed «Где наличка ???»
// to the bot — the bot echoed it, the text landed in
// rental_verifications.negotiation.draft.comment … and reached NO web surface
// (the table «Заметки» reads rental metadata, «Комментарий» is the generated
// renter line). This pins the whole surfacing chain + the bot polish:
//   • latestNegotiationComment (pure): open → draft → last round priority;
//   • getVerificationStatusMap carries comment/commentRole in the brief;
//   • CSV «Верификация» gains a short ✍️ marker, «Заметки» carries the TEXT
//     (tableview preview, CSV and XLSX all render from this builder);
//   • dashboard rows + drawer card + list chip tooltip + rental page card;
//   • bot: honest replies on dead-ends, verified-guard, expiry check,
//     one-time staff note on the FIRST comment;
//   • quest polish: hidden overview = neutral wordmark page (not blank).

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  latestNegotiationComment,
  parseNegotiation,
  type NegotiationState,
} from "@/app/franchize/lib/rental-verify-core";

const repo = (...p: string[]) => path.resolve(process.cwd(), ...p);
const src = (p: string) => readFileSync(repo(p), "utf8");

// ── latestNegotiationComment (pure) ─────────────────────────────────────────

describe("task156: latestNegotiationComment priority", () => {
  it("open (sent proposal) wins over draft and rounds", () => {
    const nego: NegotiationState = {
      draft: { by: "1", role: "owner", split: { base: 1, equipment: 0, overprice: 0 }, comment: "черновик" },
      open: { by: "1", role: "owner", split: { base: 2, equipment: 0, overprice: 0 }, comment: "отправлено" },
      rounds: [{ action: "propose", by: "1", role: "owner", at: "t", split: { base: 3, equipment: 0, overprice: 0 }, comment: "раунд" }],
    };
    expect(latestNegotiationComment(nego)).toEqual({ text: "отправлено", role: "owner", where: "open" });
  });

  it("draft comment is the standing one while nothing is sent (the boss case)", () => {
    const nego = parseNegotiation({
      draft: { by: "356282674", role: "owner", split: { base: 500, equipment: 100, overprice: 0 }, comment: "  Где наличка ???  " },
    });
    expect(latestNegotiationComment(nego)).toEqual({ text: "Где наличка ???", role: "owner", where: "draft" });
  });

  it("falls back to the LAST round carrying a comment", () => {
    const nego: NegotiationState = {
      rounds: [
        { action: "propose", by: "1", role: "operator", at: "t1", split: { base: 1, equipment: 0, overprice: 0 }, comment: "первый" },
        { action: "counter", by: "2", role: "owner", at: "t2", split: { base: 2, equipment: 0, overprice: 0 }, comment: "контр" },
        { action: "accept", by: "1", role: "operator", at: "t3", split: { base: 2, equipment: 0, overprice: 0 }, comment: null },
      ],
    };
    expect(latestNegotiationComment(nego)).toEqual({ text: "контр", role: "owner", where: "round" });
  });

  it("null on empty state / whitespace-only / junk", () => {
    expect(latestNegotiationComment(null)).toBeNull();
    expect(latestNegotiationComment({})).toBeNull();
    expect(latestNegotiationComment(parseNegotiation({ draft: { by: "1", role: "owner", split: { base: 0, equipment: 0, overprice: 0 }, comment: "   " } }))).toBeNull();
    expect(latestNegotiationComment(parseNegotiation("junk"))).toBeNull();
  });
});

// ── brief carries the comment ───────────────────────────────────────────────

describe("task156: verification brief + web surfaces (source pins)", () => {
  const verify = src("app/franchize/lib/rental-verify.ts");

  it("getVerificationStatusMap spreads latestNegotiationComment into the brief", () => {
    expect(verify).toContain("latestNegotiationComment");
    expect(verify).toMatch(/comment:\s*c\.text,\s*commentRole:\s*c\.role/);
  });

  it("CSV builder: ✍️ marker on «Верификация» + comment text rides in «Заметки»", () => {
    const csv = src("lib/csv-builders/rentals-csv.ts");
    expect(csv).toContain("verificationCommentPart");
    expect(csv).toContain("сверка · ✍️");
    expect(csv).toMatch(/return brief\.comment \? `\$\{base\} · ✍️` : base;/);
    // the notes cell joins the verification comment FIRST (most relevant)
    expect(csv).toMatch(/const notesCell = \[verComment, notesStr\]\.filter\(Boolean\)\.join\(" \| "\);/);
    expect(csv).toMatch(/notesCell, subrenterStr, photosStr/);
    // comment is capped so the wrapped notes cell stays sane
    expect(csv).toMatch(/length > 140/);
  });

  it("dashboard rows carry verificationComment/Role", () => {
    const dash = src("app/franchize/server-actions/rentals-dashboard.ts");
    expect(dash).toMatch(/verificationComment\?: string \| null/);
    expect(dash).toMatch(/verificationCommentRole\?: "operator" \| "owner" \| "admin" \| null/);
    expect(dash).toMatch(/verificationComment: verificationMap\.get\(item\.rental_id\)\?\.comment \?\? null/);
  });

  it("analytics row type + v2 mapper pass the fields through", () => {
    const types = src("app/franchize/[slug]/rentals-analytics/components/types.ts");
    expect(types).toMatch(/verificationComment\?: string \| null/);
    const v2 = src("app/franchize/[slug]/rentals-analytics/AnalyticsClientV2.tsx");
    expect(v2).toMatch(/verificationComment: item\.verificationComment \?\? null/);
  });

  it("drawer + rental page feed the card", () => {
    const drawer = src("app/franchize/[slug]/rentals-analytics/components/RentalDetailDrawer.tsx");
    expect(drawer).toMatch(/comment=\{rental\.verificationComment\}/);
    expect(drawer).toMatch(/commentRole=\{rental\.verificationCommentRole\}/);
    const page = src("app/franchize/[slug]/rental/[id]/page.tsx");
    expect(page).toMatch(/comment=\{verBrief\?\.comment \?\? null\}/);
  });

  it("card renders the comment block, hidden on verified rows", () => {
    const card = src("app/franchize/components/CommissionVerificationCard.tsx");
    expect(card).toMatch(/comment && cardStatus !== "verified"/);
    expect(card).toContain("✍️ комментарий");
    expect(card).toMatch(/whitespace-pre-wrap break-words/);
  });

  it("list chip tooltip carries the comment (not on verified rows)", () => {
    const chip = src("app/franchize/[slug]/rentals-analytics/components/AnalyticsRentalCard.tsx");
    expect(chip).toMatch(/ver && ver !== "verified" && rental\.verificationComment/);
    expect(chip).toMatch(/title=\{verCommentTitle\}/);
  });

  it("COMMENT_ROLE_RU labels all three roles", () => {
    const card = src("app/franchize/components/CommissionVerificationCard.tsx");
    expect(card).toMatch(/operator: "оператора"/);
    expect(card).toMatch(/owner: "владельца"/);
    expect(card).toMatch(/admin: "админа экипажа"/);
  });
});

// ── bot edge cases ──────────────────────────────────────────────────────────

describe("task156: bot comment-capture hardening (source pins)", () => {
  const verify = src("app/franchize/lib/rental-verify.ts");

  it("expired capture mode is cleaned up and NOT consumed (mirrors doc-manual)", () => {
    expect(verify).toMatch(/\.select\("state, context, expires_at"\)/);
    expect(verify).toMatch(/new Date\(stateRow\.expires_at\)\.getTime\(\) < Date\.now\(\)/);
  });

  it("missing verification row → honest reply, not a silent swallow", () => {
    expect(verify).toMatch(/Комментарий не сохранён — сверка по этой аренде не найдена/);
  });

  it("non-party commenter → honest reply", () => {
    expect(verify).toMatch(/вы не участник сверки по этой аренде/);
  });

  it("verified row → comment declined honestly, no dead draft", () => {
    expect(verify).toMatch(/Расчёт по этой аренде уже подтверждён — комментарий не нужен/);
  });

  it("FIRST comment fires ONE staff note (edits stay quiet)", () => {
    expect(verify).toMatch(/const isFirstComment = !\(nego\.draft && nego\.draft\.by === String\(params\.userId\)/);
    expect(verify).toMatch(/добавил комментарий к спору по аренде/);
  });

  it("capture confirmation sets expectations where the comment is visible", () => {
    expect(verify).toMatch(/уже виден в веб-таблице аренд/);
  });
});

// ── quest polish ────────────────────────────────────────────────────────────

describe("task156: roman quest polish (source pins)", () => {
  it("hidden overview = neutral wordmark page, not a blank screen", () => {
    const overview = src("app/gift/roman-quest/page.tsx");
    // task164 re-baseline: the overview is the PUBLIC tour hub now — there is
    // no "hidden" gate branch at all (v2 gate shows the tour to everyone).
    expect(overview).not.toMatch(/if \(gate === "hidden"\) return null;/);
  });

  it("stop-7 riddle lost the redundant second ending (both gated branches)", () => {
    const stats = src("app/franchize/[slug]/season-stats/page.tsx");
    expect(stats).not.toContain("Осталось нажать одну кнопку");
    expect(stats.match(/подарок ждёт тебя там с самого начала/g)?.length).toBe(2);
  });

  it("overview final card wording updated", () => {
    const overview = src("app/gift/roman-quest/page.tsx");
    // task164 re-baseline: ten stops now, and the birthday finale stays Roman-only
    expect(overview).toContain("Все десять следов собраны — подарок твой. Заходи.");
  });
});
