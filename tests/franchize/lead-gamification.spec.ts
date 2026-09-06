/**
 * tests/franchize/lead-gamification.spec.ts
 *
 * Тесты «Пути оператора» (lib/lead-gamification.ts) — связка
 * «плейбук ↔ достижения ↔ лиды»:
 *  1. XP: сумма по sticky-стору, мусорные значения игнорируются.
 *  2. Звания: пороги, прогресс к следующему, максимум — «Легенда экипажа».
 *  3. XP за событие тоста: открытие = полный уровень, апгрейд = дельта.
 *  4. ЦЕЛОСТНОСТЬ КАРТЫ КОРМЛЕНИЯ: каждый id из PLAYBOOK_FEEDS существует
 *     в computeLeadAchievements() и имеет мета для чипов; обратная карта
 *     actionsFeedingAchievement() — точная инверсия; все 8 шагов покрыты.
 *  5. primaryBadgeForAction: первый бейдж из карты, эмодзи/имя на месте.
 */

import { describe, expect, it } from "vitest";
import {
  actionsFeedingAchievement,
  computeOperatorRank,
  OPERATOR_RANKS,
  PLAYBOOK_FEEDS,
  PLAYBOOK_STEP_META,
  LINKED_ACHIEVEMENT_META,
  primaryBadgeForAction,
  rankForXp,
  xpForProfileUnlocks,
  xpForEvent,
  xpForStore,
} from "@/app/franchize/[slug]/leads/lib/lead-gamification";
import { computeLeadAchievements } from "@/app/franchize/[slug]/leads/lib/lead-achievements";
import type { AchievementStore } from "@/app/franchize/[slug]/leads/lib/lead-achievements";
import type { NextActionKey } from "@/app/franchize/[slug]/leads/lib/lead-playbook";
import { buildKpi } from "./helpers/lead-kpi-fixture";

describe("lead-gamification: XP", () => {
  it("пустой стор — 0 XP", () => {
    expect(xpForStore({})).toBe(0);
  });

  it("суммирует XP по лучшим уровням стора", () => {
    expect(xpForStore({ speedster: "bronze" })).toBe(10);
    expect(xpForStore({ speedster: "gold", closer: "silver" })).toBe(50 + 25);
    expect(xpForStore({ "perfect-shift": "legend" })).toBe(100);
  });

  it("мусорные уровни игнорируются (стор мог быть повреждён вручную)", () => {
    expect(xpForStore({ speedster: "diamond" as never })).toBe(0);
    expect(xpForStore({ speedster: undefined as never, closer: "bronze" })).toBe(10);
  });

  it("тост: открытие золота = 50 XP, апгрейд бронза→серебро = 15 XP", () => {
    expect(xpForEvent({ id: "closer", emoji: "🤝", title: "Клоузер", desc: "", color: "#fff", kind: "unlock", tier: "gold" })).toBe(50);
    expect(xpForEvent({ id: "closer", emoji: "🤝", title: "Клоузер", desc: "", color: "#fff", kind: "tier", tier: "silver" })).toBe(25 - 10);
    expect(xpForEvent({ id: "closer", emoji: "🤝", title: "Клоузер", desc: "", color: "#fff", kind: "tier", tier: "legend" })).toBe(100 - 50);
  });
});

describe("lead-gamification: звания", () => {
  it("0 XP — «Новичок бокса», следующий «Механик» на 100 XP", () => {
    const rank = computeOperatorRank({});
    expect(rank.title).toBe("Новичок бокса");
    expect(rank.level).toBe(1);
    expect(rank.xp).toBe(0);
    expect(rank.next?.title).toBe("Механик");
    expect(rank.xpToNext).toBe(100);
    expect(rank.progress).toBe(0);
  });

  it("XP точно на пороге — звание взято, прогресс следующего с нуля", () => {
    const { def, next, progress } = rankForXp(100);
    expect(def.title).toBe("Механик");
    expect(next?.title).toBe("Гонщик");
    expect(progress).toBe(0);
  });

  it("промежуточный XP — честный прогресс к следующему званию", () => {
    const rank = computeOperatorRank({ speedster: "gold", closer: "gold" }); // 100
    const rank150 = computeOperatorRank({ speedster: "gold", closer: "gold", "five-minutes": "silver" }); // 125
    expect(rank.title).toBe("Механик");
    expect(rank150.progress).toBeCloseTo((125 - 100) / (250 - 100), 6);
    expect(rank150.xpToNext).toBe(250 - 125);
  });

  it("700+ XP — «Легенда экипажа», максимум (next = null)", () => {
    // 14 золотых бейджей × 50 XP = 700 XP — ровно порог «Легенды экипажа».
    const store: AchievementStore = Object.fromEntries(
      Array.from({ length: 14 }, (_, i) => [`b${i}`, "gold" as const]),
    );
    const rank = computeOperatorRank(store);
    expect(rank.title).toBe("Легенда экипажа");
    expect(rank.level).toBe(5);
    expect(rank.next).toBeNull();
    expect(rank.xpToNext).toBeNull();
    expect(rank.progress).toBe(1);
  });

  it("звания монотонны по порогам и уникальны", () => {
    for (let i = 1; i < OPERATOR_RANKS.length; i += 1) {
      expect(OPERATOR_RANKS[i].floor).toBeGreaterThan(OPERATOR_RANKS[i - 1].floor);
    }
    expect(new Set(OPERATOR_RANKS.map((r) => r.title)).size).toBe(OPERATOR_RANKS.length);
  });
});

describe("lead-gamification: карта кормления «плейбук → бейдж»", () => {
  it("каждый id из PLAYBOOK_FEEDS существует среди достижений KPI", () => {
    const known = new Set(computeLeadAchievements(buildKpi()).map((a) => a.id));
    for (const [key, ids] of Object.entries(PLAYBOOK_FEEDS) as Array<[NextActionKey, readonly string[]]>) {
      for (const id of ids) {
        expect(known.has(id), `${key} ссылается на несуществующий бейдж "${id}"`).toBe(true);
      }
    }
  });

  it("каждому связанному бейджу есть мета для чипов (эмодзи + имя)", () => {
    for (const ids of Object.values(PLAYBOOK_FEEDS)) {
      for (const id of ids) {
        expect(LINKED_ACHIEVEMENT_META[id], `нет мета для чипа "${id}"`).toBeTruthy();
      }
    }
  });

  it("обратная карта actionsFeedingAchievement — точная инверсия", () => {
    for (const [key, ids] of Object.entries(PLAYBOOK_FEEDS) as Array<[NextActionKey, readonly string[]]>) {
      for (const id of ids) {
        expect(actionsFeedingAchievement(id)).toContain(key);
      }
    }
    // «Перезвон-ниндзя» кормится ровно одним шагом — просроченным перезвоном
    expect(actionsFeedingAchievement("callback-ninja")).toEqual(["callback-overdue"]);
    // Оба ghost-шага кормят «Реаниматора»
    expect(actionsFeedingAchievement("ghost-buster")).toEqual(["ghost", "ghost-long"]);
  });

  it("все 8 шагов плейбука покрыты картой и имеют короткие подписи", () => {
    const keys: NextActionKey[] = [
      "hot-waiting",
      "callback-overdue",
      "fresh-waiting",
      "contract-hanging",
      "pull-up",
      "ghost",
      "ghost-long",
      "referral",
    ];
    for (const k of keys) {
      expect(PLAYBOOK_FEEDS[k]?.length, `${k} не кормит ни один бейдж`).toBeGreaterThan(0);
      expect(PLAYBOOK_STEP_META[k], `${k} без подписи чипа`).toBeTruthy();
      expect(primaryBadgeForAction(k)).toBeTruthy();
    }
  });
});

// ── Мост «профиль ↔ путь оператора» (XP за shift-бейджи без уровней) ──────
describe("lead-gamification: профильный XP-мост", () => {
  it("xpForProfileUnlocks: Set из id → 15 XP за каждый", () => {
    expect(xpForProfileUnlocks(new Set())).toBe(0);
    expect(xpForProfileUnlocks(new Set(["shift_streak_3"]))).toBe(15);
    expect(xpForProfileUnlocks(new Set(["a", "b", "c"]))).toBe(45);
  });

  it("xpForProfileUnlocks: принимаем форму users.metadata (id → объект)", () => {
    expect(
      xpForProfileUnlocks({
        shift_streak_3: { unlockedAt: "2026-09-06T10:00:00Z" },
        shift_early_bird: true,
        shift_off: false, // falsy — не считается
      }),
    ).toBe(30);
  });

  it("xpForProfileUnlocks: null/undefined/мусор → 0, без падений", () => {
    expect(xpForProfileUnlocks(null)).toBe(0);
    expect(xpForProfileUnlocks(undefined)).toBe(0);
    expect(xpForProfileUnlocks(["", "  ", 42, null])).toBe(0); // не-строки и пустые id — мимо
  });

  it("мост: 7 профильных бейджей (105 XP) = звание «Механик» без единого лид-бейджа", () => {
    const seven = Object.fromEntries(
      Array.from({ length: 7 }, (_, i) => [`shift_badge_${i}`, { unlockedAt: "2026-09-06" }]),
    );
    const rank = computeOperatorRank({}, seven);
    expect(rank.xp).toBe(105);
    expect(rank.title).toBe("Механик");
    expect(rank.next?.title).toBe("Гонщик");
  });

  it("мост складывается с лидерским стором: бейдж золото (50) + 3 профильных (45) = 95 XP", () => {
    const rank = computeOperatorRank({ speedster: "gold" }, new Set(["a", "b", "c"]));
    expect(rank.xp).toBe(50 + 45);
  });
});
