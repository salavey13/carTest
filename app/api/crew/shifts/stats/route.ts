// app/api/crew/shifts/stats/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { verifyTelegramActor } from "@/lib/telegram-actor-cookie";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextParams;
    const slug = searchParams.get("slug");
    const userId = searchParams.get("userId");

    if (!slug || !userId) {
      return NextResponse.json({ error: "Missing slug or userId" }, { status: 400 });
    }

    // Verify the user is authenticated
    const actorCookie = request.cookies.get("telegram_actor");
    const actorUserId = actorCookie ? verifyTelegramActor(actorCookie.value) : null;
    if (!actorUserId || actorUserId !== userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get crew ID
    const { data: crew } = await supabaseAdmin
      .from("crews")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (!crew) {
      return NextResponse.json({ error: "Crew not found" }, { status: 404 });
    }

    // Get current month start/end
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();

    // Get completed shifts for the month
    const { data: shifts } = await supabaseAdmin
      .from("crew_member_shifts")
      .select("duration_minutes, salary_amount, clock_in_time, clock_out_time")
      .eq("crew_id", crew.id)
      .eq("member_id", userId)
      .gte("clock_in_time", monthStart)
      .lt("clock_in_time", monthEnd);

    const total_shifts = shifts?.length || 0;
    const total_minutes = shifts?.reduce((sum, s) => sum + (s.duration_minutes || 0), 0) || 0;
    const total_hours = total_minutes / 60;
    const total_earnings = shifts?.reduce((sum, s) => sum + (s.salary_amount || 0), 0) || 0;

    // Calculate unique days worked
    const uniqueDays = new Set(
      shifts?.map((s) => new Date(s.clock_in_time).toDateString()) || []
    ).size;
    const avg_daily_hours = uniqueDays > 0 ? total_hours / uniqueDays : 0;

    return NextResponse.json({
      total_shifts,
      total_hours,
      total_earnings,
      avg_daily_hours,
    });
  } catch (error) {
    console.error("Shifts stats API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
