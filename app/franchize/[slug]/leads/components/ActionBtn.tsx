"use client";

import { LucideIcon } from "lucide-react";

interface ActionBtnProps {
  href: string;
  icon: LucideIcon;
  label: string;
  T: any;
  external?: boolean;
}

export function ActionBtn({ href, icon: Icon, label, T, external }: ActionBtnProps) {
  return (
    <a href={href} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined}
      className="group flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-[11px] font-medium transition hover:brightness-110"
      style={{ borderColor: T.border, backgroundColor: T.bgElevated, color: T.text }}>
      <Icon className="h-3.5 w-3.5 transition group-hover:scale-110" style={{ color: T.accent }} />
      {label}
    </a>
  );
}