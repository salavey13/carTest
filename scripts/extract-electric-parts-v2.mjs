import pkg from 'xlsx';
const { readFile, writeFile, utils } = pkg;
import { resolve } from 'path';
import { statSync } from 'fs';

const inputFile = resolve('docs/crewDocs/Surge-V-Spare-Parts-List-0425 .xlsx');
const outputFile = resolve('docs/crewDocs/surge_parts_chunks/Surge_Electric_Parts.xlsx');

// Read the workbook
const workbook = readFile(inputFile);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];

// Convert to array of arrays (including header row)
const data = utils.sheet_to_json(worksheet, { header: 1 });

console.log(`Total rows in file: ${data.length}`);

// First, let's see what the first column looks like to understand the structure
console.log('\n=== Scanning first column for section patterns ===');
const sectionCandidates = [];

for (let i = 0; i < data.length; i++) {
  const firstColValue = String(data[i][0] || '').trim();
  const secondColValue = String(data[i][1] || '').trim();
  const thirdColValue = String(data[i][2] || '').trim();

  // A section header typically has:
  // - First column has text
  // - Subsequent columns are empty or have numbers
  // - Not a data row (data rows have SKU in column 2 or 3)

  if (firstColValue.length > 3) {
    const isPotentialSection = secondColValue === '' || /^\d+$/.test(secondColValue);
    if (isPotentialSection) {
      sectionCandidates.push({ row: i, value: firstColValue, col2: secondColValue, col3: thirdColValue });
    }
  }
}

// Print potential sections
sectionCandidates.forEach(candidate => {
  console.log(`Row ${candidate.row}: "${candidate.value}" [col2: "${candidate.col2}", col3: "${candidate.col3}"]`);
});

// Find Electric parts section
let electricPartsStartRow = -1;
let electricPartsEndRow = -1;
const electricPatterns = ['electric', 'electro', 'электрические', 'электро'];

for (let i = 0; i < data.length; i++) {
  const firstColValue = String(data[i][0] || '').toLowerCase();
  if (electricPatterns.some(p => firstColValue.includes(p))) {
    electricPartsStartRow = i;
    break;
  }
}

if (electricPartsStartRow === -1) {
  console.error('Could not find "Electric parts" section');
  process.exit(1);
}

console.log(`\nFound Electric parts section starting at row ${electricPartsStartRow}`);

// Find the end of Electric parts section
// Look for the next section header AFTER Electric parts
for (let i = electricPartsStartRow + 1; i < data.length; i++) {
  const firstColValue = String(data[i][0] || '').toLowerCase().trim();
  const secondColValue = String(data[i][1] || '').trim();
  const thirdColValue = String(data[i][2] || '').trim();

  // Skip if first column is empty or very short
  if (firstColValue.length < 3) continue;

  // A section header typically:
  // - Has text in first column
  // - Column 2 is either empty or a number (not a SKU/code)
  // - Column 3 is either empty or a number (not a description)

  // Check if column 2 looks like a number (index) rather than a code
  const col2IsNumber = secondColValue === '' || /^\d+$/.test(secondColValue);
  const col3IsEmpty = thirdColValue === '';
  const col3IsNotCode = thirdColValue === '' || /^\d+$/.test(thirdColValue);

  // If this looks like a section header and is NOT the Electric parts we already found
  const isSectionHeader = col2IsNumber && (col3IsEmpty || col3IsNotCode) && firstColValue.length > 5;

  // Make sure it's not a continuation of Electric parts
  const isNotElectric = !electricPatterns.some(p => firstColValue.includes(p));

  if (isSectionHeader && isNotElectric) {
    electricPartsEndRow = i;
    console.log(`Found next section at row ${i}: "${data[i][0]}"`);
    console.log(`  - Col2: "${secondColValue}", Col3: "${thirdColValue}"`);
    break;
  }
}

// If no end found, use the end of the file
if (electricPartsEndRow === -1) {
  electricPartsEndRow = data.length;
  console.log('No next section found, using end of file');
}

console.log(`Electric parts section ends at row ${electricPartsEndRow}`);

// Extract the rows (including the section header)
const electricPartsData = data.slice(electricPartsStartRow, electricPartsEndRow);

console.log(`\nExtracted ${electricPartsData.length} rows`);

// Also print the last few rows to verify
console.log('\n=== Last 5 rows of extracted data ===');
electricPartsData.slice(-5).forEach((row, i) => {
  const actualRow = electricPartsData.length - 5 + i;
  console.log(`Row ${actualRow}: [${row.map(cell => `"${cell}"`).join(', ')}]`);
});

// Create new workbook with the extracted data
const newWorkbook = utils.book_new();
const newWorksheet = utils.aoa_to_sheet(electricPartsData);
utils.book_append_sheet(newWorkbook, newWorksheet, 'Electric Parts');

// Write the output file
writeFile(newWorkbook, outputFile);

// Get file size
const fileSize = statSync(outputFile).size;
const fileSizeMB = (fileSize / (1024 * 1024)).toFixed(2);

console.log(`\n=== Results ===`);
console.log(`Rows extracted: ${electricPartsData.length}`);
console.log(`Output file: ${outputFile}`);
console.log(`File size: ${fileSizeMB} MB (${fileSize} bytes)`);

// Print first few rows for verification
console.log('\n=== First 5 rows of extracted data ===');
electricPartsData.slice(0, 5).forEach((row, i) => {
  console.log(`Row ${i}: [${row.map(cell => `"${cell}"`).join(', ')}]`);
});
