// Task 93 (2026-10-14) — STORAGE AUDIT v2 (RECURSIVE): per-bucket object
// counts + bytes, free-hobby-plan headroom (1 GB file storage).
// Read-only. Usage: node --env-file=.env.local scripts/task93-storage-audit.mjs [--json out.json]

import { writeFileSync } from "fs";

const URL_ = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
if (!URL_ || !KEY) {
  console.error("Missing SUPABASE env");
  process.exit(1);
}
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

const buckets = await (await fetch(`${URL_}/storage/v1/bucket`, { headers: H })).json();
const rows = [];
let totalBytes = 0, totalObjects = 0;

for (const b of buckets) {
  // recursive DFS over folder placeholders (id:null), offset pagination
  const queue = [""];
  let objects = 0, bytes = 0, folders = 0;
  while (queue.length) {
    const prefix = queue.shift();
    let offset = 0;
    for (;;) {
      const res = await fetch(`${URL_}/storage/v1/object/list/${b.name}`, {
        method: "POST", headers: H,
        body: JSON.stringify({ prefix, limit: 1000, offset, sortBy: { column: "name", order: "asc" } }),
      });
      if (!res.ok) { console.error(`list ${b.name} @ "${prefix}": ${res.status}`); break; }
      const chunk = await res.json();
      for (const obj of chunk) {
        if (obj.id == null && obj.name) {
          folders++;
          queue.push(obj.name.endsWith("/") ? obj.name : `${obj.name}/`);
        } else if (obj.id != null && obj.name && !obj.name.endsWith("/")) {
          objects++;
          bytes += obj.metadata?.size || 0;
        }
      }
      if (chunk.length < 1000) break;
      offset += 1000;
    }
  }
  totalObjects += objects;
  totalBytes += bytes;
  rows.push({ bucket: b.name, public: b.public, objects, folders, bytes, file_size_limit: b.file_size_limit });
  console.log(`${b.name.padEnd(22)} ${String(objects).padStart(6)} obj ${String(folders).padStart(4)} f  ${(bytes / 1048576).toFixed(1).padStart(9)} MB`);
}

console.log("─".repeat(56));
console.log(`${"TOTAL".padEnd(22)} ${String(totalObjects).padStart(6)} obj        ${(totalBytes / 1048576).toFixed(1).padStart(9)} MB`);
console.log(`Storage plan 1 GB (hobby): used ${(totalBytes / 1073741824 * 100).toFixed(1)}%, free ${((1073741824 - totalBytes) / 1048576).toFixed(0)} MB`);

if (process.argv.includes("--json")) {
  const out = process.argv[process.argv.indexOf("--json") + 1];
  writeFileSync(out, JSON.stringify({ generated: new Date().toISOString(), rows, totalObjects, totalBytes }, null, 2));
  console.log("json →", out);
}
