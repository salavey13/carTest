// /app/franchize/[slug]/leads/components/LeadDetailSheet.tsx
"use client";

// 2026-09-01 OVERHAUL (replaces MobileLeadSheet).
//
// ONE adaptive sheet for lead details on every screen size:
//
//   • < lg (phones, Telegram-Desktop-narrow): bottom sheet.
//       - Height = viewport − measured CrewHeader bottom − gap (the header can
//         physically never overlap the sheet, whatever its current height is —
//         this fixes "top part overlapped by crewHeader" on PC-size windows).
//       - X close button BOTH in the title row and as a big centered button
//         right under it (user request: "move x to the middle or add padding
//         from top") — always below the Telegram native corner buttons.
//       - Drag-to-close via the handle; backdrop click; Escape.
//
//   • ≥ lg (desktop): right-side drawer sliding in from the right, full
//     height, max-w 640px. Replaces the old inline sticky detail panel whose
//     top (and close button) used to hide under the sticky CrewHeader.
//
// The measurement approach: on open we read the CrewHeader's live
// getBoundingClientRect().bottom (sticky element → its current visual bottom)
// and keep a floor of 72px (mobile) so even a missing header leaves a
// Telegram-native-button-safe gap. Re-measured on resize while open.

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useDragControls, type PanInfo } from "framer-motion";
import { X } from "lucide-react";

interface LeadDetailSheetProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  T: any;
}

const DESKTOP_QUERY = "(min-width: 1024px)";

/** Mobile floor for the sheet's top clearance (below TG native buttons). */
const MOBILE_CLEARANCE_FLOOR_PX = 72;
const DESKTOP_CLEARANCE_FLOOR_PX = 12;
/** Never taller than 90% of the viewport — keeps a visible page edge. */
const MAX_HEIGHT_RATIO = 0.9;

const sheetVariantsMobile = {
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

const drawerVariantsDesktop = {
  hidden: { x: "100%" },
  visible: {
    x: 0,
    transition: { type: "spring", damping: 30, stiffness: 300 },
  },
  exit: {
    x: "100%",
    transition: { type: "spring", damping: 30, stiffness: 340 },
  },
};

const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};

export function LeadDetailSheet({ open, onClose, children, title, T }: LeadDetailSheetProps) {
  const dragControls = useDragControls();
  const [isDesktop, setIsDesktop] = useState(false);
  /** Measured px from the viewport top to just below the CrewHeader. */
  const [clearance, setClearance] = useState(MOBILE_CLEARANCE_FLOOR_PX);
  /** Viewport height, refreshed on resize (used for the px sheet height). */
  const [viewportH, setViewportH] = useState<number | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  // ── Responsive mode (lg = 1024px, same as the old lg: classes) ──
  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_QUERY);
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // ── Measure the header clearance + viewport height while open ──
  // The page behind is scroll-locked while the sheet is open, so the sticky
  // header holds its current height — one measurement on open + on resize
  // is enough (no scroll listener needed).
  useEffect(() => {
    if (!open) return;
    let raf = 0;
    const measure = () => {
      const header = document.querySelector("header");
      let headerBottom = 0;
      if (header instanceof HTMLElement) {
        const rect = header.getBoundingClientRect();
        headerBottom = Math.max(0, Math.round(rect.bottom));
      }
      const floor = isDesktop ? DESKTOP_CLEARANCE_FLOOR_PX : MOBILE_CLEARANCE_FLOOR_PX;
      setClearance(Math.max(headerBottom + 8, floor));
      setViewportH(window.innerHeight);
    };
    measure();
    const onResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    };
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, [open, isDesktop]);

  // ── Close on Escape ──
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // ── Lock body scroll while the sheet is open ──
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    // Close only on a downward drag past the threshold with no strong upward
    // flick. The body scrolls independently (dragListener is off), so this
    // only fires from the handle.
    if (info.offset.y > 100 && info.velocity.y > -300) {
      onClose();
    }
  };

  // Mobile sheet height in px: viewport minus header clearance, capped at 90%.
  const sheetHeightPx =
    viewportH != null
      ? Math.max(
          240,
          Math.min(Math.round(viewportH * MAX_HEIGHT_RATIO), viewportH - clearance),
        )
      : undefined;

  return (
    <AnimatePresence>
      {open && (
        <div
          // z-[60]: above the sticky CrewHeader (z-50), below toasts (z-[70]).
          // The DismissLeadDialog also uses z-[60] but renders later in the
          // DOM, so it still stacks above this sheet.
          className="fixed inset-0 z-[60] flex"
          style={{
            justifyContent: isDesktop ? "flex-end" : undefined,
            alignItems: isDesktop ? "stretch" : "flex-end",
            paddingTop: isDesktop ? undefined : `${clearance}px`,
          }}
        >
          {/* Backdrop — dims the page (incl. the CrewHeader) behind the sheet */}
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

          {isDesktop ? (
            // ── Desktop: right-side drawer ──
            <motion.aside
              key="lead-drawer"
              aria-label="Детали лида"
              className="relative flex h-full w-full max-w-[640px] flex-col shadow-2xl"
              style={{
                backgroundColor: T.bg,
                borderLeft: `1px solid ${T.border}`,
                boxShadow: "0 0 60px rgba(0,0,0,0.55)",
              }}
              variants={drawerVariantsDesktop}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              {/* Drawer header — title + X (X has its own top padding so it
                  clears any Telegram-native top chrome) */}
              <div
                className="sticky top-0 z-10 flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3"
                style={{
                  backgroundColor: T.bg,
                  borderColor: T.borderSoft,
                  paddingTop: "max(env(safe-area-inset-top, 0px), 0.75rem)",
                }}
              >
                <p
                  className="min-w-0 flex-1 truncate text-base font-semibold leading-tight"
                  style={{ color: T.text }}
                >
                  {title || "Лид"}
                </p>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full border transition hover:bg-black/10 active:scale-95"
                  style={{ color: T.textMuted, borderColor: T.borderSoft }}
                  aria-label="Закрыть"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              {/* Scrollable content */}
              <div
                className="flex-1 overflow-y-auto px-4 py-4"
                style={{ WebkitOverflowScrolling: "touch", overscrollBehavior: "contain" }}
              >
                {children}
              </div>
            </motion.aside>
          ) : (
            // ── Mobile: bottom sheet ──
            <motion.div
              key="lead-sheet"
              ref={sheetRef}
              role="dialog"
              aria-label={title || "Детали лида"}
              className="relative flex w-full flex-col rounded-t-3xl border-t shadow-2xl"
              style={{
                height: sheetHeightPx != null ? `${sheetHeightPx}px` : "min(88vh, calc(100dvh - 80px))",
                backgroundColor: T.bgCard,
                borderColor: T.border,
                boxShadow: "0 -8px 32px rgba(0,0,0,0.4), 0 -1px 0 rgba(255,255,255,0.06) inset",
              }}
              variants={sheetVariantsMobile}
              initial="hidden"
              animate="visible"
              exit="exit"
              // Drag ONLY via the handle (dragListener=false here) — the body
              // scrolls independently and must not hijack the gesture.
              drag="y"
              dragControls={dragControls}
              dragListener={false}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.4 }}
              onDragEnd={handleDragEnd}
            >
              {/* Sticky sheet header — drag handle + title + X on the right.
                  The sheet's top is BELOW the measured CrewHeader bottom, so
                  the X can never end up under the header. It is also centered
                  in the row above the content, away from the Telegram-native
                  top corner buttons. */}
              <div
                className="sticky top-0 z-10 flex shrink-0 items-center gap-3 px-3 pb-2 pt-3"
                style={{
                  backgroundColor: T.bgCard,
                  borderBottom: `1px solid ${T.borderSoft}`,
                }}
              >
                {/* Drag handle — the only draggable region */}
                <motion.div
                  onPointerDown={(e) => {
                    dragControls.start(e);
                  }}
                  className="flex h-11 w-11 shrink-0 cursor-grab items-center justify-center rounded-md active:cursor-grabbing"
                  aria-label="Перетащите вниз, чтобы закрыть"
                  role="button"
                  tabIndex={-1}
                >
                  <div
                    className="h-1.5 w-10 rounded-full"
                    style={{ backgroundColor: T.textFaint }}
                  />
                </motion.div>
                {title && (
                  <p
                    className="min-w-0 flex-1 truncate text-sm font-semibold leading-tight"
                    style={{ color: T.text }}
                  >
                    {title}
                  </p>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full border transition hover:bg-black/10 active:scale-95"
                  style={{ color: T.textMuted, borderColor: T.borderSoft }}
                  aria-label="Закрыть"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Scrollable content — independent of drag */}
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
          )}
        </div>
      )}
    </AnimatePresence>
  );
}
