// tests/franchize/crew-standings.spec.ts
//
// «Зачёт экипажа» (crew standings) + crew-bot de-hardcode round.
//
// Покрываем:
//   A. lib/crew-standings: формула очков (выезд×10 · чекин×4 · пост×3 ·
//      реакция×1), только реальные байки и «денежные» статусы, tie-break
//      цепочка, кап 50, пропуск райдеров без профиля, defensive like_count.
//   B. Паритет RIDE_SCORING_STATUSES ↔ RIDE_EARNING_STATUSES (правило
//      «что такое выезд» должно совпадать со статистикой профиля).
//   C. crewBotAppLink/crewBotAppBase: null-safe сборка t.me-ссылок.
//   D. Source-contracts: actions-runtime больше НЕ содержит "oneBikePlsBot"
//      и резолвит бот из crew metadata; invoice-фолбэк на веб-карточку;
//      getFranchizeRentalCard строит deeplink через crewBotAppLink;
//      new-lead-notify строит crew-aware базу; getWallStandingsAction
//      публичный и БЕЗ денежных колонок; стена и профиль ссылаются друг на
//      друга через зачёт.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  STANDINGS_MAX_ENTRIES,
  RIDE_SCORING_STATUSES,
  computeCrewStandings,
  crewStandingsDisplayName,
  isCrewStandingsCheckinBody,
  type CrewStandingsRideRow,
  type CrewStandingsPostRow,
  type CrewStandingsUserRef,
} from "@/app/franchize/lib/crew-standings";
import { crewBotAppLink, crewBotAppBase } from "@/app/franchize/lib/crew-bot";
// для паритета правил
import { RIDE_EARNING_STATUSES } from "@/app/franchize/lib/community-wall";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

/** Source slice of one exported function — keeps contract asserts scoped.
 *  Cuts at the NEXT export OR section marker (// ── ), whichever comes first. */
function fnSource(src: string, name: string): string {
  const start = src.indexOf(`export async function ${name}`);
  const alt = src.indexOf(`export function ${name}`);
  const from = start >= 0 ? start : alt;
  expect(from, `function ${name} not found`).toBeGreaterThanOrEqual(0);
  const nextExport = src.slice(from + 1).search(/\nexport (async )?(function|interface|type|const)/);
  const nextSection = src.indexOf("\n// ── ", from + 1);
  const ends = [nextExport === -1 ? Infinity : from + 1 + nextExport, nextSection === -1 ? Infinity : nextSection];
  const to = Math.min(...ends);
  return Number.isFinite(to) ? src.slice(from, to) : src.slice(from);
}

// ── fixtures ─────────────────────────────────────────────────────────────────

const user = (overrides: Partial<CrewStandingsUserRef> = {}): CrewStandingsUserRef => ({
  fullName: "Иванов Иван",
  username: "ivan",
  avatarUrl: null,
  ...overrides,
});

const ride = (overrides: Partial<CrewStandingsRideRow> = {}): CrewStandingsRideRow => ({
  user_id: "u1",
  status: "completed",
  vehicleType: "bike",
  ...overrides,
});

const post = (overrides: Partial<CrewStandingsPostRow> = {}): CrewStandingsPostRow => ({
  author_id: "u1",
  body: "Прокатился по набережной",
  like_count: 0,
  ...overrides,
});

// ── A. computeCrewStandings ──────────────────────────────────────────────────

describe("computeCrewStandings — scoring", () => {
  it("формула: выезд×10 + чекин×4 + пост×3 + реакция×1", () => {
    const users = new Map([["u1", user()]]);
    const entries = computeCrewStandings(
      [ride(), ride(), ride()],
      [post({ body: "📍 Логово" }), post({ like_count: 5 }), post({ like_count: 2 })],
      users,
    );
    expect(entries).toHaveLength(1);
    const e = entries[0];
    expect(e.rides).toBe(3);
    expect(e.checkins).toBe(1);
    expect(e.posts).toBe(3);
    expect(e.reactionsReceived).toBe(7);
    expect(e.score).toBe(3 * 10 + 1 * 4 + 3 * 3 + 7 * 1);
  });

  it("cancelled/expired аренды не приносят очков (правило bike-wall)", () => {
    const users = new Map([["u1", user()]]);
    // только отменённые → райдера вообще нет на доске (ноль активности)
    const none = computeCrewStandings(
      [ride({ status: "cancelled" }), ride({ status: "expired" }), ride({ status: "declined" })],
      [],
      users,
    );
    expect(none).toEqual([]);
    // пост есть, но отменённые аренды не дают ни выезда, ни очков за них
    const entries = computeCrewStandings(
      [ride({ status: "cancelled" })],
      [post()],
      users,
    );
    expect(entries[0]?.rides).toBe(0);
    expect(entries[0]?.score).toBe(3); // только пост
  });

  it("учитываются только денежные статусы: completed/active/confirmed/pending_confirmation", () => {
    const users = new Map([["u1", user()]]);
    const statuses = ["completed", "active", "confirmed", "pending_confirmation"];
    const entries = computeCrewStandings(statuses.map((s) => ride({ status: s })), [], users);
    expect(entries[0]?.rides).toBe(4);
  });

  it("не-байки (экипировка/сервис) не дают очков", () => {
    const users = new Map([["u1", user()]]);
    const entries = computeCrewStandings(
      [ride({ vehicleType: "equipment" }), ride({ vehicleType: null }), ride({ vehicleType: "bike" })],
      [],
      users,
    );
    expect(entries[0]?.rides).toBe(1);
  });

  it("чекин — только пост с префиксом 📍 (паритет с rider-profile), trimStart учитывается", () => {
    expect(isCrewStandingsCheckinBody("📍 Логово")).toBe(true);
    expect(isCrewStandingsCheckinBody("  📍 Логово")).toBe(true);
    expect(isCrewStandingsCheckinBody("Логово 📍")).toBe(false);
    expect(isCrewStandingsCheckinBody(null)).toBe(false);
    expect(isCrewStandingsCheckinBody(42)).toBe(false);

    const users = new Map([["u1", user()]]);
    const entries = computeCrewStandings([], [post({ body: "  📍 Spot" })], users);
    expect(entries[0]?.checkins).toBe(1);
  });

  it("пост без автора или аренда без райдера молча пропускаются", () => {
    const users = new Map([["u1", user()]]);
    const entries = computeCrewStandings(
      [ride({ user_id: null }), ride({ user_id: "u1" })],
      [post({ author_id: null })],
      users,
    );
    expect(entries).toHaveLength(1);
    expect(entries[0].userId).toBe("u1");
    expect(entries[0].rides).toBe(1);
    expect(entries[0].posts).toBe(0);
  });
});

describe("computeCrewStandings — ranking & caps", () => {
  it("tie-break цепочка: score → rides → reactions → userId", () => {
    const users = new Map([
      ["a", user({ fullName: "A" })],
      ["b", user({ fullName: "B" })],
      ["c", user({ fullName: "C" })],
      ["d", user({ fullName: "D" })],
    ]);
    // a: 3 rides = 30 (очевидный лидер)
    // b: 1 пост + 10 реакций = 3 + 10 = 13
    // d: 1 ride = 10
    // c: 2 поста = 6
    const entries = computeCrewStandings(
      [
        ride({ user_id: "a" }),
        ride({ user_id: "a" }),
        ride({ user_id: "a" }),
        ride({ user_id: "d" }),
      ],
      [
        post({ author_id: "b", like_count: 10 }),
        post({ author_id: "c", like_count: 0 }),
        post({ author_id: "c", like_count: 0 }),
      ],
      users,
    );
    expect(entries.map((e) => e.userId)).toEqual(["a", "b", "d", "c"]);
    expect(entries.map((e) => e.score)).toEqual([30, 13, 10, 6]);
  });

  it("равный score: больше выездов → выше; при полном паритете — userId asc", () => {
    const users = new Map([
      ["p", user({ fullName: "P" })],
      ["q", user({ fullName: "Q" })],
      ["r", user({ fullName: "R" })],
    ]);
    // p и r: по 1 выезду = 10 очков, полностью паритетны → userId asc (p < r).
    // q: 0 выездов, 1 пост + 7 реакций = 10 очков → rides 0 < 1, поэтому ниже.
    const entries = computeCrewStandings(
      [ride({ user_id: "p" }), ride({ user_id: "r" })],
      [post({ author_id: "q", like_count: 7 })],
      users,
    );
    expect(entries.map((e) => e.userId)).toEqual(["p", "r", "q"]);
    expect(entries.map((e) => e.score)).toEqual([10, 10, 10]);
  });

  it("кап STANDINGS_MAX_ENTRIES (50) не переполняется", () => {
    const users = new Map<string, CrewStandingsUserRef>();
    for (let i = 0; i < 80; i++) users.set(`u${i}`, user({ fullName: `R${i}` }));
    const rides = Array.from({ length: 80 }, (_, i) => ride({ user_id: `u${i}` }));
    const entries = computeCrewStandings(rides, [], users);
    expect(entries).toHaveLength(STANDINGS_MAX_ENTRIES);
  });

  it("райдеры без известного профиля (users) пропускаются — стена не рендерит безымянных", () => {
    const users = new Map([["u1", user()]]);
    const entries = computeCrewStandings(
      [ride({ user_id: "ghost" }), ride({ user_id: "u1" })],
      [post({ author_id: "ghost", like_count: 100 })],
      users,
    );
    expect(entries).toHaveLength(1);
    expect(entries[0].userId).toBe("u1");
  });
});

describe("computeCrewStandings — defensive inputs", () => {
  it("like_count: строка, мусор, отрицательное и гигантское обрабатываются", () => {
    const users = new Map([["u1", user()]]);
    const entries = computeCrewStandings(
      [],
      [
        post({ like_count: "7" as unknown as number }),
        post({ like_count: "abc" as unknown as number }),
        post({ like_count: -5 }),
        post({ like_count: 999_999 }),
      ],
      users,
    );
    // 7 + 0 + 0 + 10000 (cap)
    expect(entries[0].reactionsReceived).toBe(10_007);
  });

  it(" crewStandingsDisplayName: fullName → username → «Райдер»", () => {
    expect(crewStandingsDisplayName({ fullName: "Иван", username: "ivan" })).toBe("Иван");
    expect(crewStandingsDisplayName({ fullName: null, username: "ivan" })).toBe("ivan");
    expect(crewStandingsDisplayName({ fullName: "   ", username: "" })).toBe("Райдер");
  });
});

// ── B. паритет правил «что такое выезд» ──────────────────────────────────────

describe("ride-status parity with the rider-profile stats", () => {
  it("RIDE_SCORING_STATUSES === RIDE_EARNING_STATUSES", () => {
    expect(RIDE_SCORING_STATUSES).toEqual(RIDE_EARNING_STATUSES);
  });
});

// ── C. crewBotAppLink / crewBotAppBase ───────────────────────────────────────

describe("crewBotAppLink / crewBotAppBase (null-safe t.me builder)", () => {
  it("строит ссылку из username бота", () => {
    expect(crewBotAppLink("oneBikePlsBot", "vip-bike_community")).toBe(
      "https://t.me/oneBikePlsBot/app?startapp=vip-bike_community",
    );
  });

  it("@-префикс и мусор вокруг username нормализуются", () => {
    expect(crewBotAppLink("@oneBikePlsBot", "wall_vip-bike")).toBe(
      "https://t.me/oneBikePlsBot/app?startapp=wall_vip-bike",
    );
  });

  it("нет бота → null (CTA скрывается, а не рендерит t.me/null/app)", () => {
    expect(crewBotAppLink(null, "wall_x")).toBeNull();
    expect(crewBotAppLink(undefined, "wall_x")).toBeNull();
    expect(crewBotAppLink("", "wall_x")).toBeNull();
    expect(crewBotAppLink("не-валидный!", "wall_x")).toBeNull();
    expect(crewBotAppBase(null)).toBeNull();
  });

  it("startapp санитизируется под допустимый charset", () => {
    expect(crewBotAppLink("oneBikePlsBot", "lead 903/123!")).toBe(
      "https://t.me/oneBikePlsBot/app?startapp=lead_903_123_",
    );
  });

  it("crewBotAppBase даёт базу для кнопок ?startapp=…", () => {
    expect(crewBotAppBase("@oneBikePlsBot")).toBe("https://t.me/oneBikePlsBot/app");
  });
});

// ── D. source-contracts ──────────────────────────────────────────────────────

describe("source-contract: actions-runtime de-hardcoded", () => {
  const src = read("app/franchize/actions-runtime.ts");

  it("в actions-runtime больше нет хардкода oneBikePlsBot", () => {
    expect(src).not.toContain("oneBikePlsBot");
  });

  it("бот резолвится из crew metadata в обоих местах (order notify + invoice)", () => {
    expect(src.match(/await resolveCrewBotUsername\(/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
    expect(src).toContain("resolveCrewBotUsername(payload.slug)");
    expect(src).toContain("resolveCrewBotUsername(safeSlug)");
  });

  it("ссылки собираются через null-safe crewBotAppLink (без ручных t.me/$ {bot})", () => {
    expect(src).toContain('crewBotAppLink(crewBotUsername, `rental-${safeRentalId}`) ?? ""');
    expect(src).toContain("crewBotAppLink(crewBotUsername, startParam) ?? franchizeRentalLink");
    // ручная интерполяция бота в URL больше не встречается
    expect(src).not.toMatch(/https:\/\/t\.me\/\$\{botUsername\}/);
  });

  it("нет бота → deeplink-строки аналитики не пушатся (грейсфул)", () => {
    expect(src).toContain("rentalsAnalyticsLink ? [``, `<a href=");
  });
});

describe("source-contract: new-lead-notify crew-aware base", () => {
  it("notifyNewLead резолвит бот экипажа и передаёт базу в leadDeeplinkUrl", () => {
    const src = read("app/franchize/lib/new-lead-notify.ts");
    expect(src).toContain("const crewBot = await resolveCrewBotUsername(input.slug);");
    expect(src).toContain("leadDeeplinkUrl(input.leadKey, crewBotAppBase(crewBot) ?? undefined)");
  });

  it("leadDeeplinkUrl остаётся back-compatible (base опционален)", () => {
    const src = read("app/franchize/lib/new-lead-notify.ts");
    expect(src).toContain("export function leadDeeplinkUrl(leadKey: string, base?: string)");
  });
});

describe("source-contract: getWallStandingsAction is public & money-free", () => {
  const src = read("app/franchize/server-actions/community-wall.ts");
  const fn = fnSource(src, "getWallStandingsAction");

  it("не выбирает денежные колонки", () => {
    expect(fn).toContain('select("user_id, status, agreed_start_date, vehicle:cars(type)")');
    expect(fn).toContain('select("author_id, body, like_count")');
    expect(fn).not.toContain("total_cost");
    expect(fn).not.toContain("deposit");
  });

  it("публичный: без initData, скрытые посты исключены, фетчи ограничены", () => {
    expect(fn).toContain('z.object({ slug: z.string().trim().min(1) })');
    expect(fn).toContain('.eq("is_hidden", false)');
    expect(fn.match(/\.limit\(2000\)/g)?.length ?? 0).toBe(2);
    expect(fn).toContain(".gte(\"agreed_start_date\", weekAgo)");
    expect(fn).toContain('.gte("created_at", weekAgo)');
  });

  it("score считается в либе, а не в запросе", () => {
    expect(fn).toContain("computeCrewStandings(");
  });
});

describe("source-contract: wall & profile wiring", () => {
  it("стена: блок «Зачёт недели» лениво грузит standings, top-5, ссылки на профили", () => {
    const src = read("app/franchize/[slug]/community/CommunityWallClient.tsx");
    expect(src).toContain("getWallStandingsAction({ slug })");
    expect(src).toContain("Зачёт недели");
    expect(src).toContain(".slice(0, 5)");
    expect(src).toContain("crewStandingsDisplayName(entry)");
    expect(src).toContain("href={`/franchize/${slug}/rider/${entry.userId}`}");
    // тач-таргеты мобайла: строка зачёта ≥44px
    expect(src).toContain("min-h-[44px]");
  });

  it("профиль райдера: чип недельного ранга со ссылкой на стену", () => {
    const src = read("app/franchize/[slug]/rider/[userId]/RiderProfileClient.tsx");
    expect(src).toContain("getWallStandingsAction({ slug: crewSlug })");
    expect(src).toContain("res.standings.findIndex((e) => e.userId === rider.userId)");
    expect(src).toContain("в зачёте экипажа за неделю");
    expect(src).toContain("href={`/franchize/${crewSlug}/community`}");
  });
});
