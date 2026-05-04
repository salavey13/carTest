"use server";

import { supabaseAdmin } from "@/lib/supabase-server";
import { notifyAdmin, sendTelegramDocument } from "@/app/actions";
import { logger } from "@/lib/logger";
import { randomUUID } from "crypto";
import { getCrewSensitiveData } from "@/app/lib/private-secrets";
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

const CONFIGURATOR_DOC_TEMPLATE = `# ⚡ Конфигурация электробайка {{brand_name}}

**Дата:** {{config_date}}
**Номер конфигурации:** {{config_id}}

---

## 🏢 Информация о компании

| | |
|---|---|
| **Компания** | {{issuer_name}} |
| **Адрес** | {{issuer_address}} |
| **Контактное лицо** | {{issuer_representative}} |
| **Телефон** | {{issuer_phone}} |
| **Telegram** | {{issuer_telegram}} |

---

## 👤 Клиент

| | |
|---|---|
| **Имя** | {{client_name}} |
| **Telegram ID** | {{client_telegram_id}} |
| **ID пользователя** | {{client_user_id}} |

---

## 🏍️ Выбранная модель

| Параметр | Значение |
|----------|----------|
| **Модель** | {{bike_make_model}} |
| **Мощность мотора** | {{motor_power}} |
| **Тип батареи** | {{battery_type}} |
| **Цвет** | {{bike_color_label}} |
| **Factory ID (цвет)** | {{bike_color_factory_id}} |
| **Ёмкость батареи** | {{battery_capacity}} |
| **Запас хода** | {{battery_range}} км |

---

## 🔧 Дополнительные опции

{{accessories_table}}

---

## 💰 Расчёт стоимости

| Позиция | Сумма |
|---------|-------|
| Базовая цена (без АКБ) | {{base_price}} ₽ |
| Мотор (апгрейд) | {{motor_price}} ₽ |
| Батарея | {{battery_price}} ₽ |
| Дополнительные опции ({{accessories_count}} шт.) | {{accessories_total}} ₽ |
| Доставка | {{delivery_price}} ₽ |
| **ИТОГО** | **{{total_price}} ₽** |

---

*Документ сгенерирован автоматически конфигуратором {{brand_name}}*
*{{config_timestamp}}*
`;

// ─────────────────────────────────────────────
// Build DOCX + notify all recipients
// ─────────────────────────────────────────────

async function buildConfiguratorDocAndNotify(input: ConfiguratorLeadInput) {
  const configId = randomUUID().slice(0, 8);
  const now = new Date();
  const crewSensitive = await getCrewSensitiveData(input.crewSlug);
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
          .map((a) => `| ${a.name} | 1 шт. | ${fmt(a.price)} ₽ |`)
          .join("\n")
      : "| — | — | 0 ₽ |";

  const variables = {
    brand_name: input.crewSlug,
    config_date: now.toLocaleDateString("ru-RU"),
    config_id: configId,
    config_timestamp: now.toLocaleString("ru-RU"),
    issuer_name: String(defaults.issuerName ?? `Franchize ${input.crewSlug}`),
    issuer_address: String(defaults.return_address ?? "г. Нижний Новгород, Комсомольская пл. 2"),
    issuer_representative: String(defaults.issuer_representative ?? "Сидоров Илья"),
    issuer_phone: String(defaults.phone ?? "не указан"),
    issuer_telegram: String(defaults.telegram ?? "@oneBikePlsBot"),
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
    battery_range: "—",
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
