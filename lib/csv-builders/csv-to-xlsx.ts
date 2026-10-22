// lib/csv-builders/csv-to-xlsx.ts
// Task 124 — CSV → XLSX converter with verification-status coloring.
//
// History: iter52 (analytics-csv-send.ts) introduced this converter for the
// Telegram XLSX send — block banners (АРЕНДЫ/ЭКИП/СЕРВИС/ПРОДАЖИ/СВОДКА) +
// «Итого/ВСЕГО» totals styling. Task 124 moved it here so BOTH the Telegram
// send AND the browser download route (rentals-csv-export?format=xlsx) share
// one implementation, and added the verification layer:
//
//   the АРЕНДЫ block carries a «Верификация» column (task 101). Rows are
//   TINTED by that status and the status cell renders bold+colored:
//     подтверждено → green, спор → red, ждёт*/ожидает → amber.
//   The export answers «what is still unverified» at a glance — the boss
//   reviews the month in Excel, not in the app.
//
// Server-side only (exceljs). Pure input→Buffer, no I/O of its own.

const BANNER_RE = /^(АРЕНДЫ|ЭКИП|СЕРВИС|ПРОДАЖИ|СВОДКА)/;
const TOTALS_RE = /^(Итого|ВСЕГО)/;

export type CsvRowKind = "banner" | "totals" | "header" | "data" | "empty";

export function classifyCsvRow(cells: string[]): CsvRowKind {
  const nonEmpty = cells.filter((c) => c.trim() !== "");
  if (nonEmpty.length === 0) return "empty";
  if (nonEmpty.length === 1 && BANNER_RE.test(nonEmpty[0].trim())) return "banner";
  // sales-csv puts «Итого:» in a middle cell → scan all cells.
  if (cells.some((c) => TOTALS_RE.test(c.trim()))) return "totals";
  return "data";
}

export type VerificationTone = "verified" | "disputed" | "waiting" | null;

/**
 * Task 124 — classify the «Верификация» cell text (task-101 labels + the
 * « · скорректировано (N ₽)» suffix). Unknown/empty → no tone.
 */
export function verificationToneOf(label: string): VerificationTone {
  const s = (label || "").toLowerCase();
  if (!s.trim()) return null;
  if (s.includes("спор")) return "disputed";
  if (s.includes("подтверждено")) return "verified";
  if (s.includes("ждёт") || s.includes("ожидает")) return "waiting";
  return null;
}

/** Light row tint per tone (ARGB, no alpha — ExcelJS 8-hex). */
const ROW_TINT: Record<Exclude<VerificationTone, null>, string> = {
  verified: "FFE7F6EC",
  disputed: "FFFDE9E9",
  waiting: "FFFDF3E0",
};

/** Strong cell font color per tone. */
const CELL_FONT: Record<Exclude<VerificationTone, null>, string> = {
  verified: "FF16A34A",
  disputed: "FFDC2626",
  waiting: "FFD97706",
};

export async function csvToXlsxBuffer(csv: string, sheetName = "Sheet1"): Promise<Buffer> {
  // ExcelJS is a CJS module — use dynamic import to avoid bundler issues.
  const ExcelJS = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName);

  // buildRentalsCsv prepends a \uFEFF BOM for Excel-CSV compatibility — strip
  // it here so the first XLSX cell doesn't carry an invisible character.
  const cleanCsv = csv.charCodeAt(0) === 0xfeff ? csv.slice(1) : csv;

  // Parse the CSV (RFC-4180-lite) — same logic as the modal's parser.
  const parseLine = (line: string): string[] => {
    const out: string[] = [];
    let i = 0;
    let field = "";
    let inQ = false;
    while (i < line.length) {
      const ch = line[i];
      if (inQ) {
        if (ch === '"') {
          if (line[i + 1] === '"') { field += '"'; i += 2; continue; }
          inQ = false; i++; continue;
        }
        field += ch; i++; continue;
      }
      if (ch === '"') { inQ = true; i++; continue; }
      if (ch === ",") { out.push(field); field = ""; i++; continue; }
      field += ch; i++;
    }
    out.push(field);
    return out;
  };

  // Split lines (handle CRLF + LF + lone CR)
  const lines: string[] = [];
  let cur = "";
  for (let i = 0; i < cleanCsv.length; i++) {
    const ch = cleanCsv[i];
    if (ch === "\r") {
      lines.push(cur); cur = "";
      if (cleanCsv[i + 1] === "\n") i++;
      continue;
    }
    if (ch === "\n") { lines.push(cur); cur = ""; continue; }
    cur += ch;
  }
  if (cur.length > 0) lines.push(cur);

  const classifyRow = classifyCsvRow;

  const parsedRows: { cells: (string | number)[]; kind: ReturnType<typeof classifyRow> }[] = [];
  for (const line of lines) {
    if (!line) continue;
    const cells = parseLine(line);
    const kind = classifyRow(cells);
    if (kind === "empty") { parsedRows.push({ cells, kind }); continue; }
    // Cast numeric strings to numbers so Excel formats them properly.
    const row = cells.map((c) => {
      const t = c.trim();
      if (t === "") return "";
      const n = Number(t.replace(/\s/g, "").replace(",", "."));
      return Number.isFinite(n) && /^\d+([.,]\d+)?$/.test(t) ? n : c;
    });
    parsedRows.push({ cells: row, kind });
  }

  for (const { cells, kind } of parsedRows) {
    ws.addRow(cells);
  }

  // ── Task 124: locate the АРЕНДЫ «Верификация» column + per-row tone ──
  // ONE pass: the АРЕНДЫ banner starts the block, the row carrying the
  // literal «Верификация» header defines the column (per block, carried on
  // the row), every data row of that block gets its tone from the cell text.
  type RowWithTone = { cells: (string | number)[]; kind: CsvRowKind; tone: VerificationTone; verCol: number };
  const rowsWithTone: RowWithTone[] = [];
  {
    let verColLocal = -1;
    let inRentals = false;
    for (const { cells, kind } of parsedRows) {
      if (kind === "banner") {
        inRentals = /^АРЕНДЫ/.test(String(cells.find((c) => String(c).trim() !== "") ?? "").trim());
        verColLocal = -1;
        rowsWithTone.push({ cells, kind, tone: null, verCol: verColLocal });
        continue;
      }
      if (inRentals && verColLocal === -1 && cells.some((c) => String(c).trim() === "Верификация")) {
        verColLocal = cells.findIndex((c) => String(c).trim() === "Верификация");
        rowsWithTone.push({ cells, kind, tone: null, verCol: verColLocal }); // the header row itself
        continue;
      }
      const tone =
        inRentals && kind === "data" && verColLocal >= 0
          ? verificationToneOf(String(cells[verColLocal] ?? ""))
          : null;
      rowsWithTone.push({ cells, kind, tone, verCol: verColLocal });
    }
  }

  // Style the first row (legacy single-header sheets) + every block banner
  // row (bold + accent fill); «Итого …» / «ВСЕГО» rows render bold.
  const styled = (rowIndex: number, style: "header" | "banner" | "totals") => {
    const row = ws.getRow(rowIndex);
    row.eachCell((cell) => {
      if (style === "totals") {
        cell.font = { bold: true };
        cell.border = { top: { style: "thin", color: { argb: "FF9CA3AF" } } };
      } else {
        cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: style === "banner" ? "FF111827" : "FF3B82F6" },
        };
      }
    });
  };
  rowsWithTone.forEach(({ kind }, idx) => {
    const rowIndex = idx + 1;
    if (kind === "banner") styled(rowIndex, "banner");
    else if (kind === "totals") styled(rowIndex, "totals");
  });
  if (rowsWithTone.length > 0 && rowsWithTone[0].kind === "data") {
    styled(1, "header");
  }

  // ── Task 124: verification coloring pass ──
  // Rentals rows tint by status + the status cell bold/colored. Runs AFTER
  // banner/totals styling so a misrouted tone can never repaint a banner.
  rowsWithTone.forEach(({ kind, tone, verCol }, idx) => {
    if (kind !== "data" || !tone || verCol < 0) return;
    const row = ws.getRow(idx + 1);
    row.eachCell((cell, colNumber) => {
      if (colNumber === verCol + 1) {
        cell.font = { bold: true, color: { argb: CELL_FONT[tone] } };
      } else {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ROW_TINT[tone] } };
      }
    });
  });

  // Auto-size columns (approximate by max cell length)
  ws.columns.forEach((col) => {
    let max = 10;
    col.eachCell?.({ includeEmpty: false }, (cell) => {
      const s = String(cell.value ?? "");
      if (s.length > max) max = s.length;
    });
    col.width = Math.min(max + 2, 40);
  });

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
