// Task 110 — two bugs, one class + the /start OPEN APP note.
//
// Bug A (Paul's report): «✍️ Комментарий к предложению» asked for a comment,
// the operator typed it and got «Неизвестная команда. Используй /help.»
// ROOT CAUSE: the vrf_comment_ user_states upsert wrote an `updated_at` key,
// but the LIVE table (20250721100000_create_user_states_table.sql) has no such
// column → PostgREST rejected the whole upsert (42703/PGRST204), supabase-js
// returned the error WITHOUT throwing, the code never checked it → the state
// silently never existed → the next text message fell through every handler
// in command-handler.ts and died in the generic «Неизвестная команда» branch.
//
// Bug B: the crewsel_ callback upsert had the same `updated_at` key — same
// silent failure class.
//
// Guards pinned here:
//   • NO user_states upsert anywhere in app/ may carry `updated_at`
//     (a payload key the live table lacks) — the whole class, not one call;
//   • every user_states upsert must set `expires_at` explicitly (on-conflict
//     updates otherwise inherit a stale 15-min default);
//   • the vrf_comment upsert must CHECK its error and toast loudly on failure
//     (silent failure was the reason the operator saw a fake prompt);
//   • the comment capture hook still runs BEFORE handleDocText (task106 pin);
//   • /start sends the huge «OPEN APP» note before the first survey question,
//     wrapped in try/catch (decorative — the survey must survive its failure),
//     and only in the fresh-onboarding (plain /start) branch.

import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repo = (...p: string[]) => path.resolve(process.cwd(), ...p);
const src = (p: string) => readFileSync(repo(p), "utf8");

// ── Walk app/ for every file that writes user_states ────────────────────────

function walkTs(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (name === "node_modules" || name.startsWith(".")) continue;
      out.push(...walkTs(full));
    } else if (name.endsWith(".ts")) {
      out.push(full);
    }
  }
  return out;
}

const APP_DIR = repo("app");
// Quote-agnostic anchor (NB: the repo mixes from("user_states") and
// from('user_states') — a hard-coded quote style silently skips writers).
const USER_STATES_ANCHOR = /from\((["'])user_states\1\)/g;
const tsFiles = walkTs(APP_DIR);
const userStatesFiles = tsFiles.filter((f) => USER_STATES_ANCHOR.test(readFileSync(f, "utf8")));

/**
 * Extracts the object-literal payload of every `.upsert({...})` that follows a
 * `from('user_states')` in the same statement. Brace-matched, comment-blind —
 * a heuristic guard: it would miss a payload hoisted to a variable or an
 * upsert >2000 chars away from the anchor; acceptable for this class of bug
 * (the real code always inlines the literal right after the builder).
 */
function extractUserStatesUpsertPayloads(text: string): string[] {
  const payloads: string[] = [];
  const anchor = new RegExp(USER_STATES_ANCHOR.source, "g");
  let m: RegExpExecArray | null;
  while ((m = anchor.exec(text)) !== null) {
    const tail = text.slice(m.index, m.index + 2000);
    const up = tail.indexOf(".upsert(");
    if (up === -1) continue;
    const objStart = tail.indexOf("{", up);
    if (objStart === -1) continue;
    let depth = 0;
    let end = -1;
    for (let i = objStart; i < tail.length; i += 1) {
      if (tail[i] === "{") depth += 1;
      else if (tail[i] === "}") {
        depth -= 1;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    if (end !== -1) payloads.push(tail.slice(objStart, end + 1));
  }
  return payloads;
}

// ── Guard 1: the whole 42703 class — no updated_at in any user_states upsert ─

describe("task110 · user_states upserts are schema-safe", () => {
  it("scans every user_states writer in app/ (found some)", () => {
    // Sanity: the walker must actually find the known writers, otherwise
    // the guards below would be green on an empty set. The two single-quote
    // writers (car-rental, sos) were exactly the blind spot this guard fixed.
    const rels = userStatesFiles.map((f) => path.relative(process.cwd(), f));
    expect(rels.some((f) => f.endsWith("app/franchize/lib/rental-verify.ts"))).toBe(true);
    expect(rels.some((f) => f.endsWith("app/webhook-handlers/commands/command-handler.ts"))).toBe(true);
    expect(rels.some((f) => f.endsWith("app/webhook-handlers/car-rental.ts"))).toBe(true);
    expect(rels.some((f) => f.endsWith("app/webhook-handlers/commands/sos.ts"))).toBe(true);
    expect(userStatesFiles.length).toBeGreaterThan(4);
  });

  it("NO user_states upsert payload carries `updated_at` (live table has no such column)", () => {
    const offenders: string[] = [];
    for (const f of userStatesFiles) {
      for (const payload of extractUserStatesUpsertPayloads(readFileSync(f, "utf8"))) {
        if (/\bupdated_at\s*:/.test(payload)) {
          offenders.push(`${path.relative(process.cwd(), f)}: ${payload.slice(0, 120)}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("every user_states upsert sets `expires_at` explicitly", () => {
    const offenders: string[] = [];
    for (const f of userStatesFiles) {
      for (const payload of extractUserStatesUpsertPayloads(readFileSync(f, "utf8"))) {
        if (!/\bexpires_at\s*:/.test(payload)) {
          offenders.push(`${path.relative(process.cwd(), f)}: ${payload.slice(0, 120)}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});

// ── Guard 2: the vrf_comment capture (Paul's exact bug) ─────────────────────

describe("task110 · vrf_comment capture state", () => {
  const vrf = src("app/franchize/lib/rental-verify.ts");

  it("comment case upserts vrf_comment_ with expires_at and NO updated_at", () => {
    const caseStart = vrf.indexOf('case "comment":');
    const caseEnd = vrf.indexOf('case "send":', caseStart);
    expect(caseStart).toBeGreaterThan(-1);
    expect(caseEnd).toBeGreaterThan(caseStart);
    const block = vrf.slice(caseStart, caseEnd);
    expect(block).toContain("vrf_comment_");
    expect(block).toMatch(/expires_at:\s*new Date\(/);
    expect(block).not.toMatch(/\bupdated_at\s*:/);
  });

  it("comment case CHECKS the upsert error and answers loudly (no fake prompt)", () => {
    const caseStart = vrf.indexOf('case "comment":');
    const caseEnd = vrf.indexOf('case "send":', caseStart);
    const block = vrf.slice(caseStart, caseEnd);
    expect(block).toMatch(/error:\s*stateErr/);
    expect(block).toMatch(/if \(stateErr\)/);
    expect(block).toContain("logger.error");
    // the failure toast fires INSTEAD of «Напишите комментарий»
    const errPos = block.indexOf("if (stateErr)");
    const toastPos = block.indexOf("Не удалось включить режим ввода", errPos);
    const promptPos = block.indexOf("Напишите комментарий следующим сообщением", errPos);
    expect(toastPos).toBeGreaterThan(-1);
    expect(promptPos).toBeGreaterThan(toastPos);
  });

  it("the capture hook in command-handler still runs before handleDocText", () => {
    const s = src("app/webhook-handlers/commands/command-handler.ts");
    const vrfHook = s.indexOf("handleRentalVerifyTextCommand({ userIdStr, chatId, text })");
    const docHook = s.indexOf("const docHandled = await handleDocText(userIdStr, chatId, text)");
    expect(vrfHook).toBeGreaterThan(-1);
    expect(docHook).toBeGreaterThan(vrfHook);
  });

  it("crewsel callback upsert no longer writes updated_at", () => {
    const s = src("app/webhook-handlers/commands/command-handler.ts");
    const crewsel = s.indexOf('text.startsWith("crewsel_")');
    expect(crewsel).toBeGreaterThan(-1);
    // Slice covers the crewsel block (and a bit of the next handler — the
    // class-wide guard above already polices every writer).
    const payloads = extractUserStatesUpsertPayloads(s.slice(crewsel, crewsel + 3000));
    expect(payloads.length).toBeGreaterThanOrEqual(1);
    for (const p of payloads) expect(p).not.toMatch(/\bupdated_at\s*:/);
  });
});

// ── Guard 3: /start OPEN APP note ───────────────────────────────────────────

describe("task110 · /start OPEN APP note", () => {
  const start = src("app/webhook-handlers/commands/start.ts");

  it("plain /start sends the huge note BEFORE the first survey question", () => {
    const notePos = start.indexOf("ЗИМНЕЕ ХРАНЕНИЕ");
    const qPos = start.indexOf("await sendSurveyQuestion(chatId, question);");
    expect(notePos).toBeGreaterThan(-1);
    expect(qPos).toBeGreaterThan(notePos);
  });

  it("note names rent / buy / winter storage and links the app", () => {
    expect(start).toContain("АРЕНДОВАТЬ, КУПИТЬ БАЙК");
    expect(start).toContain("ЗИМНЕЕ ХРАНЕНИЕ");
    expect(start).toContain("Открыть приложение VIP Bike");
    expect(start).toContain("TELEGRAM_BOT_LINK");
    expect(start).toContain("https://t.me/oneBikePlsBot/app");
  });

  it("note is decorative — its failure cannot kill the survey", () => {
    const noteStart = start.indexOf("OPEN APP» note");
    const qPos = start.indexOf("await sendSurveyQuestion(chatId, question);");
    const block = start.slice(noteStart, qPos);
    expect(block).toMatch(/try \{[\s\S]*\} catch/);
    expect(block).toContain("logger.warn");
  });

  it("note lives ONLY in the fresh-onboarding branch (survey answers unaffected)", () => {
    const notePos = start.indexOf("ЗИМНЕЕ ХРАНЕНИЕ");
    const plainStart = start.indexOf("if (isPlainStart) {");
    const elseBranch = start.indexOf("// Handle Answer (user is in the middle of a survey)");
    expect(plainStart).toBeGreaterThan(-1);
    expect(elseBranch).toBeGreaterThan(plainStart);
    expect(notePos).toBeGreaterThan(plainStart);
    expect(notePos).toBeLessThan(elseBranch);
  });
});
