#!/usr/bin/env node
/**
 * backfill-artifacts-to-storage.mjs
 * 
 * Takes existing artifact entries with storage_path = null,
 * regenerates DOCX from the stored contract data using the HTML template,
 * uploads to Supabase Storage, and updates the artifact row.
 * 
 * Usage:
 *   node scripts/backfill-artifacts-to-storage.mjs [--dry-run] [--type rental|sale|subrent]
 * 
 * Env vars required:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes('--dry-run');
const TYPE_FILTER = process.argv.find(a => a.startsWith('--type='))?.split('=')[1];

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── Template Renderer (simplified from docx-capability.ts) ─────
function renderTemplate(html, vars) {
  let result = html;
  
  // Process {{#if var}}...{{else}}...{{/if}} blocks
  result = result.replace(/\{\{#if\s+(\w+)\}\}([\s\S]*?)(?:\{\{else\}\}([\s\S]*?))?\{\{\/if\}\}/g,
    (_, key, ifBlock, elseBlock) => vars[key] ? ifBlock : (elseBlock || '')
  );
  
  // Process simple {{var}} placeholders
  result = result.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => String(vars[key] ?? ''));
  
  return result;
}

// ─── DOCX Generator ──────────────────────────────────────────
async function generateDocxFromHtml(htmlContent) {
  // Import dynamically to avoid issues in script context
  const { buildFranchizeDocxFromTemplate } = await import('../app/franchize/lib/docx-capability.ts');
  
  const result = buildFranchizeDocxFromTemplate({
    html: htmlContent,
    template: htmlContent,  // Already rendered
    variables: {},
    integrationScope: 'backfill',
    uploadedBy: 'backfill-script',
    documentKey: 'backfill-' + Date.now(),
    fileName: 'backfill.docx',
    flowType: 'rental',
    templateMode: 'html',
  });
  
  return result;
}

// ─── Upload to Storage ───────────────────────────────────────
async function uploadToStorage(contractKey, buffer, metadata) {
  const storagePath = `vip-bike/${contractKey}.docx`;
  
  const { error } = await supabase.storage
    .from('rental-contracts')
    .upload(storagePath, buffer, {
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      upsert: false,
    });
  
  if (error) throw new Error(`Upload failed: ${error.message}`);
  return storagePath;
}

// ─── Main ──────────────────────────────────────────────────────
async function main() {
  console.log('🔄 Backfilling artifacts to storage');
  if (DRY_RUN) console.log('⚠️  DRY RUN — no writes');

  // Load templates
  const templateDir = '/opt/vip-bike-rental/docs';
  const templates = {
    rental: readFileSync(join(templateDir, 'RENTAL_DEAL_TEMPLATE.html'), 'utf8'),
    sale: readFileSync(join(templateDir, 'SALE_DEAL_TEMPLATE.html'), 'utf8'),
    subrent: readFileSync(join(templateDir, 'SUBRENTAL_DEAL_TEMPLATE.html'), 'utf8'),
  };

  const tables = [
    { type: 'rental', table: 'rental_contract_artifacts', keyCol: 'contract_key', nameCol: 'renter_full_name' },
    { type: 'sale', table: 'sale_contract_artifacts', keyCol: 'contract_key', nameCol: 'buyer_full_name' },
    { type: 'subrent', table: 'subrent_contract_artifacts', keyCol: 'contract_key', nameCol: 'owner_full_name' },
  ];

  let processed = 0, skipped = 0, errors = 0;

  for (const { type, table, keyCol, nameCol } of tables) {
    if (TYPE_FILTER && type !== TYPE_FILTER) continue;

    console.log(`\n── Processing ${type} artifacts...`);

    // Fetch artifacts without storage_path
    const { data: artifacts, error: fetchErr } = await supabase
      .from(table)
      .select('*')
      .is('storage_path', null)
      .limit(50);

    if (fetchErr) {
      console.error(`  ❌ Fetch failed: ${fetchErr.message}`);
      errors++;
      continue;
    }

    console.log(`  📋 Found ${artifacts.length} artifacts without storage_path`);

    for (const artifact of artifacts) {
      try {
        const contractKey = artifact[keyCol];
        const personName = artifact[nameCol] || 'Unknown';
        
        console.log(`\n  ── ${contractKey} (${personName})`);

        // Build template variables from artifact data
        const vars = buildTemplateVars(type, artifact);
        
        // Render template
        const template = templates[type];
        const renderedHtml = renderTemplate(template, vars);

        if (DRY_RUN) {
          console.log(`    📝 Would generate DOCX for ${contractKey}`);
          skipped++;
          continue;
        }

        // Generate DOCX
        const { bytes, sha256 } = await generateDocxFromHtml(renderedHtml);
        const buffer = Buffer.from(bytes);
        
        // Upload to storage
        const storagePath = await uploadToStorage(contractKey, buffer, {
          source: 'backfill',
          person: personName,
        });

        // Update artifact
        const { error: updateErr } = await supabase
          .from(table)
          .update({ 
            storage_path: storagePath,
            original_sha256: artifact.original_sha256 || sha256,
          })
          .eq('id', artifact.id);

        if (updateErr) {
          console.error(`    ❌ Update failed: ${updateErr.message}`);
          errors++;
        } else {
          console.log(`    ✅ Uploaded: ${storagePath}`);
          processed++;
        }
      } catch (err) {
        console.error(`    ❌ Error: ${err.message}`);
        errors++;
      }
    }
  }

  console.log(`\n${'═'.repeat(50)}`);
  console.log(`✅ Processed: ${processed}`);
  console.log(`⏭️  Skipped: ${skipped}`);
  console.log(`❌ Errors: ${errors}`);
}

function buildTemplateVars(type, artifact) {
  const base = {
    contract_number: artifact.contract_key?.split('-').slice(1, -1).join('-') || 'N/A',
    day: new Date().getDate(),
    month_num: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    organization_representative: 'ООО "ВИП БАЙК"',
    organization_name: 'ООО "ВИП БАЙК"',
    organization_short: 'ООО "ВИП БАЙК"',
    ogrnip: '123456789012345',
    inn: '1234567890',
    legal_address: 'г. Нижний Новгород',
    bank_name: 'ПАО Сбербанк',
    bank_account: '40702810400000000000',
    bank_corr_account: '30101810400000000000',
    bank_city: 'г. Нижний Новгород',
    return_address: 'г. Нижний Новгород, пл. Комсомольская, 2',
  };

  if (type === 'rental') {
    return {
      ...base,
      bike_vehicle_type_label: 'ЭЛЕКТРОМОТОЦИКЛА',
      bike_vehicle_type_accusative: 'электромотоцикл',
      bike_vehicle_type_genitive: 'электромотоцикла',
      bike_make: artifact.requested_bike_id?.split('-')[0] || '',
      bike_model: artifact.requested_bike_id?.split('-').slice(1).join(' ') || '',
      bike_vin: 'N/A',
      bike_category: 'M1',
      bike_color: 'N/A',
      bike_year: '2024',
      renter_full_name: artifact.renter_full_name || '',
      renter_passport: artifact.renter_passport || '',
      renter_passport_issue_date: artifact.renter_passport_issue_date || '',
      renter_passport_issued_by: artifact.renter_passport_issued_by || '',
      renter_registration: artifact.renter_registration || '',
      renter_birth_date: artifact.renter_birth_date || '',
      rent_start_date: artifact.rent_start_date || '',
      rent_start_time: '10:00',
      rent_end_date: artifact.rent_end_date || '',
      rent_end_time: '10:00',
      daily_price_rub: artifact.daily_price || '6000',
      hourly_price_rub: '1000',
      deposit_rub: artifact.deposit_rub || '15000',
      subtotal_rub: artifact.total_sum || '6000',
    };
  }

  if (type === 'sale') {
    return {
      ...base,
      product_name: artifact.requested_bike_id || '',
      buyer_full_name: artifact.buyer_full_name || '',
      buyer_passport_number: artifact.buyer_passport_number || '',
      buyer_passport_issued_by: artifact.buyer_passport_issued_by || '',
      buyer_passport_issue_date: artifact.buyer_passport_issue_date || '',
      buyer_registration: artifact.buyer_registration || '',
      price_digits: artifact.sale_price || '0',
      price_words: artifact.price_words || 'ноль',
      warranty_months: artifact.warranty_months || '0',
    };
  }

  if (type === 'subrent') {
    return {
      ...base,
      owner_full_name: artifact.owner_full_name || '',
      owner_passport_series: artifact.owner_passport_series || '',
      owner_passport_number: artifact.owner_passport_number || '',
      owner_percentage: artifact.owner_percentage || '70',
      bike_make: artifact.bike_make || '',
      bike_model: artifact.bike_model || '',
      bike_vin: artifact.bike_vin || '',
      bike_plate: artifact.bike_plate || '',
      bike_year: artifact.bike_year || '',
      bike_value_rub: artifact.bike_value_rub || '',
      min_daily_price_rub: artifact.min_daily_price_rub || '500',
      contract_start_date: artifact.contract_start_date || '',
      contract_start_time: artifact.contract_start_time || '',
      contract_end_date: artifact.contract_end_date || '',
      contract_end_time: artifact.contract_end_time || '',
    };
  }

  return base;
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
