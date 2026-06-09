/**
 * /doc command handler - MANUAL ONLY VERSION (supports both RENT and SALE)
 * ==========================================================================
 *
 * IMPORTANT CHANGES:
 * - NO photo/VLM processing - purely manual input
 * - Step-by-step field collection for passport and license data
 * - Uses TELEGRAM_BOT_TOKEN directly (NOT forward-telegram API)
 * - Saves to both private.user_rental_secrets AND public.{rental,sale}_contract_artifacts
 * - Supports BOTH rent and sale deal types
 *
 * Flow (common):
 *   /doc [bikeId]          → select bike → choose deal type
 *
 * Flow (RENT):
 *   Step 1: Full name       → manual text input
 *   Step 2: Passport number → manual text input (series + number)
 *   Step 3: Passport issue  → manual text input (date + authority)
 *   Step 4: Birth date      → manual text input
 *   Step 5: Registration    → manual text input (address)
 *   Step 6: License name    → manual text input
 *   Step 7: License number  → manual text input (series + number)
 *   Step 8: License issue   → manual text input (date)
 *   Step 9: License expiry  → manual text input
 *   Step 10: Categories     → inline keyboard selection
 *   Step 11: Schedule       → free text (start/end dates)
 *   → Generate contract + save to DB + send via Telegram
 *
 * Flow (SALE):
 *   Step 1: Full name       → manual text input
 *   Step 2: Passport number → manual text input (series + number)
 *   Step 3: Passport issue  → manual text input (date + authority)
 *   Step 4: Birth date      → manual text input
 *   Step 5: Registration    → manual text input (address) - buyer address
 *   → Generate contract + save to DB + send via Telegram
 *
 * State machine uses `user_states` table:
 *   - doc_awaiting_bike           (if /doc without bikeId)
 *   - doc_awaiting_deal_type       (choose rent or sale)
 *   - doc_manual_passport_name     (step 1 - both)
 *   - doc_manual_passport_number   (step 2 - both)
 *   - doc_manual_passport_issue    (step 3 - both)
 *   - doc_manual_passport_birth    (step 4 - both)
 *   - doc_manual_passport_reg      (step 5 - both)
 *   - doc_manual_license_name      (step 6 - rent only)
 *   - doc_manual_license_number    (step 7 - rent only)
 *   - doc_manual_license_issue     (step 8 - rent only)
 *   - doc_manual_license_expiry    (step 9 - rent only)
 *   - doc_manual_license_categories (step 10 - rent only)
 *   - doc_awaiting_schedule        (step 11 - rent only)
 *   - doc_sale_confirm             (sale confirmation)
 */

"use server";

import { logger } from "@/lib/logger";
import { supabaseAdmin, supabaseAnon } from "@/hooks/supabase";
import { sendComplexMessage, KeyboardButton } from "../actions/sendComplexMessage";
import { notifyAdmin, sendTelegramDocument } from "@/app/actions";
import { deriveUserAccessTier, getAccessTierLabel } from "@/app/lib/derive-access-tier";
import type { AccessTier } from "@/app/lib/ocr-constants";
import { buildFranchizeDocxFromTemplate } from "@/app/franchize/lib/docx-capability";
import { createHash } from "crypto";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const DOC_STATE_EXPIRY_MINUTES = 30;

// ── Keyboard builders ─────────────────────────────────────────────────────────────

/**
 * Build inline keyboard for category selection.
 */
function buildCategoryKeyboard(selected: string[] = []): KeyboardButton[][] {
  const categories = ["A", "A1", "B", "B1", "M", "C", "C1"];
  const rows: KeyboardButton[][] = [];

  for (let i = 0; i < categories.length; i += 3) {
    const row: KeyboardButton[] = [];
    for (let j = i; j < Math.min(i + 3, categories.length); j++) {
      const cat = categories[j];
      const isSelected = selected.includes(cat);
      row.push({
        text: `${cat} ${isSelected ? "✅" : "⭕"}`,
        callback_data: `cat_${cat}`,
      });
    }
    rows.push(row);
  }

  rows.push([
    { text: selected.length > 0 ? "✓ Готово" : "Нет прав", callback_data: "cat_done" },
    { text: "↩️ Отменить", callback_data: "cat_cancel" },
  ]);

  return rows;
}

/**
 * Build keyboard for deal type selection.
 */
function buildDealTypeKeyboard(): KeyboardButton[][] {
  return [
    [
      { text: "📋 Аренда", callback_data: "deal_type_rent" },
      { text: "💰 Продажа", callback_data: "deal_type_sale" },
    ],
  ];
}

// ── State type for /doc flow ─────────────────────────────────────────────────────

interface DocFlowContext {
  dealType: "rent" | "sale";
  bikeId: string;
  bikeMake?: string;
  bikeModel?: string;
  extractionProvider: "manual";
  // Passport fields (both rent and sale)
  mpFullName?: string;
  mpSeries?: string;
  mpNumber?: string;
  mpIssueDate?: string;
  mpIssuedBy?: string;
  mpBirthDate?: string;
  mpRegistration?: string;
  // License fields (rent only)
  mlFullName?: string;
  mlSeries?: string;
  mlNumber?: string;
  mlIssueDate?: string;
  mlExpiryDate?: string;
  mlCategories?: string[];
  mlAccessTier?: AccessTier;
  // Sale fields
  salePrice?: string;
  warrantyMonths?: string;
}

// ── Bike resolution ─────────────────────────────────────────────────────────────

async function resolveBikeById(bikeId: string): Promise<{
  id: string;
  make: string;
  model: string;
  specs: Record<string, any>;
  type: string;
} | null> {
  const { data: exactMatch } = await supabaseAdmin
    .from("cars")
    .select("id, make, model, specs, type")
    .eq("id", bikeId)
    .in("type", ["bike", "ebike"])
    .maybeSingle();

  if (exactMatch) return exactMatch as any;

  const { data: candidates } = await supabaseAdmin
    .from("cars")
    .select("id, make, model, specs, type")
    .in("type", ["bike", "ebike"])
    .limit(100);

  if (!candidates?.length) return null;

  const norm = (v = "") => String(v).toLowerCase().replace(/[^a-zа-я0-9]+/gi, " ").trim();
  const qn = norm(bikeId);
  if (!qn) return null;

  let best: any = null;
  let bestScore = 0;
  for (const bike of candidates) {
    const hay = [bike.id, bike.make, bike.model, bike.specs?.vin, bike.specs?.frame].map(norm).join(" ");
    if (hay.includes(qn)) {
      const score = 1000 + qn.length;
      if (score > bestScore) { bestScore = score; best = bike; }
      continue;
    }
    const parts = qn.split(" ").filter(Boolean);
    let score = 0;
    for (const p of parts) {
      if (hay.includes(p)) score += 20 + p.length;
    }
    if (score > bestScore) { bestScore = score; best = bike; }
  }

  return bestScore > 0 ? best : null;
}

async function getAvailableBikes(): Promise<Array<{ id: string; make: string; model: string; specs?: Record<string, any> }>> {
  const { data } = await supabaseAdmin
    .from("cars")
    .select("id, make, model, specs")
    .in("type", ["bike", "ebike"])
    .order("make", { ascending: true })
    .limit(20);

  return (data || []) as Array<{ id: string; make: string; model: string; specs?: Record<string, any> }>;
}

// ── Contract generation (supports both rent and sale) ───────────────────────────────

async function generateAndSendContract(
  chatId: number,
  userId: string,
  context: DocFlowContext,
  scheduleText?: string,
): Promise<boolean> {
  try {
    const bike = await resolveBikeById(context.bikeId);
    if (!bike) {
      await sendComplexMessage(chatId, "🚨 Не удалось найти указанный байк. Попробуйте /doc снова.", [], { removeKeyboard: true });
      return false;
    }

    const isElectric = bike.type === "ebike"
      || /electric/i.test(String(bike.specs?.type || ""))
      || /электро|electric|e-bike|ebike/i.test(String(bike.specs?.fuel_type || ""))
      || (bike.specs?.power_kw && Number(bike.specs.power_kw) > 0 && !bike.specs?.engine_cc);

    const now = new Date();
    const isRent = context.dealType === "rent";

    // Parse schedule for rent
    let startDate, endDate, startTime, endTime;
    if (isRent && scheduleText) {
      // Simple date parsing from schedule text
      const text = String(scheduleText || '').toLowerCase();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);

      const parseDateToken = (token: string) => {
        const t = String(token || '').toLowerCase();
        if (t === 'сегодня') return `${String(today.getDate()).padStart(2,'0')}.${String(today.getMonth()+1).padStart(2,'0')}.${today.getFullYear()}`;
        if (t === 'завтра') return `${String(tomorrow.getDate()).padStart(2,'0')}.${String(tomorrow.getMonth()+1).padStart(2,'0')}.${tomorrow.getFullYear()}`;
        const parts = t.split('.').map(v=>v.trim()).filter(Boolean);
        if (parts.length < 2) return null;
        let [d,m,y] = parts;
        if (!y) y = String(today.getFullYear());
        if (y.length === 2) y = `20${y}`;
        return `${d.padStart(2,'0')}.${m.padStart(2,'0')}.${y}`;
      };

      const startMatch = text.match(/с\s*(сегодня|завтра|\d{1,2}\.\d{1,2}(?:\.\d{2,4})?)\s*(?:в)?\s*(\d{1,2}(?:[:.]\d{2})?)/i);
      const endMatch = text.match(/до\s*(завтра|сегодня|\d{1,2}\.\d{1,2}(?:\.\d{2,4})?)\s*(?:до|в)?\s*(\d{1,2}(?:[:.]\d{2})?)/i);

      if (startMatch) {
        startDate = parseDateToken(startMatch[1]);
        startTime = startMatch[2]?.replace(':', '.') || '18.00';
      }
      if (endMatch) {
        endDate = parseDateToken(endMatch[1]);
        endTime = endMatch[2]?.replace(':', '.') || '10.00';
      }

      // Defaults if not parsed
      if (!startDate) startDate = `${String(today.getDate()).padStart(2,'0')}.${String(today.getMonth()+1).padStart(2,'0')}.${today.getFullYear()}`;
      if (!startTime) startTime = '18.00';
      if (!endDate) endDate = `${String(tomorrow.getDate()).padStart(2,'0')}.${String(tomorrow.getMonth()+1).padStart(2,'0')}.${tomorrow.getFullYear()}`;
      if (!endTime) endTime = '10.00';
    } else if (isRent) {
      // Default dates if no schedule provided
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
      startDate = `${String(today.getDate()).padStart(2,'0')}.${String(today.getMonth()+1).padStart(2,'0')}.${today.getFullYear()}`;
      startTime = '18.00';
      endDate = `${String(tomorrow.getDate()).padStart(2,'0')}.${String(tomorrow.getMonth()+1).padStart(2,'0')}.${tomorrow.getFullYear()}`;
      endTime = '10.00';
    }

    // Build template vars based on deal type
    const vars: Record<string, string> = {
      // Common fields
      contract_number: `${now.getDate()}.${now.getMonth() + 1}/${bike.id}`,
      day: String(now.getDate()).padStart(2, "0"),
      month: now.toLocaleString("ru-RU", { month: "long" }),
      month_num: String(now.getMonth() + 1).padStart(2, "0"),
      year: String(now.getFullYear()),
      contract_day: String(now.getDate()),
      contract_month_genitive: now.toLocaleString("ru-RU", { month: "long" }),
      contract_year: String(now.getFullYear()),
      appendix_date: `${String(now.getDate()).padStart(2,'0')}.${String(now.getMonth()+1).padStart(2,'0')}.${now.getFullYear()}`,

      // Renter/Buyer fields
      buyer_full_name: context.mpFullName || "",
      buyer_short_name: context.mpFullName?.split(' ').map((n, i) => i === 0 ? n : `${n[0]}.`).join(' ') || "",
      buyer_birth_date: context.mpBirthDate || "",
      buyer_passport_number: `${context.mpSeries || ""} ${context.mpNumber || ""}`.trim(),
      buyer_passport_issued_by: context.mpIssuedBy || "",
      buyer_passport_issue_date: context.mpIssueDate || "",
      buyer_registration: context.mpRegistration || "",
      buyer_email: "",

      // Bike fields
      product_name: isElectric ? "Электромотоцикл" : "Мотоцикл",
      product_color: bike.specs?.color || "уточняется",
      product_type: bike.specs?.bike_subtype || (isElectric ? "Электромотоцикл" : "Мотоцикл"),
      product_motor_type: isElectric ? "Электрический двигатель" : "ДВС",
      product_motor_power: bike.specs?.power_kw ? `${bike.specs.power_kw} кВт` : (bike.specs?.engine_cc ? `рабочий объем ${bike.specs.engine_cc} куб.см` : ""),
      product_vin: bike.specs?.vin || bike.specs?.frame || "уточняется",
      product_year: String(bike.specs?.year || "уточняется"),
      product_unit: "шт.",
      spec_number: `${now.getDate()}.${now.getMonth() + 1}/${bike.id}`,

      // Seller/Lessor fields
      seller_address: "г. Нижний Новгород, пл. Комсомольская 2",
      lessor_address: "г. Нижний Новгород, пл. Комсомольская 2",
      issuer_name: "Воробьев Р.В.",
      issuer_signatory: "Менеджер Мотосалона",
      issuer_representative: "ИП Воробьев Р.В.",
      signature_timestamp: now.toLocaleString("ru-RU"),
      signature_fingerprint: "manual-telegram-doc",
      renter_signature: "согласие через Telegram",
    };

    // Rent-specific fields
    if (isRent) {
      Object.assign(vars, {
        renter_full_name: context.mpFullName || "",
        renter_birth_date: context.mpBirthDate || "",
        renter_phone: "",
        renter_email: "",
        renter_driver_license: `${context.mlSeries || ""} ${context.mlNumber || ""}`.trim(),
        renter_passport: `${context.mpSeries || ""} ${context.mpNumber || ""}`.trim(),
        renter_passport_issue_date: context.mpIssueDate || "",
        renter_passport_issued_by: context.mpIssuedBy || "",
        renter_registration: context.mpRegistration || "",
        renter_address: context.mpRegistration || "",

        bike_make_model: `${bike.make || ""} ${bike.model || ""}`.trim(),
        bike_make: bike.make || "уточняется",
        bike_model: bike.model || "уточняется",
        bike_plate: bike.specs?.plate || "уточняется",
        bike_vin: bike.specs?.vin || bike.specs?.frame || "уточняется",
        bike_category: bike.specs?.category || "A/L3",
        bike_color: bike.specs?.color || "уточняется",
        bike_year: bike.specs?.year || "уточняется",
        bike_engine_cc: String(bike.specs?.engine_cc || bike.specs?.displacement_cc || "0"),
        bike_power_hp: String(bike.specs?.power_hp || bike.specs?.max_power_hp || "0"),
        bike_power_kw: String(bike.specs?.power_kw || "0"),
        bike_max_speed: String(bike.specs?.max_speed || bike.specs?.top_speed_kmh || "уточняется"),
        bike_battery: String(bike.specs?.battery || (isElectric ? "уточняется" : "")),
        bike_vehicle_type_label: isElectric ? "ЭЛЕКТРОМОТОЦИКЛА" : "МОТОЦИКЛА",
        bike_vehicle_type_accusative: isElectric ? "электромотоцикл" : "мотоцикл",
        bike_vehicle_type_genitive: isElectric ? "электромотоцикла" : "мотоцикла",
        bike_engine_spec_line_1: (() => {
          const ccPart = bike.specs?.engine_cc ? `рабочий объем ${bike.specs.engine_cc} куб. см` : "";
          const hpPart = bike.specs?.power_hp ? `мощность ${bike.specs.power_hp} л.с.` : "";
          if (isElectric) return bike.specs?.power_kw ? `мощность двигателя (номинальная) ${bike.specs.power_kw} кВт` : "";
          return [ccPart, hpPart].filter(Boolean).join(", ") || "";
        })(),
        bike_engine_spec_line_2: bike.specs?.max_speed ? `максимальная конструктивная скорость ${bike.specs.max_speed} км/ч` : "",
        bike_engine_spec_line_3: (() => {
          if (isElectric) return bike.specs?.battery ? `аккумулятор: тип/ёмкость ${bike.specs.battery}` : "";
          return "";
        })(),

        rent_start_date: startDate || "",
        rent_start_time: startTime?.replace('.', ':') || "18:00",
        rent_end_date: endDate || "",
        rent_end_time: endTime?.replace('.', ':') || "10:00",
        daily_price_rub: String(bike.specs?.dailyPrice || bike.specs?.rent_weekday || "10000"),
        hourly_price_rub: String(bike.specs?.price_per_hour || ""),
        deposit_rub: String(bike.specs?.deposit_rub || "20000"),
        subtotal_rub: String(bike.specs?.dailyPrice || bike.specs?.rent_weekday || "10000"),
        bike_value_rub: String(bike.specs?.sale_price || bike.specs?.price_rub || "850000"),
        bike_value_words: "",
        bike_mileage: String(bike.specs?.mileage || ""),
        return_address: "г. Нижний Новгород, пл. Комсомольская 2",
        included_km_per_day: "200",
        extra_km_fee_rub: "35",
        late_return_penalty_rub: "10000",
        late_return_penalty_max_days: "90",
        equipment: "ключ(и) 1 шт.; шлем 1",
        damage_notes_at_delivery: "от даты начала аренды",
        damage_notes_at_return: "от даты возврата ТС",
        battery_level_start: "100 %",
        battery_level_end: "____ %",
        media_links: "телефон",
        damage_price_list: "мотоцикл в сборе / царапина на пластике / прочее по расчету",
        document_key: `rental-${bike.id}-${Date.now()}`,
      });
    }

    // Sale-specific fields
    if (!isRent) {
      const salePrice = context.salePrice || String(bike.specs?.sale_price || bike.specs?.price_rub || "390000");
      const warrantyMonths = context.warrantyMonths || "6";

      Object.assign(vars, {
        price_digits: salePrice,
        price_words: numberToRussianWords(Number(salePrice)),
        price_digits_table: salePrice.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1 ') + ",00",
        warranty_months: warrantyMonths,
        document_key: `sale-${bike.id}-${Date.now()}`,

        // Bike fields for sale
        bike_make: bike.make || "уточняется",
        bike_model: bike.model || "уточняется",
        bike_vin: bike.specs?.vin || bike.specs?.frame || "уточняется",
        bike_category: bike.specs?.category || "A/L3",
        bike_color: bike.specs?.color || "уточняется",
        bike_year: bike.specs?.year || "уточняется",
        bike_engine_cc: String(bike.specs?.engine_cc || bike.specs?.displacement_cc || "0"),
        bike_power_hp: String(bike.specs?.power_hp || bike.specs?.max_power_hp || "0"),
        bike_power_kw: String(bike.specs?.power_kw || "0"),
        bike_battery: String(bike.specs?.battery || (isElectric ? "уточняется" : "")),
      });
    }

    // Generate DOCX
    const templateMode = "html";
    const docxBuf = await buildFranchizeDocxFromTemplate(vars, templateMode);

    const docSha256 = createHash("sha256").update(docxBuf).digest("hex");
    const docFileName = `${context.dealType}-contract-${bike.make}-${bike.model}-${startDate || now.toISOString().split('T')[0]}.docx`
      .replace(/[^a-zA-Zа-яА-Я0-9.\-]/g, "-")
      .replace(/-+/g, "-");

    // Generate QR code
    const qrDeepLink = `https://t.me/oneBikePlsBot/app?startapp=rent_${bike.id}_${docSha256}`;
    const qrPngUrl = `https://api.qrserver.com/v1/create-qr-code/?size=420x420&data=${encodeURIComponent(qrDeepLink)}&color=000000&bgcolor=ffffff&margin=1`;

    let qrPngBuffer: Buffer | null = null;
    try {
      const qrRes = await fetch(qrPngUrl, { signal: AbortSignal.timeout(8000) });
      if (qrRes.ok) {
        qrPngBuffer = Buffer.from(await qrRes.arrayBuffer());
      }
    } catch (qrErr) {
      logger.warn("[/doc] QR generation failed, sending DOCX only:", qrErr?.message || qrErr);
    }

    // Send the contract via Telegram (DOCX + QR as media group if QR available)
    if (qrPngBuffer) {
      const token = process.env.TELEGRAM_BOT_TOKEN;
      const mediaGroupUrl = `https://api.telegram.org/bot${token}/sendMediaGroup`;
      const form = new FormData();
      form.append('chat_id', String(chatId));

      const mediaItems = [
        { type: 'document', media: 'attach://docx', parse_mode: 'HTML' },
        { type: 'photo', media: 'attach://qr', caption: `📲 <b>QR для быстрой повторной аренды</b>\nНаведите камеру — данные заполнятся автоматически.\n\n🔗 ${qrDeepLink}`, parse_mode: 'HTML' },
      ];
      form.append('media', JSON.stringify(mediaItems));
      form.append('docx', new Blob([docxBuf], {type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}), docFileName);
      form.append('qr', new Blob([qrPngBuffer], {type:'image/png'}), `qr-${bike.id}.png`);

      try {
        const res = await fetch(mediaGroupUrl, {method:'POST', body: form});
        const bodyText = await res.text();
        try {
          const results = JSON.parse(bodyText || '{}');
          if (!results.ok) throw new Error(results.description || 'sendMediaGroup failed');
          logger.info("[/doc] DOCX + QR sent successfully as media group");
        } catch (parseError) {
          logger.warn("[/doc] sendMediaGroup response parse issue, but message likely sent");
        }
      } catch (sendError) {
        logger.warn("[/doc] sendMediaGroup failed, falling back to sendDocument:", sendError?.message);
        await sendTelegramDocument(
          String(chatId),
          docxBuf,
          docFileName,
          `${isRent ? 'Договор аренды' : 'Договор купли-продажи'}: ${bike.make} ${bike.model}\n\n🔗 Быстрая повторная аренда:\n${qrDeepLink}`,
        );
      }
    } else {
      await sendTelegramDocument(
        String(chatId),
        docxBuf,
        docFileName,
        `${isRent ? 'Договор аренды' : 'Договор купли-продажи'}: ${bike.make} ${bike.model}\n\n🔗 Быстрая повторная аренда:\n${qrDeepLink}`,
      );
    }

    // Save to private.user_rental_secrets
    await saveUserRentalSecrets({
      chat_id: String(userId),
      crew_slug: "vip-bike",
      doc_sha256: docSha256,
      renter_full_name: context.mpFullName || null,
      renter_passport: `${context.mpSeries || ""} ${context.mpNumber || ""}`.trim() || null,
      renter_passport_issue_date: context.mpIssueDate || null,
      renter_passport_issued_by: context.mpIssuedBy || null,
      renter_registration: context.mpRegistration || null,
      renter_driver_license: isRent ? `${context.mlSeries || ""} ${context.mlNumber || ""}`.trim() || null : null,
      renter_birth_date: context.mpBirthDate || null,
      renter_phone: null,
      renter_email: null,
      renter_address: context.mpRegistration || null,
      source_doc_key: vars.document_key,
      source_rental_id: null,
      verification_status: "verified",
      template_version: 1,
    });

    // Save to appropriate contract artifacts table
    if (isRent) {
      await saveRentalContractArtifact({
        contract_key: vars.document_key,
        original_sha256: docSha256,
        requested_bike_id: context.bikeId,
        resolved_bike_id: bike.id,
        telegram_chat_id: String(userId),
        telegram_message_id: null,
        provider: "manual-telegram-doc",
        metadata: {
          renter_full_name: context.mpFullName,
          renter_passport: `${context.mpSeries || ""} ${context.mpNumber || ""}`.trim(),
          renter_driver_license: `${context.mlSeries || ""} ${context.mlNumber || ""}`.trim(),
          license_categories: context.mlCategories,
          access_tier: context.mlAccessTier,
        },
      });
    } else {
      await saveSaleContractArtifact({
        contract_key: vars.document_key,
        original_sha256: docSha256,
        requested_bike_id: context.bikeId,
        resolved_bike_id: bike.id,
        telegram_chat_id: String(userId),
        telegram_message_id: null,
        provider: "manual-telegram-doc",
        metadata: {
          buyer_full_name: context.mpFullName,
          buyer_passport: `${context.mpSeries || ""} ${context.mpNumber || ""}`.trim(),
          buyer_registration: context.mpRegistration,
          sale_price: context.salePrice || Number(bike.specs?.sale_price || bike.specs?.price_rub),
          warranty_months: context.warrantyMonths,
        },
      });
    }

    // Build summary message
    const summary = [
      `✅ *${isRent ? 'Договор аренды' : 'Договор купли-продажи'} сформирован и отправлен!*`,
      "",
      `🏍 *${bike.make} ${bike.model}*`,
      `👤 ${context.mpFullName || "—"}`,
      `🪪 Паспорт: ${context.mpSeries || ""} ${context.mpNumber || ""}`,
    ];

    if (isRent) {
      const tier = context.mlAccessTier || "none";
      const tierLabel = getAccessTierLabel(tier);
      const catStr = (context.mlCategories || []).join(", ") || "не определены";
      summary.push(`🚗 ВУ: ${context.mlSeries || ""} ${context.mlNumber || ""} (кат. ${catStr})`);
      summary.push(`🛡 Допуск: *${tierLabel}*`);
    }

    summary.push("", "📝 Ручной ввод данных", "Данные сохранены для быстрого повторного бронирования.", "Используй /doc для нового договора или открой приложение.");

    await sendComplexMessage(chatId, summary.join("\n"), [
      [{ text: "🚀 Открыть VIP Bike", url: process.env.TELEGRAM_BOT_LINK || "https://t.me/oneBikePlsBot/app" }],
    ], { removeKeyboard: true, parseMode: "Markdown" });

    await notifyAdmin(
      `📄 Новый ${isRent ? 'аренды' : 'продажи'} через /doc (ручной ввод)\n` +
      `Provider: manual\n` +
      `User: ${userId}\n` +
      `Bike: ${bike.make} ${bike.model} (${bike.id})\n` +
      `Renter/Buyer: ${context.mpFullName || "—"}` +
      (isRent ? `\nCategories: ${(context.mlCategories || []).join(", ")}` : "") +
      (isRent ? `\nTier: ${getAccessTierLabel(context.mlAccessTier || "none")}` : ""),
    );

    return true;
  } catch (error) {
    logger.error("[/doc] Contract generation failed", error);
    await sendComplexMessage(
      chatId,
      "🚨 Ошибка при генерации договора. Данные сохранены — попробуйте ещё раз или обратитесь к оператору.",
      [],
      { removeKeyboard: true },
    );
    return false;
  }
}

// ── Helper: Convert number to Russian words ───────────────────────────────────────

function numberToRussianWords(n: number): string {
  const units = ["", "один", "два", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять"];
  const teens = ["десять", "одиннадцать", "двенадцать", "тринадцать", "четырнадцать", "пятнадцать", "шестнадцать", "семнадцать", "восемнадцать", "девятнадцать"];
  const tens = ["", "", "двадцать", "тридцать", "сорок", "пятьдесят", "шестьдесят", "семьдесят", "восемьдесят", "девяносто"];
  const hundreds = ["", "сто", "двести", "триста", "четыреста", "пятьсот", "шестьсот", "семьсот", "восемьсот", "девятьсот"];
  const thousands = ["", "тысяча", "тысячи", "тысяч", "тысяч", "тысяч", "тысяч", "тысяч", "тысяч", "тысяч"];

  if (n === 0) return "ноль";
  if (n < 10) return units[n];
  if (n < 20) return teens[n - 10];
  if (n < 100) {
    const t = Math.floor(n / 10);
    const u = n % 10;
    return tens[t] + (u > 0 ? " " + units[u] : "");
  }
  if (n < 1000) {
    const h = Math.floor(n / 100);
    const r = n % 100;
    return hundreds[h] + (r > 0 ? " " + numberToRussianWords(r) : "");
  }
  if (n < 1000000) {
    const th = Math.floor(n / 1000);
    const r = n % 1000;
    const thWord = th === 1 ? "тысяча" : th < 5 ? "тысячи" : "тысяч";
    return numberToRussianWords(th) + " " + thWord + (r > 0 ? " " + numberToRussianWords(r) : "");
  }
  return String(n);
}

// ── Database save functions ─────────────────────────────────────────────────────

async function saveUserRentalSecrets(data: {
  chat_id: string;
  crew_slug: string;
  doc_sha256: string;
  renter_full_name: string | null;
  renter_passport: string | null;
  renter_passport_issue_date: string | null;
  renter_passport_issued_by: string | null;
  renter_registration: string | null;
  renter_driver_license: string | null;
  renter_birth_date: string | null;
  renter_phone: string | null;
  renter_email: string | null;
  renter_address: string | null;
  source_doc_key: string | null;
  source_rental_id: string | null;
  verification_status: string;
  template_version: number;
}) {
  const { error } = await supabaseAdmin.from("user_rental_secrets").insert(data);
  if (error) {
    logger.error("[/doc] Failed to save user_rental_secrets:", error);
  }
}

async function saveRentalContractArtifact(data: {
  contract_key: string;
  original_sha256: string;
  requested_bike_id: string;
  resolved_bike_id: string;
  telegram_chat_id: string;
  telegram_message_id: number | null;
  provider: string;
  metadata: Record<string, any>;
}) {
  const { error } = await supabaseAdmin.from("rental_contract_artifacts").insert(data);
  if (error) {
    logger.error("[/doc] Failed to save rental_contract_artifacts:", error);
  }
}

async function saveSaleContractArtifact(data: {
  contract_key: string;
  original_sha256: string;
  requested_bike_id: string;
  resolved_bike_id: string;
  telegram_chat_id: string;
  telegram_message_id: number | null;
  provider: string;
  metadata: Record<string, any>;
}) {
  const { error } = await supabaseAdmin.from("sale_contract_artifacts").insert(data);
  if (error) {
    logger.error("[/doc] Failed to save sale_contract_artifacts:", error);
  }
}

// ── State management ──────────────────────────────────────────────────────────

async function setDocState(userId: string, state: string, context: DocFlowContext) {
  await supabaseAdmin.from("user_states").upsert({
    user_id: userId,
    state,
    context,
    expires_at: new Date(Date.now() + DOC_STATE_EXPIRY_MINUTES * 60 * 1000).toISOString(),
  });
}

async function clearDocState(userId: string) {
  await supabaseAdmin.from("user_states").delete().eq("user_id", userId);
}

async function getDocState(userId: string): Promise<{ state: string; context: DocFlowContext } | null> {
  const { data } = await supabaseAdmin
    .from("user_states")
    .select("state, context, expires_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (!data) return null;

  if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) {
    await clearDocState(userId);
    return null;
  }

  return {
    state: data.state,
    context: (data.context || {}) as DocFlowContext,
  };
}

// ── Manual input state handlers (passport - both rent and sale) ───────────────────────

async function handleManualPassportName(userId: string, chatId: number, context: DocFlowContext, text: string) {
  context.mpFullName = text.trim();
  await setDocState(userId, "doc_manual_passport_number", context);
  await sendComplexMessage(
    chatId,
    `✅ ФИО: *${text}*\n\nШаг 2 из 5: Серия и номер паспорта\n\nВведите серию и номер через пробел (4 цифры 6 цифр).\n\nПример: *4509 123456*`,
    [],
    { removeKeyboard: true, parseMode: "Markdown" },
  );
}

async function handleManualPassportNumber(userId: string, chatId: number, context: DocFlowContext, text: string) {
  const parts = text.trim().split(/\s+/);
  if (parts.length < 2) {
    await sendComplexMessage(
      chatId,
      "❌ Неверный формат. Введите серию и номер через пробел.\n\nПример: *4509 123456*",
      [],
      { removeKeyboard: true, parseMode: "Markdown" },
    );
    return;
  }
  context.mpSeries = parts[0];
  context.mpNumber = parts[1];
  await setDocState(userId, "doc_manual_passport_issue", context);
  await sendComplexMessage(
    chatId,
    `✅ Паспорт: *${context.mpSeries} ${context.mpNumber}*\n\nШаг 3 из 5: Дата выдачи и кем выдан\n\nВведите в формате:\nДД.ММ.ГГГГ — кем выдан\n\nПример: *15.03.2023 — ОМВД России по Н.Новгороду*`,
    [],
    { removeKeyboard: true, parseMode: "Markdown" },
  );
}

async function handleManualPassportIssue(userId: string, chatId: number, context: DocFlowContext, text: string) {
  const parts = text.split(/—|-/).map(s => s.trim());
  if (parts.length < 2) {
    await sendComplexMessage(
      chatId,
      "❌ Неверный формат. Используйте разделитель — или -\n\nПример: *15.03.2023 — ОМВД России по Н.Новгороду*",
      [],
      { removeKeyboard: true, parseMode: "Markdown" },
    );
    return;
  }
  context.mpIssueDate = parts[0];
  context.mpIssuedBy = parts.slice(1).join(" ");
  await setDocState(userId, "doc_manual_passport_birth", context);
  await sendComplexMessage(
    chatId,
    `✅ Выдан: *${context.mpIssuedBy}*\n\nШаг 4 из 5: Дата рождения\n\nВведите дату рождения (ДД.ММ.ГГГГ).`,
    [],
    { removeKeyboard: true, parseMode: "Markdown" },
  );
}

async function handleManualPassportBirth(userId: string, chatId: number, context: DocFlowContext, text: string) {
  context.mpBirthDate = text.trim();
  await setDocState(userId, "doc_manual_passport_reg", context);
  await sendComplexMessage(
    chatId,
    `✅ Дата рождения: *${text}*\n\nШаг 5 из 5: Адрес регистрации\n\nВведите адрес регистрации (можно кратко).\n\nПример: *г. Н.Новгород, ул. Ленина, д. 1, кв. 1*`,
    [],
    { removeKeyboard: true, parseMode: "Markdown" },
  );
}

async function handleManualPassportRegistration(userId: string, chatId: number, context: DocFlowContext, text: string) {
  context.mpRegistration = text.trim();
  const isRent = context.dealType === "rent";

  if (isRent) {
    // Rent flow: continue to license data
    const summary = [
      "🪪 *Паспорт введён:*",
      `👤 ФИО: ${context.mpFullName}`,
      `🔢 Паспорт: ${context.mpSeries} ${context.mpNumber}`,
      `📅 Выдан: ${context.mpIssueDate}`,
      `🏢 Кем: ${context.mpIssuedBy}`,
      `📅 Дата рождения: ${context.mpBirthDate}`,
      `🏠 Адрес: ${context.mpRegistration}`,
      "",
      "Теперь введите данные *водительского удостоверения*.",
    ].join("\n");

    await setDocState(String(userId), "doc_manual_license_name", context);
    await sendComplexMessage(chatId, summary, [], { removeKeyboard: true, parseMode: "Markdown" });
  } else {
    // Sale flow: show summary and confirm
    const summary = [
      "🪪 *Паспорт введён:*",
      `👤 ФИО: ${context.mpFullName}`,
      `🔢 Паспорт: ${context.mpSeries} ${context.mpNumber}`,
      `📅 Выдан: ${context.mpIssueDate}`,
      `🏢 Кем: ${context.mpIssuedBy}`,
      `📅 Дата рождения: ${context.mpBirthDate}`,
      `🏠 Адрес: ${context.mpRegistration}`,
      "",
      "Генерировать договор купли-продажи?",
    ].join("\n");

    await setDocState(String(userId), "doc_sale_confirm", context);
    await sendComplexMessage(chatId, summary, [
      [{ text: "✅ Да, генерировать", callback_data: "sale_confirm_yes" }],
      [{ text: "❌ Отменить", callback_data: "sale_confirm_no" }],
    ], { inlineKeyboard: true, parseMode: "Markdown" });
  }
}

// ── Manual input state handlers (license - rent only) ───────────────────────────────

async function handleManualLicenseName(userId: string, chatId: number, context: DocFlowContext, text: string) {
  context.mlFullName = text.trim();
  await setDocState(userId, "doc_manual_license_number", context);
  await sendComplexMessage(
    chatId,
    `✅ ФИО: *${text}*\n\nШаг 2 из 4: Серия и номер ВУ\n\nВведите серию и номер через пробел.\n\nПример: *99 76 123456*`,
    [],
    { removeKeyboard: true, parseMode: "Markdown" },
  );
}

async function handleManualLicenseNumber(userId: string, chatId: number, context: DocFlowContext, text: string) {
  const parts = text.trim().split(/\s+/);
  if (parts.length < 2) {
    await sendComplexMessage(
      chatId,
      "❌ Неверный формат. Введите серию и номер через пробел.\n\nПример: *99 76 123456*",
      [],
      { removeKeyboard: true, parseMode: "Markdown" },
    );
    return;
  }
  context.mlSeries = parts[0];
  context.mlNumber = parts[1];
  await setDocState(userId, "doc_manual_license_issue", context);
  await sendComplexMessage(
    chatId,
    `✅ ВУ: *${context.mlSeries} ${context.mlNumber}*\n\nШаг 3 из 4: Дата выдачи\n\nВведите дату выдачи ВУ (ДД.ММ.ГГГГ).`,
    [],
    { removeKeyboard: true, parseMode: "Markdown" },
  );
}

async function handleManualLicenseIssue(userId: string, chatId: number, context: DocFlowContext, text: string) {
  context.mlIssueDate = text.trim();
  await setDocState(userId, "doc_manual_license_expiry", context);
  await sendComplexMessage(
    chatId,
    `✅ Дата выдачи: *${text}*\n\nШаг 4 из 4: Срок действия\n\nВведите срок действия ВУ (ДД.ММ.ГГГГ).`,
    [],
    { removeKeyboard: true, parseMode: "Markdown" },
  );
}

async function handleManualLicenseExpiry(userId: string, chatId: number, context: DocFlowContext, text: string) {
  context.mlExpiryDate = text.trim();

  await setDocState(userId, "doc_manual_license_categories", context);
  await sendComplexMessage(
    chatId,
    `✅ Срок: *${text}*\n\nВыберите имеющиеся категории.`,
    buildCategoryKeyboard(),
    { inlineKeyboard: true, parseMode: "Markdown" },
  );
}

// ── Public: Handle text input during /doc flow ─────────────────────────────────────

export async function handleDocText(userId: string, chatId: number, text: string): Promise<boolean> {
  const docState = await getDocState(userId);
  if (!docState) return false;

  const { state, context } = docState;

  if (state === "doc_awaiting_bike") {
    const bike = await resolveBikeById(text.trim());
    if (!bike) {
      await sendComplexMessage(
        chatId,
        "🚲 Не удалось найти байк по вашему запросу. Попробуйте ещё раз или выберите из списка:",
        [],
        { keyboardType: "reply" },
      );
      return true;
    }

    context.bikeId = bike.id;
    context.bikeMake = bike.make;
    context.bikeModel = bike.model;

    await setDocState(String(userId), "doc_awaiting_deal_type", context);
    await sendComplexMessage(
      chatId,
      `🏍 *${bike.make} ${bike.model}* — записал!`,
      [],
      { removeKeyboard: true, parseMode: "Markdown" },
    );
    await sendComplexMessage(
      chatId,
      "Выберите тип договора:",
      buildDealTypeKeyboard(),
      { inlineKeyboard: true },
    );
    return true;
  }

  if (state === "doc_awaiting_schedule") {
    await clearDocState(userId);
    await sendComplexMessage(chatId, "⏳ Генерирую договор...", [], { removeKeyboard: true });
    await generateAndSendContract(chatId, userId, context, text);
    return true;
  }

  // Passport states (both rent and sale)
  if (state === "doc_manual_passport_name") {
    await handleManualPassportName(userId, chatId, context, text);
    return true;
  }
  if (state === "doc_manual_passport_number") {
    await handleManualPassportNumber(userId, chatId, context, text);
    return true;
  }
  if (state === "doc_manual_passport_issue") {
    await handleManualPassportIssue(userId, chatId, context, text);
    return true;
  }
  if (state === "doc_manual_passport_birth") {
    await handleManualPassportBirth(userId, chatId, context, text);
    return true;
  }
  if (state === "doc_manual_passport_reg") {
    await handleManualPassportRegistration(userId, chatId, context, text);
    return true;
  }

  // License states (rent only)
  if (state === "doc_manual_license_name") {
    await handleManualLicenseName(userId, chatId, context, text);
    return true;
  }
  if (state === "doc_manual_license_number") {
    await handleManualLicenseNumber(userId, chatId, context, text);
    return true;
  }
  if (state === "doc_manual_license_issue") {
    await handleManualLicenseIssue(userId, chatId, context, text);
    return true;
  }
  if (state === "doc_manual_license_expiry") {
    await handleManualLicenseExpiry(userId, chatId, context, text);
    return true;
  }

  return false;
}

// ── Public: Handle callback queries during /doc flow ─────────────────────────────

export async function handleDocCallback(
  userId: string,
  chatId: number,
  callbackData: string,
): Promise<boolean> {
  const docState = await getDocState(userId);
  if (!docState) return false;

  const { state, context } = docState;

  // Answer callback to remove loading state
  try {
    await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery?callback_query_id=${callbackData}`,
      { method: "POST" },
    );
  } catch (e) {
    logger.warn("[/doc] Failed to answer callback", e);
  }

  // Deal type selection
  if (callbackData === "deal_type_rent") {
    context.dealType = "rent";
    await setDocState(userId, "doc_manual_passport_name", context);
    await sendComplexMessage(
      chatId,
      [
        "✍️ *Ввод данных паспорта*",
        "",
        "Шаг 1 из 5: ФИО",
        "",
        "Введите фамилию, имя и отчество полностью.",
      ].join("\n"),
      [],
      { removeKeyboard: true, parseMode: "Markdown" },
    );
    return true;
  }

  if (callbackData === "deal_type_sale") {
    context.dealType = "sale";
    await setDocState(userId, "doc_manual_passport_name", context);
    await sendComplexMessage(
      chatId,
      [
        "✍️ *Ввод данных паспорта (для договора продажи)*",
        "",
        "Шаг 1 из 5: ФИО",
        "",
        "Введите фамилию, имя и отчество полностью.",
      ].join("\n"),
      [],
      { removeKeyboard: true, parseMode: "Markdown" },
    );
    return true;
  }

  // Sale confirmation
  if (callbackData === "sale_confirm_yes") {
    await clearDocState(userId);
    await sendComplexMessage(chatId, "⏳ Генерирую договор...", [], { removeKeyboard: true });
    await generateAndSendContract(chatId, userId, context);
    return true;
  }

  if (callbackData === "sale_confirm_no") {
    await sendComplexMessage(chatId, "❌ Договор отменён. Отправьте /doc чтобы начать заново.", [], { removeKeyboard: true });
    await clearDocState(userId);
    return true;
  }

  // Category selection
  if (callbackData.startsWith("cat_")) {
    const value = callbackData.slice(4);

    if (value === "done") {
      const cats = context.mlCategories || [];
      context.mlAccessTier = deriveUserAccessTier(cats);

      const catStr = cats.join(", ") || "нет";
      const tierLabel = getAccessTierLabel(context.mlAccessTier || "none");

      const summary = [
        "🚗 *ВУ введено:*",
        `👤 ФИО: ${context.mlFullName}`,
        `🔢 ВУ: ${context.mlSeries} ${context.mlNumber}`,
        `📅 Выдан: ${context.mlIssueDate}`,
        `📅 Срок: ${context.mlExpiryDate}`,
        `🏷 Категории: ${catStr}`,
        `🛡 Допуск: ${tierLabel}`,
        "",
        "Укажите период аренды в свободной форме:",
        "_с завтра 18:00 до завтра 10:00_",
        "или",
        "_с 15.06.2026 10:00 до 16.06.2026 20:00_",
      ].filter(Boolean).join("\n");

      await setDocState(userId, "doc_awaiting_schedule", context);
      await sendComplexMessage(chatId, summary, [], { removeKeyboard: true, parseMode: "Markdown" });
      return true;
    }

    if (value === "cancel") {
      context.mlCategories = [];
      await sendComplexMessage(
        chatId,
        "❌ Ввод отменён. Отправьте /doc чтобы начать заново.",
        [],
        { removeKeyboard: true },
      );
      await clearDocState(userId);
      return true;
    }

    // Toggle category
    const cats = context.mlCategories || [];
    const idx = cats.indexOf(value);
    if (idx >= 0) {
      cats.splice(idx, 1);
    } else {
      cats.push(value);
    }
    context.mlCategories = cats;
    await setDocState(userId, state, context);

    await sendComplexMessage(
      chatId,
      `🏷 Выберите категории:\n\nВыбрано: ${cats.join(", ") || "пока ничего"}`,
      buildCategoryKeyboard(cats),
      { inlineKeyboard: true },
    );
    return true;
  }

  logger.warn("[/doc] Unhandled callback", { callbackData, state });
  return false;
}

// ── Main: /doc command entry point ───────────────────────────────────────────────

export async function docCommand(
  chatId: number,
  userId: number,
  username: string | undefined,
  text: string,
) {
  const userIdStr = String(userId);
  logger.info(`[/doc] User: ${userIdStr}, Text: "${text}"`);

  // Parse bike ID from command args
  const parts = text.trim().split(/\s+/);
  const bikeArg = parts.slice(1).join(" ").trim();

  // If /doc with a bike arg, start the flow
  if (bikeArg) {
    const bike = await resolveBikeById(bikeArg);
    if (!bike) {
      await sendComplexMessage(
        chatId,
        `🚲 Не удалось найти байк "${bikeArg}". Укажите ID или название из каталога.`,
        [],
        { removeKeyboard: true },
      );
      return;
    }

    const context: DocFlowContext = {
      bikeId: bike.id,
      bikeMake: bike.make,
      bikeModel: bike.model,
      extractionProvider: "manual",
      dealType: "rent", // default, will be overridden by selection
    };

    await setDocState(userIdStr, "doc_awaiting_deal_type", context);
    await sendComplexMessage(
      chatId,
      `🏍 *${bike.make} ${bike.model}* — записал!`,
      [],
      { removeKeyboard: true, parseMode: "Markdown" },
    );
    await sendComplexMessage(
      chatId,
      "Выберите тип договора:",
      buildDealTypeKeyboard(),
      { inlineKeyboard: true },
    );
    return;
  }

  // /doc without args — show bike selection
  const bikes = await getAvailableBikes();

  if (bikes.length === 0) {
    await sendComplexMessage(chatId, "🚲 В каталоге пока нет доступных байков. Попробуйте позже.", [], { removeKeyboard: true });
    return;
  }

  const buttons: KeyboardButton[][] = bikes.map((bike) => {
    const tier = bike.specs?.access_tier as string | undefined;
    const tierEmoji = tier === "pro" ? "🔴" : tier === "mid" ? "🟡" : tier === "entry" ? "🟢" : "⚪";
    return [{ text: `${tierEmoji} ${bike.make} ${bike.model}` }];
  });

  await setDocState(userIdStr, "doc_awaiting_bike", {
    bikeId: "",
    extractionProvider: "manual",
    dealType: "rent",
  });

  await sendComplexMessage(
    chatId,
    [
      "📄 *Генерация договора (ручной ввод)*",
      "",
      "Выберите байк из каталога или введите ID/название:",
      "",
      "🟢 Базовый  🟡 Средний  🔴 Профессиональный",
    ].join("\n"),
    buttons,
    { keyboardType: "reply", parseMode: "Markdown" },
  );
}
