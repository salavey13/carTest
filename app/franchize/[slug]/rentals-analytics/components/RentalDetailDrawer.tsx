"use client";
import { motion } from "framer-motion";
import type { ThemeTokens } from "../hooks/useTheme";

// RentalDetailDrawer — Analytics page component
// Mobile-first, T: ThemeTokens, ../ relative imports, ФИО primary

export function RentalDetailDrawer({ T }: { T: ThemeTokens }) {
  return (
    <div className="rounded-2xl border p-4" style={{ borderColor: T.border, backgroundColor: T.bgCard }}>
      <p className="text-sm" style={{ color: T.textMuted }}>RentalDetailDrawer — TODO: implement</p>
    </div>
  );
}
