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

export function HeaderMenu({ crew, activePath, open, onOpenChange }: HeaderMenuProps) {
  const [mounted, setMounted] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const surface = crewPaletteForSurface(crew.theme);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onOpenChange(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    closeButtonRef.current?.focus();
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onOpenChange, open]);

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-start justify-center bg-black/75 p-4" onClick={() => onOpenChange(false)}>
      <div
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
                onClick={() => onOpenChange(false)}
                aria-current={isActive ? "page" : undefined}
                className={`w-full text-left block rounded-xl border px-4 py-3 text-sm transition cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--header-menu-accent)] ${
                  isActive
                    ? "border-[var(--header-menu-accent)] text-[var(--header-menu-accent)]"
                    : "border-[var(--header-menu-border)] text-[var(--header-menu-text)]"
                }`}
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