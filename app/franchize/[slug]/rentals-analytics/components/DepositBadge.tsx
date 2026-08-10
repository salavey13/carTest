// /app/franchize/[slug]/rentals-analytics/components/DepositBadge.tsx
"use client";

import { useEffect, useState } from "react";
import { Wallet } from "lucide-react";
import type { ThemeTokens } from "../../hooks/useTheme";

interface DepositBadgeProps {
  rentalId: string;
  T: ThemeTokens;
}

interface DepositSummary {
  totalCollected: number;
  totalReturned: number;
  totalPenalty: number;
  balance: number;
  destinations: Array<{ destination: string; collected: number; returned: number; penalty: number; net: number }>;
}

/**
 * Compact deposit badge for rental cards.
 * Fetches deposit entries for this rental and shows:
 * - If collected: 💰 20к (💵5к 💳Т15к) → returned
 * - If not collected: nothing (badge hidden)
 * - If penalty: red ⚠️ 3к
 *
 * Fetches on mount — small API call, cached in state.
 */
export function DepositBadge({ rentalId, T }: DepositBadgeProps) {
  const [summary, setSummary] = useState<DepositSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const resp = await fetch(`/api/franchize/deposit-summary?rentalId=${rentalId}`);
        if (resp.ok) {
          const data = await resp.json();
          if (!cancelled && data) setSummary(data);
        }
      } catch {
        // silent fail — badge is non-critical
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [rentalId]);

  if (loading || !summary || summary.totalCollected === 0) return null;

  const formatShort = (n: number) => {
    if (n >= 1000) return `${Math.round(n / 1000)}к`;
    return String(n);
  };

  const destIcons: Record<string, string> = { cash: "💵", tbank: "💳Т", sber: "💳С" };

  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] md:text-[11px]"
      style={{ color: T.textFaint }}
    >
      <Wallet className="h-3 w-3" aria-hidden />
      <span className="font-medium" style={{ color: T.textMuted }}>
        {formatShort(summary.totalCollected)}₽
      </span>
      {summary.destinations.map((d) => (
        <span key={d.destination} className="hidden sm:inline">
          {destIcons[d.destination] || "💳"}{formatShort(d.collected)}
        </span>
      ))}
      {summary.totalReturned > 0 && (
        <span style={{ color: "#3b82f6" }}>→ возвр.</span>
      )}
      {summary.totalPenalty > 0 && (
        <span style={{ color: "#ef4444" }}>⚠{formatShort(summary.totalPenalty)}</span>
      )}
    </span>
  );
}
