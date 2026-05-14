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
  const dark = rgb(0.05, 0.06, 0.07);
  const accent = rgb(0.95, 0.75, 0.22);
  const muted = rgb(0.35, 0.37, 0.4);
  const line = rgb(0.82, 0.84, 0.86);
  const specs = input.item.rawSpecs || {};
  const buyLink = buildWebAppBuyLink(input.botUsername, input.item.id);

  page.drawRectangle({ x: 0, y: height - 92, width, height: 92, color: dark });
  page.drawText(input.brandName || input.slug, {
    x: 36,
    y: height - 42,
    size: 20,
    font,
    color: rgb(1, 1, 1),
  });
  page.drawText("Карточка байка для печати / sale handoff", {
    x: 36,
    y: height - 66,
    size: 10,
    font,
    color: accent,
  });

  page.drawText(input.item.title, { x: 36, y: height - 130, size: 24, font, color: dark });
  page.drawText(`ID: ${input.item.id}`, { x: 36, y: height - 152, size: 10, font, color: muted });
  page.drawText(`Цена: ${formatRub(input.item.salePrice || Number(specs.price_rub || specs.sale_price || 0))}`, {
    x: 36,
    y: height - 180,
    size: 16,
    font,
    color: dark,
  });
  page.drawText(`Статус: ${input.item.availabilityLabel || "уточнить у оператора"}`, {
    x: 36,
    y: height - 204,
    size: 11,
    font,
    color: muted,
  });

  const hero = await embedImage(pdfDoc, input.item.imageUrl);
  if (hero) {
    page.drawImage(hero, { x: 330, y: height - 300, width: 220, height: 165 });
  } else {
    page.drawRectangle({ x: 330, y: height - 300, width: 220, height: 165, borderColor: line, borderWidth: 1 });
    page.drawText("Фото недоступно", { x: 390, y: height - 220, size: 11, font, color: muted });
  }

  const qrBytes = await fetch(
    `https://api.qrserver.com/v1/create-qr-code/?size=420x420&data=${encodeURIComponent(buyLink)}&color=000000&bgcolor=ffffff&margin=1`,
  ).then((res) => res.arrayBuffer());
  const qr = await pdfDoc.embedPng(qrBytes);
  page.drawImage(qr, { x: 390, y: 72, width: 135, height: 135 });
  page.drawText("Скан → Telegram WebApp", { x: 382, y: 52, size: 9, font, color: muted });

  const desc = input.item.description || "Описание не заполнено.";
  const wrappedDesc = desc.match(/.{1,78}(?:\s|$)/g)?.slice(0, 5) || [desc];
  let y = height - 245;
  page.drawText("Описание", { x: 36, y, size: 13, font, color: dark });
  y -= 20;
  wrappedDesc.forEach((lineText) => {
    page.drawText(lineText.trim(), { x: 36, y, size: 10, font, color: muted });
    y -= 14;
  });

  y -= 12;
  page.drawText("Характеристики", { x: 36, y, size: 13, font, color: dark });
  y -= 22;
  const rows = [
    ["Категория", readString(specs.category) || "—"],
    ["Мощность", readString(specs.power_kw || specs.motor_peak_kw) || "—"],
    ["Батарея", readString(specs.battery) || "—"],
    ["Запас хода", readString(specs.range_km) ? `${specs.range_km} км` : "—"],
    ["Вес", readString(specs.weight_kg) ? `${specs.weight_kg} кг` : "—"],
    ["Состояние", readString(specs.condition || specs.state) || "operator_checked"],
  ];
  rows.forEach(([label, value], index) => {
    const rowY = y - index * 28;
    page.drawRectangle({ x: 36, y: rowY - 8, width: 300, height: 24, borderColor: line, borderWidth: 0.5 });
    page.drawText(label, { x: 46, y: rowY, size: 8, font, color: muted });
    page.drawText(String(value), { x: 150, y: rowY, size: 10, font, color: dark });
  });

  page.drawRectangle({ x: 36, y: 76, width: 315, height: 88, color: rgb(0.98, 0.96, 0.88), borderColor: accent, borderWidth: 1 });
  page.drawText("Ссылка на карточку", { x: 52, y: 136, size: 11, font, color: dark });
  page.drawText(buyLink, { x: 52, y: 116, size: 8.5, font, color: dark });
  page.drawText("Распечатайте лист и прикрепите к байку / стойке продаж.", { x: 52, y: 94, size: 9, font, color: muted });

  page.drawText(`Generated: ${new Date().toLocaleString("ru-RU")}`, {
    x: 36,
    y: 32,
    size: 8,
    font,
    color: muted,
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
      brandName: crew.header.brandName || crew.name,
      botUsername: crew.contacts.telegramBotUsername,
      item: {
        id: item.id,
        title: item.title,
        description: item.description,
        imageUrl: item.imageUrl,
        salePrice: item.salePrice,
        pricePerDay: item.pricePerDay,
        availabilityLabel: item.availabilityLabel,
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
