// /app/webhook-handlers/commands/sample.ts
// /sample — generates a rental contract with dummy data (public offer preview)
// Sends the DOCX to the user so they can review the full contract structure

import { logger } from "@/lib/logger";
import { sendComplexMessage } from "../actions/sendComplexMessage";
import { sendTelegramDocument } from "@/app/actions";
import { buildFranchizeDocxFromTemplate } from "@/app/franchize/lib/docx-capability";
import { readFileSync } from "fs";
import { join } from "path";
import { buildRentalContractVariables } from "@/app/lib/rental-contract-vars";
import { supabaseAdmin } from "@/hooks/supabase";

export async function sampleCommand(chatId: number, userId: number, username?: string): Promise<boolean> {
  logger.info(`[/sample] user=${userId} username=${username}`);

  try {
    // Fetch the first available rental bike for realistic data
    const { data: bike } = await supabaseAdmin
      .from("cars")
      .select("id, make, model, specs, type, crew_id")
      .eq("type", "ebike")
      .limit(1)
      .maybeSingle();

    // Resolve crew_id from slug for fallback bike data
    const { data: fallbackCrew } = await supabaseAdmin
      .from("crews")
      .select("id")
      .eq("slug", "vip-bike")
      .maybeSingle();

    const bikeData = bike || {
      id: "sample-bike",
      make: "79bike",
      model: "Falcon PRO",
      type: "ebike",
      specs: {
        dailyPrice: 10000,
        rent_weekday: 8000,
        rent_weekend: 12000,
        price_per_hour: 1000,
        price_per_3h: 7000,
        price_per_6h: 8000,
        price_per_12h: 9000,
        deposit_rub: 20000,
        sale_price: 310000,
        power_kw: "8",
        top_speed_kmh: "110",
        battery: "72V 60Ah",
        color: "чёрный",
        year: 2025,
        vin: "SAMPLE1234567890",
        category: "A/L3",
      },
      crew_id: fallbackCrew?.id || null,
    };

    // Dummy crew secrets
    const crewSecrets = {
      organizationName: "Мотосалон ВипБайкЭлектро",
      organizationShort: "ИП Воробьев Р.В.",
      issuerName: "Воробьев Р.В.",
      issuerRepresentative: "Сидоров Илья Олегович",
      ogrnip: "326527500025145",
      inn: "525813643035",
      bankAccount: "40802810942710013083",
      bankName: "Волго-Вятский Банк ПАО Сбербанк",
      bankCity: "г. Нижний Новгород",
      bankCorrAccount: "30101810900000000603",
      email: "vip_bike@mail.ru",
      legalAddress: "г. Нижний Новгород, пл. Комсомольская 2",
    };

    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const fmt = (d: Date) => `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`;

    // Generate with dummy renter data
    const vars = buildRentalContractVariables({
      renter: {
        fullName: "Иванов Иван Иванович",
        birthDate: "15.03.1990",
        phone: "+7 999 123-45-67",
        email: "",
        passportSeries: "4509",
        passportNumber: "123456",
        passportIssueDate: "15.03.2020",
        passportIssuedBy: "ОМВД России по г. Нижнему Новгороду",
        registration: "г. Нижний Новгород, ул. Большая Покровская, д. 1, кв. 1",
        address: "г. Нижний Новгород, ул. Большая Покровская, д. 1, кв. 1",
        driverLicenseSeries: "99",
        driverLicenseNumber: "76 123456",
      },
      bike: {
        id: bikeData.id,
        make: bikeData.make,
        model: bikeData.model,
        type: bikeData.type,
        specs: bikeData.specs,
      },
      period: {
        startDate: fmt(tomorrow),
        startTime: "10:00",
        endDate: fmt(tomorrow),
        endTime: "13:00",
      },
      crewSecrets,
      meta: {
        contractNumber: "ОБРАЗЕЦ",
        signatureTimestamp: now.toLocaleString("ru-RU"),
      },
      equipment: {
        helmets: 1,
        gloves: 1,
        net: false,
        backpack: false,
        bag: false,
        charger: true,
      },
      odometerBefore: 1234,
      paymentSplit: {
        cashAmount: 8000,
        bankAmount: 0,
      },
    });

    // Override document key to mark as sample
    vars.document_key = `SAMPLE-${Date.now()}`;

    // Build DOCX
    const templateHtml = readFileSync(join(process.cwd(), "docs", "RENTAL_DEAL_TEMPLATE.html"), "utf8");
    const docResult = await buildFranchizeDocxFromTemplate({
      template: templateHtml,
      variables: vars,
      fileName: "obrazets-dogovora-arendy.docx",
      integrationScope: "sample-doc",
      uploadedBy: String(userId),
    });

    // Send as document
    await sendComplexMessage(
      chatId,
      "📄 *Образец договора аренды*\n\n"
      + "Это пример договора, который вы получите при аренде байка.\n"
      + "Все данные вымышленные — договор содержит реальные тарифы и условия.\n\n"
      + "Если готовы оформить аренду — отправьте /doc",
      [],
      { parseMode: "Markdown" },
    );

    const docxBuf = Buffer.from(docResult.bytes);
    await sendTelegramDocument(String(chatId), docxBuf, "obrazets-dogovara-arendy.docx");

    logger.info(`[/sample] sent sample DOCX to user=${userId}`);
    return true;
  } catch (error) {
    logger.error("[/sample] Error generating sample:", error);
    await sendComplexMessage(
      chatId,
      "❌ Не удалось создать образец. Попробуйте позже или напишите менеджеру.",
      [],
      { removeKeyboard: true },
    );
    return false;
  }
}
