"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const surface = crewPaletteForSurface(crew.theme);

  const handleMenuLinkClick = (href: string) => {
    onOpenChange(false);
    router.push(href);
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!open || !mounted) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-start justify-center bg-black/75 p-4" onClick={() => onOpenChange(false)}>
      <div
        className="mt-[calc(max(env(safe-area-inset-top),0.5rem)+0.5rem)] w-full max-w-sm max-h-[calc(100dvh-max(env(safe-area-inset-top),0.5rem)-1rem)] overflow-y-auto rounded-2xl border p-4 shadow-2xl"
        style={{
          backgroundColor: crew.theme.palette.bgCard,
          borderColor: crew.theme.palette.borderSoft,
          color: crew.theme.palette.textPrimary,
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-semibold uppercase tracking-[0.16em]">Menu</p>
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => onOpenChange(false)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border"
            style={{ borderColor: crew.theme.palette.borderSoft }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mb-5 text-center text-xs italic" style={surface.mutedText}>{crew.header.tagline}</p>

        <div className="space-y-2">
          {crew.header.menuLinks.map((link) => {
            const isActive = activePath === link.href;
            return (
              <a
                key={`${link.href}-${link.label}`}
                href={link.href}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  handleMenuLinkClick(link.href);
                }}
                className="block rounded-xl border px-4 py-3 text-sm transition"
                style={{
                  borderColor: isActive ? crew.theme.palette.accentMain : crew.theme.palette.borderSoft,
                  color: isActive ? crew.theme.palette.accentMain : crew.theme.palette.textPrimary,
                }}
              >
                {link.label}
              </a>
            );
          })}
        </div>
      </div>
    </div>,
    document.body,
  );
}
