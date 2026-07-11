"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ListOrdered, RefreshCw } from "lucide-react";
import { useAppContext } from "@/contexts/AppContext";
import { getFranchizeCrewRentalsListAction, type FranchizeActivityDigest } from "@/app/franchize/profile-actions";
import { AnalyticsPasswordEntry } from "@/app/franchize/[slug]/rentals-analytics/analytics-components/AnalyticsPasswordEntry";
import { useFranchizeTheme } from "@/app/franchize/hooks/useFranchizeTheme";
import { useCrewTokens } from "@/app/franchize/lib/use-crew-tokens";
import type { FranchizeCrewVM } from "@/app/franchize/actions";

interface RentalsListClientProps {
  initialSlug: string;
  crew: FranchizeCrewVM;
}

type RentalItem = FranchizeActivityDigest["rentals"][number];

export function RentalsListClient({ initialSlug, crew }: RentalsListClientProps) {
  const { dbUser, isLoading: authLoading } = useAppContext();
  const router = useRouter();
  const params = useParams<{ slug: string }>();
  const slug = initialSlug || params?.slug || "vip-bike";

  // Password auth state
  const [showPasswordEntry, setShowPasswordEntry] = useState(false);
  const [passwordAuthOwnerId, setPasswordAuthOwnerId] = useState<string | null>(null);

  // Data state
  const [rentals, setRentals] = useState<RentalItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Theme
  useFranchizeTheme(crew?.theme || { mode: "auto", isAuto: true });
  const T = useCrewTokens(crew?.theme || { mode: "auto", isAuto: true });

  const isAuthed = !!(dbUser?.user_id || passwordAuthOwnerId);

  const getActorUserId = useCallback((): string | null => {
    return dbUser?.user_id || passwordAuthOwnerId;
  }, [dbUser?.user_id, passwordAuthOwnerId]);

  // Show password form immediately if auth is settled and no TG user
  useEffect(() => {
    if (!authLoading && !dbUser && !passwordAuthOwnerId) {
      setShowPasswordEntry(true);
      setIsLoading(false);
    }
  }, [authLoading, dbUser, passwordAuthOwnerId]);

  // Fetch rentals when authenticated and auth is settled
  useEffect(() => {
    if (!isAuthed || authLoading) return;

    const fetchRentals = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await getFranchizeCrewRentalsListAction({
          slug,
          actorUserId: getActorUserId() || undefined,
          isPasswordAuth: !!passwordAuthOwnerId,
        });

        if (result.success && result.data) {
          setRentals(result.data);
        } else {
          setError(result.error || "Не удалось загрузить аренды.");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Ошибка загрузки");
      } finally {
        setIsLoading(false);
      }
    };

    void fetchRentals();
  }, [isAuthed, slug, getActorUserId, passwordAuthOwnerId]);

  const handlePasswordAuth = (ownerId: string) => {
    setPasswordAuthOwnerId(ownerId);
    setShowPasswordEntry(false);
  };

  const statusLabel = (status: string): string => {
    const labels: Record<string, string> = {
      pending_confirmation: "Ожидание",
      confirmed: "Подтверждена",
      active: "Активна",
      completed: "Завершена",
      cancelled: "Отменена",
    };
    return labels[status] || status;
  };

  // Password entry screen
  if (showPasswordEntry) {
    return (
      <AnalyticsPasswordEntry
        crewName={crew?.name || "Экипаж"}
        slug={slug}
        onAuthenticated={handlePasswordAuth}
      />
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="h-8 w-8 animate-spin" style={{ color: T.accent }} />
          <p className="text-sm" style={{ color: T.textMuted }}>Загрузка аренд...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="max-w-md rounded-2xl border p-6 text-center" style={{ borderColor: T.borderSoft, backgroundColor: T.bgCard }}>
          <p className="text-sm" style={{ color: T.text }}>{error}</p>
          <button
            onClick={() => { setIsLoading(true); setError(null); window.location.reload(); }}
            className="mt-4 rounded-xl px-4 py-2 text-sm font-semibold transition hover:opacity-85"
            style={T.styles.ctaPrimary}
          >
            Попробовать снова
          </button>
        </div>
      </div>
    );
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 12 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-4"
    >
      {/* Count summary */}
      <div className="flex items-center gap-4 text-xs" style={{ color: T.textMuted }}>
        <span>Всего: <strong style={{ color: T.text }}>{rentals.length}</strong></span>
        <span>Активных: <strong style={{ color: T.accent }}>
          {rentals.filter((r) => r.status === "active").length}
        </strong></span>
      </div>

      {rentals.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed px-6 py-12 text-center"
          style={{ borderColor: T.borderSoft, backgroundColor: T.bgCard }}>
          <ListOrdered className="mb-3 h-8 w-8" style={{ color: T.textMuted }} />
          <h3 className="text-base font-semibold" style={{ color: T.text }}>
            Нет аренд
          </h3>
          <p className="mt-1 max-w-xs text-sm" style={{ color: T.textMuted }}>
            Аренды экипажа пока не создавались
          </p>
          <Link
            href={`/franchize/${slug}`}
            className="mt-6 rounded-xl px-4 py-2 text-sm font-semibold transition hover:opacity-85"
            style={T.styles.ctaPrimary}
          >
            Каталог байков
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {rentals.map((rental) => (
            <motion.div key={rental.rentalId} variants={itemVariants}>
              <div
                role="button"
                tabIndex={0}
                onClick={() => router.push(rental.docLink)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    router.push(rental.docLink);
                  }
                }}
                className="block cursor-pointer rounded-xl border p-3 text-sm transition hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                style={T.styles.card}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    {rental.vehicleImage && (
                      <img
                        src={rental.vehicleImage}
                        alt={rental.vehicleLabel}
                        className="h-12 w-12 flex-shrink-0 rounded-lg object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                    )}
                    <div>
                      <span className="font-semibold" style={{ color: T.text }}>
                        {rental.vehicleLabel}
                      </span>
                      {rental.agreedStartDate && rental.agreedEndDate && (
                        <p style={{ color: T.textMuted }} className="mt-0.5 text-[11px]">
                          {new Date(rental.agreedStartDate).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
                          {" → "}
                          {new Date(rental.agreedEndDate).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
                        </p>
                      )}
                    </div>
                  </div>
                  {rental.isTestRide ? (
                    <span style={T.styles.accentBadge} className="rounded-full px-2 py-0.5 text-[10px] whitespace-nowrap">
                      Тест-драйв
                    </span>
                  ) : (
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] whitespace-nowrap"
                      style={{
                        ...T.styles.accentPill,
                        opacity: rental.status === "active" ? 1 : 0.6,
                      }}
                    >
                      {statusLabel(rental.status)}
                    </span>
                  )}
                </div>
                {rental.status === "active" && (
                  <div className="mt-2 flex items-center justify-end gap-2 border-t pt-2"
                    style={{ borderColor: T.borderSoft }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/franchize/${slug}?vehicle=${rental.vehicleId}`);
                      }}
                      className="flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold transition hover:opacity-85"
                      style={T.styles.ctaPrimary}
                    >
                      Продлить
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
