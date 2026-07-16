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
  rental_contract: { label: "Аренда",       icon: CheckCircle,  color: "#10b981", bg: "#10b98120" },
  sale_contract:   { label: "Покупка",      icon: TrendingUp,   color: "#f59e0b", bg: "#f59e0b20" },
  test_drive:      { label: "Тест-драйв",   icon: Bike,         color: "#8b5cf6", bg: "#8b5cf620" },
  app_open:        { label: "Открыл приложение", icon: Users,   color: "#64748b", bg: "#64748b20" },
  rent:            { label: "Аренда",       icon: Bike,         color: "#10b981", bg: "#10b98120" },
  sale:            { label: "Покупка",      icon: TrendingUp,   color: "#f59e0b", bg: "#f59e0b20" },
  checkout_start:  { label: "Корзина",      icon: Wallet,       color: "#06b6d4", bg: "#06b6d420" },
  rental_secret:   { label: "Документы",    icon: FileText,     color: "#06b6d4", bg: "#06b6d420" },
  profile_prefill: { label: "Профиль",      icon: FileText,     color: "#6366f1", bg: "#6366f120" },
  unknown:         { label: "Клиент",       icon: Users,        color: "#64748b", bg: "#64748b20" },
};

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
  troubled:  { label: "Проблемные",  icon: AlertCircle, color: "#dc2626" },
};

export type ViewMode = "list" | "board";
export type SortMode = "recent" | "urgent" | "name" | "spent";
export type DetailSection = "contacts" | "deals" | "tasks" | "notes";

export const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: "recent",  label: "Свежие" },
  { value: "urgent",  label: "🔥 Срочные" },
  { value: "spent",   label: "💰 По выручке" },
  { value: "name",    label: "А → Я" },
];

export const BOARD_COLUMNS: { key: string; label: string; color: string }[] = [
  { key: "new",                label: "Новые",           color: "#64748b" },
  { key: "contacted",          label: "В работе",        color: "#3b82f6" },
  { key: "configured",         label: "Настроил",        color: "#8b5cf6" },
  { key: "contract_generated", label: "Договор",         color: "#f59e0b" },
  { key: "completed",          label: "Завершено",       color: "#10b981" },
];

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