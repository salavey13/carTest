"use client";

import { useMemo } from "react";
import { useAppContext } from "@/contexts/AppContext";
import { ExternalLink, LogIn } from "lucide-react";

/**
 * GuestRentalCta
 * ──────────────────────────────────────────────────────────────────────────
 * Phase 5 from PRD: Guest minimal view.
 *
 * For unauthenticated visitors (no Telegram WebApp auth, no crew membership),
 * shows a minimal info card + "Open in Telegram" CTA. Hides all operator
 * panels (checklists, lifecycle controls, documents) and renter panels
 * (photo upload, message crew).
 *
 * Why a separate component?
 *   - Guests get a focused, single-action UI: "open in Telegram to see more"
 *   - Avoids cluttering their view with buttons they can't use
 *   - Clear conversion path: guest → opens TG → becomes renter/operator
 *
 * Visibility:
 *   - Renders only when user is NOT authenticated (dbUser is null)
 *     OR has no role on this rental (not renter, not operator, not admin)
 *   - Returns null for renters and operators
 */
interface GuestRentalCtaProps {
  ownerId?: string;
  renterId?: string;
  renterTelegramChatId?: string;
  crewId?: string;
  bikeTitle?: string;
  statusLabel?: string;
  telegramDeepLink?: string;
  accentColor: string;
  accentTextOn: string;
  borderColor: string;
  textPrimary: string;
  textSecondary: string;
}

export function GuestRentalCta({
  ownerId,
  renterId,
  renterTelegramChatId,
  crewId,
  bikeTitle,
  statusLabel,
  telegramDeepLink,
  accentColor,
  accentTextOn,
  borderColor,
  textPrimary,
  textSecondary,
}: GuestRentalCtaProps) {
  const { dbUser, userCrewMemberships } = useAppContext();

  const isGuest = useMemo(() => {
    if (!dbUser?.user_id) return true;
    if (ownerId && dbUser.user_id === ownerId) return false;
    if (renterId && dbUser.user_id === renterId) return false;
    if (renterTelegramChatId && dbUser.user_id === renterTelegramChatId) return false;
    if (crewId) {
      const m = userCrewMemberships.find((mem) => mem.crewId === crewId);
      if (m && ["owner", "admin", "co_owner", "member"].includes(m.role)) return false;
    }
    const meta = (dbUser.metadata as Record<string, unknown> | null) ?? null;
    if (meta?.role === "admin" || meta?.status === "admin") return false;
    return true;
  }, [dbUser?.user_id, dbUser?.metadata, ownerId, renterId, renterTelegramChatId, crewId, userCrewMemberships]);

  if (!isGuest || !telegramDeepLink) return null;

  return (
    <section
      className="rounded-2xl border p-5 text-center space-y-3"
      style={{
        borderColor: accentColor,
        backgroundColor: `${accentColor}08`,
      }}
    >
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full"
        style={{ backgroundColor: `${accentColor}20`, color: accentColor }}
      >
        <LogIn className="h-6 w-6" />
      </div>

      <div>
        <h3 className="text-base font-bold" style={{ color: textPrimary }}>
          Откройте в Telegram
        </h3>
        <p className="text-sm mt-1" style={{ color: textSecondary }}>
          {bikeTitle
            ? `Аренда ${bikeTitle} · ${statusLabel || ""}`.trim()
            : "Полный доступ к карточке аренды"}
        </p>
      </div>

      <p className="text-xs leading-relaxed max-w-sm mx-auto" style={{ color: textSecondary }}>
        В Telegram WebApp вы увидите договор, чек-лист и сможете связаться с экипажем —
        без переключения приложений.
      </p>

      <a
        href={telegramDeepLink}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition hover:opacity-90"
        style={{ backgroundColor: accentColor, color: accentTextOn }}
      >
        <ExternalLink className="h-4 w-4" />
        Открыть в Telegram
      </a>
    </section>
  );
}
