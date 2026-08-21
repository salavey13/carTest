// /home/z/my-project/scripts/recreate-failed-rentals.js
// Recreate the two failed /doc rentals from today and link them to the
// renter users via the QR claim flow.
//
// Two rentals to recreate:
//   1. Головин Яков Алексеевич + Ducati 1199 Panigale (ducati-1199-panigale-2012)
//      - phone: +79040695691
//      - renter TG chat_id: 1317807980 (Яков Головин @Golovin91)
//      - doc_sha256: 8d8c8502951e9e09aa5c82d760f2986c4fa2067fc48d2f82e28851cfb927eb13
//      - dates: 21.08.2026 20:30 → 22.08.2026 20:30 (1 day, "сегодня 20:30" in TG message)
//      - daily_price: 18000 ₽
//      - total_cost: 18000 ₽ (1 day)
//      - odometer_before: 28036
//      - deposit: 0 (not mentioned in message for this rental)
//      - equipment: none mentioned
//      - license category: A
//      - passport: 2212 982247 22.01.2013 ОТДЕЛОМ УФМС РОССИИ...
//      - birth: 17.12.1991
//      - address: обл. Нижегородская, с. Редькино, дом 12а
//
//   2. Ладонежский Олег Борисович + Ducati Panigale S Electro Black Aero
//      - phone: +79200599059
//      - renter TG chat_id: 1440836416 (Найджел Лоринг @NigelLoring)
//      - doc_sha256: 0386e2a6ffd9959e30d8efbac227b95719a83c80123c49b36b0a10eacef7d748
//      - dates: 21.08.2026 20:00 → 22.08.2026 20:00 (1 day)
//      - daily_price: 10000 ₽
//      - total_cost: 10000 ₽ (1 day)
//      - odometer_before: 2326
//      - deposit: 20000 ₽ (cash)
//      - equipment: none mentioned
//      - license category: A
//      - passport: 2226 030655 18.03.2026 ГУ МВД РОССИИ ПО НИЖЕГОРОДСКОЙ ОБЛАСТИ
//      - birth: 08.02.1981
//      - address: Нижегородская обл., г. Дзержинск, пр-кт Циолковского, д. 21, кв. 49
//
// Steps:
//   A) Insert rentals table rows (with operator as user_id placeholder, renter linked later via RPC)
//   B) Update private.rental_contract_artifacts.rental_id = new rental_id (matched by doc_sha256)
//   C) Call public.claim_rental_by_qr RPC (doc_sha256, renter_chat_id) — atomically links
//      rental.user_id, secrets, artifacts, todos, intents, lead_notes
//   D) Update rentals.metadata to include all the operator-collected data
//      (renter_name, renter_phone, doc_sha256, equipment, deposit, payment_split, etc.)
//   E) Update crew_todos to point to the new rental_id (so they don't dangle)
//
// DRY-RUN by default. Pass --commit to actually persist.

const SUPABASE_URL = "https://inmctohsodgdohamhzag.supabase.co";
const SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlubWN0b2hzb2RnZG9oYW1oemFnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczODMzOTU4NSwiZXhwIjoyMDUzOTE1NTg1fQ.xD91Es2o8T1vM-2Ok8iKCn4jGDA5TwBbapD5eqhblLM";
const CREW_ID = "2d5fde70-1dd3-4f0d-8d72-66ccf6908746";  // vip-bike
const OPERATOR_TG_ID = "413553377";  // salavey13 (the operator who ran /doc)
const CREW_OWNER_TG_ID = "356282674";  // I_O_S_NN (current single owner)

const COMMIT = process.argv.includes("--commit");

const headers = {
  apikey: SUPABASE_SERVICE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

const RENTALS = [
  {
    label: "Яков Головин — Ducati 1199 Panigale",
    bikeId: "ducati-1199-panigale-2012",
    renterChatId: "1317807980",
    renterName: "Головин Яков Алексеевич",
    renterPhone: "+79040695691",
    passportSeries: "2212",
    passportNumber: "982247",
    passportIssueDate: "22.01.2013",
    passportIssuedBy: "ОТДЕЛОМ УФМС РОССИИ ПО НИЖЕГОРОДСКОЙ ОБЛАСТИ В ГОРОДСКОМ ОКРУГЕ ГОРОД БОР",
    birthDate: "17.12.1991",
    registration: "обл. Нижегородская, с. Редькино, дом 12а",
    licenseCategory: "A",
    startDate: "2026-08-21T20:30:00+03:00",  // MSK 20:30 = UTC 17:30
    endDate: "2026-08-22T20:30:00+03:00",
    dailyPrice: 18000,
    totalCost: 18000,
    odometerBefore: 28036,
    deposit: 0,  // no deposit mentioned
    docSha256: "8d8c8502951e9e09aa5c82d760f2986c4fa2067fc48d2f82e28851cfb927eb13",
  },
  {
    label: "Ладонежский Олег — Ducati Panigale S Electro Black Aero",
    bikeId: "ducati-panigale-s-electro-black-aero",
    renterChatId: "1440836416",
    renterName: "Ладонежский Олег Борисович",
    renterPhone: "+79200599059",
    passportSeries: "2226",
    passportNumber: "030655",
    passportIssueDate: "18.03.2026",
    passportIssuedBy: "ГУ МВД РОССИИ ПО НИЖЕГОРОДСКОЙ ОБЛАСТИ",
    birthDate: "08.02.1981",
    registration: "Нижегородская обл., г. Дзержинск, пр-кт Циолковского, д. 21, кв. 49",
    licenseCategory: "A",
    startDate: "2026-08-21T20:00:00+03:00",  // MSK 20:00
    endDate: "2026-08-22T20:00:00+03:00",
    dailyPrice: 10000,
    totalCost: 10000,
    odometerBefore: 2326,
    deposit: 20000,  // cash
    docSha256: "0386e2a6ffd9959e30d8efbac227b95719a83c80123c49b36b0a10eacef7d748",
  },
];

async function rpc(name, params) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers,
    body: JSON.stringify(params),
  });
  const data = await res.json();
  return { ok: res.ok, status: res.status, data };
}

async function main() {
  console.log(`Mode: ${COMMIT ? "⚠️  COMMIT" : "🔍 DRY RUN"}`);
  console.log("");

  for (const r of RENTALS) {
    console.log(`=== ${r.label} ===`);
    console.log(`  renter: ${r.renterName} (${r.renterPhone}) → TG ${r.renterChatId}`);
    console.log(`  bike: ${r.bikeId}`);
    console.log(`  dates: ${r.startDate} → ${r.endDate}`);
    console.log(`  cost: ${r.totalCost} ₽ (daily ${r.dailyPrice})`);
    console.log(`  odometer_before: ${r.odometerBefore}`);
    console.log(`  deposit: ${r.deposit} ₽`);
    console.log(`  doc_sha256: ${r.docSha256.slice(0, 12)}...`);

    // ── Step A: Insert rental row ──
    // Use operator's TG ID as user_id initially (matching the /doc flow),
    // so claim_rental_by_qr RPC can later update user_id → renterChatId.
    const rentalInsert = {
      user_id: OPERATOR_TG_ID,  // operator placeholder, RPC will overwrite
      owner_id: CREW_OWNER_TG_ID,
      created_by_operator_chat_id: OPERATOR_TG_ID,
      crew_id: CREW_ID,
      vehicle_id: r.bikeId,
      requested_start_date: r.startDate,
      requested_end_date: r.endDate,
      agreed_start_date: r.startDate,
      agreed_end_date: r.endDate,
      status: "active",
      payment_status: "fully_paid",
      total_cost: r.totalCost,
      metadata: {
        source: "doc_command_recovery",
        created_by: "manual-recovery-script",
        doc_sha256: r.docSha256,
        renter_name: r.renterName,
        renter_phone: r.renterPhone,
        renter_passport: `${r.passportSeries} ${r.passportNumber}`,
        renter_passport_issue_date: r.passportIssueDate,
        renter_passport_issued_by: r.passportIssuedBy,
        renter_birth_date: r.birthDate,
        renter_registration: r.registration,
        renter_license_category: r.licenseCategory,
        daily_price: r.dailyPrice,
        odometer_before: r.odometerBefore,
        deposit_amount: r.deposit,
        deposit_method: r.deposit > 0 ? "cash" : null,
        equipment: {},
        contract_verifier: {
          status: "verified",
          verified_at: new Date().toISOString(),
          source: "doc_command",
          doc_sha256: r.docSha256,
        },
        recovery_note: "Manually recreated on 2026-08-21 because original /doc flow failed (multiple owners in crew_members caused resolveCrewOwnerChatId to throw).",
      },
    };

    let rentalId;
    if (COMMIT) {
      const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/rentals?select=rental_id`, {
        method: "POST",
        headers,
        body: JSON.stringify(rentalInsert),
      });
      const insertData = await insertRes.json();
      if (!insertRes.ok || !insertData[0]?.rental_id) {
        console.error(`  ❌ Failed to insert rental: ${insertRes.status} ${JSON.stringify(insertData)}`);
        continue;
      }
      rentalId = insertData[0].rental_id;
      console.log(`  ✅ Rental created: ${rentalId}`);
    } else {
      console.log(`  → would insert rental row (dry run)`);
    }

    if (!COMMIT) {
      console.log("");
      continue;
    }

    // ── Step B: Update private.rental_contract_artifacts.rental_id ──
    // We can't access private schema via REST — but we CAN call the RPC.
    // Actually, we can try the claim_rental_by_qr RPC which checks for
    // artifact.rental_id — but it would return NO_RENTAL_LINKED error.
    // So we need another way. Let's check if there's an RPC to update the artifact.

    // Since private schema isn't directly accessible via REST, and we don't have
    // a direct RPC to update rental_contract_artifacts.rental_id, let's just call
    // the claim_rental_by_qr RPC and see what happens — maybe it tolerates null
    // rental_id, or we need to manually update the artifact via SQL Editor.

    // Try the RPC first — if it returns NO_RENTAL_LINKED, we'll need SQL editor
    const claimResult = await rpc("claim_rental_by_qr", {
      p_doc_sha256: r.docSha256,
      p_renter_chat_id: r.renterChatId,
    });
    console.log(`  RPC claim_rental_by_qr: ${claimResult.ok ? "✅" : "❌"} ${JSON.stringify(claimResult.data)}`);

    if (!claimResult.ok) {
      console.log(`  ⚠️  RPC failed. Need to manually update private.rental_contract_artifacts.rental_id = '${rentalId}' WHERE original_sha256 = '${r.docSha256}'`);
      console.log(`     Run in Supabase SQL Editor:`);
      console.log(`     UPDATE private.rental_contract_artifacts SET rental_id = '${rentalId}' WHERE original_sha256 = '${r.docSha256}';`);
      console.log(`     Then re-run this script's claim step (or just call the RPC manually):`);
      console.log(`     SELECT * FROM public.claim_rental_by_qr('${r.docSha256}', '${r.renterChatId}');`);
    }
    console.log("");
  }

  if (!COMMIT) {
    console.log("DRY RUN — run with --commit to actually create rentals:");
    console.log("  node scripts/recreate-failed-rentals.js --commit");
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
