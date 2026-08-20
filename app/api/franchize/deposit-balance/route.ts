// /app/api/franchize/deposit-balance/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import {
  verifyTelegramActorCookieValue,
  TELEGRAM_ACTOR_COOKIE,
} from "@/lib/telegram-actor-cookie";

/**
 * GET /api/franchize/deposit-balance?slug=<slug>
 *
 * Returns the all-time on-hand balance per destination (cash/tbank/sber):
 *   collected (sum of deposit_collected) - returned (sum of deposit_returned) - penalty
 * across ALL deposit_entries for the crew's rentals, regardless of date.
 *
 * Used by the "Current on-hand balance" section at the top of the deposits
 * admin page. Answers "how much cash deposit is currently in our pockets"
 * — the per-day section below can only answer "what happened on this date".
 *
 * 2026-08-19 review: added per the user's request after they noticed the
 * deposits page showed zeros for recent dates (because no /doc runs
 * happened recently). The all-time view shows what's actually on hand
 * even on quiet days.
 *
 * Auth: cookie-based, owner / co_owner / admin tier (deposits are sensitive
 * financial data — regular members shouldn't see aggregate crew totals).
 */
export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("slug");
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

  try {
    // Resolve crew + verify owner-tier access.
    const { data: crew } = await supabaseAdmin
      .from("crews")
      .select("id, owner_id")
      .eq("slug", slug)
      .maybeSingle();
    if (!crew) {
      return NextResponse.json({ error: "Crew not found" }, { status: 404 });
    }

    const { data: user } = await supabaseAdmin
      .from("users")
      .select("metadata")
      .eq("user_id", cookieUserId)
      .maybeSingle();
    const meta = user?.metadata as Record<string, unknown> | null;
    const isAdmin = meta?.role === "admin" || meta?.status === "admin";
    const isOwner = crew.owner_id === cookieUserId || isAdmin;
    const { data: membership } = await supabaseAdmin
      .from("crew_members")
      .select("role, membership_status")
      .eq("crew_id", crew.id)
      .eq("user_id", cookieUserId)
      .maybeSingle();
    const isCoOwner =
      membership?.membership_status === "active" &&
      ["co_owner", "admin"].includes(membership?.role || "");
    if (!isOwner && !isCoOwner) {
      return NextResponse.json(
        { error: "Forbidden: только владелец, со-владелец или администратор" },
        { status: 403 }
      );
    }

    // Get all rental_ids for this crew (deposit_entries has no crew_id column).
    const { data: crewRentals } = await supabaseAdmin
      .from("rentals")
      .select("rental_id")
      .eq("crew_id", crew.id);
    const rentalIds = (crewRentals || []).map((r: any) => r.rental_id);
    if (rentalIds.length === 0) {
      return NextResponse.json({
        destinations: [],
        totals: { collected: 0, returned: 0, penalty: 0, onHand: 0 },
      });
    }

    // Fetch all deposit_entries for the crew's rentals (no date filter — all-time).
    const { data: entries, error: entriesErr } = await supabaseAdmin
      .from("deposit_entries")
      .select("entry_type, amount, destination")
      .in("rental_id", rentalIds);
    if (entriesErr) {
      console.error("[deposit-balance] entries query failed:", entriesErr);
      return NextResponse.json({ error: entriesErr.message }, { status: 500 });
    }

    // Aggregate per destination + overall totals.
    const destMap = new Map<
      string,
      { collected: number; returned: number; penalty: number }
    >();
    const totals = { collected: 0, returned: 0, penalty: 0 };

    for (const e of entries || []) {
      const amount = Number(e.amount) || 0;
      const dest = e.destination || "unknown";
      if (!destMap.has(dest)) {
        destMap.set(dest, { collected: 0, returned: 0, penalty: 0 });
      }
      const d = destMap.get(dest)!;
      if (e.entry_type === "deposit_collected") {
        d.collected += amount;
        totals.collected += amount;
      } else if (e.entry_type === "deposit_returned") {
        d.returned += amount;
        totals.returned += amount;
      } else if (e.entry_type === "penalty") {
        d.penalty += amount;
        totals.penalty += amount;
      }
    }

    const destinations = Array.from(destMap.entries()).map(([dest, d]) => ({
      destination: dest,
      collected: d.collected,
      returned: d.returned,
      penalty: d.penalty,
      // On-hand = collected - returned - penalty (money still in our pocket).
      // For deposits: when we collect 20000 and return 20000, on-hand = 0
      // (we gave the deposit back). If we collected 20000 and withheld 5000
      // as penalty + returned 15000, on-hand = 0 (we kept 5000 as penalty,
      // but penalty is "money kept" not "money on hand").
      // The "onHand" field shows what's physically in the cash box / bank
      // account right now from unreturned deposits.
      onHand: d.collected - d.returned - d.penalty,
    }));

    return NextResponse.json({
      destinations,
      totals: {
        collected: totals.collected,
        returned: totals.returned,
        penalty: totals.penalty,
        onHand: totals.collected - totals.returned - totals.penalty,
      },
    });
  } catch (error) {
    console.error("[deposit-balance] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch deposit balance" },
      { status: 500 }
    );
  }
}
