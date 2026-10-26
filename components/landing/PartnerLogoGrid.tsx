"use client";

// components/landing/PartnerLogoGrid.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Unified partner tile grid for the crew landings (boss 2026-10-27):
// «doublecheck proper interlinking trough partners sections consistently on
// all landings - try showing only logos at first, and reveal title on
// longtap/hover».
//
// Behaviour (identical on every landing):
//   at rest  → logo only, slightly dimmed;
//   hover    → logo lifts + brightens, title/tagline slide up over a gradient;
//   longtap  → same reveal on touch (≥380ms), releasing the finger keeps the
//              card open and suppresses the accidental navigation; second tap
//              follows the link;
//   focus    → keyboard focus reveals too (a11y parity), ESC closes.
//
// One card is revealed at a time; tapping elsewhere / scrolling closes it.
// Styling is inline + scoped <style> so it blends into any landing's palette:
// each item carries its own backing (light for logos with dark artwork,
// dark for neon logos) and the grid takes the landing's accent colour.
// ─────────────────────────────────────────────────────────────────────────────

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

export type PartnerLogoItem = {
  /** Target (internal route or absolute URL when external). */
  href: string;
  /** Title revealed on hover / longtap. */
  title: string;
  /** Short one-liner revealed under the title. */
  tagline?: string;
  /** Logo image source. */
  logoSrc: string;
  logoAlt?: string;
  /** Open in a new tab (external partner sites). */
  external?: boolean;
  /** CSS background of the tile — tune per brand logo. */
  backing?: string;
  /** Light backing → reveal overlay uses dark text. */
  lightBacking?: boolean;
};

const LONGTAP_MS = 380;

export default function PartnerLogoGrid({
  partners,
  accent = "#ff7522",
  columns = 4,
  ariaLabel = "Витрины партнёров платформы",
}: {
  partners: PartnerLogoItem[];
  /** Landing accent for the «Открыть витрину» hint. */
  accent?: string;
  /** Columns on ≥1024px (2 on mobile, ≤3 on tablet). */
  columns?: 2 | 3 | 4 | 5 | 6;
  ariaLabel?: string;
}) {
  const [revealed, setRevealed] = useState<string | null>(null);
  const longtapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressClick = useRef(false);

  const clearTimer = useCallback(() => {
    if (longtapTimer.current) {
      clearTimeout(longtapTimer.current);
      longtapTimer.current = null;
    }
  }, []);

  const close = useCallback(() => setRevealed(null), []);

  // Close on outside tap / scroll / Escape while a card is revealed.
  useEffect(() => {
    if (!revealed) return;
    const onDocTouch = (e: TouchEvent) => {
      if (!(e.target as HTMLElement | null)?.closest?.("[data-plg-card]")) close();
    };
    const onScroll = () => close();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("touchstart", onDocTouch, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("touchstart", onDocTouch);
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("keydown", onKey);
    };
  }, [revealed, close]);

  useEffect(() => clearTimer, [clearTimer]);

  const onTouchStart = (href: string) => {
    clearTimer();
    longtapTimer.current = setTimeout(() => {
      setRevealed((cur) => (cur === href ? cur : href));
      suppressClick.current = true;
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        try { navigator.vibrate(12); } catch { /* ignore */ }
      }
    }, LONGTAP_MS);
  };

  const onTouchMove = () => clearTimer(); // scroll gesture, not a longtap
  const onTouchEnd = () => clearTimer(); // release after reveal → keep open

  const onClick = (e: React.MouseEvent) => {
    if (suppressClick.current) {
      suppressClick.current = false;
      e.preventDefault();
      e.stopPropagation();
    }
  };

  return (
    <div
      className="plg-grid grid gap-3 sm:gap-4"
      style={{ ["--plg-cols" as string]: String(columns) }}
      role="list"
      aria-label={ariaLabel}
    >
      <style>{PLG_STYLES}</style>
      {partners.map((p) => {
        const isOpen = revealed === p.href;
        const ink = p.lightBacking ? "#141414" : "#FFFFFF";
        const inkSoft = p.lightBacking ? "rgba(20,20,20,0.62)" : "rgba(255,255,255,0.62)";
        const cover = p.lightBacking
          ? "linear-gradient(to top, rgba(255,255,255,0.97) 0%, rgba(255,255,255,0.88) 52%, rgba(255,255,255,0) 100%)"
          : "linear-gradient(to top, rgba(2,2,4,0.94) 0%, rgba(2,2,4,0.78) 52%, rgba(2,2,4,0) 100%)";
        const inner = (
          <>
            <img
              src={p.logoSrc}
              alt={p.logoAlt || p.title}
              loading="lazy"
              className="plg-logo"
              draggable={false}
            />
            <span className="plg-cover" style={{ background: cover }} aria-hidden={isOpen ? undefined : true}>
              <span className="plg-title" style={{ color: ink }}>{p.title}</span>
              {p.tagline && <span className="plg-tagline" style={{ color: inkSoft }}>{p.tagline}</span>}
              <span className="plg-open" style={{ color: accent }}>
                Открыть витрину
                <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
                  <path d="M4 8h7M8.5 4.5 12 8l-3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </span>
          </>
        );
        const shared = {
          role: "listitem" as const,
          "data-plg-card": "",
          "aria-label": p.title,
          title: p.title,
          className: `plg-card${isOpen ? " is-open" : ""}`,
          style: { background: p.backing || "rgba(255,255,255,0.03)", ["--plg-accent" as string]: accent },
          onTouchStart: () => onTouchStart(p.href),
          onTouchMove,
          onTouchEnd,
          onMouseEnter: () => setRevealed(null), // pointer devices use CSS hover; reset touch state
          onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
          onClick,
        };
        return p.external ? (
          <a key={p.href} href={p.href} target="_blank" rel="noopener noreferrer" {...shared}>
            {inner}
          </a>
        ) : (
          <Link key={p.href} href={p.href} {...shared}>
            {inner}
          </Link>
        );
      })}
    </div>
  );
}

const PLG_STYLES = `
.plg-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
@media (min-width: 640px) { .plg-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
@media (min-width: 1024px) { .plg-grid { grid-template-columns: repeat(var(--plg-cols, 4), minmax(0, 1fr)); } }

.plg-card {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  border-radius: 18px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 18px 22px 24px;
  transition: border-color .25s ease, transform .25s ease, box-shadow .25s ease;
  touch-action: manipulation;
  -webkit-user-select: none;
  user-select: none;
  cursor: pointer;
}
.plg-card:hover, .plg-card:focus-visible, .plg-card.is-open {
  border-color: color-mix(in srgb, var(--plg-accent) 55%, transparent);
  transform: translateY(-2px);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
}
.plg-card:focus-visible { outline: 2px solid var(--plg-accent); outline-offset: 2px; }

.plg-logo {
  max-width: 72%;
  max-height: 62%;
  width: auto;
  height: auto;
  object-fit: contain;
  opacity: 0.62;
  filter: saturate(0.92);
  transition: opacity .25s ease, transform .3s cubic-bezier(.2, .9, .3, 1.1), filter .25s ease;
}
.plg-card:hover .plg-logo, .plg-card:focus-visible .plg-logo, .plg-card.is-open .plg-logo {
  opacity: 1;
  filter: saturate(1.05);
  transform: translateY(-14%) scale(1.04);
}

.plg-cover {
  position: absolute;
  inset: auto 0 0 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 26px 14px 12px;
  text-align: center;
  opacity: 0;
  transform: translateY(10px);
  pointer-events: none;
  transition: opacity .22s ease, transform .25s ease;
}
.plg-card:hover .plg-cover, .plg-card:focus-visible .plg-cover, .plg-card.is-open .plg-cover {
  opacity: 1;
  transform: translateY(0);
}
.plg-title {
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  line-height: 1.2;
}
.plg-tagline {
  font-size: 10.5px;
  line-height: 1.35;
  max-width: 30ch;
}
.plg-open {
  margin-top: 3px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 9.5px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

@media (prefers-reduced-motion: reduce) {
  .plg-card, .plg-logo, .plg-cover { transition: none; }
}
`;
