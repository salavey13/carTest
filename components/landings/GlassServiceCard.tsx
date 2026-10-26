"use client";

/**
 * GlassServiceCard — the /moto-selection «ms-glass» service card as a shared
 * component (boss 2026-10-27: «Unblur mistery solved indeed!! Looks even
 * awesomer then cards in catalogue! Please apply same design tweak to cards
 * on other landings and add pictures where nesessary»).
 *
 * Anatomy (1:1 with MsServicesGrid on /moto-selection):
 *   full-bleed picture → фирменное стекло (black 60% + blur(5px)) → content
 *   (numeral poking from under the top edge, title, price pill, text, pill
 *   CTA pinned to the bottom). Hover/first-tap DISSOLVES the glass entirely
 *   (opacity 1→0, tint AND blur both gone — the ground truth probed on
 *   moto-selection.ru, where «still blurred» complaints came from keeping
 *   the dark tint above the sharpened photo).
 *
 * Interaction grammar: PC hover is pure CSS (hover:hover + pointer:fine);
 * touch has no hover — the FIRST tap reveals (glass fades), the SECOND tap
 * follows the action (link / lead modal), same as PartnerRevealCard and
 * MsServicesGrid. Keyboard gets :focus-visible reveal.
 *
 * Theming: pass --gs-accent (and optionally --gs-glass-bg) via style; the
 * landing's font applies automatically. Rendering modes:
 *   href        → <a> (in-page anchor or route)
 *   leadModal   → <button data-lead-modal-open> (FeedbackModal delegation)
 *   neither     → <article> (no action)
 */
import Image from "next/image";
import { useRef, useState } from "react";

export interface GlassServiceCardProps {
  img?: string;
  num?: string;
  title: string;
  price?: string;
  text: string;
  ctaLabel?: string;
  href?: string;
  /** card triggers the shared lead modal via [data-lead-modal-open] */
  leadModal?: boolean;
  ariaLabel?: string;
  style?: React.CSSProperties;
  className?: string;
  minH?: string;
}

const FALLBACK_BG = "linear-gradient(135deg, #20242c 0%, #0c0e12 100%)";

export function GlassServiceCard({
  img,
  num,
  title,
  price,
  text,
  ctaLabel = "Подробнее",
  href,
  leadModal = false,
  ariaLabel,
  style,
  className,
  minH = "340px",
}: GlassServiceCardProps) {
  const [activeId, setActiveId] = useState(false);
  const lastPointerWasTouch = useRef(false);

  const revealGate = {
    onPointerDown: (e: React.PointerEvent) => {
      lastPointerWasTouch.current = e.pointerType === "touch";
    },
    onClick: (e: React.MouseEvent) => {
      // Touch: first tap reveals (glass fades), second tap acts. The reveal
      // tap must ALSO not open the lead modal: FeedbackModal's trigger is a
      // document-level click delegation on [data-lead-modal-open] — a plain
      // stopPropagation() cannot block it (React's own delegation and that
      // listener live on the SAME node — only stopImmediatePropagation
      // would, and only if React attaches before the modal's effect). So the
      // gate leaves a SYNCHRONOUS mark on the element; the delegation
      // consumes it and stays closed. Deterministic, propagation-agnostic.
      if (lastPointerWasTouch.current && !activeId) {
        e.preventDefault();
        e.stopPropagation();
        (e.currentTarget as HTMLElement).setAttribute("data-reveal-pending", "true");
        setActiveId(true);
      }
    },
  };

  const inner = (
    <>
      {img ? (
        <Image
          src={img}
          alt=""
          aria-hidden
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="object-cover transition duration-500 group-hover:scale-105"
        />
      ) : (
        <div aria-hidden className="absolute inset-0" style={{ background: FALLBACK_BG }} />
      )}
      {/* фирменное стекло: ховер/тап снимает его ЦЕЛИКОМ (opacity 0) */}
      <div className="gs-glass absolute inset-0" aria-hidden />
      <div className="relative z-10 flex flex-1 flex-col items-center p-6 text-center">
        {num ? (
          <span
            aria-hidden
            className="pointer-events-none -mt-12 select-none text-[88px] font-bold leading-none text-white/85 transition duration-300 group-hover:text-[var(--gs-accent)] sm:text-[110px]"
          >
            {num}
          </span>
        ) : (
          <span aria-hidden className="mt-10" />
        )}
        <h3 className="mt-2 text-lg font-normal uppercase leading-snug text-white">{title}</h3>
        {price ? (
          <span className="mt-2 rounded-full border border-white/25 px-3 py-1 text-[11px] font-semibold text-white/85">
            {price}
          </span>
        ) : null}
        <p className="mt-3 line-clamp-3 text-xs leading-relaxed text-white/55">{text}</p>
        <span
          className="mt-auto inline-flex h-12 w-[200px] items-center justify-center self-center rounded-[30px] bg-[var(--gs-accent)] text-xs font-semibold uppercase tracking-[0.08em] text-white transition group-hover:brightness-110"
          style={{ marginTop: "auto" }}
        >
          {ctaLabel}
        </span>
      </div>
    </>
  );

  // NOTE: minHeight goes through inline style — Tailwind can't JIT dynamic
  // arbitrary classes (min-h-[${minH}] would silently not exist).
  const baseClass = `gs-card group relative flex w-full flex-col overflow-hidden rounded-[20px] border border-white/10 bg-white/[0.04] transition hover:border-[var(--gs-accent)]/60 ${className ?? ""}`;

  const common = {
    "data-active": activeId ? "true" : "false",
    className: baseClass,
    style: { minHeight: minH, ...style },
    ...revealGate,
  };

  if (href) {
    return (
      <a href={href} {...common} aria-label={ariaLabel ?? title}>
        {inner}
      </a>
    );
  }
  if (leadModal) {
    return (
      <button type="button" data-lead-modal-open {...common} aria-label={ariaLabel ?? title}>
        {inner}
      </button>
    );
  }
  return (
    <article {...common} aria-label={ariaLabel ?? title}>
      {inner}
    </article>
  );
}

/** The glass recipe lives once next to the component — every landing that
 *  renders GlassServiceCard also renders this style block (idempotent). */
export function GlassServiceCardStyle() {
  return (
    <style>{`
      .gs-glass {
        background: var(--gs-glass-bg, rgba(0, 0, 0, 0.6));
        -webkit-backdrop-filter: blur(5px);
        backdrop-filter: blur(5px);
        transition: opacity 0.5s ease;
      }
      @media (hover: hover) and (pointer: fine) {
        .gs-card:hover .gs-glass { opacity: 0; }
      }
      .gs-card[data-active="true"] .gs-glass,
      .gs-card:focus-visible .gs-glass { opacity: 0; }
    `}</style>
  );
}
