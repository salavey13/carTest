// Update today's assistant-bot rental to non-active status.
// The skill that created it set status='active' and payment_status='fully_paid'
// prematurely — no operator actually confirmed the booking, no money was collected,
// no deposit was tracked. Move it to pending_confirmation (the canonical
// "awaiting operator review" status used by the web checkout flow) so it
// doesn't pollute the active rentals list.
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://inmctohsodgdohamhzag.supabase.co";
const SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlubWN0b2hzb2RnZG9oYW1oemFnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczODMzOTU4NSwiZXhwIjoyMDUzOTE1NTg1fQ.xD91Es2o8T1vM-2Ok8iKCn4jGDA5TwBbapD5eqhblLM";
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const run = async () => {
  const { data, error } = await supabase
    .from("rentals")
    .update({
      status: "pending_confirmation",
      payment_status: "pending",  // demote from fully_paid — no money actually exchanged
      updated_at: new Date().toISOString(),
      metadata: {
        // Preserve original metadata + add a note explaining the status change
        source: "bot_contract",
        created_by: "assistant-quick-entry",
        daily_price: 10000,
        deposit_rub: 20000,
        renter_name: "Александр",
        renter_phone: "+79103971002",
        status_correction: {
          corrected_at: new Date().toISOString(),
          corrected_by: "code-review-2026-08-19",
          reason: "Skill created this rental with status=active + payment_status=fully_paid prematurely. No operator confirmed the booking, no money exchanged, no deposit collected. Demoted to pending_confirmation pending human review.",
          original_status: "active",
          original_payment_status: "fully_paid",
        },
      },
    })
    .eq("rental_id", "a85eb52e-1dc5-496b-8e79-b6b075b75789")
    .select("rental_id, status, payment_status, updated_at")
    .maybeSingle();

  if (error) {
    console.error("Failed to update rental:", error);
    process.exit(1);
  }
  console.log("Updated rental:", data);
};

run().catch(e => { console.error("FATAL:", e); process.exit(1); });
