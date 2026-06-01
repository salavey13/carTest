/**
 * VIP Bike Rental — OCR API Endpoint (Tesseract.js)
 *
 * POST /api/ocr
 * Accepts a base64-encoded image and a type ("passport" | "license"),
 * runs Tesseract.js OCR with Russian language support, then parses
 * the raw text into structured JSON using regex/positional heuristics.
 *
 * Zero cost, fully local, deterministic.
 * No VLM / API calls needed — Russian passports and driver's licenses
 * have fixed, well-known structures.
 *
 * Reusable by both the Telegram bot `/doc` command and the web-app checkout flow.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  type PassportOcrResult,
  type LicenseOcrResult,
  type AccessTier,
  OCR_MIN_CONFIDENCE,
  OCR_MAX_IMAGE_SIZE,
  OCR_SUPPORTED_MIME_TYPES,
  TESSERACT_LANG,
  OCR_VALIDATION,
  // Passport regexes
  PASSPORT_SERIES_NUMBER_RE,
  PASSPORT_FULLNAME_RE,
  PASSPORT_FULLNAME_FLAT_RE,
  PASSPORT_BIRTHDATE_RE,
  PASSPORT_GENDER_RE,
  PASSPORT_BIRTHPLACE_RE,
  PASSPORT_ISSUED_BY_RE,
  PASSPORT_ISSUE_DATE_RE,
  PASSPORT_DIVISION_CODE_RE,
  PASSPORT_REGISTRATION_RE,
  // License regexes
  LICENSE_SERIES_NUMBER_RE,
  LICENSE_FULLNAME_RE,
  LICENSE_FULLNAME_FLAT_RE,
  LICENSE_ISSUE_DATE_RE,
  LICENSE_EXPIRY_DATE_RE,
  LICENSE_CATEGORIES_RE,
  SINGLE_CATEGORY_RE,
  LICENSE_CATEGORY_DATE_RE,
} from "@/app/lib/ocr-constants";
import { deriveUserAccessTier } from "@/app/lib/derive-access-tier";

export const runtime = "nodejs";
export const maxDuration = 30; // Tesseract can be slow on large images

// ─── Request / Response Types ─────────────────────────────────────────────────

interface OcrRequest {
  image: string; // base64-encoded
  type: "passport" | "license";
}

interface OcrResponse {
  success: boolean;
  data?: PassportOcrResult | LicenseOcrResult;
  accessTier?: AccessTier; // for license type only
  rawText?: string; // for debugging
  confidence?: number;
  errors?: string[];
  error?: string;
}

// ─── Main Handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse<OcrResponse>> {
  try {
    const body = (await request.json()) as OcrRequest;
    const { image, type } = body;

    if (!image || !type) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: image, type" },
        { status: 400 },
      );
    }

    if (type !== "passport" && type !== "license") {
      return NextResponse.json(
        { success: false, error: 'Invalid type. Must be "passport" or "license"' },
        { status: 400 },
      );
    }

    // Decode base64 → Buffer
    const imageBuffer = decodeBase64Image(image);
    if (!imageBuffer) {
      return NextResponse.json(
        { success: false, error: "Invalid base64 image data" },
        { status: 400 },
      );
    }

    if (imageBuffer.length > OCR_MAX_IMAGE_SIZE) {
      return NextResponse.json(
        { success: false, error: `Image too large. Max ${OCR_MAX_IMAGE_SIZE / 1024 / 1024} MB` },
        { status: 400 },
      );
    }

    // Run Tesseract.js OCR
    const { text, confidence } = await runTesseractOcr(imageBuffer);

    if (confidence < OCR_MIN_CONFIDENCE) {
      return NextResponse.json({
        success: false,
        error: `OCR confidence too low (${confidence.toFixed(0)}%). Image may be unreadable.`,
        rawText: text,
        confidence,
      });
    }

    // Parse the raw text into structured data
    let parsed: PassportOcrResult | LicenseOcrResult;
    let parseErrors: string[];

    if (type === "passport") {
      const result = parsePassportText(text);
      parsed = result.data;
      parseErrors = result.errors;
    } else {
      const result = parseLicenseText(text);
      parsed = result.data;
      parseErrors = result.errors;
    }

    // Validate extracted fields
    const validationErrors = validateOcrResult(parsed, type);
    const allErrors = [...parseErrors, ...validationErrors];

    // Build response
    const response: OcrResponse = {
      success: allErrors.filter((e) => e.includes("required") || e.includes("missing")).length === 0,
      data: parsed,
      rawText: text,
      confidence,
      errors: allErrors.length > 0 ? allErrors : undefined,
    };

    // For license type, also derive the access tier
    if (type === "license") {
      const licenseData = parsed as LicenseOcrResult;
      response.accessTier = deriveUserAccessTier(licenseData.categories);
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("[/api/ocr] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown OCR error",
      },
      { status: 500 },
    );
  }
}

// ─── Tesseract.js OCR ────────────────────────────────────────────────────────

async function runTesseractOcr(
  imageBuffer: Buffer,
): Promise<{ text: string; confidence: number }> {
  // Dynamic import to avoid bundling Tesseract at build time if not installed
  let createWorker: typeof import("tesseract.js").createWorker;

  try {
    const tesseract = await import("tesseract.js");
    createWorker = tesseract.createWorker;
  } catch {
    throw new Error(
      "tesseract.js is not installed. Run: npm install tesseract.js",
    );
  }

  const worker = await createWorker(TESSERACT_LANG);

  try {
    const {
      data: { text, confidence },
    } = await worker.recognize(imageBuffer);

    return { text: text || "", confidence: confidence || 0 };
  } finally {
    await worker.terminate();
  }
}

// ─── Base64 Decoder ───────────────────────────────────────────────────────────

function decodeBase64Image(data: string): Buffer | null {
  try {
    // Strip data URL prefix if present: "data:image/jpeg;base64,..."
    const base64 = data.replace(/^data:[^;]+;base64,/, "");
    return Buffer.from(base64, "base64");
  } catch {
    return null;
  }
}

// ─── Passport Parser ──────────────────────────────────────────────────────────

function parsePassportText(
  rawText: string,
): { data: PassportOcrResult; errors: string[] } {
  const errors: string[] = [];
  const text = rawText;

  // ── Series + Number ──
  let series = "";
  let number = "";
  const seriesMatch = text.match(PASSPORT_SERIES_NUMBER_RE);
  if (seriesMatch) {
    series = seriesMatch[1] + seriesMatch[2]; // first 4 digits
    number = seriesMatch[3]; // last 6 digits
  } else {
    errors.push("series/number: не найдены серия и номер паспорта");
  }

  // ── Full Name ──
  let fullName = "";
  const nameLabeled = text.match(PASSPORT_FULLNAME_RE);
  if (nameLabeled) {
    fullName = `${nameLabeled[1]} ${nameLabeled[2]} ${nameLabeled[3]}`;
  } else {
    // Try flat pattern: 3 capitalized Russian words on one line
    const flatMatch = text.match(PASSPORT_FULLNAME_FLAT_RE);
    if (flatMatch) {
      fullName = `${flatMatch[1]} ${flatMatch[2]} ${flatMatch[3]}`;
    } else {
      errors.push("fullName: не удалось извлечь ФИО");
    }
  }

  // ── Birth Date ──
  const birthDateMatch = text.match(PASSPORT_BIRTHDATE_RE);
  const birthDate = birthDateMatch ? normalizeDate(birthDateMatch[1]) : "";

  // ── Gender ──
  const genderMatch = text.match(PASSPORT_GENDER_RE);
  const gender = genderMatch ? genderMatch[1] : "";

  // ── Birth Place ──
  const birthPlaceMatch = text.match(PASSPORT_BIRTHPLACE_RE);
  const birthPlace = birthPlaceMatch ? birthPlaceMatch[1].trim() : "";

  // ── Issued By ──
  const issuedByMatch = text.match(PASSPORT_ISSUED_BY_RE);
  const issuedBy = issuedByMatch ? issuedByMatch[1].trim() : "";

  // ── Issue Date ──
  const issueDateMatch = text.match(PASSPORT_ISSUE_DATE_RE);
  const issueDate = issueDateMatch ? normalizeDate(issueDateMatch[1]) : "";

  // ── Division Code ──
  const divisionMatch = text.match(PASSPORT_DIVISION_CODE_RE);
  const divisionCode = divisionMatch ? divisionMatch[1].replace(/\s/g, "-") : "";

  // ── Registration ──
  const registrationMatch = text.match(PASSPORT_REGISTRATION_RE);
  const registration = registrationMatch ? registrationMatch[1].trim() : "";

  return {
    data: {
      fullName,
      birthDate,
      series,
      number,
      issuedBy,
      issueDate,
      divisionCode,
      birthPlace,
      registration,
      gender,
    },
    errors,
  };
}

// ─── License Parser ───────────────────────────────────────────────────────────

function parseLicenseText(
  rawText: string,
): { data: LicenseOcrResult; errors: string[] } {
  const errors: string[] = [];
  const text = rawText;

  // ── Series + Number ──
  let series = "";
  let number = "";
  const seriesMatch = text.match(LICENSE_SERIES_NUMBER_RE);
  if (seriesMatch) {
    series = seriesMatch[1] + seriesMatch[2]; // first 4 digits
    number = seriesMatch[3]; // last 6 digits
  } else {
    errors.push("series/number: не найдены серия и номер ВУ");
  }

  // ── Full Name ──
  let fullName = "";
  const nameLabeled = text.match(LICENSE_FULLNAME_RE);
  if (nameLabeled) {
    fullName = `${nameLabeled[1]} ${nameLabeled[2]}`;
    // Try to get patronymic from the flat pattern
    const flatMatch = text.match(LICENSE_FULLNAME_FLAT_RE);
    if (flatMatch && flatMatch[3]) {
      fullName = `${flatMatch[1]} ${flatMatch[2]} ${flatMatch[3]}`;
    }
  } else {
    const flatMatch = text.match(LICENSE_FULLNAME_FLAT_RE);
    if (flatMatch) {
      fullName = `${flatMatch[1]} ${flatMatch[2]} ${flatMatch[3]}`;
    } else {
      errors.push("fullName: не удалось извлечь ФИО");
    }
  }

  // ── Issue Date ──
  const issueDateMatch = text.match(LICENSE_ISSUE_DATE_RE);
  const issueDate = issueDateMatch ? normalizeDate(issueDateMatch[1]) : "";

  // ── Expiry Date ──
  const expiryDateMatch = text.match(LICENSE_EXPIRY_DATE_RE);
  const expiryDate = expiryDateMatch ? normalizeDate(expiryDateMatch[1]) : "";

  // ── Categories ──
  let categories: string[] = [];
  let categoryDates: string[] = [];

  // Try labeled extraction first
  const catBlockMatch = text.match(LICENSE_CATEGORIES_RE);
  if (catBlockMatch) {
    const catBlock = catBlockMatch[1];
    let catMatch: RegExpExecArray | null;
    const singleCatRe = new RegExp(SINGLE_CATEGORY_RE.source, SINGLE_CATEGORY_RE.flags);
    while ((catMatch = singleCatRe.exec(catBlock)) !== null) {
      const cat = catMatch[1].toUpperCase();
      if (!categories.includes(cat)) {
        categories.push(cat);
      }
    }
  }

  // Also try category+date pairs: "A с 15.03.2020"
  let pairMatch: RegExpExecArray | null;
  const pairRe = new RegExp(LICENSE_CATEGORY_DATE_RE.source, LICENSE_CATEGORY_DATE_RE.flags);
  const pairedCats: string[] = [];
  const pairedDates: string[] = [];
  while ((pairMatch = pairRe.exec(text)) !== null) {
    const cat = pairMatch[1].toUpperCase();
    const date = normalizeDate(pairMatch[2]);
    if (!pairedCats.includes(cat)) {
      pairedCats.push(cat);
      pairedDates.push(date);
    }
  }

  // Merge: paired data is more reliable
  if (pairedCats.length > 0) {
    categories = pairedCats;
    categoryDates = pairedDates;
  }

  // Fallback: scan entire text for standalone category letters
  if (categories.length === 0) {
    const standaloneRe = new RegExp(SINGLE_CATEGORY_RE.source, SINGLE_CATEGORY_RE.flags);
    while ((catMatch = standaloneRe.exec(text)) !== null) {
      const cat = catMatch[1].toUpperCase();
      // Filter out common false positives: single "A" in Russian text (какая-то, etc.)
      // Only add if it looks like a standalone category (preceded by space/comma/start)
      const idx = catMatch.index;
      const prevChar = idx > 0 ? text[idx - 1] : " ";
      if (idx === 0 || /[\s,;:\-/(]/.test(prevChar)) {
        if (!categories.includes(cat)) {
          categories.push(cat);
        }
      }
    }
  }

  return {
    data: {
      fullName,
      series,
      number,
      issueDate,
      expiryDate,
      categories,
      categoryDates,
    },
    errors,
  };
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validateOcrResult(
  data: Record<string, unknown>,
  type: "passport" | "license",
): string[] {
  const errors: string[] = [];
  const rules = OCR_VALIDATION[type];

  for (const [field, rule] of Object.entries(rules)) {
    if (!rule.required) continue;

    const value = data[field];

    // Categories are optional even on license
    if (type === "license" && field === "categories") continue;

    if (value === undefined || value === null || value === "") {
      errors.push(`${field}: required field missing`);
      continue;
    }

    if (typeof value !== "string") {
      // categories is an array — skip pattern check
      if (Array.isArray(value)) continue;
      errors.push(`${field}: expected string, got ${typeof value}`);
      continue;
    }

    if (rule.pattern && !rule.pattern.test(value)) {
      errors.push(`${field}: "${value}" does not match expected format (${rule.label})`);
    }
  }

  return errors;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

/** Normalize date separators: "01/03/2020" → "01.03.2020" */
function normalizeDate(raw: string): string {
  return raw.replace(/[/.]/g, ".");
}
