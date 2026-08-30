import { describe, expect, it, vi } from "vitest";
import { readFileSync, existsSync } from "node:fs";

// ─────────────────────────────────────────────────────────────────────────────
// iter22 — code-review / polish / edge-case pass over iter21:
//   1. deriveNotificationKind — configurator rows must not offer order Retry
//   2. timezone-deterministic date labels (formatDateLong, formatRussianDateOnly)
//   3. sales & commercial-offers analytics date navs became pickers (T3 gap)
//   4. MonthPickerBar rapid-tap fix (lastEmittedRef)
//   5. v2 analytics date nav keyboard access
//   6. dead duplicate components removed
// ─────────────────────────────────────────────────────────────────────────────

vi.mock("server-only", () => ({}));

import { deriveNotificationKind } from "@/app/franchize/lib/notification-log";
import { formatDateLong } from "@/app/franchize/[slug]/rentals-analytics/components/lib/analytics-utils";
import { formatRussianDateOnly } from "@/app/franchize/[slug]/rentals-analytics/analytics-utils";

const read = (p: string) => readFileSync(p, "utf8");

// ── 1. deriveNotificationKind ────────────────────────────────────────────────

describe("iter22 · deriveNotificationKind (order vs configurator rows)", () => {
  it("explicit kind marker wins", () => {
    expect(deriveNotificationKind({ kind: "configurator", sentTo: [] })).toBe("configurator");
    expect(deriveNotificationKind({ kind: "order", recipient: "Paul" })).toBe("order");
  });

  it("legacy configurator rows detected via sentTo[] (no kind marker)", () => {
    expect(deriveNotificationKind({ sentTo: [{ tgId: "1", ok: false }] })).toBe("configurator");
    expect(deriveNotificationKind({ sentTo: [] })).toBe("configurator");
  });

  it("order-flow payload (recipient + telegramUserId) → order", () => {
    expect(deriveNotificationKind({ recipient: "Paul", telegramUserId: "413553377" })).toBe("order");
  });

  it("garbage / non-object payloads → order (safe default)", () => {
    expect(deriveNotificationKind(null)).toBe("order");
    expect(deriveNotificationKind(undefined)).toBe("order");
    expect(deriveNotificationKind("str")).toBe("order");
    expect(deriveNotificationKind({})).toBe("order");
  });

  it("kind marker only counts when it says configurator (typos don't misdetect)", () => {
    expect(deriveNotificationKind({ kind: "Configurator" })).toBe("order");
    expect(deriveNotificationKind({ kind: 42 })).toBe("order");
  });
});

// ── 2. timezone-deterministic date labels ────────────────────────────────────

describe("iter22 · timezone-deterministic date labels", () => {
  // Device west of UTC: `new Date("2026-08-30")` is Aug 29 20:00 local — the
  // old device-tz rendering showed the PREVIOUS day. The fixed helpers must
  // render the exact calendar date. (Best-effort TZ switch: Node on Linux
  // honors process.env.TZ changes; if the runner ignores it the test still
  // guards the happy path.)
  const withTz = <T>(tz: string, fn: () => T): T => {
    const prev = process.env.TZ;
    process.env.TZ = tz;
    try {
      return fn();
    } finally {
      if (prev === undefined) delete process.env.TZ;
      else process.env.TZ = prev;
    }
  };

  it("formatDateLong renders the exact MSK calendar date regardless of device tz", () => {
    const utc = withTz("UTC", () => formatDateLong("2026-08-30"));
    const west = withTz("America/New_York", () => formatDateLong("2026-08-30"));
    const east = withTz("Asia/Vladivostok", () => formatDateLong("2026-08-30"));
    expect(utc).toBe(west);
    expect(utc).toBe(east);
    expect(utc).toContain("30 августа 2026");
    // weekday of 2026-08-30 is Sunday («воскресенье»)
    expect(utc.toLowerCase()).toContain("воскресенье");
  });

  it("formatRussianDateOnly renders the exact calendar date regardless of device tz", () => {
    const utc = withTz("UTC", () => formatRussianDateOnly("2026-08-30"));
    const west = withTz("America/New_York", () => formatRussianDateOnly("2026-08-30"));
    expect(utc).toBe(west);
    expect(utc).toBe("30 авг. 2026");
  });

  it("formatRussianDateOnly tolerates null / garbage without throwing", () => {
    expect(formatRussianDateOnly(null)).toBe("—");
    expect(formatRussianDateOnly("")).toBe("—");
    expect(formatRussianDateOnly("garbage")).toBe("—");
  });

  it("source: both formatters anchor date-only parsing (no bare new Date(iso))", () => {
    const lib = read("app/franchize/[slug]/rentals-analytics/components/lib/analytics-utils.ts");
    expect(lib).toContain("T00:00:00Z");
    expect(lib).toContain('timeZone: "Europe/Moscow"');

    const utils = read("app/franchize/[slug]/rentals-analytics/analytics-utils.ts");
    // part-wise local-midnight construction for date-only strings
    expect(utils).toMatch(/new Date\(Number\(m\[1\]\), Number\(m\[2\]\) - 1, Number\(m\[3\]\)\)/);
  });
});

// ── 3. sales & commercial-offers analytics date navs are pickers too ─────────

describe("iter22 · sales / commercial-offers AnalyticsDateNav (T3 gap closed)", () => {
  const nav = "app/franchize/[slug]/rentals-analytics/analytics-components/AnalyticsDateNav.tsx";

  it("chip is a picker: label wraps a hidden native date input with showPicker", () => {
    const src = read(nav);
    expect(src).toContain('type="date"');
    expect(src).toContain("showPicker");
    expect(src).toMatch(/<label[\s\S]*?<input[\s\S]*?ref=\{dateInputRef\}/);
    // only complete YYYY-MM-DD values are committed
    expect(src).toContain("/^\\d{4}-\\d{2}-\\d{2}$/.test(e.target.value)");
  });

  it("day math is MSK/UTC-correct — no UTC-based «Сегодня», no local Date stepping", () => {
    const src = read(nav);
    expect(src).toContain("todayLocalIso()");
    expect(src).toContain("shiftDateIso(selectedDate, -1)");
    expect(src).toContain("shiftDateIso(selectedDate, 1)");
    // the old UTC-today bug must never come back
    expect(src).not.toContain('new Date().toISOString().split("T")[0]');
    expect(src).not.toContain("new Date(selectedDate)");
  });

  it("keyboard: Enter/Space open the picker; buttons are type=button", () => {
    const src = read(nav);
    expect(src).toMatch(/e\.key === "Enter"/);
    expect(src).toMatch(/e\.key === " "/);
    // every plain button must be type="button" (no accidental form submits)
    const plainButtons = src.match(/<button(?![^>]*type="button")[^>]*>/g) ?? [];
    expect(plainButtons).toHaveLength(0);
  });

  it("both analytics pages still render it with the same props contract", () => {
    const sales = read("app/franchize/[slug]/sales-analytics/SalesAnalyticsClient.tsx");
    const offers = read("app/franchize/[slug]/commercial-offers-analytics/CommercialOffersAnalyticsClient.tsx");
    for (const src of [sales, offers]) {
      expect(src).toContain("AnalyticsDateNav");
      expect(src).toContain("selectedDate={selectedDate}");
    }
  });
});

// ── 4. MonthPickerBar rapid-tap fix ──────────────────────────────────────────

describe("iter22 · MonthPickerBar rapid-tap fix", () => {
  it("iterate steps from the last EMITTED key (ref), not the stale props value", () => {
    const src = read("app/franchize/components/FranchizeMonthPicker.tsx");
    expect(src).toContain("const lastEmittedRef = useRef");
    expect(src).toContain("shiftMonthKey(lastEmittedRef.current, delta)");
    expect(src).toContain("lastEmittedRef.current = next");
    // ref re-syncs when the parent's value legitimately changes
    expect(src).toMatch(/useEffect\(\(\) => \{\s*lastEmittedRef\.current = norm;\s*\}, \[norm\]\)/);
  });
});

// ── 5. v2 analytics date nav keyboard access ─────────────────────────────────

describe("iter22 · v2 AnalyticsDateNav keyboard access", () => {
  it("hidden input is Tab-reachable and Enter/Space open the picker", () => {
    const src = read("app/franchize/[slug]/rentals-analytics/components/AnalyticsDateNav.tsx");
    expect(src).not.toContain("tabIndex={-1}");
    expect(src).toMatch(/e\.key === "Enter"/);
    expect(src).toMatch(/e\.key === " "/);
  });
});

// ── 6. configurator failure rows: kind marker + retry guard + admin UI ────────

describe("iter22 · configurator failure rows in the admin panel", () => {
  it("configurator insert writes the kind marker", () => {
    const src = read("app/franchize/[slug]/configurator/actions_configurator.ts");
    expect(src).toContain('kind: "configurator"');
  });

  it("failures loader maps kind; retry action guards configurator payloads", () => {
    const src = read("app/franchize/actions-runtime.ts");
    expect(src).toContain("kind: deriveNotificationKind(row.payload)");
    // defense in depth: clear error instead of an opaque zod failure
    expect(src).toContain("Это конфигурация из конфигуратора, а не заказ");
  });

  it("admin UI labels configurator rows and hides the order Retry for them", () => {
    const src = read("app/franchize/components/FranchizeAdminClient.tsx");
    expect(src).toContain("Конфигурация #");
    expect(src).toContain("пересоберите конфигурацию");
    // retry button still there for order rows
    expect(src).toContain("handleRetryNotification(item.orderId)");
  });
});

// ── 7. dead duplicate components removed ─────────────────────────────────────

describe("iter22 · dead duplicate analytics components removed", () => {
  it("franchize/components/Analytics{DateNav,StatCards,CrossNav}.tsx no longer exist", () => {
    expect(existsSync("app/franchize/components/AnalyticsDateNav.tsx")).toBe(false);
    expect(existsSync("app/franchize/components/AnalyticsStatCards.tsx")).toBe(false);
    expect(existsSync("app/franchize/components/AnalyticsCrossNav.tsx")).toBe(false);
  });
});
