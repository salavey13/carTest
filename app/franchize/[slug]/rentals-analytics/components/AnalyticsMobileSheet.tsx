"use client";

// /analytics/components/AnalyticsMobileSheet.tsx
//
// Bottom sheet (mobile) for rental/sale/service detail drawers.
//
// FIX (F14, iter2): the iter1 sheet used `max-h-[90vh]` + `items-end` which
// caused two problems in the Telegram WebApp viewport:
//   1. When the inner content was short the sheet collapsed to ~half screen,
//      but the inner scroll area still had a `pb-6` bottom padding which made
//      the visible content look truncated ("top half not visible").
//   2. When the inner content was long, `flex-1` + `pb-6` + safe-area-inset
//      stacked — leaving a gap big enough to fit a keyboard ("huge bottom
//      padding").
//
// FIX (iter18 — "sheet stucks at half size, footer unreachable"): two roots.
//   A. `h-[90vh]` measured the LAYOUT viewport, which in the Telegram WebView
//      can be TALLER than the visible area (TG header / browser toolbar /
//      fullscreen insets) — the sheet's bottom (sticky footer «Открыть
//      аренду») went offscreen, and only rotating the phone (forcing a vh
//      recalculation) fixed it. Now the height comes from
//      useViewportHeightPx() (tg.viewportStableHeight → window.innerHeight)
//      so the sheet ALWAYS fits the visible viewport, whatever the browser
//      does with vh. Live updates on viewportChanged/resize/rotation.
//   B. When the user started a swipe while the entry spring was still
//      running, framer-motion recorded the interrupted (half-way) position as
//      the drag origin — after a non-dismissing drag the sheet sprang back to
//      that HALF position and stayed there ("stuck at half size, draggable
//      only in the reduction direction"). Now onDragEnd always re-animates to
//      the FULL open position via animation controls — the sheet can never
//      rest at half size, and dragging up snaps it back to full.
//
// The drag handle remains a dismiss gesture only (swipe down to close);
// the sheet is not user-resizable — it is always the full intended size.

import { useEffect, useRef, type ReactNode } from "react";
import {
  motion,
  AnimatePresence,
  useAnimationControls,
  useDragControls,
} from "framer-motion";
import { X } from "lucide-react";
import type { ThemeTokens } from "../hooks/useTheme";
import { useViewportHeightPx } from "../hooks/useViewportHeightPx";

interface AnalyticsMobileSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  T: ThemeTokens;
  children: ReactNode;
}

/** Fraction of the visible viewport the sheet occupies when open. */
const SHEET_VIEWPORT_FRACTION = 0.92;

const OPEN_SPRING = { type: "spring", damping: 30, stiffness: 280 } as const;

export function AnalyticsMobileSheet({
  open,
  onClose,
  title,
  T,
  children,
}: AnalyticsMobileSheetProps) {
  // dragControls: the handle bar starts the swipe gesture (dragListener off).
  const dragControls = useDragControls();
  // controls: the sheet's y-position animation — re-fired after every
  // non-dismissing drag so it ALWAYS returns to the full open position.
  const controls = useAnimationControls();
  const scrollRef = useRef<HTMLDivElement>(null);
  const viewportHeight = useViewportHeightPx();

  // Pixel height derived from the VISIBLE viewport (see hook docblock).
  // Before mount (viewportHeight === 0) we fall back to the CSS class
  // (90dvh — dynamic viewport height, still better than the old vh).
  const sheetHeightPx =
    viewportHeight > 0 ? Math.round(viewportHeight * SHEET_VIEWPORT_FRACTION) : 0;

  // Esc to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Lock body scroll while sheet is open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // FIX (F14): reset scroll to top whenever a new sheet opens — otherwise
  // reopening the same rental keeps the previous scroll position, which
  // makes the top of the content appear cut off.
  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [open]);

  // FIX (iter18-B): the entry animation runs through the animation controls
  // so it can be re-fired after a non-dismissing drag (restore to FULL
  // size). sheetHeightPx is intentionally NOT a dependency: a viewport
  // change while open must not replay the slide-up — the inline style height
  // already re-seats the sheet correctly.
  useEffect(() => {
    if (open) {
      void controls.start({ y: 0, transition: OPEN_SPRING });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, controls]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          // z-[55]: above the sticky CrewHeader (z-50) — equal z-50 was fragile
          // (same-z stacking depends on DOM order) — below dialogs/toasts.
          className="fixed inset-0 z-[55] flex items-end"
          style={{ background: "color-mix(in srgb, #000000 60%, transparent)" }}
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label={title || "Детали"}
        >
          <motion.div
            drag="y"
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120 || info.velocity.y > 600) {
                // Dismiss — the AnimatePresence exit slides the sheet away.
                onClose();
                return;
              }
              // FIX (iter18-B): not dismissed → ALWAYS restore the FULL open
              // position. Previously the sheet could rest at the half-way
              // point where an interrupted drag started (the "stuck at half
              // size" bug) and no upward drag could recover it.
              void controls.start({ y: 0, transition: OPEN_SPRING });
            }}
            initial={{ y: "100%" }}
            animate={controls}
            exit={{ y: "100%" }}
            transition={OPEN_SPRING}
            onClick={(e) => e.stopPropagation()}
            // FIX (iter18-A): pixel height from the VISIBLE viewport (TG-aware)
            // with a 90dvh CSS fallback for the pre-mount frame. The sheet can
            // never be taller than what the user actually sees, so the sticky
            // footer stays onscreen.
            className={`relative flex w-full flex-col rounded-t-3xl ${
              sheetHeightPx > 0 ? "" : "h-[90dvh]"
            }`}
            style={{
              backgroundColor: T.bg,
              borderTop: `1px solid ${T.border}`,
              boxShadow: "0 -10px 40px rgba(0,0,0,0.4)",
              ...(sheetHeightPx > 0 ? { height: `${sheetHeightPx}px` } : {}),
              paddingBottom: "env(safe-area-inset-bottom, 0px)",
            }}
          >
            {/* Drag handle — full-width gesture surface so the user can
                start a swipe anywhere on the top bar. Only the decorative
                pill is aria-hidden; the close button stays accessible. */}
            <div
              onPointerDown={(e) => dragControls.start(e)}
              className="flex shrink-0 cursor-grab touch-none items-center justify-between gap-2 px-4 pb-1.5 pt-2.5 active:cursor-grabbing"
            >
              <div
                className="h-1.5 w-10 rounded-full"
                style={{ backgroundColor: T.textFaint }}
                aria-hidden
              />
              <button
                type="button"
                onClick={onClose}
                aria-label="Закрыть"
                className="rounded-lg p-2 transition hover:opacity-80 focus:outline-none focus-visible:ring-2"
                style={{
                  color: T.textMuted,
                  minHeight: "40px",
                  minWidth: "40px",
                }}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {title && (
              <h2
                className="shrink-0 px-4 pb-2 text-base font-semibold"
                style={{ color: T.text }}
              >
                {title}
              </h2>
            )}

            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto px-4 pb-4 pt-1"
              style={{ overscrollBehavior: "contain" }}
            >
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
