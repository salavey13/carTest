"use client";

import { useEffect, type ReactNode } from "react";
import { motion, AnimatePresence, useDragControls, type PanInfo } from "framer-motion";
import { X } from "lucide-react";
import type { ThemeTokens } from "@/app/franchize/[slug]/leads/hooks/useTheme";

interface Props {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  T: ThemeTokens;
}

// 68vh leaves room for the toolbar/funnel above the sheet and matches the
// ~65-70vh target on mobile. Previously 0.92 which covered almost the entire
// viewport and hid the pipeline funnel behind the sheet.
const SHEET_HEIGHT_VH = 0.68;
const DRAG_DISMISS_THRESHOLD = 120; // px — drag past this to dismiss

// Spring is tuned for a snappy-but-smooth open (270ms-feeling) and a slightly
// firmer close. damping/stiffness/mass are chosen so the sheet decelerates
// naturally without bouncing past y:0.
const sheetVariants = {
  hidden: { y: "100%" },
  visible: {
    y: 0,
    transition: { type: "spring" as const, damping: 32, stiffness: 340, mass: 0.8 },
  },
  exit: {
    y: "100%",
    transition: { type: "spring" as const, damping: 36, stiffness: 420, mass: 0.8 },
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
 * - Drag handle at the top — drag down past 120px to dismiss.
 *   Drag is started ONLY from the header handle (via useDragControls) so that
 *   scrolling the inner content never triggers the close gesture.
 * - Backdrop click also dismisses.
 * - Escape key dismisses.
 * - Safe-area padding bottom (80px reserved for home indicator + nav bar).
 * - Sheet body scrolls independently of the drag gesture.
 */
export function MobileLeadSheet({ open, onClose, children, title, T }: Props) {
  const dragControls = useDragControls();

  // Close on Escape + lock body scroll while sheet is open
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
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
        // z-50 sits above page chrome (z-40 backdrop / drawer) but below the
        // dismiss dialog (z-[60]) and toasts (z-[70]). lg:hidden so the sheet
        // only renders on mobile — desktop uses the right-side drawer.
        <div className="fixed inset-0 z-50 flex items-end lg:hidden">
          {/* Backdrop — dim layer. pointer-events:auto so clicking the scrim
              closes the sheet (the onClick is wired through). The scrim uses
              a dark tint that works on both light + dark themes; backdrop-blur
              softens the underlying content. */}
          <motion.div
            key="mobile-sheet-backdrop"
            className="absolute inset-0 cursor-pointer"
            style={{
              background: "color-mix(in srgb, #000000 55%, transparent)",
              backdropFilter: "blur(3px)",
              WebkitBackdropFilter: "blur(3px)",
            }}
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={onClose}
            aria-hidden
          />

          {/* Sheet — drag is started ONLY from the header handle so inner scroll works */}
          <motion.div
            key="mobile-lead-sheet"
            role="dialog"
            aria-modal="true"
            aria-label={title || "Детали лида"}
            className="relative flex w-full flex-col rounded-t-[28px] border-t shadow-2xl"
            style={{
              maxHeight: `${SHEET_HEIGHT_VH * 100}vh`,
              // Use theme bgElevated → bg gradient so the sheet visually relates
              // to the rest of the surface. Previously this hardcoded #111113 →
              // #09090b which broke on light themes and on crew theme overrides.
              background: `linear-gradient(180deg, ${T.bgElevated} 0%, ${T.bg} 100%)`,
              borderColor: T.border,
              boxShadow: "0 -20px 60px rgba(0,0,0,0.55)",
            }}
            variants={sheetVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            drag="y"
            // Disable the default drag listener — drag is started manually from
            // the header via dragControls.start(e). This is what stops the inner
            // content scroll from triggering the swipe-to-close gesture.
            dragListener={false}
            dragControls={dragControls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            dragMomentum={false}
            onDragEnd={handleDragEnd}
          >
            {/* Drag handle header — sticky, with title + close button.
                pointerDown starts the drag so the gesture only fires here, not on
                the scrollable body. */}
            <div
              className="sticky top-0 z-10 flex shrink-0 cursor-grab items-center justify-between gap-3 px-4 pb-2.5 pt-3 active:cursor-grabbing"
              style={{
                background: `linear-gradient(180deg, ${T.bgElevated} 70%, transparent)`,
                touchAction: "none",
              }}
              onPointerDown={(e) => dragControls.start(e)}
            >
              <div className="flex min-w-0 items-center gap-3">
                {/* Visible drag handle pill — gray, top-aligned, 40px wide */}
                <motion.div
                  className="h-1.5 w-10 shrink-0 rounded-full"
                  style={{ background: T.border }}
                  whileTap={{ scale: 0.85 }}
                  transition={{ type: "spring", damping: 22, stiffness: 320 }}
                  aria-hidden
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
                className="shrink-0 rounded-xl p-2 transition"
                style={{ color: T.textFaint }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = T.bgCard;
                  e.currentTarget.style.color = T.text;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = T.textFaint;
                }}
                aria-label="Закрыть"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Scrollable content area — separate from drag.
                overscrollBehavior:contain prevents scroll chaining so swiping up
                at the top of the content never propagates to the sheet drag. */}
            <div
              className="overflow-y-auto px-4"
              style={{
                maxHeight: `calc(${SHEET_HEIGHT_VH * 100}vh - 56px)`,
                WebkitOverflowScrolling: "touch",
                overscrollBehavior: "contain",
                // Safe-area padding at bottom (iOS home indicator) + breathing
                // room above the bottom of the sheet.
                paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 80px)",
                scrollbarWidth: "thin",
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
