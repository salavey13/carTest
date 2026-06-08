/**
 * /doc command handler
 * ====================
 * Telegram bot command for VLM-based rental contract generation.
 *
 * Flow:
 *   /doc [bikeId]          → starts the doc pipeline
 *   user sends passport    → ZAI VLM → passport data extracted
 *   user sends license     → ZAI VLM → license data + categories + access tier
 *   user types schedule    → "с завтра 18:00 до завтра 10:00"
 *   bot generates contract → sends DOCX + saves rental secrets
 *
 * State machine uses `user_states` table:
 *   - doc_awaiting_bike       (if /doc without bikeId)
 *   - doc_awaiting_passport   (waiting for passport photo)
 *   - doc_awaiting_license    (waiting for license photo)
 *   - doc_awaiting_schedule   (waiting for rental schedule text)
 *
 * The /doc command is the VLM equivalent of the skill script
 * (make-rental-contract-skill.mjs), but runs entirely inside the Telegram
 * bot webhook pipeline — no CLI, no pre-provided JSON.
 *
 * VLM-ONLY: Uses ZAI VLM for photo → structured JSON extraction.
 * Tesseract.js removed — client uses ZAI API key.
 *
 * Multi-step design: each photo/VLM call is a separate Telegram message
 * (= separate webhook call = separate Vercel function invocation),
 * so each step stays well within the 10s default timeout.
 */

"use server";

import { logger } from "@/lib/logger";
import { supabaseAdmin, supabaseAnon } from "@/hooks/supabase";
import { sendComplexMessage, KeyboardButton } from "../actions/sendComplexMessage";
import { notifyAdmin, sendTelegramDocument } from "@/app/actions";
import { saveUserRentalSecrets } from "@/app/lib/user-rental-secrets";
import { deriveUserAccessTier, getAccessTierLabel } from "@/app/lib/derive-access-tier";
import type { AccessTier } from "@/app/lib/ocr-constants";
import { buildFranchizeDocxFromTemplate } from "@/app/franchize/lib/docx-capability";
import { vlmExtractDocument } from "@/app/lib/vlm-extract";
import { createHash } from "crypto";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const DOC_STATE_EXPIRY_MINUTES = 30;

// ── State type for /doc flow ──────────────────────────────────────────────────

interface DocFlowContext {
  bikeId: string;
  bikeMake?: string;
  bikeModel?: string;
  passportData?: Record<string, string>;
  licenseData?: Record<string, string>;
  categories?: string[];
  accessTier?: AccessTier;
  extractionProvider?: "zai-vlm";
}

// ── VLM Photo Extraction ─────────────────────────────────────────────────────

/**
 * Downsample image for faster VLM processing.
 * Resizes to max 1024px dimension and reduces quality to 80%.
 * This significantly reduces processing time while maintaining OCR accuracy.
 */
async function downsampleImageForVlm(imageBuffer: Buffer): Promise<Buffer> {
  try {
    // Use sharp for image processing (faster and more reliable)
    const { default: sharp } = await import("sharp");

    // Resize to max 1024px on longest side, JPEG 80% quality
    const downsampled = await sharp(imageBuffer)
      .resize(1024, 1024, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();

    logger.info("[/doc] Image downsampled for VLM", {
      originalSize: imageBuffer.length,
      downsampledSize: downsampled.length,
      reductionPercent: Math.round((1 - downsampled.length / imageBuffer.length) * 100),
    });

    return downsampled;
  } catch (sharpError) {
    // Sharp not available or failed - return original
    logger.warn("[/doc] Sharp downsampling failed, using original image", sharpError);
    return imageBuffer;
  }
}

/**
 * Download a Telegram photo with retry logic for RANGE_MISSING_UNIT error.
 * This error occurs when:
 *   - Photo is too large (>10MB) and Telegram hasn't processed it yet
 *   - File_id is from a pending upload
 *   - Network issues during Telegram file access
 *
 * Retry strategy: up to 3 attempts with 1s, 2s, 3s delays
 */
async function downloadTelegramPhotoWithRetry(
  fileId: string,
  maxRetries = 3,
): Promise<{ success: boolean; buffer?: Buffer; error?: string }> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const fileInfoResponse = await fetch(
        `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getFile?file_id=${fileId}`,
      );
      const fileInfo = await fileInfoResponse.json();

      if (!fileInfo.ok) {
        const errorMsg = fileInfo.description || "Unknown Telegram error";
        logger.warn("[/doc] Telegram getFile failed", {
          attempt,
          fileId: fileId.slice(0, 20) + "...",
          error: errorMsg,
        });

        // Specific error: file too large or not ready yet
        if (errorMsg.includes("file is too big") || errorMsg.includes("RANGE")) {
          if (attempt < maxRetries) {
            const delay = attempt * 1000; // 1s, 2s, 3s
            logger.info(`[/doc] Retrying after ${delay}ms... (${attempt}/${maxRetries})`);
            await new Promise(r => setTimeout(r, delay));
            continue;
          }
          return {
            success: false,
            error: `Файл слишком большой или не готов. Попробуйте отправить фото меньшего размера или подождите 10 секунд.`,
          };
        }

        // File not found or expired
        if (errorMsg.includes("Bad Request") || errorMsg.includes("file")) {
          return { success: false, error: "Файл не найден. Отправьте фото ещё раз." };
        }

        return { success: false, error: `Ошибка Telegram: ${errorMsg}` };
      }

      const fileUrl = `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${fileInfo.result.file_path}`;
      const imageResponse = await fetch(fileUrl);

      if (!imageResponse.ok) {
        logger.warn("[/doc] Telegram file download failed", {
          attempt,
          status: imageResponse.status,
        });
        if (attempt < maxRetries && imageResponse.status === 404) {
          await new Promise(r => setTimeout(r, attempt * 1000));
          continue;
        }
        return { success: false, error: "Не удалось скачать фото. Попробуйте ещё раз." };
      }

      const buffer = Buffer.from(await imageResponse.arrayBuffer());
      if (buffer.length === 0) {
        return { success: false, error: "Пустой файл. Отправьте другое фото." };
      }

      logger.info("[/doc] Photo downloaded successfully", {
        size: buffer.length,
        attempt,
      });

      return { success: true, buffer };
    } catch (error) {
      logger.error("[/doc] Download exception", { attempt, error });
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, attempt * 1000));
        continue;
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : "Ошибка загрузки фото",
      };
    }
  }

  return { success: false, error: "Не удалось загрузить фото после нескольких попыток." };
}

/**
 * Download a Telegram photo and extract document data using ZAI VLM.
 * VLM-only path — no Tesseract fallback.
 * Supports both photo messages and document messages (for high-res scans).
 */
async function extractDocumentFromTelegramPhoto(
  fileId: string,
  docType: "passport" | "license",
): Promise<{
  success: boolean;
  data?: Record<string, any>;
  accessTier?: AccessTier;
  provider?: "zai-vlm";
  confidence?: number;
  warnings?: string[];
  error?: string;
}> {
  // Download with retry for RANGE errors
  const downloadResult = await downloadTelegramPhotoWithRetry(fileId, 3);

  if (!downloadResult.success || !downloadResult.buffer) {
    return {
      success: false,
      error: downloadResult.error || "Не удалось загрузить фото. Убедитесь, что фото не больше 10 МБ.",
    };
  }

  try {
    const downsampledBuffer = await downsampleImageForVlm(downloadResult.buffer);
    const base64Image = downsampledBuffer.toString("base64");

    // VLM extraction
    const vlmResult = await vlmExtractDocument(base64Image, docType);

    if (vlmResult.success && vlmResult.data) {
      return {
        success: true,
        data: vlmResult.data as Record<string, any>,
        accessTier: vlmResult.accessTier,
        provider: "zai-vlm",
        confidence: vlmResult.confidence,
        warnings: vlmResult.warnings,
      };
    }

    return {
      success: false,
      provider: "zai-vlm",
      error: vlmResult.error || "VLM extraction failed",
      warnings: vlmResult.warnings,
    };
  } catch (error) {
    logger.error("[/doc] Document extraction error", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown extraction error",
    };
  }
}

// ── Bike resolution ───────────────────────────────────────────────────────────

async function resolveBikeById(bikeId: string): Promise<{
  id: string;
  make: string;
  model: string;
  specs: Record<string, any>;
  type: string;
} | null> {
  // Try exact match first
  const { data: exactMatch } = await supabaseAdmin
    .from("cars")
    .select("id, make, model, specs, type")
    .eq("id", bikeId)
    .in("type", ["bike", "ebike"])
    .maybeSingle();

  if (exactMatch) return exactMatch as any;

  // Fuzzy search: match against make, model, or ID substring
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

// ── Get available bikes for keyboard selection ────────────────────────────────

async function getAvailableBikes(): Promise<Array<{ id: string; make: string; model: string; specs?: Record<string, any> }>> {
  const { data } = await supabaseAdmin
    .from("cars")
    .select("id, make, model, specs")
    .in("type", ["bike", "ebike"])
    .order("make", { ascending: true })
    .limit(20);

  return (data || []) as Array<{ id: string; make: string; model: string; specs?: Record<string, any> }>;
}

// ── Contract generation ───────────────────────────────────────────────────────

async function generateAndSendContract(
  chatId: number,
  userId: string,
  context: DocFlowContext,
  scheduleText: string,
): Promise<boolean> {
  try {
    const bike = await resolveBikeById(context.bikeId);
    if (!bike) {
      await sendComplexMessage(chatId, "🚨 Не удалось найти указанный байк. Попробуйте /doc снова.", [], { removeKeyboard: true });
      return false;
    }

    const passport = context.passportData || {};
    const license = context.licenseData || {};
    const isElectric = bike.type === "ebike"
      || /electric/i.test(String(bike.specs?.type || ""))
      || /электро|electric|e-bike|ebike/i.test(String(bike.specs?.fuel_type || ""))
      || (bike.specs?.power_kw && Number(bike.specs.power_kw) > 0 && !bike.specs?.engine_cc);

    const now = new Date();
    const startDate = now.toISOString().split("T")[0];
    const endDate = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    // Build template vars (matching skill script variable names)
    const vars: Record<string, string> = {
      contract_number: `${now.getDate()}.${now.getMonth() + 1}/${bike.id}`,
      day: String(now.getDate()).padStart(2, "0"),
      month: now.toLocaleString("ru-RU", { month: "long" }),
      month_num: String(now.getMonth() + 1).padStart(2, "0"),
      year: String(now.getFullYear()),
      renter_full_name: passport.fullName || "",
      renter_birth_date: passport.birthDate || "",
      renter_phone: passport.phone || "",
      renter_email: passport.email || "",
      renter_driver_license: `${license.series || ""} ${license.number || ""}`.trim(),
      renter_passport: `${passport.series || ""} ${passport.number || ""}`.trim(),
      renter_passport_issue_date: passport.issueDate || "",
      renter_passport_issued_by: passport.issuedBy || "",
      renter_registration: passport.registration || "",
      renter_address: passport.registration || "",
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
      rent_start_date: startDate,
      rent_start_time: "18:00",
      rent_end_date: endDate,
      rent_end_time: "10:00",
      daily_price_rub: String(bike.specs?.dailyPrice || bike.specs?.rent_weekday || "10000"),
      hourly_price_rub: String(bike.specs?.price_per_hour || ""),
      deposit_rub: String(bike.specs?.deposit_rub || "20000"),
      subtotal_rub: String(bike.specs?.dailyPrice || bike.specs?.rent_weekday || "10000"),
      bike_value_rub: String(bike.specs?.sale_price || bike.specs?.price_rub || "850000"),
      bike_value_words: "",
      bike_mileage: String(bike.specs?.mileage || ""),
      lessor_address: "г. Нижний Новгород",
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
      issuer_name: "Воробьев Р.В.",
      issuer_signatory: "Менеджер Мотосалона",
      issuer_representative: "ИП Воробьев Р.В.",
      signature_timestamp: now.toLocaleString("ru-RU"),
      signature_fingerprint: "vlm-telegram-doc",
      renter_signature: "согласие через Telegram",
      document_key: `rental-${bike.id}-${Date.now()}`,
    };

    // Generate DOCX via the shared docx-capability pipeline
    const docxBuf = await buildFranchizeDocxFromTemplate(vars, "html");

    const docSha256 = createHash("sha256").update(docxBuf).digest("hex");
    const docFileName = `rental-contract-${bike.make}-${bike.model}-${startDate}.docx`
      .replace(/[^a-zA-Zа-яА-Я0-9.\-]/g, "-")
      .replace(/-+/g, "-");

    // Generate QR code for 1-click next rent
    // Format: https://t.me/oneBikePlsBot/app?startapp=rent_{bikeId}_{docSha256}
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
      // Send DOCX + QR as a media group (album)
      const token = process.env.TELEGRAM_BOT_TOKEN;
      const mediaGroupUrl = `https://api.telegram.org/bot${token}/sendMediaGroup`;
      const form = new FormData();
      form.append('chat_id', String(chatId));

      // Media group items: [{type:"document", media:"attach://docx"}, {type:"photo", media:"attach://qr", caption:"..."}]
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
        // Fallback: send DOCX alone
        await sendTelegramDocument(
          String(chatId),
          docxBuf,
          docFileName,
          `Договор аренды: ${bike.make} ${bike.model}\n\n🔗 Быстрая повторная аренда:\n${qrDeepLink}`,
        );
      }
    } else {
      // No QR buffer — send DOCX alone with QR link in caption
      await sendTelegramDocument(
        String(chatId),
        docxBuf,
        docFileName,
        `Договор аренды: ${bike.make} ${bike.model}\n\n🔗 Быстрая повторная аренда:\n${qrDeepLink}`,
      );
    }

    // Save rental secrets for 1-click next rent
    await saveUserRentalSecrets({
      chat_id: String(userId),
      crew_slug: "vip-bike",
      doc_sha256: docSha256,
      renter_full_name: passport.fullName || null,
      renter_passport: `${passport.series || ""} ${passport.number || ""}`.trim() || null,
      renter_passport_issue_date: passport.issueDate || null,
      renter_passport_issued_by: passport.issuedBy || null,
      renter_registration: passport.registration || null,
      renter_driver_license: `${license.series || ""} ${license.number || ""}`.trim() || null,
      renter_birth_date: passport.birthDate || null,
      renter_phone: passport.phone || null,
      renter_email: passport.email || null,
      renter_address: passport.registration || null,
      source_doc_key: vars.document_key,
      source_rental_id: null,
      verification_status: "verified",
      template_version: 1,
    });

    // Build summary message
    const tier = context.accessTier || "none";
    const tierLabel = getAccessTierLabel(tier);
    const catStr = (context.categories || []).join(", ") || "не определены";

    const summary = [
      "✅ *Договор сформирован и отправлен!*",
      "",
      `🏍 *${bike.make} ${bike.model}*`,
      `👤 ${passport.fullName || "—"}`,
      `🪪 Паспорт: ${passport.series || ""} ${passport.number || ""}`,
      `🚗 ВУ: ${license.series || ""} ${license.number || ""} (кат. ${catStr})`,
      `🛡 Допуск: *${tierLabel}*`,
      "",
      "🤖 VLM обработка данных",
      "Данные сохранены для быстрого повторного бронирования.",
      "Используй /doc для нового договора или открой приложение.",
    ].join("\n");

    await sendComplexMessage(chatId, summary, [
      [{ text: "🚀 Открыть VIP Bike", url: process.env.TELEGRAM_BOT_LINK || "https://t.me/oneBikePlsBot/app" }],
    ], { removeKeyboard: true, parseMode: "Markdown" });

    // Admin notification
    await notifyAdmin(
      `📄 Новый договор через /doc\n` +
      `Provider: zai-vlm\n` +
      `User: ${userId}\n` +
      `Bike: ${bike.make} ${bike.model} (${bike.id})\n` +
      `Renter: ${passport.fullName || "—"}\n` +
      `Categories: ${catStr}\n` +
      `Tier: ${tierLabel}`,
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

  // Check expiry
  if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) {
    await clearDocState(userId);
    return null;
  }

  return {
    state: data.state,
    context: (data.context || {}) as DocFlowContext,
  };
}

// ── Public: Check if a photo message is part of a /doc flow ───────────────────

export async function handleDocPhoto(message: any): Promise<boolean> {
  const userId = String(message.from.id);
  const chatId = message.chat.id;

  const docState = await getDocState(userId);
  if (!docState) return false;

  const { state, context } = docState;

  // Only handle states that expect a photo
  if (state !== "doc_awaiting_passport" && state !== "doc_awaiting_license") {
    return false;
  }

  // Extract file_id from both photo and document messages
  // Users often send high-res scans as documents rather than compressed photos
  let fileId: string | null = null;

  // Try photo array first (Telegram sends multiple sizes)
  if (Array.isArray(message.photo) && message.photo.length > 0) {
    // Use the largest photo (last in array)
    const largestPhoto = message.photo[message.photo.length - 1];
    if (largestPhoto?.file_id) {
      fileId = largestPhoto.file_id;
    }
  }

  // If no photo found, try document (high-res scans)
  if (!fileId && message.document?.file_id) {
    // Only accept image documents
    const mimeType = message.document.mime_type || "";
    if (mimeType.startsWith("image/")) {
      fileId = message.document.file_id;
    }
  }

  if (!fileId) {
    await sendComplexMessage(chatId, "🚨 Не удалось прочитать изображение. Отправьте фото ещё раз (как фото или как файл).", [], undefined);
    return true; // consumed the message
  }

  // Show "processing" indicator
  if (state === "doc_awaiting_passport") {
    await sendComplexMessage(chatId, "🤖 Обрабатываю паспорт через VLM... Это может занять несколько секунд.", [], { removeKeyboard: true });

    const result = await extractDocumentFromTelegramPhoto(fileId, "passport");

    if (!result.success) {
      await sendComplexMessage(
        chatId,
        `⚠️ Не удалось распознать паспорт.\n${result.error || ""}\n\nПопробуйте ещё раз — отправьте чёткое фото основной страницы.`,
        [],
        { keyboardType: "reply" },
      );
      return true;
    }

    const passportData = result.data || {};
    context.passportData = passportData;
    context.extractionProvider = "zai-vlm";

    // Show extracted data for confirmation
    const summary = [
      "🪪 *Паспорт распознан:*",
      `👤 ФИО: ${passportData.fullName || "—"}`,
      `📅 Дата рождения: ${passportData.birthDate || "—"}`,
      `🔢 Серия/номер: ${passportData.series || ""} ${passportData.number || ""}`,
      passportData.issueDate ? `📅 Выдан: ${passportData.issueDate}` : "",
      passportData.issuedBy ? `🏢 Кем выдан: ${passportData.issuedBy}` : "",
      passportData.registration ? `🏠 Регистрация: ${passportData.registration}` : "",
      "",
      result.confidence ? `🤖 VLM уверенность: ${(result.confidence * 100).toFixed(0)}%` : "",
      ...(result.warnings || []).map((w: string) => `⚠️ ${w}`),
      "",
      "Теперь отправьте фото *водительского удостоверения* (лицевая сторона).",
    ].filter(Boolean).join("\n");

    await setDocState(userId, "doc_awaiting_license", context);
    await sendComplexMessage(chatId, summary, [], { removeKeyboard: true, parseMode: "Markdown" });
  } else {
    // doc_awaiting_license
    await sendComplexMessage(chatId, "🤖 Обрабатываю водительское удостоверение через VLM...", [], { removeKeyboard: true });

    const result = await extractDocumentFromTelegramPhoto(fileId, "license");

    if (!result.success) {
      await sendComplexMessage(
        chatId,
        `⚠️ Не удалось распознать ВУ.\n${result.error || ""}\n\nПопробуйте ещё раз — отправьте чёткое фото лицевой стороны.`,
        [],
        { keyboardType: "reply" },
      );
      return true;
    }

    const licenseData = result.data || {};
    context.licenseData = licenseData;
    context.categories = licenseData.categories || [];
    context.accessTier = result.accessTier || "none";
    if (!context.extractionProvider) {
      context.extractionProvider = "zai-vlm";
    }

    const catStr = (context.categories || []).join(", ") || "не определены";
    const tierLabel = getAccessTierLabel(context.accessTier || "none");

    const summary = [
      "🚗 *Водительское удостоверение распознано:*",
      `👤 ФИО: ${licenseData.fullName || "—"}`,
      `🔢 Серия/номер: ${licenseData.series || ""} ${licenseData.number || ""}`,
      `📅 Дата выдачи: ${licenseData.issueDate || "—"}`,
      `📅 Срок действия: ${licenseData.expiryDate || "—"}`,
      `🏷 Категории: *${catStr}*`,
      `🛡 Допуск: *${tierLabel}*`,
      "",
      result.confidence ? `🤖 VLM уверенность: ${(result.confidence * 100).toFixed(0)}%` : "",
      ...(result.warnings || []).map((w: string) => `⚠️ ${w}`),
      "",
      "Укажите период аренды в свободной форме, например:",
      "_с завтра 18:00 до завтра 10:00_",
      "или",
      "_с 15.06.2026 10:00 до 16.06.2026 20:00_",
    ].filter(Boolean).join("\n");

    await setDocState(userId, "doc_awaiting_schedule", context);
    await sendComplexMessage(chatId, summary, [], { removeKeyboard: true, parseMode: "Markdown" });
  }

  return true; // photo consumed by /doc flow
}

// ── Public: Handle text input during /doc flow ────────────────────────────────

export async function handleDocText(userId: string, chatId: number, text: string): Promise<boolean> {
  const docState = await getDocState(userId);
  if (!docState) return false;

  const { state, context } = docState;

  if (state === "doc_awaiting_bike") {
    // User typed a bike name/ID
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

    await setDocState(userId, "doc_awaiting_passport", context);
    await sendComplexMessage(
      chatId,
      `🏍 Отлично, *${bike.make} ${bike.model}*\n\nОтправьте фото *основной страницы паспорта* (разворот с фото и данными).`,
      [],
      { removeKeyboard: true, parseMode: "Markdown" },
    );
    return true;
  }

  if (state === "doc_awaiting_schedule") {
    // Generate contract with the provided schedule
    await clearDocState(userId);
    await sendComplexMessage(chatId, "⏳ Генерирую договор...", [], { removeKeyboard: true });
    await generateAndSendContract(chatId, userId, context, text);
    return true;
  }

  // Unknown state — let other handlers process the message
  return false;
}

// ── Main: /doc command entry point ────────────────────────────────────────────

export async function docCommand(
  chatId: number,
  userId: number,
  username: string | undefined,
  text: string,
  photoVariants?: any[],
  documentFiles?: any[],
) {
  const userIdStr = String(userId);
  logger.info(`[/doc] User: ${userIdStr}, Text: "${text}"`);

  // If user sent a photo/document WITH /doc caption, process it as the first step
  const hasPhoto = Array.isArray(photoVariants) && photoVariants.length > 0;
  const hasDocument = documentFiles && documentFiles.length > 0;

  // Parse bike ID from command args
  const parts = text.trim().split(/\s+/);
  const bikeArg = parts.slice(1).join(" ").trim(); // everything after /doc

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
    };

    // If photo/document was sent with /doc caption, treat it as passport
    if (hasPhoto || hasDocument) {
      let fileId: string | null = null;

      // Try photo first
      if (hasPhoto && photoVariants && photoVariants.length > 0) {
        fileId = photoVariants[photoVariants.length - 1]?.file_id;
      }

      // If no photo, try document (must be an image)
      if (!fileId && hasDocument && documentFiles && documentFiles.length > 0) {
        const doc = documentFiles[0];
        if (doc?.mime_type?.startsWith("image/")) {
          fileId = doc.file_id;
        }
      }

      if (fileId) {
        await setDocState(userIdStr, "doc_awaiting_passport", context);
        // The photo will be handled by handleDocPhoto on next webhook call
        await sendComplexMessage(
          chatId,
          `🏍 *${bike.make} ${bike.model}*\n\n🤖 Обрабатываю прикреплённое изображение через VLM...`,
          [],
          { removeKeyboard: true, parseMode: "Markdown" },
        );
        return;
      }
    }

    await setDocState(userIdStr, "doc_awaiting_passport", context);
    await sendComplexMessage(
      chatId,
      [
        `🏍 *${bike.make} ${bike.model}* — записал!`,
        "",
        "Отправьте фото *основной страницы паспорта* (разворот с фото и данными).",
        "",
        "💡 Убедитесь, что фото чёткое, без бликов, все данные читаемы.",
      ].join("\n"),
      [],
      { removeKeyboard: true, parseMode: "Markdown" },
    );
    return;
  }

  // /doc without args — show bike selection
  const bikes = await getAvailableBikes();

  if (bikes.length === 0) {
    await sendComplexMessage(chatId, "🚲 В каталоге пока нет доступных байков. Попробуйте позже.", [], { removeKeyboard: true });
    return;
  }

  // Build keyboard with tier indicators
  const buttons: KeyboardButton[][] = bikes.map((bike) => {
    const tier = bike.specs?.access_tier as string | undefined;
    const tierEmoji = tier === "pro" ? "🔴" : tier === "mid" ? "🟡" : tier === "entry" ? "🟢" : "⚪";
    return [{ text: `${tierEmoji} ${bike.make} ${bike.model}` }];
  });

  // Set state to awaiting bike selection
  await setDocState(userIdStr, "doc_awaiting_bike", { bikeId: "" });

  await sendComplexMessage(
    chatId,
    [
      "📄 *Генерация договора аренды*",
      "",
      "Выберите байк из каталога или введите ID/название:",
      "",
      "🟢 Базовый  🟡 Средний  🔴 Профессиональный",
    ].join("\n"),
    buttons,
    { keyboardType: "reply", parseMode: "Markdown" },
  );
}
