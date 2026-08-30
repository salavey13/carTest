"use server";

import { logger } from "@/lib/logger";
import { supabaseAdmin } from "@/lib/supabase-server";
import { sendComplexMessage } from "../actions/sendComplexMessage";
import { grantFranchizeAchievementAction } from "@/app/franchize/profile-actions";
import {
    buildShiftReplyButtons,
    escapeHtmlTg,
    evaluateClockInAchievements,
    evaluateClockOutAchievements,
    formatCrewShiftOnShiftLine,
    formatCrewShiftStatusMessage,
    formatMskClock,
    type CrewShiftStatusEntry,
} from "@/app/franchize/lib/shift-crew-status";

export async function shiftCommand(chatId: number, userId: string, username?: string, action?: string) {
    logger.info(`[Shift Command EXEC] User ${userId}, Action: ${action || 'request_keyboard'}`);

    try {
        // Use supabaseAdmin (service role) — this is a server-side webhook handler.
        // supabaseAnon was used before, but RLS blocks anon writes to crew_members
        // and crew_member_shifts, causing silent failures (shift not created, live_status not updated).
        // Use .limit(1) instead of .single() — users can be active members of multiple crews.
        const { data: crewMembers, error: crewError } = await supabaseAdmin
            .from("crew_members")
            .select("crew_id, live_status, crews(owner_id, name, slug)")
            .eq("user_id", userId)
            .eq("membership_status", "active")
            .order("joined_at", { ascending: false })
            .limit(1);
        const crewMember = crewMembers?.[0] ?? null;

        if (crewError || !crewMember) {
            await sendComplexMessage(chatId, "Вы не являетесь активным участником экипажа.");
            return;
        }

        const { crew_id } = crewMember;
        // Nested one-to-one join: the untyped supabase client types `crews(...)`
        // as an array, but at runtime a crew_members → crews FK join returns a
        // single object — cast to keep the destructuring below type-safe.
        const crew = crewMember.crews as unknown as { owner_id: string | null; name: string; slug?: string | null } | null;
        if (!crew) throw new Error(`Критическая ошибка: отсутствуют данные экипажа для участника ${userId}`);

        const { owner_id: ownerId, name: crewName } = crew;
        const displayName = username || 'user';

        // ── Crew shift snapshot (iter24) ──────────────────────────────────────
        // One batched read that powers BOTH the roster message and the
        // hasActiveShift check (single source of truth — see below).
        const entries = await loadCrewShiftSnapshot(crew_id);
        const actorEntry = entries.find((e) => e.userId === String(userId)) ?? null;

        // The original code read live_status straight from the crew_members row
        // fetched above; the snapshot entry carries the same value (same table,
        // same read batch) — isPresenceActive centralizes the "presence is not
        // offline" check the clock_out / toggle_ride cases rely on.
        const isPresenceActive = (actorEntry?.liveStatus ?? "offline") !== "offline";

        // ── Single source of truth for "active shift" ───────────────────────────
        // The web page (FranchizeCrewShiftsClient + GET /api/crew/shifts) considers
        // a shift ACTIVE only if a row exists in crew_member_shifts with
        // clock_out_time IS NULL. live_status in crew_members is a secondary
        // "instant presence" field and can drift out of sync (e.g. when a shift
        // was closed manually in the DB or via an admin script). To keep the bot
        // and the web page in tandem, we must base the keyboard on the SAME rule.
        const hasActiveShift = !!actorEntry?.activeShiftStartedAt;

        if (!action) {
            // iter24: /shift replies with ONE message — the live crew roster
            // (who's on shift / riding / off, with durations) + the action
            // buttons, so the caller instantly sees the whole crew's picture.
            const buttons = buildShiftReplyButtons(hasActiveShift, actorEntry?.liveStatus ?? null);
            const roster = formatCrewShiftStatusMessage({ crewName, viewerUserId: userId, entries });
            await sendComplexMessage(chatId, roster, buttons, { keyboardType: 'reply', parseMode: "HTML" });
            return;
        }

        let updateData: any = {};
        let userMessage = "";
        let ownerMessage = "";
        // PostgrestFilterBuilder (insert) and Promise alike are assignable to any.
        let shiftLogAction: (() => any) | null = null;
        // 2026-08-19 review: populated inside shiftLogAction for clock_out so
        // the user-facing message can include the earned amount per shift.
        let shiftEarnedAmount = 0;
        let shiftEarnedHours = 0;
        let shiftEarnedRate = 0;
        // Flag: set during clock_out case, used AFTER shiftLogAction() runs
        // to construct the user/owner messages with the earned amount.
        let needClockOutMessage = false;
        // iter24: the closed shift's exact timestamps, populated inside
        // shiftLogAction — used for the per-shift achievements (marathon /
        // night owl) so they evaluate the exact times written to the DB.
        let closedShift: { clockInIso: string; clockOutIso: string } | null = null;
        // iter24: how the actor's roster entry must look AFTER the change
        // (patched locally — no refetch needed).
        let actorPatch: Partial<CrewShiftStatusEntry> | null = null;

        switch (action) {
            case 'clock_in':
                // Allow start only when there is no active shift row. Relying on
                // live_status alone would let a user "start" while an orphaned
                // active row exists (double shift) — the API page guard does the same.
                if (!hasActiveShift) {
                    const clockInIso = new Date().toISOString();
                    updateData = { live_status: 'online' };
                    actorPatch = { liveStatus: 'online', activeShiftStartedAt: clockInIso };
                    userMessage = "✅ Смена начата. Время пошло — отличной работы! 💪";
                    ownerMessage = `🟢 @${escapeHtmlTg(displayName)} начал смену в экипаже «${escapeHtmlTg(crewName)}» (${formatMskClock(clockInIso)}).`;
                    // NOTE timezone: clock_in_time is stored in UTC (ISO-8601, +00:00).
                    // Moscow is UTC+3: 09:00 UTC == 12:00 MSK. All consumers
                    // (page client, API, salary trigger) treat it as UTC and render
                    // in the browser's local timezone — do NOT pass local time here.
                    shiftLogAction = () => supabaseAdmin.from('crew_member_shifts').insert({
                        member_id: userId,
                        crew_id: crew_id,
                        clock_in_time: clockInIso,
                        hourly_rate: 169,
                    });
                    // iter24: clock-in achievements — first shift (classic) +
                    // early bird (<10:00 МСК), dawn patrol (<07:00 МСК),
                    // weekend warrior (clock-in on Sat/Sun, МСК calendar).
                    // All fire-and-forget; already-unlocked badges no-op server-side.
                    for (const achievementId of evaluateClockInAchievements(clockInIso)) {
                        grantFranchizeAchievementAction({
                            slug: crew.slug || "vip-bike",
                            userId,
                            achievementId,
                            source: "telegram:/shift",
                            context: { action: "clock_in", mskClock: formatMskClock(clockInIso) },
                            incrementCounters: { shiftsStarted: 1 },
                        }).catch((err) => logger.warn(`[Shift Achievement] Failed to grant ${achievementId} to ${userId}:`, err));
                    }
                }
                break;
            case 'clock_out':
                // Always try to close the shift, regardless of live_status
                shiftLogAction = async () => {
                    const { data: latestShift } = await supabaseAdmin.from('crew_member_shifts')
                        .select('id')
                        .eq('member_id', userId)
                        .eq('crew_id', crew_id)
                        .is('clock_out_time', null)
                        .order('clock_in_time', { ascending: false })
                        .limit(1)
                        .maybeSingle();
                    if (latestShift) {
                        // Calculate duration and salary
                        // NOTE timezone: clock_out_time is UTC. Duration is computed
                        // from clock_in_time → clock_out_time in UTC, then displayed
                        // in MSK (UTC+3). 18:00 UTC == 21:00 MSK.
                        const { data: shiftData } = await supabaseAdmin.from('crew_member_shifts')
                            .select('clock_in_time, hourly_rate')
                            .eq('id', latestShift.id)
                            .single();
                        if (shiftData) {
                            const clockIn = new Date(shiftData.clock_in_time).getTime();
                            const clockOut = Date.now();
                            const clockOutIso = new Date(clockOut).toISOString();
                            const durationMinutes = Math.round((clockOut - clockIn) / 60000);
                            const rate = shiftData.hourly_rate || 169;
                            const salaryAmount = (durationMinutes / 60) * rate;
                            // 2026-08-19 review: stash the earned amount + duration
                            // so we can include it in the user-facing message.
                            shiftEarnedAmount = Math.round(salaryAmount);
                            shiftEarnedHours = Math.round((durationMinutes / 60) * 10) / 10;
                            shiftEarnedRate = rate;
                            // iter24: exact times for the per-shift achievements
                            // (marathon ≥ 8h, night owl — closed 23:00–05:00 МСК).
                            closedShift = { clockInIso: String(shiftData.clock_in_time), clockOutIso };

                            // BUG FIX (2026-08-24): duration_minutes is a GENERATED
                            // column — PostgREST silently rejects any UPDATE that
                            // tries to write to it. The previous code included
                            // duration_minutes + salary_amount in the UPDATE payload,
                            // which caused the ENTIRE UPDATE to fail (including
                            // clock_out_time). Result: shift stayed open even though
                            // the bot said "Смена завершена".
                            //
                            // Fix: only write clock_out_time + salary_amount (which
                            // IS a regular column). duration_minutes is auto-computed
                            // by the database (generated column = EXTRACT(EPOCH FROM
                            // (clock_out_time - clock_in_time)) / 60).
                            return supabaseAdmin.from('crew_member_shifts').update({
                                clock_out_time: clockOutIso,
                                salary_amount: Math.round(salaryAmount * 100) / 100,
                            }).eq('id', latestShift.id);
                        }
                    }
                    // No active shift found — return a no-op (don't crash)
                    return { data: null, error: null };
                };
            // Closing is allowed when there is an active shift row OR live_status is
            // not offline. Two drift scenarios both converge on offline:
            //   1) live_status online but no row (zombie) → just flip presence.
            //   2) row exists but live_status offline (reverse drift) → close row.
            if (hasActiveShift || isPresenceActive) {
                actorPatch = { liveStatus: 'offline', activeShiftStartedAt: null };
                if (isPresenceActive) {
                    updateData = { live_status: 'offline', last_location: null };
                    // 2026-08-19 review: DON'T construct userMessage here —
                    // shiftEarnedAmount is still 0 because shiftLogAction()
                    // hasn't run yet. Set a flag and construct the message
                    // AFTER shiftLogAction() completes (where shiftEarnedAmount
                    // gets populated).
                    needClockOutMessage = true;
                } else {
                    userMessage = "✅ Остаточная смена закрыта.\nСмена в базе данных была завершена.";
                    ownerMessage = `🔧 @${escapeHtmlTg(displayName)}: закрыл остаточную смену в «${escapeHtmlTg(crewName)}».`;
                }
            }
            break;
            case 'toggle_ride':
                if (isPresenceActive) {
                    const currentStatus = actorEntry?.liveStatus;
                    const newStatus = currentStatus === 'online' ? 'riding' : 'online';
                    updateData = { live_status: newStatus };
                    actorPatch = { liveStatus: newStatus };
                    if (newStatus === 'riding') {
                        userMessage = "🏍️ Статус: На Байке. Теперь отправьте свою геолокацию, чтобы появиться на карте экипажа.";
                    } else {
                        updateData.last_location = null;
                        userMessage = "🏢 Статус: Онлайн. Снова в боксе, с карты убраны.";
                    }
                    ownerMessage = `⚙️ Статус @${escapeHtmlTg(displayName)} в «${escapeHtmlTg(crewName)}»: ${newStatus === 'riding' ? "На Байке" : "Онлайн"}`;
                }
                break;
        }

        if (Object.keys(updateData).length > 0 || shiftLogAction) {
            // Use supabaseAdmin for writes — RLS blocks anon writes
            if (Object.keys(updateData).length > 0) {
                await supabaseAdmin.from("crew_members").update(updateData).eq("user_id", userId).eq("crew_id", crew_id).eq("membership_status", "active");
            }
            if (shiftLogAction) await shiftLogAction();

            // 2026-08-19 review: construct clock_out message AFTER shiftLogAction()
            // runs — that's when shiftEarnedAmount/Hours/Rate are populated.
            // Previously the message was built in the switch case BEFORE
            // shiftLogAction ran, so shiftEarnedAmount was always 0 and the
            // money line was never shown.
            if (needClockOutMessage) {
                const moneyLine = shiftEarnedAmount > 0
                  ? `\n💰 Заработано: ${shiftEarnedAmount.toLocaleString("ru-RU")} ₽ (${shiftEarnedHours} ч × ${shiftEarnedRate} ₽/ч)\n`
                  : "\n";
                userMessage = `✅ Смена завершена.${moneyLine}\nХорошего отдыха — ты это заслужил! 🌟`;
                ownerMessage = `🔴 @${escapeHtmlTg(displayName)} завершил смену в экипаже «${escapeHtmlTg(crewName)}»${shiftEarnedAmount > 0 ? ` (заработал ${shiftEarnedAmount.toLocaleString("ru-RU")} ₽)` : ""}.`;

                // ── Achievement grants after successful shift completion ─────────
                // Grant shift-related achievements based on totals + this shift
                await grantShiftAchievements(userId, crew_id, crew.slug || "vip-bike", closedShift);
            }

            // iter24: a no-op clock_out (nothing to close, presence already
            // offline) used to leave the user WITHOUT any reply. Give them a
            // friendly "already up to date" + the current picture instead.
            if (!userMessage) {
                userMessage = "👌 Статус уже актуален — всё в порядке!";
            }

            // iter24: patch the actor's roster entry locally (no refetch) and
            // reply with the confirmation + fresh roster + contextual buttons,
            // so the flow can continue without retyping /shift.
            const freshEntries = actorPatch
                ? entries.map((e) => (e.userId === String(userId) ? { ...e, ...actorPatch! } : e))
                : entries;
            const freshActor = freshEntries.find((e) => e.userId === String(userId)) ?? null;
            const buttons = buildShiftReplyButtons(!!freshActor?.activeShiftStartedAt, freshActor?.liveStatus ?? null);
            const roster = formatCrewShiftStatusMessage({ crewName, viewerUserId: userId, entries: freshEntries });

            // Send messages as HTML (no MarkdownV2 — avoids escaping bugs;
            // all dynamic parts are escaped by the shift-crew-status lib)
            if (userMessage) {
                await sendComplexMessage(chatId, `${userMessage}\n\n${roster}`, buttons, { keyboardType: 'reply', parseMode: "HTML" });
            }

            // iter24: status-change notice → crew owner + crew admins/co-owners
            // (dedup; the actor is never notified about their own change).
            if (ownerMessage) {
                await notifyCrewStatusChange({
                    ownerId,
                    crewId: crew_id,
                    actorId: userId,
                    notice: ownerMessage,
                    entries: freshEntries,
                });
            }
        } else {
            // Nothing to do (e.g. double clock-in attempt): show the current
            // picture + the RIGHT buttons instead of a dead-end message.
            const buttons = buildShiftReplyButtons(hasActiveShift, actorEntry?.liveStatus ?? null);
            const roster = formatCrewShiftStatusMessage({ crewName, viewerUserId: userId, entries });
            await sendComplexMessage(
                chatId,
                `👌 Статус уже актуален — всё в порядке!\n\n${roster}`,
                buttons,
                { keyboardType: 'reply', parseMode: "HTML" },
            );
        }

    } catch (e: any) {
        logger.error(`[Shift Command FATAL] for user ${userId}:`, e);
        await sendComplexMessage(chatId, `🚨 Критическая ошибка в системе смен: ${e.message}`);
    }
}

// ── Crew shift snapshot (iter24) ─────────────────────────────────────────────
// One batched read used by every /shift reply: active members + their open
// shift rows + user profiles. Powers both the user-facing roster message and
// the compact on-shift line in the status-change notices.
async function loadCrewShiftSnapshot(crewId: string): Promise<CrewShiftStatusEntry[]> {
    const [membersRes, shiftsRes] = await Promise.all([
        supabaseAdmin
            .from("crew_members")
            .select("user_id, role, live_status")
            .eq("crew_id", crewId)
            .eq("membership_status", "active"),
        supabaseAdmin
            .from("crew_member_shifts")
            .select("member_id, clock_in_time")
            .eq("crew_id", crewId)
            .is("clock_out_time", null),
    ]);
    const members = (membersRes.data ?? []) as Array<{ user_id: string | number; role: string | null; live_status: string | null }>;
    const openShifts = (shiftsRes.data ?? []) as Array<{ member_id: string | number; clock_in_time: string }>;
    if (members.length === 0) return [];

    const ids = Array.from(new Set(members.map((m) => String(m.user_id))));
    const { data: users } = await supabaseAdmin
        .from("users")
        .select("user_id, username, full_name")
        .in("user_id", ids);
    const userById = new Map<string, { username?: string | null; full_name?: string | null }>();
    for (const u of (users ?? []) as Array<{ user_id: string | number; username?: string | null; full_name?: string | null }>) {
        userById.set(String(u.user_id), u);
    }
    const openShiftByMember = new Map<string, string>();
    for (const s of openShifts) {
        const key = String(s.member_id);
        // Multiple open rows per member shouldn't happen; keep the earliest
        // (longest shift) just in case — mirrors the web page's "latest open row" view.
        const existing = openShiftByMember.get(key);
        if (!existing || Date.parse(s.clock_in_time) < Date.parse(existing)) {
            openShiftByMember.set(key, s.clock_in_time);
        }
    }
    return members.map((m) => {
        const idStr = String(m.user_id);
        const u = userById.get(idStr);
        return {
            userId: idStr,
            username: u?.username ?? null,
            fullName: u?.full_name ?? null,
            role: m.role ?? null,
            liveStatus: m.live_status ?? null,
            activeShiftStartedAt: openShiftByMember.get(idStr) ?? null,
        };
    });
}

// ── Status-change notice to the crew owner + admins (iter24) ────────────────
// The user asked that EVERY crew-member status change notifies the owner AND
// the crew's admins. Recipients: crews.owner_id + active crew_members with
// role owner/admin/co_owner, dedup'd, actor excluded (they get their own
// reply). Never throws — a failed notice must not break the shift flow.
async function notifyCrewStatusChange(params: {
    ownerId: string | null;
    crewId: string;
    actorId: string;
    /** pre-escaped HTML status line (built in the switch above) */
    notice: string;
    /** fresh snapshot (actor already patched) for the compact on-shift line */
    entries: CrewShiftStatusEntry[];
}): Promise<void> {
    try {
        const recipients = new Set<string>();
        if (params.ownerId) recipients.add(String(params.ownerId));
        const { data: admins, error } = await supabaseAdmin
            .from("crew_members")
            .select("user_id")
            .eq("crew_id", params.crewId)
            .in("role", ["owner", "admin", "co_owner"])
            .eq("membership_status", "active");
        if (error) {
            logger.warn(`[Shift Command] admin list failed for crew ${params.crewId}: ${error.message}`);
        }
        for (const a of (admins ?? []) as Array<{ user_id: string | number }>) {
            recipients.add(String(a.user_id));
        }
        recipients.delete(String(params.actorId));
        if (recipients.size === 0) return;

        const text = `${params.notice}\n\n${formatCrewShiftOnShiftLine(params.entries)}`;
        for (const chatId of recipients) {
            await sendComplexMessage(chatId, text, [], { parseMode: "HTML" });
        }
    } catch (e) {
        logger.warn(`[Shift Command] status-change notice failed for crew ${params.crewId}:`, e);
    }
}

// ── Achievement Helper for Shift Activities ─────────────────────────────────
// Grants achievements based on shift totals after each clock-out, plus the
// iter24 per-shift badges: marathon (single shift ≥ 8h) and night owl
// (shift closed between 23:00 and 05:00 МСК).
async function grantShiftAchievements(
    userId: string,
    crewId: string,
    crewSlug: string,
    closedShift: { clockInIso: string; clockOutIso: string } | null,
) {
    try {
        // Fetch all completed shifts for this user in this crew
        const { data: shifts, error } = await supabaseAdmin
            .from("crew_member_shifts")
            .select("duration_minutes, salary_amount")
            .eq("member_id", userId)
            .eq("crew_id", crewId)
            .not("clock_out_time", "is", null);

        if (error || !shifts) {
            logger.warn(`[Shift Achievements] Could not fetch shifts for ${userId}:`, error?.message);
            return;
        }

        const totalShifts = shifts.length;
        const totalMinutes = shifts.reduce((sum, s) => sum + (s.duration_minutes || 0), 0);
        const totalHours = totalMinutes / 60;
        const totalEarnings = shifts.reduce((sum, s) => sum + (s.salary_amount || 0), 0);

        // Grant achievements based on thresholds
        const achievementsToGrant: Array<{ id: string; context?: Record<string, unknown> }> = [];

        if (totalShifts >= 1) achievementsToGrant.push({ id: "shift_first" });
        if (totalShifts >= 3) achievementsToGrant.push({ id: "shift_streak_3", context: { totalShifts } });
        if (totalShifts >= 7) achievementsToGrant.push({ id: "shift_week_7", context: { totalShifts } });
        if (totalShifts >= 30) achievementsToGrant.push({ id: "shift_month_30", context: { totalShifts } });

        if (totalHours >= 13) achievementsToGrant.push({ id: "shift_hours_13", context: { totalHours: Math.round(totalHours * 10) / 10 } });
        if (totalHours >= 69) achievementsToGrant.push({ id: "shift_hours_69", context: { totalHours: Math.round(totalHours * 10) / 10 } });
        if (totalHours >= 100) achievementsToGrant.push({ id: "shift_hours_100", context: { totalHours: Math.round(totalHours * 10) / 10 } });

        if (totalEarnings > 0) achievementsToGrant.push({ id: "shift_earnings_first", context: { totalEarnings: Math.round(totalEarnings) } });

        // iter24: per-shift badges evaluated from the exact times written to the DB
        if (closedShift) {
            for (const id of evaluateClockOutAchievements(closedShift)) {
                const durationMinutes = Math.round((Date.parse(closedShift.clockOutIso) - Date.parse(closedShift.clockInIso)) / 60000);
                achievementsToGrant.push({
                    id,
                    context: { durationMinutes, endedAtMsk: formatMskClock(closedShift.clockOutIso) },
                });
            }
        }

        // Grant each achievement (non-blocking, don't await each)
        // Also update profile counters with current totals
        for (const achievement of achievementsToGrant) {
            grantFranchizeAchievementAction({
                slug: crewSlug,
                userId,
                achievementId: achievement.id,
                source: "telegram:/shift",
                context: achievement.context,
                incrementCounters: {
                    shiftsCompleted: totalShifts,
                    totalHoursWorked: totalHours,
                },
            }).catch((err) => logger.warn(`[Shift Achievement] Failed to grant ${achievement.id} to ${userId}:`, err));
        }

        logger.info(`[Shift Achievements] Processed ${totalShifts} shifts (${totalHours.toFixed(1)}h) for ${userId}, eligible for ${achievementsToGrant.length} achievements`);
    } catch (e) {
        logger.error(`[Shift Achievements] Error processing for ${userId}:`, e);
    }
}
