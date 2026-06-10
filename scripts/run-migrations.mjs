#!/usr/bin/env node
/**
 * Migration Runner Script
 *
 * Executes SQL migrations from supabase/migrations folder
 * Uses service_role key for admin access
 *
 * Usage:
 *   node scripts/run-migrations.mjs [migration-file]
 *
 *   If migration-file is specified, runs only that migration
 *   Otherwise, lists pending migrations
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get Supabase credentials from environment
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase credentials in environment');
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const migrationsDir = join(__dirname, '../supabase/migrations');

/**
 * Get list of all migration files sorted by name
 */
function getMigrationFiles() {
  if (!existsSync(migrationsDir)) {
    console.error(`❌ Migrations directory not found: ${migrationsDir}`);
    process.exit(1);
  }

  const files = readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  return files;
}

/**
 * Read migration file content
 */
function readMigrationFile(filename) {
  const filePath = join(migrationsDir, filename);
  return readFileSync(filePath, 'utf-8');
}

/**
 * Execute SQL migration
 */
async function executeMigration(sql) {
  // Use RPC to execute raw SQL
  // Note: This requires the database to have a function that can execute arbitrary SQL
  // For now, we'll split by statements and execute each one

  // Split by semicolon, but ignore semicolons inside $$...$$ blocks
  const statements = splitSqlStatements(sql);

  const results = [];
  for (const statement of statements) {
    if (statement.trim()) {
      try {
        // Use pgadmin or direct query - for complex SQL with extensions,
        // we might need a different approach
        const { data, error } = await supabase.rpc('exec_sql', { sql: statement });

        if (error) {
          // If exec_sql doesn't exist, we'll need to use a different method
          console.warn(`⚠️  Could not execute via RPC: ${error.message}`);
          results.push({ statement: statement.substring(0, 50) + '...', status: 'skipped', error: error.message });
        } else {
          results.push({ statement: statement.substring(0, 50) + '...', status: 'success', data });
        }
      } catch (e) {
        results.push({ statement: statement.substring(0, 50) + '...', status: 'error', error: e.message });
      }
    }
  }

  return results;
}

/**
 * Split SQL into statements, handling $$...$$ blocks
 */
function splitSqlStatements(sql) {
  const statements = [];
  let current = '';
  let inDollarQuote = false;
  let dollarQuoteTag = '';

  const lines = sql.split('\n');

  for (const line of lines) {
    // Check for $$...$$
    if (line.includes('$$')) {
      if (!inDollarQuote) {
        inDollarQuote = true;
        dollarQuoteTag = '$$';
      } else {
        inDollarQuote = false;
        dollarQuoteTag = '';
      }
    }

    current += line + '\n';

    // Only split on semicolon if not in dollar quote
    if (!inDollarQuote && line.trim().endsWith(';')) {
      statements.push(current);
      current = '';
    }
  }

  if (current.trim()) {
    statements.push(current);
  }

  return statements;
}

/**
 * List all migrations
 */
function listMigrations() {
  const files = getMigrationFiles();

  console.log(`📋 Available Migrations (${files.length} total):\n`);

  for (const file of files) {
    const filePath = join(migrationsDir, file);
    const stats = readFileSync(filePath, 'utf-8');
    const lineCount = stats.split('\n').length;

    console.log(`  📄 ${file} (${lineCount} lines)`);
  }
}

/**
 * Run a single migration
 */
async function runMigration(filename) {
  const filePath = join(migrationsDir, filename);

  if (!existsSync(filePath)) {
    console.error(`❌ Migration file not found: ${filename}`);
    process.exit(1);
  }

  console.log(`🔄 Running migration: ${filename}\n`);

  const sql = readMigrationFile(filename);

  try {
    // For migrations that create functions, views, or use pg_cron
    // we need to execute them directly via the postgres connection
    // Since we can't do that easily via JS client, let's print the SQL
    // and instructions for manual execution

    console.log(`⚠️  This migration requires manual execution via Supabase Dashboard or psql.`);
    console.log(`\n📋 SQL to execute:\n`);
    console.log('─'.repeat(60));
    console.log(sql);
    console.log('─'.repeat(60));

    console.log(`\n💡 To execute this migration:`);
    console.log(`   1. Go to https://inmctohsodgdohamhzag.supabase.co`);
    console.log(`   2. Navigate to SQL Editor`);
    console.log(`   3. Paste and run the SQL above`);

  } catch (error) {
    console.error(`❌ Error reading migration: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Run new migrations (not yet applied)
 */
async function runNewMigrations() {
  console.log(`🔍 Checking for new migrations...\n`);

  const files = getMigrationFiles();

  // For now, just list them - actual tracking would require a migrations table
  console.log(`📋 Migrations to apply:\n`);

  const newMigrations = [
    '20260610000000_daily_insights_cron.sql',
    '20260610000001_add_total_sum_to_artifacts.sql'
  ];

  for (const file of files) {
    if (newMigrations.includes(file)) {
      console.log(`  ✨ ${file} - READY TO APPLY`);
      await runMigration(file);
      console.log();
    } else {
      console.log(`  ✓ ${file} - Already applied (assumed)`);
    }
  }
}

// CLI entry point
const args = process.argv.slice(2);
const command = args[0];

if (command === 'list') {
  listMigrations();
} else if (command === 'run' && args[1]) {
  await runMigration(args[1]);
} else if (command === 'run-new') {
  await runNewMigrations();
} else {
  console.log(`
Migration Runner

Usage:
  node scripts/run-migrations.mjs list          - List all migrations
  node scripts/run-migrations.mjs run <file>   - Show SQL for a migration
  node scripts/run-migrations.mjs run-new       - Run new migrations

Migrations:
${getMigrationFiles().map(f => `  ${f}`).join('\n')}
  `);
}
