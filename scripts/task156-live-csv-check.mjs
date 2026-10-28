// task156 — live check: run the REAL buildRentalsCsv against prod DB and
// confirm the dispute comment renders in «Заметки» + «Верификация» cells.
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://inmctohsodgdohamhzag.supabase.co";
const { readFileSync } = await import("node:fs");
process.env.SUPABASE_SERVICE_ROLE_KEY = readFileSync("/home/z/cartest/.sb_key", "utf8").trim();

const { buildRentalsCsv } = await import("../lib/csv-builders/rentals-csv.ts");

const { csv, filename } = await buildRentalsCsv("vip-bike", "2026-10-20", "2026-10-20");
const lines = csv.split("\n");
const hit = lines.filter((l) => l.includes("Где наличка") || (l.includes("d7b4d4dc") && l.includes("спор")));
console.log("filename:", filename);
console.log("rows mentioning the comment:", lines.filter((l) => l.includes("Где наличка")).length);
for (const l of hit.slice(0, 3)) {
  console.log("RAW ROW:", l.slice(0, 700));
}
if (!hit.length) { console.log("NO MATCH — dumping tail of АРЕНДЫ block"); console.log(lines.slice(0, 40).join("\n").slice(0, 2000)); }
