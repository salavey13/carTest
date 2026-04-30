import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

function normalizeFlow(raw: string | null): "buy" | "rent" {
  return raw?.toLowerCase() === "buy" ? "buy" : "rent";
}

export async function GET(request: NextRequest) {
  const vehicle = (request.nextUrl.searchParams.get("vehicle") || "").trim().toLowerCase();
  const flow = normalizeFlow(request.nextUrl.searchParams.get("flow"));

  if (!vehicle) {
    return NextResponse.json({ slug: "vip-bike", vehicleId: "", flow });
  }

  const { data: car } = await supabaseAdmin
    .from("cars")
    .select("id, crew_id, owner_id, specs")
    .eq("id", vehicle)
    .maybeSingle();

  if (!car) {
    return NextResponse.json({ slug: "vip-bike", vehicleId: vehicle, flow, saleAvailable: false });
  }

  let slug = "vip-bike";

  if (car.crew_id) {
    const { data: crewById } = await supabaseAdmin
      .from("crews")
      .select("slug")
      .eq("id", car.crew_id)
      .maybeSingle();
    if (typeof crewById?.slug === "string" && crewById.slug.trim()) {
      slug = crewById.slug;
    }
  }

  if (slug === "vip-bike" && car.owner_id) {
    const { data: crewByOwner } = await supabaseAdmin
      .from("crews")
      .select("slug")
      .eq("owner_id", car.owner_id)
      .maybeSingle();
    if (typeof crewByOwner?.slug === "string" && crewByOwner.slug.trim()) {
      slug = crewByOwner.slug;
    }
  }

  const rawSale = (car as { specs?: Record<string, unknown> }).specs?.sale;
  const saleAvailable = rawSale === 1 || rawSale === true || String(rawSale).toLowerCase() === "1" || String(rawSale).toLowerCase() === "true";

  return NextResponse.json({ slug, vehicleId: car.id, flow, saleAvailable });
}
