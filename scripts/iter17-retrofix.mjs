// iter17 retrofix: 3 rental totals + cancel stale duplicate + backfill web-renter secrets
// Usage: node scripts/iter17-retrofix.mjs [--apply]
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";

const APPLY = process.argv.includes("--apply");
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const priv = (table) => sb.schema("private").from(table);

const NOW = new Date().toISOString();
const note = (text) => ({ corrected_at: NOW, corrected_by: "iter17 retrofix (voice notes 2026-08-29)", text });

// ─── 1. Rental total corrections ────────────────────────────────────────────
const fixes = [
  {
    rentalId: "08d80058-8f44-43f9-9088-785e9f956a75",
    vehicle: "kawasaki-ex650k",
    from: 5000, to: 3500,
    artifactId: "f12a8bdf-c53d-4327-b0f4-6f89af80783d",
    breakdown: "Аренда 1,5 часа — 3 000 ₽ + шлем — 500 ₽ = 3 500 ₽ (голосовая заметка)",
    equipmentPatch: { helmets: 1 },
    splitPatch: { bank: 3500 },
    overridePatch: { price_override_amount: 3500 },
  },
  {
    rentalId: "63d243f1-fc1b-4953-aea0-a39d43408029",
    vehicle: "yamaha-r6-2007",
    from: 5000, to: 3500,
    artifactId: "9677c7a1-9632-488a-bd06-5aac40146359",
    breakdown: "Аренда 1,5 часа — 3 000 ₽ + шлем — 500 ₽ = 3 500 ₽ (голосовая заметка)",
    equipmentPatch: { helmets: 1 },
    splitPatch: { bank: 3500 },
  },
  {
    rentalId: "7ced14e6-0423-4bd9-9f3d-570cec1e78b1",
    vehicle: "ducati-panigale-s-electro-green",
    from: 8500, to: 7800,
    artifactId: "bc29e51f-d195-447b-8730-cf5f831e4e28",
    breakdown: "Аренда 3 часа — 6 000 ₽ + шлем — 1 000 ₽ + продажа балаклавы — 800 ₽ = 7 800 ₽ (голосовая заметка)",
    splitPatch: { cash: 27800 }, // 7800 + 20000 deposit
  },
];

console.log(APPLY ? "=== APPLY MODE ===" : "=== DRY RUN ===");

for (const f of fixes) {
  const { data: rental } = await sb.from("rentals").select("rental_id, vehicle_id, status, total_cost, metadata").eq("rental_id", f.rentalId).maybeSingle();
  if (!rental) { console.log(`✗ ${f.vehicle}: rental NOT FOUND`); continue; }
  if (rental.total_cost !== f.from) { console.log(`⚠ ${f.vehicle}: total_cost is ${rental.total_cost}, expected ${f.from} — SKIP (already fixed?)`); continue; }

  const md = rental.metadata || {};
  const newMd = {
    ...md,
    ...(f.equipmentPatch ? { equipment: { ...(md.equipment || {}), ...f.equipmentPatch } } : {}),
    ...(md.payment_split && f.splitPatch ? { payment_split: { ...md.payment_split, ...f.splitPatch } } : {}),
    ...(f.overridePatch && md.price_overridden ? { ...f.overridePatch } : {}),
    manual_correction: note(f.breakdown),
  };
  console.log(`→ ${f.vehicle} (${f.rentalId.slice(0, 8)}): total_cost ${f.from} → ${f.to}; equipment ${JSON.stringify(f.equipmentPatch ?? {})}; split ${JSON.stringify(f.splitPatch ?? {})}`);
  if (APPLY) {
    const { error: e1 } = await sb.from("rentals").update({ total_cost: f.to, metadata: newMd }).eq("rental_id", f.rentalId);
    if (e1) console.log("  ✗ rentals update failed:", e1.message);
    const { error: e2 } = await priv("rental_contract_artifacts").update({ total_sum: f.to }).eq("id", f.artifactId);
    if (e2) console.log("  ✗ artifact update failed:", e2.message);
  }
}

// ─── 2. Cancel the stale pending_confirmation duplicate (false-busy blocker) ─
{
  const dupId = "5626326b-3644-4987-ab91-e79414bf382c";
  const { data: dup } = await sb.from("rentals").select("rental_id, status, metadata").eq("rental_id", dupId).maybeSingle();
  if (dup && dup.status === "pending_confirmation") {
    console.log(`→ cancel stale duplicate ${dupId.slice(0, 8)} (kawasaki, Морозов 09:32, двойной submit — блокировал повторную аренду)`);
    if (APPLY) {
      const md = dup.metadata || {};
      const { error } = await sb.from("rentals").update({
        status: "cancelled",
        metadata: { ...md, manual_correction: note("Дубль заказа (double submit через 10 сек после 7bb1b3cc) — аренда прошла по 7bb1b3cc, эта строка отменена; именно она ложно блокировала повторную аренду Kawasaki в тот же день.") },
      }).eq("rental_id", dupId);
      if (error) console.log("  ✗ duplicate cancel failed:", error.message);
    }
  } else if (dup) {
    console.log(`⚠ duplicate ${dupId.slice(0, 8)} status = ${dup.status} — skip`);
  }
}

// ─── 3. Backfill user_rental_secrets for past WEB renters ──────────────────
// Rents placed via the web app have artifacts with telegram_chat_id = RENTER
// (created_by_operator_chat_id is NULL). /doc artifacts have
// telegram_chat_id = OPERATOR until the renter claims the QR — excluded by
// the operatorKeyed guard. Crew members are skipped (their chat_id would
// pollute their own prefill with renter data).
{
  const { data: arts, error } = await priv("rental_contract_artifacts")
    .select("id, telegram_chat_id, created_by_operator_chat_id, crew_slug, renter_full_name, renter_phone, renter_passport, renter_passport_issued_by, renter_passport_issue_date, renter_registration, renter_driver_license, renter_birth_date, license_categories, created_at")
    .not("telegram_chat_id", "is", null)
    .gte("created_at", "2026-06-01T00:00:00Z")
    .order("created_at", { ascending: true });
  if (error) { console.log("✗ artifacts query failed:", error.message); process.exit(1); }

  // Live DB may lack license_categories/license_expiry_date (migration
  // 20260708000000 not applied yet) — writes fail with PGRST204. Strip them.
  const probe = await priv("user_rental_secrets").select("license_categories").limit(1);
  const licenseColsOk = !probe.error;
  console.log(licenseColsOk ? "(license columns present)" : "(license columns MISSING on live DB — writing without them; apply migration 20260708000000)");
  const strip = (payload) => {
    if (licenseColsOk) return payload;
    const out = { ...payload };
    delete out.license_categories;
    delete out.license_expiry_date;
    return out;
  };

  // crew guard data (vip-bike)
  const crewBySlug = {};
  for (const slug of new Set(arts.map((a) => a.crew_slug).filter(Boolean))) {
    const { data: crew } = await sb.from("crews").select("id, owner_id").eq("slug", slug).maybeSingle();
    if (!crew) continue;
    const { data: members } = await sb.from("crew_members").select("user_id").eq("crew_id", crew.id);
    crewBySlug[slug] = new Set([crew.owner_id, ...(members ?? []).map((m) => m.user_id)]);
  }

  // existing prefill rows keyed by chat|crew
  let existingRows = null;
  { const baseCols = "id, chat_id, crew_slug, source_doc_key, verification_status, renter_full_name, renter_phone, renter_passport, renter_passport_issued_by, renter_passport_issue_date, renter_registration, renter_driver_license, renter_birth_date";
    let q = priv("user_rental_secrets").select(baseCols + (licenseColsOk ? ", license_categories" : "")).eq("source_doc_key", "profile_prefill");
    const res = await q; existingRows = res.data;
    if (res.error) console.log("⚠ existing prefill rows query failed:", res.error.message); }
  const key = (chat, crew) => `${chat}|${crew}`;
  const byKey = new Map((existingRows ?? []).map((r) => [key(r.chat_id, r.crew_slug), r]));

  let created = 0, updated = 0, skipped = 0;
  for (const a of arts) {
    const chat = String(a.telegram_chat_id || "").trim();
    const crew = String(a.crew_slug || "").trim();
    if (!chat || !crew) { skipped++; continue; }
    // operator-keyed artifact (QR not claimed) → chat_id is the OPERATOR, not the renter
    if (a.created_by_operator_chat_id && String(a.created_by_operator_chat_id) === chat) { skipped++; continue; }
    // crew member guard
    if (crewBySlug[crew]?.has(chat)) { skipped++; continue; }
    const incoming = {
      renter_full_name: a.renter_full_name || null,
      renter_phone: a.renter_phone || null,
      renter_passport: a.renter_passport || null,
      renter_passport_issued_by: a.renter_passport_issued_by || null,
      renter_passport_issue_date: a.renter_passport_issue_date || null,
      renter_registration: a.renter_registration || null,
      renter_driver_license: a.renter_driver_license || null,
      renter_birth_date: a.renter_birth_date || null,
      license_categories: a.license_categories || null,
    };
    if (!Object.values(incoming).some(Boolean)) { skipped++; continue; }

    const existing = byKey.get(key(chat, crew));
    if (existing) {
      const merged = {};
      for (const [k, v] of Object.entries(incoming)) {
        if (!licenseColsOk && (k === "license_categories" || k === "license_expiry_date")) continue;
        merged[k] = v ?? existing[k] ?? null;
      }
      const changed = Object.entries(merged).some(([k, v]) => v !== existing[k]);
      if (!changed) { skipped++; continue; }
      console.log(`↻ update prefill ${chat} @ ${crew}: ${JSON.stringify(Object.fromEntries(Object.entries(merged).filter(([k, v]) => v !== existing[k])))}`);
      if (APPLY) {
        const { error: ue } = await priv("user_rental_secrets").update({ ...strip(merged), verification_status: "verified", updated_at: NOW }).eq("chat_id", chat).eq("crew_slug", crew).eq("source_doc_key", "profile_prefill");
        if (ue) console.log("  ✗ update failed:", ue.message); else updated++;
      } else updated++;
    } else {
      console.log(`+ create prefill ${chat} @ ${crew}: ${a.renter_full_name}${a.renter_passport ? " • паспорт ✓" : ""}${a.renter_driver_license ? " • ВУ ✓" : ""}`);
      if (APPLY) {
        const docSha = createHash("sha256").update(`profile_prefill_${chat}_${crew}`).digest("hex");
        const { error: ie } = await priv("user_rental_secrets").insert(strip({
          chat_id: chat, crew_slug: crew, doc_sha256: docSha,
          ...incoming,
          source_doc_key: "profile_prefill",
          verification_status: "verified",
          template_version: 1,
          updated_at: NOW,
        }));
        if (ie) console.log("  ✗ insert failed:", ie.message); else created++;
      } else created++;
      byKey.set(key(chat, crew), { chat_id: chat, crew_slug: crew, ...incoming });
    }
  }
  console.log(`prefill backfill: ${created} created, ${updated} updated, ${skipped} skipped`);
}

console.log(APPLY ? "DONE (applied)" : "DONE (dry run — pass --apply to execute)");
