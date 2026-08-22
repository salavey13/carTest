"use client";

import { useState, useEffect, useCallback } from "react";
import { Lock, X, Loader2 } from "lucide-react";
import { validateAnalyticsPassword } from "@/app/franchize/server-actions/rentals-dashboard";

export interface UseAnalyticsPasswordGateProps {
  slug: string;
  isInTelegram: boolean;
  ownerId?: string | null; // crew owner's telegram user_id
}

export interface UseAnalyticsPasswordGateReturn {
  showPasswordEntry: boolean;
  setShowPasswordEntry: (v: boolean) => void;
  passwordInput: string;
  setPasswordInput: (v: string) => void;
  passwordError: string | null;
  setPasswordError: (v: string | null) => void;
  isPasswordValidating: boolean;
  passwordAuthOwnerId: string | null;
  setPasswordAuthOwnerId: (v: string | null) => void;
  handlePasswordSubmit: () => Promise<void>;
  handlePasswordCancel: () => void;
}

export function useAnalyticsPasswordGate({
  slug,
  isInTelegram,
  ownerId,
}: UseAnalyticsPasswordGateProps): UseAnalyticsPasswordGateReturn {
  const [showPasswordEntry, setShowPasswordEntry] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isPasswordValidating, setIsPasswordValidating] = useState(false);
  const [passwordAuthOwnerId, setPasswordAuthOwnerId] = useState<string | null>(null);

  // Show password entry if not in Telegram and no auth yet
  useEffect(() => {
    if (!isInTelegram && !passwordAuthOwnerId) {
      setShowPasswordEntry(true);
    }
  }, [isInTelegram, passwordAuthOwnerId]);

  const handlePasswordSubmit = useCallback(async () => {
    if (!passwordInput.trim()) return;
    setIsPasswordValidating(true);
    setPasswordError(null);

    try {
      const result = await validateAnalyticsPassword({
        password: passwordInput,
        crewSlug: slug,
      });

      if (!result.success) {
        setPasswordError(result.error || "Неверный пароль");
        return;
      }

      if (result.slug && result.slug !== slug.trim()) {
        setPasswordError("Пароль для другого экипажа");
        return;
      }

      // Store ownerId for password auth
      setPasswordAuthOwnerId(result.ownerId || null);
      setShowPasswordEntry(false);
      setPasswordInput("");
    } catch {
      setPasswordError("Ошибка проверки пароля");
    } finally {
      setIsPasswordValidating(false);
    }
  }, [passwordInput, slug]);

  const handlePasswordCancel = useCallback(() => {
    setShowPasswordEntry(false);
    setPasswordInput("");
    setPasswordError(null);
  }, []);

  return {
    showPasswordEntry,
    setShowPasswordEntry,
    passwordInput,
    setPasswordInput,
    passwordError,
    setPasswordError,
    isPasswordValidating,
    passwordAuthOwnerId,
    setPasswordAuthOwnerId,
    handlePasswordSubmit,
    handlePasswordCancel,
  };
}