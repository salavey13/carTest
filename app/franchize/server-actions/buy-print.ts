"use server";

import { cookies } from "next/headers";
import fs from "fs";
import path from "path";
import { PDFDocument, rgb } from "pdf-lib";
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
  if (!actorUserId) return { allowed: false, reason: "Нужна Telegram-сессия." };

  const { data: crew, error: crewError } = await supabaseAdmin
    .from("crews")
    .select("id, owner_id")
    .eq("slug", normalizeSlug(slug))
    .maybeSingle();

  if (crewError) return { allowed: false, reason: crewError.message };
  if (!crew?.id) return { allowed: false, reason: "Экипаж не найден." };

  const { data: user } = await supabaseAdmin
    .from("users")
    .select("role, status")
    .eq("user_id", actorUserId)
    .maybeSingle();

  const role = readString(user?.role).toLowerCase();
  const status = readString(user?.status).toLowerCase();
  const isAdmin = role === "admin" || role === "vpradmin" || status === "admin";
  const isOwner = crew.owner_id === actorUserId;

  if (isAdmin || isOwner) {
    return { allowed: true, reason: isAdmin ? "admin" : "owner" };
  }

  return {
    allowed: false,
    reason: "PDF-печать доступна только админам и владельцу экипажа.",
  };
}

function safeFilePart(value: string) {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9а-яА-ЯёЁ_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "bike";
}

function formatRub(value: number | null | undefined) {
  return value && value > 0 ? `${value.toLocaleString("ru-RU")} ₽` : "по запросу";
}

function buildWebAppBuyLink(botUsername: string, bikeId: string) {
  const normalizedBot =
    botUsername.trim().replace(/^@+/, "").replace(/[^a-zA-Z0-9_]/g, "") ||
    DEFAULT_TELEGRAM_BOT_USERNAME;
  const safeBikeId = bikeId.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 64) || "bike";
  return `https://t.me/${normalizedBot}/app?startapp=buy_${safeBikeId}`;
}

async function embedImage(pdfDoc: PDFDocument, url: string) {
  if (!url) return null;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const bytes = await response.arrayBuffer();
    const contentType = response.headers.get("content-type") || "";
    return contentType.includes("png") || url.toLowerCase().includes(".png")
      ? await pdfDoc.embedPng(bytes)
      : await pdfDoc.embedJpg(bytes);
  } catch (error) {
    logger.warn("[franchize] failed to embed buy PDF image", error);
    return null;
  }
}

function extractKeySpecs(specs: UnknownRecord) {
  const rows: [string, string][] = [];

  const priorityFields = [
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

  // Fallback
  Object.entries(specs).forEach(([key, value]) => {
    if (typeof value === "string" && value.length > 2 &&
        !priorityFields.flat().includes(key) &&
        !["gallery", "features", "buy_colors", "buy_options", "spec_labels"].includes(key)) {
      const niceLabel = key
        .replace(/_/g, " ")
        .replace(/\b\w/g, l => l.toUpperCase());
      if (!rows.some(r => r[0] === niceLabel)) {
        rows.push([niceLabel, value]);
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
    pricePerDay: number;
    availabilityLabel: string;
    rawSpecs?: UnknownRecord;
  };
}) {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  const fontPath = path.join(process.cwd(), "server-assets", "fonts", "DejaVuSans.ttf");
  const fontBytes = fs.readFileSync(fontPath);
  const font = await pdfDoc.embedFont(fontBytes);

  const page = pdfDoc.addPage([595.28, 841.89]);
  const { width, height } = page.getSize();

  const headerBg = rgb(0.08, 0.09, 0.12);
  const textDark = rgb(0.12, 0.13, 0.15);
  const accent = rgb(0.95, 0.75, 0.22);
  const muted = rgb(0.45, 0.48, 0.52);
  const line = rgb(0.85, 0.87, 0.89);

  const specs = input.item.rawSpecs || {};
  const buyLink = buildWebAppBuyLink(input.botUsername, input.item.id);

  // HEADER
  page.drawRectangle({ x: 0, y: height - 92, width, height: 92, color: headerBg });

  page.drawText((input.brandName || input.slug).toUpperCase(), {
    x: 36, y: height - 42, size: 22, font, color: rgb(1, 1, 1)
  });
  page.drawText("Карточка байка для печати / sale handoff", {
    x: 36, y: height - 66, size: 11, font, color: accent
  });

  // LEFT COLUMN - Title block
  let y = height - 125;

  page.drawText(input.item.title, { x: 36, y, size: 26, font, color: textDark });
  y -= 28;

  page.drawText(`ID: ${input.item.id}`, { x: 36, y, size: 11, font, color: muted });
  y -= 26;

  page.drawText(`Цена: ${formatRub(input.item.salePrice || Number(specs.price_rub || specs.sale_price || 0))}`, {
    x: 36, y, size: 18, font, color: textDark
  });
  y -= 26;

  page.drawText(`Статус: ${input.item.availabilityLabel || "уточнить у оператора"}`, {
    x: 36, y, size: 11.5, font, color: muted
  });
  y -= 45;

  // IMAGE (right side, tall 9:16)
  const imageX = 340;
  const imageWidth = 220;
  const imageHeight = Math.round(imageWidth * (16 / 9));

  const hero = await embedImage(pdfDoc, input.item.imageUrl);
  if (hero) {
    page.drawImage(hero, { 
      x: imageX, 
      y: height - 325, 
      width: imageWidth, 
      height: imageHeight 
    });
  } else {
    page.drawRectangle({ 
      x: imageX, 
      y: height - 325, 
      width: imageWidth, 
      height: imageHeight, 
      borderColor: line, 
      borderWidth: 2 
    });
  }

  // DESCRIPTION (left, below title)
  const desc = input.item.description || "Описание не заполнено.";
  const wrappedDesc = desc.match(/.{1,78}(?:\s|$)/g)?.slice(0, 8) || [desc];

  y = height - 355;
  page.drawText("Описание", { x: 36, y, size: 14, font, color: textDark });
  y -= 22;

  wrappedDesc.forEach((lineText) => {
    page.drawText(lineText.trim(), { 
      x: 36, 
      y, 
      size: 10.8, 
      font, 
      color: muted, 
      maxWidth: 275 
    });
    y -= 14.8;
  });

  // DYNAMIC SPECS (below description)
  y -= 12;
  page.drawText("Характеристики", { x: 36, y, size: 14, font, color: textDark });
  y -= 26;

  const keySpecs = extractKeySpecs(specs);

  keySpecs.forEach(([label, value], index) => {
    const rowY = y - index * 29;
    page.drawRectangle({ 
      x: 36, 
      y: rowY - 9, 
      width: 285, 
      height: 26, 
      borderColor: line, 
      borderWidth: 0.8 
    });
    page.drawText(label, { x: 46, y: rowY, size: 9.5, font, color: muted });
    page.drawText(value, { x: 165, y: rowY, size: 10.5, font, color: textDark });
  });

  // QR + LINK BOX (bottom)
  const qrBytes = await fetch(
    `https://api.qrserver.com/v1/create-qr-code/?size=420x420&data=${encodeURIComponent(buyLink)}&color=000000&bgcolor=ffffff&margin=1`
  ).then((res) => res.arrayBuffer());
  const qr = await pdfDoc.embedPng(qrBytes);

  page.drawImage(qr, { x: 380, y: 65, width: 145, height: 145 });

  page.drawRectangle({ 
    x: 36, 
    y: 65, 
    width: 320, 
    height: 88, 
    color: rgb(0.98, 0.97, 0.92), 
    borderColor: accent, 
    borderWidth: 1.5 
  });

  page.drawText("Ссылка на карточку", { x: 52, y: 130, size: 11.5, font, color: textDark });
  page.drawText(buyLink, { x: 52, y: 112, size: 8.8, font, color: textDark, maxWidth: 290 });
  page.drawText("Распечатайте лист и прикрепите к байку / стойке продаж.", { 
    x: 52, y: 82, size: 9.5, font, color: muted 
  });

  page.drawText(`Generated: ${new Date().toLocaleString("ru-RU")}`, {
    x: 36, y: 32, size: 8.5, font, color: muted
  });

  return pdfDoc.save();
}

export async function sendFranchizeBuyPrintPdf(input: unknown): Promise<{
  success: boolean;
  error?: string;
  fileName?: string;
}> {
  const payload = input && typeof input === "object" ? (input as UnknownRecord) : {};
  const slug = normalizeSlug(readString(payload.slug));
  const bikeId = readString(payload.bikeId);
  if (!bikeId) return { success: false, error: "bikeId is required." };

  const actorUserId = await resolveActorUserId();
  const access = await resolvePrintAccess(actorUserId, slug);
  if (!access.allowed) return { success: false, error: access.reason };

  try {
    const { crew, items } = await getFranchizeBySlug(slug);
    const item = items.find((candidate) => candidate.id === bikeId);
    if (!item) return { success: false, error: "Байк не найден." };

    const bytes = await generateBuyPdf({
      slug,
      brandName: crew.header?.brandName || crew.name || "VIP BIKE RENTAL",
      botUsername: crew.contacts.telegramBotUsername,
      item: {
        id: item.id,
        title: item.title,
        description: item.description || "",
        imageUrl: item.imageUrl || "",
        salePrice: item.salePrice,
        pricePerDay: item.pricePerDay || 0,
        availabilityLabel: item.availabilityLabel || "",
        rawSpecs: item.rawSpecs,
      },
    });

    const fileName = `BUY_${safeFilePart(item.title)}_${safeFilePart(item.id)}.pdf`;
    const fileBlob = new Blob([bytes], { type: "application/pdf" });
    const sendResult = await sendTelegramDocument(actorUserId, fileBlob, fileName);

    if (!sendResult.success) {
      return { success: false, error: sendResult.error || "Telegram sendDocument failed." };
    }

    return { success: true, fileName };
  } catch (error) {
    logger.error("[franchize] sendFranchizeBuyPrintPdf failed", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Не удалось отправить PDF.",
    };
  }
}
