#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { readdirSync, statSync } from 'node:fs';
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

const ALLOWED_AGENT_STATUSES = new Set(['claimed', 'running', 'ready_for_pr', 'ready', 'completed']);
const ALLOWED_BOSS_MODE_STATUSES = new Set(['claimed', 'running', 'ready', 'completed']);
const CLAIM_RPC_FALLBACK_CODES = new Set(['42883', 'PGRST202']);
const SUPAPLAN_TASK_REF_REGEX = /supaplan_task\s*:\s*([0-9a-fA-F-]{36})/i;
const UUID_V4_OR_COMPAT_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;


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

function listPluginManifestFiles(rootDir = 'app') {
  const manifests = [];
  const queue = [rootDir];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || !existsSync(current)) continue;

    for (const entry of readdirSync(current)) {
      const full = `${current}/${entry}`;
      const stats = statSync(full);
      if (stats.isDirectory()) {
        queue.push(full);
        continue;
      }
      if (entry === 'plugin.ts') manifests.push(full);
    }
  }

  return manifests;
}

function parsePluginManifest(filePath) {
  const source = readFileSync(filePath, 'utf8');
  const normalized = source.replace(/\r\n/g, '\n');
  const match = normalized.match(/export\s+const\s+plugin\s*=\s*(\{[\s\S]*?\})\s*;?/);
  if (!match) {
    return { ok: false, error: 'Cannot find `export const plugin = { ... }` block.' };
  }

  let objectLiteral = match[1];
  objectLiteral = objectLiteral.replace(/(\w+)\s*:/g, '"$1":');
  objectLiteral = objectLiteral.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');

  try {
    return { ok: true, value: JSON.parse(objectLiteral) };
  } catch (error) {
    return { ok: false, error: `Failed to parse plugin manifest object: ${normalizeError(error)}` };
  }
}

function validatePluginManifestShape(filePath, manifest) {
  const requiredStringFields = ['name', 'description', 'version'];
  const requiredArrayFields = ['uses', 'exports', 'capabilities'];
  const errors = [];
  const warnings = [];

  for (const key of requiredStringFields) {
    if (typeof manifest[key] !== 'string' || manifest[key].trim().length === 0) {
      errors.push(`${key} must be a non-empty string`);
    }
  }

  for (const key of requiredArrayFields) {
    if (!Array.isArray(manifest[key])) {
      errors.push(`${key} must be an array`);
      continue;
    }

    if (manifest[key].length === 0) {
      warnings.push(`${key} is empty`);
    }

    for (const item of manifest[key]) {
      if (typeof item !== 'string' || item.trim().length === 0) {
        errors.push(`${key} entries must be non-empty strings`);
        break;
      }
    }
  }

  if (typeof manifest.version === 'string' && !/^\d+\.\d+(\.\d+)?$/.test(manifest.version)) {
    warnings.push('version should follow semver-like format (x.y or x.y.z)');
  }

  if (filePath.includes('/greenbox/') && !manifest.capabilities?.some((cap) => String(cap).startsWith('greenbox'))) {
    warnings.push('greenbox manifest should include at least one capability prefixed with `greenbox`');
  }

  if (filePath.includes('/franchize/') && !manifest.capabilities?.some((cap) => String(cap).startsWith('franchize'))) {
    warnings.push('franchize manifest should include at least one capability prefixed with `franchize`');
  }

  return { errors, warnings };
}

function validateFranchizeContractDoc() {
  const contractPath = 'docs/FRANCHIZE_METADATA_CONTRACT.md';
  if (!existsSync(contractPath)) {
    return {
      ok: false,
      error: `Missing ${contractPath}. FRZ-R1 requires a frozen metadata + fallback contract document.`,
    };
  }

  const doc = readFileSync(contractPath, 'utf8');
  const requiredMarkers = ['## Frozen metadata contract (FRZ-R1)', '## Fallback matrix', '## Compatibility guarantee'];
  const missingMarkers = requiredMarkers.filter((marker) => !doc.includes(marker));

  if (missingMarkers.length > 0) {
    return {
      ok: false,
      error: `${contractPath} is missing required sections: ${missingMarkers.join(', ')}`,
    };
  }

  return { ok: true };
}

function validatePluginContracts() {
  const manifestFiles = listPluginManifestFiles();
  const report = {
    ok: true,
    checked: manifestFiles.length,
    manifests: [],
    contractGuards: [],
  };

  for (const filePath of manifestFiles) {
    const parsed = parsePluginManifest(filePath);
    if (!parsed.ok) {
      report.ok = false;
      report.manifests.push({ file: filePath, ok: false, errors: [parsed.error], warnings: [] });
      continue;
    }

    const { errors, warnings } = validatePluginManifestShape(filePath, parsed.value);
    if (errors.length > 0) report.ok = false;
    report.manifests.push({ file: filePath, ok: errors.length === 0, errors, warnings });
  }

  const franchizeContract = validateFranchizeContractDoc();
  report.contractGuards.push({
    name: 'franchize-metadata-contract',
    ok: franchizeContract.ok,
    error: franchizeContract.ok ? null : franchizeContract.error,
  });
  if (!franchizeContract.ok) report.ok = false;

  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exit(1);
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
  const mode = getArg('mode', 'pr');
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
        const response = { mode: 'rpc-js', capability, capabilitySource: resolved.source, result: data ?? { task: null }, workflow: mode === 'boss' ? 'boss' : 'pr' };
        console.log(JSON.stringify(response, null, 2));
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
        console.log(JSON.stringify({ mode: 'fallback-js', capability, capabilitySource: resolved.source, result: { task: null }, workflow: mode }, null, 2));
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
        console.log(JSON.stringify({ mode: 'fallback-js', capability, capabilitySource: resolved.source, result: { task: null }, workflow: mode }, null, 2));
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

      console.log(JSON.stringify({ mode: 'fallback-js', capability, capabilitySource: resolved.source, result: { task: claimedTask, claim }, workflow: mode }, null, 2));
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
    console.log(JSON.stringify({ mode: 'rpc-rest', capability, capabilitySource: resolved.source, result: rpcResult ?? { task: null }, workflow: mode }, null, 2));
    return;
  } catch (error) {
    if (!isTransientNetworkError(error)) {
      throw error;
    }
  }

  try {
    const fallback = await fallbackClaimViaRest(capability, agentId);
    console.log(JSON.stringify({ ...fallback, capability, capabilitySource: resolved.source, workflow: mode }, null, 2));
    return;
  } catch (error) {
    throw new Error(`pick-task failed in all modes (rpc-js -> rpc-rest -> fallback-rest): ${normalizeError(error)}`);
  }
}


function maybeNotifyStatusUpdate(taskId, status) {
  if (process.env.SUPAPLAN_NOTIFY_STATUS_UPDATES !== '1') {
    console.warn('maybeNotifyStatusUpdate skipped: set SUPAPLAN_NOTIFY_STATUS_UPDATES=1 to enable callback notifications');
    return;
  }
  const summary = `SupaPlan task ${taskId} -> ${status}`;
  try {
    spawnSync('node', ['scripts/codex-notify.mjs', 'callback-auto', '--status', status, '--summary', summary], {
      stdio: 'ignore',
      encoding: 'utf8',
    });
  } catch {
    console.warn(`maybeNotifyStatusUpdate failed for ${taskId} -> ${status}`)
  }
}

function attemptDirectCommit(taskId, agentId, commitMessage) {
  const tag = `[supaplan:${taskId.slice(0, 8)}]`;
  const fullMessage = `${tag} ${commitMessage}`;

  // Check for merge conflicts first
  const conflictCheck = spawnSync('git', ['diff', '--name-only', '--diff-filter=U'], {
    encoding: 'utf8',
    stdio: 'pipe'
  });

  if (conflictCheck.stdout && conflictCheck.stdout.trim().length > 0) {
    return {
      success: false,
      reason: 'merge_conflicts_detected',
      conflictedFiles: conflictCheck.stdout.trim().split('\n').filter(Boolean)
    };
  }

  // Stage all changes
  const addResult = spawnSync('git', ['add', '-A'], {
    encoding: 'utf8',
    stdio: 'pipe'
  });

  if (addResult.status !== 0) {
    return {
      success: false,
      reason: 'git_add_failed',
      stderr: addResult.stderr
    };
  }

  // Commit with message
  const commitResult = spawnSync('git', ['commit', '-m', fullMessage], {
    encoding: 'utf8',
    stdio: 'pipe'
  });

  if (commitResult.status !== 0) {
    return {
      success: false,
      reason: 'git_commit_failed',
      stderr: commitResult.stderr,
      stdout: commitResult.stdout
    };
  }

  return {
    success: true,
    commitHash: commitResult.stdout.trim() || 'unknown',
    message: fullMessage
  };
}

function detectMergeConflicts() {
  const result = spawnSync('git', ['diff', '--name-only', '--diff-filter=U'], {
    encoding: 'utf8',
    stdio: 'pipe'
  });

  if (result.status !== 0) {
    const response = {
      ok: false,
      error: 'git_diff_failed',
      stderr: result.stderr
    };
    console.log(JSON.stringify(response, null, 2));
    return response;
  }

  const conflictedFiles = result.stdout
    ? result.stdout.trim().split('\n').filter(Boolean)
    : [];

  const response = {
    ok: true,
    hasConflicts: conflictedFiles.length > 0,
    conflictedFiles
  };
  console.log(JSON.stringify(response, null, 2));
  return response;
}

function getConflictResolutionSuggestions() {
  const conflictResult = detectMergeConflicts();
  if (!conflictResult.ok) {
    console.log(JSON.stringify(conflictResult, null, 2));
    return conflictResult;
  }

  if (!conflictResult.hasConflicts) {
    const response = {
      ok: true,
      hasConflicts: false,
      suggestions: []
    };
    console.log(JSON.stringify(response, null, 2));
    return response;
  }

  const suggestions = conflictResult.conflictedFiles.map((file) => {
    const ext = file.split('.').pop();
    const base = file.replace(/\.[^.]*$/, '');

    return {
      file,
      strategy: ext === 'sql' ? 'accept-theirs' : 'manual-review',
      action: ext === 'sql'
        ? `git checkout --theirs "${file}" && git add "${file}"`
        : `review conflict markers in "${file}"`
    };
  });

  const response = {
    ok: true,
    hasConflicts: true,
    conflictedFiles: conflictResult.conflictedFiles,
    suggestions
  };
  console.log(JSON.stringify(response, null, 2));
  return response;
}

async function pickCheatcodeTask() {
  const agentId = getArg('agentId', process.env.SUPAPLAN_AGENT_ID || 'codex-local-agent');
  const capability = getArg('capability', 'auto');
  const dryRun = hasFlag('dry-run');
  const resolved = resolveCapabilityForPick(capability);

  if (!resolved.capability) {
    console.log(JSON.stringify({ mode: 'cheatcode', result: { task: null }, capabilitySource: resolved.source }, null, 2));
    return;
  }

  // Only pick tasks marked as polishing tasks (no file operations needed)
  const candidates = restRequest(
    'GET',
    `supaplan_tasks?select=*&status=eq.open&capability=eq.${encodeURIComponent(resolved.capability)}&order=created_at.asc&limit=10`,
  );
  const tasks = Array.isArray(candidates) ? candidates : [];

  // Filter for polishing tasks - these should have specific metadata or capability prefix
  const polishingTasks = tasks.filter((task) => {
    return task.capability?.startsWith('polish') ||
           task.capability?.startsWith('refactor') ||
           task.capability?.startsWith('docs') ||
           task.capability?.startsWith('test') ||
           task.metadata?.cheatcode === true;
  });

  if (polishingTasks.length === 0) {
    console.log(JSON.stringify({
      mode: 'cheatcode',
      capability: resolved.capability,
      capabilitySource: resolved.source,
      result: { task: null, reason: 'no_polishing_tasks' }
    }, null, 2));
    return;
  }

  const task = polishingTasks[0];

  if (dryRun) {
    console.log(JSON.stringify({
      mode: 'cheatcode-dry-run',
      capability: resolved.capability,
      capabilitySource: resolved.source,
      result: { task }
    }, null, 2));
    return;
  }

  // Claim without file operations
  const now = new Date().toISOString();
  const claimedRows = restRequest(
    'PATCH',
    `supaplan_tasks?id=eq.${task.id}&status=eq.open`,
    { status: 'running', updated_at: now },
    'return=representation',
  );
  const claimedTask = Array.isArray(claimedRows) ? claimedRows[0] : null;

  if (!claimedTask) {
    console.log(JSON.stringify({
      mode: 'cheatcode',
      result: { task: null, reason: 'race_condition' }
    }, null, 2));
    return;
  }

  const claimRows = restRequest(
    'POST',
    'supaplan_claims',
    {
      task_id: claimedTask.id,
      agent_id: agentId,
      claim_token: randomUUID(),
      status: 'running',
      claimed_at: now,
      last_heartbeat: now,
    },
    'return=representation',
  );

  console.log(JSON.stringify({
    mode: 'cheatcode',
    capability: resolved.capability,
    capabilitySource: resolved.source,
    result: {
      task: claimedTask,
      claim: Array.isArray(claimRows) ? claimRows[0] : claimRows,
      note: 'This is a polishing task - work directly in memory, skip file staging'
    }
  }, null, 2));
}

async function resolveConflict() {
  const file = required(getArg('file'), 'Missing --file');
  const strategy = getArg('strategy', 'ours');
  const validStrategies = new Set(['ours', 'theirs', 'union', 'merge']);

  if (!validStrategies.has(strategy)) {
    throw new Error(`Invalid --strategy=${strategy}. Allowed: ours|theirs|union|merge`);
  }

  const checkoutArgs = ['checkout', `--${strategy}`, '--', file];
  const result = spawnSync('git', checkoutArgs, { encoding: 'utf8', stdio: 'pipe' });

  if (result.status !== 0) {
    console.log(JSON.stringify({
      ok: false,
      file,
      strategy,
      error: 'git_checkout_failed',
      stderr: result.stderr
    }, null, 2));
    return;
  }

  const addResult = spawnSync('git', ['add', file], {
    encoding: 'utf8',
    stdio: 'pipe'
  });

  if (addResult.status !== 0) {
    console.log(JSON.stringify({
      ok: false,
      file,
      strategy,
      error: 'git_add_failed',
      stderr: addResult.stderr
    }, null, 2));
    return;
  }

  console.log(JSON.stringify({
    ok: true,
    file,
    strategy,
    resolved: true
  }, null, 2));
}

async function updateStatus() {
  const taskId = required(getArg('taskId'), 'Missing --taskId');
  const status = required(getArg('status'), 'Missing --status');
  const mode = getArg('mode', 'pr');
  const agentId = getArg('agentId', process.env.SUPAPLAN_AGENT_ID || 'codex-local-agent');
  const commitMessage = getArg('commitMessage', null);
  const now = new Date().toISOString();

  const allowedStatuses = mode === 'boss' ? ALLOWED_BOSS_MODE_STATUSES : ALLOWED_AGENT_STATUSES;
  if (!allowedStatuses.has(status)) {
    const statusList = mode === 'boss'
      ? 'claimed|running|ready|completed'
      : 'claimed|running|ready_for_pr';
    throw new Error(`Invalid --status=${status} for mode=${mode}. Allowed: ${statusList}`);
  }

  // BOSS mode: handle direct commit when completing tasks
  if (mode === 'boss' && (status === 'completed' || status === 'ready')) {
    if (!hasFlag('skip-commit') && commitMessage) {
      const commitResult = attemptDirectCommit(taskId, agentId, commitMessage);
      console.log(JSON.stringify({ ok: true, taskId, status, mode, commit: commitResult }, null, 2));
    } else if (hasFlag('skip-commit')) {
      console.log(JSON.stringify({ ok: true, taskId, status, mode, commit: 'skipped' }, null, 2));
    } else {
      console.warn('BOSS mode with commit requires --commitMessage. Skipping commit.');
      console.log(JSON.stringify({ ok: true, taskId, status, mode, commit: 'skipped-missing-message' }, null, 2));
    }
  }

  const updatePayload = { status, updated_at: now };
  if (mode === 'boss' && status === 'completed') {
    updatePayload.completed_by = agentId;
    updatePayload.completed_at = now;
  }

  try {
    const supabase = getAdminClient();
    const { error } = await supabase
      .from('supaplan_tasks')
      .update(updatePayload)
      .eq('id', taskId);

    if (error) throw error;
  } catch (error) {
    if (!isTransientNetworkError(error)) {
      throw error;
    }

    restRequest(
      'PATCH',
      `supaplan_tasks?id=eq.${taskId}`,
      updatePayload,
      'return=minimal',
    );
  }

  maybeNotifyStatusUpdate(taskId, status);
  if (mode === 'boss' && !commitMessage) {
    console.log(JSON.stringify({ ok: true, taskId, status, mode, commit: 'skipped' }, null, 2));
  }
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

  let knownCapabilities = [];
  try {
    const rows = restRequest(
      'GET',
      'supaplan_tasks?select=capability&limit=500',
    );
    knownCapabilities = Array.from(
      new Set(
        (Array.isArray(rows) ? rows : [])
          .map((row) => row?.capability)
          .filter((value) => typeof value === 'string' && value.trim().length > 0),
      ),
    ).sort();
  } catch (error) {
    if (!isTransientNetworkError(error)) throw error;
  }

  if (knownCapabilities.length > 0 && !knownCapabilities.includes(capability)) {
    throw new Error(
      `Invalid --capability=${capability}. Use one of: ${knownCapabilities.join(', ')}. ` +
      'Run `node scripts/supaplan-skill.mjs inspect-migrations` to discover real capabilities.',
    );
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

async function agentStats() {
  const agentId = getArg('agentId', process.env.SUPAPLAN_AGENT_ID || 'codex-local-agent');
  let data = null;

  try {
    const supabase = getAdminClient();
    const { data: stats, error } = await supabase.rpc('supaplan_agent_stats', {
      p_agent: agentId
    });

    if (error) throw error;
    data = stats;
  } catch (error) {
    // Fallback to manual query if RPC doesn't exist
    if (!isTransientNetworkError(error)) {
      // Try manual query
      try {
        const claims = restRequest(
          'GET',
          `supaplan_claims?select=agent_id,claimed_at&agent_id=eq.${encodeURIComponent(agentId)}&limit=1000`
        );
        const completed = restRequest(
          'GET',
          `supaplan_tasks?select=completed_by,completed_at&completed_by=eq.${encodeURIComponent(agentId)}&limit=1000`
        );

        data = {
          agent_id: agentId,
          tasks_claimed: Array.isArray(claims) ? claims.length : 0,
          tasks_completed: Array.isArray(completed) ? completed.length : 0,
          source: 'manual-fallback'
        };
      } catch (fallbackError) {
        if (!isTransientNetworkError(fallbackError)) {
          throw fallbackError;
        }
      }
    } else {
      throw error;
    }
  }

  console.log(JSON.stringify({ ok: true, stats: data }, null, 2));
}

async function parallelWorkCheck() {
  let data = null;

  try {
    const supabase = getAdminClient();
    const { data: checks, error } = await supabase.rpc('supaplan_parallel_work_check');

    if (error) throw error;
    data = checks;
  } catch (error) {
    if (!isTransientNetworkError(error)) {
      throw error;
    }

    // Fallback to manual query
    const running = restRequest(
      'GET',
      `supaplan_tasks?select=capability,status,id&status=eq.running&limit=100`
    );

    if (Array.isArray(running) && running.length > 0) {
      const taskIds = running.map(t => t.id);
      const claims = restRequest(
        'GET',
        `supaplan_claims?select=task_id,agent_id&task_id=in.(${taskIds.join(',')})&limit=100`
      );

      const byCapability = {};
      for (const task of running) {
        const cap = task.capability || 'unknown';
        if (!byCapability[cap]) {
          byCapability[cap] = { capability: cap, running_count: 0, running_agents: [] };
        }
        byCapability[cap].running_count += 1;

        const taskClaims = Array.isArray(claims) ? claims.filter(c => c.task_id === task.id) : [];
        for (const claim of taskClaims) {
          if (!byCapability[cap].running_agents.includes(claim.agent_id)) {
            byCapability[cap].running_agents.push(claim.agent_id);
          }
        }
      }

      data = Object.values(byCapability);
    } else {
      data = [];
    }
  }

  console.log(JSON.stringify({ ok: true, parallelWork: data }, null, 2));
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

  let rows = [];
  let capabilitySource = 'supabase-rest';

  try {
    const supabase = getAdminClient();
    const result = await supabase
      .from('supaplan_tasks')
      .select('id,title,capability,status,updated_at,todo_path')
      .order('updated_at', { ascending: false })
      .limit(200);

    if (result.error) throw result.error;
    rows = Array.isArray(result.data) ? result.data : [];
    capabilitySource = 'supabase-js';
  } catch (error) {
    if (!isTransientNetworkError(error)) {
      throw error;
    }

    const fallbackRows = restRequest(
      'GET',
      'supaplan_tasks?select=id,title,capability,status,updated_at,todo_path&order=updated_at.desc&limit=200',
    );
    rows = Array.isArray(fallbackRows) ? fallbackRows : [];
    capabilitySource = 'supabase-rest';
  }

  const byCapability = rows.reduce((acc, row) => {
    const cap = row.capability || 'unknown';
    acc[cap] = acc[cap] || { open: 0, running: 0, ready_for_pr: 0, claimed: 0, done: 0, total: 0 };
    const status = row.status || 'unknown';
    if (status in acc[cap]) acc[cap][status] += 1;
    acc[cap].total += 1;
    return acc;
  }, {});

  const capabilities = Object.keys(byCapability).filter((cap) => cap !== 'unknown').sort();
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
    lifecycle,
    currentStatus: 'phase-2-live-smoke',
    hasMergeWorkflow,
    fakeDoors,
    capabilityDiscovery: {
      source: capabilitySource,
      description: 'Capabilities are derived from live supaplan_tasks rows in Supabase, not from seed migration files.',
      capabilities,
      byCapability,
      oldestOpen,
      totalTasksScanned: rows.length,
    },
    nextFocus: [
      'run one full claim->ready_for_pr smoke in real Supabase',
      'verify merge workflow against a merged PR containing supaplan_task:<uuid>',
      'add heartbeat updater + scheduled stale cleanup trigger',
    ],
  }, null, 2));
}

const runners = {
  'pick-task': pickTask,
  'pick-cheatcode': pickCheatcodeTask,
  'update-status': updateStatus,
  'task-status': taskStatus,
  'log-event': logEvent,
  'inspect-migrations': inspectMigrations,
  'review-merge-workflow': reviewMergeWorkflow,
  'smoke-flow': smokeFlow,
  'status': status,
  'add-task': addTask,
  'validate-plugin-contracts': validatePluginContracts,
  'detect-conflicts': detectMergeConflicts,
  'resolve-conflict': resolveConflict,
  'conflict-suggestions': getConflictResolutionSuggestions,
  'agent-stats': agentStats,
  'parallel-check': parallelWorkCheck,
};

if (!command || !runners[command]) {
  if (command && UUID_V4_OR_COMPAT_REGEX.test(command)) {
    console.error(`Looks like a bare UUID input: "${command}".`);
    console.error('Tip: check whether this is a SupaPlan task id and run: node scripts/supaplan-skill.mjs task-status --taskId <uuid>');
  }
  console.error('Usage: node scripts/supaplan-skill.mjs <command> [--key value]');
  console.error('');
  console.error('Commands:');
  console.error('  pick-task [--capability <name|auto>] [--agentId <id>] [--mode <pr|boss>] [--dry-run]');
  console.error('  pick-cheatcode [--capability <name|auto>] [--agentId <id>] [--dry-run]');
  console.error('  update-status --taskId <uuid> --status <claimed|running|ready|ready_for_pr|completed> [--mode <pr|boss>] [--commitMessage <msg>] [--skip-commit]');
  console.error('  task-status --taskId <uuid>');
  console.error('  log-event --type <type> [--payload <json>] [--source <name>]');
  console.error('  inspect-migrations');
  console.error('  review-merge-workflow');
  console.error('  smoke-flow [--capability <name|auto>] [--agentId <id>] [--dry-run]');
  console.error('  status');
  console.error('  add-task --title <title> --capability <capability> [--todoPath <path>]');
  console.error('  validate-plugin-contracts');
  console.error('  detect-conflicts');
  console.error('  resolve-conflict --file <path> [--strategy <ours|theirs|union|merge>]');
  console.error('  conflict-suggestions');
  console.error('  agent-stats [--agentId <id>]');
  console.error('  parallel-check');
  process.exit(1);
}

Promise.resolve(runners[command]()).catch((error) => {
  console.error(normalizeError(error));
  process.exit(1);
});
