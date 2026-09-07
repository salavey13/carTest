// tests/franchize/lead-view-history.spec.ts
//
// Спеки истории просмотров «за смену» (next iteration ideas: «per-lead
// view history — which leads you already opened this shift»): чужой день
// сбрасывает историю, капа вытесняет старейшие, дубли не размножаются.

import { describe, expect, it } from "vitest";
import {
  applyLeadViewed,
  parseLeadViewHistory,
  serializeLeadViewHistory,
  VIEWED_HISTORY_CAP,
  viewedHistoryKey,
} from "@/app/franchize/[slug]/leads/lib/lead-view-history";

const NOON = new Date(2026, 8, 8, 12, 0, 0); // локальный полдень 2026-09-08

const ids = (arr: string[]): string => JSON.stringify({ day: "2026-09-08", ids: arr });

describe("viewedHistoryKey: ключ на экипаж", () => {
  it("формирует ключ с префиксом сменного стора", () => {
    expect(viewedHistoryKey("motorpark")).toBe("leads-viewed:motorpark");
  });
});

describe("parseLeadViewHistory: свежесменная история или пустое множество", () => {
  it("null/пусто → пустое множество", () => {
    expect(parseLeadViewHistory(null, NOON).size).toBe(0);
    expect(parseLeadViewHistory(undefined, NOON).size).toBe(0);
    expect(parseLeadViewHistory("", NOON).size).toBe(0);
  });

  it("битый JSON → пустое множество (не падаем)", () => {
    expect(parseLeadViewHistory("{не json", NOON).size).toBe(0);
    expect(parseLeadViewHistory("42", NOON).size).toBe(0);
    expect(parseLeadViewHistory("{}", NOON).size).toBe(0); // нет day/ids
  });

  it("чужой день (вкладка пережила полночь) → пустое множество", () => {
    expect(parseLeadViewHistory(ids(["a", "b"]), NOON).size).toBe(2);
    const nextDay = new Date(2026, 8, 9, 0, 0, 5);
    expect(parseLeadViewHistory(ids(["a", "b"]), nextDay).size).toBe(0);
  });

  it("нестроковые и пустые id отбрасываются, дубли схлопываются", () => {
    const raw = JSON.stringify({ day: "2026-09-08", ids: ["a", 42, null, "", "a", "b"] });
    const parsed = parseLeadViewHistory(raw, NOON);
    expect(Array.from(parsed)).toEqual(["a", "b"]);
  });

  it("капа отрезает СТАРЕШУЮ голову (порядок добавления сохранён)", () => {
    const many = Array.from({ length: VIEWED_HISTORY_CAP + 10 }, (_, i) => `lead-${i}`);
    const parsed = parseLeadViewHistory(JSON.stringify({ day: "2026-09-08", ids: many }), NOON);
    expect(parsed.size).toBe(VIEWED_HISTORY_CAP);
    expect(parsed.has("lead-0")).toBe(false); // старейшие вытеснены
    expect(parsed.has(`lead-${VIEWED_HISTORY_CAP + 9}`)).toBe(true); // свежие на месте
  });
});

describe("applyLeadViewed: чистое добавление", () => {
  it("добавляет нового лида, не мутируя базу", () => {
    const base = new Set(["a"]);
    const next = applyLeadViewed(base, "b");
    expect(Array.from(next)).toEqual(["a", "b"]);
    expect(base.size).toBe(1); // база не тронута
  });

  it("уже просмотренный лид возвращает ТОТ ЖЕ экземпляр (без рендера)", () => {
    const base = new Set(["a", "b"]);
    expect(applyLeadViewed(base, "a")).toBe(base);
  });

  it("переполнение вытесняет старейшего (FIFO, свежая память смены)", () => {
    let set = new Set<string>();
    for (let i = 0; i < VIEWED_HISTORY_CAP + 1; i++) {
      set = applyLeadViewed(set, `lead-${i}`);
    }
    expect(set.size).toBe(VIEWED_HISTORY_CAP);
    expect(set.has("lead-0")).toBe(false);
    expect(set.has(`lead-${VIEWED_HISTORY_CAP}`)).toBe(true);
  });

  it("кастомная капа работает для тестов/будущих настроек", () => {
    let set = new Set<string>(["x", "y"]);
    set = applyLeadViewed(set, "z", 2);
    expect(Array.from(set)).toEqual(["y", "z"]);
  });
});

describe("serializeLeadViewHistory: круглый маршрут", () => {
  it("сериализация → парс возвращает то же множество (тот же день)", () => {
    const source = new Set(["a", "b", "c"]);
    const parsed = parseLeadViewHistory(serializeLeadViewHistory(source, NOON), NOON);
    expect(Array.from(parsed)).toEqual(["a", "b", "c"]);
  });

  it("запись всегда под ТЕКУЩИЙ день (защита от протекания смены)", () => {
    const stale = new Set(["yesterday"]);
    const raw = serializeLeadViewHistory(stale, NOON);
    expect(JSON.parse(raw).day).toBe("2026-09-08");
  });
});
