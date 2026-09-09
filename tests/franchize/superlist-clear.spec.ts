/**
 * tests/franchize/superlist-clear.spec.ts
 *
 * Тесты механики «Суперлист закрыт» (lib/superlist-clear.ts) — просьба
 * босса: «when somebody actually covered whole superlead list — notify
 * admin and owner, give a fucking achievement to the dude:) an so on;)».
 *
 * Покрывается ЧИСТАЯ математика (evaluateSuperlistClear /
 * nextSuperlistSnapshot / snapshotNeedsWrite / superlistActionSignature);
 * серверная оркестрация (CAS, гранты, Telegram) — best-effort клей,
 * тестируется вручную на живой книге (см. worklog Task 20).
 *
 * Кейсы:
 *  1. Полное покрытие + работа оператора → праздник, closer = последний актор.
 *  2. Минимум позиций: список из 2 позиций — не «супер», праздника нет.
 *  3. Протухший снапшот (> 7 суток) — архив, не работа смены.
 *  4. Нет операторской работы с момента среза — список сам истёк (нет праздника).
 *  5. Кулдаун 12 ч: по снапшоту lastClearAt И по факту события в журнале.
 *  6. Переезд позиции в другое ведро у ТОГО ЖЕ лида — ситуация жива.
 *  7. Новые прибывшие лиды не мешают празднику (список был закрыт).
 *  8. Служебный актор (avito-agent / null) не даёт работу и не становится closer.
 *  9. Снапшот после праздника несёт lastClearAt/totalClears; без праздника —
 *     только новый срез; без изменений — записи не требуется.
 * 10. Подпись позиции: leadId стабильнее ведра; без лида — ведро+заголовок.
 */

import { describe, expect, it } from "vitest";
import {
  evaluateSuperlistClear,
  nextSuperlistSnapshot,
  snapshotNeedsWrite,
  superlistActionSignature,
  SUPERLIST_COOLDOWN_MS,
  SUPERLIST_MIN_ITEMS,
  SUPERLIST_SNAPSHOT_MAX_AGE_MS,
  type SuperlistEventRow,
  type SuperlistSnapshotState,
} from "@/app/franchize/lib/superlist-clear-core";
import type { NextAction } from "@/app/franchize/[slug]/leads/lib/lead-playbook";

const NOW = Date.parse("2026-09-09T12:00:00.000Z");
const HOUR = 60 * 60 * 1000;

function action(overrides: Partial<NextAction> = {}): NextAction {
  return {
    key: "hot-waiting",
    emoji: "🔥",
    title: "Ответить горячему: Иван",
    detail: "ждёт 3 мин",
    message: null,
    leadId: "avito:chat-1",
    tone: "danger",
    weight: 110,
    ageMs: 3 * 60 * 1000,
    ...overrides,
  };
}

function snapshot(overrides: Partial<SuperlistSnapshotState> = {}): SuperlistSnapshotState {
  return {
    count: 3,
    items: ["lead:avito:chat-1", "lead:avito:chat-2", "lead:+79001234567"],
    at: new Date(NOW - 2 * HOUR).toISOString(),
    lastClearAt: null,
    totalClears: 0,
    ...overrides,
  };
}

function event(overrides: Partial<SuperlistEventRow> = {}): SuperlistEventRow {
  return {
    type: "lead_handled",
    actor: "413553377",
    createdAt: new Date(NOW - 1 * HOUR).toISOString(),
    ...overrides,
  };
}

function clearedQueue(): NextAction[] {
  return []; // всё отработано
}

describe("superlist: evaluateSuperlistClear", () => {
  it("празднует полное покрытие: все позиции ушли + была работа, closer = последний актор", () => {
    const events: SuperlistEventRow[] = [
      event({ actor: "244736261", createdAt: new Date(NOW - 90 * 60 * 1000).toISOString() }),
      event({ actor: "413553377", createdAt: new Date(NOW - 10 * 60 * 1000).toISOString() }),
    ];
    const d = evaluateSuperlistClear({ snapshot: snapshot(), queue: clearedQueue(), events, nowMs: NOW });
    expect(d).not.toBeNull();
    expect(d!.closerId).toBe("413553377"); // последний — он и есть «the dude»
    expect(d!.itemsCount).toBe(3);
    expect(d!.workEvents).toBe(2);
    expect(d!.totalClears).toBe(1);
  });

  it(`список из ${SUPERLIST_MIN_ITEMS - 1} позиций — не «супер»`, () => {
    const d = evaluateSuperlistClear({
      snapshot: snapshot({ count: 2, items: ["lead:avito:chat-1", "lead:avito:chat-2"] }),
      queue: clearedQueue(),
      events: [event()],
      nowMs: NOW,
    });
    expect(d).toBeNull();
  });

  it(`протухший снапшот (>${SUPERLIST_SNAPSHOT_MAX_AGE_MS / (24 * 60 * 60 * 1000)} суток) — архив, не смена`, () => {
    const d = evaluateSuperlistClear({
      snapshot: snapshot({ at: new Date(NOW - SUPERLIST_SNAPSHOT_MAX_AGE_MS - HOUR).toISOString() }),
      queue: clearedQueue(),
      events: [event()],
      nowMs: NOW,
    });
    expect(d).toBeNull();
  });

  it("без операторской работы с момента среза праздника нет (список сам истёк)", () => {
    const d = evaluateSuperlistClear({
      snapshot: snapshot(),
      queue: clearedQueue(),
      events: [event({ createdAt: new Date(NOW - 3 * HOUR).toISOString() })], // ДО среза
      nowMs: NOW,
    });
    expect(d).toBeNull();
  });

  it(`кулдаун ${SUPERLIST_COOLDOWN_MS / (60 * 60 * 1000)} ч по снапшоту lastClearAt`, () => {
    const d = evaluateSuperlistClear({
      snapshot: snapshot({ lastClearAt: new Date(NOW - 2 * HOUR).toISOString(), totalClears: 4 }),
      queue: clearedQueue(),
      events: [event()],
      nowMs: NOW,
    });
    expect(d).toBeNull();
  });

  it("кулдаун живёт в журнале даже без lastClearAt в снапшоте", () => {
    const d = evaluateSuperlistClear({
      snapshot: snapshot(),
      queue: clearedQueue(),
      events: [
        event({ type: "superlist_cleared", createdAt: new Date(NOW - 3 * HOUR).toISOString() }),
        event({ createdAt: new Date(NOW - 2 * HOUR).toISOString() }),
      ],
      nowMs: NOW,
    });
    expect(d).toBeNull();
  });

  it("переезд позиции в другое ведро у ТОГО ЖЕ лида — ситуация жива, праздника нет", () => {
    // «Горячий» остыл до ghost — позиция сменила ведро, но лид тот же.
    const d = evaluateSuperlistClear({
      snapshot: snapshot(),
      queue: [action({ key: "ghost", tone: "info", weight: 55 })],
      events: [event()],
      nowMs: NOW,
    });
    expect(d).toBeNull();
  });

  it("новые прибывшие лиды не мешают празднику — прошлый список закрыт", () => {
    const d = evaluateSuperlistClear({
      snapshot: snapshot(),
      // свежая волна: новые лиды ждут первого ответа
      queue: [
        action({ leadId: "avito:brand-new-1", ageMs: 4 * 60 * 1000 }),
        action({ leadId: "avito:brand-new-2", ageMs: 9 * 60 * 1000 }),
      ],
      events: [event()],
      nowMs: NOW,
    });
    expect(d).not.toBeNull();
    expect(d!.closerId).toBe("413553377");
  });

  it("служебный/пустой актор не даёт работу и не становится closer", () => {
    const d = evaluateSuperlistClear({
      snapshot: snapshot(),
      queue: clearedQueue(),
      events: [
        event({ actor: "avito-agent" }),
        event({ actor: null }),
      ],
      nowMs: NOW,
    });
    expect(d).toBeNull();
  });

  it("позиция без leadId: та же подпись в очереди = ситуация жива; исчезновение = закрыта", () => {
    const sig = superlistActionSignature({ key: "referral", leadId: null });
    // 1) no-lead позиция всё ещё в очереди — праздника нет
    const stillThere = evaluateSuperlistClear({
      snapshot: snapshot({ count: 3, items: ["lead:avito:chat-1", "lead:avito:chat-2", sig] }),
      queue: [
        action({ key: "referral", leadId: null, tone: "info", weight: 45 }),
        action({ leadId: "avito:someone-else" }),
      ],
      events: [event()],
      nowMs: NOW,
    });
    expect(stillThere).toBeNull();

    // 2) no-lead позиция исчезла (остальные тоже) — праздник
    const gone = evaluateSuperlistClear({
      snapshot: snapshot({ count: 3, items: ["lead:avito:chat-1", "lead:avito:chat-2", sig] }),
      queue: [],
      events: [event()],
      nowMs: NOW,
    });
    expect(gone).not.toBeNull();
  });

  it("частичное покрытие (одна позиция дожила) — праздника нет", () => {
    const d = evaluateSuperlistClear({
      snapshot: snapshot(),
      queue: [action({ leadId: "avito:chat-2", key: "callback-overdue", tone: "danger" })],
      events: [event(), event()],
      nowMs: NOW,
    });
    expect(d).toBeNull();
  });
});

describe("superlist: снапшот", () => {
  it("после праздника несёт lastClearAt=now и следующий totalClears", () => {
    const next = nextSuperlistSnapshot(
      snapshot({ totalClears: 2 }),
      [action({ leadId: "avito:fresh" })],
      { closerId: "413553377", itemsCount: 3, workEvents: 2, totalClears: 3 },
      new Date(NOW).toISOString(),
    );
    expect(next.totalClears).toBe(3);
    expect(next.lastClearAt).toBe(new Date(NOW).toISOString());
    expect(next.count).toBe(1);
    expect(next.items).toEqual(["lead:avito:fresh"]);
  });

  it("без праздника — просто новый срез, lastClearAt и totalClears наследуются", () => {
    const prev = snapshot({ lastClearAt: new Date(NOW - 30 * HOUR).toISOString(), totalClears: 7 });
    const next = nextSuperlistSnapshot(prev, [], null, new Date(NOW).toISOString());
    expect(next.lastClearAt).toBe(prev.lastClearAt);
    expect(next.totalClears).toBe(7);
    expect(next.count).toBe(0);
  });

  it("snapshotNeedsWrite: первое наблюдение и изменение — да, тот же срез — нет", () => {
    const prev = snapshot();
    const same = nextSuperlistSnapshot(prev, [action()], null, prev.at);
    expect(snapshotNeedsWrite(null, same)).toBe(true);
    // очередь не изменилась и момент среза прежний → записи не нужно
    expect(snapshotNeedsWrite(prev, { ...same, at: prev.at, items: prev.items, count: prev.count })).toBe(false);
    const changed = nextSuperlistSnapshot(prev, [action({ leadId: "avito:chat-9" })], null, new Date(NOW).toISOString());
    expect(snapshotNeedsWrite(prev, changed)).toBe(true);
  });

  it("подпись: leadId важнее ведра, без лида — ведро", () => {
    expect(superlistActionSignature({ key: "hot-waiting", leadId: "42" })).toBe("lead:42");
    expect(superlistActionSignature({ key: "ghost", leadId: "42" })).toBe("lead:42"); // тот же лид
    expect(superlistActionSignature({ key: "referral", leadId: null })).toBe("no-lead:referral");
  });
});
