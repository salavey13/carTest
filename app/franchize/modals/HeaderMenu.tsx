"use client";

import Link from "next/link";
import { X } from "lucide-react";
import type { FranchizeCrewVM } from "../actions";

interface HeaderMenuProps {
  crew: FranchizeCrewVM;
  activePath: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function HeaderMenu({ crew, activePath, open, onOpenChange }: HeaderMenuProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center bg-black/70 p-4" onClick={() => onOpenChange(false)}>
      <div
        className="mt-16 w-full max-w-sm rounded-2xl border p-4"
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

        <p className="mb-5 text-center text-xs text-muted-foreground italic">{crew.header.tagline}</p>

        <div className="space-y-2">
          {crew.header.menuLinks.map((link) => {
            const isActive = activePath === link.href;
            return (
              <Link
                key={`${link.href}-${link.label}`}
                href={link.href}
                onClick={() => onOpenChange(false)}
                className="block rounded-xl border px-4 py-3 text-sm transition"
                style={{
                  borderColor: isActive ? crew.theme.palette.accentMain : crew.theme.palette.borderSoft,
                  color: isActive ? crew.theme.palette.accentMain : crew.theme.palette.textPrimary,
                }}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
