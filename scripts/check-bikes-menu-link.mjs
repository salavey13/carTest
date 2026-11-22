// Check live vip-bike crew header.menuLinks for the /bikes link + footer + profile hub
const url = "https://inmctohsodgdohamhzag.supabase.co";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

const res = await fetch(
  `${url}/rest/v1/crews?select=id,slug,header,footer,metadata&slug=eq.vip-bike`,
  { headers: { apikey: key, Authorization: `Bearer ${key}` } },
);
if (!res.ok) {
  console.error("HTTP", res.status, await res.text());
  process.exit(1);
}
const crews = await res.json();
const crew = crews[0];
const menuLinks = crew?.header?.menuLinks || [];
console.log("=== header.menuLinks (" + menuLinks.length + ") ===");
for (const l of menuLinks) console.log(`- ${l.label} → ${l.href}`);
console.log("\nbikes link present:", menuLinks.some((l) => String(l.href || "").includes("/bikes")));

// footer link check
const footerStr = JSON.stringify(crew?.footer || {});
console.log("\nfooter mentions bikes:", /bikes/.test(footerStr));

// profile hub check (metadata?)
const metaStr = JSON.stringify(crew?.metadata || {});
console.log("metadata mentions bikes:", /bikes|Мотопарк/i.test(metaStr));

// where does the app render profile hub buttons? check metadata keys
console.log("\nmetadata keys:", Object.keys(crew?.metadata || {}));
