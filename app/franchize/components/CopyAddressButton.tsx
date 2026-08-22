"use client";

import { useState } from "react";
import { Check, Copy, TriangleAlert } from "lucide-react";

import { upsertFranchizeIntent } from "@/app/franchize/actions";
import { useAppContext } from "@/contexts/AppContext";

interface CopyAddressButtonProps {
  address: string;
  slug?: string;
  sourceRoute?: string;
}

type CopyStatus = "idle" | "copied" | "error";

function copyWithTextareaFallback(text: string) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();

  try {
    return document.execCommand("copy");
  } finally {
    document.body.removeChild(textarea);
  }
}

export function CopyAddressButton({ address, slug, sourceRoute }: CopyAddressButtonProps) {
  const [status, setStatus] = useState<CopyStatus>("idle");
  const { user, dbUser } = useAppContext();

  const handleCopy = async () => {
    if (!address) {
      return;
    }

    const clipboard = navigator.clipboard;
    const copied = await Promise.resolve(
      clipboard
        ? clipboard.writeText(address).then(() => true, () => copyWithTextareaFallback(address))
        : copyWithTextareaFallback(address),
    ).catch(() => false);

    if (slug) {
      void upsertFranchizeIntent({
        slug,
        intentType: "map_click",
        stage: "clicked",
        sourceRoute: sourceRoute ?? `/franchize/${slug}/contacts`,
        contactChannel: "address_copy",
        urgencyScore: 50,
        telegramUserId: user?.id ? String(user.id) : dbUser?.user_id ? String(dbUser.user_id) : undefined,
        phone: typeof (dbUser as { phone?: unknown } | null)?.phone === "string" ? (dbUser as { phone?: string } | null)?.phone : undefined,
        metadata: { address, copied },
      }).catch((error) => console.warn("address intent tracking failed", error));
    }

    setStatus(copied ? "copied" : "error");
    window.setTimeout(() => setStatus("idle"), 1800);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--crew-border)] px-4 py-2 text-sm font-semibold text-[var(--crew-text)] transition hover:border-[var(--crew-accent)] hover:text-[var(--crew-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--crew-accent)]"
      aria-live="polite"
    >
      {status === "copied" ? <Check className="h-4 w-4" /> : null}
      {status === "error" ? <TriangleAlert className="h-4 w-4" /> : null}
      {status === "idle" ? <Copy className="h-4 w-4" /> : null}
      {status === "copied" ? "Адрес скопирован" : null}
      {status === "error" ? "Скопируйте вручную" : null}
      {status === "idle" ? "Скопировать адрес" : null}
    </button>
  );
}
