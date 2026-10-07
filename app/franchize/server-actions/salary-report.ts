// app/franchize/server-actions/salary-report.ts
"use server";

// Task 77 (boss 2026-10-07): «add ability to receive salary report as tg
// file similarly to subrenters reports».
//
// Same pipeline as the subrenter weekly report
// (app/franchize/server-actions/subrenter-monitoring.ts →
// generateSubrenterWeeklyReportAction): compute → render HTML →
// buildFranchizeDocxFromTemplate → sendTelegramDocument. The receiver is
// the member himself (memberId IS his telegram chat id, same identity the
// whole crew layer uses).
//
// Access: owner-tier (owner/co_owner/admin via verifyCrewAccess.isOwner —
// NOTE: verifyCrewAccess already folds admin/co_owner crew roles into
// isOwner) may request a report for ANY member (e.g. from the team salary
// page); a regular member may request ONLY his own (owner-or-self, the
// same IDOR rule calculateSalaryForPeriod enforces).

import { supabaseAdmin } from "@/lib/supabase-server";
import { logger } from "@/lib/logger";
import {
  verifyCrewAccess,
  resolveServerActorUserId,
} from "./shared/auth-helpers";
import { calculateSalaryForPeriod } from "./salary-calculations";
import { mskDayBoundsUtcIso } from "@/app/franchize/lib/msk-time";
import {
  SALARY_REPORT_TEMPLATE,
  renderSalaryShiftRowsHtml,
  renderSalaryBreakdownRowsHtml,
  type SalaryReportShiftRow,
} from "@/app/franchize/lib/salary-report-template";

export interface SalaryReportResult {
  success: boolean;
  error?: string;
  fileName?: string;
  sentToMember?: boolean;
  sentToRequester?: boolean;
  summary?: {
    memberName: string;
    periodFrom: string;
    periodTo: string;
    shiftsCount: number;
    shiftsHours: string;
    shiftsTotalRub: number;
    commissionRub: number;
    totalRub: number;
  };
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const fmtRub = (n: number): string => Math.round(n).toLocaleString("ru-RU");

const fmtRuDate = (dateStr: string): string => {
  const [y, m, d] = dateStr.split("-");
  return `${d}.${m}.${y}`;
};

/** Shift duration in a compact ru label, e.g. «10 ч 00 м». */
const fmtDuration = (minutes: number): string => {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h} ч ${String(m).padStart(2, "0")} м`;
};

export async function sendSalaryReportTelegramAction(input: {
  slug: string;
  /** The member the report is ABOUT (and the default receiver). */
  memberId: string;
  /** Period dates, YYYY-MM-DD, interpreted in MSK (app convention). */
  from: string;
  to: string;
  actorUserId?: string;
  initData?: string;
  /** Owner convenience: a copy into the requester's own TG. */
  sendCopyToRequester?: boolean;
}): Promise<SalaryReportResult> {
  const parsed = {
    slug: typeof input?.slug === "string" ? input.slug.trim() : "",
    memberId: typeof input?.memberId === "string" ? input.memberId.trim() : "",
    from: typeof input?.from === "string" ? input.from.trim() : "",
    to: typeof input?.to === "string" ? input.to.trim() : "",
    initData: typeof input?.initData === "string" ? input.initData.trim() : "",
    sendCopyToRequester: input?.sendCopyToRequester === true,
  };
  if (!parsed.slug || !/^\d{5,}$/.test(parsed.memberId) || !DATE_RE.test(parsed.from) || !DATE_RE.test(parsed.to)) {
    return { success: false, error: "Некорректные параметры отчёта." };
  }
  if (parsed.from > parsed.to) {
    return { success: false, error: "Дата начала позже даты окончания." };
  }

  // SA-002-style identity: signed cookie or HMAC initData — never a
  // client-claimed id.
  const actorUserId = await resolveServerActorUserId({
    claimedActorUserId: input?.actorUserId,
    initData: parsed.initData,
  });
  if (!actorUserId) return { success: false, error: "Не авторизовано." };

  const access = await verifyCrewAccess(parsed.slug);
  if (!access.allowed) {
    return { success: false, error: access.error };
  }
  // owner-or-self: a member may only generate HIS OWN report; owner-tier
  // (owner / co_owner / admin) may generate for anyone in the crew.
  const isOwnerTier = access.isOwner === true;
  if (!isOwnerTier && actorUserId !== parsed.memberId) {
    return { success: false, error: "Недостаточно прав: свой отчёт может получить только сам участник." };
  }

  try {
    // MSK day bounds (app-wide convention — see my-work.ts / MyEarningsPanel).
    const startUtcIso = mskDayBoundsUtcIso(parsed.from).startUtcIso;
    const endUtcIso = mskDayBoundsUtcIso(parsed.to).endUtcIso;

    // Aggregate breakdown — the EXACT numbers the salary page shows
    // (shift income + category bonuses from rentals/sales attribution).
    const calc = await calculateSalaryForPeriod({
      slug: parsed.slug,
      actorUserId,
      memberId: parsed.memberId,
      periodStart: startUtcIso,
      periodEnd: endUtcIso,
    });
    if (!calc.success || !calc.data) {
      return { success: false, error: calc.error || "Не удалось рассчитать зарплату за период." };
    }

    // Shift detail for the report table.
    const { data: shiftRows, error: shiftsError } = await supabaseAdmin
      .from("crew_member_shifts")
      .select("clock_in_time, clock_out_time, duration_minutes, hourly_rate, salary_amount")
      .eq("crew_id", access.crewId!)
      .eq("member_id", parsed.memberId)
      .gte("clock_in_time", startUtcIso)
      .lt("clock_in_time", endUtcIso)
      .order("clock_in_time", { ascending: true });
    if (shiftsError) {
      logger.warn("[salary-report] shifts detail query failed:", shiftsError);
    }

    const reportRows: SalaryReportShiftRow[] = (shiftRows ?? []).map((s: {
      clock_in_time?: string | null;
      duration_minutes?: number | null;
      hourly_rate?: number | null;
      salary_amount?: number | null;
    }) => {
      const startIso = s.clock_in_time ?? "";
      // MSK wall-clock date of the shift start (+03:00).
      const msk = new Date(Date.parse(startIso) + 3 * 3600 * 1000);
      const dateLabel = Number.isFinite(msk.getTime()) && startIso
        ? `${String(msk.getUTCDate()).padStart(2, "0")}.${String(msk.getUTCMonth() + 1).padStart(2, "0")}.${msk.getUTCFullYear()}`
        : "—";
      const minutes = Number(s.duration_minutes ?? 0);
      return {
        dateLabel,
        hoursLabel: fmtDuration(minutes),
        rateRub: Number(s.hourly_rate ?? 0),
        amountRub: Number(s.salary_amount ?? 0) || (minutes / 60) * Number(s.hourly_rate ?? 0),
      };
    });

    // Names: user full name / username; crew display name.
    const [{ data: memberUser }, { data: crewRow }] = await Promise.all([
      supabaseAdmin
        .from("users")
        .select("full_name, username")
        .eq("user_id", parsed.memberId)
        .maybeSingle(),
      supabaseAdmin
        .from("crews")
        .select("name")
        .eq("id", access.crewId!)
        .maybeSingle(),
    ]);
    const memberName =
      memberUser?.full_name?.trim() ||
      (memberUser?.username ? `@${memberUser.username}` : `Telegram ID ${parsed.memberId}`);
    const crewName = crewRow?.name?.trim() || parsed.slug;

    const shiftsTotal = reportRows.reduce((acc, r) => acc + r.amountRub, 0);
    const totalMinutes = (shiftRows ?? []).reduce((acc: number, s: { duration_minutes?: number | null }) => acc + Number(s.duration_minutes ?? 0), 0);
    const commissionRub = calc.data.commissionIncome;
    const totalRub = calc.data.totalIncome;

    const mskNow = new Date(Date.now() + 3 * 3600 * 1000);
    const pad = (n: number) => String(n).padStart(2, "0");
    const generatedAt = `${pad(mskNow.getUTCDate())}.${pad(mskNow.getUTCMonth() + 1)}.${mskNow.getUTCFullYear()} ${pad(mskNow.getUTCHours())}:${pad(mskNow.getUTCMinutes())}`;

    const variables: Record<string, string> = {
      crew_name: crewName,
      member_full_name: memberName,
      member_tg: parsed.memberId,
      date_from: fmtRuDate(parsed.from),
      date_to: fmtRuDate(parsed.to),
      generated_at: generatedAt,
      zero_shifts: reportRows.length === 0 ? "1" : "",
      shifts_table_rows: renderSalaryShiftRowsHtml(reportRows),
      shifts_count: String(reportRows.length),
      shifts_hours: fmtDuration(totalMinutes),
      shifts_total_rub: fmtRub(shiftsTotal),
      breakdown_table_rows: renderSalaryBreakdownRowsHtml(calc.data.breakdown),
      commissions_total_rub: fmtRub(commissionRub),
      total_rub: fmtRub(totalRub),
    };

    const { buildFranchizeDocxFromTemplate } = await import("@/app/franchize/lib/docx-capability");
    const fileName = `salary-report-${parsed.slug}-${parsed.memberId}-${parsed.from}_${parsed.to}.docx`;
    const doc = await buildFranchizeDocxFromTemplate({
      integrationScope: `salary-report:${parsed.slug}`,
      uploadedBy: actorUserId,
      fileName,
      template: SALARY_REPORT_TEMPLATE,
      variables,
      templateMode: "html",
    });

    // Deliver: the file goes to the member's own chat (same channel the
    // subrenter reports land in). Optional owner copy.
    const { sendTelegramDocument } = await import("@/app/actions");
    let sentToMember = false;
    try {
      const sendResult = await sendTelegramDocument(parsed.memberId, new Blob([doc.bytes]), fileName);
      sentToMember = Boolean(sendResult?.success);
      if (!sentToMember) {
        logger.warn("[salary-report] member delivery failed", { memberId: parsed.memberId, error: sendResult?.error });
      }
    } catch (sendErr) {
      logger.warn("[salary-report] member delivery threw (non-fatal)", sendErr);
    }

    let sentToRequester = false;
    if (parsed.sendCopyToRequester && actorUserId !== parsed.memberId) {
      try {
        const copyResult = await sendTelegramDocument(actorUserId, new Blob([doc.bytes]), fileName);
        sentToRequester = Boolean(copyResult?.success);
      } catch (copyErr) {
        logger.warn("[salary-report] requester copy threw (non-fatal)", copyErr);
      }
    }

    return {
      success: true,
      fileName,
      sentToMember,
      sentToRequester,
      summary: {
        memberName,
        periodFrom: parsed.from,
        periodTo: parsed.to,
        shiftsCount: reportRows.length,
        shiftsHours: fmtDuration(totalMinutes),
        shiftsTotalRub: Math.round(shiftsTotal),
        commissionRub: Math.round(commissionRub),
        totalRub: Math.round(totalRub),
      },
    };
  } catch (error) {
    logger.error("[sendSalaryReportTelegramAction] failed:", error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}
