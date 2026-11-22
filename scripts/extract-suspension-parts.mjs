#!/usr/bin/env node

/**
 * Extract Front & Rear suspension parts from Surge parts Excel file
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import xlsx from 'xlsx';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');

async function main() {
  const sourceFile = join(repoRoot, 'docs/crewDocs/Surge-V-Spare-Parts-List-0425 .xlsx');
  const outputDir = join(repoRoot, 'docs/crewDocs/surge_parts_chunks');
  const outputFile = join(outputDir, 'Surge_Front_Rear_Suspension.xlsx');

  console.log(`Reading: ${sourceFile}`);

  // Read the workbook
  const workbook = xlsx.readFile(sourceFile);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  // Convert to array of arrays (raw values)
  const range = xlsx.utils.decode_range(worksheet['!ref']);
  const data = [];

  for (let row = range.s.r; row <= range.e.r; row++) {
    const rowData = [];
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellAddress = xlsx.utils.encode_cell({ r: row, c: col });
      const cell = worksheet[cellAddress];
      rowData.push(cell ? cell.v : '');
    }
    data.push(rowData);
  }

  // Find the suspension section
  // Look for various possible spellings of the section name
  const suspensionPatterns = [
    /front\s*&\s*rear\s*suspension/i,
    /fronet\s*&\s*rear\s*suspension/i,
    /front\s*&\s*rear\s*suspension\s*part/i,
    /fronet\s*&\s*rear\s*suspension\s*part/i,
    /suspension/i
  ];

  let sectionStartRow = -1;
  let sectionName = '';

  for (let i = 0; i < data.length; i++) {
    const firstColValue = String(data[i][0] || '').trim();
    for (const pattern of suspensionPatterns) {
      if (pattern.test(firstColValue)) {
        sectionStartRow = i;
        sectionName = firstColValue;
        break;
      }
    }
    if (sectionStartRow >= 0) break;
  }

  if (sectionStartRow < 0) {
    console.error('Could not find Front & Rear suspension section!');
    console.log('First column values in the file:');
    for (let i = 0; i < Math.min(30, data.length); i++) {
      console.log(`  Row ${i}: "${data[i][0]}"`);
    }
    process.exit(1);
  }

  console.log(`Found section at row ${sectionStartRow}: "${sectionName}"`);

  // Extract rows from this section until the next major section
  // A new major section is typically non-empty first column with all caps or distinct formatting
  const extractedRows = [];
  extractedRows.push(data[sectionStartRow]); // Header row

  for (let row = sectionStartRow + 1; row < data.length; row++) {
    const firstColValue = String(data[row][0] || '').trim();

    // Stop if we hit a new major section
    // Major sections typically have non-empty first col and don't look like data rows
    // Data rows usually have part numbers or are empty
    if (firstColValue && firstColValue.length > 3) {
      // Check if this might be a new section header (all caps or contains SECTION/PART)
      const isAllCaps = firstColValue === firstColValue.toUpperCase() && firstColValue.length > 5;
      const looksLikeSection = /section|part|system|assembly/i.test(firstColValue);

      // If the row has text in first col and nothing in second col (like data rows have),
      // it's likely a new section header
      const hasDataInCols = String(data[row][1] || '').trim() || String(data[row][2] || '').trim();

      if (!hasDataInCols && (isAllCaps || looksLikeSection)) {
        // Found next section
        console.log(`Next section starts at row ${row}: "${firstColValue}"`);
        break;
      }
    }

    extractedRows.push(data[row]);
  }

  console.log(`Extracted ${extractedRows.length} rows`);

  // Create output directory if needed
  await mkdir(outputDir, { recursive: true });

  // Create new workbook with extracted data
  const newWorksheet = xlsx.utils.aoa_to_sheet(extractedRows);
  const newWorkbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(newWorkbook, newWorksheet, 'Front Rear Suspension');

  // Write the file
  xlsx.writeFile(newWorkbook, outputFile);

  // Get file size
  const fs = await import('fs');
  const fileSizeBytes = fs.statSync(outputFile).size;
  const fileSizeMB = (fileSizeBytes / (1024 * 1024)).toFixed(3);

  console.log(`\nResults:`);
  console.log(`  Rows extracted: ${extractedRows.length}`);
  console.log(`  File size: ${fileSizeMB} MB`);
  console.log(`  Output: ${outputFile}`);

  return { rows: extractedRows.length, sizeMB: fileSizeMB };
}

main().catch(console.error);
