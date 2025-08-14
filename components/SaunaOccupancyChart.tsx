"use client";

import React, { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * SaunaOccupancyChart
 * - Простой и адаптивный компонент-график для отображения занятости по часам (0-23).
 * - Рендерит кнопку, открывающую модалку с графиком. Мобильный-first: модалка занимает экран.
 * - Поддерживаемые поля booking'а: start_at (ISO), end_at (ISO), date (YYYY-MM-DD), extras, metadata.
 * - Если booking'и не содержат времени — компонент постарается распределить по дате.
 *
 * Props:
 * - bookings: Booking[] — список бронирований
 * - date?: string — фильтр по дате (YYYY-MM-DD)
 * - title?: string
 *
 * Компонент изначально независим — можно вставлять в любые места UI.
 *
 * Небольшой хард-виртуал: capacity = 6 по умолчанию (подправь при необходимости).
 *
 * Сделано: адаптивность, touch-friendly tooltip, aria, кнопки унифицированы с ui/button.
 */

// Типы
type Booking = {
  id?: string | number;
  start_at?: string;
  end_at?: string;
  date?: string;
  extras?: string[];
  metadata?: Record<string, any>;
  [k: string]: any;
};

type Props = {
  bookings?: Booking[];
  date?: string; // фильтр по дате YYYY-MM-DD
  title?: string;
  capacity?: number;
};

function parseIsoToHour(iso?: string): number | null {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return null;
    return d.getHours();
  } catch (e) {
    return null;
  }
}

export default function SaunaOccupancyChart({
  bookings = [],
  date,
  title = "График занятости",
  capacity = 6,
}: Props) {
  const [open, setOpen] = useState(false);
  const [hoveredHour, setHoveredHour] = useState<number | null>(null);

  // compute occupancy by hour 0..23
  const hours = Array.from({ length: 24 }).map((_, i) => i);
  const occupancyByHour = useMemo(() => {
    const cnt: number[] = Array(24).fill(0);
    try {
      bookings.forEach((b) => {
        // If date filter provided — skip bookings not for this date
        if (date) {
          const bDate =
            (b.start_at && String(b.start_at).slice(0, 10)) ||
            (b.date && String(b.date).slice(0, 10)) ||
            (b.start && String(b.start).slice(0, 10));
          if (bDate !== date) return;
        }
        // try parse start/end hours
        const sh = parseIsoToHour(b.start_at || b.start || b.start_time);
        const eh = parseIsoToHour(b.end_at || b.end || b.end_time);

        if (sh !== null && eh !== null) {
          // increment hours between start and end (inclusive start, exclusive end)
          const start = sh;
          const end = eh > start ? eh : start + 1;
          for (let h = start; h < end && h < 24; h++) {
            cnt[h] = cnt[h] + 1;
          }
        } else if (sh !== null) {
          // only start specified -> mark that hour
          cnt[sh] = cnt[sh] + 1;
        } else {
          // fallback: if only date present, scatter to midday
          cnt[12] = cnt[12] + 1;
        }
      });
    } catch (err) {
      console.warn("[SaunaOccupancyChart] occupancy calc failed:", err);
    }
    return cnt;
  }, [bookings, date]);

  // calculate max occupancy for scaling
  const maxOcc = Math.max(...occupancyByHour, capacity);

  // mobile friendly formatting for hour label
  const hourLabel = (h: number) => {
    if (h === 0) return "00";
    if (h < 10) return `0${h}`;
    return String(h);
  };

  return (
    <div className="inline-block">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-controls="sauna-occupancy-modal"
      >
        Показать график
      </Button>

      {/* Modal */}
      {open ? (
        <div
          id="sauna-occupancy-modal"
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
        >
          {/* backdrop */}
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-hidden
          />

          {/* modal panel */}
          <div className="relative w-full sm:w-11/12 md:w-3/4 lg:w-1/2 max-h-[92vh] bg-[#0b0b0b] border border-white/6 rounded-t-2xl sm:rounded-2xl overflow-hidden p-4 flex flex-col">
            {/* header */}
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <h3 className="text-lg font-semibold">{title}</h3>
                {date && (
                  <div className="text-xs text-neutral-400 mt-0.5">
                    Дата: {date}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <div className="text-sm text-neutral-400 mr-2">
                  cap: {capacity}
                </div>
                <Button
                  variant="accent"
                  size="sm"
                  onClick={() => setOpen(false)}
                  aria-label="Закрыть"
                >
                  Закрыть
                </Button>
              </div>
            </div>

            {/* Chart area */}
            <div className="flex-1 overflow-auto">
              <div className="w-full">
                <div className="mb-2 text-sm text-neutral-300">
                  Занятость по часам
                </div>

                {/* Bars container */}
                <div className="w-full bg-white/5 rounded-lg p-3">
                  <div className="w-full overflow-x-auto">
                    <div className="flex items-end gap-1 h-40 min-h-[160px]">
                      {hours.map((h) => {
                        const c = occupancyByHour[h];
                        const pct = Math.min(
                          100,
                          Math.round((c / Math.max(1, capacity)) * 100)
                        );
                        const barHeight = Math.max(6, pct); // use percent directly
                        const isHover = hoveredHour === h;
                        return (
                          <div
                            key={h}
                            className={`flex flex-col items-center justify-end text-center w-7 sm:w-9`}
                            onMouseEnter={() => setHoveredHour(h)}
                            onMouseLeave={() => setHoveredHour(null)}
                            onTouchStart={() => setHoveredHour(h)}
                            onTouchEnd={() =>
                              setTimeout(() => setHoveredHour(null), 200)
                            }
                          >
                            <div
                              className={`w-full rounded-t-md transition-all ${
                                isHover ? "ring-2 ring-amber-400" : ""
                              }`}
                              style={{
                                height: `${barHeight}%`,
                                background:
                                  "linear-gradient(180deg, rgba(250,204,21,0.95), rgba(250,160,60,0.85))",
                                minHeight: 8,
                              }}
                              title={`${hourLabel(h)}:00 — ${c} броней (${pct}% от cap)`}
                              aria-label={`${hourLabel(h)}:00 — ${c} броней`}
                            />
                            <div className="mt-2 text-[10px] text-neutral-300">
                              {hourLabel(h)}
                            </div>
                            <div className="text-[10px] text-neutral-400 mt-0.5">
                              {c}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  {/* legend & info */}
                  <div className="mt-3 flex items-center justify-between text-xs text-neutral-400">
                    <div>
                      Max: {maxOcc} / cap: {capacity}
                    </div>
                    <div>{bookings.length} брони</div>
                  </div>
                </div>
              </div>
            </div>

            {/* footer actions */}
            <div className="mt-3 flex items-center justify-end">
              <Button
                size="sm"
variant="accent"
                className="bg-amber-600 text-black hover:bg-amber-700"
                onClick={() => setOpen(false)}
              >
                Закрыть
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}