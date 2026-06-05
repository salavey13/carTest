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
const HEADER_HEIGHT = 62; // compact — brand text still fits with comfortable padding
const HEADER_BRAND_Y_OFFSET = 38; // from top of page (visually centered in header)
const HEADER_ACCENT_HEIGHT = 2; // gold separator line under header

// Title block — full page width, dynamically positioned below header
const TITLE_FONT_SIZE = 24;
const TITLE_LINE_HEIGHT = 28;
const TITLE_MAX_WIDTH = PAGE_WIDTH - 2 * PAGE_PADDING; // full width: 519px
const TITLE_ASCENT = 22; // approximate ascent for DejaVu Sans at TITLE_FONT_SIZE
const TITLE_BELOW_HEADER_GAP = 10; // visual gap between header accent line and title visual top
const TITLE_BLOCK_TOP = PAGE_HEIGHT - HEADER_HEIGHT - TITLE_ASCENT - TITLE_BELOW_HEADER_GAP;

// Price
const PRICE_FONT_SIZE = 20;
const TITLE_TO_PRICE_GAP = 10; // gap between last title line baseline and price baseline
const PRICE_TO_DESC_GAP = 16; // gap between price baseline and description heading

// Right column — positioned dynamically below title block
const RIGHT_COL_X = 314;
const RIGHT_COL_WIDTH = 242;
const RIGHT_COL_TOP_PADDING = 8; // gap between title block bottom and image top edge

// Image panel stretches from below title all the way to just above the rental box
// (computed dynamically — constant removed, was 340)

// Left column specs — starts below price, offset from left edge
const LEFT_COL_X = PAGE_PADDING;
const LEFT_COL_WIDTH = 248;

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
const SPEC_ROW_BORDER_OFFSET = 6;
const SPEC_ROW_GAP = 4;
const SPEC_MAX_ROWS = 13;
const SPEC_MAX_VALUE_LINES = 2;

// QR codes — two side by side (buy link + VK community)
const VK_LINK = "https://vk.com/vip_bike_electro";

const QR_SIZE = 110;
const VK_QR_SIZE = 110;
const QR_PAIR_GAP = 10;
const QR_PAIR_TOTAL_WIDTH = QR_SIZE + QR_PAIR_GAP + VK_QR_SIZE; // 230
const IMAGE_TO_RENTAL_GAP = 6; // small gap between image panel bottom and rental box top

// QR labels
const QR_LABEL_GAP = 4;
const QR_LABEL_FONT_SIZE = 7;

// Rental price box — expanded to hold hourly + daily rates + CTA
const RENTAL_BOX_HEIGHT = 148;
const RENTAL_BOX_GAP = 8;
const RENTAL_BOX_X = RIGHT_COL_X;
const RENTAL_BOX_WIDTH = RIGHT_COL_WIDTH;
const RENTAL_HEADING_FONT_SIZE = 11;
const RENTAL_VALUE_FONT_SIZE = 11;
const RENTAL_LINE_HEIGHT = 15;
const RENTAL_INNER_X = 10;
const RENTAL_INNER_Y = 10;

// CTA (call-to-action) text at the bottom of rental box
const CTA_FONT_SIZE = 8;
const CTA_LINE_HEIGHT = 11;

// Description
const DESC_FONT_SIZE = 10.4;
const DESC_LINE_HEIGHT = 14;
const DESC_MAX_LINES = 8;
const DESC_SECTION_GAP = 18;

// Section headings
const SECTION_HEADING_SIZE = 14;
const SECTION_HEADING_GAP_AFTER = 22;
const SECTION_HEADING_GAP_BEFORE = 24;

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
  pageBg: rgb(0.16, 0.17, 0.20),       // lighter graphite — better for A5 print
  header: rgb(0.10, 0.11, 0.14),       // near-black — deeper than page
  text: rgb(0.92, 0.93, 0.95),         // near-white — main body text
  muted: rgb(0.58, 0.60, 0.64),        // medium gray — labels, secondary text
  line: rgb(0.28, 0.29, 0.33),         // subtle dark — spec row borders
  accent: rgb(0.04, 0.745, 0.94),      // electric cyan — matches bike neon accent
  accentSubtle: rgb(0.04, 0.745, 0.94),// electric cyan (same)
  imageBg: rgb(0.16, 0.17, 0.20),      // graphite — matches pageBg (seamless panel)
  linkBg: rgb(0.20, 0.21, 0.24),       // lifted dark — link card background
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
 * Draws a rounded rectangle on a PDF page.
 * pdf-lib doesn't natively support borderRadius, so we draw
 * the path manually using bezier curves for the corners.
 *
 * Draws fill first, then stroke on top (two passes) for clean results.
 */
function drawRoundedRect(
  page: ReturnType<PDFDocument["addPage"]>,
  opts: {
    x: number;
    y: number;
    width: number;
    height: number;
    radius: number;
    color?: RGB;
    borderColor?: RGB;
    borderWidth?: number;
  },
) {
  const { x, y, width, height, radius, color, borderColor, borderWidth } = opts;
  const r = Math.min(radius, width / 2, height / 2);
  const k = 0.5522847498; // bezier circle approximation constant

  // --- Fill pass ---
  if (color) {
    page.drawRectangle({
      x: x + r,
      y,
      width: width - 2 * r,
      height,
      color,
    });
    page.drawRectangle({
      x,
      y: y + r,
      width,
      height: height - 2 * r,
      color,
    });

    // Four corner quadrants as small filled squares + overlapping circles approximated
    // by small filled rectangles (close enough at typical corner radius 6-10pt)
    const cr = r;
    // Top-left corner fill
    page.drawRectangle({ x, y: y + height - cr, width: cr, height: cr, color });
    // Top-right corner fill
    page.drawRectangle({ x: x + width - cr, y: y + height - cr, width: cr, height: cr, color });
    // Bottom-left corner fill
    page.drawRectangle({ x, y, width: cr, height: cr, color });
    // Bottom-right corner fill
    page.drawRectangle({ x: x + width - cr, y, width: cr, height: cr, color });
  }

  // --- Stroke pass (border) using line segments + bezier arcs ---
  if (borderColor && borderWidth) {
    page.drawLine({
      start: { x: x + r, y: y + height },
      end: { x: x + width - r, y: y + height },
      thickness: borderWidth,
      color: borderColor,
    });
    page.drawLine({
      start: { x: x + width, y: y + height - r },
      end: { x: x + width, y: y + r },
      thickness: borderWidth,
      color: borderColor,
    });
    page.drawLine({
      start: { x: x + width - r, y },
      end: { x: x + r, y },
      thickness: borderWidth,
      color: borderColor,
    });
    page.drawLine({
      start: { x, y: y + r },
      end: { x, y: y + height - r },
      thickness: borderWidth,
      color: borderColor,
    });

    // Four corner arcs as short line segments (approximation)
    const steps = 4;
    for (let i = 0; i < steps; i++) {
      const a1 = (i / steps) * Math.PI / 2;
      const a2 = ((i + 1) / steps) * Math.PI / 2;

      // Top-right corner (center at x+w-r, y+h-r)
      page.drawLine({
        start: { x: x + width - r + r * Math.cos(a1), y: y + height - r + r * Math.sin(a1) },
        end: { x: x + width - r + r * Math.cos(a2), y: y + height - r + r * Math.sin(a2) },
        thickness: borderWidth,
        color: borderColor,
      });
      // Bottom-right corner (center at x+w-r, y+r)
      page.drawLine({
        start: { x: x + width - r + r * Math.cos(Math.PI / 2 + a1), y: y + r + r * Math.sin(Math.PI / 2 + a1) },
        end: { x: x + width - r + r * Math.cos(Math.PI / 2 + a2), y: y + r + r * Math.sin(Math.PI / 2 + a2) },
        thickness: borderWidth,
        color: borderColor,
      });
      // Bottom-left corner (center at x+r, y+r)
      page.drawLine({
        start: { x: x + r + r * Math.cos(Math.PI + a1), y: y + r + r * Math.sin(Math.PI + a1) },
        end: { x: x + r + r * Math.cos(Math.PI + a2), y: y + r + r * Math.sin(Math.PI + a2) },
        thickness: borderWidth,
        color: borderColor,
      });
      // Top-left corner (center at x+r, y+h-r)
      page.drawLine({
        start: { x: x + r + r * Math.cos(3 * Math.PI / 2 + a1), y: y + height - r + r * Math.sin(3 * Math.PI / 2 + a1) },
        end: { x: x + r + r * Math.cos(3 * Math.PI / 2 + a2), y: y + height - r + r * Math.sin(3 * Math.PI / 2 + a2) },
        thickness: borderWidth,
        color: borderColor,
      });
    }
  }
}

// ─── PDF Generation ─────────────────────────────────────────────────────────

/**
 * Generates a premium DARK-MODE product-sheet PDF for a franchize bike listing.
 *
 * Layout overview (A4 portrait, dark theme):
 * ┌──────────────────────────────────────┐
 * │ HEADER (near-black + cyan accent)    │
 * ├──────────────────────────────────────┤
 * │  Title (full page width, multi-line) │
 * │  Price                               │
 * ├───────────────┬──────────────────────┤
 * │  Description  │  IMAGE (cover fit)   │
 * │  ─────────    │  (fills right col,   │
 * │  Specs table  │   bike + floor)      │
 * │  (dark rows)  │   ┌──────────────┐   │
 * │               │   │ QR backdrop  │   │
 * │               │   │ QR buy │ VK  │   │
 * │               │   └──────────────┘   │
 * │               │   ┌──────────────┐   │
 * │               │   │ RENTAL BOX   │   │
 * │               │   │ (rounded)    │   │
 * │               │   └──────────────┘   │
 * └───────────────┴──────────────────────┘
 *
 * Key: Title spans full width. Image uses cover-fit to fill the right
 * column. QR codes overlap the bottom of the image (floor reflection).
 * Rental box sits below the image with rounded corners.
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

  // ── Title Block (full page width, dynamically sized) ────────────────────
  // Title wraps across the full page width so long names aren't clipped.
  // Right column elements start BELOW the title block to avoid overlap.

  let leftY = TITLE_BLOCK_TOP;

  // Wrap title across full page width
  const titleLines = wrapText(
    input.item.title,
    font,
    TITLE_FONT_SIZE,
    TITLE_MAX_WIDTH,
  );

  titleLines.forEach((line) => {
    page.drawText(line, {
      x: PAGE_PADDING,
      y: leftY,
      size: TITLE_FONT_SIZE,
      font,
      color: COLORS.text,
    });

    leftY -= TITLE_LINE_HEIGHT;
  });

  leftY -= TITLE_TO_PRICE_GAP;

  // Price
  page.drawText(
    `Цена: ${formatRub(input.item.salePrice)}`,
    {
      x: PAGE_PADDING,
      y: leftY,
      size: PRICE_FONT_SIZE,
      font,
      color: COLORS.text,
    },
  );

  leftY -= PRICE_TO_DESC_GAP;

  // ── Compute right column positions (dynamic, below title block) ─────────
  // The image panel stretches from rightColumnTop down to just above the rental box.
  // QR codes sit INSIDE the image panel (overlapping with the bike photo).
  // Rental box sits below the image panel.

  const titleBlockBottom = leftY;
  const rightColumnTop = titleBlockBottom + RIGHT_COL_TOP_PADDING;

  // Total vertical span from rightColumnTop to rental box bottom
  // (keeps the same proportions as the original layout)
  const RIGHT_COL_TOTAL = 625;

  // Rental box: bottom of the right column
  const RENTAL_BOX_Y = rightColumnTop - RIGHT_COL_TOTAL;

  // QR codes: above rental box, inside the image panel
  const QR_Y = RENTAL_BOX_Y + RENTAL_BOX_HEIGHT + RENTAL_BOX_GAP + QR_LABEL_FONT_SIZE + QR_LABEL_GAP;
  const QR_X = RIGHT_COL_X + (RIGHT_COL_WIDTH - QR_PAIR_TOTAL_WIDTH) / 2;
  const VK_QR_X = QR_X + QR_SIZE + QR_PAIR_GAP;

  // Image panel: from rightColumnTop to just above the rental box
  // (covers the QR code area — QR codes intentionally overlap with the bike image)
  const IMAGE_PANEL_Y = RENTAL_BOX_Y + RENTAL_BOX_HEIGHT + IMAGE_TO_RENTAL_GAP;
  const IMAGE_PANEL_HEIGHT = rightColumnTop - IMAGE_PANEL_Y;

  // ── Image Panel (Right Column) — cover fit, drawn BEFORE left column ───
  // Drawn early so that any horizontal overflow can be masked with pageBg,
  // then left column text renders on top of the mask cleanly.

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
    // Cover fit: scale image to fill entire panel, center + crop overflow
    const imgW = hero.width;
    const imgH = hero.height;
    const scaleByW = RIGHT_COL_WIDTH / imgW;
    const scaleByH = IMAGE_PANEL_HEIGHT / imgH;
    const coverScale = Math.max(scaleByW, scaleByH);

    const drawW = imgW * coverScale;
    const drawH = imgH * coverScale;

    // Center horizontally in panel, center vertically
    const imgX = RIGHT_COL_X + (RIGHT_COL_WIDTH - drawW) / 2;
    const imgY = IMAGE_PANEL_Y + (IMAGE_PANEL_HEIGHT - drawH) / 2;

    page.drawImage(hero, {
      x: imgX,
      y: imgY,
      width: drawW,
      height: drawH,
    });

    // Mask left overflow (if image extends beyond right column left edge)
    if (imgX < RIGHT_COL_X) {
      page.drawRectangle({
        x: imgX,
        y: IMAGE_PANEL_Y,
        width: RIGHT_COL_X - imgX,
        height: IMAGE_PANEL_HEIGHT,
        color: COLORS.pageBg,
      });
    }

    // Mask right overflow (if image extends beyond page margin)
    const imgRight = imgX + drawW;
    const panelRight = RIGHT_COL_X + RIGHT_COL_WIDTH;
    if (imgRight > panelRight) {
      page.drawRectangle({
        x: panelRight,
        y: IMAGE_PANEL_Y,
        width: imgRight - panelRight,
        height: IMAGE_PANEL_HEIGHT,
        color: COLORS.pageBg,
      });
    }
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

  // ── QR backdrop (semi-transparent dark rectangle behind QR pair) ───────
  // Helps QR labels remain readable on top of the bike image.

  const QR_BACKDROP_PADDING = 8;
  const QR_BACKDROP_Y = QR_Y - QR_LABEL_GAP - QR_LABEL_FONT_SIZE - QR_BACKDROP_PADDING;
  const QR_BACKDROP_HEIGHT = QR_SIZE + QR_LABEL_GAP + QR_LABEL_FONT_SIZE + QR_BACKDROP_PADDING * 2;

  page.drawRectangle({
    x: QR_X - QR_BACKDROP_PADDING,
    y: QR_BACKDROP_Y,
    width: QR_PAIR_TOTAL_WIDTH + QR_BACKDROP_PADDING * 2,
    height: QR_BACKDROP_HEIGHT,
    color: COLORS.pageBg,
    opacity: 0.75,
  });

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
    const vkLabel = "Мы ВКонтакте";
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

  // ── Rental Price Box (expanded: hourly + daily rates + CTA) ───────────

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

  // Hourly rates from specs (with fallback to computed from daily)
  const pricePerHour =
    typeof specs.price_per_hour === "number" && specs.price_per_hour > 0
      ? specs.price_per_hour
      : rentWeekday > 0
        ? Math.round(rentWeekday / 8)
        : 0;
  const pricePer3h =
    typeof specs.price_per_3h === "number" && specs.price_per_3h > 0
      ? specs.price_per_3h
      : pricePerHour > 0
        ? pricePerHour * 3
        : 0;
  const pricePer6h =
    typeof specs.price_per_6h === "number" && specs.price_per_6h > 0
      ? specs.price_per_6h
      : pricePerHour > 0
        ? pricePerHour * 6
        : 0;
  const pricePer12h =
    typeof specs.price_per_12h === "number" && specs.price_per_12h > 0
      ? specs.price_per_12h
      : pricePerHour > 0
        ? pricePerHour * 12
        : 0;

  const hasRentalRates =
    pricePerHour > 0 ||
    pricePer3h > 0 ||
    pricePer6h > 0 ||
    pricePer12h > 0 ||
    rentWeekday > 0 ||
    rentWeekend > 0;

  if (hasRentalRates) {
    drawRoundedRect(page, {
      x: RENTAL_BOX_X,
      y: RENTAL_BOX_Y,
      width: RENTAL_BOX_WIDTH,
      height: RENTAL_BOX_HEIGHT,
      radius: 8,
      color: COLORS.linkBg,
      borderColor: COLORS.accent,
      borderWidth: 1.2,
    });

    // Current Y inside the rental box (top-down)
    let rentalY =
      RENTAL_BOX_Y + RENTAL_BOX_HEIGHT - RENTAL_INNER_Y - RENTAL_HEADING_FONT_SIZE + 2;

    // Heading
    page.drawText("АРЕНДА", {
      x: RENTAL_BOX_X + RENTAL_INNER_X,
      y: rentalY,
      size: RENTAL_HEADING_FONT_SIZE,
      font,
      color: COLORS.accent,
    });

    rentalY -= RENTAL_LINE_HEIGHT + 2;

    // ── Hourly rates ──────────────────────────────────────────────────────
    if (pricePerHour > 0) {
      page.drawText(`1 час   ${formatRub(pricePerHour)}`, {
        x: RENTAL_BOX_X + RENTAL_INNER_X,
        y: rentalY,
        size: RENTAL_VALUE_FONT_SIZE,
        font,
        color: COLORS.text,
      });
      rentalY -= RENTAL_LINE_HEIGHT;
    }

    if (pricePer3h > 0) {
      page.drawText(`3 часа  ${formatRub(pricePer3h)}`, {
        x: RENTAL_BOX_X + RENTAL_INNER_X,
        y: rentalY,
        size: RENTAL_VALUE_FONT_SIZE,
        font,
        color: COLORS.text,
      });
      rentalY -= RENTAL_LINE_HEIGHT;
    }

    if (pricePer6h > 0) {
      page.drawText(`6 часов  ${formatRub(pricePer6h)}`, {
        x: RENTAL_BOX_X + RENTAL_INNER_X,
        y: rentalY,
        size: RENTAL_VALUE_FONT_SIZE,
        font,
        color: COLORS.text,
      });
      rentalY -= RENTAL_LINE_HEIGHT;
    }

    if (pricePer12h > 0) {
      page.drawText(`12 часов  ${formatRub(pricePer12h)}`, {
        x: RENTAL_BOX_X + RENTAL_INNER_X,
        y: rentalY,
        size: RENTAL_VALUE_FONT_SIZE,
        font,
        color: COLORS.text,
      });
      rentalY -= RENTAL_LINE_HEIGHT;
    }

    // ── Separator line between hourly and daily ───────────────────────────
    if ((rentWeekday > 0 || rentWeekend > 0) && pricePerHour > 0) {
      const sepY = rentalY + 5;
      page.drawRectangle({
        x: RENTAL_BOX_X + RENTAL_INNER_X,
        y: sepY,
        width: RENTAL_BOX_WIDTH - RENTAL_INNER_X * 2,
        height: 0.5,
        color: COLORS.line,
      });
      rentalY -= 6;
    }

    // ── Daily rates ───────────────────────────────────────────────────────
    if (rentWeekday > 0) {
      page.drawText(`Будни  ${formatRub(rentWeekday)}/сутки`, {
        x: RENTAL_BOX_X + RENTAL_INNER_X,
        y: rentalY,
        size: RENTAL_VALUE_FONT_SIZE,
        font,
        color: COLORS.text,
      });
      rentalY -= RENTAL_LINE_HEIGHT;
    }

    if (rentWeekend > 0) {
      page.drawText(`Выходные  ${formatRub(rentWeekend)}/сутки`, {
        x: RENTAL_BOX_X + RENTAL_INNER_X,
        y: rentalY,
        size: RENTAL_VALUE_FONT_SIZE,
        font,
        color: COLORS.text,
      });
      rentalY -= RENTAL_LINE_HEIGHT;
    }

    // ── CTA (call-to-action) ──────────────────────────────────────────────
    const ctaText = "Сканируй QR — пройди бесплатный тест-драйв!";
    const ctaLines = wrapText(
      ctaText,
      font,
      CTA_FONT_SIZE,
      RENTAL_BOX_WIDTH - RENTAL_INNER_X * 2,
    ).slice(0, 2);

    // Small separator before CTA
    const ctaSepY = rentalY + 4;
    page.drawRectangle({
      x: RENTAL_BOX_X + RENTAL_INNER_X,
      y: ctaSepY,
      width: RENTAL_BOX_WIDTH - RENTAL_INNER_X * 2,
      height: 0.5,
      color: COLORS.accent,
    });
    rentalY -= 6;

    ctaLines.forEach((line) => {
      page.drawText(line, {
        x: RENTAL_BOX_X + RENTAL_INNER_X,
        y: rentalY,
        size: CTA_FONT_SIZE,
        font,
        color: COLORS.accent,
      });
      rentalY -= CTA_LINE_HEIGHT;
    });
  }

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
