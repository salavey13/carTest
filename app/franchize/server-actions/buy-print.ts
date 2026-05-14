"use server";

import { cookies } from "next/headers";
import fs from "fs";
import path from "path";
import { PDFDocument, PDFFont, rgb } from "pdf-lib";
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
    imageBg: rgb(0.05, 0.06, 0.08),
    linkBg: rgb(0.99, 0.98, 0.94),
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
    y: PAGE_HEIGHT - 82,
    width: PAGE_WIDTH,
    height: 82,
    color: colors.header,
  });

  page.drawText(
    (input.brandName || input.slug).toUpperCase(),
    {
      x: 38,
      y: PAGE_HEIGHT - 40,
      size: 24,
      font,
      color: rgb(1, 1, 1),
    },
  );

  // LAYOUT CONSTANTS
  const leftX = 38;
  const leftWidth = 248;

  const rightX = 314;
  const rightWidth = 242;

  // TITLE BLOCK
  let leftY = PAGE_HEIGHT - 118;

  page.drawText(input.item.title, {
    x: leftX,
    y: leftY,
    size: 24,
    font,
    color: colors.text,
  });

  leftY -= 34;

  page.drawText(
    `Цена: ${formatRub(input.item.salePrice)}`,
    {
      x: leftX,
      y: leftY,
      size: 20,
      font,
      color: colors.text,
    },
  );

  leftY -= 44;

  // DESCRIPTION
  page.drawText("Описание", {
    x: leftX,
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
    248,
  ).slice(0, 8);

  descriptionLines.forEach((line) => {
    page.drawText(line, {
      x: leftX,
      y: leftY,
      size: 10.4,
      font,
      color: colors.muted,
      maxWidth: 248,
    });

    leftY -= 14;
  });

  leftY -= 18;

  // SPECS HEADER
  page.drawText("Характеристики", {
    x: leftX,
    y: leftY,
    size: 14,
    font,
    color: colors.text,
  });

  leftY -= 24;

  // SPECS TABLE
  keySpecs.forEach(([label, value]) => {
    const wrappedValue = wrapText(
      value,
      font,
      9.6,
      122,
    ).slice(0, 2);

    const rowHeight =
      wrappedValue.length > 1
        ? 38
        : 28;

    page.drawRectangle({
      x: leftX,
      y: leftY - rowHeight + 6,
      width: leftWidth,
      height: rowHeight,
      borderColor: colors.line,
      borderWidth: 0.9,
    });

    // label
    page.drawText(label, {
      x: leftX + 12,
      y: leftY - 10,
      size: 9.3,
      font,
      color: colors.muted,
      maxWidth: 82,
    });

    // value
    wrappedValue.forEach((line, index) => {
      page.drawText(line, {
        x: leftX + 108,
        y: leftY - 10 - index * 11,
        size: 9.6,
        font,
        color: colors.text,
        maxWidth: 122,
      });
    });

    leftY -= rowHeight + 4;
  });

  // IMAGE PANEL
  const imageY = PAGE_HEIGHT - 355;
  const imageHeight = 255;

  page.drawRectangle({
    x: rightX,
    y: imageY,
    width: rightWidth,
    height: imageHeight,
    color: colors.imageBg,
  });

  const hero = await embedImage(
    pdfDoc,
    input.item.imageUrl,
  );

  if (hero) {
    const scaled = hero.scaleToFit(
      rightWidth - 18,
      imageHeight - 18,
    );

    page.drawImage(hero, {
      x: rightX + (rightWidth - scaled.width) / 2,
      y: imageY + (imageHeight - scaled.height) / 2,
      width: scaled.width,
      height: scaled.height,
    });
  }

  // QR
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

  // LINK BOX
  page.drawRectangle({
    x: 38,
    y: 56,
    width: 324,
    height: 82,
    color: colors.linkBg,
    borderColor: colors.accent,
    borderWidth: 1.4,
  });

  page.drawText("Ссылка на карточку", {
    x: 52,
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
      x: 52,
      y: 90 - index * 10,
      size: 8.2,
      font,
      color: colors.text,
      maxWidth: 286,
    });
  });

  // FOOTER
  page.drawText(
    `ID: ${input.item.id}`,
    {
      x: 38,
      y: 24,
      size: 8.3,
      font,
      color: colors.muted,
    },
  );

  page.drawText(
    `Generated: ${new Date().toLocaleString("ru-RU")}`,
    {
      x: 180,
      y: 24,
      size: 8.3,
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