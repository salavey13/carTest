/**
 * Validates translated RU part-section CSVs and concatenates them into a single
 * master file: docs/crewDocs/surge_parts_all_ru.csv
 *
 * Validation per file:
 *  - balanced quotes on every physical line (no multi-line quoted cells)
 *  - col 2 = numeric seq, col 3 = non-empty part number, col 7 = numeric base price
 *  - category name only on first row
 *
 * Usage: node scripts/concat-parts-csv-ru.mjs
 */

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const SRC_DIR = join(process.cwd(), "docs", "crewDocs", "surge_parts_csv_ru");
const OUT_FILE = join(process.cwd(), "docs", "crewDocs", "surge_parts_all_ru.csv");

/** Deterministic catalog order by first seq number of each section. */
const FILE_ORDER = [
  "Surge_Electric_Parts.csv",
  "Surge_Wheel_Sets.csv",
  "Surge_Saddle.csv",
  "Surge_Braking_Chain_Sets.csv",
  "Surge_Plastic_Parts.csv",
  "Surge_Structural_Part.csv",
  "Surge_Front_Rear_Suspension.csv",
  "Surge_Rubber_Parts.csv",
  "Surge_Standard_Parts.csv",
];

function parseCsvLine(line) {
  const cols = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      cols.push(cur); cur = "";
    } else cur += ch;
  }
  cols.push(cur);
  return cols.map((c) => c.trim());
}

let totalRows = 0;
let failures = 0;
const masterLines = [];

for (const file of FILE_ORDER) {
  const path = join(SRC_DIR, file);
  let content;
  try {
    content = readFileSync(path, "utf8");
  } catch {
    console.error(`MISSING  ${file}`);
    failures++;
    continue;
  }

  const lines = content.split(/\r?\n/).filter((l) => l.trim());
  let fileOk = true;
  let rowCount = 0;

  lines.forEach((line, idx) => {
    const quoteCount = (line.match(/"/g) || []).length;
    if (quoteCount % 2 !== 0) {
      console.error(`BADQUOTES ${file}:${idx + 1}  ${line.slice(0, 80)}`);
      fileOk = false;
      return;
    }
    const cols = parseCsvLine(line);
    const [, seq, partNumber, , , , price] = cols;
    if (!/^\d+$/.test(seq || "")) {
      console.error(`BADSEQ    ${file}:${idx + 1}  seq="${seq}"`);
      fileOk = false;
      return;
    }
    if (!partNumber) {
      console.error(`NOPN      ${file}:${idx + 1}`);
      fileOk = false;
      return;
    }
    if (price === undefined || price === "" || Number.isNaN(Number(price))) {
      console.error(`BADPRICE  ${file}:${idx + 1}  price="${price}"`);
      fileOk = false;
      return;
    }
    if (idx > 0 && cols[0]) {
      console.error(`CATREPEAT ${file}:${idx + 1}  "${cols[0]}"`);
      fileOk = false;
      return;
    }
    rowCount++;
  });

  if (!lines[0] || !parseCsvLine(lines[0])[0]) {
    console.error(`NOCAT     ${file} — first row missing category name`);
    fileOk = false;
  }

  if (fileOk) {
    console.log(`OK        ${file}  rows=${rowCount}`);
    totalRows += rowCount;
    masterLines.push(...lines);
  } else {
    failures++;
  }
}

if (failures > 0) {
  console.error(`\n${failures} file(s) failed validation — master CSV NOT written.`);
  process.exit(1);
}

writeFileSync(OUT_FILE, masterLines.join("\n") + "\n", "utf8");
console.log(`\nWrote ${OUT_FILE}  (${totalRows} parts, ${FILE_ORDER.length} sections)`);
