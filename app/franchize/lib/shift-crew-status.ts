// Pure helpers for the /shift bot command (iter24).
//
// What lives here (NO db / NO server-only imports — vitest-friendly):
//   • crew roster rendering — the "who is on shift right now" message that
//     /shift replies with, and the compact one-liner appended to the
//     status-change notices sent to the crew owner + admins
//   • MSK (UTC+3, no DST) wall-clock helpers used by the achievement rules
//   • clock-in / clock-out achievement evaluation (early bird, dawn patrol,
//     weekend warrior, marathon, night owl)
//   • the reply-keyboard builder shared by the /shift keyboard and the
//     post-action replies (so the flow can continue without retyping /shift)
//   • positive-mindset footer lines — a must :)
//
// Timezone note: crew_member_shifts stores clock_in_time / clock_out_time as
// UTC ISO strings. The crew operates in Moscow (MSK = UTC+3, fixed offset —
// Russia has no DST since 2014), so every "wall clock" decision below shifts
// the UTC timestamp by +3h and reads the UTC getters. A date-only parse is
// never involved, so no TZ ambiguity.

export type ShiftLiveStatus = "online" | "riding" | "offline";

export type CrewShiftStatusEntry = {
  userId: string;
  username?: string | null;
  fullName?: string | null;
  /** crew_members.role: owner | co_owner | admin | member */
  role?: string | null;
  /** raw crew_members.live_status — can drift from the shift table */
  liveStatus?: string | null;
  /** ISO clock-in of the member's OPEN shift row; null = not on shift */
  activeShiftStartedAt?: string | null;
};

const MSK_OFFSET_MS = 3 * 60 * 60 * 1000;

// ── HTML escaping (bot messages are sent with parse_mode: HTML) ─────────────

export function escapeHtmlTg(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ── Russian pluralization ────────────────────────────────────────────────────

export function pluralRu(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(Math.floor(n));
  const mod10 = abs % 10;
  const mod100 = abs % 100;
  let form = many;
  if (mod10 === 1 && mod100 !== 11) form = one;
  else if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) form = few;
  return form.replace("%d", String(abs));
}

// ── MSK wall-clock helpers ───────────────────────────────────────────────────

export type MskParts = {
  hour: number;
  minute: number;
  /** 0 = Sunday … 6 = Saturday, in the MSK calendar day */
  dayOfWeek: number;
  /** 1-based day of the MSK year — used as the positive-line seed */
  dayOfYear: number;
};

/** MSK wall-clock parts of a UTC ISO timestamp (MSK = UTC+3, fixed). */
export function mskPartsFromIso(iso: string): MskParts {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return { hour: 0, minute: 0, dayOfWeek: 0, dayOfYear: 1 };
  const msk = new Date(t + MSK_OFFSET_MS);
  const yearStart = Date.UTC(msk.getUTCFullYear(), 0, 0);
  const dayOfYear = Math.floor((msk.getTime() - yearStart) / 86_400_000);
  return {
    hour: msk.getUTCHours(),
    minute: msk.getUTCMinutes(),
    dayOfWeek: msk.getUTCDay(),
    dayOfYear,
  };
}

/** "09:42 МСК" — for grant contexts and status-change notices. */
export function formatMskClock(iso: string): string {
  const { hour, minute } = mskPartsFromIso(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(hour)}:${pad(minute)} МСК`;
}

// ── Shift duration labels ────────────────────────────────────────────────────

/** "только что" | "23 минуты" | "2 часа" | "2 часа 5 минут" */
export function shiftDurationLabel(startedAtIso: string, nowMs: number): string {
  const started = Date.parse(startedAtIso);
  if (!Number.isFinite(started)) return "";
  const minutes = Math.max(0, Math.round((nowMs - started) / 60_000));
  if (minutes < 1) return "только что";
  if (minutes < 60) return pluralRu(minutes, "%d минуту", "%d минуты", "%d минут");
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const hoursLabel = pluralRu(hours, "%d час", "%d часа", "%d часов");
  if (rest === 0) return hoursLabel;
  return `${hoursLabel} ${pluralRu(rest, "%d минута", "%d минуты", "%d минут")}`;
}

// ── Positive-mindset footer lines (a must 🙂) ────────────────────────────────

export const SHIFT_POSITIVE_LINES: readonly string[] = [
  "Отличный день, чтобы заработать! 🔥",
  "Экипаж в деле — клиенты будут довольны! 😎",
  "Каждая смена — шаг к цели! 💪",
  "С экипажем за спиной любая задача по плечу! 🤝",
  "Успех любит настойчивых — так держать! ✨",
  "Хорошая смена начинается с хорошего настроя! 🌟",
  "Мотоциклы заряжены, клиенты едут — вперёд! 🏍️",
];

/** Deterministic pick (same line for the whole crew within one MSK day). */
export function pickPositiveShiftLine(seed: number): string {
  const idx = Math.abs(Math.floor(seed)) % SHIFT_POSITIVE_LINES.length;
  return SHIFT_POSITIVE_LINES[idx];
}

// ── Roster rendering ─────────────────────────────────────────────────────────

/**
 * Single source of truth for "is this member on shift" — the SAME rule the
 * /shift keyboard and the web shifts page use: an OPEN row in
 * crew_member_shifts means on shift; a zombie live_status='online' without a
 * row is ignored (drift); riding only when presence explicitly says so.
 */
export function resolveEffectiveShiftStatus(
  entry: Pick<CrewShiftStatusEntry, "liveStatus" | "activeShiftStartedAt">,
): ShiftLiveStatus {
  if (!entry.activeShiftStartedAt) return "offline";
  return entry.liveStatus === "riding" ? "riding" : "online";
}

/** Display name: full name → @username → "Участник #1234". */
export function shiftMemberDisplayName(entry: Pick<CrewShiftStatusEntry, "userId" | "username" | "fullName">): string {
  const name = String(entry.fullName ?? "").trim();
  if (name) return name;
  const uname = String(entry.username ?? "").replace(/^@/, "").trim();
  if (uname) return `@${uname}`;
  return `Участник #${String(entry.userId).slice(-4)}`;
}

/** Fun role badges: 👑 owner, ⭐ admin / co_owner. */
export function shiftRoleBadge(entry: Pick<CrewShiftStatusEntry, "role">): string {
  if (entry.role === "owner") return " 👑";
  if (entry.role === "admin" || entry.role === "co_owner") return " ⭐";
  return "";
}

const MAX_ON_SHIFT_LINES = 12;
const MAX_OFFLINE_NAMES = 10;

/**
 * Full roster block used by /shift replies:
 *
 *   🏍️ Экипаж «VIP_BIKE» — статусы смен
 *
 *   🏍️ Илья 👑 · @I_O_S_NN — на байке · 2 часа 5 минут
 *   🟢 Paul · @salavey13 — на смене · только что (это вы)
 *
 *   😴 Не на смене: Goollil, ORUDJOV
 *
 *   Отличный день, чтобы заработать! 🔥
 *
 * All dynamic parts are HTML-escaped (the bot sends parse_mode: HTML).
 * Riding members sort first, then by longest shift; the viewer is marked.
 */
export function formatCrewShiftStatusMessage(input: {
  crewName: string;
  viewerUserId: string;
  entries: CrewShiftStatusEntry[];
  nowMs?: number;
  header?: string;
}): string {
  const nowMs = input.nowMs ?? Date.now();

  const onShift = input.entries
    .map((entry) => ({ entry, status: resolveEffectiveShiftStatus(entry) }))
    .filter((x) => x.status !== "offline")
    .sort((a, b) => {
      const rank = (s: ShiftLiveStatus) => (s === "riding" ? 0 : 1);
      if (rank(a.status) !== rank(b.status)) return rank(a.status) - rank(b.status);
      const aStart = Date.parse(a.entry.activeShiftStartedAt ?? "") || nowMs;
      const bStart = Date.parse(b.entry.activeShiftStartedAt ?? "") || nowMs;
      return aStart - bStart; // longest shift first
    });
  const offline = input.entries.filter((e) => resolveEffectiveShiftStatus(e) === "offline");
  const isViewer = (id: string) => String(id) === String(input.viewerUserId);

  const lines: string[] = [];
  lines.push(input.header ?? `🏍️ Экипаж «${escapeHtmlTg(input.crewName)}» — статусы смен`);
  lines.push("");

  if (onShift.length === 0) {
    lines.push("😴 Сейчас никто не на смене — экипаж отдыхает.");
  } else {
    for (const { entry, status } of onShift.slice(0, MAX_ON_SHIFT_LINES)) {
      const icon = status === "riding" ? "🏍️" : "🟢";
      const label = status === "riding" ? "на байке" : "на смене";
      const displayName = escapeHtmlTg(shiftMemberDisplayName(entry));
      const badge = shiftRoleBadge(entry);
      const uname = String(entry.username ?? "").replace(/^@/, "").trim();
      const safeUname = `@${escapeHtmlTg(uname)}`;
      // append "@username" only when it isn't already the display name itself
      const who = uname && displayName !== safeUname ? `${displayName}${badge} · ${safeUname}` : `${displayName}${badge}`;
      const dur = entry.activeShiftStartedAt ? shiftDurationLabel(entry.activeShiftStartedAt, nowMs) : "";
      const viewer = isViewer(entry.userId) ? " (это вы)" : "";
      lines.push(`${icon} ${who} — ${label}${dur ? ` · ${dur}` : ""}${viewer}`);
    }
    if (onShift.length > MAX_ON_SHIFT_LINES) {
      lines.push(`… и ещё ${onShift.length - MAX_ON_SHIFT_LINES} на смене`);
    }
  }

  if (offline.length > 0) {
    const names = offline.slice(0, MAX_OFFLINE_NAMES).map((e) => {
      const n = escapeHtmlTg(shiftMemberDisplayName(e));
      return isViewer(e.userId) ? `${n} (это вы)` : n;
    });
    const more = offline.length > MAX_OFFLINE_NAMES ? `, … и ещё ${offline.length - MAX_OFFLINE_NAMES}` : "";
    lines.push("");
    lines.push(`😴 Не на смене: ${names.join(", ")}${more}`);
  }

  lines.push("");
  lines.push(pickPositiveShiftLine(mskPartsFromIso(new Date(nowMs).toISOString()).dayOfYear));
  return lines.join("\n");
}

/**
 * Compact one-liner for status-change notices to the owner/admins:
 * "Сейчас на смене (2): Paul, Илья" | "Сейчас на смене никого — экипаж отдыхает 😴"
 */
export function formatCrewShiftOnShiftLine(entries: CrewShiftStatusEntry[]): string {
  const onShift = entries.filter((e) => resolveEffectiveShiftStatus(e) !== "offline");
  if (onShift.length === 0) return "Сейчас на смене никого — экипаж отдыхает 😴";
  const names = onShift.map((e) => escapeHtmlTg(shiftMemberDisplayName(e)));
  return `Сейчас на смене (${onShift.length}): ${names.join(", ")}`;
}

// ── Reply keyboard ───────────────────────────────────────────────────────────

/**
 * Contextual /shift reply keyboard — the same rows the no-action keyboard
 * shows, reused after every action so the user can chain actions without
 * retyping /shift. Button TEXTS are matched verbatim by command-handler's
 * shiftActionMap — do not change them casually.
 */
export function buildShiftReplyButtons(
  hasActiveShift: boolean,
  liveStatus?: string | null,
): Array<Array<{ text: string }>> {
  if (!hasActiveShift) return [[{ text: "✅ Начать Смену" }]];
  if (liveStatus === "riding") return [[{ text: "🏢 В Боксе" }], [{ text: "❌ Завершить Смену" }]];
  return [[{ text: "🏍️ На Байке" }], [{ text: "❌ Завершить Смену" }]];
}

// ── Shift achievements (MSK rules) ──────────────────────────────────────────

/**
 * Achievements earned by STARTING a shift at clockInIso (UTC):
 *   shift_first          — always (first-ever badge; the grant action no-ops when already unlocked)
 *   shift_early_bird     — started before 10:00 МСК (strictly)
 *   shift_dawn_patrol    — started before 07:00 МСК (includes early_bird)
 *   shift_weekend_warrior— clock-in falls on Sat/Sun in the МСК calendar
 */
export function evaluateClockInAchievements(clockInIso: string): string[] {
  const ids: string[] = ["shift_first"];
  const { hour, minute, dayOfWeek } = mskPartsFromIso(clockInIso);
  const minutesOfDay = hour * 60 + minute;
  if (minutesOfDay < 10 * 60) ids.push("shift_early_bird");
  if (minutesOfDay < 7 * 60) ids.push("shift_dawn_patrol");
  if (dayOfWeek === 0 || dayOfWeek === 6) ids.push("shift_weekend_warrior");
  return ids;
}

/**
 * Achievements earned by CLOSING a shift:
 *   shift_marathon  — single shift lasted 8+ hours (480 minutes)
 *   shift_night_owl — shift ended at/after 23:00 МСК or before 05:00 МСК
 */
export function evaluateClockOutAchievements(input: { clockInIso: string; clockOutIso: string }): string[] {
  const ids: string[] = [];
  const started = Date.parse(input.clockInIso);
  const ended = Date.parse(input.clockOutIso);
  if (Number.isFinite(started) && Number.isFinite(ended)) {
    const durationMinutes = Math.round((ended - started) / 60_000);
    if (durationMinutes >= 480) ids.push("shift_marathon");
  }
  const { hour } = mskPartsFromIso(input.clockOutIso);
  if (hour >= 23 || hour < 5) ids.push("shift_night_owl");
  return ids;
}
