import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const raw = readFileSync('/home/z/my-project/upload/secrets_all.txt', 'utf8');
const SB_URL = (raw.match(/NEXT_PUBLIC_SUPABASE_URL=(\S+)/) || [])[1];
const SB_KEY = (raw.match(/SUPABASE_SERVICE_ROLE_KEY=(\S+)/) || [])[1];
const sb = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });

// recent rentals for reference
const since = new Date(Date.now() - 4 * 24 * 3600 * 1000).toISOString();
const { data: rentals } = await sb.from('rentals')
  .select('rental_id, vehicle_id, status, start_photo_count, end_photo_count, created_at')
  .gte('created_at', since)
  .order('created_at', { ascending: false })
  .limit(12);
console.log('=== rentals photo counts ===');
for (const r of rentals || []) {
  console.log(`${r.rental_id} | ${r.vehicle_id} | ${r.status} | start_photos=${r.start_photo_count} end_photos=${r.end_photo_count}`);
}

// rental_photos rows
const { data: photos, error } = await sb.from('rental_photos')
  .select('id, rental_id, photo_type, storage_path, file_size_bytes, created_at, uploaded_by, uploader_role')
  .gte('created_at', since)
  .order('created_at', { ascending: false })
  .limit(30);
if (error) console.log('PHOTOS ERR:', error.message);
else {
  console.log('\n=== rental_photos rows (4 days) ===');
  if (!photos.length) console.log('(none)');
  for (const p of photos) console.log(`${p.photo_type} | rental=${p.rental_id} | ${p.storage_path} | ${Math.round((p.file_size_bytes||0)/1024)}KB | by=${p.uploaded_by} (${p.uploader_role}) @ ${p.created_at}`);
}

// check bucket existence + signed url for one path
if (photos && photos.length) {
  const { data: url, error: sErr } = await sb.storage.from('rental-photos').createSignedUrl(photos[0].storage_path, 60);
  console.log('\nsignedUrl test:', sErr ? `ERR ${sErr.message}` : `OK ${String(url?.signedUrl||'').slice(0, 60)}...`);
} else {
  // try listing the bucket
  const { data: files, error: lErr } = await sb.storage.from('rental-photos').list('', { limit: 10 });
  console.log('\nbucket list root:', lErr ? `ERR ${lErr.message}` : (files || []).map(f => f.name).slice(0, 10));
}
