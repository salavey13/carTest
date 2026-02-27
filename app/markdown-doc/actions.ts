"use server";

import { promises as fs } from "node:fs";
import path from "node:path";
import { sendTelegramDocument } from "@/app/actions";
import { logger } from "@/lib/logger";
import * as docx from "docx";
import { parseCellMarkers } from "@/lib/parseCellMarkers";

const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  ShadingType,
  AlignmentType,
  TableLayoutType,
} = docx;

const TABLE_BORDER_COLOR = "D1D5DB";
const PAGE_WIDTH_DXA = 11906;
const PAGE_MARGIN_DXA = 1440;
const CONTENT_WIDTH_DXA = PAGE_WIDTH_DXA - PAGE_MARGIN_DXA * 2;

type InlineStyle = {
  bold?: boolean;
  italics?: boolean;
};

type InlineSegment = {
  text: string;
  bold?: boolean;
  italics?: boolean;
};

function splitTableRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  const cells: string[] = [];
  let current = "";
  let escaped = false;

  for (const char of trimmed) {
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = true;
      continue;
    }

    if (char === "|") {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
}

function isMarkdownDividerRow(cells: string[]) {
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell.trim()));
}

function parseInlineRuns(text: string, style: InlineStyle = {}): InlineSegment[] {
  const markers = ["***", "___", "**", "__", "*", "_"];
  let earliestIndex = -1;
  let marker = "";

  for (const currentMarker of markers) {
    const index = text.indexOf(currentMarker);
    if (index !== -1 && (earliestIndex === -1 || index < earliestIndex)) {
      earliestIndex = index;
      marker = currentMarker;
    }
  }

  if (!marker) {
    return [{ text: text || " ", ...style }];
  }

  const markerLength = marker.length;
  const closeIndex = text.indexOf(marker, earliestIndex + markerLength);

  if (closeIndex === -1) {
    return [{ text, ...style }];
  }

  const before = text.slice(0, earliestIndex);
  const inside = text.slice(earliestIndex + markerLength, closeIndex);
  const after = text.slice(closeIndex + markerLength);

  const nextStyle: InlineStyle = {
    bold: style.bold || markerLength >= 2,
    italics: style.italics || markerLength === 1 || markerLength === 3,
  };

  return [
    ...parseInlineRuns(before, style),
    ...parseInlineRuns(inside, nextStyle),
    ...parseInlineRuns(after, style),
  ];
}

function createParagraph(text: string, options?: { heading?: (typeof HeadingLevel)[keyof typeof HeadingLevel] }) {
  return new Paragraph({
    heading: options?.heading,
    spacing: { after: 120 },
    children: parseInlineRuns(text).map((segment) => new TextRun(segment)),
  });
}

async function generateDocxBytes(markdown: string): Promise<Uint8Array> {
  const children: docx.FileChild[] = [];
  const lines = markdown.split(/\r?\n/);
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line) {
      i++;
      continue;
    }

    if (line.startsWith("#")) {
      const level = line.match(/^#+/)?.[0].length || 1;
      const heading = level === 1 ? HeadingLevel.HEADING_1 : HeadingLevel.HEADING_2;
      children.push(createParagraph(line.replace(/^#+\s*/, ""), { heading }));
    } else if (line.startsWith("|")) {
      const tableRows: TableRow[] = [];
      const markdownRows: string[][] = [];

      let checkI = i;
      while (checkI < lines.length && lines[checkI].trim().startsWith("|")) {
        const cells = splitTableRow(lines[checkI]);
        if (!isMarkdownDividerRow(cells)) {
          markdownRows.push(cells);
        }
        checkI++;
      }

      const colCount = markdownRows.reduce((max, row) => Math.max(max, row.length), 0);
      if (!colCount) {
        i = checkI;
        continue;
      }

      const baseCellWidth = Math.floor(CONTENT_WIDTH_DXA / colCount);
      const widthRemainder = CONTENT_WIDTH_DXA - baseCellWidth * colCount;
      const columnWidths = Array.from({ length: colCount }, (_, index) =>
        baseCellWidth + (index < widthRemainder ? 1 : 0),
      );

      markdownRows.forEach((rawRow, rowIndex) => {
        const normalizedRow = [...rawRow];
        while (normalizedRow.length < colCount) {
          normalizedRow.push("");
        }

        const isHeaderRow = rowIndex === 0;
        tableRows.push(
          new TableRow({
            children: normalizedRow.map((rawCell, cellIndex) => {
              const { text, bg, textColor } = parseCellMarkers(rawCell);
              const cleanText = text || " ";
              const width = columnWidths[cellIndex];

              return new TableCell({
                children: [
                  new Paragraph({
                    alignment: AlignmentType.LEFT,
                    children: parseInlineRuns(cleanText, { bold: isHeaderRow }).map((segment) =>
                      textColor
                        ? new TextRun({
                            ...segment,
                            color: textColor.replace("#", ""),
                          })
                        : new TextRun(segment),
                    ),
                  }),
                ],
                shading: bg ? { fill: bg.replace("#", ""), type: ShadingType.CLEAR } : undefined,
                width: { size: width, type: WidthType.DXA },
                margins: { top: 120, bottom: 120, left: 120, right: 120 },
                borders: {
                  top: { style: BorderStyle.SINGLE, size: 2, color: TABLE_BORDER_COLOR },
                  bottom: { style: BorderStyle.SINGLE, size: 2, color: TABLE_BORDER_COLOR },
                  left: { style: BorderStyle.SINGLE, size: 2, color: TABLE_BORDER_COLOR },
                  right: { style: BorderStyle.SINGLE, size: 2, color: TABLE_BORDER_COLOR },
                },
              });
            }),
          }),
        );
      });

      children.push(
        new Table({
          rows: tableRows,
          width: { size: CONTENT_WIDTH_DXA, type: WidthType.DXA },
          columnWidths,
          layout: TableLayoutType.FIXED,
        }),
      );

      i = checkI;
      continue;
    } else {
      children.push(createParagraph(line));
    }

    i++;
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: PAGE_MARGIN_DXA, right: PAGE_MARGIN_DXA, bottom: PAGE_MARGIN_DXA, left: PAGE_MARGIN_DXA },
          },
        },
        children,
      },
    ],
  });

  return Packer.toBuffer(doc);
}

export async function loadFrancheezeStatusMarkdown() {
  try {
    const absolutePath = path.join(process.cwd(), "docs", "THE_FRANCHEEZEPLAN_STATUS.MD");
    return await fs.readFile(absolutePath, "utf8");
  } catch (error) {
    logger.error("[markdown-doc] unable to load THE_FRANCHEEZEPLAN_STATUS.MD", error);
    throw new Error("Не удалось загрузить docs/THE_FRANCHEEZEPLAN_STATUS.MD");
  }
}

export async function sendMarkdownDoc(markdown: string, chatId: string) {
  try {
    const bytes = await generateDocxBytes(markdown);
    return await sendTelegramDocument(chatId, new Blob([bytes]), "Report.docx", "🚀 CyberVibe v8.3");
  } catch (e: any) {
    logger.error("[markdown-doc] failed to generate DOCX", e);
    return { success: false, error: e.message };
  }
}
