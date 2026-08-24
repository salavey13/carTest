import XLSX from 'xlsx';

const outputFile = 'C:/Users/SLY13/carTest/docs/crewDocs/surge_parts_chunks/Surge_Rubber_Parts.xlsx';

const workbook = XLSX.readFile(outputFile);
const worksheet = workbook.Sheets['Rubber Parts'];
const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

console.log(`Total rows in output file: ${data.length}\n`);
console.log('First few rows:');
data.slice(0, Math.min(data.length, 15)).forEach((row, i) => {
  console.log(`Row ${i + 1}: [${row.slice(0, 5).map(c => `"${c}"`).join(', ')}...`);
});
