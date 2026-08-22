/**
 * htmlToDocx.ts — Proper HTML → docx element converter
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

import { load, type CheerioAPI, type AnyNode, type Element } from 'cheerio';
import {
  Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, BorderStyle, WidthType, PageBreak,
} from 'docx';

// ─── Helpers ────────────────────────────────────────────────────────

const CM_TO_TWIP = 567;      // 1 cm ≈ 567 twip
const PT_TO_HALF_PT = 2;     // docx sizes are in half-points
const DEFAULT_FONT = 'Times New Roman';

/** Convert CSS length → twip */
export function cssLengthToTwip(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const s = String(raw).trim().toLowerCase();
  const cm = s.match(/^([\d.]+)\s*cm$/);
  if (cm) return Math.round(parseFloat(cm[1]) * CM_TO_TWIP);
  const pt = s.match(/^([\d.]+)\s*pt$/);
  if (pt) return Math.round(parseFloat(pt[1]) * 20);   // 1pt = 20 twip
  const px = s.match(/^([\d.]+)\s*px$/);
  if (px) return Math.round(parseFloat(px[1]) * 15);
  const bare = s.match(/^([\d.]+)$/);
  if (bare) return Math.round(parseFloat(bare[1]) * 20);
  return undefined;
}

/** Convert CSS font-size → half-points for TextRun.size */
export function cssFontSizeToHalfPt(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const s = String(raw).trim().toLowerCase();
  const pt = s.match(/^([\d.]+)\s*pt$/);
  if (pt) return Math.round(parseFloat(pt[1]) * PT_TO_HALF_PT);
  return undefined;
}

/** Parse inline style string → key-value map */
export function parseStyle(raw: string | undefined): Record<string, string> {
  const map: Record<string, string> = {};
  if (!raw) return map;
  for (const part of String(raw).split(';')) {
    const [k, ...rest] = part.split(':');
    if (k && rest.length) map[k.trim().toLowerCase()] = rest.join(':').trim();
  }
  return map;
}

/** Map CSS text-align → docx AlignmentType */
function mapAlign(style: Record<string, string>): (typeof AlignmentType)[keyof typeof AlignmentType] | undefined {
  const v = style['text-align'];
  if (!v) return undefined;
  const s = v.toLowerCase().trim();
  if (s === 'center') return AlignmentType.CENTER;
  if (s === 'right') return AlignmentType.RIGHT;
  if (s === 'justify') return AlignmentType.JUSTIFIED;
  if (s === 'left') return AlignmentType.LEFT;
  return undefined;
}

/** Decode common HTML entities */
function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&emsp;/g, '\t')
    .replace(/&ensp;/g, '  ')
    .replace(/&quot;/g, '"')
    .replace(/&laquo;/g, '\u00AB')
    .replace(/&raquo;/g, '\u00BB')
    .replace(/&ndash;/g, '\u2013')
    .replace(/&mdash;/g, '\u2014')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(x[0-9a-f]+);/gi, (_, code: string) => String.fromCharCode(parseInt(code.slice(1), 16)))
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)));
}

// ─── Border helpers ─────────────────────────────────────────────────

const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const THIN_BORDER = { style: BorderStyle.SINGLE, size: 1, color: '000000' };

function cellBordersFromStyle(
  style: Record<string, string>,
  rowStyle?: Record<string, string>,
): { top: typeof NO_BORDER; bottom: typeof NO_BORDER; left: typeof NO_BORDER; right: typeof NO_BORDER } {
  const borderProp = style['border'] || rowStyle?.['border'];
  if (!borderProp || borderProp === 'none') {
    return { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER };
  }
  if (/solid/i.test(borderProp)) {
    return { top: THIN_BORDER, bottom: THIN_BORDER, left: THIN_BORDER, right: THIN_BORDER };
  }
  return { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER };
}

// ─── Inline run builder ────────────────────────────────────────────

interface RunContext {
  bold?: boolean;
  italic?: boolean;
  fontSize?: number;
  upperCase?: boolean;
}

/**
 * Recursively collect TextRun[] from an element's children.
 */
export function collectRuns($el: ReturnType<CheerioAPI>, $: CheerioAPI, ctx: RunContext = {}): TextRun[] {
  const runs: TextRun[] = [];

  $el.contents().each((_, node: AnyNode) => {
    if (node.type === 'text') {
      let text = decodeEntities((node as any).data || '');
      if (ctx.upperCase) text = text.toUpperCase();
      if (text) {
        const runOpts: Record<string, any> = { text, font: DEFAULT_FONT };
        if (ctx.bold) runOpts.bold = true;
        if (ctx.italic) runOpts.italics = true;
        if (ctx.fontSize) runOpts.size = ctx.fontSize;
        runs.push(new TextRun(runOpts));
      }
      return;
    }

    if (node.type !== 'tag') return;

    const tag = (node as Element).tagName.toLowerCase();
    const $child = $(node);
    const childStyle = parseStyle($child.attr('style'));
    const childCtx: RunContext = { ...ctx };

    if (tag === 'b' || tag === 'strong') childCtx.bold = true;
    if (tag === 'i' || tag === 'em') childCtx.italic = true;
    if (childStyle['font-weight'] === 'bold' || Number(childStyle['font-weight']) >= 700) childCtx.bold = true;
    if (childStyle['font-size']) childCtx.fontSize = cssFontSizeToHalfPt(childStyle['font-size']);
    if (childStyle['text-transform'] === 'uppercase') childCtx.upperCase = true;

    if (tag === 'br') {
      runs.push(new TextRun({ break: 1 }));
      return;
    }

    runs.push(...collectRuns($child, $, childCtx));
  });

  return runs;
}

// ─── Table builder ──────────────────────────────────────────────────

export function buildTable($table: ReturnType<CheerioAPI>, $: CheerioAPI): Table | null {
  const rows: TableRow[] = [];

  // Support both <table><tr> and <table><thead|tbody><tr>
  const $rows = $table.children('tr').length
    ? $table.children('tr')
    : $table.children('thead, tbody, tfoot').children('tr');

  // ── Determine column count and compute proportional widths ──
  const firstRowCells = $rows.first().children('td, th');
  const colCount = firstRowCells.length || 1;

  // Table width from style (default = page width minus margins ≈ 9000 twip for A4)
  const tableStyle = parseStyle($table.attr('style'));
  const tableWidthTwip = cssLengthToTwip(tableStyle['width']) || 9000;

  // Collect explicit column widths from first row; fall back to equal division
  const colWidths: number[] = [];
  firstRowCells.each((__: number, cellNode: AnyNode) => {
    const $cell = $(cellNode);
    const cellStyle = parseStyle($cell.attr('style'));
    const w = cellStyle['width'];
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

  $rows.each((_, trNode: AnyNode) => {
    const $tr = $(trNode);
    const rowStyle = parseStyle($tr.attr('style'));
    const cells: TableCell[] = [];

    $tr.children('td, th').each((colIdx: number, cellNode: AnyNode) => {
      const $cell = $(cellNode);
      const cellStyle = parseStyle($cell.attr('style'));
      const isHeader = (cellNode as Element).tagName.toLowerCase() === 'th';

      const borders = cellBordersFromStyle(cellStyle, rowStyle);

      const cellParagraphs: Paragraph[] = [];
      const pChildren = $cell.children('p');

      if (pChildren.length) {
        pChildren.each((___: number, pInCell: AnyNode) => {
          const $p = $(pInCell);
          const pStyle = parseStyle($p.attr('style'));
          const pCtx: RunContext = {};
          if (pStyle['font-weight'] === 'bold' || Number(pStyle['font-weight']) >= 700) pCtx.bold = true;
          if (pStyle['font-size']) pCtx.fontSize = cssFontSizeToHalfPt(pStyle['font-size']);
          if (isHeader) pCtx.bold = true;

          const runs = collectRuns($p, $, pCtx);
          cellParagraphs.push(new Paragraph({
            alignment: mapAlign(pStyle) || mapAlign(cellStyle),
            children: runs.length ? runs : [new TextRun({ text: '', font: DEFAULT_FONT })],
          }));
        });
      } else {
        const cellCtx: RunContext = {};
        if (cellStyle['font-weight'] === 'bold' || Number(cellStyle['font-weight']) >= 700) cellCtx.bold = true;
        if (isHeader) cellCtx.bold = true;

        const runs = collectRuns($cell, $, cellCtx);
        cellParagraphs.push(new Paragraph({
          alignment: mapAlign(cellStyle),
          children: runs.length ? runs : [new TextRun({ text: '', font: DEFAULT_FONT })],
        }));
      }

      const cellOpts: Record<string, any> = { children: cellParagraphs, borders };
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

export function buildParagraph($el: ReturnType<CheerioAPI>, $: CheerioAPI): Paragraph {
  const style = parseStyle($el.attr('style'));
  const pOpts: Record<string, any> = {};

  // Default to JUSTIFIED for body paragraphs (matches GOST legal doc standard)
  // Only override for explicit text-align in style
  const align = mapAlign(style);
  pOpts.alignment = align || AlignmentType.JUSTIFIED;

  if (style['text-indent']) {
    const twip = cssLengthToTwip(style['text-indent']);
    if (twip) pOpts.indent = { firstLine: twip };
  }

  if (style['margin-top']) {
    const before = cssLengthToTwip(style['margin-top']);
    if (before) pOpts.spacing = { ...(pOpts.spacing || {}), before };
  }
  if (style['margin-bottom']) {
    const after = cssLengthToTwip(style['margin-bottom']);
    if (after) pOpts.spacing = { ...(pOpts.spacing || {}), after };
  }

  const ctx: RunContext = {};
  if (style['font-weight'] === 'bold' || Number(style['font-weight']) >= 700) ctx.bold = true;
  if (style['font-size']) ctx.fontSize = cssFontSizeToHalfPt(style['font-size']);
  if (style['text-transform'] === 'uppercase') ctx.upperCase = true;

  const runs = collectRuns($el, $, ctx);
  pOpts.children = runs.length ? runs : [new TextRun({ text: '', font: DEFAULT_FONT })];

  return new Paragraph(pOpts);
}

// ─── Main entry point ──────────────────────────────────────────────

/**
 * Convert rendered HTML string → array of docx Paragraph/Table objects.
 * @param html — HTML content (template vars already substituted)
 * @returns Array of Paragraph | Table instances
 */
export function htmlToDocxElements(html: string): (Paragraph | Table)[] {
  const $ = load(html);
  const elements: (Paragraph | Table | (Paragraph | Table)[])[] = [];

  // Find content root: prefer <body>, else the outer wrapper
  const $root = $('body').length ? $('body') : $.root();

  $root.children().each((_, node: AnyNode) => {
    if (node.type !== 'tag') return;
    const el = processElement($(node), $);
    if (el) {
      if (Array.isArray(el)) elements.push(el);
      else elements.push(el);
    }
  });

  // Fallback: if nothing produced, try root's immediate children
  if (!elements.length) {
    $.root().children().each((_, node: AnyNode) => {
      if (node.type !== 'tag') return;
      const el = processElement($(node), $);
      if (el) {
        if (Array.isArray(el)) elements.push(el);
        else elements.push(el);
      }
    });
  }

  // Flatten any nested arrays
  const flat: (Paragraph | Table)[] = [];
  for (const e of elements) {
    if (Array.isArray(e)) flat.push(...e);
    else flat.push(e);
  }

  return flat.length
    ? flat
    : [new Paragraph({ children: [new TextRun({ text: ' ', font: DEFAULT_FONT })] })];
}

/**
 * Process a single HTML element → docx construct(s)
 */
function processElement($el: ReturnType<CheerioAPI>, $: CheerioAPI): (Paragraph | Table | (Paragraph | Table)[]) | null {
  const tag = (($el[0] as Element)?.tagName || '').toLowerCase();
  if (!tag) return null;

  if (tag === 'p') return buildParagraph($el, $);

  if (tag === 'table') return buildTable($el, $);

  if (tag === 'hr') {
    return new Paragraph({
      spacing: { before: 200, after: 200 },
      border: {
        bottom: { style: BorderStyle.SINGLE, size: 6, color: '000000', space: 1 },
      },
      children: [new TextRun({ text: ' ', font: DEFAULT_FONT, size: 2 })],
    });
  }

  if (/^h[1-6]$/.test(tag)) {
    const style = parseStyle($el.attr('style'));
    const ctx: RunContext = { bold: true };
    if (style['font-size']) ctx.fontSize = cssFontSizeToHalfPt(style['font-size']);
    const runs = collectRuns($el, $, ctx);
    return new Paragraph({
      alignment: mapAlign(style),
      spacing: { before: 240, after: 120 },
      children: runs,
    });
  }

  if (tag === 'ul' || tag === 'ol') {
    const items: Paragraph[] = [];
    $el.children('li').each((_, liNode: AnyNode) => {
      const $li = $(liNode);
      const style = parseStyle($li.attr('style'));
      const ctx: RunContext = {};
      if (style['font-weight'] === 'bold') ctx.bold = true;
      const runs = collectRuns($li, $, ctx);
      items.push(new Paragraph({
        alignment: mapAlign(style),
        indent: { left: CM_TO_TWIP },
        children: [new TextRun({ text: '\u2022 ', font: DEFAULT_FONT }), ...runs],
      }));
    });
    return items.length ? items : null;
  }

  // Container elements: recurse
  if (tag === 'div' || tag === 'section' || tag === 'article' || tag === 'main') {
    const style = parseStyle($el.attr('style'));
    const hasPageBreak = style['page-break-before'] === 'always'
      || $el.hasClass('page-break');
    const inner: (Paragraph | Table)[] = [];
    if (hasPageBreak) inner.push(new Paragraph({ children: [new PageBreak()] }));
    $el.children().each((_, child: AnyNode) => {
      if (child.type === 'tag') {
        const el = processElement($(child), $);
        if (el) {
          if (Array.isArray(el)) inner.push(...el);
          else inner.push(el);
        }
      }
    });
    return inner.length ? inner : null;
  }

  // Fallback: treat as paragraph
  return buildParagraph($el, $);
}