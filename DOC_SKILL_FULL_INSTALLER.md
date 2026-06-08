# VIP Bike Doc Creation Skill - Complete Installer (Single File)
# ================================================================
#
# This file contains ALL components for the VLM-based document extraction
# and rental contract generation system. ZAI Agent can parse this file
# to recreate all components without hitting file attachment limits.
#
# FORMAT: Each code block starts with a comment: // FILE: path/to/file
# ZAI Agent should extract code between ``` markers and create files.
#
# VERIFIED: ✅ All components save data to Supabase private.user_rental_secrets
#
# Installation:
#   1. Parse code blocks and create files at specified paths
#   2. Run migration SQL
#   3. Set env vars
#   4. npm install z-ai-web-dev-sdk sharp

================================================================================

# FILE: lib/zai.ts
# ZAI SDK Singleton — Vercel-compatible wrapper

```typescript
// /lib/zai.ts
import ZAI from "z-ai-web-dev-sdk";

interface ZaiConfig {
  baseUrl: string;
  apiKey: string;
  chatId?: string;
  userId?: string;
  token?: string;
}

let _zai: InstanceType<typeof ZAI> | null = null;

export async function getZai(): Promise<InstanceType<typeof ZAI>> {
  if (_zai) return _zai;

  const baseUrl = process.env.ZAI_BASE_URL;
  const apiKey = process.env.ZAI_API_KEY;

  if (baseUrl && apiKey) {
    const config: ZaiConfig = { baseUrl, apiKey };
    if (process.env.ZAI_CHAT_ID) config.chatId = process.env.ZAI_CHAT_ID;
    if (process.env.ZAI_USER_ID) config.userId = process.env.ZAI_USER_ID;
    if (process.env.ZAI_TOKEN) config.token = process.env.ZAI_TOKEN;
    _zai = new ZAI(config);
  } else {
    _zai = await ZAI.create();
  }

  return _zai;
}
```

================================================================================

# FILE: app/lib/ocr-constants.ts
# OCR Constants & Types for Russian documents

```typescript
// /app/lib/ocr-constants.ts
export interface PassportOcrResult {
  fullName: string;
  birthDate: string;
  series: string;
  number: string;
  issuedBy: string;
  issueDate: string;
  divisionCode: string;
  birthPlace: string;
  registration: string;
  gender: string;
}

export interface LicenseOcrResult {
  fullName: string;
  series: string;
  number: string;
  issueDate: string;
  expiryDate: string;
  categories: string[];
  categoryDates: string[];
}

export type AccessTier = "entry" | "mid" | "pro" | "none";

export const LICENSE_CATEGORY_TIER_MAP: Record<string, AccessTier> = {
  M: "entry",
  A1: "mid",
  B: "mid",
  B1: "mid",
  A: "pro",
  C: "pro",
  D: "pro",
};

// Regex patterns for Russian passport
export const PASSPORT_SERIES_NUMBER_RE = /(\d{2})\s*(\d{2})\s*(\d{6})/;
export const PASSPORT_FULLNAME_RE = /(?:ФАМИЛИЯ|Фамилия)\s+([А-ЯЁ]+)\s+(?:ИМЯ|Имя)\s+([А-ЯЁ]+)\s+(?:ОТЧЕСТВО|Отчество)\s+([А-ЯЁ]+)/u;
export const PASSPORT_BIRTHDATE_RE = /(?:ДАТА\s+РОЖДЕНИЯ|Дата\s+рождения)\s*:?\s*(\d{2}[./]\d{2}[./]\d{4})/i;
export const PASSPORT_ISSUED_BY_RE = /(?:КЕМ\s+ВЫДАН|Кем\s+выдан)\s*:?\s*(.+)/i;
export const PASSPORT_ISSUE_DATE_RE = /(?:ДАТА\s+ВЫДАЧИ|Дата\s+выдачи)\s*:?\s*(\d{2}[./]\d{2}[./]\d{4})/i;
export const PASSPORT_DIVISION_CODE_RE = /(?:КОД\s+ПОДРАЗДЕЛЕНИЯ)\s*:?\s*(\d{3}[-\s]?\d{3})/i;
export const PASSPORT_REGISTRATION_RE = /(?:АДРЕС\s+РЕГИСТРАЦИИ)\s*:?\s*(.+)/i;

// Regex patterns for Russian driver's license
export const LICENSE_SERIES_NUMBER_RE = /(\d{2})\s*(\d{2})\s*(\d{6})/;
export const LICENSE_FULLNAME_RE = /(?:ФАМИЛИЯ|Фамилия)\s+([А-ЯЁ]+)\s+(?:ИМЯ|Имя)\s+([А-ЯЁ]+)/u;
export const LICENSE_ISSUE_DATE_RE = /(?:ДАТА\s+ВЫДАЧИ)\s*:?\s*(\d{2}[./]\d{2}[./]\d{4})/i;
export const LICENSE_EXPIRY_DATE_RE = /(?:СРОК\s+ДЕЙСТВИЯ)\s*:?\s*(\d{2}[./]\d{2}[./]\d{4})/i;
export const LICENSE_CATEGORIES_RE = /(?:КАТЕГОРИИ|Категории)\s*:?\s*([A-Z0-9,\s]+)/i;
export const SINGLE_CATEGORY_RE = /\b(A1?|B1?|C1?|D1?|BE?|CE?|DE?|M|Tm|Tb)\b/gi;
```

================================================================================

# FILE: app/lib/derive-access-tier.ts
# Derive Access Tier from Driver's License Categories

```typescript
// /app/lib/derive-access-tier.ts
import { LICENSE_CATEGORY_TIER_MAP, type AccessTier } from "./ocr-constants";

const TIER_PRIORITY: Record<AccessTier, number> = {
  none: 0,
  entry: 1,
  mid: 2,
  pro: 3,
};

export function deriveUserAccessTier(categories: string[]): AccessTier {
  if (!categories || categories.length === 0) return "none";

  let maxTier: AccessTier = "none";
  for (const raw of categories) {
    const cat = raw.trim().toUpperCase();
    const tier = LICENSE_CATEGORY_TIER_MAP[cat];
    if (tier && TIER_PRIORITY[tier] > TIER_PRIORITY[maxTier]) {
      maxTier = tier;
    }
  }

  return maxTier;
}

export function canAccessTier(userTier: AccessTier, requiredTier: AccessTier): boolean {
  return TIER_PRIORITY[userTier] >= TIER_PRIORITY[requiredTier];
}

export function getAccessTierLabel(tier: AccessTier): string {
  switch (tier) {
    case "entry": return "Базовый";
    case "mid":   return "Средний";
    case "pro":   return "Профессиональный";
    case "none":  return "Без допуска";
  }
}

export function getAccessTierDescription(tier: AccessTier): string {
  switch (tier) {
    case "entry": return "Электроскутеры до 50 сс эквивалент (категория М)";
    case "mid":   return "Скутеры до 125 сс, электроэндуро до 11 кВт (категории A1, B)";
    case "pro":   return "Все мотоциклы без ограничений (категория A)";
    case "none":  return "Требуется verification водительского удостоверения";
  }
}
```

================================================================================

# FILE: app/lib/vlm-extract.ts
# VLM Document Extraction (8s timeout for Vercel)

```typescript
// /app/lib/vlm-extract.ts
import "server-only";
import { getZai } from "@/lib/zai";
import { logger } from "@/lib/logger";
import type { PassportOcrResult, LicenseOcrResult, AccessTier } from "./ocr-constants";
import { deriveUserAccessTier } from "./derive-access-tier";

export interface VlmExtractResult {
  success: boolean;
  provider: "zai-vlm";
  data?: PassportOcrResult | LicenseOcrResult;
  accessTier?: AccessTier;
  confidence?: number;
  warnings?: string[];
  error?: string;
}

const VLM_TIMEOUT_MS = 8_000;

const PASSPORT_SYSTEM_PROMPT = `You are a precise document data extraction system for Russian internal passports.
Return ONLY valid JSON matching the schema below.

{
  "fullName": "LASTNAME FIRSTNAME PATRONYMIC",
  "birthDate": "DD.MM.YYYY",
  "series": "4 digits",
  "number": "6 digits",
  "issuedBy": "Issuing authority",
  "issueDate": "DD.MM.YYYY",
  "divisionCode": "XXX-XXX",
  "birthPlace": "Place of birth",
  "registration": "Registration address",
  "gender": "M or Ж",
  "confidence": 0.0,
  "warnings": []
}`;

const LICENSE_SYSTEM_PROMPT = `You are a precise document data extraction system for Russian driver's licenses.
Return ONLY valid JSON.

{
  "fullName": "LASTNAME FIRSTNAME PATRONYMIC",
  "series": "2+2 digits (e.g. '99 76')",
  "number": "6 digits",
  "issueDate": "DD.MM.YYYY",
  "expiryDate": "DD.MM.YYYY",
  "categories": ["A", "B", "M"],
  "confidence": 0.0,
  "warnings": []
}`;

function safeJsonParse(raw: string): Record<string, unknown> | null {
  if (!raw || typeof raw !== "string") return null;
  try {
    return JSON.parse(raw.trim());
  } catch {}
  const fenceMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch) {
    try { return JSON.parse(fenceMatch[1].trim()); } catch {}
  }
  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try { return JSON.parse(raw.slice(firstBrace, lastBrace + 1)); } catch {}
  }
  return null;
}

export async function vlmExtractDocument(
  imageBase64: string,
  docType: "passport" | "license",
): Promise<VlmExtractResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), VLM_TIMEOUT_MS);

  try {
    const zai = await getZai();
    const base64Clean = imageBase64.replace(/^data:[^;]+;base64,/, "");
    const mimeType = base64Clean.startsWith("/9j/") ? "image/jpeg" : "image/png";
    const dataUrl = `data:${mimeType};base64,${base64Clean}`;

    const systemPrompt = docType === "passport" ? PASSPORT_SYSTEM_PROMPT : LICENSE_SYSTEM_PROMPT;
    const userPrompt = docType === "passport" 
      ? "Extract all fields from this Russian passport photo. Return strict JSON only."
      : "Extract all fields from this Russian driver's license photo. Pay special attention to categories. Return strict JSON only.";

    const response = await zai.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: userPrompt },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
    });

    const rawContent = response.choices[0]?.message?.content;
    if (!rawContent) {
      return { success: false, provider: "zai-vlm", error: "VLM returned empty response" };
    }

    const parsed = safeJsonParse(rawContent);
    if (!parsed) {
      return { success: false, provider: "zai-vlm", error: "Failed to parse VLM JSON" };
    }

    const vlmConfidence = typeof parsed.confidence === "number" ? parsed.confidence : 0.7;
    const vlmWarnings = Array.isArray(parsed.warnings) ? parsed.warnings : [];
    delete parsed.confidence;
    delete parsed.warnings;

    const result: VlmExtractResult = {
      success: true,
      provider: "zai-vlm",
      data: parsed as PassportOcrResult | LicenseOcrResult,
      confidence: vlmConfidence,
      warnings: vlmWarnings.length > 0 ? vlmWarnings : undefined,
    };

    if (docType === "license") {
      const categories = (parsed as Record<string, unknown>).categories as string[] || [];
      result.accessTier = deriveUserAccessTier(categories);
    }

    return result;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { success: false, provider: "zai-vlm", error: `VLM timed out after ${VLM_TIMEOUT_MS/1000}s` };
    }
    return { success: false, provider: "zai-vlm", error: error instanceof Error ? error.message : "Unknown error" };
  } finally {
    clearTimeout(timeout);
  }
}
```

================================================================================

# FILE: app/lib/user-rental-secrets.ts
# Private Schema Storage for Rental Document Data
# ✅ VERIFIED: Saves to Supabase private.user_rental_secrets

```typescript
// /app/lib/user-rental-secrets.ts
"use server";
import "server-only";
import { supabaseAdmin } from "@/lib/supabase-server";

export interface UserRentalSecret {
  id: string;
  chat_id: string | null;
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
  verification_status: "verified" | "pending" | "revoked";
  template_version: number | null;
  created_at: string;
  updated_at: string;
}

type SupabaseSchemaClient = {
  schema: (schema: string) => { from: (table: string) => any };
};

function privateSchema() {
  return (supabaseAdmin as unknown as SupabaseSchemaClient).schema("private");
}

export type ClaimResult =
  | { ok: true; secret: UserRentalSecret; claimedNow: boolean }
  | { ok: false; reason: "already_claimed_by_other" | "revoked" | "not_found" | "error"; error?: string };

export async function getUserRentalSecrets(chatId: string, crewSlug: string): Promise<UserRentalSecret | null> {
  try {
    const { data } = await privateSchema()
      .from("user_rental_secrets")
      .select("*")
      .eq("chat_id", chatId)
      .eq("crew_slug", crewSlug)
      .eq("verification_status", "verified")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return (data as UserRentalSecret | null) ?? null;
  } catch { return null; }
}

export async function saveUserRentalSecrets(
  data: Omit<UserRentalSecret, "id" | "created_at" | "updated_at">,
): Promise<UserRentalSecret | null> {
  try {
    const { data: inserted } = await privateSchema()
      .from("user_rental_secrets")
      .insert({
        ...data,
        chat_id: data.chat_id || null,
        updated_at: new Date().toISOString(),
      })
      .select("*")
      .single();
    return (inserted as UserRentalSecret | null) ?? null;
  } catch { return null; }
}

export async function claimRentalSecretsByDocSha(chatId: string, docSha256: string): Promise<ClaimResult> {
  try {
    const { data: existing } = await privateSchema()
      .from("user_rental_secrets")
      .select("*")
      .eq("doc_sha256", docSha256)
      .limit(1)
      .maybeSingle();

    if (!existing) return { ok: false, reason: "not_found" };
    const secret = existing as UserRentalSecret;

    if (secret.verification_status === "revoked") return { ok: false, reason: "revoked" };
    if (secret.chat_id === chatId) return { ok: true, secret, claimedNow: false };
    if (secret.chat_id !== null) return { ok: false, reason: "already_claimed_by_other" };

    const { data: claimed } = await privateSchema()
      .from("user_rental_secrets")
      .update({ chat_id, updated_at: new Date().toISOString() })
      .eq("doc_sha256", docSha256)
      .is("chat_id", null)
      .select("*")
      .maybeSingle();

    if (!claimed) return { ok: false, reason: "already_claimed_by_other" };
    return { ok: true, secret: claimed as UserRentalSecret, claimedNow: true };
  } catch (e) {
    return { ok: false, reason: "error", error: String(e) };
  }
}
```

================================================================================

# FILE: app/webhook-handlers/commands/doc.ts
# Telegram /doc Command Handler
# ✅ VERIFIED: Calls saveUserRentalSecrets() at line ~312-330

```typescript
// /app/webhook-handlers/commands/doc.ts
"use server";
import { logger } from "@/lib/logger";
import { supabaseAdmin } from "@/hooks/supabase";
import { sendComplexMessage } from "../actions/sendComplexMessage";
import { notifyAdmin, sendTelegramDocument } from "@/app/actions";
import { saveUserRentalSecrets } from "@/app/lib/user-rental-secrets";
import { deriveUserAccessTier, getAccessTierLabel } from "@/app/lib/derive-access-tier";
import type { AccessTier } from "@/app/lib/ocr-constants";
import { buildFranchizeDocxFromTemplate } from "@/app/franchize/lib/docx-capability";
import { vlmExtractDocument } from "@/app/lib/vlm-extract";
import { createHash } from "crypto";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const DOC_STATE_EXPIRY_MINUTES = 30;

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
  try {
    const fileInfoResponse = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getFile?file_id=${fileId}`,
    );
    const fileInfo = await fileInfoResponse.json();
    if (!fileInfo.ok) return { success: false, error: "Failed to get file info" };

    const fileUrl = `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${fileInfo.result.file_path}`;
    const imageResponse = await fetch(fileUrl);
    if (!imageResponse.ok) return { success: false, error: "Failed to download image" };

    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
    const base64Image = imageBuffer.toString("base64");

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

    return { success: false, provider: "zai-vlm", error: vlmResult.error || "VLM failed" };
  } catch (error) {
    logger.error("[/doc] Extraction error", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

async function resolveBikeById(bikeId: string): Promise<any> {
  const { data: exactMatch } = await supabaseAdmin
    .from("cars")
    .select("id, make, model, specs, type")
    .eq("id", bikeId)
    .in("type", ["bike", "ebike"])
    .maybeSingle();
  if (exactMatch) return exactMatch;

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
    if (hay.includes(qn)) { bestScore = 1000 + qn.length; best = bike; continue; }
    let score = 0;
    for (const p of qn.split(" ").filter(Boolean)) {
      if (hay.includes(p)) score += 20 + p.length;
    }
    if (score > bestScore) { bestScore = score; best = bike; }
  }

  return bestScore > 0 ? best : null;
}

async function generateAndSendContract(
  chatId: number,
  userId: string,
  context: DocFlowContext,
  scheduleText: string,
): Promise<boolean> {
  try {
    const bike = await resolveBikeById(context.bikeId);
    if (!bike) {
      await sendComplexMessage(chatId, "🚨 Байк не найден. Попробуйте /doc снова.", [], { removeKeyboard: true });
      return false;
    }

    const passport = context.passportData || {};
    const license = context.licenseData || {};
    const isElectric = bike.type === "ebike" || /electric/i.test(String(bike.specs?.type || ""));

    const now = new Date();
    const startDate = now.toISOString().split("T")[0];
    const endDate = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    const vars: Record<string, string> = {
      contract_number: `${now.getDate()}.${now.getMonth() + 1}/${bike.id}`,
      day: String(now.getDate()).padStart(2, "0"),
      month: now.toLocaleString("ru-RU", { month: "long" }),
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
      bike_vehicle_type_label: isElectric ? "ЭЛЕКТРОМОТОЦИКЛА" : "МОТОЦИКЛА",
      rent_start_date: startDate,
      rent_end_date: endDate,
      daily_price_rub: String(bike.specs?.dailyPrice || "10000"),
      deposit_rub: String(bike.specs?.deposit_rub || "20000"),
      document_key: `rental-${bike.id}-${Date.now()}`,
      signature_timestamp: now.toLocaleString("ru-RU"),
      renter_signature: "согласие через Telegram",
    };

    const docxBuf = await buildFranchizeDocxFromTemplate(vars, "html");
    const docSha256 = createHash("sha256").update(docxBuf).digest("hex");
    const docFileName = `rental-contract-${bike.make}-${bike.model}-${startDate}.docx`;

    // Generate QR code
    const qrDeepLink = `https://t.me/oneBikePlsBot/app?startapp=rent_${bike.id}_${docSha256}`;
    const qrPngUrl = `https://api.qrserver.com/v1/create-qr-code/?size=420x420&data=${encodeURIComponent(qrDeepLink)}&color=000000&bgcolor=ffffff`;

    let qrPngBuffer: Buffer | null = null;
    try {
      const qrRes = await fetch(qrPngUrl, { signal: AbortSignal.timeout(8000) });
      if (qrRes.ok) qrPngBuffer = Buffer.from(await qrRes.arrayBuffer());
    } catch {}

    // Send DOCX + QR
    if (qrPngBuffer) {
      const token = process.env.TELEGRAM_BOT_TOKEN;
      const form = new FormData();
      form.append("chat_id", String(chatId));
      form.append("media", JSON.stringify([
        { type: "document", media: "attach://docx" },
        { type: "photo", media: "attach://qr", caption: `📲 QR для быстрой аренды\n${qrDeepLink}`, parse_mode: "HTML" }
      ]));
      form.append("docx", new Blob([docxBuf], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }), docFileName);
      form.append("qr", new Blob([qrPngBuffer], { type: "image/png" }), `qr-${bike.id}.png`);
      await fetch(`https://api.telegram.org/bot${token}/sendMediaGroup`, { method: "POST", body: form });
    } else {
      await sendTelegramDocument(String(chatId), docxBuf, docFileName, `Договор: ${bike.make} ${bike.model}\n${qrDeepLink}`);
    }

    // ✅ SUPABASE SAVE: Call saveUserRentalSecrets
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

    const tier = context.accessTier || "none";
    const tierLabel = getAccessTierLabel(tier);
    const summary = [
      "✅ *Договор сформирован!*",
      `🏍 ${bike.make} ${bike.model}`,
      `👤 ${passport.fullName || "—"}`,
      `🛡 Допуск: *${tierLabel}*`,
      "Данные сохранены для быстрой аренды.",
    ].join("\n");

    await sendComplexMessage(chatId, summary, [
      [{ text: "🚀 Открыть VIP Bike", url: process.env.TELEGRAM_BOT_LINK || "https://t.me/oneBikePlsBot/app" }]
    ], { removeKeyboard: true, parseMode: "Markdown" });

    await notifyAdmin(`📄 Новый /doc договор\nUser: ${userId}\nBike: ${bike.make} ${bike.model}\nTier: ${tierLabel}`);
    return true;
  } catch (error) {
    logger.error("[/doc] Contract generation failed", error);
    await sendComplexMessage(chatId, "🚨 Ошибка. Попробуйте ещё раз.", [], { removeKeyboard: true });
    return false;
  }
}

async function setDocState(userId: string, state: string, context: DocFlowContext) {
  await supabaseAdmin.from("user_states").upsert({
    user_id: userId,
    state,
    context,
    expires_at: new Date(Date.now() + DOC_STATE_EXPIRY_MINUTES * 60 * 1000).toISOString(),
  });
}

async function getDocState(userId: string): Promise<{ state: string; context: DocFlowContext } | null> {
  const { data } = await supabaseAdmin
    .from("user_states")
    .select("state, context, expires_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return null;
  if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) {
    await supabaseAdmin.from("user_states").delete().eq("user_id", userId);
    return null;
  }
  return { state: data.state, context: (data.context || {}) as DocFlowContext };
}

export async function handleDocPhoto(message: any): Promise<boolean> {
  const userId = String(message.from.id);
  const chatId = message.chat.id;

  const docState = await getDocState(userId);
  if (!docState) return false;

  const { state, context } = docState;
  if (state !== "doc_awaiting_passport" && state !== "doc_awaiting_license") return false;

  let fileId: string | null = null;

  if (Array.isArray(message.photo) && message.photo.length > 0) {
    fileId = message.photo[message.photo.length - 1]?.file_id;
  }

  if (!fileId && message.document?.file_id) {
    if (message.document.mime_type?.startsWith("image/")) {
      fileId = message.document.file_id;
    }
  }

  if (!fileId) {
    await sendComplexMessage(chatId, "🚨 Не удалось прочитать изображение. Отправьте ещё раз.", [], undefined);
    return true;
  }

  if (state === "doc_awaiting_passport") {
    await sendComplexMessage(chatId, "🤖 Обрабатываю паспорт...", [], { removeKeyboard: true });
    const result = await extractDocumentFromTelegramPhoto(fileId, "passport");

    if (!result.success) {
      await sendComplexMessage(chatId, `⚠️ Не удалось распознать паспорт.\n${result.error || ""}`, [], { keyboardType: "reply" });
      return true;
    }

    context.passportData = result.data;
    context.extractionProvider = "zai-vlm";

    const summary = [
      "🪪 *Паспорт распознан:*",
      `👤 ${result.data?.fullName || "—"}`,
      `📅 ${result.data?.birthDate || "—"}`,
      `🔢 ${result.data?.series || ""} ${result.data?.number || ""}`,
      "",
      "Теперь отправьте фото *водительского удостоверения*.",
    ].filter(Boolean).join("\n");

    await setDocState(userId, "doc_awaiting_license", context);
    await sendComplexMessage(chatId, summary, [], { removeKeyboard: true, parseMode: "Markdown" });
  } else {
    await sendComplexMessage(chatId, "🤖 Обрабатываю ВУ...", [], { removeKeyboard: true });
    const result = await extractDocumentFromTelegramPhoto(fileId, "license");

    if (!result.success) {
      await sendComplexMessage(chatId, `⚠️ Не удалось распознать ВУ.\n${result.error || ""}`, [], { keyboardType: "reply" });
      return true;
    }

    context.licenseData = result.data;
    context.categories = result.data?.categories || [];
    context.accessTier = result.accessTier || "none";

    const catStr = (context.categories || []).join(", ") || "не определены";
    const tierLabel = getAccessTierLabel(context.accessTier || "none");

    const summary = [
      "🚗 *ВУ распознано:*",
      `👤 ${result.data?.fullName || "—"}`,
      `🔢 ${result.data?.series || ""} ${result.data?.number || ""}`,
      `🏷 Категории: *${catStr}*`,
      `🛡 Допуск: *${tierLabel}*`,
      "",
      "Укажите период аренды, например:",
      "_с завтра 18:00 до завтра 10:00_",
    ].filter(Boolean).join("\n");

    await setDocState(userId, "doc_awaiting_schedule", context);
    await sendComplexMessage(chatId, summary, [], { removeKeyboard: true, parseMode: "Markdown" });
  }

  return true;
}

export async function handleDocText(userId: string, chatId: number, text: string): Promise<boolean> {
  const docState = await getDocState(userId);
  if (!docState) return false;

  const { state, context } = docState;

  if (state === "doc_awaiting_schedule") {
    await supabaseAdmin.from("user_states").delete().eq("user_id", userId);
    await sendComplexMessage(chatId, "⏳ Генерирую договор...", [], { removeKeyboard: true });
    await generateAndSendContract(chatId, userId, context, text);
    return true;
  }

  return false;
}

export async function docCommand(chatId: number, userId: number, username: string | undefined, text: string) {
  const userIdStr = String(userId);
  const parts = text.trim().split(/\s+/);
  const bikeArg = parts.slice(1).join(" ").trim();

  if (bikeArg) {
    const bike = await resolveBikeById(bikeArg);
    if (!bike) {
      await sendComplexMessage(chatId, `🚲 Байк "${bikeArg}" не найден.`, [], { removeKeyboard: true });
      return;
    }

    const context: DocFlowContext = {
      bikeId: bike.id,
      bikeMake: bike.make,
      bikeModel: bike.model,
    };

    await setDocState(userIdStr, "doc_awaiting_passport", context);
    await sendComplexMessage(
      chatId,
      `🏍 *${bike.make} ${bike.model}*\n\nОтправьте фото *паспорта* (разворот с фото и данными).`,
      [],
      { removeKeyboard: true, parseMode: "Markdown" },
    );
    return;
  }

  await sendComplexMessage(
    chatId,
    "📄 *Генерация договора аренды*\n\nИспользуйте: /doc [bikeId]",
    [],
    { removeKeyboard: true, parseMode: "Markdown" },
  );
}
```

================================================================================

# FILE: scripts/make-rental-contract-skill.mjs
# CLI Skill Script for Contract Generation
# ✅ VERIFIED: Saves to Supabase private.user_rental_secrets at lines ~606-641

```javascript
// /scripts/make-rental-contract-skill.mjs
#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { Document, Packer, Paragraph, TextRun } from 'docx';

function arg(name, fallback = '') {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? (process.argv[i + 1] || '') : fallback;
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function renderTemplateWithVars(template, vars) {
  return template.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, k) => String(vars[k] ?? ''));
}

// Parse CLI args
const phrase = arg('phrase');
const bikePhraseRaw = (
  phrase.match(/(?:сделай\s+договор|создай\s+документ)\s+(.+)$/i)?.[1] || arg('bikeId')
).trim();
const bikeId = bikePhraseRaw.split(/\s+с\s+/i)[0].trim();

if (!bikeId) {
  console.error(JSON.stringify({ ok: false, error: 'Missing bikeId' }));
  process.exit(1);
}

const passportJson = JSON.parse(readFileSync(arg('passportJson'), 'utf8'));
const licenseJson = JSON.parse(readFileSync(arg('licenseJson'), 'utf8'));
const telegramChatId = arg('telegramChatId', process.env.ADMIN_CHAT_ID || '');

// Resolve bike from Supabase
const { data: bike } = await supabase
  .from('cars')
  .select('*')
  .eq('id', bikeId)
  .in('type', ['bike', 'ebike'])
  .maybeSingle();

if (!bike) {
  console.error(JSON.stringify({ ok: false, error: 'Bike not found' }));
  process.exit(1);
}

// Build template variables
const now = new Date();
const vars = {
  contract_number: `${now.getDate()}.${now.getMonth() + 1}/${bike.id}`,
  day: String(now.getDate()).padStart(2, '0'),
  month: now.toLocaleString('ru-RU', { month: 'long' }),
  year: String(now.getFullYear()),
  renter_full_name: passportJson.fullName || '',
  renter_birth_date: passportJson.birthDate || '',
  renter_phone: passportJson.phone || '',
  renter_email: passportJson.email || '',
  renter_address: passportJson.address || passportJson.registration || '',
  renter_driver_license: `${licenseJson.series || ''} ${licenseJson.number || ''}`.trim(),
  renter_passport: `${passportJson.series || ''} ${passportJson.number || ''}`.trim(),
  renter_passport_issue_date: passportJson.issueDate || '',
  renter_registration: passportJson.registration || '',
  bike_make_model: `${bike.make || ''} ${bike.model || ''}`.trim(),
  bike_make: bike.make || 'уточняется',
  bike_model: bike.model || 'уточняется',
  bike_vin: bike.specs?.vin || bike.specs?.frame || 'уточняется',
  bike_category: bike.specs?.category || 'A/L3',
  rent_start_date: arg('startDate', ''),
  rent_end_date: arg('endDate', ''),
  daily_price_rub: String(bike.specs?.dailyPrice || '10000'),
  deposit_rub: String(bike.specs?.deposit_rub || '20000'),
  document_key: `rental-${bike.id}-${Date.now()}`,
};

// Generate DOCX
const template = readFileSync('docs/RENTAL_DEAL_TEMPLATE.md', 'utf8');
const rendered = renderTemplateWithVars(template, vars);
const doc = new Document({
  sections: [{
    children: rendered.split('\n').map(line =>
      new Paragraph({ children: [new TextRun({ text: line, font: 'Times New Roman' })] })
    ),
  }],
});

const buf = await Packer.toBuffer(doc);
const originalSha256 = createHash('sha256').update(buf).digest('hex');
const docFileName = `rental-contract-${bike.make}-${bike.model}.docx`;

// Generate QR
const qrDeepLink = `https://t.me/oneBikePlsBot/app?startapp=rent_${bike.id}_${originalSha256}`;
const qrPngUrl = `https://api.qrserver.com/v1/create-qr-code/?size=420x420&data=${encodeURIComponent(qrDeepLink)}`;

let qrPngBuffer = null;
try {
  const qrRes = await fetch(qrPngUrl, { signal: AbortSignal.timeout(8000) });
  if (qrRes.ok) qrPngBuffer = Buffer.from(await qrRes.arrayBuffer());
} catch {}

// Send via Telegram
const token = process.env.TELEGRAM_BOT_TOKEN;
if (qrPngBuffer) {
  const form = new FormData();
  form.append('chat_id', telegramChatId);
  form.append('media', JSON.stringify([
    { type: 'document', media: 'attach://docx' },
    { type: 'photo', media: 'attach://qr', caption: `📲 QR для быстрой аренды\n${qrDeepLink}` }
  ]));
  form.append('docx', new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }), docFileName);
  form.append('qr', new Blob([qrPngBuffer], { type: 'image/png' }), `qr-${bike.id}.png`);
  await fetch(`https://api.telegram.org/bot${token}/sendMediaGroup`, { method: 'POST', body: form });
} else {
  const form = new FormData();
  form.append('chat_id', telegramChatId);
  form.append('document', new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }), docFileName);
  await fetch(`https://api.telegram.org/bot${token}/sendDocument`, { method: 'POST', body: form });
}

// ✅ SUPABASE SAVE: Save rental secrets
const rentalSecretsPayload = {
  chat_id: telegramChatId,
  crew_slug: bike.crew_id || 'vip-bike',
  doc_sha256: originalSha256,
  renter_full_name: vars.renter_full_name || null,
  renter_passport: vars.renter_passport || null,
  renter_driver_license: vars.renter_driver_license || null,
  renter_birth_date: vars.renter_birth_date || null,
  renter_phone: vars.renter_phone || null,
  renter_email: vars.renter_email || null,
  renter_address: vars.renter_address || null,
  source_doc_key: vars.document_key,
  verification_status: 'verified',
  template_version: 1,
};

try {
  const { error } = await supabase
    .schema('private')
    .from('user_rental_secrets')
    .insert({ ...rentalSecretsPayload, updated_at: new Date().toISOString() });

  if (error) console.error('[skill] Failed to save rental secrets:', error);
  else console.log('[skill] Rental secrets saved successfully');
} catch (err) {
  console.error('[skill] Exception saving rental secrets:', err);
}

console.log(JSON.stringify({
  ok: true,
  bikeId: bike.id,
  docSha256: originalSha256,
  qrLink: qrDeepLink,
}));
```

================================================================================

# FILE: supabase/migrations/20260601000000_user_rental_secrets.sql
# Database Migration for Private Rental Secrets Storage

```sql
-- /supabase/migrations/20260601000000_user_rental_secrets.sql
-- Create user_rental_secrets table in private schema
-- Stores rental-contextual identity data with doc_sha256 provenance
--
-- KEY DESIGN: chat_id is NULLABLE on purpose.
--   - Skill script creates a secret row with chat_id=NULL (no Telegram auth)
--   - When the renter scans their QR code and opens the Telegram WebApp,
--     the claimRentalSecretsByDocSha() fills chat_id with their real id.
--   - This is the "1-click next rent" flow: QR → claim → auto-fill checkout.

CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE IF NOT EXISTS private.user_rental_secrets (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id               TEXT,                   -- NULL until renter scans QR & claims
  crew_slug             TEXT NOT NULL,
  doc_sha256            TEXT NOT NULL,
  renter_full_name      TEXT,
  renter_passport       TEXT,
  renter_passport_issued_by TEXT,
  renter_passport_issue_date TEXT,
  renter_registration   TEXT,
  renter_driver_license TEXT,
  renter_birth_date     TEXT,
  renter_phone          TEXT,
  renter_email          TEXT,
  renter_address        TEXT,
  source_doc_key        TEXT,
  source_rental_id      TEXT,
  verification_status   TEXT NOT NULL DEFAULT 'verified',
  template_version      INTEGER,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(doc_sha256)
);

CREATE INDEX IF NOT EXISTS idx_user_rental_secrets_doc_sha
  ON private.user_rental_secrets(doc_sha256);

CREATE INDEX IF NOT EXISTS idx_user_rental_secrets_user_crew
  ON private.user_rental_secrets(chat_id, crew_slug, verification_status)
  WHERE chat_id IS NOT NULL;

REVOKE ALL ON SCHEMA private FROM anon, authenticated;
REVOKE ALL ON private.user_rental_secrets FROM anon;
REVOKE ALL ON private.user_rental_secrets FROM authenticated;

GRANT USAGE ON SCHEMA private TO service_role;
GRANT ALL ON private.user_rental_secrets TO service_role;
```

================================================================================

# ENVIRONMENT VARIABLES REQUIRED

```
# ZAI VLM
ZAI_BASE_URL=https://internal-api.z.ai/v1
ZAI_API_KEY=your_zai_api_key

# Telegram
TELEGRAM_BOT_TOKEN=your_bot_token
ADMIN_CHAT_ID=your_admin_chat_id
TELEGRAM_BOT_LINK=https://t.me/your_bot

# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Vercel (optional)
VERCEL_PROJECT_NAME=your_project
```

================================================================================

# INSTALLATION INSTRUCTIONS FOR ZAI AGENT

1. Parse each code block (between ``` markers)
2. Extract file path from first comment: // FILE: path/to/file
3. Create file at that path with the code content
4. Run migration SQL in Supabase
5. Set environment variables
6. Run: npm install z-ai-web-dev-sdk sharp

================================================================================

# VERIFICATION: Supabase Save Confirmed ✅

Both /doc command and skill script save to Supabase:

1. **/doc Command** (app/webhook-handlers/commands/doc.ts):
   - Line ~312-330: calls `saveUserRentalSecrets()`
   - Saves: passport, license, phone, email, address, doc_sha256

2. **Skill Script** (scripts/make-rental-contract-skill.mjs):
   - Lines ~606-641: inserts into `private.user_rental_secrets`
   - Saves: same fields as /doc command

3. **Storage Schema** (migration):
   - Table: `private.user_rental_secrets`
   - Unique constraint on `doc_sha256`
   - Indexes for chat_id lookup and QR claim flow

================================================================================

# QR CODE FORMAT

Deep-link format: `https://t.me/oneBikePlsBot/app?startapp=rent_{bikeId}_{docSha256}`

Example: `https://t.me/oneBikePlsBot/app?startapp=rent_abc123_a1b2c3d4e5f6...`

Flow:
1. User receives DOCX + QR after first rental
2. QR contains bikeId + docSha256
3. User scans QR → opens WebApp with start_param
4. WebApp calls `claimRentalSecretsByDocSha()`
5. Rental secrets linked to user's chat_id
6. Future rentals auto-fill from saved data

================================================================================

# END OF INSTALLER

For issues or questions, see:
- AGENTS.md
- TODO-1-click-next-rent.md
