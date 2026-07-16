"use client";

import { useEffect } from "react";
import { Lock } from "lucide-react";
import { CrewHeader } from "@/app/franchize/components/CrewHeader";
import { FranchizePageShell } from "@/app/franchize/components/FranchizePageShell";
import { crewPaletteForSurface } from "@/app/franchize/lib/theme";
import type { FranchizeCrewVM } from "@/app/franchize/actions";

interface AnalyticsLayoutProps {
  crew: FranchizeCrewVM;
  activePath: string;
  children: React.ReactNode;
  title: string;
  description?: string;
  groupLinks?: Array<{ label: string; href: string; icon?: React.ReactNode }>;
  showRail?: boolean;
  width?: "content" | "full";
  contentClassName?: string;
}

export function AnalyticsLayout({
  crew,
  activePath,
  children,
  title,
  description,
  groupLinks = [],
  showRail = false,
  width = "full",
  contentClassName = "space-y-6",
}: AnalyticsLayoutProps) {
  const surface = crewPaletteForSurface(crew.theme);
  const resolvedSlug = crew.slug || "";

  // Scroll to top on navigation
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [activePath]);

  return (
    <main className="min-h-screen" style={surface.page}>
      <CrewHeader
        crew={crew}
        activePath={activePath}
        groupLinks={groupLinks}
        showRail={showRail}
      />
      <FranchizePageShell theme={crew.theme} contentClassName={contentClassName} width={width}>
        <div className="space-y-6 pt-4">
          <header className="border-b pb-4">
            <h1 className="text-2xl font-bold uppercase tracking-tight" style={{ color: "var(--franchize-text-primary)" }}>
              {title}
            </h1>
            {description && (
              <p className="mt-1 text-sm" style={{ color: "var(--franchize-text-secondary)" }}>
                {description}
              </p>
            )}
          </header>
          {children}
        </div>
      </FranchizePageShell>
    </main>
  );
}

export function AnalyticsPasswordGate({
  crew,
  slug,
  isInTelegram,
  passwordAuthOwnerId,
  showPasswordEntry,
  setShowPasswordEntry,
  passwordInput,
  setPasswordInput,
  passwordError,
  isPasswordValidating,
  handlePasswordSubmit,
}: {
  crew: FranchizeCrewVM;
  slug: string;
  isInTelegram: boolean;
  passwordAuthOwnerId: string | null;
  showPasswordEntry: boolean;
  setShowPasswordEntry: (v: boolean) => void;
  passwordInput: string;
  setPasswordInput: (v: string) => void;
  passwordError: string | null;
  isPasswordValidating: boolean;
  handlePasswordSubmit: () => Promise<void>;
}) {
  const surface = crewPaletteForSurface(crew.theme);

  if (!showPasswordEntry || passwordAuthOwnerId) return null;

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-4 rounded-2xl border p-6" style={{ borderColor: "var(--franchize-border-soft)", backgroundColor: "var(--franchize-bg-card)", boxShadow: "0 4px 24px rgba(0,0,0,0.1)" }}>
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full" style={{ backgroundColor: "var(--franchize-bg-base)" }}>
            <Lock className="h-6 w-6" style={{ color: "var(--franchize-accent-main)" }} />
          </div>
          <h2 className="text-lg font-bold" style={{ color: "var(--franchize-text-primary)" }}>Введите пароль</h2>
          <p className="mt-1 text-sm" style={{ color: "var(--franchize-text-secondary)" }}>Для доступа к аналитике</p>
        </div>
        <input
          type="password"
          value={passwordInput}
          onChange={(e) => setPasswordInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handlePasswordSubmit()}
          placeholder="••••••••"
          disabled={isPasswordValidating}
          className="w-full rounded-xl border px-4 py-3 text-center tracking-widest outline-none transition focus:ring-2"
          style={{
            borderColor: "var(--franchize-border-soft)",
            backgroundColor: "var(--franchize-bg-base)",
            color: "var(--franchize-text-primary)",
            "--tw-ring-color": "var(--franchize-accent-main)",
          }}
          autoFocus
        />
        {passwordError && (
          <p className="flex items-center justify-center gap-1.5 text-center text-sm text-red-400">
            <Lock className="h-4 w-4" /> {passwordError}
          </p>
        )}
        <button
          onClick={handlePasswordSubmit}
          disabled={isPasswordValidating || !passwordInput.trim()}
          className="w-full rounded-xl py-3 font-bold transition hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: "var(--franchize-accent-main)", color: "var(--franchize-accent-contrast)" }}
        >
          {isPasswordValidating ? "Проверка..." : "Войти"}
        </button>
        <p className="text-center text-xs" style={{ color: "var(--franchize-text-secondary)" }}>
          Пароль можно получить через бота: /analytics_pass
        </p>
      </div>
    </div>
  );
}