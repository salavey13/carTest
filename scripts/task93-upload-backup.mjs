// Task 93 (2026-10-14) — upload super-backup parts + manifest to carpix
// bucket (public) and write an audit block into crews.metadata.specs.
// NOTE: backup lives ONLY in storage, never in the repo (user PII inside).
// Usage: node --env-file=.env.local scripts/task93-upload-backup.mjs

import { readFileSync } from "fs";

const URL_ = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
if (!URL_ || !KEY) { console.error("Missing SUPABASE env"); process.exit(1); }
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };

const PARTS_DIR = process.env.BACKUP_PARTS_DIR || "/home/z/my-project/backup-staging/parts";
const FULL_ZIP = process.env.BACKUP_ZIP || "/home/z/my-project/backup-staging/cartest-super-backup-20261013.zip";
const PREFIX = "backup-clone-2026-10";
const full = readFileSync(FULL_ZIP);
const sha256 = (await import("crypto")).createHash("sha256").update(full).digest("hex");
const partNames = process.argv.slice(2).length ? process.argv.slice(2) : readFileSync(`${PARTS_DIR}/../PARTS.txt`, "utf8").split("\n").filter(Boolean);

// 1. MANIFEST (what/how to join)
const manifest = {
  file: full.name || "cartest-super-backup.zip",
  size_bytes: full.length,
  sha256,
  parts: partNames.length,
  join: {
    linux_mac: "cat <file>.part*.bin > <file>.zip",
    windows: "copy /b <file>.part0.bin+<file>.part1.bin+… <file>.zip",
    check: "sha256sum <joined>.zip  →  ожидается " + sha256,
  },
  source_project: "inmctohsodgdohamhzag",
  made_by: "scripts/task84-backup.mjs @ commit HEAD (see MANIFEST inside zip for exact stamp)",
  contains: "data/*.json (all public + private-* tables, full rows), data.sql, storage/<bucket>/… , schema/*, MANIFEST.json",
  pii_warning: "Паспорта/ВУ/секреты экипажей. Держать файл в тайне, не выкладывать в публичные места.",
};
await fetch(`${URL_}/storage/v1/object/carpix/${PREFIX}/MANIFEST.json`, {
  method: "POST", headers: { ...H, "Content-Type": "application/json", "x-upsert": "true" },
  body: JSON.stringify(manifest),
}).then(async (r) => console.log("MANIFEST:", r.status));

// 2. parts
for (const name of partNames) {
  const buf = readFileSync(`${PARTS_DIR}/${name}`);
  const res = await fetch(`${URL_}/storage/v1/object/carpix/${PREFIX}/${name}`, {
    method: "POST", headers: { ...H, "Content-Type": "application/octet-stream", "x-upsert": "true" },
    body: buf,
  });
  console.log(name, res.status, buf.length, "bytes");
  if (!res.ok) process.exit(1);
}
console.log("done → carpix/" + PREFIX + "/");
