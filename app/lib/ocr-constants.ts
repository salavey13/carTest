/**
 * VIP Bike Rental — OCR Constants & Prompts
 *
 * Architecture decision: VLM-based OCR (Option A).
 * Send photo to GLM-4V via `z-ai-web-dev-sdk` for structured JSON extraction.
 * Highest accuracy for Russian passports/licenses, simplest to implement.
 *
 * Future: Add Tesseract.js fallback for cost optimization.
 */

export const OCR_PROVIDER = "vlm" as const;

export const OCR_PASSPORT_PROMPT = `Extract passport data from this Russian passport photo. Return JSON only, no markdown:
{
  "fullName": "Фамилия Имя Отчество",
  "birthDate": "DD.MM.YYYY",
  "series": "1234",
  "number": "567890",
  "issueDate": "DD.MM.YYYY",
  "issuedBy": "Кем выдан",
  "departmentCode": "000-000",
  "registration": "Адрес регистрации"
}

Rules:
- fullName must be in nominative case
- All dates in DD.MM.YYYY format
- series is exactly 4 digits
- number is exactly 6 digits
- If a field is unreadable, use empty string ""`;

export const OCR_LICENSE_PROMPT = `Extract driver's license data from this Russian ВУ (водительское удостоверение) photo. Return JSON only, no markdown:
{
  "fullName": "Фамилия Имя Отчество",
  "birthDate": "DD.MM.YYYY",
  "series": "99 76",
  "number": "543210",
  "issueDate": "DD.MM.YYYY",
  "expiryDate": "DD.MM.YYYY",
  "categories": ["A", "B", "M"],
  "issuedBy": "Кем выдан"
}

Rules:
- fullName must be in nominative case
- All dates in DD.MM.YYYY format
- series is 2+2 digits separated by space
- number is exactly 6 digits
- categories is an array of license category letters: A, A1, B, B1, M, etc.
- Include ALL categories shown on the license, even if expired
- If a field is unreadable, use empty string ""`;

/** Validation rules for OCR output */
export const OCR_VALIDATION = {
  passport: {
    series: { pattern: /^\d{4}$/, label: "Серия паспорта (4 цифры)" },
    number: { pattern: /^\d{6}$/, label: "Номер паспорта (6 цифр)" },
    birthDate: { pattern: /^\d{2}\.\d{2}\.\d{4}$/, label: "Дата рождения (DD.MM.YYYY)" },
  },
  license: {
    series: { pattern: /^\d{2}\s?\d{2}$/, label: "Серия ВУ (2+2 цифры)" },
    number: { pattern: /^\d{6}$/, label: "Номер ВУ (6 цифр)" },
    categories: { minItems: 0, label: "Категории прав" },
  },
} as const;

/** Type for passport OCR result */
export interface PassportOcrResult {
  fullName: string;
  birthDate: string;
  series: string;
  number: string;
  issueDate: string;
  issuedBy: string;
  departmentCode: string;
  registration: string;
}

/** Type for driver's license OCR result */
export interface LicenseOcrResult {
  fullName: string;
  birthDate: string;
  series: string;
  number: string;
  issueDate: string;
  expiryDate: string;
  categories: string[];
  issuedBy: string;
}
