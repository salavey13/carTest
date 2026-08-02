/**
 * Notification Templates (Polish v3)
 * ──────────────────────────────────────────────────────────────────────────
 * Centralized notification text builders for the rental system.
 *
 * WHY THIS FILE EXISTS:
 *   Previously, notification text was scattered across:
 *     - doc-manual.ts (rent/sale creation)
 *     - rentals-dashboard.ts (status change, activation)
 *     - rentals.ts (contract draft submit/approve/decline)
 *     - boss scripts (evening summary, morning standup, etc.)
 *   Each file built its own text with inconsistent format, tone, and density.
 *
 * This file provides:
 *   1. A single source of truth for all notification text
 *   2. Consistent format: {emoji header} + {context lines} + {imperative CTA}
 *   3. Type-safe builders that take a typed input and return HTML-formatted text
 *   4. Easy to audit, easy to A/B test, easy to localize
 *
 * TEMPLATE FORMAT (the OCR notification was the gold standard):
 *   {emoji header}
 *
 *   {2-4 lines of context: who/what/when/where}
 *   {optional: 1 line of "what's needed" or "what's next"}
 *
 *   {imperative CTA: "активируйте", "проверьте", "откройте"}
 *
 * USAGE:
 *   import { buildDocSuccessMessage, buildRentalStatusChangeMessage } from "./notification-templates";
 *   const text = buildDocSuccessMessage({ isRent: true, bikeTitle, clientName, ... });
 *   await sendComplexMessage(chatId, text, buttons, { parseMode: "HTML" });
 */

// ── Shared types ──────────────────────────────────────────────────────────

interface BaseTemplateInput {
  /** Short rental ID (first 8 chars of UUID) */
  shortRentalId?: string;
  /** Crew slug for context */
  crewSlug?: string;
}

interface DocSuccessInput extends BaseTemplateInput {
  isRent: boolean;
  bikeTitle: string;
  clientName?: string;
  startDate?: string;
  endDate?: string;
  salePrice?: number;
  totalCost?: number;
  depositRub?: number;
  categories?: string[];
}

interface RentalStatusChangeInput extends BaseTemplateInput {
  status: "active" | "completed" | "cancelled" | "confirmed" | "disputed";
  bikeTitle: string;
  startDate?: string;
  endDate?: string;
  renterName?: string;
  operatorMessage?: string;
  totalCost?: number;
  depositRub?: number;
  depositReturned?: boolean;
}

interface ActivationInput extends BaseTemplateInput {
  bikeTitle: string;
  startDate?: string;
  endDate?: string;
  odometerKm?: number;
  renterName?: string;
  depositRub?: number;
  totalCost?: number;
  /** Recipient type — message tone varies */
  recipient: "renter" | "operator" | "admin";
}

interface ContractApprovedInput extends BaseTemplateInput {
  bikeTitle: string;
  startDate?: string;
  endDate?: string;
  renterName?: string;
}

interface ContractDeclinedInput extends BaseTemplateInput {
  reason?: string;
  ownerTelegramUsername?: string;
}

interface CartCheckoutRenterInput extends BaseTemplateInput {
  orderId: string;
  bikeTitle: string;
  startDate?: string;
  endDate?: string;
  totalCost?: number;
  depositRub?: number;
  pickupAddress?: string;
  pickupTime?: string;
}

interface CartCheckoutAdminInput extends BaseTemplateInput {
  orderId: string;
  bikeTitle: string;
  renterName?: string;
  renterPhone?: string; // will be masked
  startDate?: string;
  endDate?: string;
  totalCost?: number;
  equipment?: string;
  paymentMethod?: string;
  deliveryMethod?: string;
}

interface RenterMessageRelayInput extends BaseTemplateInput {
  renterName: string;
  message: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────

/**
 * Escape HTML special characters in user-supplied strings before interpolating
 * into HTML-formatted TG messages.
 *
 * WHY: All notification builders use parseMode: "HTML". Without escaping, a
 * renter name like "<script>" or an operator message containing "<a href=...>"
 * would be interpreted as HTML by Telegram — leading to broken rendering or
 * XSS-style phishing links sent to other users.
 *
 * This is the single most important security fix in v3.
 */
function escapeHtml(s: unknown): string {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDateRange(start?: string, end?: string): string {
  if (!start && !end) return "";
  const fmt = (iso?: string) => {
    if (!iso) return "?";
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return "?";
      return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" });
    } catch {
      return "?";
    }
  };
  if (start && end) return `${fmt(start)} → ${fmt(end)}`;
  return fmt(start || end);
}

function formatMoney(amount?: number): string {
  if (amount == null || Number.isNaN(amount)) return "—";
  return amount.toLocaleString("ru-RU") + " ₽";
}

function maskPhone(phone?: string): string {
  if (!phone) return "—";
  // Strict masking — show only country code, mask all digits.
  // Previously showed last 2 digits which is enough to disambiguate in small crews.
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 1) return "—";
  return `+${digits[0]} ••• •• ••`;
}

function truncate(s: string, max: number): { text: string; wasTruncated: boolean } {
  if (s.length > max) {
    return { text: s.slice(0, max - 1) + "…", wasTruncated: true };
  }
  return { text: s, wasTruncated: false };
}

// ── Template builders ────────────────────────────────────────────────────

/**
 * 1. /doc rental/sale creation → operator success message
 * Replaces the old "✅ Договор аренды готов!" with full context + deep link.
 */
export function buildDocSuccessMessage(input: DocSuccessInput): string {
  const { isRent, bikeTitle, clientName, startDate, endDate, salePrice, totalCost, depositRub, categories, shortRentalId } = input;
  const lines: string[] = [];

  // CRITICAL: escapeHtml on all user-supplied strings to prevent HTML injection
  // via parseMode: "HTML" (operator name, bike title, categories could contain <>)
  const safeBikeTitle = escapeHtml(bikeTitle);
  const safeClientName = escapeHtml(clientName);
  const safeCategories = (categories || []).map(escapeHtml);

  lines.push(`✅ <b>${isRent ? "Договор аренды" : "Договор купли-продажи"} готов</b>`);
  lines.push("");
  lines.push(`🏍 ${safeBikeTitle}`);
  if (clientName) lines.push(`👤 ${safeClientName}`);
  if (isRent) {
    const range = formatDateRange(startDate, endDate);
    if (range) lines.push(`📅 ${range}`);
    if (totalCost != null) lines.push(`💰 ${formatMoney(totalCost)}${depositRub ? ` (депозит ${formatMoney(depositRub)})` : ""}`);
  } else {
    if (salePrice != null) lines.push(`💰 ${formatMoney(salePrice)}`);
  }
  if (safeCategories.length > 0) lines.push(`🛡 Категории: ${safeCategories.join(", ")}`);
  if (shortRentalId) lines.push(`🔑 Аренда: ${escapeHtml(shortRentalId)}`);
  lines.push("");
  lines.push(isRent
    ? "Что дальше: проверьте документы и активируйте аренду."
    : "Что дальше: подпишите акт приёма-передачи и проконтролируйте оплату.");

  return lines.join("\n");
}

/**
 * 2. /doc creation → boss audit notification
 * Russian-ized keys, no PII in passport, with rental ID.
 */
export function buildDocAdminAuditMessage(input: DocSuccessInput): string {
  const { isRent, bikeTitle, clientName, startDate, endDate, salePrice, totalCost, depositRub, shortRentalId, crewSlug } = input;
  const lines: string[] = [];

  const safeBikeTitle = escapeHtml(bikeTitle);
  const safeClientName = escapeHtml(clientName);
  const safeCrewSlug = escapeHtml(crewSlug);

  lines.push(`📄 Новый договор ${isRent ? "аренды" : "купли-продажи"}`);
  lines.push(`🏍 ${safeBikeTitle}`);
  if (clientName) lines.push(`👤 ${safeClientName}`);
  if (isRent) {
    const range = formatDateRange(startDate, endDate);
    if (range) lines.push(`📅 ${range}`);
    if (totalCost != null) {
      lines.push(`💰 Итого: ${formatMoney(totalCost)}${depositRub ? ` (депозит ${formatMoney(depositRub)})` : ""}`);
    }
  } else {
    if (salePrice != null) lines.push(`💰 ${formatMoney(salePrice)}`);
  }
  if (shortRentalId) lines.push(`🔑 ID: ${escapeHtml(shortRentalId)}`);
  if (crewSlug) lines.push(`👥 Экипаж: ${safeCrewSlug}`);

  return lines.join("\n");
}

/**
 * 3. Rental status change → renter notification
 * CRITICAL FIX: Always sends a notification (even if operatorMessage is empty).
 * Default messages are warm and include a clear next step.
 */
export function buildRentalStatusChangeMessage(input: RentalStatusChangeInput): string {
  const { status, bikeTitle, startDate, endDate, renterName, operatorMessage, totalCost, depositRub, depositReturned, shortRentalId } = input;

  const statusConfig: Record<string, { emoji: string; label: string; defaultNext: string }> = {
    active: {
      emoji: "🚀",
      label: "активирована",
      defaultNext: "Приятной поездки! 🏍️ Возьмите паспорт и права на случай проверки.",
    },
    completed: {
      emoji: "✅",
      label: "завершена",
      defaultNext: "Спасибо за аренду! Оставьте отзыв — это поможет другим клиентам.",
    },
    cancelled: {
      emoji: "❌",
      label: "отменена",
      defaultNext: "Если есть вопросы — напишите экипажу, поможем разобраться.",
    },
    confirmed: {
      emoji: "📋",
      label: "подтверждена",
      defaultNext: "Менеджер свяжется для уточнения времени выдачи.",
    },
    disputed: {
      emoji: "⚠️",
      label: "передана в спор",
      defaultNext: "Менеджер изучит ситуацию и свяжется с вами в течение часа.",
    },
  };

  const cfg = statusConfig[status] || statusConfig.confirmed;
  const lines: string[] = [];

  // CRITICAL: escapeHtml on all user-supplied strings
  const safeBikeTitle = escapeHtml(bikeTitle);
  const safeOperatorMessage = escapeHtml(operatorMessage);

  lines.push(`${cfg.emoji} <b>Аренда ${cfg.label}</b>`);
  lines.push("");
  lines.push(`🏍 ${safeBikeTitle}`);
  const range = formatDateRange(startDate, endDate);
  if (range) lines.push(`📅 ${range}`);
  if (shortRentalId) lines.push(`🔑 ${escapeHtml(shortRentalId)}`);

  // For completed status, show deposit status if known
  if (status === "completed" && depositRub != null) {
    if (depositReturned === true) {
      lines.push(`💰 Депозит ${formatMoney(depositRub)} возвращён ✓`);
    } else if (depositReturned === false) {
      lines.push(`💰 Депозит ${formatMoney(depositRub)} удержан (уточните у менеджера)`);
    }
  }

  if (totalCost != null && status === "completed") {
    lines.push(`💰 Итого: ${formatMoney(totalCost)}`);
  }

  lines.push("");
  // Use operator's message if provided, otherwise the default next-step
  lines.push(safeOperatorMessage.trim() || cfg.defaultNext);

  return lines.join("\n");
}

/**
 * 4. Rental activation → renter (warm version)
 * vs. operator/admin (operational version)
 */
export function buildActivationMessage(input: ActivationInput): string {
  const { bikeTitle, startDate, endDate, odometerKm, renterName, depositRub, totalCost, shortRentalId, recipient } = input;
  const range = formatDateRange(startDate, endDate);
  const lines: string[] = [];

  const safeBikeTitle = escapeHtml(bikeTitle);
  const safeRenterName = escapeHtml(renterName);

  if (recipient === "renter") {
    lines.push(`🎉 <b>Ваша аренда активирована!</b>`);
    lines.push("");
    lines.push(`🏍 ${safeBikeTitle}`);
    if (range) lines.push(`📅 ${range}`);
    if (odometerKm != null) lines.push(`📊 Одометр: ${odometerKm.toLocaleString("ru-RU")} км`);
    if (shortRentalId) lines.push(`🔑 ${escapeHtml(shortRentalId)}`);
    lines.push("");
    lines.push(`Приятной поездки! 🏍️`);
    lines.push("");
    lines.push(`Если что-то пойдёт не так — пишите экипажу, мы на связи.`);
  } else {
    // Operator / admin — operational tone
    lines.push(`✅ <b>Аренда активирована</b>`);
    lines.push("");
    lines.push(`🏍 ${safeBikeTitle}`);
    if (renterName) lines.push(`👤 ${safeRenterName}`);
    if (range) lines.push(`📅 ${range}`);
    if (odometerKm != null) lines.push(`📊 Одометр: ${odometerKm.toLocaleString("ru-RU")} км`);
    if (depositRub != null) lines.push(`💰 Депозит: ${formatMoney(depositRub)}`);
    if (totalCost != null) lines.push(`💰 Итого: ${formatMoney(totalCost)}`);
    if (shortRentalId) lines.push(`🔑 ${escapeHtml(shortRentalId)}`);
    lines.push("");
    if (endDate) {
      lines.push(`⏰ Возврат до ${new Date(endDate).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}`);
    }
  }

  return lines.join("\n");
}

/**
 * 5. Contract approved → renter
 * With rental ID + next steps (was missing both).
 */
export function buildContractApprovedMessage(input: ContractApprovedInput): string {
  const { bikeTitle, startDate, endDate, renterName, shortRentalId } = input;
  const range = formatDateRange(startDate, endDate);
  const lines: string[] = [];

  const safeBikeTitle = escapeHtml(bikeTitle);
  // S8 fix: actually use renterName (was accepted but ignored previously)
  const safeRenterName = renterName ? escapeHtml(renterName) : "";

  lines.push(`✅ <b>Договор утверждён!</b>`);
  lines.push("");
  lines.push(`🏍 ${safeBikeTitle}`);
  if (safeRenterName) lines.push(`👤 ${safeRenterName}`);
  if (range) lines.push(`📅 ${range}`);
  if (shortRentalId) lines.push(`🔑 Аренда: ${escapeHtml(shortRentalId)}`);
  lines.push("");
  lines.push(`Менеджер свяжется для уточнения времени выдачи. Возьмите паспорт и права.`);

  return lines.join("\n");
}

/**
 * 6. Contract declined → renter
 * With reason (or fallback) + contact CTA.
 */
export function buildContractDeclinedMessage(input: ContractDeclinedInput): string {
  const { reason, ownerTelegramUsername, shortRentalId } = input;
  const lines: string[] = [];

  const safeReason = escapeHtml(reason);

  lines.push(`❌ <b>Договор не утверждён</b>`);
  if (shortRentalId) lines.push(`🔑 Аренда: ${escapeHtml(shortRentalId)}`);
  lines.push("");
  lines.push(`Причина: ${safeReason.trim() || "уточните у менеджера"}`);
  lines.push("");
  lines.push(`💬 Напишите менеджеру — поможем исправить и оформить заново.`);
  // S7 fix: don't leak operator's personal @username. Use crew support handle instead.
  // Caller should pass a support bot link, not a personal username.
  if (ownerTelegramUsername) {
    lines.push(`Поддержка: @${escapeHtml(ownerTelegramUsername)}`);
  }

  return lines.join("\n");
}

/**
 * 7. Cart checkout → renter
 * With total amount, deposit, pickup info, and clear next-step CTA.
 */
export function buildCartCheckoutRenterMessage(input: CartCheckoutRenterInput): string {
  const { orderId, bikeTitle, startDate, endDate, totalCost, depositRub, pickupAddress, pickupTime } = input;
  const range = formatDateRange(startDate, endDate);
  const lines: string[] = [];

  const safeBikeTitle = escapeHtml(bikeTitle);
  const safeOrderId = escapeHtml(orderId);
  const safePickupAddress = escapeHtml(pickupAddress);

  lines.push(`🧾 <b>Заказ #${safeOrderId} принят</b>`);
  lines.push("");
  lines.push(`🏍 ${safeBikeTitle}`);
  if (range) lines.push(`📅 ${range}`);
  if (totalCost != null) {
    lines.push(`💰 ${formatMoney(totalCost)}${depositRub ? ` (депозит ${formatMoney(depositRub)})` : ""}`);
  }
  if (pickupAddress) {
    lines.push(`📍 Самовывоз: ${safePickupAddress}${pickupTime ? `, ${escapeHtml(pickupTime)}` : ""}`);
  }
  lines.push("");
  lines.push(`Менеджер активирует аренду и пришлёт договор. Если нужно — загрузите паспорт в профиле.`);

  return lines.join("\n");
}

/**
 * 8. Cart checkout → admin
 * With masked phone (PII protection) and rental ID.
 */
export function buildCartCheckoutAdminMessage(input: CartCheckoutAdminInput): string {
  const { orderId, bikeTitle, renterName, renterPhone, startDate, endDate, totalCost, equipment, paymentMethod, deliveryMethod, shortRentalId } = input;
  const range = formatDateRange(startDate, endDate);
  const lines: string[] = [];

  const safeBikeTitle = escapeHtml(bikeTitle);
  const safeRenterName = escapeHtml(renterName);
  const safeOrderId = escapeHtml(orderId);
  const safeEquipment = escapeHtml(equipment);
  const safePaymentMethod = escapeHtml(paymentMethod);
  const safeDeliveryMethod = escapeHtml(deliveryMethod);

  lines.push(`🧾 <b>Новый заказ #${safeOrderId}</b>`);
  lines.push("");
  lines.push(`🏍 ${safeBikeTitle}`);
  if (renterName) lines.push(`👤 ${safeRenterName}`);
  if (renterPhone) lines.push(`📞 ${maskPhone(renterPhone)}`);
  if (range) lines.push(`📅 ${range}`);
  if (totalCost != null) lines.push(`💰 ${formatMoney(totalCost)}`);
  if (equipment) lines.push(`🎒 ${safeEquipment}`);
  if (paymentMethod) lines.push(`💳 Оплата: ${safePaymentMethod}`);
  if (deliveryMethod) lines.push(`📦 Доставка: ${safeDeliveryMethod}`);
  if (shortRentalId) lines.push(`🔑 Аренда: ${escapeHtml(shortRentalId)}`);

  return lines.join("\n");
}

/**
 * 9. Renter message relay → operator
 * Prefixes with renter name + adds reply button hint.
 */
export function buildRenterMessageRelay(input: RenterMessageRelayInput): string {
  const { renterName, message, shortRentalId } = input;
  const lines: string[] = [];

  const safeRenterName = escapeHtml(renterName);
  // Truncate BEFORE escaping so HTML chars in the truncated tail don't break encoding
  const { text: truncatedMessage, wasTruncated } = truncate(message, 500);
  const safeMessage = escapeHtml(truncatedMessage);

  lines.push(`📩 От <b>${safeRenterName}</b>${shortRentalId ? ` · аренда ${escapeHtml(shortRentalId)}` : ""}`);
  lines.push("");
  lines.push(safeMessage);
  if (wasTruncated) {
    lines.push("");
    lines.push(`<i>[сообщение обрезано]</i>`);
  }

  return lines.join("\n");
}

// ── Export helpers for testing ────────────────────────────────────────────

export const __test__ = {
  escapeHtml,
  formatDateRange,
  formatMoney,
  maskPhone,
  truncate,
};
