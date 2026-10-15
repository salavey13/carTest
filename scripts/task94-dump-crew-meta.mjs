// Task 94 — dump crew metadata (vip-bike ads + georg-electro + nn pattern) to /tmp files
import { writeFileSync } from "fs";
const U = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
const K = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const H = { apikey: K, Authorization: `Bearer ${K}` };

const slugs = process.argv.slice(2).length ? process.argv.slice(2) : ["vip-bike", "georg-electro", "nn-bikeland", "nn-motogor"];
const crews = await fetch(`${U}/rest/v1/crews?select=slug,name,description,metadata&slug=in.(${slugs.join(",")})`, { headers: H }).then(r => r.json());
for (const c of crews) {
  writeFileSync(`/tmp/crew-${c.slug}.json`, JSON.stringify(c.metadata, null, 1));
  console.log(c.slug, "→", `/tmp/crew-${c.slug}.json`, Object.keys(c.metadata || {}).length, "meta keys");
}
