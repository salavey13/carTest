// /home/z/my-project/scripts/fix-cbr-rental.js
const SUPABASE_URL = "https://inmctohsodgdohamhzag.supabase.co";
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
if (!KEY) {
  console.error("ENV MISSING: export SUPABASE_SERVICE_ROLE_KEY (legacy JWT or new sb_secret_ key) before running this script");
  process.exit(1);
}
const RENTAL_ID = "78759a77-5e58-49e7-b435-39a6b36e3e58";
const h = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", Prefer: "return=representation" };

async function main() {
  // 1. Set total_cost to 0
  const r1 = await fetch(`${SUPABASE_URL}/rest/v1/rentals?rental_id=eq.${RENTAL_ID}`, {
    method: "PATCH", headers: h,
    body: JSON.stringify({ total_cost: 0 }),
  });
  const d1 = await r1.json();
  console.log(`total_cost: ${d1[0]?.total_cost ?? "FAILED"}`);

  // 2. Read metadata, update it
  const r2 = await fetch(`${SUPABASE_URL}/rest/v1/rentals?rental_id=eq.${RENTAL_ID}&select=metadata`, { headers: h });
  const d2 = await r2.json();
  const meta = d2[0].metadata;
  meta.price_overridden = true;
  meta.price_override_amount = 0;
  meta.payment_split = { cash: 0, bank: 0, card_destination: null };
  meta.free_rental_reason = "Клиент завершил предыдущую аренду на 1 день раньше — бонусная бесплатная аренда";

  const r3 = await fetch(`${SUPABASE_URL}/rest/v1/rentals?rental_id=eq.${RENTAL_ID}`, {
    method: "PATCH", headers: h,
    body: JSON.stringify({ metadata: meta }),
  });
  const d3 = await r3.json();
  console.log(`metadata: override=${d3[0]?.metadata?.price_overridden} amount=${d3[0]?.metadata?.price_override_amount} reason=${d3[0]?.metadata?.free_rental_reason}`);
}
main().catch(e => { console.error(e); process.exit(1); });
