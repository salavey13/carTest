"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

interface MobileLeadSheetProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  T: any;
}

const SHEET_HEIGHT = 0.88; // 88% of viewport

const sheetVariants = {
  hidden: { y: "100%" },
  visible: {
    y: 0,
    transition: { type: "spring", damping: 28, stiffness: 300, mass: 0.8 },
  },
  exit: {
    y: "100%",
    transition: { type: "spring", damping: 28, stiffness: 400, mass: 0.8 },
  },
};

const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};

export function MobileLeadSheet({ open, onClose, children, title, T }: MobileLeadSheetProps) {
  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end lg:hidden">
          {/* Backdrop */}
          <motion.div
            key="sheet-backdrop"
            className="absolute inset-0"
            style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={onClose}
          />

          {/* Sheet — drag="y" on the outer shell, content scrolls independently */}
          <motion.div
            key="lead-sheet"
            className="relative w-full rounded-t-3xl border-t shadow-2xl flex flex-col"
            style={{
              maxHeight: `${SHEET_HEIGHT * 100}vh`,
              backgroundColor: T.bgCard,
              borderColor: T.border,
            }}
            variants={sheetVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            drag="y"
            dragConstraints={{ top: 0, bottom: 80 }}
            dragElastic={{ top: 0, bottom: 0.3 }}
            onDragEnd={(_event, info) => {
              if (info.offset.y > 80) onClose();
            }}
          >
            {/* Drag handle header — sticky, clickable X */}
            <div
              className="sticky top-0 z-10 shrink-0 flex items-center justify-between pt-3 pb-2 px-4"
              style={{ backgroundColor: T.bgCard }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <motion.div
                  className="h-1.5 w-10 rounded-full shrink-0"
                  style={{ backgroundColor: T.borderSoft }}
                  whileTap={{ scale: 0.85 }}
                />
                {title && (
                  <p className="truncate text-xs font-semibold leading-tight" style={{ color: T.textMuted }}>
                    {title}
                  </p>
                )}
              </div>
              <button
                onClick={onClose}
                className="rounded-xl p-2 transition hover:bg-black/10 shrink-0"
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
                maxHeight: `calc(${SHEET_HEIGHT * 100}vh - 48px)`,
                WebkitOverflowScrolling: "touch",
                overscrollBehavior: "contain",
              }}
            >
              <div className="pb-[calc(env(safe-area-inset-bottom,_16px)+16px)]">
                {children}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
