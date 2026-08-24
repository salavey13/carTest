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

// Find the "Electric parts" section
let electricPartsStartRow = -1;
let electricPartsEndRow = -1;
const sectionKeyword = 'Electric parts';
const nextSectionPatterns = [
  'parts',
  'brake',
  'frame',
  'engine',
  'transmission',
  'wheel',
  'body',
  'suspension',
  'exhaust',
  'fuel',
  'cooling'
];

// Find the start of Electric parts section
for (let i = 0; i < data.length; i++) {
  const firstColValue = String(data[i][0] || '').toLowerCase().trim();
  if (firstColValue.includes('electric') || firstColValue.includes('электрические') ||
      firstColValue.includes('electro')) {
    electricPartsStartRow = i;
    break;
  }
}

if (electricPartsStartRow === -1) {
  console.error('Could not find "Electric parts" section');
  process.exit(1);
}

console.log(`Found Electric parts section starting at row ${electricPartsStartRow}`);

// Find the end of Electric parts section (next section starts)
for (let i = electricPartsStartRow + 1; i < data.length; i++) {
  const firstColValue = String(data[i][0] || '').toLowerCase().trim();

  // Check if this looks like a new section header
  // A section header typically has empty cells after the first column
  // and contains a category name
  const secondColEmpty = !data[i][1] || String(data[i][1] || '').trim() === '';
  const thirdColEmpty = !data[i][2] || String(data[i][2] || '').trim() === '';

  // Check if any section keyword is present
  const isSectionHeader = nextSectionPatterns.some(pattern =>
    firstColValue.includes(pattern)
  );

  // Also check for common patterns in Russian
  const isRussianSection = firstColValue.includes('запчасть') ||
                          firstColValue.includes('тормоз') ||
                          firstColValue.includes('рама') ||
                          firstColValue.includes('двигател') ||
                          firstColValue.includes('колесо') ||
                          firstColValue.includes('кузов') ||
                          firstColValue.includes('подвеска') ||
                          firstColValue.includes('выхлоп') ||
                          firstColValue.includes('топлив') ||
                          firstColValue.includes('охлажден');

  if ((isSectionHeader || isRussianSection) && secondColEmpty && thirdColEmpty && firstColValue.length > 3) {
    electricPartsEndRow = i;
    console.log(`Found next section at row ${i}: "${firstColValue}"`);
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

console.log(`Extracted ${electricPartsData.length} rows`);

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
