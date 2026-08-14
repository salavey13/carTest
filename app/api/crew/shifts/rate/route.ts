// app/api/crew/shifts/rate/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { verifyTelegramActor } from "@/lib/telegram-actor-cookie";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { slug, memberId, hourlyRate } = body;

    if (!slug || !memberId || hourlyRate === undefined) {
      return NextResponse.json(
        { error: "Missing slug, memberId, or hourlyRate" },
        { status: 400 }
      );
    }

    const rate = Number(hourlyRate);
    if (isNaN(rate) || rate < 0) {
      return NextResponse.json({ error: "Invalid hourly rate" }, { status: 400 });
    }

    // Verify the user is authenticated
    const actorCookie = request.cookies.get("telegram_actor");
    const actorUserId = actorCookie ? verifyTelegramActor(actorCookie.value) : null;
    if (!actorUserId || actorUserId !== memberId) {
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

    // Check if user is a crew member
    const { data: membership } = await supabaseAdmin
      .from("crew_members")
      .select("role, membership_status")
      .eq("crew_id", crew.id)
      .eq("user_id", memberId)
      .eq("membership_status", "active")
      .maybeSingle();

    if (!membership) {
      return NextResponse.json({ error: "Not a crew member" }, { status: 403 });
    }

    // Update hourly_rate in users.metadata
    const { error: updateError } = await supabaseAdmin
      .from("users")
      .update({
        metadata: supabaseAdmin.sql`jsonb_set(
          coalesce(metadata, '{}'::jsonb),
          '{hourly_rate}',
          ${rate}::jsonb
        )`,
      })
      .eq("user_id", memberId);

    if (updateError) {
      console.error("Failed to update hourly rate:", updateError);
      return NextResponse.json({ error: "Failed to update rate" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Hourly rate API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
