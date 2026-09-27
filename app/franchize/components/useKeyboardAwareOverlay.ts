"use client";

import { useEffect, useState, type RefObject } from "react";

/**
 * useKeyboardAwareOverlay
 * ──────────────────────────────────────────────────────────────────────────
 * 2026-09-28 — owner report: on mobile, closing the keyboard covers the
 * bottom button of the rental modals («Закрыть аренду» / «Подтвердить
 * отмену»). The modals are `fixed inset-0` overlays centered in the LAYOUT
 * viewport; Telegram's iOS WebView does NOT resize the layout viewport when
 * the keyboard slides in — it just paints over the bottom half, so the
 * action row became unreachable.
 *
 * Two-layer fix (both cheap, both standard):
 *   1. The overlay gets `paddingBottom = keyboardPx` — the visualViewport
 *      gap between the layout viewport and the visible area. The flex
 *      centering then positions the card in the VISIBLE area, above the
 *      keyboard. On desktop / no keyboard → 0 (no visual change).
 *   2. On `focusin` inside the overlay, the focused control is scrolled to
 *      the center of its scrollable card after the keyboard settles
 *      (300ms — iOS/Android both animate the viewport by then).
 *
 * Android TG WebView (Chromium ≥108) additionally honours the
 * `interactive-widget=resizes-content` viewport meta — see
 * app/layout.tsx generateViewport() — which resizes dvh itself; the hook
 * stays silent there because the visualViewport gap is then ~0.
 */
export function useKeyboardAwareOverlay(
  overlayRef: RefObject<HTMLElement | null>,
  active: boolean,
): { keyboardPx: number } {
  const [keyboardPx, setKeyboardPx] = useState(0);

  useEffect(() => {
    if (!active) {
      setKeyboardPx(0);
      return;
    }

    const vv = window.visualViewport;

    const recompute = () => {
      if (!vv) return;
      // innerHeight = layout viewport; vv.height = what's actually visible.
      // When the keyboard covers ~40% of the screen the gap exceeds 120px —
      // below that threshold treat it as browser chrome noise (URL bar
      // collapse also produces small gaps).
      const gap = window.innerHeight - vv.height - vv.offsetTop;
      setKeyboardPx(gap > 120 ? Math.round(gap) : 0);
    };

    recompute();
    vv?.addEventListener("resize", recompute);
    vv?.addEventListener("scroll", recompute);
    window.addEventListener("orientationchange", recompute);

    // Focused input → scroll it into the visible area once the keyboard
    // has finished animating.
    const onFocusIn = (event: FocusEvent) => {
      const target = event.target as HTMLElement | null;
      const overlay = overlayRef.current;
      if (!target || !overlay) return;
      if (!overlay.contains(target)) return;
      const tag = target.tagName;
      const isTypable =
        tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
      if (!isTypable) return;
      window.setTimeout(() => {
        target.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 300);
    };
    overlayRef.current?.addEventListener("focusin", onFocusIn);

    return () => {
      vv?.removeEventListener("resize", recompute);
      vv?.removeEventListener("scroll", recompute);
      window.removeEventListener("orientationchange", recompute);
      overlayRef.current?.removeEventListener("focusin", onFocusIn);
    };
  }, [active, overlayRef]);

  return { keyboardPx };
}
