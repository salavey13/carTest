// /app/franchize/lib/superlist-clear-core.ts
//
// ЧИСТАЯ математика механики «Суперлист закрыт» (без серверных импортов —
// чтобы её можно было импортировать из тестов и клиентских компонентов без
// пробуждения lib/supabase-server, который бросает исключение в браузере/
// vitest; серверная оркестрация — в superlist-clear.ts, паттерн как у
// lead-event-core.ts / lead-events.ts).
//
// Просьба босса (2026-09-09): «improve something notification wise — like
// when somebody actually covered whole superlead list — notify admin and
// owner, give a fucking achievement to the dude:) an so on;)».
//
// «Суперлист» — очередь плейбука смены (LeadsPlaybookPanel, «что делать
// сейчас», buildNextActions ≤6 позиций). Оператор отрабатывает позиции —
// и когда КАЖДАЯ позиция прошлого среза ушла из очереди (горячие отвечены,
// перезвоны сделаны, молчуны реанимированы, деньги на столе закрыты) — это
// МОМЕНТ ПРАЗДНИКА: бейдж closer'у, очки в лидерборд, фанфары в Telegram
// владельцу+админам+глобальному админу и золотой баннер на странице лидов.
//
// DETEКЦИЯ: getFranchizeLeads и так считает плейбук при каждой загрузке
// страницы и каждом тихом meta-рефреше (90 c). Рядом с этим сравниваем
// ТЕКУЩУЮ очередь со снапшотом прошлого среза:
//
//   снапшот (crews.metadata.superlist, CAS по crews.updated_at):
//     { count, items: string[] (подписи позиций), at: ISO,
//       lastClearAt?: ISO, totalClears?: number }
//
//   CLEAR = все условия сразу:
//     1. в снапшоте было ≥ SUPERLIST_MIN_ITEMS позиций (список «супер»);
//     2. снапшот свежий (≤ 7 суток — иначе это архив, а не работа смены);
//     3. КАЖДАЯ подпись прошлого среза отсутствует сейчас:
//        • новые прибывшие лиды НЕ мешают празднику (список был закрыт —
//          новые уже следующая очередь);
//        • переезд позиции в другое ведро у ТОГО ЖЕ лида НЕ считается
//          закрытием (подпись = leadId: «горячий» стал «ghost» — ситуация
//          жива, работать ещё);
//     4. БЫЛА РЕАЛЬНАЯ РАБОТА: ≥ 1 события lead_handled/callback_completed
//        от живого оператора ПОСЛЕ снапшота (список отработан, а не сам
//        истёк) — closer = актор ПОСЛЕДНЕГО такого события;
//     5. кулдаун 12 ч (по снапшоту И по факту события superlist_cleared в
//        журнале — кулдаун выживает даже при неудачной записи снапшота).

import type { NextAction } from "@/app/franchize/[slug]/leads/lib/lead-playbook";

// ── Константы ──────────────────────────────────────────────────────────────

/** Список «супер» только если в нём было хотя бы столько позиций. */
export const SUPERLIST_MIN_ITEMS = 3;

/** Протухший снапшот (список висит неделями) праздника не даёт. */
export const SUPERLIST_SNAPSHOT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** Минимум операторских действий между срезами, чтобы верить в «отработал». */
export const SUPERLIST_MIN_WORK_EVENTS = 1;

/** Повторный праздник не раньше, чем через столько после предыдущего. */
export const SUPERLIST_COOLDOWN_MS = 12 * 60 * 60 * 1000;

/** Очки лидерборда closer'у (LEAD_EVENT_POINTS.superlist_cleared). */
export const SUPERLIST_POINTS = 25;

/** Личное закрытие №…, после которого выдаётся веха-бейдж. */
export const SUPERLIST_MILESTONES: ReadonlyArray<{ at: number; achievementId: string }> = [
  { at: 5, achievementId: "superlist_clear_5" },
  { at: 15, achievementId: "superlist_clear_15" },
];

/** Действия, доказывающие работу по списку (журнал lead_events). */
export const SUPERLIST_WORK_EVENT_TYPES: ReadonlySet<string> = new Set([
  "lead_handled",
  "callback_completed",
]);

// ── Типы ───────────────────────────────────────────────────────────────────

/** Минимальная форма события журнала, нужная детекции (LeadEventRow уже такова). */
export interface SuperlistEventRow {
  type: string;
  actor: string | null;
  createdAt: string;
}

export interface SuperlistSnapshotState {
  /** Размер очереди на прошлом срезе. */
  count: number;
  /** Подписи позиций прошлого среза. */
  items: string[];
  /** ISO момента среза (обновляется только при изменении очереди). */
  at: string;
  /** ISO последнего праздника (информативно; кулдаун дублируется журналом). */
  lastClearAt?: string | null;
  /** Сколько раз экипаж закрывал суперлист за всё время. */
  totalClears?: number;
}

export interface SuperlistClearDecision {
  /** Оператор, чьё действие оказалось последним («the dude»). */
  closerId: string;
  /** Сколько позиций было в закрытом списке. */
  itemsCount: number;
  /** Сколько операторских действий прошло между срезами. */
  workEvents: number;
  /** Порядковый номер закрытия экипажа (с учётом этого). */
  totalClears: number;
}

// ── Чистые функции ─────────────────────────────────────────────────────────

/** Подпись позиции очереди: ситуация привязана к ЛИДУ (переезды между
 *  вёдрами у того же лида — та же нерешённая ситуация). */
export function superlistActionSignature(action: Pick<NextAction, "key" | "leadId">): string {
  return action.leadId ? `lead:${action.leadId}` : `no-lead:${action.key}`;
}

/** Живой оператор (не служебный ingest) — тот же критерий, что в recordLeadEvent. */
export function isHumanSuperlistActor(actor: string | null | undefined): boolean {
  return !!actor && actor !== "avito-agent" && /^\d{1,12}$/.test(actor);
}

/**
 * Решение «суперлист закрыт?» — чистая функция, детерминирована входами
 * (nowMs снаружи — как в lead-playbook/lead-kpi). null = праздника нет.
 */
export function evaluateSuperlistClear(params: {
  snapshot: SuperlistSnapshotState | null;
  queue: NextAction[];
  /** Журнал событий экипажа (окно ≥ срока жизни снапшота — 30 суток ок). */
  events: SuperlistEventRow[];
  nowMs: number;
}): SuperlistClearDecision | null {
  const { snapshot, queue, events, nowMs } = params;
  if (!snapshot || !Number.isFinite(snapshot.count) || snapshot.count < SUPERLIST_MIN_ITEMS) return null;
  if (!Array.isArray(snapshot.items) || snapshot.items.length === 0) return null;

  // 2) снапшот свежий?
  const snapMs = new Date(snapshot.at).getTime();
  if (!Number.isFinite(snapMs) || nowMs - snapMs > SUPERLIST_SNAPSHOT_MAX_AGE_MS || nowMs < snapMs) return null;

  // 3) каждая прошлая позиция ушла (подпись = lead — переезды в другие вёдра не считаются)
  const currentSigs = new Set((Array.isArray(queue) ? queue : []).map(superlistActionSignature));
  const covered = snapshot.items.every((sig) => !currentSigs.has(sig));
  if (!covered) return null;

  // 4) была реальная работа живого оператора ПОСЛЕ среза; closer — последний
  const work = (Array.isArray(events) ? events : [])
    .filter((e) => SUPERLIST_WORK_EVENT_TYPES.has(e.type) && isHumanSuperlistActor(e.actor))
    .filter((e) => {
      const t = new Date(e.createdAt).getTime();
      return Number.isFinite(t) && t > snapMs && t <= nowMs;
    })
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  if (work.length < SUPERLIST_MIN_WORK_EVENTS) return null;
  const closerId = work[work.length - 1].actor as string;

  // 5) кулдаун: по снапшоту ИЛИ по факту праздника в журнале (живучесть при
  //    неудачной записи снапшота)
  const lastClearMs = snapshot.lastClearAt ? new Date(snapshot.lastClearAt).getTime() : NaN;
  if (Number.isFinite(lastClearMs) && nowMs - lastClearMs < SUPERLIST_COOLDOWN_MS) return null;
  const celebratedRecently = (Array.isArray(events) ? events : []).some((e) => {
    if (e.type !== "superlist_cleared") return false;
    const t = new Date(e.createdAt).getTime();
    return Number.isFinite(t) && nowMs - t < SUPERLIST_COOLDOWN_MS;
  });
  if (celebratedRecently) return null;

  return {
    closerId,
    itemsCount: snapshot.count,
    workEvents: work.length,
    totalClears: (Number.isFinite(snapshot.totalClears) ? Number(snapshot.totalClears) : 0) + 1,
  };
}

/** Следующий снапшот после наблюдения (чистая функция). */
export function nextSuperlistSnapshot(
  snapshot: SuperlistSnapshotState | null,
  queue: NextAction[],
  decision: SuperlistClearDecision | null,
  nowIso: string,
): SuperlistSnapshotState {
  const items = (Array.isArray(queue) ? queue : []).map(superlistActionSignature);
  return {
    count: items.length,
    items,
    at: nowIso,
    lastClearAt: decision ? nowIso : snapshot?.lastClearAt ?? null,
    totalClears: decision
      ? decision.totalClears
      : Number.isFinite(snapshot?.totalClears)
        ? Number(snapshot?.totalClears)
        : 0,
  };
}

/** Снапшот нужно перезаписать? (иначе — чтение/выдача без записи в crews) */
export function snapshotNeedsWrite(
  prev: SuperlistSnapshotState | null,
  next: SuperlistSnapshotState,
): boolean {
  if (!prev) return true;
  if (prev.count !== next.count) return true;
  if (prev.at !== next.at) {
    if (prev.items.length !== next.items.length) return true;
    if (prev.items.some((s, i) => s !== next.items[i])) return true;
  }
  // праздник внутри этого среза (lastClearAt совпал с моментом среза)
  if (!!next.lastClearAt && next.lastClearAt === next.at && prev.lastClearAt !== next.lastClearAt) return true;
  return false;
}

/** «1 позиция / 2 позиции / 5 позиций» для телеграм-текста. */
export function pluralSuperlistItems(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "позиция";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "позиции";
  return "позиций";
}
