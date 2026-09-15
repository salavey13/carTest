/**
 * Parser for ETM public product cards.
 *
 * The public card (etm.ru/cat/nn/{code}) is server-rendered enough for label
 * extraction: «Розничная цена 7 123.82₽», «5 169.51 ₽/шт - 27 %», «Кешбэк ЭТМ
 * до 601.42 баллов», «7 шт. Сегодня / 794 шт. Позже», «Артикул: 11220»,
 * «Производитель: INSTALL», «Марка ТМ-63», plus colon-separated spec pairs.
 *
 * The parser is deliberately tolerant: it never throws on a partial card —
 * it returns whatever it could find, and the caller decides what is mandatory.
 */

import { ConnectorError } from "../shared/errors";
import type { EtmCardSnapshot, EtmPricePoint } from "./types";

/** HTML → label-oriented text: block tags become newlines, tags stripped, entities fixed. */
export function cardHtmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h[1-6]|section|article|table)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

/** "7 123.82" / "7\u00a0123,82" → 7123.82. Returns null when not parseable. */
export function parseAmount(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/\u00a0/g, " ").replace(/\s/g, "").replace(/,/g, ".");
  if (!/^[\d.]+$/.test(cleaned)) return null;
  const value = Number.parseFloat(cleaned);
  return Number.isFinite(value) ? value : null;
}

function matchOne(text: string, re: RegExp): string | null {
  const m = text.match(re);
  return m && m[1] ? m[1].trim() : null;
}

function extractPrices(text: string): EtmPricePoint[] {
  const prices: EtmPricePoint[] = [];

  // «Розничная цена 7 123.82₽» (nbsp inside amount tolerated)
  const retailRaw = matchOne(text, /Розничная цена\s*([\d\s\u00a0.,]{2,20})\s*(?:₽|руб)/);
  const retail = parseAmount(retailRaw);
  if (retail !== null) prices.push({ kind: "retail", amount: retail, currency: "RUB" });

  // «5 169.51 ₽/шт - 27 %» — opt/legal-entity tier with a discount percent
  const optRaw = text.match(/([\d\s\u00a0.,]{2,20})\s*(?:₽|руб)\s*\/\s*шт\s*-\s*(\d{1,2})\s*%/);
  if (optRaw) {
    const opt = parseAmount(optRaw[1]);
    if (opt !== null) {
      prices.push({
        kind: "opt",
        amount: opt,
        currency: "RUB",
        discountPercent: Number.parseInt(optRaw[2], 10),
      });
    }
  }

  // «Кешбэк ЭТМ до 601.42 баллов»
  const cashbackRaw = matchOne(text, /Кешбэк[^\d]{1,40}([\d\s\u00a0.,]{2,15})\s*балл/);
  const cashback = parseAmount(cashbackRaw);
  if (cashback !== null && prices.length > 0) {
    prices[0].cashbackPoints = cashback;
  }

  return prices;
}

function extractStock(text: string): EtmCardSnapshot["stock"] {
  const today = matchOne(text, /(\d+)\s*шт[.\s]*Сегодня/i);
  const later = matchOne(text, /(\d+)\s*шт[.\s]*Позже/i);
  const sentenceMatch = text.match(/(\d+\s*шт[.\s]*Сегодня[^А-Яа-я]{0,6}\d*\s*шт[.\s]*Позже)/i);
  if (today === null && later === null) return undefined;
  return {
    availableToday: today === null ? null : Number.parseInt(today, 10),
    availableLater: later === null ? null : Number.parseInt(later, 10),
    raw: sentenceMatch ? sentenceMatch[1].trim() : undefined,
  };
}

function extractSpecs(text: string): Record<string, string> {
  const specs: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*([A-Za-zА-Яа-яЁё0-9 ,.%/()'"-]{3,60}?)\s*:\s*(.+?)\s*$/);
    if (!m) continue;
    const label = m[1].replace(/\s+/g, " ").trim();
    const value = m[2].replace(/\s+/g, " ").trim();
    if (!label || !value || value.length > 120) continue;
    if (specs[label] === undefined) specs[label] = value;
  }
  return specs;
}

/** Extract label-value pairs written without a colon («Марка ТМ-63», «Серия PX»). */
function extractLooseField(text: string, label: string): string | null {
  const m = text.match(new RegExp(`(?:^|\\n|\\s)${label}\\s+([^\\n:;]{1,60})`, "i"));
  if (!m || !m[1]) return null;
  const value = m[1].replace(/\s+/g, " ").trim();
  return value || null;
}

export function parseEtmCard(input: {
  html?: string;
  text?: string;
  code?: string;
  url?: string;
}): EtmCardSnapshot {
  const text = input.text ?? (input.html ? cardHtmlToText(input.html) : "");
  if (!text.trim()) {
    throw new ConnectorError({
      connector: "etm",
      code: "PARSE_ERROR",
      message: "parseEtmCard: empty input (no html/text)",
    });
  }

  const code =
    input.code ??
    matchOne(text, /Код товара:\s*(\d{4,12})/) ??
    matchOne(input.url ? input.url : "", /\/cat\/nn\/(\d+)/) ??
    "";

  const title = matchOne(input.html ?? "", /<title>([^<]{3,300})<\/title>/i);
  const prices = extractPrices(text);
  const specs = extractSpecs(text);

  const article =
    matchOne(text, /Артикул:\s*([A-Za-zА-Яа-яЁё0-9][A-Za-zА-Яа-яЁё0-9\-.\/]{0,40})/) ?? undefined;
  const brand = specs["Производитель"] ?? extractLooseField(text, "Производитель") ?? undefined;
  const mark = specs["Марка"] ?? extractLooseField(text, "Марка") ?? undefined;
  const series = specs["Серия"] ?? extractLooseField(text, "Серия") ?? undefined;
  const unit = specs["Ед.измерения"] ?? specs["Ед. измерения"] ?? undefined;

  return {
    code,
    url: input.url,
    title: title ?? undefined,
    article,
    brand,
    mark,
    series,
    unit,
    prices,
    stock: extractStock(text),
    specs,
    parsedAt: new Date().toISOString(),
  };
}
