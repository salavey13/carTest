"use server";

import { supabaseAdmin } from "@/lib/supabase-server";
import { notifyAdmin, sendTelegramDocument } from "@/app/actions";
import { logger } from "@/lib/logger";
import { randomUUID } from "crypto";
import { readFile } from "fs/promises";
import { join } from "path";
import { getCrewSensitiveDataOrDefault } from "@/lib/private-secrets";
import { buildFranchizeDocxFromTemplate } from "@/app/franchize/lib/docx-capability";
import type {
  ConfiguratorLeadInput,
  ConfiguratorBike,
  ConfiguratorPart,
  ConfiguratorBatteryOption,
} from "./configurator-types";
import {
  fallbackBikes,
  fallbackParts,
  lithiumBatteries,
} from "./fallback-catalog";
import { DEFAULT_FACTORY_COLOR, FACTORY_COLORS, getFactoryColorById, getFactoryColorByFactoryId } from "./factory-colors";

// ─────────────────────────────────────────────
// Catalog loader
// ─────────────────────────────────────────────

export async function loadConfiguratorCatalog(): Promise<{
  ebikes: ConfiguratorBike[];
  parts: ConfiguratorPart[];
  hasLiveEbikeData: boolean;
  hasLivePartsData: boolean;
}> {
  try {
    const { data: ebikes, error: eErr } = await supabaseAdmin
      .from("cars")
      .select("id, make, model, description, image_url, daily_price, type, specs")
      .eq("type", "ebike")
      .order("daily_price", { ascending: true });

    const { data: parts, error: pErr } = await supabaseAdmin
      .from("cars")
      .select("id, make, model, description, image_url, daily_price, type, specs")
      .eq("type", "parts")
      .order("daily_price", { ascending: true });

    if (eErr) logger.warn("[configurator] ebike query failed", eErr.message);
    if (pErr) logger.warn("[configurator] parts query failed", pErr.message);

    return {
      ebikes: (ebikes as ConfiguratorBike[])?.length ? (ebikes as ConfiguratorBike[]) : fallbackBikes,
      parts: (parts as ConfiguratorPart[])?.length ? (parts as ConfiguratorPart[]) : fallbackParts,
      hasLiveEbikeData: Boolean(ebikes?.length),
      hasLivePartsData: Boolean(parts?.length),
    };
  } catch (err) {
    logger.warn("[configurator] loadCatalog fell back", err);
    return {
      ebikes: fallbackBikes,
      parts: fallbackParts,
      hasLiveEbikeData: false,
      hasLivePartsData: false,
    };
  }
}

// ─────────────────────────────────────────────
// Configurator DOCX template loader
// ─────────────────────────────────────────────
//
// Resolution order:
//   1. crew-sensitive stored template (docTemplates.configuratorTemplate) — fastest, per-crew override
//   2. docs/crewDocs/{slug}_CONFIGURATOR_DEAL_TEMPLATE.html — per-crew file on disk
//   3. CONFIGURATOR_DOC_FALLBACK (inline below) — last resort so the action never crashes
//
// The external HTML lives at docs/crewDocs/vip-bike_CONFIGURATOR_DEAL_TEMPLATE.html and is the
// single source of truth for visual layout. Keep the inline fallback in sync with it.

const CONFIGURATOR_DOC_FALLBACK = `<style>
  @page { size: A4; margin: 18mm 18mm 22mm 22mm; }
  .doc-container { max-width: 17cm; margin: 0 auto; font-family: 'Inter', 'Helvetica Neue', Arial, sans-serif; font-size: 11pt; line-height: 1.5; color: #18181b; }
  .doc-container p { max-width: 100%; overflow-wrap: break-word; }
  .config-hero { background: linear-gradient(135deg, #050507 0%, #0c1418 55%, #001f1c 100%); color: #fff; padding: 26pt 28pt; border-radius: 12pt; margin-bottom: 18pt; border: 1pt solid #1f2937; }
  .config-hero h1 { margin: 0; font-size: 22pt; font-weight: 900; }
  .config-hero .subtitle { font-size: 11pt; opacity: 0.78; margin-top: 6pt; }
  .config-hero .config-id { font-family: monospace; font-size: 9.5pt; opacity: 0.55; margin-top: 14pt; padding-top: 10pt; border-top: 1pt solid rgba(255,255,255,0.1); }
  .section-title { font-size: 11pt; font-weight: 800; letter-spacing: 0.04em; text-transform: uppercase; margin: 18pt 0 8pt 0; padding-bottom: 5pt; border-bottom: 1.5pt solid #0a0a0a; color: #0a0a0a; }
  table.spec-table { width: 100%; border-collapse: collapse; font-size: 10.5pt; }
  table.spec-table td { padding: 5pt 9pt; border: 0.5pt solid #d4d4d8; vertical-align: top; }
  table.spec-table tr:nth-child(even) td { background: #f7f7f8; }
  table.spec-table td.label { font-weight: 700; background: #f0f0f2 !important; width: 38%; color: #18181b; }
  table.accessory-table { width: 100%; border-collapse: collapse; font-size: 10.5pt; }
  table.accessory-table th { background: #0a0a0a; color: #fff; padding: 6pt 9pt; text-align: left; font-weight: 700; font-size: 9.5pt; }
  table.accessory-table td { padding: 5pt 9pt; border: 0.5pt solid #d4d4d8; }
  table.accessory-table td.price-cell { text-align: right; font-family: monospace; font-weight: 600; }
  table.price-table { width: 100%; border-collapse: collapse; font-size: 11pt; }
  table.price-table td { padding: 6pt 10pt; border: 0.5pt solid #d4d4d8; }
  table.price-table td.price-value { text-align: right; font-family: monospace; font-weight: 600; }
  table.price-table tr.total-row td { background: #0a0a0a; color: #fff; font-weight: 800; font-size: 14pt; padding: 10pt; }
  table.price-table tr.total-row td.price-value { color: #00ffea; font-size: 16pt; }
  .validity-box { background: #fffbeb; border: 1pt solid #fcd34d; border-left: 4pt solid #f59e0b; padding: 9pt 12pt; margin-top: 14pt; border-radius: 4pt; font-size: 10pt; color: #78350f; }
  .doc-footer { margin-top: 22pt; padding-top: 9pt; border-top: 1pt solid #e4e4e7; font-size: 9pt; color: #71717a; text-align: center; line-height: 1.5; }
</style>
<div class="doc-container">
  <div class="config-hero">
    <h1>⚡ Конфигуратор · {{brand_name}}</h1>
    <div class="subtitle">Спецификация электробайка и расчёт стоимости</div>
    <div class="config-id">№ {{config_id}} · {{config_date}} · {{config_timestamp}}</div>
  </div>
  <div class="section-title">Продавец</div>
  <table class="spec-table">
    <tr><td class="label">Компания</td><td>{{brand_name}}</td></tr>
    <tr><td class="label">Адрес</td><td>{{issuer_address}}</td></tr>
    <tr><td class="label">Контактное лицо</td><td>{{issuer_representative}}</td></tr>
    <tr><td class="label">Телефон</td><td>{{issuer_phone}}</td></tr>
    <tr><td class="label">Telegram</td><td>{{issuer_telegram}}</td></tr>
  </table>
  <div class="section-title">Покупатель</div>
  <table class="spec-table">
    <tr><td class="label">Имя</td><td>{{client_name}}</td></tr>
    <tr><td class="label">Telegram ID</td><td>{{client_telegram_id}}</td></tr>
    <tr><td class="label">ID пользователя</td><td>{{client_user_id}}</td></tr>
  </table>
  <div class="section-title">Выбранная модель</div>
  <table class="spec-table">
    <tr><td class="label">Модель</td><td>{{bike_make_model}}</td></tr>
    <tr><td class="label">Мощность мотора</td><td>{{motor_power}}</td></tr>
    <tr><td class="label">Тип батареи</td><td>{{battery_type}}</td></tr>
    <tr><td class="label">Ёмкость батареи</td><td>{{battery_capacity}}</td></tr>
    <tr><td class="label">Запас хода</td><td>{{battery_range}} км</td></tr>
    <tr><td class="label">Цвет</td><td>{{bike_color_label}}</td></tr>
    <tr><td class="label">Factory ID</td><td>{{bike_color_factory_id}}</td></tr>
  </table>
  <div class="section-title">Дополнительные опции ({{accessories_count}} шт.)</div>
  <table class="accessory-table">
    <tr><th>Наименование</th><th>Кол-во</th><th>Цена</th></tr>
    {{accessories_table}}
  </table>
  <div class="section-title">Расчёт стоимости</div>
  <table class="price-table">
    <tr><td>Базовая цена (без АКБ)</td><td class="price-value">{{base_price}} ₽</td></tr>
    <tr><td>Мотор (апгрейд)</td><td class="price-value">{{motor_price}} ₽</td></tr>
    <tr><td>Батарея</td><td class="price-value">{{battery_price}} ₽</td></tr>
    <tr><td>Дополнительные опции ({{accessories_count}} шт.)</td><td class="price-value">{{accessories_total}} ₽</td></tr>
    <tr><td>Доставка</td><td class="price-value">{{delivery_price}}</td></tr>
    <tr class="total-row"><td>ИТОГО</td><td class="price-value">{{total_price}} ₽</td></tr>
  </table>
  <div class="validity-box"><strong>⏱ Срок действия предложения:</strong> 7 календарных дней с даты формирования (до {{valid_until}}).</div>
  <div class="doc-footer">Документ сгенерирован автоматически конфигуратором {{brand_name}}.<br>Не является публичной офертой.<br>config #{{config_id}} · {{config_timestamp}}</div>
</div>
`

function escapeHtml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

async function loadConfiguratorTemplate(crewSlug: string, secureTemplate: string): Promise<string> {
  // 1. crew-sensitive stored template wins immediately
  if (typeof secureTemplate === "string" && secureTemplate.trim().length > 0) {
    return secureTemplate
  }
  // 2. per-crew file on disk (docs/crewDocs/{slug}_CONFIGURATOR_DEAL_TEMPLATE.html)
  const crewDocPath = join(process.cwd(), "docs", "crewDocs", `${crewSlug}_CONFIGURATOR_DEAL_TEMPLATE.html`)
  try {
    const fileTemplate = await readFile(crewDocPath, "utf8")
    if (fileTemplate.trim().length > 0) {
      logger.info(`[configurator] using crew-specific template: ${crewDocPath}`)
      return fileTemplate
    }
  } catch (err) {
    logger.info(`[configurator] no crew template at ${crewDocPath}, using inline fallback`)
  }
  // 3. inline fallback (always available, never throws)
  return CONFIGURATOR_DOC_FALLBACK
}

// ─────────────────────────────────────────────
// Build DOCX + notify all recipients
// ─────────────────────────────────────────────

async function buildConfiguratorDocAndNotify(input: ConfiguratorLeadInput) {
  const configId = randomUUID().slice(0, 8);
  const now = new Date();
  const crewSensitive = await getCrewSensitiveDataOrDefault(input.crewSlug, { source: "buildConfiguratorDocAndNotify" });
  const contractDefaults = (crewSensitive.contractDefaults ?? {}) as Record<string, unknown>;
  const defaults = ((contractDefaults.defaults ?? {}) as Record<string, unknown>);
  const docTemplates = (crewSensitive.docTemplates ?? {}) as Record<string, unknown>;
  const secureTemplate = typeof docTemplates.configuratorTemplate === "string" ? docTemplates.configuratorTemplate : "";

  const fmt = (n: number) => n.toLocaleString("ru-RU");

  const fallbackColor = DEFAULT_FACTORY_COLOR ?? FACTORY_COLORS[0] ?? { id: 'unknown', factoryId: 'UNKNOWN-FACTORY-COLOR', label: 'Не указан' };
  const resolvedColor =
    getFactoryColorById(input.selectedColorId) ??
    getFactoryColorByFactoryId(input.selectedColorFactoryId) ??
    FACTORY_COLORS.find((c) => c.factoryId === input.selectedColorFactoryId) ??
    fallbackColor;
  const resolvedColorFactoryId =
    resolvedColor.factoryId?.trim() || input.selectedColorFactoryId?.trim() || 'UNKNOWN-FACTORY-COLOR';

  // ── Build accessories table rows matching the polished template's CSS classes ──
  const accessoriesTable =
    input.selectedAccessories.length > 0
      ? input.selectedAccessories
          .map((a) => {
            const qty = a.quantity > 0 ? a.quantity : 1
            const unitPrice = qty > 0 ? Math.round(a.price / qty) : a.price
            const qtyLabel = qty > 1 ? `${qty} шт.` : '1 шт.'
            const priceCell = qty > 1 ? `${fmt(unitPrice)} × ${qty} = ${fmt(a.price)} ₽` : `${fmt(a.price)} ₽`
            return `<tr><td>${escapeHtml(a.name)}</td><td class="num-cell">${qtyLabel}</td><td class="price-cell">${priceCell}</td></tr>`
          })
          .join("\n")
      : `<tr class="empty-row"><td colspan="3">Дополнительные опции не выбраны</td></tr>`;

  // ── Validity: 7 days from now, formatted DD.MM.YYYY ──
  const validUntil = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString("ru-RU");

  const variables = {
    brand_name: input.crewSlug,
    config_date: now.toLocaleDateString("ru-RU"),
    config_id: configId,
    config_timestamp: now.toLocaleString("ru-RU"),
    issuer_name: String(defaults.issuerName ?? `Franchize ${input.crewSlug}`),
    issuer_address: String(defaults.return_address ?? "г. Нижний Новгород, Комсомольская пл. 2"),
    issuer_representative: String(defaults.issuer_representative ?? "Сидоров Илья"),
    issuer_phone: String(defaults.phone ?? "не указан"),
    issuer_telegram: String(defaults.telegram ?? ""),
    client_name: input.userName || "не указано",
    client_telegram_id: input.userTelegramId || "не указано",
    client_user_id: input.userId || "—",
    bike_make_model: input.bikeLabel,
    motor_power: input.motorLabel,
    battery_type: input.batteryLabel.includes("lithium")
      ? "Литиевая (Lithium)"
      : input.batteryLabel.includes("regular")
        ? "Стандартная (Regular)"
        : input.batteryLabel || "—",
    battery_capacity: input.batteryLabel.split(" ")[0] || "—",
    bike_color_label: resolvedColor.label || 'Не указан',
    bike_color_factory_id: resolvedColorFactoryId,
    battery_range: input.batteryRange || "—",
    accessories_table: accessoriesTable,
    accessories_count: String(input.selectedAccessories.reduce((s, a) => s + (a.quantity > 0 ? a.quantity : 1), 0)),
    base_price: fmt(input.basePrice),
    motor_price: input.motorExtra > 0 ? `+${fmt(input.motorExtra)}` : "включена",
    battery_price: input.batteryPrice > 0 ? `+${fmt(input.batteryPrice)}` : "включена",
    accessories_total: input.accessoriesTotal > 0 ? fmt(input.accessoriesTotal) : "0",
    delivery_price: input.withDelivery ? fmt(input.deliveryPrice) : "не требуется",
    total_price: fmt(input.total),
    valid_until: validUntil,
  };

  const docFileName = `vipbike-config-${input.crewSlug}-${configId}.docx`;
  const template = await loadConfiguratorTemplate(input.crewSlug, secureTemplate);
  const { bytes } = await buildFranchizeDocxFromTemplate({
    integrationScope: "franchize-configurator",
    uploadedBy: "franchize-configurator",
    fileName: docFileName,
    documentKey: `configurator-${input.crewSlug}-${configId}`,
    template,
    variables,
  });

  // ── Collect recipient Telegram IDs ──

  const recipientSet = new Set<string>();

  // 1. Admin
  const adminChatId = process.env.ADMIN_CHAT_ID;
  if (adminChatId) recipientSet.add(adminChatId);

  // 2. The user who configured
  if (input.userTelegramId) recipientSet.add(input.userTelegramId);

  // 3. Crew owner
  const { data: crewRow } = await supabaseAdmin
    .from("crews")
    .select("owner_id")
    .eq("slug", input.crewSlug)
    .maybeSingle();

  const ownerId = typeof crewRow?.owner_id === "string" ? crewRow.owner_id : "";
  if (ownerId) {
    const { data: ownerUser } = await supabaseAdmin
      .from("users")
      .select("metadata")
      .eq("user_id", ownerId)
      .maybeSingle();
    const ownerMeta = (ownerUser?.metadata ?? {}) as Record<string, unknown>;
    const ownerTgId = String(
      ownerMeta.telegram_id ?? ownerMeta.telegramId ?? ""
    ).trim();
    if (ownerTgId) recipientSet.add(ownerTgId);
  }

  // ── Notify admin via text message ──

  if (adminChatId) {
    const totalAccessoriesQty = input.selectedAccessories.reduce((s, a) => s + (a.quantity > 0 ? a.quantity : 1), 0);
    const accessoriesLine = input.selectedAccessories.length === 0
      ? "Опции: нет"
      : `Опции: ${input.selectedAccessories.length} поз. / ${totalAccessoriesQty} шт. (+${fmt(input.accessoriesTotal)} ₽)`;
    await notifyAdmin(
      [
        `⚡ Новая конфигурация #${configId}`,
        `Crew: ${input.crewSlug}`,
        `Клиент: ${input.userName}`,
        `TG ID: ${input.userTelegramId}`,
        `Модель: ${input.bikeLabel}`,
        `Мотор: ${input.motorLabel}`,
        `Батарея: ${input.batteryLabel} · запас хода ${input.batteryRange} км`,
        `Цвет: ${resolvedColor.label} (${resolvedColorFactoryId})`,
        accessoriesLine,
        `Доставка: ${input.withDelivery ? `+${fmt(input.deliveryPrice)} ₽` : "не требуется"}`,
        `Итого: ${fmt(input.total)} ₽`,
        `Срок действия: до ${validUntil}`,
      ].join("\n")
    ).catch((e) => logger.warn("[configurator] notifyAdmin failed", e));
  }

  // ── Send DOCX to all recipients ──

  const blob = new Blob([bytes], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });

  const sendResults: Array<{ id: string; ok: boolean; error?: string }> = [];

  for (const tgId of recipientSet) {
    try {
      const res = await sendTelegramDocument(tgId, blob, docFileName);
      sendResults.push({ id: tgId, ok: res.success, error: res.error });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "send failed";
      sendResults.push({ id: tgId, ok: false, error: msg });
    }
  }

  const failures = sendResults.filter((r) => !r.ok);
  if (failures.length > 0) {
    logger.warn("[configurator] some recipients failed", failures);
    // Don't throw — admin text notification likely went through
  }

  // ── Persist to log table (reuse franchize table for simplicity) ──

  try {
    await supabaseAdmin.from("franchize_order_notifications").insert({
      slug: input.crewSlug,
      order_id: configId,
      payload: {
        ...input,
        configId,
        sentTo: sendResults.map((r) => ({ tgId: r.id, ok: r.ok })),
        persistedAt: now.toISOString(),
      },
      send_status: failures.length === sendResults.length ? "failed" : "sent",
      attempts: 1,
      doc_file_name: docFileName,
    });
  } catch (e) {
    logger.warn("[configurator] log insert failed", e);
  }

  return { configId, docFileName, sentTo: recipientSet.size };
}

// ─────────────────────────────────────────────
// Public action
// ─────────────────────────────────────────────

export async function sendConfiguratorLead(
  input: ConfiguratorLeadInput
): Promise<{ success: boolean; error?: string }> {
  try {
    await buildConfiguratorDocAndNotify(input);
    return { success: true };
  } catch (error) {
    logger.error("[configurator] sendConfiguratorLead failed", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
