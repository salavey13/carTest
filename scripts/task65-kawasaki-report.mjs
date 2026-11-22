// task65-kawasaki-report.mjs — REAL «Мотопарк» report for Kawasaki EX650K,
// September 2026, generated through the repo's OWN (post-fix) builder —
// exactly what getBikeRentalsReportAction produces for this bike on prod.
//
// Run: cd /home/z/cartest && SUPABASE_SERVICE_ROLE_KEY=... bun scripts/task65-kawasaki-report.mjs
import { createClient } from "@supabase/supabase-js";
import { writeFileSync, mkdirSync } from "fs";

const sb = createClient("https://inmctohsodgdohamhzag.supabase.co", process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// same fallback chain as the action: users.full_name → @username → renter_name
function resolveReportClientName(user, renterName) {
  const fullName = (user?.fullName || "").trim();
  if (fullName) return fullName;
  const username = (user?.username || "").trim();
  if (username) return `@${username}`;
  return (renterName || "").trim() || null;
}

const BIKE = "kawasaki-ex650k";
const PARTNER_CHAT = "425137783"; // Александр Корнилов @K0r_Al (specs.subrenter_chat_id)
const PCT = 50; // private.subrent_contract_artifacts is empty → contract default 50
const MONTH = "2026-09";

const { data: car } = await sb.from("cars").select("id, make, model, specs").eq("id", BIKE).maybeSingle();
const { data: crew } = await sb.from("crews").select("name").eq("slug", "vip-bike").maybeSingle();
const { data: rentals } = await sb.from("rentals")
  .select("rental_id,status,payment_status,total_cost,agreed_start_date,agreed_end_date,requested_start_date,requested_end_date,created_at,user_id,metadata")
  .eq("vehicle_id", BIKE)
  .order("created_at", { ascending: true });

const userIds = Array.from(new Set((rentals ?? []).map((r) => r.user_id).filter(Boolean)));
const { data: users } = userIds.length
  ? await sb.from("users").select("user_id, full_name, username").in("user_id", userIds)
  : { data: [] };
const usersByName = new Map((users ?? []).map((u) => [String(u.user_id), { fullName: u.full_name, username: u.username }]));

const rows = (rentals ?? []).map((r) => ({
  rentalId: String(r.rental_id),
  status: r.status ?? null,
  paymentStatus: r.payment_status ?? null,
  totalCost: r.total_cost == null ? null : Number(r.total_cost),
  agreedStart: r.agreed_start_date ?? null,
  agreedEnd: r.agreed_end_date ?? null,
  requestedStart: r.requested_start_date ?? null,
  requestedEnd: r.requested_end_date ?? null,
  createdAt: r.created_at ?? null,
  clientName: resolveReportClientName(
    r.user_id ? usersByName.get(String(r.user_id)) : undefined,
    typeof r.metadata?.renter_name === "string" ? r.metadata.renter_name : null,
  ),
  metadata: r.metadata ?? null,
}));

const { buildBikeRentalsReport } = await import("../app/franchize/lib/bike-rentals-report.ts");
const { markdown, filename } = buildBikeRentalsReport({
  bikeLabel: `${car.make || ""} ${car.model || ""}`.trim(),
  bikeId: BIKE,
  crewName: crew?.name ?? "VIP_BIKE",
  rentals: rows,
  month: MONTH,
  subrent: { chatId: PARTNER_CHAT, pct: PCT },
  nowMs: Date.now(),
});

mkdirSync("/home/z/my-project/download", { recursive: true });
writeFileSync(`/home/z/my-project/download/${filename}`, markdown, "utf8");
console.log("WROTE /home/z/my-project/download/" + filename);
console.log("──────────────────────────────────────");
console.log(markdown);
