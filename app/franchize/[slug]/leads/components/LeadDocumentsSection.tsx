"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  ChevronDown,
  QrCode,
  CheckCircle2,
  Clock,
  XCircle,
  Minus,
  type LucideIcon,
} from "lucide-react";
import type { ThemeTokens } from "../hooks/useTheme";

export type DocStatus = "missing" | "pending" | "verified" | "sent";

export interface DocumentItem {
  key: string;
  name: string;
  status: DocStatus;
  actionLabel?: string;
  onAction?: () => void;
}

export interface QrStatus {
  label: string;
  tone: "danger" | "warning" | "good" | "neutral";
}

interface Props {
  documents: DocumentItem[];
  qrStatus: QrStatus;
  expanded: boolean;
  onToggle: () => void;
  onRequestResendQr: () => void;
  T: ThemeTokens;
}

const STATUS_META: Record<
  DocStatus,
  { color: string; label: string; icon: LucideIcon }
> = {
  missing: { color: "#ef4444", label: "Отсутствует", icon: XCircle },
  pending: { color: "#f59e0b", label: "На проверке", icon: Clock },
  verified: { color: "#22c55e", label: "Проверен", icon: CheckCircle2 },
  sent: { color: "#3b82f6", label: "Отправлен", icon: Minus },
};

/**
 * Resolve a QR tone to a hex color. Semantic tones (danger/warning/good) use
 * fixed colors so the severity reads consistently across light/dark themes.
 * `neutral` falls back to the theme's textFaint token so it adapts.
 */
function qrToneColor(tone: QrStatus["tone"], T: ThemeTokens): string {
  switch (tone) {
    case "danger":
      return "#ef4444";
    case "warning":
      return "#f59e0b";
    case "good":
      return "#22c55e";
    case "neutral":
    default:
      return T.textFaint;
  }
}

/**
 * Document checklist section.
 *
 * Each row:
 *   - Status icon on the left (✓ green / ⏳ yellow / ✗ red / — gray).
 *   - Document name + status label.
 *   - Action link ("Запросить" / "Открыть" / "Verify") right-aligned, in
 *     the accent color (T.accent) for clear affordance.
 *
 * QR status row at the bottom with a resend button (accent-styled).
 */
export function LeadDocumentsSection({
  documents,
  qrStatus,
  expanded,
  onToggle,
  onRequestResendQr,
  T,
}: Props) {
  const missingCount = documents.filter((d) => d.status === "missing").length;
  const qrColor = qrToneColor(qrStatus.tone, T);

  return (
    <section className="glass-panel rounded-[24px] p-4 sm:p-5">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex min-h-[44px] w-full cursor-pointer items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <FileText className="h-5 w-5" style={{ color: T.accent }} aria-hidden />
          <h3 className="text-base font-semibold md:text-lg" style={{ color: T.text }}>
            Документы
          </h3>
          {missingCount > 0 && (
            <span
              className="rounded-full px-2 py-0.5 text-[11px] font-medium"
              style={{ background: "#ef444420", color: "#ef4444" }}
            >
              {missingCount} отсутствует
            </span>
          )}
        </div>
        <motion.div
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="h-5 w-5" style={{ color: T.textMuted }} aria-hidden />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 240 }}
            className="overflow-hidden"
          >
            <div className="mt-4 space-y-3">
              {documents.map((doc) => {
                const meta = STATUS_META[doc.status];
                const StatusIcon = meta.icon;
                return (
                  <div
                    key={doc.key}
                    className="flex min-h-[44px] items-center justify-between rounded-2xl border p-3 sm:p-4"
                    style={{
                      borderColor: T.border,
                      background: T.bgCard,
                    }}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-xl"
                        style={{ background: `${meta.color}1a` }}
                        aria-hidden
                      >
                        <StatusIcon className="h-4 w-4" style={{ color: meta.color }} />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium" style={{ color: T.text }}>
                          {doc.name}
                        </div>
                        <div className="mt-0.5 text-xs" style={{ color: meta.color }}>
                          {meta.label}
                        </div>
                      </div>
                    </div>
                    {doc.actionLabel && (
                      <button
                        type="button"
                        onClick={doc.onAction}
                        className="shrink-0 cursor-pointer text-sm font-medium transition"
                        style={{ color: T.accent }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.opacity = "0.75";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.opacity = "1";
                        }}
                      >
                        {doc.actionLabel}
                      </button>
                    )}
                  </div>
                );
              })}

              {/* QR status row */}
              <div
                className="flex min-h-[44px] items-center justify-between rounded-2xl border p-3 sm:p-4"
                style={{
                  borderColor: `${qrColor}33`,
                  background: `${qrColor}0d`,
                }}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-xl"
                    style={{ background: `${qrColor}1a` }}
                    aria-hidden
                  >
                    <QrCode className="h-4 w-4" style={{ color: qrColor }} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium" style={{ color: T.text }}>
                      QR код аренды
                    </div>
                    <div className="mt-0.5 text-xs" style={{ color: qrColor }}>
                      {qrStatus.label}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onRequestResendQr}
                  className="shrink-0 cursor-pointer rounded-lg border px-3 py-1.5 text-sm font-medium transition"
                  style={{
                    borderColor: `${T.accent}4d`,
                    background: `${T.accent}1a`,
                    color: T.accent,
                  }}
                >
                  Переслать QR
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
