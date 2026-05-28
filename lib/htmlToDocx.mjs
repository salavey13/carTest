/**
 * htmlToDocx.mjs — Proper HTML → docx element converter
 *
 * Parses HTML with cheerio and produces an array of docx construct objects
 * (Paragraph, Table) that preserve formatting: bold, centering, indentation,
 * tables with borders, horizontal rules, line breaks, etc.
 *
 * Usage:
 *   import { htmlToDocxElements } from './lib/htmlToDocx.mjs';
 *   const children = htmlToDocxElements(renderedHtml);
 *   const doc = new Document({ sections: [{ children }] });
 */

import * as cheerio from 'cheerio';
import {
  Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, BorderStyle, WidthType, PageBreak,
} from 'docx';

// ─── Helpers ────────────────────────────────────────────────────────

const CM_TO_TWIP = 567;      // 1 cm ≈ 567 twip
const PT_TO_HALF_PT = 2;     // docx sizes are in half-points
const DEFAULT_FONT = 'Times New Roman';

/** Convert CSS length → twip */
function cssLengthToTwip(raw) {
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
function cssFontSizeToHalfPt(raw) {
  if (!raw) return undefined;
  const s = String(raw).trim().toLowerCase();
  const pt = s.match(/^([\d.]+)\s*pt$/);
  if (pt) return Math.round(parseFloat(pt[1]) * PT_TO_HALF_PT);
  return undefined;
}

/** Parse inline style string → key-value map */
function parseStyle(raw) {
  const map = {};
  if (!raw) return map;
  for (const part of String(raw).split(';')) {
    const [k, ...rest] = part.split(':');
    if (k && rest.length) map[k.trim().toLowerCase()] = rest.join(':').trim();
  }
  return map;
}

/** Map CSS text-align → docx AlignmentType */
function mapAlign(style) {
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
function decodeEntities(text) {
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
    .replace(/&#(x[0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code.slice(1), 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

// ─── Border helpers ─────────────────────────────────────────────────

const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const THIN_BORDER = { style: BorderStyle.SINGLE, size: 1, color: '000000' };

function cellBordersFromStyle(style, rowStyle) {
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

/**
 * Recursively collect TextRun[] from an element's children.
 * @param {cheerio.Cheerio} $el
 * @param {cheerio.CheerioAPI} $
 * @param {object} ctx — inherited formatting { bold, italic, fontSize, upperCase }
 */
function collectRuns($el, $, ctx = {}) {
  const runs = [];

  $el.contents().each((_, node) => {
    if (node.type === 'text') {
      let text = decodeEntities(node.data);
      if (ctx.upperCase) text = text.toUpperCase();
      if (text) {
        const runOpts = { text, font: DEFAULT_FONT };
        if (ctx.bold) runOpts.bold = true;
        if (ctx.italic) runOpts.italics = true;
        if (ctx.fontSize) runOpts.size = ctx.fontSize;
        runs.push(new TextRun(runOpts));
      }
      return;
    }

    if (node.type !== 'tag') return;

    const tag = node.tagName.toLowerCase();
    const $child = $(node);
    const childStyle = parseStyle($child.attr('style'));
    const childCtx = { ...ctx };

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

function buildTable($table, $) {
  const rows = [];

  // Support both <table><tr> and <table><thead|tbody><tr>
  const $rows = $table.children('tr').length
    ? $table.children('tr')
    : $table.children('thead, tbody, tfoot').children('tr');

  $rows.each((_, trNode) => {
    const $tr = $(trNode);
    const rowStyle = parseStyle($tr.attr('style'));
    const cells = [];

    $tr.children('td, th').each((__, cellNode) => {
      const $cell = $(cellNode);
      const cellStyle = parseStyle($cell.attr('style'));
      const isHeader = cellNode.tagName.toLowerCase() === 'th';

      const borders = cellBordersFromStyle(cellStyle, rowStyle);

      const cellParagraphs = [];
      const pChildren = $cell.children('p');

      if (pChildren.length) {
        pChildren.each((___, pInCell) => {
          const $p = $(pInCell);
          const pStyle = parseStyle($p.attr('style'));
          const pCtx = {};
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
        const cellCtx = {};
        if (cellStyle['font-weight'] === 'bold' || Number(cellStyle['font-weight']) >= 700) cellCtx.bold = true;
        if (isHeader) cellCtx.bold = true;

        const runs = collectRuns($cell, $, cellCtx);
        cellParagraphs.push(new Paragraph({
          alignment: mapAlign(cellStyle),
          children: runs.length ? runs : [new TextRun({ text: '', font: DEFAULT_FONT })],
        }));
      }

      const widthTwip = cssLengthToTwip(cellStyle['width']);
      const cellOpts = { children: cellParagraphs, borders };
      if (widthTwip) cellOpts.width = { size: widthTwip, type: WidthType.DXA };

      cells.push(new TableCell(cellOpts));
    });

    if (cells.length) rows.push(new TableRow({ children: cells }));
  });

  if (!rows.length) return null;
  return new Table({ rows });
}

// ─── Paragraph builder ──────────────────────────────────────────────

function buildParagraph($el, $) {
  const style = parseStyle($el.attr('style'));
  const pOpts = {};

  const align = mapAlign(style);
  if (align) pOpts.alignment = align;

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

  const ctx = {};
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
 * @param {string} html — HTML content (template vars already substituted)
 * @returns {Array}     — Array of Paragraph | Table instances
 */
export function htmlToDocxElements(html) {
  const $ = cheerio.load(html);
  const elements = [];

  // Find content root: prefer <body>, else the outer wrapper
  const $root = $('body').length ? $('body') : $.root();

  $root.children().each((_, node) => {
    if (node.type !== 'tag') return;
    const el = processElement($(node), $);
    if (el) {
      if (Array.isArray(el)) elements.push(...el);
      else elements.push(el);
    }
  });

  // Fallback: if nothing produced, try root's immediate children
  if (!elements.length) {
    $.root().children().each((_, node) => {
      if (node.type !== 'tag') return;
      const el = processElement($(node), $);
      if (el) {
        if (Array.isArray(el)) elements.push(...el);
        else elements.push(el);
      }
    });
  }

  return elements.length
    ? elements
    : [new Paragraph({ children: [new TextRun({ text: ' ', font: DEFAULT_FONT })] })];
}

/**
 * Process a single HTML element → docx construct(s)
 */
function processElement($el, $) {
  const tag = ($el[0]?.tagName || '').toLowerCase();
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
    const ctx = { bold: true };
    if (style['font-size']) ctx.fontSize = cssFontSizeToHalfPt(style['font-size']);
    const runs = collectRuns($el, $, ctx);
    return new Paragraph({
      alignment: mapAlign(style),
      spacing: { before: 240, after: 120 },
      children: runs,
    });
  }

  if (tag === 'ul' || tag === 'ol') {
    const items = [];
    $el.children('li').each((_, liNode) => {
      const $li = $(liNode);
      const style = parseStyle($li.attr('style'));
      const ctx = {};
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
    const inner = [];
    if (hasPageBreak) inner.push(new Paragraph({ children: [new PageBreak()] }));
    $el.children().each((_, child) => {
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

export { buildParagraph, buildTable, collectRuns, cssLengthToTwip, cssFontSizeToHalfPt, parseStyle };
