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
    const { shiftId, slug, removeMember, userId } = body;

    // ── Member removal mode ──
    if (removeMember && slug && userId) {
      // Get crew ID + owner from slug
      const { data: crew, error: crewError } = await supabaseAdmin
        .from("crews")
        .select("id, owner_id")
        .eq("slug", slug)
        .single();

      if (crewError || !crew) {
        return NextResponse.json({ error: "Crew not found" }, { status: 404 });
      }

      // Can't remove the owner
      if (userId === crew.owner_id) {
        return NextResponse.json({ error: "Нельзя удалить владельца экипажа" }, { status: 403 });
      }

      // Remove the member from crew_members
      const { error: removeError } = await supabaseAdmin
        .from("crew_members")
        .delete()
        .eq("crew_id", crew.id)
        .eq("user_id", userId);

      if (removeError) {
        return NextResponse.json({ error: "Failed to remove member: " + removeError.message }, { status: 500 });
      }

      // Also end any active shift
      await supabaseAdmin
        .from("crew_member_shifts")
        .update({ clock_out_time: new Date().toISOString() })
        .eq("crew_id", crew.id)
        .eq("member_id", userId)
        .is("clock_out_time", null);

      return NextResponse.json({ success: true, removed: true });
    }

    // ── Shift end mode (original) ──
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
      .maybeSingle();

    if (shiftError || !shift) {
      return NextResponse.json({ error: "Shift not found" }, { status: 404 });
    }

    // Check if already closed - handle gracefully
    if (shift.clock_out_time) {
      return NextResponse.json({ success: true, alreadyClosed: true, message: "Shift already closed" });
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
    // Single source of truth for "active shift" = row with clock_out_time IS NULL.
    // Bot /shift command uses the same rule, so the page and the bot stay in tandem.
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
    // NOTE timezone: clock_in_time is stored as UTC (ISO-8601 +00:00). Moscow is
    // UTC+3 — 09:00 UTC == 12:00 MSK. Consumers (page timer, salary trigger,
    // history) parse it as UTC and render in the viewer's local timezone.
    // Never pass local wall-clock time here.
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
    // Syncs the secondary presence field so the crew list shows the member online.
    // The "active shift" truth itself lives in crew_member_shifts (see above).
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

    // Get ALL active shifts (no clock_out_time) - don't filter by age.
    // If a shift is >24h old, it's still real and needs to be closed properly —
    // filtering it out would hide a "zombie" shift that the bot still reports.
    // NOTE timezone: comparisons are UTC (Supabase stores timestamptz as UTC).
    // Display happens client-side in the viewer's local timezone (Moscow = UTC+3).
    const { data: shifts } = await supabaseAdmin
      .from("crew_member_shifts")
      .select("*")
      .eq("crew_id", crew.id)
      .is("clock_out_time", null)
      .order("clock_in_time", { ascending: false });

    // Enrich shifts with member info including hourly_rate
    const enrichedShifts = shifts
      ? await Promise.all(
          shifts.map(async (shift) => {
            const [memberData, crewMemberData] = await Promise.all([
              supabaseAdmin
                .from("users")
                .select("id, username, avatar_url, metadata")
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

            // Extract hourly_rate from metadata if available
            const hourlyRate = memberData?.metadata?.hourly_rate || 169; // Default 169 RUB/hour

            return {
              ...shift,
              hourly_rate: hourlyRate,
              member: memberData
                ? {
                    user_id: memberData.id,
                    username: memberData.username || "Unknown",
                    avatar_url: memberData.avatar_url,
                    live_status: crewMemberData?.live_status || "offline",
                    hourly_rate: hourlyRate,
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
