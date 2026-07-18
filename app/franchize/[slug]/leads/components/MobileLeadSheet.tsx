"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

interface MobileLeadSheetProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  T: any;
}

export function MobileLeadSheet({ open, onClose, children, T }: MobileLeadSheetProps) {
  const [visible, setVisible] = useState(false);
  const [animating, setAnimating] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setVisible(true);
      // Trigger animation on next frame
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setAnimating(true));
      });
    } else {
      setAnimating(false);
      const timer = setTimeout(() => setVisible(false), 250);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end lg:hidden">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 transition-opacity duration-250 ${
          animating ? "opacity-100" : "opacity-0"
        }`}
        style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className={`relative w-full max-h-[85vh] rounded-t-3xl border-t shadow-2xl overflow-y-auto transition-transform duration-250 ease-out ${
          animating ? "translate-y-0" : "translate-y-full"
        }`}
        style={{
          backgroundColor: T.bgCard,
          borderColor: T.border,
        }}
      >
        {/* Drag handle */}
        <div className="sticky top-0 z-10 flex items-center justify-center pt-3 pb-2" style={{ backgroundColor: T.bgCard }}>
          <div className="h-1.5 w-10 rounded-full" style={{ backgroundColor: T.borderSoft }} />
          <button
            onClick={onClose}
            className="absolute right-4 top-2 rounded-xl p-2 transition hover:bg-black/10"
            style={{ color: T.textFaint }}
            aria-label="Закрыть"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-4 pb-8">{children}</div>
      </div>
    </div>
  );
}
