"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { FranchizeCrewVM } from "../actions";
import { crewPaletteForSurface } from "../lib/theme";

interface HeaderMenuProps {
  crew: FranchizeCrewVM;
  activePath: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export function HeaderMenu({ crew, activePath, open, onOpenChange }: HeaderMenuProps) {
  const [mounted, setMounted] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const surface = crewPaletteForSurface(crew.theme);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    const originalOverflow = document.body.style.overflow;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = "hidden";

    const focusFirstControl = window.requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onOpenChange(false);
        return;
      }

      if (event.key !== "Tab") return;

      const focusable = Array.from(menuRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ?? [])
        .filter((element) => element.offsetParent !== null || element === document.activeElement);
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFirstControl);
      document.body.style.overflow = originalOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      if (previouslyFocused && document.contains(previouslyFocused)) {
        previouslyFocused.focus();
      }
    };
  }, [onOpenChange, open]);

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-start justify-center bg-black/75 p-4" onClick={() => onOpenChange(false)}>
      <div
        ref={menuRef}
        id="franchize-header-menu"
        role="dialog"
        aria-modal="true"
        aria-labelledby="franchize-header-menu-title"
        className="mt-[calc(max(env(safe-area-inset-top),0.5rem)+0.5rem)] max-h-[calc(100dvh-max(env(safe-area-inset-top),0.5rem)-1rem)] w-full max-w-sm overflow-y-auto rounded-2xl border border-[var(--header-menu-border)] bg-[var(--header-menu-bg)] p-4 text-[var(--header-menu-text)] shadow-2xl"
        style={{
          ["--header-menu-bg" as string]: crew.theme.palette.bgCard,
          ["--header-menu-border" as string]: crew.theme.palette.borderSoft,
          ["--header-menu-text" as string]: crew.theme.palette.textPrimary,
          ["--header-menu-accent" as string]: crew.theme.palette.accentMain,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <p id="franchize-header-menu-title" className="text-sm font-semibold uppercase tracking-[0.16em]">Меню экипажа</p>
          <button
            ref={closeButtonRef}
            type="button"
            aria-label="Закрыть меню"
            onClick={() => onOpenChange(false)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--header-menu-border)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--header-menu-accent)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mb-5 text-center text-xs italic" style={surface.mutedText}>{crew.header.tagline}</p>

        <div className="space-y-2">
          {crew.header.menuLinks.map((link) => {
            const isActive = activePath === link.href;
            return (
              <Link
                key={`${link.href}-${link.label}`}
                href={link.href}
                onClick={(e) => {
                  // ── FIX v6: Always close menu + let Link navigate ──
                  // v5 tried: "don't close menu for regular links, let pathname
                  // change effect close it." This failed because:
                  // a) If the Link navigates to the same page, pathname doesn't
                  //    change, and the menu stays open (appears broken).
                  // b) If navigation is slow, the menu stays open too long.
                  //
                  // v6 approach: Always close the menu immediately for clear
                  // user feedback. Don't call e.preventDefault() for regular
                  // links so the Next.js <Link> component handles navigation
                  // via its own internal onClick (which calls router.push
                  // wrapped in startTransition). The menu close (setState)
                  // and the Link's navigation both fire in the same React
                  // batch, so they don't conflict.
                  //
                  // For hash links, prevent default and scroll manually.
                  if (link.href.startsWith("#")) {
                    e.preventDefault();
                    const target = document.querySelector(link.href);
                    target?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }
                  onOpenChange(false);
                }}
                aria-current={isActive ? "page" : undefined}
                className={`w-full text-left block rounded-xl border px-4 py-3 text-sm no-underline transition cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--header-menu-accent)] ${
                  isActive
                    ? "border-[var(--header-menu-accent)] text-[var(--header-menu-accent)]"
                    : "border-[var(--header-menu-border)] text-[var(--header-menu-text)]"
                }`}
                style={{ textDecoration: "none" }}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      </div>
    </div>,
    document.body,
  );
}