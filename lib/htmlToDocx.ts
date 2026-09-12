/**
 * htmlToDocx.ts — Proper HTML → docx element converter
 *
 * ⚠️ SHADOWED TWIN: lib/htmlToDocx.mjs is the file that actually loads at
 * runtime — Next.js (webpack) and Vitest (Vite) both resolve ".mjs" before
 * ".ts" for extensionless imports. This .ts is the typed twin used by
 * `tsc` typecheck only. ANY behavior change here MUST be mirrored in
 * lib/htmlToDocx.mjs (and vice versa). tests/franchize/iter25-testdrive-fixes.spec.ts
 * imports the module the same way the app does, so it gates the live .mjs.
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
  AlignmentType, BorderStyle, WidthType, PageBreak, TableLayoutType,
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

/**
 * Map text-align for a table cell whose raw content is a single implicit
 * paragraph with <br> soft line breaks (signature/requisites blocks).
 *
 * OOXML gotcha: a JUSTIFIED paragraph stretches EVERY line that ends with a
 * manual line break (w:br) to the full column width — only the paragraph's
 * final line is spared. Signature blocks like
 *   «Мотосалон: <br> ООО … <br> ____ /Имя/ (подпись)»
 * render with huge gaps between short fragments and look "spread".
 * Guard: multi-`<br>` cell content never justifies — fall back to LEFT.
 */
function mapCellBreakAlign(
  style: Record<string, string>,
  cellHasLineBreaks: boolean,
): (typeof AlignmentType)[keyof typeof AlignmentType] | undefined {
  const align = mapAlign(style);
  if (align === AlignmentType.JUSTIFIED && cellHasLineBreaks) {
    return AlignmentType.LEFT;
  }
  return align;
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
// size is in eighth-points: 4 = 0.5pt — Word's standard single-border weight.
// 1 (0.125pt hairline) renders invisible/None in several viewers and printers.
const THIN_BORDER = { style: BorderStyle.SINGLE, size: 4, color: '000000' };

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

/**
 * Minimum sane column width (≈ 0.42 cm). Columns thinner than this are a
 * symptom of broken width math — several viewers render them one glyph wide
 * and blow the table height up to absurdity. If the math produces such a
 * column we fall back to equal division instead of trusting it.
 */
const MIN_COL_TWIP = 240;

/** Word-default cell margins (twip): 0 top/bottom, 108 left/right (≈ 0.19 cm). */
const TABLE_CELL_MARGINS = { top: 0, bottom: 0, left: 108, right: 108 };

/** Sum colWidths[from .. from+span-1] with safe fallbacks for malformed rows. */
function spanWidth(colWidths: number[], from: number, span: number): number {
  let sum = 0;
  for (let k = 0; k < span; k++) {
    sum += colWidths[from + k]
      ?? colWidths[colWidths.length - 1]
      ?? Math.round(9000 / Math.max(1, colWidths.length));
  }
  return sum;
}

export function buildTable($table: ReturnType<CheerioAPI>, $: CheerioAPI): Table | null {
  const rows: TableRow[] = [];

  // Support both <table><tr> and <table><thead|tbody><tr>
  const $rows = $table.children('tr').length
    ? $table.children('tr')
    : $table.children('thead, tbody, tfoot').children('tr');

  // Table width from style (default 9000 twip: fits every in-repo generator's
  // A4 content width — 9071 for GOST rental margins, 9638 for deal-doc margins)
  const tableStyle = parseStyle($table.attr('style'));
  const tableWidthTwip = cssLengthToTwip(tableStyle['width']) || 9000;

  // ── Pass 1: collect cells per row (with colspan) and the true column count ──
  // colCount must be the max column-span coverage over ALL rows, not the first
  // row's cell count: a leading full-width row (colspan) used to make every
  // later cell fall back to a wrong/equal width.
  type CellInfo = { $cell: ReturnType<CheerioAPI>; node: AnyNode; colspan: number };
  const rowsInfo: { $tr: ReturnType<CheerioAPI>; cellsInfo: CellInfo[] }[] = [];
  let colCount = 0;
  $rows.each((_, trNode: AnyNode) => {
    const cellsInfo: CellInfo[] = [];
    $(trNode).children('td, th').each((__: number, cellNode: AnyNode) => {
      const $cell = $(cellNode);
      const colspan = Math.max(1, parseInt(String($cell.attr('colspan') || '1'), 10) || 1);
      cellsInfo.push({ $cell, node: cellNode, colspan });
    });
    const rowCols = cellsInfo.reduce((a, c) => a + c.colspan, 0);
    if (rowCols > colCount) colCount = rowCols;
    rowsInfo.push({ $tr: $(trNode), cellsInfo });
  });
  colCount = colCount || 1;

  // ── Pass 2: derive per-column grid widths ──
  // Reference row = the row covering all columns with the most cells (least
  // merging) — more trustworthy than blindly using the first row.
  let refRow: { $tr: ReturnType<CheerioAPI>; cellsInfo: CellInfo[] } | null = null;
  for (const r of rowsInfo) {
    const covered = r.cellsInfo.reduce((a, c) => a + c.colspan, 0);
    if (covered === colCount && (!refRow || r.cellsInfo.length > refRow.cellsInfo.length)) {
      refRow = r;
    }
  }

  const colWidths: number[] = new Array(colCount).fill(0);
  if (refRow) {
    let gridIdx = 0;
    for (const c of refRow.cellsInfo) {
      const w = parseStyle(c.$cell.attr('style'))['width'];
      let twip: number | undefined;
      if (w) {
        const pct = String(w).match(/^([\d.]+)\s*%$/);
        if (pct) twip = Math.round(tableWidthTwip * parseFloat(pct[1]) / 100);
        else twip = cssLengthToTwip(w);
      }
      // A cell's width spans `colspan` grid columns — spread it evenly.
      const share = twip ? Math.round(twip / c.colspan) : 0;
      for (let k = 0; k < c.colspan && gridIdx + k < colCount; k++) colWidths[gridIdx + k] = share;
      gridIdx += c.colspan;
    }
  }
  // Columns without an explicit width share the remainder equally.
  const specified = colWidths.filter((w) => w > 0);
  const specifiedSum = specified.reduce((a, b) => a + b, 0);
  const unspecified = colCount - specified.length;
  if (unspecified > 0) {
    const rest = Math.max(0, tableWidthTwip - specifiedSum);
    const share = Math.round(rest / unspecified);
    for (let i = 0; i < colCount; i++) if (colWidths[i] === 0) colWidths[i] = share;
  }

  // Normalize so widths sum EXACTLY to tableWidthTwip (rounding drift goes to
  // the last column). Viewers honor the grid literally — a sum that drifts off
  // the table width makes some of them re-shrink the whole table.
  const totalW = colWidths.reduce((a, b) => a + b, 0);
  if (totalW <= 0) {
    for (let i = 0; i < colCount; i++) colWidths[i] = Math.round(tableWidthTwip / colCount);
  } else {
    const scale = tableWidthTwip / totalW;
    for (let i = 0; i < colCount; i++) colWidths[i] = Math.round(colWidths[i] * scale);
  }
  colWidths[colCount - 1] += tableWidthTwip - colWidths.reduce((a, b) => a + b, 0);

  // Degenerate-column guard: a one-symbol-wide column is worse than no
  // explicit grid at all → fall back to equal division.
  if (colCount > 1 && colWidths.some((w) => w < MIN_COL_TWIP)) {
    const share = Math.round(tableWidthTwip / colCount);
    for (let i = 0; i < colCount; i++) colWidths[i] = share;
    colWidths[colCount - 1] += tableWidthTwip - colWidths.reduce((a, b) => a + b, 0);
  }

  // ── Pass 3: build rows; the grid index advances by colspan ──
  for (const { $tr, cellsInfo } of rowsInfo) {
    const rowStyle = parseStyle($tr.attr('style'));
    const cells: TableCell[] = [];
    let gridIdx = 0;

    for (const { $cell, node, colspan } of cellsInfo) {
      const cellStyle = parseStyle($cell.attr('style'));
      const isHeader = (node as Element).tagName.toLowerCase() === 'th';

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
        const cellHasLineBreaks = $cell.find('br').length > 0;
        cellParagraphs.push(new Paragraph({
          alignment: mapCellBreakAlign(cellStyle, cellHasLineBreaks),
          children: runs.length ? runs : [new TextRun({ text: '', font: DEFAULT_FONT })],
        }));
      }

      const cellOpts: Record<string, any> = { children: cellParagraphs, borders };
      // Fixed grid: cell width = sum of the grid columns it spans.
      const colW = spanWidth(colWidths, gridIdx, colspan);
      cellOpts.width = { size: colW, type: WidthType.DXA };
      if (colspan > 1) cellOpts.columnSpan = colspan;

      cells.push(new TableCell(cellOpts));
      gridIdx += colspan;
    }

    if (cells.length) rows.push(new TableRow({ children: cells }));
  }

  if (!rows.length) return null;

  // Cross-viewer robustness (the "renders in 1 of 10 viewers" bug): without
  // an explicit tblGrid the docx lib writes gridCol w="100" placeholders —
  // MS Word rebalances via autofit, but LibreOffice / OnlyOffice / Google
  // Docs / mobile viewers honor the grid literally and collapse columns to
  // one glyph, exploding the table height. Fix: real gridCol widths + fixed
  // layout + Word-default cell margins, so every renderer agrees.
  return new Table({
    rows,
    width: { size: tableWidthTwip, type: WidthType.DXA },
    columnWidths: colWidths,
    layout: TableLayoutType.FIXED,
    margins: { marginUnitType: WidthType.DXA, ...TABLE_CELL_MARGINS },
  });
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