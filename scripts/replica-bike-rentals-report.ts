// Live replica check: build the Мотопарк per-bike report with the REAL lib
// over REAL Supabase rows for the two bikes the boss pasted as samples.
// Run: bun scripts/replica-bike-rentals-report.ts
import { buildBikeRentalsReport, resolveReportClientName, type BikeReportRentalRow } from "../app/franchize/lib/bike-rentals-report";

const URL = "https://inmctohsodgdohamhzag.supabase.co";
const KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlubWN0b2hzb2RnZG9oYW1oemFnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczODMzOTU4NSwiZXhwIjoyMDUzOTE1NTg1fQ.xD91Es2o8T1vM-2Ok8iKCn4jGDA5TwBbapD5eqhblLM";

async function rest(path: string): Promise<unknown[]> {
  const res = await fetch(`${URL}/rest/v1/${path}`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return (await res.json()) as unknown[];
}

interface RawRental {
  rental_id: string;
  status: string | null;
  payment_status: string | null;
  total_cost: number | null;
  agreed_start_date: string | null;
  agreed_end_date: string | null;
  requested_start_date: string | null;
  requested_end_date: string | null;
  created_at: string | null;
  user_id: string | null;
  renter_name: string | null;
}

async function reportForBike(bikeId: string, label: string): Promise<string> {
  const raw = (await rest(
    `rentals?select=rental_id,status,payment_status,total_cost,agreed_start_date,agreed_end_date,requested_start_date,requested_end_date,created_at,user_id,metadata->>renter_name&vehicle_id=eq.${bikeId}`,
  )) as unknown as RawRental[];

  const userIds = Array.from(new Set(raw.map((r) => r.user_id).filter((v): v is string => typeof v === "string" && v.trim().length > 0)));
  const usersByName = new Map<string, { fullName: string | null; username: string | null }>();
  if (userIds.length > 0) {
    const users = (await rest(`users?select=user_id,full_name,username&user_id=in.(${userIds.join(",")})`)) as Array<{
      user_id: string | number;
      full_name: string | null;
      username: string | null;
    }>;
    for (const u of users) {
      usersByName.set(String(u.user_id), { fullName: u.full_name, username: u.username });
    }
  }

  const rows: BikeReportRentalRow[] = raw.map((r) => ({
    rentalId: String(r.rental_id),
    status: r.status ?? null,
    paymentStatus: r.payment_status ?? null,
    totalCost: r.total_cost == null ? null : Number(r.total_cost),
    agreedStart: r.agreed_start_date ?? null,
    agreedEnd: r.agreed_end_date ?? null,
    requestedStart: r.requested_start_date ?? null,
    requestedEnd: r.requested_end_date ?? null,
    createdAt: r.created_at ?? null,
    clientName: resolveReportClientName(r.user_id ? usersByName.get(String(r.user_id)) : undefined, r.renter_name),
  }));

  const out = buildBikeRentalsReport({ bikeLabel: label, bikeId, crewName: "VIP_BIKE", rentals: rows });
  return out.markdown;
}

console.log("========== YAMAHA R6 ==========");
console.log(await reportForBike("yamaha-r6-2007", "Yamaha R6"));
console.log("========== SUZUKI M109R ==========");
console.log(await reportForBike("suzuki-vzr1800-boulevard-2006", "Suzuki M109R 1800 Boulevard"));
