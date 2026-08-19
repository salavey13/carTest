// /app/api/franchize/deposit-penalty/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import {
  verifyTelegramActorCookieValue,
  TELEGRAM_ACTOR_COOKIE,
} from "@/lib/telegram-actor-cookie";

/**
 * POST /api/franchize/deposit-penalty
 *
 * Records a penalty withholding from a rental deposit.
 * Creates a `penalty` entry (direction=out) in deposit_entries.
 *
 * The operator specifies:
 * - amount: how much to withhold
 * - destination: which destination the penalty applies to (cash/tbank/sber)
 * - notes: reason (e.g., "scratched fairing")
 *
 * This does NOT automatically create a deposit_returned entry for the
 * remaining balance — the auto-return trigger handles that on rental
 * completion, or the operator can manually return via the admin page.
 *
 * Body: { rentalId, amount, destination, notes?, slug }
 *
 * 2026-08-19 review fix: previously this route had no auth — ANY external
 * attacker could insert fake penalty entries against any rental. Now we
 * require the cookie + owner-tier access (owner / co_owner / admin) for
 * the crew that owns the rental.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { rentalId, amount, destination, notes, operatorChatId, slug } = body;

    if (!rentalId || !amount || !destination || !slug) {
      return NextResponse.json(
        { error: "rentalId, amount, destination, and slug are required" },
        { status: 400 }
      );
    }

    const penaltyAmount = Number(amount);
    if (isNaN(penaltyAmount) || penaltyAmount <= 0) {
      return NextResponse.json({ error: "amount must be a positive number" }, { status: 400 });
    }

    if (!["cash", "tbank", "sber"].includes(destination)) {
      return NextResponse.json({ error: "destination must be cash, tbank, or sber" }, { status: 400 });
    }

    // Cookie-based auth
    const cookieStore = await import("next/headers").then((m) => m.cookies());
    const cookieUserId = verifyTelegramActorCookieValue(
      cookieStore.get(TELEGRAM_ACTOR_COOKIE)?.value
    );
    if (!cookieUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify the rental belongs to a crew the caller owns/admins.
    const { data: rental } = await supabaseAdmin
      .from("rentals")
      .select("crew_id")
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
    if (rental.crew_id !== crew.id) {
      return NextResponse.json({ error: "Rental does not belong to this crew" }, { status: 403 });
    }

    const { data: membership } = await supabaseAdmin
      .from("crew_members")
      .select("role, membership_status")
      .eq("crew_id", crew.id)
      .eq("user_id", cookieUserId)
      .maybeSingle();

    const { data: user } = await supabaseAdmin
      .from("users")
      .select("metadata")
      .eq("user_id", cookieUserId)
      .maybeSingle();
    const meta = user?.metadata as Record<string, unknown> | null;
    const isAdmin = meta?.role === "admin" || meta?.status === "admin";

    const isOwner = crew.owner_id === cookieUserId || isAdmin;
    const isCoOwner = membership?.membership_status === "active" && ["co_owner", "admin"].includes(membership?.role || "");
    if (!isOwner && !isCoOwner) {
      return NextResponse.json(
        { error: "Forbidden: только владелец, со-владелец или администратор может списывать штрафы с депозитов" },
        { status: 403 }
      );
    }

    // Verify the penalty doesn't exceed the collected amount for this destination
    const { data: collected } = await supabaseAdmin
      .from("deposit_entries")
      .select("amount")
      .eq("rental_id", rentalId)
      .eq("entry_type", "deposit_collected")
      .eq("destination", destination);

    const totalCollected = (collected || []).reduce((sum, r) => sum + Number(r.amount), 0);

    const { data: existingPenalties } = await supabaseAdmin
      .from("deposit_entries")
      .select("amount")
      .eq("rental_id", rentalId)
      .eq("entry_type", "penalty")
      .eq("destination", destination);

    const totalPenalty = (existingPenalties || []).reduce((sum, r) => sum + Number(r.amount), 0);

    if (penaltyAmount > totalCollected - totalPenalty) {
      return NextResponse.json({
        error: `Penalty (${penaltyAmount}) exceeds available balance for ${destination} (collected: ${totalCollected}, already penalized: ${totalPenalty})`,
      }, { status: 400 });
    }

    // Insert the penalty entry
    const { data, error } = await supabaseAdmin
      .from("deposit_entries")
      .insert({
        rental_id: rentalId,
        entry_type: "penalty",
        amount: penaltyAmount,
        direction: "out",
        destination,
        operator_chat_id: operatorChatId || cookieUserId,
        notes: notes || "Penalty withheld",
      })
      .select("id")
      .single();

    if (error) {
      console.error("[deposit-penalty] Insert error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, id: data.id });
  } catch (error) {
    console.error("[deposit-penalty] Error:", error);
    return NextResponse.json({ error: "Failed to record penalty" }, { status: 500 });
  }
}
