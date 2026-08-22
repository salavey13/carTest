#!/usr/bin/env node

/**
 * Extract "Plastic parts" section from Surge V Spare Parts List Excel file
 */

import xlsx from 'xlsx';
import fs from 'fs';
import path from 'path';

const SOURCE_FILE = 'docs/crewDocs/Surge-V-Spare-Parts-List-0425 .xlsx';
const OUTPUT_FILE = 'docs/crewDocs/surge_parts_chunks/Surge_Plastic_Parts.xlsx';
const SECTION_NAME = 'Plastic parts';

console.log(`Reading ${SOURCE_FILE}...`);

// Read the Excel file
const workbook = xlsx.readFile(path.join(process.cwd(), SOURCE_FILE));
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];

// Convert to array of arrays (raw data)
const data = xlsx.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

console.log(`Total rows in file: ${data.length}`);

// Find the "Plastic parts" section
let sectionStartRow = -1;
let sectionEndRow = -1;

for (let i = 0; i < data.length; i++) {
  const firstCol = String(data[i][0] || '').trim();

  // Check if this is the start of "Plastic parts" section
  if (firstCol.toLowerCase() === SECTION_NAME.toLowerCase()) {
    sectionStartRow = i;
    console.log(`Found "${SECTION_NAME}" section at row ${i}`);
    continue;
  }

  // If we found the section start, look for the next section to know where to end
  if (sectionStartRow >= 0 && sectionEndRow === -1) {
    // A new section starts if we have a non-empty first column that looks like a section header
    // Section headers are typically non-empty, not numbers, and not indented
    if (firstCol && firstCol !== '' && isNaN(Number(firstCol)) && !firstCol.startsWith('  ')) {
      // Skip the first row after section start (which might be sub-header)
      if (i > sectionStartRow + 1) {
        sectionEndRow = i;
        console.log(`Found next section at row ${i}, ending extraction`);
        break;
      }
    }
  }
}

// If no next section found, extract until end
if (sectionStartRow >= 0 && sectionEndRow === -1) {
  sectionEndRow = data.length;
  console.log(`No next section found, extracting until end (${data.length})`);
}

if (sectionStartRow === -1) {
  console.error(`ERROR: Could not find "${SECTION_NAME}" section in the file!`);
  process.exit(1);
}

// Extract the section rows
const extractedRows = data.slice(sectionStartRow, sectionEndRow);
console.log(`Extracted ${extractedRows.length} rows`);

// Create new workbook with extracted data
const newWorkbook = xlsx.utils.book_new();
const newWorksheet = xlsx.utils.aoa_to_sheet(extractedRows);
xlsx.utils.book_append_sheet(newWorkbook, newWorksheet, 'Plastic Parts');

const outputPath = path.join(process.cwd(), OUTPUT_FILE);
xlsx.writeFile(newWorkbook, outputPath);

// Get file stats
const stats = fs.statSync(outputPath);
const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);

console.log(`\n✓ Saved to: ${outputPath}`);
console.log(`✓ Rows extracted: ${extractedRows.length}`);
console.log(`✓ File size: ${fileSizeMB} MB`);

// Output summary for easy parsing
console.log(`\nSUMMARY:${extractedRows.length}|${fileSizeMB}`);
