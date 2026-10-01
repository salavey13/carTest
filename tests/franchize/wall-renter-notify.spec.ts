// tests/franchize/wall-renter-notify.spec.ts
//
// BOSS 2026-09-29 — «разослать пост прошлым арендаторам» (wall v7 fanout):
//   1. pure job state (parseNotifyJob) — мусор в metadata не роняет крон;
//   2. exactly-once pending math (pendingRecipients) — ledger + exclude + dedupe;
//   3. Telegram rate-limit constants — пакеты 20 × 1.1с ≈ 18/сек < 30/сек
//      Bot API ceiling, бюджет прогона 50с внутри maxDuration=60;
//   4. staff security wiring — UI-флаг косметический, сервер перепроверяет
//      isCrewStaffUser И на постановке job, И на kick-роуте;
//   5. ledger durability — запись после КАЖДОГО пакета (крэш ≤ 1 пакет),
//      скрытый пост → job failed (ghost guard);
//   6. аудитории recent/past/all по rentals.created_at (cancelled — всегда мимо);
//   7. migration 20260929100000: crew_posts.metadata jsonb (chat_id НИКОГДА
//      не хранятся — только users.user_id ledger);
//   8. meetup → wall interlink: флаги видны только staff (showStaffFlags),
//      autoPublish импликитно выключает suggest-режим, повторный тап по
//      аудитории снимает выбор;
//   9. sheet contrast guard: тинт следует за ТЕМОЙ КАРТОЧКИ (isDarkCssColor),
//      не за темой приложения;
//  10. review-nudge enrichment: сводка поездки + готовый черновик отзыва
//      Яндекса (buildSuggestedYandexReview), паритет dashboard-пути закрытия.

import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock("@/lib/supabase-server", () => ({
  supabaseAdmin: {
    from: vi.fn(() => {
      const ret = {
        insert: vi.fn(() => ret),
        select: vi.fn(() => ret),
        upsert: vi.fn(() => ret),
        update: vi.fn(() => ret),
        delete: vi.fn(() => ret),
        eq: vi.fn(() => ret),
        neq: vi.fn(() => ret),
        gte: vi.fn(() => ret),
        lt: vi.fn(() => ret),
        in: vi.fn(() => ret),
        not: vi.fn(() => ret),
        order: vi.fn(() => ret),
        limit: vi.fn(() => ret),
        single: vi.fn(async () => ({ data: null, error: null })),
        maybeSingle: vi.fn(async () => ({ data: null, error: null })),
      };
      return ret;
    }),
  },
}));
vi.mock("@/lib/telegram-transport", () => ({
  telegramDeliver: vi.fn(async () => ({ ok: true })),
}));

import {
  RENTER_NOTIFY_BATCH_SIZE,
  RENTER_NOTIFY_BATCH_PAUSE_MS,
  RENTER_NOTIFY_MAX_RECIPIENTS,
  RENTER_NOTIFY_TIME_BUDGET_MS,
  RENTER_NOTIFY_JOB_TTL_DAYS,
  WALL_RENTER_AUDIENCES,
  parseNotifyJob,
  pendingRecipients,
} from "@/app/franchize/lib/wall-renter-notify";
import { buildSuggestedYandexReview, summarizeRide } from "@/app/franchize/lib/ride-share-notify";
import {
  buildWallBroadcastCreatorHtml,
  buildWallRentButton,
  bikeRentButtonLabel,
} from "@/app/franchize/lib/community-wall";
import {
  capWallNotifyCaption,
  deliverWallPostNotify,
} from "@/app/franchize/lib/wall-notify-deliver";
import { telegramDeliver } from "@/lib/telegram-transport";
import { isDarkCssColor } from "@/lib/map-riders";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

const LIB = "app/franchize/lib/wall-renter-notify.ts";
const KICK = "app/api/franchize/wall-renter-notify/route.ts";
const CRON = "app/api/cron/wall-renter-notify/route.ts";
const WALL_ACTION = "app/franchize/server-actions/community-wall.ts";
const MAP = "components/map-riders/MapRidersClientRefactored.tsx";
const MODAL = "components/map-riders/MeetupCreateModal.tsx";
const MIGRATION = "supabase/migrations/20260929100000_crew_posts_metadata.sql";

// ── 1. Telegram limits (brainstorm answer, baked into constants) ────────────

describe("renter fanout: telegram rate-limit budget", () => {
  it("batch pace stays under the Bot API global ceiling (~30 msg/sec)", () => {
    expect(RENTER_NOTIFY_BATCH_SIZE).toBe(20);
    expect(RENTER_NOTIFY_BATCH_PAUSE_MS).toBe(1100);
    const msgsPerSec = RENTER_NOTIFY_BATCH_SIZE / (RENTER_NOTIFY_BATCH_PAUSE_MS / 1000);
    expect(msgsPerSec).toBeLessThan(30); // ~18.2/s — ~40% запаса
    expect(msgsPerSec).toBeGreaterThan(10); // и не черепаший темп
  });

  it("one run fits inside the serverless window (50s budget < maxDuration 60)", () => {
    expect(RENTER_NOTIFY_TIME_BUDGET_MS).toBe(50_000);
    const route = read(KICK);
    expect(route).toContain("maxDuration = 60");
    expect(RENTER_NOTIFY_TIME_BUDGET_MS).toBeLessThan(60_000);
  });

  it("audience is capped per post; the tail is finished by later runs/cron", () => {
    expect(RENTER_NOTIFY_MAX_RECIPIENTS).toBe(500);
    expect(RENTER_NOTIFY_JOB_TTL_DAYS).toBeGreaterThanOrEqual(7);
    const vercel = read("vercel.json");
    expect(vercel).toContain("/api/cron/wall-renter-notify");
  });

  it("audience enum: recent / past / all only", () => {
    expect(WALL_RENTER_AUDIENCES).toEqual(["recent", "past", "all"]);
  });
});

// ── 2. job state (pure) ──────────────────────────────────────────────────────

describe("parseNotifyJob", () => {
  const valid = {
    status: "queued",
    audience: "recent",
    requested_by: "user-1",
    created_at: "2026-09-29T10:00:00Z",
    finished_at: null,
    sent_user_ids: ["u1", "u2"],
    sent: 2,
    failed: 0,
    error: null,
  };

  it("accepts a well-formed job", () => {
    const job = parseNotifyJob({ notify_job: valid });
    expect(job).not.toBeNull();
    expect(job?.status).toBe("queued");
    expect(job?.audience).toBe("recent");
    expect(job?.sent_user_ids).toEqual(["u1", "u2"]);
    expect(job?.sent).toBe(2);
  });

  it("rejects garbage / missing / wrong-typed metadata (cron must not crash)", () => {
    expect(parseNotifyJob(null)).toBeNull();
    expect(parseNotifyJob("string")).toBeNull();
    expect(parseNotifyJob({})).toBeNull();
    expect(parseNotifyJob({ notify_job: "nope" })).toBeNull();
    expect(parseNotifyJob({ notify_job: { ...valid, status: "exploded" } })).toBeNull();
    expect(parseNotifyJob({ notify_job: { ...valid, audience: "bosses" } })).toBeNull();
    expect(parseNotifyJob({ notify_job: { ...valid, requested_by: 42 } })).toBeNull();
  });

  it("tolerates a polluted sent_user_ids ledger (strings only survive)", () => {
    const job = parseNotifyJob({ notify_job: { ...valid, sent_user_ids: ["ok", 7, null, "fine"] } });
    expect(job?.sent_user_ids).toEqual(["ok", "fine"]);
    // non-finite counters fall back to 0
    const job2 = parseNotifyJob({ notify_job: { ...valid, sent: Number.NaN, failed: "x" } });
    expect(job2?.sent).toBe(0);
    expect(job2?.failed).toBe(0);
  });
});

// ── 3. exactly-once pending math (pure) ──────────────────────────────────────

describe("pendingRecipients", () => {
  it("skips already-sent (ledger), excluded and duplicated ids, keeps order", () => {
    const out = pendingRecipients(
      ["a", "b", "c", "a", "d", "b"],
      ["b"], // ledger
      new Set(["d"]), // author / crew members / requester
    );
    expect(out).toEqual(["a", "c"]);
  });

  it("returns everything when ledger and exclude are empty", () => {
    expect(pendingRecipients(["x", "y"], [], new Set())).toEqual(["x", "y"]);
  });

  it("empty pending → processor marks the job done (no ghost tail)", () => {
    expect(pendingRecipients([], [], new Set())).toEqual([]);
  });
});

// ── 4. security wiring (staff-only fanout) ──────────────────────────────────

describe("renter fanout: staff security wiring", () => {
  it("kick route re-verifies wall actor AND crew staff server-side", () => {
    const src = read(KICK);
    expect(src).toContain("resolveWallActor");
    expect(src).toContain("isCrewStaffUser(actor.userId, crew)");
    expect(src).toContain("Рассылка доступна только экипажу");
    // no chat ids ever leak in the response — counters only (the doc comment
    // says so; responses spread WallRenterNotifyRunResult = counters + status)
    expect(src).toContain("только счётчики");
    expect(src).toContain("processWallRenterNotifyJob(postId)");
    expect(src).not.toMatch(/NextResponse\.json\([^)]*chat/);
  });

  it("createCommunityPostAction: UI flag is cosmetic, server re-checks authorScope", () => {
    const src = read(WALL_ACTION);
    expect(src).toContain("notifyRenters");
    expect(src).toContain('authorScope !== "crew"');
    expect(src).toContain("Разослать арендаторам могут только owner и члены экипажа.");
    // job is queued ONLY after the ghost-guard (post survived photo-failure rollback)
    expect(src).toContain("notifyJobAudience && stillThere");
    expect(src).toContain("queueWallRenterNotifyJob");
  });

  it("hidden post kills its own job (ghost guard before fanout)", () => {
    const src = read(LIB);
    expect(src).toContain("post hidden before fanout");
    expect(src).toContain('status: "failed"');
  });

  it("ledger is persisted after EACH batch — a crash loses at most one batch", () => {
    const src = read(LIB);
    expect(src).toContain("Ledger после КАЖДОГО пакета");
    expect(src).toContain("sentLedger.push(...delivered)");
    // resumes from the ledger, never re-sends delivered messages
    expect(src).toContain("pendingRecipients(filtered, job.sent_user_ids, exclude)");
  });
});

// ── 5. audience windows + migration ─────────────────────────────────────────

describe("renter fanout: audience + storage", () => {
  it("audience windows: recent 30d, past 31–180d, cancelled always excluded", () => {
    const src = read(LIB);
    expect(src).toContain('daysAgoIso(30)');
    expect(src).toContain("daysAgoIso(180)");
    expect(src).toContain('.neq("status", "cancelled")');
    // warmest first — the 500 cap keeps the most recent renters
    expect(src).toContain('{ ascending: false }');
  });

  it("chat_ids are NEVER stored — ledger holds users.user_id only", () => {
    const migration = read(MIGRATION);
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS metadata jsonb");
    expect(migration).toContain("chat ids are NOT stored");
    const lib = read(LIB);
    expect(lib).toContain("sent_user_ids: string[]");
  });

  it("cron: timing-safe guard, one post per run, queued+running both picked up", () => {
    const src = read(CRON);
    expect(src).toContain("timingSafeEqual");
    expect(src).toContain('job.status === "queued" || job.status === "running"');
    expect(src).toContain("processWallRenterNotifyJob(pendingIds[0]");
    expect(src).toContain('req.headers.get("x-vercel-cron")');
  });
});

// ── 6. meetup → wall interlink (map-riders) ─────────────────────────────────

describe("meetup → wall: staff flags + auto post", () => {
  it("staff flags are gated by the server-verified viewer flag (cosmetic UI)", () => {
    const map = read(MAP);
    expect(map).toContain("showStaffFlags={viewerIsCrewStaff}");
    expect(map).toContain("getWallStaffFlagAction");
    // kick is awaited (lesson d275c52: fire-and-forget freezes on Vercel)
    expect(map).toContain("await kickRenterFanout(res.post.id, crewSlug)");
    expect(map).toContain("createCommunityPostAction");
  });

  it("modal: suggest by default; autoPublish implies no draft; audience is a radio-set", () => {
    const modal = read(MODAL);
    expect(modal).toContain("shareToWall: autoPublish ? false : shareToWall");
    expect(modal).toContain('setNotifyAudience((cur) => (cur === option.value ? null : option.value))');
    expect(modal).toContain("showStaffFlags?: boolean");
  });

  it("auto post carries the meetup geo-tag so the wall pin lands on the map", () => {
    const map = read(MAP);
    expect(map).toMatch(/geo: \{ lat: point\[0\], lng: point\[1\], label: value \}/);
    // post failure must not bury the meetup — point already exists
    expect(map).toContain("Точка на карте добавлена — опубликуй пост о ней вручную");
  });
});

// ── 7. sheet contrast guard (dark tint over the light map) ──────────────────

describe("map-riders sheet: dark tint follows the CARD theme", () => {
  it("tint paints OVER the card color and is theme-matched, not app-matched", () => {
    const src = read(MAP);
    expect(src).toContain("isDarkCssColor(crew.theme.palette.bgCard)");
    expect(src).toContain("rgba(2, 6, 23, 0.42)"); // dark sheet tint
    expect(src).toContain("rgba(255, 255, 255, 0.16)"); // light sheet tint
    expect(src).toContain(`linear-gradient(${sheetTintTemplate()}, ${sheetTintTemplate()})`);
  });

  it("isDarkCssColor: parsable colors are decided by luminance; unparsable → dark (safe default)", () => {
    expect(isDarkCssColor("#0b1220")).toBe(true);
    expect(isDarkCssColor("#f8fafc")).toBe(false);
    expect(isDarkCssColor("rgb(15, 23, 42)")).toBe(true);
    expect(isDarkCssColor("rgba(248, 250, 252, 0.9)")).toBe(false);
    // CSS vars / color-mix / garbage → conservative DARK (vip-bike-style dark crews)
    expect(isDarkCssColor("var(--mr-card)")).toBe(true);
    expect(isDarkCssColor("color-mix(in srgb, red, blue)")).toBe(true);
    expect(isDarkCssColor("nonsense")).toBe(true);
    expect(isDarkCssColor(null)).toBe(true);
  });

  function sheetTintTemplate(): string {
    return "${sheetTint}";
  }
});

// ── 8. community page portrait fix ──────────────────────────────────────────

describe("community wall: portrait photos are not cropped anymore", () => {
  it("single-photo card renders native aspect (w-auto) over a blurred backdrop", () => {
    const src = read("app/franchize/[slug]/community/CommunityWallClient.tsx");
    // the photo itself: no more object-cover crop
    expect(src).toContain("w-auto max-w-full");
    // blurred oversized copy fills the shell behind (no ugly gutters)
    expect(src).toContain("blur-2xl");
    expect(src).toContain('style={{ transform: "scale(1.25)" }}');
  });
});

// ── 9. review-nudge enrichment (ride stats + review draft) ──────────────────

describe("review nudge: ride stats + precreated Yandex review draft", () => {
  const HOUR = 60 * 60 * 1000;
  const isoAgo = (h: number) => new Date(Date.now() - h * HOUR).toISOString();

  it("draft uses only rental facts; deposit line only when actually returned", () => {
    const summary = summarizeRide({
      bikeTitle: "Honda NPS Zoomer",
      startIso: isoAgo(30),
      endIso: isoAgo(2),
      totalCost: 3500,
      odometerBefore: 1200,
      odometerAfter: 1337,
      depositReturned: true,
      crewName: null,
      crewSlug: null,
    });
    const text = buildSuggestedYandexReview(summary);
    expect(text).toContain("Honda NPS Zoomer");
    expect(text).toContain("137 км"); // 1337 − 1200
    expect(text).toContain("Депозит вернули");
    expect(text).toContain("⭐⭐⭐⭐⭐");

    const noDeposit = buildSuggestedYandexReview(
      summarizeRide({
        bikeTitle: "Honda Zoomer",
        startIso: isoAgo(10),
        endIso: isoAgo(2),
        totalCost: 2000,
        odometerBefore: null,
        odometerAfter: null,
        depositReturned: false,
        crewName: null,
        crewSlug: null,
      }),
    );
    expect(noDeposit).not.toContain("епозит"); // neither returned nor promised
    expect(noDeposit).not.toContain("км"); // no odometer → no invented numbers
  });

  it("lifecycle-messaging accepts a rideSummary and renders the draft (italic HTML)", () => {
    const src = read("app/franchize/lib/lifecycle-messaging.ts");
    expect(src).toContain("rideSummary?: RideSummary | null");
    expect(src).toContain("buildSuggestedYandexReview(summary)");
    expect(src).toContain("escapeTelegramHtml");
    expect(src).toContain("<i>");
  });

  it("both closure paths feed summarizeRide (webhook + dashboard parity)", () => {
    const actions = read("app/rentals/actions.ts");
    expect(actions).toMatch(/odometerBefore: nudgeOdoBefore/);
    expect(actions).toMatch(/odometerAfter: closureData\?\.odometerAfter \?\? null/);

    const dashboard = read("app/franchize/server-actions/rentals-dashboard.ts");
    expect(dashboard).toContain("notifyRideFinishedAndSuggestPost");
    // dashboard path reads fresh odometer from the ACTION parameter (metadata is pre-update)
    expect(dashboard).toContain("odometerAfter ?? null");
  });
});

// ── 10. fullscreen viewer polish (shared gesture engine) ────────────────────

describe("fullscreen photo viewer: shared engine + top-center close", () => {

  it("engine consumers: wall lightbox, map lightbox, rental ДО/ПОСЛЕ lightbox", () => {
    for (const file of [
      "app/franchize/[slug]/community/CommunityWallClient.tsx",
      "components/map-riders/MapPhotoLightbox.tsx",
      "app/franchize/components/RentalPhotoGallery.tsx",
    ]) {
      expect(read(file)).toContain("usePhotoZoomGestures(");
    }
  });

  it("map lightbox: close at TOP CENTER, pinch zoom, tap-outside + swipe-down close", () => {
    const src = read("components/map-riders/MapPhotoLightbox.tsx");
    expect(src).toContain("left-1/2 top-3");
    expect(src).toContain("dismissOnDragDown: true");
    expect(src).toContain("closeOnTapOutside: true");
  });

  it("rental lightbox: keyboard nav lives INSIDE the lightbox (no double-skip)", () => {
    const src = read("app/franchize/components/RentalPhotoGallery.tsx");
    expect(src).toContain("closeOnTapOutside: true");
    expect(src).toContain("function RentalPhotoLightbox");
    // old duplicate parent-level listener removed
    expect(src).not.toContain("ArrowLeft\" && lightboxIndex > 0");
  });
});

// ── 11. quick-rent deeplink on post notifications (boss 2026-10-01) ─────────

describe("quick-rent deeplink: buildWallRentButton (pure)", () => {
  it("builds the boss example: vip-bike metadata bot + rent_bmw-f800r", () => {
    const btn = buildWallRentButton({
      bikes: [{ bikeId: "bmw-f800r", title: "BMW F 800 R" }],
      botUsername: "oneBikePlsBot", // metadata.franchize.contacts.telegramBotUsername
    });
    expect(btn).toEqual({
      text: "🏍 Арендовать «BMW F 800 R»",
      url: "https://t.me/oneBikePlsBot/app?startapp=rent_bmw-f800r",
    });
  });

  it("strips @ from the bot handle (metadata sometimes stores it)", () => {
    const btn = buildWallRentButton({
      bikes: [{ bikeId: "kawasaki-ex650k", title: "Kawasaki EX650K" }],
      botUsername: "@oneBikePlsBot",
    });
    expect(btn?.url).toBe("https://t.me/oneBikePlsBot/app?startapp=rent_kawasaki-ex650k");
  });

  it("first round-trippable bike wins; ids that would break the rent_ grammar are skipped", () => {
    const btn = buildWallRentButton({
      bikes: [
        { bikeId: "bad_id_with_underscore", title: "Broken" }, // parseRentDeepLink splits on _
        { bikeId: "bmw-f800r", title: "BMW F 800 R" },
      ],
      botUsername: "oneBikePlsBot",
    });
    expect(btn?.url).toContain("startapp=rent_bmw-f800r");
  });

  it("no bot / no bikes / no eligible bike → null (caller keeps the ordinary post button)", () => {
    expect(buildWallRentButton({ bikes: [{ bikeId: "bmw-f800r" }], botUsername: null })).toBeNull();
    expect(buildWallRentButton({ bikes: [], botUsername: "oneBikePlsBot" })).toBeNull();
    expect(buildWallRentButton({ botUsername: "oneBikePlsBot" })).toBeNull();
    expect(
      buildWallRentButton({ bikes: [{ bikeId: "still_bad_id" }], botUsername: "oneBikePlsBot" }),
    ).toBeNull();
  });

  it("label: long models truncate to keep the row narrow; missing model → neutral call", () => {
    expect(bikeRentButtonLabel("Ducati 1199 Panigale S Tricolore")).toBe(
      "🏍 Арендовать «Ducati 1199 Panigale S…»",
    );
    expect(bikeRentButtonLabel("  ")).toBe("🏍 Быстрая аренда");
    expect(bikeRentButtonLabel(null)).toBe("🏍 Быстрая аренда");
  });
});

describe("quick-rent deeplink: notification wiring (source contracts)", () => {
  it("renter fanout: bikes come in the author's attach order + rent row precedes the post row", () => {
    const src = read(LIB);
    expect(src).toContain('buildWallRentButton({ bikes, botUsername })');
    expect(src).toContain('.order("position", { ascending: true })');
    const rentIdx = src.indexOf("if (rentButton) keyboard.push([rentButton]);");
    const postIdx = src.indexOf('keyboard.push([{ text: "🟣 Открыть пост", url: deeplink }]);');
    expect(rentIdx).toBeGreaterThan(-1);
    expect(postIdx).toBeGreaterThan(rentIdx); // rent first — the headline action
  });

  it("crew notification (wall-notify): same button from input.bikes + crew bot from metadata", () => {
    const src = read("app/franchize/lib/wall-notify.ts");
    expect(src).toContain("buildWallRentButton({ bikes: input.bikes, botUsername: crewBot })");
    expect(src).toContain("resolveCrewBotUsername(input.slug)");
    // без байка раскладка прежняя — «Открыть стену» остаётся
    expect(src).toContain('keyboard.push([{ text: "🟣 Открыть стену", url: deeplink }]);');
  });

  it("createCommunityPostAction feeds bikeRefs (id + model) into the notify", () => {
    const src = read(WALL_ACTION);
    expect(src).toContain("bikes: bikeRefs.map((b) => ({ bikeId: b.bikeId, title: b.title })),");
  });

  it("button builder is pure string plumbing (no transport imports in the grammar path)", () => {
    const src = read("app/franchize/lib/community-wall.ts");
    expect(src).toContain('import { bikeRentStartParam, buildTelegramAppLink } from "@/lib/wall-deeplink";');
  });
});

// ── 12. boss polish pack 2026-10-01: photo + creator copy + link fixes ──────

describe("post notification carries the post image (sendPhoto via forward API)", () => {
  it("renter fanout selects photo rows and passes the cover into the deliver helper", () => {
    const src = read(LIB);
    // rows (not head-count) — the first one becomes the sendPhoto cover
    expect(src).toContain('.select("storage_path")');
    expect(src).toContain(".order(\"position\", { ascending: true })");
    expect(src).toContain("wallPhotoPublicUrl(photoRows[0])");
    // delivery goes through the photo-capable helper for EVERY recipient
    expect(src).toContain("deliverWallPostNotify(chatId, text, replyMarkup, coverPhotoUrl)");
    // the old head-count photo probe is gone
    expect(src).not.toContain('select("id", { count: "exact", head: true })');
  });

  it("crew fanout (wall-notify) takes coverPhotoUrl and delivers via the same helper", () => {
    const src = read("app/franchize/lib/wall-notify.ts");
    expect(src).toContain("coverPhotoUrl?: string | null");
    expect(src).toContain("deliverWallPostNotify(chatId, text, replyMarkup, input.coverPhotoUrl)");
    // createCommunityPostAction feeds the first photo view as the cover
    const action = read(WALL_ACTION);
    expect(action).toContain("coverPhotoUrl: photoViews[0]?.url ?? null");
  });

  it("deliver helper: sendPhoto with caption+buttons, sendMessage fallback, never throws", async () => {
    const deliver = vi.mocked(telegramDeliver);
    const kb = { inline_keyboard: [[{ text: "🟣 Открыть пост", url: "https://t.me/oneBikePlsBot/app?startapp=wall_vip-bike" }]] };

    // photo present → sendPhoto carries photo, HTML caption and the SAME buttons
    deliver.mockResolvedValueOnce({ ok: true, via: "forward", messageId: 42 });
    const withPhoto = await deliverWallPostNotify("100", "<b>пост</b>", kb, "https://supabase/wallpix/posts/p/0.jpg");
    expect(deliver).toHaveBeenLastCalledWith("sendPhoto", "100", expect.objectContaining({
      photo: "https://supabase/wallpix/posts/p/0.jpg",
      caption: "<b>пост</b>",
      parse_mode: "HTML",
      reply_markup: kb,
    }));
    expect(withPhoto).toEqual({ ok: true, via: "sendPhoto", messageId: 42 });

    // sendPhoto fails (TG can't fetch the URL) → ONE sendMessage fallback with buttons
    deliver.mockReset();
    deliver.mockResolvedValueOnce({ ok: false, error: "failed to get HTTP URL content" });
    deliver.mockResolvedValueOnce({ ok: true, via: "forward", messageId: 43 });
    const fallback = await deliverWallPostNotify("100", "<b>пост</b>", kb, "https://dead.example/x.jpg");
    expect(deliver).toHaveBeenCalledTimes(2);
    expect(deliver).toHaveBeenLastCalledWith("sendMessage", "100", expect.objectContaining({
      text: "<b>пост</b>",
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup: kb,
    }));
    expect(fallback).toEqual({ ok: true, via: "sendMessage", messageId: 43 });

    // no photo → straight sendMessage (old behaviour, zero extra cost)
    deliver.mockReset();
    deliver.mockResolvedValueOnce({ ok: true, via: "forward", messageId: 44 });
    const noPhoto = await deliverWallPostNotify("100", "текст", null, null);
    expect(deliver).toHaveBeenCalledTimes(1);
    expect(deliver).toHaveBeenLastCalledWith("sendMessage", "100", expect.objectContaining({ text: "текст" }));
    expect(noPhoto.via).toBe("sendMessage");
  });

  it("caption guard keeps the photo caption inside the Telegram 1024 limit", () => {
    expect(capWallNotifyCaption("x".repeat(2000)).length).toBeLessThanOrEqual(1000);
    expect(capWallNotifyCaption("короткий")).toBe("короткий");
  });
});

describe("creator broadcast copy («be aware what was broadcasted»)", () => {
  it("creator HTML leads with the broadcast header + audience counter, then the same content", () => {
    const html = buildWallBroadcastCreatorHtml({
      body: "Каталог пополнен",
      photoCount: 3,
      bikeTitles: ["BMW F 800 R"],
      hasStats: false,
      recipients: 28,
    });
    expect(html).toContain("📤 <b>Ваш пост разослан прошлым арендаторам экипажа</b>");
    expect(html).toContain("👥 28 получателей");
    expect(html).toContain("💬 «Каталог пополнен»");
    expect(html).toContain("📷 3 фото");
    expect(html).toContain("🏍 BMW F 800 R");
    // no author line — the creator knows whose post it is
    expect(html).not.toContain("👤");
  });

  it("failed count surfaces when non-zero; singular/plural ru forms", () => {
    expect(buildWallBroadcastCreatorHtml({ body: "", photoCount: 0, bikeTitles: [], hasStats: false, recipients: 1, failed: 2 }))
      .toContain("👥 1 получатель · 2 не доставлено");
    expect(buildWallBroadcastCreatorHtml({ body: "", photoCount: 0, bikeTitles: [], hasStats: false, recipients: 3 }))
      .toContain("👥 3 получателя");
  });

  it("renter fanout sends the copy to the AUTHOR once per job (creator_notified ledger flag)", () => {
    const src = read(LIB);
    expect(src).toContain("creator_notified?: boolean");
    expect(src).toContain("if (!job.creator_notified)");
    expect(src).toContain("buildWallBroadcastCreatorHtml");
    expect(src).toContain("deliverWallPostNotify(post.author_id, creatorText, replyMarkup, coverPhotoUrl)");
    // flag persisted right after a successful creator delivery
    expect(src).toContain("creator_notified: true");
    // …and the tolerant parser reads the flag without breaking old jobs
    const legacy = parseNotifyJob({
      notify_job: {
        status: "queued",
        audience: "recent",
        requested_by: "user-1",
        created_at: "2026-09-29T10:00:00Z",
        finished_at: null,
        sent_user_ids: [],
        sent: 0,
        failed: 0,
        error: null,
      },
    });
    expect(legacy?.creator_notified).toBe(false);
  });
});

describe("post bike chip opens the actual bike rental page (404 fix)", () => {
  it("chip links ?vehicle=<bikeId>&flow=rent — the destination rent_<bikeId> resolves to", () => {
    const src = read("app/franchize/[slug]/community/CommunityWallClient.tsx");
    // the dead route is gone
    expect(src).not.toContain("href={`/franchize/${slug}/catalog`}");
    // the chip now deep-links the bike modal on the crew page
    expect(src).toContain("href={`/franchize/${slug}?vehicle=${encodeURIComponent(bike.bikeId)}&flow=rent`}");
  });
});
