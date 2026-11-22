// Task 92: upload tutorial PDF to Supabase storage (carpix) + audit block
// run: node --env-file=.env.local scripts/task92-upload.mjs
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const CREW = '2d5fde70-1dd3-4f0d-8d72-66ccf6908746';

const PDF = '/home/z/cartest/task92-tutorial/vip-bike-kak-arendovat-2026-10.pdf';
const STORE_PATH = 'tutorials/vip-bike-kak-arendovat-2026-10.pdf';

const buf = readFileSync(PDF);
const up = await sb.storage.from('carpix').upload(STORE_PATH, buf, { contentType: 'application/pdf', upsert: true });
if (up.error) { console.error('UPLOAD ERROR:', up.error.message); process.exit(1); }
const pub = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/carpix/${STORE_PATH}`;
const head = await fetch(pub, { method: 'HEAD' });
console.log('UPLOADED:', pub);
console.log('HEAD:', head.status, head.headers.get('content-type'), head.headers.get('content-length'));
if (head.status !== 200) process.exit(1);

// audit block
{
  const { data: crew } = await sb.from('crews').select('id, metadata').eq('id', CREW).single();
  const meta = crew?.metadata || {};
  meta.specs = meta.specs || {};
  meta.specs.owner_fix_20261011_tutorial_pdf = {
    created_at: new Date().toISOString(),
    type: 'storage_upload',
    purpose: 'task92: Russian renter tutorial PDF (13 pages A4, screenshots, print-light palette)',
    file: STORE_PATH,
    bytes: buf.length,
    source_html: 'task92-tutorial/tutorial.html (repo), screenshots via local prod build + demo rental 91e5a7c0-1091-4109-8109-202610110001',
    demo_data_note: 'demo rental/user 910910910 created for screenshots, deleted after (see owner_fix_20261011_tutorial_demo_rental)',
    public_url: pub,
  };
  const { error } = await sb.from('crews').update({ metadata: meta }).eq('id', CREW);
  console.log('AUDIT:', error ? 'FAILED: ' + error.message : 'owner_fix_20261011_tutorial_pdf');
}
console.log('PUBLIC URL:', pub);
