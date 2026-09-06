/**
 * tests/franchize/lead-playbook-done.spec.ts
 *
 * Тесты чистой логики дневных отметок «сделал» плейбука смены
 * (lib/lead-playbook-done.ts). Главный сценарий — ВКЛАДКА, ПЕРЕЖИВШАЯ
 * ПОЛНОЧЬ (ночная смена): без защиты state держит вчерашние ключи, и
 * следующий toggle записывает их уже под новым днём — вчерашняя смена
 * протекает в новую.
 *  1. playbookTodayKey — локальная дата YYYY-MM-DD с нулями.
 *  2. msUntilNextMidnight — остаток до следующей полуночи (+1 c запас).
 *  3. parsePlaybookDone — чужой день / битый JSON / мусор в keys → пустой набор.
 *  4. applyPlaybookDoneToggle — add/remove; ЧУЖОЙ день сбрасывается ДО
 *     применения (протекания нет), «added» различает «сделал» и «вернул».
 */

import { describe, expect, it } from "vitest";
import {
  applyPlaybookDoneToggle,
  msUntilNextMidnight,
  parsePlaybookDone,
  playbookTodayKey,
} from "@/app/franchize/[slug]/leads/lib/lead-playbook-done";

describe("lead-playbook-done", () => {
  describe("playbookTodayKey", () => {
    it("форматирует локальную дату с ведущими нулями", () => {
      expect(playbookTodayKey(new Date(2026, 8, 7, 13, 45))).toBe("2026-09-07");
      expect(playbookTodayKey(new Date(2026, 11, 31, 23, 59))).toBe("2026-12-31");
      expect(playbookTodayKey(new Date(2027, 0, 1, 0, 0))).toBe("2027-01-01");
    });
  });

  describe("msUntilNextMidnight", () => {
    it("до полуночи — остаток дня + 1 c запаса", () => {
      const noon = new Date(2026, 8, 7, 12, 0, 0);
      expect(msUntilNextMidnight(noon)).toBe(12 * 60 * 60 * 1000 + 1000);
    });

    it("после полуночи остаток считается от НОВОГО дня", () => {
      const justAfter = new Date(2026, 8, 7, 0, 0, 30);
      // До 00:00:01 следующего дня: 23 ч 59 м 31 с.
      expect(msUntilNextMidnight(justAfter)).toBe(23 * 60 * 60 * 1000 + 59 * 60 * 1000 + 31 * 1000);
    });

    it("никогда не возвращает меньше 1 с (защита от отрицательного остатка)", () => {
      const edge = new Date(2026, 8, 7, 23, 59, 59, 900);
      expect(msUntilNextMidnight(edge)).toBeGreaterThanOrEqual(1000);
    });
  });

  describe("parsePlaybookDone", () => {
    it("парсит запись сегодняшнего дня", () => {
      const now = new Date(2026, 8, 7, 10, 0);
      const raw = JSON.stringify({ day: "2026-09-07", keys: ["call_hot:1", "recall:2"] });
      expect(parsePlaybookDone(raw, now)).toEqual(new Set(["call_hot:1", "recall:2"]));
    });

    it("чужой день → пустой набор (новая смена = чистая очередь)", () => {
      const now = new Date(2026, 8, 8, 0, 5);
      const raw = JSON.stringify({ day: "2026-09-07", keys: ["call_hot:1"] });
      expect(parsePlaybookDone(raw, now).size).toBe(0);
    });

    it("битый JSON / null / не-строковые ключи → пустой набор без исключений", () => {
      const now = new Date(2026, 8, 7, 10, 0);
      expect(parsePlaybookDone("not json{", now).size).toBe(0);
      expect(parsePlaybookDone(null, now).size).toBe(0);
      expect(parsePlaybookDone(undefined, now).size).toBe(0);
      const garbage = JSON.stringify({ day: "2026-09-07", keys: ["ok", 42, null, true] });
      expect(parsePlaybookDone(garbage, now)).toEqual(new Set(["ok"]));
    });
  });

  describe("applyPlaybookDoneToggle", () => {
    const today = new Date(2026, 8, 7, 21, 0);

    it("добавляет и снимает отметку, added различает направления", () => {
      const added = applyPlaybookDoneToggle({ day: "2026-09-07", keys: new Set() }, "call_hot:1", today);
      expect(added.added).toBe(true);
      expect(added.keys.has("call_hot:1")).toBe(true);

      const removed = applyPlaybookDoneToggle(
        { day: "2026-09-07", keys: new Set(["call_hot:1"]) },
        "call_hot:1",
        today,
      );
      expect(removed.added).toBe(false);
      expect(removed.keys.has("call_hot:1")).toBe(false);
    });

    it("ГРАНИЦА ДНЯ: чужой день в state сбрасывается ДО toggle — вчерашние отметки не протекают в запись нового дня", () => {
      const justAfterMidnight = new Date(2026, 8, 8, 0, 1);
      const staleState = { day: "2026-09-07", keys: new Set(["recall:2", "pull_up:3"]) };

      const next = applyPlaybookDoneToggle(staleState, "call_hot:9", justAfterMidnight);

      expect(next.day).toBe("2026-09-08");
      expect(Array.from(next.keys)).toEqual(["call_hot:9"]);
      expect(next.added).toBe(true);
    });

    it("граница дня при toggle чужого ключа: трактуется как свежая отметка НОВОГО дня", () => {
      const justAfterMidnight = new Date(2026, 8, 8, 0, 1);
      const staleState = { day: "2026-09-07", keys: new Set(["recall:2"]) };

      const next = applyPlaybookDoneToggle(staleState, "recall:2", justAfterMidnight);

      // База — чистый набор нового дня, поэтому тап добавляет ключ заново
      // (в UI строка после сброса вернулась в очередь; оператор снова
      // отмечает «сделал» — это обычное добавление).
      expect(next.day).toBe("2026-09-08");
      expect(next.keys).toEqual(new Set(["recall:2"]));
      expect(next.added).toBe(true);
    });

    it("тот же день: существующие отметки сохраняются", () => {
      const state = { day: "2026-09-07", keys: new Set(["a:1", "b:2"]) };
      const next = applyPlaybookDoneToggle(state, "c:3", today);
      expect(next.day).toBe("2026-09-07");
      expect(next.keys).toEqual(new Set(["a:1", "b:2", "c:3"]));
    });
  });
});
