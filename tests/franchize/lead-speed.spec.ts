/**
 * tests/franchize/lead-speed.spec.ts
 *
 * Тесты счётчиков скорости обработки лидов (lib/lead-speed.ts):
 *  1. Время обработки = earliest «✅ Лид обработан» − createdAt.
 *  2. Конвертировавшийся лид (аренда/покупка/договор) — обработан даже без
 *     отметки, но в статистику скорости НЕ попадает (нет обеих точек).
 *  3. Медиана/средняя/лучшая скорость по накопленным точкам.
 *  4. Бакеты распределения: ≤15м / 15м–1ч / 1–4ч / 4–24ч / >24ч.
 *  5. Очередь «ждут»: не обработан и не конвертировался; счётчики >1ч и >24ч,
 *     топ-3 «дольше всех ждут».
 *  6. Операторские заглушки (operator_placeholder) исключены из метрик.
 *  7. Перезвоны: максимум 1 pending + 1 overdue на лид (как плашка в UI).
 */

import { describe, expect, it } from "vitest";
import {
  computeLeadSpeedMetrics,
  fmtDurationMs,
} from "@/app/franchize/[slug]/leads/lib/lead-speed";
import type { LeadRow, LeadTodoRow } from "@/app/franchize/[slug]/leads/leads-types";

const NOW = Date.parse("2026-09-04T12:00:00.000Z");

function buildLead(overrides: Partial<LeadRow> = {}): LeadRow {
  return {
    user_id: "lead-1",
    full_name: "Тест Лид",
    username: null,
    phone: null,
    source: "callback_request",
    bikeTitle: null,
    createdAt: "2026-09-04T10:00:00.000Z",
    lastSeenAt: null,
    verified: false,
    rentals: [],
    sales: [],
    ...overrides,
  };
}

function handledTodo(leadId: string, completedAt: string): LeadTodoRow {
  return {
    id: `todo-h-${leadId}`,
    lead_id: leadId,
    user_id: null,
    phone: null,
    rental_id: null,
    title: "✅ Лид обработан",
    description: '{"kind":"handled"}',
    status: "done",
    priority: "normal",
    category: "lead_handling",
    created_at: completedAt,
    completed_at: completedAt,
    assigned_to: null,
    due_date: null,
  };
}

function callbackTodo(leadId: string, dueAt: string): LeadTodoRow {
  return {
    id: `todo-cb-${leadId}`,
    lead_id: leadId,
    user_id: null,
    phone: null,
    rental_id: null,
    title: "📞 Перезвонить",
    description: '{"kind":"callback","note":"после 18:00"}',
    status: "pending",
    priority: "normal",
    category: "lead_handling",
    created_at: "2026-09-04T09:00:00.000Z",
    completed_at: null,
    assigned_to: null,
    due_date: dueAt,
  };
}

describe("lead-speed: fmtDurationMs", () => {
  it("компактные длительности", () => {
    expect(fmtDurationMs(10 * 60_000)).toBe("10 м");
    expect(fmtDurationMs(130 * 60_000)).toBe("2 ч 10 м");
    expect(fmtDurationMs(30 * 3600_000)).toBe("1 д 6 ч");
    expect(fmtDurationMs(-5)).toBe("—");
    expect(fmtDurationMs(0)).toBe("меньше минуты");
  });
});

describe("lead-speed: computeLeadSpeedMetrics", () => {
  it("медиана/средняя/лучшая + бакеты + обработано сегодня", () => {
    const leads = [
      // 10 минут → lt15m
      buildLead({ user_id: "a", createdAt: "2026-09-04T09:00:00.000Z" }),
      // 30 минут → lt1h
      buildLead({ user_id: "b", createdAt: "2026-09-04T10:00:00.000Z" }),
      // 3 часа → lt4h
      buildLead({ user_id: "c", createdAt: "2026-09-04T08:00:00.000Z" }),
      // 30 часов (вчера) → over24h, НЕ «сегодня»
      buildLead({ user_id: "d", createdAt: "2026-09-01T06:00:00.000Z" }),
    ];
    const todos = [
      handledTodo("a", "2026-09-04T09:10:00.000Z"),
      handledTodo("b", "2026-09-04T10:30:00.000Z"),
      handledTodo("c", "2026-09-04T11:00:00.000Z"),
      handledTodo("d", "2026-09-02T12:00:00.000Z"),
    ];
    const m = computeLeadSpeedMetrics(leads, todos, NOW);

    expect(m.handledTotal).toBe(4);
    expect(m.handledToday).toBe(3); // d обработан позавчера
    // точки: 10м, 30м, 180м, 1800м → медиана (30+180)/2 = 105 мин
    expect(m.medianMs).toBe(105 * 60_000);
    expect(m.avgMs).toBe(Math.round(((10 + 30 + 180 + 1800) / 4) * 60_000));
    expect(m.fastestMs).toBe(10 * 60_000);
    const byKey = Object.fromEntries(m.buckets.map((b) => [b.key, b.count]));
    expect(byKey).toEqual({ lt15m: 1, lt1h: 1, lt4h: 1, lt24h: 0, over24h: 1 });
    expect(m.waitingTotal).toBe(0);
  });

  it("конверсия без отметки = обработан, но вне статистики скорости", () => {
    const leads = [
      buildLead({
        user_id: "conv",
        createdAt: "2026-09-04T08:00:00.000Z",
        rentals: [
          {
            rentalId: "r1",
            status: "active",
            paymentStatus: "paid",
            startDate: "2026-09-05T10:00:00.000Z",
            endDate: "2026-09-07T10:00:00.000Z",
            bikeTitle: "79BIKE Falcon GT",
            totalCost: 30000,
          },
        ],
      }),
      buildLead({ user_id: "a", createdAt: "2026-09-04T09:00:00.000Z" }),
    ];
    const todos = [handledTodo("a", "2026-09-04T09:30:00.000Z")];
    const m = computeLeadSpeedMetrics(leads, todos, NOW);

    expect(m.converted).toBe(1);
    expect(m.handledTotal).toBe(2);
    // в тайминг попал только «a» (30 мин) — у conv нет второй точки
    expect(m.medianMs).toBe(30 * 60_000);
    const byKey = Object.fromEntries(m.buckets.map((b) => [b.key, b.count]));
    expect(byKey.lt1h).toBe(1);
    expect(byKey.lt15m).toBe(0);
  });

  it("очередь «ждут» + SLA-счётчики + топ-3 дольше всех ждут", () => {
    const leads = [
      // ждёт 2 часа
      buildLead({ user_id: "w1", full_name: "Анна", createdAt: "2026-09-04T10:00:00.000Z" }),
      // ждёт ~2 суток → over24h, первый в worstWaiting
      buildLead({ user_id: "w2", full_name: "Борис", createdAt: "2026-09-02T10:00:00.000Z" }),
      // обработан → не в очереди
      buildLead({ user_id: "h1", createdAt: "2026-09-04T09:00:00.000Z" }),
    ];
    const todos = [handledTodo("h1", "2026-09-04T09:20:00.000Z")];
    const m = computeLeadSpeedMetrics(leads, todos, NOW);

    expect(m.handledTotal).toBe(1);
    expect(m.waitingTotal).toBe(2);
    expect(m.waitingOver1h).toBe(2);
    expect(m.waitingOver24h).toBe(1);
    expect(m.worstWaiting[0]?.id).toBe("w2");
    expect(m.worstWaiting[0]?.name).toBe("Борис");
    expect(m.worstWaiting.length).toBe(2);
  });

  it("перезвоны: максимум 1 pending + 1 overdue на лид (как плашка в UI)", () => {
    const leads = [
      buildLead({ user_id: "cb1", createdAt: "2026-09-04T10:00:00.000Z" }),
      buildLead({ user_id: "cb2", createdAt: "2026-09-04T10:00:00.000Z" }),
    ];
    const todos = [
      // у cb1 два просроченных перезвона — в счётчике 1 overdue (лид один)
      callbackTodo("cb1", "2026-09-04T11:00:00.000Z"),
      callbackTodo("cb1", "2026-09-04T11:30:00.000Z"),
      // у cb2 перезвон в будущем
      callbackTodo("cb2", "2026-09-04T18:00:00.000Z"),
    ];
    const m = computeLeadSpeedMetrics(leads, todos, NOW);
    expect(m.callbacksPending).toBe(2);
    expect(m.callbacksOverdue).toBe(1);
    // Назначенный перезвон = контролируемое ожидание (оператор уже взял лида
    // в работу) → из очереди «ждут ответа» исключены, двойного учёта нет.
    expect(m.waitingTotal).toBe(0);
  });

  it("операторские заглушки исключены из всех метрик", () => {
    const leads = [
      buildLead({
        user_id: "ph",
        identityState: "operator_placeholder",
        createdAt: "2026-09-04T08:00:00.000Z",
      }),
    ];
    const m = computeLeadSpeedMetrics(leads, [], NOW);
    expect(m.waitingTotal).toBe(0);
    expect(m.handledTotal).toBe(0);
    expect(m.medianMs).toBeNull();
    expect(m.avgMs).toBeNull();
    expect(m.worstWaiting).toHaveLength(0);
  });

  it("пустые данные → нули и null, без NaN", () => {
    const m = computeLeadSpeedMetrics([], [], NOW);
    expect(m.handledTotal).toBe(0);
    expect(m.medianMs).toBeNull();
    expect(m.avgMs).toBeNull();
    expect(m.fastestMs).toBeNull();
    expect(m.waitingTotal).toBe(0);
    expect(m.callbacksPending).toBe(0);
    expect(m.buckets.every((b) => b.count === 0)).toBe(true);
  });
});

describe("lead-speed: edge cases — битые данные не роняют расчёт", () => {
  it("лид с rentals/sales = null (дрейф API) не роняет расчёт и не считается конверсией", () => {
    // битая строка: массивы пришли null вместо [] — раньше упал бы
    // rentals.map внутри matchTodosToLead → белый экран всей страницы.
    const broken = buildLead({
      user_id: "l-broken",
      createdAt: "2026-09-04T08:00:00.000Z",
    }) as unknown as Record<string, unknown>;
    broken.rentals = null;
    broken.sales = null;
    const m = computeLeadSpeedMetrics([broken as unknown as LeadRow], [], NOW);
    expect(m.converted).toBe(0);
    expect(m.handledTotal).toBe(0);
    expect(m.waitingTotal).toBe(1); // обычный ждущий лид, не крэш
  });

  it("allTodos = null (битый срез) не роняет расчёт", () => {
    const m = computeLeadSpeedMetrics(
      [buildLead({ user_id: "l-1", createdAt: "2026-09-04T10:00:00.000Z" })],
      null as unknown as LeadTodoRow[],
      NOW,
    );
    expect(m.waitingTotal).toBe(1);
    expect(m.callbacksPending).toBe(0);
  });

  it("leads = null (битый срез) → нули, без крэша", () => {
    const m = computeLeadSpeedMetrics(null as unknown as LeadRow[], [], NOW);
    expect(m.handledTotal).toBe(0);
    expect(m.medianMs).toBeNull();
    expect(m.waitingTotal).toBe(0);
  });
});

// ── Правило 5 минут (плейбук 2026) ──────────────────────────────────────────

describe("lead-speed: правило 5 минут (under5m / handledTimedTotal)", () => {
  it("Считает долю обработок, уложившихся в 5 минут", () => {
    const leads = [
      buildLead({ user_id: "l-fast", createdAt: "2026-09-04T10:00:00.000Z" }),
      buildLead({ user_id: "l-slow", createdAt: "2026-09-04T10:00:00.000Z" }),
    ];
    const todos = [
      handledTodo("l-fast", "2026-09-04T10:03:00.000Z"), // 3 мин → в пятёрке
      handledTodo("l-slow", "2026-09-04T10:40:00.000Z"), // 40 мин → мимо
    ];
    const m = computeLeadSpeedMetrics(leads, todos, NOW);
    expect(m.handledTimedTotal).toBe(2);
    expect(m.under5m).toBe(1);
    expect(m.under5mRate).toBeCloseTo(0.5, 6);
  });

  it("Нет timed-точек (только конверсии) → under5mRate null", () => {
    const lead = buildLead({
      user_id: "l-conv",
      rentals: [
        {
          rentalId: "r-1", status: "active", paymentStatus: "paid",
          startDate: "2026-09-03T10:00:00.000Z", endDate: "2026-09-20T10:00:00.000Z",
          bikeTitle: "79BIKE Falcon GT", totalCost: 21000,
        },
      ],
    });
    const m = computeLeadSpeedMetrics([lead], [], NOW);
    expect(m.handledTimedTotal).toBe(0);
    expect(m.under5m).toBe(0);
    expect(m.under5mRate).toBeNull();
  });

  it("Граница окна: ровно 5 минут — считается уложившимся (≤)", () => {
    const todos = [handledTodo("l-edge", "2026-09-04T10:05:00.000Z")];
    const m = computeLeadSpeedMetrics(
      [buildLead({ user_id: "l-edge", createdAt: "2026-09-04T10:00:00.000Z" })],
      todos,
      NOW,
    );
    expect(m.under5m).toBe(1);
  });
});
