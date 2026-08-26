"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAppContext } from "@/contexts/AppContext";
import { signRentalContractPep } from "@/app/rentals/actions";
import { Camera, Download, MessageSquare, ExternalLink, FileText, PenLine, ShieldCheck } from "lucide-react";

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
  /** Rental status — ПЭП sign button hidden for cancelled rentals */
  rentalStatus?: string;
  /** metadata.pep_signature — present once the renter signed (ПЭП, ст. 5–6 ФЗ-63) */
  pepSignature?: { telegram_id?: string; username?: string | null; signed_at?: string; doc_sha256?: string } | null;
  /** metadata.doc_sha256 — the CURRENT document fingerprint (stale-signature detection) */
  currentDocSha?: string | null;
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
  rentalStatus,
  pepSignature,
  currentDocSha,
  accentColor,
  accentTextOn,
  borderColor,
  textPrimary,
  textSecondary,
}: RenterActionsPanelProps) {
  const { dbUser } = useAppContext();
  const router = useRouter();
  const [isSigning, startSigningTransition] = useTransition();
  const [justSigned, setJustSigned] = useState(false);

  const isRenter = useMemo(() => {
    if (!dbUser?.user_id) return false;
    if (renterId && dbUser.user_id === renterId) return true;
    if (renterTelegramChatId && dbUser.user_id === renterTelegramChatId) return true;
    return false;
  }, [dbUser?.user_id, renterId, renterTelegramChatId]);

  const signedPep = pepSignature?.signed_at ? pepSignature : (justSigned ? { signed_at: "now" } : null);

  // Stale signature: the document was regenerated AFTER the renter signed
  // (e.g. via /doc) — the ПЭП record binds to the OLD document's SHA-256, so
  // the renter should re-sign the current version.
  const isSignatureStale = Boolean(
    signedPep &&
    !justSigned &&
    signedPep !== null &&
    typeof signedPep.doc_sha256 === "string" &&
    signedPep.doc_sha256.length > 0 &&
    typeof currentDocSha === "string" &&
    currentDocSha.length > 0 &&
    signedPep.doc_sha256 !== currentDocSha,
  );

  const handleSignPep = () => {
    if (!dbUser?.user_id) {
      toast.error("Нужна авторизация в Telegram WebApp.");
      return;
    }
    let initData = "";
    try {
      initData = String((window as any).Telegram?.WebApp?.initData || "");
    } catch {
      // falls to the length check below
    }
    if (initData.length < 32) {
      toast.error("Подпись доступна в Telegram — откройте страницу через бота.");
      return;
    }
    startSigningTransition(async () => {
      const result = await signRentalContractPep(rentalId, dbUser!.user_id, initData);
      if (!result.success) {
        toast.error(result.error || "Не удалось подписать договор.");
        return;
      }
      setJustSigned(true);
      toast.success(
        isSignatureStale
          ? "Текущая версия договора подписана вашей ПЭП (п. 12.3)."
          : "Договор подписан вашей ПЭП — бумажная подпись не нужна (п. 12.3).",
      );
      router.refresh();
    });
  };

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

      {/* ── ПЭП signature (ст. 5–6 ФЗ-63) ──
          Signed → green confirmation card with signature details.
          Unsigned → «Подписать договор» button (renter-only, Telegram only). */}
      {signedPep ? (
        <div
          className="flex items-center gap-3 rounded-xl border p-3"
          style={{ borderColor: accentColor, backgroundColor: `${accentColor}10` }}
        >
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
            style={{ backgroundColor: `${accentColor}25`, color: accentColor }}
          >
            <ShieldCheck className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold" style={{ color: textPrimary }}>
              Договор подписан ПЭП
            </p>
            <p className="text-xs" style={{ color: textSecondary }}>
              {signedPep.telegram_id ? `Telegram ID ${signedPep.telegram_id}${signedPep.username ? ` (@${signedPep.username})` : ""}` : "Ваш аккаунт Telegram"}
              {signedPep.signed_at && signedPep.signed_at !== "now"
                ? ` · ${new Date(signedPep.signed_at).toLocaleString("ru-RU")}`
                : ""}
            </p>
            {signedPep.doc_sha256 && (
              <p className="mt-0.5 truncate font-mono text-[10px]" style={{ color: textSecondary }}>
                SHA-256: {signedPep.doc_sha256.slice(0, 24)}…
              </p>
            )}
            {isSignatureStale && (
              <p className="mt-1 rounded-md px-2 py-1 text-[11px] font-medium" style={{ color: "#b45309", backgroundColor: "rgba(245, 158, 11, 0.12)" }}>
                ⚠ Документ обновлён после подписи — подпись относится к предыдущей версии
              </p>
            )}
          </div>
        </div>
      ) : null}

      {/* Stale signature → offer re-signing the CURRENT document version.
          (The server replaces the old record atomically — see signRentalContractPep.) */}
      {isSignatureStale && rentalStatus !== "cancelled" && (
        <button
          type="button"
          onClick={handleSignPep}
          disabled={isSigning}
          className="flex w-full items-center gap-3 rounded-xl border p-3 text-left transition hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-50"
          style={{ borderColor: "#b45309", backgroundColor: "rgba(245, 158, 11, 0.08)" }}
        >
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
            style={{ backgroundColor: "rgba(245, 158, 11, 0.18)", color: "#b45309" }}
          >
            <PenLine className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold" style={{ color: textPrimary }}>
              {isSigning ? "Подписываем…" : "Подписать текущую версию (ПЭП)"}
            </p>
            <p className="text-xs" style={{ color: textSecondary }}>
              Подпись привяжется к актуальному документу (п. 12.3 договора)
            </p>
          </div>
        </button>
      )}

      {!signedPep && rentalStatus !== "cancelled" ? (
        <button
          type="button"
          onClick={handleSignPep}
          disabled={isSigning}
          className="flex w-full items-center gap-3 rounded-xl border p-3 text-left transition hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-50"
          style={{ borderColor: accentColor, backgroundColor: `${accentColor}08` }}
        >
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
            style={{ backgroundColor: `${accentColor}25`, color: accentColor }}
          >
            <PenLine className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold" style={{ color: textPrimary }}>
              {isSigning ? "Подписываем…" : "Подписать договор (ПЭП)"}
            </p>
            <p className="text-xs" style={{ color: textSecondary }}>
              Подпишите прямо в Telegram — без печати и бумаги (п. 12.3 договора)
            </p>
          </div>
        </button>
      ) : null}

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
