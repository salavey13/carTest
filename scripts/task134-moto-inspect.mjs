// task134: read moto-selection crew services from Supabase public.cars (read-only)
import fs from "node:fs";

const env = fs.readFileSync("/home/z/cartest/.env.local", "utf8");
const srk = (env.match(/^SUPABASE_SERVICE_ROLE_KEY=(.*)$/m) || [])[1]?.trim();
if (!srk) { console.error("no service key"); process.exit(1); }
const url = "https://inmctohsodgdohamhzag.supabase.co/rest/v1";
const H = { apikey: srk, Authorization: `Bearer ${srk}` };

const crews = await fetch(`${url}/crews?select=id,name,slug&slug=eq.moto-selection`, { headers: H }).then(r => r.json());
console.log("crew:", JSON.stringify(crews));
if (!crews?.length) process.exit(0);
const crewId = crews[0].id;

const cars = await fetch(
  `${url}/cars?select=id,make,model,description,image_url,daily_price,type&crew_id=eq.${crewId}&order=type.asc,make.asc`,
  { headers: H }
).then(r => r.json());
console.log(`\ncars (${cars.length}):`);
for (const c of cars) {
  console.log(`- [${c.type}] ${c.make} ${c.model ?? ""} | ${c.daily_price ?? "-"} | ${(c.description || "").slice(0, 110)}`);
  if (c.image_url) console.log(`    img: ${c.image_url.slice(0, 100)}`);
}

// crew metadata theme/palette for visual consistency
const full = await fetch(`${url}/crews?select=metadata&slug=eq.moto-selection`, { headers: H }).then(r => r.json());
const meta = full?.[0]?.metadata ?? {};
const fr = meta.franchize ?? meta;
console.log("\ntheme:", JSON.stringify(fr.theme ?? fr.palette ?? {}).slice(0, 400));
console.log("contacts:", JSON.stringify(fr.contacts ?? {}).slice(0, 500));
