// task193 data fixes — APPLY phase (boss instruction, 2026-11-19):
//   1. cbr600rr 8bad98ff (11 Sep, Федотов): price 27500 → 7500, deposit
//      15000 → 20000 (top-level column + metadata.deposit_amount), append
//      a finance_edit comment explaining the 20k that wrongly sat in the
//      price (bank received 27500 = 7500 rent + 20000 deposit).
//      The verified сверка snapshot stays FROZEN (honesty contract) — the
//      boss is informed in the report.
//   2. Two phantom falcon-lynx «rentals» (created 2026-10-10 backdated to
//      2026-09-09, pending_confirmation, no price, no agreed date, empty
//      metadata): reference-checked, then DELETED (boss: «ditch'em»).
const SUPABASE_URL = "https://inmctohsodgdohamhzag.supabase.co";
const { readFileSync } = await import("node:fs");
const secrets = readFileSync("/home/z/my-project/upload/secrets_all.txt", "utf8");
const SRK = secrets.split("\n").find((l) => l.startsWith("SUPABASE_SERVICE_ROLE_KEY="))?.split("=").slice(1).join("=");
if (!SRK) { console.error("NO SERVICE KEY"); process.exit(2); }
const HDR = { apikey: SRK, Authorization: `Bearer ${SRK}`, "Content-Type": "application/json", Accept: "application/json" };

const CBR = "8bad98ff-f14c-4e19-a9c4-436ea647dcf9";
const LYNX = ["3bc69a27-f914-40c3-bc3a-6359fe0eaf6f", "0ffb583c-2b06-4947-87ee-199cd2bba827"];
const list = (ids) => ids.map((i) => `"${i}"`).join(",");

// ── 1. cbr600rr price/deposit fix (read-modify-write) ───────────────────────
{
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rentals?select=rental_id,total_cost,deposit_amount,metadata,agreed_start_date&rental_id=eq.${CBR}`, { headers: HDR });
  const [row] = await res.json();
  if (!row) { console.error("CBR row not found"); process.exit(1); }
  const before = { total: row.total_cost, deposit: row.deposit_amount };
  if (row.total_cost !== 27500 || row.agreed_start_date?.slice(0, 10) !== "2026-09-11") {
    console.error("ABORT: row changed since inspection — re-run inspect:", before, row.agreed_start_date);
    process.exit(1);
  }
  const meta = { ...(row.metadata || {}) };
  meta.deposit_amount = 20000;
  const comments = Array.isArray(meta.comments) ? [...meta.comments] : [];
  comments.push({
    text: "✍️ 19.11: цена 27500→7500, залог 15000→20000 — 20 000 ₽ залог ошибочно попал в цену (банк 27500 = 7500 аренда + 20000 залог)",
    at: new Date().toISOString(),
    by: "7813830016",
    kind: "finance_edit",
  });
  meta.comments = comments;
  const patch = { total_cost: 7500, deposit_amount: 20000, metadata: meta };
  const pRes = await fetch(`${SUPABASE_URL}/rest/v1/rentals?rental_id=eq.${CBR}`, {
    method: "PATCH", headers: HDR, body: JSON.stringify(patch),
  });
  console.log("CBR patch:", pRes.status, pRes.ok ? "OK" : (await pRes.text()).slice(0, 300));
  if (pRes.ok) {
    const [after] = await (await fetch(`${SUPABASE_URL}/rest/v1/rentals?select=total_cost,deposit_amount&rental_id=eq.${CBR}`, { headers: HDR })).json();
    console.log(`CBR verified: price ${before.total}→${after.total_cost}, deposit ${before.deposit}→${after.deposit_amount}`);
  }
}

// ── 2. falcon-lynx phantom rows: reference check, then DELETE ───────────────
for (const table of ["deposit_entries", "rental_verifications", "crew_todos"]) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*&rental_id=in.(${list(LYNX)})`, { headers: HDR });
  const rows = res.ok ? await res.json() : [{ error: `query failed ${res.status}` }];
  console.log(`refs in ${table}:`, Array.isArray(rows) ? rows.length : rows, JSON.stringify(rows).slice(0, 200));
}
for (const id of LYNX) {
  const dRes = await fetch(`${SUPABASE_URL}/rest/v1/rentals?rental_id=eq.${id}`, { method: "DELETE", headers: HDR });
  console.log(`DELETE ${id.slice(0, 8)}:`, dRes.status, dRes.ok ? "OK" : (await dRes.text()).slice(0, 200));
}
// final check — both must be gone
const check = await (await fetch(`${SUPABASE_URL}/rest/v1/rentals?select=rental_id&rental_id=in.(${list(LYNX)})`, { headers: HDR })).json();
console.log("remaining lynx rows:", check.length, check.length === 0 ? "(both ditched ✅)" : "⚠️ STILL THERE");
