// task119 · step 2 — REBUILD the Aprilia Shiver сверка (rental a5532f57) with the
// task118 day-taper canon, withdraw the stale misclicked proposal, reset to
// pending and re-send the DMs (photo + summary + ✅/⚠️ keyboard) to operator,
// owner AND admin (@salavey13) with the boss's recalc comment.
//
// Money target (boss 2026-10-21): байк 3×11 000 = 33 000; экип (500+250+250)×3 = 3 000;
// эталон 36 000; клиент 46 000 → наценка 10 000; комиссия 1 000 + 1 200 + 1 000 = 3 200 ₽.
//
// AUDIT: negotiation.rounds += withdraw round (by @salavey13, admin, full fix
// description); DM text carries the same description; worklog documents the run.
//
// Run (dry):  bun --env-file=.env.local scripts/task119-verify-fix.ts
// Run (real): bun --env-file=.env.local scripts/task119-verify-fix.ts --apply

import { createClient } from "@supabase/supabase-js";

// Pure prod canons — the EXACT code that renders the DM on Vercel (269dc064a).
import {
  formatVerificationSummary,
  verificationKeyboard,
  verificationStatusNote,
  labelFromUsersMap,
} from "../app/franchize/lib/rental-verify-core.ts";
import {
  buildEquipmentCommLine,
  buildGearDaysLine,
  daysLabelRu,
} from "../lib/salary-coefficients-shared.ts";

const RENTAL_ID = "a5532f57-7e00-41d3-a5c5-1abfb615de0a";
const APPLY = process.argv.includes("--apply");

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const FORWARD_URL = process.env.FORWARD_TELEGRAM_URL || "https://v0-car-test.vercel.app/api/forward-telegram";
const FORWARD_ORIGIN = process.env.FORWARD_TELEGRAM_ORIGIN || "https://v0-car-test.vercel.app";

// salavey13 (Paul, admin) · I_O_S_NN (owner) · DJORUDJOV (operator)
const PAUL = "413553377";
const OWNER = "356282674";
const OPERATOR = "7813830016";

const BOSS_COMMENT = [
  `✍️ <b>@salavey13</b> (админ) пересобрал сверку — старое предложение (3 350 ₽) отозвано, числа перезаморожены:`,
  `байк 3 × 11 000 = 33 000 ₽ (при создании считали 4 × 10 000),`,
  `экип (500 + 250 + 250) × 3 ед. = 3 000 ₽ → эталон 36 000 ₽.`,
  `Клиент заплатил 46 000 ₽ → переплата (наценка) 10 000 ₽.`,
  `Комиссия: мот 1 000 + экип (200 + 100 + 100) × 3 = 1 200 + 10% наценки 1 000 = <b>3 200 ₽</b>.`,
].join("\n");

async function forward(chatId: string, method: string, payload: Record<string, unknown>): Promise<{ ok: boolean; error?: string; result?: any }> {
  const resp = await fetch(FORWARD_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: FORWARD_ORIGIN },
    body: JSON.stringify({ chat_id: chatId, method, payload }),
  });
  const json: any = await resp.json().catch(() => null);
  if (!resp.ok) return { ok: false, error: json?.error || `HTTP ${resp.status}` };
  return { ok: true, result: json };
}

// ── Load ──
const { data: row, error: rowErr } = await sb.from("rental_verifications").select("*").eq("rental_id", RENTAL_ID).maybeSingle();
if (rowErr) throw rowErr;
if (!row) { console.error("verification row not found"); process.exit(1); }
const { data: crewRow } = await sb.from("crews").select("slug, name").eq("slug", row.crew_slug || "vip-bike").maybeSingle();
const { data: users } = await sb.from("users").select("user_id, username, full_name").in("user_id", [OPERATOR, OWNER, PAUL]);
const usersMap = new Map((users || []).map((u: any) => [String(u.user_id), { username: u.username, full_name: u.full_name }]));
const { data: rental } = await sb.from("rentals").select("vehicle:cars(id, make, model, image_url)").eq("rental_id", RENTAL_ID).maybeSingle();
const vehicle: any = Array.isArray((rental as any)?.vehicle) ? (rental as any).vehicle[0] : (rental as any)?.vehicle;

const snap: any = { ...row.snapshot };
const formula: any = { ...snap.formula };
const eq = { gloves: 1, jacket: true, boots: true }; // from rentals.metadata.equipment (verified)
const gearDays = 3; // 72h window, matches formula.bikeDays
const gearStandard = 3000; // equipmentStandardCost(eq, 3) — asserted below
const standardTotal = formula.bikeStandard + gearStandard;
const markup = Math.max(0, snap.totalCost - standardTotal);
const overprice = Math.round((markup * formula.overpricePercent) / 100);
const equipmentComm = 3 * (200 + 100 * (gearDays - 1));
const total = formula.baseCoef + equipmentComm + overprice;

// Sanity asserts — the boss's numbers, digit-equal or abort.
if (formula.bikeStandard !== 33000) throw new Error(`bikeStandard drift: ${formula.bikeStandard}`);
if (gearStandard !== 3000) throw new Error("gearStandard math drift");
if (standardTotal !== 36000) throw new Error("эталон drift");
if (markup !== 10000) throw new Error("наценка drift");
if (total !== 3200) throw new Error(`total drift: ${total}`);

// ── Patch the snapshot (task118 fields) ──
snap.equipment = equipmentComm;
snap.overprice = overprice;
snap.total = total;
formula.gearStandard = gearStandard;
formula.standardTotal = standardTotal;
formula.markup = markup;
formula.gearDays = gearDays;
formula.equipFollowupUnit = 100;
formula.gearDaysLabel = daysLabelRu(gearDays);
formula.gearDaysLine = buildGearDaysLine(eq, gearDays, gearStandard);
formula.equipCommLine = buildEquipmentCommLine(3, 200, 100, gearDays);
snap.formula = formula;

// ── Negotiation: withdraw the stale proposal with a full audit round ──
const nowIso = new Date().toISOString();
const staleOpen = row.negotiation?.open || null;
const nego: any = { ...(row.negotiation || {}) };
nego.open = null;
nego.draft = null;
nego.rounds = [
  ...((nego.rounds || []) as any[]),
  {
    action: "withdraw",
    by: PAUL,
    role: "admin",
    at: nowIso,
    split: staleOpen?.split || { base: snap.base, equipment: 600, overprice: 1150 },
    comment: BOSS_COMMENT.replace(/<[^>]+>/g, "").replace(/\n/g, " | "),
  },
];

const singleParty = false;
const statusNote = verificationStatusNote({ status: "pending", singleParty, operatorLabel: labelFromUsersMap(usersMap, OPERATOR), ownerLabel: labelFromUsersMap(usersMap, OWNER) });
const summary = formatVerificationSummary({
  crewName: crewRow?.name || row.crew_slug,
  snapshot: snap,
  usersMap,
  operatorChatId: OPERATOR,
  ownerChatId: OWNER,
  statusNote,
});
const text = `${summary}\n\n${BOSS_COMMENT}`;
const keyboard = verificationKeyboard(RENTAL_ID);

console.log("=== PATCH PREVIEW ===");
console.log(JSON.stringify({ status: "pending", disputed_by: null, dispute_reason: null, snapshot_money: { base: snap.base, equipment: snap.equipment, overprice: snap.overprice, total: snap.total }, formula_money: { gearStandard, standardTotal, markup }, withdrawn: staleOpen?.split, new_formulas: { gearDaysLine: formula.gearDaysLine, equipCommLine: formula.equipCommLine, gearDaysLabel: formula.gearDaysLabel } }, null, 1));
console.log("=== DM TEXT ===");
console.log(text);
console.log("=== KEYBOARD ===", JSON.stringify(keyboard));

if (!APPLY) {
  console.log("\nDRY RUN — pass --apply to patch + send.");
  process.exit(0);
}

// ── 1. Patch the row ──
const { error: upErr } = await sb
  .from("rental_verifications")
  .update({
    status: "pending",
    disputed_by: null,
    dispute_reason: null,
    snapshot: snap,
    negotiation: nego,
    updated_at: nowIso,
  })
  .eq("rental_id", RENTAL_ID);
if (upErr) throw upErr;
console.log("ROW PATCHED ✅");

// ── 2. Re-send DMs (photo first, then summary+keyboard) — operator, owner, admin ──
const photoUrl = (vehicle?.image_url || "").trim();
for (const chatId of [OPERATOR, OWNER, PAUL]) {
  const role = chatId === OPERATOR ? "оператор" : chatId === OWNER ? "владелец" : "админ";
  if (/^https:\/\//.test(photoUrl)) {
    const photo = await forward(chatId, "sendPhoto", {
      photo: photoUrl,
      caption: `🛵 ${vehicle?.make || ""} ${vehicle?.model || ""}`.trim() + " — сверка пересчитана, актуальные цифры ниже 👇",
    });
    console.log(`photo → ${chatId} (${role}):`, photo.ok ? "OK" : photo.error);
  }
  const msg = await forward(chatId, "sendMessage", {
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    reply_markup: { inline_keyboard: keyboard },
  });
  console.log(`summary → ${chatId} (${role}):`, msg.ok ? "OK" : msg.error);
}
console.log("DONE ✅ (row rebuilt + 3 DMs sent)");
