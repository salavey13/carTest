/**
 * VIP Bike Rental — OCR Constants & Types
 *
 * Shared types, regex patterns, and validation rules for the Tesseract.js OCR pipeline.
 * Used by /api/ocr route and any future OCR consumers.
 *
 * Architecture: Tesseract.js (free, local) → raw text → regex/positional parsers → structured JSON
 * No VLM/API calls needed — Russian passport and driver's license have fixed, well-known structures.
 */

// ─── Result Types ─────────────────────────────────────────────────────────────

export interface PassportOcrResult {
  /** Full name as printed: "ИВАНОВ ИВАН ИВАНОВИЧ" */
  fullName: string;
  /** Date of birth: "DD.MM.YYYY" */
  birthDate: string;
  /** Passport series: 4 digits */
  series: string;
  /** Passport number: 6 digits */
  number: string;
  /** Issuing authority */
  issuedBy: string;
  /** Issue date: "DD.MM.YYYY" */
  issueDate: string;
  /** Division code: "XXX-XXX" */
  divisionCode: string;
  /** Place of birth */
  birthPlace: string;
  /** Registration address */
  registration: string;
  /** Gender: "М" | "Ж" */
  gender: string;
}

export interface LicenseOcrResult {
  /** Full name as printed */
  fullName: string;
  /** License series: 4 digits */
  series: string;
  /** License number: 6 digits */
  number: string;
  /** Issue date: "DD.MM.YYYY" */
  issueDate: string;
  /** Expiry date: "DD.MM.YYYY" */
  expiryDate: string;
  /** Vehicle categories: ["A", "B", "M", "A1", "B1", "C", "D", ...] */
  categories: string[];
  /** Category issue dates (parallel to categories): ["DD.MM.YYYY", ...] */
  categoryDates: string[];
}

// ─── Access Tier Types ────────────────────────────────────────────────────────

export type AccessTier = "entry" | "mid" | "pro" | "none";

/**
 * Mapping from license category to minimum access tier.
 * Based on Russian vehicle category definitions:
 *   - М (moped ≤50cc) → entry (electric 49cc-equivalent, entry bikes)
 *   - A1 (125cc) → mid (scooters, e-dirt up to 11kW)
 *   - B (car) → mid (same as A1 for our purposes — B holders can ride A1-class)
 *   - A (unrestricted motorcycle) → pro (all bikes including high-power)
 *   - No license → none (entry electrics only after manual verification)
 */
export const LICENSE_CATEGORY_TIER_MAP: Record<string, AccessTier> = {
  M: "entry",
  A1: "mid",
  B: "mid",
  B1: "mid",
  A: "pro",
  C: "pro",
  D: "pro",
};

// ─── Validation Rules ─────────────────────────────────────────────────────────

export interface OcrFieldValidation {
  pattern: RegExp | null;
  label: string;
  required: boolean;
}

export const OCR_VALIDATION: {
  passport: Record<keyof PassportOcrResult, OcrFieldValidation>;
  license: Record<keyof LicenseOcrResult, OcrFieldValidation>;
} = {
  passport: {
    fullName: { pattern: /^[А-ЯЁ\s-]+$/u, label: "ФИО (кириллица)", required: true },
    birthDate: { pattern: /^\d{2}\.\d{2}\.\d{4}$/, label: "DD.MM.YYYY", required: true },
    series: { pattern: /^\d{4}$/, label: "4 цифры", required: true },
    number: { pattern: /^\d{6}$/, label: "6 цифр", required: true },
    issuedBy: { pattern: null, label: "Кем выдан", required: false },
    issueDate: { pattern: /^\d{2}\.\d{2}\.\d{4}$/, label: "DD.MM.YYYY", required: false },
    divisionCode: { pattern: /^\d{3}-\d{3}$/, label: "XXX-XXX", required: false },
    birthPlace: { pattern: null, label: "Место рождения", required: false },
    registration: { pattern: null, label: "Адрес регистрации", required: false },
    gender: { pattern: /^[МЖ]$/, label: "М/Ж", required: false },
  },
  license: {
    fullName: { pattern: /^[А-ЯЁ\s-]+$/u, label: "ФИО (кириллица)", required: true },
    series: { pattern: /^\d{4}$/, label: "4 цифры", required: true },
    number: { pattern: /^\d{6}$/, label: "6 цифр", required: true },
    issueDate: { pattern: /^\d{2}\.\d{2}\.\d{4}$/, label: "DD.MM.YYYY", required: false },
    expiryDate: { pattern: /^\d{2}\.\d{2}\.\d{4}$/, label: "DD.MM.YYYY", required: false },
    categories: { pattern: null, label: "Категории ТС", required: false },
    categoryDates: { pattern: null, label: "Даты категорий", required: false },
  },
};

// ─── Passport Parser Regexes ──────────────────────────────────────────────────
//
// Russian internal passport (first page, unfolded) has a fixed layout:
//
//   СЕРИЯ  НОМЕР          or split across two lines:
//   XX XX  XXXXXX
//
//   ФАМИЛИЯ        ИВАНОВА
//   ИМЯ            МАРИЯ
//   ОТЧЕСТВО       ИВАНОВНА
//
//   ПОЛ            Ж        ДАТА РОЖДЕНИЯ   DD.MM.YYYY
//   МЕСТО РОЖДЕНИЯ г. Нижний Новгород
//
//   КЕМ ВЫДАН      Отделом УФМС...
//   ДАТА ВЫДАЧИ    DD.MM.YYYY
//   КОД ПОДРАЗДЕЛЕНИЯ  XXX-XXX
//
//   АДРЕС РЕГИСТРАЦИИ (on page 2 / stamp area)

/** Extract passport series+number — looks for "XX XX XXXXXX" or "XX.XX.XXXXXX" patterns */
export const PASSPORT_SERIES_NUMBER_RE = /(\d{2})\s*(\d{2})\s*(\d{6})/;

/** Extract full name — 3 consecutive capitalized Russian words after ФАМИЛИЯ/ИМЯ/ОТЧЕСТВО labels */
export const PASSPORT_FULLNAME_RE =
  /(?:ФАМИЛИЯ|Фамилия)\s+([А-ЯЁ]+)\s+(?:ИМЯ|Имя)\s+([А-ЯЁ]+)\s+(?:ОТЧЕСТВО|Отчество)\s+([А-ЯЁ]+)/u;

/** Alternative: 3 capitalized Russian words on a single line (common in OCR) */
export const PASSPORT_FULLNAME_FLAT_RE = /^([А-ЯЁ]{2,})\s+([А-ЯЁ]{2,})\s+([А-ЯЁ]{2,})$/um;

/** Extract birth date */
export const PASSPORT_BIRTHDATE_RE = /(?:ДАТА\s+РОЖДЕНИЯ|Дата\s+рождения|род\.?)\s*:?\s*(\d{2}[./]\d{2}[./]\d{4})/i;

/** Extract gender */
export const PASSPORT_GENDER_RE = /(?:ПОЛ|Пол)\s*:?\s*([МЖ])/i;

/** Extract place of birth */
export const PASSPORT_BIRTHPLACE_RE = /(?:МЕСТО\s+РОЖДЕНИЯ|Место\s+рождения|М\.Р\.?)\s*:?\s*(.+)/i;

/** Extract issuing authority */
export const PASSPORT_ISSUED_BY_RE = /(?:КЕМ\s+ВЫДАН|Кем\s+выдан)\s*:?\s*(.+)/i;

/** Extract issue date */
export const PASSPORT_ISSUE_DATE_RE = /(?:ДАТА\s+ВЫДАЧИ|Дата\s+выдачи)\s*:?\s*(\d{2}[./]\d{2}[./]\d{4})/i;

/** Extract division code */
export const PASSPORT_DIVISION_CODE_RE = /(?:КОД\s+ПОДРАЗДЕЛЕНИЯ|Код\s+подразделения)\s*:?\s*(\d{3}[-\s]?\d{3})/i;

/** Extract registration address */
export const PASSPORT_REGISTRATION_RE = /(?:АДРЕС\s+РЕГИСТРАЦИИ|Адрес\s+регистрации|Зарег\.?)\s*:?\s*(.+)/i;

// ─── License Parser Regexes ───────────────────────────────────────────────────
//
// Russian driver's license (new plastic format) has:
//
//   1) Фамилия Имя Отчество
//   2) ДАТА РОЖДЕНИЯ  DD.MM.YYYY
//   3) СЕРИЯ НОМЕР    XX XX XXXXXX  (on front)
//   4) ДАТА ВЫДАЧИ    DD.MM.YYYY
//   5) СРОК ДЕЙСТВИЯ  DD.MM.YYYY
//   6) Категории: A  B  M  C  D  A1  B1  (with dates)

/** Extract license series+number */
export const LICENSE_SERIES_NUMBER_RE = /(\d{2})\s*(\d{2})\s*(\d{6})/;

/** Extract full name from license */
export const LICENSE_FULLNAME_RE = /(?:ФАМИЛИЯ|Фамилия|2a|1b)\s+([А-ЯЁ]+)\s+(?:ИМЯ|Имя|2b)\s+([А-ЯЁ]+)/u;

/** Alternative flat name extraction */
export const LICENSE_FULLNAME_FLAT_RE = /^([А-ЯЁ]{2,})\s+([А-ЯЁ]{2,})\s+([А-ЯЁ]{2,})$/um;

/** Extract issue date */
export const LICENSE_ISSUE_DATE_RE = /(?:ДАТА\s+ВЫДАЧИ|Дата\s+выдачи|4a?)\s*:?\s*(\d{2}[./]\d{2}[./]\d{4})/i;

/** Extract expiry date */
export const LICENSE_EXPIRY_DATE_RE = /(?:СРОК\s+ДЕЙСТВИЯ|Срок\s+действия|4b)\s*:?\s*(\d{2}[./]\d{2}[./]\d{4})/i;

/**
 * Extract vehicle categories.
 * Matches patterns like "Категории: A, B, M" or "CAT A B M" or just standalone category letters.
 * Russian license categories: A, A1, B, B1, C, C1, D, D1, BE, CE, DE, M, Tm, Tb
 */
export const LICENSE_CATEGORIES_RE = /(?:КАТЕГОРИИ|Категории|CAT|Category|9)\s*:?\s*([A-Z0-9,\s]+)/i;

/** Individual category extractor from the captured category string */
export const SINGLE_CATEGORY_RE = /\b(A1?|B1?|C1?|D1?|BE?|CE?|DE?|M|Tm|Tb)\b/gi;

/** Extract category dates (paired with categories): "A с DD.MM.YYYY" */
export const LICENSE_CATEGORY_DATE_RE = /([A-Z0-9]+)\s+(?:с|от|from)\s+(\d{2}[./]\d{2}[./]\d{4})/gi;

// ─── Tesseract Config ─────────────────────────────────────────────────────────

/** Tesseract.js language for Russian documents */
export const TESSERACT_LANG = "rus";

/** Minimum confidence threshold (0-100) to accept OCR result */
export const OCR_MIN_CONFIDENCE = 40;

/** Maximum image size in bytes (10 MB) */
export const OCR_MAX_IMAGE_SIZE = 10 * 1024 * 1024;

/** Supported MIME types for OCR input */
export const OCR_SUPPORTED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/bmp",
  "image/tiff",
];
