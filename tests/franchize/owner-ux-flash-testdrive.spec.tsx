// tests/franchize/owner-ux-flash-testdrive.spec.ts
// ── Owner UX batch (2026-10-04): bike-card auto-scroll to date pickers,
// testdrive end = start + 10 min, fullscreen cart-added flash ────────────────
// Per repo convention: pure logic is unit-tested, component/graph wiring is
// asserted on the SOURCE (see deposit-rail-wiring.spec.ts).
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { addMinutesToHhMm, addMinutesToDateTime } from "@/app/franchize/lib/date-utils";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..");
const read = (rel: string) => readFileSync(join(repoRoot, rel), "utf8");

describe("addMinutesToHhMm (testdrive end = start + 10 min)", () => {
  it("adds minutes inside the same hour/day", () => {
    expect(addMinutesToHhMm("14:32", 10)).toBe("14:42");
    expect(addMinutesToHhMm("09:05", 10)).toBe("09:15");
  });

  it("carries into the next hour and wraps past midnight", () => {
    expect(addMinutesToHhMm("14:55", 10)).toBe("15:05");
    expect(addMinutesToHhMm("23:55", 10)).toBe("00:05");
  });

  it("handles arbitrary minute amounts", () => {
    expect(addMinutesToHhMm("14:32", 90)).toBe("16:02");
    expect(addMinutesToHhMm("00:00", 24 * 60)).toBe("00:00");
  });

  it("returns an empty string for invalid input (renderers show nothing)", () => {
    expect(addMinutesToHhMm("", 10)).toBe("");
    expect(addMinutesToHhMm(undefined, 10)).toBe("");
    expect(addMinutesToHhMm("7:5", 10)).toBe("");
    expect(addMinutesToHhMm("25:00", 10)).toBe("");
    expect(addMinutesToHhMm("12:60", 10)).toBe("");
    expect(addMinutesToHhMm("abc", 10)).toBe("");
  });
});

describe("addMinutesToDateTime (testdrive end = start + 10 min, date rollover)", () => {
  it("adds minutes inside the same day", () => {
    expect(addMinutesToDateTime("2026-10-04", "14:32", 10)).toEqual({ date: "2026-10-04", time: "14:42" });
    expect(addMinutesToDateTime("2026-10-04", "14:55", 10)).toEqual({ date: "2026-10-04", time: "15:05" });
  });

  it("rolls past midnight, month and year boundaries", () => {
    expect(addMinutesToDateTime("2026-10-04", "23:55", 10)).toEqual({ date: "2026-10-05", time: "00:05" });
    expect(addMinutesToDateTime("2026-10-31", "23:55", 10)).toEqual({ date: "2026-11-01", time: "00:05" });
    expect(addMinutesToDateTime("2026-12-31", "23:55", 10)).toEqual({ date: "2027-01-01", time: "00:05" });
  });

  it("returns null for invalid input", () => {
    expect(addMinutesToDateTime("", "14:32", 10)).toBeNull();
    expect(addMinutesToDateTime(undefined, "14:32", 10)).toBeNull();
    expect(addMinutesToDateTime("2026-10-04", "", 10)).toBeNull();
    expect(addMinutesToDateTime("2026-10-04", "25:00", 10)).toBeNull();
    expect(addMinutesToDateTime("not-a-date", "14:32", 10)).toBeNull();
    expect(addMinutesToDateTime("2026-13-40", "14:32", 10)).toBeNull();
  });
});

describe("CartAddedFlash (fullscreen add-to-cart confirmation) — source contract", () => {
  // The repo's vitest pipeline keeps tsconfig jsx:preserve, so app .tsx
  // components are asserted on the SOURCE (repo convention, see iter21-suite).
  const src = read("app/franchize/components/CartAddedFlash.tsx");

  it("covers the whole viewport as a modal dialog, nothing renders without a flash", () => {
    expect(src.includes("className=\"fixed inset-0 z-[9999] flex items-center justify-center px-6\"")).toBe(true);
    expect(src.includes("role=\"dialog\"")).toBe(true);
    expect(src.includes("aria-modal=\"true\"")).toBe(true);
    expect(src.includes("{flash && (")).toBe(true);
  });

  it("greets cart adds and testdrive bookings with dedicated titles", () => {
    expect(src.includes("Вы записаны на тест-драйв")).toBe(true);
    expect(src.includes("Добавлено в корзину")).toBe(true);
  });

  it("auto-dismisses after ~2.6s, closes on ESC and backdrop tap, card tap stays", () => {
    expect(src.includes("const AUTO_DISMISS_MS = 2600;")).toBe(true);
    expect(src.includes("if (event.key === \"Escape\") closeRef.current();")).toBe(true);
    // backdrop onClick closes the flash…
    expect(src.includes("aria-label={flash.kind === \"testdrive\" ? \"Вы записаны на тест-драйв\" : \"Добавлено в корзину\"}")).toBe(true);
    expect(src.includes("onClick={onClose}")).toBe(true);
    // …while the inner card stops propagation so a misclick on the card
    // does not dismiss it
    expect(src.includes("onClick={(event) => event.stopPropagation()}")).toBe(true);
  });

  it("offers a cart shortcut and a keep-browsing exit, both 44px+ tap targets", () => {
    expect(src.includes("href={cartHref}")).toBe(true);
    expect(src.includes("Перейти в корзину")).toBe(true);
    expect(src.includes("Продолжить выбор")).toBe(true);
    expect((src.match(/min-h-11/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });
});

describe("wiring: bike-card auto-scroll + testdrive end time + flash", () => {
  it("ItemModal scrolls the rental config into view on open", () => {
    const src = read("app/franchize/modals/Item.tsx");
    expect(src.includes("rentalConfigRef")).toBe(true);
    expect(src.includes("rentalConfigRef.current?.scrollIntoView({ behavior: \"smooth\", block: \"start\" })")).toBe(true);
    // the ref wraps the rental-only block (dates + testdrive switch)
    expect(src.includes("{isRental && (\n              <div ref={rentalConfigRef}>")).toBe(true);
    // wait for the modal entrance before scrolling
    expect(src.includes("window.setTimeout")).toBe(true);
  });

  it("ItemModal hands the ride end (start + 10 min) to the parent", () => {
    const src = read("app/franchize/modals/Item.tsx");
    expect(src.includes("onTestdrive?: (slot?: { date: string; time: string; endTime?: string })")).toBe(true);
    expect(src.includes("endTime: addMinutesToHhMm(testdriveTime, 10) || undefined")).toBe(true);
    // 2026-10-04 iter2 (owner): the END is a real read-only picker field,
    // derived from start + 10 minutes WITH the calendar date (rollover-safe)
    expect(src.includes("Окончание · +10 минут")).toBe(true);
    expect(src.includes("value={`${formatRuDateFromISO(tdEnd.date)} ${tdEnd.time}`}")).toBe(true);
    expect(src.includes("readOnly")).toBe(true);
  });

  it("selecting testdrive stamps start = CURRENT time unconditionally", () => {
    // 2026-10-04 iter2 (owner): «при выборе тест-драйва дата начала =
    // текущее время» — the old `prev ||` kept a stale date across toggles.
    const src = read("app/franchize/modals/Item.tsx");
    expect(src.includes("setTestdriveDate(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`);")).toBe(true);
    expect(src.includes("setTestdriveTime(`${pad(now.getHours())}:${pad(now.getMinutes())}`);")).toBe(true);
    // the stale-guard pattern must be gone
    expect(src.includes("setTestdriveDate((prev) => prev || ")).toBe(false);
    expect(src.includes("setTestdriveTime((prev) => prev || ")).toBe(false);
  });

  it("CatalogClient stores rentEndTime on the testdrive line and pops the flash on every add", () => {
    const src = read("app/franchize/components/CatalogClient.tsx");
    expect(src.includes("rentEndTime: slot?.endTime || addMinutesToHhMm(slot?.time || fallbackTime, 10),")).toBe(true);
    // three add-paths trigger the fullscreen flash
    const flashes = src.split("setCartFlash({").length - 1;
    expect(flashes).toBe(3);
    expect(src.includes("<CartAddedFlash")).toBe(true);
    expect(src.includes("cartHref={`/franchize/${resolvedSlug}/cart`}")).toBe(true);
  });

  it("cart badge and checkout window show the 14:32–14:42 range", () => {
    const lines = read("app/franchize/hooks/useFranchizeCartLines.ts");
    expect(lines.includes("const timeLabel = t ? `${t}${end && end !== t ? `–${end}` : \"\"}` : \"\";")).toBe(true);
    const order = read("app/franchize/components/OrderPageClient.tsx");
    expect(order.includes("|| firstTestdriveLineWithDate?.options.rentEndTime")).toBe(true);
  });

  it("operator notification shows the testdrive window", () => {
    const src = read("app/franchize/actions-runtime.ts");
    expect(src.includes("tdTimeLabel")).toBe(true);
    expect(src.includes("Тест-драйв: ${payload.rentalStartDate}${tdTimeLabel}")).toBe(true);
  });
});
