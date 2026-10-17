// task102: download + parse the f800r contract docx (recovery evidence)
// node --env-file=.env.local scripts/task102-f800r-docx.mjs
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
import { execSync } from 'child_process';
import fs from 'fs';

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const path = 'vip-bike/rental-bmw-f800r-1792230158214.docx';
const { data, error } = await sb.storage.from('rental-contracts').download(path);
if (error || !data) {
  console.error('DOWNLOAD FAILED:', error?.message);
  process.exit(1);
}
const buf = Buffer.from(await data.arrayBuffer());
console.log('bytes:', buf.length, 'sha256:', createHash('sha256').update(buf).digest('hex'));

fs.writeFileSync('/home/z/cartest/scripts/f800r.docx', buf);
// extract document.xml
execSync('cd /home/z/cartest/scripts && rm -rf f800r_x && mkdir f800r_x && cd f800r_x && unzip -o -q ../f800r.docx word/document.xml');
const xml = fs.readFileSync('/home/z/cartest/scripts/f800r_x/word/document.xml', 'utf8');
// paragraphs → text
const texts = xml
  .replace(/<w:p [^>]*>/g, '\n<w:p>')
  .replace(/<\/w:p>/g, '\n')
  .replace(/<[^>]+>/g, '')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ');
const lines = texts.split('\n').map((l) => l.trim()).filter(Boolean);
console.log('=== DOC TEXT (relevant lines) ===');
for (const l of lines) {
  if (
    /паспорт|серия|номер|выдан|дата рождения|телефон| registration|регистрац|прожив|водител|удостоверен|F800|BMW|аренд|Срок|период|начало|окончан|сумма|руб|залог|депозит|депон|шлем|экип|цена|стоимост|дней|суток|час/i.test(l)
  ) {
    console.log(l.slice(0, 220));
  }
}
console.log('=== FULL TEXT SAVED to scripts/f800r_text.txt ===');
fs.writeFileSync('/home/z/cartest/scripts/f800r_text.txt', lines.join('\n'));
