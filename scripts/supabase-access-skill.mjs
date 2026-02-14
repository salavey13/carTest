#!/usr/bin/env node

/**
 * Supabase access skill
 *
 * Modes:
 *   count           - row count for one table
 *   growth          - month-by-month growth stats from created_at / updated_at
 *   usage           - quick usage signal for important tables (rows + latest activity)
 *   migration-drift - compare local migration CREATE TABLE list vs exposed Supabase REST tables
 *
 * Examples:
 *   node scripts/supabase-access-skill.mjs count --schema public --table users
 *   node scripts/supabase-access-skill.mjs growth --table users --idField user_id
 *   node scripts/supabase-access-skill.mjs usage --tables users,crews,shifts,cars
 *   node scripts/supabase-access-skill.mjs migration-drift
 */

import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const [mode, ...args] = process.argv.slice(2);

function getArg(name, fallback = undefined) {
  const idx = args.indexOf(`--${name}`);
  if (idx === -1) return fallback;
  return args[idx + 1];
}

function parseCsvArg(name, fallback = []) {
  const value = getArg(name);
  if (!value) return fallback;
  return value.split(',').map((v) => v.trim()).filter(Boolean);
}

function parseContentRange(contentRange) {
  if (!contentRange) return null;
  const parts = contentRange.split('/');
  if (parts.length !== 2) return null;
  const total = Number(parts[1]);
  return Number.isFinite(total) ? total : null;
}

function restRequest({ supabaseUrl, serviceRoleKey, path, method = 'GET', headers = [], body = null, outputMode = 'body' }) {
  const curlArgs = ['-sS'];
  if (method !== 'GET') curlArgs.push('-X', method);
  curlArgs.push(`${supabaseUrl}${path}`);
  curlArgs.push('-H', `apikey: ${serviceRoleKey}`);
  curlArgs.push('-H', `Authorization: Bearer ${serviceRoleKey}`);
  for (const header of headers) {
    curlArgs.push('-H', header);
  }

  if (outputMode === 'headers') {
    curlArgs.push('-D', '-', '-o', '/dev/null');
  }

  if (body) {
    curlArgs.push('-H', 'Content-Type: application/json', '-d', JSON.stringify(body));
  }

  const curl = spawnSync('curl', curlArgs, { encoding: 'utf8' });
  if (curl.status !== 0) {
    throw new Error(`Supabase request failed for ${path}: ${curl.stderr || curl.stdout}`);
  }
  return outputMode === 'headers' ? curl.stdout : curl.stdout.trim();
}

function fetchTableCount({ supabaseUrl, serviceRoleKey, schema, table }) {
  const headersText = restRequest({
    supabaseUrl,
    serviceRoleKey,
    path: `/rest/v1/${table}?select=*`,
    headers: [`Accept-Profile: ${schema}`, 'Prefer: count=exact'],
    outputMode: 'headers',
  });

  const contentRangeHeader = headersText
    .split('\n')
    .find((line) => line.toLowerCase().startsWith('content-range:'));

  const contentRange = contentRangeHeader?.split(':').slice(1).join(':').trim();
  const count = parseContentRange(contentRange);
  if (count === null) {
    throw new Error(`Could not parse count for ${schema}.${table}. Raw headers:\n${headersText}`);
  }
  return count;
}

function fetchJsonRows({ supabaseUrl, serviceRoleKey, schema, table, select, order, limit }) {
  const params = [`select=${encodeURIComponent(select)}`];
  if (order) params.push(`order=${encodeURIComponent(order)}`);
  if (limit) params.push(`limit=${Number(limit)}`);
  const path = `/rest/v1/${table}?${params.join('&')}`;
  const body = restRequest({
    supabaseUrl,
    serviceRoleKey,
    path,
    headers: [`Accept-Profile: ${schema}`],
  });
  return JSON.parse(body || '[]');
}

function safeFetchJsonRows(options) {
  try {
    return fetchJsonRows(options);
  } catch {
    return [];
  }
}

function monthKey(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}`;
}

function runCountMode(ctx) {
  const table = getArg('table', 'users');
  const count = fetchTableCount({ ...ctx, table });
  console.log(JSON.stringify({ schema: ctx.schema, table, count }, null, 2));
}

function runGrowthMode(ctx) {
  const table = getArg('table', 'users');
  const createdAtField = getArg('createdAtField', 'created_at');
  const updatedAtField = getArg('updatedAtField', 'updated_at');
  const idField = getArg('idField', 'user_id');

  const rows = fetchJsonRows({
    ...ctx,
    table,
    select: `${idField},${createdAtField},${updatedAtField}`,
    order: `${createdAtField}.asc`,
    limit: getArg('limit'),
  });

  const byMonth = new Map();
  for (const row of rows) {
    const createdMonth = monthKey(row[createdAtField]);
    if (createdMonth) {
      const item = byMonth.get(createdMonth) || { month: createdMonth, newUsers: 0, updatedUsers: 0 };
      item.newUsers += 1;
      byMonth.set(createdMonth, item);
    }

    const updatedMonth = monthKey(row[updatedAtField]);
    if (updatedMonth) {
      const item = byMonth.get(updatedMonth) || { month: updatedMonth, newUsers: 0, updatedUsers: 0 };
      item.updatedUsers += 1;
      byMonth.set(updatedMonth, item);
    }
  }

  const months = [...byMonth.keys()].sort();
  let cumulativeUsers = 0;
  const series = months.map((month) => {
    const item = byMonth.get(month);
    cumulativeUsers += item.newUsers;
    return {
      month,
      newUsers: item.newUsers,
      updatedUsers: item.updatedUsers,
      cumulativeUsers,
    };
  });

  const output = {
    schema: ctx.schema,
    table,
    sampleSize: rows.length,
    series,
  };
  console.log(JSON.stringify(output, null, 2));
}

function getExposedTables(ctx) {
  const raw = restRequest({
    ...ctx,
    path: '/rest/v1/',
  });
  const openApi = JSON.parse(raw);
  const paths = Object.keys(openApi.paths || {});
  return paths
    .map((path) => path.replace(/^\//, '').split('?')[0])
    .filter((name) => name && !name.startsWith('rpc/'))
    .sort();
}

function runUsageMode(ctx) {
  const priorityTables = parseCsvArg('tables', ['users', 'crews', 'shifts', 'cars']);
  const report = [];

  for (const table of priorityTables) {
    try {
      const count = fetchTableCount({ ...ctx, table });
      const latestRows = safeFetchJsonRows({
        ...ctx,
        table,
        select: 'updated_at,created_at',
        order: 'updated_at.desc',
        limit: 1,
      });
      const latest = latestRows[0]?.updated_at || latestRows[0]?.created_at || null;
      report.push({ table, count, latestActivityAt: latest });
    } catch (error) {
      report.push({ table, error: error.message });
    }
  }

  const sorted = report.slice().sort((a, b) => {
    const ac = a.count ?? -1;
    const bc = b.count ?? -1;
    return bc - ac;
  });

  console.log(JSON.stringify({ schema: ctx.schema, report: sorted }, null, 2));
}

function extractTablesFromMigrations() {
  const migrationList = spawnSync('bash', ['-lc', 'rg --files supabase/migrations'], { encoding: 'utf8' });
  if (migrationList.status !== 0) {
    throw new Error(`Could not list migration files: ${migrationList.stderr || migrationList.stdout}`);
  }

  const files = migrationList.stdout.split('\n').map((line) => line.trim()).filter(Boolean).sort();
  const tables = new Set();

  for (const file of files) {
    const sql = readFileSync(join(process.cwd(), file), 'utf8');
    const regex = /create\s+table\s+(if\s+not\s+exists\s+)?(?:public\.)?"?([a-zA-Z0-9_]+)"?/gi;
    let match;
    while ((match = regex.exec(sql)) !== null) {
      tables.add(match[2]);
    }
  }

  return [...tables].sort();
}

function runMigrationDriftMode(ctx) {
  const expectedFromMigrations = extractTablesFromMigrations();
  const exposedTables = getExposedTables(ctx);

  const missingInSupabase = expectedFromMigrations.filter((table) => !exposedTables.includes(table));
  const extraInSupabase = exposedTables.filter((table) => !expectedFromMigrations.includes(table));

  console.log(JSON.stringify({
    expectedFromMigrations,
    exposedTables,
    missingInSupabase,
    extraInSupabase,
    summary: {
      expectedCount: expectedFromMigrations.length,
      exposedCount: exposedTables.length,
      missingCount: missingInSupabase.length,
      extraCount: extraInSupabase.length,
    },
  }, null, 2));
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || getArg('supabaseUrl');
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || getArg('serviceRoleKey');
const schema = getArg('schema', 'public');

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const usage = 'Usage: node scripts/supabase-access-skill.mjs <count|growth|usage|migration-drift> [--schema public] [--table users]';

try {
  const ctx = { supabaseUrl, serviceRoleKey, schema };

  if (mode === 'count') {
    runCountMode(ctx);
  } else if (mode === 'growth') {
    runGrowthMode(ctx);
  } else if (mode === 'usage') {
    runUsageMode(ctx);
  } else if (mode === 'migration-drift') {
    runMigrationDriftMode(ctx);
  } else {
    console.error(usage);
    process.exit(1);
  }
} catch (error) {
  console.error(error.message || error);
  process.exit(1);
}
