import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

const inputFile = 'C:/Users/SLY13/carTest/docs/crewDocs/Surge-V-Spare-Parts-List-0425 .xlsx';
const outputFile = 'C:/Users/SLY13/carTest/docs/crewDocs/surge_parts_chunks/Surge_Wheel_Sets.xlsx';

console.log('Reading Excel file...');

// Read the workbook
const workbook = XLSX.readFile(inputFile);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];

// Convert to array of arrays (raw data)
const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

console.log(`Total rows in file: ${rawData.length}`);

// Find the "Wheel sets" section
let wheelSetsStartIndex = -1;
let nextSectionIndex = -1;

// Look for "Wheel sets" in the first column (case-insensitive)
for (let i = 0; i < rawData.length; i++) {
  const firstCol = String(rawData[i][0] || '').trim().toLowerCase();

  if (firstCol.includes('wheel') || firstCol.includes('колес')) {
    // Check if it's specifically "Wheel sets" or similar
    const rowText = String(rawData[i][0] || '').trim();
    console.log(`Found potential match at row ${i + 1}: "${rowText}"`);

    if (wheelSetsStartIndex === -1) {
      wheelSetsStartIndex = i;
    }
  } else if (wheelSetsStartIndex !== -1 && nextSectionIndex === -1) {
    // Once we found wheel sets, look for the next section
    // A new section typically starts with a bold/category-like entry
    const rowText = String(rawData[i][0] || '').trim();

    // Check if this looks like a new section header (not empty, not a sub-item)
    if (rowText && rowText.length > 0 && !rowText.startsWith('.')) {
      // Skip rows that look like sub-items (indented or numbered)
      const isSubItem = /^\d+\.|^\s+/.test(rowText);

      if (!isSubItem && i > wheelSetsStartIndex + 1) {
        // This might be a new section
        const lowerText = rowText.toLowerCase();

        // If it's a clearly different section, mark it
        if (!lowerText.includes('wheel') && !lowerText.includes('колес') &&
            lowerText.length < 50 && // Short text suggests a header
            /^[A-ZА-Я]/.test(rowText)) { // Starts with capital letter
          nextSectionIndex = i;
          break;
        }
      }
    }
  }
}

if (wheelSetsStartIndex === -1) {
  console.error('Could not find "Wheel sets" section');
  process.exit(1);
}

// If we didn't find a clear next section, go until end or until we hit another major category
if (nextSectionIndex === -1) {
  console.log('No clear next section found, scanning for category change...');

  for (let i = wheelSetsStartIndex + 1; i < rawData.length; i++) {
    const firstCol = String(rawData[i][0] || '').trim();

    if (firstCol && firstCol.length > 0 && firstCol.length < 50) {
      const lowerText = firstCol.toLowerCase();

      // Check if this is a new major section (all caps, or clearly a category)
      const isAllCaps = firstCol === firstCol.toUpperCase() &&
                       firstCol !== firstCol.toLowerCase();

      const looksLikeSection = /^[A-ZА-Я]{2,}/.test(firstCol) &&
                               !firstCol.includes('.') &&
                               !firstCol.includes(' ') ||
                               /^[IVX]+\./.test(firstCol); // Roman numerals

      if ((isAllCaps || looksLikeSection) && !lowerText.includes('wheel')) {
        nextSectionIndex = i;
        break;
      }
    }
  }

  // If still no next section, go to end
  if (nextSectionIndex === -1) {
    nextSectionIndex = rawData.length;
  }
}

console.log(`Wheel sets section starts at row ${wheelSetsStartIndex + 1}`);
console.log(`Next section starts at row ${nextSectionIndex + 1}`);

// Extract the wheel sets rows
const wheelSetsRows = rawData.slice(wheelSetsStartIndex, nextSectionIndex);

console.log(`Extracted ${wheelSetsRows.length} rows`);

// Create a new workbook with the extracted data
const newWorkbook = XLSX.utils.book_new();
const newWorksheet = XLSX.utils.aoa_to_sheet(wheelSetsRows);
XLSX.utils.book_append_sheet(newWorkbook, newWorksheet, 'Wheel Sets');

// Write the output file
XLSX.writeFile(newWorkbook, outputFile);

// Get file stats
const stats = fs.statSync(outputFile);
const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);

console.log(`\n✓ Successfully saved to: ${outputFile}`);
console.log(`✓ Rows extracted: ${wheelSetsRows.length}`);
console.log(`✓ File size: ${fileSizeMB} MB`);
