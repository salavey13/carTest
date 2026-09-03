"use client";

import {
  Flame, Phone, CheckCircle, ChevronDown, ChevronRight, Plus,
  Trash2, Send, Clock, TrendingUp, Search, X, Bike, FileText,
  CircleDot, Users, Lock, AlertCircle, LayoutList, Columns3,
  Calendar, UserPlus, Download, Star, Filter, StickyNote, History,
  MapPin, ExternalLink, Banknote, Briefcase, ShieldAlert, Hash,
  MessageSquare, Wallet, Gauge, Activity, Check, Loader2, XCircle,
  RotateCcw, Camera, ShieldCheck, Eye, ImageOff, RefreshCw
} from "lucide-react";

export const SOURCE_META: Record<string, { label: string; icon: typeof Flame; color: string; bg: string }> = {
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
  testdrive: { label: "Тест-драйв", members: ["test_drive", "testdrive_contract"] },
  rent:      { label: "Аренда",    members: ["rental_contract", "rent"] },
  sale:      { label: "Покупка",   members: ["sale_contract", "sale"] },
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

export const STAGE_LABELS: Record<string, string> = {
  contract_generated: "Договор готов",
  checkout_started:   "Оформление",
  checkout_completed: "Оплачен",
  dismissed:          "Отклонён",
  interest_paid:      "Интерес",
  new:                "Новый",
  contacted:          "Контакт установлен",
  viewed:             "Просмотр",
  configured:         "Настроил",
};

export type Segment = "all" | "hot" | "verified" | "warm" | "troubled";

export const SEGMENT_META: Record<Segment, { label: string; icon: typeof Flame; color: string }> = {
  all:       { label: "Все",         icon: Users,       color: "#64748b" },
  hot:       { label: "Горячие",     icon: Flame,       color: "#ef4444" },
  verified:  { label: "Клиенты",     icon: CheckCircle, color: "#10b981" },
  warm:      { label: "Заявки",      icon: Phone,       color: "#3b82f6" },
  troubled:  { label: "Ждут внимания", icon: AlertCircle, color: "#f59e0b" },
};

export type ViewMode = "list" | "board" | "table";
// "priority" — сортировка по итоговому индексу Priority Score 0–100
// (см. lib/lead-priority.ts): LIFO-свежесть + температура + задачи +
// LTV + этап воронки, с мультипликатором ×2 для Авито. Дефолтный режим.
export type SortMode = "priority" | "recent" | "urgent" | "name" | "spent";
export type DetailSection = "contacts" | "deals" | "tasks" | "notes";

export const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: "priority", label: "🔥 Приоритет" },
  { value: "recent",  label: "Свежие" },
  { value: "urgent",  label: "⏱ Срочность" },
  { value: "spent",   label: "💰 По выручке" },
  { value: "name",    label: "А → Я" },
];

// Funnel (kanban) columns — MUST stay in sync with PIPELINE_STAGES keys in
// ./lib/pipeline-stages.ts (groupLeadsForBoard groups by stageKey and falls
// back to "new" for unknown keys). The old set (new/contacted/configured/
// contract_generated/completed) matched raw DB stages, so real pipeline stages
// like awaiting_qr_claim/active_rental/return_due never had a column.
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
  { key: "awaiting_qr_claim",  label: "QR не принят",     color: "#eab308" },
  { key: "documents_missing",  label: "Нет документов",   color: "#f97316" },
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

export const RENTAL_HISTORY_LABELS: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  pending_confirmation: { label: "Заявка создана",  color: "#f59e0b", icon: Clock },
  active:               { label: "Активирована",    color: "#10b981", icon: Activity },
  completed:            { label: "Завершена",       color: "#3b82f6", icon: CheckCircle },
  cancelled:            { label: "Отклонена",       color: "#ef4444", icon: X },
  confirmed:            { label: "Подтверждена",    color: "#8b5cf6", icon: CheckCircle },
  disputed:             { label: "В споре",         color: "#ef4444", icon: ShieldAlert },
};

export const TROUBLED_QUICK_REASONS = [
  "Байк на зарядке",
  "Байк на ремонте",
  "Нет свободных дат",
  "Перенос на другие даты",
];

export const TODO_PRIORITIES = [
  { value: "low",    label: "Низкий" },
  { value: "medium", label: "Средний" },
  { value: "high",   label: "Высокий" },
] as const;

export const PASSWORD_MIN_LENGTH = 4;

export const LEAD_CARD_TRANSITION_MS = 200;
export const BOARD_MAX_HEIGHT = "calc(100vh - 280px)";
export const DETAIL_PANEL_MAX_HEIGHT = "calc(100vh - 140px)";
export const SEARCH_DEBOUNCE_MS = 300;
// ── Leads UI v2 types ──
export type Mode = "rent" | "sale" | "service";

export type StageKey =
  | "new" | "needs_contact" | "contract_sent" | "awaiting_qr_claim"
  | "documents_missing" | "active_rental" | "return_due"
  | "closed_won" | "closed_lost";

export type SortModeV2 = "recent" | "urgent" | "name" | "spent" | "sla" | "return_due" | "overdue_todos";

export type FilterFlags = {
  overdueOnly: boolean;
  unclaimedQrOnly: boolean;
  documentsMissingOnly: boolean;
  activeRentalOnly: boolean;
  returnDueOnly: boolean;
  dismissedOnly: boolean;
  hideOperatorPlaceholders: boolean;
};

export type LeadQuickAction =
  | { type: "call" } | { type: "telegram" } | { type: "notify" }
  | { type: "request_docs" } | { type: "resend_qr" } | { type: "open_contract" }
  | { type: "verify_photos" } | { type: "create_rental" } | { type: "schedule_return" }
  | { type: "dismiss" } | { type: "assign_owner" } | { type: "pin" } | { type: "more" };

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
};

/**
 * Пагинация страницы лидов (просьба босса: «лидов уже пара сотен»).
 * Столько лидов показывают все вьюхи сразу; остальное дозагружается
 * кнопкой «Показать ещё» (по LEADS_PAGE_SIZE за клик).
 */
export const LEADS_PAGE_SIZE = 50;
