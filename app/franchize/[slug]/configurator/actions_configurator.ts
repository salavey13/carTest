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

export async function loadConfiguratorCatalog(crewSlug?: string): Promise<{
  ebikes: ConfiguratorBike[];
  parts: ConfiguratorPart[];
  hasLiveEbikeData: boolean;
  hasLivePartsData: boolean;
  purchaseUrl: string;
}> {
  // CR-045: Resolve crew-specific purchase URL from crew-sensitive defaults.
  // Falls back to the original hardcoded @I_O_S_NN if no crew context or no override.
  let purchaseUrl = "https://t.me/I_O_S_NN";
  if (crewSlug) {
    try {
      const crewSensitive = await getCrewSensitiveDataOrDefault(crewSlug, { source: "loadConfiguratorCatalog" });
      const defaults = ((crewSensitive.contractDefaults ?? {}) as Record<string, unknown>).defaults as Record<string, unknown> | undefined;
      const fromDefaults =
        (typeof defaults?.purchase_url === "string" && defaults.purchase_url.trim()) ||
        (typeof defaults?.purchaseUrl === "string" && defaults.purchaseUrl.trim()) ||
        (typeof defaults?.purchase_telegram === "string" && defaults.purchase_telegram.trim()) ||
        (typeof defaults?.purchaseTelegram === "string" && defaults.purchaseTelegram.trim()) ||
        "";
      if (fromDefaults) {
        // If it's just a Telegram username (no protocol), normalise to t.me URL
        purchaseUrl = fromDefaults.startsWith("http") || fromDefaults.startsWith("@")
          ? (fromDefaults.startsWith("@") ? `https://t.me/${fromDefaults.slice(1)}` : fromDefaults)
          : (fromDefaults.startsWith("t.me/") ? `https://${fromDefaults}` : `https://t.me/${fromDefaults}`);
      }
    } catch (err) {
      logger.warn(`[configurator] failed to load purchase URL for crew ${crewSlug}`, err);
    }
  }

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
      purchaseUrl,
    };
  } catch (err) {
    logger.warn("[configurator] loadCatalog fell back", err);
    return {
      ebikes: fallbackBikes,
      parts: fallbackParts,
      hasLiveEbikeData: false,
      hasLivePartsData: false,
      purchaseUrl,
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
  .doc-container { max-width: 17cm; margin: 0 auto; font-family: Arial, 'Helvetica Neue', sans-serif; font-size: 11pt; line-height: 1.5; color: #18181b; }
  .doc-container p { max-width: 100%; overflow-wrap: break-word; }
  .config-hero { background: #0a0a0a; color: #fff; padding: 22pt 24pt; margin-bottom: 16pt; border-left: 4pt solid #00ffea; }
  .config-hero h1 { margin: 0; font-size: 20pt; font-weight: 900; }
  .config-hero .subtitle { font-size: 11pt; opacity: 0.78; margin-top: 6pt; }
  .config-hero .config-id { font-family: 'Courier New', monospace; font-size: 9.5pt; opacity: 0.55; margin-top: 12pt; padding-top: 8pt; border-top: 1pt solid #333333; }
  .section-title { font-size: 11pt; font-weight: 800; letter-spacing: 0.04em; text-transform: uppercase; margin: 16pt 0 8pt 0; padding-bottom: 4pt; border-bottom: 1.5pt solid #0a0a0a; color: #0a0a0a; }
  table.spec-table { width: 100%; border-collapse: collapse; font-size: 10.5pt; }
  table.spec-table td { padding: 5pt 9pt; border: 0.5pt solid #d4d4d8; vertical-align: top; }
  table.spec-table tr:nth-child(even) td { background: #f7f7f8; }
  table.spec-table td.label { font-weight: 700; background: #f0f0f2; width: 38%; color: #18181b; }
  table.accessory-table { width: 100%; border-collapse: collapse; font-size: 10.5pt; }
  table.accessory-table th { background: #0a0a0a; color: #fff; padding: 6pt 9pt; text-align: left; font-weight: 700; font-size: 9.5pt; }
  table.accessory-table th.num-col { text-align: center; width: 14%; }
  table.accessory-table th.price-col { text-align: right; width: 22%; }
  table.accessory-table td { padding: 5pt 9pt; border: 0.5pt solid #d4d4d8; vertical-align: middle; }
  table.accessory-table td.num-cell { text-align: center; font-family: 'Courier New', monospace; font-size: 10pt; color: #52525b; }
  table.accessory-table td.price-cell { text-align: right; font-family: 'Courier New', monospace; font-weight: 600; color: #18181b; }
  table.accessory-table tr.empty-row td { text-align: center; font-style: italic; color: #71717a; padding: 10pt; }
  table.price-table { width: 100%; border-collapse: collapse; font-size: 11pt; }
  table.price-table td { padding: 6pt 10pt; border: 0.5pt solid #d4d4d8; }
  table.price-table td.price-label { color: #3f3f46; }
  table.price-table td.price-value { text-align: right; font-family: 'Courier New', monospace; font-weight: 600; color: #18181b; }
  table.price-table tr.delivery-row td { color: #6b7280; font-style: italic; }
  table.price-table tr.total-row td { background: #0a0a0a; color: #fff; font-weight: 800; font-size: 14pt; padding: 10pt; border-top: 2pt solid #0a0a0a; border-bottom: 2pt solid #0a0a0a; }
  table.price-table tr.total-row td.price-value { color: #00ffea; font-size: 16pt; }
  .validity-box { background: #fffbeb; border: 1pt solid #fcd34d; border-left: 4pt solid #f59e0b; padding: 9pt 12pt; margin-top: 14pt; font-size: 10pt; color: #78350f; }
  table.signature-table { width: 100%; border-collapse: collapse; margin-top: 26pt; table-layout: fixed; }
  table.signature-table td { width: 50%; padding: 0 14pt; vertical-align: bottom; }
  table.signature-table td .sig-line { border-top: 1pt solid #18181b; padding-top: 5pt; margin-top: 30pt; font-size: 9pt; color: #52525b; text-align: center; }
  table.signature-table td .sig-role { font-weight: 700; color: #18181b; }
  .doc-footer { margin-top: 22pt; padding-top: 9pt; border-top: 1pt solid #e4e4e7; font-size: 9pt; color: #71717a; text-align: center; line-height: 1.5; }
</style>
<div class="doc-container">
  <div class="config-hero">
    <h1>Конфигуратор электробайка</h1>
    <div class="subtitle">{{brand_name}} — спецификация и расчёт стоимости</div>
    <div class="config-id">№ {{config_id}} · {{config_date}} · {{config_timestamp}}</div>
  </div>
  <div class="section-title">Продавец</div>
  <table class="spec-table">
    <tr><td class="label">Компания</td><td>{{brand_name}}</td></tr>
    <tr><td class="label">Адрес выдачи</td><td>{{issuer_address}}</td></tr>
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
    <tr><td class="label">Цвет рамы</td><td>{{bike_color_label}}</td></tr>
    <tr><td class="label">Factory ID (код краски)</td><td>{{bike_color_factory_id}}</td></tr>
  </table>
  <div class="section-title">Дополнительные опции ({{accessories_count}} шт.)</div>
  <table class="accessory-table">
    <tr><th>Наименование</th><th class="num-col">Кол-во</th><th class="price-col">Цена</th></tr>
    {{accessories_table}}
  </table>
  <div class="section-title">Расчёт стоимости</div>
  <table class="price-table">
    <tr><td class="price-label">Базовая цена (без АКБ)</td><td class="price-value">{{base_price}}</td></tr>
    <tr><td class="price-label">Мотор (апгрейд)</td><td class="price-value">{{motor_price}}</td></tr>
    <tr><td class="price-label">Батарея</td><td class="price-value">{{battery_price}}</td></tr>
    <tr><td class="price-label">Дополнительные опции ({{accessories_count}} шт.)</td><td class="price-value">{{accessories_total}}</td></tr>
    <tr class="delivery-row"><td class="price-label">Доставка</td><td class="price-value">{{delivery_price}}</td></tr>
    <tr class="total-row"><td>ИТОГО</td><td class="price-value">{{total_price}}</td></tr>
  </table>
  <div class="validity-box"><strong>Срок действия предложения:</strong> 7 календарных дней с даты формирования (до {{valid_until}}). Финальная цена фиксируется в договоре купли-продажи.</div>
  <table class="signature-table">
    <tr>
      <td><div class="sig-line"><div class="sig-role">Продавец</div>{{issuer_representative}} · {{brand_name}}</div></td>
      <td><div class="sig-line"><div class="sig-role">Покупатель</div>{{client_name}}</div></td>
    </tr>
  </table>
  <div class="doc-footer">Документ сгенерирован автоматически конфигуратором {{brand_name}}.<br>Не является публичной офертой. Финальные условия определяются договором.<br>config #{{config_id}} · {{config_timestamp}}</div>
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
    // CR-002: Distinguish "file not found" (expected, info-level) from real errors
    // (permission denied, disk error, encoding error — warn-level so we see them).
    const code = (err as NodeJS.ErrnoException)?.code
    if (code === "ENOENT") {
      logger.info(`[configurator] no crew template at ${crewDocPath}, using inline fallback`)
    } else {
      logger.warn(`[configurator] failed to read crew template ${crewDocPath}: ${code ?? "unknown"} — using inline fallback`, err)
    }
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
  const fmtRub = (n: number) => `${fmt(n)} ₽`;

  // ── Resolve crew display name (not the URL slug) for brand_name in the DOCX ──
  // Falls back to slug capitalised if crew.name is missing.
  // Also fetches owner_id for recipient collection (reused later).
  const { data: crewRow } = await supabaseAdmin
    .from("crews")
    .select("name, slug, owner_id")
    .eq("slug", input.crewSlug)
    .maybeSingle();
  const crewDisplayName =
    (typeof crewRow?.name === "string" && crewRow.name.trim()) ||
    input.crewSlug
      .split("-")
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join(" ");

  // ── Resolve issuer fields with both snake_case and camelCase fallbacks ──
  // (CR-005: contractDefaults.defaults may use either convention depending on
  //  which onboarding flow created the crew. Try both before falling back.)
  const pickStr = (keys: string[], fallback: string) => {
    for (const k of keys) {
      const v = defaults[k];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
    return fallback;
  };

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

  // ── Validity: 7 days from now, formatted DD.MM.YYYY (Europe/Moscow timezone) ──
  const validUntil = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString("ru-RU", {
    timeZone: "Europe/Moscow",
  });

  // ── Battery label parsing (handles A4 "Included" + regular/lithium + "без батареи") ──
  // input.batteryLabel formats from ConfiguratorClient:
  //   "50Ah (regular)" / "60Ah (lithium)" / "без батареи" / "Included (lithium)" (A4)
  const label = input.batteryLabel || "";
  const isNoBattery = label.startsWith("без") || label.trim() === "";
  const isIncluded = label.toLowerCase().includes("included");
  const batteryType = isIncluded
    ? "Литиевая (в комплекте)"
    : label.includes("lithium")
      ? "Литиевая (Lithium)"
      : label.includes("regular")
        ? "Стандартная (Regular)"
        : "—";
  // capacity = first token before space, but "Included" / "без" → "—"
  const batteryCapacity = isNoBattery || isIncluded
    ? (isIncluded ? "в комплекте" : "—")
    : (label.split(" ")[0] || "—");

  // ── Build the variables map. All user-sourced strings are HTML-escaped. ──
  // Price variables include their own ₽ symbol so the template doesn't append one
  // (avoids "включена ₽" / "не требуется ₽" grammar bugs).
  const variables = {
    brand_name: escapeHtml(crewDisplayName),
    config_date: now.toLocaleDateString("ru-RU", { timeZone: "Europe/Moscow" }),
    config_id: configId,
    config_timestamp: now.toLocaleString("ru-RU", { timeZone: "Europe/Moscow" }),
    // CR-004: issuer_name removed — was computed but never referenced in any template.
    // issuer_representative already carries the human-readable contact name.
    issuer_address: escapeHtml(pickStr(["return_address", "returnAddress", "address"], "г. Нижний Новгород, Комсомольская пл. 2")),
    issuer_representative: escapeHtml(pickStr(["issuer_representative", "issuerRepresentative", "representative"], "Сидоров Илья")),
    issuer_phone: escapeHtml(pickStr(["phone", "issuerPhone"], "не указан")),
    issuer_telegram: escapeHtml(pickStr(["telegram", "issuerTelegram"], "не указан")),
    client_name: escapeHtml(input.userName || "не указано"),
    client_telegram_id: escapeHtml(input.userTelegramId || "не указано"),
    client_user_id: escapeHtml(input.userId || "—"),
    bike_make_model: escapeHtml(input.bikeLabel),
    motor_power: escapeHtml(input.motorLabel),
    battery_type: escapeHtml(batteryType),
    battery_capacity: escapeHtml(batteryCapacity),
    bike_color_label: escapeHtml(resolvedColor.label || 'Не указан'),
    bike_color_factory_id: escapeHtml(resolvedColorFactoryId),
    battery_range: escapeHtml(input.batteryRange || "—"),
    accessories_table: accessoriesTable,
    // CR-038: section title shows POSITION count ("3 шт." = 3 distinct items),
    // not total quantity (which could be 7 if user picked 3+2+2 of three items).
    accessories_count: String(input.selectedAccessories.length),
    accessories_total_qty: String(input.selectedAccessories.reduce((s, a) => s + (a.quantity > 0 ? a.quantity : 1), 0)),
    base_price: fmtRub(input.basePrice),
    motor_price: input.motorExtra > 0 ? `+${fmtRub(input.motorExtra)}` : "включена в базу",
    battery_price: input.batteryPrice > 0 ? `+${fmtRub(input.batteryPrice)}` : (isIncluded ? "включена в базу" : "—"),
    accessories_total: input.accessoriesTotal > 0 ? fmtRub(input.accessoriesTotal) : "—",
    delivery_price: input.withDelivery ? fmtRub(input.deliveryPrice) : "не требуется",
    total_price: fmtRub(input.total),
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

  // 3. Crew owner — reuses the crewRow fetched earlier for brand_name resolution
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
      : `Опции: ${input.selectedAccessories.length} поз. / ${totalAccessoriesQty} шт. (+${fmtRub(input.accessoriesTotal)})`;
    await notifyAdmin(
      [
        `⚡ Новая конфигурация #${configId}`,
        `Crew: ${input.crewSlug} (${crewDisplayName})`,
        `Клиент: ${input.userName}`,
        `TG ID: ${input.userTelegramId}`,
        `Модель: ${input.bikeLabel}`,
        `Мотор: ${input.motorLabel}`,
        `Батарея: ${batteryType} · ${batteryCapacity} · запас хода ${input.batteryRange || "—"} км`,
        `Цвет: ${resolvedColor.label} (${resolvedColorFactoryId})`,
        accessoriesLine,
        `Доставка: ${input.withDelivery ? `+${fmtRub(input.deliveryPrice)}` : "не требуется"}`,
        `Итого: ${fmtRub(input.total)}`,
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
      // CR-006: Distinguish "no recipients at all" from "all failed" from "some sent".
      // Was: 0 recipients → 0===0 false → "sent" (misleading — DOCX generated but delivered to nobody).
      send_status: recipientSet.size === 0
        ? "no_recipients"
        : failures.length === sendResults.length
          ? "failed"
          : "sent",
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
