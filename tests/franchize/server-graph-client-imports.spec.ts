/**
 * tests/franchize/server-graph-client-imports.spec.ts
 *
 * Багфикс 2026-09-08: страница лидов падала «TypeError: g is not a function»
 * в проде. Причина: lead-priority.ts импортировал isAvitoLead из
 * leads-utils.tsx — файла с директивой "use client". В серверной сборке
 * (getFranchizeLeads → leads-query-core → lead-priority) такой импорт
 * превращается в createClientModuleProxy("…#isAvitoLead"): некомпонентную
 * функцию клиента нельзя ВЫЗЫВАТЬ на сервере — вершина стека приоритизации
 * падала, и getFranchizeLeads целиком уходил в catch → «не удалось загрузить
 * лиды». Fix: импорт из ./lead-identity (каноничная чистая реализация).
 *
 * Этот спек — регрессионный замок на КЛАСС бага: обходит граф импортов от
 * серверных корней (server-actions, api-маршруты, чистые lib) и падает, если
 * хоть один путь приводит к модулю с "use client". Компоненты/хуки сами по
 * себе клиентские — это норма; ненорма — достижимость их из серверного кода
 * через статический импорт.
 *
 * Ограничения парсера: регулярные выражения по исходникам (без TS API),
 * поддерживаются относительные пути и алиас "@/". Этого достаточно для
 * данного репозитория; динамические import() тоже учитываются.
 */

import { existsSync, readFileSync, statSync } from "fs";
import { dirname, join, normalize, resolve } from "path";

const ROOT = resolve(__dirname, "../..");

/** Серверные корни: файлы, чей граф импортов обязан быть свободен от "use client". */
const SERVER_ROOTS: string[] = [
  "app/franchize/server-actions/leads.ts",
  "app/franchize/server-actions/lead-notes.ts",
  // 2026-09-10: leads-kpis.ts (мёртвый легаси-экспорт getLeadsKpis) удалён —
  // единственный «возврат всего без окна» оставался опасным вором вызовов.
  "app/franchize/lib/lead-events.ts",
  "app/franchize/lib/lead-event-core.ts",
  "app/api/webhooks/avito/route.ts",
  "app/api/franchize/lead-todo/route.ts",
  "app/api/franchize/lead-handling/route.ts",
];

const exts = ["", ".ts", ".tsx", "/index.ts", "/index.tsx"];

function resolveTarget(fromFile: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) {
    base = join(ROOT, spec.slice(2));
  } else if (spec.startsWith("./") || spec.startsWith("../")) {
    base = normalize(join(dirname(fromFile), spec));
  } else {
    return null; // пакет node_modules — вне класса бага
  }
  for (const e of exts) {
    const cand = base + e;
    if (existsSync(cand) && statSync(cand).isFile()) return cand;
  }
  return null;
}

const IMPORT_RE = /(?:^|[\s;}])(?:import|export)\s[^"'`]*?from\s*["']([^"']+)["']|(?:^|[^.\w])import\(\s*["']([^"']+)["']\s*\)|(?:^|[\s;}])export\s+(?:\*|\{[^}]*\})\s*from\s*["']([^"']+)["']/g;
const TYPE_ONLY_RE = /^import\s+type\s/;

function extractSpecifiers(src: string): Array<{ spec: string; typeOnly: boolean }> {
  const out: Array<{ spec: string; typeOnly: boolean }> = [];
  // 1) полноценные import-объявления (включая import type) — берём вместе с префиксом
  const stmtRe = /(^|[\s;}])import\s+(type\s+)?[^;'"]*?from\s*["']([^"']+)["']/g;
  let m: RegExpExecArray | null;
  while ((m = stmtRe.exec(src))) {
    out.push({ spec: m[3], typeOnly: !!m[2] });
  }
  // 2) export ... from "..."
  const expRe = /(^|[\s;}])export\s+(?:type\s+)?(?:\*(?:\s+as\s+\w+)?|\{[^}]*\})\s*from\s*["']([^"']+)["']/g;
  while ((m = expRe.exec(src))) {
    out.push({ spec: m[2], typeOnly: !!/export\s+type/.test(m[0]) });
  }
  // 3) динамический import("...")
  const dynRe = /import\(\s*["']([^"']+)["']\s*\)/g;
  while ((m = dynRe.exec(src))) {
    out.push({ spec: m[1], typeOnly: false });
  }
  void TYPE_ONLY_RE;
  return out;
}

function isUseClientFile(file: string): boolean {
  const head = readFileSync(file, "utf8").slice(0, 200);
  return /(^|\n)\s*["']use client["']/.test(head);
}

/** BFS по графу; возвращает список путей «сервер → … → use client файл». */
function findClientReachable(root: string): string[] {
  const violations: string[] = [];
  const seen = new Set<string>([root]);
  const queue: Array<{ file: string; path: string[] }> = [{ file: root, path: [root] }];
  while (queue.length) {
    const { file, path } = queue.shift()!;
    let src: string;
    try {
      src = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    for (const { spec, typeOnly } of extractSpecifiers(src)) {
      // import type / export type стираются на компиляции — реального графа нет.
      if (typeOnly) continue;
      const target = resolveTarget(file, spec);
      if (!target || seen.has(target)) continue;
      seen.add(target);
      if (isUseClientFile(target)) {
        violations.push([...path, target].join(" → "));
        continue; // дальше из клиентского файла не идём
      }
      queue.push({ file: target, path: [...path, target] });
    }
  }
  return violations;
}

describe("server graph · серверный код не импортирует \"use client\" модули", () => {
  it("корневые серверные файлы существуют (защита от переименований)", () => {
    for (const r of SERVER_ROOTS) {
      expect(existsSync(join(ROOT, r)), `нет файла ${r}`).toBe(true);
    }
  });

  it.each(SERVER_ROOTS.map((r) => [r] as const))(
    "%s — граф импортов чист от \"use client\"",
    (root) => {
      const violations = findClientReachable(join(ROOT, root));
      expect(
        violations,
        `серверный граф из ${root} достигает клиентских модулей:\n${violations.join("\n")}\n` +
          `Вызов некомпонентного экспорта клиента с сервера падает в проде ` +
          `(createClientModuleProxy). Импортируйте чистую реализацию из lib/.`,
      ).toEqual([]);
    },
  );
});
