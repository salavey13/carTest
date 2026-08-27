"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/hooks/supabase";
import { privateSchema } from "@/lib/private-secrets";
import { buildFranchizeDocxFromTemplate } from "@/app/franchize/lib/docx-capability";
import { readFileSync } from "fs";
import { join } from "path";
import { createHash } from "crypto";

export interface SubrentFormData {
  // Owner details
  ownerFullName: string;
  ownerBirthDate: string;
  ownerPassportSeries: string;
  ownerPassportNumber: string;
  ownerPassportIssuedBy: string;
  ownerPassportIssueDate: string;
  ownerRegistration: string;
  ownerPhone: string;
  ownerEmail?: string;

  // Bike details
  bikeMake: string;
  bikeModel: string;
  bikeVin?: string;
  bikePlate?: string;
  bikeYear?: string;
  bikeValue?: string;
  bikeRegistrationCert?: string;
  bikeInsurancePolicy?: string;

  // Payment terms
  ownerPercentage: number;
  minDailyPrice: number;
  /** Minimum price per day for 2+ day rentals (contract §5.1.1). */
  min2plusPrice?: number;
  /** Minimum price per day for 3+ day rentals (contract §5.1.1). */
  min3plusPrice?: number;
  hourly3hPrice?: number;
  hourly6hPrice?: number;
  hourly12hPrice?: number;
  weekdayPrice?: number;
  weekendPrice?: number;

  // Contract duration
  contractStartDate: string;
  contractStartTime: string;
  contractDuration: "3m" | "6m" | "1y";

  // Crew context
  crewId?: string;
}

export async function createSubrentContract(formData: SubrentFormData, userId: string) {
  try {
    // Load crew secrets. FIX (iter12): private.crew_secrets stores contract
    // data inside the contract_defaults JSONB (camelCase keys) — flat columns
    // like organization_short do NOT exist, so the old direct accesses always
    // silently used the hardcoded fallbacks.
    const crewId = formData.crewId || "default";
    let crewCd: Record<string, any> = {};
    try {
      const { data: crewSecretsRow } = await privateSchema()
        .from("crew_secrets")
        .select("contract_defaults")
        .eq("crew_slug", crewId)
        .maybeSingle();
      if (crewSecretsRow?.contract_defaults) {
        crewCd =
          typeof crewSecretsRow.contract_defaults === "string"
            ? JSON.parse(crewSecretsRow.contract_defaults)
            : crewSecretsRow.contract_defaults;
      }
    } catch (secretsErr) {
      console.warn("[createSubrentContract] crew_secrets load failed, using fallbacks:", secretsErr);
    }
    const pick = (v: unknown, fallback: string): string =>
      typeof v === "string" && v.trim() ? v.trim() : fallback;
    const crew = {
      organization_name: pick(crewCd.organizationName, "Мотосалон ВипБайкЭлектро"),
      organization_short: pick(crewCd.organizationShort, "ИП Воробьев Р.В."),
      organization_representative: pick(crewCd.organizationRepresentative, ""),
      legal_address: pick(crewCd.legalAddress, "г. Нижний Новгород, пл. Комсомольская 2"),
      ogrnip: pick(crewCd.ogrnip, "326527500025145"),
      inn: pick(crewCd.inn, "525813643035"),
      bank_account: pick(crewCd.bankAccount, "40802810942710013083"),
      bank_name: pick(crewCd.bankName, "Волго-Вятский Банк ПАО Сбербанк"),
      bank_city: pick(crewCd.bankCity, "г. Нижний Новгород"),
      bank_corr_account: pick(crewCd.bankCorrAccount, "30101810900000000603"),
      email: pick(crewCd.email, ""),
      organization_phone: pick(crewCd.phone ?? crewCd.organizationPhone, ""),
      organization_initials:
        initialsOf(pick(crewCd.issuerName, "")) || pick(crewCd.organizationShort, ""),
    };

    // Generate contract number
    const contractNumber = Math.floor(Math.random() * 9000) + 1000;
    const now = new Date();

    // Parse start date
    const [day, month, year] = formData.contractStartDate.split('.');
    const [startHour, startMin] = formData.contractStartTime.split(':');

    // Calculate end date
    const startDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    let months = 0;
    if (formData.contractDuration === "3m") months = 3;
    else if (formData.contractDuration === "6m") months = 6;
    else if (formData.contractDuration === "1y") months = 12;

    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + months);
    endDate.setHours(19, 0, 0, 0);

    // Build template variables
    const variables = {
      // Contract metadata
      contract_number: String(contractNumber),
      day: day.padStart(2, '0'),
      month_num: month.padStart(2, '0'),
      year: year,

      // Park/crew details
      organization_name: crew.organization_name,
      organization_short: crew.organization_short,
      organization_representative: crew.organization_representative,
      legal_address: crew.legal_address,
      ogrnip: crew.ogrnip,
      inn: crew.inn,
      bank_account: crew.bank_account,
      bank_name: crew.bank_name,
      bank_city: crew.bank_city,
      bank_corr_account: crew.bank_corr_account,
      email: crew.email,
      organization_phone: crew.organization_phone,
      organization_initials: crew.organization_initials,

      // Owner details
      owner_full_name: formData.ownerFullName,
      owner_birth_date: formData.ownerBirthDate,
      owner_passport_series: formData.ownerPassportSeries,
      owner_passport_number: formData.ownerPassportNumber,
      owner_passport_issued_by: formData.ownerPassportIssuedBy,
      owner_passport_issue_date: formData.ownerPassportIssueDate,
      owner_registration: formData.ownerRegistration,
      owner_phone: formData.ownerPhone,
      owner_email: formData.ownerEmail || "",

      // Bike details
      bike_make: formData.bikeMake,
      bike_model: formData.bikeModel,
      bike_vin: formData.bikeVin || "",
      bike_plate: formData.bikePlate || "",
      bike_year: formData.bikeYear || "",
      bike_value_rub: formData.bikeValue || "",
      bike_registration_cert: formData.bikeRegistrationCert || "",
      bike_insurance_policy: formData.bikeInsurancePolicy || "",

      // Payment terms
      owner_percentage: String(formData.ownerPercentage),
      owner_percentage_text: numberToRussianWords(formData.ownerPercentage),
      min_daily_price_rub: String(formData.minDailyPrice),
      min_daily_price_text: numberToRussianWords(formData.minDailyPrice),
      min_2plus_daily_price_rub: String(formData.min2plusPrice || Math.max(1000, Math.round(formData.minDailyPrice * 0.9))),
      min_2plus_daily_price_text: numberToRussianWords(formData.min2plusPrice || Math.max(1000, Math.round(formData.minDailyPrice * 0.9))),
      min_3plus_daily_price_rub: String(formData.min3plusPrice || Math.max(1000, Math.round(formData.minDailyPrice * 0.8))),
      min_3plus_daily_price_text: numberToRussianWords(formData.min3plusPrice || Math.max(1000, Math.round(formData.minDailyPrice * 0.8))),
      owner_initials: initialsOf(formData.ownerFullName),
      hourly_3h_price_rub: String(formData.hourly3hPrice || 6000),
      hourly_6h_price_rub: String(formData.hourly6hPrice || 7000),
      hourly_12h_price_rub: String(formData.hourly12hPrice || 8000),
      weekday_daily_price_rub: String(formData.weekdayPrice || 14000),
      weekend_daily_price_rub: String(formData.weekendPrice || 16000),
      reporting_period: "неделя",
      payment_deadline_days: "2",
      payment_deadline_days_text: "двух",
      late_penalty_percent: "0.2",

      // Contract duration
      contract_start_date: formData.contractStartDate,
      contract_start_time: formData.contractStartTime,
      contract_end_date: `${String(endDate.getDate()).padStart(2, '0')}.${String(endDate.getMonth() + 1).padStart(2, '0')}.${endDate.getFullYear()}`,
      contract_end_time: "19:00",

      // Deposits and terms
      regular_client_deposit_rub: "10000",
      regular_client_deposit_text: numberToRussianWords(10000),
      new_client_deposit_rub: "20000",
      new_client_deposit_text: numberToRussianWords(20000),
      daily_km_allowance: "200",
      extra_km_fee_rub: "30",
      downtime_compensation_daily_rub: "4000",
      downtime_compensation_daily_text: numberToRussianWords(4000),

      // Return address
      return_address: pick(crewCd.returnAddress, "г. Нижний Новгород, пл. Комсомольская 2"),

      // Territory
      insurance_territory: pick(crewCd.insuranceTerritory, "Нижегородской области"),
    };

    // Load template — crew-specific override first, general as fallback
    // (same priority as the /subrent bot command).
    let template: string;
    try {
      const crewTemplate = readFileSync(
        join(process.cwd(), "docs", "crewDocs", `${crewId}_SUBRENTAL_DEAL_TEMPLATE.html`),
        "utf-8",
      );
      template = crewTemplate.trim().length > 0 ? crewTemplate : readFileSync(join(process.cwd(), "docs", "SUBRENTAL_DEAL_TEMPLATE.html"), "utf-8");
    } catch {
      template = readFileSync(join(process.cwd(), "docs", "SUBRENTAL_DEAL_TEMPLATE.html"), "utf-8");
    }

    // Generate DOCX
    const docFileName = `subrental-${formData.bikeMake}-${formData.bikeModel}-${now.toISOString().split("T")[0]}.docx`
      .replace(/[^a-zA-Zа-яА-Я0-9.\-]/g, "-")
      .replace(/-+/g, "-");

    const result = await buildFranchizeDocxFromTemplate({
      integrationScope: "subrent-web",
      uploadedBy: userId,
      documentKey: `subrent-${contractNumber}-${Date.now()}`,
      fileName: docFileName,
      template,
      variables,
      flowType: "subrental",
      templateMode: "html",
    });

    // Calculate SHA256 for deduplication
    const docBuffer = result.bytes;
    const fileHash = result.sha256 || createHash("sha256").update(docBuffer).digest("hex");

    // Store contract artifact
    const { data: artifact, error: dbError } = await privateSchema()
      .from("subrent_contract_artifacts")
      .insert({
        contract_key: `subrent-${contractNumber}-${Date.now()}`,
        telegram_chat_id: userId,
        bike_make: formData.bikeMake,
        bike_model: formData.bikeModel,
        bike_vin: formData.bikeVin,
        bike_plate: formData.bikePlate,
        bike_year: formData.bikeYear,
        bike_value_rub: formData.bikeValue,
        bike_registration_cert: formData.bikeRegistrationCert,
        bike_insurance_policy: formData.bikeInsurancePolicy,
        owner_full_name: formData.ownerFullName,
        owner_birth_date: formData.ownerBirthDate,
        owner_passport_series: formData.ownerPassportSeries,
        owner_passport_number: formData.ownerPassportNumber,
        owner_passport_issued_by: formData.ownerPassportIssuedBy,
        owner_passport_issue_date: formData.ownerPassportIssueDate,
        owner_registration: formData.ownerRegistration,
        owner_phone: formData.ownerPhone,
        owner_email: formData.ownerEmail,
        owner_percentage: String(formData.ownerPercentage),
        min_daily_price_rub: String(formData.minDailyPrice),
        hourly_3h_price_rub: String(formData.hourly3hPrice || 6000),
        hourly_6h_price_rub: String(formData.hourly6hPrice || 7000),
        hourly_12h_price_rub: String(formData.hourly12hPrice || 8000),
        weekday_daily_price_rub: String(formData.weekdayPrice || 14000),
        weekend_daily_price_rub: String(formData.weekendPrice || 16000),
        contract_start_date: formData.contractStartDate,
        contract_start_time: formData.contractStartTime,
        contract_end_date: `${String(endDate.getDate()).padStart(2, '0')}.${String(endDate.getMonth() + 1).padStart(2, '0')}.${endDate.getFullYear()}`,
        contract_end_time: "19:00",
        crew_id: crewId,
        original_sha256: fileHash,
        template_version: 1,
      })
      .select()
      .single();

    if (dbError) {
      console.error("[createSubrentContract] DB error:", dbError);
      return { success: false, error: "Failed to store contract" };
    }

    revalidatePath("/partner");

    return {
      success: true,
      contractNumber,
      artifact,
      documentBuffer: docBuffer,
      fileName: docFileName,
    };
  } catch (error) {
    console.error("[createSubrentContract] Error:", error);
    return { success: false, error: "Internal server error" };
  }
}

/** "Молев Георгий Анатольевич" → "Молев Г.А." — signature-line initials. */
function initialsOf(fullName: string | undefined): string {
  const parts = (fullName || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  const surname = parts[0];
  const initials = parts.slice(1).map((p) => (p[0] ? `${p[0].toUpperCase()}.` : "")).join("");
  return initials ? `${surname} ${initials}` : surname;
}

function numberToRussianWords(num: number): string {
  const ones = ["", "один", "два", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять"];
  const teens = ["десять", "одиннадцать", "двенадцать", "тринадцать", "четырнадцать", "пятнадцать", "шестнадцать", "семнадцать", "восемнадцать", "девятнадцать"];
  const tens = ["", "", "двадцать", "тридцать", "сорок", "пятьдесят", "шестьдесят", "семьдесят", "восемьдесят", "девяносто"];
  const hundreds = ["", "сто", "двести", "триста", "четыреста", "пятьсот", "шестьсот", "семьсот", "восемьсот", "девятьсот"];
  const thousands = ["", "тысяча", "тысячи", "тысяч"];

  if (num === 0) return "ноль";

  let words: string[] = [];
  let n = num;

  // Thousands
  if (n >= 1000) {
    const t = Math.floor(n / 1000);
    if (t === 1) words.push("одна тысяча");
    else if (t === 2) words.push("две тысячи");
    else if (t < 5) words.push(`${ones[t]} тысячи`);
    else words.push(`${ones[t]} тысяч`);
    n %= 1000;
  }

  // Hundreds
  if (n >= 100) {
    words.push(hundreds[Math.floor(n / 100)]);
    n %= 100;
  }

  // Tens and ones
  if (n >= 20) {
    words.push(tens[Math.floor(n / 10)]);
    n %= 10;
  }
  if (n >= 10) {
    words.push(teens[n - 10]);
    n = 0;
  }
  if (n > 0) {
    words.push(ones[n]);
  }

  return words.join(" ") || String(num);
}

export async function getAvailableBikes() {
  const { data } = await supabaseAdmin
    .from("cars")
    .select("id, make, model, specs")
    .in("type", ["bike", "ebike"])
    .order("make", { ascending: true })
    .limit(50);

  return { bikes: data || [] };
}
