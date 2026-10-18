"use client";

// app/franchize/components/VerificationResendButton.tsx
//
// Reusable «🤝 выслать сверку в TG» button (owner-tier enforced server-side
// by resendVerificationDmsAction). Used on:
//   • the single-rental page (/franchize/[slug]/rental/[id])
//   • the salary verification strip
//   • the season-stats page
// Renders nothing for non-completed rentals unless `force` is set.

import { useState } from "react";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { resendVerificationDmsAction } from "@/app/franchize/server-actions/rental-verify-actions";

interface Props {
  slug: string;
  rentalId: string;
  /** Show the button even if the rental is not completed (server still rejects). */
  force?: boolean;
  label?: string;
  /** Compact icon-only variant (tables/lists). */
  compact?: boolean;
  accentColor?: string;
  borderColor?: string;
  className?: string;
}

export function VerificationResendButton({
  slug,
  rentalId,
  force = false,
  label,
  compact = false,
  accentColor = "#f59e0b",
  borderColor,
  className = "",
}: Props) {
  const [busy, setBusy] = useState(false);

  const send = async () => {
    setBusy(true);
    try {
      const res = await resendVerificationDmsAction({ slug, rentalId });
      if (res.success) {
        toast.success("🤝 Сверка выслана в Telegram");
      } else {
        toast.error(res.error || "Не удалось выслать сверку.");
      }
    } catch {
      toast.error("Сеть недоступна — попробуйте ещё раз.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={send}
      disabled={busy}
      title="Выслать сверку расчёта в Telegram (владелец/админ)"
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg border font-semibold transition hover:opacity-80 disabled:opacity-50 ${className}`}
      style={{
        borderColor: borderColor || accentColor,
        color: accentColor,
        padding: compact ? "2px 8px" : "8px 14px",
        fontSize: compact ? 11 : 13,
      }}
    >
      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
      {compact ? "🤝" : label || "Выслать сверку в TG"}
    </button>
  );
}
