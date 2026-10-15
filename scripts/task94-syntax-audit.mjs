// Task 94 — repo-wide syntax audit: find every file the "[m"-eater mangled.
// Bun.Transpiler parses TS/TSX fast and throws on syntax errors.
import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";

const ROOTS = ["app", "components", "lib", "hooks", "scripts", "supabase"];
const transpiler = new Bun.Transpiler({ loader: "tsx" });
const broken = [];

function walk(dir) {
  let entries;
  try { entries = readdirSync(dir); } catch { return; }
  for (const e of entries) {
    const p = join(dir, e);
    let st; try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) {
      if (e === "node_modules" || e === ".next" || e === ".git") continue;
      walk(p);
    } else if (/\.(ts|tsx|mjs)$/.test(e) && !/\.(test|spec)\./.test(e)) {
      const src = readFileSync(p, "utf8");
      try {
        transpiler.scanImports(src);
      } catch (err) {
        const first = String(err?.message || err).split("\n").slice(0, 4).join(" | ");
        broken.push({ file: p, error: first });
      }
    }
  }
}

for (const r of ROOTS) walk(r);
console.log(`scanned, broken: ${broken.length}`);
for (const b of broken) console.log("✗", b.file, "→", b.error);
