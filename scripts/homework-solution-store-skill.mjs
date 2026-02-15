#!/usr/bin/env node

/**
 * Homework solution store skill helper.
 *
 * Usage:
 *   node scripts/homework-solution-store-skill.mjs ensure-table
 *   node scripts/homework-solution-store-skill.mjs bootstrap-table
 *   node scripts/homework-solution-store-skill.mjs exists --solutionKey 13-02-final --date 2026-02-13
 *   node scripts/homework-solution-store-skill.mjs save --solutionKey 13-02-final --date 2026-02-13 --json ./tmp/solution.json
 */

import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const [mode, ...args] = process.argv.slice(2);
const MIGRATION_SQL_PATH = "supabase/migrations/20260214195500_homework_daily_solutions.sql";
const HOMEWORK_TABLE = "homework_daily_solutions";

function getArg(name, fallback = undefined) {
  const idx = args.indexOf(`--${name}`);
  if (idx === -1) return fallback;
  return args[idx + 1];
}

function envRequired(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env: ${name}`);
  return value;
}

function run(cmd, cmdArgs) {
  const result = spawnSync(cmd, cmdArgs, { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `${cmd} failed`);
  }
  return result.stdout.trim();
}

function curlJson({ url, method = "GET", headers = [], body }) {
  const curlArgs = ["-sS", "-X", method, url];
  for (const header of headers) {
    curlArgs.push("-H", header);
  }
  if (body) {
    curlArgs.push("-H", "Content-Type: application/json", "-d", JSON.stringify(body));
  }

  return run("curl", curlArgs);
}


function client() {
  const supabaseUrl = envRequired("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = envRequired("SUPABASE_SERVICE_ROLE_KEY");

  const headers = [
    `apikey: ${serviceKey}`,
    `Authorization: Bearer ${serviceKey}`,
    "Accept-Profile: public",
  ];

  return {
    supabaseUrl,
    headers,
  };
}

function maybeNotify(summary, options = {}) {
  if (getArg("notify", "0") !== "1") return;

  const branch = getArg("branch", process.env.PR_HEAD_REF || run("git", ["rev-parse", "--abbrev-ref", "HEAD"]));
  const callbackEndpoint = process.env.CODEX_CALLBACK_ENDPOINT || "https://v0-car-test.vercel.app/api/codex-bridge/callback";
  const secret = process.env.CODEX_BRIDGE_CALLBACK_SECRET;
  if (!secret) return;

  const taskPath = options.taskPath || getArg("taskPath") || "/";

  try {
    curlJson({
      url: callbackEndpoint,
      method: "POST",
      headers: ["Content-Type: application/json", `x-codex-bridge-secret: ${secret}`],
      body: {
        status: "completed",
        summary,
        branch,
        taskPath,
        telegramChatId: process.env.ADMIN_CHAT_ID,
        telegramUserId: process.env.TELEGRAM_USER_ID,
        slackChannelId: process.env.SLACK_CODEX_CHANNEL_ID,
      },
    });
  } catch {
    // best-effort notification, no hard fail
  }
}

function getExposedTables() {
  const { supabaseUrl, headers } = client();
  const raw = curlJson({
    url: `${supabaseUrl}/rest/v1/`,
    headers,
  });
  const openApi = JSON.parse(raw);
  const paths = Object.keys(openApi.paths || {});
  return paths
    .map((path) => path.replace(/^\//, "").split("?")[0])
    .filter((name) => name && !name.startsWith("rpc/"))
    .sort();
}

function tableExists() {
  const tables = getExposedTables();
  return tables.includes(HOMEWORK_TABLE);
}


function ensureTable({ exitOnMissing = true } = {}) {
  const exists = tableExists();

  if (exists) {
    console.log(JSON.stringify({ ok: true, table: HOMEWORK_TABLE }, null, 2));
    return true;
  }

  const out = {

    ok: false,
    reason: "missing_table",
    table: HOMEWORK_TABLE,
    migrationPath: MIGRATION_SQL_PATH,
    action: `Apply migration ${MIGRATION_SQL_PATH} and retry.`,
  };
  console.log(JSON.stringify(out, null, 2));
  if (exitOnMissing) process.exit(2);
  return false;
}

function bootstrapTableMode() {
  const exists = ensureTable({ exitOnMissing: false });
  if (exists) {
    maybeNotify("Supabase homework table already exists; bootstrap skipped.");
    return;
  }

  console.log(
    JSON.stringify(
      {
        ok: false,
        reason: "bootstrap_disabled",
        migrationPath: MIGRATION_SQL_PATH,
        action: "Automatic SQL table creation is disabled. Apply migration manually in Supabase SQL editor.",
      },
      null,
      2,
    ),
  );
  process.exit(3);
}

function existsMode() {
  const key = getArg("solutionKey");
  const date = getArg("date");
  if (!key) throw new Error("Missing --solutionKey");

  ensureTable();

  const { supabaseUrl, headers } = client();
  const filters = [`solution_key=eq.${encodeURIComponent(key)}`];
  if (date) filters.push(`homework_date=eq.${encodeURIComponent(date)}`);

  const raw = curlJson({
    url: `${supabaseUrl}/rest/v1/${HOMEWORK_TABLE}?select=solution_key,homework_date,updated_at&${filters.join("&")}&order=updated_at.desc&limit=1`,
    headers,
  });

  const rows = JSON.parse(raw || "[]");
  const out = {
    ok: true,
    exists: rows.length > 0,
    row: rows[0] ?? null,
  };
  console.log(JSON.stringify(out, null, 2));

  if (out.exists) {
    maybeNotify(`Same-day homework hit found for ${key}; reusing stored answer.`, { taskPath: `/homework/solution/${key}` });
  }
}

function saveMode() {
  const key = getArg("solutionKey");
  const date = getArg("date");
  const jsonPath = getArg("json");
  if (!key) throw new Error("Missing --solutionKey");
  if (!jsonPath) throw new Error("Missing --json path");

  ensureTable();

  const payload = JSON.parse(readFileSync(jsonPath, "utf8"));
  const markdown = payload.solutionMarkdown || payload.solution_markdown || payload.fullSolutionRich || payload.full_solution_rich || null;

  const row = {
    solution_key: key,
    homework_date: date || new Date().toISOString().slice(0, 10),
    subject: payload.subject || "unknown",
    topic: payload.topic || "Разбор задания",
    given: payload.given || "Данные не указаны",
    steps: payload.steps || [],
    answer: payload.answer || "Ответ не указан",
    solution_markdown: markdown,
    full_solution_rich: markdown,
    rewrite_for_notebook: payload.rewriteForNotebook || payload.rewrite_for_notebook || null,
    source_hints: payload.sourceHints || payload.source_hints || [],
    screenshot_url: payload.screenshotUrl || payload.screenshot_url || null,
  };

  const { supabaseUrl, headers } = client();
  const raw = curlJson({
    url: `${supabaseUrl}/rest/v1/${HOMEWORK_TABLE}?on_conflict=homework_date,solution_key`,
    method: "POST",
    headers: [...headers, "Prefer: resolution=merge-duplicates,return=representation"],
    body: row,
  });

  const inserted = JSON.parse(raw || "[]");
  console.log(JSON.stringify({ ok: true, upserted: inserted[0] ?? null }, null, 2));
  maybeNotify(`Homework answer saved to Supabase for ${key}.`, { taskPath: `/homework/solution/${key}` });
}

if (!mode || !["ensure-table", "bootstrap-table", "exists", "save"].includes(mode)) {
  console.error("Usage: node scripts/homework-solution-store-skill.mjs <ensure-table|bootstrap-table|exists|save> [--key value]");
  process.exit(1);
}

try {
  if (mode === "ensure-table") ensureTable();
  if (mode === "bootstrap-table") bootstrapTableMode();
  if (mode === "exists") existsMode();
  if (mode === "save") saveMode();
} catch (error) {
  console.error(error.message || error);
  process.exit(1);
}
