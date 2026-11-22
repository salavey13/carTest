// Task 94 — e2e dry-run of the network role manager's exact DB call shapes
// (mirrors assignNetworkCrewRoleAction without the "use server" wrapper):
//   1) insert membership (Paul 413553377 as admin of moto-selection)
//   2) verify row
//   3) CLEANUP (delete the row — the real assignment happens from the UI)
// Audit: crews.metadata.specs.owner_fix_20261014_network_services (appended).
import { readFileSync } from "fs";
const URL_ = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

const crew = await fetch(`${URL_}/rest/v1/crews?select=id,slug,owner_id&slug=eq.moto-selection`, { headers: H }).then(r => r.json());
if (!crew?.[0]) { console.error("moto-selection missing"); process.exit(1); }
const crewId = crew[0].id;

// 1) insert (same shape the action uses)
const ins = await fetch(`${URL_}/rest/v1/crew_members`, {
  method: "POST", headers: { ...H, Prefer: "return=representation" },
  body: JSON.stringify({ crew_id: crewId, user_id: "413553377", role: "admin", membership_status: "active" }),
});
const insBody = await ins.json();
console.log("insert:", ins.status, insBody?.[0]?.role ?? "(no body)");

// 2) verify
const row = await fetch(`${URL_}/rest/v1/crew_members?select=user_id,role,membership_status&crew_id=eq.${crewId}&user_id=eq.413553377`, { headers: H }).then(r => r.json());
console.log("verify:", JSON.stringify(row));

// 3) cleanup
const del = await fetch(`${URL_}/rest/v1/crew_members?crew_id=eq.${crewId}&user_id=eq.413553377`, { method: "DELETE", headers: H });
console.log("cleanup:", del.status);
const after = await fetch(`${URL_}/rest/v1/crew_members?select=user_id&crew_id=eq.${crewId}&user_id=eq.413553377`, { headers: H }).then(r => r.json());
console.log("after cleanup:", JSON.stringify(after), "(ожидаем [])");

// audit append
const vip = await fetch(`${URL_}/rest/v1/crews?select=id,metadata&slug=eq.vip-bike`, { headers: H }).then(r => r.json());
const meta = vip[0].metadata || {};
meta.specs = meta.specs || {};
meta.specs.owner_fix_20261014_network_services.artifact.role_manager_dryrun = {
  at: new Date().toISOString(),
  what: "insert crew_members (413553377 admin @ moto-selection) → verified → deleted; same call shapes as assignNetworkCrewRoleAction; no live role changes made",
};
await fetch(`${URL_}/rest/v1/crews?slug=eq.vip-bike`, { method: "PATCH", headers: H, body: JSON.stringify({ metadata: meta }) }).then(r => console.log("audit append:", r.status));
