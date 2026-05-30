/**
 * htmlToDocx.ts — Proper HTML → docx element converter (TypeScript)
 *
 * Parses HTML with cheerio and produces an array of docx construct objects
 * (Paragraph, Table) that preserve formatting: bold, centering, indentation,
 * tables with borders, horizontal rules, line breaks, etc.
 *
 * Usage:
 *   import { htmlToDocxElements } from '@/lib/htmlToDocx';
 *   const children = htmlToDocxElements(renderedHtml);
 *   const doc = new Document({ sections: [{ children }] });
 */

import * as cheerio from "cheerio";
import {
  Document,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  AlignmentType,
  BorderStyle,
  WidthType,
  PageBreak,
} from "docx";

// ─── Types ──────────────────────────────────────────────────────────

interface RunContext {
  bold?: boolean;
  italic?: boolean;
  fontSize?: number;
  upperCase?: boolean;
}

interface StyleMap {
  [key: string]: string;
}

// ─── Constants ──────────────────────────────────────────────────────

const CM_TO_TWIP = 567;
const PT_TO_HALF_PT = 2;
const DEFAULT_FONT = "Times New Roman";

const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const THIN_BORDER = { style: BorderStyle.SINGLE, size: 1, color: "000000" };

// ─── Helpers ────────────────────────────────────────────────────────

function cssLengthToTwip(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const s = raw.trim().toLowerCase();
  const cm = s.match(/^([\d.]+)\s*cm$/);
  if (cm) return Math.round(parseFloat(cm[1]) * CM_TO_TWIP);
  const pt = s.match(/^([\d.]+)\s*pt$/);
  if (pt) return Math.round(parseFloat(pt[1]) * 20);
  const px = s.match(/^([\d.]+)\s*px$/);
  if (px) return Math.round(parseFloat(px[1]) * 15);
  const bare = s.match(/^([\d.]+)$/);
  if (bare) return Math.round(parseFloat(bare[1]) * 20);
  return undefined;
}

function cssFontSizeToHalfPt(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const s = raw.trim().toLowerCase();
  const pt = s.match(/^([\d.]+)\s*pt$/);
  if (pt) return Math.round(parseFloat(pt[1]) * PT_TO_HALF_PT);
  return undefined;
}

function parseStyle(raw: string | undefined): StyleMap {
  const map: StyleMap = {};
  if (!raw) return map;
  for (const part of raw.split(";")) {
    const [k, ...rest] = part.split(":");
    if (k && rest.length) map[k.trim().toLowerCase()] = rest.join(":").trim();
  }
  return map;
}

function mapAlign(style: StyleMap): AlignmentType | undefined {
  const v = style["text-align"];
  if (!v) return undefined;
  const s = v.toLowerCase().trim();
  if (s === "center") return AlignmentType.CENTER;
  if (s === "right") return AlignmentType.RIGHT;
  if (s === "justify") return AlignmentType.JUSTIFIED;
  if (s === "left") return AlignmentType.LEFT;
  return undefined;
}

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&emsp;/g, "\t")
    .replace(/&ensp;/g, "  ")
    .replace(/&quot;/g, '"')
    .replace(/&laquo;/g, "\u00AB")
    .replace(/&raquo;/g, "\u00BB")
    .replace(/&ndash;/g, "\u2013")
    .replace(/&mdash;/g, "\u2014")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(x[0-9a-f]+);/gi, (_, code: string) => String.fromCharCode(parseInt(code.slice(1), 16)))
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)));
}

function cellBordersFromStyle(style: StyleMap, rowStyle?: StyleMap) {
  const borderProp = style["border"] || rowStyle?.["border"];
  if (!borderProp || borderProp === "none") {
    return { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER };
  }
  if (/solid/i.test(borderProp)) {
    return { top: THIN_BORDER, bottom: THIN_BORDER, left: THIN_BORDER, right: THIN_BORDER };
  }
  return { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER };
}

function isBoldWeight(val: string | undefined): boolean {
  if (!val) return false;
  if (val === "bold") return true;
  const n = Number(val);
  return !isNaN(n) && n >= 700;
}

// ─── Inline run builder ────────────────────────────────────────────

function collectRuns($el: cheerio.Cheerio<any>, $: cheerio.CheerioAPI, ctx: RunContext = {}): TextRun[] {
  const runs: TextRun[] = [];

  $el.contents().each((_, node) => {
    if (node.type === "text") {
      let text = decodeEntities((node as any).data || "");
      if (ctx.upperCase) text = text.toUpperCase();
      if (text) {
        const runOpts: any = { text, font: DEFAULT_FONT };
        if (ctx.bold) runOpts.bold = true;
        if (ctx.italic) runOpts.italics = true;
        if (ctx.fontSize) runOpts.size = ctx.fontSize;
        runs.push(new TextRun(runOpts));
      }
      return;
    }

    if (node.type !== "tag") return;

    const tag = (node as any).tagName?.toLowerCase();
    const $child = $(node as any);
    const childStyle = parseStyle($child.attr("style"));
    const childCtx: RunContext = { ...ctx };

    if (tag === "b" || tag === "strong") childCtx.bold = true;
    if (tag === "i" || tag === "em") childCtx.italic = true;
    if (isBoldWeight(childStyle["font-weight"])) childCtx.bold = true;
    if (childStyle["font-size"]) childCtx.fontSize = cssFontSizeToHalfPt(childStyle["font-size"]);
    if (childStyle["text-transform"] === "uppercase") childCtx.upperCase = true;

    if (tag === "br") {
      runs.push(new TextRun({ break: 1 }));
      return;
    }

    runs.push(...collectRuns($child, $, childCtx));
  });

  return runs;
}

// ─── Table builder ──────────────────────────────────────────────────

function buildTable($table: cheerio.Cheerio<any>, $: cheerio.CheerioAPI): Table | null {
  const rows: TableRow[] = [];

  // Support both <table><tr> and <table><thead|tbody><tr>
  const $rows = $table.children("tr").length
    ? $table.children("tr")
    : $table.children("thead, tbody, tfoot").children("tr");

  // ── Determine column count and compute proportional widths ──
  const firstRowCells = $rows.first().children("td, th");
  const colCount = firstRowCells.length || 1;

  // Table width from style (default = page width minus margins ≈ 9000 twip for A4)
  const tableStyle = parseStyle($table.attr("style"));
  const tableWidthTwip = cssLengthToTwip(tableStyle["width"]) || 9000;

  // Collect explicit column widths from first row; fall back to equal division
  const colWidths: number[] = [];
  firstRowCells.each((__, cellNode) => {
    const $cell = $(cellNode);
    const cellStyle = parseStyle($cell.attr("style"));
    const w = cellStyle["width"];
    if (w) {
      // Handle percentage widths
      const pct = String(w).match(/^([\d.]+)%$/);
      if (pct) {
        colWidths.push(Math.round(tableWidthTwip * parseFloat(pct[1]) / 100));
      } else {
        const twip = cssLengthToTwip(w);
        colWidths.push(twip || Math.round(tableWidthTwip / colCount));
      }
    } else {
      colWidths.push(Math.round(tableWidthTwip / colCount));
    }
  });

  // Normalize widths: ensure they sum to tableWidthTwip
  const totalW = colWidths.reduce((a, b) => a + b, 0);
  if (totalW > 0 && Math.abs(totalW - tableWidthTwip) > 10) {
    const scale = tableWidthTwip / totalW;
    for (let i = 0; i < colWidths.length; i++) colWidths[i] = Math.round(colWidths[i] * scale);
  }

  $rows.each((_, trNode) => {
    const $tr = $(trNode);
    const rowStyle = parseStyle($tr.attr("style"));
    const cells: TableCell[] = [];

    $tr.children("td, th").each((colIdx, cellNode) => {
      const $cell = $(cellNode);
      const cellStyle = parseStyle($cell.attr("style"));
      const isHeader = (cellNode as any).tagName?.toLowerCase() === "th";
      const borders = cellBordersFromStyle(cellStyle, rowStyle);

      const cellParagraphs: Paragraph[] = [];
      const pChildren = $cell.children("p");

      if (pChildren.length) {
        pChildren.each((___, pInCell) => {
          const $p = $(pInCell);
          const pStyle = parseStyle($p.attr("style"));
          const pCtx: RunContext = {};
          if (isBoldWeight(pStyle["font-weight"])) pCtx.bold = true;
          if (pStyle["font-size"]) pCtx.fontSize = cssFontSizeToHalfPt(pStyle["font-size"]);
          if (isHeader) pCtx.bold = true;

          const runs = collectRuns($p, $, pCtx);
          cellParagraphs.push(
            new Paragraph({
              alignment: mapAlign(pStyle) || mapAlign(cellStyle),
              children: runs.length ? runs : [new TextRun({ text: "", font: DEFAULT_FONT })],
            }),
          );
        });
      } else {
        const cellCtx: RunContext = {};
        if (isBoldWeight(cellStyle["font-weight"])) cellCtx.bold = true;
        if (isHeader) cellCtx.bold = true;

        const runs = collectRuns($cell, $, cellCtx);
        cellParagraphs.push(
          new Paragraph({
            alignment: mapAlign(cellStyle),
            children: runs.length ? runs : [new TextRun({ text: "", font: DEFAULT_FONT })],
          }),
        );
      }

      const cellOpts: any = { children: cellParagraphs, borders };
      // Always set explicit column width to prevent vertical-letter rendering bug
      const colW = colWidths[colIdx] || Math.round(tableWidthTwip / colCount);
      cellOpts.width = { size: colW, type: WidthType.DXA };

      cells.push(new TableCell(cellOpts));
    });

    if (cells.length) rows.push(new TableRow({ children: cells }));
  });

  if (!rows.length) return null;
  return new Table({ rows, width: { size: tableWidthTwip, type: WidthType.DXA } });
}

// ─── Paragraph builder ──────────────────────────────────────────────

function buildParagraph($el: cheerio.Cheerio<any>, $: cheerio.CheerioAPI): Paragraph {
  const style = parseStyle($el.attr("style"));
  const pOpts: any = {};

  // Default to JUSTIFIED for body paragraphs (matches GOST legal doc standard)
  // Only override for explicit text-align in style
  const align = mapAlign(style);
  pOpts.alignment = align || AlignmentType.JUSTIFIED;

  if (style["text-indent"]) {
    const twip = cssLengthToTwip(style["text-indent"]);
    if (twip) pOpts.indent = { firstLine: twip };
  }

  const spacing: any = {};
  if (style["margin-top"]) {
    const before = cssLengthToTwip(style["margin-top"]);
    if (before) spacing.before = before;
  }
  if (style["margin-bottom"]) {
    const after = cssLengthToTwip(style["margin-bottom"]);
    if (after) spacing.after = after;
  }
  if (Object.keys(spacing).length) pOpts.spacing = spacing;

  const ctx: RunContext = {};
  if (isBoldWeight(style["font-weight"])) ctx.bold = true;
  if (style["font-size"]) ctx.fontSize = cssFontSizeToHalfPt(style["font-size"]);
  if (style["text-transform"] === "uppercase") ctx.upperCase = true;

  const runs = collectRuns($el, $, ctx);
  pOpts.children = runs.length ? runs : [new TextRun({ text: "", font: DEFAULT_FONT })];

  return new Paragraph(pOpts);
}

// ─── Process element ────────────────────────────────────────────────

type DocxElement = Paragraph | Table;

function processElement($el: cheerio.Cheerio<any>, $: cheerio.CheerioAPI): DocxElement | DocxElement[] | null {
  const tag = ($el[0] as any)?.tagName?.toLowerCase();
  if (!tag) return null;

  if (tag === "p") return buildParagraph($el, $);
  if (tag === "table") return buildTable($el, $);

  if (tag === "hr") {
    return new Paragraph({
      spacing: { before: 200, after: 200 },
      border: {
        bottom: { style: BorderStyle.SINGLE, size: 6, color: "000000", space: 1 },
      },
      children: [new TextRun({ text: " ", font: DEFAULT_FONT, size: 2 })],
    });
  }

  if (/^h[1-6]$/.test(tag)) {
    const style = parseStyle($el.attr("style"));
    const ctx: RunContext = { bold: true };
    if (style["font-size"]) ctx.fontSize = cssFontSizeToHalfPt(style["font-size"]);
    const runs = collectRuns($el, $, ctx);
    return new Paragraph({
      alignment: mapAlign(style),
      spacing: { before: 240, after: 120 },
      children: runs,
    });
  }

  if (tag === "ul" || tag === "ol") {
    const items: Paragraph[] = [];
    $el.children("li").each((_, liNode) => {
      const $li = $(liNode);
      const style = parseStyle($li.attr("style"));
      const ctx: RunContext = {};
      if (isBoldWeight(style["font-weight"])) ctx.bold = true;
      const runs = collectRuns($li, $, ctx);
      items.push(
        new Paragraph({
          alignment: mapAlign(style),
          indent: { left: CM_TO_TWIP },
          children: [new TextRun({ text: "\u2022 ", font: DEFAULT_FONT }), ...runs],
        }),
      );
    });
    return items.length ? items : null;
  }

  if (tag === "div" || tag === "section" || tag === "article" || tag === "main") {
    const style = parseStyle($el.attr("style"));
    const hasPageBreak = style["page-break-before"] === "always"
      || $el.hasClass("page-break");
    const inner: DocxElement[] = [];
    if (hasPageBreak) inner.push(new Paragraph({ children: [new PageBreak()] }));
    $el.children().each((_, child) => {
      if ((child as any).type === "tag") {
        const el = processElement($(child as any), $);
        if (el) {
          if (Array.isArray(el)) inner.push(...el);
          else inner.push(el);
        }
      }
    });
    return inner.length ? inner : null;
  }

  return buildParagraph($el, $);
}

// ─── Main entry point ──────────────────────────────────────────────

/**
 * Convert rendered HTML string → array of docx Paragraph/Table objects.
 */
export function htmlToDocxElements(html: string): DocxElement[] {
  const $ = cheerio.load(html);
  const elements: DocxElement[] = [];

  const $root = $("body").length ? $("body") : $.root();

  $root.children().each((_, node) => {
    if ((node as any).type !== "tag") return;
    const el = processElement($(node as any), $);
    if (el) {
      if (Array.isArray(el)) elements.push(...el);
      else elements.push(el);
    }
  });

  if (!elements.length) {
    $.root()
      .children()
      .each((_, node) => {
        if ((node as any).type !== "tag") return;
        const el = processElement($(node as any), $);
        if (el) {
          if (Array.isArray(el)) elements.push(...el);
          else elements.push(el);
        }
      });
  }

  return elements.length
    ? elements
    : [new Paragraph({ children: [new TextRun({ text: " ", font: DEFAULT_FONT })] })];
}

/**
 * Build a full docx Document from HTML string with default Russian legal styling.
 */
export function htmlToDocxDocument(html: string): Document {
  const children = htmlToDocxElements(html);
  return new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1134,    // 2 cm
              right: 1134,
              bottom: 1134,
              left: 1701,   // 3 cm (Russian GOST)
            },
          },
        },
        children,
      },
    ],
  });
}
