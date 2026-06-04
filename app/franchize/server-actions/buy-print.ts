// /app/franchize/server-actions/buy-print.ts
"use server";

import { cookies } from "next/headers";
import fs from "fs";
import path from "path";
import { PDFDocument, rgb, type PDFFont, type RGB } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

import { sendTelegramDocument } from "@/app/actions";
import { getFranchizeBySlug } from "@/app/franchize/server-actions/catalog";
import { DEFAULT_TELEGRAM_BOT_USERNAME } from "@/app/franchize/lib/telegram-links";
import { logger } from "@/lib/logger";
import {
  TELEGRAM_ACTOR_COOKIE,
  verifyTelegramActorCookieValue,
} from "@/lib/telegram-actor-cookie";
import { supabaseAdmin } from "@/lib/supabase-server";

type UnknownRecord = Record<string, unknown>;

// ─── Global Layout Constants (A4) ──────────────────────────────────────────

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;

const PAGE_PADDING = 38;

// Header
const HEADER_HEIGHT = 82;
const HEADER_BRAND_Y_OFFSET = 40; // from top of page
const HEADER_ACCENT_HEIGHT = 2; // gold separator line under header

// Columns
const LEFT_COL_X = PAGE_PADDING;
const LEFT_COL_WIDTH = 248;

const RIGHT_COL_X = 314;
const RIGHT_COL_WIDTH = 242;

const COL_GAP = RIGHT_COL_X - (LEFT_COL_X + LEFT_COL_WIDTH); // 28

// Content vertical anchors (from top of page)
const TITLE_BLOCK_TOP = PAGE_HEIGHT - 118;

// Image panel (right column) — 9:16 portrait ratio
const IMAGE_PANEL_HEIGHT = Math.round(RIGHT_COL_WIDTH * 16 / 9); // ≈ 430 (242 × 16/9)
const IMAGE_PANEL_TOP_GAP = 4; // gap between header accent and image top edge
// Y is the bottom-left corner in pdf-lib; panel extends from Y upward to Y + height
const IMAGE_PANEL_Y = PAGE_HEIGHT - HEADER_HEIGHT - IMAGE_PANEL_TOP_GAP - IMAGE_PANEL_HEIGHT;
const IMAGE_PANEL_PADDING = 18; // inset for scaled images

// Spec table
const SPEC_VALUE_FONT_SIZE = 9.4;
const SPEC_VALUE_MAX_WIDTH = 118;
const SPEC_VALUE_X_OFFSET = 108;
const SPEC_LABEL_FONT_SIZE = 9.3;
const SPEC_LABEL_MAX_WIDTH = 82;
const SPEC_LABEL_X_OFFSET = 12;
const SPEC_LINE_HEIGHT = 10;
const SPEC_ROW_MIN_HEIGHT = 30;
const SPEC_ROW_CONTENT_PADDING = 12;
const SPEC_ROW_BORDER_OFFSET = 6; // aligns top border with row anchor
const SPEC_ROW_GAP = 4;
const SPEC_MAX_ROWS = 13;
const SPEC_MAX_VALUE_LINES = 2;

// Footer
const FOOTER_Y = 24;
const FOOTER_GENERATED_X = 180;

// Bottom section: QR pair → rental box → link box stacked in right column
const VK_LINK = "https://vk.com/vip_bike_electro";

// QR codes — two side by side (buy link + VK community)
const QR_SIZE = 110;
const VK_QR_SIZE = 110;
const QR_GAP_FROM_IMAGE = 8;
const QR_PAIR_GAP = 10;
const QR_PAIR_TOTAL_WIDTH = QR_SIZE + QR_PAIR_GAP + VK_QR_SIZE; // 230

const QR_Y = IMAGE_PANEL_Y - QR_GAP_FROM_IMAGE - QR_SIZE;
const QR_X = RIGHT_COL_X + (RIGHT_COL_WIDTH - QR_PAIR_TOTAL_WIDTH) / 2;
const VK_QR_X = QR_X + QR_SIZE + QR_PAIR_GAP;

// QR labels
const QR_LABEL_GAP = 4;
const QR_LABEL_FONT_SIZE = 7;

// Rental price box
const RENTAL_BOX_HEIGHT = 72;
const RENTAL_BOX_GAP = 8;
const RENTAL_BOX_Y = QR_Y - QR_LABEL_GAP - QR_LABEL_FONT_SIZE - RENTAL_BOX_GAP - RENTAL_BOX_HEIGHT;
const RENTAL_BOX_X = RIGHT_COL_X;
const RENTAL_BOX_WIDTH = RIGHT_COL_WIDTH;
const RENTAL_HEADING_FONT_SIZE = 9;
const RENTAL_VALUE_FONT_SIZE = 8.5;
const RENTAL_LINE_HEIGHT = 14;
const RENTAL_INNER_X = 10;
const RENTAL_INNER_Y = 10;

// Link box
const LINK_BOX_HEIGHT = 46;
const LINK_BOX_GAP = 8;
const LINK_BOX_X = RIGHT_COL_X;
const LINK_BOX_WIDTH = RIGHT_COL_WIDTH;
const LINK_BOX_Y = RENTAL_BOX_Y - LINK_BOX_GAP - LINK_BOX_HEIGHT;
const LINK_BOX_INNER_X = 10;
const LINK_BOX_LINK_LINE_HEIGHT = 9;
const LINK_BOX_MAX_WIDTH = LINK_BOX_WIDTH - LINK_BOX_INNER_X * 2;
const LINK_FONT_SIZE = 7.2;
const LINK_TITLE_FONT_SIZE = 8.4;

// Description
const DESC_FONT_SIZE = 10.4;
const DESC_LINE_HEIGHT = 14;
const DESC_MAX_LINES = 8;
const DESC_SECTION_GAP = 18;

// Section headings
const SECTION_HEADING_SIZE = 14;
const SECTION_HEADING_GAP_AFTER = 22;
const SECTION_HEADING_GAP_BEFORE = 24;

// Title / price block
const TITLE_FONT_SIZE = 24;
const PRICE_FONT_SIZE = 20;
const TITLE_TO_PRICE_GAP = 34;
const PRICE_TO_DESC_GAP = 44;

// Network
const FETCH_TIMEOUT_MS = 8_000;

// ─── Color Palette (DARK MODE) ─────────────────────────────────────────────

interface PdfColors {
  pageBg: RGB;
  header: RGB;
  text: RGB;
  muted: RGB;
  line: RGB;
  accent: RGB;
  accentSubtle: RGB;
  imageBg: RGB;
  linkBg: RGB;
  imageFallback: RGB;
  white: RGB;
}

const COLORS: PdfColors = {
  pageBg: rgb(0.10, 0.11, 0.13),       // dark graphite — same as image panel (seamless)
  header: rgb(0.05, 0.06, 0.08),       // near-black — deeper than page
  text: rgb(0.92, 0.93, 0.95),         // near-white — main body text
  muted: rgb(0.58, 0.60, 0.64),        // medium gray — labels, secondary text
  line: rgb(0.22, 0.23, 0.26),         // subtle dark — spec row borders
  accent: rgb(0.96, 0.76, 0.22),       // gold — accent line, link border
  accentSubtle: rgb(0.96, 0.76, 0.22), // gold (same)
  imageBg: rgb(0.10, 0.11, 0.13),      // graphite — matches pageBg (seamless panel)
  linkBg: rgb(0.14, 0.15, 0.18),       // lifted dark — link card background
  imageFallback: rgb(0.50, 0.52, 0.55), // visible on dark — fallback text
  white: rgb(1, 1, 1),                 // pure white — header brand
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function normalizeSlug(value: string) {
  return (value || "vip-bike").trim().toLowerCase() || "vip-bike";
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : "";
}

async function resolveActorUserId() {
  const actorUserId = verifyTelegramActorCookieValue(
    cookies().get(TELEGRAM_ACTOR_COOKIE)?.value,
  );

  if (actorUserId) {
    return actorUserId;
  }

  if (
    process.env.NODE_ENV !== "production" &&
    process.env.NEXT_PUBLIC_USE_MOCK_USER === "true"
  ) {
    return process.env.NEXT_PUBLIC_MOCK_USER_ID || "413553377";
  }

  return "";
}

async function resolvePrintAccess(actorUserId: string, slug: string) {
  if (!actorUserId) {
    return {
      allowed: false,
      reason: "Нужна Telegram-сессия.",
    };
  }

  const { data: crew } = await supabaseAdmin
    .from("crews")
    .select("id, owner_id")
    .eq("slug", normalizeSlug(slug))
    .maybeSingle();

  if (!crew?.id) {
    return {
      allowed: false,
      reason: "Экипаж не найден.",
    };
  }

  const { data: user } = await supabaseAdmin
    .from("users")
    .select("role, status")
    .eq("user_id", actorUserId)
    .maybeSingle();

  const role = readString(user?.role).toLowerCase();

  const isAdmin =
    role === "admin" ||
    role === "vpradmin";

  const isOwner = crew.owner_id === actorUserId;

  if (isAdmin || isOwner) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: "PDF-печать доступна только админам и владельцу.",
  };
}

function safeFilePart(value: string) {
  return (
    value
      .trim()
      .replace(/[^a-zA-Z0-9а-яА-ЯёЁ_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "bike"
  );
}

function formatRub(value: number | null | undefined) {
  if (!value || value <= 0) {
    return "по запросу";
  }

  return `${value.toLocaleString("ru-RU")} ₽`;
}

function buildWebAppBuyLink(botUsername: string, bikeId: string) {
  const normalizedBot =
    botUsername
      .trim()
      .replace(/^@+/, "")
      .replace(/[^a-zA-Z0-9_]/g, "") ||
    DEFAULT_TELEGRAM_BOT_USERNAME;

  const safeBikeId =
    bikeId
      .replace(/[^a-zA-Z0-9_-]/g, "-")
      .slice(0, 64) || "bike";

  return `https://t.me/${normalizedBot}/app?startapp=buy_${safeBikeId}`;
}

/**
 * Fetches an image URL and embeds it into the PDF document.
 * Returns `null` on any failure (missing URL, network error, bad response).
 * Includes a timeout guard to prevent hanging on slow hosts.
 */
async function embedImage(pdfDoc: PDFDocument, url: string) {
  if (!url) {
    return null;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      FETCH_TIMEOUT_MS,
    );

    const response = await fetch(url, {
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return null;
    }

    const bytes = await response.arrayBuffer();
    const contentType = response.headers.get("content-type") || "";

    if (
      contentType.includes("png") ||
      url.toLowerCase().includes(".png")
    ) {
      return await pdfDoc.embedPng(bytes);
    }

    return await pdfDoc.embedJpg(bytes);
  } catch (error) {
    logger.warn("[franchize] failed to embed buy PDF image", error);
    return null;
  }
}

function extractKeySpecs(specs: UnknownRecord) {
  const rows: [string, string][] = [];

  const priorityFields: Array<[string, ...string[]]> = [
    ["Тип", "bike_subtype"],
    ["Год", "year"],
    ["Пиковая мощность", "power_kw", "motor_peak_kw"],
    ["Номинальная мощность", "motor_nominal_kw"],
    ["Крутящий момент", "torque_nm", "torque_motor_nm"],
    ["Батарея", "battery"],
    ["Запас хода", "range_km", "range_120ah_km", "range_100ah_km"],
    ["Макс. скорость", "top_speed_kmh"],
    ["Разгон 0-100", "acceleration_0_100_s"],
    ["Вес", "weight_kg"],
    ["Тормоза", "brake_type"],
    ["Подвеска", "suspension_type", "suspension_front"],
    ["Рама", "frame_type"],
    ["Зарядка", "charge_time_h"],
    ["Класс прав", "license_class"],
  ];

  priorityFields.forEach(([label, ...keys]) => {
    for (const key of keys) {
      const value = readString(specs[key]);

      if (value && value !== "—") {
        rows.push([label, value]);
        break;
      }
    }
  });

  Object.entries(specs).forEach(([key, value]) => {
    if (
      typeof value === "string" &&
      value.length > 2 &&
      !priorityFields.flat().includes(key) &&
      ![
        "gallery",
        "features",
        "buy_colors",
        "buy_options",
        "spec_labels",
      ].includes(key)
    ) {
      const niceLabel = key
        .replace(/_/g, " ")
        .replace(/\b\w/g, (letter) => letter.toUpperCase());

      if (!rows.some((row) => row[0] === niceLabel)) {
        rows.push([niceLabel, value]);
      }
    }
  });

  return rows.slice(0, SPEC_MAX_ROWS);
}

function wrapText(
  text: string,
  font: PDFFont,
  fontSize: number,
  maxWidth: number,
) {
  const words = text.split(/\s+/);
  const lines: string[] = [];

  let currentLine = "";

  words.forEach((word) => {
    const testLine = currentLine
      ? `${currentLine} ${word}`
      : word;

    const width = font.widthOfTextAtSize(testLine, fontSize);

    if (width <= maxWidth) {
      currentLine = testLine;
    } else {
      if (currentLine) {
        lines.push(currentLine);
      }

      currentLine = word;
    }
  });

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

/**
 * Formats a stable timestamp string for PDF footers.
 * Uses manual UTC-based formatting to avoid locale-dependent
 * `toLocaleString` inconsistencies across Node.js versions and hosts.
 */
function formatTimestamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");

  return [
    [
      pad(date.getDate()),
      pad(date.getMonth() + 1),
      date.getFullYear(),
    ].join("."),
    [
      pad(date.getHours()),
      pad(date.getMinutes()),
      pad(date.getSeconds()),
    ].join(":"),
  ].join(", ");
}

// ─── PDF Generation ─────────────────────────────────────────────────────────

/**
 * Generates a premium DARK-MODE product-sheet PDF for a franchize bike listing.
 *
 * Layout overview (A4 portrait, dark theme):
 * ┌──────────────────────────────────────┐
 * │ HEADER (near-black + gold accent)    │
 * ├───────────────┬──────────────────────┤
 * │  Title        │                      │
 * │  Price        │    IMAGE PANEL       │
 * │  Description  │    (9:16 graphite)   │
 * │  ─────────    │                      │
 * │  Specs table  │   QR buy │ QR VK     │
 * │  (dark rows)  │  (110)   (110)       │
 * │               │   ──────────────     │
 * │               │   RENTAL BOX         │
 * │               │   LINK BOX (dark)    │
 * ├───────────────┴──────────────────────┤
 * │  ID: ...        Generated: ...       │
 * └──────────────────────────────────────┘
 */
async function generateBuyPdf(input: {
  slug: string;
  brandName: string;
  botUsername: string;
  item: {
    id: string;
    title: string;
    description: string;
    imageUrl: string;
    salePrice: number | null;
    availabilityLabel: string;
    rawSpecs?: UnknownRecord;
  };
}) {
  const pdfDoc = await PDFDocument.create();

  pdfDoc.registerFontkit(fontkit);

  const fontPath = path.join(
    process.cwd(),
    "server-assets",
    "fonts",
    "DejaVuSans.ttf",
  );

  const fontBytes = fs.readFileSync(fontPath);
  const font = await pdfDoc.embedFont(fontBytes);

  const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

  const specs = input.item.rawSpecs || {};
  const keySpecs = extractKeySpecs(specs);

  const buyLink = buildWebAppBuyLink(
    input.botUsername,
    input.item.id,
  );

  // ── Page Background (dark graphite) ─────────────────────────────────────

  page.drawRectangle({
    x: 0,
    y: 0,
    width: PAGE_WIDTH,
    height: PAGE_HEIGHT,
    color: COLORS.pageBg,
  });

  // ── Header ──────────────────────────────────────────────────────────────

  page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - HEADER_HEIGHT,
    width: PAGE_WIDTH,
    height: HEADER_HEIGHT,
    color: COLORS.header,
  });

  page.drawText(
    (input.brandName || input.slug).toUpperCase(),
    {
      x: PAGE_PADDING,
      y: PAGE_HEIGHT - HEADER_BRAND_Y_OFFSET,
      size: TITLE_FONT_SIZE,
      font,
      color: COLORS.white,
    },
  );

  // Gold accent line at bottom of header
  page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - HEADER_HEIGHT,
    width: PAGE_WIDTH,
    height: HEADER_ACCENT_HEIGHT,
    color: COLORS.accent,
  });

  // ── Title Block ─────────────────────────────────────────────────────────

  let leftY = TITLE_BLOCK_TOP;

  page.drawText(input.item.title, {
    x: LEFT_COL_X,
    y: leftY,
    size: TITLE_FONT_SIZE,
    font,
    color: COLORS.text,
  });

  leftY -= TITLE_TO_PRICE_GAP;

  page.drawText(
    `Цена: ${formatRub(input.item.salePrice)}`,
    {
      x: LEFT_COL_X,
      y: leftY,
      size: PRICE_FONT_SIZE,
      font,
      color: COLORS.text,
    },
  );

  leftY -= PRICE_TO_DESC_GAP;

  // ── Description ─────────────────────────────────────────────────────────

  page.drawText("Описание", {
    x: LEFT_COL_X,
    y: leftY,
    size: SECTION_HEADING_SIZE,
    font,
    color: COLORS.text,
  });

  leftY -= SECTION_HEADING_GAP_AFTER;

  const description =
    input.item.description || "Описание не заполнено.";

  const descriptionLines = wrapText(
    description,
    font,
    DESC_FONT_SIZE,
    LEFT_COL_WIDTH,
  ).slice(0, DESC_MAX_LINES);

  descriptionLines.forEach((line) => {
    page.drawText(line, {
      x: LEFT_COL_X,
      y: leftY,
      size: DESC_FONT_SIZE,
      font,
      color: COLORS.muted,
      maxWidth: LEFT_COL_WIDTH,
    });

    leftY -= DESC_LINE_HEIGHT;
  });

  leftY -= DESC_SECTION_GAP;

  // ── Specs ───────────────────────────────────────────────────────────────

  if (keySpecs.length > 0) {
    page.drawText("Характеристики", {
      x: LEFT_COL_X,
      y: leftY,
      size: SECTION_HEADING_SIZE,
      font,
      color: COLORS.text,
    });

    leftY -= SECTION_HEADING_GAP_AFTER;

    keySpecs.forEach(([label, value]) => {
      const wrappedValue = wrapText(
        value,
        font,
        SPEC_VALUE_FONT_SIZE,
        SPEC_VALUE_MAX_WIDTH,
      ).slice(0, SPEC_MAX_VALUE_LINES);

      const contentHeight =
        wrappedValue.length * SPEC_LINE_HEIGHT;
      const rowHeight = Math.max(
        SPEC_ROW_MIN_HEIGHT,
        contentHeight + SPEC_ROW_CONTENT_PADDING,
      );

      // Row border (subtle dark line)
      page.drawRectangle({
        x: LEFT_COL_X,
        y: leftY - rowHeight + SPEC_ROW_BORDER_OFFSET,
        width: LEFT_COL_WIDTH,
        height: rowHeight,
        borderColor: COLORS.line,
        borderWidth: 0.9,
      });

      // Vertically centered label
      const labelTextY =
        leftY - rowHeight / 2 + SPEC_LABEL_FONT_SIZE / 2 - 1;

      page.drawText(label, {
        x: LEFT_COL_X + SPEC_LABEL_X_OFFSET,
        y: labelTextY,
        size: SPEC_LABEL_FONT_SIZE,
        font,
        color: COLORS.muted,
        maxWidth: SPEC_LABEL_MAX_WIDTH,
      });

      // Vertically centered multiline value
      const textBaseY =
        leftY - rowHeight / 2 + contentHeight / 2 - 2;

      wrappedValue.forEach((line, index) => {
        page.drawText(line, {
          x: LEFT_COL_X + SPEC_VALUE_X_OFFSET,
          y: textBaseY - index * SPEC_LINE_HEIGHT,
          size: SPEC_VALUE_FONT_SIZE,
          font,
          color: COLORS.text,
          maxWidth: SPEC_VALUE_MAX_WIDTH,
        });
      });

      leftY -= rowHeight + SPEC_ROW_GAP;
    });
  }

  // ── Image Panel (Right Column) ──────────────────────────────────────────

  page.drawRectangle({
    x: RIGHT_COL_X,
    y: IMAGE_PANEL_Y,
    width: RIGHT_COL_WIDTH,
    height: IMAGE_PANEL_HEIGHT,
    color: COLORS.imageBg,
  });

  const hero = await embedImage(
    pdfDoc,
    input.item.imageUrl,
  );

  if (hero) {
    const scaled = hero.scaleToFit(
      RIGHT_COL_WIDTH - IMAGE_PANEL_PADDING,
      IMAGE_PANEL_HEIGHT - IMAGE_PANEL_PADDING,
    );

    page.drawImage(hero, {
      x: RIGHT_COL_X + (RIGHT_COL_WIDTH - scaled.width) / 2,
      y: IMAGE_PANEL_Y + (IMAGE_PANEL_HEIGHT - scaled.height) / 2,
      width: scaled.width,
      height: scaled.height,
    });
  } else {
    const fallbackText = "Изображение недоступно";
    const fallbackSize = 11;
    const fallbackWidth = font.widthOfTextAtSize(fallbackText, fallbackSize);

    page.drawText(fallbackText, {
      x: RIGHT_COL_X + (RIGHT_COL_WIDTH - fallbackWidth) / 2,
      y: IMAGE_PANEL_Y + IMAGE_PANEL_HEIGHT / 2 - 4,
      size: fallbackSize,
      font,
      color: COLORS.imageFallback,
    });
  }

  // ── QR Codes (buy link + VK, side by side) ────────────────────────────

  // Buy QR
  try {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      FETCH_TIMEOUT_MS,
    );

    const qrBytes = await fetch(
      `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
        buyLink,
      )}&color=000000&bgcolor=ffffff&margin=1`,
      { signal: controller.signal },
    ).then((response) => response.arrayBuffer());

    clearTimeout(timeout);

    const qr = await pdfDoc.embedPng(qrBytes);

    page.drawImage(qr, {
      x: QR_X,
      y: QR_Y,
      width: QR_SIZE,
      height: QR_SIZE,
    });

    // Label under buy QR
    const buyLabel = "Купить";
    const buyLabelWidth = font.widthOfTextAtSize(buyLabel, QR_LABEL_FONT_SIZE);
    page.drawText(buyLabel, {
      x: QR_X + (QR_SIZE - buyLabelWidth) / 2,
      y: QR_Y - QR_LABEL_GAP - QR_LABEL_FONT_SIZE,
      size: QR_LABEL_FONT_SIZE,
      font,
      color: COLORS.muted,
    });
  } catch (error) {
    logger.warn("[franchize] failed to generate buy QR", error);
  }

  // VK QR
  try {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      FETCH_TIMEOUT_MS,
    );

    const vkQrBytes = await fetch(
      `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
        VK_LINK,
      )}&color=000000&bgcolor=ffffff&margin=1`,
      { signal: controller.signal },
    ).then((response) => response.arrayBuffer());

    clearTimeout(timeout);

    const vkQr = await pdfDoc.embedPng(vkQrBytes);

    page.drawImage(vkQr, {
      x: VK_QR_X,
      y: QR_Y,
      width: VK_QR_SIZE,
      height: VK_QR_SIZE,
    });

    // Label under VK QR
    const vkLabel = "\u041C\u044B \u0412\u041A\u043E\u043D\u0442\u0430\u043A\u0442\u0435";
    const vkLabelWidth = font.widthOfTextAtSize(vkLabel, QR_LABEL_FONT_SIZE);
    page.drawText(vkLabel, {
      x: VK_QR_X + (VK_QR_SIZE - vkLabelWidth) / 2,
      y: QR_Y - QR_LABEL_GAP - QR_LABEL_FONT_SIZE,
      size: QR_LABEL_FONT_SIZE,
      font,
      color: COLORS.muted,
    });
  } catch (error) {
    logger.warn("[franchize] failed to generate VK QR", error);
  }

  // ── Rental Price Box ──────────────────────────────────────────────────

  const rentWeekday =
    typeof specs.rent_weekday === "number" && specs.rent_weekday > 0
      ? specs.rent_weekday
      : typeof specs.dailyPrice === "number" && specs.dailyPrice > 0
        ? specs.dailyPrice
        : 0;
  const rentWeekend =
    typeof specs.rent_weekend === "number" && specs.rent_weekend > 0
      ? specs.rent_weekend
      : 0;

  if (rentWeekday > 0 || rentWeekend > 0) {
    page.drawRectangle({
      x: RENTAL_BOX_X,
      y: RENTAL_BOX_Y,
      width: RENTAL_BOX_WIDTH,
      height: RENTAL_BOX_HEIGHT,
      color: COLORS.linkBg,
      borderColor: COLORS.accent,
      borderWidth: 1.2,
    });

    // Heading
    page.drawText("\u0410\u0420\u0415\u041D\u0414\u0410", {
      x: RENTAL_BOX_X + RENTAL_INNER_X,
      y: RENTAL_BOX_Y + RENTAL_BOX_HEIGHT - RENTAL_INNER_Y - RENTAL_HEADING_FONT_SIZE + 2,
      size: RENTAL_HEADING_FONT_SIZE,
      font,
      color: COLORS.accent,
    });

    // Weekday price
    if (rentWeekday > 0) {
      page.drawText(`\u0411\u0443\u0434\u043D\u0438  ${formatRub(rentWeekday)}/\u0441\u0443\u0442\u043A\u0438`, {
        x: RENTAL_BOX_X + RENTAL_INNER_X,
        y: RENTAL_BOX_Y + RENTAL_BOX_HEIGHT - RENTAL_INNER_Y - RENTAL_HEADING_FONT_SIZE - 6,
        size: RENTAL_VALUE_FONT_SIZE,
        font,
        color: COLORS.text,
      });
    }

    // Weekend price
    if (rentWeekend > 0) {
      page.drawText(`\u0412\u044B\u0445\u043E\u0434\u043D\u044B\u0435  ${formatRub(rentWeekend)}/\u0441\u0443\u0442\u043A\u0438`, {
        x: RENTAL_BOX_X + RENTAL_INNER_X,
        y: RENTAL_BOX_Y + RENTAL_BOX_HEIGHT - RENTAL_INNER_Y - RENTAL_HEADING_FONT_SIZE - 6 - RENTAL_LINE_HEIGHT,
        size: RENTAL_VALUE_FONT_SIZE,
        font,
        color: COLORS.text,
      });
    }
  }

  // ── Link Box (dark, right column, below QR) ────────────────────────────

  page.drawRectangle({
    x: LINK_BOX_X,
    y: LINK_BOX_Y,
    width: LINK_BOX_WIDTH,
    height: LINK_BOX_HEIGHT,
    color: COLORS.linkBg,
    borderColor: COLORS.accent,
    borderWidth: 1.2,
  });

  // Line 1: "Ссылка:" label
  page.drawText("Ссылка:", {
    x: LINK_BOX_X + LINK_BOX_INNER_X,
    y: LINK_BOX_Y + LINK_BOX_HEIGHT - 14,
    size: LINK_TITLE_FONT_SIZE,
    font,
    color: COLORS.muted,
  });

  // Line 2: actual URL (wrapped to fit)
  const linkLines = wrapText(
    buyLink,
    font,
    LINK_FONT_SIZE,
    LINK_BOX_MAX_WIDTH,
  ).slice(0, 2);

  linkLines.forEach((line, index) => {
    page.drawText(line, {
      x: LINK_BOX_X + LINK_BOX_INNER_X,
      y: LINK_BOX_Y + LINK_BOX_HEIGHT - 24 - index * LINK_BOX_LINK_LINE_HEIGHT,
      size: LINK_FONT_SIZE,
      font,
      color: COLORS.text,
      maxWidth: LINK_BOX_MAX_WIDTH,
    });
  });

  // ── Footer ──────────────────────────────────────────────────────────────

  page.drawText(
    `ID: ${input.item.id}`,
    {
      x: PAGE_PADDING,
      y: FOOTER_Y,
      size: 8.3,
      font,
      color: COLORS.muted,
    },
  );

  page.drawText(
    formatTimestamp(new Date()),
    {
      x: FOOTER_GENERATED_X,
      y: FOOTER_Y,
      size: 8.3,
      font,
      color: COLORS.muted,
    },
  );

  return pdfDoc.save();
}

// ─── Server Action ──────────────────────────────────────────────────────────

export async function sendFranchizeBuyPrintPdf(
  input: unknown,
): Promise<{
  success: boolean;
  error?: string;
  fileName?: string;
}> {
  const payload =
    input && typeof input === "object"
      ? (input as UnknownRecord)
      : {};

  const slug = normalizeSlug(
    readString(payload.slug),
  );

  const bikeId = readString(payload.bikeId);

  if (!bikeId) {
    return {
      success: false,
      error: "bikeId is required.",
    };
  }

  const actorUserId = await resolveActorUserId();

  const access = await resolvePrintAccess(
    actorUserId,
    slug,
  );

  if (!access.allowed) {
    return {
      success: false,
      error: access.reason,
    };
  }

  try {
    const { crew, items } =
      await getFranchizeBySlug(slug);

    const item = items.find(
      (candidate) => candidate.id === bikeId,
    );

    if (!item) {
      return {
        success: false,
        error: "Байк не найден.",
      };
    }

    const bytes = await generateBuyPdf({
      slug,
      brandName:
        crew.header?.brandName ||
        crew.name ||
        "VIP BIKE RENTAL",
      botUsername:
        crew.contacts.telegramBotUsername,
      item: {
        id: item.id,
        title: item.title,
        description: item.description || "",
        imageUrl: item.imageUrl || "",
        salePrice: item.salePrice,
        availabilityLabel:
          item.availabilityLabel || "",
        rawSpecs: item.rawSpecs,
      },
    });

    const fileName =
      `BUY_${safeFilePart(item.title)}_${safeFilePart(item.id)}.pdf`;

    const fileBlob = new Blob(
      [bytes],
      {
        type: "application/pdf",
      },
    );

    const sendResult =
      await sendTelegramDocument(
        actorUserId,
        fileBlob,
        fileName,
      );

    if (!sendResult.success) {
      return {
        success: false,
        error:
          sendResult.error ||
          "Telegram sendDocument failed.",
      };
    }

    return {
      success: true,
      fileName,
    };
  } catch (error) {
    logger.error(
      "[franchize] sendFranchizeBuyPrintPdf failed",
      error,
    );

    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Не удалось отправить PDF.",
    };
  }
}
