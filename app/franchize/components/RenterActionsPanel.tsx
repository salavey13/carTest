"use client";

import { useMemo } from "react";
import { useAppContext } from "@/contexts/AppContext";
import { Camera, Download, MessageSquare, ExternalLink, FileText } from "lucide-react";

/**
 * RenterActionsPanel
 * ──────────────────────────────────────────────────────────────────────────
 * Phase 5 from PRD: Renter-specific view.
 *
 * Shows renter-only actions:
 *   - Upload photos (passport/registration/license) — if unverified
 *   - Download contract (if verified)
 *   - Message crew (free text → TG relay to operator)
 *   - Open in Telegram (deep link)
 *
 * Visibility:
 *   - Renders only when the current user is the renter of this rental
 *   - Returns null for operators/guests (they see other panels)
 *
 * Why a separate component (vs. just role-guarding inline)?
 *   - Renter's UX is fundamentally different: they don't need operator tools,
 *     they need simple "what do I do next" guidance.
 *   - Keeping it as a single component makes the renter journey easy to
 *     understand and modify.
 *
 * Props mirror FranchizeRentalRoleGuard: identity inputs + theme tokens.
 */
interface RenterActionsPanelProps {
  rentalId: string;
  ownerId?: string;
  renterId?: string;
  renterTelegramChatId?: string;
  crewId?: string;
  contractVerified: boolean;
  contractDownloadUrl?: string | null;
  photoUploadHref?: string; // web app photo upload route
  messageCrewHref?: string; // route to message input section
  telegramDeepLink?: string;
  accentColor: string;
  accentTextOn: string;
  borderColor: string;
  textPrimary: string;
  textSecondary: string;
}

export function RenterActionsPanel({
  rentalId,
  ownerId,
  renterId,
  renterTelegramChatId,
  crewId,
  contractVerified,
  contractDownloadUrl,
  photoUploadHref,
  messageCrewHref,
  telegramDeepLink,
  accentColor,
  accentTextOn,
  borderColor,
  textPrimary,
  textSecondary,
}: RenterActionsPanelProps) {
  const { dbUser } = useAppContext();

  const isRenter = useMemo(() => {
    if (!dbUser?.user_id) return false;
    if (renterId && dbUser.user_id === renterId) return true;
    if (renterTelegramChatId && dbUser.user_id === renterTelegramChatId) return true;
    return false;
  }, [dbUser?.user_id, renterId, renterTelegramChatId]);

  // Only render for renters
  if (!isRenter) return null;

  return (
    <section
      className="rounded-2xl border p-4 space-y-3"
      style={{ borderColor }}
    >
      <div>
        <h3 className="text-base font-bold" style={{ color: textPrimary }}>
          Ваши действия
        </h3>
        <p className="text-xs mt-0.5" style={{ color: textSecondary }}>
          Аренда <span className="font-mono">#{rentalId.slice(0, 8)}</span> · что можно сделать
        </p>
      </div>

      {/* Photo upload — only if contract not verified yet */}
      {!contractVerified && photoUploadHref && (
        <a
          href={photoUploadHref}
          className="flex items-center gap-3 rounded-xl border p-3 transition hover:opacity-85"
          style={{ borderColor: accentColor, backgroundColor: `${accentColor}10` }}
        >
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
            style={{ backgroundColor: `${accentColor}25`, color: accentColor }}
          >
            <Camera className="h-4 w-4" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold" style={{ color: textPrimary }}>
              Загрузить фото документов
            </p>
            <p className="text-xs" style={{ color: textSecondary }}>
              Паспорт · Права · Документы на ТС — мы распознаем автоматически
            </p>
          </div>
          <ExternalLink className="h-4 w-4 opacity-50" />
        </a>
      )}

      {/* Contract download — only if verified */}
      {contractVerified && contractDownloadUrl && (
        <a
          href={contractDownloadUrl}
          download
          className="flex items-center gap-3 rounded-xl border p-3 transition hover:opacity-85"
          style={{ borderColor, backgroundColor: `${accentColor}08` }}
        >
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
            style={{ backgroundColor: `${accentColor}25`, color: accentColor }}
          >
            <Download className="h-4 w-4" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold" style={{ color: textPrimary }}>
              Скачать договор
            </p>
            <p className="text-xs" style={{ color: textSecondary }}>
              DOCX · подписан и верифицирован
            </p>
          </div>
          <FileText className="h-4 w-4 opacity-50" />
        </a>
      )}

      {/* Message crew */}
      {messageCrewHref && (
        <a
          href={messageCrewHref}
          className="flex items-center gap-3 rounded-xl border p-3 transition hover:opacity-85"
          style={{ borderColor }}
        >
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
            style={{ backgroundColor: `${accentColor}25`, color: accentColor }}
          >
            <MessageSquare className="h-4 w-4" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold" style={{ color: textPrimary }}>
              Написать экипажу
            </p>
            <p className="text-xs" style={{ color: textSecondary }}>
              Вопрос по аренде, сроки, доставка
            </p>
          </div>
        </a>
      )}

      {/* Telegram deep link — always visible as fallback */}
      {telegramDeepLink && (
        <a
          href={telegramDeepLink}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 justify-center rounded-xl px-3 py-2 text-xs font-semibold transition hover:opacity-85"
          style={{ borderColor, color: accentColor, border: `1px solid ${accentColor}` }}
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Открыть в Telegram
        </a>
      )}

      {/* Helper note */}
      <p className="text-[11px] leading-relaxed opacity-70" style={{ color: textSecondary }}>
        Не видите нужного действия? Напишите экипажу — мы поможем разобраться.
      </p>
    </section>
  );
}
