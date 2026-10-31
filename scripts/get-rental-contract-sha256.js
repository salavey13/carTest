// /home/z/my-project/scripts/get-rental-contract-sha256.js
// Download both rental .docx files and compute their SHA256 hashes.
// These hashes are the doc_sha256 stored in user_rental_secrets (private schema)
// and used by claimRentalSecretsByDocSha to find the renter's secret.

const crypto = require("crypto");
const SUPABASE_URL = "https://inmctohsodgdohamhzag.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
if (!SUPABASE_SERVICE_KEY) {
  console.error("ENV MISSING: export SUPABASE_SERVICE_ROLE_KEY (legacy JWT or new sb_secret_ key) before running this script");
  process.exit(1);
}
const BUCKET = "rental-contracts";

const FILES = [
  { label: "Яков Головин (ducati-1199-panigale-2012)", path: "vip-bike/rental-ducati-1199-panigale-2012-1787332349600.docx" },
  { label: "Ладонежский Олег (ducati-panigale-s-electro-black-aero)", path: "vip-bike/rental-ducati-panigale-s-electro-black-aero-1787329759937.docx" },
];

async function main() {
  for (const file of FILES) {
    const url = `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${file.path}`;
    const res = await fetch(url, {
      headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
    });
    if (!res.ok) {
      console.error(`Failed to download ${file.path}: ${res.status}`);
      continue;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    const sha256 = crypto.createHash("sha256").update(buf).digest("hex");
    console.log(`${file.label}`);
    console.log(`  path: ${file.path}`);
    console.log(`  size: ${buf.length}`);
    console.log(`  sha256: ${sha256}`);
    console.log(`  sha256 (first 12): ${sha256.slice(0, 12)}`);
    console.log("");
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
