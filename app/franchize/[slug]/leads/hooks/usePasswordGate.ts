"use client";

import { useState, useEffect, useCallback } from "react";
import { validateAnalyticsPassword } from "@/app/franchize/server-actions/rentals-dashboard";

export function usePasswordGate(slug: string, isInTelegram: boolean, dbUserId?: string | null) {
  const [showPasswordEntry, setShowPasswordEntry] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isPasswordValidating, setIsPasswordValidating] = useState(false);
  const [passwordAuthed, setPasswordAuthed] = useState(false);

  // Skip password gate entirely if user is already authenticated via Telegram
  const isAlreadyAuthed = !!dbUserId;

  useEffect(() => {
    if (!isAlreadyAuthed && !isInTelegram && !passwordAuthed) setShowPasswordEntry(true);
  }, [isInTelegram, passwordAuthed, isAlreadyAuthed]);

  const handlePasswordSubmit = useCallback(async () => {
    if (!passwordInput.trim()) return;
    setIsPasswordValidating(true);
    setPasswordError(null);
    try {
      const result = await validateAnalyticsPassword({ password: passwordInput });
      if (!result.success) { setPasswordError(result.error || "Неверный пароль"); return; }
      if (result.slug && result.slug !== slug.trim()) { setPasswordError("Пароль для другого экипажа"); return; }
      setPasswordAuthed(true);
      setShowPasswordEntry(false);
      setPasswordInput("");
    } catch { setPasswordError("Ошибка проверки пароля"); }
    finally { setIsPasswordValidating(false); }
  }, [passwordInput, slug]);

  return {
    showPasswordEntry,
    passwordInput,
    setPasswordInput,
    passwordError,
    setPasswordError,
    isPasswordValidating,
    passwordAuthed,
    handlePasswordSubmit,
  };
}