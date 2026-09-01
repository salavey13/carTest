"use client";

// MyWorkPanel — «Моя работа» (CREW ONLY): per-day shift/commission/sales
// stats with a date picker (iter26). Self-contained since iter31: owns its
// date state + fetch, so picking days refetches only this panel.

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Briefcase, ChevronLeft, ChevronRight } from "lucide-react";
import { FranchizeOperatorPanel } from "@/app/franchize/components/FranchizeOperatorSurface";
import {
  getMyWorkDayAction,
  type MyWorkRentalDetail,
  type MyWorkSaleDetail,
} from "@/app/franchize/server-actions/my-work";
import {
  formatCurrency,
  itemVariants,
  shiftDateKey,
  todayMskIso,
  type CrewTokens,
} from "./profile-shared";

type MyWorkData = {
  date: string;
  isToday: boolean;
  shifts: { count: number; total: number };
  rentals: { count: number; revenue: number; salary: number };
  sales: { count: number; total: number; revenue: number };
  serviceReturns: { count: number; total: number };
  totalDay: number;
  rentalDetails: MyWorkRentalDetail[];
  saleDetails: MyWorkSaleDetail[];
};

export function MyWorkPanel({
  slug,
  enabled,
  T,
}: {
  slug: string;
  /** false → the parent doesn't render the panel (crew gate). */
  enabled: boolean;
  T: CrewTokens;
}) {
  const [workDate, setWorkDate] = useState<string>(() => todayMskIso());
  const [myWork, setMyWork] = useState<MyWorkData | null>(null);
  const [workLoading, setWorkLoading] = useState(true);

  // iter26: date picker — refetch the My Work section when the picked day
  // changes. Ignores garbage dates (the action would fall back to "today"
  // and mismatch the picker forever).
  const shiftWorkDate = (deltaDays: number) => {
    const next = shiftDateKey(workDate, deltaDays);
    const cap = todayMskIso();
    setWorkDate(next > cap ? cap : next);
  };

  useEffect(() => {
    if (!enabled) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(workDate)) return;
    if (workDate === myWork?.date) return;
    let cancelled = false;
    setWorkLoading(true);
    getMyWorkDayAction({ slug, date: workDate })
      .then((res) => {
        if (!cancelled && res.success && res.data) setMyWork(res.data);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setWorkLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workDate, enabled, slug, myWork?.date]);

  return (
    <motion.div variants={itemVariants}>
      <FranchizeOperatorPanel>
        <h2 className="flex items-center gap-2 text-base font-semibold" style={{ color: T.text }}>
          <Briefcase className="h-4 w-4" /> Моя работа
        </h2>
        {workLoading ? (
          <div className="py-4 text-center text-sm" style={{ color: T.textMuted }}>
            Загрузка данных...
          </div>
        ) : myWork ? (
          <div className="mt-3 space-y-4">
            {/* iter26: date picker — any day, not just today (client wish:
                «хочу date picker, чтобы видеть зарплату за прошлые дни»). */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                aria-label="Предыдущий день"
                onClick={() => shiftWorkDate(-1)}
                className="inline-flex items-center justify-center rounded-lg border transition focus:outline-none focus-visible:ring-2"
                style={{ borderColor: T.borderSoft, color: T.text, minHeight: "36px", minWidth: "36px" }}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <input
                type="date"
                value={workDate}
                max={todayMskIso()}
                onChange={(e) => e.target.value && setWorkDate(e.target.value)}
                className="rounded-lg border px-2.5 py-1.5 text-xs tabular-nums"
                style={{ borderColor: T.borderSoft, color: T.text, backgroundColor: T.bgCard }}
                aria-label="Дата работы"
              />
              <button
                type="button"
                aria-label="Следующий день"
                disabled={myWork.isToday}
                onClick={() => shiftWorkDate(1)}
                className="inline-flex items-center justify-center rounded-lg border transition focus:outline-none focus-visible:ring-2 disabled:opacity-40"
                style={{ borderColor: T.borderSoft, color: T.text, minHeight: "36px", minWidth: "36px" }}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              {!myWork.isToday && (
                <button
                  type="button"
                  onClick={() => setWorkDate(todayMskIso())}
                  className="rounded-lg border px-3 py-1.5 text-xs font-semibold transition focus:outline-none focus-visible:ring-2"
                  style={{ borderColor: T.borderSoft, color: T.accent }}
                >
                  Сегодня
                </button>
              )}
              <span className="ml-auto text-sm" style={{ color: T.textMuted }}>
                {myWork.isToday ? "Сегодня: " : ""}
                {new Date(`${myWork.date}T12:00:00Z`).toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" })}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {/* Аренды — real rentals attributed to me; salary matches the
                  analytics table view «ЗП Аренда» 1:1 (same engine). */}
              <div className="rounded-lg border p-3" style={{ borderColor: T.borderSoft, backgroundColor: T.bgCard }}>
                <p className="text-xs" style={{ color: T.textMuted }}>Аренды (ЗП)</p>
                <p className="mt-1 text-lg font-semibold" style={{ color: T.text }}>
                  {myWork.rentals.count}
                </p>
                <p className="text-xs font-semibold" style={{ color: T.accent }}>
                  {formatCurrency(myWork.rentals.salary)}
                </p>
                <p className="text-[10px]" style={{ color: T.textMuted }}>
                  оборот {formatCurrency(myWork.rentals.revenue)}
                </p>
              </div>
              {/* Смены — what the old card mislabeled as «Аренды». */}
              <div className="rounded-lg border p-3" style={{ borderColor: T.borderSoft, backgroundColor: T.bgCard }}>
                <p className="text-xs" style={{ color: T.textMuted }}>Смены</p>
                <p className="mt-1 text-lg font-semibold" style={{ color: T.text }}>
                  {myWork.shifts.count}
                </p>
                <p className="text-xs" style={{ color: T.textMuted }}>
                  {formatCurrency(myWork.shifts.total)}
                </p>
              </div>
              {/* Продажи — actual attributed sales (created via /doc by me, or
                  my shift covered the sale). ЗП matches the salary model 1:1. */}
              <div className="rounded-lg border p-3" style={{ borderColor: T.borderSoft, backgroundColor: T.bgCard }}>
                <p className="text-xs" style={{ color: T.textMuted }}>Продажи (ЗП)</p>
                <p className="mt-1 text-lg font-semibold" style={{ color: T.text }}>
                  {myWork.sales.count}
                </p>
                <p className="text-xs font-semibold" style={{ color: T.accent }}>
                  {formatCurrency(myWork.sales.total)}
                </p>
                <p className="text-[10px]" style={{ color: T.textMuted }}>
                  оборот {formatCurrency(myWork.sales.revenue ?? 0)}
                </p>
              </div>
              <div className="rounded-lg border p-3" style={{ borderColor: T.borderSoft, backgroundColor: T.bgCard }}>
                <p className="text-xs" style={{ color: T.textMuted }}>Сервис/Возвраты</p>
                <p className="mt-1 text-lg font-semibold" style={{ color: T.text }}>
                  {myWork.serviceReturns.count}
                </p>
                <p className="text-xs" style={{ color: T.textMuted }}>
                  {formatCurrency(myWork.serviceReturns.total)}
                </p>
              </div>
            </div>

            {/* Итого за день */}
            <div
              className="flex items-center justify-between rounded-lg border px-3 py-2"
              style={{ borderColor: T.borderSoft, backgroundColor: "color-mix(in srgb, var(--franchize-shell-accent) 8%, transparent)" }}
            >
              <span className="text-xs font-semibold" style={{ color: T.textMuted }}>
                Итого за день
              </span>
              <span className="text-base font-bold" style={{ color: T.accent }}>
                {formatCurrency(myWork.totalDay)}
              </span>
            </div>

            {/* Детализация: мои продажи за день — bike, цена, ЗП, зачтено. */}
            {myWork.saleDetails?.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-semibold" style={{ color: T.textMuted }}>
                  Мои продажи за день
                </p>
                {myWork.saleDetails.map((s) => (
                  <div
                    key={s.saleId}
                    className="flex items-center justify-between rounded px-2 py-1.5 text-xs"
                    style={{ backgroundColor: "color-mix(in srgb, var(--franchize-shell-accent) 8%, transparent)" }}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate" style={{ color: T.text }}>{s.bikeLabel}</p>
                      <p className="text-[10px]" style={{ color: T.textMuted }}>
                        цена {formatCurrency(s.salePrice)} · зачтено: {s.sourceLabel}
                      </p>
                    </div>
                    <span className="ml-2 font-mono font-semibold" style={{ color: T.accent }}>
                      +{formatCurrency(s.salary)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Детализация: мои аренды за день — bike, revenue, ЗП. */}
            {myWork.rentalDetails.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-semibold" style={{ color: T.textMuted }}>
                  Мои аренды за день
                </p>
                {myWork.rentalDetails.map((r) => (
                  <div
                    key={r.rentalId}
                    className="flex items-center justify-between rounded px-2 py-1.5 text-xs"
                    style={{ backgroundColor: "color-mix(in srgb, var(--franchize-shell-accent) 8%, transparent)" }}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate" style={{ color: T.text }}>{r.bikeLabel}</p>
                      <p className="text-[10px]" style={{ color: T.textMuted }}>
                        {formatCurrency(r.revenue)} · зачтено: {r.sourceLabel}
                      </p>
                    </div>
                    <span className="ml-2 font-mono font-semibold" style={{ color: T.accent }}>
                      +{formatCurrency(r.salary)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="py-4 text-center text-sm" style={{ color: T.textMuted }}>
            Нет данных о работе
          </div>
        )}
      </FranchizeOperatorPanel>
    </motion.div>
  );
}
