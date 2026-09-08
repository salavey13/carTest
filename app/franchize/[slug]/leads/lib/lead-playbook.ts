// /app/franchize/[slug]/leads/lib/lead-playbook.ts
//
// ПЛЕЙБУК СМЕНЫ — «что делать сейчас» (off-the-call SOP).
// =====================================================================
//
// Источник идей: The Ultimate Sales Training 2026 («Ultimate Sales
// blueprint»). Ключевой тезис курса: у продавца есть ON-the-call скрипт
// (у нас — «Готовый ответ» в шторке лида) и OFF-the-call SOP — что делать
// между диалогами. «Most people only address the on-the-call and don't
// address the off-the-call, which is why their salespeople aren't nearly
// as productive». Этот модуль — вторая половина: упорядоченная очередь
// действий по живым данным лидов, каждое — с готовым сообщением для
// копирования.
//
// ПРИОРИТЕТЫ (веса) — по цифрам курса:
//   1. ГОРЯЧИЙ ЖДЁТ < 5 мин (вес 110) — «окно 60 секунд»: ответ в первую
//      минуту = +391% к шансу закрытия; мотивация покупателя живёт недолго
//      («people have huge motivation for a tiny period of time»).
//   2. ПРОСРОЧЕННЫЙ ПЕРЕЗВОН (100) — назначенное обещание важнее нового
//      входящего: просроченный перезвон = слитый доверие.
//   3. ГОРЯЧИЙ ЖДЁТ ≥ 5 мин (90) — «зона смерти»: после 5 минут тишины
//      шанс закрытия −80%; спасаем следующие по температуре.
//   4. СВЕЖИЙ ЖДЁТ ≤ 60 мин (85) — «50% покупателей уходят к тому, кто
//      ответил первым»: новичок в очереди почти конкурент.
//   5. ДОГОВОР ВИСИТ > 24 ч (70) — КЭВ, отправленный и забытый.
//   6. ПОДТЯНУТЬ НА СЕГОДНЯ (60) — «pull-up appointments»: same-day визиты
//      имеют заметно более высокую явку, чем «через три дня».
//   7. РЕАНИМАЦИЯ GHOST (55) — «no for now ≠ no forever»: лёгкое
//      сообщение-мем даёт самый высокий отклик из всех сообщений курса.
//   8. ПУЛЬС-ЧЕК ПО ДОЛГО ПРОПАВШИМ (50) — тишина ≥ 7 дней: дожим уже
//      не «куда пропали», а с поводом из факта (сезон/модель) — «нет»
//      истекает, препятствия (занятость, бюджет месяца) прошли.
//   9. РЕКОМЕНДАЦИЯ ПОСЛЕ ЗАКРЫТИЯ (45) — «1+1=11» («10 Steps To Become A
//      Sales Machine», Squibb): просьба в 7-дневном окне после ЗАВЕРШЁННОЙ
//      (completed) аренды — самая низкая позиция: приятная опция, которая не
//      вытесняет операционные действия из очереди.
//
// Модуль чистый: без React, без Date.now() внутри (now передаётся снаружи).
// Сообщения переиспользуют скриптовый движок (lead-scripts.ts) — один
// источник тона и фактов экипажа.

import type { LeadRow, LeadTodoRow } from "../leads-types";
import { ensureLeadArraysSafe } from "./lead-speed";
import { matchTodosToLead } from "./pipeline-stages";
import { getLeadHandling } from "./lead-handling";
import { isAvitoLead } from "./lead-identity";
import { GHOST_SILENCE_MS } from "./lead-kpi";
// public API kept: specs import GHOST_SILENCE_MS from this module
export { GHOST_SILENCE_MS };
import { givenUpLine, ghostReengageLine, instantFollowUpLine, pullUpLine, referralAskLine, seasonalReengageLine } from "./lead-scripts";

// ── Ориентиры курса (бенчмарки для UI) ─────────────────────────────────────

export interface PlaybookBenchmark {
  key: string;
  /** Короткая метка («60 сек», «5 мин», «50%», «+29%»). */
  label: string;
  /** Факт из курса для подсказки/футера панели. */
  fact: string;
}

export const PLAYBOOK_BENCHMARKS: readonly PlaybookBenchmark[] = [
  {
    key: "sec60",
    label: "60 сек",
    fact: "ответ в первую минуту даёт +391% к шансу закрытия",
  },
  {
    key: "min5",
    label: "5 минут",
    fact: "после 5 минут тишины шанс сделки падает на 80%",
  },
  {
    key: "first",
    label: "50%",
    fact: "половина покупателей уходит к тому, кто ответил первым",
  },
  {
    key: "weekend",
    label: "+29%",
    fact: "продажа в субботу и воскресенье = +104 рабочих дня = +29% выручки в год",
  },
];

// ── Окна времени ───────────────────────────────────────────────────────────

/** «Золотое окно» первого ответа (курс: 60 сек; практично — 5 мин). */
const GOLD_WINDOW_MS = 5 * 60_000;
/** «Зона смерти»: после 5 минут тишины закрытие падает на 80%. */
/** Свежий не-горячий лид: пока конкурент не ответил. */
const FRESH_WINDOW_MS = 60 * 60_000;
/** Тишина, после которой договор считается «висящим». */
const CONTRACT_HANG_MS = 24 * 60 * 60 * 1000;
/** Тишина покупателя, после которой диалог считается «пропавшим». */
/** Тишина, после которой лёгкое «куда пропали?» меняется на пульс-чек с поводом. */
export const GHOST_LONG_SILENCE_MS = 7 * 24 * 60 * 60 * 1000;
/** Аренда стартует позже чем через… — кандидат на «подтянуть на сегодня». */
const PULLUP_HORIZON_MS = 36 * 60 * 60 * 1000;
//
// ── 2026-09-09 RECENCY POLISH («the recenter the better», просьба босса) ────
//
// Раньше у «ожидающих» вёдер не было потолка давности: hot-лид (температура
// фиксируется при ingest и не переоценивается) висел «Спасти горячего»
// неделями, просроченный перезвон двухмесячной давности занимал топ очереди
// с весом 100, а «Договор висит» мог быть полугодовым. Очередь превращалась
// в музей древностей вместо «что делать СЕГОДНЯ».
//
// Теперь у каждого операционного окна есть потолок: после него ситуация —
// уже не оперативка, а реанимация (ведро ghost 👻) или вообще вне очереди
// (туду остаётся в колонке «Работа», но не мигает в плейбуке).

/**
 * Потолок «Спасти горячего»: сутки тишины — и горячий лид перестаёт быть
 * операционной срочностью. Avito-диалоги дальше автоматически подхватывает
 * ведро ghost (≥ GHOST_SILENCE_MS) с честным тоном реанимации.
 */
export const HOT_WAIT_MAX_MS = 24 * 60 * 60 * 1000;
/**
 * Просроченный перезвон ≤ суток — свежее нарушенное обещание (полный вес 100,
 * «слитый доверие» — курс). Демотированный вес для перезвона возрастом
 * сутки–неделя: обещание старое, но живое — ниже «договора висит» (70).
 */
export const CALLBACK_OVERDUE_FRESH_MS = 24 * 60 * 60 * 1000;
export const CALLBACK_OVERDUE_STALE_WEIGHT = 65;
/**
 * Потолок просрочки перезвона (неделя): старше — «перезвоню» уже мёртв,
 * таскать его наверху очереди — ложная срочность. Туду «Перезвонить»
 * продолжает висеть в колонке «Работа» до явного решения оператора.
 */
export const CALLBACK_OVERDUE_MAX_MS = 7 * 24 * 60 * 60 * 1000;
/**
 * Потолок «Договора висит» (2 недели): договор без движения месяц — это не
 * очередь, это архивная пыль; оператору нужно закрыть лид (Потеряно/Отказ),
 * а не ежедневно видеть его в «что делать сейчас».
 */
export const CONTRACT_HANG_MAX_MS = 14 * 24 * 60 * 60 * 1000;
/**
 * Окно просьбы о рекомендации после закрытой аренды («1+1=11», 10 Steps
 * To Become A Sales Machine): лучшее время — сразу после успешного опыта,
 * пока эмоция жива. Неделя — разумный горизонт, потом повод остывает.
 */
export const REFERRAL_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
/**
 * Давность потери, после которой лид в «Потеряно» становится кандидатом
 * на реактивацию («Вы передумали?», LAPS reactivation). Месяц — разумный
 * горизонт: раньше ещё горячий, позже — сезон может уйти.
 */
export const LOST_REACTIVATE_MS = 30 * 24 * 60 * 60 * 1000;
//
// ── 2026-09-09 SUPER DUPER («todays work = super duper leads», просьба босса) ─
//
// Потолки давности для оставшихся «вечных» вёдер: очередь «что делать
// сейчас» — это РАБОТА СЕГОДНЯ, а не музей древностей. Ситуация старше
// своего потолка уходит из очереди (в работу по мере жизни данных) —
// реально перезвонить/реанимировать можно у ситуации, которая ещё тёплая.

/**
 * Потолок тишины для вёдер ghost 👻 / ghost-long 🍂 (30 дней): авито-диалог,
 * молчащий дольше месяца, — не «сегодняшняя работа», а архив. Реанимация
 * такого диалога — фоновая кампания, а не очередь смены.
 */
export const GHOST_MAX_MS = 30 * 24 * 60 * 60 * 1000;
/**
 * Потолок реактивации «Потеряно» (90 дней): лид, потерянный квартал назад,
 * ещё помнит нас; потерянный год назад — нет. Старше — не мигаем в очереди.
 */
export const LOST_REACTIVATE_MAX_MS = 90 * 24 * 60 * 60 * 1000;
/**
 * Горизонт «Подтянуть на сегодня» (7 дней): бронь, стартующая через месяц,
 * не подтягивается на сегодня — оператор просто пугает клиента планами.
 * Потолок препятствует ложной срочности далёких броней.
 */
export const PULLUP_MAX_HORIZON_MS = 7 * 24 * 60 * 60 * 1000;
/**
 * ВЕСО 105 — «ДЕНЬГИ НА СТОЛЕ» (money-on-table): самая денежная ситуация
 * дня, сразу после «горячего ждёт < 5 мин» (110) и ВЫШЕ просроченного
 * перезвона (100). Два случая:
 *   1. частичная оплата зафиксирована (metadata.saleProgress.status =
 *      "partial_paid") — деньги УЖЕ у нас, дожимаем остаток;
 *   2. подтверждённая бронь стартует ≤ PULLUP_HORIZON_MS (36 ч) — клиент
 *      вот-вот приедет: принять оплату и выдать байк.
 */
export const MONEY_ON_TABLE_WEIGHT = 105;

// ── Типы ───────────────────────────────────────────────────────────────────

export type NextActionKey =
  | "money-on-table"
  | "hot-waiting"
  | "callback-overdue"
  | "fresh-waiting"
  | "contract-hanging"
  | "pull-up"
  | "ghost"
  | "ghost-long"
  | "referral"
  | "reactivation";

export interface NextAction {
  key: NextActionKey;
  emoji: string;
  /** Что сделать — глагол + имя лида («Ответить: Иван»). */
  title: string;
  /** Почему сейчас — цифра/факт курса («ждёт 3 мин — окно +391%»). */
  detail: string;
  /** Готовое сообщение для копирования (не у всех действий). */
  message: string | null;
  /** Лид-адресат (user_id) для будущей навигации. */
  leadId: string | null;
  tone: "danger" | "warning" | "info";
  weight: number;
  /** Возраст ситуации (мс) — вторичная сортировка. */
  ageMs: number;
}

// ── Веса (см. шапку модуля) ────────────────────────────────────────────────

const WEIGHT = {
  // «Деньги на столе» — самая денежная ситуация дня (см. константу выше).
  moneyOnTable: MONEY_ON_TABLE_WEIGHT,
  hotFresh: 110,
  callbackOverdue: 100,
  hotLate: 90,
  fresh: 85,
  contractHanging: 70,
  pullUp: 60,
  ghost: 55,
  ghostLong: 50,
  // Ниже ghost-long: приятная опция, не операционка — при нескольких
  // закрытиях за неделю не вытесняет перезвоны/ghost/pull-up из очереди.
  referral: 45,
  // Самый низкий: реактивация «Потеряно» — фоновая работа, никогда
  // не раньше живых диалогов.
  reactivation: 40,
} as const;

const PRE_RENTAL_STAGES: ReadonlySet<string> = new Set([
  "contract_sent",
  // 2026-09-09: awaiting_qr_claim/documents_missing удалены из пайплайна
  // (pipeline-stages) — преддоговорная стадия теперь одна.
]);

// ── Внутренние хелперы ─────────────────────────────────────────────────────

function leadFirstName(lead: LeadRow): string | null {
  const raw = (lead.full_name || "").trim();
  if (!raw || /^покупатель/i.test(raw)) return null;
  const first = raw.split(/\s+/)[0]?.replace(/[^\p{L}\-]/gu, "") ?? "";
  if (first.length < 2 || first.length > 24) return null;
  return first;
}

function safeMs(iso: string | null | undefined): number {
  if (!iso) return NaN;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : NaN;
}

function fmtAge(ms: number): string {
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `${Math.max(1, m)} мин`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ч`;
  return `${Math.floor(h / 24)} д`;
}

/** 300000 → «300 000 ₽» (сообщения ведра «Деньги на столе»). */
function fmtRub(n: number): string {
  return `${new Intl.NumberFormat("ru-RU").format(Math.round(n))} ₽`;
}

function action(
  key: NextActionKey,
  emoji: string,
  title: string,
  detail: string,
  message: string | null,
  leadId: string | null,
  tone: NextAction["tone"],
  weight: number,
  ageMs: number,
): NextAction {
  return { key, emoji, title, detail, message, leadId, tone, weight, ageMs };
}

// ── Основной расчёт ────────────────────────────────────────────────────────

/**
 * Очередь «что делать сейчас» по всем лидам (off-the-call SOP).
 * Возвращает до `limit` действий, отсортированных по весу (курс-приоритеты);
 * при равном весе — СВЕЖАЯ ситуация раньше старой («the recenter the
 * better», 2026-09-09: внутри одного ведра оператор сначала закрывает
 * то, что ещё тёплое).
 */
export function buildNextActions(
  leadsInput: LeadRow[],
  allTodosInput: LeadTodoRow[],
  now: number = Date.now(),
  limit: number = 4,
): NextAction[] {
  const leads = Array.isArray(leadsInput) ? leadsInput : [];
  const allTodos = Array.isArray(allTodosInput) ? allTodosInput : [];
  const cap = Math.max(1, Math.min(6, limit));
  const found: NextAction[] = [];

  for (const rawLead of leads) {
    const lead = ensureLeadArraysSafe(rawLead);
    // Операторские заглушки — не покупатели, SOP не для них.
    if (lead.identityState === "operator_placeholder") continue;

    const name = leadFirstName(lead);
    const who = name ? name : "Лид";
    const leadId = lead.user_id || null;
    const todosForLead = matchTodosToLead(lead, allTodos);
    const handling = getLeadHandling(todosForLead);

    const isConverted =
      lead.rentals.length > 0 || lead.sales.length > 0 || (lead.contractCount ?? 0) > 0;

    // Avito channel - canonical detector (lib/lead-identity); ghost semantics
    // matches lead-kpi because it is now literally the same function.
    const isAvitoLike = isAvitoLead(lead);

    // ── Просроченный перезвон — обещание уже нарушено ──
    if (
      handling.callback &&
      !handling.handled &&
      !isConverted
    ) {
      const due = safeMs(handling.callback.dueAt);
      const overdueFor = Number.isFinite(due) ? now - due : NaN;
      // 2026-09-09 recency polish: ≤ суток просрочки — свежее нарушенное
      // обещание (полный вес, danger); до недели — демотированное (warning,
      // ниже «договора висит»); старше недели — не мигаем вовсе (туду
      // остаётся в «Работе», но топ очереди не занимает).
      if (
        Number.isFinite(overdueFor) &&
        overdueFor > 0 &&
        overdueFor <= CALLBACK_OVERDUE_MAX_MS
      ) {
        const freshPromise = overdueFor <= CALLBACK_OVERDUE_FRESH_MS;
        found.push(
          action(
            "callback-overdue",
            "📞",
            `Позвонить: ${who}`,
            `Перезвон просрочен на ${fmtAge(overdueFor)} — обещание уже нарушено${handling.callback.note ? ` (${handling.callback.note})` : ""}`,
            "Здравствуйте! Перезваниваю по вашему вопросу — подскажу наличие и посчитаю стоимость на ваши даты. Удобно сейчас поговорить пару минут?",
            leadId,
            freshPromise ? "danger" : "warning",
            freshPromise ? WEIGHT.callbackOverdue : CALLBACK_OVERDUE_STALE_WEIGHT,
            overdueFor,
          ),
        );
        continue; // у лида активный перезвон — «ждёт ответа» это не перекрывает
      }
    }

    const isHot = lead.avito?.analysis?.temperature === "hot";
    const createdMs = safeMs(lead.createdAt);
    const ageMs = Number.isFinite(createdMs) ? Math.max(0, now - createdMs) : NaN;

    // ── «ДЕНЬГИ НА СТОЛЕ» (105) — самая денежная ситуация дня ──
    // 1) Частичная оплата (metadata.saleProgress.status = "partial_paid"):
    //    деньги уже у нас, клиент уже согласился — дожать остаток проще и
    //    дешевле, чем закрывать нового. Без потолка давности: частичный
    //    платёж — это не «старый мусор», а реальное незакрытое обязательство,
    //    но свежие ситуации внутри ведра идут раньше (tie-break по ageMs).
    const sp = lead.saleProgress;
    if (sp && sp.status === "partial_paid") {
      const paid = typeof sp.paidRub === "number" && sp.paidRub > 0 ? sp.paidRub : 0;
      const total = typeof sp.totalRub === "number" && sp.totalRub > 0 ? sp.totalRub : 0;
      const rest = total > paid && paid > 0 ? total - paid : 0;
      found.push(
        action(
          "money-on-table",
          "💰",
          `Деньги на столе: ${who}`,
          rest > 0
            ? `внесено ${fmtRub(paid)} из ${fmtRub(total)} — осталось ${fmtRub(rest)}; дожми сделку, пока клиент сам не передумал`
            : `частичная оплата внесена${paid > 0 ? ` (${fmtRub(paid)})` : ""} — свяжись и закрой остаток сделки`,
          rest > 0
            ? `Здравствуйте${name ? `, ${name}` : ""}! Видим, что часть суммы по вашему байку уже внесена (${fmtRub(paid)}). Осталось ${fmtRub(rest)} — как подтвердим, сразу готовим к выдаче. Удобно закрыть вопрос сегодня?`
            : `Здравствуйте${name ? `, ${name}` : ""}! Видим, что часть суммы по вашему байку уже внесена${paid > 0 ? ` (${fmtRub(paid)})` : ""}. Давайте закроем остаток и подготовим байк к выдаче — удобно сегодня?`,
          leadId,
          "warning",
          WEIGHT.moneyOnTable,
          Number.isFinite(createdMs) ? Math.max(0, now - createdMs) : 0,
        ),
      );
    }
    // 2) Подтверждённая бронь стартует ≤ 36 ч: клиент вот-вот приедет —
    //    принять оплату и выдать байк СЕГОДНЯ. Ниже PULLUP_HORIZON_MS,
    //    поэтому с «Подтянуть на сегодня» не пересекается (там старт
    //    ДАЛЬШЕ горизонта, до PULLUP_MAX_HORIZON_MS).
    if (lead.rentals.length > 0) {
      const soonStarts = lead.rentals
        .filter((r) => r.status === "confirmed" || r.status === "pending_confirmation")
        .map((r) => safeMs(r.startDate))
        .filter((t) => Number.isFinite(t) && t > now && t <= now + PULLUP_HORIZON_MS)
        .sort((a, b) => a - b);
      if (soonStarts.length > 0) {
        found.push(
          action(
            "money-on-table",
            "💰",
            `Встретить клиента: ${who}`,
            `бронь стартует через ${fmtAge(soonStarts[0] - now)} — принять оплату и выдать байк`,
            `Здравствуйте${name ? `, ${name}` : ""}! Напоминаю: ваша бронь стартует уже скоро. Подъезжайте — встретим, примем оплату и выдадим байк. Если планы изменились, напишите — перенесём.`,
            leadId,
            "warning",
            WEIGHT.moneyOnTable,
            soonStarts[0] - now,
          ),
        );
      }
    }

    // ── Ждёт первого ответа (не обработан, не конверт, без перезвона) ──
    // 2026-09-09 recency polish: у «Спасти горячего» появился потолок
    // HOT_WAIT_MAX_MS (сутки) — дальше лид уже не «горячий ждёт», а тихий
    // ghost (его подхватывает ведро 👻 ниже, если был диалог).
    if (!handling.handled && !isConverted && !handling.callback) {
      if (isHot && Number.isFinite(ageMs)) {
        if (ageMs <= GOLD_WINDOW_MS) {
          found.push(
            action(
              "hot-waiting",
              "🔥",
              `Ответить горячему: ${who}`,
              `ждёт ${fmtAge(ageMs)} — окно первого ответа: +391% к закрытию, мотивация живёт минуты`,
              instantFollowUpLine(name),
              leadId,
              "danger",
              WEIGHT.hotFresh,
              ageMs,
            ),
          );
        } else if (Number.isFinite(ageMs) && ageMs <= HOT_WAIT_MAX_MS) {
          found.push(
            action(
              "hot-waiting",
              "🌡",
              `Спасти горячего: ${who}`,
              `ждёт ${fmtAge(ageMs)} — после 5 минут тишины шанс −80%, но диалог ещё спасаем`,
              `Здравствуйте${name ? `, ${name}` : ""}! Вы писали насчёт байка — ещё актуально? Могу назвать точную стоимость на ваши даты и забронировать.`,
              leadId,
              "warning",
              WEIGHT.hotLate,
              ageMs,
            ),
          );
        }
      } else if (Number.isFinite(ageMs) && ageMs <= FRESH_WINDOW_MS) {
        found.push(
          action(
            "fresh-waiting",
            "⚡",
            `Ответить первым: ${who}`,
            `ждёт ${fmtAge(ageMs)} — 50% покупателей уходят к тому, кто ответил первым`,
            "Здравствуйте! Да, в наличии — напишите даты, и я сразу зафиксирую бронь за вами.",
            leadId,
            "warning",
            WEIGHT.fresh,
            ageMs,
          ),
        );
      }
    }

    // ── КЭВ-стадия: договор висит или бронь «подтягивается» на сегодня ──
    // NB: БЕЗ гейта isConverted — договорные лиды уже «конверсия» по
    // семантике скорости (contractCount>0), но именно им адресованы
    // pull-up и «договор висит». Стадии active_rental+ не входят в набор.
    const stage = lead.stageKey || "";
    if (PRE_RENTAL_STAGES.has(stage)) {
      // Подтянуть: аренда с датой старта дальше горизонта — same-day явка выше.
      const futureStarts = lead.rentals
        .map((r) => safeMs(r.startDate))
        .filter((t) => Number.isFinite(t) && t > now + PULLUP_HORIZON_MS)
        .sort((a, b) => a - b);
      if (futureStarts.length > 0) {
        const startMs = futureStarts[0];
        // 2026-09-09 super duper: потолок горизонта PULLUP_MAX_HORIZON_MS —
        // бронь через месяц не «подтягивается на сегодня».
        if (startMs <= now + PULLUP_MAX_HORIZON_MS) {
          found.push(
            action(
              "pull-up",
              "⏩",
              `Подтянуть на сегодня: ${who}`,
              `бронь стартует через ${fmtAge(startMs - now)} — same-day визиты дают заметно более высокую явку`,
              pullUpLine(),
              leadId,
              "info",
              WEIGHT.pullUp,
              startMs - now,
            ),
          );
        }
      } else if (futureStarts.length === 0 && lead.rentals.length === 0) {
        // Договор без аренды и без ближайшего старта: висит?
        // 2026-09-09 recency polish: потолок CONTRACT_HANG_MAX_MS — договор
        // без движения 2+ недели это архивная пыль, а не «что делать сейчас».
        const modMs = safeMs(lead.lastModifiedAt || lead.createdAt);
        const hangFor = Number.isFinite(modMs) ? now - modMs : NaN;
        if (
          Number.isFinite(hangFor) &&
          hangFor >= CONTRACT_HANG_MS &&
          hangFor <= CONTRACT_HANG_MAX_MS
        ) {
          found.push(
            action(
              "contract-hanging",
              "🧾",
              `Договор висит: ${who}`,
              `без движения ${fmtAge(hangFor)} — помочь принять договор, пока интерес не остыл`,
              "Здравствуйте! Высылали вам договор на аренду — помогу его принять и оформить за пару минут. Когда удобно подъехать за байком?",
              leadId,
              "warning",
              WEIGHT.contractHanging,
              hangFor,
            ),
          );
        }
      }
    }

    // ── Ghost: авито-диалог молчит; никто его не ведёт. Курс: «нет» ≠
    // «нет навсегда» — но тон зависит от давности: сутки–неделя — лёгкое
    // «куда пропали?» (самый высокий отклик), дольше недели — пульс-чек
    // с ПОВОДОМ ИЗ ФАКТА (сезон/модель), препятствия за неделю истекают.
    const avito = lead.avito;
    if (avito && isAvitoLike && !handling.handled && !isConverted && !handling.callback) {
      const messagesCount =
        typeof avito.messagesCount === "number" && Number.isFinite(avito.messagesCount)
          ? avito.messagesCount
          : 0;
      const hadDialog =
        messagesCount >= 2 ||
        !!(avito.lastMessage || "").trim() ||
        !!(avito.firstMessage || "").trim();
      const silenceFrom = safeMs(avito.lastMessageAt || lead.lastSeenAt || lead.createdAt);
      if (hadDialog && Number.isFinite(silenceFrom)) {
        const silence = now - silenceFrom;
        // 2026-09-09 super duper: потолок GHOST_MAX_MS — диалог, молчащий
        // дольше месяца, не «сегодняшняя работа», а архив (см. константу).
        if (silence >= GHOST_LONG_SILENCE_MS && silence <= GHOST_MAX_MS) {
          found.push(
            action(
              "ghost-long",
              "🍂",
              `Пульс-чек: ${who}`,
              `тишина ${fmtAge(silence)} — «нет» истекает: препятствия (сезон, занятость) прошли, дожим с поводом из факта`,
              seasonalReengageLine(lead.bikeTitle),
              leadId,
              "info",
              WEIGHT.ghostLong,
              silence,
            ),
          );
        } else if (silence >= GHOST_SILENCE_MS && silence <= GHOST_MAX_MS) {
          // 2026-09-09 super duper: потолок GHOST_MAX_MS действует и здесь —
          // тишина дольше месяца из очереди «сегодня» уходит в архив.
          found.push(
            action(
              "ghost",
              "👻",
              `Реанимировать: ${who}`,
              `тишина ${fmtAge(silence)} — «нет» не навсегда: лёгкое сообщение даёт самый высокий отклик`,
              ghostReengageLine(name),
              leadId,
              "info",
              WEIGHT.ghost,
              silence,
            ),
          );
        }
      }
    }
  }

  // ── «1+1=11»: попросить рекомендацию у свежезакрытой аренды («10 Steps
  // To Become A Sales Machine», Squibb) — лучший момент для просьбы сразу
  // после успешного опыта; рекомендатель рискует своей репутацией, поэтому
  // приведённых друзей потом обслуживают безупречно. Отдельный проход ПОСЛЕ
  // основного цикла: закрытые лиды не участвуют в очереди ожидания.
  // ВЕС 45 (ниже ghost-long): просьба — приятная опция, а не операционка;
  // при нескольких закрытиях за неделю она не вытесняет из очереди
  // перезвоны/ghost/pull-up. Считаем только ЗАВЕРШЁННЫЕ аренды
  // (status="completed"): у отменённой endDate тоже наступает, но «успешного
  // опыта» не было — караулить клиента с «Рады, что всё прошло отлично!»
  // после отмены — прямой вред рекомендациям.
  for (const rawLead of leads) {
    const lead = ensureLeadArraysSafe(rawLead);
    if (lead.identityState === "operator_placeholder") continue;
    if ((lead.stageKey || "") !== "closed_won") continue;

    // Одним проходом: максимальный endDate среди завершённых в прошлом.
    let latestEndMs = NaN;
    for (const r of lead.rentals) {
      if (r.status !== "completed") continue;
      const t = safeMs(r.endDate);
      if (Number.isFinite(t) && t < now && (Number.isNaN(latestEndMs) || t > latestEndMs)) {
        latestEndMs = t;
      }
    }
    if (Number.isNaN(latestEndMs)) continue;
    const sinceEnd = now - latestEndMs;
    if (sinceEnd > REFERRAL_WINDOW_MS) continue;

    const name = leadFirstName(lead);
    found.push(
      action(
        "referral",
        "🤝",
        `Попросить рекомендацию: ${name ? name : "Лид"}`,
        `аренда закрыта ${fmtAge(sinceEnd)} назад — окно «1+1=11»: эмоция от удачной поездки ещё жива`,
        referralAskLine(name),
        lead.user_id || null,
        "info",
        WEIGHT.referral,
        sinceEnd,
      ),
    );
  }

  // ── «Вы передумали?»: реактивация проигранных («25 Years of Sales
  // Knowledge», LAPS reactivation campaign). Лиды в стадии «Потеряно»
  // (closed_lost) с давностью ≥ LOST_REACTIVATE_MS: прямой мягкий вопрос
  // «отказались или ещё думаете?» со встроенным разрешением перестать
  // напоминать — самый честный способ оживить пул потерь. Отдельный проход:
  // потерянные не участвуют в очереди ожидания. ВЕС 40 — самый низкий:
  // реактивация не должна стоять выше живых диалогов.
  for (const rawLead of leads) {
    const lead = ensureLeadArraysSafe(rawLead);
    if (lead.identityState === "operator_placeholder") continue;
    if ((lead.stageKey || "") !== "closed_lost") continue;

    // Точка потери: последнее касание (модификация/просмотр) или создание.
    const lostAtMs = safeMs(lead.lastModifiedAt || lead.lastSeenAt || lead.createdAt);
    if (!Number.isFinite(lostAtMs)) continue;
    const lostFor = now - lostAtMs;
    // 2026-09-09 super duper: потолок LOST_REACTIVATE_MAX_MS — потерянный
    // квартал назад лид ещё помнит нас, потерянный год назад — нет.
    if (lostFor < LOST_REACTIVATE_MS || lostFor > LOST_REACTIVATE_MAX_MS) continue;

    const mode: "rent" | "sale" | "generic" =
      lead.sales.length > 0 ? "sale" : lead.rentals.length > 0 ? "rent" : "generic";
    const name = leadFirstName(lead);
    found.push(
      action(
        "reactivation",
        "📭",
        `Реактивировать: ${name ? name : "Лид"}`,
        `в «Потеряно» ${fmtAge(lostFor)} — курс LAPS: прямой вопрос «передумали?» оживляет пул потерь без неловкости`,
        givenUpLine(mode),
        lead.user_id || null,
        "info",
        WEIGHT.reactivation,
        lostFor,
      ),
    );
  }

  return found
    .sort((a, b) => b.weight - a.weight || a.ageMs - b.ageMs)
    .slice(0, cap);
}
