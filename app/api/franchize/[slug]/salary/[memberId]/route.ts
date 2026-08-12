// /app/api/franchize/[slug]/salary/[memberId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { verifyTelegramActorCookieValue } from "@/lib/telegram-actor-cookie";
import { TELEGRAM_ACTOR_COOKIE } from "@/lib/telegram-actor-cookie";
import { calculateSalaryForPeriod } from "@/app/franchize/server-actions/salary-calculations";
import { logger } from "@/lib/logger";

/**
 * API route for salary calculations.
 * GET: Salary calculation for member and period
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; memberId: string }> }
) {
  try {
    const { slug, memberId } = await params;
    const cookieStore = await import("next/headers").then(m => m.cookies());

    const cookieUserId = verifyTelegramActorCookieValue(
      cookieStore.get(TELEGRAM_ACTOR_COOKIE)?.value,
    );

    if (!cookieUserId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    // Verify crew access
    const { data: user } = await supabaseAdmin
      .from("users")
      .select("metadata")
      .eq("user_id", cookieUserId)
      .maybeSingle();

    const userMetadata = user?.metadata as Record<string, unknown> | null;
    const isAdmin = userMetadata?.role === "admin" || userMetadata?.status === "admin";

    const { data: crew } = await supabaseAdmin
      .from("crews")
      .select("id, owner_id")
      .eq("slug", slug)
      .maybeSingle();

    if (!crew) {
      return NextResponse.json({ success: false, error: "Crew not found" }, { status: 404 });
    }

    const isOwner = crew.owner_id === cookieUserId || isAdmin;

    if (!isOwner) {
      const { data: membership } = await supabaseAdmin
        .from("crew_members")
        .select("role, membership_status")
        .eq("crew_id", crew.id)
        .eq("user_id", cookieUserId)
        .maybeSingle();

      if (membership?.membership_status !== "active") {
        return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
      }
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
      actorUserId: cookieUserId,
      memberId,
      periodStart: from,
      periodEnd: to,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.error?.includes("не найден") ? 404 : 401 }
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