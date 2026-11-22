// lib/csv-builders/rentals-csv-sections.ts
//
// PURE, client-safe section model for the block-structured rentals CSV
// (iter52, 2026-10-07 — boss request «отдельные блоки про аренды, экип,
// сервис»).
//
// The exported sheet is no longer one flat 21-column grid — it is a sequence
// of named blocks, each with its own header + data rows + «Итого …» row:
//
//   АРЕНДЫ   — bike rentals only (vehicle.type = bike)
//   ЭКИП     — standalone equipment docs (metadata.item_type = equipment)
//              → NO salary column on purpose: the per-unit gear bonus is
//              already paid inside the paired bike rental's «ЗП Аренда»
//              (200 ₽ × units). Counting it here would double-pay.
//   СЕРВИС   — service works (vehicle.type = service)
//              → NO salary column: the official bonus scheme has no
//              service coefficient.
//   ПРОДАЖИ  — sale artifacts (ЗП Продажа by bike category)
//   СВОДКА   — per-block revenue/salary totals + grand total
//
// This module gives both the server builder and the client table view one
// shared definition of the block titles + a parser that splits raw CSV rows
// into sections. No server imports — safe for client components.

export type CsvSectionKey = "rentals" | "equipment" | "service" | "sales" | "summary";

export const CSV_SECTION_TITLES: Record<CsvSectionKey, string> = {
  rentals: "АРЕНДЫ",
  equipment: "ЭКИП",
  service: "СЕРВИС",
  sales: "ПРОДАЖИ",
  summary: "СВОДКА",
};

const TITLE_TO_KEY = new Map<string, CsvSectionKey>(
  (Object.entries(CSV_SECTION_TITLES) as Array<[CsvSectionKey, string]>).map(
    ([key, title]) => [title, key],
  ),
);

/** «АРЕНДЫ (байки)» → "rentals" (prefix match, case-insensitive). */
export function sectionKeyFromTitle(rawTitle: string | undefined | null): CsvSectionKey | null {
  if (!rawTitle) return null;
  const t = rawTitle.trim().toUpperCase();
  for (const [title, key] of TITLE_TO_KEY) {
    if (t.startsWith(title)) return key;
  }
  return null;
}

export interface ParsedCsvSection {
  key: CsvSectionKey;
  title: string;
  /** Column header row of the block. */
  header: string[];
  /** Data rows (totals + blank separators excluded). */
  data: string[][];
  /** «Итого …» row of the block (null when absent). */
  totals: string[] | null;
}

/**
 * Split raw parsed CSV rows into block sections.
 *
 * A block starts at a banner row — a row whose ONLY non-empty cell matches a
 * known section title. The next non-empty row is the block header; rows whose
 * first cell starts with «итого» (case-insensitive) become the block totals;
 * everything else is data. Fully empty rows are separators and are dropped.
 *
 * When no banner row exists (legacy flat sheet or the sales-only variant),
 * `{ sections: [], legacy: true }` is returned so callers can fall back to
 * the old single-table rendering.
 */
export function parseCsvSections(rows: string[][]): {
  sections: ParsedCsvSection[];
  legacy: boolean;
} {
  const sections: ParsedCsvSection[] = [];
  let current: ParsedCsvSection | null = null;
  let sawBanner = false;

  for (const row of rows) {
    const nonEmpty = row.filter((c) => (c || "").trim() !== "");

    // Blank separator row.
    if (nonEmpty.length === 0) continue;

    // Banner row → start a new block.
    if (nonEmpty.length === 1) {
      const key = sectionKeyFromTitle(nonEmpty[0]);
      if (key) {
        sawBanner = true;
        current = {
          key,
          title: nonEmpty[0].trim(),
          header: [],
          data: [],
          totals: null,
        };
        sections.push(current);
        continue;
      }
    }

    // Rows before the first banner → legacy flat sheet.
    if (!current) {
      return { sections: [], legacy: true };
    }

    const first = (row[0] || "").trim().toLowerCase();
    if (first.startsWith("итого")) {
      current.totals = row;
      continue;
    }
    if (current.header.length === 0) {
      current.header = row;
      continue;
    }
    current.data.push(row);
  }

  if (!sawBanner) return { sections: [], legacy: true };
  return { sections, legacy: false };
}

/** 1 блок / 2-4 блока / 5+ блоков — for the modal badge. */
export function pluralBlocksRu(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} блок`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return `${n} блока`;
  return `${n} блоков`;
}
