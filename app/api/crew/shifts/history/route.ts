// app/api/crew/shifts/history/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { verifyTelegramActorCookieValue, TELEGRAM_ACTOR_COOKIE } from "@/lib/telegram-actor-cookie";

// Force dynamic rendering because this route uses request.cookies for auth
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextParams;
    const slug = searchParams.get("slug");
    const userId = searchParams.get("userId");

    if (!slug || !userId) {
      return NextResponse.json({ error: "Missing slug or userId" }, { status: 400 });
    }

    // Verify the user is authenticated
    const actorCookie = request.cookies.get(TELEGRAM_ACTOR_COOKIE);
    const actorUserId = actorCookie ? verifyTelegramActorCookieValue(actorCookie.value) : null;
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

    // Get completed shifts for the user
    const { data: shifts } = await supabaseAdmin
      .from("crew_member_shifts")
      .select("*")
      .eq("crew_id", crew.id)
      .eq("member_id", userId)
      .not("clock_out_time", "is", null)
      .order("clock_in_time", { ascending: false })
      .limit(50);

    return NextResponse.json({
      shifts: shifts || [],
    });
  } catch (error) {
    console.error("Shift history API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
