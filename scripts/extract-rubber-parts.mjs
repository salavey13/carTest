import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

const inputFile = 'C:/Users/SLY13/carTest/docs/crewDocs/Surge-V-Spare-Parts-List-0425 .xlsx';
const outputDir = 'C:/Users/SLY13/carTest/docs/crewDocs/surge_parts_chunks';
const outputFile = path.join(outputDir, 'Surge_Rubber_Parts.xlsx');

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Read the Excel file
const workbook = XLSX.readFile(inputFile);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];

// Convert to array of arrays (including header)
const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

console.log(`Total rows in file: ${data.length}`);

// Find the "Rubber part" section
let rubberPartStartIndex = -1;
let rubberPartEndIndex = data.length;

// Search for the section start
for (let i = 0; i < data.length; i++) {
  const firstCell = String(data[i][0] || '').trim().toLowerCase();
  if (firstCell === 'rubber part' || firstCell.includes('rubber') && firstCell.includes('part')) {
    rubberPartStartIndex = i;
    console.log(`Found "Rubber part" section at row ${i + 1}: "${data[i][0]}"`);
    break;
  }
}

if (rubberPartStartIndex === -1) {
  console.error('Could not find "Rubber part" section in the file');
  process.exit(1);
}

// Find where the section ends (next section starts)
// Look for any row with non-empty first cell that looks like a section header
// Section headers typically have "part" in the name or other section indicators
for (let i = rubberPartStartIndex + 1; i < data.length; i++) {
  const firstCell = String(data[i][0] || '').trim();

  // Skip empty rows
  if (firstCell === '') {
    continue;
  }

  // Check if this looks like a new section header
  // Section headers: contain "part" or "standard" or "terms", are short, don't start with numbers
  const looksLikeSectionHeader =
    firstCell.length < 50 &&
    !/^\d/.test(firstCell) &&
    (firstCell.toLowerCase().includes('part') ||
     firstCell.toLowerCase().includes('standard') ||
     firstCell.toLowerCase().includes('terms'));

  if (looksLikeSectionHeader && i > rubberPartStartIndex) {
    rubberPartEndIndex = i;
    console.log(`Found next section "${data[i][0]}" at row ${i + 1}, ending Rubber part section`);
    break;
  }
}

// Extract the rows
const rubberPartRows = data.slice(rubberPartStartIndex, rubberPartEndIndex);

console.log(`Extracted ${rubberPartRows.length} rows from "Rubber part" section`);

// Create new workbook with extracted data
const newWorkbook = XLSX.utils.book_new();
const newWorksheet = XLSX.utils.aoa_to_sheet(rubberPartRows);
XLSX.utils.book_append_sheet(newWorkbook, newWorksheet, 'Rubber Parts');

// Write to file
XLSX.writeFile(newWorkbook, outputFile);

// Get file size
const stats = fs.statSync(outputFile);
const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);

console.log(`Successfully saved to: ${outputFile}`);
console.log(`File size: ${fileSizeMB} MB`);
console.log(`Rows extracted: ${rubberPartRows.length}`);
