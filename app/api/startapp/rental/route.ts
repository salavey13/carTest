import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

/**
 * task168 (boss: «deeplinks like t.me/oneBikePlsBot/app?startapp=rental_<uuid>
 * stopped working … on some phones the app hanged while waiting for the
 * deeplink to trigger routing»):
 *
 * Crew resolver for RENTAL deep links, mirroring /api/startapp/vehicle.
 *
 * WHY THIS EXISTS: the startapp router used to route rental_ params ONLY
 * after the Telegram auth roundtrip finished (it needed userCrewInfo.slug to
 * build /franchize/<slug>/rental/<id>). On phones with a stalled network the
 * auth window can stretch for minutes — the deeplink looked dead AND the app
 * looked hung. But the rental page is PUBLIC: routing a rental_ param needs
 * ZERO identity. The crew can be resolved SERVER-SIDE from the rental row
 * itself — so the router can fast-path the param before auth even starts.
 *
 * Security: the rentalId is an unguessable UUID — the same capability token
 * the public rental page itself already trusts. This endpoint leaks nothing
 * but the crew slug for that rental.
 */
export async function GET(request: NextRequest) {
  const rentalId = (request.nextUrl.searchParams.get("rentalId") || "")
    .trim()
    .toLowerCase();

  if (!rentalId) {
    return NextResponse.json({ slug: "vip-bike", rentalId: "" });
  }

  const { data: rental } = await supabaseAdmin
    .from("rentals")
    .select("rental_id, user_id, owner_id, vehicle_id")
    .eq("rental_id", rentalId)
    .maybeSingle();

  if (!rental) {
    return NextResponse.json({ slug: "vip-bike", rentalId, found: false });
  }

  let slug = "vip-bike";

  if (rental.vehicle_id) {
    const { data: car } = await supabaseAdmin
      .from("cars")
      .select("id, crew_id, owner_id")
      .eq("id", rental.vehicle_id)
      .maybeSingle();

    if (car?.crew_id) {
      const { data: crewById } = await supabaseAdmin
        .from("crews")
        .select("slug")
        .eq("id", car.crew_id)
        .maybeSingle();
      if (typeof crewById?.slug === "string" && crewById.slug.trim()) {
        slug = crewById.slug;
      }
    }

    if (slug === "vip-bike" && car?.owner_id) {
      const { data: crewByOwner } = await supabaseAdmin
        .from("crews")
        .select("slug")
        .eq("owner_id", car.owner_id)
        .maybeSingle();
      if (typeof crewByOwner?.slug === "string" && crewByOwner.slug.trim()) {
        slug = crewByOwner.slug;
      }
    }
  }

  if (slug === "vip-bike" && rental.owner_id) {
    // Rental without a vehicle (edge) — the owner's own crew is the last
    // reliable crew signal before the vip-bike fallback.
    const { data: crewByRentalOwner } = await supabaseAdmin
      .from("crews")
      .select("slug")
      .eq("owner_id", rental.owner_id)
      .maybeSingle();
    if (typeof crewByRentalOwner?.slug === "string" && crewByRentalOwner.slug.trim()) {
      slug = crewByRentalOwner.slug;
    }
  }

  return NextResponse.json({ slug, rentalId, found: true });
}
