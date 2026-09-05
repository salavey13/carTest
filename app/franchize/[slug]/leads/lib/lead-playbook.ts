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
//
// Модуль чистый: без React, без Date.now() внутри (now передаётся снаружи).
// Сообщения переиспользуют скриптовый движок (lead-scripts.ts) — один
// источник тона и фактов экипажа.

import type { LeadRow, LeadTodoRow } from "../leads-types";
import { ensureLeadArraysSafe } from "./lead-speed";
import { matchTodosToLead } from "./pipeline-stages";
import { getLeadHandling } from "./lead-handling";
import { ghostReengageLine, pullUpLine } from "./lead-scripts";

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
export const DEATH_ZONE_MS = 5 * 60_000;
/** Свежий не-горячий лид: пока конкурент не ответил. */
const FRESH_WINDOW_MS = 60 * 60_000;
/** Тишина, после которой договор считается «висящим». */
const CONTRACT_HANG_MS = 24 * 60 * 60 * 1000;
/** Тишина покупателя, после которой диалог считается «пропавшим». */
export const GHOST_SILENCE_MS = 24 * 60 * 60 * 1000;
/** Аренда стартует позже чем через… — кандидат на «подтянуть на сегодня». */
const PULLUP_HORIZON_MS = 36 * 60 * 60 * 1000;

// ── Типы ───────────────────────────────────────────────────────────────────

export type NextActionKey =
  | "hot-waiting"
  | "callback-overdue"
  | "fresh-waiting"
  | "contract-hanging"
  | "pull-up"
  | "ghost";

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
  hotFresh: 110,
  callbackOverdue: 100,
  hotLate: 90,
  fresh: 85,
  contractHanging: 70,
  pullUp: 60,
  ghost: 55,
} as const;

const PRE_RENTAL_STAGES: ReadonlySet<string> = new Set([
  "contract_sent",
  "awaiting_qr_claim",
  "documents_missing",
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
 * Возвращает до `limit` действий, отсортированных по весу (курс-приоритеты),
 * при равном весе — старые ситуации раньше свежих.
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

    // Канал авито — та же тройка проверок, что в lead-kpi (ghost-семантика
    // должна совпадать с ghostsTotal, иначе панель и счётчик разойдутся).
    const isAvitoLike =
      lead.contactChannel === "avito" ||
      !!lead.avito?.chatId ||
      lead.user_id.startsWith("avito:");

    // ── Просроченный перезвон — обещание уже нарушено ──
    if (
      handling.callback &&
      !handling.handled &&
      !isConverted
    ) {
      const due = safeMs(handling.callback.dueAt);
      if (Number.isFinite(due) && due < now) {
        found.push(
          action(
            "callback-overdue",
            "📞",
            `Позвонить: ${who}`,
            `Перезвон просрочен на ${fmtAge(now - due)} — обещание уже нарушено${handling.callback.note ? ` (${handling.callback.note})` : ""}`,
            "Здравствуйте! Перезваниваю по вашему вопросу — подскажу наличие и посчитаю стоимость на ваши даты. Удобно сейчас поговорить пару минут?",
            leadId,
            "danger",
            WEIGHT.callbackOverdue,
            now - due,
          ),
        );
        continue; // у лида активный перезвон — «ждёт ответа» это не перекрывает
      }
    }

    const isHot = lead.avito?.analysis?.temperature === "hot";
    const createdMs = safeMs(lead.createdAt);
    const ageMs = Number.isFinite(createdMs) ? Math.max(0, now - createdMs) : NaN;

    // ── Ждёт первого ответа (не обработан, не конверт, без перезвона) ──
    if (!handling.handled && !isConverted && !handling.callback) {
      if (isHot && Number.isFinite(ageMs)) {
        if (ageMs <= GOLD_WINDOW_MS) {
          found.push(
            action(
              "hot-waiting",
              "🔥",
              `Ответить горячему: ${who}`,
              `ждёт ${fmtAge(ageMs)} — окно первого ответа: +391% к закрытию, мотивация живёт минуты`,
              `Здравствуйте${name ? `, ${name}` : ""}! Байк свободен — когда удобнее подъехать, сегодня или завтра? Зафиксирую бронь сразу.`,
              leadId,
              "danger",
              WEIGHT.hotFresh,
              ageMs,
            ),
          );
        } else {
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
      } else if (futureStarts.length === 0 && lead.rentals.length === 0) {
        // Договор без аренды и без ближайшего старта: висит?
        const modMs = safeMs(lead.lastModifiedAt || lead.createdAt);
        if (Number.isFinite(modMs) && now - modMs >= CONTRACT_HANG_MS) {
          found.push(
            action(
              "contract-hanging",
              "🧾",
              `Договор висит: ${who}`,
              `без движения ${fmtAge(now - modMs)} — помочь принять договор/QR, пока интерес не остыл`,
              "Здравствуйте! Высылали вам договор на аренду — помогу его принять и оформить за пару минут. Когда удобно подъехать за байком?",
              leadId,
              "warning",
              WEIGHT.contractHanging,
              now - modMs,
            ),
          );
        }
      }
    }

    // ── Ghost: авито-диалог молчит >24 ч, никто его не ведёт ──
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
      if (hadDialog && Number.isFinite(silenceFrom) && now - silenceFrom >= GHOST_SILENCE_MS) {
        found.push(
          action(
            "ghost",
            "👻",
            `Реанимировать: ${who}`,
            `тишина ${fmtAge(now - silenceFrom)} — «нет» не навсегда: лёгкое сообщение даёт самый высокий отклик`,
            ghostReengageLine(name),
            leadId,
            "info",
            WEIGHT.ghost,
            now - silenceFrom,
          ),
        );
      }
    }
  }

  return found
    .sort((a, b) => b.weight - a.weight || b.ageMs - a.ageMs)
    .slice(0, cap);
}
