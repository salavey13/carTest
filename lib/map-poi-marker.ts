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
  | { kind: "none" };

/**
 * Parses the marker icon grammar used across the map layer:
 *   `image:https://…` → picture, `::FaMotorcycle::` → FA6 glyph, else none.
 */
export function parsePoiIcon(icon: string | null | undefined): ParsedPoiIcon {
  const raw = (icon ?? "").trim();
  if (!raw) return { kind: "none" };

  if (raw.toLowerCase().startsWith("image:")) {
    const url = raw.slice("image:".length).trim();
    return url ? { kind: "image", url } : { kind: "none" };
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
  /** Extra classes carried over from the old CircleMarker (halo, entrance). */
  markerClassName?: string;
}

/**
 * Builds a Leaflet divIcon for a POI:
 *   · round picture with a colored ring when `imageUrl` is present;
 *   · colored round badge with a white FA6 glyph otherwise;
 *   · `null` when nothing renderable is available (caller keeps CircleMarker).
 */
export function buildPoiMarkerIcon(options: PoiMarkerOptions): L.DivIcon | null {
  const color = options.color.trim() || "#f97316";
  const extraClasses = (options.markerClassName || "").trim();

  const wantsImage = options.imageUrl ? isSafeMarkerImageUrl(options.imageUrl) : false;
  const faHtml = wantsImage ? null : options.faName ? fa6GlyphSvg(options.faName) : null;
  if (!wantsImage && !faHtml) return null;

  const haloClass = extraClasses.includes("mr-spot-popup") ? " mr-poi--halo" : "";
  const rootClass = `mr-poi${haloClass}${extraClasses ? ` ${extraClasses}` : ""}`;

  let inner: string;
  if (wantsImage) {
    inner = `<img src="${escAttr(options.imageUrl!.trim())}" alt="" draggable="false" />`;
  } else {
    inner = `<span class="mr-poi__glyph" aria-hidden="true">${faHtml}</span>`;
  }

  const html =
    `<div class="${rootClass}" style="background-color:${escAttr(color)}">` +
    inner +
    `</div>`;

  return L.divIcon({
    html,
    className: "mr-poi-div-icon",
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -19],
  });
}
