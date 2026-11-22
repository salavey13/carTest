"use client";

import { Phone, CheckCircle, TrendingUp, Bike, FileText, Users, MessageSquare, Wallet, type LucideIcon } from "lucide-react";

export const SOURCE_META: Record<string, { label: string; icon: LucideIcon; color: string; bg: string }> = {
  web_callback:    { label: "Звонок",       icon: Phone,        color: "#3b82f6", bg: "#3b82f620" },
  callback_request:{ label: "Заявка",       icon: MessageSquare,color: "#0af",    bg: "#0af20" },
  rental_contract: { label: "Аренда",       icon: CheckCircle,  color: "#10b981", bg: "#10b98120" },
  sale_contract:   { label: "Покупка",      icon: TrendingUp,   color: "#f59e0b", bg: "#f59e0b20" },
  test_drive:      { label: "Тест-драйв",   icon: Bike,         color: "#8b5cf6", bg: "#8b5cf620" },
  testdrive_contract: { label: "Тест-драйв", icon: Bike,       color: "#8b5cf6", bg: "#8b5cf620" },
  app_open:        { label: "Открыл приложение", icon: Users,   color: "#64748b", bg: "#64748b20" },
  rent:            { label: "Аренда",       icon: Bike,         color: "#10b981", bg: "#10b98120" },
  sale:            { label: "Покупка",      icon: TrendingUp,   color: "#f59e0b", bg: "#f59e0b20" },
  checkout_start:  { label: "Корзина",      icon: Wallet,       color: "#06b6d4", bg: "#06b6d420" },
  rental_secret:   { label: "Документы",    icon: FileText,     color: "#06b6d4", bg: "#06b6d420" },
  profile_prefill: { label: "Профиль",      icon: FileText,     color: "#6366f1", bg: "#6366f120" },
  unknown:         { label: "Клиент",       icon: Users,        color: "#64748b", bg: "#64748b20" },
  // ── 2026-09-10: сырье из franchize_intents.intent_type, которое раньше
  // просачивалось в фильтр «Источник» как английские slug'и (критик R1).
  // Канонический список типов — intents.ts franchizeIntentTypes.
  contact_click:   { label: "Клик по контакту", icon: Phone,        color: "#3b82f6", bg: "#3b82f620" },
  map_click:       { label: "Клик по карте",    icon: Bike,         color: "#8b5cf6", bg: "#8b5cf620" },
  test_ride:       { label: "Тест-драйв",       icon: Bike,         color: "#8b5cf6", bg: "#8b5cf620" },
  test_ride_click: { label: "Клик по тест-драйву", icon: Bike,      color: "#8b5cf6", bg: "#8b5cf620" },
  prebuy:          { label: "Интерес к покупке", icon: TrendingUp, color: "#f59e0b", bg: "#f59e0b20" },
  finance:         { label: "Рассрочка",        icon: TrendingUp,   color: "#f59e0b", bg: "#f59e0b20" },
  trade_in:        { label: "Трейд-ин",         icon: TrendingUp,   color: "#f59e0b", bg: "#f59e0b20" },
  hold_created:    { label: "Бронь",            icon: CheckCircle,  color: "#10b981", bg: "#10b98120" },
  service:         { label: "Сервис",           icon: FileText,     color: "#06b6d4", bg: "#06b6d420" },
  payment_success: { label: "Оплата прошла",    icon: CheckCircle,  color: "#10b981", bg: "#10b98120" },
  payment_failure: { label: "Сбой оплаты",      icon: MessageSquare,color: "#0af",    bg: "#0af20" },
  rental:          { label: "Аренда",           icon: Bike,         color: "#10b981", bg: "#10b98120" },
  avito_webhook:   { label: "Авито",            icon: MessageSquare,color: "#0af",    bg: "#0af20" },
};

/**
 * Канонические группы источников (fix «2 тест-драйва, 2 аренды…» в фильтре).
 * Один и тот же смысл приходит из РАЗНЫХ таблиц под разными slug:
 *   • «Тест-драйв»: franchize_intents (test_drive) + testdrive_contract_artifacts
 *     (testdrive_contract) — интент и подписанный договор;
 *   • «Аренда»: rental_contract_artifacts (rental_contract) + rentals/intents
 *     (rent) — договор аренды и сама аренда;
 *   • «Покупка»: sale_contract_artifacts (sale_contract) + intents (sale).
 * Раньше фильтр «Источник» показывал по ДВЕ опции с одинаковыми подписями,
 * каждая фильтровала только «свои» лиды. Теперь дропдаун строится по
 * КАНОНИЧЕСКОЙ группе (sourceGroupOf), а filterLeads матчит группу целиком.
 */
export const SOURCE_GROUPS: Record<string, { label: string; members: string[] }> = {
  testdrive: { label: "Тест-драйв", members: ["test_drive", "testdrive_contract", "test_ride", "test_ride_click"] },
  rent:      { label: "Аренда",    members: ["rental_contract", "rent", "rental"] },
  sale:      { label: "Покупка",   members: ["sale_contract", "sale", "prebuy", "hold_created"] },
};

const RAW_SOURCE_TO_GROUP: Record<string, string> = {};
for (const [groupId, def] of Object.entries(SOURCE_GROUPS)) {
  for (const member of def.members) RAW_SOURCE_TO_GROUP[member] = groupId;
}

/** Канонический ключ источника: slug из группы → id группы, иначе сам slug. */
export function sourceGroupOf(source: string | null | undefined): string {
  if (!source) return "unknown";
  return RAW_SOURCE_TO_GROUP[source] ?? source;
}

export type Segment = "all" | "hot" | "verified" | "warm" | "troubled";

export type ViewMode = "list" | "board" | "table";
// "priority" — сортировка по итоговому индексу Priority Score 0–100
// (см. lib/lead-priority.ts): LIFO-свежесть + температура + задачи +
// LTV + этап воронки, с мультипликатором ×2 для Авито. Дефолтный режим.
export type SortMode = "priority" | "recent" | "urgent" | "name" | "spent";

/** Rent/sale/service lens used by the crew KPI server action (leads-kpis.ts). */
export type Mode = "rent" | "sale" | "service";

// Funnel (kanban) columns — MUST stay in sync with PIPELINE_STAGES keys in
// ./lib/pipeline-stages.ts (groupLeadsForBoard groups by stageKey and falls
// back to "new" for unknown keys). The old set (new/contacted/configured/
// contract_generated/completed) matched raw DB stages, so real pipeline stages
// like active_rental/return_due never had a column.
// 2026-09-09: колонки «QR не принят»/«Нет документов» удалены вместе со
// стадиями (pipeline-stages) — QR и документы больше не состояния.
//
// "avito" — ВИРТУАЛЬНАЯ колонка (не стадия воронки): все лиды из чатов Авито
// на дотрудовой стадии (new/needs_contact) собираются сюда, чтобы босс видел
// их одним взглядом и они не растворялись в общем потоке. Как только сделка
// доходит до договора/аренды — лид живёт в своей обычной стадии воронки.
export const BOARD_COLUMNS: { key: string; label: string; color: string }[] = [
  { key: "avito",             label: "Авито",            color: "#0a8f2a" },
  { key: "new",                label: "Новые",            color: "#64748b" },
  { key: "needs_contact",      label: "Нужен контакт",    color: "#3b82f6" },
  { key: "contract_sent",      label: "Договор отправлен", color: "#06b6d4" },
  { key: "active_rental",      label: "Активные",         color: "#22c55e" },
  { key: "return_due",         label: "Возврат",          color: "#f97316" },
  { key: "closed_won",         label: "Закрыто",          color: "#166534" },
  { key: "closed_lost",        label: "Потеряно",         color: "#1f2937" },
];

/**
 * Дотрудовые стадии воронки: авито-лиды на них живут в виртуальной колонке
 * «Авито» (см. BOARD_COLUMNS выше). Дальше по воронке — обычные колонки.
 */
export const AVITO_COLUMN_STAGES = new Set(["new", "needs_contact"]);

export const RENTAL_STATUS_META: Record<string, { label: string; color: string }> = {
  active:                { label: "Активна",     color: "#10b981" },
  completed:             { label: "Завершена",   color: "#3b82f6" },
  confirmed:             { label: "Подтверждена", color: "#8b5cf6" },
  pending_confirmation:  { label: "В обработке", color: "#f59e0b" },
  cancelled:             { label: "Отменена",     color: "#64748b" },
};

export type LeadSignal = {
  key: string;
  label: string;
  value: string;
  tone: "neutral" | "good" | "warning" | "danger";
  priority: number;
  detail?: string;
};

export type LeadHistoryEvent = {
  type: string;
  timestamp: string;
  label: string;
  icon?: string;
  detail?: string;
  /** Кто совершил (записанные события журнала) — TG id или "avito-agent". */
  actor?: string | null;
  /** Имя актора, если резолвлено (пришло с событием или ростером). */
  actorName?: string | null;
  /** true — записанный факт из public.lead_events (переживает производные данные). */
  recorded?: boolean;
};

/**
 * Пагинация страницы лидов (просьба босса: «лидов уже пара сотен»).
 * Столько лидов показывают все вьюхи сразу; остальное дозагружается
 * кнопкой «Показать ещё» (по LEADS_PAGE_SIZE за клик).
 */
export const LEADS_PAGE_SIZE = 50;
