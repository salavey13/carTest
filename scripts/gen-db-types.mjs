#!/usr/bin/env node
/**
 * gen:db-types — regenerate types/database.types.ts from the LIVE Supabase
 * PostgREST OpenAPI spec (the same source PostgREST serves at /rest/v1/).
 *
 * Why: the hand-typed types drifted from reality (claimed cars.status exists —
 * it doesn't; had no rental_photos at all). This script makes truth the default.
 *
 * Design (iter29, matches the repo's product boundary):
 *   - STRICT shapes (Row/Insert/Update + Relationships) for the franchize
 *     product tables — the ones product code actually queries (scan list below).
 *   - LooseSupabaseTable for legacy sandbox tables and every view — strictness
 *     there only produced inference noise, never value.
 *   - Functions block is MANUAL: on each run the existing block is carried over
 *     from the current types file (edit it in types/database.types.ts and it
 *     survives regeneration).
 *   - Relationships are parsed from the spec's <fk table='x' column='y'/> hints
 *     so supabase-js embedded joins (`.select("vehicle:cars(...)")`) typecheck.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run gen:db-types
 * (NEXT_PUBLIC_SUPABASE_URL is accepted as a fallback for SUPABASE_URL.)
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";

// ─── config ───────────────────────────────────────────────────────────────────

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || "";
const TYPES_PATH = new URL("../types/database.types.ts", import.meta.url).pathname;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("✗ Need SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY in env.");
  process.exit(1);
}

/**
 * Franchize product tables → strict typing. Derived from a code scan of
 * .from("<table>") over app/franchize, app/rentals, app/webhook-handlers,
 * components/franchize, app/api/my, app/testdrive and the product edge
 * functions. Keep this list in sync when the product starts querying a new
 * table (tables listed here but missing from the live spec are emitted loose
 * with a warning — they live in another schema, e.g. private.crew_secrets).
 */
const STRICT_TABLES = [
  "cars",
  "cash_transactions",
  "checklist_state",
  "commercial_proposal_artifacts",
  "commission_rates",
  "crew_member_shifts",
  "crew_members",
  "crew_secrets",
  "crew_todos",
  "crews",
  "deposit_entries",
  "doc_verifier_records",
  "docpix",
  "equipment_rentals",
  "events",
  "franchize_intents",
  "franchize_order_notifications",
  "god_mode_simulations",
  "homework_daily_solutions",
  "invoices",
  "lead_notes",
  "live_locations",
  "maps",
  "market_data",
  "message_templates",
  "profiles",
  "rental_contract_artefacts",
  "rental_contract_artifacts",
  "rental_handoffs",
  "rental_photos",
  "rental_reviews",
  "rentals",
  "salary_calculations",
  "salary_plans",
  "sale_contract_artifacts",
  "subrent_contract_artifacts",
  "testdrive_contract_artifacts",
  "user_purchases",
  "user_rental_secrets",
  "user_states",
  "user_survey_state",
  "user_surveys",
  "users",
];
const STRICT = new Set(STRICT_TABLES);

// ─── fetch spec ───────────────────────────────────────────────────────────────

const res = await fetch(`${SUPABASE_URL}/rest/v1/`, {
  headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
});
if (!res.ok) {
  console.error(`✗ Spec fetch failed: HTTP ${res.status}`);
  process.exit(1);
}
const spec = await res.json();
const defs = spec.definitions ?? spec.components?.schemas ?? null;
if (!defs) {
  console.error("✗ Spec has no definitions/components.schemas — unexpected PostgREST shape.");
  process.exit(1);
}
const paths = spec.paths ?? {};
const methodsOf = (name) => Object.keys(paths[`/${name}`] ?? {});
const isWritable = (name) => ["post", "patch", "put", "delete"].some((m) => methodsOf(name).includes(m));

const tableNames = Object.keys(defs).filter(isWritable).sort();
const viewNames = Object.keys(defs).filter((n) => !isWritable(n)).sort();

// ─── type mapping ─────────────────────────────────────────────────────────────

/** Map an OpenAPI property to a TS type for strict rows. */
function tsType(prop) {
  const fmt = prop.format ?? "";
  if (fmt === "jsonb") return "Json";
  if (fmt.endsWith("[]")) {
    const item = prop.items ?? {};
    const inner =
      item.type === "string" ? "string"
      : item.type === "number" || item.type === "integer" ? "number"
      : item.type === "boolean" ? "boolean"
      : item.format === "jsonb" || fmt === "jsonb[]" ? "Json"
      : "Json";
    return `${inner}[]`;
  }
  switch (prop.type) {
    case "string":
      return "string";
    case "number":
    case "integer":
      return "number";
    case "boolean":
      return "boolean";
    case "object":
      return "Json";
    case "array":
      return "Json[]";
    default:
      return "Json";
  }
}

const FK_RE = /<fk table='([^']+)' column='([^']+)'\/>/g;

/** Parse <fk table='x' column='y'/> hints from property descriptions. */
function relationshipsOf(def) {
  const rels = [];
  const seen = new Set();
  for (const [col, prop] of Object.entries(def.properties ?? {})) {
    const desc = prop.description ?? "";
    let m;
    FK_RE.lastIndex = 0;
    while ((m = FK_RE.exec(desc)) !== null) {
      const [, table, refCol] = m;
      const key = `${col}->${table}.${refCol}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rels.push({
        foreignKeyName: `${table}_${col}_fkey`,
        columns: [col],
        referencedRelation: table,
        referencedColumns: [refCol],
      });
    }
  }
  return rels;
}

/** Emit a strict table block. */
function strictTableBlock(name, def) {
  const props = Object.entries(def.properties ?? {});
  const required = new Set(def.required ?? []);
  const rels = relationshipsOf(def);

  const rowLines = props.map(([col, prop]) => {
    const t = tsType(prop);
    return `          ${col}: ${required.has(col) ? t : `${t} | null`}`;
  });
  const insertLines = props.map(([col, prop]) => {
    const t = tsType(prop);
    const req = required.has(col);
    const hasDefault = prop.default !== undefined;
    if (req && !hasDefault) return `          ${col}: ${t}`;
    if (req && hasDefault) return `          ${col}?: ${t}`;
    return `          ${col}?: ${t} | null`;
  });
  const updateLines = props.map(([col, prop]) => `          ${col}?: ${tsType(prop)}`);

  const relLines = rels.length
    ? rels.flatMap((r) => [
        "          {",
        `            foreignKeyName: "${r.foreignKeyName}"`,
        `            columns: ["${r.columns.join('", "')}"]`,
        "            isOneToOne: false",
        `            referencedRelation: "${r.referencedRelation}"`,
        `            referencedColumns: ["${r.referencedColumns.join('", "')}"]`,
        "          },",
      ])
    : [];

  return [
    `      ${name}: {`,
    "        Row: {",
    ...(rowLines.length ? rowLines : ["          // (no columns exposed)"]),
    "        }",
    "        Insert: {",
    ...(insertLines.length ? insertLines : ["          // (no columns exposed)"]),
    "        }",
    "        Update: {",
    ...(updateLines.length ? updateLines : ["          // (no columns exposed)"]),
    "        }",
    "        Relationships: [",
    ...relLines,
    "        ]",
    "      }",
  ].join("\n");
}

// ─── preserve manual Functions from the current file ──────────────────────────

let functionsBlock = "    Functions: {\n      [_ in never]: never\n    }";
if (existsSync(TYPES_PATH)) {
  const cur = readFileSync(TYPES_PATH, "utf8");
  const m = cur.match(/^ {4}Functions: \{[\s\S]*?^\ {4}\}(?=\n {4}Enums:)/m);
  if (m) functionsBlock = m[0];
}

// ─── emit ─────────────────────────────────────────────────────────────────────

const warnings = [];
// union: spec tables + strict-listed tables the spec doesn't expose (kept loose, documented)
const notExposed = STRICT_TABLES.filter((n) => !tableNames.includes(n));
const allTableNames = [...tableNames, ...notExposed].sort();
const tableLines = [];
for (const name of allTableNames) {
  if (tableNames.includes(name) && STRICT.has(name)) {
    tableLines.push(strictTableBlock(name, defs[name]));
  } else if (!tableNames.includes(name)) {
    tableLines.push(`      // NOT exposed in the REST spec (private schema or dropped) — kept loose:`);
    tableLines.push(`      ${name}: LooseSupabaseTable`);
    warnings.push(name);
  } else {
    tableLines.push(`      ${name}: LooseSupabaseTable`);
  }
}

const viewLines = viewNames.map((n) => `      ${n}: {\n        Row: LooseSupabaseRow\n      }`);

const out = `// AUTO-GENERATED FILE — DO NOT EDIT ROW/TABLE SHAPES BY HAND.
// Regenerate with: npm run gen:db-types   (reads the live PostgREST OpenAPI spec)
// Generated: ${new Date().toISOString()}
//
// Layout: strict shapes for franchize product tables (list in
// scripts/gen-db-types.mjs), loose rows for legacy sandbox tables and views,
// and a MANUAL Functions block that is carried over on each regeneration —
// edit Functions directly in this file, they survive regeneration.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

type LooseSupabaseRow = { [key: string]: any }
type LooseSupabaseTable = {
  Row: LooseSupabaseRow
  Insert: LooseSupabaseRow
  Update: LooseSupabaseRow
  Relationships: []
}
type LooseSupabaseView = {
  Row: LooseSupabaseRow
  Relationships: []
}

export interface Database {
  public: {
    Tables: {
${tableLines.join("\n")}
    }
    Views: {
${viewLines.length ? viewLines.join("\n") : "      [_ in never]: never"}
    }
${functionsBlock}
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
`;

writeFileSync(TYPES_PATH, out);

// ─── summary ──────────────────────────────────────────────────────────────────

const strictCount = tableNames.filter((n) => STRICT.has(n)).length;
console.log(`✓ types/database.types.ts regenerated from the live DB`);
console.log(`  tables: ${tableNames.length} total · ${strictCount} strict · ${tableNames.length - strictCount} loose`);
console.log(`  views:  ${viewNames.length} (loose) · functions: manual block preserved`);
if (warnings.length) {
  console.warn(`  ⚠ strict-list tables NOT in the public REST spec (kept loose): ${warnings.join(", ")}`);
  console.warn(`    → they live in another schema (e.g. private.*) or were dropped; product code still queries some of them.`);
}
