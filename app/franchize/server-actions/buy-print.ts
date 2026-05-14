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

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;

const PAGE_PADDING = 38;
const HEADER_HEIGHT = 92;

const LEFT_COL_X = 38;
const LEFT_COL_W = 248;

const RIGHT_COL_X = 314;
const RIGHT_COL_W = 242;

const QR_BLOCK_HEIGHT = 165;

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

  if (actorUserId) return actorUserId;

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
  return value && value > 0
    ? `${value.toLocaleString("ru-RU")} ₽`
    : "по запросу";
}

function buildWebAppBuyLink(
  botUsername: string,
  bikeId: string,
) {
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

async function embedImage(
  pdfDoc: PDFDocument,
  url: string,
) {
  if (!url) return null;

  try {
    const response = await fetch(url);

    if (!response.ok) return null;

    const bytes = await response.arrayBuffer();

    const contentType =
      response.headers.get("content-type") || "";

    return contentType.includes("png") ||
      url.toLowerCase().includes(".png")
      ? await pdfDoc.embedPng(bytes)
      : await pdfDoc.embedJpg(bytes);
  } catch (error) {
    logger.warn(
      "[franchize] failed to embed PDF image",
      error,
    );

    return null;
  }
}

function wrapText(
  font: PDFFont,
  text: string,
  size: number,
  maxWidth: number,
) {
  const words = text.split(/\s+/).filter(Boolean);

  const lines: string[] = [];

  let current = "";

  words.forEach((word) => {
    const candidate = current
      ? `${current} ${word}`
      : word;

    const width =
      font.widthOfTextAtSize(candidate, size);

    if (width <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  });

  if (current) lines.push(current);

  return lines;
}

function extractKeySpecs(
  specs: UnknownRecord,
): [string, string][] {
  const rows: [string, string][] = [];

  const priorityFields: Array<
    [string, ...string[]]
  > = [
    ["Тип", "bike_subtype"],
    ["Год", "year"],
    ["Пиковая мощность", "power_kw", "motor_peak_kw"],
    ["Номинальная мощность", "motor_nominal_kw"],
    ["Крутящий момент", "torque_nm", "torque_motor_nm"],
    ["Батарея", "battery"],
    ["Запас хода", "range_km"],
    ["Макс. скорость", "top_speed_kmh"],
    ["Вес", "weight_kg"],
    ["Тормоза", "brake_type"],
    ["Подвеска", "suspension_type"],
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

  return rows.slice(0, 14);
}

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

  const page = pdfDoc.addPage([
    PAGE_WIDTH,
    PAGE_HEIGHT,
  ]);

  const colors = {
    header: rgb(0.07, 0.08, 0.11),
    text: rgb(0.12, 0.13, 0.15),
    muted: rgb(0.45, 0.48, 0.52),
    line: rgb(0.88, 0.89, 0.91),
    accent: rgb(0.96, 0.76, 0.22),
    soft: rgb(0.97, 0.98, 0.99),
    linkBg: rgb(0.99, 0.98, 0.94),
    imageBg: rgb(0.04, 0.05, 0.08),
    imageBorder: rgb(0.15, 0.85, 0.95),
  };

  const specs = input.item.rawSpecs || {};

  const keySpecs = extractKeySpecs(specs);

  const buyLink = buildWebAppBuyLink(
    input.botUsername,
    input.item.id,
  );

  // HEADER
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
      y: PAGE_HEIGHT - 42,
      size: 23,
      font,
      color: rgb(1, 1, 1),
    },
  );

  page.drawText(
    "Карточка байка / sale handoff",
    {
      x: PAGE_PADDING,
      y: PAGE_HEIGHT - 66,
      size: 11,
      font,
      color: colors.accent,
    },
  );

  // LEFT COLUMN
  let y = PAGE_HEIGHT - 128;

  // TITLE
  const titleLines = wrapText(
    font,
    input.item.title,
    25,
    LEFT_COL_W,
  ).slice(0, 2);

  titleLines.forEach((line) => {
    page.drawText(line, {
      x: LEFT_COL_X,
      y,
      size: 25,
      font,
      color: colors.text,
    });

    y -= 28;
  });

  y -= 4;

  page.drawText(`ID: ${input.item.id}`, {
    x: LEFT_COL_X,
    y,
    size: 11,
    font,
    color: colors.muted,
  });

  y -= 28;

  page.drawText(
    `Цена: ${formatRub(input.item.salePrice)}`,
    {
      x: LEFT_COL_X,
      y,
      size: 19,
      font,
      color: colors.text,
    },
  );

  y -= 30;

  page.drawText(
    `Статус: ${
      input.item.availabilityLabel ||
      "уточнить у оператора"
    }`,
    {
      x: LEFT_COL_X,
      y,
      size: 11.5,
      font,
      color: colors.muted,
    },
  );

  y -= 48;

  // DESCRIPTION
  page.drawText("Описание", {
    x: LEFT_COL_X,
    y,
    size: 14,
    font,
    color: colors.text,
  });

  y -= 22;

  const description =
    input.item.description?.trim() ||
    "Описание не заполнено.";

  const descriptionLines = wrapText(
    font,
    description,
    10.4,
    LEFT_COL_W,
  ).slice(0, 8);

  descriptionLines.forEach((line) => {
    page.drawText(line, {
      x: LEFT_COL_X,
      y,
      size: 10.4,
      font,
      color: colors.muted,
    });

    y -= 15;
  });

  y -= 18;

  // SPECS
  page.drawText("Характеристики", {
    x: LEFT_COL_X,
    y,
    size: 14,
    font,
    color: colors.text,
  });

  y -= 24;

  // prevent overlap with QR block
  const minY =
    QR_BLOCK_HEIGHT + 22;

  const visibleSpecs = keySpecs.filter(
    (_, index) => {
      const nextY =
        y - index * 32;

      return nextY > minY;
    },
  );

  visibleSpecs.forEach(([label, value]) => {
    page.drawRectangle({
      x: LEFT_COL_X,
      y: y - 10,
      width: LEFT_COL_W,
      height: 28,
      borderColor: colors.line,
      borderWidth: 0.8,
    });

    page.drawText(label, {
      x: LEFT_COL_X + 12,
      y: y - 8,
      size: 9.3,
      font,
      color: colors.muted,
      maxWidth: 88,
    });

    page.drawText(value, {
      x: LEFT_COL_X + 104,
      y: y - 8,
      size: 10.1,
      font,
      color: colors.text,
      maxWidth: 130,
    });

    y -= 32;
  });

  // IMAGE PANEL
  const imagePanelY = 245;
  const imagePanelH =
    PAGE_HEIGHT - HEADER_HEIGHT - imagePanelY - 18;

  page.drawRectangle({
    x: RIGHT_COL_X,
    y: imagePanelY,
    width: RIGHT_COL_W,
    height: imagePanelH,
    color: colors.imageBg,
  });

  page.drawRectangle({
    x: RIGHT_COL_X,
    y: imagePanelY,
    width: RIGHT_COL_W,
    height: imagePanelH,
    borderColor: colors.imageBorder,
    borderWidth: 1,
    opacity: 0.35,
  });

  const hero = await embedImage(
    pdfDoc,
    input.item.imageUrl,
  );

  if (hero) {
    const scaled = hero.scaleToFit(
      RIGHT_COL_W - 16,
      imagePanelH - 16,
    );

    page.drawImage(hero, {
      x:
        RIGHT_COL_X +
        (RIGHT_COL_W - scaled.width) / 2,
      y: imagePanelY + 8,
      width: scaled.width,
      height: scaled.height,
    });
  } else {
    page.drawText("Фото недоступно", {
      x: RIGHT_COL_X + 48,
      y: imagePanelY + imagePanelH / 2,
      size: 11,
      font,
      color: colors.muted,
    });
  }

  // BOTTOM BLOCK
  page.drawRectangle({
    x: 0,
    y: 0,
    width: PAGE_WIDTH,
    height: QR_BLOCK_HEIGHT,
    color: colors.soft,
  });

  // QR
  try {
    const qrBytes = await fetch(
      `https://api.qrserver.com/v1/create-qr-code/?size=420x420&data=${encodeURIComponent(
        buyLink,
      )}&color=000000&bgcolor=ffffff&margin=1`,
    ).then((res) => res.arrayBuffer());

    const qr = await pdfDoc.embedPng(qrBytes);

    page.drawImage(qr, {
      x: 396,
      y: 24,
      width: 132,
      height: 132,
    });
  } catch (error) {
    logger.warn(
      "[franchize] failed to generate QR",
      error,
    );
  }

  // LINK CARD
  page.drawRectangle({
    x: PAGE_PADDING,
    y: 38,
    width: 322,
    height: 98,
    color: colors.linkBg,
    borderColor: colors.accent,
    borderWidth: 1.3,
  });

  page.drawText("Ссылка на карточку", {
    x: 54,
    y: 112,
    size: 12,
    font,
    color: colors.text,
  });

  const linkLines = wrapText(
    font,
    buyLink,
    8.5,
    280,
  ).slice(0, 3);

  let linkY = 92;

  linkLines.forEach((line) => {
    page.drawText(line, {
      x: 54,
      y: linkY,
      size: 8.5,
      font,
      color: colors.text,
    });

    linkY -= 11;
  });

  page.drawText(
    "Распечатайте и прикрепите к байку / стойке продаж.",
    {
      x: 54,
      y: 52,
      size: 9.2,
      font,
      color: colors.muted,
      maxWidth: 260,
    },
  );

  page.drawText(
    `Generated: ${new Date().toLocaleString("ru-RU")}`,
    {
      x: PAGE_PADDING,
      y: 16,
      size: 8.2,
      font,
      color: colors.muted,
    },
  );

  return pdfDoc.save();
}

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

  const actorUserId =
    await resolveActorUserId();

  const access =
    await resolvePrintAccess(
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

    const fileBlob = new Blob([bytes], {
      type: "application/pdf",
    });

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
