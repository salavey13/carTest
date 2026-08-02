"use client";

import { useState } from "react";

/**
 * RentalTimeline
 * ──────────────────────────────────────────────────────────────────────────
 * Idea C from PRD: Timeline view.
 *
 * Horizontal stage timeline showing the rental lifecycle:
 *   Создан → Договор → Выдан → Активен → Возврат → Закрыт
 *     ●        ●        ●        ●        ○        ○
 *   31.07    31.07    31.07    31.07    02.08    ?
 *
 * Each dot is a stage. Filled = done, empty = pending.
 * Tap a dot to expand details below (description + timestamp).
 *
 * Stages derived from rental.status:
 *   pending_confirmation → only "Создан" filled
 *   confirmed            → "Создан" + "Договор" filled
 *   active               → first 4 filled (Создан + Договор + Выдан + Активен)
 *   completed            → all 6 filled
 *   cancelled            → all greyed out except "Создан"
 *
 * Why horizontal?
 *   - Mobile-first: horizontal fits better in narrow viewports.
 *   - Dot pattern gives instant visual status without reading text.
 *   - Tap-to-expand keeps the timeline compact while details are accessible.
 *
 * Accessibility:
 *   - Each stage is a button with aria-label.
 *   - Selected stage expands an aria-live region below.
 *   - Filled vs empty conveyed via aria-pressed.
 */

type TimelineStage = {
  key: string;
  label: string;
  description: string;
  /** ISO timestamp or null if not yet reached */
  timestamp: string | null;
  /** Whether this stage is complete */
  done: boolean;
};

interface RentalTimelineProps {
  status: string;
  /** ISO strings */
  createdAt?: string | null;
  verifiedAt?: string | null;
  pickedUpAt?: string | null;
  activeAt?: string | null;
  returnedAt?: string | null;
  completedAt?: string | null;
  cancelledAt?: string | null;
  accentColor: string;
  textPrimary: string;
  textSecondary: string;
  borderSoft: string;
}

function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" });
  } catch {
    return "—";
  }
}

export function RentalTimeline({
  status,
  createdAt,
  verifiedAt,
  pickedUpAt,
  activeAt,
  returnedAt,
  completedAt,
  cancelledAt,
  accentColor,
  textPrimary,
  textSecondary,
  borderSoft,
}: RentalTimelineProps) {
  const [selected, setSelected] = useState<string | null>(null);

  // N1 fix: removed dead `isCancelled` variable (was never used after the
  // displayStages simplification — cancelled rentals now preserve real history).
  const isCompleted = status === "completed";
  const stages: TimelineStage[] = [
    {
      key: "created",
      label: "Создан",
      description: "Заявка на аренду создана в системе.",
      timestamp: createdAt ?? null,
      done: Boolean(createdAt),
    },
    {
      key: "contract",
      label: "Договор",
      description: "Контракт верифицирован, документы проверены.",
      timestamp: verifiedAt ?? null,
      done: Boolean(verifiedAt) || ["active", "completed"].includes(status),
    },
    {
      key: "pickup",
      label: "Выдан",
      description: "ТС передан арендатору, фото ДО сделано.",
      timestamp: pickedUpAt ?? null,
      done: ["active", "completed"].includes(status),
    },
    {
      key: "active",
      label: "Активен",
      description: "ТС у арендатора, идёт аренда.",
      timestamp: activeAt ?? null,
      done: status === "active" || isCompleted,
    },
    {
      key: "returned",
      label: "Возврат",
      description: "ТС возвращён, финальный осмотр проведён.",
      timestamp: returnedAt ?? null,
      // Decouple "returned" from "closed" — a rental can be returned but not yet closed.
      done: Boolean(returnedAt) || isCompleted,
    },
    {
      key: "closed",
      label: "Закрыт",
      description: "Аренда завершена, депозит возвращён, история сохранена.",
      timestamp: completedAt ?? null,
      done: isCompleted,
    },
  ];

  // If cancelled, keep history of stages that actually happened (don't lie about
  // what was done). The cancelled badge in the page header already signals the state.
  // Previously we forced all-but-first to done:false, which discarded real history.
  const displayStages = stages;

  const selectedIndex = selected ? displayStages.findIndex((s) => s.key === selected) : -1;
  const selectedStage = selectedIndex >= 0 ? displayStages[selectedIndex] : null;

  return (
    <div className="rounded-2xl border p-3" style={{ borderColor: borderSoft }}>
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: textSecondary }}>
        Хронология аренды
      </p>

      {/* Horizontal scrollable timeline */}
      <div className="overflow-x-auto pb-2">
        <div className="flex items-start gap-1 min-w-max">
          {displayStages.map((stage, idx) => {
            const isSelected = stage.key === selected;
            const isLast = idx === displayStages.length - 1;
            return (
              <div key={stage.key} className="flex items-start">
                <button
                  type="button"
                  onClick={() => setSelected(isSelected ? null : stage.key)}
                  aria-current={isSelected ? "step" : undefined}
                  aria-label={`${stage.label}: ${stage.done ? "выполнено" : "ожидает"}${stage.timestamp ? `, ${formatShortDate(stage.timestamp)}` : ""}`}
                  className="flex flex-col items-center gap-1.5 px-1 transition-transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                >
                  <span
                    className="flex h-6 w-6 items-center justify-center rounded-full border-2 text-[10px] font-bold transition-colors"
                    style={{
                      backgroundColor: stage.done ? accentColor : "transparent",
                      borderColor: stage.done ? accentColor : borderSoft,
                      color: stage.done ? "#16130A" : textSecondary,
                    }}
                  >
                    {stage.done ? "✓" : idx + 1}
                  </span>
                  <span
                    className="text-[10px] font-medium whitespace-nowrap"
                    style={{ color: isSelected ? textPrimary : textSecondary }}
                  >
                    {stage.label}
                  </span>
                  <span className="text-[9px] opacity-60 whitespace-nowrap">
                    {formatShortDate(stage.timestamp)}
                  </span>
                </button>
                {!isLast && (
                  <div
                    className="mt-3 h-0.5 w-6 sm:w-10"
                    style={{
                      backgroundColor: displayStages[idx + 1].done ? accentColor : borderSoft,
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Expanded details for selected stage */}
      {selectedStage && (
        <div
          aria-live="polite"
          className="mt-3 rounded-xl border p-3 text-xs"
          style={{
            borderColor: borderSoft,
            backgroundColor: "color-mix(in srgb, var(--franchize-bg-card, transparent) 50%, transparent)",
            color: textPrimary,
          }}
        >
          <p className="font-semibold" style={{ color: accentColor }}>
            {selectedStage.label}
          </p>
          <p className="mt-1 opacity-80">{selectedStage.description}</p>
          {selectedStage.timestamp && (
            <p className="mt-1.5 opacity-60">
              {new Date(selectedStage.timestamp).toLocaleString("ru-RU", {
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
