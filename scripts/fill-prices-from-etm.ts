/**
 * fill-prices-from-etm.ts — batch script: «марка + серия + артикул» rows →
 * ETM public card prices/stock, written back as CSV.
 *
 * The «227 missing prices» unlock from the megarepo blueprint §05: catalog
 * rows without prices can be filled TODAY from public ETM cards (no заявка,
 * no login). This script is input-agnostic on purpose — feed it the CSV
 * export of whatever table has the gap (products, catalog, …).
 *
 * SAFE BY DEFAULT: without --mode public it runs against the in-memory mock
 * (fixture data), so CI/dev runs never touch etm.ru.
 *
 * Usage:
 *   bun scripts/fill-prices-from-etm.ts --input rows.csv --output filled.csv
 *   bun scripts/fill-prices-from-etm.ts --mode public --input rows.csv --output filled.csv \
 *       [--delay-ms 800] [--limit 50] [--timeout-ms 15000]
 *
 * Input CSV (header required, column order free):
 *   mark,series,article
 *   ТМ-63,PX,11220
 *
 * Output CSV adds: etm_code,title,retail_price,opt_price,discount_pct,
 *                  cashback_points,stock_today,stock_later,url,status
 *   status: ok | not_found | empty_card | error:<code>
 */

import { readFileSync, writeFileSync } from "node:fs";

import { ConnectorError, isConnectorError } from "../lib/connectors/shared/errors";
import type { ConnectorCallContext } from "../lib/connectors/shared/errors";
import {
  getEtmClientFromEnv,
  MockEtmTransport,
} from "../lib/connectors/etm";
import {
  ETM_CARD_TM63_FIXTURE_HTML,
  ETM_SEARCH_TM63_FIXTURE_HTML,
} from "../lib/connectors/etm/fixtures/etm-card-tm63";
import { EtmClient } from "../lib/connectors/etm/client";
import type { EtmCardSnapshot } from "../lib/connectors/etm/types";

/* ── CLI ─────────────────────────────────────────────────────────────────── */

interface Args {
  mode: "mock" | "public";
  input: string | null;
  output: string;
  delayMs: number;
  limit: number;
  timeoutMs: number;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    mode: "mock",
    input: null,
    output: "etm-filled-prices.csv",
    delayMs: 800,
    limit: Number.POSITIVE_INFINITY,
    timeoutMs: 15_000,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1];
    switch (key) {
      case "--mode":
        if (value !== "mock" && value !== "public") {
          throw new Error(`--mode must be mock|public, got ${value}`);
        }
        args.mode = value;
        i += 1;
        break;
      case "--input":
        args.input = value;
        i += 1;
        break;
      case "--output":
        args.output = value;
        i += 1;
        break;
      case "--delay-ms":
        args.delayMs = Number(value);
        i += 1;
        break;
      case "--limit":
        args.limit = Number(value);
        i += 1;
        break;
      case "--timeout-ms":
        args.timeoutMs = Number(value);
        i += 1;
        break;
      default:
        throw new Error(`unknown flag ${key}`);
    }
  }
  return args;
}

/* ── minimal CSV (RFC-4180 subset: quotes + commas, our own files) ───────── */

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') inQuotes = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field.replace(/\r$/, ""));
      field = "";
      rows.push(row);
      row = [];
    } else field += ch;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }
  return rows.filter((r) => r.length > 0 && !(r.length === 1 && r[0] === ""));
}

function csvField(value: string | number | null | undefined): string {
  const s = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/* ── price extraction ────────────────────────────────────────────────────── */

function pickPrice(
  snapshot: EtmCardSnapshot,
  kind: "retail" | "opt",
): { amount: number | null; discountPercent: number | null; cashbackPoints: number | null } {
  const point = snapshot.prices.find((p) => p.kind === kind);
  return {
    amount: point?.amount ?? null,
    discountPercent: point?.discountPercent ?? null,
    cashbackPoints: kind === "retail" ? point?.cashbackPoints ?? null : null,
  };
}

/* ── main ────────────────────────────────────────────────────────────────── */

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!args.input) {
    console.error("usage: bun scripts/fill-prices-from-etm.ts --input rows.csv [--mode mock|public] ...");
    process.exit(2);
  }

  const context: ConnectorCallContext = {
    actor: { id: "fill-prices-batch", kind: "system" },
    correlationId: `batch:${new Date().toISOString()}`,
  };

  let client: EtmClient;
  if (args.mode === "mock") {
    const mock = new MockEtmTransport({
      cards: { 5517285: ETM_CARD_TM63_FIXTURE_HTML },
      searches: { "ТМ-63 PX 11220": ETM_SEARCH_TM63_FIXTURE_HTML },
    });
    client = new EtmClient({ transport: mock, baseUrl: "https://www.etm.ru" });
  } else {
    client = getEtmClientFromEnv({ ETM_MODE: "public" } as NodeJS.ProcessEnv);
  }

  const header = [
    "mark",
    "series",
    "article",
    "etm_code",
    "title",
    "retail_price",
    "opt_price",
    "discount_pct",
    "cashback_points",
    "stock_today",
    "stock_later",
    "url",
    "status",
  ];

  const text = readFileSync(args.input, "utf8");
  const rows = parseCsv(text);
  const [inputHeader, ...dataRows] = rows;
  const headerIndex = (name: string) => inputHeader.findIndex((h) => h.trim().toLowerCase() === name);
  const markIdx = headerIndex("mark");
  const seriesIdx = headerIndex("series");
  const articleIdx = headerIndex("article");
  if (markIdx === -1) {
    console.error('input CSV must have a "mark" column (series/article recommended)');
    process.exit(2);
  }

  const out: string[] = [header.join(",")];
  const stats = { ok: 0, not_found: 0, empty_card: 0, error: 0 };
  const targets = dataRows.slice(0, Number.isFinite(args.limit) ? args.limit : undefined);

  for (const [i, row] of targets.entries()) {
    const mark = row[markIdx] ?? "";
    const series = seriesIdx >= 0 ? row[seriesIdx] ?? "" : "";
    const article = articleIdx >= 0 ? row[articleIdx] ?? "" : "";
    const base = [mark, series, article];

    if (!mark.trim()) {
      out.push([...base, "", "", "", "", "", "", "", "", "", "error:EMPTY_ROW"].map(csvField).join(","));
      stats.error += 1;
      continue;
    }

    try {
      const hit = await client.findByRef({ mark, series: series || undefined, article: article || undefined }, context);
      if (!hit) {
        out.push([...base, "", "", "", "", "", "", "", "", "", "not_found"].map(csvField).join(","));
        stats.not_found += 1;
      } else {
        const snapshot = await client.getCard(hit.code, context);
        const hasPrices = snapshot.prices.length > 0;
        if (!hasPrices && !snapshot.title) {
          // empty page (client-side rendered / throttled) — retry later per README
          out.push([...base, hit.code, "", "", "", "", "", "", "", "", hit.url ?? "", "empty_card"].map(csvField).join(","));
          stats.empty_card += 1;
        } else {
          const retail = pickPrice(snapshot, "retail");
          const opt = pickPrice(snapshot, "opt");
          out.push(
            [
              ...base,
              snapshot.code,
              snapshot.title ?? hit.title ?? "",
              retail.amount,
              opt.amount,
              retail.discountPercent,
              retail.cashbackPoints,
              snapshot.stock?.availableToday ?? "",
              snapshot.stock?.availableLater ?? "",
              snapshot.url ?? hit.url ?? "",
              "ok",
            ]
              .map(csvField)
              .join(","),
          );
          stats.ok += 1;
        }
      }
    } catch (error) {
      const code = isConnectorError(error) ? error.code : "INTERNAL";
      out.push([...base, "", "", "", "", "", "", "", "", "", `error:${code}`].map(csvField).join(","));
      stats.error += 1;
      if (error instanceof ConnectorError) {
        console.error(`[row ${i + 2}] ${mark} ${series} ${article}: ${error.code} — ${error.message}`);
      }
    }

    if (args.mode === "public" && i < targets.length - 1) {
      await sleep(args.delayMs); // be polite to the public site
    }
  }

  writeFileSync(args.output, `${out.join("\n")}\n`, "utf8");
  console.log(
    `[fill-prices] mode=${args.mode} rows=${targets.length} → ${args.output} · ` +
      `ok=${stats.ok} not_found=${stats.not_found} empty_card=${stats.empty_card} error=${stats.error}`,
  );
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exit(1);
});
