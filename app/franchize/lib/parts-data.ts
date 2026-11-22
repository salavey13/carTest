/**
 * Parts data loader for Surge bike spare parts.
 *
 * Parses CSV section files and returns structured catalog data.
 * Prefers the translated Russian sections in docs/crewDocs/surge_parts_csv_ru/
 * and falls back to the original English docs/crewDocs/surge_parts_csv/.
 *
 * CSV structure (comma-separated, 8 columns):
 * - Col 1: Category name (only on the first row of a section; may switch mid-file)
 * - Col 2: Sequence number
 * - Col 3: Part number (e.g., "DMNSGPL06001")
 * - Col 4: Part name
 * - Col 5: Empty/unused
 * - Col 6: Description/specs
 * - Col 7: Base price in USD (0 = price on request)
 * - Col 8: Original calculated price (unused, we override)
 *
 * Pricing formula: Final Price (RUB) = Base Price (USD) x 2.5 (margin) x 100 (exchange rate) = x250
 * Image paths: /supabase-mirror/parts-pics/{folder}/{partNumber}.{ext}
 */

import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";

/** Directory with the translated Russian section CSVs (preferred). */
const CSV_DIR_RU = join(process.cwd(), "docs", "crewDocs", "surge_parts_csv_ru");
/** Fallback directory with the original English section CSVs. */
const CSV_DIR_EN = join(process.cwd(), "docs", "crewDocs", "surge_parts_csv");

/** Multiplier for pricing formula (USD x 2.5 margin x 100 exchange rate = 250x total) */
const PRICE_MULTIPLIER = 250;

/** Base path for part images */
const IMAGE_BASE_PATH = "/supabase-mirror/parts-pics";

/** Supported image extensions */
const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "gif"] as const;

interface CanonicalCategory {
  id: string;
  folder: string;
  /** Russian display name, used when the CSV does not provide one. */
  name: string;
}

/**
 * Canonical category registry keyed by normalized section name.
 * Both English (original CSVs) and Russian (translated CSVs) keys are supported.
 */
const CATEGORY_CANONICAL: Record<string, CanonicalCategory> = {
  "electric parts": { id: "electric", folder: "electric", name: "Электрика" },
  "электрика": { id: "electric", folder: "electric", name: "Электрика" },
  "wheel sets": { id: "wheel-sets", folder: "wheel", name: "Колёса" },
  "колёса": { id: "wheel-sets", folder: "wheel", name: "Колёса" },
  "колеса": { id: "wheel-sets", folder: "wheel", name: "Колёса" },
  "saddle": { id: "saddle", folder: "saddle", name: "Седло" },
  "седло": { id: "saddle", folder: "saddle", name: "Седло" },
  "braking&chain sets": { id: "braking-chain", folder: "braking", name: "Тормоза и цепь" },
  "тормоза и цепь": { id: "braking-chain", folder: "braking", name: "Тормоза и цепь" },
  "plastic parts": { id: "plastic", folder: "plastic", name: "Пластик" },
  "пластик": { id: "plastic", folder: "plastic", name: "Пластик" },
  "structural part": { id: "structural", folder: "structural", name: "Рама и крепёж" },
  "рама и крепёж": { id: "structural", folder: "structural", name: "Рама и крепёж" },
  "fronet &rear suspension part": { id: "suspension", folder: "suspension", name: "Подвеска" },
  "front&rear suspension": { id: "suspension", folder: "suspension", name: "Подвеска" },
  "подвеска": { id: "suspension", folder: "suspension", name: "Подвеска" },
  "rubber part": { id: "rubber", folder: "rubber", name: "Резиновые детали" },
  "резиновые детали": { id: "rubber", folder: "rubber", name: "Резиновые детали" },
  "standard parts": { id: "standard", folder: "standard", name: "Стандартные детали" },
  "стандартные детали": { id: "standard", folder: "standard", name: "Стандартные детали" },
};

/** Individual spare part. */
export interface SparePart {
  /** Sequence number within the source list */
  itemNumber: number;
  /** Part number (e.g., "DMNSGPL06001") */
  partNumber: string;
  /** Display name of the part */
  name: string;
  /** Part description/specifications */
  description: string;
  /** Base price from CSV (USD). 0 = price on request. */
  basePrice: number;
  /** Final price in rubles (basePrice x 250 = USD x 2.5 margin x 100 exchange rate). 0 = price on request. */
  finalPrice: number;
  /** Image filename if found */
  imageName?: string;
  /** Relative path to part image */
  imagePath?: string;
  /** Source category display name */
  sourceCategory: string;
}

/** Category of parts (e.g., "Электрика", "Колёса"). */
export interface PartsCategory {
  /** Category id (e.g., "electric", "braking-chain") */
  id: string;
  /** Display name of the category */
  name: string;
  /** All parts in this category */
  parts: SparePart[];
}

/** Normalize a raw category cell to a lookup key. */
function normalizeCategoryKey(raw: string): string {
  return raw.toLowerCase().replace(/\s+/g, " ").trim();
}

function canonicalFor(rawCategory: string, fileName: string): CanonicalCategory & { displayName: string } {
  const key = normalizeCategoryKey(rawCategory);
  const hit = CATEGORY_CANONICAL[key];
  if (hit) {
    return { ...hit, displayName: rawCategory.trim() || hit.name };
  }
  // Unknown section: derive a stable id, default image folder, keep the raw name.
  const slug = key
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  return {
    id: slug || fileName.replace(/^surge_/i, "").replace(/\.csv$/i, "").toLowerCase(),
    folder: "standard",
    name: rawCategory.trim() || fileName,
    displayName: rawCategory.trim() || fileName,
  };
}

/**
 * Split CSV content into logical rows, stitching lines that contain
 * unterminated quoted cells (multi-line quoted values in source exports).
 */
function toLogicalRows(content: string): string[] {
  const physical = content.split(/\r?\n/);
  const rows: string[] = [];
  let buffer = "";
  let quoteCount = 0;

  for (const line of physical) {
    buffer = buffer ? `${buffer} ${line}` : line;
    for (const ch of line) {
      if (ch === '"') quoteCount++;
    }
    if (quoteCount % 2 === 0) {
      if (buffer.trim()) rows.push(buffer);
      buffer = "";
      quoteCount = 0;
    }
  }
  if (buffer.trim()) rows.push(buffer);
  return rows;
}

/** Parse a CSV row into columns, respecting quoted values. */
function parseCsvRow(row: string): string[] {
  const columns: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < row.length; i++) {
    const char = row[i];
    if (char === '"') {
      if (inQuotes && row[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      columns.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  columns.push(current.trim());
  return columns;
}

/** Check if an image exists for a part number in a folder. */
function findPartImage(partNumber: string, imageFolder: string): string | undefined {
  const sanitized = partNumber.replace(/[^a-zA-Z0-9_-]/g, "");
  if (!sanitized) return undefined;

  for (const ext of IMAGE_EXTENSIONS) {
    const imageName = `${sanitized}.${ext}`;
    const fullPath = join(process.cwd(), "public", IMAGE_BASE_PATH, imageFolder, imageName);
    if (existsSync(fullPath)) {
      return imageName;
    }
  }
  return undefined;
}

/** Rows that are metadata, not parts. */
function isMetaRow(firstCell: string): boolean {
  const lower = firstCell.toLowerCase();
  return lower.startsWith("terms") || lower.includes("exchange rate");
}

/**
 * Parse CSV content into categories. A new category starts whenever
 * column 1 is non-empty (the source master file stacks all sections).
 */
function parseCsvContent(content: string, fileName: string): PartsCategory[] {
  const rows = toLogicalRows(content);
  const categories: PartsCategory[] = [];
  let current: PartsCategory | null = null;
  let currentFolder = "standard";

  for (const row of rows) {
    const columns = parseCsvRow(row);
    const firstCell = columns[0] ?? "";

    if (firstCell && isMetaRow(firstCell)) {
      current = null;
      continue;
    }

    if (firstCell) {
      const canonical = canonicalFor(firstCell, fileName);
      current = categories.find((c) => c.id === canonical.id) ?? null;
      if (!current) {
        current = { id: canonical.id, name: canonical.displayName, parts: [] };
        categories.push(current);
      }
      currentFolder = canonical.folder;
      // Do NOT continue: a section's first row also carries the first part.
    }

    if (!current) continue; // part rows before any category header

    const [, seqId, partNumberRaw, partName, , description, basePriceStr] = columns;

    const itemNumber = parseInt(seqId, 10);
    if (Number.isNaN(itemNumber) || itemNumber <= 0) continue;

    // Part number: take the first line of (rare) multi-line cells.
    const partNumber = (partNumberRaw ?? "").split(/\r?\n/)[0].trim();
    if (partNumber.length < 3) continue;

    // Price: "/" or empty means "price on request" -> 0.
    const priceStr = (basePriceStr ?? "").replace(",", ".").replace(/[^\d.]/g, "");
    const parsed = parseFloat(priceStr);
    const basePrice = Number.isNaN(parsed) || parsed < 0 ? 0 : parsed;
    const finalPrice = Math.round(basePrice * PRICE_MULTIPLIER * 100) / 100;

    const imageName = findPartImage(partNumber, currentFolder);

    current.parts.push({
      itemNumber,
      partNumber,
      name: (partName ?? "").trim() || partNumber,
      description: (description ?? "").trim(),
      basePrice,
      finalPrice,
      imageName,
      imagePath: imageName ? `${IMAGE_BASE_PATH}/${currentFolder}/${imageName}` : undefined,
      sourceCategory: current.name,
    });
  }

  for (const category of categories) {
    category.parts.sort((a, b) => a.itemNumber - b.itemNumber);
  }

  return categories.filter((c) => c.parts.length > 0);
}

/** Read all CSV section files from a directory. */
async function readCsvDir(dir: string): Promise<Array<{ file: string; content: string }>> {
  const entries = await readdir(dir);
  const contents = await Promise.all(
    entries
      .filter((file) => file.toLowerCase().endsWith(".csv"))
      .map(async (file) => {
        try {
          return { file, content: await readFile(join(dir, file), "utf-8") };
        } catch (err) {
          console.warn(`Failed to read CSV file: ${file}`, err);
          return null;
        }
      })
  );
  return contents.filter((c): c is { file: string; content: string } => c !== null);
}

/**
 * Load and parse all CSV section files.
 * Prefers the translated Russian directory; falls back to the English source.
 * Categories are ordered by their lowest sequence number (source catalog order).
 */
export async function loadPartsData(): Promise<PartsCategory[]> {
  const useRu = existsSync(CSV_DIR_RU);
  const dir = useRu ? CSV_DIR_RU : CSV_DIR_EN;

  try {
    const files = await readCsvDir(dir);
    const categories: PartsCategory[] = [];

    for (const { file, content } of files) {
      for (const category of parseCsvContent(content, file)) {
        const existing = categories.find((c) => c.id === category.id);
        if (existing) {
          // The English master file repeats every section; dedupe by part number.
          const seen = new Set(existing.parts.map((p) => p.partNumber));
          existing.parts.push(...category.parts.filter((p) => !seen.has(p.partNumber)));
        } else {
          categories.push(category);
        }
      }
    }

    for (const category of categories) {
      category.parts.sort((a, b) => a.itemNumber - b.itemNumber);
    }
    categories.sort(
      (a, b) => Math.min(...a.parts.map((p) => p.itemNumber)) - Math.min(...b.parts.map((p) => p.itemNumber))
    );

    return categories;
  } catch (error) {
    console.error(`Failed to load parts data from ${dir}:`, error);
    return [];
  }
}

/** Get all parts across all categories. */
export async function getAllParts(): Promise<SparePart[]> {
  const categories = await loadPartsData();
  return categories.flatMap((cat) => cat.parts);
}

/** Find a specific part by part number. */
export async function findPartByNumber(partNumber: string): Promise<SparePart | null> {
  const allParts = await getAllParts();
  return allParts.find((p) => p.partNumber === partNumber) || null;
}

/** Get a category by ID. */
export async function getCategoryById(categoryId: string): Promise<PartsCategory | null> {
  const categories = await loadPartsData();
  return categories.find((c) => c.id === categoryId) || null;
}

/** Search parts across all categories by query string. */
export async function searchParts(query: string): Promise<SparePart[]> {
  const allParts = await getAllParts();
  const lowerQuery = query.toLowerCase();

  return allParts.filter(
    (part) =>
      part.name.toLowerCase().includes(lowerQuery) ||
      part.partNumber.toLowerCase().includes(lowerQuery) ||
      part.description.toLowerCase().includes(lowerQuery) ||
      part.sourceCategory.toLowerCase().includes(lowerQuery)
  );
}

/** Catalog metadata for client-side display. */
export interface PartsCatalogMetadata {
  totalParts: number;
  totalCategories: number;
  categories: Array<{ id: string; name: string; count: number }>;
}

/** Get catalog metadata without loading all parts. */
export async function getCatalogMetadata(): Promise<PartsCatalogMetadata> {
  const categories = await loadPartsData();

  return {
    totalParts: categories.reduce((sum, cat) => sum + cat.parts.length, 0),
    totalCategories: categories.length,
    categories: categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      count: cat.parts.length,
    })),
  };
}
