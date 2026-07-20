"use client";

import { useEffect } from "react";

/**
 * RentalEscapeHatch
 *
 * Safety net for /franchize/[slug]/rental/[id] page when navigation gets stuck.
 * Provides:
 *  1. Escape key → navigate to catalog
 *  2. Telegram BackButton → navigate to catalog
 *  3. A visible fallback button that uses window.location.href directly
 *     (bypasses any broken Next.js router state)
 */
export function RentalEscapeHatch({ catalogHref }: { catalogHref: string }) {
  // ── Escape key → go to catalog ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        window.location.href = catalogHref;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [catalogHref]);

  // ── Telegram BackButton → go to catalog ──
  useEffect(() => {
    const webApp = (window as any).Telegram?.WebApp;
    const backButton = webApp?.BackButton;
    if (backButton && webApp?.isVersionAtLeast?.("6.1")) {
      backButton.show();
      const handler = () => { window.location.href = catalogHref; };
      backButton.onClick(handler);
      backButton.show();
      return () => {
        backButton.offClick(handler);
        backButton.hide();
      };
    }
  }, [catalogHref]);

  return (
    <div className="mb-4 flex items-center gap-2">
      <button
        onClick={() => window.location.href = catalogHref}
        className="inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs transition-colors hover:opacity-80 cursor-pointer"
        style={{
          borderColor: "var(--franchize-border-soft, #333)",
          color: "var(--franchize-text-secondary, #999)",
          backgroundColor: "var(--franchize-bg-card, transparent)",
        }}
      >
        ← В каталог
      </button>
    </div>
  );
}
