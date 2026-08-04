#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// crew-customization-skill.mjs — Crew config read/edit via the shared contract
// ═══════════════════════════════════════════════════════════════════════════
//
// USAGE:
//   node crew-customization-skill.mjs list-crews
//   node crew-customization-skill.mjs get-config --slug vip-bike
//   node crew-customization-skill.mjs show-field --slug vip-bike --field input.phone
//   node crew-customization-skill.mjs set-field --slug vip-bike --field input.phone --value "+7 900 123-45-67"
//   node crew-customization-skill.mjs set-field --slug vip-bike --field metadata.footer.phone --value "+7 900 123-45-67"
//   node crew-customization-skill.mjs set-contract-default --slug vip-bike --field issuerName --value "ИП Иванов И.И."
//   node crew-customization-skill.mjs validate-config --slug vip-bike
//   node crew-customization-skill.mjs get-readiness --slug vip-bike
//
// ─── SUPPORTED CLI FLAGS ───────────────────────────────────────────────────
//   list-crews                (COMMAND) List crews with slug + brand + enabled
//   get-config                (COMMAND) Full resolved config (JSON) for a crew
//   show-field                (COMMAND) Print one resolved field value
//   set-field                 (COMMAND) Set one config field and persist
//   set-contract-default      (COMMAND) Set one contract-defaults secret field
//   validate-config           (COMMAND) Validate config + secrets for a crew
//   get-readiness             (COMMAND) Readiness checklist for a crew
//   --slug <slug>             Crew slug (default: vip-bike)
//   --field <dotpath>         Field to read/write. Namespaces:
//                               input.<field>            flat editor input (e.g. input.brandName, input.phone, input.accentMain)
//                               metadata.<path>          raw crews.metadata.franchize (e.g. metadata.branding.name)
//                               contractDefaults.<path>  private crew_secrets.contract_defaults (e.g. contractDefaults.issuerName, contractDefaults.inn)
//                               docTemplates.<path>      private crew_secrets.doc_templates
//                               Bare names (brandName) are treated as input.<field>.
//   --value <raw>             Value to set (JSON if it parses, else string;
//                             coerced to the current field type).
//   --dryRun                  (FLAG) Print before/after WITHOUT persisting.
//   --includeSecrets          (FLAG) Include contractDefaultsJson/docTemplatesJson in get-config output.
//
// ─── FLAGS THAT DO NOT EXIST (anti-hallucination) ──────────────────────────
//   --skipTelegram    DOES NOT EXIST.
//   --outPath         DOES NOT EXIST.
//   --userId          DOES NOT EXIST (no membership resolution — pass --slug explicitly).
//
// Output is JSON on stdout; human logs go to stderr.
// ═══════════════════════════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js';
import {
  readPath,
  defaultFranchizeConfig,
  franchizeConfigSchema,
  metadataToConfig,
  configToMetadata,
  splitCsv,
  normalizeCrewSlug,
} from '../app/franchize/lib/franchize-config-contract.ts';

// ── CLI helpers ──────────────────────────────────────────────────────────
function arg(name, fallback = '') {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? (process.argv[i + 1] || '') : fallback;
}
function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}
const COMMAND = process.argv[2] || '';
const dryRun = hasFlag('dryRun');
const includeSecrets = hasFlag('includeSecrets');
const slug = normalizeCrewSlug(arg('slug', 'vip-bike'));

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) {
  fail({ stage: 'env', reason: 'missing_supabase_env', details: { expected: 'NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY' } });
}

const supabase = createClient(supabaseUrl, supabaseKey);
const supabasePrivate = createClient(supabaseUrl, supabaseKey, { db: { schema: 'private' } });

// ── Output helpers ───────────────────────────────────────────────────────
function fail(payload) {
  console.error(JSON.stringify({ ok: false, ...payload }, null, 2));
  process.exit(2);
}
function done(payload) {
  console.log(JSON.stringify(payload, null, 2));
  process.exit(0);
}

// ── Supabase access ──────────────────────────────────────────────────────
// L10 fix: auth check for write operations. The skill uses service-role key
// which bypasses RLS. Before any write, verify the --actorUserId is either:
//   1. The crew owner (crew.owner_id)
//   2. A crew_members row with role=owner/admin/co_owner
//   3. A global admin (users.metadata.role=admin)
async function loadCrew(slugToLoad) {
  const { data, error } = await supabase
    .from('crews')
    .select('id, slug, name, logo_url, metadata, owner_id')
    .eq('slug', slugToLoad)
    .maybeSingle();
  if (error) fail({ stage: 'load_crew', reason: 'db_error', details: { slug: slugToLoad, message: error.message } });
  if (!data) fail({ stage: 'load_crew', reason: 'crew_not_found', details: { slug: slugToLoad } });
  return data;
}

async function checkWriteAccess(crew, actorUserId) {
  if (!actorUserId) {
    fail({ stage: 'auth', reason: 'missing_actor', details: { hint: 'Pass --actorUserId <telegram_chat_id> for write operations' } });
  }
  // 1. Crew owner?
  if (crew.owner_id === actorUserId) return;
  // 2. Crew member with owner/admin/co_owner role?
  const { data: membership } = await supabase
    .from('crew_members')
    .select('role')
    .eq('crew_id', crew.id)
    .eq('user_id', actorUserId)
    .maybeSingle();
  if (membership && ['owner', 'admin', 'co_owner'].includes(membership.role)) return;
  // 3. Global admin?
  const { data: user } = await supabase
    .from('users')
    .select('metadata')
    .eq('user_id', actorUserId)
    .maybeSingle();
  const meta = user?.metadata;
  if (meta?.role === 'admin' || meta?.status === 'admin') return;
  // Denied
  fail({ stage: 'auth', reason: 'not_authorized', details: { actorUserId, crewSlug: crew.slug, hint: 'Only crew owner/admin/co_owner or global admin can write' } });
}

async function loadSecrets(crewSlug) {
  const fallback = { contractDefaults: {}, docTemplates: {} };
  try {
    const { data, error } = await supabasePrivate
      .from('crew_secrets')
      .select('contract_defaults, doc_templates')
      .eq('crew_slug', crewSlug)
      .maybeSingle();
    if (error) return fallback;
    return {
      contractDefaults: (data?.contract_defaults ?? {}) && typeof data.contract_defaults === 'string'
        ? JSON.parse(data.contract_defaults)
        : (data?.contract_defaults ?? {}),
      docTemplates: (data?.doc_templates ?? {}) && typeof data.doc_templates === 'string'
        ? JSON.parse(data.doc_templates)
        : (data?.doc_templates ?? {}),
    };
  } catch {
    return fallback;
  }
}

async function persistSecrets(crewSlug, contractDefaults, docTemplates) {
  const payload = {
    crew_slug: crewSlug,
    updated_at: new Date().toISOString(),
  };
  if (contractDefaults !== undefined) payload.contract_defaults = contractDefaults;
  if (docTemplates !== undefined) payload.doc_templates = docTemplates;
  const { error } = await supabasePrivate.from('crew_secrets').upsert(payload);
  if (error) fail({ stage: 'persist_secrets', reason: 'db_error', details: { slug: crewSlug, message: error.message } });
}

async function persistMetadata(crewId, metadata) {
  const { error } = await supabase.from('crews').update({ metadata }).eq('id', crewId);
  if (error) fail({ stage: 'persist_metadata', reason: 'db_error', details: { message: error.message } });
}

// ── Resolve full config ──────────────────────────────────────────────────
async function resolveConfig(crewSlug) {
  const crew = await loadCrew(crewSlug);
  const secrets = await loadSecrets(crewSlug);
  const input = metadataToConfig((crew.metadata ?? {}) || {}, crew, secrets);
  const parsed = franchizeConfigSchema.safeParse(input);
  return { crew, secrets, input, parsed };
}

// ── Dot-path get/set ─────────────────────────────────────────────────────
function getPath(obj, dotPath) {
  return readPath(obj, dotPath.split('.').filter(Boolean), undefined);
}

function setPath(obj, dotPath, value) {
  const parts = dotPath.split('.').filter(Boolean);
  if (parts.length === 0) return obj;
  const target = { ...(obj ?? {}) };
  let cursor = target;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    const next = cursor[key];
    cursor[key] = (next && typeof next === 'object' && !Array.isArray(next)) ? { ...next } : {};
    cursor = cursor[key];
  }
  cursor[parts[parts.length - 1]] = value;
  return target;
}

function coerceSetValue(current, raw) {
  if (typeof current === 'boolean') {
    if (raw === 'true' || raw === '1') return true;
    if (raw === 'false' || raw === '0') return false;
    try { return Boolean(JSON.parse(raw)); } catch { return false; }
  }
  if (typeof current === 'number') {
    const n = Number(raw);
    return Number.isNaN(n) ? raw : n;
  }
  if (Array.isArray(current)) {
    try { const v = JSON.parse(raw); return Array.isArray(v) ? v : current; } catch { return current; }
  }
  if (current && typeof current === 'object') {
    try { const v = JSON.parse(raw); return (v && typeof v === 'object' && !Array.isArray(v)) ? v : current; } catch { return current; }
  }
  if (typeof current === 'string') {
    try {
      const v = JSON.parse(raw);
      if (typeof v === 'string') return v;
    } catch { /* keep raw */ }
    return raw;
  }
  if (current === undefined) {
    try {
      const v = JSON.parse(raw);
      if (typeof v === 'object' || typeof v === 'boolean' || typeof v === 'number') return v;
    } catch { /* keep raw */ }
    return raw;
  }
  return raw;
}

function parseField(fieldRaw) {
  const f = String(fieldRaw || '').trim();
  if (!f) fail({ stage: 'field', reason: 'missing_field', details: { expected: '--field <dotpath>' } });
  if (f.startsWith('input.') || f.startsWith('metadata.') || f.startsWith('contractDefaults.') || f.startsWith('docTemplates.')) return f;
  return `input.${f}`;
}

function maskSecrets(input) {
  const out = { ...input };
  out.contractDefaultsJson = out.contractDefaultsJson ? '<<redacted: contractDefaultsJson (pass --includeSecrets)>>' : '';
  out.docTemplatesJson = out.docTemplatesJson ? '<<redacted: docTemplatesJson (pass --includeSecrets)>>' : '';
  return out;
}

// ── COMMAND: list-crews ──────────────────────────────────────────────────
async function cmdListCrews() {
  const { data, error } = await supabase.from('crews').select('slug, name, logo_url, metadata').order('name');
  if (error) fail({ stage: 'list_crews', reason: 'db_error', details: { message: error.message } });
  const crews = (data || []).map((row) => {
    const franchize = (readPath(row.metadata, ['franchize'], {}) || {});
    return {
      slug: row.slug,
      name: row.name,
      enabled: readPath(franchize, ['enabled'], true),
      brandName: readPath(franchize, ['branding', 'name'], row.name),
      hasConfig: !!franchize && Object.keys(franchize).length > 0,
    };
  });
  done({ ok: true, stage: 'list_crews', crews, count: crews.length });
}

// ── COMMAND: get-config ──────────────────────────────────────────────────
async function cmdGetConfig() {
  const { crew, input, parsed } = await resolveConfig(slug);
  const out = includeSecrets ? input : maskSecrets(input);
  done({
    ok: parsed.success,
    stage: 'get_config',
    crew: { slug: crew.slug, name: crew.name, id: crew.id },
    validation: parsed.success ? { ok: true } : { ok: false, issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) },
    config: out,
  });
}

// ── COMMAND: show-field ──────────────────────────────────────────────────
async function cmdShowField() {
  const field = parseField(arg('field'));
  const { crew, secrets, input, parsed } = await resolveConfig(slug);
  let value;
  if (field.startsWith('input.')) value = getPath(input, field.slice('input.'.length));
  else if (field.startsWith('metadata.')) value = getPath(readPath(crew.metadata, ['franchize'], {}), field.slice('metadata.'.length));
  else if (field.startsWith('contractDefaults.')) value = getPath(secrets.contractDefaults, field.slice('contractDefaults.'.length));
  else if (field.startsWith('docTemplates.')) value = getPath(secrets.docTemplates, field.slice('docTemplates.'.length));
  const isSecret = field.startsWith('contractDefaults.') || field.startsWith('docTemplates.');
  done({
    ok: true,
    stage: 'show_field',
    field,
    value: isSecret ? '<<redacted>>' : value,
    isSecret,
    crew: { slug: crew.slug, name: crew.name },
    configValid: parsed.success,
  });
}

// ── COMMAND: validate-config ─────────────────────────────────────────────
async function cmdValidateConfig() {
  const { crew, secrets, input, parsed } = await resolveConfig(slug);
  const issues = parsed.success ? [] : parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
  const required = {
    brandName: input.brandName,
    phone: input.phone,
    email: input.email,
    address: input.address,
    telegram: input.telegram,
  };
  const missing = Object.entries(required).filter(([, v]) => !String(v || '').trim()).map(([k]) => k);
  const secretsOk = !!(secrets.contractDefaults && Object.keys(secrets.contractDefaults).length > 0);
  done({
    ok: parsed.success && missing.length === 0,
    stage: 'validate_config',
    crew: { slug: crew.slug, name: crew.name },
    configValid: parsed.success,
    issues,
    missingRequired: missing,
    hasContractDefaults: secretsOk,
  });
}

// ── COMMAND: get-readiness ───────────────────────────────────────────────
async function cmdReadiness() {
  const { crew, secrets, input, parsed } = await resolveConfig(slug);
  const franchize = readPath(crew.metadata, ['franchize'], {});
  const menuLinks = readPath(franchize, ['header', 'menuLinks'], []);
  const checks = [
    { key: 'crew_exists', ok: true, message: `Crew ${crew.slug}` },
    { key: 'has_franchize_metadata', ok: !!franchize && Object.keys(franchize).length > 0, message: 'crews.metadata.franchize present' },
    { key: 'config_valid', ok: parsed.success, message: parsed.success ? 'schema valid' : `invalid: ${parsed.error.issues.map((i) => i.path.join('.')).join(', ')}` },
    { key: 'brand_set', ok: input.brandName && input.brandName.trim().length >= 2, message: `brand: ${input.brandName || '(empty)'}` },
    { key: 'contacts_set', ok: !!(input.phone && input.email && input.address), message: `phone=${input.phone || '—'} email=${input.email || '—'} address=${input.address || '—'}` },
    { key: 'telegram_set', ok: !!input.telegram, message: `telegram: ${input.telegram || '(empty)'}` },
    { key: 'menu_links', ok: Array.isArray(menuLinks) && menuLinks.length > 0, message: `${Array.isArray(menuLinks) ? menuLinks.length : 0} menu links` },
    { key: 'contract_defaults', ok: !!(secrets.contractDefaults && Object.keys(secrets.contractDefaults).length > 0), message: 'private contract_defaults present' },
  ];
  const ready = checks.every((c) => c.ok);
  done({ ok: ready, stage: 'get_readiness', ready, crew: { slug: crew.slug, name: crew.name }, checks });
}

// ── COMMAND: set-field ───────────────────────────────────────────────────
async function cmdSetField() {
  const field = parseField(arg('field'));
  const raw = arg('value');
  if (raw === '' && !hasFlag('value')) fail({ stage: 'set_field', reason: 'missing_value', details: { expected: '--value <raw>' } });
  const { crew, secrets, input, parsed } = await resolveConfig(slug);
  // L10: auth check before write
  if (!dryRun) await checkWriteAccess(crew, arg('actorUserId'));
  const prev = parsed.success ? input : null;

  if (field.startsWith('input.')) {
    const rel = field.slice('input.'.length);
    const current = prev ? getPath(prev, rel) : undefined;
    const next = setPath(prev ?? input, rel, coerceSetValue(current, raw));
    const v = franchizeConfigSchema.safeParse(next);
    if (!v.success) {
      fail({ stage: 'set_field', reason: 'validation_failed', details: { slug, field, issues: v.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) } });
    }
    const newFranchize = configToMetadata(v.data, readPath(crew.metadata, ['franchize'], {}) || {});
    const newMetadata = { ...(crew.metadata ?? {}), franchize: newFranchize };
    if (dryRun) {
      done({ ok: true, stage: 'set_field', dryRun: true, slug, field, value: getPath(v.data, rel), before: getPath(prev, rel), persisted: false });
    }
    await persistMetadata(crew.id, newMetadata);
    done({ ok: true, stage: 'set_field', slug, field, value: getPath(v.data, rel), persisted: true });
  }

  if (field.startsWith('metadata.')) {
    const rel = field.slice('metadata.'.length);
    const franchize = setPath(readPath(crew.metadata, ['franchize'], {}) || {}, rel, coerceSetValue(getPath(readPath(crew.metadata, ['franchize'], {}) || {}, rel), raw));
    const roundTrip = metadataToConfig({ franchize }, crew, secrets);
    const v = franchizeConfigSchema.safeParse(roundTrip);
    if (!v.success) {
      fail({ stage: 'set_field', reason: 'validation_failed', details: { slug, field, issues: v.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) } });
    }
    const newMetadata = { ...(crew.metadata ?? {}), franchize };
    if (dryRun) {
      done({ ok: true, stage: 'set_field', dryRun: true, slug, field, value: getPath(franchize, rel), persisted: false });
    }
    await persistMetadata(crew.id, newMetadata);
    done({ ok: true, stage: 'set_field', slug, field, value: getPath(franchize, rel), persisted: true });
  }

  if (field.startsWith('contractDefaults.')) {
    const rel = field.slice('contractDefaults.'.length);
    const next = setPath(secrets.contractDefaults ?? {}, rel, coerceSetValue(getPath(secrets.contractDefaults ?? {}, rel), raw));
    if (dryRun) {
      done({ ok: true, stage: 'set_field', dryRun: true, slug, field, value: getPath(next, rel), persisted: false });
    }
    await persistSecrets(slug, next, secrets.docTemplates);
    done({ ok: true, stage: 'set_field', slug, field, value: getPath(next, rel), persisted: true });
  }

  if (field.startsWith('docTemplates.')) {
    const rel = field.slice('docTemplates.'.length);
    const next = setPath(secrets.docTemplates ?? {}, rel, coerceSetValue(getPath(secrets.docTemplates ?? {}, rel), raw));
    if (dryRun) {
      done({ ok: true, stage: 'set_field', dryRun: true, slug, field, value: getPath(next, rel), persisted: false });
    }
    await persistSecrets(slug, secrets.contractDefaults, next);
    done({ ok: true, stage: 'set_field', slug, field, value: getPath(next, rel), persisted: true });
  }

  fail({ stage: 'set_field', reason: 'unsupported_field', details: { field } });
}

// ── COMMAND: set-contract-default ────────────────────────────────────────
async function cmdSetContractDefault() {
  const fieldRaw = arg('field');
  const raw = arg('value');
  if (raw === '' && !hasFlag('value')) fail({ stage: 'set_contract_default', reason: 'missing_value', details: { expected: '--value <raw>' } });
  const f = `contractDefaults.${fieldRaw.replace(/^contractDefaults\./, '')}`;
  await cmdSetFieldImpl(slug, f, raw, dryRun);
}

// shared setter used by set-field and set-contract-default
async function cmdSetFieldImpl(crewSlug, field, raw, dryRunFlag) {
  const { crew, secrets, input, parsed } = await resolveConfig(crewSlug);
  // L10: auth check before write
  if (!dryRunFlag) await checkWriteAccess(crew, arg('actorUserId'));
  const prev = parsed.success ? input : null;

  if (field.startsWith('contractDefaults.')) {
    const rel = field.slice('contractDefaults.'.length);
    const next = setPath(secrets.contractDefaults ?? {}, rel, coerceSetValue(getPath(secrets.contractDefaults ?? {}, rel), raw));
    if (dryRunFlag) {
      done({ ok: true, stage: 'set_contract_default', dryRun: true, slug: crewSlug, field, value: getPath(next, rel), persisted: false });
    }
    await persistSecrets(crewSlug, next, secrets.docTemplates);
    done({ ok: true, stage: 'set_contract_default', slug: crewSlug, field, value: getPath(next, rel), persisted: true });
  }
  fail({ stage: 'set_contract_default', reason: 'unsupported_field', details: { field, expected: 'contractDefaults.<path>' } });
}

// ── Dispatch ─────────────────────────────────────────────────────────────
(async () => {
  switch (COMMAND) {
    case 'list-crews': return await cmdListCrews();
    case 'get-config': return await cmdGetConfig();
    case 'show-field': return await cmdShowField();
    case 'set-field': return await cmdSetField();
    case 'set-contract-default': return await cmdSetContractDefault();
    case 'validate-config': return await cmdValidateConfig();
    case 'get-readiness': return await cmdReadiness();
    case 'readiness': return await cmdReadiness();
    default:
      fail({ stage: 'command', reason: 'unknown_command', details: { received: COMMAND || '(empty)', expected: 'list-crews | get-config | show-field | set-field | set-contract-default | validate-config | get-readiness' } });
  }
})().catch((err) => {
  fail({ stage: 'fatal', reason: 'unhandled', details: { message: String(err && err.stack ? err.stack : err) } });
});
