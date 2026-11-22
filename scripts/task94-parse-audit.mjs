// Task 94 — AUTHORITATIVE parse audit using the repo's own TypeScript parser.
// Parse-only (no type-check, no imports resolution) — safe on 4GB RAM.
import { readdirSync, readFileSync, statSync } from "fs";
import { join, relative } from "path";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const ts = require("typescript");

const ROOTS = ["app", "components", "lib", "hooks"];
const broken = [];
let scanned = 0;

function walk(dir) {
  let entries;
  try { entries = readdirSync(dir); } catch { return; }
  for (const e of entries) {
    const p = join(dir, e);
    let st; try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) {
      if (e === "node_modules" || e === ".next" || e === ".git") continue;
      walk(p);
    } else if (/\.(ts|tsx)$/.test(e) && !/\.(test|spec|d)\.ts/.test(e)) {
      scanned++;
      const src = readFileSync(p, "utf8");
      const sf = ts.createSourceFile(p, src, ts.ScriptTarget.Latest, true, e.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
      const diags = sf.parseDiagnostics || [];
      if (diags.length) {
        broken.push({
          file: relative(process.cwd(), p),
          errors: diags.slice(0, 3).map((d) => {
            const { line, character } = sf.getLineAndCharacterOfPosition(d.start);
            return `L${line + 1}:${character + 1} ${ts.flattenDiagnosticMessageText(d.messageText, " ")}`;
          }),
        });
      }
    }
  }
}
for (const r of ROOTS) walk(r);
console.log(`parsed ${scanned} files, broken: ${broken.length}`);
for (const b of broken) {
  console.log("✗", b.file);
  for (const e of b.errors) console.log("   ", e);
}
