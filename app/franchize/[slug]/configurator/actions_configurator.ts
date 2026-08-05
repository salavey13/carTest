"use server";

import { supabaseAdmin } from "@/lib/supabase-server";
import { notifyAdmin, sendTelegramDocument } from "@/app/actions";
import { logger } from "@/lib/logger";
import { randomUUID } from "crypto";
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
import { DEFAULT_FACTORY_COLOR, FACTORY_COLORS, getFactoryColorById } from "./factory-colors";

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
// Configurator DOCX template
// ─────────────────────────────────────────────

const CONFIGURATOR_DOC_TEMPLATE = `<style>
  @page { size: A4; margin: 20mm 20mm 25mm 25mm; }
  .doc-container { max-width: 17cm; margin: 0 auto; }
  .doc-container p { max-width: 100%; overflow-wrap: break-word; }
  .spec-table td { padding: 4pt 8pt; }
  .spec-table tr:nth-child(even) td { background: #f8f8f8; }
  .price-table td { padding: 4pt 8pt; }
  .price-table .total td { font-weight: bold; font-size: 14pt; border-top: 2px solid #333; }
  .config-header { background: linear-gradient(135deg, #0a0a0a 0%, #1a2a2a 100%); color: #fff; padding: 20pt; border-radius: 8pt; margin-bottom: 16pt; }
  .config-header h1 { margin: 0; font-size: 18pt; }
  .config-header .subtitle { font-size: 11pt; opacity: 0.8; margin-top: 4pt; }
  .config-id { font-family: monospace; font-size: 10pt; opacity: 0.6; margin-top: 8pt; }
  .section-title { font-size: 13pt; font-weight: bold; margin: 16pt 0 8pt 0; padding-bottom: 4pt; border-bottom: 1px solid #ccc; }
  .accent { color: #00b894; }
  .accessory-row td { padding: 3pt 8pt; }
</style>
<div class="doc-container" style="font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.5; color: #000;">

<!-- Header with branding -->
<div class="config-header">
  <h1>⚡ Конфигурация электробайка {{brand_name}}</h1>
  <div class="subtitle">Спецификация и расчёт стоимости</div>
  <div class="config-id">№ {{config_id}} · {{config_date}} · {{config_timestamp}}</div>
</div>

<!-- Quick info box -->
<table style="width: 100%; border: 2px solid #333; margin-top: 12pt; margin-bottom: 12pt; font-size: 11pt;" class="spec-table">
<tr><td style="border: 1px solid #999; padding: 4pt 8pt; font-weight: bold; background: #f0f0f0;" colspan="2">📋 КРАТКАЯ ИНФОРМАЦИЯ</td></tr>
<tr><td style="border: 1px solid #999; padding: 3pt 8pt; width: 40%; font-weight: bold;">Компания:</td><td style="border: 1px solid #999; padding: 3pt 8pt;">{{brand_name}}</td></tr>
<tr><td style="border: 1px solid #999; padding: 3pt 8pt; font-weight: bold;">Адрес:</td><td style="border: 1px solid #999; padding: 3pt 8pt;">{{issuer_address}}</td></tr>
<tr><td style="border: 1px solid #999; padding: 3pt 8pt; font-weight: bold;">Контактное лицо:</td><td style="border: 1px solid #999; padding: 3pt 8pt;">{{issuer_representative}}</td></tr>
<tr><td style="border: 1px solid #999; padding: 3pt 8pt; font-weight: bold;">Телефон:</td><td style="border: 1px solid #999; padding: 3pt 8pt;">{{issuer_phone}}</td></tr>
<tr><td style="border: 1px solid #999; padding: 3pt 8pt; font-weight: bold;">Telegram:</td><td style="border: 1px solid #999; padding: 3pt 8pt;">{{issuer_telegram}}</td></tr>
</table>

<!-- Client info -->
<div class="section-title">👤 Клиент</div>
<table style="width: 100%; border: 1px solid #ccc; font-size: 11pt;" class="spec-table">
<tr><td style="border: 1px solid #999; padding: 3pt 8pt; width: 40%; font-weight: bold;">Имя:</td><td style="border: 1px solid #999; padding: 3pt 8pt;">{{client_name}}</td></tr>
<tr><td style="border: 1px solid #999; padding: 3pt 8pt; font-weight: bold;">Telegram ID:</td><td style="border: 1px solid #999; padding: 3pt 8pt;">{{client_telegram_id}}</td></tr>
<tr><td style="border: 1px solid #999; padding: 3pt 8pt; font-weight: bold;">ID пользователя:</td><td style="border: 1px solid #999; padding: 3pt 8pt;">{{client_user_id}}</td></tr>
</table>

<!-- Selected model -->
<div class="section-title">🏍️ Выбранная модель</div>
<table style="width: 100%; border: 1px solid #ccc; font-size: 11pt;" class="spec-table">
<tr><td style="border: 1px solid #999; padding: 3pt 8pt; width: 40%; font-weight: bold;">Модель:</td><td style="border: 1px solid #999; padding: 3pt 8pt;">{{bike_make_model}}</td></tr>
<tr><td style="border: 1px solid #999; padding: 3pt 8pt; font-weight: bold;">Мощность мотора:</td><td style="border: 1px solid #999; padding: 3pt 8pt;"><span class="accent">{{motor_power}}</span></td></tr>
<tr><td style="border: 1px solid #999; padding: 3pt 8pt; font-weight: bold;">Тип батареи:</td><td style="border: 1px solid #999; padding: 3pt 8pt;">{{battery_type}}</td></tr>
<tr><td style="border: 1px solid #999; padding: 3pt 8pt; font-weight: bold;">Ёмкость батареи:</td><td style="border: 1px solid #999; padding: 3pt 8pt;">{{battery_capacity}}</td></tr>
<tr><td style="border: 1px solid #999; padding: 3pt 8pt; font-weight: bold;">Запас хода:</td><td style="border: 1px solid #999; padding: 3pt 8pt;">{{battery_range}}</td></tr>
<tr><td style="border: 1px solid #999; padding: 3pt 8pt; font-weight: bold;">Цвет:</td><td style="border: 1px solid #999; padding: 3pt 8pt;">{{bike_color_label}}</td></tr>
<tr><td style="border: 1px solid #999; padding: 3pt 8pt; font-weight: bold;">Factory ID (цвет):</td><td style="border: 1px solid #999; padding: 3pt 8pt; font-family: monospace; font-size: 10pt;">{{bike_color_factory_id}}</td></tr>
</table>

<!-- Accessories -->
<div class="section-title">🔧 Дополнительные опции ({{accessories_count}} шт.)</div>
<table style="width: 100%; border: 1px solid #ccc; font-size: 11pt;" class="accessory-row">
<tr style="background: #f0f0f0;"><td style="border: 1px solid #999; padding: 3pt 8pt; font-weight: bold;">Наименование</td><td style="border: 1px solid #999; padding: 3pt 8pt; font-weight: bold; text-align: center;">Кол-во</td><td style="border: 1px solid #999; padding: 3pt 8pt; font-weight: bold; text-align: right;">Цена</td></tr>
{{accessories_table}}
</table>

<!-- Price breakdown -->
<div class="section-title">💰 Расчёт стоимости</div>
<table style="width: 100%; border: 1px solid #ccc; font-size: 12pt;" class="price-table">
<tr><td style="border: 1px solid #999; padding: 4pt 8pt;">Базовая цена (без АКБ)</td><td style="border: 1px solid #999; padding: 4pt 8pt; text-align: right;">{{base_price}} ₽</td></tr>
<tr><td style="border: 1px solid #999; padding: 4pt 8pt;">Мотор (апгрейд)</td><td style="border: 1px solid #999; padding: 4pt 8pt; text-align: right;">{{motor_price}} ₽</td></tr>
<tr><td style="border: 1px solid #999; padding: 4pt 8pt;">Батарея</td><td style="border: 1px solid #999; padding: 4pt 8pt; text-align: right;">{{battery_price}} ₽</td></tr>
<tr><td style="border: 1px solid #999; padding: 4pt 8pt;">Дополнительные опции ({{accessories_count}} шт.)</td><td style="border: 1px solid #999; padding: 4pt 8pt; text-align: right;">{{accessories_total}} ₽</td></tr>
<tr><td style="border: 1px solid #999; padding: 4pt 8pt;">Доставка</td><td style="border: 1px solid #999; padding: 4pt 8pt; text-align: right;">{{delivery_price}} ₽</td></tr>
<tr class="total"><td style="border: 2px solid #333; padding: 6pt 8pt;">ИТОГО</td><td style="border: 2px solid #333; padding: 6pt 8pt; text-align: right;" class="accent">{{total_price}} ₽</td></tr>
</table>

<!-- Footer -->
<p style="margin-top: 24pt; font-size: 10pt; color: #666; border-top: 1px solid #ccc; padding-top: 8pt;">
Документ сгенерирован автоматически конфигуратором {{brand_name}}.<br>
{{config_timestamp}}<br>
Конфигурация № {{config_id}}
</p>

</div>
`

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
    FACTORY_COLORS.find((c) => c.factoryId === input.selectedColorFactoryId) ??
    fallbackColor;
  const resolvedColorFactoryId =
    resolvedColor.factoryId?.trim() || input.selectedColorFactoryId?.trim() || 'UNKNOWN-FACTORY-COLOR';

  const accessoriesTable =
    input.selectedAccessories.length > 0
      ? input.selectedAccessories
          .map((a) => `<tr><td style="border: 1px solid #999; padding: 3pt 8pt;">${a.name}</td><td style="border: 1px solid #999; padding: 3pt 8pt; text-align: center;">1 шт.</td><td style="border: 1px solid #999; padding: 3pt 8pt; text-align: right;">${fmt(a.price)} ₽</td></tr>`)
          .join("\n")
      : `<tr><td style="border: 1px solid #999; padding: 3pt 8pt;" colspan="3">Дополнительные опции не выбраны</td></tr>`;

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
    accessories_count: String(input.selectedAccessories.length),
    base_price: fmt(input.basePrice),
    motor_price: input.motorExtra > 0 ? `+${fmt(input.motorExtra)}` : "включена",
    battery_price: input.batteryPrice > 0 ? `+${fmt(input.batteryPrice)}` : "включена",
    accessories_total: input.accessoriesTotal > 0 ? fmt(input.accessoriesTotal) : "0",
    delivery_price: input.withDelivery ? fmt(input.deliveryPrice) : "не требуется",
    total_price: fmt(input.total),
  };

  const docFileName = `vipbike-config-${input.crewSlug}-${configId}.docx`;
  const { bytes } = await buildFranchizeDocxFromTemplate({
    integrationScope: "franchize-configurator",
    uploadedBy: "franchize-configurator",
    fileName: docFileName,
    documentKey: `configurator-${input.crewSlug}-${configId}`,
    template: secureTemplate.trim().length > 0 ? secureTemplate : CONFIGURATOR_DOC_TEMPLATE,
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
    await notifyAdmin(
      [
        `⚡ Новая конфигурация #${configId}`,
        `Crew: ${input.crewSlug}`,
        `Клиент: ${input.userName}`,
        `TG ID: ${input.userTelegramId}`,
        `Модель: ${input.bikeLabel}`,
        `Мотор: ${input.motorLabel}`,
        `Батарея: ${input.batteryLabel}`,
        `Цвет: ${resolvedColor.label} (${resolvedColorFactoryId})`,
        `Опции: ${input.selectedAccessories.length} шт.`,
        `Итого: ${fmt(input.total)} ₽`,
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
