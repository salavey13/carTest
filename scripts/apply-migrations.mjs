#!/usr/bin/env node
/**
 * Migration Executor - Displays SQL for manual execution
 * Provides instructions and SQL for applying migrations via Supabase Dashboard
 */

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Known project details
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://inmctohsodgdohamhzag.supabase.co';
const PROJECT_ID = 'inmctohsodgdohamhzag';

// Display instructions for manual execution
async function main() {
  const migrationsDir = join(__dirname, '../supabase/migrations');
  const migrations = [
    '20260610000000_daily_insights_cron.sql',
    '20260610000001_add_total_sum_to_artifacts.sql'
  ];

  console.log('📋 Migrations to apply to remote Supabase:');
  console.log(`   Project: ${PROJECT_ID}.supabase.co`);
  console.log(`   URL: ${SUPABASE_URL}\n`);

  for (const migration of migrations) {
    const filePath = join(migrationsDir, migration);

    if (!existsSync(filePath)) {
      console.log(`⚠️  Migration not found: ${migration}`);
      continue;
    }

    const sql = readFileSync(filePath, 'utf-8');
    const lineCount = sql.split('\n').length;

    console.log(`📄 ${migration} (${lineCount} lines)`);
    console.log('─'.repeat(60));
    console.log(sql);
    console.log('─'.repeat(60));
    console.log();
  }

  console.log('💡 To execute these migrations:');
  console.log(`   1. Go to https://supabase.com/dashboard/project/${PROJECT_ID}/sql/new`);
  console.log('   2. Copy and paste each migration SQL separately');
  console.log('   3. Click "Run" to execute\n');

  console.log('⚠️  CRON_SECRET is already set to "13131313" in app.settings and .env');
  console.log('   (The migration inserts it if not exists)');
}

main().catch(console.error);
