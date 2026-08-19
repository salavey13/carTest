// /app/api/franchize/[slug]/salary/[memberId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { calculateSalaryForPeriod } from "@/app/franchize/server-actions/salary-calculations";
import { verifyCrewAccess } from "@/app/franchize/server-actions/shared/auth-helpers";
import { logger } from "@/lib/logger";

/**
 * API route for salary calculations.
 * GET: Salary calculation for member and period
 *
 * 2026-08-19 review fix:
 *   - Replaced 40+ lines of inline cookie+crew+membership check with a call
 *     to the shared `verifyCrewAccess` helper. The inline check previously
 *     didn't recognize `co_owner` / `admin` roles as owner-tier, and any
 *     active `member` could read any other member's salary breakdown (IDOR).
 *   - Now: owner / co_owner / admin can query any memberId; regular members
 *     can only query their own memberId (defense-in-depth — the underlying
 *     `calculateSalaryForPeriod` server action enforces the same rule).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; memberId: string }> }
) {
  try {
    const { slug, memberId } = await params;

    // Shared cookie-based auth: verifies the Telegram actor cookie and
    // resolves crew + owner/co_owner/admin tier in one call.
    const access = await verifyCrewAccess(slug);
    if (!access.allowed) {
      return NextResponse.json(
        { success: false, error: access.error || "Unauthorized" },
        { status: 401 }
      );
    }

    // Owner-or-self: regular members can only query their own salary
    // breakdown. Owners (incl. co_owner / admin per shared helper) can
    // query any member.
    if (!access.isOwner && memberId !== access.actorUserId) {
      return NextResponse.json(
        { success: false, error: "Forbidden: можно запрашивать только свой расчёт." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    if (!from || !to) {
      return NextResponse.json(
        { success: false, error: "Missing required query params (from, to)" },
        { status: 400 }
      );
    }

    const result = await calculateSalaryForPeriod({
      slug,
      actorUserId: access.actorUserId || "",
      memberId,
      periodStart: from,
      periodEnd: to,
    });

    if (!result.success) {
      const status = result.error?.includes("не найден") ? 404
        : result.error?.includes("Недостаточно прав") ? 403
        : 401;
      return NextResponse.json(
        { success: false, error: result.error },
        { status }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    logger.error("[salary GET] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
