"use client";

// profile-shared.tsx
// ──────────────────────────────────────────────────────────────────────────
// iter31 profile refactor: the former ProfileClient.tsx grew past 2.5k
// lines, so the page was split into per-domain panel components. This
// module holds the atoms every panel shares: motion variants, currency /
// date helpers, rental status labels, the skeleton and the empty state.
//
// IMPORTANT: the shell CSS variables (--franchize-shell-*) are set on the
// root motion.div in ProfileClient; atoms below rely on them cascading.

import Link from "next/link";
import { motion } from "framer-motion";
import { useCrewTokens } from "@/app/franchize/lib/use-crew-tokens";

export type CrewTokens = ReturnType<typeof useCrewTokens>;

/** router.push wrapper — profile cards must SPA-navigate (no hard reload). */
export type SpaNavigate = (href: string) => void;

// ── motion variants ──────────────────────────────────────────────────────────

export const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

export const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

// ── helpers ──────────────────────────────────────────────────────────────────

/** iter26: today's date as "YYYY-MM-DD" in Europe/Moscow (server runs UTC). */
export function todayMskIso(): string {
  return new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** iter26: shift a "YYYY-MM-DD" day key by ±N days (MSK-safe, no DST in MSK). */
export function shiftDateKey(key: string, deltaDays: number): string {
  const [y, m, d] = key.split("-").map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return todayMskIso();
  return new Date(Date.UTC(y, m - 1, d + deltaDays)).toISOString().slice(0, 10);
}

/** Currency formatter (₽, no fractional digits) reused by every panel. */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/** "август 2026" label for a YYYY-MM key. */
export function monthLabel(monthKey: string): string {
  try {
    const [y, m] = monthKey.split("-").map(Number);
    const label = new Date(y, m - 1, 1).toLocaleDateString("ru-RU", {
      month: "long",
      year: "numeric",
    });
    return label.charAt(0).toUpperCase() + label.slice(1);
  } catch {
    return monthKey;
  }
}

/** Rental status → human label (shared by rentals + subrent panels). */
export const RENTAL_STATUS_LABELS: Record<string, string> = {
  active: "Активна",
  completed: "Завершена",
  cancelled: "Отменена",
  disputed: "Спорная",
  confirmed: "Подтверждена",
  pending_confirmation: "Ждёт подтверждения",
};

export function rentalStatusLabel(status: string): string {
  return RENTAL_STATUS_LABELS[status] || status;
}

/** Treat confirmed-but-not-yet-finished as «живая» аренда for badges. */
export function isLiveRentalStatus(status: string): boolean {
  return status === "active" || status === "confirmed";
}

// ── atoms ────────────────────────────────────────────────────────────────────

// m7 (iter32 review): the old `PanelSection` wrapper was removed — it was
// exported but never used; each panel composes motion.div + FranchizeOperatorPanel
// directly (kept inline so per-panel props like muted stay explicit).

// Loading skeleton component
export function ProfileSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="h-32 animate-pulse rounded-2xl border"
          style={{
            borderColor: "var(--franchize-shell-border)",
            backgroundColor: "color-mix(in srgb, var(--franchize-shell-card) 50%, transparent)",
          }}
        />
      ))}
    </div>
  );
}

// Empty state component
export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  actionHref,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed p-8 text-center">
      <div
        className="mb-4 flex h-16 w-16 items-center justify-center rounded-full"
        style={{
          backgroundColor: "color-mix(in srgb, var(--franchize-shell-accent) 12%, transparent)",
          color: "var(--franchize-shell-accent)",
        }}
      >
        {icon}
      </div>
      <p className="font-semibold" style={{ color: "var(--franchize-shell-text)" }}>
        {title}
      </p>
      <p className="mt-1 text-sm" style={{ color: "var(--franchize-shell-muted)" }}>
        {description}
      </p>
      {actionLabel && actionHref && (
        <Link
          href={actionHref}
          className="mt-4 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition hover:opacity-90"
          style={{
            backgroundColor: "var(--franchize-shell-accent)",
            color: "var(--franchize-shell-primary-contrast)",
          }}
        >
          {actionLabel}
        </Link>
      )}
    </div>
  );
}

// ── shared state shapes (previously inline in ProfileClient) ────────────────

export type RentalSecretsState = {
  hasPreviousRentals: boolean;
  lastRentalDate?: string;
  savedData?: {
    fullName: string;
    phone: string;
    passport: string;
    driverLicense: string;
    birthDate: string;
    licenseExpiryDate: string;
    licenseCategories: string;
  };
};

export type ProfileDocsStatusState = {
  passportMainpage: { uploaded: boolean; verified: boolean };
  passportRegistration: { uploaded: boolean; verified: boolean };
  driversLicence: { uploaded: boolean; verified: boolean };
};

/** Owner-cash quick add form values (form state lives in the wallet panel). */
export type OwnerCashFormValues = {
  direction: "in" | "out";
  kind: "personal" | "subrenter_payout" | "other";
  amount: string;
  title: string;
  person: string;
};
