"use client";

import { useState } from "react";
import { Copy, Check, ExternalLink } from "lucide-react";

/**
 * RentalQrCode
 * ──────────────────────────────────────────────────────────────────────────
 * Shows the QR code for a rental on the rental page (operator-only).
 * Includes a copyable deep link so the operator can send it via DM or SMS.
 *
 * QR deep link format (matches doc-manual.ts):
 *   https://t.me/<bot>/app?startapp=rent_<vehicleId>_<docSha256>
 *
 * The QR image is generated via api.qrserver.com (same as /doc command).
 * The full deep link is shown as copyable text below the QR image.
 */
interface RentalQrCodeProps {
  vehicleId: string;
  docSha256: string;
  botUsername: string;
  accentColor: string;
  borderColor: string;
  textPrimary: string;
  textSecondary: string;
}

export function RentalQrCode({
  vehicleId,
  docSha256,
  botUsername,
  accentColor,
  borderColor,
  textPrimary,
  textSecondary,
}: RentalQrCodeProps) {
  const [copied, setCopied] = useState(false);

  const deepLink = `https://t.me/${botUsername}/app?startapp=rent_${vehicleId}_${docSha256}`;
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(deepLink)}&color=000000&bgcolor=ffffff`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(deepLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard not available — select the text input as fallback
    }
  };

  return (
    <div className="rounded-xl border p-3 flex items-start gap-3" style={{ borderColor }}>
      <img
        src={qrImageUrl}
        alt="QR код для арендатора"
        className="h-24 w-24 shrink-0 rounded-lg"
        loading="lazy"
      />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold" style={{ color: textPrimary }}>
          📲 QR-код для арендатора
        </p>
        <p className="text-[11px] mt-0.5" style={{ color: textSecondary }}>
          Покажите код арендатору или отправьте ссылку ниже в личное сообщение / SMS.
        </p>

        {/* Copyable deep link */}
        <div className="mt-2 flex items-center gap-1.5">
          <input
            type="text"
            readOnly
            value={deepLink}
            className="flex-1 min-w-0 rounded-lg border px-2 py-1 text-[10px] font-mono outline-none"
            style={{
              borderColor,
              backgroundColor: "transparent",
              color: textSecondary,
            }}
            onClick={(e) => (e.target as HTMLInputElement).select()}
          />
          <button
            type="button"
            onClick={handleCopy}
            aria-label="Скопировать ссылку"
            className="shrink-0 rounded-lg p-1.5 transition hover:opacity-80"
            style={{
              backgroundColor: copied ? "#22c55e20" : `${accentColor}20`,
              color: copied ? "#22c55e" : accentColor,
            }}
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
          <a
            href={deepLink}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Открыть ссылку"
            className="shrink-0 rounded-lg p-1.5 transition hover:opacity-80"
            style={{ color: textSecondary }}
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>

        {/* Copy confirmation */}
        {copied && (
          <p className="mt-1 text-[10px] font-semibold" style={{ color: "#22c55e" }}>
            ✓ Ссылка скопирована — вставьте в чат или SMS
          </p>
        )}
      </div>
    </div>
  );
}
