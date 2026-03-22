import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase-server";

const startSchema = z.object({
  action: z.enum(["start", "stop"]),
  userId: z.string().min(1),
  crewSlug: z.string().min(1).default("vip-bike"),
  sessionId: z.string().uuid().optional(),
  rideName: z.string().trim().max(120).optional(),
  vehicleLabel: z.string().trim().max(120).optional(),
  rideMode: z.enum(["rental", "personal"]).default("rental"),
  visibility: z.enum(["crew", "all_auth"]).default("crew"),
});

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = startSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.flatten() }, { status: 400 });
  }

  const payload = parsed.data;

  if (payload.action === "start") {
    const now = new Date().toISOString();
    await supabaseAdmin
      .from("map_rider_sessions")
      .update({ status: "completed", sharing_enabled: false, ended_at: now, updated_at: now })
      .eq("user_id", payload.userId)
      .eq("crew_slug", payload.crewSlug)
      .eq("status", "active");

    const { data, error } = await supabaseAdmin
      .from("map_rider_sessions")
      .insert({
        user_id: payload.userId,
        crew_slug: payload.crewSlug,
        ride_name: payload.rideName || null,
        vehicle_label: payload.vehicleLabel || null,
        ride_mode: payload.rideMode,
        visibility: payload.visibility,
        status: "active",
        sharing_enabled: true,
        started_at: now,
        last_ping_at: now,
      })
      .select("id")
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  }

  const sessionId = payload.sessionId;
  if (!sessionId) {
    return NextResponse.json({ success: false, error: "sessionId is required for stop action" }, { status: 400 });
  }

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("map_rider_sessions")
    .select("id, started_at")
    .eq("id", sessionId)
    .eq("user_id", payload.userId)
    .single();

  if (existingError || !existing) {
    return NextResponse.json({ success: false, error: existingError?.message || "Session not found" }, { status: 404 });
  }

  const endedAt = new Date().toISOString();
  const durationSeconds = Math.max(0, Math.round((new Date(endedAt).getTime() - new Date(existing.started_at).getTime()) / 1000));
  const { error } = await supabaseAdmin
    .from("map_rider_sessions")
    .update({
      status: "completed",
      sharing_enabled: false,
      ended_at: endedAt,
      duration_seconds: durationSeconds,
      updated_at: endedAt,
    })
    .eq("id", sessionId)
    .eq("user_id", payload.userId);

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
