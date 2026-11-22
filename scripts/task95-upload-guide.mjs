// Task 95 (2026-10-15) — upload clone-guide refresh + fresh full-data SQL dump
// to the public carpix bucket (backup-clone-2026-10/). Idempotent (upsert).
// Usage: node --env-file=.env.local scripts/task95-upload-guide.mjs

import { readFileSync } from "fs";

const URL_ = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
if (!URL_ || !KEY) { console.error("Missing SUPABASE env"); process.exit(1); }

const files = [
  ["docs/CLONE_PROJECT_GUIDE.html", "backup-clone-2026-10/CLONE_PROJECT_GUIDE.html", "text/html; charset=utf-8"],
  ["/home/z/my-project/backup-staging/cartest-backup-202610151358/data.sql", "backup-clone-2026-10/full-data-2026-10-15.sql", "application/sql; charset=utf-8"],
];

for (const [local, remote, ctype] of files) {
  const body = readFileSync(local);
  const res = await fetch(`${URL_}/storage/v1/object/carpix/${remote}`, {
    method: "POST",
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": ctype, "x-upsert": "true" },
    body,
  });
  const text = await res.text();
  console.log(`${res.ok ? "✓" : "✗"} carpix/${remote} → ${res.status} ${text.slice(0, 120)}`);
  if (res.ok) {
    const head = await fetch(`${URL_}/storage/v1/object/public/carpix/${remote}`, { method: "HEAD" });
    console.log(`   public HEAD: ${head.status}, ${head.headers.get("content-length")} bytes`);
  }
}
console.log("done");
