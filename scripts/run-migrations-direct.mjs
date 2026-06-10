#!/usr/bin/env node
/**
 * Run migrations via PostgreSQL connection
 * Uses pg library to connect directly to Supabase database
 */

import pg from 'pg';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Try multiple methods for database connection
async function getConnectionConfig() {
  // Method 1: Direct connection string from env
  if (process.env.DATABASE_URL) {
    console.log('✓ Using DATABASE_URL from environment');
    return process.env.DATABASE_URL;
  }

  // Method 2: Construct from individual parts
  const dbHost = process.env.DB_HOST || 'db.inmctohsodgdohamhzag.supabase.co';
  const dbPort = process.env.DB_PORT || '5432';
  const dbUser = process.env.DB_USER || 'postgres';
  const dbPassword = process.env.DB_PASSWORD;
  const dbName = process.env.DB_NAME || 'postgres';

  if (dbPassword) {
    console.log('✓ Using individual DB credentials from environment');
    return `postgresql://${dbUser}:${dbPassword}@${dbHost}:${dbPort}/${dbName}`;
  }

  // Method 3: Supabase format (need db password)
  console.error('❌ Database password not found in environment');
  console.error('Please set DB_PASSWORD or DATABASE_URL environment variable');
  console.error('\nTo get your database password:');
  console.error('1. Go to https://supabase.com/dashboard/project/inmctohsodgdohamhzag/settings/database');
  console.error('2. Copy the database password');
  console.error('3. Set DB_PASSWORD=<password> in .env or environment');
  return null;
}

async function runMigrations() {
  const connectionString = await getConnectionConfig();

  if (!connectionString) {
    process.exit(1);
  }

  console.log('Connecting to database...');

  const client = new pg.Client({ connectionString });

  try {
    await client.connect();
    console.log('✓ Connected\n');

    // Read and run migrations
    const migrations = [
      { file: '20260610000002_sleep_reminder_cron.sql', name: 'Sleep Reminder Cron' },
    ];

    for (const migration of migrations) {
      const filePath = join(__dirname, '../supabase/migrations', migration.file);
      const sql = readFileSync(filePath, 'utf-8');

      console.log(`📄 Running: ${migration.name}`);
      console.log('─'.repeat(60));

      // Split by statements and execute
      const statements = sql.split(';').filter(s => s.trim() && !s.trim().startsWith('--'));

      for (const stmt of statements) {
        const trimmed = stmt.trim();
        if (!trimmed || trimmed.startsWith('--')) continue;

        try {
          await client.query(trimmed);
          console.log(`  ✓ ${trimmed.substring(0, 50)}...`);
        } catch (err) {
          console.error(`  ✗ Error: ${err.message}`);
        }
      }

      console.log('─'.repeat(60) + '\n');
    }

    console.log('✅ Migrations completed!');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

runMigrations().catch(console.error);
