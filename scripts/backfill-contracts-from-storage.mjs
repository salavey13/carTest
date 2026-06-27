#!/usr/bin/env node
/**
 * backfill-contracts-from-storage.mjs
 * 
 * Retrospective extraction: scans rental-contracts bucket, downloads DOCX files,
 * parses them to extract contract data, and creates/updates artifact table entries.
 * 
 * Usage:
 *   node scripts/backfill-contracts-from-storage.mjs [--dry-run] [--type rental|sale|subrent]
 * 
 * Env vars required:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js';
import JSZip from 'jszip';
import * as cheerio from 'cheerio';
import { createHash } from 'crypto';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = 'rental-contracts';
const DRY_RUN = process.argv.includes('--dry-run');
const TYPE_FILTER = process.argv.find(a => a.startsWith('--type='))?.split('=')[1];

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── DOCX Parser ────────────────────────────────────────────────
async function parseDocxToText(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const docXml = await zip.file('word/document.xml')?.async('text');
  if (!docXml) throw new Error('No word/document.xml in DOCX');
  
  const $ = cheerio.load(docXml, { xmlMode: true });
  const paragraphs = [];
  
  $('w\\:p').each((_, p) => {
    const texts = [];
    $(p).find('w\\:t').each((_, t) => {
      texts.push($(t).text());
    });
    if (texts.length > 0) {
      paragraphs.push(texts.join(''));
    }
  });
  
  return paragraphs.join('\n');
}

// ─── Field Extractors ──────────────────────────────────────────
function extract(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1]?.trim() || match[0]?.trim();
  }
  return null;
}

function detectContractType(text) {
  if (/договор\s+(проката|аренды)/i.test(text)) return 'rental';
  if (/купли[\s-]?продажи/i.test(text)) return 'sale';
  if (/субаренды/i.test(text)) return 'subrent';
  return null;
}

function extractRentalFields(text) {
  return {
    renter_full_name: extract(text, [
      /([А-ЯЁ][а-яё]+(?:\s+[А-ЯЁ][а-яё]+){1,2}),?\s+именуемый/i,
      /Арендатор[,\s:]+([А-ЯЁ][а-яё]+(?:\s+[А-ЯЁ][а-яё]+){1,2})/i,
    ]),
    renter_passport: extract(text, [
      /паспорт\s+(?:серии?\s+)?(\d{4}\s+\d{6})/i,
      /серия\s+(\d{4})\s*№?\s*(\d{6})/i,
    ]),
    renter_passport_issue_date: extract(text, [
      /выдан[оа]?\s+«?(\d{1,2})»?\s+(\S+)\s+(\d{4})/i,
      /дата выдачи[:\s]+(\d{2}\.\d{2}\.\d{4})/i,
    ]),
    renter_passport_issued_by: extract(text, [
      /выдан[оа]?\s+«?\d{1,2}»?\s+\S+\s+\d{4}\s+(.+?)(?:,\s*зарегистрирован|\.)/i,
      /кем выдан[оа]?\s*[:.]?\s*(.+?)(?:,\s*зарегистрирован|\.)/i,
    ]),
    renter_registration: extract(text, [
      /зарегистрирован[а]?\s+по\s+адресу[:\s]+(.+?)(?:\.|;\s*Арендодатель)/i,
      /адрес регистрации[:\s]+(.+?)(?:\.|;)/i,
    ]),
    renter_birth_date: extract(text, [
      /дата рождения[:\s]+(\d{2}\.\d{2}\.\d{4})/i,
      /родился[а]?\s+«?(\d{1,2})»?\s+(\S+)\s+(\d{4})/i,
    ]),
    bike_make: extract(text, [
      /марка\/модель\s+(\S+)\s+(.+?)[,\n]/i,
      /транспортное средство[:\s]+(\S+)\s+(.+?)[,\n]/i,
    ]),
    bike_model: extract(text, [
      /марка\/модель\s+\S+\s+(.+?)[,\n]/i,
    ]),
    bike_vin: extract(text, [
      /(?:VIN|вин|серийный\s+№\s+рамы)[\s:]+([A-HJ-NPR-Z0-9]{17})/i,
    ]),
    bike_year: extract(text, [
      /год изготовления[:\s]+(\d{4})/i,
    ]),
    rent_start_date: extract(text, [
      /с\s+[«"]?(\d{1,2})[»"]?\s+(\S+)\s+(\d{4})/i,
      /арендная плата[^\n]*?с\s+(\d{2}\.\d{2}\.\d{4})/i,
    ]),
    rent_end_date: extract(text, [
      /по\s+[«"]?(\d{1,2})[»"]?\s+(\S+)\s+(\d{4})/i,
      /по\s+[«"]?(\d{2}\.\d{2}\.\d{4})[»"]?/i,
    ]),
    deposit_rub: extract(text, [
      /депозит[:\s]+(\d[\d\s]+)\s*руб/i,
      /обеспечительный платёж[:\s]+(\d[\d\s]+)\s*руб/i,
    ]),
    daily_price_rub: extract(text, [
      /(\d[\d\s]+)\s*руб\.\s*за\s+сутки/i,
      /сутки[:(\s]+(\d[\d\s]+)\s*руб/i,
    ]),
    contract_number: extract(text, [
      /ДОГОВОР\s+№\s*(\S+)/i,
      /договор\s+(?:проката|аренды)\s+№\s*(\S+)/i,
    ]),
  };
}

function extractSaleFields(text) {
  return {
    buyer_full_name: extract(text, [
      /([А-ЯЁ][а-яё]+(?:\s+[А-ЯЁ][а-яё]+){1,2}),?\s+именуемый/i,
      /Покупатель[,\s:]+([А-ЯЁ][а-яё]+(?:\s+[А-ЯЁ][а-яё]+){1,2})/i,
    ]),
    buyer_passport_number: extract(text, [
      /паспорт\s+(?:серии?\s+)?(\d{4}\s+\d{6})/i,
      /серия\s+(\d{4})\s*№?\s*(\d{6})/i,
    ]),
    buyer_passport_issued_by: extract(text, [
      /выдан[оа]?\s+«?\d{1,2}»?\s+\S+\s+\d{4}\s+(.+?)(?:,\s*зарегистрирован|\.)/i,
    ]),
    buyer_passport_issue_date: extract(text, [
      /выдан[оа]?\s+«?(\d{1,2})»?\s+(\S+)\s+(\d{4})/i,
    ]),
    buyer_registration: extract(text, [
      /зарегистрирован[а]?\s+по\s+адресу[:\s]+(.+?)(?:\.|;\s*Покупатель)/i,
    ]),
    product_name: extract(text, [
      /(?:транспортное средство|мотоцикл|изделие)[:\s]+(.+?)[,\n]/i,
    ]),
    sale_price: extract(text, [
      /(?:цена|стоимость|сумма)[\s:]+(\d[\d\s]+)\s*руб/i,
      /(\d[\d\s]+)\s*руб\.\s*(?:\(|за\s)/i,
    ]),
    contract_number: extract(text, [
      /ДОГОВОР\s+№\s*(\S+)/i,
      /купли[\s-]?продажи\s+№\s*(\S+)/i,
    ]),
  };
}

function extractSubrentFields(text) {
  return {
    owner_full_name: extract(text, [
      /([А-ЯЁ][а-яё]+(?:\s+[А-ЯЁ][а-яё]+){1,2}),?\s+именуемый/i,
      /Собственник[,\s:]+([А-ЯЁ][а-яё]+(?:\s+[А-ЯЁ][а-яё]+){1,2})/i,
    ]),
    owner_passport_series: extract(text, [
      /паспорт\s+серии?\s+(\d{4})/i,
    ]),
    owner_passport_number: extract(text, [
      /паспорт\s+(?:серии?\s+)?\d{4}\s*№?\s*(\d{6})/i,
    ]),
    owner_percentage: extract(text, [
      /(\d+)%\s*(?:от\s+)?(?:выручк|доход|арендн)/i,
      /процент\s+собственника[:\s]+(\d+)/i,
    ]),
    bike_make: extract(text, [
      /мотоцикл[:\s]+(\S+)\s+(.+?)[,\n]/i,
      /марка[:\s]+(\S+)/i,
    ]),
    bike_model: extract(text, [
      /мотоцикл[:\s]+\S+\s+(.+?)[,\n]/i,
      /модель[:\s]+(.+?)[,\n]/i,
    ]),
    contract_number: extract(text, [
      /ДОГОВОР\s+№\s*(\S+)/i,
      /субаренды\s+№\s*(\S+)/i,
    ]),
  };
}

// ─── Main ──────────────────────────────────────────────────────
async function main() {
  console.log('🔍 Scanning storage bucket:', BUCKET);
  if (DRY_RUN) console.log('⚠️  DRY RUN — no writes');
  if (TYPE_FILTER) console.log(`📋 Type filter: ${TYPE_FILTER}`);

  // List all files recursively
  const files = await listAllFiles('');
  console.log(`📁 Found ${files.length} files in bucket`);

  const docxFiles = files.filter(f => f.name.endsWith('.docx'));
  console.log(`📄 ${docxFiles.length} DOCX files to process`);

  let created = 0, skipped = 0, errors = 0;

  for (const file of docxFiles) {
    try {
      console.log(`\n── Processing: ${file.name}`);
      
      // Download DOCX
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .download(file.name);
      
      if (error) {
        console.error(`  ❌ Download failed: ${error.message}`);
        errors++;
        continue;
      }

      const buffer = Buffer.from(await data.arrayBuffer());
      const sha256 = createHash('sha256').update(buffer).digest('hex');
      
      // Parse DOCX
      const text = await parseDocxToText(buffer);
      const contractType = detectContractType(text);
      
      if (!contractType) {
        console.log('  ⚠️  Could not detect contract type, skipping');
        skipped++;
        continue;
      }
      
      if (TYPE_FILTER && contractType !== TYPE_FILTER) {
        console.log(`  ⏭️  Type mismatch (${contractType} vs ${TYPE_FILTER}), skipping`);
        skipped++;
        continue;
      }

      console.log(`  📋 Type: ${contractType}`);

      // Extract fields based on type
      let fields;
      let tableName;
      let dedupKey;
      
      switch (contractType) {
        case 'rental':
          fields = extractRentalFields(text);
          tableName = 'rental_contract_artifacts';
          dedupKey = fields.contract_number ? `rental-${fields.contract_number}` : null;
          break;
        case 'sale':
          fields = extractSaleFields(text);
          tableName = 'sale_contract_artifacts';
          dedupKey = fields.contract_number ? `sale-${fields.contract_number}` : null;
          break;
        case 'subrent':
          fields = extractSubrentFields(text);
          tableName = 'subrent_contract_artifacts';
          dedupKey = fields.contract_number ? `subrent-${fields.contract_number}` : null;
          break;
      }

      // Log extracted fields
      const nonNull = Object.entries(fields).filter(([k, v]) => v != null);
      console.log(`  📝 Extracted ${nonNull.length} fields:`, nonNull.map(([k]) => k).join(', '));

      // Dedup check: look for existing artifact with same contract_key or sha256
      const existingBySha = await supabase
        .from(tableName)
        .select('id, contract_key, storage_path')
        .eq('original_sha256', sha256)
        .maybeSingle();

      const existingByKey = dedupKey ? await supabase
        .from(tableName)
        .select('id, contract_key, storage_path')
        .eq('contract_key', dedupKey)
        .maybeSingle() : null;

      const existing = existingBySha.data || existingByKey?.data;

      if (existing) {
        console.log(`  ℹ️  Already exists (id: ${existing.id.slice(0, 8)}..., key: ${existing.contract_key})`);
        
        // Update storage_path if missing
        if (!existing.storage_path && !DRY_RUN) {
          const { error: updateErr } = await supabase
            .from(tableName)
            .update({ storage_path: file.name })
            .eq('id', existing.id);
          
          if (updateErr) {
            console.error(`  ❌ Failed to update storage_path: ${updateErr.message}`);
          } else {
            console.log(`  ✅ Updated storage_path: ${file.name}`);
          }
        }
        skipped++;
        continue;
      }

      // Create new artifact
      const contractKey = dedupKey || `${contractType}-${Date.now()}`;
      const insertData = {
        contract_key: contractKey,
        storage_path: file.name,
        original_sha256: sha256,
        telegram_chat_id: null,
        template_version: 1,
        created_at: new Date().toISOString(),
        ...fields,
      };

      if (DRY_RUN) {
        console.log('  📝 Would insert:', JSON.stringify(insertData, null, 2).slice(0, 500));
      } else {
        const { error: insertErr } = await supabase
          .from(tableName)
          .insert(insertData);
        
        if (insertErr) {
          console.error(`  ❌ Insert failed: ${insertErr.message}`);
          errors++;
        } else {
          console.log(`  ✅ Created: ${contractKey}`);
          created++;
        }
      }
    } catch (err) {
      console.error(`  ❌ Error: ${err.message}`);
      errors++;
    }
  }

  console.log(`\n${'═'.repeat(50)}`);
  console.log(`✅ Created: ${created}`);
  console.log(`⏭️  Skipped: ${skipped}`);
  console.log(`❌ Errors: ${errors}`);
}

async function listAllFiles(prefix) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .list(prefix, { limit: 1000, sortBy: { column: 'name', order: 'asc' } });
  
  if (error) throw new Error(`List failed: ${error.message}`);
  
  let allFiles = [];
  for (const item of data || []) {
    if (item.id === null) {
      // It's a folder, recurse
      const subFiles = await listAllFiles(`${prefix}${item.name}/`);
      allFiles = allFiles.concat(subFiles);
    } else {
      allFiles.push({ ...item, name: `${prefix}${item.name}` });
    }
  }
  
  return allFiles;
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
