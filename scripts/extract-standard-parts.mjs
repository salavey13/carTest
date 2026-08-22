import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

const inputFile = 'C:/Users/SLY13/carTest/docs/crewDocs/Surge-V-Spare-Parts-List-0425 .xlsx';
const outputFile = 'C:/Users/SLY13/carTest/docs/crewDocs/surge_parts_chunks/Surge_Standard_Parts.xlsx';

console.log('Reading Excel file...');

const workbook = XLSX.readFile(inputFile);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];

// Convert to array of arrays (raw values)
const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

console.log(`Total rows in file: ${jsonData.length}`);

// Find the "Standard parts" section
let standardPartsStartIndex = -1;
let nextSectionIndex = jsonData.length;

for (let i = 0; i < jsonData.length; i++) {
  const firstCol = String(jsonData[i][0] || '').trim().toLowerCase();

  // Look for "Standard parts" section start
  if (firstCol.includes('standard parts') || firstCol === 'standard parts') {
    standardPartsStartIndex = i;
    console.log(`Found "Standard parts" at row ${i + 1}`);
    break;
  }
}

if (standardPartsStartIndex === -1) {
  console.error('Could not find "Standard parts" section!');
  console.log('First column values (first 30 rows):');
  for (let i = 0; i < Math.min(30, jsonData.length); i++) {
    console.log(`  Row ${i + 1}: "${String(jsonData[i][0] || '').trim()}"`);
  }
  process.exit(1);
}

// Find where the next section starts (after Standard parts)
for (let i = standardPartsStartIndex + 1; i < jsonData.length; i++) {
  const firstCol = String(jsonData[i][0] || '').trim();

  // Skip empty rows
  if (!firstCol) continue;

  // Check if this looks like a new section header
  // (contains "parts" but not "standard parts", or other common section patterns)
  const lower = firstCol.toLowerCase();

  // Common patterns that indicate a new section
  if (
    (lower.includes('parts') && !lower.includes('standard')) ||
    lower.includes('section') ||
    lower.includes('category') ||
    lower.includes('group') ||
    // Check if it's all caps or looks like a header (short, no numbers)
    (firstCol.length < 30 && firstCol === firstCol.toUpperCase() && !firstCol.match(/\d/))
  ) {
    // Make sure we're not just picking up a data row
    // Section headers typically don't have data in adjacent columns
    const hasAdjacentData = jsonData[i].slice(1, 4).some(cell => cell !== '' && cell !== undefined);

    if (!hasAdjacentData || lower.includes('parts')) {
      nextSectionIndex = i;
      console.log(`Found next section "${firstCol}" at row ${i + 1}`);
      break;
    }
  }
}

// Extract the Standard parts section (including the header row)
const standardPartsData = jsonData.slice(standardPartsStartIndex, nextSectionIndex);

console.log(`Extracted ${standardPartsData.length} rows from "Standard parts" section`);

// Create new workbook with extracted data
const newWorkbook = XLSX.utils.book_new();
const newWorksheet = XLSX.utils.aoa_to_sheet(standardPartsData);
XLSX.utils.book_append_sheet(newWorkbook, newWorksheet, 'Standard Parts');

// Write to file
XLSX.writeFile(newWorkbook, outputFile);

// Get file size
const stats = fs.statSync(outputFile);
const fileSizeMB = stats.size / (1024 * 1024);

console.log(`\nResults:`);
console.log(`- Rows extracted: ${standardPartsData.length}`);
console.log(`- Output file: ${outputFile}`);
console.log(`- File size: ${fileSizeMB.toFixed(2)} MB`);
