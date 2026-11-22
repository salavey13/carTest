import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

// ─────────────────────────────────────────────────────────────────────────────
// iter24 — /shift command upgrade:
//   1. /shift replies with ONE message: live crew roster (who's on shift /
//      riding / off, with durations) + contextual action buttons
//   2. every status change notifies the crew owner + crew admins/co-owners
//      (dedup'd, actor excluded) with a compact "on shift now" line
//   3. new shift achievements (МСК rules, pure evaluation):
//      shift_early_bird (<10:00), shift_dawn_patrol (<07:00),
//      shift_weekend_warrior (Sat/Sun), shift_marathon (single shift ≥ 8h),
//      shift_night_owl (closed 23:00–05:00 МСК)
//   4. positivity mindset — uplifting copy in every roster footer :)
// ─────────────────────────────────────────────────────────────────────────────

import {
  SHIFT_POSITIVE_LINES,
  buildShiftReplyButtons,
  escapeHtmlTg,
  evaluateClockInAchievements,
  evaluateClockOutAchievements,
  formatCrewShiftOnShiftLine,
  formatCrewShiftStatusMessage,
  formatMskClock,
  mskPartsFromIso,
  pickPositiveShiftLine,
  pluralRu,
  resolveEffectiveShiftStatus,
  shiftDurationLabel,
  shiftMemberDisplayName,
  shiftRoleBadge,
  type CrewShiftStatusEntry,
} from "@/app/franchize/lib/shift-crew-status";

const read = (p: string) => readFileSync(p, "utf8");

// ── 1. MSK wall-clock helpers ───────────────────────────────────────────────

describe("iter24 · mskPartsFromIso / formatMskClock (UTC → МСК)", () => {
  it("shifts UTC by +3h", () => {
    const p = mskPartsFromIso("2026-08-31T06:30:00.000Z"); // 09:30 МСК
    expect(p.hour).toBe(9);
    expect(p.minute).toBe(30);
  });

  it("rolls to the next MSK calendar day across midnight", () => {
    // 21:00 UTC Aug 30 → 00:00 МСК Monday Aug 31
    const p = mskPartsFromIso("2026-08-30T21:00:00.000Z");
    expect(p.hour).toBe(0);
    expect(p.minute).toBe(0);
    expect(p.dayOfWeek).toBe(1); // Monday
  });

  it("knows MSK weekdays (Saturday / Sunday)", () => {
    expect(mskPartsFromIso("2026-08-29T11:00:00.000Z").dayOfWeek).toBe(6); // 14:00 МСК Sat
    expect(mskPartsFromIso("2026-08-30T11:00:00.000Z").dayOfWeek).toBe(0); // 14:00 МСК Sun
    expect(mskPartsFromIso("2026-08-31T11:00:00.000Z").dayOfWeek).toBe(1); // 14:00 МСК Mon
  });

  it("dayOfYear is stable within one МСК day (positive-line seed)", () => {
    const a = mskPartsFromIso("2026-08-30T10:00:00.000Z");
    const b = mskPartsFromIso("2026-08-30T20:59:59.000Z");
    expect(a.dayOfYear).toBe(b.dayOfYear);
  });

  it("formatMskClock renders zero-padded МСК time", () => {
    expect(formatMskClock("2026-08-31T06:30:00.000Z")).toBe("09:30 МСК");
    expect(formatMskClock("2026-08-30T21:00:00.000Z")).toBe("00:00 МСК");
  });
});

// ── 2. Russian pluralization + duration labels ──────────────────────────────

describe("iter24 · pluralRu / shiftDurationLabel", () => {
  it("Russian plural forms: one / few / many", () => {
    expect(pluralRu(1, "%d минуту", "%d минуты", "%d минут")).toBe("1 минуту");
    expect(pluralRu(2, "%d минуту", "%d минуты", "%d минут")).toBe("2 минуты");
    expect(pluralRu(5, "%d минуту", "%d минуты", "%d минут")).toBe("5 минут");
    expect(pluralRu(21, "%d минуту", "%d минуты", "%d минут")).toBe("21 минуту");
    expect(pluralRu(22, "%d минуту", "%d минуты", "%d минут")).toBe("22 минуты");
    expect(pluralRu(11, "%d минуту", "%d минуты", "%d минут")).toBe("11 минут");
    expect(pluralRu(1, "%d час", "%d часа", "%d часов")).toBe("1 час");
    expect(pluralRu(2, "%d час", "%d часа", "%d часов")).toBe("2 часа");
    expect(pluralRu(5, "%d час", "%d часа", "%d часов")).toBe("5 часов");
  });

  it("duration labels: just now / minutes / hours+minutes", () => {
    const now = Date.parse("2026-08-31T12:00:00.000Z");
    const started = (minAgo: number) => new Date(now - minAgo * 60_000).toISOString();
    expect(shiftDurationLabel(started(0.2), now)).toBe("только что");
    expect(shiftDurationLabel(started(45), now)).toBe("45 минут");
    expect(shiftDurationLabel(started(61), now)).toBe("1 час 1 минута");
    expect(shiftDurationLabel(started(120), now)).toBe("2 часа");
    expect(shiftDurationLabel(started(125), now)).toBe("2 часа 5 минут");
    expect(shiftDurationLabel(started(300), now)).toBe("5 часов");
  });
});

// ── 3. Clock-in achievements (early bird / dawn patrol / weekend warrior) ────

describe("iter24 · evaluateClockInAchievements", () => {
  it("shift_first is always granted", () => {
    expect(evaluateClockInAchievements("2026-08-31T11:00:00.000Z")).toEqual(["shift_first"]);
  });

  it("early bird: before 10:00 МСК yes, 10:00:00 exactly no", () => {
    expect(evaluateClockInAchievements("2026-08-31T06:59:59.000Z")).toContain("shift_early_bird"); // 09:59:59 МСК
    expect(evaluateClockInAchievements("2026-08-31T07:00:00.000Z")).not.toContain("shift_early_bird"); // 10:00:00 МСК
  });

  it("dawn patrol: before 07:00 МСК (implies early bird)", () => {
    const ids = evaluateClockInAchievements("2026-08-31T03:59:00.000Z"); // 06:59 МСК
    expect(ids).toContain("shift_dawn_patrol");
    expect(ids).toContain("shift_early_bird");
    expect(evaluateClockInAchievements("2026-08-31T04:00:00.000Z")).not.toContain("shift_dawn_patrol"); // 07:00 МСК
  });

  it("weekend warrior: Sat/Sun in the МСК calendar only", () => {
    expect(evaluateClockInAchievements("2026-08-29T11:00:00.000Z")).toContain("shift_weekend_warrior"); // Sat 14:00 МСК
    expect(evaluateClockInAchievements("2026-08-30T11:00:00.000Z")).toContain("shift_weekend_warrior"); // Sun 14:00 МСК
    expect(evaluateClockInAchievements("2026-08-31T11:00:00.000Z")).not.toContain("shift_weekend_warrior"); // Mon
  });

  it("late-Saturday UTC clock-in lands on MSK Sunday → weekend + night stack", () => {
    // 2026-08-29T21:30Z = 00:30 МСК Sunday Aug 30 → all four clock-in badges
    const ids = evaluateClockInAchievements("2026-08-29T21:30:00.000Z");
    expect(ids).toEqual([
      "shift_first",
      "shift_early_bird",
      "shift_dawn_patrol",
      "shift_weekend_warrior",
    ]);
  });
});

// ── 4. Clock-out achievements (marathon / night owl) ────────────────────────

describe("iter24 · evaluateClockOutAchievements", () => {
  it("marathon at exactly 8h, not at 7h59m", () => {
    expect(evaluateClockOutAchievements({ clockInIso: "2026-08-31T08:00:00Z", clockOutIso: "2026-08-31T16:00:00Z" })).toContain("shift_marathon");
    expect(evaluateClockOutAchievements({ clockInIso: "2026-08-31T08:00:00Z", clockOutIso: "2026-08-31T15:59:00Z" })).not.toContain("shift_marathon");
  });

  it("night owl when closing after 23:00 МСК or before 05:00 МСК", () => {
    expect(evaluateClockOutAchievements({ clockInIso: "2026-08-31T10:00:00Z", clockOutIso: "2026-08-31T20:30:00Z" })).toContain("shift_night_owl"); // 23:30 МСК
    expect(evaluateClockOutAchievements({ clockInIso: "2026-08-31T10:00:00Z", clockOutIso: "2026-08-31T19:59:00Z" })).not.toContain("shift_night_owl"); // 22:59 МСК
    expect(evaluateClockOutAchievements({ clockInIso: "2026-08-31T18:00:00Z", clockOutIso: "2026-09-01T01:00:00Z" })).toContain("shift_night_owl"); // 04:00 МСК
  });

  it("marathon + night owl can stack on one heroic shift", () => {
    const ids = evaluateClockOutAchievements({ clockInIso: "2026-08-31T09:00:00Z", clockOutIso: "2026-09-01T00:30:00Z" }); // 15.5h, ends 03:30 МСК
    expect(ids).toEqual(["shift_marathon", "shift_night_owl"]);
  });

  it("a plain daytime shift earns nothing", () => {
    expect(evaluateClockOutAchievements({ clockInIso: "2026-08-31T07:00:00Z", clockOutIso: "2026-08-31T14:00:00Z" })).toEqual([]); // 12:00–19:00 МСК, 7h
  });
});

// ── 5. Roster rendering ──────────────────────────────────────────────────────

const NOW = Date.parse("2026-08-31T12:00:00.000Z");
const ago = (min: number) => new Date(NOW - min * 60_000).toISOString();

// Modeled on the LIVE vip-bike roster (Paul online w/ shift, Илья owner riding,
// Goollil/ORUDJOV offline) — see worklog iter24 investigation.
const liveLikeEntries: CrewShiftStatusEntry[] = [
  { userId: "413553377", username: "salavey13", fullName: "Paul", role: "admin", liveStatus: "online", activeShiftStartedAt: ago(125) },
  { userId: "356282674", username: "I_O_S_NN", fullName: "Илья I.O.S.", role: "owner", liveStatus: "riding", activeShiftStartedAt: ago(40) },
  { userId: "687580818", username: "Goollil", fullName: "🌊Георгий", role: "co_owner", liveStatus: "offline", activeShiftStartedAt: null },
  { userId: "7813830016", username: "DJORUDJOV", fullName: "ORUDJOV", role: "member", liveStatus: "offline", activeShiftStartedAt: null },
];

describe("iter24 · formatCrewShiftStatusMessage (the /shift roster)", () => {
  it("renders header, riding before online, durations, badges, viewer marker, offline list, positive footer", () => {
    const msg = formatCrewShiftStatusMessage({
      crewName: "VIP_BIKE",
      viewerUserId: "413553377",
      entries: liveLikeEntries,
      nowMs: NOW,
    });
    expect(msg).toContain("🏍️ Экипаж «VIP_BIKE» — статусы смен");

    // riding member sorts BEFORE plain online ones (badge sits right after the name)
    const ridingIdx = msg.indexOf("🏍️ Илья I.O.S. 👑 · @I_O_S_NN — на байке · 40 минут");
    const onlineIdx = msg.indexOf("🟢 Paul ⭐ · @salavey13 — на смене · 2 часа 5 минут (это вы)");
    expect(ridingIdx).toBeGreaterThan(-1);
    expect(onlineIdx).toBeGreaterThan(ridingIdx);

    expect(msg).toContain("😴 Не на смене: 🌊Георгий, ORUDJOV");

    // positivity mindset is a must — the footer always comes from the pool
    const lastLine = msg.trimEnd().split("\n").pop()!.trim();
    expect(SHIFT_POSITIVE_LINES).toContain(lastLine);
  });

  it("empty crew picture: nobody on shift gets a friendly line, not silence", () => {
    const msg = formatCrewShiftStatusMessage({
      crewName: "VIP_BIKE",
      viewerUserId: "413553377",
      entries: [{ userId: "413553377", username: "salavey13", fullName: "Paul", role: "member", liveStatus: "offline", activeShiftStartedAt: null }],
      nowMs: NOW,
    });
    expect(msg).toContain("😴 Сейчас никто не на смене — экипаж отдыхает.");
    expect(msg).toContain("Paul (это вы)"); // viewer marked in the offline list
  });

  it("escapes HTML in names (bot sends parse_mode: HTML)", () => {
    const msg = formatCrewShiftStatusMessage({
      crewName: "VIP <BIKE> & Co",
      viewerUserId: "1",
      entries: [
        { userId: "1", username: "x_<b>", fullName: "Иван<b>&", role: "member", liveStatus: "online", activeShiftStartedAt: ago(30) },
      ],
      nowMs: NOW,
    });
    expect(msg).toContain("Иван&lt;b&gt;&amp;");
    expect(msg).toContain("@x_&lt;b&gt;");
    expect(msg).toContain("«VIP &lt;BIKE&gt; &amp; Co»");
    expect(msg).not.toContain("Иван<b>");
  });

  it("caps long rosters instead of overflowing the message", () => {
    const entries: CrewShiftStatusEntry[] = Array.from({ length: 14 }, (_, i) => ({
      userId: String(100 + i),
      username: `rider${i}`,
      fullName: `Райдер ${i}`,
      role: "member",
      liveStatus: i % 2 === 0 ? "online" : "riding",
      activeShiftStartedAt: ago(10 * (i + 1)),
    }));
    const msg = formatCrewShiftStatusMessage({ crewName: "BIG", viewerUserId: "1", entries, nowMs: NOW });
    expect(msg).toContain("… и ещё 2 на смене");
    // list = 7 riding (longest first) + 5 longest online; the two SHORTEST
    // online shifts get cut (rider0 @10 мин, rider2 @30 мин)
    expect(msg).not.toContain("Райдер 0 · @rider0 —");
    expect(msg).not.toContain("Райдер 2 · @rider2 —");
    expect(msg).toContain("Райдер 13 · @rider13 — на байке · 2 часа 20 минут"); // longest riding stays
    expect(msg).toContain("Райдер 1 · @rider1 — на байке · 20 минут");
  });

  it("zombie presence (online without a shift row) shows as offline — truth rule", () => {
    expect(
      formatCrewShiftStatusMessage({
        crewName: "X",
        viewerUserId: "1",
        entries: [{ userId: "1", username: "u1", fullName: "Зомби", role: "member", liveStatus: "online", activeShiftStartedAt: null }],
        nowMs: NOW,
      }),
    ).toContain("Сейчас никто не на смене");
  });
});

describe("iter24 · formatCrewShiftOnShiftLine (admin notice one-liner)", () => {
  it("counts and names everyone effectively on shift", () => {
    expect(formatCrewShiftOnShiftLine(liveLikeEntries)).toBe("Сейчас на смене (2): Paul, Илья I.O.S.");
  });

  it("friendly line when nobody is on shift", () => {
    expect(formatCrewShiftOnShiftLine(liveLikeEntries.slice(2))).toBe("Сейчас на смене никого — экипаж отдыхает 😴");
  });
});

describe("iter24 · roster building blocks", () => {
  it("resolveEffectiveShiftStatus: truth rule + riding override", () => {
    expect(resolveEffectiveShiftStatus({ liveStatus: "online", activeShiftStartedAt: ago(5) })).toBe("online");
    expect(resolveEffectiveShiftStatus({ liveStatus: "riding", activeShiftStartedAt: ago(5) })).toBe("riding");
    expect(resolveEffectiveShiftStatus({ liveStatus: "online", activeShiftStartedAt: null })).toBe("offline"); // zombie
    expect(resolveEffectiveShiftStatus({ liveStatus: "offline", activeShiftStartedAt: ago(5) })).toBe("online"); // reverse drift still on shift
  });

  it("shiftMemberDisplayName: full name → @username → participant fallback", () => {
    expect(shiftMemberDisplayName({ userId: "1", fullName: "Paul", username: "p" })).toBe("Paul");
    expect(shiftMemberDisplayName({ userId: "1", fullName: "", username: "@p" })).toBe("@p");
    expect(shiftMemberDisplayName({ userId: "12345678", fullName: null, username: null })).toBe("Участник #5678");
  });

  it("role badges: 👑 owner, ⭐ admin/co_owner, nothing for members", () => {
    expect(shiftRoleBadge({ role: "owner" })).toBe(" 👑");
    expect(shiftRoleBadge({ role: "admin" })).toBe(" ⭐");
    expect(shiftRoleBadge({ role: "co_owner" })).toBe(" ⭐");
    expect(shiftRoleBadge({ role: "member" })).toBe("");
  });

  it("positive lines pool is non-empty, emoji-flavoured, and picked deterministically", () => {
    expect(SHIFT_POSITIVE_LINES.length).toBeGreaterThanOrEqual(5);
    for (const line of SHIFT_POSITIVE_LINES) expect(line).toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
    expect(pickPositiveShiftLine(3)).toBe(SHIFT_POSITIVE_LINES[3]);
    expect(pickPositiveShiftLine(3 + SHIFT_POSITIVE_LINES.length)).toBe(SHIFT_POSITIVE_LINES[3]);
    expect(pickPositiveShiftLine(-3)).toBe(SHIFT_POSITIVE_LINES[3]); // negative seeds stay in range (abs)
  });

  it("escapeHtmlTg covers the HTML trio", () => {
    expect(escapeHtmlTg("a<b>&c")).toBe("a&lt;b&gt;&amp;c");
    expect(escapeHtmlTg("")).toBe("");
  });
});

describe("iter24 · buildShiftReplyButtons (button texts are contract-bound)", () => {
  it("no shift → start button", () => {
    expect(buildShiftReplyButtons(false, "offline")).toEqual([[{ text: "✅ Начать Смену" }]]);
  });

  it("on shift + online → ride / close", () => {
    expect(buildShiftReplyButtons(true, "online")).toEqual([
      [{ text: "🏍️ На Байке" }],
      [{ text: "❌ Завершить Смену" }],
    ]);
  });

  it("on shift + riding → box / close", () => {
    expect(buildShiftReplyButtons(true, "riding")).toEqual([
      [{ text: "🏢 В Боксе" }],
      [{ text: "❌ Завершить Смену" }],
    ]);
  });

  it("missing presence defaults to the ride/close branch", () => {
    expect(buildShiftReplyButtons(true, null)).toEqual([
      [{ text: "🏍️ На Байке" }],
      [{ text: "❌ Завершить Смену" }],
    ]);
  });
});

// ── 6. Source guards (wiring) ────────────────────────────────────────────────

describe("iter24 · source guards — /shift wiring", () => {
  const shiftSrc = read("app/webhook-handlers/commands/shift.ts");
  const catalogSrc = read("app/franchize/profile-actions.ts");
  const handlerSrc = read("app/webhook-handlers/commands/command-handler.ts");

  it("/shift (no action) sends roster + buttons in ONE HTML message", () => {
    expect(shiftSrc).toContain("loadCrewShiftSnapshot(crew_id)");
    expect(shiftSrc).toMatch(/formatCrewShiftStatusMessage\(\{ crewName, viewerUserId: userId, entries \}\)/);
    expect(shiftSrc).toMatch(/buildShiftReplyButtons\(hasActiveShift, actorEntry\?\.liveStatus/);
    expect(shiftSrc).toContain(`{ keyboardType: 'reply', parseMode: "HTML" }`);
  });

  it("status changes notify owner + admins/co-owners, actor excluded", () => {
    expect(shiftSrc).toContain("notifyCrewStatusChange");
    expect(shiftSrc).toContain(`.in("role", ["owner", "admin", "co_owner"])`);
    expect(shiftSrc).toContain("recipients.delete(String(params.actorId))");
    expect(shiftSrc).toMatch(/notice: ownerMessage,\s*\n\s*entries: freshEntries/);
  });

  it("post-action replies keep the flow alive: roster + buttons, no dead ends", () => {
    // the success path re-sends contextual buttons (never removes the keyboard)
    expect(shiftSrc).not.toContain("removeKeyboard");
    expect(shiftSrc).toMatch(/`\$\{userMessage\}\\n\\n\$\{roster\}`/);
    expect(shiftSrc).toContain("👌 Статус уже актуален — всё в порядке!");
  });

  it("clock-in achievements come from the pure evaluator (incl. early bird)", () => {
    expect(shiftSrc).toMatch(/for \(const achievementId of evaluateClockInAchievements\(clockInIso\)\)/);
    expect(shiftSrc).toContain('context: { action: "clock_in", mskClock: formatMskClock(clockInIso) }');
  });

  it("clock-out passes the exact closed-shift times to the achievement helper", () => {
    expect(shiftSrc).toContain("closedShift = { clockInIso: String(shiftData.clock_in_time), clockOutIso }");
    expect(shiftSrc).toMatch(/grantShiftAchievements\(userId, crew_id, crew\.slug \|\| "vip-bike", closedShift\)/);
    expect(shiftSrc).toMatch(/for \(const id of evaluateClockOutAchievements\(closedShift\)\)/);
  });

  it("snapshot loader reads the three sources with the right filters", () => {
    expect(shiftSrc).toContain(`.select("user_id, role, live_status")`);
    expect(shiftSrc).toContain(`.select("member_id, clock_in_time")`);
    expect(shiftSrc).toContain(`.is("clock_out_time", null)`);
    expect(shiftSrc).toContain(`.in("user_id", ids)`);
    expect(shiftSrc).toContain(`.select("user_id, username, full_name")`);
  });

  it("all 5 new achievements exist in the catalog with /shift trigger source", () => {
    for (const id of ["shift_early_bird", "shift_dawn_patrol", "shift_weekend_warrior", "shift_marathon", "shift_night_owl"]) {
      expect(catalogSrc).toContain(`id: "${id}"`);
    }
    const earlyBirdBlock = catalogSrc.slice(catalogSrc.indexOf('id: "shift_early_bird"'), catalogSrc.indexOf('id: "shift_dawn_patrol"'));
    expect(earlyBirdBlock).toContain("10:00");
    expect(earlyBirdBlock).toContain('triggerSources: ["telegram:/shift"]');
  });

  it("command-handler still routes the exact button texts (contract)", () => {
    expect(handlerSrc).toContain(`"✅ Начать Смену": "clock_in", "❌ Завершить Смену": "clock_out"`);
    expect(handlerSrc).toContain(`"🏍️ На Байке": "toggle_ride", "🏢 В Боксе": "toggle_ride"`);
  });
});
