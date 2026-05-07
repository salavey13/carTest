#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

const configPath = "tsconfig.franchize.json";
const config = JSON.parse(readFileSync(configPath, "utf8"));
const strictFiles = new Set((config.include || []).filter((entry) => /\.[cm]?[tj]sx?$/.test(entry)).map((entry) => path.normalize(entry)));

const result = spawnSync("npx", ["tsc", "-p", configPath, "--noEmit", "--pretty", "false", "--noErrorTruncation"], {
  encoding: "utf8",
  shell: process.platform === "win32",
});

const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
const diagnosticPattern = /^(.+?\.[cm]?[tj]sx?)\(\d+,\d+\): error TS\d+:/gm;
const strictDiagnostics = [];
const surfacedDiagnostics = [];
let match;

while ((match = diagnosticPattern.exec(output)) !== null) {
  const filePath = path.normalize(match[1]);
  if (strictFiles.has(filePath)) strictDiagnostics.push(filePath);
  else surfacedDiagnostics.push(filePath);
}

const outputLines = output ? output.split(/\r?\n/) : [];

if (strictDiagnostics.length > 0) {
  const strictFileSet = new Set(strictDiagnostics);
  outputLines
    .filter((line) => [...strictFileSet].some((filePath) => line.startsWith(`${filePath}(`)))
    .forEach((line) => console.error(line));
  console.error(`\nFranchize strict slice failed in allowlisted files (${[...strictFileSet].join(", ")}).`);
  if (process.env.FRANCHIZE_TYPECHECK_VERBOSE === "1" && output) console.error(output);
  process.exit(result.status || 1);
}

if ((result.status || 0) !== 0) {
  const uniqueSurfaced = [...new Set(surfacedDiagnostics)];
  console.warn("Franchize strict slice passed for allowlisted files.");
  console.warn(
    `TypeScript also surfaced ${uniqueSurfaced.length} existing transitive debt file(s) outside the allowlist. Set FRANCHIZE_TYPECHECK_VERBOSE=1 for full diagnostics.`,
  );
  if (uniqueSurfaced.length) console.warn(`First surfaced files: ${uniqueSurfaced.slice(0, 12).join(", ")}`);
  if (process.env.FRANCHIZE_TYPECHECK_VERBOSE === "1" && output) console.warn(output);
  process.exit(0);
}

console.log("Franchize strict slice passed.");
