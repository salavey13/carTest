import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { logger } from "@/lib/logger";
import { z } from "zod";

// Helper to convert date formats (YYYY-MM-DD to DD.MM.YYYY)
function toRussianDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return `${day}.${month}.${year}`;
}

// Helper for number to Russian words (simplified version)
function numberToRussianWords(num: number): string {
  const ones = ["", "один", "два", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять"];
  const tens = ["", "", "двадцать", "тридцать", "сорок", "пятьдесят", "шестьдесят", "семьдесят", "восемьдесят", "девяносто"];
  const hundreds = ["", "сто", "двести", "триста", "четыреста", "пятьсот", "шестьсот", "семьсот", "восемьсот", "девятьсот"];

  if (num === 0) return "ноль";
  if (num < 20) return ones[num] || String(num);
  if (num < 100) {
    const ten = Math.floor(num / 10);
    const one = num % 10;
    return tens[ten] + (one ? " " + ones[one] : "");
  }
  if (num < 1000) {
    const hundred = Math.floor(num / 100);
    const remainder = num % 100;
    return hundreds[hundred] + (remainder ? " " + numberToRussianWords(remainder) : "");
  }
  return String(num);
}

// Schema for validation
const subrentSchema = z.object({
  crewId: z.string().uuid(),
  crewSlug: z.string().min(1),
  bikeId: z.string().uuid(),
  bikePlate: z.string().min(1),
  bikeVin: z.string().min(1),
  bikeYear: z.string().min(1),
  bikeValue: z.string().min(1),
  ownerFullName: z.string().min(2),
  ownerPhone: z.string().min(10),
  ownerEmail: z.string().email().optional(),
  ownerBirthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  ownerPassportSeries: z.string().length(4),
  ownerPassportNumber: z.string().length(6),
  ownerPassportIssueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  ownerPassportIssuedBy: z.string().min(5),
  ownerRegistration: z.string().min(10),
  ownerPercentage: z.number().min(1).max(99),
  minDailyPrice: z.number().min(1000),
  contractStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  contractDuration: z.enum(["season", "3m", "6m", "1y"]),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = subrentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Некорректные данные формы", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Verify crew exists
    const { data: crew } = await supabaseAdmin
      .from("crews")
      .select("id, name, slug")
      .eq("id", data.crewId)
      .maybeSingle();

    if (!crew) {
      return NextResponse.json({ error: "Экипаж не найден" }, { status: 404 });
    }

    // Verify bike exists and belongs to crew
    const { data: bike } = await supabaseAdmin
      .from("cars")
      .select("id, make, model, crew_id, specs, type")
      .eq("id", data.bikeId)
      .maybeSingle();

    if (!bike) {
      return NextResponse.json({ error: "Мотоцикл не найден" }, { status: 404 });
    }

    if (bike.crew_id !== data.crewId) {
      return NextResponse.json({ error: "Мотоцикл не принадлежит этому экипажу" }, { status: 400 });
    }

    // Access private schema
    const privateSchema = () => (supabaseAdmin as any).schema("private");

    // Calculate end date based on duration
    const startDate = new Date(data.contractStartDate);
    let endDate = new Date(startDate);

    switch (data.contractDuration) {
      case "season":
        endDate = new Date(startDate.getFullYear(), 10, 22); // Nov 22
        if (startDate > endDate) endDate.setFullYear(endDate.getFullYear() + 1);
        break;
      case "3m":
        endDate.setMonth(startDate.getMonth() + 3);
        break;
      case "6m":
        endDate.setMonth(startDate.getMonth() + 6);
        break;
      case "1y":
        endDate.setFullYear(startDate.getFullYear() + 1);
        break;
    }

    // Generate contract number
    const contractNumber = `SR-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    // Format dates for storage (DD.MM.YYYY as per existing table pattern)
    const startDateRussian = toRussianDate(data.contractStartDate);
    const endDateRussian = toRussianDate(endDate.toISOString().split("T")[0]);
    const birthDateRussian = toRussianDate(data.ownerBirthDate);
    const passportIssueDateRussian = toRussianDate(data.ownerPassportIssueDate);

    // Get bike details - use form-submitted values for contract-required fields
    const bikeMake = bike.make || "Не указан";
    const bikeModel = bike.model || "";
    // Use form-submitted bike details since bike may not exist in DB yet
    const bikeVin = data.bikeVin || "";
    const bikePlate = data.bikePlate || "";
    const bikeYear = data.bikeYear || "";
    const bikeValue = data.bikeValue || "";
    const bikeValueNum = Number(bikeValue) || 0;

    // Store the application in subrent_contract_artifacts (existing table)
    const { error: insertError } = await privateSchema()
      .from("subrent_contract_artifacts")
      .insert({
        id: crypto.randomUUID(),
        contract_key: contractNumber,
        requested_bike_id: data.bikeId,
        resolved_bike_id: data.bikeId,
        telegram_chat_id: null, // Will be filled when operator contacts
        telegram_message_id: null,

        // Owner details
        owner_full_name: data.ownerFullName,
        owner_birth_date: birthDateRussian,
        owner_passport_series: data.ownerPassportSeries,
        owner_passport_number: data.ownerPassportNumber,
        owner_passport_issued_by: data.ownerPassportIssuedBy,
        owner_passport_issue_date: passportIssueDateRussian,
        owner_registration: data.ownerRegistration,
        owner_phone: data.ownerPhone,
        owner_email: data.ownerEmail || null,

        // Bike details
        bike_make: bikeMake,
        bike_model: bikeModel,
        bike_vin: bikeVin,
        bike_plate: bikePlate,
        bike_year: bikeYear,
        bike_value_rub: bikeValue > 0 ? String(bikeValue) : null,

        // Payment terms
        owner_percentage: String(data.ownerPercentage),
        owner_percentage_text: numberToRussianWords(data.ownerPercentage),
        min_daily_price_rub: String(data.minDailyPrice),
        min_daily_price_text: numberToRussianWords(data.minDailyPrice),

        // Default hourly prices (aligned with /subrent command)
        hourly_3h_price_rub: "6000",
        hourly_6h_price_rub: "7000",
        hourly_12h_price_rub: "8000",
        weekday_daily_price_rub: "14000",
        weekend_daily_price_rub: "16000",
        regular_client_deposit_rub: "10000",
        new_client_deposit_rub: "20000",
        daily_km_allowance: "200",
        extra_km_fee_rub: "30",
        downtime_compensation_daily_rub: "4000",
        reporting_period: "неделя",
        payment_deadline_days: "2",
        late_penalty_percent: "0.2",

        // Contract terms
        contract_start_date: startDateRussian,
        contract_start_time: "19:00", // Default start time
        contract_end_date: endDateRussian,
        contract_end_time: "19:00", // Default end time

        // Crew context
        crew_id: data.crewSlug, // Stores crew_slug as per table pattern

        // Metadata
        created_at: new Date().toISOString(),
      });

    if (insertError) {
      logger.error("[subrent-submit] Insert error:", insertError);
      return NextResponse.json(
        { error: "Ошибка сохранения заявки", details: insertError.message },
        { status: 500 }
      );
    }

    // Log for monitoring
    logger.info("[subrent-submit] Application created:", {
      crewSlug: data.crewSlug,
      bikeId: data.bikeId,
      bikeName: `${bikeMake} ${bikeModel}`,
      ownerName: data.ownerFullName,
      contractNumber,
    });

    return NextResponse.json({
      success: true,
      contractNumber,
      message: "Заявка успешно создана. Оператор свяжется с вами для подтверждения договора.",
    });

  } catch (error) {
    logger.error("[subrent-submit] Error:", error);
    return NextResponse.json(
      { error: "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}
