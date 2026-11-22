"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

/**
 * RentalYandexPayCard
 * ──────────────────────────────────────────────────────────────────────────
 * Re-shows the Яндекс PAY payment QR on the rental page (operator-only,
 * same role guard as RentalQrCode). Reads rentals.metadata.yandex_pay —
 * the link persisted at checkout (actions-runtime) — so NO Yandex API call
 * happens here: the QR is rendered client-side from the STORED paymentUrl
 * (same public renderer the claim-QR card uses).
 *
 * Freshness: a Yandex Pay payment link lives ttl=1800s (30 minutes, Merchant
 * API docs). Past that the link still opens but shows «срок оплаты истёк» on
 * Yandex side — the card turns amber and tells the operator to re-issue the
 * payment (new checkout or /api/yandex-pay/qr) instead of trusting the QR.
 */
interface RentalYandexPayCardProps {
  paymentUrl: string;
  amountRub: number | null;
  createdAt: string | null;
  demo: boolean;
  accentColor: string;
  borderColor: string;
  textPrimary: string;
  textSecondary: string;
}

/** Merchant API ttl for a payment link, seconds (pay.yandex.ru/docs). */
const PAYMENT_LINK_TTL_MS = 30 * 60 * 1000;

export function RentalYandexPayCard({
  paymentUrl,
  amountRub,
  createdAt,
  demo,
  accentColor,
  borderColor,
  textPrimary,
  textSecondary,
}: RentalYandexPayCardProps) {
  const [copied, setCopied] = useState(false);

  const createdAtMs = createdAt ? Date.parse(createdAt) : Number.NaN;
  const ageMs = Number.isFinite(createdAtMs) ? Date.now() - createdAtMs : Number.NaN;
  const expired = Number.isFinite(ageMs) ? ageMs > PAYMENT_LINK_TTL_MS : false;

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(paymentUrl)}&color=000000&bgcolor=ffffff`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(paymentUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard not available — the input stays selectable as fallback
    }
  };

  return (
    <div className="rounded-xl border p-3" style={{ borderColor: expired ? "#f59e0b" : borderColor }}>
      <div className="flex items-start gap-3">
        <img
          src={qrImageUrl}
          alt="QR оплаты Яндекс PAY"
          className="h-28 w-28 shrink-0 rounded-lg"
          style={{ border: `1px solid ${borderColor}` }}
          loading="lazy"
        />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-1.5 text-xs font-semibold" style={{ color: textPrimary }}>
            💳 Оплата — Яндекс PAY
            {demo && (
              <span
                className="rounded-full px-1.5 py-0.5 text-[10px] font-bold"
                style={{ backgroundColor: "#f59e0b20", color: "#b45309" }}
              >
                DEMO
              </span>
            )}
          </p>
          {typeof amountRub === "number" && amountRub > 0 && (
            <p className="mt-0.5 text-sm font-bold" style={{ color: textPrimary }}>
              {amountRub.toLocaleString("ru-RU")} ₽
            </p>
          )}
          <p className="mt-1 text-[11px]" style={{ color: textSecondary }}>
            QR уже был отправлен арендатору вместе с договором. Покажите этот код повторно или скопируйте ссылку.
          </p>
          {expired ? (
            <p className="mt-1.5 text-[10px] font-medium" style={{ color: "#b45309" }}>
              ⚠️ Срок жизни платёжной ссылки Яндекс Пэй — 30 минут. Ссылка могла истечь — если арендатор ещё не оплатил,
              переоформите оплату (новый чекаут или POST /api/yandex-pay/qr).
            </p>
          ) : (
            <p className="mt-1.5 text-[10px] font-medium" style={{ color: "#16a34a" }}>
              ✓ Ссылка свежая (жизнь ссылки — 30 минут)
            </p>
          )}
        </div>
      </div>

      {/* Copyable payment link */}
      <div className="mt-2 flex items-center gap-1.5">
        <input
          type="text"
          readOnly
          value={paymentUrl}
          className="flex-1 min-w-0 rounded-lg border px-2 py-1 text-[10px] font-mono outline-none"
          style={{ borderColor, backgroundColor: "transparent", color: textSecondary }}
          onClick={(e) => (e.target as HTMLInputElement).select()}
        />
        <button
          type="button"
          onClick={handleCopy}
          aria-label="Скопировать ссылку оплаты"
          className="shrink-0 rounded-lg p-1.5 transition hover:opacity-80"
          style={{
            backgroundColor: copied ? "#22c55e20" : `${accentColor}20`,
            color: copied ? "#22c55e" : accentColor,
          }}
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
}
