import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { guardMapRidersWriteRequest, applyRateLimitHeaders } from "@/lib/map-riders-security";
import { enforceRateLimit } from "@/lib/rate-limit";
import { supabaseAdmin } from "@/lib/supabase-server";
import { assertCrewMembership } from "@/app/api/map-riders/_lib/crew-access";

const locationSchema = z.object({
  sessionId: z.string().uuid(),
  userId: z.string().min(1),
  crewSlug: z.string().min(1).default("vip-bike"),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  speedKmh: z.number().min(0).max(320).default(0),
  headingDeg: z.number().min(0).max(360).nullable().optional(),
  accuracyMeters: z.number().min(0).max(5000).nullable().optional(),
  capturedAt: z.string().datetime().optional(),
  privacy: z
    .object({
      visibilityMode: z.enum(["crew", "public"]).default("crew"),
      homeBlurEnabled: z.boolean().default(true),
      autoExpireMinutes: z.union([z.literal(1), z.literal(5), z.literal(15), z.literal(60)]).default(15),
      expiresAt: z.string().datetime().nullable().optional(),
    })
    .optional(),
});


export async function POST(request: NextRequest) {
  const guard = await guardMapRidersWriteRequest(request);
  if (!guard.ok) {
    return guard.response;
  }

  const body = await request.json();
  const parsed = locationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.flatten() }, { status: 400 });
  }

  const payload = parsed.data;
  if (payload.userId !== guard.subject) {
    return NextResponse.json({ success: false, error: "Unauthorized", reason: "subject_mismatch" }, { status: 403 });
  }

  const isCrewMember = await assertCrewMembership(payload.userId, payload.crewSlug);
  if (!isCrewMember) {
    return NextResponse.json({ success: false, error: "Join crew to start sharing", code: "join_required", reason: "membership_required" }, { status: 403 });
  }
  const limit = enforceRateLimit(`map-riders:location:${guard.subject}`, 30, 60_000);
  if (!limit.allowed) {
    const response = NextResponse.json({ success: false, error: "Too Many Requests" }, { status: 429 });
    applyRateLimitHeaders(response, limit.retryAfterSeconds, limit.remaining, limit.limit);
    return response;
  }

  const capturedAt = payload.capturedAt || new Date().toISOString();
  const { data: activeSession } = await supabaseAdmin
    .from("map_rider_sessions")
    .select("id, sharing_enabled")
    .eq("id", payload.sessionId)
    .eq("user_id", payload.userId)
    .eq("crew_slug", payload.crewSlug)
    .eq("status", "active")
    .maybeSingle();
  if (!activeSession?.sharing_enabled) {
    return NextResponse.json({ success: false, error: "Sharing is disabled for this session" }, { status: 409 });
  }

  const expiresAt = payload.privacy?.expiresAt ? new Date(payload.privacy.expiresAt).getTime() : null;
  if (expiresAt && Number.isFinite(expiresAt) && Date.now() >= expiresAt) {
    await supabaseAdmin
      .from("map_rider_sessions")
      .update({ sharing_enabled: false, status: "completed", ended_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", payload.sessionId)
      .eq("user_id", payload.userId);
    await supabaseAdmin.from("live_locations").delete().eq("user_id", payload.userId).eq("crew_slug", payload.crewSlug);
    return NextResponse.json({ success: false, error: "Sharing session expired" }, { status: 409 });
  }

  const seed = Math.floor(Date.now() / 1000);
  const effectiveLat = payload.privacy?.homeBlurEnabled ? blurCoordinate(payload.lat, seed) : payload.lat;
  const effectiveLon = payload.privacy?.homeBlurEnabled ? blurCoordinate(payload.lon, seed + 3) : payload.lon;
  const visibility = payload.privacy?.visibilityMode === "public" ? "all_auth" : "crew";

  const liveLocationUpsert = supabaseAdmin.from("live_locations").upsert(
    {
      user_id: payload.userId,
      crew_slug: payload.crewSlug,
      lat: effectiveLat,
      lng: effectiveLon,
      speed_kmh: payload.speedKmh,
      heading: payload.headingDeg || null,
      is_riding: true,
      updated_at: capturedAt,
    },
    { onConflict: "user_id" },
  );

  const sessionUpdate = supabaseAdmin
    .from("map_rider_sessions")
    .update({
      latest_lat: payload.lat,
      latest_lon: payload.lon,
      latest_speed_kmh: payload.speedKmh,
      last_ping_at: capturedAt,
      updated_at: new Date().toISOString(),
      stats: {
        lastAccuracyMeters: payload.accuracyMeters || null,
        lastHeadingDeg: payload.headingDeg || null,
        privacy: {
          homeBlurEnabled: payload.privacy?.homeBlurEnabled ?? true,
          autoExpireMinutes: payload.privacy?.autoExpireMinutes ?? 15,
          expiresAt: payload.privacy?.expiresAt ?? null,
        },
      },
      visibility,
    })
    .eq("id", payload.sessionId)
    .eq("user_id", payload.userId)
    .eq("crew_slug", payload.crewSlug)
    .eq("status", "active");

  const [{ error: liveError }, { error: sessionError }] = await Promise.all([liveLocationUpsert, sessionUpdate]);

  if (liveError) {
    return NextResponse.json({ success: false, error: liveError.message }, { status: 500 });
  }

  if (sessionError) {
    return NextResponse.json({ success: false, error: sessionError.message }, { status: 500 });
  }

  const response = NextResponse.json({ success: true, data: { capturedAt } });
  response.headers.set("X-Deprecated", "Use /api/map-riders/batch-points");
  return response;
}
