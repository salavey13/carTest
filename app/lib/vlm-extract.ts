/**
 * VIP Bike Rental — VLM Document Extraction Service
 *
 * Server-only module that uses ZAI VLM (Vision Language Model) to extract
 * structured data from Russian passport and driver's license photos.
 *
 * VLM-ONLY extraction path (Tesseract.js removed — client uses ZAI API key).
 * VLM provides significantly better accuracy on real-world photos with
 * shadows, rotation, glare, and mixed passport/license layouts.
 *
 * Architecture:
 *   Photo (base64) → ZAI VLM chat completion → strict JSON → validation → PassportOcrResult | LicenseOcrResult
 *
 * No client imports. Server-only (uses "server-only" guard + env vars).
 *
 * Code review notes:
 *   - Uses zai.chat.completions.create() (standard vision-capable chat API)
 *     NOT createVision (that method doesn't exist in the SDK)
 *   - 25s AbortController timeout to stay within Vercel's 30s maxDuration
 *   - Multi-step /doc flow splits VLM calls across separate webhook messages,
 *     so each photo extraction gets its own request lifecycle (~5-8s each),
 *     comfortably within Vercel's 10s default function timeout
 */

import "server-only";
import ZAI from "z-ai-web-dev-sdk";
import { logger } from "@/lib/logger";
import type { PassportOcrResult, LicenseOcrResult, AccessTier } from "./ocr-constants";
import { deriveUserAccessTier } from "./derive-access-tier";

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface VlmExtractResult {
  success: boolean;
  provider: "zai-vlm";
  data?: PassportOcrResult | LicenseOcrResult;
  accessTier?: AccessTier;
  confidence?: number;
  warnings?: string[];
  errors?: string[];
  error?: string;
}

// ─── ZAI VLM Singleton ─────────────────────────────────────────────────────────

let _zaiInstance: Awaited<ReturnType<typeof ZAI.create>> | null = null;

async function getZai(): Promise<ReturnType<typeof ZAI.create>> {
  if (!_zaiInstance) {
    _zaiInstance = await ZAI.create();
  }
  return _zaiInstance;
}

// ─── Timeout for VLM calls ────────────────────────────────────────────────────
// Vercel default function timeout is 10s; maxDuration can go up to 30s on Pro.
// We set a 25s abort to leave headroom for response handling.
const VLM_TIMEOUT_MS = 25_000;

// ─── Prompt Templates ───────────────────────────────────────────────────────────

const PASSPORT_SYSTEM_PROMPT = `You are a precise document data extraction system for Russian internal passports.
Your task is to extract specific fields from a photo of a Russian passport's main page (the page with photo and personal data).
Return ONLY valid JSON matching the schema below. Do NOT wrap in markdown or code fences.
If a field is unreadable or not found, use an empty string "".
Do NOT invent or guess any data.

Required JSON shape:
{
  "fullName": "LASTNAME FIRSTNAME PATRONYMIC (all caps, space-separated)",
  "birthDate": "DD.MM.YYYY",
  "series": "4 digits",
  "number": "6 digits",
  "issuedBy": "Issuing authority text",
  "issueDate": "DD.MM.YYYY",
  "divisionCode": "XXX-XXX",
  "birthPlace": "Place of birth",
  "registration": "Registration address (if visible, otherwise empty)",
  "gender": "М or Ж",
  "confidence": 0.0,
  "warnings": []
}

Rules:
- fullName: combine ФАМИЛИЯ, ИМЯ, ОТЧЕСТВО into one string
- series: first 4 digits of passport number (10-digit: series is first 4)
- number: last 6 digits of passport number
- birthDate: DD.MM.YYYY format
- issueDate: DD.MM.YYYY format
- divisionCode: 3 digits dash 3 digits
- confidence: your confidence level 0.0-1.0 for the overall extraction
- warnings: array of strings noting any fields that may be inaccurate`;

const LICENSE_SYSTEM_PROMPT = `You are a precise document data extraction system for Russian driver's licenses.
Your task is to extract specific fields from a photo of a Russian driver's license (водительское удостоверение).
Return ONLY valid JSON matching the schema below. Do NOT wrap in markdown or code fences.
If a field is unreadable or not found, use an empty string "".
Do NOT invent or guess any data.

Required JSON shape:
{
  "fullName": "LASTNAME FIRSTNAME PATRONYMIC (all caps, space-separated)",
  "series": "2+2 digits (e.g. '99 76')",
  "number": "6 digits",
  "issueDate": "DD.MM.YYYY",
  "expiryDate": "DD.MM.YYYY",
  "categories": ["A", "B", "M"],
  "categoryDates": ["DD.MM.YYYY"],
  "confidence": 0.0,
  "warnings": []
}

Rules:
- fullName: combine ФАМИЛИЯ, ИМЯ, ОТЧЕСТВО into one string
- series: 4 digits, can be shown as "99 76" (space in middle) or "9976"
- number: 6 digits
- categories: array of license categories found: A, A1, B, B1, C, C1, D, D1, M, Tm, Tb, BE, CE, DE
- categoryDates: dates when each category was granted (parallel array to categories), use DD.MM.YYYY or empty string
- confidence: your confidence level 0.0-1.0 for the overall extraction
- warnings: array of strings noting any fields that may be inaccurate
- CRITICAL: Categories are the most important field — extract ALL visible categories accurately`;

const PASSPORT_USER_PROMPT = `Extract all fields from this Russian passport photo. Return strict JSON only.`;

const LICENSE_USER_PROMPT = `Extract all fields from this Russian driver's license photo. Pay special attention to the vehicle categories (категории ТС) — extract ALL of them accurately. Return strict JSON only.`;

// ─── Safe JSON Extraction ───────────────────────────────────────────────────────

/**
 * Safely extract JSON from VLM response text.
 * Handles: markdown code fences, leading/trailing text, etc.
 */
function safeJsonParse(raw: string): Record<string, unknown> | null {
  if (!raw || typeof raw !== "string") return null;

  // Try direct parse first
  try {
    return JSON.parse(raw.trim());
  } catch {
    // Continue to extraction attempts
  }

  // Try extracting from markdown code fences: ```json ... ```
  const fenceMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1].trim());
    } catch {
      // Continue
    }
  }

  // Try finding the outermost { ... } brace pair
  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(raw.slice(firstBrace, lastBrace + 1));
    } catch {
      // Continue
    }
  }

  return null;
}

// ─── Validation ─────────────────────────────────────────────────────────────────

function validatePassportResult(data: Record<string, unknown>): {
  valid: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];

  // Series must be 4 digits
  const series = String(data.series || "");
  if (series && !/^\d{4}$/.test(series)) {
    warnings.push(`passport series "${series}" is not 4 digits`);
  }

  // Number must be 6 digits
  const number = String(data.number || "");
  if (number && !/^\d{6}$/.test(number)) {
    warnings.push(`passport number "${number}" is not 6 digits`);
  }

  // Birth date format
  const bd = String(data.birthDate || "");
  if (bd && !/^\d{2}\.\d{2}\.\d{4}$/.test(bd)) {
    warnings.push(`birth date "${bd}" not in DD.MM.YYYY format`);
  }

  // FullName should have at least 2 words
  const fn = String(data.fullName || "");
  if (fn && fn.split(/\s+/).length < 2) {
    warnings.push(`fullName "${fn}" seems incomplete (expected at least 2 words)`);
  }

  return { valid: warnings.length === 0, warnings };
}

function validateLicenseResult(data: Record<string, unknown>): {
  valid: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];

  // Series must be 4 digits (may have space in middle)
  const series = String(data.series || "").replace(/\s/g, "");
  if (series && !/^\d{4}$/.test(series)) {
    warnings.push(`license series "${series}" is not 4 digits`);
  }

  // Number must be 6 digits
  const number = String(data.number || "");
  if (number && !/^\d{6}$/.test(number)) {
    warnings.push(`license number "${number}" is not 6 digits`);
  }

  // Categories must be an array
  if (data.categories !== undefined && !Array.isArray(data.categories)) {
    warnings.push("categories is not an array — converting");
    data.categories = [];
  }

  // Validate individual category values
  if (Array.isArray(data.categories)) {
    const validCats = ["A", "A1", "B", "B1", "C", "C1", "D", "D1", "M", "Tm", "Tb", "BE", "CE", "DE"];
    const filtered = (data.categories as string[]).filter((c) => validCats.includes(String(c).toUpperCase()));
    if (filtered.length !== (data.categories as string[]).length) {
      warnings.push(`some categories were invalid and filtered out`);
    }
    data.categories = filtered.map((c) => String(c).toUpperCase());
  }

  return { valid: warnings.length === 0, warnings };
}

// ─── PII Masking for Logs ──────────────────────────────────────────────────────

function maskPii(data: Record<string, unknown>): Record<string, unknown> {
  const masked = { ...data };

  if (masked.fullName) {
    const parts = String(masked.fullName).split(/\s+/);
    masked.fullName = parts.map((p: string, i: number) =>
      i === 0 ? `${p[0]}***` : `${p[0]}.`
    ).join(" ");
  }

  if (masked.series) {
    const s = String(masked.series);
    masked.series = s.slice(0, 2) + "**";
  }

  if (masked.number) {
    const n = String(masked.number);
    masked.number = "****" + n.slice(-2);
  }

  return masked;
}

// ─── Main Extraction Function ───────────────────────────────────────────────────

/**
 * Extract structured data from a document photo using ZAI VLM.
 *
 * @param imageBase64 - Base64-encoded image (with or without data: prefix)
 * @param docType     - "passport" or "license"
 * @returns VlmExtractResult with extracted data or error
 */
export async function vlmExtractDocument(
  imageBase64: string,
  docType: "passport" | "license",
): Promise<VlmExtractResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), VLM_TIMEOUT_MS);

  try {
    const zai = await getZai();

    // Normalize base64: strip data URL prefix if present
    const base64Clean = imageBase64.replace(/^data:[^;]+;base64,/, "");

    // Detect MIME type from base64 header or default to JPEG
    const mimeType = detectMimeType(base64Clean);
    const dataUrl = `data:${mimeType};base64,${base64Clean}`;

    // Select prompts based on document type
    const systemPrompt = docType === "passport" ? PASSPORT_SYSTEM_PROMPT : LICENSE_SYSTEM_PROMPT;
    const userPrompt = docType === "passport" ? PASSPORT_USER_PROMPT : LICENSE_USER_PROMPT;

    // Call ZAI VLM via standard chat.completions.create (NOT createVision — that doesn't exist)
    // The vision capability is built into chat.completions via multimodal content blocks
    const response = await zai.chat.completions.create({
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
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
      logger.warn("[vlm-extract] VLM returned empty content", { docType });
      return {
        success: false,
        provider: "zai-vlm",
        error: "VLM returned empty response",
      };
    }

    // Parse the JSON response
    const parsed = safeJsonParse(rawContent);

    if (!parsed) {
      logger.warn("[vlm-extract] Failed to parse VLM JSON response", {
        docType,
        rawLength: rawContent.length,
        rawPreview: rawContent.slice(0, 200),
      });
      return {
        success: false,
        provider: "zai-vlm",
        error: "Failed to parse VLM JSON response",
      };
    }

    // Extract confidence and warnings from VLM response
    const vlmConfidence = typeof parsed.confidence === "number" ? parsed.confidence : 0.7;
    const vlmWarnings = Array.isArray(parsed.warnings)
      ? (parsed.warnings as string[]).filter((w) => typeof w === "string")
      : [];

    // Remove VLM metadata fields from the data
    delete parsed.confidence;
    delete parsed.warnings;

    // Validate extracted fields
    const validation = docType === "passport"
      ? validatePassportResult(parsed)
      : validateLicenseResult(parsed);

    const allWarnings = [...vlmWarnings, ...validation.warnings];

    // Log masked result for debugging
    logger.info("[vlm-extract] Extraction complete", {
      docType,
      confidence: vlmConfidence,
      warnings: allWarnings,
      maskedData: maskPii(parsed),
    });

    // Build result
    const result: VlmExtractResult = {
      success: true,
      provider: "zai-vlm",
      data: parsed as PassportOcrResult | LicenseOcrResult,
      confidence: vlmConfidence,
      warnings: allWarnings.length > 0 ? allWarnings : undefined,
    };

    // For license type, derive access tier from categories
    if (docType === "license") {
      const categories = (parsed as Record<string, unknown>).categories as string[] || [];
      result.accessTier = deriveUserAccessTier(categories);
    }

    return result;
  } catch (error) {
    // Distinguish abort/timeout from other errors
    if (error instanceof Error && error.name === "AbortError") {
      logger.error("[vlm-extract] VLM call timed out", { docType, timeoutMs: VLM_TIMEOUT_MS });
      return {
        success: false,
        provider: "zai-vlm",
        error: `VLM extraction timed out after ${VLM_TIMEOUT_MS / 1000}s`,
      };
    }

    logger.error("[vlm-extract] VLM extraction failed", {
      docType,
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      success: false,
      provider: "zai-vlm",
      error: error instanceof Error ? error.message : "Unknown VLM error",
    };
  } finally {
    clearTimeout(timeout);
  }
}

// ─── Utility ────────────────────────────────────────────────────────────────────

/**
 * Detect MIME type from base64-encoded image data.
 * Checks the first few bytes for known magic numbers.
 */
function detectMimeType(base64: string): string {
  try {
    const header = Buffer.from(base64.slice(0, 16), "base64").toString("hex").toUpperCase();

    if (header.startsWith("FFD8")) return "image/jpeg";
    if (header.startsWith("89504E47")) return "image/png";
    if (header.startsWith("52494646")) return "image/webp";
    if (header.startsWith("424D")) return "image/bmp";
    if (header.startsWith("49492A00") || header.startsWith("4D4D002A")) return "image/tiff";
  } catch {
    // Fallback
  }

  return "image/jpeg"; // Default — most common for phone photos
}