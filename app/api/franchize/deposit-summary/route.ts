// /app/api/franchize/deposit-summary/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import {
  verifyTelegramActorCookieValue,
  TELEGRAM_ACTOR_COOKIE,
} from "@/lib/telegram-actor-cookie";
import { getDepositSummary } from "@/app/franchize/server-actions/deposit-entries";

/**
 * GET /api/franchize/deposit-summary?rentalId=<uuid>&slug=<slug>
 *
 * Returns deposit entries summary for a rental.
 * Used by DepositBadge component on rental cards.
 *
 * 2026-08-19 review fix: previously this route had no auth at all — the
 * comment said deposit amounts are "not PII" but the rentalId is uniquely
 * identifying. Now we verify the cookie + that the caller is a member of
 * the crew that owns the rental.
 */
export async function GET(request: NextRequest) {
  const rentalId = request.nextUrl.searchParams.get("rentalId");
  const slug = request.nextUrl.searchParams.get("slug");

  if (!rentalId) {
    return NextResponse.json({ error: "rentalId is required" }, { status: 400 });
  }
  if (!slug) {
    return NextResponse.json({ error: "slug is required" }, { status: 400 });
  }

  // Cookie-based auth
  const cookieStore = await import("next/headers").then((m) => m.cookies());
  const cookieUserId = verifyTelegramActorCookieValue(
    cookieStore.get(TELEGRAM_ACTOR_COOKIE)?.value
  );
  if (!cookieUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify the rental belongs to a crew the caller has access to.
  // (deposit_entries has no crew_id; the rental does.)
  const { data: rental } = await supabaseAdmin
    .from("rentals")
    .select("crew_id, crew:crews(slug)")
    .eq("rental_id", rentalId)
    .maybeSingle();
  if (!rental) {
    return NextResponse.json({ error: "Rental not found" }, { status: 404 });
  }

  const { data: crew } = await supabaseAdmin
    .from("crews")
    .select("id, owner_id")
    .eq("slug", slug)
    .maybeSingle();
  if (!crew) {
    return NextResponse.json({ error: "Crew not found" }, { status: 404 });
  }

  // The rental must belong to the same crew the caller is querying.
  if (rental.crew_id !== crew.id) {
    return NextResponse.json({ error: "Rental does not belong to this crew" }, { status: 403 });
  }

  const { data: membership } = await supabaseAdmin
    .from("crew_members")
    .select("role, membership_status")
    .eq("crew_id", crew.id)
    .eq("user_id", cookieUserId)
    .maybeSingle();

  const isAdmin = await (async () => {
    const { data: user } = await supabaseAdmin
      .from("users")
      .select("metadata")
      .eq("user_id", cookieUserId)
      .maybeSingle();
    const meta = user?.metadata as Record<string, unknown> | null;
    return meta?.role === "admin" || meta?.status === "admin";
  })();

  const isOwner = crew.owner_id === cookieUserId || isAdmin;
  if (!isOwner && membership?.membership_status !== "active") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const summary = await getDepositSummary(rentalId);
    return NextResponse.json(summary || { totalCollected: 0, totalReturned: 0, totalPenalty: 0, balance: 0, destinations: [], entries: [] });
  } catch (error) {
    console.error("[deposit-summary] Error:", error);
    return NextResponse.json({ error: "Failed to fetch deposit summary" }, { status: 500 });
  }
}
