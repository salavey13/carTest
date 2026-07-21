"use client";

import { motion, AnimatePresence } from "framer-motion";
import { FileText, ChevronDown, QrCode } from "lucide-react";
import type { ThemeTokens } from "@/app/franchize/[slug]/leads/hooks/useTheme";

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

const STATUS_META: Record<DocStatus, { color: string; label: string }> = {
  missing: { color: "#ef4444", label: "Отсутствует" },
  pending: { color: "#f59e0b", label: "На проверке" },
  verified: { color: "#22c55e", label: "Проверен" },
  sent: { color: "#3b82f6", label: "Отправлен" },
};

const QR_TONE_COLOR: Record<QrStatus["tone"], string> = {
  danger: "#ef4444",
  warning: "#f59e0b",
  good: "#22c55e",
  neutral: "#a1a1aa",
};

/**
 * Document checklist section.
 * Each row: icon + name + status badge + action button.
 * QR status row at the bottom with a resend button.
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

  return (
    <section className="glass-panel rounded-[24px] p-5">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <FileText className="h-5 w-5" style={{ color: T.accent }} />
          <h3 className="text-lg font-semibold" style={{ color: T.text }}>
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
        <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="h-5 w-5" style={{ color: T.textMuted }} />
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
                return (
                  <div
                    key={doc.key}
                    className="flex items-center justify-between rounded-2xl border p-4"
                    style={{
                      borderColor: "rgba(255,255,255,0.08)",
                      background: "rgba(255,255,255,0.03)",
                    }}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-xl"
                        style={{ background: `${meta.color}1a` }}
                      >
                        <FileText className="h-4 w-4" style={{ color: meta.color }} />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate font-medium" style={{ color: T.text }}>
                          {doc.name}
                        </div>
                        <div className="mt-0.5 text-sm" style={{ color: meta.color }}>
                          {meta.label}
                        </div>
                      </div>
                    </div>
                    {doc.actionLabel && (
                      <button
                        type="button"
                        onClick={doc.onAction}
                        className="shrink-0 text-sm font-medium transition hover:brightness-125"
                        style={{ color: "#93c5fd" }}
                      >
                        {doc.actionLabel}
                      </button>
                    )}
                  </div>
                );
              })}

              {/* QR status row */}
              <div
                className="flex items-center justify-between rounded-2xl border p-4"
                style={{
                  borderColor: `${QR_TONE_COLOR[qrStatus.tone]}33`,
                  background: `${QR_TONE_COLOR[qrStatus.tone]}0d`,
                }}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-xl"
                    style={{ background: `${QR_TONE_COLOR[qrStatus.tone]}1a` }}
                  >
                    <QrCode
                      className="h-4 w-4"
                      style={{ color: QR_TONE_COLOR[qrStatus.tone] }}
                    />
                  </div>
                  <div>
                    <div className="font-medium" style={{ color: T.text }}>
                      QR код аренды
                    </div>
                    <div
                      className="mt-0.5 text-sm"
                      style={{ color: QR_TONE_COLOR[qrStatus.tone] }}
                    >
                      {qrStatus.label}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onRequestResendQr}
                  className="shrink-0 rounded-lg border px-3 py-1.5 text-sm font-medium transition hover:brightness-125"
                  style={{
                    borderColor: "#3b82f64d",
                    background: "#3b82f61a",
                    color: "#93c5fd",
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
