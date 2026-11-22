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

    // 2026-09-28 hardening (owner re-report «keyboard overlaps buttons»):
    // some iOS WKWebView builds (Telegram in particular) fire the
    // visualViewport resize UNRELIABLY during the keyboard slide animation —
    // the event may land before the layout settles or not at all until the
    // next touch. Every focus/blur of a typable control therefore schedules
    // a few delayed recomputes (120/350/700ms) so the padding tracks the
    // keyboard even when the resize event is swallowed. Cheap (a state set
    // with the same value is a React no-op) and covers both keyboard OPEN
    // and CLOSE timing.
    const scheduleRecomputes = () => {
      [120, 350, 700].forEach((delay) => window.setTimeout(recompute, delay));
    };

    const isTypableTarget = (target: EventTarget | null): target is HTMLElement => {
      if (!target || !(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
    };
    const overlayContains = (target: EventTarget | null): boolean => {
      const overlay = overlayRef.current;
      return Boolean(target && overlay && overlay.contains(target as Node));
    };

    // Focused input → recompute the gap as the keyboard animates in and
    // scroll the control into the visible area once it has settled.
    const onFocusIn = (event: FocusEvent) => {
      const target = event.target;
      if (!overlayContains(target)) return;
      if (!isTypableTarget(target)) return;
      scheduleRecomputes();
      window.setTimeout(() => {
        target.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 300);
    };
    // Focus leaving the overlay entirely → the keyboard is closing; release
    // the padding as soon as the viewport settles (no ghost offset).
    const onFocusOut = (event: FocusEvent) => {
      if (overlayContains(event.relatedTarget)) return;
      scheduleRecomputes();
    };
    overlayRef.current?.addEventListener("focusin", onFocusIn);
    overlayRef.current?.addEventListener("focusout", onFocusOut);

    return () => {
      vv?.removeEventListener("resize", recompute);
      vv?.removeEventListener("scroll", recompute);
      window.removeEventListener("orientationchange", recompute);
      overlayRef.current?.removeEventListener("focusin", onFocusIn);
      overlayRef.current?.removeEventListener("focusout", onFocusOut);
    };
  }, [active, overlayRef]);

  return { keyboardPx };
}
