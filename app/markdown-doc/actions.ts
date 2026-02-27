"use server";

import { sendTelegramDocument } from "@/app/actions";
import { logger } from "@/lib/logger";
import { supabaseAdmin } from "@/hooks/supabase";
import * as docx from "docx";
import { parseCellMarkers } from "@/lib/parseCellMarkers";

// Base URL for your raw GitHub files
const GITHUB_RAW_BASE = "https://raw.githubusercontent.com/salavey13/carTest/main/docs";

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

export type MarkdownTemplateVariables = Record<string, string | number | boolean | null>;

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

  return [...parseInlineRuns(before, style), ...parseInlineRuns(inside, nextStyle), ...parseInlineRuns(after, style)];
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
        if (!isMarkdownDividerRow(cells)) markdownRows.push(cells);
        checkI++;
      }

      const colCount = markdownRows.reduce((max, row) => Math.max(max, row.length), 0);
      if (!colCount) {
        i = checkI;
        continue;
      }

      const baseCellWidth = Math.floor(CONTENT_WIDTH_DXA / colCount);
      const widthRemainder = CONTENT_WIDTH_DXA - baseCellWidth * colCount;
      const columnWidths = Array.from({ length: colCount }, (_, index) => baseCellWidth + (index < widthRemainder ? 1 : 0));

      markdownRows.forEach((rawRow, rowIndex) => {
        const normalizedRow = [...rawRow];
        while (normalizedRow.length < colCount) normalizedRow.push("");

        const isHeaderRow = rowIndex === 0;
        tableRows.push(
          new TableRow({
            children: normalizedRow.map((rawCell, cellIndex) => {
              const { text, bg, textColor } = parseCellMarkers(rawCell);
              const width = columnWidths[cellIndex];

              return new TableCell({
                children: [
                  new Paragraph({
                    alignment: AlignmentType.LEFT,
                    children: parseInlineRuns(text || " ", { bold: isHeaderRow }).map((segment) =>
                      textColor ? new TextRun({ ...segment, color: textColor.replace("#", "") }) : new TextRun(segment),
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




/**
 * Loads the Francheeze status from the remote GitHub repository
 */
export async function loadFrancheezeStatusMarkdown() {
  try {
    const url = `${GITHUB_RAW_BASE}/THE_FRANCHEEZEPLAN_STATUS.MD`;
    const response = await fetch(url, { cache: 'no-store' });
    
    if (!response.ok) {
      throw new Error(`GitHub returned ${response.status}: ${response.statusText}`);
    }
    
    return await response.text();
  } catch (error) {
    logger.error("[markdown-doc] remote load failed: THE_FRANCHEEZEPLAN_STATUS.MD", error);
    throw new Error("Не удалось загрузить статус-файл из удаленного репозитория");
  }
}

/**
 * Loads the Rental Deal template from the remote GitHub repository
 */
export async function loadRentalDealTemplateMarkdown() {
  try {
    const url = `${GITHUB_RAW_BASE}/RENTAL_DEAL_TEMPLATE_DEMO.md`;
    const response = await fetch(url, { cache: 'no-store' });
    
    if (!response.ok) {
      throw new Error(`GitHub returned ${response.status}: ${response.statusText}`);
    }
    
    return await response.text();
  } catch (error) {
    logger.error("[markdown-doc] remote load failed: RENTAL_DEAL_TEMPLATE_DEMO.md", error);
    throw new Error("Не удалось загрузить шаблон аренды из удаленного репозитория");
  }
}

export async function getRentalDocDemoVariables() {
  if (!supabaseAdmin) {
    throw new Error("Нет подключения к Supabase admin клиенту");
  }

  const [userResult, carResult] = await Promise.all([
    supabaseAdmin.from("users").select("user_id, full_name, metadata").limit(1).maybeSingle(),
    supabaseAdmin.from("cars").select("id, owner_id, make, model, daily_price, specs").limit(1).maybeSingle(),
  ]);

  if (userResult.error) throw new Error(`Ошибка users: ${userResult.error.message}`);
  if (carResult.error) throw new Error(`Ошибка cars: ${carResult.error.message}`);
  if (!userResult.data || !carResult.data) throw new Error("Недостаточно данных в users/cars для демо");

  const userMetadata = (userResult.data.metadata as Record<string, any> | null) || {};
  const carSpecs = (carResult.data.specs as Record<string, any> | null) || {};

  const dailyPrice = Number(carResult.data.daily_price || 4500);
  const rentDays = 3;
  const extraItems = [
    { name: "Шлем", qty: 1, price: 400 },
    { name: "Экшн-камера", qty: 1, price: 900 },
  ];
  const extrasTotal = extraItems.reduce((sum, item) => sum + item.price * item.qty, 0);
  const subtotal = dailyPrice * rentDays;
  const total = subtotal + extrasTotal;

  const extrasRows = extraItems
    .map((item) => `| ${item.name} | ${item.qty} | ${item.price.toLocaleString("ru-RU")} ₽ | ${(item.price * item.qty).toLocaleString("ru-RU")} ₽ |`)
    .join("\n");

  const today = new Date();
  const endDate = new Date(today);
  endDate.setDate(today.getDate() + rentDays);

  return {
    templateName: "rental_deal_template_demo",
    userId: userResult.data.user_id,
    ownerId: carResult.data.owner_id || userResult.data.user_id,
    vehicleId: carResult.data.id,
    variables: {
      contract_number: `RB-${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${Math.floor(Math.random() * 900 + 100)}`,
      contract_date: today.toLocaleDateString("ru-RU"),
      renter_full_name: userMetadata.full_name || userResult.data.full_name || "Иван Иванов",
      renter_document_id: userMetadata.passport || userMetadata.document_id || "4010 123456",
      renter_phone: userMetadata.phone || "+7 (900) 000-00-00",
      bike_make_model: `${carResult.data.make || "Yamaha"} ${carResult.data.model || "MT-07"}`,
      bike_vin: carSpecs.vin || carSpecs.frame || "JYARM061000123456",
      bike_plate: carSpecs.plate || "А123АА77",
      rent_start_date: today.toLocaleDateString("ru-RU"),
      rent_end_date: endDate.toLocaleDateString("ru-RU"),
      rent_days: rentDays,
      daily_price_rub: dailyPrice.toLocaleString("ru-RU"),
      subtotal_rub: subtotal.toLocaleString("ru-RU"),
      extras_rows: extrasRows,
      extras_total_rub: extrasTotal.toLocaleString("ru-RU"),
      total_price_rub: total.toLocaleString("ru-RU"),
      deposit_rub: "20 000",
      issuer_name: "OneBike Rentals",
      issuer_signatory: "Оператор смены",
    } satisfies MarkdownTemplateVariables,
  };
}

export async function saveRentalDocGenerationDemo(input: {
  templateName: string;
  variables: MarkdownTemplateVariables;
  renderedMarkdown: string;
  userId: string;
  ownerId: string;
  vehicleId: string;
}) {
  if (!supabaseAdmin) return { success: false, error: "Нет подключения к Supabase admin клиенту" };

  const now = new Date().toISOString();
  const { error } = await supabaseAdmin.from("rentals").insert({
    user_id: input.userId,
    owner_id: input.ownerId,
    vehicle_id: input.vehicleId,
    status: "pending_confirmation",
    payment_status: "interest_paid",
    interest_amount: 0,
    total_cost: Number(String(input.variables.total_price_rub || "0").replace(/[^\d.]/g, "")) || 0,
    requested_start_date: now,
    requested_end_date: now,
    metadata: {
      source: "markdown-doc-poc",
      template_name: input.templateName,
      variables: input.variables,
      rendered_markdown: input.renderedMarkdown,
      generated_at: now,
    },
  });

  if (error) {
    logger.error("[markdown-doc] saveRentalDocGenerationDemo failed", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function sendMarkdownDoc(markdown: string, chatId: string) {
  try {
    const bytes = await generateDocxBytes(markdown);
    return await sendTelegramDocument(chatId, new Blob([bytes]), "Report.docx", "🚀 CyberVibe v8.4");
  } catch (e: any) {
    logger.error("[markdown-doc] failed to generate DOCX", e);
    return { success: false, error: e.message };
  }
}