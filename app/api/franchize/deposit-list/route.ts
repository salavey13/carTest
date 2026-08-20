// /app/api/franchize/deposit-list/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import {
  verifyTelegramActorCookieValue,
  TELEGRAM_ACTOR_COOKIE,
} from "@/lib/telegram-actor-cookie";

/**
 * GET /api/franchize/deposit-list?date=YYYY-MM-DD&slug=<slug>
 *
 * Returns deposit entries for a date + daily summary per destination.
 * Used by the admin deposits page.
 *
 * 2026-08-19 review fix: this route previously had no auth. Anyone with the
 * URL could query deposit entries for any date. Now we verify the Telegram
 * actor cookie AND verify crew access via the slug param.
 */
export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get("date");
  const slug = request.nextUrl.searchParams.get("slug");

  if (!date) {
    return NextResponse.json({ error: "date is required" }, { status: 400 });
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

  // Verify crew access: any active crew member (incl. owner/admin/co_owner)
  // can read deposit entries for their own crew.
  const { data: crew } = await supabaseAdmin
    .from("crews")
    .select("id, owner_id")
    .eq("slug", slug)
    .maybeSingle();
  if (!crew) {
    return NextResponse.json({ error: "Crew not found" }, { status: 404 });
  }

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
  const { data: membership } = await supabaseAdmin
    .from("crew_members")
    .select("role, membership_status")
    .eq("crew_id", crew.id)
    .eq("user_id", cookieUserId)
    .maybeSingle();
  // 2026-08-19 review: tighten deposit-list to owner-tier only. It returns
  // aggregate deposit data for the entire crew (cash_collected, penalty,
  // etc.) which is sensitive financial information; regular members should
  // not see other members' deposit entries. Per-rental deposit-summary
  // remains accessible to any active crew member (used on rental cards).
  const isCoOwner =
    membership?.membership_status === "active" &&
    ["co_owner", "admin"].includes(membership?.role || "");
  if (!isOwner && !isCoOwner) {
    return NextResponse.json(
      { error: "Forbidden: только владелец, со-владелец или администратор может видеть агрегированные депозиты команды" },
      { status: 403 }
    );
  }

  try {
    const start = `${date}T00:00:00Z`;
    const end = `${date}T23:59:59Z`;

    // Filter deposit_entries to those whose rental belongs to this crew.
    // deposit_entries has no crew_id column, so we filter via an `in` clause
    // against the member's crew rentals.
    const { data: crewRentalIds } = await supabaseAdmin
      .from("rentals")
      .select("rental_id")
      .eq("crew_id", crew.id);
    const rentalIds = (crewRentalIds || []).map((r: any) => r.rental_id);
    if (rentalIds.length === 0) {
      return NextResponse.json({ entries: [], summaries: [] });
    }

    const { data, error } = await supabaseAdmin
      .from("deposit_entries")
      .select("*")
      .in("rental_id", rentalIds)
      .gte("created_at", start)
      .lte("created_at", end)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[deposit-list] Query error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const entries = data || [];

    // Aggregate by destination
    const destMap = new Map<string, { collected: number; returned: number; penalty: number }>();
    for (const e of entries) {
      const dest = e.destination;
      if (!destMap.has(dest)) {
        destMap.set(dest, { collected: 0, returned: 0, penalty: 0 });
      }
      const d = destMap.get(dest)!;
      if (e.entry_type === "deposit_collected") d.collected += Number(e.amount);
      else if (e.entry_type === "deposit_returned") d.returned += Number(e.amount);
      else if (e.entry_type === "penalty") d.penalty += Number(e.amount);
    }

    const summaries = Array.from(destMap.entries()).map(([dest, d]) => ({
      destination: dest,
      collected: d.collected,
      returned: d.returned,
      penalty: d.penalty,
      net: d.collected - d.returned - d.penalty,
    }));

    return NextResponse.json({ entries, summaries });
  } catch (error) {
    console.error("[deposit-list] Error:", error);
    return NextResponse.json({ error: "Failed to fetch deposit entries" }, { status: 500 });
  }
}
