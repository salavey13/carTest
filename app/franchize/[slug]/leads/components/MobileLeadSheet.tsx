// /app/franchize/[slug]/leads/components/MobileLeadSheet.tsx
"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence, useDragControls, type PanInfo } from "framer-motion";
import { X } from "lucide-react";

interface MobileLeadSheetProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  T: any;
}

// 72% of viewport height — leaves a 28% gap at the top so:
//   - The CrewHeader (sticky top-0 z-50) doesn't overlap the sheet
//   - The close (X) button at the top of the sheet is always visible + tappable
// Previously 80% which was too tall — on small screens (≤700px tall) the
// sheet's top edge ended up underneath the CrewHeader and the close button
// became unreachable.
const SHEET_HEIGHT_VH = 72;

const sheetVariants = {
  hidden: { y: "100%" },
  visible: {
    y: 0,
    transition: { type: "spring", damping: 32, stiffness: 320, mass: 0.8 },
  },
  exit: {
    y: "100%",
    transition: { type: "spring", damping: 32, stiffness: 380, mass: 0.8 },
  },
};

const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};

/**
 * Mobile bottom sheet for lead details.
 *
 * Layout:
 *   - Outer flex container fills the viewport (z-40, below TG native UI).
 *   - Backdrop dims the page behind.
 *   - Sheet is anchored to the bottom, takes 80vh of height.
 *   - Sheet header (drag handle + title + X) is sticky at the top of the sheet.
 *   - Sheet body scrolls vertically inside the sheet — independent of the page.
 *
 * Drag behavior:
 *   - The drag handle (the small pill at the top) is the ONLY draggable region.
 *   - Dragging the handle down by >80px closes the sheet.
 *   - The body is NOT draggable — this prevents the scroll gesture inside the
 *     body from being hijacked by framer-motion's drag handler, which was
 *     causing the sheet to "collapse when scrolled" (the user's complaint).
 *     When the user scrolled up inside the body, momentum pushed the gesture
 *     into drag territory and the sheet started following the finger.
 *
 * Top gap:
 *   - The outer container has `paddingTop: env(safe-area-inset-top)` plus
 *     `paddingTop: 24px` so even on devices without a notch, there's a
 *     visible gap at the top for the TG native back/close button.
 */
export function MobileLeadSheet({ open, onClose, children, title, T }: MobileLeadSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  // useDragControls is the official framer-motion API for "drag from handle".
  // We pass dragListener={false} on the sheet so the body doesn't trigger
  // drag, and the handle calls dragControls.start(e) on pointer down to
  // initiate the drag gesture manually.
  const dragControls = useDragControls();

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Lock body scroll while sheet is open so the page behind doesn't move
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    // Close only if the user dragged DOWN past the threshold (positive y offset)
    // AND the body is scrolled to the top (offset.y === 0). This prevents the
    // sheet from closing when the user is just scrolling content up.
    if (info.offset.y > 100 && info.velocity.y > -300) {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <div
          // z-[60]: above CrewHeader (z-50), above other page chrome, below
          // toasts (z-[70]). The previous z-40 was UNDER the CrewHeader's z-50,
          // which is why the sheet's top (close button) was hidden behind it.
          className="fixed inset-0 z-[60] flex items-end lg:hidden"
          style={{
            // Leave a visible gap at the top so:
            //   - the CrewHeader (sticky z-50) stays visible behind the sheet
            //     but doesn't overlap the close (X) button
            //   - the user can always see and tap the close button
            // 80px is enough to clear the CrewHeader's full height (~76px on
            // most TG WebApp contexts) plus a small breathing margin.
            paddingTop: "max(env(safe-area-inset-top, 0px), 80px)",
          }}
        >
          {/* Backdrop */}
          <motion.div
            key="sheet-backdrop"
            className="absolute inset-0"
            style={{ backgroundColor: "rgba(0,0,0,0.55)" }}
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={onClose}
          />

          {/* Sheet — drag only via the handle, body scrolls independently */}
          <motion.div
            key="lead-sheet"
            ref={sheetRef}
            className="relative flex w-full flex-col rounded-t-3xl border-t shadow-2xl"
            style={{
              height: `${SHEET_HEIGHT_VH}vh`,
              backgroundColor: T.bgCard,
              borderColor: T.border,
              // Subtle top highlight so the sheet's edge is visible against
              // the dimmed backdrop (especially in dark themes where the
              // border color alone is too low-contrast).
              boxShadow: "0 -8px 32px rgba(0,0,0,0.4), 0 -1px 0 rgba(255,255,255,0.06) inset",
            }}
            variants={sheetVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            // drag="y" on the WHOLE sheet was the bug — it hijacked scroll
            // gestures inside the body. Now we drag only via the handle
            // (dragListener={false} here, dragControls.start(e) on the handle).
            drag="y"
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            onDragEnd={handleDragEnd}
          >
            {/* Sticky header — drag handle + title (NO close button here —
                it overlaps Telegram's native floating back/close button
                which sits at the top-right of the WebApp viewport). */}
            <div
              className="sticky top-0 z-10 flex shrink-0 items-center gap-3 pb-2 pt-3"
              style={{
                backgroundColor: T.bgCard,
                borderBottom: `1px solid ${T.borderSoft}`,
              }}
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                {/* Drag handle — the only draggable region */}
                <motion.div
                  onPointerDown={(e) => {
                    // Start a drag gesture when the user grabs the handle.
                    // This is the official framer-motion pattern for
                    // "drag-from-handle": dragListener={false} on the
                    // draggable element + manual start on the handle.
                    dragControls.start(e);
                  }}
                  className="flex h-8 w-10 shrink-0 cursor-grab items-center justify-center rounded-md active:cursor-grabbing"
                  aria-label="Перетащите вниз, чтобы закрыть"
                  role="button"
                  tabIndex={-1}
                >
                  <div
                    className="h-1.5 w-9 rounded-full"
                    style={{ backgroundColor: T.textFaint }}
                  />
                </motion.div>
                {title && (
                  <p
                    className="truncate text-sm font-semibold leading-tight"
                    style={{ color: T.text }}
                  >
                    {title}
                  </p>
                )}
              </div>
            </div>

            {/* Close button — placed BELOW the header, centered, to avoid
                overlapping Telegram's native floating button (top-right).
                The native button is ~44px tall; placing our X at ~60px from
                the top of the sheet clears it with margin to spare. */}
            <div className="flex shrink-0 justify-center pb-1 pt-1" style={{ backgroundColor: T.bgCard }}>
              <button
                onClick={onClose}
                className="flex h-9 w-9 items-center justify-center rounded-full border transition hover:bg-black/10 active:scale-95"
                style={{
                  color: T.textMuted,
                  borderColor: T.borderSoft,
                }}
                aria-label="Закрыть"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Scrollable content area — independent of drag */}
            <div
              className="flex-1 overflow-y-auto px-4 py-4"
              style={{
                WebkitOverflowScrolling: "touch",
                overscrollBehavior: "contain",
              }}
            >
              <div
                className="pb-[calc(env(safe-area-inset-bottom,_16px)+24px)]"
                style={{ minHeight: "100%" }}
              >
                {children}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
