// tests/franchize/map-wall-interlink.spec.ts
//
// Interlink карта ⇄ стена (Chain-style):
//   · ride_<sessionId>_<slug> deeplink grammar (parse/build/roundtrip);
//   · NN moto-spots catalog sanity (unique ids, NN bbox, kind meta);
//   · spots ↔ SQL migration sync (crews.slug = spot.slug both ways);
//   · ride-draft text builder (exact copy, NaN-safety);
//   · source asserts: router fast-path + wall page params wiring.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  isUuidLike,
  parseWallDeepLink,
  wallRideStartParam,
} from "@/lib/wall-deeplink";
import {
  buildSpotCheckinText,
  findMotoSpotById,
  MOTO_SPOT_KINDS,
  NN_MOTO_SPOTS,
  motoSpotKindIcon,
  motoSpotKindLabel,
} from "@/lib/map-riders-spots";
import { buildRideSessionDraftText } from "@/app/franchize/lib/community-wall";
import { meetupDraftFromPost } from "@/lib/map-riders";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

const SESSION_ID = "1f2e3d4c-5b6a-4789-9abc-def012345678";
const SLUG = "vip-bike";

// ── ride_ deeplink grammar ───────────────────────────────────────────────────

describe("ride_ deeplink (map-riders session → wall composer)", () => {
  it("parses ride_<sessionId>_<slug>", () => {
    expect(parseWallDeepLink(`ride_${SESSION_ID}_${SLUG}`)).toEqual({
      kind: "compose-ride",
      sessionId: SESSION_ID,
      slug: SLUG,
    });
  });

  it("rejects malformed payloads (no bare fallback, like wallp_)", () => {
    expect(parseWallDeepLink(`ride_${SESSION_ID}`)).toBeNull();
    expect(parseWallDeepLink("ride_not-a-uuid_vip-bike")).toBeNull();
    expect(parseWallDeepLink(`ride_${SESSION_ID}_../../etc`)).toBeNull();
    expect(parseWallDeepLink("ride_")).toBeNull();
    // underscore-slug safety: first segment must still be a uuid
    expect(parseWallDeepLink(`ride_${SESSION_ID}_my_crew`)).toEqual({
      kind: "compose-ride",
      sessionId: SESSION_ID,
      slug: "my_crew",
    });
  });

  it("builds a ≤64-char startapp param and roundtrips through the parser", () => {
    const param = wallRideStartParam(SESSION_ID, SLUG);
    expect(param.length).toBeLessThanOrEqual(64);
    expect(param.startsWith(`ride_${SESSION_ID}_`)).toBe(true);
    const parsed = parseWallDeepLink(param);
    expect(parsed).toEqual({ kind: "compose-ride", sessionId: SESSION_ID, slug: SLUG });
  });

  it("truncates over-budget slugs to a valid ≤64 prefix (wallp_ semantics)", () => {
    const longSlug = "a-very-long-crew-slug-that-definitely-does-not-fit-64";
    const param = wallRideStartParam(SESSION_ID, longSlug);
    expect(param.length).toBeLessThanOrEqual(64);
    // Same rationale as wallp_: a truncated slug lands on a possibly-wrong
    // crew, and getWallRideDraftAction re-verifies crew_slug server-side.
    const parsed = parseWallDeepLink(param);
    expect(parsed && parsed.kind === "compose-ride" ? parsed.slug : null).toBe(
      "a-very-long-crew-slug-",
    );
  });

  it("builder rejects non-uuid session ids loudly", () => {
    expect(() => wallRideStartParam("nope", SLUG)).toThrow(/uuid/);
  });

  it("router fast-path routes ride_ links BEFORE auth (source assert)", () => {
    const src = read("hooks/useStartParamRouter.ts");
    expect(src).toContain("/franchize/${link.slug}/community?ride=${link.sessionId}");
    expect(src).toContain("ride_<sessionId>_<slug>");
  });
});

// ── NN moto-spots catalog ────────────────────────────────────────────────────

describe("NN moto-spots catalog", () => {
  it("has unique ids == slugs (by design: crews.slug = spot.slug)", () => {
    const ids = NN_MOTO_SPOTS.map((s) => s.id);
    const slugs = NN_MOTO_SPOTS.map((s) => s.slug);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(ids).toEqual(slugs);
  });

  it("keeps every slug url-safe ([a-z0-9-])", () => {
    for (const spot of NN_MOTO_SPOTS) {
      expect(spot.slug).toMatch(/^[a-z0-9-]{1,64}$/);
    }
  });

  it("keeps coords inside the NN map bbox (56.08..56.42 / 43.66..44.12)", () => {
    for (const spot of NN_MOTO_SPOTS) {
      const [lat, lon] = spot.coords;
      expect(lat).toBeGreaterThan(56.08);
      expect(lat).toBeLessThan(56.42);
      expect(lon).toBeGreaterThan(43.66);
      expect(lon).toBeLessThan(44.12);
    }
  });

  it("uses only known kinds with non-empty labels/icons and a hex color", () => {
    for (const spot of NN_MOTO_SPOTS) {
      expect(MOTO_SPOT_KINDS).toContain(spot.kind);
      expect(motoSpotKindLabel(spot.kind).length).toBeGreaterThan(0);
      expect(motoSpotKindIcon(spot.kind)).toMatch(/^::Fa\w+::$/);
      expect(spot.color).toMatch(/^#[0-9a-f]{6}$/i);
      expect(spot.name.length).toBeGreaterThan(0);
      expect(spot.address.length).toBeGreaterThan(0);
    }
  });

  it("findMotoSpotById validates ?spot= input strictly", () => {
    const first = NN_MOTO_SPOTS[0];
    expect(findMotoSpotById(first.id)?.id).toBe(first.id);
    expect(findMotoSpotById(` ${first.id.toUpperCase()} `)?.id).toBe(first.id);
    expect(findMotoSpotById("../../etc/passwd")).toBeNull();
    expect(findMotoSpotById("<script>alert(1)</script>")).toBeNull();
    expect(findMotoSpotById(null)).toBeNull();
    expect(findMotoSpotById(undefined)).toBeNull();
    expect(findMotoSpotById("nn-does-not-exist")).toBeNull();
  });

  it("check-in text mentions the spot name and address", () => {
    const spot = NN_MOTO_SPOTS[0];
    const text = buildSpotCheckinText(spot);
    expect(text).toContain(spot.name);
    expect(text).toContain(spot.address);
    expect(text).toContain(motoSpotKindLabel(spot.kind));
  });
});

describe("spots ↔ SQL migration sync (20260921000000)", () => {
  const MIGRATION = "supabase/migrations/20260921000000_seed_nn_moto_spot_crews.sql";

  it("seeds exactly the catalog slugs (both ways)", () => {
    const sql = read(MIGRATION);
    const seeded = new Set(
      [...sql.matchAll(/^\s*\('([a-z0-9-]+)',\s*'[a-z0-9-]+',/gm)].map((m) => m[1]),
    );
    const catalog = new Set(NN_MOTO_SPOTS.map((s) => s.slug));
    expect(seeded).toEqual(catalog);
  });

  it("references the same slug the spot popup links to", () => {
    const sql = read(MIGRATION);
    for (const spot of NN_MOTO_SPOTS) {
      expect(sql).toContain(`'${spot.slug}'`);
    }
  });
});

// ── ride-draft text builder ──────────────────────────────────────────────────

describe("buildRideSessionDraftText", () => {
  const base = {
    sessionId: SESSION_ID,
    rideName: "Вечерний круиз по набережной",
    vehicleLabel: "Honda CB400",
    rideMode: "rental" as const | string,
    distanceKm: 42.35,
    durationSeconds: 5460, // 1 ч 31 мин
    maxSpeedKmh: 118.4,
    avgSpeedKmh: 51.2,
    startedAtIso: "2026-09-20T18:00:00.000Z",
    crewName: "VIP BIKE",
  };

  it("builds the exact draft copy with all stats", () => {
    const text = buildRideSessionDraftText(base);
    expect(text).toContain("🏁 Заезд завершён: Вечерний круиз по набережной");
    expect(text).toContain("🏍 Honda CB400");
    expect(text).toContain("📏 42.4 км · 1 ч 31 мин · до 118 км/ч · средняя 51 км/ч");
    expect(text).toContain("VIP BIKE — MapRiders");
    expect(text).toContain("#mapriders #OnlyBike");
  });

  it("falls back to labels when everything is missing (NaN-safety)", () => {
    const text = buildRideSessionDraftText({
      ...base,
      rideName: null,
      vehicleLabel: null,
      distanceKm: null,
      durationSeconds: null,
      maxSpeedKmh: null,
      avgSpeedKmh: null,
    });
    expect(text).toContain("🏁 Заезд завершён: Без названия");
    expect(text).toContain("🏍 байк экипажа");
    expect(text).not.toContain("📏");
  });

  it("labels personal rides as «личный байк»", () => {
    const text = buildRideSessionDraftText({ ...base, vehicleLabel: null, rideMode: "personal" });
    expect(text).toContain("🏍 личный байк");
  });
});

// ── wall page params wiring (source asserts) ────────────────────────────────

describe("wall page interlink params", () => {
  it("passes ride / q / spot params into CommunityWallClient (uuid/regex-validated)", () => {
    const page = read("app/franchize/[slug]/community/page.tsx");
    expect(page).toContain("composeRideId={composeRideId}");
    expect(page).toContain("initialQuery={initialQuery}");
    expect(page).toContain("checkinSpotId={checkinSpotId}");
    expect(page).toContain("uuidRe.test(rawRide)");
    expect(page).toContain("/^[a-z0-9-]{1,64}$/i.test(rawSpot)");
  });

  it("client fetches the ride draft and validates spot ids against the catalog", () => {
    const client = read("app/franchize/[slug]/community/CommunityWallClient.tsx");
    expect(client).toContain("getWallRideDraftAction");
    expect(client).toContain("findMotoSpotById(checkinSpotId)");
    expect(client).toContain("buildSpotCheckinText(spot)");
  });

  it("server action exposes getWallRideDraftAction with crew + owner guard", () => {
    const actions = read("app/franchize/server-actions/community-wall.ts");
    expect(actions).toContain("export async function getWallRideDraftAction");
    expect(actions).toContain("s.crew_slug !== crew.slug");
    expect(actions).toContain("isCrewStaffUser(actor.userId, crew)");
    expect(actions).toContain("buildRideSessionDraftText");
  });

  it("session manager exposes onRideStopped with pre-dispatch capture", () => {
    const hook = read("app/franchize/hooks/useSessionManager.ts");
    expect(hook).toContain("onRideStopped?: (endedSessionId: string) => void");
    expect(hook).toContain("const endedSessionId = state.sessionId;");
    expect(hook).toContain("onRideStopped?.(endedSessionId);");
  });

  it("map client wires the spots layer + in-sheet ride share + meetup→wall link", () => {
    const client = read("components/map-riders/MapRidersClientRefactored.tsx");
    expect(client).toContain("NN_MOTO_SPOTS.filter");
    expect(client).toContain("visibleSpots.map");
    // Чек-ин точки — кнопка с in-page префиллом шита (НЕ <Link> на тот же
    // маршрут: same-route ?spot=-навигация выглядела как «не работает»).
    expect(client).toContain("openSpotCheckin(spot.id)");
    expect(client).not.toContain("map-riders?spot=${spot.id}");
    // «Поделиться заездом» открывает черновик в шите (без смены URL).
    expect(client).toContain("setSheetRideComposeId(endedRideSessionId)");
    // 2026-09-25: meetup→wall — обратный interlink «точка карты → пост на
    // стене» (in-page compose с геотегом точки) заменил поиск-ссылку ?q=.
    expect(client).toContain("openWallComposeFromPoint({ lat: m.lat, lng: m.lon, label: m.title, text: m.title })");
    expect(client).not.toContain("encodeURIComponent(m.title.slice(0, 60))");
    expect(client).toContain("spotKindFilter");
  });

  it("spot popup cross-links other crews through TG startapp grammar", () => {
    const client = read("components/map-riders/MapRidersClientRefactored.tsx");
    // crew_<slug> → каталог чужого экипажа; wall_<slug> → его стена.
    expect(client).toContain("crewCatalogStartParam(spot.slug)");
    expect(client).toContain("wallStartParam(spot.slug)");
    // Открывается через openTelegramLink (мини-апп перезапускается с новым
    // startapp); без бота ИЛИ на броске билдера — веб-фолбэк тем же контролом.
    expect(client).toContain("openCrewDeeplink(crewBot, param)");
    expect(client).toContain("built = paramFactory()");
    expect(client).toContain("crew.contacts.telegramBotUsername");
    // URL в подсказке строится билдером, а не дублируется руками.
    expect(client).toContain("title={buildTelegramAppLink(crewBot, param)}");
    // In-page чек-ин пробрасывается в стену шита (+ nonce на повторный тап).
    expect(client).toContain("checkinSpotId={wallCheckinSpot?.id ?? wallParams?.checkinSpotId ?? null}");
    expect(client).toContain("checkinSpotNonce={wallCheckinSpot?.nonce}");
  });

  it("RacingMap renders only real React elements as rich popups (XSS guard)", () => {
    const map = read("components/maps/RacingMap.tsx");
    expect(map).toContain("React.isValidElement(poi.popup)");
  });

  it("round-3 polish: legend chips, check-in banner, migration uses a CTE (no ghost columns)", () => {
    const client = read("components/map-riders/MapRidersClientRefactored.tsx");
    expect(client).toContain("MOTO_SPOT_KINDS.map");
    expect(client).toContain("aria-pressed");
    const wall = read("app/franchize/[slug]/community/CommunityWallClient.tsx");
    expect(wall).toContain("checkinSpot && !checkinDismissed");
    const migration = read("supabase/migrations/20260921000000_seed_nn_moto_spot_crews.sql");
    // regression guard: the first draft referenced v.description (ghost column);
    // the CTE form computes description once and exposes it to both usages
    expect(migration).toContain("with data as (");
    expect(migration).not.toMatch(/v\.description/);
    expect(migration).toContain("from data d");
  });
});

// ── uuid guard sanity (shared with wall grammar) ─────────────────────────────

describe("uuid guard", () => {
  it("accepts the canonical fixture", () => {
    expect(isUuidLike(SESSION_ID)).toBe(true);
  });
});

// ── interlink v2: «пост на стене → точка на карте» (обратная сторона) ────────

describe("meetupDraftFromPost (post → meetup draft)", () => {
  it("geo label wins over post text (label is the human place name)", () => {
    const draft = meetupDraftFromPost("Площадь Комсомольская", "Собираемся тут вечером, заезжайте!", "Иван");
    expect(draft.title).toBe("Площадь Комсомольская");
    expect(draft.comment).toBe("Из поста · Иван");
  });

  it("falls back to post text when label is empty/short; collapses whitespace", () => {
    const draft = meetupDraftFromPost("  ", "Собираемся\n\n  у старого моста,   вечерняя покатушка!", "Иван");
    expect(draft.title).toBe("Собираемся у старого моста, вечерняя покатушка!");
  });

  it("respects the meetups POST schema caps: title ≤80, comment ≤240", () => {
    const longText = "М".repeat(300);
    const draft = meetupDraftFromPost(null, longText, "А".repeat(300));
    expect(draft.title.length).toBeLessThanOrEqual(80);
    expect(draft.comment.length).toBeLessThanOrEqual(240);
    expect(draft.title).toBe("М".repeat(80));
  });

  it("sub-2-char sources fall back to «Точка из поста»; empty author → райдер", () => {
    expect(meetupDraftFromPost(null, "  x ", "  ").title).toBe("Точка из поста");
    expect(meetupDraftFromPost(null, null, "").comment).toBe("Из поста · райдер");
  });

  it("never splits a surrogate pair at the cut (emoji-heavy posts keep 🏁 whole)", () => {
    const draft = meetupDraftFromPost(null, "М".repeat(79) + "🏁 финиш", "Иван");
    expect(draft.title.length).toBeLessThanOrEqual(80);
    expect(draft.title.endsWith("🏁")).toBe(false);
    // сама высокоя суррогатная пара не остаётся «хвостом» строки
    const last = draft.title.charCodeAt(draft.title.length - 1);
    expect(last < 0xd800 || last > 0xdbff).toBe(true);
  });
});

describe("post → meetup point wiring (interlink v2)", () => {
  it("wall declares onMakeMeetupPoint (optional → страница стены кнопку не показывает)", () => {
    const wall = read("app/franchize/[slug]/community/CommunityWallClient.tsx");
    expect(wall).toMatch(/onMakeMeetupPoint\?:/);
    expect(wall).toContain("authorName: string }) => void;");
    // Кнопка рендерится ТОЛЬКО когда проп задан (map-riders sheet).
    expect(wall).toContain("{props.onMakeMeetupPoint ? (");
    expect(wall).toContain("Точкой на карту");
    // Передаётся в PostCard вместе с onFocusGeotag.
    expect(wall).toContain("onMakeMeetupPoint={onMakeMeetupPoint}");
    // В meta уходит реальный текст поста и его автор (не заглушки).
    expect(wall).toContain("text: post.body ?? null,");
    expect(wall).toContain("authorName,");
    // Страница стены рендерит CommunityWallClient БЕЗ этого пропа.
    expect(read("app/franchize/[slug]/community/page.tsx")).not.toContain("onMakeMeetupPoint=");
  });

  it("helper caps stay in sync with the server zod schema (title 2..80, comment ≤240)", () => {
    const route = read("app/api/map-riders/meetups/route.ts");
    expect(route).toMatch(/title:\s*z\.string\(\)\.trim\(\)\.min\(2\)\.max\(80\)/);
    expect(route).toMatch(/comment:\s*z\.string\(\)\.trim\(\)\.max\(240\)/);
  });

  it("map client passes the handler and flies to the new point after creation", () => {
    const client = read("components/map-riders/MapRidersClientRefactored.tsx");
    expect(client).toContain("onMakeMeetupPoint={handleMakeMeetupFromPost}");
    // Точка создаётся в координатах поста (не selectedMeetupPoint!).
    expect(client).toContain("point: [geo.lat, geo.lng],");
    // Черновик (title/comment) — через общий helper, не руками.
    expect(client).toContain("meetupDraftFromPost(geo.label, meta.text, meta.authorName)");
    // Успех → шит сворачивается и карта летит к точке (пользователь её ВИДИТ).
    expect(client).toContain("setWallFocusPoint({ lat: geo.lat, lng: geo.lng, key: Date.now() })");
  });

  it("handler keeps the meetup-action hygiene: auth guard + debounce + double-tap ref", () => {
    const client = read("components/map-riders/MapRidersClientRefactored.tsx");
    expect(client).toContain("isCreatingMeetupFromPostRef.current = true;");
    expect(client).toMatch(/handleMakeMeetupFromPost[\s\S]{0,900}lastMeetupActionAtRef\.current < MEETUP_ACTION_DEBOUNCE_MS/);
    expect(client).toMatch(/handleMakeMeetupFromPost[\s\S]{0,400}toast\.error\("Авторизуйся в Telegram\/VIP BIKE"\)/);
  });
});
