#!/usr/bin/env node
/**
 * cron-skill.mjs — Supabase Cron Job Management for Agent Triggers
 *
 * Schedule and manage cron jobs that trigger agent workflows.
 * Uses pg_cron extension in Supabase.
 *
 * Usage:
 *   node scripts/cron-skill.mjs add --cron "0 9 * * *" --prompt "Send daily insights" --recurring
 *   node scripts/cron-skill.mjs list
 *   node scripts/cron-skill.mjs delete <job-id>
 *   node scripts/cron-skill.mjs enable --jobId <id>
 *   node scripts/cron-skill.mjs disable --jobId <id>
 */

import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CRON_JSON_PATH = join(process.cwd(), '.claude', 'scheduled_tasks.json');

function getArg(name, fallback = undefined) {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return fallback;
  return process.argv[idx + 1];
}

function required(value, message) {
  if (!value) throw new Error(message);
  return value;
}

function getAdminClient() {
  const url = required(process.env.NEXT_PUBLIC_SUPABASE_URL, 'Missing NEXT_PUBLIC_SUPABASE_URL');
  const key = required(process.env.SUPABASE_SERVICE_ROLE_KEY, 'Missing SUPABLAN_SERVICE_ROLE_KEY');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/**
 * Load cron jobs from local JSON file (fallback)
 */
function loadCronJobs() {
  if (!existsSync(CRON_JSON_PATH)) {
    return { jobs: [], version: 1 };
  }
  try {
    const content = readFileSync(CRON_JSON_PATH, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    return { jobs: [], version: 1 };
  }
}

/**
 * Save cron jobs to local JSON file (fallback)
 */
function saveCronJobs(data) {
  const dir = dirname(CRON_JSON_PATH);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(CRON_JSON_PATH, JSON.stringify(data, null, 2));
}

/**
 * Validate cron expression format
 */
function validateCron(cron) {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) {
    throw new Error(`Invalid cron expression: "${cron}". Expected 5 parts (min hour day month dow).`);
  }
  return cron;
}

/**
 * Generate unique job ID
 */
function generateJobId() {
  return `cron_${Date.now()}_${randomUUID().slice(0, 8)}`;
}

/**
 * Ensure pg_cron extension is enabled
 */
async function ensurePgCron(supabase) {
  try {
    // Try to enable pg_cron extension
    const { error } = await supabase.rpc('eval', {
      sql: 'CREATE EXTENSION IF NOT EXISTS pg_cron;'
    });

    if (error) {
      console.warn('⚠️  Could not enable pg_cron via RPC — may already be enabled or not available');
    }
  } catch (e) {
    console.warn('⚠️  pg_cron extension might not be available — using local fallback');
  }
}

/**
 * Create cron_jobs table if it doesn't exist
 */
async function createCronJobsTable(supabase) {
  const createTableSql = `
    CREATE TABLE IF NOT EXISTS cron_jobs (
      job_id TEXT PRIMARY KEY,
      cron_expression TEXT NOT NULL,
      prompt TEXT NOT NULL,
      recurring BOOLEAN DEFAULT false,
      capability TEXT,
      agent_id TEXT,
      status TEXT DEFAULT 'active',
      last_run TIMESTAMPTZ,
      run_count BIGINT DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS cron_jobs_status_idx ON cron_jobs(status);
    CREATE INDEX IF NOT EXISTS cron_jobs_next_run_idx ON cron_jobs(status, updated_at);
  `;

  try {
    // Use raw SQL via REST
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const result = spawnSync('curl', [
      '-s', '-X', 'POST',
      `${url}/rest/v1/rpc/eval`,
      '-H', `apikey: ${key}`,
      '-H', `Authorization: Bearer ${key}`,
      '-H', 'Content-Type: application/json',
      '-d', JSON.stringify({ sql: createTableSql })
    ], { encoding: 'utf8' });

    if (result.status !== 0) {
      console.warn('⚠️  Could not create cron_jobs table:', result.stderr);
    }
  } catch (e) {
    console.warn('⚠️  Could not create cron_jobs table:', e.message);
  }
}

/**
 * Schedule job using pg_cron
 */
async function scheduleJob(supabase, jobId, cron, metadata) {
  try {
    const executeSql = `
      -- Update job metadata
      UPDATE cron_jobs
      SET last_run = now(),
          run_count = run_count + 1,
          updated_at = now()
      WHERE job_id = '${jobId}';

      -- Create or claim a SupaPlan task for agent execution
      DO $$
      DECLARE
        v_task_id TEXT;
        v_agent_id TEXT := '${metadata.agentId}';
        v_prompt TEXT := '${metadata.prompt.replace(/'/g, "''")}';
      BEGIN
        -- Try to claim an existing open task
        SELECT id INTO v_task_id
        FROM supaplan_tasks
        WHERE capability = '${metadata.capability}'
          AND status = 'open'
        ORDER BY created_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED;

        IF v_task_id IS NOT NULL THEN
          UPDATE supaplan_tasks
          SET status = 'running',
              updated_at = now()
          WHERE id = v_task_id;
        ELSE
          -- Create new task for cron-triggered work
          v_task_id := gen_random_uuid()::TEXT;

          INSERT INTO supaplan_tasks (id, title, capability, status, body, created_at, updated_at)
          VALUES (
            v_task_id,
            'Cron: ' || LEFT(v_prompt, 50),
            '${metadata.capability}',
            'running',
            v_prompt,
            now(),
            now()
          );
        END IF;

        -- Log the cron trigger event
        INSERT INTO supaplan_events (source, type, payload)
        VALUES (
          'cron:${jobId}',
          'cron_trigger',
          jsonb_build_object(
            'task_id', v_task_id,
            'job_id', '${jobId}',
            'agent_id', v_agent_id,
            'prompt', v_prompt,
            'capability', '${metadata.capability}',
            'triggered_at', now()
          )
        );
      END $$;
    `;

    const scheduleSql = `
      SELECT cron.schedule(
        '${jobId}',
        '${cron}',
        $$${executeSql}$$
      );
    `;

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const result = spawnSync('curl', [
      '-s', '-X', 'POST',
      `${url}/rest/v1/rpc/eval`,
      '-H', `apikey: ${key}`,
      `-H`, `Authorization: Bearer ${key}`,
      '-H', 'Content-Type: application/json',
      '-d', JSON.stringify({ sql: scheduleSql })
    ], { encoding: 'utf8' });

    if (result.status !== 0) {
      console.warn('⚠️  pg_cron.schedule failed — job stored but not scheduled in pg_cron');
      return false;
    }

    return true;
  } catch (e) {
    console.warn('⚠️  Could not schedule via pg_cron:', e.message);
    return false;
  }
}

/**
 * Add a new cron job
 */
async function addCronJob() {
  const cron = required(validateCron(getArg('cron')), 'Missing or invalid --cron');
  const prompt = required(getArg('prompt'), 'Missing --prompt');
  const recurring = process.argv.includes('--recurring');
  const capability = getArg('capability', 'auto');
  const agentId = getArg('agentId', process.env.SUPAPLAN_AGENT_ID || 'cron-agent');
  const durable = process.argv.includes('--durable');

  const jobId = generateJobId();

  // Always store in local JSON as fallback
  const localData = loadCronJobs();
  const newJob = {
    id: jobId,
    cron,
    prompt,
    recurring,
    capability,
    agent_id: agentId,
    status: 'active',
    last_run: null,
    run_count: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  localData.jobs.push(newJob);
  saveCronJobs(localData);

  // Try to also store in Supabase
  const supabase = getAdminClient();
  await ensurePgCron(supabase);

  try {
    const { data: storedJob, error: storeError } = await supabase
      .from('cron_jobs')
      .insert(newJob)
      .select()
      .maybeSingle();

    if (storeError) {
      await createCronJobsTable(supabase);
      // Retry insert
      const { data: retryJob } = await supabase
        .from('cron_jobs')
        .insert(newJob)
        .select()
        .maybeSingle();
    }

    // Schedule using pg_cron
    const scheduleSuccess = await scheduleJob(supabase, jobId, cron, {
      prompt,
      capability,
      agentId,
      recurring
    });

    if (scheduleSuccess) {
      console.log('✅ Cron job scheduled in Supabase pg_cron');
    } else {
      console.log('✅ Cron job stored in Supabase (pg_cron scheduling failed, using polling fallback)');
    }
  } catch (e) {
    console.log('✅ Cron job stored locally (Supabase unavailable)');
  }

  console.log(`\n📅 Cron Job Created`);
  console.log(`   ID: ${jobId}`);
  console.log(`   Schedule: ${cron}`);
  console.log(`   Prompt: ${prompt}`);
  console.log(`   Agent: ${agentId}`);
  console.log(`   Recurring: ${recurring ? 'yes' : 'no (one-shot)'}`);
  console.log(`   Storage: ${durable ? 'Supabase + local' : 'local session-only'}\n`);

  console.log(`💡 The job will trigger agent workflow at the scheduled time.`);
  console.log(`   Run 'node scripts/cron-skill.mjs tick' to check for due jobs.\n`);
}

/**
 * List all cron jobs
 */
async function listCronJobs() {
  const localData = loadCronJobs();

  console.log(`📅 Scheduled Cron Jobs (${localData.jobs.length} total)\n`);

  if (localData.jobs.length === 0) {
    console.log('No cron jobs configured.\n');
    return;
  }

  localData.jobs.forEach((job, i) => {
    console.log(`${i + 1}. ${job.id}`);
    console.log(`   Schedule: ${job.cron}`);
    console.log(`   Prompt: ${job.prompt}`);
    console.log(`   Status: ${job.status || 'active'}`);
    console.log(`   Agent: ${job.agent_id}`);
    if (job.last_run) {
      console.log(`   Last Run: ${job.last_run}`);
      console.log(`   Run Count: ${job.run_count || 0} times`);
    }
    console.log('');
  });

  console.log(`💡 Commands:`);
  console.log(`   node scripts/cron-skill.mjs delete <job-id>`);
  console.log(`   node scripts/cron-skill.mjs run <job-id>`);
  console.log(`   node scripts/cron-skill.mjs tick\n`);
}

/**
 * Delete a cron job
 */
async function deleteCronJob() {
  const jobId = required(getArg('jobId'), 'Missing --jobId');

  // Remove from local storage
  const localData = loadCronJobs();
  const initialLength = localData.jobs.length;
  localData.jobs = localData.jobs.filter(job => job.id !== jobId);

  if (localData.jobs.length === initialLength && !localData.jobs.find(j => j.id === jobId)) {
    console.log(`❌ Job not found: ${jobId}\n`);
    return;
  }

  saveCronJobs(localData);

  // Try to unschedule from pg_cron
  const supabase = getAdminClient();
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    spawnSync('curl', [
      '-s', '-X', 'POST',
      `${url}/rest/v1/rpc/eval`,
      '-H', `apikey: ${key}`,
      `-H`, `Authorization: Bearer ${key}`,
      '-H', 'Content-Type: application/json',
      '-d', JSON.stringify({ sql: `SELECT cron.unschedule('${jobId}');` })
    ], { encoding: 'utf8' });

    // Also delete from Supabase table
    await supabase.from('cron_jobs').delete().eq('job_id', jobId);
  } catch (e) {
    // Continue anyway
  }

  console.log(`✅ Deleted cron job: ${jobId}\n`);
}

/**
 * Run a job manually
 */
async function runCronJob() {
  const jobId = required(getArg('jobId'), 'Missing --jobId');

  const localData = loadCronJobs();
  const job = localData.jobs.find(j => j.id === jobId);

  if (!job) {
    console.log(`❌ Job not found: ${jobId}\n`);
    return;
  }

  console.log(`🏃 Running job: ${job.id}`);
  console.log(`   Prompt: ${job.prompt}\n`);

  // Execute using BOSS mode executor
  const executeResult = spawnSync('node', [
    join(__dirname, '..', 'skills', 'boss-mode', 'execute.mjs'),
    'auto',
    '--capability', job.capability || 'auto',
    '--agentId', job.agent_id || 'cron-agent'
  ], {
    env: process.env,
    stdio: 'inherit'
  });

  // Update stats
  job.last_run = new Date().toISOString();
  job.run_count = (job.run_count || 0) + 1;
  saveCronJobs(localData);

  console.log(`\n✅ Job executed. Run count: ${job.run_count}\n`);

  // Remove one-shot jobs
  if (!job.recurring) {
    localData.jobs = localData.jobs.filter(j => j.id !== jobId);
    saveCronJobs(localData);
    console.log(`🗑️  Removed one-shot job: ${jobId}\n`);
  }
}

/**
 * Tick - check and execute due jobs
 */
async function tickCronJobs() {
  const localData = loadCronJobs();
  const now = new Date();
  let executedCount = 0;

  for (const job of localData.jobs) {
    if (shouldRunNow(job.cron, now)) {
      console.log(`⏰ Executing due job: ${job.id} - ${job.prompt}`);

      try {
        // Execute using BOSS mode executor
        spawnSync('node', [
          join(__dirname, '..', 'skills', 'boss-mode', 'execute.mjs'),
          'auto',
          '--capability', job.capability || 'auto',
          '--agentId', job.agent_id || 'cron-agent'
        ], {
          env: process.env,
          stdio: 'inherit'
        });

        job.last_run = now.toISOString();
        job.run_count = (job.run_count || 0) + 1;
        executedCount++;

        // Remove one-shot jobs
        if (!job.recurring) {
          console.log(`🗑️  Removing one-shot job: ${job.id}`);
          localData.jobs = localData.jobs.filter(j => j.id !== jobId);
        }
      } catch (error) {
        console.error(`❌ Error executing job ${job.id}: ${error.message}`);
      }
    }
  }

  if (executedCount > 0) {
    saveCronJobs(localData);
  }

  console.log(`\n✅ Tick complete. Executed ${executedCount} job(s).\n`);
}

/**
 * Check if a job should run now
 */
function shouldRunNow(cron, now = new Date()) {
  const parts = cron.split(/\s+/);
  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

  const currentMinute = now.getMinutes();
  const currentHour = now.getHours();
  const currentDayOfMonth = now.getDate();
  const currentMonth = now.getMonth() + 1;
  const currentDayOfWeek = now.getDay();

  if (minute !== '*' && !matchesCronPart(currentMinute, minute)) return false;
  if (hour !== '*' && !matchesCronPart(currentHour, hour)) return false;
  if (dayOfMonth !== '*' && !matchesCronPart(currentDayOfMonth, dayOfMonth)) return false;
  if (month !== '*' && !matchesCronPart(currentMonth, month)) return false;
  if (dayOfWeek !== '*' && !matchesCronPart(currentDayOfWeek, dayOfWeek)) return false;

  return true;
}

/**
 * Check if value matches cron part
 */
function matchesCronPart(value, cronPart) {
  if (cronPart.includes(',')) {
    return cronPart.split(',').some(part => matchesCronPart(value, part.trim()));
  }

  if (cronPart.includes('/')) {
    const [base, step] = cronPart.split('/');
    const stepNum = parseInt(step, 10);

    if (base === '*') {
      return value % stepNum === 0;
    }

    if (base.includes('-')) {
      const [start, end] = base.split('-').map(Number);
      if (value < start || value > end) return false;
      return (value - start) % stepNum === 0;
    }

    return value % stepNum === 0;
  }

  if (cronPart.includes('-')) {
    const [start, end] = cronPart.split('-').map(Number);
    return value >= start && value <= end;
  }

  return parseInt(cronPart, 10) === value;
}

/**
 * Enable a job
 */
async function enableCronJob() {
  const jobId = required(getArg('jobId'), 'Missing --jobId');

  const localData = loadCronJobs();
  const job = localData.jobs.find(j => j.id === jobId);

  if (!job) {
    console.log(`❌ Job not found: ${jobId}\n`);
    return;
  }

  job.status = 'active';
  saveCronJobs(localData);

  const supabase = getAdminClient();
  try {
    await supabase.from('cron_jobs').update({ status: 'active' }).eq('job_id', jobId);
  } catch (e) {
    // Continue
  }

  console.log(`✅ Enabled cron job: ${jobId}\n`);
}

/**
 * Disable a job
 */
async function disableCronJob() {
  const jobId = required(getArg('jobId'), 'Missing --jobId');

  const localData = loadCronJobs();
  const job = localData.jobs.find(j => j.id === jobId);

  if (!job) {
    console.log(`❌ Job not found: ${jobId}\n`);
    return;
  }

  job.status = 'disabled';
  saveCronJobs(localData);

  const supabase = getAdminClient();
  try {
    await supabase.from('cron_jobs').update({ status: 'disabled' }).eq('job_id', jobId);

    // Unschedule from pg_cron
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    spawnSync('curl', [
      '-s', '-X', 'POST',
      `${url}/rest/v1/rpc/eval`,
      '-H', `apikey: ${key}`,
      `-H`, `Authorization: Bearer ${key}`,
      '-H', 'Content-Type: application/json',
      '-d', JSON.stringify({ sql: `SELECT cron.unschedule('${jobId}');` })
    ], { encoding: 'utf8' });
  } catch (e) {
    // Continue
  }

  console.log(`✅ Disabled cron job: ${jobId}\n`);
}

/**
 * Show help
 */
function runHelpCommand() {
  console.log(`
Cron Job Skill for Supabase

Manage scheduled tasks that trigger agent workflows.

Usage: node scripts/cron-skill.mjs <command> [options]

Commands:
  add       Add a new cron job
  list      List all cron jobs
  delete    Delete a cron job
  run       Manually run a cron job
  tick      Check and execute due jobs
  enable    Enable a disabled job
  disable   Disable an active job
  help      Show this help message

Options for 'add':
  --cron <expression>      Cron expression (e.g., "0 9 * * *" for 9am daily)
  --prompt <text>          Task description to execute
  --recurring              Job repeats (default: true)
  --one-shot               Job runs once then auto-deletes
  --capability <name>      SupaPlan capability to use
  --agentId <id>          Agent ID to assign
  --durable                Persist in Supabase (default: false)

Examples:
  # Add daily 9am insights job
  node scripts/cron-skill.mjs add --cron "0 9 * * *" --prompt "Send daily insights" --recurring

  # List all jobs
  node scripts/cron-skill.mjs list

  # Delete a job
  node scripts/cron-skill.mjs delete cron_1234567890_abc123

  # Manually run a job
  node scripts/cron-skill.mjs run cron_1234567890_abc123

  # Check for due jobs (for cron daemon)
  node scripts/cron-skill.mjs tick

Cron Expression Format:
  minute hour day-of-month month day-of-week
  *     *    *             *     *
  0-59  0-23 1-31          1-12  0-6 (0=Sunday)

Examples:
  "0 9 * * *"      - 9:00 AM daily
  "*/5 * * * *"    - Every 5 minutes
  "0 9 * * 1-5"    - 9:00 AM weekdays
  "30 14 * * 0"    - 2:30 PM Sundays only

Integration:
  - Uses pg_cron extension in Supabase for scheduling
  - Creates SupaPlan tasks when jobs trigger
  - Executes via BOSS mode multi-agent orchestrator
  - Falls back to local JSON storage if Supabase unavailable
`);
}

// Main command router
const [command] = process.argv.slice(2);

const commands = {
  'add': addCronJob,
  'list': listCronJobs,
  'delete': deleteCronJob,
  'run': runCronJob,
  'tick': tickCronJobs,
  'enable': enableCronJob,
  'disable': disableCronJob,
  'help': runHelpCommand
};

try {
  const handler = commands[command] || runHelpCommand;
  await handler();
} catch (error) {
  console.error(`❌ Error: ${error.message}`);
  process.exit(1);
}
