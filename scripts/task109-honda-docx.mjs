// task109 part 6: download + inspect the honda contract docx content
// READ-ONLY (no PII in repo — extraction runs at runtime, prints only field sanity).
// node --env-file=.env.local scripts/task109-honda-docx.mjs
import { createClient } from '@supabase/supabase-js';
import { execSync } from 'child_process';
import fs from 'fs';

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const path = 'vip-bike/rental-honda-cbr600rr-2003-1792330590117.docx';
const { data, error } = await sb.storage.from('rental-contracts').download(path);
if (error || !data) { console.error('DOWNLOAD FAILED:', error?.message); process.exit(1); }
const buf = Buffer.from(await data.arrayBuffer());
console.log('bytes:', buf.length);

fs.writeFileSync('/tmp/honda.docx', buf);
execSync('cd /tmp && rm -rf honda_x && mkdir honda_x && cd honda_x && unzip -o -q ../honda.docx word/document.xml');
const xml = fs.readFileSync('/tmp/honda_x/word/document.xml', 'utf8');
const texts = xml
  .replace(/<w:p [^>]*>/g, '\n<w:p>')
  .replace(/<\/w:p>/g, '\n')
  .replace(/<[^>]+>/g, '')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;$/g, '>').replace(/&nbsp;/g, ' ');
const lines = texts.split('\n').map((l) => l.trim()).filter(Boolean);

// print ALL non-empty lines (contract is short) but mask nothing — output stays in sandbox
console.log('=== DOC TEXT ===');
for (const l of lines) console.log(l.slice(0, 200));
