"use client";

import type React from "react";
import { useAppContext } from "@/contexts/AppContext";

/**
 * Hides its children when the page is opened inside Telegram WebApp.
 * "Open in Telegram" buttons are pointless when already in Telegram.
 */
export function RentalTelegramGuard({ children }: { children: React.ReactNode }) {
  const { isInTelegramContext } = useAppContext();

  if (isInTelegramContext) return null;

  return <>{children}</>;
}

/**
 * Shows children only when inside Telegram WebApp.
 * Used for Telegram-specific calls-to-action.
 */
export function RentalTelegramOnly({ children }: { children: React.ReactNode }) {
  const { isInTelegramContext } = useAppContext();

  if (!isInTelegramContext) return null;

  return <>{children}</>;
}
