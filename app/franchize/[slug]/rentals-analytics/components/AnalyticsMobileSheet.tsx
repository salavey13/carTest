"use client";

// /analytics/components/AnalyticsMobileSheet.tsx
//
// Bottom sheet (mobile) for rental/sale/service detail drawers.
// 70vh default, drag handle (useDragControls so only handle drags — fix the
// same scroll-glitch bug from MobileLeadSheet), safe-area padding, ARIA dialog.

import { useEffect, type ReactNode } from "react";
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
            className="relative flex max-h-[88vh] w-full flex-col rounded-t-3xl"
            style={{
              backgroundColor: T.bg,
              borderTop: `1px solid ${T.border}`,
              boxShadow: "0 -10px 40px rgba(0,0,0,0.4)",
              paddingBottom: "env(safe-area-inset-bottom, 0px)",
            }}
          >
            {/* Drag handle — only the decorative pill is aria-hidden,
                NOT the close button (must remain screen-reader accessible). */}
            <div
              onPointerDown={(e) => dragControls.start(e)}
              className="flex shrink-0 cursor-grab touch-none items-center justify-between px-4 pb-2 pt-3 active:cursor-grabbing"
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
                className="rounded-lg p-2.5 transition hover:opacity-80 focus:outline-none focus-visible:ring-2"
                style={{
                  color: T.textMuted,
                  minHeight: "44px",
                  minWidth: "44px",
                }}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {title && (
              <h2
                className="shrink-0 px-4 pb-3 text-base font-semibold"
                style={{ color: T.text }}
              >
                {title}
              </h2>
            )}

            <div className="flex-1 overflow-y-auto px-4 pb-6">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
