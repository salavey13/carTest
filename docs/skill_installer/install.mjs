#!/usr/bin/env node
// install.mjs — Extract code blocks from zai_agent_doc_src.txt into real files
// Usage: node install.mjs [source_file] [target_dir]
//   source_file: defaults to ./zai_agent_doc_src.txt
//   target_dir:  defaults to current directory
//
// The source file uses this pattern for each file:
//   // /path/to/file.ext          ← file marker
//   ```lang                       ← code fence opens
//   ... actual file content ...
//   ```                           ← code fence closes
//
// Each marker+code-block pair becomes a real file at target_dir/path/to/file.ext

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const sourceFile = process.argv[2] || './zai_agent_doc_src.txt';
const targetDir  = process.argv[3] || '.';

if (!existsSync(sourceFile)) {
  console.error(`❌ Source file not found: ${sourceFile}`);
  process.exit(1);
}

const text = readFileSync(sourceFile, 'utf-8');

// Strategy: find all "// /path/to/file.ext" markers,
// then for each, grab the FIRST code block content that follows it
// (skipping any inline code blocks inside the prose before the main block)

function extractCodeBlock(text, startIndex) {
  // Find the first ``` after startIndex
  const fenceRe = /^```([a-zA-Z]*)\s*$/gm;
  fenceRe.lastIndex = startIndex;
  
  const openMatch = fenceRe.exec(text);
  if (!openMatch) return null;
  
  // Now find the closing ```
  const contentStart = openMatch.index + openMatch[0].length + 1; // skip \n
  fenceRe.lastIndex = contentStart;
  
  // Look for closing fence — a line that is just ```
  const closePattern = /^```\s*$/gm;
  closePattern.lastIndex = contentStart;
  const closeMatch = closePattern.exec(text);
  
  if (!closeMatch) return null;
  
  return text.slice(contentStart, closeMatch.index).replace(/\n$/, '');
}

// Find all file markers
const markerRe = /^\/\/\s+(\/\S+\.\S+)\s*$/gm;
const files = [];
let m;
while ((m = markerRe.exec(text)) !== null) {
  files.push({ path: m[1], searchFrom: m.index + m[0].length });
}

// Dedupe — keep first occurrence of each path
const seen = new Set();
const unique = [];
for (const f of files) {
  if (!seen.has(f.path)) {
    seen.add(f.path);
    unique.push(f);
  }
}

console.log(`📦 Extracting ${unique.length} files from ${sourceFile}\n`);

let extracted = 0;
let skipped = 0;

for (const file of unique) {
  const content = extractCodeBlock(text, file.searchFrom);
  
  if (!content || !content.trim()) {
    console.log(`  ⚠️  No code block found: ${file.path} — skipped`);
    skipped++;
    continue;
  }

  const outPath = join(targetDir, file.path);
  const dir = dirname(outPath);

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  writeFileSync(outPath, content, 'utf-8');
  console.log(`  ✅ ${file.path} (${(content.length / 1024).toFixed(1)} KB)`);
  extracted++;
}

console.log(`\n🎉 Done: ${extracted} files extracted, ${skipped} skipped`);
console.log(`📁 Target: ${resolve(targetDir)}`);
