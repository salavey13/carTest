#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const [command, ...args] = process.argv.slice(2);

function getArg(name, fallback = undefined) {
  const idx = args.indexOf(`--${name}`);
  if (idx === -1) return fallback;
  return args[idx + 1];
}

function required(value, message) {
  if (!value) throw new Error(message);
  return value;
}

function getAdminClient() {
  const url = required(process.env.NEXT_PUBLIC_SUPABASE_URL, 'Missing NEXT_PUBLIC_SUPABASE_URL');
  const key = required(process.env.SUPABASE_SERVICE_ROLE_KEY, 'Missing SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

const ALLOWED_AGENT_STATUSES = new Set(['claimed', 'running', 'ready_for_pr']);
const CLAIM_RPC_FALLBACK_CODES = new Set(['42883', 'PGRST202']);
const SUPAPLAN_TASK_REF_REGEX = /supaplan_task\s*:\s*([0-9a-fA-F-]{36})/i;


function normalizeError(error) {
  if (!error) return 'Unknown error';
  if (error instanceof Error) return error.message;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}



function restRequest(method, path, body = null, prefer = null) {
  const url = required(process.env.NEXT_PUBLIC_SUPABASE_URL, 'Missing NEXT_PUBLIC_SUPABASE_URL');
  const key = required(process.env.SUPABASE_SERVICE_ROLE_KEY, 'Missing SUPABASE_SERVICE_ROLE_KEY');
  const fullUrl = `${url}/rest/v1/${path}`;

  const args = ['-sS', '-X', method, fullUrl, '-H', `apikey: ${key}`, '-H', `Authorization: Bearer ${key}`, '-H', 'Content-Type: application/json'];
  if (prefer) args.push('-H', `Prefer: ${prefer}`);
  if (body !== null) args.push('-d', JSON.stringify(body));

  const result = spawnSync('curl', args, { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || 'curl request failed');
  }

  const text = (result.stdout || '').trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function extractTaskIdFromText(text) {
  if (!text) return null;
  const match = text.match(SUPAPLAN_TASK_REF_REGEX);
  return match?.[1] ?? null;
}

async function pickTask() {
  const capability = required(getArg('capability'), 'Missing --capability');
  const agentId = getArg('agentId', process.env.SUPAPLAN_AGENT_ID || 'codex-local-agent');
  const supabase = getAdminClient();

  const { data, error } = await supabase.rpc('supaplan_claim_task', {
    p_capability: capability,
    p_agent: agentId,
  });

  if (!error) {
    console.log(JSON.stringify({ mode: 'rpc', result: data ?? { task: null } }, null, 2));
    return;
  }

  if (!CLAIM_RPC_FALLBACK_CODES.has(error.code ?? '')) {
    throw error;
  }

  const { data: task, error: selectError } = await supabase
    .from('supaplan_tasks')
    .select('*')
    .eq('status', 'open')
    .eq('capability', capability)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (selectError) throw selectError;
  if (!task) {
    console.log(JSON.stringify({ mode: 'fallback', result: { task: null } }, null, 2));
    return;
  }

  const now = new Date().toISOString();
  const { data: claimedTask, error: updateError } = await supabase
    .from('supaplan_tasks')
    .update({ status: 'claimed', updated_at: now })
    .eq('id', task.id)
    .eq('status', 'open')
    .select('*')
    .maybeSingle();

  if (updateError) throw updateError;
  if (!claimedTask) {
    console.log(JSON.stringify({ mode: 'fallback', result: { task: null } }, null, 2));
    return;
  }

  const { data: claim, error: claimError } = await supabase
    .from('supaplan_claims')
    .insert({
      task_id: claimedTask.id,
      agent_id: agentId,
      claim_token: randomUUID(),
      status: 'claimed',
      claimed_at: now,
      last_heartbeat: now,
    })
    .select('*')
    .maybeSingle();

  if (claimError) throw claimError;

  console.log(JSON.stringify({ mode: 'fallback', result: { task: claimedTask, claim } }, null, 2));
}

async function updateStatus() {
  const taskId = required(getArg('taskId'), 'Missing --taskId');
  const status = required(getArg('status'), 'Missing --status');
  const supabase = getAdminClient();

  if (!ALLOWED_AGENT_STATUSES.has(status)) {
    throw new Error(`Invalid --status=${status}. Allowed: claimed|running|ready_for_pr`);
  }

  const { error } = await supabase
    .from('supaplan_tasks')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', taskId);

  if (error) throw error;
  console.log(JSON.stringify({ ok: true, taskId, status }, null, 2));
}

async function taskStatus() {
  const taskId = required(getArg('taskId'), 'Missing --taskId');
  const supabase = getAdminClient();

  const { data, error } = await supabase
    .from('supaplan_tasks')
    .select('id,title,capability,status,updated_at,todo_path')
    .eq('id', taskId)
    .maybeSingle();

  if (error) throw error;
  console.log(JSON.stringify({ ok: true, task: data }, null, 2));
}

async function logEvent() {
  const type = required(getArg('type'), 'Missing --type');
  const payloadRaw = getArg('payload', '{}');
  const source = getArg('source', 'codex-skill');
  const supabase = getAdminClient();

  let payload;
  try {
    payload = JSON.parse(payloadRaw);
  } catch {
    throw new Error('Invalid --payload JSON');
  }

  const { data, error } = await supabase
    .from('supaplan_events')
    .insert({ source, type, payload })
    .select('*')
    .maybeSingle();

  if (error) throw error;
  console.log(JSON.stringify({ ok: true, event: data }, null, 2));
}

function reviewMergeWorkflow() {
  const workflowPath = '.github/workflows/supaplan-merge.yml';
  if (!existsSync(workflowPath)) {
    console.log(JSON.stringify({ ok: false, reason: `Missing ${workflowPath}` }, null, 2));
    return;
  }

  const content = readFileSync(workflowPath, 'utf8');
  const hasClosedEvent = /pull_request:\s*[\s\S]*types:\s*\[\s*closed\s*\]/m.test(content);
  const hasMergedGuard = /merged\s*==\s*true/.test(content);
  const hasSupaplanRefParse = /supaplan_task/.test(content);
  const hasDonePatch = /status\"?\s*:\s*\"done\"/.test(content) || /status.*done/.test(content);

  const parserSamples = {
    valid: 'supaplan_task:123e4567-e89b-12d3-a456-426614174000',
    validWithSpaces: 'supaplan_task : 123e4567-e89b-12d3-a456-426614174000',
    invalid: 'supaplan_task:not-a-uuid',
  };

  console.log(JSON.stringify({
    ok: hasClosedEvent && hasMergedGuard && hasSupaplanRefParse && hasDonePatch,
    checks: { hasClosedEvent, hasMergedGuard, hasSupaplanRefParse, hasDonePatch },
    parser: {
      regex: SUPAPLAN_TASK_REF_REGEX.source,
      valid: extractTaskIdFromText(parserSamples.valid),
      validWithSpaces: extractTaskIdFromText(parserSamples.validWithSpaces),
      invalid: extractTaskIdFromText(parserSamples.invalid),
    },
  }, null, 2));
}


async function smokeFlow() {
  const capability = required(getArg('capability'), 'Missing --capability');
  const agentId = getArg('agentId', process.env.SUPAPLAN_AGENT_ID || 'codex-local-agent');

  const candidates = restRequest('GET', `supaplan_tasks?select=*&status=eq.open&capability=eq.${encodeURIComponent(capability)}&order=created_at.asc&limit=1`);
  const task = Array.isArray(candidates) ? candidates[0] : null;

  if (!task) {
    console.log(JSON.stringify({ ok: true, message: 'No open task for capability', capability }, null, 2));
    return;
  }

  const claimed = restRequest('PATCH', `supaplan_tasks?id=eq.${task.id}&status=eq.open`, {
    status: 'claimed',
    updated_at: new Date().toISOString(),
  }, 'return=representation');

  if (!Array.isArray(claimed) || !claimed[0]) {
    console.log(JSON.stringify({ ok: false, message: 'Task was not claimable (race condition)', taskId: task.id }, null, 2));
    return;
  }

  const claimToken = randomUUID();
  const now = new Date().toISOString();

  const claimRow = restRequest('POST', 'supaplan_claims', {
    task_id: task.id,
    agent_id: agentId,
    claim_token: claimToken,
    status: 'claimed',
    claimed_at: now,
    last_heartbeat: now,
  }, 'return=representation');

  restRequest('PATCH', `supaplan_tasks?id=eq.${task.id}`, {
    status: 'running',
    updated_at: new Date().toISOString(),
  }, 'return=representation');

  const eventRow = restRequest('POST', 'supaplan_events', {
    source: 'codex-smoke',
    type: 'task_progress',
    payload: {
      taskId: task.id,
      step: 'smoke_flow_running_to_ready_for_pr',
      capability,
      agentId,
    },
  }, 'return=representation');

  restRequest('PATCH', `supaplan_tasks?id=eq.${task.id}`, {
    status: 'ready_for_pr',
    updated_at: new Date().toISOString(),
  }, 'return=representation');

  const finalTask = restRequest('GET', `supaplan_tasks?select=id,title,capability,status,updated_at,todo_path&id=eq.${task.id}&limit=1`);

  console.log(JSON.stringify({
    ok: true,
    simulatedFlow: ['claimed', 'running', 'ready_for_pr'],
    task: Array.isArray(finalTask) ? finalTask[0] : finalTask,
    claim: Array.isArray(claimRow) ? claimRow[0] : claimRow,
    event: Array.isArray(eventRow) ? eventRow[0] : eventRow,
  }, null, 2));
}

async function inspectMigrations() {
  const lifecycle = ['open', 'claimed', 'running', 'ready_for_pr', 'done'];
  const hasMergeWorkflow = existsSync('.github/workflows/supaplan-merge.yml');
  const fakeDoors = [
    'cleanup_stale_function.sql had stale fields/statuses in earlier drafts; verify migration order in real DB instance.',
    hasMergeWorkflow
      ? 'Merge workflow file exists; parser/secret wiring must be validated in a real merged PR run.'
      : 'No merge workflow file found to auto-promote ready_for_pr -> done.',
    'Seed SQL creates open tasks; operator must run claim->running->ready_for_pr loop to activate real flow.',
  ];

  console.log(JSON.stringify({
    lifecycle,
    currentStatus: 'phase-2-live-smoke',
    hasMergeWorkflow,
    fakeDoors,
    nextFocus: [
      'run one full claim->ready_for_pr smoke in real Supabase',
      'verify merge workflow against a merged PR containing supaplan_task:<uuid>',
      'add heartbeat updater + scheduled stale cleanup trigger',
    ],
  }, null, 2));
}

const runners = {
  'pick-task': pickTask,
  'update-status': updateStatus,
  'task-status': taskStatus,
  'log-event': logEvent,
  'inspect-migrations': inspectMigrations,
  'review-merge-workflow': reviewMergeWorkflow,
  'smoke-flow': smokeFlow,
};

if (!command || !runners[command]) {
  console.error('Usage: node scripts/supaplan-skill.mjs <pick-task|update-status|task-status|log-event|inspect-migrations|review-merge-workflow|smoke-flow> [--key value]');
  process.exit(1);
}

Promise.resolve(runners[command]()).catch((error) => {
  console.error(normalizeError(error));
  process.exit(1);
});
