// tests/franchize/forward-telegram-hardening.spec.ts
//
// Code review 2026-10-02 — boss: «codereview the shit out of generated links»,
// «use best practices». The forwarding API (v0-car-test.vercel.app) is the
// transport for EVERY wall-post notification with a photo, so it gets the same
// treatment as the wall libs:
//   1. METHOD ALLOWLIST — the Origin whitelist is forgeable (server-to-server
//      callers present an allowed origin header by design), so without an
//      allowlist the endpoint exposed the bot token for ARBITRARY Bot API
//      methods: getUpdates (data exfiltration), setWebhook / logOut / close
//      (bot hijack), deleteMessage, etc. Only the four documented delivery
//      methods may pass.
//   2. DEADLINES — both Telegram fetches in the route carry
//      AbortSignal.timeout; a hung call must not hold the serverless function.
//   3. PAYLOAD SHAPE — payload must be a plain object before it is spread
//      into the Bot API body.
//   4. 429 VISIBILITY — parseTelegramRetryAfter (pure) surfaces
//      parameters.retry_after from BOTH response shapes (direct Bot API body
//      and the forward route's { telegram: … } error envelope), so callers can
//      retry respectfully instead of treating flood control as a hard failure.
//   5. CREW FANOUT PACING — wall-notify (crew members) now batches with the
//      same 20 × 1.1s ≈ 18 msg/s tempo as the renter fanout; a large crew can
//      no longer burst 50+ parallel sendPhoto calls into the 30/s Bot API
//      ceiling (crew fanout has no cron retry to heal 429 storms).

import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { parseTelegramRetryAfter } from "@/lib/telegram-transport";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

const ROUTE = "app/api/forward-telegram/route.ts";
const CREW_NOTIFY = "app/franchize/lib/wall-notify.ts";
const DELIVER = "app/franchize/lib/wall-notify-deliver.ts";

describe("forward API hardening: method allowlist + deadlines (source pins)", () => {
  it("route allows ONLY the four delivery methods", () => {
    const src = read(ROUTE);
    expect(src).toContain('ALLOWED_METHODS = new Set<string>(["sendMessage", "sendPhoto", "sendDocument", "sendMediaGroup"])');
    expect(src).toContain("!ALLOWED_METHODS.has(body.method)");
    expect(src).toContain('"Method not allowed"');
    // the allowlist check happens BEFORE anything touches the bot token path
    expect(src.indexOf("ALLOWED_METHODS.has")).toBeLessThan(src.indexOf("await forwardToTelegram("));
  });

  it("route payload must be a plain object (no arrays/null spread into Bot API body)", () => {
    const src = read(ROUTE);
    expect(src).toContain("payload must be an object");
  });

  it("both Telegram fetches in the route carry an AbortSignal deadline", () => {
    const src = read(ROUTE);
    expect(src).toContain("AbortSignal.timeout(TELEGRAM_CALL_TIMEOUT_MS)");
    // multipart (files) and JSON branches share the same deadline object
    expect(src.match(/signal:/g)?.length).toBeGreaterThanOrEqual(1);
    expect(src).toContain("body: form, ...deadline");
    expect(src).toContain("...deadline,\n    });");
  });
});

describe("parseTelegramRetryAfter (pure)", () => {
  it("reads retry_after from the direct Bot API error body", () => {
    expect(parseTelegramRetryAfter({ ok: false, parameters: { retry_after: 3 } })).toBe(3);
  });

  it("reads retry_after from the forward route error envelope ({ telegram })", () => {
    expect(parseTelegramRetryAfter({ error: "Telegram API error", telegram: { ok: false, parameters: { retry_after: 5 } } })).toBe(5);
  });

  it("string retry_after coerces; sub-second floors to a positive int", () => {
    expect(parseTelegramRetryAfter({ parameters: { retry_after: "2" } })).toBe(2);
  });

  it("garbage in → null out (never throws)", () => {
    expect(parseTelegramRetryAfter(null)).toBeNull();
    expect(parseTelegramRetryAfter(undefined)).toBeNull();
    expect(parseTelegramRetryAfter("oops")).toBeNull();
    expect(parseTelegramRetryAfter({})).toBeNull();
    expect(parseTelegramRetryAfter({ parameters: { retry_after: 0 } })).toBeNull();
    expect(parseTelegramRetryAfter({ parameters: { retry_after: -3 } })).toBeNull();
    expect(parseTelegramRetryAfter({ parameters: { retry_after: "soon" } })).toBeNull();
    expect(parseTelegramRetryAfter({ telegram: "boom" })).toBeNull();
  });
});

describe("crew fanout pacing (wall-notify)", () => {
  it("crew fanout batches with the shared tempo instead of one unbounded allSettled", () => {
    const src = read(CREW_NOTIFY);
    expect(src).toContain("batched(targets)");
    expect(src).toContain("WALL_NOTIFY_BATCH_PAUSE_MS");
    // every delivery still goes through the photo-capable helper
    expect(src).toContain("deliverWallPostNotify(chatId, text, replyMarkup, input.coverPhotoUrl)");
  });

  it("batched() lives next to the delivery helper and exports the shared constants", () => {
    const src = read(DELIVER);
    expect(src).toContain("export const WALL_NOTIFY_BATCH_SIZE = 20");
    expect(src).toContain("export const WALL_NOTIFY_BATCH_PAUSE_MS = 1100");
    expect(src).toContain("export function batched");
  });

  it("renter fanout re-exports the same constants (public contract preserved)", () => {
    const src = read("app/franchize/lib/wall-renter-notify.ts");
    expect(src).toContain("export const RENTER_NOTIFY_BATCH_SIZE = WALL_NOTIFY_BATCH_SIZE");
    expect(src).toContain("export const RENTER_NOTIFY_BATCH_PAUSE_MS = WALL_NOTIFY_BATCH_PAUSE_MS");
  });
});
