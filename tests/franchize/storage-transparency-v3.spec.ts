// tests/franchize/storage-transparency-v3.spec.ts
// 2026-09-27 — boss: «make winter storage owners transparency on same quality
// level as subrenters, with admin/crewowner config, full package».
//
// Covers the v3 parity layer:
//   · resolveStorageConfig (metadata.franchize.storage + legacy vip-bike rule)
//   · money stats / paid_until coverage (MSK, injectable clock)
//   · wall triage: status filter + sort modes
//   · per-bike markdown report (Мотопарк «Отчёт» parity)
//   · migration v2 (paid_until + payment/owner_linked event types, NO new RLS)
//   · new server actions: story / mark-paid / report / owner-link gates
//   · wall + story UI wiring (report pill, KPI band, payment + owner-link
//     controls, config-driven offer)
//   · config editor + section-links + catalog pill de-hardcoding

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_STORAGE_ADDRESS,
  DEFAULT_STORAGE_CARE_DUTIES,
  DEFAULT_STORAGE_MONTHLY_PRICE_RUB,
  resolveStorageConfig,
} from "@/app/franchize/lib/storage-config";
import {
  STORAGE_EVENT_TYPE_LABELS,
  STORAGE_SORT_LABELS,
  STORAGE_STATUS_TRANSITIONS,
  filterStorageBikes,
  sortStorageBikes,
  storageEventLabel,
  storageIsoToRu,
  storageMoneyStatsOf,
  storagePaidCovered,
  storageSeasonDefaults,
  type StorageBikeVM,
} from "@/app/franchize/lib/storage";
import {
  buildStorageBikeReport,
  storageReportPaymentLine,
  storageReportStatusLabel,
} from "@/app/franchize/lib/storage-bike-report";
import { buildFranchizeIntentLinks } from "@/app/franchize/lib/section-links";

const read = (p: string) => readFileSync(p, "utf8");

const baseBike = (over: Partial<StorageBikeVM> = {}): StorageBikeVM => ({
  id: "b1",
  createdAt: "2026-09-20T10:00:00Z",
  status: "in_storage",
  ownerName: "Михалёв Роман Викторович",
  ownerPhone: "+7 909 283-82-49",
  bikeTitle: "SYM LM 25",
  regNumber: "1110 XX52",
  vin: "RFGLM30WYB5008081",
  year: 2011,
  color: "чёрный",
  mileageKm: 35400,
  accessories: "Кофр и чехол",
  estimatedValueRub: 200000,
  monthlyPriceRub: 2000,
  totalPriceRub: 15000,
  seasonStart: "2026-10-15",
  seasonEnd: "2027-06-01",
  monthsLabel: "7,5 месяца",
  storageAddress: "",
  noticeAddress: "",
  orderId: null,
  docPath: null,
  pepSigned: true,
  paidUntil: null,
  source: "checkout",
  events: [],
  ...over,
});

// ── resolveStorageConfig ─────────────────────────────────────────────────────

describe("resolveStorageConfig (admin/crewowner config)", () => {
  it("legacy rule: no storage block → vip-bike only, Стригинский / 2000 defaults", () => {
    const on = resolveStorageConfig({}, "vip-bike");
    const off = resolveStorageConfig({}, "svarprofi");
    expect(on.enabled).toBe(true);
    expect(off.enabled).toBe(false);
    expect(on.address).toBe(DEFAULT_STORAGE_ADDRESS);
    expect(on.defaultMonthlyPriceRub).toBe(DEFAULT_STORAGE_MONTHLY_PRICE_RUB);
    expect(on.seasonStartMMDD).toBe("10-15");
    expect(on.seasonEndMMDD).toBe("06-01");
    expect(on.careDuties).toEqual(DEFAULT_STORAGE_CARE_DUTIES);
  });

  it("explicit storage.enabled wins over the legacy slug rule (both directions)", () => {
    expect(resolveStorageConfig({ storage: { enabled: false } }, "vip-bike").enabled).toBe(false);
    expect(resolveStorageConfig({ storage: { enabled: true } }, "svarprofi").enabled).toBe(true);
    // absent enabled key (empty/partial block) keeps the legacy slug rule —
    // a partial block must never silently disable vip-bike's service
    expect(resolveStorageConfig({ storage: {} }, "vip-bike").enabled).toBe(true);
    // hand-edited metadata strings resolve explicitly ("false" must NOT enable)
    expect(resolveStorageConfig({ storage: { enabled: "true" } }, "svarprofi").enabled).toBe(true);
    expect(resolveStorageConfig({ storage: { enabled: "false" } }, "vip-bike").enabled).toBe(false);
  });

  it("config fields resolve with sanitization; invalid season/prices fall back", () => {
    const cfg = resolveStorageConfig(
      {
        storage: {
          enabled: true,
          address: "ул. Пример, 1\nвторая строка",
          defaultMonthlyPriceRub: "3500",
          seasonStart: "11-01",
          seasonEnd: "04-30",
          careDuties: ["Своя забота 1", "", "   ", "Своя забота 2"],
        },
      },
      "svarprofi",
    );
    expect(cfg.address).toBe("ул. Пример, 1 вторая строка");
    expect(cfg.defaultMonthlyPriceRub).toBe(3500);
    expect(cfg.seasonStartMMDD).toBe("11-01");
    expect(cfg.seasonEndMMDD).toBe("04-30");
    expect(cfg.careDuties).toEqual(["Своя забота 1", "Своя забота 2"]);

    const fallback = resolveStorageConfig(
      { storage: { enabled: true, address: "   ", defaultMonthlyPriceRub: -5, seasonStart: "1-ene", careDuties: [] } },
      "vip-bike",
    );
    expect(fallback.address).toBe(DEFAULT_STORAGE_ADDRESS);
    expect(fallback.defaultMonthlyPriceRub).toBe(DEFAULT_STORAGE_MONTHLY_PRICE_RUB);
    expect(fallback.seasonStartMMDD).toBe("10-15");
    expect(fallback.careDuties).toEqual(DEFAULT_STORAGE_CARE_DUTIES);
  });
});

// ── money / paid_until ───────────────────────────────────────────────────────

describe("storageMoneyStatsOf + storagePaidCovered (MSK, injectable today)", () => {
  const today = "2026-12-01";

  it("counts active season money; returned/cancelled never count", () => {
    const bikes = [
      baseBike({ id: "a", status: "in_storage", totalPriceRub: 15000, paidUntil: "2027-06-01" }),
      baseBike({ id: "b", status: "requested", totalPriceRub: 8000, paidUntil: null }),
      baseBike({ id: "c", status: "returned", totalPriceRub: 15000, paidUntil: "2027-06-01" }),
      baseBike({ id: "d", status: "cancelled", totalPriceRub: 999 }),
    ];
    const stats = storageMoneyStatsOf(bikes, today);
    expect(stats.activeRub).toBe(23000);
    expect(stats.inStorageRub).toBe(15000);
    expect(stats.paidRub).toBe(15000);
    expect(stats.unpaidRub).toBe(8000);
  });

  it("paid_until covering today (MSK) counts as paid; yesterday is unpaid", () => {
    expect(storagePaidCovered("2026-12-01", "2026-12-01")).toBe(true);
    expect(storagePaidCovered("2026-11-30", "2026-12-01")).toBe(false);
    // timestamp injectable — MSK wall clock, not UTC date:
    // 29 Nov 21:30 UTC = 30 Nov 00:30 МСК → paid through 30-11 covers it
    expect(storagePaidCovered("2026-11-30", Date.UTC(2026, 10, 29, 21, 30))).toBe(true);
    // 30 Nov 23:30 UTC = 1 Dec 02:30 МСК → today already 12-01, paid through 30-11 does NOT cover
    expect(storagePaidCovered("2026-11-30", Date.UTC(2026, 10, 30, 23, 30))).toBe(false);
    expect(storagePaidCovered(null, today)).toBe(false);
    expect(storagePaidCovered("garbage", today)).toBe(false);
  });
});

// ── wall triage ──────────────────────────────────────────────────────────────

describe("filterStorageBikes + sortStorageBikes (Мотопарк triage parity)", () => {
  const bikes = [
    baseBike({ id: "1", status: "in_storage", createdAt: "2026-09-01T10:00:00Z", totalPriceRub: 10000, bikeTitle: "А-style" }),
    baseBike({ id: "2", status: "requested", createdAt: "2026-09-10T10:00:00Z", totalPriceRub: 30000, bikeTitle: "Б-style" }),
    baseBike({ id: "3", status: "returned", createdAt: "2026-09-05T10:00:00Z", totalPriceRub: 20000, bikeTitle: "В-style" }),
  ];

  it("filter by status and all", () => {
    expect(filterStorageBikes(bikes, "all")).toHaveLength(3);
    expect(filterStorageBikes(bikes, "in_storage").map((b) => b.id)).toEqual(["1"]);
    expect(filterStorageBikes(bikes, "returned").map((b) => b.id)).toEqual(["3"]);
  });

  it("sort modes: recent / money / title (ru collation)", () => {
    expect(sortStorageBikes(bikes, "recent").map((b) => b.id)).toEqual(["2", "3", "1"]);
    expect(sortStorageBikes(bikes, "money").map((b) => b.id)).toEqual(["2", "3", "1"]);
    expect(sortStorageBikes(bikes, "title").map((b) => b.id)).toEqual(["1", "2", "3"]);
    // original array untouched (pure)
    expect(bikes.map((b) => b.id)).toEqual(["1", "2", "3"]);
    expect(Object.keys(STORAGE_SORT_LABELS)).toEqual(["recent", "money", "title"]);
  });
});

// ── season defaults with config override ────────────────────────────────────

describe("storageSeasonDefaults with config MM-DD override", () => {
  it("defaults stay 15.10 → 01.06", () => {
    const d = storageSeasonDefaults(new Date(2026, 8, 1)); // 1 Sep 2026 — before season start
    expect(d).toEqual({ start: "2026-10-15", end: "2027-06-01" });
  });

  it("custom anchors shift the window; garbage anchors fall back", () => {
    const d = storageSeasonDefaults(new Date(2026, 8, 1), { start: "11-01", end: "04-30" });
    expect(d).toEqual({ start: "2026-11-01", end: "2027-04-30" });
    const fallback = storageSeasonDefaults(new Date(2026, 8, 1), { start: "bad", end: "also-bad" });
    expect(fallback).toEqual({ start: "2026-10-15", end: "2027-06-01" });
  });
});

// ── events labels ────────────────────────────────────────────────────────────

describe("storageEventLabel — new event kinds never render as «Статус: Заявка»", () => {
  it("labels payment and owner_linked", () => {
    expect(storageEventLabel("payment")).toBe("Оплата");
    expect(storageEventLabel("owner_linked")).toBe("Владелец привязан");
    expect(storageEventLabel("note")).toBe("Заметка");
    expect(storageEventLabel("created")).toBe("Заявка создана");
    expect(storageEventLabel("status_changed")).toBe("Статус");
    expect(storageEventLabel("unknown_kind")).toBe("unknown_kind");
    expect(STORAGE_EVENT_TYPE_LABELS.doc).toBe("Документ");
  });
});

// ── report builder ───────────────────────────────────────────────────────────

describe("buildStorageBikeReport (per-bike «Отчёт» parity)", () => {
  const nowMs = Date.UTC(2026, 11, 1, 10, 0); // 13:00 МСК 01.12.2026

  const bike = baseBike({
    paidUntil: "2027-06-01",
    storageAddress: "Стригинский переулок, 13Б",
    docPath: "vip-bike/storage-test.docx",
    events: [
      { id: 1, type: "created", status: "requested", actorName: "Система", message: "Владелец добавил байк", createdAt: "2026-09-20T10:00:00Z" },
      { id: 2, type: "status_changed", status: "in_storage", actorName: "Paul", message: "Заявка → На хранении", createdAt: "2026-09-21T09:30:00Z" },
      { id: 3, type: "payment", status: null, actorName: "Paul", message: "Оплата отмечена до 01.06.2027", createdAt: "2026-09-22T12:00:00Z" },
    ],
  });

  it("boss format: title, meta, сводка with payment line, mото/владелец blocks, events table desc", () => {
    const { markdown, filename } = buildStorageBikeReport({
      bike,
      crewName: "VIP_BIKE",
      botUsername: "oneBikePlsBot",
      wallUrl: "https://t.me/oneBikePlsBot/app?startapp=storage_vip-bike",
      docUrl: "https://cdn.test/storage/v1/object/public/rental-contracts/vip-bike/storage-test.docx",
      nowMs,
    });

    expect(markdown).toContain("# Хранение — SYM LM 25 (1110 XX52)");
    expect(markdown).toContain("- Экипаж: VIP BIKE");
    expect(markdown).toContain(`- Статус: ${storageReportStatusLabel("in_storage")}`);
    expect(markdown).toContain("- Отчёт сформирован: 01.12.2026 13:00 МСК");
    expect(markdown).toContain("- Сезон: 15.10.2026 — 01.06.2027 (7,5 месяца)");
    expect(markdown).toContain("- Ставка: 2 000 ₽/мес · Итого за сезон: **15 000 ₽**");
    expect(markdown).toContain("- Оплата: **оплачено до 01.06.2027**");
    expect(markdown).toContain("- Оценочная стоимость (ответственность Хранителя): **200 000 ₽**");
    expect(markdown).toContain("- Место хранения: Стригинский переулок, 13Б · не для аренды ❄️");
    expect(markdown).toContain("## Мотоцикл");
    expect(markdown).toContain("## Владелец");
    expect(markdown).toContain("- ФИО: Михалёв Роман Викторович");
    expect(markdown).toContain("| # | Когда (МСК) | Событие | Кто | Комментарий |");
    // events sorted newest-first
    expect(markdown.indexOf("Оплата отмечена до 01.06.2027")).toBeLessThan(markdown.indexOf("Владелец добавил байк"));
    // payment event uses the label, never «Статус: Заявка»
    expect(markdown).toContain("| Оплата |");
    expect(markdown).toContain("| Статус: 🧊 На хранении |");
    expect(markdown).toContain("startapp=storage_vip-bike");
    expect(markdown).toContain("Договор хранения (DOCX)");
    expect(filename).toMatch(/^storage_1110-XX52_2026-12-01\.md$/);
  });

  it("unpaid and overdue payment lines; crew name prettified; filename falls back to id", () => {
    expect(storageReportPaymentLine(null, nowMs)).toBe("не оплачено");
    expect(storageReportPaymentLine("2026-11-30", nowMs)).toBe("ОПЛАТА ПРОСРОЧЕНА (была до 30.11.2026)");
    const { markdown, filename } = buildStorageBikeReport({
      bike: baseBike({ regNumber: "", id: "uuid-1", paidUntil: null, seasonEnd: null }),
      crewName: "svar_profi",
      nowMs,
    });
    expect(markdown).toContain("- Оплата: **не оплачено**");
    expect(markdown).toContain("- Экипаж: SVAR PROFI".replace("SVAR PROFI", "svar profi"));
    expect(filename).toMatch(/^storage_uuid-1_2026-12-01\.md$/);
  });

  it("event cap truncation note", () => {
    const many = Array.from({ length: 501 }, (_, i) => ({
      id: i,
      type: "note",
      status: null,
      actorName: "t",
      message: `m${i}`,
      createdAt: new Date(Date.UTC(2026, 8, 1, 0, 0, i)).toISOString(),
    }));
    const { markdown } = buildStorageBikeReport({ bike: baseBike({ events: many }), crewName: "c", nowMs });
    expect(markdown).toContain("Показаны последние 500 событий — всего 501");
  });
});

// ── migration v2 ─────────────────────────────────────────────────────────────

describe("migration 20260927130000_winter_storage_v2.sql", () => {
  const sql = read("supabase/migrations/20260927130000_winter_storage_v2.sql");

  it("adds paid_until, widens event CHECK (payment + owner_linked), stays idempotent", () => {
    expect(sql.includes("add column if not exists paid_until date")).toBe(true);
    expect(sql.includes("drop constraint if exists storage_bike_events_type_check")).toBe(true);
    expect(sql.includes("'created', 'status_changed', 'note', 'doc', 'payment', 'owner_linked'")).toBe(true);
    expect(sql.includes("run AFTER 20260927120000_winter_storage.sql")).toBe(true);
    // no new RLS — the v1 owner-SELECT policies already cover the new column
    expect(sql.includes("create policy")).toBe(false);
  });

  it("v1 owner-SELECT RLS policies untouched (still exactly 2)", () => {
    const v1 = read("supabase/migrations/20260927120000_winter_storage.sql");
    expect(v1.match(/create policy/g)?.length).toBe(2);
  });
});

// ── server actions (source guards) ──────────────────────────────────────────

describe("storage-bikes server actions v3 — gates and scoping", () => {
  const src = read("app/franchize/server-actions/storage-bikes.ts");

  it("'use server' file exports only async functions (STORAGE_STORY_EVENTS_CAP moved to lib)", () => {
    expect(src.includes('export const STORAGE_STORY_EVENTS_CAP')).toBe(false);
    // photo-fixation v4 imports ride before it — the lib import stays intact
    expect(src.includes('import {\n  canTransitionStorageStatus,\n  sanitizeStoragePhotoPaths,')).toBe(true);
    expect(src.includes('  STORAGE_STORY_EVENTS_CAP,')).toBe(true);
    // every export is an async function — the Next.js "use server" constraint
    const exports = [...src.matchAll(/^export (async function|const|function|class) (\w+)/gm)].map((m) => `${m[1]} ${m[2]}`);
    expect(exports.length).toBeGreaterThan(0);
    for (const entry of exports) {
      expect(entry.startsWith("async function")).toBe(true);
    }
  });

  it("story/report/payment/owner-link all scope by crew_slug AND gate staff/owner", () => {
    // shared loader enforces crew_slug + identity + owner match
    expect(src.includes('.eq("id", params.bikeId)')).toBe(true);
    expect(src.includes('.eq("crew_slug", params.slug)')).toBe(true);
    expect(src.includes("if (!resolved.actor.isStaff && !isMine) return null;")).toBe(true);
    // data-free gate failures
    expect(src.includes("Карточка недоступна: войдите через Telegram как владелец или экипаж.")).toBe(true);
    // staff-only gates
    expect(src.includes("Оплату отмечает экипаж — запросите менеджера.")).toBe(true);
    expect(src.includes("Привязать владельца может только экипаж.")).toBe(true);
    expect(src.includes("Отчёт доступен владельцу байка и экипажу.")).toBe(true);
  });

  it("payment: date regex, season ±31d clamp, idempotent same-date, escHtml in notify", () => {
    expect(src.includes('paidUntil: z.string().trim().regex(ISO_DATE_RE')).toBe(true);
    expect(src.includes("31 * 86400000")).toBe(true);
    expect(src.includes("if (row.paid_until === target) return { success: true };")).toBe(true);
    expect(src.split("escHtml(").length).toBeGreaterThan(5);
  });

  it("payment + owner-link notify the owner and exclude the actor (no self-ping)", () => {
    const blocks = src.split("await notifyStorageMove(");
    expect(blocks.length).toBeGreaterThanOrEqual(6); // created + status + note + payment + owner-link args
    const paymentBlock = blocks.find((b) => b.includes("Оплата хранения:"));
    expect(paymentBlock).toBeTruthy();
    expect(paymentBlock).toContain("excludeChatIds: [staffId]");
    expect(paymentBlock).toContain("alsoChatIds: row.owner_user_id ? [String(row.owner_user_id)] : []");
    const linkBlock = blocks.find((b) => b.includes("Владелец привязан к Telegram — теперь"));
    expect(linkBlock).toBeTruthy();
    expect(linkBlock).toContain("excludeChatIds: [staffId]");
    expect(linkBlock).toContain("alsoChatIds: digits ? [digits] : []");
  });

  it("report action builds markdown via the lib with wall deeplink and public doc url", () => {
    expect(src.includes("buildStorageBikeReport(")).toBe(true);
    expect(src.includes("crewBotAppLink(botUsername, storageStartParam(slug))")).toBe(true);
    expect(src.includes("storageDocPublicUrl(loaded.row.doc_path)")).toBe(true);
    expect(src.includes("platformBotUsername()")).toBe(true);
  });

  it("mapBike surfaces paid_until", () => {
    expect(src.includes("paidUntil: row.paid_until ?? null,")).toBe(true);
    expect(src.includes("paid_until: string | null;")).toBe(true);
  });

  it("config gate: BOTH checkout paths reject storage orders when crew disabled the service", () => {
    const runtime = read("app/franchize/actions-runtime.ts");
    expect(runtime.includes("async function assertStorageServiceEnabled(slug: string)")).toBe(true);
    expect(runtime.includes('FranchizeOrderDocValidationError(["storage_disabled"])')).toBe(true);
    // human phrase goes straight to the owner's toast
    expect(runtime.includes("Зимнее хранение сейчас недоступно в этом экипаже — напишите менеджеру в Telegram.")).toBe(true);
    // pre-write call sites: submitFranchizeOrderNotification + createFranchizeOrderCheckout
    const callSites = (runtime.match(/await assertStorageServiceEnabled\(/g)?.length ?? 0) - (runtime.includes("async function assertStorageServiceEnabled(slug: string): Promise<void>") ? 0 : 0) - 0;
    // definition body contains 0 awaits; exactly 2 call sites expected
    const definitionSelfMatches = (runtime.match(/async function assertStorageServiceEnabled\(/g)?.length ?? 0);
    expect(definitionSelfMatches).toBe(1);
    expect(callSites).toBe(2);
    expect(callSites).toBe(2);
    // "false" strings from bot scripts must not enable the service
    expect(runtime.includes("z.preprocess(")).toBe(true);
    // the phrase surfaces on BOTH paths — the checkout gate maps
    // DocValidationError → { success:false, error: message } before the try
    expect(runtime.includes("gateError instanceof FranchizeOrderDocValidationError")).toBe(true);
    expect(runtime.includes('raw === true || raw === "true"')).toBe(true);
  });

  it("config gate source asserts: storage_disabled phrase on both checkout paths", () => {
    const runtime = read("app/franchize/actions-runtime.ts");
    expect(runtime.includes("async function assertStorageServiceEnabled(slug: string)")).toBe(true);
    expect(runtime.includes('FranchizeOrderDocValidationError(["storage_disabled"])')).toBe(true);
    // human phrase goes straight to the owner's toast
    expect(runtime.includes("Зимнее хранение сейчас недоступно в этом экипаже — напишите менеджеру в Telegram.")).toBe(true);
    // pre-write call sites: submitFranchizeOrderNotification + createFranchizeOrderCheckout
    const callSites = (runtime.match(/await assertStorageServiceEnabled\(/g)?.length ?? 0) - (runtime.includes("async function assertStorageServiceEnabled(slug: string): Promise<void>") ? 0 : 0) - 0;
    // definition body contains 0 awaits; exactly 2 call sites expected
    const definitionSelfMatches = (runtime.match(/async function assertStorageServiceEnabled\(/g)?.length ?? 0);
    expect(definitionSelfMatches).toBe(1);
    expect(callSites).toBe(2);
    expect(callSites).toBe(2);
    // the editor checkbox promise is enforced end-to-end (page gates below)
    expect(runtime.includes("z.preprocess(")).toBe(true);
    expect(runtime.includes('raw === true || raw === "true"')).toBe(true);
  });
});

// ── UI wiring ────────────────────────────────────────────────────────────────

describe("wall client — money tiles, filters, sort, report pill, paid badges, story links", () => {
  const src = read("app/franchize/[slug]/storage/StorageWallClient.tsx");

  it("staff money tiles + clickable status filter chips + sort pills", () => {
    expect(src.includes("storageMoneyStatsOf(wall?.bikes ?? [])")).toBe(true);
    expect(src.includes("Ждёт оплаты ₽")).toBe(true);
    expect(src.includes("onClick={() => setStatusFilter(key)}")).toBe(true);
    expect(src.includes("onClick={() => setSortMode(mode)}")).toBe(true);
    expect(src.includes("sortStorageBikes(filterStorageBikes(base, statusFilter), sortMode)")).toBe(true);
    expect(src.includes("aria-pressed")).toBe(true);
  });

  it("cards: «Отчёт» pill sibling, story link, paid badge vs «оплата ждёт», tel: owner link", () => {
    expect(src.includes("<StorageReportButton")).toBe(true);
    expect(src.includes("storagePaidCovered(bike.paidUntil)")).toBe(true);
    expect(src.includes("оплата просрочена (до")).toBe(true);
    expect(src.includes("href={`tel:+7${phoneDigits.slice(-10)}`}")).toBe(true);
    expect(src.includes("storyHref = `/franchize/${slug}/storage/${bike.id}`")).toBe(true);
    // timeline renders new event kinds through the label map
    expect(src.includes("storageEventLabel(event.type)")).toBe(true);
  });

  it("guest offer comes from config with legacy fallbacks", () => {
    expect(src.includes("config?.address || \"Стригинский переулок, 13Б\"")).toBe(true);
    expect(src.includes("config?.defaultMonthlyPriceRub ?? 2000")).toBe(true);
    expect(src.includes("careDuties.map")).toBe(true);
  });

  it("config toggle gates the wall: staff banner + non-staff off-card + hidden CTA", () => {
    expect(src.includes("serviceEnabled = true")).toBe(true);
    expect(src.includes("const serviceOff = !serviceEnabled;")).toBe(true);
    expect(src.includes("отключена в конфиге экипажа")).toBe(true);
    expect(src.includes("Зимнее хранение временно недоступно")).toBe(true);
    expect(src.includes('{access !== "guest" && !serviceOff ? (')).toBe(true);
    // header season line computed from the config anchors, not the wall clock
    expect(src.includes("seasonRangeLabel(storageConfig)")).toBe(true);
    // no dev-speak / column names on staff tiles
    expect(src.includes("paid_until покрывает сегодня")).toBe(false);
  });

  it("token hygiene: only real CrewTokens keys (text/textMuted/textFaint)", () => {
    expect(src.includes("T.textPrimary")).toBe(false);
    expect(src.includes("T.textSecondary")).toBe(false);
  });
});

describe("story page — KPI band, payment + owner-link controls, data-free gate", () => {
  const src = read("app/franchize/[slug]/storage/StorageBikeStoryClient.tsx");
  const page = read("app/franchize/[slug]/storage/[bikeId]/page.tsx");

  it("client carries the full parity surface", () => {
    expect(src.includes("getStorageBikeStoryAction")).toBe(true);
    expect(src.includes("markStorageBikePaidAction")).toBe(true);
    expect(src.includes("linkStorageBikeOwnerAction")).toBe(true);
    expect(src.includes("dateDividerLabel")).toBe(true);
    expect(src.includes("<StorageReportButton")).toBe(true);
    expect(src.includes("Итого за сезон")).toBe(true);
    expect(src.includes("Оценка (ответств.)")).toBe(true);
    expect(src.includes("Привязать владельца (TG id)")).toBe(true);
    expect(src.includes("Оплата единовременно за сезон (п. 3 договора)")).toBe(true);
    // gate screen has a retry (Мотопарк parity)
    expect(src.includes("Попробовать снова")).toBe(true);
    // payment edit opens on the CURRENT paid date, not the season end
    expect(src.includes('useState(currentPaidUntil || seasonEnd || "")')).toBe(true);
    // token hygiene
    expect(src.includes("T.textPrimary")).toBe(false);
    expect(src.includes("T.textSecondary")).toBe(false);
  });

  it("page passes crew storage config and keeps header section links", () => {
    expect(page.includes("storageConfig={crew.storage}")).toBe(true);
    expect(page.includes("{ storageEnabled: crew.storage?.enabled }")).toBe(true);
    expect(page.includes("StorageBikeStoryClient")).toBe(true);
  });
});

// ── config editor + section links + de-hardcode ─────────────────────────────

describe("admin/crewowner config — editor, pipeline, section links", () => {
  it("section-links: opts.storageEnabled wins; undefined keeps legacy vip-bike rule", () => {
    const vip = buildFranchizeIntentLinks("vip-bike", "/franchize/vip-bike/storage");
    expect(vip.some((l) => l.label === "Хранение")).toBe(true);
    expect(buildFranchizeIntentLinks("svarprofi", "/franchize/svarprofi/catalog").some((l) => l.label === "Хранение")).toBe(false);
    expect(buildFranchizeIntentLinks("svarprofi", "/x", { storageEnabled: true }).some((l) => l.label === "Хранение")).toBe(true);
    expect(buildFranchizeIntentLinks("vip-bike", "/x", { storageEnabled: false }).some((l) => l.label === "Хранение")).toBe(false);
  });

  it("actions-runtime: config input + schema + save merge + load reads the storage block", () => {
    const src = read("app/franchize/actions-runtime.ts");
    expect(src.includes("storageEnabled: boolean;")).toBe(true);
    expect(src.includes("storageEnabled: z.preprocess(")).toBe(true);
    expect(src.includes('readPath(franchize, ["storage", "enabled"], slug === "vip-bike")')).toBe(true);
    expect(src.includes("enabled: payload.storageEnabled,")).toBe(true);
    expect(src.includes("address: payload.storageAddress,")).toBe(true);
    // VM hydration + empty/fallback crews
    expect(src.includes("storage: resolveStorageConfig(franchize, crew.slug ?? safeSlug),")).toBe(true);
    expect(src.includes("storage: resolveStorageConfig(null, slug),")).toBe(true);
  });

  it("fallback crew keeps the legacy vip-bike storage default", () => {
    const src = read("app/franchize/lib/fallback-crew.ts");
    expect(src.includes('storage: resolveStorageConfig(null, "vip-bike")')).toBe(true);
  });

  it("CreateFranchizeForm has the «Зимнее хранение» section and the fixed draft-clear", () => {
    const src = read("app/franchize/create/CreateFranchizeForm.tsx");
    expect(src.includes("Зимнее хранение (metadata.franchize.storage)")).toBe(true);
    expect(src.includes("checked={form.storageEnabled}")).toBe(true);
    expect(src.includes("updateField(\"storageAddress\"")).toBe(true);
    expect(src.includes("updateField(\"storageDefaultMonthlyPriceRub\"")).toBe(true);
    // latent-bug fix: the draft-clear path reads FranchizeConfigState.ok —
    // the save handler must not test a nonexistent .success flag
    expect(src.includes("if (result.ok) {")).toBe(true);
    expect(src.includes("if (result.success) {")).toBe(false);
  });

  it("order form + page: config pre-fills price/season/place, staff-confirmed rate still wins", () => {
    const form = read("app/franchize/[slug]/storage/StorageOrderForm.tsx");
    const page = read("app/franchize/[slug]/storage/new/page.tsx");
    expect(form.includes("defaultMonthlyPriceRub ?? 2000")).toBe(true);
    expect(form.includes("seasonStartMMDD || \"10-15\"")).toBe(true);
    expect(page.includes("storageConfig?.address || crew.contacts.address || \"Стригинский переулок, 13Б\"")).toBe(true);
    expect(page.includes("defaultMonthlyPriceRub={storageConfig?.defaultMonthlyPriceRub}")).toBe(true);
    // disabled service → off-card instead of the form
    expect(page.includes("const serviceEnabled = storageConfig?.enabled ?? true;")).toBe(true);
    expect(page.includes("Зимнее хранение временно недоступно")).toBe(true);
  });

  it("modal: city-neutral description when the crew configures its own place", () => {
    const src = read("app/franchize/components/WinterStorageModal.tsx");
    expect(src.includes("GENERIC_PLACE_DESCRIPTION")).toBe(true);
    expect(src.includes("storageAddress ? GENERIC_PLACE_DESCRIPTION : STORAGE_PLACE.description")).toBe(true);
  });

  it("types: paid_until hand-added in all three Row/Insert/Update shapes", () => {
    const src = read("types/database.types.ts");
    expect(src.match(/paid_until\???: string \| null/g)?.length).toBe(3);
  });

  it("status transitions unchanged: returned/cancelled are terminal", () => {
    expect(STORAGE_STATUS_TRANSITIONS.returned).toEqual([]);
    expect(STORAGE_STATUS_TRANSITIONS.cancelled).toEqual([]);
    expect(storageIsoToRu("2026-10-15")).toBe("15.10.2026");
  });
});
