"use client";

/**
 * RestBreak — full-screen picture «передышка» between landing acts.
 *
 * Pollinated from /sly13 (boss 2026-10-27: «we recently added "rest sections"
 * to /sly13 — LOOKS AND FEELS GREAT — pollonate this great idea to other
 * interlinked rentals»). Same anatomy as Sly13LandingClient's rest acts:
 * 100svh picture with scroll-linked parallax (±9%), bg-colored scrim top and
 * bottom so the break melts into the acts around it, and a small caption
 * block bottom-left: kicker · headline with one accent word · teaser line
 * teasing the NEXT section. No cards, no lists — a breath.
 *
 * Shared client component (framer-motion useScroll) so RSC landings
 * (/moto-selection, /georg-electro) can render it too. reduced-motion:
 * framer-motion tracks nothing here beyond the scroll transform — same
 * trade-off as sly13's ParallaxBg; the parallax is subtle (±9%) and the
 * section is fully readable without it.
 */
import Image from "next/image";
import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";

export interface RestBreakProps {
  src: string;
  kicker: string;
  title: string;
  /** trailing accent word inside the headline (rendered in accent color) */
  accentWord?: string;
  note?: string;
  /** landing palette — scrim melts the picture into the surrounding acts */
  bg: string;
  accent: string;
  textPrimary: string;
  textSecondary: string;
  /** default 0.9 — lower it when the photo is very bright */
  imageOpacity?: number;
  /** extra classes on the <section> (e.g. landing-scoped font binding) */
  className?: string;
  /** extra classes on the headline (landing display font etc.) */
  titleClass?: string;
}

export function RestBreak({
  src,
  kicker,
  title,
  accentWord,
  note,
  bg,
  accent,
  textPrimary,
  textSecondary,
  imageOpacity = 0.9,
  className,
  titleClass,
}: RestBreakProps) {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], ["-9%", "9%"]);

  return (
    <section
      ref={ref}
      aria-label={typeof title === "string" ? `${kicker} — ${title}` : kicker}
      className={`relative isolate flex h-[100svh] min-h-[560px] items-end overflow-hidden ${className ?? ""}`}
      style={{ background: bg }}
    >
      {/* parallax picture — -inset-y gives the transform headroom */}
      <div className="absolute inset-0 overflow-hidden" aria-hidden>
        <motion.div style={{ y }} className="absolute -inset-y-[10%] inset-x-0">
          <Image
            src={src}
            alt=""
            fill
            sizes="100vw"
            className="object-cover"
            style={{ opacity: imageOpacity }}
          />
        </motion.div>
        {/* scrim: melts into the acts above and below (sly13 rest DNA) */}
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(to bottom, ${bg} 0%, ${bg}14 20%, ${bg}14 70%, ${bg} 100%)`,
          }}
        />
        {/* soft accent glow for depth (same recipe as sly13 rest acts) */}
        <div
          className="absolute inset-0"
          style={{ background: `radial-gradient(46% 52% at 16% 42%, ${accent}12 0%, transparent 70%)` }}
        />
      </div>
      <div className="relative z-10 mx-auto w-full max-w-7xl px-4 pb-14 sm:px-6 sm:pb-20">
        <p className="text-[11px] font-bold uppercase tracking-[0.3em]" style={{ color: accent }}>
          {kicker}
        </p>
        <p
          className={`mt-2 text-2xl font-extrabold uppercase leading-tight tracking-tight sm:text-4xl ${titleClass ?? ""}`}
          style={{ color: textPrimary }}
        >
          {title}
          {accentWord ? (
            <>
              {" "}
              <span style={{ color: accent }}>{accentWord}</span>
            </>
          ) : null}
        </p>
        {note ? (
          <p
            className="mt-3 text-[10px] uppercase leading-relaxed tracking-[0.22em] sm:text-[11px]"
            style={{ color: textSecondary }}
          >
            {note}
          </p>
        ) : null}
      </div>
    </section>
  );
}
