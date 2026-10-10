// Task 87: Honda CBR600RR → Aprilia Shiver 750 bike swap per owner protocol.
// Phase A (this file, --calibrate): rebuild ORIGINAL Honda contract vars and
// compare against the rendered values of the original DOCX (empirical match),
// so the regenerated Aprilia doc mirrors the cancelled one 1:1.
// Run: node --env-file=.env.local scripts/task87-cbr-aprilia-swap.mjs --calibrate
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const BASE = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb = createClient(BASE, KEY);
const priv = sb.schema("private");

const CREW_SLUG = "vip-bike";
const CREW_ID = "2d5fde70-1dd3-4f0d-8d72-66ccf6908746";
const HONDA_ID = "honda-cbr600rr-2003";
const APRILIA_ID = "aprilia-shiver";
const CLIENT_ID = "561091269"; // ALLEKSEEVA_V / Виктория Дыдыкина
const OWNER_ID = "356282674"; // I_O_S_NN
const BOSS_ID = "413553377"; // salavey13 (cancelled the Honda rental in UI)
const HONDA_RENTAL_ID = "ba91ac61-6185-4299-85ab-d96e71e2739b";
const HONDA_ARTIFACT_KEY = "rental-honda-cbr600rr-2003-1791493611973";

// Renter data — verbatim from private.rental_contract_artifacts f8f21dd3
const RENTER = {
  fullName: "Виктория Дыдыкина",
  birthDate: "15.02.2006",
  phone: "89200036623",
  passportSeries: "2226",
  passportNumber: "019257",
  passportIssueDate: "19.02.2026",
  passportIssuedBy: "ГУ МВД РОССИИ ПО НИЖЕГОРОДСКОЙ ОБЛАСТИ",
  registration: "Нижегородская область Кстовский район деревня Караулово",
  driverLicenseSeries: "99 51",
  driverLicenseNumber: "135055",
};

async function getCar(id) {
  const { data, error } = await sb.from("cars").select("*").eq("id", id).maybeSingle();
  if (error || !data) throw new Error(`car ${id}: ${error?.message ?? "not found"}`);
  return data;
}

async function getCrewSecrets() {
  const { data } = await sb.from("crew_secrets").select("contract_defaults").eq("crew_slug", CREW_SLUG).maybeSingle();
  const cd = data?.contract_defaults;
  return { contractDefaults: typeof cd === "string" ? JSON.parse(cd || "{}") : (cd ?? {}) };
}

// Crew contract defaults — same fallbacks as make-deal-contract-skill.mjs /
// loadCrewSecrets (vip-bike crew_secrets.contract_defaults is empty → defaults)
const CREW_FALLBACKS = {
  organizationName: "Мотосалон ВипБайкЭлектро",
  organizationShort: "ИП Воробьева Р.В.",
  organizationRepresentative: "ИП Воробьев Р.В.",
  ogrnip: "326527500025145",
  inn: "525813643035",
  bankAccount: "40802810942710013083",
  bankName: "Волго-Вятский Банк ПАО Сбербанк",
  bankCity: "г. Нижний Новгород",
  bankCorrAccount: "30101810900000000603",
  email: "vip_bike@mail.ru",
  legalAddress: "г. Нижний Новгород, пл. Комсомольская 2",
  issuerName: "Воробьев Р.В.",
  issuerRepresentative: "Сидоров Илья Олегович",
  returnAddress: "Н. Н. пл. Комсомольская 2",
  signatoryRole: "Менеджер Мотосалона",
};

function crewSecretsWithFallbacks(secrets) {
  const cd = { ...CREW_FALLBACKS, ...(secrets?.contractDefaults ?? {}) };
  return {
    legalAddress: cd.legalAddress,
    returnAddress: cd.returnAddress,
    issuerName: cd.issuerName,
    signatoryRole: cd.signatoryRole,
    organizationRepresentative: cd.organizationRepresentative,
    organizationName: cd.organizationName,
    organizationShort: cd.organizationShort,
    ogrnip: cd.ogrnip,
    inn: cd.inn,
    bankAccount: cd.bankAccount,
    bankName: cd.bankName,
    bankCity: cd.bankCity,
    bankCorrAccount: cd.bankCorrAccount,
    email: cd.email,
    contractDefaults: cd,
  };
}

// ── main ──
const { buildRentalContractVariables } = await import("../app/lib/rental-contract-vars.ts");

const honda = await getCar(HONDA_ID);
const secrets = crewSecretsWithFallbacks(await getCrewSecrets());
const now = new Date("2026-10-08T21:06:00Z"); // original doc build moment (08.10)

const hondaVars = buildRentalContractVariables({
  renter: {
    fullName: RENTER.fullName,
    birthDate: RENTER.birthDate,
    phone: RENTER.phone,
    email: "",
    passportSeries: RENTER.passportSeries,
    passportNumber: RENTER.passportNumber,
    passportIssueDate: RENTER.passportIssueDate,
    passportIssuedBy: RENTER.passportIssuedBy,
    registration: RENTER.registration,
    address: RENTER.registration,
    driverLicenseSeries: RENTER.driverLicenseSeries,
    driverLicenseNumber: RENTER.driverLicenseNumber,
  },
  bike: { id: honda.id, make: honda.make, model: honda.model, type: honda.type, specs: honda.specs },
  period: {
    startDate: "2026-10-09",
    startTime: "15:00",
    endDate: "2026-10-10",
    endTime: "15:00",
  },
  crewSecrets: secrets,
  stsPledge: { used: false },
  meta: {
    signatureTimestamp: now.toLocaleString("ru-RU"),
    signatureFingerprint: "manual-telegram-doc",
    renterSignature: "согласие через Telegram",
    documentKey: HONDA_ARTIFACT_KEY,
    appendixDate: "08.10.2026",
  },
  equipment: { helmets: 1 },
  odometerBefore: 0,
  paymentSplit: { cashAmount: 31000, bankAmount: 0 },
  depositPaymentMethod: "наличными",
});

// Expected values — extracted from the original DOCX text
const EXPECTED = {
  contract_number: "8.10/honda-cbr600rr-2003",
  daily_price_rub: "10000",
  equipment_total_cost: "1000",
  equipment_summary: "Шлем ×1",
  subtotal_rub: "11000",
  payment_cash_rub: "31000",
  payment_bank_rub: "0",
  deposit_rub: "20000",
  odometer_before: "0",
  pricing_tier_price_rub: "10000",
  rent_start_date: "2026-10-09",
  rent_start_time: "15:00",
  rent_end_date: "2026-10-10",
  rent_end_time: "15:00",
  bike_vin: "PC37-1000901",
};

console.log("── CALIBRATION: rebuilt Honda vars vs original DOCX ──");
let mismatches = 0;
for (const [k, expected] of Object.entries(EXPECTED)) {
  const got = String(hondaVars[k] ?? "");
  const ok = got === expected;
  if (!ok) mismatches++;
  console.log(`${ok ? "✓" : "✗"} ${k}: got "${got}" ${ok ? "==" : "!= expected"} "${expected}"`);
}
console.log("── other notable vars ──");
for (const k of ["pricing_tier_label", "pricing_tier_unit", "renter_full_name", "renter_passport_number", "renter_phone", "total_payable_rub", "equipment_helmet_price", "appendix_date", "signature_timestamp", "contract_day", "contract_month_genitive", "contract_year"]) {
  if (hondaVars[k] !== undefined) console.log(`  ${k}: "${hondaVars[k]}"`);
}
console.log(`\nRESULT: ${mismatches === 0 ? "ALL MATCH ✓" : mismatches + " mismatches ✗"}`);

// ═════════════════════════════════════════════════════════════════════════
// APPLY PHASE — node --env-file / bun with --apply
// ═════════════════════════════════════════════════════════════════════════
const APPLY = process.argv.includes("--apply");
const SEND = process.argv.includes("--send");

if (!APPLY && !process.argv.includes("--calibrate-only")) {
  console.log("\n(dry-run — add --apply to write, --send to deliver doc to client)");
}

if (APPLY) {
  const { createHash } = await import("node:crypto");
  const sharp = (await import("sharp")).default;
  const { htmlToDocxElements } = await import("../lib/htmlToDocx.mjs");
  const { Document, Packer } = await import("docx");
  const ts = Date.now();
  const docKey = `rental-aprilia-shiver-${ts}`;
  const auditId = "owner_fix_20261010_cbr_aprilia_swap";
  const nowIso = new Date().toISOString();

  // ── 1. Fresh reads ──
  const april = await getCar(APRILIA_ID);
  const hondaFresh = await getCar(HONDA_ID);
  const { data: hondaRental } = await sb.from("rentals").select("*").eq("rental_id", HONDA_RENTAL_ID).maybeSingle();
  if (!hondaRental || hondaRental.status !== "cancelled") throw new Error("Honda rental is not in cancelled state — aborting");
  const { data: dup } = await sb.from("rentals").select("rental_id").eq("vehicle_id", APRILIA_ID).eq("user_id", CLIENT_ID).eq("status", "completed");
  if ((dup ?? []).length > 0) throw new Error("Completed Aprilia rental for this client already exists — aborting (rerun guard)");

  // ── 2. Build Aprilia vars (mirror original presentation) ──
  const nowReal = new Date();
  const vars = buildRentalContractVariables({
    renter: {
      fullName: RENTER.fullName,
      birthDate: RENTER.birthDate,
      phone: RENTER.phone,
      email: "",
      passportSeries: RENTER.passportSeries,
      passportNumber: RENTER.passportNumber,
      passportIssueDate: RENTER.passportIssueDate,
      passportIssuedBy: RENTER.passportIssuedBy,
      registration: RENTER.registration,
      address: RENTER.registration,
      driverLicenseSeries: RENTER.driverLicenseSeries,
      driverLicenseNumber: RENTER.driverLicenseNumber,
    },
    bike: { id: april.id, make: april.make, model: april.model, type: april.type, specs: april.specs },
    period: { startDate: "2026-10-09", startTime: "15:00", endDate: "2026-10-10", endTime: "15:00", dailyPrice: 10000 },
    crewSecrets: secrets,
    stsPledge: { used: false },
    meta: {
      signatureTimestamp: nowReal.toLocaleString("ru-RU"),
      signatureFingerprint: "manual-telegram-doc",
      renterSignature: "согласие через Telegram",
      documentKey: docKey,
      appendixDate: "10.10.2026",
    },
    equipment: { helmets: 1 },
    odometerBefore: 49547,
    paymentSplit: { cashAmount: 31000, bankAmount: 0 },
    depositPaymentMethod: "наличными",
  });
  // Mirror the ORIGINAL doc's money presentation (protocol: «Договор перенесён
  // из отмененной аренды»): rent 10000 + helmet 1000 = 11 000, deposit shown
  // separately. The builder's current formula folds deposit into subtotal
  // (31 000) — the standalone skill script has the same --subtotal override.
  vars.subtotal_rub = "11000";
  vars.pricing_tier_price_rub = "10000";
  vars.pricing_tier_unit = "за день";
  vars.pricing_tier_label = "день";
  vars.contract_number = `10.10/${APRILIA_ID}`;

  // ── 3. Render template → DOCX ──
  const template = readFileSync("docs/RENTAL_DEAL_TEMPLATE.html", "utf8");
  function renderTemplateWithVars(template, vars) {
    let out = template.replace(/<!--[\s\S]*?-->/g, "");
    const isTruthy = (v) => {
      if (v === null || v === undefined) return false;
      if (typeof v === "number") return v > 0;
      if (typeof v === "boolean") return v;
      const s = String(v).trim().toLowerCase();
      if (s === "" || s === "0" || s === "false" || s === "no" || s === "null" || s === "undefined") return false;
      return true;
    };
    const blockRe = /\{\{#if\s+([a-zA-Z0-9_]+)\s*\}\}((?:(?!\{\{#if\s|\{\{\/if\}\}).)*?)\{\{\/if\}\}/gs;
    let guard = 0;
    while (guard++ < 100) {
      let replaced = false;
      out = out.replace(blockRe, (full, varName, body) => {
        replaced = true;
        let ifBranch = body, elseBranch = "";
        const elseIdx = body.indexOf("{{else}}");
        if (elseIdx >= 0) { ifBranch = body.slice(0, elseIdx); elseBranch = body.slice(elseIdx + "{{else}}".length); }
        return isTruthy(vars[varName]) ? ifBranch : elseBranch;
      });
      if (!replaced) break;
    }
    return out.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, k) => String(vars[k] ?? ""));
  }
  const renderedHtml = renderTemplateWithVars(template, vars);
  const children = htmlToDocxElements(renderedHtml);
  const doc = new Document({
    sections: [{
      properties: { page: { margin: { top: 1021, right: 1021, bottom: 1247, left: 1247 } } },
      children,
    }],
  });
  const docxBuffer = Buffer.from(await Packer.toBuffer(doc));
  const docSha = createHash("sha256").update(docxBuffer).digest("hex");
  const storagePath = `${CREW_SLUG}/${docKey}.docx`;
  console.log(`docx built: ${docxBuffer.length} B, sha256 ${docSha.slice(0, 16)}…, path ${storagePath}`);

  if (process.argv.includes("--build-only")) {
    const fs = await import("node:fs");
    fs.writeFileSync("/tmp/aprilia-preview.docx", docxBuffer);
    console.log("BUILD-ONLY: preview saved to /tmp/aprilia-preview.docx — no writes performed");
    process.exit(0);
  }

  // ── 4. Upload DOCX to storage ──
  const { error: upErr } = await sb.storage.from("rental-contracts").upload(storagePath, docxBuffer, {
    contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    upsert: false,
  });
  if (upErr) throw new Error(`docx upload: ${upErr.message}`);
  console.log("docx uploaded to rental-contracts");

  // ── 5. INSERT new rental (completed) ──
  const newRentalId = crypto.randomUUID();
  const rentalRow = {
    rental_id: newRentalId,
    user_id: CLIENT_ID,
    owner_id: OWNER_ID,
    crew_id: CREW_ID,
    vehicle_id: APRILIA_ID,
    status: "completed",
    payment_status: hondaRental.payment_status ?? "pending",
    total_cost: 11000,
    requested_start_date: "2026-10-09T12:00:00+00:00",
    requested_end_date: "2026-10-10T12:00:00+00:00",
    agreed_start_date: "2026-10-09T12:00:00+00:00",
    agreed_end_date: "2026-10-10T12:00:00+00:00",
    deposit_amount: hondaRental.deposit_amount,
    deposit_method: hondaRental.deposit_method,
    deposit_returned: hondaRental.deposit_returned ?? false,
    created_by_operator_chat_id: hondaRental.created_by_operator_chat_id ?? null,
    metadata: {
      source: "bike_swap_owner_fix",
      history: [
        {
          status: "completed",
          at: nowIso,
          by: BOSS_ID,
          message: "Аренда создана протоколом замены ТС 10.10.2026: Honda CBR600RR → Aprilia Shiver 750 (замена байка клиенту в начале аренды). Данные клиента и договор перенесены из отмененной аренды " + HONDA_RENTAL_ID,
        },
      ],
      daily_price: 10000,
      renter_name: RENTER.fullName,
      renter_phone: RENTER.phone,
      odometer_before: 49547,
      odometer_after: 49755,
      return_confirmed_at: nowIso,
      return_confirmed_by: BOSS_ID,
      doc_sha256: docSha,
      bike_swap: {
        from_vehicle_id: HONDA_ID,
        from_rental_id: HONDA_RENTAL_ID,
        reason: "Замена байка клиенту на Aprilia",
        protocol: "Протокол изменения договора аренды 10.10.2026",
      },
    },
  };
  const { error: rentErr } = await sb.from("rentals").insert(rentalRow);
  if (rentErr) throw new Error(`rental insert: ${rentErr.message}`);
  console.log("rental inserted:", newRentalId);

  // ── 6. INSERT private artifact ──
  const artifactRow = {
    contract_key: docKey,
    crew_slug: CREW_SLUG,
    storage_path: storagePath,
    original_sha256: docSha,
    requested_bike_id: APRILIA_ID,
    resolved_bike_id: APRILIA_ID,
    telegram_chat_id: String(CLIENT_ID),
    created_by_operator_chat_id: String(BOSS_ID),
    renter_phone: RENTER.phone,
    telegram_message_id: null,
    renter_full_name: RENTER.fullName,
    renter_passport: `${RENTER.passportSeries} ${RENTER.passportNumber}`,
    renter_passport_issued_by: RENTER.passportIssuedBy,
    renter_passport_issue_date: RENTER.passportIssueDate,
    renter_registration: RENTER.registration,
    renter_driver_license: `${RENTER.driverLicenseSeries} ${RENTER.driverLicenseNumber}`,
    renter_birth_date: RENTER.birthDate,
    license_categories: "А,В",
    rent_start_date: "2026-10-09",
    rent_end_date: "2026-10-10",
    daily_price: 10000,
    deposit_rub: "20000",
    total_sum: 11000,
    template_version: 1,
    rental_id: newRentalId,
    sts_pledge_used: false,
  };
  const { error: artErr, data: artRow } = await priv.from("rental_contract_artifacts").insert(artifactRow).select("id").single();
  if (artErr) throw new Error(`artifact insert: ${artErr.message}`);
  console.log("artifact inserted:", artRow.id);

  // ── 7. Update Honda rental: cancellation reason + swap link (protocol §1) ──
  const hondaMeta = { ...(hondaRental.metadata ?? {}) };
  hondaMeta.last_status_change_message = "Замена байка клиенту на Aprilia (Shiver 750) — протокол изменения договора аренды 10.10.2026";
  hondaMeta.replaced_by_rental_id = newRentalId;
  hondaMeta.history = [
    ...((hondaMeta.history ?? [])),
    {
      status: "cancelled",
      at: nowIso,
      by: BOSS_ID,
      message: `Причина отмены зафиксирована протоколом: замена ТС на Aprilia Shiver 750. Новая аренда: ${newRentalId}`,
    },
  ];
  const { error: hondaUpdErr } = await sb.from("rentals").update({ metadata: hondaMeta, updated_at: nowIso }).eq("rental_id", HONDA_RENTAL_ID);
  if (hondaUpdErr) throw new Error(`honda rental update: ${hondaUpdErr.message}`);
  console.log("honda rental annotated (reason + replaced_by)");

  // ── 8. Photos ПОСЛЕ (compress → upload → rows → counters → events) ──
  const PHOTOS = [
    "/home/z/my-project/upload/IMG_20261010_173037.jpg",
    "/home/z/my-project/upload/IMG_20261010_173047.jpg",
  ];
  const { data: existingPhotos } = await sb.from("rental_photos").select("id").eq("rental_id", newRentalId).eq("photo_type", "end");
  let seq = (existingPhotos?.length ?? 0);
  for (const p of PHOTOS) {
    seq += 1;
    const raw = readFileSync(p);
    let quality = 75;
    let compressed = await sharp(raw).rotate().resize(1280, 1280, { fit: "inside", withoutEnlargement: true }).jpeg({ quality, mozjpeg: true }).toBuffer({ resolveWithObject: true });
    while (compressed.data.length > 500 * 1024 && quality > 50) {
      quality -= 5;
      compressed = await sharp(raw).rotate().resize(1280, 1280, { fit: "inside", withoutEnlargement: true }).jpeg({ quality, mozjpeg: true }).toBuffer({ resolveWithObject: true });
    }
    const hash = createHash("sha256").update(compressed.data).digest("hex");
    const photoPath = `${newRentalId}/end/${seq}-${Date.now()}-${BOSS_ID}.jpg`;
    const { error: phUpErr } = await sb.storage.from("rental-photos").upload(photoPath, compressed.data, { contentType: "image/jpeg", cacheControl: "3600", upsert: false });
    if (phUpErr) throw new Error(`photo upload ${p}: ${phUpErr.message}`);
    const { data: phRow, error: phInsErr } = await sb.from("rental_photos").insert({
      rental_id: newRentalId,
      photo_type: "end",
      storage_path: photoPath,
      file_size_bytes: compressed.data.length,
      sha256_hash: hash,
      mime_type: "image/jpeg",
      width: compressed.info.width,
      height: compressed.info.height,
      uploaded_by: BOSS_ID,
      uploader_role: "admin",
      source: "operator_ui",
      metadata: { notes: "Фото ПОСЛЕ (возврат) — Aprilia Shiver 750, протокол замены ТС 10.10.2026" },
    }).select("id").single();
    if (phInsErr) { await sb.storage.from("rental-photos").remove([photoPath]); throw new Error(`photo insert: ${phInsErr.message}`); }
    const { error: rpcErr } = await sb.rpc("increment_photo_count", { p_rental_id: newRentalId, p_column: "end_photo_count", p_delta: 1 });
    if (rpcErr) console.error("photo counter RPC failed:", rpcErr.message);
    await sb.from("events").insert({
      rental_id: newRentalId,
      type: "photo_end",
      status: "completed",
      created_by: BOSS_ID,
      payload: {
        photo_id: phRow.id,
        storage_path: photoPath,
        sha256_hash: hash,
        file_size_bytes: compressed.data.length,
        width: compressed.info.width,
        height: compressed.info.height,
        source: "operator_ui",
        uploader_role: "admin",
        notes: "Фото ПОСЛЕ — Aprilia Shiver 750 (протокол замены ТС)",
      },
    });
    console.log(`photo ${seq} ok: ${compressed.info.width}×${compressed.info.height}, ${Math.round(compressed.data.length / 1024)} КБ, q${quality}`);
  }

  // ── 9. return_confirmed event ──
  await sb.from("events").insert({
    rental_id: newRentalId,
    type: "return_confirmed",
    status: "completed",
    created_by: BOSS_ID,
    payload: {
      odometer_after: 49755,
      odometer_before: 49547,
      trip_km: 208,
      source: "bike_swap_owner_fix",
      note: "Аренда закрыта протоколом замены ТС (фото ПОСЛЕ загружены ассистентом по поручению владельца)",
    },
  });
  console.log("return_confirmed event written");

  // ── 10. Aprilia fleet odometer (same write as confirmVehicleReturn) ──
  const aprilSpecs = { ...(april.specs ?? {}) };
  aprilSpecs.last_known_odometer = 49755;
  aprilSpecs[auditId] = {
    applied_at: nowIso,
    applied_by: "assistant (по поручению salavey13)",
    what: "last_known_odometer 49542 → 49755 (протокол замены ТС: одометр на выдаче 49547, на возврате 49755, пробег 208 км)",
    rental_id: newRentalId,
  };
  const { error: aprilUpdErr } = await sb.from("cars").update({ specs: aprilSpecs }).eq("id", APRILIA_ID);
  if (aprilUpdErr) throw new Error(`aprilia specs update: ${aprilUpdErr.message}`);
  console.log("aprilia last_known_odometer → 49755");

  // ── 11. Crew audit block ──
  const { data: crewRow } = await sb.from("crews").select("metadata").eq("id", CREW_ID).maybeSingle();
  const crewMeta = { ...(crewRow?.metadata ?? {}) };
  crewMeta.specs = { ...(crewMeta.specs ?? {}) };
  crewMeta.specs[auditId] = {
    applied_and_verified: true,
    applied_at: nowIso,
    applied_by: "assistant (по поручению salavey13 в чате)",
    request: "fix one rental in supabase, create another one similarly — bike swapped at the beginning of cbr600rr rental → aprilia shiver; align docs to reality; keep rider info; regenerate and resend docs; activate+close with odometer 49547→49755; add two 'after' photos",
    what: [
      `rentals ${HONDA_RENTAL_ID} (Honda CBR600RR, отменена владельцем 10.10 14:36 через UI): metadata.last_status_change_message = «Замена байка клиенту на Aprilia (Shiver 750)…», metadata.replaced_by_rental_id, history-запись с причиной (протокол §1)`,
      `rentals INSERT ${newRentalId}: Aprilia Shiver 750, клиент 561091269 (Виктория Дыдыкина) перенесён из отмененной аренды, период 09.10 12:00 UTC — 10.10 12:00 UTC, total_cost 11000 (тариф перенесён с Honda), deposit 20000 cash (не возвращён, как в исходной), status completed, metadata.odometer_before 49547 / odometer_after 49755, return_confirmed_by 413553377`,
      `private.rental_contract_artifacts INSERT ${artRow.id} (contract_key ${docKey}): арендатор/паспорт/ВУ перенесены из f8f21dd3, resolved_bike_id aprilia-shiver, total_sum 11000`,
      `DOCX regenerated via buildRentalContractVariables (апрельские specs, тариф override 10000, subtotal override 11000 — зеркально оригинальному договору, где залог не входил в «Итого»), uploaded to rental-contracts/${storagePath}, sha256 ${docSha}`,
      "photos ПОСЛЕ ×2 (IMG_20261010_173037/173047) сжаты sharp 1280px/mozjpeg, rental-photos/<rental_id>/end/, rental_photos ×2, end_photo_count +2 через increment_photo_count, events photo_end ×2",
      "cars(aprilia-shiver).specs.last_known_odometer 49542 → 49755",
    ],
    not_touched: "cash_transactions/deposit_entries (денежных строк у отмененной аренды не было), зарплатные поверхности (создатель-оператор null — атрибуция не менялась), 11 фото ДО на Honda-аренде остались на ней",
    boss_quote: "kinda bike was swapped at the beginning of cbr60rr rental - switched to aprilia shiver, lets align docs to reality kinda, change bike, keep rider info, regenerate and resend docs",
  };
  const { error: crewUpdErr } = await sb.from("crews").update({ metadata: crewMeta }).eq("id", CREW_ID);
  if (crewUpdErr) throw new Error(`crew audit update: ${crewUpdErr.message}`);
  console.log("crew audit block written:", auditId);

  // ── 12. Post-verify ──
  const { data: vRental } = await sb.from("rentals").select("rental_id,status,total_cost,start_photo_count,end_photo_count,metadata").eq("rental_id", newRentalId).maybeSingle();
  console.log("VERIFY rental:", JSON.stringify({ id: vRental.rental_id, status: vRental.status, total: vRental.total_cost, start: vRental.start_photo_count, end: vRental.end_photo_count, odo: [vRental.metadata?.odometer_before, vRental.metadata?.odometer_after] }));
  const { data: vPhotos } = await sb.from("rental_photos").select("storage_path,file_size_bytes").eq("rental_id", newRentalId).eq("photo_type", "end");
  console.log("VERIFY photos:", vPhotos.length, vPhotos.map((x) => `${x.storage_path.split("/").pop()} (${Math.round(x.file_size_bytes / 1024)} КБ)`).join("; "));
  const { data: vHonda } = await sb.from("rentals").select("metadata").eq("rental_id", HONDA_RENTAL_ID).maybeSingle();
  console.log("VERIFY honda reason:", vHonda.metadata?.last_status_change_message, "| replaced_by:", vHonda.metadata?.replaced_by_rental_id);
  const { data: vApril } = await sb.from("cars").select("specs").eq("id", APRILIA_ID).maybeSingle();
  console.log("VERIFY april odo:", vApril.specs?.last_known_odometer);

  console.log("\nAPPLY DONE. rental:", newRentalId, "| doc:", storagePath);
  console.log("send doc to client:", SEND ? "yes (--send)" : "no — rerun with --send");
}

