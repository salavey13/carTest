import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

/**
 * API endpoint for managing crew shifts
 * DELETE: End a shift (crew owner only)
 */

export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const { shiftId, slug } = body;

    if (!shiftId || !slug) {
      return NextResponse.json({ error: "Missing shiftId or slug" }, { status: 400 });
    }

    // Get crew ID from slug
    const { data: crew, error: crewError } = await supabaseAdmin
      .from("crews")
      .select("id, owner_id")
      .eq("slug", slug)
      .single();

    if (crewError || !crew) {
      return NextResponse.json({ error: "Crew not found" }, { status: 404 });
    }

    // Get the shift to verify it belongs to this crew
    const { data: shift, error: shiftError } = await supabaseAdmin
      .from("crew_member_shifts")
      .select("*")
      .eq("id", shiftId)
      .eq("crew_id", crew.id)
      .single();

    if (shiftError || !shift) {
      return NextResponse.json({ error: "Shift not found" }, { status: 404 });
    }

    // End the shift
    const { error: updateError } = await supabaseAdmin
      .from("crew_member_shifts")
      .update({ clock_out_time: new Date().toISOString() })
      .eq("id", shiftId);

    if (updateError) {
      return NextResponse.json({ error: "Failed to end shift" }, { status: 500 });
    }

    // Update member live status to offline
    await supabaseAdmin
      .from("crew_members")
      .update({ live_status: "offline" })
      .eq("crew_id", crew.id)
      .eq("user_id", shift.member_id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Shift API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get("slug");

    if (!slug) {
      return NextResponse.json({ error: "Missing slug" }, { status: 400 });
    }

    // Get crew ID from slug
    const { data: crew } = await supabaseAdmin
      .from("crews")
      .select("id")
      .eq("slug", slug)
      .single();

    if (!crew) {
      return NextResponse.json({ error: "Crew not found" }, { status: 404 });
    }

    // Get active shifts (no clock_out_time)
    const { data: shifts } = await supabaseAdmin
      .from("crew_member_shifts")
      .select("*")
      .eq("crew_id", crew.id)
      .is("clock_out_time", null)
      .order("clock_in_time", { ascending: false });

    // Enrich shifts with member info
    const enrichedShifts = shifts
      ? await Promise.all(
          shifts.map(async (shift) => {
            const [memberData, crewMemberData] = await Promise.all([
              supabaseAdmin
                .from("users")
                .select("id, username, avatar_url")
                .eq("id", shift.member_id)
                .single()
                .then((r) => r.data),
              supabaseAdmin
                .from("crew_members")
                .select("live_status")
                .eq("crew_id", crew.id)
                .eq("user_id", shift.member_id)
                .single()
                .then((r) => r.data),
            ]);

            return {
              ...shift,
              member: memberData
                ? {
                    user_id: memberData.id,
                    username: memberData.username || "Unknown",
                    avatar_url: memberData.avatar_url,
                    live_status: crewMemberData?.live_status || "offline",
                  }
                : undefined,
            };
          })
        )
      : [];

    return NextResponse.json({ success: true, shifts: enrichedShifts });
  } catch (error) {
    console.error("Shift API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
