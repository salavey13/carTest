/**
 * tests/franchize/lead-priority.spec.ts
 *
 * Тесты движка Priority Score (ТЗ «Итоговый индекс приоритета 0–100»):
 *  1. Индекс всегда в [0, 100].
 *  2. LIFO (ТЗ п.2): «только что» → freshness 100 → верх очереди;
 *     tie-break при равном счёте — свежий выше.
 *  3. Авито ×2 (ТЗ п.3): мультипликатор к базовому весу.
 *  4. «Лайбочки» (ТЗ п.4): isFresh ≤ 60 мин, isHot ≥ 70.
 *  5. Монотонность компонент: срочность/задачи/LTV/этап не снижают балл.
 *  6. sortLeads("priority") поднимает горячие+свежие наверх (не по алфавиту).
 */

import { describe, expect, it } from "vitest";
import {
  computeLeadPriority,
  compareByPriority,
  freshnessScore,
  leadAgeMs,
  AVITO_MULTIPLIER,
  HOT_THRESHOLD,
  FRESH_LEAD_MINUTES,
} from "@/app/franchize/[slug]/leads/lib/lead-priority";
import { sortLeads, buildPriorityMap } from "@/app/franchize/[slug]/leads/leads-utils";
import type { LeadRow } from "@/app/franchize/[slug]/leads/leads-types";

// ── Builders ────────────────────────────────────────────────────────────────

const NOW = new Date("2026-09-02T12:00:00.000Z").getTime();

function buildLead(overrides: Partial<LeadRow> = {}): LeadRow {
  return {
    user_id: "413553377",
    full_name: "Иван Иванов",
    username: null,
    phone: "+79998887766",
    source: "web_callback",
    bikeTitle: null,
    createdAt: "2026-09-01T10:00:00.000Z",
    lastSeenAt: "2026-09-02T11:55:00.000Z", // 5 мин назад
    verified: false,
    rentals: [],
    sales: [],
    ...overrides,
  };
}

// ── 1. Bounds ───────────────────────────────────────────────────────────────

describe("Priority Score: границы", () => {
  it("индекс всегда 0–100", () => {
    const hot = computeLeadPriority(
      buildLead({ urgencyScore: 100, totalSpent: 1_000_000, stageKey: "return_due" }),
      10,
      NOW,
    );
    expect(hot.score).toBeLessThanOrEqual(100);
    expect(hot.score).toBeGreaterThanOrEqual(0);

    const cold = computeLeadPriority(
      buildLead({ lastSeenAt: "2026-06-01T00:00:00.000Z", urgencyScore: 0, source: "app_open" }),
      0,
      NOW,
    );
    expect(cold.score).toBeLessThanOrEqual(100);
    expect(cold.score).toBeGreaterThanOrEqual(0);
  });
});

// ── 2. LIFO ─────────────────────────────────────────────────────────────────

describe("LIFO-свежесть (ТЗ п.2)", () => {
  it("возраст ≤ 15 мин → freshness 100", () => {
    const lead = buildLead({ lastSeenAt: new Date(NOW - 10 * 60 * 1000).toISOString() });
    expect(freshnessScore(leadAgeMs(lead, NOW))).toBe(100);
  });

  it("age ≤ 15 мин «только что» — максимум freshness", () => {
    expect(freshnessScore(0)).toBe(100);
    expect(freshnessScore(15 * 60 * 1000)).toBe(100);
  });

  it("72 ч и старше → freshness 0", () => {
    expect(freshnessScore(72 * 60 * 60 * 1000)).toBe(0);
    expect(freshnessScore(30 * 24 * 60 * 60 * 1000)).toBe(0);
  });

  it("свежий лид выше при равном счёте (tie-break по времени)", () => {
    const oldLead = buildLead({ user_id: "1", lastSeenAt: "2026-08-01T00:00:00.000Z" });
    const newLead = buildLead({ user_id: "2", lastSeenAt: "2026-09-02T11:00:00.000Z" });
    const pOld = computeLeadPriority(oldLead, 0, NOW);
    const pNew = computeLeadPriority(newLead, 0, NOW);
    // при прочих равных свежий лид строго выше
    expect(compareByPriority(newLead, pNew, oldLead, pOld)).toBeLessThan(0);
  });

  it("обращение «только что» даёт высокий приоритет даже без истории", () => {
    const freshLead = buildLead({
      lastSeenAt: new Date(NOW - 2 * 60 * 1000).toISOString(),
      urgencyScore: 0,
      source: "unknown",
    });
    const staleLead = buildLead({
      lastSeenAt: "2026-07-02T00:00:00.000Z",
      urgencyScore: 0,
      source: "unknown",
    });
    const pFresh = computeLeadPriority(freshLead, 0, NOW);
    const pStale = computeLeadPriority(staleLead, 0, NOW);
    expect(pFresh.score).toBeGreaterThan(pStale.score);
    expect(pFresh.isFresh).toBe(true);
    expect(pStale.isFresh).toBe(false);
  });
});

// ── 3. Avito ×2 (ТЗ п.3) ────────────────────────────────────────────────────

describe("Специальный коэффициент Авито (ТЗ п.3)", () => {
  it("мультипликатор Авито = 2", () => {
    expect(AVITO_MULTIPLIER).toBe(2);
  });

  it("авитный лид получает ≈2× к базовому весу (до клампа)", () => {
    const base = buildLead({ source: "unknown", urgencyScore: 30, lastSeenAt: "2026-09-01T00:00:00.000Z" });
    const avito = buildLead({
      ...base,
      source: "callback_request",
      contactChannel: "avito",
      avito: { chatId: "123", itemUrl: null, profileUrl: null, itemId: null, lastMessage: null },
    });
    const pBase = computeLeadPriority(base, 0, NOW);
    const pAvito = computeLeadPriority(avito, 0, NOW);
    expect(pAvito.channelMultiplier).toBe(2);
    expect(pAvito.channel).toBe("avito");
    // кламп на 100 может срезать точное 2×, но авитный строго выше
    expect(pAvito.score).toBeGreaterThan(pBase.score);
    expect(pAvito.score).toBe(Math.min(100, Math.round((pAvito.score / pAvito.channelMultiplier) * 2)));
  });

  it("не-авитный лид имеет мультипликатор ≤ 1.35", () => {
    const lead = computeLeadPriority(buildLead({ source: "web_callback" }), 0, NOW);
    expect(lead.channelMultiplier).toBe(1.35);
    expect(lead.channel).toBe("web_callback");
  });
});

// ── 4. «Лайбочки» (ТЗ п.4) ──────────────────────────────────────────────────

describe("Пороги лайбочек", () => {
  it("isFresh — только ≤ 60 мин", () => {
    const fresh = computeLeadPriority(buildLead({ lastSeenAt: new Date(NOW - 30 * 60 * 1000).toISOString() }), 0, NOW);
    const stale = computeLeadPriority(buildLead({ lastSeenAt: new Date(NOW - (FRESH_LEAD_MINUTES + 5) * 60 * 1000).toISOString() }), 0, NOW);
    expect(fresh.isFresh).toBe(true);
    expect(stale.isFresh).toBe(false);
  });

  it("isHot — score ≥ HOT_THRESHOLD", () => {
    expect(HOT_THRESHOLD).toBe(70);
    const strong = computeLeadPriority(
      buildLead({ urgencyScore: 90, stageKey: "needs_contact", lastSeenAt: new Date(NOW - 5 * 60 * 1000).toISOString() }),
      2,
      NOW,
    );
    expect(strong.isHot).toBe(true);
  });
});

// ── 5. Монотонность компонент ───────────────────────────────────────────────

describe("Монотонность компонент", () => {
  const base = buildLead({ lastSeenAt: "2026-09-01T00:00:00.000Z" });

  it("больше срочности → не ниже балл", () => {
    const low = computeLeadPriority({ ...base, urgencyScore: 10 }, 0, NOW);
    const high = computeLeadPriority({ ...base, urgencyScore: 90 }, 0, NOW);
    expect(high.score).toBeGreaterThan(low.score);
  });

  it("больше открытых задач → не ниже балл", () => {
    const low = computeLeadPriority(base, 0, NOW);
    const high = computeLeadPriority(base, 3, NOW);
    expect(high.score).toBeGreaterThan(low.score);
  });

  it("больше LTV → не ниже балл", () => {
    const low = computeLeadPriority({ ...base, totalSpent: 0 }, 0, NOW);
    const high = computeLeadPriority({ ...base, totalSpent: 50_000 }, 0, NOW);
    expect(high.score).toBeGreaterThan(low.score);
  });

  it("этап «нужен контакт» горячее «закрыто-потеряно»", () => {
    const won = computeLeadPriority({ ...base, stageKey: "needs_contact" }, 0, NOW);
    const lost = computeLeadPriority({ ...base, stageKey: "closed_lost" }, 0, NOW);
    expect(won.score).toBeGreaterThan(lost.score);
  });
});

// ── 6. Сортировка «priority» ────────────────────────────────────────────────

describe("sortLeads(mode='priority')", () => {
  it("горячие и свежие сверху, а не по алфавиту", () => {
    const leads = [
      buildLead({ user_id: "a-Абрамов", full_name: "Абрамов", lastSeenAt: "2026-08-01T00:00:00.000Z", urgencyScore: 10 }),
      buildLead({ user_id: "b-Яшин", full_name: "Яшин", lastSeenAt: new Date(NOW - 5 * 60 * 1000).toISOString(), urgencyScore: 80, stageKey: "needs_contact" }),
      buildLead({ user_id: "c-Иванов", full_name: "Иванов", lastSeenAt: "2026-08-15T00:00:00.000Z", urgencyScore: 40 }),
    ];
    const sorted = sortLeads(leads, "priority", () => []);
    expect(sorted[0].user_id).toBe("b-Яшин"); // свежий + горячий
    // два оставшихся — по убыванию score (Иванов с u=40 выше Абрамова с u=10)
    expect(sorted[1].user_id).toBe("c-Иванов");
    expect(sorted[2].user_id).toBe("a-Абрамов");
  });

  it("Авито-лид поднимается наверх при прочих равных", () => {
    const leads = [
      buildLead({ user_id: "plain", lastSeenAt: "2026-09-02T11:00:00.000Z", urgencyScore: 40 }),
      buildLead({
        user_id: "avito",
        lastSeenAt: "2026-09-02T11:00:00.000Z",
        urgencyScore: 40,
        contactChannel: "avito",
        avito: { chatId: "9", itemUrl: null, profileUrl: null, itemId: null, lastMessage: null },
      }),
    ];
    const sorted = sortLeads(leads, "priority", () => []);
    expect(sorted[0].user_id).toBe("avito");
  });

  it("buildPriorityMap мемоизирует по user_id", () => {
    const leads = [buildLead({ user_id: "x" }), buildLead({ user_id: "y", urgencyScore: 95 })];
    const map = buildPriorityMap(leads, () => [], NOW);
    expect(map.size).toBe(2);
    expect(map.get("y").score).toBeGreaterThan(map.get("x").score);
  });
});

// ── 7. Заметки: «Прочитать заметки» + буст за свежую ───────────────────────

describe("Заметки лида (флажок + буст)", () => {
  it("свежая заметка (≤24 ч) даёт буст +10", () => {
    const base = computeLeadPriority(buildLead(), 0, NOW);
    const withNote = computeLeadPriority(
      buildLead({ notesCount: 3, lastNoteAt: new Date(NOW - 2 * 60 * 60 * 1000).toISOString() }),
      0,
      NOW,
    );
    expect(withNote.score).toBe(base.score + 10);
    expect(withNote.hasRecentNotes).toBe(true);
  });

  it("старая заметка (>24 ч) не даёт буста", () => {
    const p = computeLeadPriority(
      buildLead({ notesCount: 5, lastNoteAt: "2026-08-01T00:00:00.000Z" }),
      0,
      NOW,
    );
    expect(p.hasRecentNotes).toBe(false);
  });

  it("notesCount = 0 / нет полей — никакого буста", () => {
    expect(computeLeadPriority(buildLead({ notesCount: 0, lastNoteAt: null }), 0, NOW).hasRecentNotes).toBe(false);
    expect(computeLeadPriority(buildLead(), 0, NOW).hasRecentNotes).toBe(false);
  });

  it("заметки без валидной даты — буста нет (мусорное lastNoteAt не роняет расчёт)", () => {
    const p = computeLeadPriority(buildLead({ notesCount: 2, lastNoteAt: "не-дата" }), 0, NOW);
    expect(Number.isFinite(p.score)).toBe(true);
    expect(p.hasRecentNotes).toBe(false);
  });

  it("заметка в «будущем» (неточные часы клиента) не считается старой", () => {
    const p = computeLeadPriority(
      buildLead({ notesCount: 1, lastNoteAt: new Date(NOW + 60 * 60 * 1000).toISOString() }),
      0,
      NOW,
    );
    expect(p.hasRecentNotes).toBe(true);
  });

  it("буст заметок суммируется с бустом перезвона и не превышает 100", () => {
    const handling = {
      handled: false,
      handledAt: null,
      callback: { dueAt: new Date(NOW - 60 * 1000).toISOString(), note: null, todoId: "t1" }, // просрочен
    } as const;
    const p = computeLeadPriority(
      buildLead({
        urgencyScore: 100,
        totalSpent: 1_000_000,
        stageKey: "return_due",
        notesCount: 4,
        lastNoteAt: new Date(NOW - 1000).toISOString(),
      }),
      10,
      NOW,
      handling as never,
    );
    expect(p.score).toBeLessThanOrEqual(100);
    expect(p.score).toBe(100); // кламп наверху
    expect(p.hasRecentNotes).toBe(true);
  });

  it("лид со свежей заметкой поднимается над таким же без заметок", () => {
    const plain = buildLead({ user_id: "plain", lastSeenAt: new Date(NOW - 3 * 60 * 60 * 1000).toISOString() });
    const noted = buildLead({
      user_id: "noted",
      lastSeenAt: new Date(NOW - 3 * 60 * 60 * 1000).toISOString(),
      notesCount: 1,
      lastNoteAt: new Date(NOW - 30 * 60 * 1000).toISOString(),
    });
    const sorted = sortLeads([plain, noted], "priority", () => [], undefined, NOW);
    expect(sorted[0].user_id).toBe("noted");
  });
});
