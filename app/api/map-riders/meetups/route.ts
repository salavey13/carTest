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
