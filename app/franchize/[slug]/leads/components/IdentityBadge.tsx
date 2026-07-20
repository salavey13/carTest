"use client";

import { User, Phone, ShieldAlert, GitMerge } from "lucide-react";

type IdentityState = 'claimed_user' | 'phone_only' | 'operator_placeholder' | 'merged';

const IDENTITY_META: Record<IdentityState, { label: string; icon: any; color: string; bg: string; title: string }> = {
  claimed_user: {
    label: "Telegram",
    icon: User,
    color: "#10b981",
    bg: "#10b98115",
    title: "Подтверждённый пользователь Telegram",
  },
  phone_only: {
    label: "Телефон",
    icon: Phone,
    color: "#3b82f6",
    bg: "#3b82f615",
    title: "Только номер телефона, Telegram не привязан",
  },
  operator_placeholder: {
    label: "Оператор",
    icon: ShieldAlert,
    color: "#f59e0b",
    bg: "#f59e0b15",
    title: "Заглушка оператора — реальный арендатор не привязан",
  },
  merged: {
    label: "Объединён",
    icon: GitMerge,
    color: "#8b5cf6",
    bg: "#8b5cf615",
    title: "Объединён из нескольких источников",
  },
};

export function IdentityBadge({ state }: { state?: IdentityState | null }) {
  if (!state || state === 'claimed_user') return null; // Don't show for normal claimed users
  const meta = IDENTITY_META[state];
  if (!meta) return null;
  const Icon = meta.icon;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
      style={{ backgroundColor: meta.bg, color: meta.color }}
      title={meta.title}
    >
      <Icon className="h-2.5 w-2.5" />
      {meta.label}
    </span>
  );
}
