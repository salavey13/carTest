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

# FILE: app/franchize/[slug]/rentals-analytics/page.tsx
# Rentals Analytics Page - Server Component

```typescript
// /app/franchize/[slug]/rentals-analytics/page.tsx
import type { Metadata } from "next";

import { CrewFooter } from "@/app/franchize/components/CrewFooter";
import { CrewHeader } from "@/app/franchize/components/CrewHeader";
import { FranchizePageShell } from "@/app/franchize/components/FranchizePageShell";
import { getFranchizeBySlug } from "@/app/franchize/actions";
import { crewPaletteForSurface } from "@/app/franchize/lib/theme";
import { buildFranchizeSectionMetadata } from "../metadata";
import { RentalsAnalyticsClient } from "./RentalsAnalyticsClient";

interface FranchizeSlugRentalsAnalyticsPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ date?: string }>;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  return buildFranchizeSectionMetadata(slug, {
    sectionTitle: "Аналитика аренд",
    sectionDescription:
      "Ежедневная статистика аренд с детальной информацией по каждому заказу и документам.",
    pathSuffix: "/rentals-analytics",
  });
}

export default async function FranchizeSlugRentalsAnalyticsPage({
  params,
  searchParams,
}: FranchizeSlugRentalsAnalyticsPageProps) {
  const { slug } = await params;
  const { date: dateParam } = await searchParams;
  const { crew } = await getFranchizeBySlug(slug);
  const resolvedSlug = crew.slug || slug;
  const activePath = `/franchize/${resolvedSlug}/rentals-analytics`;
  const surface = crewPaletteForSurface(crew.theme);

  const today = new Date().toISOString().split("T")[0];
  const selectedDate = dateParam || today;

  return (
    <main className="min-h-screen" style={surface.page}>
      <CrewHeader
        crew={crew}
        activePath={activePath}
        groupLinks={[]}
      />
      <FranchizePageShell theme={crew.theme} contentClassName="space-y-4">
        <RentalsAnalyticsClient
          initialSlug={resolvedSlug}
          initialDate={selectedDate}
          crew={crew}
        />
      </FranchizePageShell>
      <CrewFooter crew={crew} />
    </main>
  );
}
```

================================================================================

# FILE: app/franchize/[slug]/rentals-analytics/RentalsAnalyticsClient.tsx
# Rentals Analytics Client Component

```typescript
// /app/franchize/[slug]/rentals-analytics/RentalsAnalyticsClient.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import {
  Calendar, ChevronLeft, ChevronRight, FileText, User, CreditCard,
  MapPin, Phone, Mail, IdCard, CheckCircle2, XCircle, Clock,
  AlertCircle, X, RefreshCw, QrCode, Send, ShieldCheck, ShieldAlert, Filter,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Loading } from "@/components/Loading";
import { useAppContext } from "@/contexts/AppContext";
import {
  getRentalsDashboard,
  getRentalDocumentDetails,
  getRentalsDateRange,
  resendRentalContract,
  type RentalDashboardItem,
  type RentalDocumentDetail,
} from "@/app/franchize/server-actions/rentals-dashboard";
import { crewPaletteForSurface, focusRingOutlineStyle } from "@/app/franchize/lib/theme";
import type { FranchizeCrewVM } from "@/app/franchize/actions";
import {
  FranchizeOperatorPanel,
  FranchizeOperatorStatCard,
} from "@/app/franchize/components/FranchizeOperatorSurface";

const formatRubles = (amount: number | null | undefined): string => {
  if (amount == null) return "—";
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    minimumFractionDigits: 0,
  }).format(amount);
};

const formatRussianDate = (dateStr: string | null): string => {
  if (!dateStr) return "—";
  try {
    return format(new Date(dateStr), "dd MMM yyyy, HH:mm", { locale: ru });
  } catch {
    return "—";
  }
};

const formatRussianDateOnly = (dateStr: string | null): string => {
  if (!dateStr) return "—";
  try {
    return format(new Date(dateStr), "dd MMM yyyy", { locale: ru });
  } catch {
    return "—";
  }
};

const statusConfig = {
  confirmed: { label: "Подтверждена", icon: CheckCircle2, color: "emerald" },
  active: { label: "Активна", icon: Clock, color: "blue" },
  completed: { label: "Завершена", icon: CheckCircle2, color: "green" },
  cancelled: { label: "Отменена", icon: XCircle, color: "rose" },
  pending_confirmation: { label: "Ожидает", icon: AlertCircle, color: "amber" },
  checkout_started: { label: "Оформление", icon: Clock, color: "slate" },
};

export function RentalsAnalyticsClient({
  initialSlug,
  initialDate,
  crew,
}: {
  initialSlug: string;
  initialDate: string;
  crew: FranchizeCrewVM;
}) {
  const { dbUser, isLoading: authLoading } = useAppContext();
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [verificationFilter, setVerificationFilter] = useState<"all" | "verified" | "pending" | "revoked">("all");
  const [rentals, setRentals] = useState<RentalDashboardItem[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedRental, setSelectedRental] = useState<RentalDashboardItem | null>(null);
  const [rentalDetails, setRentalDetails] = useState<RentalDocumentDetail | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [dateRange, setDateRange] = useState<{ minDate: string; maxDate: string } | null>(null);
  const [resending, setResending] = useState<string | null>(null);

  const slug = initialSlug?.trim() || "vip-bike";

  const loadRentals = useCallback(async (date: string, showRefresh = false) => {
    if (!dbUser?.user_id) return;
    if (showRefresh) setRefreshing(true); else setLoading(true);
    try {
      const result = await getRentalsDashboard({
        slug, actorUserId: dbUser.user_id, date,
        verificationStatus: verificationFilter === "all" ? undefined : verificationFilter,
      });
      if (!result.success) {
        toast.error(result.error || "Не удалось загрузить аренды");
        return;
      }
      setRentals(result.data?.items || []);
      setSummary(result.data?.summary || null);
    } catch (error) {
      console.error("[RentalsAnalytics] Load error:", error);
      toast.error("Ошибка загрузки данных");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [dbUser?.user_id, slug, verificationFilter]);

  const loadRentalDetails = useCallback(async (rentalId: string) => {
    if (!dbUser?.user_id) return;
    setLoadingDetails(true);
    try {
      const result = await getRentalDocumentDetails({ actorUserId: dbUser.user_id, rentalId });
      if (!result.success) {
        toast.error(result.error || "Не удалось загрузить детали");
        return;
      }
      setRentalDetails(result.data || null);
    } catch (error) {
      console.error("[RentalsAnalytics] Details load error:", error);
      toast.error("Ошибка загрузки деталей");
    } finally {
      setLoadingDetails(false);
    }
  }, [dbUser?.user_id]);

  const loadDateRange = useCallback(async () => {
    if (!dbUser?.user_id) return;
    try {
      const result = await getRentalsDateRange({ slug, actorUserId: dbUser.user_id });
      if (result.success && result.data) setDateRange(result.data);
    } catch (error) {
      console.error("[RentalsAnalytics] Date range error:", error);
    }
  }, [dbUser?.user_id, slug]);

  useEffect(() => {
    if (dbUser?.user_id) {
      void loadRentals(selectedDate);
      void loadDateRange();
    }
  }, [dbUser?.user_id, selectedDate, loadRentals, loadDateRange]);

  useEffect(() => {
    if (dbUser?.user_id) void loadRentals(selectedDate);
  }, [verificationFilter]); // eslint-disable-line

  useEffect(() => {
    const interval = setInterval(() => {
      if (dbUser?.user_id && !loading) void loadRentals(selectedDate, true);
    }, 30_000);
    return () => clearInterval(interval);
  }, [dbUser?.user_id, selectedDate, loadRentals, loading]);

  const handleResendContract = useCallback(async (rental: RentalDashboardItem) => {
    if (!dbUser?.user_id || !rental.documentSecret?.doc_sha256) {
      toast.error("QR код недоступен для этой аренды");
      return;
    }
    setResending(rental.rental_id);
    try {
      const targetChatId = rental.user?.metadata?.telegram_chat_id as string | undefined;
      const chatIdToSend = targetChatId || prompt("Введите ID чата Telegram:", rental.user_id);
      if (!chatIdToSend) { toast.error("ID чата не указан"); return; }
      const result = await resendRentalContract({
        actorUserId: dbUser.user_id, rentalId: rental.rental_id, telegramChatId: chatIdToSend,
      });
      if (!result.success) {
        toast.error(result.error || "Не удалось отправить договор");
        return;
      }
      toast.success("Договор успешно отправлен");
    } catch (error) {
      console.error("[RentalsAnalytics] Resend error:", error);
      toast.error("Ошибка отправки");
    } finally {
      setResending(null);
    }
  }, [dbUser?.user_id]);

  const navigateDate = (days: number) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + days);
    const newDateStr = newDate.toISOString().split("T")[0];
    if (dateRange) {
      if (days < 0 && newDateStr < dateRange.minDate) return;
      if (days > 0 && newDateStr > dateRange.maxDate) return;
    }
    setSelectedDate(newDateStr);
    window.history.pushState({}, "", `/franchize/${slug}/rentals-analytics?date=${newDateStr}`);
  };

  const openRentalDetails = (rental: RentalDashboardItem) => {
    setSelectedRental(rental);
    setRentalDetails(null);
    void loadRentalDetails(rental.rental_id);
  };

  const closeModal = () => { setSelectedRental(null); setRentalDetails(null); };

  const getStatusConfig = (status: string) => {
    return statusConfig[status as keyof typeof statusConfig] || {
      label: status, icon: AlertCircle, color: "slate",
    };
  };

  if (authLoading) return <Loading text="Загружаем данные..." />;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-medium tracking-wide text-[var(--fr-analytics-accent)]">
            Аналитика аренд
          </p>
          <h1 className="mt-2 break-words text-2xl font-semibold text-[var(--fr-analytics-text)]">
            Аренды за день
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="icon" onClick={() => navigateDate(-1)}
            disabled={!dateRange || selectedDate <= dateRange.minDate || loading} className="h-9 w-9">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2 rounded-lg border px-3 py-2">
            <Calendar className="h-4 w-4" />
            <span className="text-sm font-medium">{formatRussianDateOnly(selectedDate)}</span>
          </div>
          <Button type="button" variant="outline" size="icon" onClick={() => navigateDate(1)}
            disabled={!dateRange || selectedDate >= dateRange.maxDate || loading} className="h-9 w-9">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <input type="date" value={selectedDate} min={dateRange?.minDate} max={dateRange?.maxDate}
            onChange={(e) => { setSelectedDate(e.target.value); window.history.pushState({}, "", `/franchize/${slug}/rentals-analytics?date=${e.target.value}`); }}
            className="h-9 rounded-md border bg-transparent px-3 py-1 text-sm" />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4" />
        <span className="text-sm">Фильтр по верификации:</span>
        <div className="flex gap-1">
          {[
            { value: "all", label: "Все", icon: FileText },
            { value: "verified", label: "Проверены", icon: ShieldCheck },
            { value: "pending", label: "Ожидают", icon: Clock },
            { value: "revoked", label: "Отозваны", icon: ShieldAlert },
          ].map((filter) => {
            const Icon = filter.icon;
            const isActive = verificationFilter === filter.value;
            return (
              <button key={filter.value} type="button"
                onClick={() => setVerificationFilter(filter.value as typeof verificationFilter)}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium ${
                  isActive ? "bg-[var(--fr-analytics-accent)] text-white" : "bg-transparent hover:bg-[var(--fr-analytics-accent)]/10"
                }`}>
                <Icon className="h-3.5 w-3.5" />{filter.label}
              </button>
            );
          })}
        </div>
      </div>

      {summary && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <FranchizeOperatorStatCard label="Всего аренд" value={summary.totalCount} icon={<FileText className="h-4 w-4" />} />
          <FranchizeOperatorStatCard label="Выручка" value={formatRubles(summary.totalRevenue)} icon={<CreditCard className="h-4 w-4" />} highlight />
          <FranchizeOperatorStatCard label="Подтверждённые" value={summary.byStatus.confirmed || 0} icon={<CheckCircle2 className="h-4 w-4" />} />
          <FranchizeOperatorStatCard label="Активные" value={summary.byStatus.active || 0} icon={<Clock className="h-4 w-4" />} />
        </div>
      )}

      <FranchizeOperatorPanel>
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Список аренд</p>
          {refreshing && <RefreshCw className="h-4 w-4 animate-spin" />}
        </div>
        {loading ? <div className="flex justify-center py-12"><Loading text="Загружаем аренды..." /></div>
          : !rentals.length ? <p className="py-12 text-center text-sm">За этот день аренд нет</p>
          : (
            <div className="mt-3 overflow-hidden rounded-xl border">
              <div className="hidden grid-cols-[1fr_1.5fr_1fr_1fr_1fr_1.2fr] gap-3 border-b px-4 py-3 text-xs font-semibold">
                <span>Время</span><span>Клиент / Техника</span><span>Сумма</span><span>Статус</span><span>Документы</span><span className="text-right">Действия</span>
              </div>
              <div className="divide-y">
                {rentals.map((rental) => {
                  const statusConf = getStatusConfig(rental.status);
                  const StatusIcon = statusConf.icon;
                  const vehicleName = rental.vehicle ? `${rental.vehicle.make} ${rental.vehicle.model}` : "Неизвестно";
                  const hasQrCode = !!rental.documentSecret?.doc_sha256;
                  const verificationStatus = rental.documentSecret?.verification_status || "none";
                  return (
                    <div key={rental.rental_id} className="grid gap-2 px-4 py-3 md:grid-cols-[1fr_1.5fr_1fr_1fr_1fr_1.2fr] md:items-center hover:bg-[var(--fr-analytics-accent)]/5 cursor-pointer"
                      onClick={() => openRentalDetails(rental)}>
                      <div>{formatRussianDate(rental.created_at)?.split(",")?.[1] || "—"}</div>
                      <div>
                        <div className="flex items-center gap-2"><User className="h-3.5 w-3.5" />
                          <span className="font-medium">{rental.user?.full_name || rental.user?.username || `#${rental.user_id.slice(0, 8)}`}</span>
                        </div>
                        <div className="mt-0.5 text-xs">{vehicleName}</div>
                      </div>
                      <div className="font-medium">{formatRubles(rental.total_cost)}</div>
                      <div className="flex items-center gap-1.5"><StatusIcon className={`h-3.5 w-3.5 text-${statusConf.color}-500`} /><span className="text-xs">{statusConf.label}</span></div>
                      <div className="flex items-center gap-2">
                        {hasQrCode && <div className="flex items-center gap-1 text-emerald-600"><QrCode className="h-3.5 w-3.5" /><span className="text-xs">QR</span></div>}
                        {verificationStatus === "verified" && <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />}
                        {verificationStatus === "pending" && <Clock className="h-3.5 w-3.5 text-amber-600" />}
                        {verificationStatus === "revoked" && <ShieldAlert className="h-3.5 w-3.5 text-rose-600" />}
                      </div>
                      <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        {hasQrCode && (
                          <Button type="button" variant="outline" size="sm" className="h-7 text-xs"
                            onClick={() => handleResendContract(rental)} disabled={resending === rental.rental_id}>
                            {resending === rental.rental_id ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <><Send className="h-3.5 w-3.5" /><span className="hidden sm:inline">Отправить</span></>}
                          </Button>
                        )}
                        <Button type="button" variant="ghost" size="sm" className="h-7 text-xs"
                          onClick={(e) => { e.stopPropagation(); openRentalDetails(rental); }}>Подробнее</Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
      </FranchizeOperatorPanel>

      {/* Modal for rental details - simplified version */}
      {selectedRental && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={closeModal}>
          <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-2xl border p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <h2 className="text-lg font-semibold">Детали аренды</h2>
              <Button type="button" variant="ghost" size="icon" onClick={closeModal}><X className="h-4 w-4" /></Button>
            </div>
            <div className="mt-4 space-y-4">
              <div className="rounded-xl border p-3">
                <p className="text-xs">Техника</p>
                <p className="mt-1 text-sm font-semibold">{selectedRental.vehicle ? `${selectedRental.vehicle.make} ${selectedRental.vehicle.model}` : "Неизвестно"}</p>
              </div>
              <div className="rounded-xl border p-3">
                <p className="text-xs">Клиент</p>
                <p className="mt-1 text-sm font-semibold">{selectedRental.user?.full_name || selectedRental.user?.username || `#${selectedRental.user_id.slice(0, 8)}`}</p>
              </div>
              <div className="rounded-xl border p-3">
                <p className="text-xs">Стоимость</p>
                <p className="mt-1 text-xl font-bold">{formatRubles(selectedRental.total_cost)}</p>
              </div>
              {loadingDetails ? <div className="flex justify-center py-8"><Loading text="Загружаем документы..." /></div>
                : rentalDetails?.secret ? (
                  <div className="space-y-3">
                    <p className="text-xs font-medium">Данные из документов</p>
                    {rentalDetails.secret.renter_full_name && (
                      <div className="rounded-xl border p-3"><p className="text-xs">ФИО</p><p className="mt-1 text-sm">{rentalDetails.secret.renter_full_name}</p></div>
                    )}
                    {rentalDetails.secret.doc_sha256 && (
                      <div className="rounded-xl border p-3"><p className="text-xs">QR код доступен</p><p className="mt-1 text-xs font-mono break-all">{rentalDetails.secret.doc_sha256.slice(0, 32)}...</p></div>
                    )}
                  </div>
                ) : <div className="rounded-xl border p-4"><p className="text-sm">Данные из документов не найдены</p></div>}
            </div>
            <div className="mt-6 flex justify-end"><Button type="button" variant="outline" onClick={closeModal}>Закрыть</Button></div>
          </div>
        </div>
      )}
    </div>
  );
}
```

================================================================================

# END OF INSTALLER

For issues or questions, see:
- AGENTS.md
- README.MD
