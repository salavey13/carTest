import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase-server";

const meetupSchema = z.object({
  crewSlug: z.string().min(1).default("vip-bike"),
  userId: z.string().min(1),
  title: z.string().trim().min(2).max(80),
  comment: z.string().trim().max(240).optional(),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  scheduledAt: z.string().datetime().optional().nullable(),
});

const meetupDeleteSchema = z.object({
  meetupId: z.string().uuid(),
  crewSlug: z.string().trim().min(1).default("vip-bike"),
  userId: z.string().trim().min(1),
});

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = meetupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.flatten() }, { status: 400 });
  }

  const { error, data } = await supabaseAdmin
    .from("map_rider_meetups")
    .insert({
      crew_slug: parsed.data.crewSlug,
      created_by_user_id: parsed.data.userId,
      title: parsed.data.title,
      comment: parsed.data.comment || null,
      lat: parsed.data.lat,
      lon: parsed.data.lon,
      scheduled_at: parsed.data.scheduledAt || null,
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, data });
}

export async function DELETE(request: NextRequest) {
  const body = await request.json();
  const parsed = meetupDeleteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.flatten() }, { status: 400 });
  }

  const { meetupId, crewSlug, userId } = parsed.data;

  const { data: meetup, error: meetupError } = await supabaseAdmin
    .from("map_rider_meetups")
    .select("id, crew_slug, created_by_user_id")
    .eq("id", meetupId)
    .single();

  if (meetupError || !meetup) {
    return NextResponse.json({ success: false, error: "Meetup не найден" }, { status: 404 });
  }

  if (meetup.crew_slug !== crewSlug) {
    return NextResponse.json({ success: false, error: "Meetup относится к другому экипажу" }, { status: 403 });
  }

  const { data: actor } = await supabaseAdmin
    .from("users")
    .select("role,status")
    .eq("user_id", userId)
    .maybeSingle();

  const isAdmin = actor?.status === "admin" || actor?.role === "admin" || actor?.role === "vprAdmin";
  const isCreator = meetup.created_by_user_id === userId;

  let isCrewOwner = false;
  if (!isAdmin && !isCreator) {
    const { data: crew } = await supabaseAdmin
      .from("crews")
      .select("id, owner_id")
      .eq("slug", crewSlug)
      .maybeSingle();

    if (crew?.owner_id === userId) {
      isCrewOwner = true;
    } else if (crew?.id) {
      const { data: membership } = await supabaseAdmin
        .from("crew_members")
        .select("role,membership_status")
        .eq("crew_id", crew.id)
        .eq("user_id", userId)
        .maybeSingle();
      isCrewOwner = membership?.role === "owner" && membership?.membership_status === "active";
    }
  }

  if (!isAdmin && !isCreator && !isCrewOwner) {
    return NextResponse.json({ success: false, error: "Удалять meetup может автор, owner экипажа или admin" }, { status: 403 });
  }

  const { error: deleteError } = await supabaseAdmin.from("map_rider_meetups").delete().eq("id", meetupId);
  if (deleteError) {
    return NextResponse.json({ success: false, error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: { id: meetupId } });
}
