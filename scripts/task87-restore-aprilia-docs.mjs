// Task 87 RECOVERY: 11 historical Aprilia contract DOCX files were accidentally
// deleted from rental-contracts storage during the orphan cleanup (my filter
// matched the shared prefix). Artifact rows are intact — regenerate each DOCX
// from its artifact + rental row and upload to the EXACT storage_path.
// No deletions in this script. Run: bun --env-file=.env.local scripts/task87-restore-aprilia-docs.mjs [--apply]
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const priv = sb.schema("private");
const APPLY = process.argv.includes("--apply");

const { buildRentalContractVariables } = await import("../app/lib/rental-contract-vars.ts");
const { htmlToDocxElements } = await import("../lib/htmlToDocx.mjs");
const { Document, Packer } = await import("docx");

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

const DELETED_KEYS = [
  "rental-aprilia-shiver-1784966667782",
  "rental-aprilia-shiver-1784968744192",
  "rental-aprilia-shiver-1785245859531",
  "rental-aprilia-shiver-1787503412966",
  "rental-aprilia-shiver-1787931817119",
  "rental-aprilia-shiver-1788013361730",
  "rental-aprilia-shiver-1788192627849",
  "rental-aprilia-shiver-1789056053188",
  "rental-aprilia-shiver-1789215179385",
  "rental-aprilia-shiver-1790100923632",
  "rental-aprilia-shiver-1790258577743",
];

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

function mskTime(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d)) return null;
  return d.toLocaleString("ru-RU", { timeZone: "Europe/Moscow", hour: "2-digit", minute: "2-digit" });
}

const { data: april } = await sb.from("cars").select("*").eq("id", "aprilia-shiver").maybeSingle();
const template = readFileSync("docs/RENTAL_DEAL_TEMPLATE.html", "utf8");

let restored = 0, failed = 0;
for (const key of DELETED_KEYS) {
  try {
    const { data: art } = await priv.from("rental_contract_artifacts").select("*").eq("contract_key", key).maybeSingle();
    if (!art) throw new Error("artifact not found");
    const { data: rental } = art.rental_id
      ? await sb.from("rentals").select("*").eq("rental_id", art.rental_id).maybeSingle()
      : { data: null };
    const meta = rental?.metadata ?? {};
    const eq = meta.equipment ?? null;

    // doc creation moment from the contract_key timestamp suffix
    const tsMs = Number(key.split("-").pop());
    const tsDate = new Date(tsMs);
    const contractNumber = `${tsDate.getUTCDate()}.${tsDate.getUTCMonth() + 1}/${art.resolved_bike_id || "aprilia-shiver"}`;
    const appendixDate = `${String(tsDate.getUTCDate()).padStart(2, "0")}.${String(tsDate.getUTCMonth() + 1).padStart(2, "0")}.${tsDate.getUTCFullYear()}`;

    const [series, number] = (art.renter_passport || "").split(" ");
    const dlParts = (art.renter_driver_license || "").split(" ");
    const dlSeries = dlParts.length > 2 ? dlParts.slice(0, -1).join(" ") : (dlParts[0] ?? "");
    const dlNumber = dlParts.length > 2 ? dlParts[dlParts.length - 1] : (dlParts[1] ?? "");
    const daily = art.daily_price ?? meta.daily_price ?? null;
    const total = art.total_sum ?? rental?.total_cost ?? 0;
    const deposit = art.deposit_rub ?? "20000";
    const depNum = Number(deposit) || 0;
    const cash = total >= depNum && depNum > 0 ? total : total + depNum;

    const vars = buildRentalContractVariables({
      renter: {
        fullName: art.renter_full_name || "",
        birthDate: art.renter_birth_date || "",
        phone: art.renter_phone || "",
        email: "",
        passportSeries: series || "",
        passportNumber: number || "",
        passportIssueDate: art.renter_passport_issue_date || "",
        passportIssuedBy: art.renter_passport_issued_by || "",
        registration: art.renter_registration || "",
        address: art.renter_registration || "",
        driverLicenseSeries: dlSeries,
        driverLicenseNumber: dlNumber,
      },
      bike: { id: april.id, make: april.make, model: april.model, type: april.type, specs: april.specs },
      period: {
        startDate: art.rent_start_date || "",
        startTime: mskTime(rental?.agreed_start_date) || "18:00",
        endDate: art.rent_end_date || "",
        endTime: mskTime(rental?.agreed_end_date) || "10:00",
        ...(daily ? { dailyPrice: Number(daily) } : {}),
      },
      crewSecrets: { contractDefaults: CREW_FALLBACKS },
      stsPledge: { used: !!art.sts_pledge_used },
      meta: {
        signatureTimestamp: tsDate.toLocaleString("ru-RU"),
        signatureFingerprint: "manual-telegram-doc",
        renterSignature: "согласие через Telegram",
        documentKey: key,
        appendixDate,
      },
      equipment: {
        helmets: eq?.helmets ?? 0,
        gloves: eq?.gloves ?? 0,
        jacket: !!eq?.jacket,
        pants: !!eq?.pants,
        boots: !!eq?.boots,
        net: !!eq?.net,
        backpack: !!eq?.backpack,
        bag: !!eq?.bag,
        charger: !!eq?.charger,
      },
      odometerBefore: Number(meta.odometer_before ?? 0) || 0,
      paymentSplit: { cashAmount: cash, bankAmount: 0 },
      depositPaymentMethod: "наличными",
    });
    // Money display verbatim from the artifact record (authoritative history)
    vars.subtotal_rub = String(total);
    if (daily) {
      vars.daily_price_rub = String(Math.round(Number(daily)));
      vars.pricing_tier_price_rub = String(Math.round(Number(daily)));
      vars.pricing_tier_unit = "за день";
      vars.pricing_tier_label = "день";
    }
    vars.contract_number = contractNumber;
    vars.deposit_rub = String(deposit);

    const renderedHtml = renderTemplateWithVars(template, vars);
    const children = htmlToDocxElements(renderedHtml);
    const doc = new Document({
      sections: [{ properties: { page: { margin: { top: 1021, right: 1021, bottom: 1247, left: 1247 } } }, children }],
    });
    const buf = Buffer.from(await Packer.toBuffer(doc));
    const sha = createHash("sha256").update(buf).digest("hex");

    if (!APPLY) {
      console.log(`[dry] ${key}: ${buf.length} B sha ${sha.slice(0, 12)} — ${art.renter_full_name}, ${art.rent_start_date}..${art.rent_end_date}, Σ ${total}`);
      restored++;
      continue;
    }
    const { error: upErr } = await sb.storage.from("rental-contracts").upload(art.storage_path, buf, {
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      upsert: false,
    });
    if (upErr) throw new Error(`upload: ${upErr.message}`);
    console.log(`[restored] ${art.storage_path} (${buf.length} B) — ${art.renter_full_name}, Σ ${total}`);
    restored++;
  } catch (e) {
    failed++;
    console.error(`[FAILED] ${key}: ${e.message}`);
  }
}
console.log(`\n${APPLY ? "RESTORED" : "DRY"}: ${restored}/${DELETED_KEYS.length}, failed: ${failed}`);
