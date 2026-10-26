"use client";

/**
 * PartnerRevealCard — shared tap/hover reveal behavior for landing partner
 * cards (task 144, boss: «I WANT PICTURE LOGOS AND TITLES BE REVEALED ON
 * TAP/HOVER»).
 *
 * WHY a shared client component: the reveal has two halves and they live in
 * different worlds —
 *   · VISUALS are per-landing (each landing has its own design system), so
 *     they stay in that landing's markup/CSS via children + classNames;
 *   · BEHAVIOR must be identical everywhere: PC hover is pure CSS
 *     (:hover), but touch has no hover — the FIRST tap reveals (native
 *     navigation is prevented), the SECOND tap follows the link. Without
 *     this gate a tap would just jump away and the boss would never see the
 *     reveal on his phone.
 *
 * Contract with the landing CSS: the <a> renders
 *   data-reveal-active="true" | "false"
 * and each landing styles its own reveal states as
 *   .x:hover .reveal, .x[data-reveal-active="true"] .reveal { ... }
 * (.x is the card class from the landing's stylesheet).
 *
 * The same first-tap gate is what /moto-selection service cards use
 * (ms-glass active state) — one interaction grammar across the landings.
 */

import { useRef, useState, type CSSProperties, type ReactNode } from "react";

export function PartnerRevealCard({
  href,
  className,
  style,
  children,
  ariaLabel,
  external = false,
}: {
  href: string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
  ariaLabel?: string;
  /** external partner sites open in a new tab with noopener (Bikeland, etc.) */
  external?: boolean;
}) {
  // pointerdown (not click) is the reliable place to remember the pointer
  // type: click synthesizes pointer events with pointerType="mouse" on some
  // touch browsers after the tap is already long-past.
  const lastPointerWasTouch = useRef(false);
  const [active, setActive] = useState(false);

  return (
    <a
      href={href}
      className={className}
      style={style}
      aria-label={ariaLabel}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      data-reveal-active={active ? "true" : "false"}
      onPointerDown={(e) => {
        lastPointerWasTouch.current = e.pointerType === "touch";
      }}
      onClick={(e) => {
        // Touch: first tap reveals, second tap follows the link.
        // Mouse/keyboard: href works immediately (hover already revealed).
        if (lastPointerWasTouch.current && !active) {
          e.preventDefault();
          setActive(true);
        }
      }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setActive(false);
        }
      }}
    >
      {children}
    </a>
  );
}
