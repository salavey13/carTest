"use client";

import { useState } from "react";
import { RefreshCw, ShieldCheck, AlertCircle, Sparkles } from "lucide-react";
import { validateAnalyticsPassword } from "@/app/franchize/server-actions/rentals-dashboard";
import { useFranchizeTheme } from "@/app/franchize/hooks/useFranchizeTheme";
import { withAlpha } from "@/app/franchize/lib/theme";
import { toast } from "sonner";

interface AnalyticsPasswordEntryProps {
  crewName: string;
  slug: string;
  onAuthenticated: (ownerId: string) => void;
}

export function AnalyticsPasswordEntry({ crewName, slug, onAuthenticated }: AnalyticsPasswordEntryProps) {
  const theme = useFranchizeTheme({});
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isPasswordValidating, setIsPasswordValidating] = useState(false);

  const bgBase = "var(--franchize-bg-base)";
  const bgCard = "var(--franchize-bg-card)";
  const accentMain = "var(--franchize-accent-main)";
  const accentHover = "var(--franchize-accent-hover)";
  const textPrimary = "var(--franchize-text-primary)";
  const textSecondary = "var(--franchize-text-secondary)";
  const borderSoft = "var(--franchize-border-soft)";

  const handleSubmit = async () => {
    if (!passwordInput.trim()) return;
    setIsPasswordValidating(true);
    setPasswordError(null);

    try {
      const result = await validateAnalyticsPassword({ password: passwordInput });
      if (!result.success) {
        setPasswordError(result.error || "Неверный пароль");
        return;
      }
      if (result.slug && result.slug !== slug) {
        setPasswordError(`Пароль для другого экипажа: ${result.slug}`);
        return;
      }
      onAuthenticated(result.ownerId || null);
      toast.success("Доступ разрешён");
    } catch {
      setPasswordError("Ошибка проверки пароля");
    } finally {
      setIsPasswordValidating(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: bgBase }}>
      <div className="w-full max-w-sm relative">
        <div
          className="absolute -inset-3 md:-inset-4 rounded-full blur-2xl md:blur-3xl animate-pulse"
          style={{ backgroundColor: withAlpha(accentMain, 0.15) }}
        />
        <div
          className="relative rounded-2xl md:rounded-3xl p-6 md:p-8 border shadow-xl md:shadow-2xl"
          style={{ backgroundColor: bgCard, borderColor: borderSoft }}
        >
          <div className="text-center mb-6 md:mb-8">
            <div
              className="w-16 h-16 md:w-20 md:h-20 mx-auto mb-4 md:mb-6 rounded-xl md:rounded-2xl flex items-center justify-center shadow-lg"
              style={{
                background: `linear-gradient(135deg, ${accentMain}, ${accentHover})`,
                boxShadow: `0 10px 40px ${withAlpha(accentMain, 0.3)}`,
              }}
            >
              <ShieldCheck className="w-8 h-8 md:w-10 md:h-10" style={{ color: "#FFFFFF" }} />
            </div>
            <h1
              className="text-2xl md:text-3xl font-black tracking-tight"
              style={{
                backgroundImage: `linear-gradient(to right, ${accentMain}, ${accentHover})`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              Аналитика
            </h1>
            <p className="text-xs md:text-sm mt-1.5 md:mt-2" style={{ color: textSecondary }}>
              {crewName} — введите пароль для доступа
            </p>
          </div>

          <div className="relative">
            <input
              type="password"
              value={passwordInput}
              onChange={(e) => { setPasswordInput(e.target.value); setPasswordError(null); }}
              onKeyDown={(e) => e.key === "Enter" && void handleSubmit()}
              placeholder="••••••••"
              disabled={isPasswordValidating}
              className="w-full px-4 md:px-6 py-3 md:py-4 rounded-lg md:rounded-xl border-2 text-center tracking-widest text-base md:text-lg transition-all focus:outline-none focus:ring-2"
              style={{
                backgroundColor: withAlpha(bgCard, 0.5),
                borderColor: borderSoft,
                color: textPrimary,
              }}
              autoFocus
            />
            {passwordError && (
              <p className="mt-2 md:mt-3 text-center text-xs md:text-sm flex items-center justify-center gap-1.5 md:gap-2" style={{ color: "#ef4444" }}>
                <AlertCircle className="w-3.5 h-3.5 md:w-4 md:h-4" />
                {passwordError}
              </p>
            )}
          </div>

          <button
            onClick={handleSubmit}
            disabled={isPasswordValidating || !passwordInput.trim()}
            className="w-full mt-4 md:mt-6 px-4 md:px-6 py-3 md:py-4 font-bold rounded-lg md:rounded-xl transition-all hover:scale-[1.02] hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-1.5 md:gap-2 text-sm md:text-base relative overflow-hidden"
            style={{
              background: `linear-gradient(to right, ${accentMain}, ${accentHover})`,
              boxShadow: `0 4px 20px ${withAlpha(accentMain, 0.4)}`,
              color: "#000000",
            }}
          >
            {isPasswordValidating ? (
              <>
                <RefreshCw className="w-4 h-4 md:w-5 md:h-5 animate-spin" />
                Проверка...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 md:w-5 md:h-5" />
                Войти
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
