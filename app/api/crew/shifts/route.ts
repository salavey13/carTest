import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

/**
 * API endpoint for managing crew shifts
 * POST: Start a shift (any crew member)
 * DELETE: End a shift (crew owner/admin/co_owner only)
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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { slug, memberId, shiftType } = body;

    if (!slug || !memberId) {
      return NextResponse.json({ error: "Missing slug or memberId" }, { status: 400 });
    }

    // Get crew ID from slug
    const { data: crew, error: crewError } = await supabaseAdmin
      .from("crews")
      .select("id")
      .eq("slug", slug)
      .single();

    if (crewError || !crew) {
      return NextResponse.json({ error: "Crew not found" }, { status: 404 });
    }

    // Check user is a crew member
    const { data: membership } = await supabaseAdmin
      .from("crew_members")
      .select("user_id")
      .eq("user_id", memberId)
      .eq("crew_id", crew.id)
      .eq("membership_status", "active")
      .maybeSingle();

    if (!membership) {
      return NextResponse.json({ error: "Вы не участник экипажа" }, { status: 403 });
    }

    // Check no active shift already
    const { data: existing } = await supabaseAdmin
      .from("crew_member_shifts")
      .select("id")
      .eq("crew_id", crew.id)
      .eq("member_id", memberId)
      .is("clock_out_time", null)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: "У вас уже есть активная смена" }, { status: 409 });
    }

    // Create shift
    const { data: shift, error: insertError } = await supabaseAdmin
      .from("crew_member_shifts")
      .insert({
        crew_id: crew.id,
        member_id: memberId,
        shift_type: shiftType || "default",
        clock_in_time: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: "Ошибка создания смены" }, { status: 500 });
    }

    // Update live status
    await supabaseAdmin
      .from("crew_members")
      .update({ live_status: "online" })
      .eq("crew_id", crew.id)
      .eq("user_id", memberId);

    return NextResponse.json({ success: true, shift });
  } catch (error) {
    console.error("Shift POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
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

    // Get active shifts (no clock_out_time, started within last 24h to exclude zombies)
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: shifts } = await supabaseAdmin
      .from("crew_member_shifts")
      .select("*")
      .eq("crew_id", crew.id)
      .is("clock_out_time", null)
      .gte("clock_in_time", cutoff)
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
