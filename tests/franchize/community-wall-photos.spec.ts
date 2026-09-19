// tests/franchize/community-wall-photos.spec.ts
//
// OnlyBike wall v2 (photos + bike mentions + notifications):
//   1. Unit tests for the pure helpers in lib/community-wall.ts:
//      staging-path validation, photo/bike payload sanitizers, public URL
//      builder, TG-notification HTML builder.
//   2. Wiring/source assertions:
//      - migration 20260919220000: tables + public wallpix bucket + policies;
//      - server-actions: staging-only photo paths, crew-scope bike check,
//        storage move + cleanup, AWAITED crew notification (Vercel freeze
//        lesson), bike-picker action;
//      - upload route: cookie + initData identity, sharp pipeline parity;
//      - client: rental-page compression reuse, pinch lightbox, full-width wall;
//      - page.tsx: legacy contentBlocks (events/guide/partners) are GONE;
//      - useStartParamRouter routes wall_<slug> → community page.
//
// Run: npx vitest run tests/franchize/community-wall-photos.spec.ts

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildWallPostNotifyHtml,
  buildWallPostPreview,
  computeZoomOffset,
  isWallStagingPath,
  sanitizeWallBikeIds,
  sanitizeWallPhotoInputs,
  wallPhotoPublicUrl,
  zoomAtPoint,
  WALL_BIKES_MAX,
  WALL_PHOTOS_MAX,
} from "@/app/franchize/lib/community-wall";

const ROOT = process.cwd();
const APP = "app/franchize";
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

// ── 1. pure helpers ──────────────────────────────────────────────────────────

describe("isWallStagingPath", () => {
  it("accepts the actor's own staging folder with a sane file name", () => {
    expect(isWallStagingPath("staging/user-42/8f3c9a2b1d4e5f6a7b8c9d0e1f2a3b4c.jpg", "user-42")).toBe(true);
    expect(isWallStagingPath("staging/user-42/abcdef12.webp", "user-42")).toBe(true);
  });

  it("rejects other users' folders, finals, traversal and junk", () => {
    const own = "staging/user-42/8f3c9a2b1d4e5f6a7b8c9d0e1f2a3b4c.jpg";
    expect(isWallStagingPath("staging/someone-else/8f3c9a2b1d4e5f6a7b8c9d0e1f2a3b4c.jpg", "user-42")).toBe(false);
    expect(isWallStagingPath("posts/post-9/1.jpg", "user-42")).toBe(false);
    expect(isWallStagingPath("staging/user-42/../../crews/x.jpg", "user-42")).toBe(false);
    expect(isWallStagingPath("staging/user-42/short.jpg", "user-42")).toBe(false); // < 8 chars
    expect(isWallStagingPath("staging/user-42/8f3c9a2b1d4e5f6a7b8c9d0e1f2a3b4c.gif", "user-42")).toBe(false);
    expect(isWallStagingPath("", "user-42")).toBe(false);
    expect(isWallStagingPath(own, "")).toBe(false);
  });
});

describe("sanitizeWallPhotoInputs", () => {
  const good = (path: string, extra: Record<string, unknown> = {}) => ({ path, ...extra });
  const PATH_A = "staging/u1/11111111111111111111111111111111.jpg";
  const PATH_B = "staging/u1/22222222222222222222222222222222.jpg";

  it("passes undefined/null through as [] (no photos attached)", () => {
    expect(sanitizeWallPhotoInputs(undefined, "u1")).toEqual([]);
    expect(sanitizeWallPhotoInputs(null, "u1")).toEqual([]);
  });

  it("keeps valid photos, drops junk dimensions, dedupes paths", () => {
    const out = sanitizeWallPhotoInputs(
      [good(PATH_A, { width: 1280, height: 960, bytes: 150000 }), good(PATH_B, { width: -5, height: "x" }), good(PATH_A)],
      "u1",
    );
    expect(out).toEqual([
      { path: PATH_A, width: 1280, height: 960, bytes: 150000 },
      { path: PATH_B, width: null, height: null, bytes: null },
    ]);
  });

  it("rejects: too many, someone else's staging path, wrong shape", () => {
    const many = Array.from({ length: WALL_PHOTOS_MAX + 1 }, (_, i) =>
      good(`staging/u1/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa${i}.jpg`),
    );
    expect(sanitizeWallPhotoInputs(many, "u1")).toBeNull();
    expect(sanitizeWallPhotoInputs([good("staging/other/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.jpg")], "u1")).toBeNull();
    expect(sanitizeWallPhotoInputs([good("posts/x/0.jpg")], "u1")).toBeNull();
    expect(sanitizeWallPhotoInputs(["staging/u1/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.jpg"], "u1")).toBeNull();
    expect(sanitizeWallPhotoInputs("nope", "u1")).toBeNull();
  });
});

describe("sanitizeWallBikeIds", () => {
  // cars.id is TEXT — real catalogue slugs, NOT uuids (migration 42804 lesson).
  const SLUG_A = "kawasaki-ex650k";
  const SLUG_B = "suzuki-boulevard";

  it("accepts catalogue slugs (and uuids), dedupes, caps at WALL_BIKES_MAX", () => {
    expect(sanitizeWallBikeIds([SLUG_A, SLUG_B, SLUG_A])).toEqual([SLUG_A, SLUG_B]);
    expect(sanitizeWallBikeIds(["11111111-1111-1111-1111-111111111111"])).not.toBeNull();
    expect(sanitizeWallBikeIds(undefined)).toEqual([]);
    const many = Array.from({ length: WALL_BIKES_MAX + 1 }, () => SLUG_A);
    expect(sanitizeWallBikeIds(many)).toBeNull();
  });

  it("rejects junk: whitespace, control chars, overlong ids, non-strings", () => {
    expect(sanitizeWallBikeIds(["not a slug"])).toBeNull(); // space
    expect(sanitizeWallBikeIds(["два"])).toBeNull(); // non-ascii
    expect(sanitizeWallBikeIds(["a".repeat(129)])).toBeNull(); // overlong
    expect(sanitizeWallBikeIds([42])).toBeNull();
    expect(sanitizeWallBikeIds("x")).toBeNull();
  });
});

describe("wallPhotoPublicUrl", () => {
  it("builds the public object URL from the env base and encodes segments", () => {
    const prev = process.env.NEXT_PUBLIC_SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://inmctohsodgdohamhzag.supabase.co/";
    try {
      expect(wallPhotoPublicUrl("posts/post-1/0.jpg")).toBe(
        "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/wallpix/posts/post-1/0.jpg",
      );
    } finally {
      if (prev === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      else process.env.NEXT_PUBLIC_SUPABASE_URL = prev;
    }
  });
});

describe("wall notify builder", () => {
  it("builds an HTML message with author, preview, photos, bikes and stats", () => {
    const html = buildWallPostNotifyHtml({
      authorName: "Виктор <3",
      body: "Первый заезд на <b>Falcon</b>",
      photoCount: 2,
      bikeTitles: ["79bike Falcon PRO"],
      hasStats: true,
    });
    expect(html).toContain("🟣 <b>Новый пост на стене экипажа</b>");
    expect(html).toContain("Виктор &lt;3");
    expect(html).toContain("&lt;b&gt;Falcon&lt;/b&gt;");
    expect(html).toContain("📷 2 фото");
    expect(html).toContain("🏍 79bike Falcon PRO");
    expect(html).toContain("📊");
  });

  it("preview collapses whitespace and ellipsizes long bodies", () => {
    expect(buildWallPostPreview("  a\n\nb  ")).toBe("a b");
    const long = "x".repeat(500);
    const cut = buildWallPostPreview(long, 220);
    expect(cut.length).toBeLessThanOrEqual(220);
    expect(cut.endsWith("…")).toBe(true);
    expect(buildWallPostPreview(null)).toBe("");
  });
});

describe("lightbox zoom math (pure)", () => {
  const CENTER = { x: 500, y: 400 };

  it("zoom at screen centre keeps the offset at zero (from natural state)", () => {
    const offset = zoomAtPoint(1, { x: 0, y: 0 }, CENTER, CENTER, 2.5);
    expect(offset.x).toBeCloseTo(0, 6);
    expect(offset.y).toBeCloseTo(0, 6);
  });

  it("keeps the zoomed point visually anchored (pinch midpoint stays put)", () => {
    // zoom to 2 around an off-centre point: that point must not move
    const point = { x: 700, y: 250 };
    const before = zoomAtPoint(1, { x: 0, y: 0 }, point, CENTER, 2);
    // screen position of the content point after transform:
    // screen = center + offset + (content - center) * scale; invert for content:
    const content = {
      x: (point.x - CENTER.x - before.x) / 2,
      y: (point.y - CENTER.y - before.y) / 2,
    };
    const after = zoomAtPoint(2, before, point, CENTER, 4);
    const screenAfter = {
      x: CENTER.x + after.x + content.x * 4,
      y: CENTER.y + after.y + content.y * 4,
    };
    expect(screenAfter.x).toBeCloseTo(point.x, 4);
    expect(screenAfter.y).toBeCloseTo(point.y, 4);
  });

  it("pinch after pan preserves the pan (ratio-scaled, no snap to centre)", () => {
    const startOffset = { x: 120, y: -80 };
    const out = computeZoomOffset({
      startScale: 2,
      startOffset,
      startMid: CENTER,
      currentMid: CENTER,
      center: CENTER,
      nextScale: 3,
    });
    // mid = centre → o' = o * r
    expect(out.x).toBeCloseTo(180, 6);
    expect(out.y).toBeCloseTo(-120, 6);
  });
});

// ── 2. migration ─────────────────────────────────────────────────────────────

describe("migration 20260919220000 (photos + bikes + wallpix)", () => {
  const src = read("supabase/migrations/20260919220000_onlybike_wall_photos_bikes.sql");

  it("creates both tables with FK cascades + denormalized crew_id", () => {
    expect(src).toContain("CREATE TABLE IF NOT EXISTS public.crew_post_photos");
    expect(src).toContain("CREATE TABLE IF NOT EXISTS public.crew_post_bikes");
    expect(src).toContain("REFERENCES public.crew_posts(id) ON DELETE CASCADE");
    expect(src).toContain("REFERENCES public.cars(id) ON DELETE CASCADE");
    expect(src.match(/crew_id uuid NOT NULL REFERENCES public.crews/g)?.length).toBe(2);
    expect(src).toContain("position integer NOT NULL DEFAULT 0");
  });

  it("RLS: public read policies, no anon writes", () => {
    expect(src).toContain("ENABLE ROW LEVEL SECURITY");
    expect(src).toContain('"Public can read crew post photos"');
    expect(src).toContain('"Public can read crew post bikes"');
    expect(src).not.toMatch(/FOR INSERT/);
  });

  it("public wallpix bucket with size cap + mime allowlist + public read policy", () => {
    expect(src).toContain("'wallpix'");
    expect(src).toContain("5242880");
    expect(src).toContain("ARRAY['image/jpeg', 'image/png', 'image/webp']");
    expect(src).toContain('ON CONFLICT (id) DO UPDATE');
    expect(src).toContain('"Public read wallpix objects"');
    expect(src).toContain("bucket_id = 'wallpix'");
  });
});

// ── 3. server actions wiring ─────────────────────────────────────────────────

describe("community-wall server actions (v2)", () => {
  const src = read(`${APP}/server-actions/community-wall.ts`);

  it("create: staging-only photos + crew-scope bikes, both sanitized with the actor id", () => {
    expect(src).toContain("sanitizeWallPhotoInputs(parsed.data.photos, actor.userId)");
    expect(src).toContain("sanitizeWallBikeIds(parsed.data.bikes)");
    expect(src).toContain('WALL_PHOTOS_MAX} на пост');
    expect(src).toContain("WALL_BIKES_MAX}.");
  });

  it("create: photo-only posts are allowed; fully empty posts are not", () => {
    expect(src).toContain("photos.length === 0 && bikeIds.length === 0");
    expect(src).toContain("напиши пару слов или прикрепи фото");
  });

  it("bikes must belong to THIS crew's catalogue (count equality check)", () => {
    expect(src).toContain('.from("cars")');
    expect(src).toContain('.eq("crew_id", crew.id)');
    expect(src).toContain("rows.length !== bikeIds.length");
    expect(src).toContain("не из каталога этого экипажа");
  });

  it("photos move staging → posts/<postId>/<n>.jpg, then rows insert (position i)", () => {
    expect(src).toContain(".move(photo.path, target)");
    expect(src).toContain("posts/${postId}/${i}.jpg");
    expect(src).toContain('.from("crew_post_photos")');
    expect(src).toContain("byte_size: photo.bytes");
    expect(src).toContain("position: i");
    // move failure = photo skipped (staging TTL would break the image later)
    expect(src).toContain("photo move attempt ${attempt + 1} failed:");
    expect(src).toContain("via the TTL janitor instead of becoming a broken image later");
  });

  it("bike mention rows insert into crew_post_bikes", () => {
    expect(src).toContain('.from("crew_post_bikes")');
    expect(src).toContain("bike_id: ref.bikeId");
  });

  it("crew notification is AWAITED after insert and excludes the author", () => {
    expect(src).toContain("await notifyNewWallPost(");
    expect(src).toContain("excludeUserId: actor.userId");
    expect(src).toContain("fire-and-forget freezes on");
  });

  it("feed loads photos + bike mentions for the page posts only", () => {
    expect(src).toContain('.from("crew_post_photos")');
    expect(src).toContain(".in(\"post_id\", postIds)");
    expect(src).toContain('.order("position", { ascending: true })');
    expect(src).toContain("cars(id, model, image_url)");
    expect(src).toContain("wallPhotoPublicUrl(row.storage_path)");
  });

  it("delete cleans up wallpix objects after the row delete", () => {
    expect(src).toContain('.select("storage_path")');
    expect(src).toContain(`.from(WALLPHOTO_BUCKET).remove(photoPaths)`);
  });

  it("bike picker action: crew bikes only, capped, ordered", () => {
    expect(src).toContain("getWallBikeOptionsAction");
    expect(src).toContain('.eq("type", "bike")');
    expect(src).toContain(".limit(60)");
  });

  it("like toggles are rate-braked too (writes are writes)", () => {
    expect(src).toContain("assertLikeRate(actor.userId)");
    const access = read(`${APP}/lib/wall-access.ts`);
    expect(access).toContain("WALL_RATE_LIKES_PER_HOUR = 120");
  });

  it("cursor is validated (parseable date) before it reaches PostgREST", () => {
    expect(src).toContain("before must be a parseable ISO date");
  });

  it("comment preview budget has headroom against starvation", () => {
    expect(src).toContain("WALL_COMMENT_PREVIEW * 3");
  });

  it("ghost guard: notify skipped + photos cleaned if post vanished", () => {
    expect(src).toContain("post vanished before notify");
    expect(src).toContain("photoFinalPaths");
  });


  it("photo move retried once; persistent failure skips the photo row entirely", () => {
    expect(src).toContain("attempt < 2 && finalPath === null");
    expect(src).toContain("if (finalPath === null)");
    expect(src).toContain("via the TTL janitor instead of becoming a broken image later");
  });

  it("shared access helpers moved to lib/wall-access (imported, not duplicated)", () => {
    expect(src).toContain('from "@/app/franchize/lib/wall-access"');
    const access = read(`${APP}/lib/wall-access.ts`);
    expect(access).toContain("export async function resolveWallActor");
    expect(access).toContain("export async function canWriteOnWall");
    expect(access).toContain("export async function assertWallRate");
    expect(access).toContain("export async function ensureUserProfile");
  });
});

// ── 4. upload route (rental-page pipeline parity) ────────────────────────────

describe("wall-photo-upload route", () => {
  const src = read("app/api/franchize/wall-photo-upload/route.ts");

  it("identity: signed cookie first, HMAC-verified initData fallback", () => {
    expect(src).toContain("verifyTelegramActorCookieValue");
    expect(src).toContain("computeTelegramWebAppHash");
    expect(src).toContain("isTelegramInitDataFresh");
    expect(src).toContain("parseTelegramInitDataUser");
  });

  it("write scope: canWriteOnWall for the slug's crew (staff or ≥1 rental)", () => {
    expect(src).toContain("canWriteOnWall(callerUserId, crewRow)");
    expect(src).toContain('getCrewBySlug(slug)');
  });

  it("sharp pipeline parity with rental photos (1280px, mozjpeg q75 → ≤500KB)", () => {
    expect(src).toContain('from "sharp"');
    expect(src).toContain(".rotate()");
    expect(src).toContain("MAX_DIMENSION = 1280");
    expect(src).toContain("MAX_SIZE_BYTES = 500 * 1024");
    expect(src).toContain("QUALITY_FLOOR = 50");
    expect(src).toContain('mozjpeg: true');
  });

  it("uploads into the actor's OWN staging folder with a RE-safe name", () => {
    expect(src).toContain("staging/${callerUserId}");
    expect(src).toContain("randomUUID().replace(/-/g, \"\")");
    expect(src).toContain("upsert: false");
    expect(src).toContain("WALLPHOTO_BUCKET");
  });

  it("staging lifecycle is honest: quota 429 + TTL janitor per upload + script", () => {
    expect(src).toContain("WALL_STAGING_QUOTA");
    expect(src).toContain("WALL_STAGING_TTL_HOURS");
    expect(src).toContain("Слишком много черновых фото");
    expect(src).toContain(".list(stagingPrefix, { limit: 200");
    expect(src).toContain(".emptyFolderPlaceholder");
    const janitor = read("scripts/cleanup-wallpix-staging.mjs");
    expect(janitor).toContain("wallpix");
    expect(janitor).toContain("--dry-run");
    expect(janitor).toContain("--ttl-hours=");
    expect(janitor).toContain("async function listAll"); // offset pagination
    const cronRoute = read("app/api/cron/cleanup-wallpix-staging/route.ts");
    expect(cronRoute).toContain("x-vercel-cron");
    expect(cronRoute).toContain("CLEANUP_WALLPIX_TOKEN");
    expect(cronRoute).toContain("timingSafeEqual"); // timing-safe token compare
    expect(cronRoute).toContain("TIME_BUDGET_MS"); // liveness: partial passes durably
    expect(cronRoute).toContain("purgeFolder"); // remove INSIDE the scan loop
    const vercel = JSON.parse(read("vercel.json"));
    expect(vercel.crons.some((c: { path: string }) => c.path === "/api/cron/cleanup-wallpix-staging")).toBe(true);
  });


  it("no raw sharp/stack errors over the wire — generic message + hint only", () => {
    expect(src).toContain("Не удалось обработать фото");
    expect(src).toContain("const hint = error instanceof Error");
  });
});

// ── 5. client ────────────────────────────────────────────────────────────────

describe("community wall client (v2)", () => {
  const src = read(`${APP}/[slug]/community/CommunityWallClient.tsx`);

  it("photo attach REUSES the rental-page compression lib (1600px, q0.72)", () => {
    expect(src).toContain('from "@/lib/client-image-compress"');
    expect(src).toContain("maxSize: 1600");
    expect(src).toContain("quality: 0.72");
    expect(src).toContain('fetch("/api/franchize/wall-photo-upload"');
  });

  it("composer caps: photos ≤ WALL_PHOTOS_MAX, bikes ≤ WALL_BIKES_MAX", () => {
    expect(src).toContain("WALL_PHOTOS_MAX");
    expect(src).toContain("WALL_BIKES_MAX");
    expect(src).toContain("getWallBikeOptionsAction");
  });

  it("publish waits for pending uploads and blocks on failed ones", () => {
    expect(src).toContain("pendingUploads");
    expect(src).toContain("failedUploads");
    expect(src).toContain("Часть фото не загрузилось");
  });

  it("fullscreen lightbox: pinch-zoom, pan, double-tap, swipe nav, scroll lock", () => {
    expect(src).toContain("function PhotoLightbox");
    expect(src).toContain("onPointerDown");
    expect(src).toContain("onDoubleClick");
    // wheel is a NATIVE { passive: false } listener (React root wheel is passive)
    expect(src).toContain('el.addEventListener("wheel", onWheelNative, { passive: false })');
    expect(src).toContain('lastPointerType.current !== "mouse"');
    expect(src).toContain("stageRef.current");
    expect(src).toContain("pointers.current.size === 2");
    expect(src).toContain("document.body.style.overflow = \"hidden\"");
    expect(src).toContain("touchAction: \"none\"");
    expect(src).toContain("Math.abs(dx) > 60");
    // desktop zoom uses dblclick; the double-tap detector ignores mice
    expect(src).toContain('e.pointerType !== "mouse"');
    // zoom math goes through the pure, unit-tested helpers
    expect(src).toContain("computeZoomOffset({");
    expect(src).toContain("zoomAtPoint(");
  });

  it("notification spam budget: chatty authors stop waking all members", () => {
    const notify = read(`${APP}/lib/wall-notify.ts`);
    expect(notify).toContain("WALL_NOTIFY_MEMBER_FANOUT_THRESHOLD = 3");
    expect(notify).toContain("includeMembers: !quietMode");
    const actions = read(`${APP}/server-actions/community-wall.ts`);
    expect(actions).toContain("recentAuthorPosts: authorPostsLastHour");
    expect(actions).toContain("authorPostsLastHour = rate.ok ? rate.posts : 0");
  });

  it("original photo blob is revoked when the compressed preview replaces it", () => {
    expect(src).toContain("URL.revokeObjectURL(placeholder.previewUrl)");
    const sharedLib = read("lib/client-image-compress.ts");
    expect(sharedLib.match(/revokeObjectURL\(objectUrl\)/g)?.length).toBe(2);
  });

  it("wall spans the FULL page width (border-y band, no max-w container)", () => {
    expect(src).toContain("w-full border-y border-[var(--community-border)]");
  });

  it("post cards render photo grid + bike mention chips linking to the catalogue", () => {
    expect(src).toContain("function PostPhotoGrid");
    expect(src).toContain("function PostBikeChips");
    expect(src).toContain("/franchize/${slug}/catalog");
  });
});

// ── 6. page: legacy filler removed, wall outside the max-w wrapper ──────────

describe("community page (legacy ditched)", () => {
  const src = read(`${APP}/[slug]/community/page.tsx`);

  it("no more events/guide/partners dummy content", () => {
    expect(src).not.toContain("communityEvents");
    expect(src).not.toContain("partnerCards");
    expect(src).not.toContain("cityRiderTips");
    expect(src).not.toContain("Куда ехать с");
    expect(src).not.toContain("как это работает");
  });

  it("keeps the live CTAs and renders the wall as the full-width page body", () => {
    expect(src).toContain("Стена экипажа {brandName}");
    expect(src).toContain("<CommunityWallClient");
    expect(src).toContain("map-riders");
    expect(src).toContain("FULL PAGE WIDTH");
  });

  it("metadata describes the wall, not the old schedule", () => {
    expect(src).toContain("Живая стена экипажа");
  });
});

// ── 7. deep link routing ─────────────────────────────────────────────────────

describe("useStartParamRouter: wall deep links", () => {
  const src = read("hooks/useStartParamRouter.ts");

  it("wall → own crew community, wall_<slug> → that crew's community", () => {
    expect(src).toContain('paramToProcess === "wall" || paramToProcess.startsWith("wall_")');
    expect(src).toContain("`/franchize/${wallSlug}/community`");
    expect(src).toContain("lib/wall-notify.ts");
  });
});
