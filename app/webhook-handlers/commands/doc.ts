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
 * Manual fallback (when VLM fails):
 *   User can choose step-by-step text input with inline keyboards
 *   Categories, yes/no options via buttons
 *   Names, addresses via free text
 *
 * State machine uses `user_states` table:
 *   - doc_awaiting_bike           (if /doc without bikeId)
 *   - doc_awaiting_passport       (waiting for passport photo)
 *   - doc_awaiting_license        (waiting for license photo)
 *   - doc_awaiting_schedule       (waiting for rental schedule text)
 *   - doc_manual_passport_name    (manual: full name)
 *   - doc_manual_passport_number  (manual: passport number)
 *   - doc_manual_passport_issue   (manual: issue date and authority)
 *   - doc_manual_passport_birth   (manual: birth date)
 *   - doc_manual_passport_reg     (manual: registration address)
 *   - doc_manual_license_name     (manual: full name for license)
 *   - doc_manual_license_number   (manual: license number)
 *   - doc_manual_license_categories (manual: category selection)
 *   - doc_manual_license_issue    (manual: issue date)
 *   - doc_manual_license_expiry   (manual: expiry date)
 *   - doc_awaiting_schedule       (waiting for rental schedule text)
 *
 * The /doc command is the VLM equivalent of the skill script
 * (make-rental-contract-skill.mjs), but runs entirely inside the Telegram
 * bot webhook pipeline — no CLI, no pre-provided JSON.
 *
 * Multi-step design: each photo/VLM call is a separate Telegram message
 * (= separate webhook call = separate Vercel function invocation),
 * so each step stays well within the 10s default timeout.
 *
 * FIXES APPLIED (V2):
 *   - FIX 1: Document delivery via direct Telegram API (telegramSendDocument/telegramSendPhoto)
 *   - FIX 2: Better error logging for Supabase inserts (log .message, .code, .details, .hint)
 *   - FIX 3: rental_contract_artifacts uses private schema with correct columns
 */

"use server";

import { logger } from "@/lib/logger";
import { supabaseAdmin, supabaseAnon } from "@/hooks/supabase";
import { sendComplexMessage, KeyboardButton } from "../actions/sendComplexMessage";
import { notifyAdmin, sendTelegramDocument } from "@/app/actions";
import { saveUserRentalSecrets, isCrewMember } from "@/app/lib/user-rental-secrets";
import { deriveUserAccessTier, getAccessTierLabel } from "@/app/lib/derive-access-tier";
import type { AccessTier } from "@/app/lib/ocr-constants";
import { buildFranchizeDocxFromTemplate } from "@/app/franchize/lib/docx-capability";
import { vlmExtractDocument } from "@/app/lib/vlm-extract";
import { createHash, randomUUID } from "crypto";
import { readFileSync } from "fs";
import { join } from "path";
import { buildRentalContractVariables, type BikeSpecs, type RenterData, type RentalPeriod, type CrewSecrets, type DocumentMeta } from "@/app/lib/rental-contract-vars";
import { createLeadFollowupTodos } from "@/app/franchize/server-actions/crew-todos";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const DOC_STATE_EXPIRY_MINUTES = 30;

// ── Crew secrets loader for contract defaults ───────────────────────────────────

/**
 * Load crew secrets for contract defaults.
 * Returns CrewSecrets type compatible with buildRentalContractVariables.
 */
async function loadCrewSecrets(crewSlug: string = "vip-bike"): Promise<CrewSecrets> {
  try {
    const { data: secretsData } = await supabaseAdmin
      .from("crew_secrets")
      .select("contract_defaults")
      .eq("crew_slug", crewSlug)
      .maybeSingle();

    let contractDefaults: Record<string, any> = {};
    if (secretsData?.contract_defaults) {
      contractDefaults = typeof secretsData.contract_defaults === "string"
        ? JSON.parse(secretsData.contract_defaults)
        : secretsData.contract_defaults;
    }

    // Extract contract defaults with fallbacks - matching CrewSecrets shape
    const secrets: CrewSecrets = {
      organizationName: contractDefaults.organizationName || "Мотосалон ВипБайкЭлектро",
      organizationShort: contractDefaults.organizationShort || "ИП Воробьев Р.В.",
      ogrnip: contractDefaults.ogrnip || "326527500025145",
      inn: contractDefaults.inn || "525813643035",
      bankAccount: contractDefaults.bankAccount || "40802810942710013083",
      bankName: contractDefaults.bankName || "Волго-Вятский Банк ПАО Сбербанк",
      bankCity: contractDefaults.bankCity || "г. Нижний Новгород",
      bankCorrAccount: contractDefaults.bankCorrAccount || "30101810900000000603",
      email: contractDefaults.email || "vip_bike@mail.ru",
      legalAddress: contractDefaults.legalAddress || "г. Нижний Новгород, пл. Комсомольская 2",
      issuerName: contractDefaults.issuerName || "Воробьев Р.В.",
      signatoryRole: contractDefaults.signatoryRole || "Менеджер Мотосалона",
      issuerRepresentative: contractDefaults.issuerRepresentative || contractDefaults.organizationRepresentative || "ИП Воробьев Р.В.",
      returnAddress: contractDefaults.returnAddress || "г. Нижний Новгород, пл. Комсомольская 2",
      contractDefaults,
    };
    return secrets;
  } catch (error) {
    logger.warn("[/doc] Failed to load crew_secrets, using fallbacks:", error);
    // Return fallback values matching CrewSecrets shape
    const fallbackDefaults: CrewSecrets = {
      organizationName: "Мотосалон ВипБайкЭлектро",
      organizationShort: "ИП Воробьев Р.В.",
      organizationRepresentative: "ИП Воробьев Р.В.",
      issuerRepresentative: "Сидоров Илья Олегович",
      ogrnip: "326527500025145",
      inn: "525813643035",
      bankAccount: "40802810942710013083",
      bankName: "Волго-Вятский Банк ПАО Сбербанк",
      bankCity: "г. Нижний Новгород",
      bankCorrAccount: "30101810900000000603",
      email: "vip_bike@mail.ru",
      legalAddress: "г. Нижний Новгород, пл. Комсомольская 2",
      issuerName: "Воробьев Р.В.",
      signatoryRole: "Менеджер Мотосалона",
      returnAddress: "г. Нижний Новгород, пл. Комсомольская 2",
      contractDefaults: {},
    };
    return fallbackDefaults;
  }
}

// ── Telegram API helpers (self-contained, no dependency on @/app/actions) ──

async function telegramSendDocument(
  chatId: string | number,
  buffer: Buffer,
  filename: string,
  caption?: string,
): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) { logger.error("[telegramSendDocument] No TELEGRAM_BOT_TOKEN"); return false; }

  try {
    const form = new FormData();
    form.append("chat_id", String(chatId));
    if (caption) {
      form.append("caption", caption.substring(0, 1024)); // Telegram limit
      form.append("parse_mode", "HTML");
    }
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    form.append("document", blob, filename);

    const res = await fetch(
      `https://api.telegram.org/bot${token}/sendDocument`,
      { method: "POST", body: form },
    );
    const body = await res.json();
    if (!body.ok) {
      logger.error("[telegramSendDocument] API error:", body.description);
      return false;
    }
    logger.info("[telegramSendDocument] Sent", { chatId, filename });
    return true;
  } catch (e) {
    logger.error("[telegramSendDocument] Exception:", e);
    return false;
  }
}

async function telegramSendPhoto(
  chatId: string | number,
  buffer: Buffer,
  filename: string,
  caption?: string,
): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) { logger.error("[telegramSendPhoto] No TELEGRAM_BOT_TOKEN"); return false; }

  try {
    const form = new FormData();
    form.append("chat_id", String(chatId));
    if (caption) {
      form.append("caption", caption.substring(0, 1024));
      form.append("parse_mode", "HTML");
    }
    const blob = new Blob([buffer], { type: "image/png" });
    form.append("photo", blob, filename);

    const res = await fetch(
      `https://api.telegram.org/bot${token}/sendPhoto`,
      { method: "POST", body: form },
    );
    const body = await res.json();
    if (!body.ok) {
      logger.error("[telegramSendPhoto] API error:", body.description);
      return false;
    }
    logger.info("[telegramSendPhoto] Sent", { chatId, filename });
    return true;
  } catch (e) {
    logger.error("[telegramSendPhoto] Exception:", e);
    return false;
  }
}

// ── Keyboard builders for manual input ───────────────────────────────────────────

/**
 * Build inline keyboard for category selection.
 * Shows common motorcycle categories as toggle buttons.
 */
function buildCategoryKeyboard(selected: string[] = []): KeyboardButton[][] {
  const categories = ["A", "A1", "B", "B1", "M", "C", "C1"];
  const rows: KeyboardButton[][] = [];

  // Create rows with 3 categories each
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

  // Add "Done" and "None" buttons
  rows.push([
    { text: selected.length > 0 ? "✓ Готово" : "Нет прав", callback_data: "cat_done" },
    { text: "↩️ Отменить", callback_data: "cat_cancel" },
  ]);

  return rows;
}

/**
 * Parse callback data to extract action and value.
 */
function parseCallbackData(data: string): { action: string; value: string } | null {
  if (data.startsWith("cat_")) {
    const value = data.slice(4);
    if (value === "done" || value === "cancel") {
      return { action: value, value: "" };
    }
    return { action: "toggle", value };
  }
  if (data.startsWith("yesno_")) {
    const parts = data.slice(6).split("_");
    return { action: parts[0] || "", value: parts[1] || "" };
  }
  return null;
}

// ── State type for /doc flow ──────────────────────────────────────────────────

interface DocFlowContext {
  bikeId: string;
  bikeMake?: string;
  bikeModel?: string;
  passportData?: Record<string, string>;
  licenseData?: Record<string, string>;
  categories?: string[];
  accessTier?: AccessTier;
  extractionProvider?: "zai-vlm" | "manual";
  // Manual input state
  manualStep?: string;
  // Manual passport fields
  mpFullName?: string;
  mpSeries?: string;
  mpNumber?: string;
  mpIssueDate?: string;
  mpIssuedBy?: string;
  mpBirthDate?: string;
  mpRegistration?: string;
  // Manual license fields
  mlFullName?: string;
  mlSeries?: string;
  mlNumber?: string;
  mlIssueDate?: string;
  mlExpiryDate?: string;
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
  maxRetries = 2,
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

  // Retry VLM extraction for transient failures
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const downsampledBuffer = await downsampleImageForVlm(downloadResult.buffer);
      const base64Image = downsampledBuffer.toString("base64");

      logger.info(`[/doc] VLM extraction attempt ${attempt}/${maxRetries}`, { docType });

      // VLM extraction
      const vlmResult = await vlmExtractDocument(base64Image, docType);

      if (vlmResult.success && vlmResult.data) {
        logger.info(`[/doc] VLM extraction succeeded on attempt ${attempt}`, {
          docType,
          confidence: vlmResult.confidence,
        });
        return {
          success: true,
          data: vlmResult.data as Record<string, any>,
          accessTier: vlmResult.accessTier,
          provider: "zai-vlm",
          confidence: vlmResult.confidence,
          warnings: vlmResult.warnings,
        };
      }

      // Check if error is retryable
      const isRetryable = vlmResult.error?.includes("timeout") ||
                         vlmResult.error?.includes("connection") ||
                         vlmResult.error?.includes("ECONNREFUSED") ||
                         vlmResult.error?.includes("temporarily");

      if (!isRetryable || attempt === maxRetries) {
        logger.warn(`[/doc] VLM extraction failed on attempt ${attempt}`, {
          docType,
          error: vlmResult.error,
          isRetryable,
        });
        return {
          success: false,
          provider: "zai-vlm",
          error: vlmResult.error || "VLM extraction failed",
          warnings: vlmResult.warnings,
        };
      }

      // Wait before retry
      logger.info(`[/doc] Retrying VLM extraction after 2s delay...`);
      await new Promise(r => setTimeout(r, 2000));

    } catch (error) {
      logger.error(`[/doc] Document extraction error on attempt ${attempt}`, error);

      if (attempt === maxRetries) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown extraction error",
        };
      }

      // Wait before retry
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  // Should not reach here, but TypeScript needs it
  return {
    success: false,
    error: "Extraction failed after all retries",
  };
}

// ── Bike resolution ───────────────────────────────────────────────────────────

async function resolveBikeById(bikeId: string): Promise<{
  id: string;
  make: string;
  model: string;
  specs: Record<string, any>;
  type: string;
  crew_id: string | null;
} | null> {
  // Try exact match first
  const { data: exactMatch } = await supabaseAdmin
    .from("cars")
    .select("id, make, model, specs, type, crew_id")
    .eq("id", bikeId)
    .in("type", ["bike", "ebike"])
    .maybeSingle();

  if (exactMatch) return exactMatch as any;

  // Fuzzy search: match against make, model, or ID substring
  const { data: candidates } = await supabaseAdmin
    .from("cars")
    .select("id, make, model, specs, type, crew_id")
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
  // Resolve crew_id from slug (no hardcoded UUID)
  const { data: crew } = await supabaseAdmin
    .from("crews")
    .select("id")
    .eq("slug", "vip-bike")
    .maybeSingle();

  if (!crew?.id) {
    console.error("[getAvailableBikes] Crew not found for slug: vip-bike");
    return [];
  }

  // Show bikes from vip-bike crew OR unassigned (crew_id=null).
  // Exclude bikes from OTHER crews (e.g. custom-bobber-virus, honda-cbr600rr-sz).
  const { data } = await supabaseAdmin
    .from("cars")
    .select("id, make, model, specs")
    .in("type", ["bike", "ebike"])
    .or(`crew_id.eq.${crew.id},crew_id.is.null`)
    .order("make", { ascending: true });

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

    const now = new Date();
    const startDate = now.toISOString().split("T")[0];
    const endDate = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    // Load crew secrets for contract defaults
    const crewSecrets = await loadCrewSecrets("vip-bike");

    // Build template vars using shared builder
    const vars = buildRentalContractVariables({
      renter: {
        fullName: passport.fullName || "",
        birthDate: passport.birthDate || "",
        phone: passport.phone || "",
        email: passport.email || "",
        passportSeries: passport.series || "",
        passportNumber: passport.number || "",
        passportIssueDate: passport.issueDate || "",
        passportIssuedBy: passport.issuedBy || "",
        registration: passport.registration || "",
        address: passport.registration || "",
        driverLicenseSeries: license.series || "",
        driverLicenseNumber: license.number || "",
      },
      bike: {
        id: bike.id,
        make: bike.make || "уточняется",
        model: bike.model || "уточняется",
        type: bike.type,
        specs: bike.specs || {},
      },
      period: {
        startDate: startDate,
        startTime: "18:00",
        endDate: endDate,
        endTime: "10:00",
      },
      crewSecrets,
      meta: {
        contractNumber: `${now.getDate()}.${now.getMonth() + 1}/${bike.id}`,
        signatureTimestamp: now.toLocaleString("ru-RU"),
        signatureFingerprint: "vlm-telegram-doc",
        renterSignature: "согласие через Telegram",
        documentKey: `rental-${bike.id}-${Date.now()}`,
      },
    });

    // Load rental HTML template
    const templatePath = join(process.cwd(), "docs", "RENTAL_DEAL_TEMPLATE.html");
    let htmlTemplate: string;
    try {
      htmlTemplate = readFileSync(templatePath, "utf8");
    } catch (readErr) {
      logger.error("[/doc] Failed to read rental HTML template", readErr);
      await sendComplexMessage(chatId, "🚨 Ошибка: шаблон договора не найден. Обратитесь к администратору.", [], { removeKeyboard: true });
      return false;
    }

    const docFileName = `rental-contract-${bike.make}-${bike.model}-${startDate}.docx`
      .replace(/[^a-zA-Zа-яА-Я0-9.\-]/g, "-")
      .replace(/-+/g, "-");

    // Generate DOCX via the shared docx-capability pipeline
    const docResult = await buildFranchizeDocxFromTemplate({
      integrationScope: "telegram-doc-rental",
      uploadedBy: String(userId),
      documentKey: vars.document_key,
      fileName: docFileName,
      template: htmlTemplate,
      variables: vars,
      flowType: "rental",
      templateMode: "html",
    });

    const docxBuf = Buffer.from(docResult.bytes);
    const docSha256 = docResult.sha256;

    // Generate QR code for 1-click next rent with retry logic
    const qrDeepLink = `https://t.me/oneBikePlsBot/app?startapp=rent_${bike.id}_${docSha256}`;
    const qrPngUrl = `https://api.qrserver.com/v1/create-qr-code/?size=420x420&data=${encodeURIComponent(qrDeepLink)}&color=000000&bgcolor=ffffff&margin=1`;

    /**
     * Fetch with retry and exponential backoff for transient failures
     */
    async function fetchWithRetry(url: string, maxRetries = 3): Promise<Buffer | null> {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const timeoutMs = Math.min(8000, 2000 * attempt); // 2s, 4s, 8s
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

          const response = await fetch(url, { signal: controller.signal });
          clearTimeout(timeoutId);

          if (response.ok) {
            const buffer = Buffer.from(await response.arrayBuffer());
            if (buffer.length > 0) {
              logger.info(`[/doc] QR generation succeeded on attempt ${attempt}/${maxRetries}`);
              return buffer;
            }
          }

          // Non-OK response (404, 500, etc.)
          if (attempt === maxRetries) {
            logger.warn(`[/doc] QR generation failed on attempt ${attempt}/${maxRetries}: HTTP ${response.status}`);
            return null;
          }

          // Backoff before retry
          const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // 1s, 2s, 4s max
          logger.info(`[/doc] QR generation attempt ${attempt}/${maxRetries} failed, retrying in ${backoffMs}ms`);
          await new Promise(resolve => setTimeout(resolve, backoffMs));

        } catch (error) {
          const isAbort = error instanceof Error && error.name === 'AbortError';
          const isTransient = error instanceof Error && (
            /timeout/i.test(error.message) ||
            /fetch failed/i.test(error.message) ||
            /network/i.test(error.message)
          );

          if (attempt === maxRetries || !isTransient) {
            logger.warn(`[/doc] QR generation failed on attempt ${attempt}/${maxRetries}:`, error instanceof Error ? error.message : String(error));
            return null;
          }

          // Backoff for transient errors
          const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          logger.info(`[/doc] QR generation transient error on attempt ${attempt}/${maxRetries}, retrying in ${backoffMs}ms`);
          await new Promise(resolve => setTimeout(resolve, backoffMs));
        }
      }
      return null;
    }

    const qrPngBuffer = await fetchWithRetry(qrPngUrl, 3);
    if (!qrPngBuffer) {
      logger.warn("[/doc] QR generation failed after all retries, sending DOCX only");
    }

    // ── Send document + QR via Telegram (direct API, no @/app/actions dependency) ──
    let docSent = false;
    const caption = `Договор аренды: ${bike.make} ${bike.model}\n\n🔗 Быстрая повторная аренда:\n${qrDeepLink}`;

    // 1. Send DOCX first (most important)
    docSent = await telegramSendDocument(String(chatId), docxBuf, docFileName, caption);

    // 2. Send QR as separate photo (if we have it)
    if (qrPngBuffer) {
      const qrCaption = `📲 <b>QR для быстрой повторной аренды</b>\nНаведите камеру — данные заполнятся автоматически.\n\n🔗 ${qrDeepLink}`;
      const qrSent = await telegramSendPhoto(String(chatId), qrPngBuffer, `qr-${bike.id}.png`, qrCaption);
      if (!qrSent) {
        logger.warn("[/doc] QR photo send failed, but DOCX was sent");
      }
    }

    if (!docSent) {
      logger.error("[/doc] Document delivery FAILED — trying sendTelegramDocument fallback");
      // Last resort: try the imported sendTelegramDocument from @/app/actions
      try {
        await sendTelegramDocument(String(chatId), docxBuf, docFileName, caption);
        docSent = true;
        logger.info("[/doc] DOCX sent via sendTelegramDocument fallback");
      } catch (e) {
        logger.error("[/doc] All document delivery methods failed!", e);
      }
    }

    // Save rental secrets for 1-click next rent.
    // If the caller is a crew member (operator creating contract for a renter),
    // leave chat_id NULL so the operator does not accidentally load the renter's
    // personal data in their own profile/order. The renter claims it via QR.
    const creatorIsCrewMember = await isCrewMember(String(userId), "vip-bike");
    const secretChatId = creatorIsCrewMember ? null : String(userId);
    const { error: secretsError } = await supabaseAdmin
      .schema("private")
      .from("user_rental_secrets")
      .insert({
        chat_id: secretChatId,
        crew_slug: "vip-bike",
        doc_sha256: docSha256,
        renter_full_name: passport.fullName || null,
        renter_passport: `${passport.series || ""} ${passport.number || ""}`.trim() || null,
        renter_passport_issue_date: passport.issueDate || null,
        renter_passport_issued_by: passport.issuedBy || null,
        renter_registration: passport.registration || null,
        renter_driver_license: `${license.series || ""} ${license.number || ""}`.trim() || null,
        license_categories: (context.categories || []).join(", ") || null,
        license_expiry_date: license.expiryDate || null,
        renter_birth_date: passport.birthDate || null,
        renter_phone: passport.phone || null,
        renter_email: passport.email || null,
        renter_address: passport.registration || null,
        source_doc_key: vars.document_key,
        source_rental_id: null,
        verification_status: "verified",
        template_version: 1,
      });
    if (secretsError) {
      // Supabase errors have non-enumerable properties — log each explicitly
      logger.error("[/doc] Failed to save user_rental_secrets:", {
        message: (secretsError as any).message,
        code: (secretsError as any).code,
        details: (secretsError as any).details,
        hint: (secretsError as any).hint,
      });
    }

    // Save rental contract artifacts — now in private schema with all needed columns
    const { error: rentError } = await supabaseAdmin
      .schema("private")
      .from("rental_contract_artifacts")
      .insert({
        contract_key: vars.document_key,
        original_sha256: docSha256,
        requested_bike_id: context.bikeId,
        resolved_bike_id: bike.id,
        telegram_chat_id: String(userId),
        telegram_message_id: null,
        renter_full_name: passport.fullName || null,
        renter_passport: `${passport.series || ""} ${passport.number || ""}`.trim() || null,
        renter_passport_issued_by: passport.issuedBy || null,
        renter_passport_issue_date: passport.issueDate || null,
        renter_registration: passport.registration || null,
        renter_driver_license: `${license.series || ""} ${license.number || ""}`.trim() || null,
        renter_birth_date: passport.birthDate || null,
        license_categories: (context.categories || []).join(", ") || null,
        license_expiry_date: license.expiryDate || null,
        rent_start_date: startDate || null,
        rent_end_date: endDate || null,
        daily_price: String(bike.specs?.dailyPrice || bike.specs?.rent_weekday || "10000"),
        deposit_rub: vars.deposit_rub || String(bike.specs?.deposit_rub || "20000"),
        total_sum: Number(vars.subtotal_rub) || Number(bike.specs?.dailyPrice || bike.specs?.rent_weekday || "10000"),
        template_version: 1,
      });
    if (rentError) {
      logger.error("[/doc] Failed to save rental_contract_artifacts:", {
        message: (rentError as any).message,
        code: (rentError as any).code,
        details: (rentError as any).details,
        hint: (rentError as any).hint,
      });
    }

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

    // ── Create lead + crew_todos (aligned with /doc-manual flow) ──────────
    try {
      const { upsertFranchizeLead } = await import("@/app/franchize/lib/leads");
      const leadPhone = passport.phone || "";
      const leadUserId = leadPhone || String(userId);
      await upsertFranchizeLead({
        slug: "vip-bike",
        userId: leadUserId,
        intentType: "rent",
        stage: "contract_generated",
        bikeId: bike.id,
        bikeTitle: `${bike.make} ${bike.model}`,
        phone: leadPhone || undefined,
        fullName: passport.fullName || undefined,
        sourceRoute: "/doc-vlm",
        contactChannel: "telegram_bot",
        urgencyScore: 90,
        metadata: {
          dealType: "rent",
          operatorId: String(userId),
          hasPassport: !!(passport.series && passport.number),
          hasLicense: !!(license.series && license.number),
          source: "vlm",
        },
        ensureUser: true,
      });

      // Create crew_todos for equipment return
      if (!bike.crew_id) {
        logger.error("[/doc-vlm] Bike has no crew_id, cannot create todos", { bikeId: bike.id });
      } else {
      const crewId = bike.crew_id;
      const bikeLabel = `${bike.make} ${bike.model}`;
      const todos = [
        { title: `🔧 Проверить ТС при возврате: ${bikeLabel} (${endDate} 10:00)`, priority: "high" as const },
        { title: `🔑 Принять ключи от ${bikeLabel}`, priority: "high" as const },
        { title: `📄 Проверить документы при возврате ${bikeLabel}`, priority: "medium" as const },
        { title: `🔍 Осмотр на повреждения: ${bikeLabel}`, priority: "high" as const },
      ];

      const todoResult = await createLeadFollowupTodos({
        crewId,
        leadId: leadUserId,
        leadPhone,
        leadName: passport.fullName || "",
        bikeId: bike.id,
        todos,
        assignedTo: String(userId),
        metadata: {
          rental_id: null,
          rent_end_date: endDate,
          source: "vlm_doc",
        },
      });

      if (todoResult.success) {
        logger.info(`[/doc-vlm] Created ${todoResult.created} crew_todos (${todoResult.skipped} skipped as duplicates)`);
      } else {
        logger.warn("[/doc-vlm] Failed to create crew_todos:", todoResult.error);
      }
      } // close else (bike has crew_id)
    } catch (leadErr) {
      logger.warn("[/doc-vlm] Failed to create lead/todos:", leadErr);
    }

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

/**
 * Set or overwrite doc state for a user.
 * Always overwrites any existing state - user can only have one active /doc flow at a time.
 * This is intentional: starting a new /doc flow abandons any previous in-progress draft.
 */
async function setDocState(userId: string, state: string, context: DocFlowContext) {
  const expiresAt = new Date(Date.now() + DOC_STATE_EXPIRY_MINUTES * 60 * 1000).toISOString();

  // Use upsert with explicit onConflict to ensure overwrite behavior
  const { error } = await supabaseAdmin
    .from("user_states")
    .upsert(
      {
        user_id: userId,
        state,
        context,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(), // Force update timestamp
      },
      {
        onConflict: "user_id", // Explicitly state that user_id is the conflict target
        ignoreDuplicates: false, // We want to overwrite, not ignore
      }
    );

  if (error) {
    logger.error("[/doc] setDocState upsert failed", { userId, state, error: error.message });
    throw new Error(`Failed to set doc state: ${error.message}`);
  }

  logger.info("[/doc] Doc state set/overwritten", { userId, state, expiresAt });
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
    await sendComplexMessage(chatId, "🤖 Анализирую паспорт через ИИ... Это может занять несколько секунд.", [], { removeKeyboard: true });

    const result = await extractDocumentFromTelegramPhoto(fileId, "passport");

    if (!result.success) {
      const errorMsg = result.error || "Неизвестная ошибка";
      const userFriendlyError = errorMsg.includes("timeout")
        ? "⏰ Сервер ИИ не ответил вовремя."
        : errorMsg.includes("connection") || errorMsg.includes("ECONNREFUSED")
        ? "🔌 Не удалось подключиться к серверу ИИ."
        : errorMsg.includes("authentication") || errorMsg.includes("401")
        ? "🔑 Ошибка доступа к ИИ сервису."
        : `⚠️ ${errorMsg}`;

      // Offer manual input as fallback
      await sendComplexMessage(
        chatId,
        `${userFriendlyError}\n\n💡 *В fallback режим:* введите данные вручную или отправьте другое фото.`,
        [
          [{ text: "✍️ Ввести данные вручную", callback_data: "doc_manual_passport_start" }],
          [{ text: "🔄 Отправить другое фото", callback_data: "doc_retry_passport" }],
        ],
        { inlineKeyboard: true, parseMode: "Markdown" },
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
    await sendComplexMessage(chatId, "🤖 Анализирую водительское удостоверение через ИИ...", [], { removeKeyboard: true });

    const result = await extractDocumentFromTelegramPhoto(fileId, "license");

    if (!result.success) {
      const errorMsg = result.error || "Неизвестная ошибка";
      const userFriendlyError = errorMsg.includes("timeout")
        ? "⏰ Сервер ИИ не ответил вовремя."
        : errorMsg.includes("connection") || errorMsg.includes("ECONNREFUSED")
        ? "🔌 Не удалось подключиться к серверу ИИ."
        : errorMsg.includes("authentication") || errorMsg.includes("401")
        ? "🔑 Ошибка доступа к ИИ сервису."
        : `⚠️ ${errorMsg}`;

      // Offer manual input as fallback
      await sendComplexMessage(
        chatId,
        `${userFriendlyError}\n\n💡 *В fallback режим:* введите данные вручную или отправьте другое фото.`,
        [
          [{ text: "✍️ Ввести данные вручную", callback_data: "doc_manual_license_start" }],
          [{ text: "🔄 Отправить другое фото", callback_data: "doc_retry_license" }],
        ],
        { inlineKeyboard: true, parseMode: "Markdown" },
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

  // ── Manual input states ─────────────────────────────────────────────────────────────

  // Add manual passport states
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
  if (state === "doc_manual_passport_registration") {
    await handleManualPassportRegistration(userId, chatId, context, text);
    return true;
  }

  // Add manual license states
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

  // Unknown state — let other handlers process the message
  return false;
}

export async function handleDocCallback(
  userId: string,
  chatId: number,
  callbackData: string,
  callbackQueryId?: string,
): Promise<boolean> {
  const docState = await getDocState(userId);
  if (!docState) return false;

  const { state, context } = docState;
  const userIdNum = Number(userId);

  // Answer callback to remove loading state
  if (callbackQueryId) {
    try {
      await fetch(
        `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery?callback_query_id=${callbackQueryId}`,
        { method: "POST" },
      );
    } catch (e) {
      logger.warn("[/doc] Failed to answer callback", e);
    }
  }

  // Manual passport start
  if (callbackData === "doc_manual_passport_start") {
    context.extractionProvider = "manual";
    context.manualStep = "name";
    await setDocState(userId, "doc_manual_passport_name", context);
    await sendComplexMessage(
      chatId,
      "✍️ *Ввод данных паспорта*\n\nШаг 1 из 5: ФИО\n\nВведите фамилию, имя и отчество полностью.",
      [],
      { removeKeyboard: true, parseMode: "Markdown" },
    );
    return true;
  }

  // Manual license start
  if (callbackData === "doc_manual_license_start") {
    context.extractionProvider = "manual";
    context.manualStep = "name";
    await setDocState(userId, "doc_manual_license_name", context);
    await sendComplexMessage(
      chatId,
      "✍️ *Ввод данных водительского удостоверения*\n\nШаг 1 из 4: ФИО\n\nВведите фамилию, имя и отчество (как в ВУ).",
      [],
      { removeKeyboard: true, parseMode: "Markdown" },
    );
    return true;
  }

  // Retry passport photo
  if (callbackData === "doc_retry_passport") {
    await sendComplexMessage(
      chatId,
      "📸 Отправьте фото паспорта ещё раз.\n\n💡 Убедитесь, что фото чёткое и без бликов.",
      [],
      { removeKeyboard: true },
    );
    return true;
  }

  // Retry license photo
  if (callbackData === "doc_retry_license") {
    await sendComplexMessage(
      chatId,
      "📸 Отправьте фото водительского удостоверения ещё раз.\n\n💡 Убедитесь, что все категории видны.",
      [],
      { removeKeyboard: true },
    );
    return true;
  }

  // Category selection
  if (callbackData.startsWith("cat_")) {
    const value = callbackData.slice(4);

    if (value === "done") {
      // Done selecting categories
      const cats = context.categories || [];
      context.accessTier = deriveUserAccessTier(cats);

      // Move to expiry date
      context.manualStep = "expiry";
      await setDocState(userId, "doc_manual_license_expiry", context);

      const catStr = cats.join(", ") || "нет";
      await sendComplexMessage(
        chatId,
        `✅ Категории: *${catStr}*\n\nШаг 4 из 4: Срок действия\n\nВведите срок действия ВУ (ДД.ММ.ГГГГ).`,
        [],
        { removeKeyboard: true, parseMode: "Markdown" },
      );
      return true;
    }

    if (value === "cancel") {
      // Cancel manual input, go back to photo
      context.manualStep = undefined;
      context.categories = [];
      await setDocState(userId, "doc_awaiting_license", context);
      await sendComplexMessage(
        chatId,
        "❌ Ввод отменён. Отправьте фото ВУ или введите данные вручную.",
        [
          [{ text: "✍️ Ввести данные вручную", callback_data: "doc_manual_license_start" }],
          [{ text: "🔄 Отправить другое фото", callback_data: "doc_retry_license" }],
        ],
        { inlineKeyboard: true },
      );
      return true;
    }

    // Toggle category
    const cats = context.categories || [];
    const idx = cats.indexOf(value);
    if (idx >= 0) {
      cats.splice(idx, 1);
    } else {
      cats.push(value);
    }
    context.categories = cats;
    await setDocState(userId, state, context);

    // Update keyboard
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

// ── Manual input state handlers ─────────────────────────────────────────────────

async function handleManualPassportName(userId: string, chatId: number, context: DocFlowContext, text: string) {
  context.mpFullName = text.trim();
  context.manualStep = "number";
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
  context.manualStep = "issue";
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
  context.manualStep = "birth";
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
  context.manualStep = "registration";
  await setDocState(userId, "doc_manual_passport_registration", context);
  await sendComplexMessage(
    chatId,
    `✅ Дата рождения: *${text}*\n\nШаг 5 из 5: Адрес регистрации\n\nВведите адрес регистрации (можно кратко).\n\nПример: *г. Н.Новгород, ул. Ленина, д. 1, кв. 1*`,
    [],
    { removeKeyboard: true, parseMode: "Markdown" },
  );
}

async function handleManualPassportRegistration(userId: string, chatId: number, context: DocFlowContext, text: string) {
  context.mpRegistration = text.trim();

  // Compile passport data
  context.passportData = {
    fullName: context.mpFullName,
    series: context.mpSeries,
    number: context.mpNumber,
    issueDate: context.mpIssueDate,
    issuedBy: context.mpIssuedBy,
    birthDate: context.mpBirthDate,
    registration: context.mpRegistration,
  };

  // Show summary and move to license
  const summary = [
    "🪪 *Паспорт введён:*",
    `👤 ФИО: ${context.mpFullName}`,
    `🔢 Паспорт: ${context.mpSeries} ${context.mpNumber}`,
    `📅 Выдан: ${context.mpIssueDate}`,
    `🏢 Кем: ${context.mpIssuedBy}`,
    `📅 Дата рождения: ${context.mpBirthDate}`,
    `🏠 Адрес: ${context.mpRegistration}`,
    "",
    "Теперь отправьте фото *водительского удостоверения* или введите данные вручную.",
  ].join("\n");

  await setDocState(userId, "doc_awaiting_license", context);
  await sendComplexMessage(chatId, summary, [
    [{ text: "✍️ Ввести данные вручную", callback_data: "doc_manual_license_start" }],
  ], { removeKeyboard: true, parseMode: "Markdown" });
}

async function handleManualLicenseName(userId: string, chatId: number, context: DocFlowContext, text: string) {
  context.mlFullName = text.trim();
  context.manualStep = "number";
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
  context.manualStep = "categories";
  await setDocState(userId, "doc_manual_license_categories", context);
  await sendComplexMessage(
    chatId,
    `✅ ВУ: *${context.mlSeries} ${context.mlNumber}*\n\nШаг 3 из 4: Категории\n\nВыберите имеющиеся категории.`,
    buildCategoryKeyboard(),
    { inlineKeyboard: true, parseMode: "Markdown" },
  );
}

async function handleManualLicenseIssue(userId: string, chatId: number, context: DocFlowContext, text: string) {
  context.mlIssueDate = text.trim();
  context.manualStep = "expiry";
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

  // Compile license data
  context.licenseData = {
    fullName: context.mlFullName,
    series: context.mlSeries,
    number: context.mlNumber,
    issueDate: context.mlIssueDate,
    expiryDate: context.mlExpiryDate,
    categories: context.categories,
  };
  context.accessTier = deriveUserAccessTier(context.categories || []);

  const tierLabel = getAccessTierLabel(context.accessTier || "none");
  const catStr = (context.categories || []).join(", ") || "нет";

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
  ].filter(Boolean).join("\n");

  await setDocState(userId, "doc_awaiting_schedule", context);
  await sendComplexMessage(chatId, summary, [], { removeKeyboard: true, parseMode: "Markdown" });
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

  // Check ZAI configuration early
  const zaiBaseUrl = process.env.ZAI_BASE_URL;
  const zaiApiKey = process.env.ZAI_API_KEY;

  if (!zaiBaseUrl || !zaiApiKey) {
    logger.error("[/doc] ZAI not configured", {
      hasBaseUrl: !!zaiBaseUrl,
      hasApiKey: !!zaiApiKey,
    });
    await sendComplexMessage(
      chatId,
      "🚨 Сервис ИИ недоступен. Обратитесь к поддержке.",
      [],
      { removeKeyboard: true },
    );
    await notifyAdmin(`❌ /doc command used but ZAI not configured! Missing: ${!zaiBaseUrl ? 'ZAI_BASE_URL ' : ''}${!zaiApiKey ? 'ZAI_API_KEY' : ''}`);
    return;
  }

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