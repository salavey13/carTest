// iter16 retrofix: correct today's two rentals (user-reported wrong totals)
// 1. Ducati Panigale S Electro Black Aero — Нектарий Томашевский Михайлович (38d0af71, active)
//    total 10 000 → 8 000, deposit 20 000 → 15 000
// 2. Aprilia Shiver 750 — Лобанов Михаил (c01cb3b3, pending_confirmation)
//    total 13 000 → 11 000 (bike 10k by agreement + helmet 1k, gloves free)
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const raw = readFileSync('/home/z/my-project/upload/secrets_all.txt', 'utf8');
const SB_URL = (raw.match(/NEXT_PUBLIC_SUPABASE_URL=(\S+)/) || [])[1];
const SB_KEY = (raw.match(/SUPABASE_SERVICE_ROLE_KEY=(\S+)/) || [])[1];
const sb = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });
const priv = sb.schema('private');

const DRY = process.argv.includes('--dry');
console.log(DRY ? '=== DRY RUN ===' : '=== APPLYING ===');

async function patchRental(rentalId, patch) {
  const { data: before } = await sb.from('rentals').select('rental_id, vehicle_id, total_cost, deposit_amount, metadata').eq('rental_id', rentalId).maybeSingle();
  if (!before) { console.log(`NOT FOUND: ${rentalId}`); return; }
  const md = { ...(before.metadata || {}), ...patch.metadata };
  const row = { ...patch.row, metadata: md, updated_at: new Date().toISOString() };
  console.log(`\n--- ${before.vehicle_id} (${rentalId.slice(0, 8)})`);
  console.log(`    total_cost: ${before.total_cost} → ${row.total_cost ?? before.total_cost}`);
  if (row.deposit_amount !== undefined) console.log(`    deposit_amount: ${before.deposit_amount ?? '(none)'} → ${row.deposit_amount}`);
  if (patch.metadata) console.log(`    metadata patch: ${Object.keys(patch.metadata).join(', ')}`);
  if (DRY) return;
  const { error } = await sb.from('rentals').update(row).eq('rental_id', rentalId);
  console.log(error ? `    ERR: ${error.message}` : '    rentals OK');
}

async function patchArtifact(rentalId, patch) {
  const { data: art } = await priv.from('rental_contract_artifacts').select('id, contract_key, total_sum, deposit_rub').eq('rental_id', rentalId).maybeSingle();
  if (!art) { console.log(`    artifact NOT FOUND for ${rentalId.slice(0, 8)} (skipping)`); return; }
  console.log(`    artifact ${art.contract_key}: total_sum ${art.total_sum} → ${patch.total_sum ?? art.total_sum}, deposit ${art.deposit_rub} → ${patch.deposit_rub ?? art.deposit_rub}`);
  if (DRY) return;
  const { error } = await priv.from('rental_contract_artifacts').update(patch).eq('rental_id', rentalId);
  console.log(error ? `    artifact ERR: ${error.message}` : '    artifact OK');
}

// ── 1. Ducati Panigale S Electro Black Aero ─────────────────────────────────
const DUCATI_AERO = '38d0af71-f723-4dad-988f-e274823d73ec';
await patchRental(DUCATI_AERO, {
  row: { total_cost: 8000, deposit_amount: 15000 },
  metadata: {
    deposit_amount: 15000,
    payment_split: { bank: 8000, cash: 15000, card_destination: 'tbank' },
    deposit_notes: 'Залог 15 000 ₽ (исправлено вручную 2026-08-29, было 20 000).',
    manual_correction: {
      corrected_at: new Date().toISOString(),
      reason: 'Итог исправлен вручную: 8 000 ₽ вместо 10 000 ₽ по договорённости с арендатором.',
      previous_total: 10000,
      previous_deposit: 20000,
    },
  },
});
await patchArtifact(DUCATI_AERO, { total_sum: 8000, deposit_rub: 15000 });

// ── 2. Aprilia Shiver 750 ───────────────────────────────────────────────────
const APRILIA = 'c01cb3b3-ee8c-4a2d-a852-ab8003c940b5';
await patchRental(APRILIA, {
  row: { total_cost: 11000 },
  metadata: {
    payment_split: { bank: 11000, cash: 20000, card_destination: 'tbank' },
    price_correction_note: 'Итог 11 000 ₽: байк 10 000 ₽ (по договорённости), шлем 1 000 ₽, перчатки — в подарок.',
    manual_correction: {
      corrected_at: new Date().toISOString(),
      reason: 'Итог исправлен вручную: 11 000 ₽ вместо 13 000 ₽. Байк 10 000 ₽ по договорённости, шлем 1 000 ₽, перчатки — в подарок.',
      previous_total: 13000,
    },
    equipment_notes: 'Перчатки — в подарок',
  },
});
await patchArtifact(APRILIA, { total_sum: 11000 });

console.log('\n=== DONE ===');
