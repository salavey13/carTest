"use client";

import { Phone, CheckCircle, TrendingUp, Bike, Users, Wallet, FileText, Hash } from "lucide-react";

const SOURCE_META: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  web_callback: { label: "Звонок", icon: Phone, color: "#3b82f6", bg: "#3b82f620" },
  rental_contract: { label: "Аренда", icon: CheckCircle, color: "#10b981", bg: "#10b98120" },
  sale_contract: { label: "Покупка", icon: TrendingUp, color: "#f59e0b", bg: "#f59e0b20" },
  test_drive: { label: "Тест-драйв", icon: Bike, color: "#8b5cf6", bg: "#8b5cf620" },
  app_open: { label: "Открыл приложение", icon: Users, color: "#64748b", bg: "#64748b20" },
  rent: { label: "Аренда", icon: Bike, color: "#10b981", bg: "#10b98120" },
  sale: { label: "Покупка", icon: TrendingUp, color: "#f59e0b", bg: "#f59e0b20" },
  checkout_start: { label: "Корзина", icon: Wallet, color: "#06b6d4", bg: "#06b6d420" },
  rental_secret: { label: "Документы", icon: FileText, color: "#06b6d4", bg: "#06b6d420" },
  profile_prefill: { label: "Профиль", icon: FileText, color: "#6366f1", bg: "#6366f120" },
  unknown: { label: "Клиент", icon: Users, color: "#64748b", bg: "#64748b20" },
};

export function SourceBadge({ source, size = "sm" }: { source: string; size?: "sm" | "md" }) {
  const meta = SOURCE_META[source] || SOURCE_META.unknown;
  const Icon = meta.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium ${
        size === "md" ? "px-2.5 py-1 text-[11px]" : "px-2 py-0.5 text-[10px]"
      }`}
      style={{ backgroundColor: meta.bg, color: meta.color }}
    >
      <Icon className={size === "md" ? "h-3 w-3" : "h-2.5 w-2.5"} />
      {meta.label}
    </span>
  );
}