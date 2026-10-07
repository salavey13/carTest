// iter52b — doublecheck of the block-structured buildRentalsCsv on LIVE data.
// Boss spec: separate АРЕНДЫ/ЭКИП/СЕРВИС blocks; «Итого аренды» must NOT
// include service; ЭКИП/СЕРВИС pay no salary (already counted in rentals /
// official scheme has none). Run: bun scripts/iter52b-verify-csv.mjs
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

// Point lib/supabase-server's admin client at the same instance.
process.env.NEXT_PUBLIC_SUPABASE_URL ||= process.env.NEXT_PUBLIC_SUPABASE_URL;
globalThis.__SUPABASE_ADMIN__ = sb;

const { buildRentalsCsv } = await import("../lib/csv-builders/rentals-csv.ts");

const from = "2026-09-01";
const to = "2026-10-07";
const { csv, summary } = await buildRentalsCsv("vip-bike", from, to);

const lines = csv.split("\n");
const blockOf = {};
let cur = null;
for (const l of lines) {
  const t = l.replace(/\uFEFF/, "").trim();
  if (/^(АРЕНДЫ|ЭКИП|СЕРВИС|ПРОДАЖИ|СВОДКА)/.test(t)) { cur = t; blockOf[cur] = []; continue; }
  if (cur && t) blockOf[cur].push(l);
}

const pick = (arr, i) => arr.map((l) => l.split(",")[i] ?? "");

console.log("=== LIVE buildRentalsCsv vip-bike", from, "→", to, "===");
console.log("АРЕНДЫ rows:", blockOf["АРЕНДЫ"].length - 2, "| header:", blockOf["АРЕНДЫ"][0]);
console.log("  Итого аренды:", blockOf["АРЕНДЫ"].find((l) => l.startsWith("Итого аренды")));
console.log("ЭКИП rows:", blockOf["ЭКИП"].length - 2, "| header:", blockOf["ЭКИП"][0]);
console.log("  Итого экип:", blockOf["ЭКИП"].find((l) => l.startsWith("Итого экип")));
console.log("СЕРВИС rows:", blockOf["СЕРВИС"].length - 2, "| header:", blockOf["СЕРВИС"][0]);
console.log("  Итого сервис:", blockOf["СЕРВИС"].find((l) => l.startsWith("Итого сервис")));
console.log("ПРОДАЖИ rows:", blockOf["ПРОДАЖИ"].length - 2);
console.log("  Итого продажи:", blockOf["ПРОДАЖИ"].find((l) => l.startsWith("Итого продажи")));
console.log("СВОДКА:");
for (const l of blockOf["СВОДКА"]) console.log("  ", l);

// ── Assertions (boss spec) ────────────────────────────────────────────────
const assert = (cond, msg) => { if (!cond) { console.error("FAIL:", msg); process.exitCode = 1; } else console.log("OK:", msg); };

// 1. Blocks are separate banners
assert(["АРЕНДЫ", "ЭКИП", "СЕРВИС", "ПРОДАЖИ", "СВОДКА"].every((b) => blockOf[b]), "all 5 blocks present");

// 2. ЭКИП header has NO ЗП column
const eqHeader = blockOf["ЭКИП"][0];
assert(!eqHeader.includes("ЗП"), "ЭКИП block has no ЗП column");

// 3. СЕРВИС header has NO ЗП column
const svcHeader = blockOf["СЕРВИС"][0];
assert(!svcHeader.includes("ЗП"), "СЕРВИС block has no ЗП column");

// 4. СВОДКА: ЭКИП and СЕРВИС rows carry ЗП=0
const sv = blockOf["СВОДКА"];
const eqRow = sv.find((l) => l.startsWith("Экип,"));
const svcRow = sv.find((l) => l.startsWith("Сервис,"));
assert(eqRow && eqRow.split(",")[3] === "0", `СВОДКА Экип ЗП=0 (${eqRow})`);
assert(svcRow && svcRow.split(",")[3] === "0", `СВОДКА Сервис ЗП=0 (${svcRow})`);

// 5. Итого аренды revenue == СВОДКА Аренды revenue (service NOT inside)
const itogoRent = blockOf["АРЕНДЫ"].find((l) => l.startsWith("Итого аренды")).split(",");
const svRent = sv.find((l) => l.startsWith("Аренды,")).split(",");
assert(Number(itogoRent[3]) === Number(svRent[2]), `Итого аренды ${itogoRent[3]} == СВОДКА Аренды выручка ${svRent[2]}`);

// 6. ЗП всего = ЗП аренды + ЗП продажи only
const itogoSales = blockOf["ПРОДАЖИ"].find((l) => l.startsWith("Итого продажи")).split(",");
const vsego = sv.find((l) => l.startsWith("ВСЕГО,")).split(",");
assert(Number(vsego[3]) === Number(itogoRent[1]) + Number(itogoSales[1]), `ВСЕГО ЗП ${vsego[3]} = аренды ${itogoRent[1]} + продажи ${itogoSales[1]}`);

// 7. builder summary agrees with СВОДКА
assert(summary.totalSalary === Number(vsego[3]), "summary.totalSalary == СВОДКА");
assert(summary.blocks.rentals.count === Number(svRent[1]), "summary blocks.rentals.count");

console.log(process.exitCode ? "=== DOUBLECHECK FAILED ===" : "=== DOUBLECHECK PASSED ===");
