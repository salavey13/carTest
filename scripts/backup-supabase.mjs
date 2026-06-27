#!/usr/bin/env node
/**
 * backup-supabase.mjs — DEPENDENCY-FREE (uses curl only)
 * 
 * Exports all Supabase tables (public + private) to JSON files.
 * Read-only, safe to run anytime.
 * 
 * Usage:
 *   node scripts/backup-supabase.mjs                    # Full backup
 *   node scripts/backup-supabase.mjs --schema private   # Only private
 *   node scripts/backup-supabase.mjs --table cars        # Single table
 *   node scripts/backup-supabase.mjs --list              # Show table sizes
 */

import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://inmctohsodgdohamhzag.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_KEY) { console.error('Missing SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }

const SCHEMA_FILTER = process.argv.find(a => a.startsWith('--schema='))?.split('=')[1];
const TABLE_FILTER = process.argv.find(a => a.startsWith('--table='))?.split('=')[1];
const IS_LIST = process.argv.includes('--list');

const TABLES = {
  public: ['crews', 'crew_members', 'users', 'cars', 'rentals', 'crew_todos', 'analytics_passwords'],
  private: ['rental_contract_artifacts', 'sale_contract_artifacts', 'subrent_contract_artifacts', 'user_rental_secrets', 'crew_secrets'],
};

function fetchAll(schema, table) {
  const allData = [];
  let from = 0;
  const pageSize = 1000;
  const headers = ['-H', `apikey: ${SERVICE_KEY}`, '-H', `Authorization: Bearer ${SERVICE_KEY}`];
  if (schema !== 'public') headers.push('-H', `Accept-Profile: ${schema}`);

  while (true) {
    const r = spawnSync('curl', ['-sS',
      `${SUPABASE_URL}/rest/v1/${table}?select=*&offset=${from}&limit=${pageSize}`,
      ...headers], { encoding: 'utf8' });
    if (r.status !== 0) return { error: r.stderr };

    let data;
    try { data = JSON.parse(r.stdout || '[]'); } catch { return { error: `Parse error: ${r.stdout?.slice(0, 200)}` }; }
    if (!Array.isArray(data)) return { error: `Unexpected: ${JSON.stringify(data).slice(0, 200)}` };
    if (data.length === 0) break;

    allData.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return { data: allData };
}

// List mode
if (IS_LIST) {
  console.log('\n📋 Supabase Table Sizes\n');
  for (const [schema, tables] of Object.entries(TABLES)) {
    if (SCHEMA_FILTER && schema !== SCHEMA_FILTER) continue;
    for (const table of tables) {
      if (TABLE_FILTER && table !== TABLE_FILTER) continue;
      const { data, error } = fetchAll(schema, table);
      const count = error ? `✗ ${error}` : `${data?.length || 0} rows`;
      console.log(`  ${schema}.${table.padEnd(35)} ${count}`);
    }
  }
  console.log('');
  process.exit(0);
}

// Backup mode
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const backupDir = join(process.cwd(), 'backups', `supabase-${timestamp}`);
mkdirSync(backupDir, { recursive: true });

console.log(`\n💾 Supabase Backup → ${backupDir}\n`);

const manifest = { timestamp, tables: {} };
const schemas = SCHEMA_FILTER ? [SCHEMA_FILTER] : Object.keys(TABLES);

for (const schema of schemas) {
  const schemaDir = join(backupDir, schema);
  mkdirSync(schemaDir, { recursive: true });

  let tables = TABLES[schema] || [];
  if (TABLE_FILTER) tables = tables.filter(t => t === TABLE_FILTER);

  for (const table of tables) {
    process.stdout.write(`  ${schema}.${table}... `);
    const { data, error } = fetchAll(schema, table);

    if (error) {
      console.log(`✗ ${error}`);
      manifest.tables[`${schema}.${table}`] = { error };
      continue;
    }

    const count = data?.length || 0;
    writeFileSync(join(schemaDir, `${table}.json`), JSON.stringify(data, null, 2));
    manifest.tables[`${schema}.${table}`] = { count };
    console.log(`${count} rows`);
  }
}

writeFileSync(join(backupDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

const total = Object.values(manifest.tables).reduce((s, t) => s + (t.count || 0), 0);
console.log(`\n📊 ${Object.keys(manifest.tables).length} tables, ${total} rows total`);
console.log(`   Manifest: ${join(backupDir, 'manifest.json')}\n`);
