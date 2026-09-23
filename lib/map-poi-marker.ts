// lib/map-poi-marker.ts
// ─────────────────────────────────────────────────────────────────────────────
// POI marker upgrade («instead of simple dots show real icons with round
// pictures if available» — map-riders feedback, 2026-09-22).
//
// RacingMap previously rendered EVERY point-POI as a bare CircleMarker and
// ignored `poi.icon` entirely. Now:
//   · `image:<url>` icon or `poi.imageUrl` → round avatar marker (crew logo,
//     catalog item photo, wall pin photo, demo-rider initials);
//   · `::FaXxx::` icon → real Font Awesome 6 glyph on a colored round badge
//     (spots, meetups, HQ, routes endpoints);
//   · neither → fallback to the classic CircleMarker dot.
//
// Security notes:
//   · FA glyph names are only ever used as a LOOKUP KEY into the fixed
//     `react-icons/fa6` module — an arbitrary string can never inject markup;
//   · image URLs must match http(s)/data:image (no javascript: etc.) and are
//     attribute-escaped before entering the divIcon HTML;
//   · colors are attribute-escaped too (DB POIs carry arbitrary strings).
// ─────────────────────────────────────────────────────────────────────────────

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as Fa6Icons from "react-icons/fa6";
import L from "leaflet";

export type ParsedPoiIcon =
  | { kind: "image"; url: string }
  | { kind: "fa"; name: string }
  | { kind: "initials"; text: string }
  | { kind: "none" };

/**
 * Parses the marker icon grammar used across the map layer:
 *   `image:https://…` → picture, `::FaMotorcycle::` → FA6 glyph,
 *   `initials:АК` → local initials badge (zero network — works offline and
 *   when foreign placeholder CDNs are slow/blocked), else none.
 */
export function parsePoiIcon(icon: string | null | undefined): ParsedPoiIcon {
  const raw = (icon ?? "").trim();
  if (!raw) return { kind: "none" };

  if (raw.toLowerCase().startsWith("image:")) {
    const url = raw.slice("image:".length).trim();
    return url ? { kind: "image", url } : { kind: "none" };
  }

  if (raw.toLowerCase().startsWith("initials:")) {
    // Cap at 3 chars — badges are 34px, longer strings become noise. Spread
    // via Array.from so astral characters (emoji initials) don't tear into
    // lone surrogates. The text is attribute-escaped by the builder before
    // entering any HTML.
    const text = Array.from(raw.slice("initials:".length).trim()).slice(0, 3).join("");
    return text ? { kind: "initials", text } : { kind: "none" };
  }

  const fa = /^::\s*([A-Za-z][A-Za-z0-9_]{0,63})\s*::$/.exec(raw);
  if (fa) return { kind: "fa", name: fa[1] };

  return { kind: "none" };
}

/** Only web-safe image sources may enter marker HTML. */
export function isSafeMarkerImageUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed || trimmed.length > 2048) return false;
  return /^(https?:\/\/|data:image\/(png|jpe?g|webp|gif|avif);)/i.test(trimmed);
}

/**
 * Percent-encodes every character that could terminate the CSS `url('…')`
 * string or start another declaration. HTML-entity escaping alone is NOT
 * enough here: the browser decodes entities BEFORE applying the style, so a
 * raw `'` from a user-authored photo URL could break out of the CSS string
 * (CSS injection). Percent-encoding keeps the URL functionally identical —
 * the browser decodes %27 etc. at the URL layer, after CSS parsing.
 *
 * data:image URLs keep `;` / parens (mime/params structure — including the
 * `;base64,` token — must stay intact), but get the FULL quoted-string
 * breakout set encoded: quotes, backslash AND raw newlines — a raw newline
 * is a BAD-STRING terminator in the CSS syntax, after which the parser
 * resumes with new declarations at the next `;` (codereview SF-1).
 */
export function cssSafeUrlForMarker(url: string): string {
  if (/^data:image\//i.test(url)) {
    return url.replace(/['"\\\n\r\f]/g, (c) => {
      switch (c) {
        case "'": return "%27";
        case '"': return "%22";
        case "\\": return "%5C";
        case "\n": return "%0A";
        case "\r": return "%0D";
        default: return "%0C"; // \f
      }
    });
  }
  // NB: encodeURIComponent leaves ' ( ) untouched (unreserved marks) — exactly
  // the chars needed to break out of url('…') — hence the explicit map.
  return url.replace(/['"()\\\s;]/g, (c) => {
    switch (c) {
      case "'": return "%27";
      case '"': return "%22";
      case "(": return "%28";
      case ")": return "%29";
      case "\\": return "%5C";
      case ";": return "%3B";
      default: return "%20"; // whitespace
    }
  });
}

function escAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const faGlyphHtmlCache = new Map<string, string | null>();

/**
 * Renders a react-icons/fa6 component to a static `<svg>` string (cached).
 * Unknown names → null (caller falls back to the plain dot) — the name is
 * never interpolated into HTML, only used as a module lookup key.
 */
export function fa6GlyphSvg(name: string): string | null {
  const cached = faGlyphHtmlCache.get(name);
  if (cached !== undefined) return cached;

  let html: string | null = null;
  const candidate = (Fa6Icons as unknown as Record<string, unknown>)[name];
  if (typeof candidate === "function" || (candidate !== null && typeof candidate === "object")) {
    try {
      html = renderToStaticMarkup(createElement(candidate as React.ComponentType<{ className?: string }>));
    } catch {
      html = null;
    }
  }
  faGlyphHtmlCache.set(name, html);
  return html;
}

export interface PoiMarkerOptions {
  color: string;
  /** Round picture source (already validated) — wins over the FA badge. */
  imageUrl?: string | null;
  /** FA6 icon name for the badge variant (e.g. "FaLocationDot"). */
  faName?: string | null;
  /**
   * Local initials badge ("АК") for entities without a photo — live riders,
   * demo riders. Rendered offline; text is escaped, auto-contrasted against
   * the disc color.
   */
  initials?: string | null;
  /** "lg" = 40px anchor marker (crew HQ); "sm" = 26px route-start badge; default "md" = 34px. */
  markerSize?: "sm" | "md" | "lg";
  /** Explicit halo pulse (the legacy mr-spot-popup carry-over still works). */
  halo?: boolean;
  /** Extra classes carried over from the old CircleMarker (halo, entrance). */
  markerClassName?: string;
}

/**
 * White text on a light disc is unreadable (yellow self-rider badge!).
 * YIQ luma picks dark glyphs for light backgrounds. Understands 3-digit hex
 * too (expanded to 6) — DB-authored palette values come in both shapes.
 */
export function readableTextColorOn(hexColor: string): string {
  const trimmed = hexColor.trim().replace(/^#/, "");
  const hex6 =
    /^[0-9a-fA-F]{6}$/.test(trimmed)
      ? trimmed
      : /^[0-9a-fA-F]{3}$/.test(trimmed)
        ? trimmed.split("").map((ch) => ch + ch).join("")
        : null;
  if (!hex6) return "#ffffff";
  const v = parseInt(hex6, 16);
  const r = (v >> 16) & 255;
  const g = (v >> 8) & 255;
  const b = v & 255;
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 150 ? "#0f172a" : "#ffffff";
}

const CSS_COLOR_RE =
  /^#[0-9a-fA-F]{3,8}$|^rgba?\(\s*[-\d.,\s%]+\)$|^hsla?\(\s*[-\d.,\s%]+\)$/i;

/**
 * Whitelist guard for colors interpolated into the divIcon style attribute.
 * escAttr does not encode `;`, so a DB-authored `red;background:url(https://evil)`
 * would otherwise inject extra CSS declarations next to background-color.
 * Anything that is not a plain hex/rgb(a)/hsl(a) color (or is absurdly long —
 * style-attr size guard) collapses to the fallback accent.
 */
export function safeCssColor(raw: string | null | undefined, fallback = "#f97316"): string {
  const color = (raw ?? "").trim();
  if (color.length > 64) return fallback;
  return CSS_COLOR_RE.test(color) ? color : fallback;
}

/**
 * Builds a Leaflet divIcon for a POI:
 *   · round picture with a colored ring when `imageUrl` is present — the FA
 *     glyph (if any) is layered UNDERNEATH as a pure-CSS fallback, so a broken
 *     photo degrades to the colored badge instead of an ugly broken-image icon
 *     (a background-image that fails to load simply paints nothing — no inline
 *     JS handlers needed);
 *   · colored round badge with a white FA6 glyph otherwise;
 *   · local initials badge when neither photo nor glyph exists;
 *   · `null` when nothing renderable is available (caller keeps CircleMarker).
 */
export function buildPoiMarkerIcon(options: PoiMarkerOptions): L.DivIcon | null {
  // Whitelist the color (DB POIs carry arbitrary strings — `;` inside would
  // inject extra CSS declarations; see safeCssColor).
  const color = safeCssColor(options.color);
  const extraClasses = (options.markerClassName || "").trim();
  const isLg = options.markerSize === "lg";
  const isSm = options.markerSize === "sm";

  const wantsImage = options.imageUrl ? isSafeMarkerImageUrl(options.imageUrl) : false;
  // The glyph is rendered even under a picture now — it doubles as the
  // broken-image fallback layer (see CSS .mr-poi__img).
  const faHtml = options.faName ? fa6GlyphSvg(options.faName) : null;
  const initialsText = wantsImage || faHtml ? null : (options.initials || "").trim().slice(0, 3);
  if (!wantsImage && !faHtml && !initialsText) return null;

  // Legacy carry-over: discovery-layer popups breathe (mr-spot-popup), plus
  // the explicit opt-in for anchor markers like HQ.
  const legacyHalo = extraClasses.includes("mr-spot-popup") ? " mr-poi--halo" : "";
  const optHalo = options.halo ? " mr-poi--halo" : "";
  const sizeClass = isLg ? " mr-poi--lg" : isSm ? " mr-poi--sm" : "";
  const rootClass = `mr-poi${optHalo}${legacyHalo}${sizeClass}${extraClasses ? ` ${extraClasses}` : ""}`;

  let inner: string;
  if (wantsImage) {
    const fallbackGlyph = faHtml ? `<span class="mr-poi__glyph" aria-hidden="true">${faHtml}</span>` : "";
    inner =
      fallbackGlyph +
      `<span class="mr-poi__img" aria-hidden="true" style="background-image:url('${escAttr(cssSafeUrlForMarker(options.imageUrl!.trim()))}')"></span>`;
  } else if (faHtml) {
    inner = `<span class="mr-poi__glyph" aria-hidden="true">${faHtml}</span>`;
  } else {
    const initials = Array.from((options.initials || "").trim()).slice(0, 3).join("");
    inner = `<span class="mr-poi__initials" style="color:${readableTextColorOn(color)}">${escAttr(initials)}</span>`;
  }

  const html =
    `<div class="${rootClass}" style="background-color:${escAttr(color)}">` +
    inner +
    `</div>`;

  return L.divIcon({
    html,
    className: "mr-poi-div-icon",
    iconSize: isLg ? [40, 40] : isSm ? [26, 26] : [34, 34],
    iconAnchor: isLg ? [20, 20] : isSm ? [13, 13] : [17, 17],
    popupAnchor: [0, isLg ? -22 : isSm ? -15 : -19],
  });
}
