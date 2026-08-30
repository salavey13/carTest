import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

// ─────────────────────────────────────────────────────────────────────────────
// iter21 — admin notification-failures loader fix + pickable date/month
// selectors:
//   1. deriveNotificationSendTo (payload JSONB → recipient label)
//   2. monthKeyToLabelRu (MonthPickerBar label)
//   3. source guards for every wiring point:
//      - actions-runtime failure query (no send_to column!)
//      - configurator CHECK-constraint-safe insert (no 'no_recipients')
//      - profile: both money counters use MonthPickerBar
//      - analytics: date chip is a picker (native input + showPicker)
// ─────────────────────────────────────────────────────────────────────────────

vi.mock("server-only", () => ({}));

import { deriveNotificationSendTo } from "@/app/franchize/lib/notification-log";
import { monthKeyToLabelRu } from "@/app/franchize/lib/subrenter-economics";

const read = (p: string) => readFileSync(p, "utf8");

// ── 1. deriveNotificationSendTo ──────────────────────────────────────────────

describe("iter21 · deriveNotificationSendTo (payload → recipient label)", () => {
  it("order-flow shape: recipient + telegramUserId combined", () => {
    const payload = {
      slug: "vip-bike",
      orderId: "ord-1",
      recipient: "Paul",
      telegramUserId: "413553377",
      phone: "+79001234567",
    };
    expect(deriveNotificationSendTo(payload)).toBe("Paul · TG 413553377");
  });

  it("accepts numeric telegramUserId (JSON numbers)", () => {
    expect(deriveNotificationSendTo({ recipient: "Иван", telegramUserId: 12345 })).toBe("Иван · TG 12345");
  });

  it("configurator shape: sentTo array joined into an id list", () => {
    const payload = {
      sentTo: [
        { tgId: "413553377", ok: true },
        { tgId: "8037950842", ok: false },
      ],
    };
    expect(deriveNotificationSendTo(payload)).toBe("413553377, 8037950842");
  });

  it("configurator shape: garbage entries skipped, numeric tgIds stringified", () => {
    const payload = {
      sentTo: [
        null,
        "garbage",
        { tgId: 42, ok: false },
        { ok: true }, // no tgId
        { tgId: "  " }, // blank
      ],
    };
    expect(deriveNotificationSendTo(payload)).toBe("42");
  });

  it("single-sided fallbacks: recipient only, tgId only, neither", () => {
    expect(deriveNotificationSendTo({ recipient: "Anna" })).toBe("Anna");
    expect(deriveNotificationSendTo({ telegramUserId: "99" })).toBe("TG 99");
    expect(deriveNotificationSendTo({ orderId: "x" })).toBe("");
  });

  it("non-object payloads and empties → empty string", () => {
    expect(deriveNotificationSendTo(null)).toBe("");
    expect(deriveNotificationSendTo(undefined)).toBe("");
    expect(deriveNotificationSendTo("string")).toBe("");
    expect(deriveNotificationSendTo(42)).toBe("");
    expect(deriveNotificationSendTo({})).toBe("");
    expect(deriveNotificationSendTo({ recipient: "   ", telegramUserId: "" })).toBe("");
  });

  it("sentTo empty array falls through to recipient/telegramUserId chain", () => {
    const payload = { sentTo: [], recipient: "Paul", telegramUserId: "413553377" };
    expect(deriveNotificationSendTo(payload)).toBe("Paul · TG 413553377");
  });
});

// ── 2. monthKeyToLabelRu ─────────────────────────────────────────────────────

describe("iter21 · monthKeyToLabelRu (MonthPickerBar label)", () => {
  it("formats a valid YYYY-MM key", () => {
    expect(monthKeyToLabelRu("2026-08")).toBe("Август 2026");
    expect(monthKeyToLabelRu("2026-01")).toBe("Январь 2026");
    expect(monthKeyToLabelRu("2025-12")).toBe("Декабрь 2025");
  });

  it("invalid keys → neutral placeholder (no throw)", () => {
    expect(monthKeyToLabelRu("")).toBe("Месяц");
    expect(monthKeyToLabelRu("2026-13")).toBe("Месяц");
    expect(monthKeyToLabelRu("garbage")).toBe("Месяц");
  });
});

// ── 3. Source guards ─────────────────────────────────────────────────────────

describe("iter21 · source guards", () => {
  it("notification failures query selects payload — the send_to column must never be queried", () => {
    const src = read("app/franchize/actions-runtime.ts");
    expect(src).toContain('.select("order_id, payload, last_error, created_at")');
    expect(src).toContain("deriveNotificationSendTo(row.payload)");
    // the bug itself: any select mentioning the non-existent column
    expect(src).not.toMatch(/\.select\([^)]*\bsend_to\b/);
  });

  it("configurator insert respects the CHECK constraint (no 'no_recipients' status)", () => {
    const src = read("app/franchize/[slug]/configurator/actions_configurator.ts");
    expect(src).not.toContain('"no_recipients"');
    // no-recipients case becomes an explicit failed row with a readable error
    expect(src).toContain("Получатели не настроены");
    expect(src).toContain('send_status: failures.length === sendResults.length ? "failed" : "sent"');
    // failed sends record the per-recipient error
    expect(src).toMatch(/failures\.map\(\(f\) => `\$\{f\.id\}: /);
  });

  it("profile: BOTH money counters use the shared MonthPickerBar, old ‹ › switchers gone", () => {
    const src = read("app/franchize/[slug]/profile/ProfileClient.tsx");
    expect(src).toContain('import { MonthPickerBar } from "../../components/FranchizeMonthPicker"');
    expect((src.match(/<MonthPickerBar/g) ?? []).length).toBeGreaterThanOrEqual(2);
    expect(src).toContain("value={subrenterMonth}");
    expect(src).toContain("value={payoutsMonth}");
    // the old bare-chevron switchers are gone
    expect(src).not.toContain("setSubrenterMonth((m) => shiftMonthKey");
    expect(src).not.toContain("setPayoutsMonth((m) => shiftMonthKey");
  });

  it("MonthPickerBar: iterate + year stepper + 12-month grid + current-month jump", () => {
    const src = read("app/franchize/components/FranchizeMonthPicker.tsx");
    // iterate
    expect(src).toContain("shiftMonthKey(norm, -1)");
    expect(src).toContain("shiftMonthKey(norm, 1)");
    // label comes from the shared lib (single source of truth)
    expect(src).toContain("monthKeyToLabelRu(norm)");
    // direct pick
    expect(src).toContain("Текущий месяц");
    expect(src).toContain("currentMskMonthKey()");
    expect(src).toMatch(/grid-cols-3/);
    expect(src).toContain('role="dialog"');
    expect(src).toMatch(/aria-label="Предыдущий год"/);
    expect(src).toMatch(/aria-label="Следующий год"/);
    // closes on outside interaction (both pointer families) and Escape
    expect(src).toContain('document.addEventListener("mousedown", onDown)');
    expect(src).toContain('document.addEventListener("touchstart", onDown)');
    expect(src).toContain('e.key === "Escape"');
  });

  it("analytics date nav: chip is a real picker (native input + showPicker), iterator kept", () => {
    const src = read("app/franchize/[slug]/rentals-analytics/components/AnalyticsDateNav.tsx");
    // pick directly
    expect(src).toContain('type="date"');
    expect(src).toContain("showPicker");
    // the label wraps the hidden input so the whole chip opens the picker
    expect(src).toMatch(/<label[\s\S]*?<input[\s\S]*?ref=\{dateInputRef\}/);
    // iterate + today kept
    expect(src).toContain("shiftDateIso(date, -1)");
    expect(src).toContain("shiftDateIso(date, 1)");
    expect(src).toContain("todayLocalIso()");
    expect(src).toContain("Сегодня");
    // only complete YYYY-MM-DD values are committed (no mid-edit "" commits)
    expect(src).toContain("/^\\d{4}-\\d{2}-\\d{2}$/.test(e.target.value)");
  });

  it("admin panel failure list still renders the derived sendTo + retry", () => {
    const src = read("app/franchize/components/FranchizeAdminClient.tsx");
    expect(src).toContain("{item.sendTo || \"не указан\"}");
    expect(src).toContain("handleRetryNotification(item.orderId)");
    // the loader toast with the ACTUAL error is intact (M4 fix)
    expect(src).toContain("Не удалось загрузить уведомления");
  });
});
