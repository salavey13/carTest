// /app/franchize/server-actions/buy-print.ts
"use server";

import { cookies } from "next/headers";
import fs from "fs";
import path from "path";
import { PDFDocument, rgb, type PDFFont } from "pdf-lib";
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

// ─── Global Layout Constants ────────────────────────────────────────────────

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;

const PAGE_PADDING = 38;

const HEADER_HEIGHT = 82;

const LEFT_COL_X = PAGE_PADDING;
const LEFT_COL_WIDTH = 248;

const RIGHT_COL_X = 314;
const RIGHT_COL_WIDTH = 242;

const IMAGE_PANEL_HEIGHT = 255;

const FOOTER_Y = 24;

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

async function embedImage(pdfDoc: PDFDocument, url: string) {
  if (!url) {
    return null;
  }

  try {
    const response = await fetch(url);

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

  return rows.slice(0, 13);
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

// ─── PDF Generation ─────────────────────────────────────────────────────────

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

  const colors = {
    header: rgb(0.07, 0.08, 0.11),
    text: rgb(0.12, 0.13, 0.15),
    muted: rgb(0.46, 0.48, 0.52),
    line: rgb(0.88, 0.89, 0.91),
    accent: rgb(0.96, 0.76, 0.22),
    imageBg: rgb(0.10, 0.11, 0.13),
    linkBg: rgb(0.99, 0.98, 0.94),
  };

  const specs = input.item.rawSpecs || {};
  const keySpecs = extractKeySpecs(specs);

  const buyLink = buildWebAppBuyLink(
    input.botUsername,
    input.item.id,
  );

  // ── Header ──────────────────────────────────────────────────────────────

  page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - HEADER_HEIGHT,
    width: PAGE_WIDTH,
    height: HEADER_HEIGHT,
    color: colors.header,
  });

  page.drawText(
    (input.brandName || input.slug).toUpperCase(),
    {
      x: PAGE_PADDING,
      y: PAGE_HEIGHT - 40,
      size: 24,
      font,
      color: rgb(1, 1, 1),
    },
  );

  // ── Title Block ─────────────────────────────────────────────────────────

  let leftY = PAGE_HEIGHT - 118;

  page.drawText(input.item.title, {
    x: LEFT_COL_X,
    y: leftY,
    size: 24,
    font,
    color: colors.text,
  });

  leftY -= 34;

  page.drawText(
    `Цена: ${formatRub(input.item.salePrice)}`,
    {
      x: LEFT_COL_X,
      y: leftY,
      size: 20,
      font,
      color: colors.text,
    },
  );

  leftY -= 44;

  // ── Description ─────────────────────────────────────────────────────────

  page.drawText("Описание", {
    x: LEFT_COL_X,
    y: leftY,
    size: 14,
    font,
    color: colors.text,
  });

  leftY -= 22;

  const description =
    input.item.description || "Описание не заполнено.";

  const descriptionLines = wrapText(
    description,
    font,
    10.4,
    LEFT_COL_WIDTH,
  ).slice(0, 8);

  descriptionLines.forEach((line) => {
    page.drawText(line, {
      x: LEFT_COL_X,
      y: leftY,
      size: 10.4,
      font,
      color: colors.muted,
      maxWidth: LEFT_COL_WIDTH,
    });

    leftY -= 14;
  });

  leftY -= 18;

  // ── Specs Header ────────────────────────────────────────────────────────

  page.drawText("Характеристики", {
    x: LEFT_COL_X,
    y: leftY,
    size: 14,
    font,
    color: colors.text,
  });

  leftY -= 24;

  // ── Specs Table ─────────────────────────────────────────────────────────

  const SPEC_VALUE_FONT_SIZE = 9.4;
  const SPEC_VALUE_MAX_WIDTH = 118;
  const SPEC_LINE_HEIGHT = 10;
  const SPEC_LABEL_FONT_SIZE = 9.3;
  const SPEC_LABEL_MAX_WIDTH = 82;
  const SPEC_VALUE_X_OFFSET = 108;
  const SPEC_LABEL_X_OFFSET = 12;

  keySpecs.forEach(([label, value]) => {
    const wrappedValue = wrapText(
      value,
      font,
      SPEC_VALUE_FONT_SIZE,
      SPEC_VALUE_MAX_WIDTH,
    ).slice(0, 2);

    const contentHeight = wrappedValue.length * SPEC_LINE_HEIGHT;
    const rowHeight = Math.max(30, contentHeight + 12);

    // Row border
    page.drawRectangle({
      x: LEFT_COL_X,
      y: leftY - rowHeight + 6,
      width: LEFT_COL_WIDTH,
      height: rowHeight,
      borderColor: colors.line,
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
      color: colors.muted,
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
        color: colors.text,
        maxWidth: SPEC_VALUE_MAX_WIDTH,
      });
    });

    leftY -= rowHeight + 4;
  });

  // ── Image Panel (Right Column) ──────────────────────────────────────────

  const imageY = PAGE_HEIGHT - 355;

  page.drawRectangle({
    x: RIGHT_COL_X,
    y: imageY,
    width: RIGHT_COL_WIDTH,
    height: IMAGE_PANEL_HEIGHT,
    color: colors.imageBg,
  });

  const hero = await embedImage(
    pdfDoc,
    input.item.imageUrl,
  );

  if (hero) {
    const scaled = hero.scaleToFit(
      RIGHT_COL_WIDTH - 18,
      IMAGE_PANEL_HEIGHT - 18,
    );

    page.drawImage(hero, {
      x: RIGHT_COL_X + (RIGHT_COL_WIDTH - scaled.width) / 2,
      y: imageY + (IMAGE_PANEL_HEIGHT - scaled.height) / 2,
      width: scaled.width,
      height: scaled.height,
    });
  } else {
    // Fallback text when image is unavailable
    page.drawText("Изображение недоступно", {
      x: RIGHT_COL_X + (RIGHT_COL_WIDTH - font.widthOfTextAtSize("Изображение недоступно", 11)) / 2,
      y: imageY + IMAGE_PANEL_HEIGHT / 2 - 4,
      size: 11,
      font,
      color: rgb(0.35, 0.36, 0.38),
    });
  }

  // ── QR Code ─────────────────────────────────────────────────────────────

  try {
    const qrBytes = await fetch(
      `https://api.qrserver.com/v1/create-qr-code/?size=420x420&data=${encodeURIComponent(
        buyLink,
      )}&color=000000&bgcolor=ffffff&margin=1`,
    ).then((response) => response.arrayBuffer());

    const qr = await pdfDoc.embedPng(qrBytes);

    page.drawImage(qr, {
      x: 390,
      y: 52,
      width: 142,
      height: 142,
    });
  } catch (error) {
    logger.warn("[franchize] failed to generate QR", error);
  }

  // ── Link Box ────────────────────────────────────────────────────────────

  page.drawRectangle({
    x: PAGE_PADDING,
    y: 56,
    width: 324,
    height: 82,
    color: colors.linkBg,
    borderColor: colors.accent,
    borderWidth: 1.4,
  });

  page.drawText("Ссылка на карточку", {
    x: PAGE_PADDING + 14,
    y: 112,
    size: 11.5,
    font,
    color: colors.text,
  });

  const linkLines = wrapText(
    buyLink,
    font,
    8.2,
    286,
  ).slice(0, 2);

  linkLines.forEach((line, index) => {
    page.drawText(line, {
      x: PAGE_PADDING + 14,
      y: 90 - index * 10,
      size: 8.2,
      font,
      color: colors.text,
      maxWidth: 286,
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
      color: colors.muted,
    },
  );

  page.drawText(
    `Generated: ${new Date().toLocaleString("ru-RU")}`,
    {
      x: 180,
      y: FOOTER_Y,
      size: 8.3,
      font,
      color: colors.muted,
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

