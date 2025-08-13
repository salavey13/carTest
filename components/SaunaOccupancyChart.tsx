"use client";

import React, { useMemo, useState } from "react";

type Booking = {
  id: string;
  date: string; // ISO date yyyy-mm-dd
  startHour: number; // 0..23
  durationHours: number;
  price?: number;
  starsUsed?: number;
  extras?: string[];
  createdAt?: string;
};

type Props = {
  bookings: Booking[];
  /** date in yyyy-mm-dd format to display (defaults to today) */
  date?: string;
  /** optional title */
  title?: string;
};

export default function SaunaOccupancyChart({ bookings, date, title }: Props) {
  const [open, setOpen] = useState(false);

  const targetDate = date ?? new Date().toISOString().slice(0, 10);

  // bookings only for the selected date
  const bookingsForDate = useMemo(
    () => bookings.filter((b) => b.date === targetDate),
    [bookings, targetDate]
  );

  // assign bookings to lanes so overlapping bookings stack
  const bookingsWithLanes = useMemo(() => {
    // sort by startHour (earlier first), longer first as tiebreaker
    const sorted = [...bookingsForDate].sort((a, b) => {
      if (a.startHour !== b.startHour) return a.startHour - b.startHour;
      return b.durationHours - a.durationHours;
    });

    const lanes: { end: number }[] = [];
    const result: Array<Booking & { lane: number; endHour: number }> = [];

    for (const b of sorted) {
      const start = Math.max(0, Math.floor(b.startHour));
      const end = Math.min(24, Math.ceil(b.startHour + b.durationHours));
      // find lane that is free (its end <= start)
      let laneIndex = lanes.findIndex((l) => l.end <= start);
      if (laneIndex === -1) {
        laneIndex = lanes.length;
        lanes.push({ end });
      } else {
        lanes[laneIndex].end = end;
      }
      result.push({ ...b, lane: laneIndex, endHour: end });
    }
    return { lanesCount: Math.max(1, lanes.length), items: result };
  }, [bookingsForDate]);

  // hour labels 0..23
  const hours = Array.from({ length: 24 }, (_, i) => i);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        Показать график
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          role="dialog"
          aria-modal="true"
          aria-label="График занятости сауны"
        >
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setOpen(false)}
          />
          <div className="relative z-10 w-[95%] max-w-4xl max-h-[90vh] overflow-auto bg-white rounded-lg shadow-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">{title ?? "График занятости"}</h3>
              <div className="flex gap-2 items-center">
                <div className="text-sm text-muted-foreground mr-4">
                  Дата: <span className="font-medium">{targetDate}</span>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="px-2 py-1 rounded border text-sm"
                >
                  Закрыть
                </button>
              </div>
            </div>

            <div className="mb-2 text-sm text-muted-foreground">
              Легенда: блок = бронирование; дорожки показывают параллельные (перекрывающиеся) брони
            </div>

            {/* Chart container */}
            <div
              className="border rounded overflow-hidden"
              style={{
                // grid for columns (hours) and rows (lanes)
                display: "grid",
                gridTemplateColumns: `60px repeat(24, minmax(0, 1fr))`,
                // rows equal to lanesCount: one header row + lanesCount rows (40px each)
                gridTemplateRows: `32px repeat(${bookingsWithLanes.lanesCount}, 44px)`,
                gap: "4px",
                alignItems: "center",
              }}
            >
              {/* Left column: hour labels column header empty */}
              <div style={{ gridColumn: "1 / 2", gridRow: "1 / 2" }} />

              {/* Hour headers */}
              {hours.map((h) => (
                <div
                  key={`h-${h}`}
                  style={{
                    gridColumn: `${2 + h} / ${3 + h}`,
                    gridRow: "1 / 2",
                    fontSize: 12,
                    textAlign: "center",
                    paddingTop: 6,
                    borderLeft: "1px solid rgba(0,0,0,0.06)",
                    userSelect: "none",
                  }}
                >
                  {h}
                </div>
              ))}

              {/* left column labels for rows (lanes) */}
              {Array.from({ length: bookingsWithLanes.lanesCount }).map((_, i) => (
                <div
                  key={`laneLabel-${i}`}
                  style={{
                    gridColumn: "1 / 2",
                    gridRow: `${2 + i} / ${3 + i}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 13,
                    color: "#374151",
                    borderRight: "1px solid rgba(0,0,0,0.06)",
                    height: 44,
                  }}
                >
                  {i === 0 ? "Дорожка" : ""}
                  <div className="text-xs text-muted-foreground ml-1">{i + 1}</div>
                </div>
              ))}

              {/* grid background for hour cells (visual vertical separators) */}
              {Array.from({ length: bookingsWithLanes.lanesCount }).flatMap((_, rowIdx) =>
                hours.map((h) => (
                  <div
                    key={`cell-${rowIdx}-${h}`}
                    style={{
                      gridColumn: `${2 + h} / ${3 + h}`,
                      gridRow: `${2 + rowIdx} / ${3 + rowIdx}`,
                      height: 44,
                      borderLeft: "1px solid rgba(0,0,0,0.03)",
                      background: rowIdx % 2 === 0 ? "transparent" : "transparent",
                    }}
                    aria-hidden
                  />
                ))
              )}

              {/* bookings as blocks */}
              {bookingsWithLanes.items.map((b) => {
                const start = Math.max(0, Math.floor(b.startHour));
                const end = Math.min(24, Math.ceil(b.endHour));
                const colStart = 2 + start;
                const colEnd = 2 + end;
                const row = 2 + b.lane; // because first row is header

                return (
                  <div
                    key={b.id}
                    title={`№${b.id} — ${b.startHour}:00  → ${b.startHour + b.durationHours}:00`}
                    style={{
                      gridColumn: `${colStart} / ${colEnd}`,
                      gridRow: `${row} / ${row + 1}`,
                      margin: "6px 4px",
                      borderRadius: 8,
                      display: "flex",
                      alignItems: "center",
                      paddingLeft: 8,
                      paddingRight: 8,
                      fontSize: 13,
                      color: "white",
                      background:
                        "linear-gradient(90deg, rgba(59,130,246,1), rgba(99,102,241,1))",
                      boxShadow: "0 2px 6px rgba(0,0,0,0.12)",
                      overflow: "hidden",
                      whiteSpace: "nowrap",
                      textOverflow: "ellipsis",
                    }}
                  >
                    <div style={{ fontWeight: 600, marginRight: 8 }}>
                      {b.startHour}:00
                    </div>
                    <div style={{ opacity: 0.95 }}>
                      {b.durationHours} ч · {b.extras?.join(", ") || "—"}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* footer / small summary */}
            <div className="mt-3 text-sm text-muted-foreground">
              Показано брони на <strong>{targetDate}</strong>:{" "}
              <strong>{bookingsForDate.length}</strong>
            </div>
          </div>
        </div>
      )}
    </>
  );
}