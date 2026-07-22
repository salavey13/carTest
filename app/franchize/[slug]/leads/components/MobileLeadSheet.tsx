"use client";

import { useEffect, type ReactNode } from "react";
import { motion, AnimatePresence, type PanInfo } from "framer-motion";
import { X } from "lucide-react";
import type { ThemeTokens } from "@/app/franchize/[slug]/leads/hooks/useTheme";

interface Props {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  T: ThemeTokens;
}

const SHEET_HEIGHT_VH = 0.92; // 92% of viewport — leaves room for status bar
const DRAG_DISMISS_THRESHOLD = 120; // px — drag past this to dismiss

const sheetVariants = {
  hidden: { y: "100%" },
  visible: {
    y: 0,
    transition: { type: "spring" as const, damping: 30, stiffness: 320, mass: 0.8 },
  },
  exit: {
    y: "100%",
    transition: { type: "spring" as const, damping: 32, stiffness: 380, mass: 0.8 },
  },
};

const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};

/**
 * Bottom sheet that slides up on mobile (hidden on lg+).
 *
 * - Drag handle at the top — drag down past 120px to dismiss
 * - Backdrop click also dismisses
 * - Escape key dismisses
 * - Safe-area padding bottom (80px reserved for home indicator + nav bar)
 * - Sheet body scrolls independently of the drag gesture
 */
export function MobileLeadSheet({ open, onClose, children, title, T }: Props) {
  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    // Lock body scroll while sheet is open
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handler);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.y > DRAG_DISMISS_THRESHOLD) onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end lg:hidden">
          {/* Backdrop */}
          <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={title || "Детали лида"}
            key="mobile-sheet-backdrop"
            className="absolute inset-0"
            style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(2px)" }}
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={onClose}
          />

          {/* Sheet — drag handle on the outer shell; content scrolls independently */}
          <motion.div
            key="mobile-lead-sheet"
            className="relative flex w-full flex-col rounded-t-[28px] border-t shadow-2xl"
            style={{
              maxHeight: `${SHEET_HEIGHT_VH * 100}vh`,
              background: "linear-gradient(180deg, #111113 0%, #09090b 100%)",
              borderColor: "T.border",
              boxShadow: "0 -20px 60px rgba(0,0,0,0.6)",
            }}
            variants={sheetVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            dragMomentum={false}
            onDragEnd={handleDragEnd}
          >
            {/* Drag handle header — sticky, with title + close button */}
            <div
              className="sticky top-0 z-10 flex shrink-0 items-center justify-between gap-3 px-4 pb-2 pt-3"
              style={{
                background: "linear-gradient(180deg, #111113 60%, transparent)",
                cursor: "grab",
              }}
            >
              <div className="flex min-w-0 items-center gap-3">
                <motion.div
                  className="h-1.5 w-10 shrink-0 rounded-full"
                  style={{ background: "rgba(255,255,255,0.18)" }}
                  whileTap={{ scale: 0.85 }}
                />
                {title && (
                  <p
                    className="truncate text-xs font-semibold leading-tight"
                    style={{ color: T.textMuted }}
                  >
                    {title}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="shrink-0 rounded-xl p-2 transition hover:bg-white/5"
                style={{ color: T.textFaint }}
                aria-label="Закрыть"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Scrollable content area — separate from drag */}
            <div
              className="overflow-y-auto px-4"
              style={{
                maxHeight: `calc(${SHEET_HEIGHT_VH * 100}vh - 56px)`,
                WebkitOverflowScrolling: "touch",
                overscrollBehavior: "contain",
                // Reserve 80px at bottom for safe-area + mobile nav
                paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 80px)",
              }}
            >
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
