'use client';

import { useAppContext } from '@/contexts/AppContext';
import { useFranchizeTheme } from '../../../hooks/useFranchizeTheme';
import { crewPaletteForSurface } from '../../../lib/theme';
import { redirect } from 'next/navigation';
import { useEffect, useState } from 'react';

interface RentalRow {
  rentalId: string;
  userId: string;
  vehicleId: string;
  bikeName: string;
  bikeSpecs: any;
  startDate: string;
  endDate: string;
  totalCost: number;
  status: string;
  paymentStatus: string;
  renterName: string;
}

interface AnalyticsSummary {
  count: number;
  revenue: number;
  date: string;
}

interface AnalyticsClientProps {
  crew: any;
  slug: string;
  rentals: RentalRow[];
  summary: AnalyticsSummary | null;
  error: string | null;
}

export function AnalyticsClient({
  crew,
  slug,
  rentals,
  summary,
  error,
}: AnalyticsClientProps) {
  const { dbUser } = useAppContext();
  const [isMember, setIsMember] = useState(false);
  const [checkingMember, setCheckingMember] = useState(true);
  const theme = useFranchizeTheme(crew.theme);
  const surface = crewPaletteForSurface(crew.theme);

  // Check crew membership on mount
  useEffect(() => {
    const checkMembership = async () => {
      if (!dbUser?.user_id) {
        setCheckingMember(false);
        setIsMember(false);
        return;
      }

      try {
        // Authorization is now handled server-side in getTodayRentalsAnalytics
        // Client-side state tracking only for UI purposes
        setIsMember(true);
      } catch (err) {
        console.error('[Analytics] Membership check failed:', err);
        setIsMember(false);
      } finally {
        setCheckingMember(false);
      }
    };

    checkMembership();
  }, [dbUser?.user_id, crew.id]);

  // While checking membership, show loading
  if (checkingMember) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <p className="text-muted-foreground">Загрузка...</p>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center p-6">
        <p className="text-destructive mb-4">Ошибка загрузки данных</p>
        <p className="text-muted-foreground text-sm">{error}</p>
      </div>
    );
  }

  // Format date for display
  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('ru-RU') + ' ₽';
  };

  // Empty state
  if (!rentals.length) {
    return (
      <div className="min-h-[400px] flex flex-col items-center justify-center p-6">
        <p className="text-muted-foreground text-lg mb-2">📊</p>
        <p className="text-muted-foreground">Сегодня аренд пока нет</p>
      </div>
    );
  }

  return (
    <div
      className="container mx-auto max-w-4xl px-4 py-8"
      style={{
        ['--analytics-bg' as string]: theme.isAuto
          ? 'var(--franchize-bg-base)'
          : crew.theme.palette.bgBase,
        ['--analytics-card' as string]: theme.isAuto
          ? 'var(--franchize-bg-card)'
          : crew.theme.palette.bgCard,
        ['--analytics-text' as string]: theme.isAuto
          ? 'var(--franchize-text-primary)'
          : crew.theme.palette.textPrimary,
        ['--analytics-muted' as string]: theme.isAuto
          ? 'var(--franchize-text-secondary)'
          : crew.theme.palette.textSecondary,
        ['--analytics-accent' as string]: theme.isAuto
          ? 'var(--franchize-accent-main)'
          : crew.theme.palette.accentMain,
      }}
    >
      {/* Header */}
      <div className="mb-8">
        <h1
          className="text-3xl font-bold uppercase tracking-tight mb-2"
          style={{ color: 'var(--analytics-text)' }}
        >
          Аналитика аренд
        </h1>
        <p className="text-sm" style={{ color: 'var(--analytics-muted)' }}>
          {summary?.date || new Date().toLocaleDateString('ru-RU')}
        </p>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div
            className="rounded-2xl border p-6 text-center"
            style={{
              backgroundColor: 'var(--analytics-card)',
              borderColor: theme.isAuto
                ? 'var(--franchize-border-soft)'
                : crew.theme.palette.borderSoft,
            }}
          >
            <p className="text-sm mb-2" style={{ color: 'var(--analytics-muted)' }}>
              Аренд сегодня
            </p>
            <p
              className="text-4xl font-bold"
              style={{ color: 'var(--analytics-accent)' }}
            >
              {summary.count}
            </p>
          </div>

          <div
            className="rounded-2xl border p-6 text-center"
            style={{
              backgroundColor: 'var(--analytics-card)',
              borderColor: theme.isAuto
                ? 'var(--franchize-border-soft)'
                : crew.theme.palette.borderSoft,
            }}
          >
            <p className="text-sm mb-2" style={{ color: 'var(--analytics-muted)' }}>
              💰 Выручка
            </p>
            <p
              className="text-4xl font-bold"
              style={{ color: 'var(--analytics-accent)' }}
            >
              {formatCurrency(summary.revenue)}
            </p>
          </div>
        </div>
      )}

      {/* Rentals List */}
      <div>
        <h2
          className="text-xl font-bold uppercase tracking-tight mb-4"
          style={{ color: 'var(--analytics-text)' }}
        >
          Список аренд на сегодня
        </h2>

        <div className="space-y-3">
          {rentals.map((rental) => (
            <div
              key={rental.rentalId}
              className="rounded-xl border p-4"
              style={{
                backgroundColor: 'var(--analytics-card)',
                borderColor: theme.isAuto
                  ? 'var(--franchize-border-soft)'
                  : crew.theme.palette.borderSoft,
              }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <p
                    className="font-semibold text-lg mb-1"
                    style={{ color: 'var(--analytics-text)' }}
                  >
                    🏍 {rental.bikeName}
                  </p>
                  <p className="text-sm mb-2" style={{ color: 'var(--analytics-muted)' }}>
                    {rental.renterName}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--analytics-muted)' }}>
                    {formatDate(rental.startDate)} {formatTime(rental.startDate)} →{' '}
                    {formatDate(rental.endDate)} {formatTime(rental.endDate)}
                  </p>
                </div>
                <div className="text-right">
                  <p
                    className="text-lg font-bold"
                    style={{ color: 'var(--analytics-accent)' }}
                  >
                    {formatCurrency(rental.totalCost)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
