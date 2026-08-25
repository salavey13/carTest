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
// Fix:
//   - Use `h-[90vh]` (fixed) instead of `max-h-[90vh]` so the sheet is always
//     full-height regardless of content length. The drag handle still lets
//     the user swipe down to dismiss.
//   - Move the scroll container to start at the TOP, anchor with `pt-2` only
//     and trim `pb-4`. The safe-area inset is applied to the OUTER container
//     only (no double padding).
//   - Reset scroll to top on open — without this, when a user opens the same
//     rental modal again after closing, the scroll position is preserved at
//     whatever they last scrolled to, which feels like the top is hidden.
//   - Stretch the drag handle across the full width (so dragging anywhere on
//     the top bar starts the gesture, not just the small pill).

import { useEffect, useRef, type ReactNode } from "react";
import { motion, AnimatePresence, useDragControls } from "framer-motion";
import { X } from "lucide-react";
import type { ThemeTokens } from "../hooks/useTheme";

interface AnalyticsMobileSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  T: ThemeTokens;
  children: ReactNode;
}

export function AnalyticsMobileSheet({
  open,
  onClose,
  title,
  T,
  children,
}: AnalyticsMobileSheetProps) {
  const dragControls = useDragControls();
  const scrollRef = useRef<HTMLDivElement>(null);

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

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-end"
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
              if (info.offset.y > 120 || info.velocity.y > 600) onClose();
            }}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 280 }}
            onClick={(e) => e.stopPropagation()}
            // FIX (F14): fixed height instead of max-h — guarantees full-screen
            // sheet regardless of content length. Safe-area inset on the OUTER
            // container only (no double-padding).
            className="relative flex h-[90vh] w-full flex-col rounded-t-3xl"
            style={{
              backgroundColor: T.bg,
              borderTop: `1px solid ${T.border}`,
              boxShadow: "0 -10px 40px rgba(0,0,0,0.4)",
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
