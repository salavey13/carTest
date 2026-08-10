// /app/api/franchize/deposit-penalty/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

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
 * Body: { rentalId, amount, destination, notes? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { rentalId, amount, destination, notes, operatorChatId } = body;

    if (!rentalId || !amount || !destination) {
      return NextResponse.json(
        { error: "rentalId, amount, and destination are required" },
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
        operator_chat_id: operatorChatId || null,
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
