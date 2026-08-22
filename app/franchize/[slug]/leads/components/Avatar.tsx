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

function getInitials(name: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function Avatar({ name, source, size = 44 }: { name: string | null; source: string; size?: number }) {
  const meta = SOURCE_META[source] || SOURCE_META.unknown;
  const initials = getInitials(name);
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full font-bold"
      style={{
        width: size,
        height: size,
        backgroundColor: meta.bg,
        color: meta.color,
        fontSize: size > 40 ? "14px" : "12px",
        boxShadow: `0 0 0 2px ${meta.color}25`,
      }}
    >
      {initials}
    </div>
  );
}