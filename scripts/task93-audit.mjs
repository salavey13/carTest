// Task 93 — write audit block into crews.metadata.specs.owner_fix_<STAMP>
// Usage: node --env-file=.env.local scripts/task93-audit.mjs <audit-key> [crew-slug]
import { readFileSync } from "fs";
const URL_ = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
if (!URL_ || !KEY) { console.error("Missing SUPABASE env"); process.exit(1); }
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

const auditKey = process.argv[2] || "owner_fix_20261014_clone_backup";
const slug = process.argv[3] || "vip-bike";

const crew = await fetch(`${URL_}/rest/v1/crews?select=id,slug,metadata&slug=eq.${slug}`, { headers: H }).then(r => r.json());
if (!crew?.[0]) { console.error("crew not found:", slug); process.exit(1); }
const meta = crew[0].metadata || {};
meta.specs = meta.specs || {};
meta.specs[auditKey] = {
  at: new Date().toISOString(),
  by: "super-z (main agent) on boss order in chat",
  reason: "deliver super-backup for restore into friend's fresh Supabase (project clone)",
  status: "applied_and_verified",
  artifact: {
    storage_prefix: "carpix/backup-clone-2026-10/",
    files: ["MANIFEST.json", "CLONE_PROJECT_GUIDE.html", "full-schema-2026-10-13.sql", "cartest-super-backup-20261013.zip.part0..3.bin"],
    zip_size_bytes: 132649008,
    zip_sha256: "ef26b9ddedf80528155531648d6d7cc4e0ce0067bc51d90d1636d6a2849ca87d",
    source: "scripts/task84-backup.mjs full dump: 117 tables, 11716 rows (incl. private-*), 19 buckets; orphans documented in backup MANIFEST",
  },
  scope_note: "read-only elsewhere; storage upload only (no data rows changed)",
};
const res = await fetch(`${URL_}/rest/v1/crews?slug=eq.${slug}`, {
  method: "PATCH", headers: H, body: JSON.stringify({ metadata: meta }),
});
console.log("PATCH crews:", res.status, "→", auditKey);
