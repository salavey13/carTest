/**
 * GhostWordmark — a full-viewport-width decorative brand wordmark (SVG).
 *
 * Boss 2026-10-27 on /moto-selection: «HUGE "moto.selection" text at the
 * bottom of the page that is intended to cover whole screen width doesn't
 * fit a bit — fits only "MOTO.SELECTI" part — looks cool as fuck too».
 * The CSS version sized the font in vw and GUESSED the glyph budget —
 * 14 Archivo/Montserrat-black glyphs at 13vw ≈ 136vw of advance width,
 * so the tail was clipped. This component guarantees the fit BY
 * CONSTRUCTION: an SVG <text> with textLength="1000" (viewBox width 1000)
 * + lengthAdjust="spacingAndGlyphs" forces the string to span exactly the
 * artboard width at every viewport — then scales with the container
 * (w-full, aspect from the viewBox). Full width, zero clipping, one line.
 *
 * RSC-safe (no hooks/state). Each landing passes its own palette:
 * ghost segments render at low opacity, the brand-dot segment pops in the
 * accent color. aria-hidden — purely decorative.
 */
export interface GhostWordmarkPart {
  text: string;
  /** CSS color (supports var(...)) */
  color: string;
  /** fill-opacity for the ghost effect (default 0.05, accent dot ~0.6) */
  opacity?: number;
}

export function GhostWordmark({
  parts,
  className,
  fontFamily,
  height = 132,
  baseline = 118,
  fontSize = 128,
  title,
}: {
  parts: GhostWordmarkPart[];
  className?: string;
  /** inherit the landing's display font by default; override if needed */
  fontFamily?: string;
  /** viewBox height (text is sized by fontSize; keep height ≥ ~0.95×fontSize) */
  height?: number;
  /** baseline y inside the viewBox */
  baseline?: number;
  fontSize?: number;
  /** accessible label is skipped (decorative), but keep for debugging */
  title?: string;
}) {
  return (
    <div aria-hidden={title ? undefined : true} className={`select-none overflow-hidden ${className ?? ""}`}>
      <svg
        viewBox={`0 0 1000 ${height}`}
        className="block h-auto w-full"
        preserveAspectRatio="xMidYMid meet"
        role={title ? "img" : undefined}
      >
        {title ? <title>{title}</title> : null}
        <text
          x="500"
          y={baseline}
          textAnchor="middle"
          textLength="1000"
          lengthAdjust="spacingAndGlyphs"
          fontSize={fontSize}
          fontWeight={900}
          letterSpacing="0"
          style={{ fontFamily: fontFamily ?? "inherit", textTransform: "uppercase" }}
        >
          {parts.map((p, i) => (
            <tspan key={i} fill={p.color} fillOpacity={p.opacity ?? 0.05}>
              {p.text}
            </tspan>
          ))}
        </text>
      </svg>
    </div>
  );
}
