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

function hasFlag(name) {
  return args.includes(`--${name}`);
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

function isTransientNetworkError(error) {
  const text = normalizeError(error).toLowerCase();
  return (
    text.includes('fetch failed') ||
    text.includes('econnrefused') ||
    text.includes('enotfound') ||
    text.includes('etimedout') ||
    text.includes('network')
  );
}

function restRpc(rpcName, body = {}) {
  return restRequest('POST', `rpc/${rpcName}`, body);
}

async function fallbackClaimViaRest(capability, agentId) {
  const candidates = restRequest(
    'GET',
    `supaplan_tasks?select=*&status=eq.open&capability=eq.${encodeURIComponent(capability)}&order=created_at.asc&limit=1`,
  );
  const task = Array.isArray(candidates) ? candidates[0] : null;

  if (!task) {
    return { mode: 'fallback-rest', result: { task: null } };
  }

  const now = new Date().toISOString();
  const claimedRows = restRequest(
    'PATCH',
    `supaplan_tasks?id=eq.${task.id}&status=eq.open`,
    { status: 'claimed', updated_at: now },
    'return=representation',
  );
  const claimedTask = Array.isArray(claimedRows) ? claimedRows[0] : null;

  if (!claimedTask) {
    return { mode: 'fallback-rest', result: { task: null, reason: 'race_condition' } };
  }

  const claimRows = restRequest(
    'POST',
    'supaplan_claims',
    {
      task_id: claimedTask.id,
      agent_id: agentId,
      claim_token: randomUUID(),
      status: 'claimed',
      claimed_at: now,
      last_heartbeat: now,
    },
    'return=representation',
  );

  return {
    mode: 'fallback-rest',
    result: {
      task: claimedTask,
      claim: Array.isArray(claimRows) ? claimRows[0] : claimRows,
    },
  };
}

function restRequest(method, path, body = null, prefer = null) {
  const url = required(process.env.NEXT_PUBLIC_SUPABASE_URL, 'Missing NEXT_PUBLIC_SUPABASE_URL');
  const key = required(process.env.SUPABASE_SERVICE_ROLE_KEY, 'Missing SUPABASE_SERVICE_ROLE_KEY');
  const fullUrl = `${url}/rest/v1/${path}`;

  const args = [
    '-sS',
    '-X', method,
    fullUrl,
    '-H', `apikey: ${key}`,
    '-H', `Authorization: Bearer ${key}`,
    '-H', 'Content-Type: application/json',
    '-w', '\n%{http_code}',
  ];
  if (prefer) args.push('-H', `Prefer: ${prefer}`);
  if (body !== null) args.push('-d', JSON.stringify(body));

  const result = spawnSync('curl', args, { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || 'curl request failed');
  }

  const output = result.stdout || '';
  const splitIdx = output.lastIndexOf('\n');
  const responseText = splitIdx === -1 ? output.trim() : output.slice(0, splitIdx).trim();
  const httpCodeRaw = splitIdx === -1 ? '000' : output.slice(splitIdx + 1).trim();
  const httpCode = Number.parseInt(httpCodeRaw, 10);

  let parsed = null;
  if (responseText) {
    try {
      parsed = JSON.parse(responseText);
    } catch {
      parsed = responseText;
    }
  }

  if (!Number.isFinite(httpCode) || httpCode < 200 || httpCode >= 300) {
    const details = typeof parsed === 'string' ? parsed : JSON.stringify(parsed ?? {});
    throw new Error(`REST ${method} ${path} failed with HTTP ${httpCodeRaw}: ${details}`);
  }

  return parsed;
}

function extractTaskIdFromText(text) {
  if (!text) return null;
  const match = text.match(SUPAPLAN_TASK_REF_REGEX);
  return match?.[1] ?? null;
}


function resolveCapabilityForPick(requestedCapability) {
  if (requestedCapability && requestedCapability !== 'auto') {
    return { capability: requestedCapability, source: 'arg' };
  }

  const candidates = restRequest(
    'GET',
    'supaplan_tasks?select=capability,updated_at&status=eq.open&order=updated_at.asc&limit=1',
  );
  const first = Array.isArray(candidates) ? candidates[0] : null;
  if (!first?.capability) {
    return { capability: null, source: 'auto-empty' };
  }

  return { capability: first.capability, source: 'auto-oldest-open' };
}

async function pickTask() {
  const requestedCapability = getArg('capability', 'auto');
  const agentId = getArg('agentId', process.env.SUPAPLAN_AGENT_ID || 'codex-local-agent');
  const dryRun = hasFlag('dry-run');
  const resolved = resolveCapabilityForPick(requestedCapability);

  if (!resolved.capability) {
    console.log(JSON.stringify({ mode: 'none', result: { task: null }, capabilitySource: resolved.source }, null, 2));
    return;
  }

  const capability = resolved.capability;

  if (dryRun) {
    const candidateRows = restRequest(
      'GET',
      `supaplan_tasks?select=*&status=eq.open&capability=eq.${encodeURIComponent(capability)}&order=created_at.asc&limit=1`,
    );
    const candidate = Array.isArray(candidateRows) ? candidateRows[0] : null;
    console.log(JSON.stringify({
      mode: 'dry-run',
      capability,
      capabilitySource: resolved.source,
      result: { task: candidate ?? null },
    }, null, 2));
    return;
  }

  let supabase = null;
  try {
    supabase = getAdminClient();
  } catch (error) {
    if (!isTransientNetworkError(error)) {
      throw error;
    }
  }

  if (supabase) {
    try {
      const { data, error } = await supabase.rpc('supaplan_claim_task', {
        p_capability: capability,
        p_agent: agentId,
      });

      if (!error) {
        console.log(JSON.stringify({ mode: 'rpc-js', capability, capabilitySource: resolved.source, result: data ?? { task: null } }, null, 2));
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
        console.log(JSON.stringify({ mode: 'fallback-js', capability, capabilitySource: resolved.source, result: { task: null } }, null, 2));
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
        console.log(JSON.stringify({ mode: 'fallback-js', capability, capabilitySource: resolved.source, result: { task: null } }, null, 2));
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

      console.log(JSON.stringify({ mode: 'fallback-js', capability, capabilitySource: resolved.source, result: { task: claimedTask, claim } }, null, 2));
      return;
    } catch (error) {
      if (!isTransientNetworkError(error)) {
        throw error;
      }
    }
  }

  try {
    const rpcResult = restRpc('supaplan_claim_task', {
      p_capability: capability,
      p_agent: agentId,
    });
    console.log(JSON.stringify({ mode: 'rpc-rest', capability, capabilitySource: resolved.source, result: rpcResult ?? { task: null } }, null, 2));
    return;
  } catch (error) {
    if (!isTransientNetworkError(error)) {
      throw error;
    }
  }

  try {
    const fallback = await fallbackClaimViaRest(capability, agentId);
    console.log(JSON.stringify({ ...fallback, capability, capabilitySource: resolved.source }, null, 2));
    return;
  } catch (error) {
    throw new Error(`pick-task failed in all modes (rpc-js -> rpc-rest -> fallback-rest): ${normalizeError(error)}`);
  }
}

async function updateStatus() {
  const taskId = required(getArg('taskId'), 'Missing --taskId');
  const status = required(getArg('status'), 'Missing --status');
  const now = new Date().toISOString();

  if (!ALLOWED_AGENT_STATUSES.has(status)) {
    throw new Error(`Invalid --status=${status}. Allowed: claimed|running|ready_for_pr`);
  }

  try {
    const supabase = getAdminClient();
    const { error } = await supabase
      .from('supaplan_tasks')
      .update({ status, updated_at: now })
      .eq('id', taskId);

    if (error) throw error;
  } catch (error) {
    if (!isTransientNetworkError(error)) {
      throw error;
    }

    restRequest(
      'PATCH',
      `supaplan_tasks?id=eq.${taskId}`,
      { status, updated_at: now },
      'return=minimal',
    );
  }

  console.log(JSON.stringify({ ok: true, taskId, status }, null, 2));
}

async function taskStatus() {
  const taskId = required(getArg('taskId'), 'Missing --taskId');
  let data = null;

  try {
    const supabase = getAdminClient();
    const result = await supabase
      .from('supaplan_tasks')
      .select('id,title,capability,status,updated_at,todo_path')
      .eq('id', taskId)
      .maybeSingle();

    if (result.error) throw result.error;
    data = result.data;
  } catch (error) {
    if (!isTransientNetworkError(error)) {
      throw error;
    }

    const rows = restRequest(
      'GET',
      `supaplan_tasks?select=id,title,capability,status,updated_at,todo_path&id=eq.${taskId}&limit=1`,
    );
    data = Array.isArray(rows) ? (rows[0] ?? null) : rows;
  }

  console.log(JSON.stringify({ ok: true, task: data }, null, 2));
}

async function logEvent() {
  const type = required(getArg('type'), 'Missing --type');
  const payloadRaw = getArg('payload', '{}');
  const source = getArg('source', 'codex-skill');

  let payload;
  try {
    payload = JSON.parse(payloadRaw);
  } catch {
    throw new Error('Invalid --payload JSON');
  }

  let data = null;

  try {
    const supabase = getAdminClient();
    const result = await supabase
      .from('supaplan_events')
      .insert({ source, type, payload })
      .select('*')
      .maybeSingle();

    if (result.error) throw result.error;
    data = result.data;
  } catch (error) {
    if (!isTransientNetworkError(error)) {
      throw error;
    }

    const rows = restRequest(
      'POST',
      'supaplan_events',
      { source, type, payload },
      'return=representation',
    );
    data = Array.isArray(rows) ? (rows[0] ?? null) : rows;
  }

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
  const requestedCapability = getArg('capability', 'auto');
  const agentId = getArg('agentId', process.env.SUPAPLAN_AGENT_ID || 'codex-local-agent');
  const dryRun = hasFlag('dry-run');
  const resolved = resolveCapabilityForPick(requestedCapability);

  if (!resolved.capability) {
    console.log(JSON.stringify({ mode: 'none', result: { task: null }, capabilitySource: resolved.source }, null, 2));
    return;
  }

  const capability = resolved.capability;

  if (dryRun) {
    const candidateRows = restRequest(
      'GET',
      `supaplan_tasks?select=*&status=eq.open&capability=eq.${encodeURIComponent(capability)}&order=created_at.asc&limit=1`,
    );
    const candidate = Array.isArray(candidateRows) ? candidateRows[0] : null;
    console.log(JSON.stringify({
      mode: 'dry-run',
      capability,
      capabilitySource: resolved.source,
      result: { task: candidate ?? null },
    }, null, 2));
    return;
  }

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


async function status() {
  const tasks = restRequest('GET', 'supaplan_tasks?select=id,capability,status,updated_at,title,todo_path&order=updated_at.desc&limit=200');
  const rows = Array.isArray(tasks) ? tasks : [];

  const counts = rows.reduce((acc, row) => {
    const key = row.status || 'unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const byCapability = rows.reduce((acc, row) => {
    const cap = row.capability || 'unknown';
    acc[cap] = acc[cap] || { open: 0, running: 0, ready_for_pr: 0 };
    if (row.status === 'open') acc[cap].open += 1;
    if (row.status === 'running') acc[cap].running += 1;
    if (row.status === 'ready_for_pr') acc[cap].ready_for_pr += 1;
    return acc;
  }, {});

  const oldestOpen = rows
    .filter((row) => row.status === 'open')
    .sort((a, b) => String(a.updated_at || '').localeCompare(String(b.updated_at || '')))
    .slice(0, 5)
    .map((row) => ({
      id: row.id,
      title: row.title,
      capability: row.capability,
      todo_path: row.todo_path,
      updated_at: row.updated_at,
    }));

  console.log(JSON.stringify({
    ok: true,
    total: rows.length,
    counts,
    byCapability,
    oldestOpen,
  }, null, 2));
}

async function addTask() {
  const title = required(getArg('title'), 'Missing --title');
  const capability = required(getArg('capability'), 'Missing --capability');
  const todoPath = getArg('todoPath', null);
  const status = getArg('status', 'open');

  if (status !== 'open') {
    throw new Error('Invalid --status. For planned tasks use status=open');
  }

  const payload = {
    title,
    capability,
    status,
    todo_path: todoPath,
  };

  let row = null;

  try {
    const supabase = getAdminClient();
    const result = await supabase
      .from('supaplan_tasks')
      .insert(payload)
      .select('id,title,capability,status,todo_path,created_at')
      .maybeSingle();

    if (result.error) throw result.error;
    row = result.data;
  } catch (error) {
    if (!isTransientNetworkError(error)) {
      throw error;
    }

    const rows = restRequest('POST', 'supaplan_tasks', payload, 'return=representation');
    row = Array.isArray(rows) ? (rows[0] ?? null) : rows;
  }

  console.log(JSON.stringify({ ok: true, task: row }, null, 2));
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
  'status': status,
  'add-task': addTask,
};

if (!command || !runners[command]) {
  console.error('Usage: node scripts/supaplan-skill.mjs <pick-task|update-status|task-status|log-event|inspect-migrations|review-merge-workflow|smoke-flow|status|add-task> [--key value] (pick-task supports --capability <name|auto> --agentId <id> --dry-run; add-task supports --title --capability [--todoPath])');
  process.exit(1);
}

Promise.resolve(runners[command]()).catch((error) => {
  console.error(normalizeError(error));
  process.exit(1);
});
