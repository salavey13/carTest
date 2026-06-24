// /app/franchize/lib/subrent-contract-generator.ts
/**
 * Subrent contract document generator
 * Generates DOCX contracts from subrent application data
 */

import { supabaseAdmin } from "@/lib/supabase-server";
import { buildFranchizeDocxFromTemplate } from "./docx-capability";
import { readFileSync } from "fs";
import { join } from "path";
import { privateSchema } from "@/lib/private-secrets";

// ── Helper functions ─────────────────────────────────────────────────────────────

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

const DEFAULT_HOURLY_PRICES = { "3h": 6000, "6h": 7000, "12h": 8000 };
const DEFAULT_SEASONAL_PRICES = { weekday: 14000, weekend: 16000 };
const DEFAULT_REGULAR_DEPOSIT = 10000;
const DEFAULT_NEW_CLIENT_DEPOSIT = 20000;
const DEFAULT_KM_ALLOWANCE = 200;
const DEFAULT_EXTRA_KM_FEE = 30;
const DEFAULT_DOWNTIME_COMPENSATION = 4000;
const DEFAULT_REPORTING_DAYS = 2;
const DEFAULT_LATE_PENALTY_PERCENT = 0.2;

// ── Main generator function ───────────────────────────────────────────────────────

interface GenerateSubrentContractInput {
  application: any;
  crewSlug: string;
}

interface GenerateSubrentContractResult {
  success: boolean;
  contractNumber?: string;
  error?: string;
}

export async function generateSubrentContract(
  input: GenerateSubrentContractInput
): Promise<GenerateSubrentContractResult> {
  try {
    const { application, crewSlug } = input;

    // Load crew secrets
    const { data: crewSecrets } = await privateSchema()
      .from("crew_secrets")
      .select("*")
      .eq("crew_slug", crewSlug)
      .maybeSingle();

    // Generate contract number from contract_key
    const contractNumber = application.contract_key || `SR-${Date.now().toString(36).toUpperCase()}`;
    const now = new Date();

    // Parse dates (Russian format DD.MM.YYYY)
    const parseRussianDate = (dateStr: string): { day: string; month: string; year: string } => {
      const parts = dateStr.split(".");
      return {
        day: parts[0]?.padStart(2, "0") || "01",
        month: parts[1]?.padStart(2, "0") || "01",
        year: parts[2] || "2026",
      };
    };

    const startDate = parseRussianDate(application.contract_start_date || "01.01.2026");
    const endDate = parseRussianDate(application.contract_end_date || "31.12.2026");

    // Parse owner percentage and prices
    const ownerPercentage = parseInt(application.owner_percentage || "50") || 50;
    const minDailyPrice = parseInt(application.min_daily_price_rub || "9000") || 9000;

    // Build template variables
    const variables = {
      // Contract metadata
      contract_number: contractNumber,
      day: startDate.day,
      month_num: startDate.month,
      year: startDate.year,

      // Park/crew details
      organization_name: crewSecrets?.organization_name || "Мотосалон ВипБайкЭлектро",
      organization_short: crewSecrets?.organization_short || "ИП Воробьев Р.В.",
      organization_representative: crewSecrets?.organization_representative || "",
      legal_address: crewSecrets?.legal_address || "Комсомольская пл. д.2",
      ogrnip: crewSecrets?.ogrnip || "326527500025145",
      inn: crewSecrets?.inn || "525813643035",
      bank_account: crewSecrets?.bank_account || "40802810942710013083",
      bank_name: crewSecrets?.bank_name || "Волго-Вятский Банк ПАО Сбербанк",
      bank_city: crewSecrets?.bank_city || "г. Нижний Новгород",
      bank_corr_account: crewSecrets?.bank_corr_account || "30101810900000000603",
      email: crewSecrets?.email || "",

      // Owner details
      owner_full_name: application.owner_full_name || "",
      owner_birth_date: application.owner_birth_date || "",
      owner_passport_series: application.owner_passport_series || "",
      owner_passport_number: application.owner_passport_number || "",
      owner_passport_issued_by: application.owner_passport_issued_by || "",
      owner_passport_issue_date: application.owner_passport_issue_date || "",
      owner_registration: application.owner_registration || "",
      owner_phone: application.owner_phone || "",
      owner_email: application.owner_email || "",

      // Bike details
      bike_make: application.bike_make || "",
      bike_model: application.bike_model || "",
      bike_vin: application.bike_vin || "",
      bike_plate: application.bike_plate || "",
      bike_year: application.bike_year || "",
      bike_value_rub: application.bike_value_rub || "",
      bike_registration_cert: application.bike_registration_cert || "",
      bike_insurance_policy: application.bike_insurance_policy || "",

      // Payment terms
      owner_percentage: String(ownerPercentage),
      owner_percentage_text: numberToRussianWords(ownerPercentage),
      min_daily_price_rub: String(minDailyPrice),
      min_daily_price_text: numberToRussianWords(minDailyPrice),
      hourly_3h_price_rub: String(application.hourly_3h_price_rub || DEFAULT_HOURLY_PRICES["3h"]),
      hourly_6h_price_rub: String(application.hourly_6h_price_rub || DEFAULT_HOURLY_PRICES["6h"]),
      hourly_12h_price_rub: String(application.hourly_12h_price_rub || DEFAULT_HOURLY_PRICES["12h"]),
      weekday_daily_price_rub: String(application.weekday_daily_price_rub || DEFAULT_SEASONAL_PRICES.weekday),
      weekend_daily_price_rub: String(application.weekend_daily_price_rub || DEFAULT_SEASONAL_PRICES.weekend),
      reporting_period: "неделя",
      payment_deadline_days: String(DEFAULT_REPORTING_DAYS),
      payment_deadline_days_text: "двух",
      late_penalty_percent: String(DEFAULT_LATE_PENALTY_PERCENT),

      // Contract duration
      contract_start_date: application.contract_start_date || "",
      contract_start_time: application.contract_start_time || "19:00",
      contract_end_date: application.contract_end_date || "",
      contract_end_time: application.contract_end_time || "19:00",

      // Deposits and terms
      regular_client_deposit_rub: String(DEFAULT_REGULAR_DEPOSIT),
      regular_client_deposit_text: numberToRussianWords(DEFAULT_REGULAR_DEPOSIT),
      new_client_deposit_rub: String(DEFAULT_NEW_CLIENT_DEPOSIT),
      new_client_deposit_text: numberToRussianWords(DEFAULT_NEW_CLIENT_DEPOSIT),
      daily_km_allowance: String(DEFAULT_KM_ALLOWANCE),
      extra_km_fee_rub: String(DEFAULT_EXTRA_KM_FEE),
      downtime_compensation_daily_rub: String(DEFAULT_DOWNTIME_COMPENSATION),
      downtime_compensation_daily_text: numberToRussianWords(DEFAULT_DOWNTIME_COMPENSATION),

      // Return address (from crew secrets or default)
      return_address: crewSecrets?.return_address || "г. Нижний Новгород, ул. Генкиной 39 А/16 кв 17",

      // Territory
      insurance_territory: crewSecrets?.insurance_territory || "Нижегородской области",
    };

    // Load template
    const templatePath = join(process.cwd(), "docs", "SUBRENTAL_DEAL_TEMPLATE.html");
    const template = readFileSync(templatePath, "utf-8");

    // Generate DOCX
    const docFileName = `subrental-${application.bike_make}-${application.bike_model}-${now.toISOString().split("T")[0]}.docx`
      .replace(/[^a-zA-Zа-яА-Я0-9.\-]/g, "-")
      .replace(/-+/g, "-");

    const result = await buildFranchizeDocxFromTemplate({
      integrationScope: "subrent-approval",
      uploadedBy: crewSlug,
      documentKey: `subrent-${contractNumber}-${Date.now()}`,
      fileName: docFileName,
      template: template,
      variables,
      flowType: "subrental",
      templateMode: "html",
    });

    // TODO: Send document to Telegram or store it somewhere accessible
    // For now, we'll just log it
    console.log("[subrent-contract] Contract generated:", {
      contractNumber,
      fileName: docFileName,
      sha256: result.sha256,
    });

    return {
      success: true,
      contractNumber,
    };
  } catch (error) {
    console.error("[subrent-contract] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
