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

export type PageSize = "A4" | "A5";

interface LayoutConstants {
  pageWidth: number;
  pageHeight: number;
  pagePadding: number;
  headerHeight: number;
  headerBrandYOffset: number;
  headerAccentHeight: number;
  titleFontSize: number;
  titleLineHeight: number;
  titleMaxWidth: number;
  titleAscent: number;
  titleBelowHeaderGap: number;
  titleBlockTop: number;
  priceFontSize: number;
  titleToPriceGap: number;
  priceToDescGap: number;
  rightColX: number;
  rightColWidth: number;
  rightColTopPadding: number;
  leftColX: number;
  leftColWidth: number;
  specValueFontSize: number;
  specValueMaxWidth: number;
  specLabelFontSize: number;
  specLabelMaxWidth: number;
  specLabelXOffset: number;
  specLineHeight: number;
  specRowMinHeight: number;
  specRowContentPadding: number;
  specRowBorderOffset: number;
  specRowGap: number;
  qrSize: number;
  vkQrSize: number;
  qrPairGap: number;
  qrPairTotalWidth: number;
  qrBottomPadding: number;
  imageToRentalGap: number;
  qrLabelGap: number;
  qrLabelFontSize: number;
  rentalBoxHeight: number;
  rentalBoxX: number;
  rentalBoxWidth: number;
  rentalHeadingFontSize: number;
  rentalValueFontSize: number;
  rentalLineHeight: number;
  rentalInnerX: number;
  rentalInnerY: number;
  ctaFontSize: number;
  ctaLineHeight: number;
  descFontSize: number;
  descLineHeight: number;
  descMaxLines: number;
  descSectionGap: number;
  sectionHeadingSize: number;
  sectionHeadingGapAfter: number;
  sectionHeadingGapBefore: number;
  specMaxRows: number;
}

// ─── Layout Constants Factory ────────────────────────────────────────────────

function createLayoutConstants(pageSize: PageSize): LayoutConstants {
  // A4: 595.28 x 841.89 pt
  // A5: 420 x 595 pt (A5 is half of A4 by area: 420mm x 148mm from 210mm x 297mm)
  const isA5 = pageSize === "A5";
  // Scale factor derived from width ratio: 420 / 595.28 ≈ 0.705
  const scale = isA5 ? 420 / 595.28 : 1;

  const pageWidth = isA5 ? 420 : 595.28;
  const pageHeight = isA5 ? 595 : 841.89;
  const pagePadding = Math.round(38 * scale);

  const headerHeight = Math.round(62 * scale);
  const headerBrandYOffset = Math.round(38 * scale);
  const headerAccentHeight = Math.max(2, Math.round(2 * scale));

  const titleFontSize = Math.round(24 * scale);
  const titleLineHeight = Math.round(28 * scale);
  const titleMaxWidth = pageWidth - 2 * pagePadding;
  const titleAscent = Math.round(22 * scale);
  const titleBelowHeaderGap = Math.round(10 * scale);
  const titleBlockTop = pageHeight - headerHeight - titleAscent - titleBelowHeaderGap;

  const priceFontSize = Math.round(20 * scale);
  const titleToPriceGap = Math.round(10 * scale);
  const priceToDescGap = Math.round(16 * scale);

  const rightColX = Math.round(314 * scale);
  const rightColWidth = Math.round(242 * scale);
  const rightColTopPadding = Math.round(8 * scale);

  const leftColX = pagePadding;
  const leftColWidth = Math.round(248 * scale);

  const specValueFontSize = Math.round(9.4 * scale * 10) / 10;
  const specValueMaxWidth = Math.round(118 * scale);
  const specLabelFontSize = Math.round(9.3 * scale * 10) / 10;
  const specLabelMaxWidth = Math.round(82 * scale);
  const specLabelXOffset = Math.round(12 * scale);
  const specLineHeight = Math.round(10 * scale);
  const specRowMinHeight = Math.round(30 * scale);
  const specRowContentPadding = Math.round(12 * scale);
  const specRowBorderOffset = Math.round(6 * scale);
  const specRowGap = Math.round(4 * scale);

  const qrSize = Math.round(68 * scale);
  const vkQrSize = Math.round(68 * scale);
  const qrPairGap = Math.round(16 * scale);
  const qrPairTotalWidth = qrSize + qrPairGap + vkQrSize;
  const qrBottomPadding = Math.round(14 * scale);
  const imageToRentalGap = Math.round(6 * scale);
  const qrLabelGap = Math.round(4 * scale);
  const qrLabelFontSize = Math.round(7 * scale);

  const rentalBoxHeight = Math.round(isA5 ? 168 : 148 * scale); // Taller for A5: enlarged prices + proper CTA space
  const rentalBoxX = rightColX;
  const rentalBoxWidth = rightColWidth;
  const rentalHeadingFontSize = Math.round(11 * scale);
  const rentalValueFontSize = Math.round(11 * scale);
  const rentalLineHeight = Math.round(15 * scale);
  const rentalInnerX = Math.round(10 * scale);
  const rentalInnerY = Math.round(10 * scale);

  const ctaFontSize = Math.round(8 * scale);
  const ctaLineHeight = Math.round(11 * scale);

  const descFontSize = Math.round(10.4 * scale * 10) / 10;
  const descLineHeight = Math.round(14 * scale);
  const descMaxLines = isA5 ? 6 : 8; // Fewer lines for A5
  const descSectionGap = Math.round(18 * scale);

  const sectionHeadingSize = Math.round(14 * scale);
  const sectionHeadingGapAfter = Math.round(22 * scale);
  const sectionHeadingGapBefore = Math.round(24 * scale);

  const specMaxRows = 13; // Same for both A4 and A5

  return {
    pageWidth,
    pageHeight,
    pagePadding,
    headerHeight,
    headerBrandYOffset,
    headerAccentHeight,
    titleFontSize,
    titleLineHeight,
    titleMaxWidth,
    titleAscent,
    titleBelowHeaderGap,
    titleBlockTop,
    priceFontSize,
    titleToPriceGap,
    priceToDescGap,
    rightColX,
    rightColWidth,
    rightColTopPadding,
    leftColX,
    leftColWidth,
    specValueFontSize,
    specValueMaxWidth,
    specLabelFontSize,
    specLabelMaxWidth,
    specLabelXOffset,
    specLineHeight,
    specRowMinHeight,
    specRowContentPadding,
    specRowBorderOffset,
    specRowGap,
    qrSize,
    vkQrSize,
    qrPairGap,
    qrPairTotalWidth,
    qrBottomPadding,
    imageToRentalGap,
    qrLabelGap,
    qrLabelFontSize,
    rentalBoxHeight,
    rentalBoxX,
    rentalBoxWidth,
    rentalHeadingFontSize,
    rentalValueFontSize,
    rentalLineHeight,
    rentalInnerX,
    rentalInnerY,
    ctaFontSize,
    ctaLineHeight,
    descFontSize,
    descLineHeight,
    descMaxLines,
    descSectionGap,
    sectionHeadingSize,
    sectionHeadingGapAfter,
    sectionHeadingGapBefore,
    specMaxRows,
  };
}

// Spec table limits (not scaled with page size)
const SPEC_MAX_VALUE_LINES = 2;
const SPEC_LABEL_MAX_LINES = 2; // Prevent unbounded label wrapping

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
  pageBg: rgb(0.07, 0.08, 0.10),       // near-black — slick dark, image pops just right
  header: rgb(0.04, 0.05, 0.07),       // deep black — header bar
  text: rgb(0.92, 0.93, 0.95),         // near-white — main body text
  muted: rgb(0.55, 0.57, 0.60),        // medium gray — labels, secondary text
  line: rgb(0.18, 0.19, 0.22),         // subtle dark — spec row borders
  accent: rgb(0.04, 0.745, 0.94),      // electric cyan — matches bike neon accent
  accentSubtle: rgb(0.04, 0.745, 0.94),// electric cyan (same)
  imageBg: rgb(0.07, 0.08, 0.10),      // near-black — matches pageBg (seamless panel)
  linkBg: rgb(0.11, 0.12, 0.14),       // lifted dark — link card background
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

/**
 * Checks whether a spec value is truthy (true, 1, "true", "1").
 * Used for boolean-like spec fields such as "sale" and "rent".
 */
function isTruthySpec(value: unknown): boolean {
  if (value === true || value === 1) return true;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    return v === "true" || v === "1";
  }
  return false;
}

/**
 * Formats a spec value by appending the appropriate unit suffix.
 * Detects numeric-only values and appends units based on the spec key.
 * Values that already contain units or are non-numeric are left as-is.
 */
function formatSpecValue(key: string, value: string): string {
  // If the value already contains a unit (non-numeric suffix), leave as-is
  if (!/^\d+([.,]\d+)?$/.test(value.trim())) {
    return value;
  }

  // Map spec keys to their unit suffixes
  const unitMap: Record<string, string> = {
    power_kw: " кВт",
    motor_peak_kw: " кВт",
    motor_nominal_kw: " кВт",
    torque_nm: " Н·м",
    torque_motor_nm: " Н·м",
    range_km: " км",
    range_120ah_km: " км",
    range_100ah_km: " км",
    top_speed_kmh: " км/ч",
    weight_kg: " кг",
    charge_time_h: " ч",
    acceleration_0_100_s: " с",
    year: "", // no unit for year
  };

  const suffix = unitMap[key];
  if (suffix !== undefined) {
    return value + suffix;
  }

  // Fallback: try to infer unit from the label
  return value;
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

  return `${value.toLocaleString("ru-RU")} Руб`;
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

function extractKeySpecs(specs: UnknownRecord, maxRows: number = 13) {
  const rows: [string, string, string][] = []; // [label, value, rawKey]

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
      const rawValue = readString(specs[key]);

      if (rawValue && rawValue !== "—") {
        rows.push([label, formatSpecValue(key, rawValue), key]);
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
        const rawValue = readString(value);
        rows.push([niceLabel, formatSpecValue(key, rawValue), key]);
      }
    }
  });

  return rows.slice(0, maxRows);
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
      // Bottom-right corner (center at x+w-r, y+r) — arc from -90° to 0°
      page.drawLine({
        start: { x: x + width - r + r * Math.cos(-Math.PI / 2 + a1), y: y + r + r * Math.sin(-Math.PI / 2 + a1) },
        end: { x: x + width - r + r * Math.cos(-Math.PI / 2 + a2), y: y + r + r * Math.sin(-Math.PI / 2 + a2) },
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
      // Top-left corner (center at x+r, y+h-r) — arc from 90° to 180°
      page.drawLine({
        start: { x: x + r + r * Math.cos(Math.PI / 2 + a1), y: y + height - r + r * Math.sin(Math.PI / 2 + a1) },
        end: { x: x + r + r * Math.cos(Math.PI / 2 + a2), y: y + height - r + r * Math.sin(Math.PI / 2 + a2) },
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
  vkLink?: string;
  pageSize?: PageSize;
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
  const pageSize = input.pageSize || "A4";
  const isA5 = pageSize === "A5";
  const layout = createLayoutConstants(pageSize);

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

  // Bold font for header brand
  const boldFontPath = path.join(
    process.cwd(),
    "server-assets",
    "fonts",
    "DejaVuSans-Bold.ttf",
  );

  let boldFont: PDFFont;
  try {
    const boldFontBytes = fs.readFileSync(boldFontPath);
    boldFont = await pdfDoc.embedFont(boldFontBytes);
  } catch {
    // Fallback to system DejaVuSans-Bold if project copy doesn't exist
    const sysBoldBytes = fs.readFileSync("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf");
    boldFont = await pdfDoc.embedFont(sysBoldBytes);
  }

  const page = pdfDoc.addPage([layout.pageWidth, layout.pageHeight]);

  const specs = input.item.rawSpecs || {};
  const keySpecs = extractKeySpecs(specs, layout.specMaxRows);

  const buyLink = buildWebAppBuyLink(
    input.botUsername,
    input.item.id,
  );

  // ── Page Background (dark graphite) ─────────────────────────────────────

  page.drawRectangle({
    x: 0,
    y: 0,
    width: layout.pageWidth,
    height: layout.pageHeight,
    color: COLORS.pageBg,
  });

  // ── Header ──────────────────────────────────────────────────────────────

  page.drawRectangle({
    x: 0,
    y: layout.pageHeight - layout.headerHeight,
    width: layout.pageWidth,
    height: layout.headerHeight,
    color: COLORS.header,
  });

  // Dynamic header title based on bike specs and crew branding:
  //   sale=true/1 → "{BRAND} ELECTRO" (bike is for sale)
  //   otherwise   → brandName (crew default, or "Экипаж" fallback)
  const baseBrand = input.brandName || "Экипаж";
  const headerTitle = isTruthySpec(specs.sale)
    ? `${baseBrand.toUpperCase()} ELECTRO`
    : baseBrand.toUpperCase();

  page.drawText(headerTitle, {
    x: layout.pagePadding,
    y: layout.pageHeight - layout.headerBrandYOffset,
    size: layout.titleFontSize,
    font: boldFont,
    color: COLORS.accent,
  });

  // Cyan accent line at bottom of header
  page.drawRectangle({
    x: 0,
    y: layout.pageHeight - layout.headerHeight,
    width: layout.pageWidth,
    height: layout.headerAccentHeight,
    color: COLORS.accent,
  });

  // ── Title Block (full page width, dynamically sized) ────────────────────
  // Title wraps across the full page width so long names aren't clipped.
  // Right column elements start BELOW the title block to avoid overlap.

  let leftY = layout.titleBlockTop;

  // Wrap title across full page width
  const titleLines = wrapText(
    input.item.title,
    font,
    layout.titleFontSize,
    layout.titleMaxWidth,
  );

  titleLines.forEach((line) => {
    page.drawText(line, {
      x: layout.pagePadding,
      y: leftY,
      size: layout.titleFontSize,
      font,
      color: COLORS.text,
    });

    leftY -= layout.titleLineHeight;
  });

  leftY -= layout.titleToPriceGap;

  // Price
  page.drawText(
    `Цена: ${formatRub(input.item.salePrice)}`,
    {
      x: layout.pagePadding,
      y: leftY,
      size: layout.priceFontSize,
      font,
      color: COLORS.text,
    },
  );

  leftY -= layout.priceToDescGap;

  // ── Compute right column positions (dynamic, below title block) ─────────
  // Image panel uses 9:16 ratio (matches bike photos → no black border).
  // Image height is computed dynamically so that the rental box bottom
  // aligns with the specs table bottom for visual consistency.
  // QR codes sit INSIDE the image panel near the bottom, with padding.
  // Rental box sits below the image panel.

  const titleBlockBottom = leftY;
  const rightColumnTop = titleBlockBottom + layout.rightColTopPadding;

  // Snapshot leftY before drawing description/specs — we'll track final leftY later.
  // For now, compute image panel from a target total right-column height.
  // We want: rightColumnTop - RENTAL_BOX_Y ≈ rightColumnTop - (leftY after specs)
  // The rental box bottom (RENTAL_BOX_Y) should match specs table bottom (leftY after specs).
  // Since we don't know leftY after specs yet, we compute the image panel height
  // dynamically AFTER drawing the left column.

  // We'll fill in IMAGE_PANEL_Y and IMAGE_PANEL_HEIGHT after the left column.
  // For now, just record rightColumnTop.
  let _rightColumnTop = rightColumnTop;

  // ── Image panel & QR codes will be drawn AFTER the left column ──────────
  // (We need to know leftY after specs to align rental box bottom with specs bottom.)

  // ── Description ─────────────────────────────────────────────────────────

  page.drawText("Описание", {
    x: layout.leftColX,
    y: leftY,
    size: layout.sectionHeadingSize,
    font,
    color: COLORS.text,
  });

  leftY -= layout.sectionHeadingGapAfter;

  const description =
    input.item.description || "Описание не заполнено.";

  const descriptionLines = wrapText(
    description,
    font,
    layout.descFontSize,
    layout.leftColWidth,
  ).slice(0, layout.descMaxLines);

  descriptionLines.forEach((line) => {
    page.drawText(line, {
      x: layout.leftColX,
      y: leftY,
      size: layout.descFontSize,
      font,
      color: COLORS.muted,
      maxWidth: layout.leftColWidth,
    });

    leftY -= layout.descLineHeight;
  });

  leftY -= layout.descSectionGap;

  // ── Specs ───────────────────────────────────────────────────────────────

  if (keySpecs.length > 0) {
    page.drawText("Характеристики", {
      x: layout.leftColX,
      y: leftY,
      size: layout.sectionHeadingSize,
      font,
      color: COLORS.text,
    });

    leftY -= layout.sectionHeadingGapAfter;

    keySpecs.forEach(([label, value, _rawKey]) => {
      const wrappedValue = wrapText(
        value,
        font,
        layout.specValueFontSize,
        layout.specValueMaxWidth,
      ).slice(0, SPEC_MAX_VALUE_LINES);

      // Wrap label to handle multiline case
      const wrappedLabel = wrapText(
        label,
        font,
        layout.specLabelFontSize,
        layout.specLabelMaxWidth,
      ).slice(0, SPEC_LABEL_MAX_LINES);

      const valueHeight = wrappedValue.length * layout.specLineHeight;
      const labelHeight = wrappedLabel.length * layout.specLineHeight;
      const contentHeight = Math.max(valueHeight, labelHeight);
      const rowHeight = Math.max(
        layout.specRowMinHeight,
        contentHeight + layout.specRowContentPadding,
      );

      // Row border (subtle dark line)
      page.drawRectangle({
        x: layout.leftColX,
        y: leftY - rowHeight + layout.specRowBorderOffset,
        width: layout.leftColWidth,
        height: rowHeight,
        borderColor: COLORS.line,
        borderWidth: 0.9,
      });

      // Vertically centered label (multiline aware)
      // Scale the baseline adjustment for proper centering
      // labelHeight/2 puts us at text block center from first line's baseline
      // We need to subtract line height/2 to get from text center back to baseline position
      const baselineAdjustment = -layout.specLineHeight / 2 - 1;
      const labelBaseY =
        leftY - rowHeight / 2 + labelHeight / 2 + baselineAdjustment;

      wrappedLabel.forEach((line, index) => {
        page.drawText(line, {
          x: layout.leftColX + layout.specLabelXOffset,
          y: labelBaseY - index * layout.specLineHeight,
          size: layout.specLabelFontSize,
          font,
          color: COLORS.muted,
          maxWidth: layout.specLabelMaxWidth,
        });
      });

      // Vertically centered multiline value — right-aligned
      const specValueRightEdge = layout.leftColX + layout.leftColWidth - layout.specLabelXOffset;
      const textBaseY =
        leftY - rowHeight / 2 + valueHeight / 2 + baselineAdjustment;

      wrappedValue.forEach((line, index) => {
        const lineWidth = font.widthOfTextAtSize(line, layout.specValueFontSize);
        page.drawText(line, {
          x: specValueRightEdge - lineWidth,
          y: textBaseY - index * layout.specLineHeight,
          size: layout.specValueFontSize,
          font,
          color: COLORS.text,
          maxWidth: layout.specValueMaxWidth,
        });
      });

      leftY -= rowHeight + layout.specRowGap;
    });
  }

  // ── Right column layout — compute positions to align CTA bottom with specs bottom
  const specsBottom = leftY;
  const RENTAL_BOX_Y = specsBottom; // CTA bottom = specs table bottom

  // Image panel: from rightColumnTop to just above the rental box
  const IMAGE_PANEL_Y = RENTAL_BOX_Y + layout.rentalBoxHeight + layout.imageToRentalGap;
  const IMAGE_PANEL_HEIGHT = _rightColumnTop - IMAGE_PANEL_Y;

  // Image dimensions — A5 gets proportionally larger 9:16 image (centered in available space)
  const imageScaleMultiplier = isA5 ? 1.12 : 1.0; // A5 gets 12% larger image
  const IMAGE_PANEL_WIDTH = Math.round(IMAGE_PANEL_HEIGHT * 9 / 16 * imageScaleMultiplier);
  const IMAGE_DRAW_HEIGHT = Math.round(IMAGE_PANEL_HEIGHT * imageScaleMultiplier);
  const IMAGE_DRAW_Y = IMAGE_PANEL_Y + (IMAGE_PANEL_HEIGHT - IMAGE_DRAW_HEIGHT) / 2; // Center vertically

  // QR codes: positioned from bottom of image draw area with padding
  const QR_Y = IMAGE_DRAW_Y + layout.qrBottomPadding + layout.qrLabelGap + layout.qrLabelFontSize;
  const QR_X = layout.rightColX + (layout.rightColWidth - layout.qrPairTotalWidth) / 2;
  const VK_QR_X = QR_X + layout.qrSize + layout.qrPairGap;

  // ── Image Panel (Right Column) — cover fit ─────────────────────────────

  page.drawRectangle({
    x: layout.rightColX,
    y: IMAGE_PANEL_Y,
    width: layout.rightColWidth,
    height: IMAGE_PANEL_HEIGHT,
    color: COLORS.imageBg,
  });

  const hero = await embedImage(
    pdfDoc,
    input.item.imageUrl,
  );

  if (hero) {
    // Cover fit: scale image to fill the 9:16 panel, center + crop overflow
    const imgW = hero.width;
    const imgH = hero.height;
    const scaleByW = IMAGE_PANEL_WIDTH / imgW;
    const scaleByH = IMAGE_DRAW_HEIGHT / imgH;
    const coverScale = Math.max(scaleByW, scaleByH);

    const drawW = imgW * coverScale;
    const drawH = imgH * coverScale;

    // Center horizontally in the right column area, center vertically in draw area
    const imgX = layout.rightColX + (layout.rightColWidth - drawW) / 2;
    const imgY = IMAGE_DRAW_Y + (IMAGE_DRAW_HEIGHT - drawH) / 2;

    page.drawImage(hero, {
      x: imgX,
      y: imgY,
      width: drawW,
      height: drawH,
    });

    // Mask left overflow (if image extends beyond right column left edge)
    if (imgX < layout.rightColX) {
      page.drawRectangle({
        x: imgX,
        y: IMAGE_DRAW_Y,
        width: layout.rightColX - imgX,
        height: IMAGE_DRAW_HEIGHT,
        color: COLORS.pageBg,
      });
    }

    // Mask right overflow (if image extends beyond page margin)
    const imgRight = imgX + drawW;
    const panelRight = layout.rightColX + layout.rightColWidth;
    if (imgRight > panelRight) {
      page.drawRectangle({
        x: panelRight,
        y: IMAGE_DRAW_Y,
        width: imgRight - panelRight,
        height: IMAGE_DRAW_HEIGHT,
        color: COLORS.pageBg,
      });
    }
  } else {
    const fallbackText = "Изображение недоступно";
    const fallbackSize = 11;
    const fallbackWidth = font.widthOfTextAtSize(fallbackText, fallbackSize);

    page.drawText(fallbackText, {
      x: layout.rightColX + (layout.rightColWidth - fallbackWidth) / 2,
      y: IMAGE_DRAW_Y + IMAGE_DRAW_HEIGHT / 2 - 4,
      size: fallbackSize,
      font,
      color: COLORS.imageFallback,
    });
  }

  // ── QR backdrop (semi-transparent dark rectangle behind QR pair) ───────
  // Helps QR labels remain readable on top of the bike image.

  const QR_BACKDROP_PADDING = 8;
  const QR_BACKDROP_Y = QR_Y - layout.qrLabelGap - layout.qrLabelFontSize - QR_BACKDROP_PADDING;
  const QR_BACKDROP_HEIGHT = layout.qrSize + layout.qrLabelGap + layout.qrLabelFontSize + QR_BACKDROP_PADDING * 2;

  page.drawRectangle({
    x: QR_X - QR_BACKDROP_PADDING,
    y: QR_BACKDROP_Y,
    width: layout.qrPairTotalWidth + QR_BACKDROP_PADDING * 2,
    height: QR_BACKDROP_HEIGHT,
    color: COLORS.pageBg,
    opacity: 0.75,
  });

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
      width: layout.qrSize,
      height: layout.qrSize,
    });

    // Label under buy QR
    const buyLabel = "Купить/Арендовать";
    const buyLabelWidth = font.widthOfTextAtSize(buyLabel, layout.qrLabelFontSize);
    page.drawText(buyLabel, {
      x: QR_X + (layout.qrSize - buyLabelWidth) / 2,
      y: QR_Y - layout.qrLabelGap - layout.qrLabelFontSize,
      size: layout.qrLabelFontSize,
      font,
      color: COLORS.muted,
    });
  } catch (error) {
    logger.warn("[franchize] failed to generate buy QR", error);
  }

  // VK QR (crew-specific social link)
  const vkLink = input.vkLink;
  if (vkLink) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        FETCH_TIMEOUT_MS,
      );

      const vkQrBytes = await fetch(
        `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
          vkLink,
        )}&color=000000&bgcolor=ffffff&margin=1`,
        { signal: controller.signal },
      ).then((response) => response.arrayBuffer());

      clearTimeout(timeout);

    const vkQr = await pdfDoc.embedPng(vkQrBytes);

    page.drawImage(vkQr, {
      x: VK_QR_X,
      y: QR_Y,
      width: layout.vkQrSize,
      height: layout.vkQrSize,
    });

    // Label under VK QR
    const vkLabel = "Мы ВКонтакте";
    const vkLabelWidth = font.widthOfTextAtSize(vkLabel, layout.qrLabelFontSize);
    page.drawText(vkLabel, {
      x: VK_QR_X + (layout.vkQrSize - vkLabelWidth) / 2,
      y: QR_Y - layout.qrLabelGap - layout.qrLabelFontSize,
      size: layout.qrLabelFontSize,
      font,
      color: COLORS.muted,
    });
    } catch (error) {
      logger.warn("[franchize] failed to generate VK QR", error);
    }
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
      x: layout.rentalBoxX,
      y: RENTAL_BOX_Y,
      width: layout.rentalBoxWidth,
      height: layout.rentalBoxHeight,
      radius: 8,
      color: COLORS.linkBg,
      borderColor: COLORS.accent,
      borderWidth: 1.2,
    });

    // Current Y inside the rental box (top-down)
    let rentalY =
      RENTAL_BOX_Y + layout.rentalBoxHeight - layout.rentalInnerY - layout.rentalHeadingFontSize + 2;

    // Heading
    page.drawText("АРЕНДА", {
      x: layout.rentalBoxX + layout.rentalInnerX,
      y: rentalY,
      size: layout.rentalHeadingFontSize,
      font,
      color: COLORS.accent,
    });

    rentalY -= layout.rentalLineHeight + 2;

    // Helper: draw rental line with key left-aligned, value right-aligned
    const rentalValueX = layout.rentalBoxX + layout.rentalBoxWidth - layout.rentalInnerX;

    const drawRentalLine = (key: string, value: string) => {
      page.drawText(key, {
        x: layout.rentalBoxX + layout.rentalInnerX,
        y: rentalY,
        size: layout.rentalValueFontSize,
        font,
        color: COLORS.text,
      });
      const valueWidth = font.widthOfTextAtSize(value, layout.rentalValueFontSize);
      page.drawText(value, {
        x: rentalValueX - valueWidth,
        y: rentalY,
        size: layout.rentalValueFontSize,
        font,
        color: COLORS.text,
      });
      rentalY -= layout.rentalLineHeight;
    };

    // ── Hourly rates ──────────────────────────────────────────────────────
    if (pricePerHour > 0) {
      drawRentalLine("1 час", formatRub(pricePerHour));
    }

    if (pricePer3h > 0) {
      drawRentalLine("3 часа", formatRub(pricePer3h));
    }

    if (pricePer6h > 0) {
      drawRentalLine("6 часов", formatRub(pricePer6h));
    }

    if (pricePer12h > 0) {
      drawRentalLine("12 часов", formatRub(pricePer12h));
    }

    // ── Separator line between hourly and daily ───────────────────────────
    if ((rentWeekday > 0 || rentWeekend > 0) && pricePerHour > 0) {
      const sepY = rentalY + 5;
      page.drawRectangle({
        x: layout.rentalBoxX + layout.rentalInnerX,
        y: sepY,
        width: layout.rentalBoxWidth - layout.rentalInnerX * 2,
        height: 0.5,
        color: COLORS.line,
      });
      rentalY -= 6;
    }

    // ── Daily rates ───────────────────────────────────────────────────────
    if (rentWeekday > 0) {
      drawRentalLine("Будни", `${formatRub(rentWeekday)}/сутки`);
    }

    if (rentWeekend > 0) {
      drawRentalLine("Выходные", `${formatRub(rentWeekend)}/сутки`);
    }

    // ── CTA (call-to-action) — positioned from bottom of rental box ────────────
    const ctaText = "Сканируй QR — пройди бесплатный тест-драйв!";
    const ctaLines = wrapText(
      ctaText,
      font,
      layout.ctaFontSize,
      layout.rentalBoxWidth - layout.rentalInnerX * 2,
    ).slice(0, 2);

    // CTA is positioned from the BOTTOM of the rental box with proper padding
    const ctaBottomPadding = layout.rentalInnerY + 4; // Padding from rounded border
    const ctaGapBefore = 8; // Gap before separator
    const ctaSeparatorHeight = 0.5;
    const ctaTotalHeight = ctaLines.length * layout.ctaLineHeight + ctaGapBefore + ctaSeparatorHeight;

    // CTA first line baseline: from bottom of box + padding + height of all lines except first
    const ctaFirstLineY = RENTAL_BOX_Y + ctaBottomPadding + (ctaLines.length - 1) * layout.ctaLineHeight + 4;

    // Separator line sits above CTA with gap
    const ctaSepY = ctaFirstLineY + ctaGapBefore;
    page.drawRectangle({
      x: layout.rentalBoxX + layout.rentalInnerX,
      y: ctaSepY,
      width: layout.rentalBoxWidth - layout.rentalInnerX * 2,
      height: 0.5,
      color: COLORS.accent,
    });

    // Draw CTA lines from bottom up
    ctaLines.forEach((line, idx) => {
      const lineY = ctaFirstLineY - idx * layout.ctaLineHeight;
      page.drawText(line, {
        x: layout.rentalBoxX + layout.rentalInnerX,
        y: lineY,
        size: layout.ctaFontSize,
        font,
        color: COLORS.accent,
      });
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
  const pageSize = (payload.pageSize === "A5" ? "A5" : "A4") as PageSize;

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

    // Extract VK link from crew social links
    const vkLink = crew.footer?.socialLinks?.find(
      (link: any) => link.href && link.href.includes("vk.com")
    )?.href || "";

    const bytes = await generateBuyPdf({
      slug,
      brandName:
        crew.header?.brandName ||
        crew.name ||
        "Экипаж",
      botUsername:
        crew.contacts.telegramBotUsername,
      vkLink,
      pageSize,
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
