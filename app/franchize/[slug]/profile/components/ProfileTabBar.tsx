"use client";

// ProfileTabBar — task 79 (2026-10-07) boss-review refactor; task 83
// (2026-10-08) mobile pass: sticky dock rail, scroll affordance, compact pills.
// ──────────────────────────────────────────────────────────────────────────
// The profile page used to stack up to 10 panels vertically (~15 phone
// screens for the owner — boss-review verdict 4/10, «страница-свалка»).
// The composition is now tabbed: this component owns ONLY the pill rail
// (visual sibling of the CrewHeader rail) — visibility, composition and
// keep-mounted rendering live in ProfileClient.
//
// Task 83 mobile UX:
// - The rail is a STICKY dock: it pins right below the CrewHeader while long
//   tab content scrolls underneath. This requires the shell to render with
//   overflow:clip (overflow:hidden silently disables viewport-sticky for
//   descendants) — see FranchizePageShell overflowMode, opt-in for /profile.
//   The header is sticky too (compacts on scroll, carries the Telegram
//   safe-area inset), so its height is measured live, rAF-throttled.
// - Edge fades + hidden scrollbar give a horizontal-scroll affordance on
//   narrow phones where 6 pills don't fit.
// - The active pill auto-centers in the rail (covers the session-restored
//   tab sitting off-screen). Manual scrollLeft math — never scrollIntoView,
//   which could also yank the PAGE vertically.
//
// Pure presentational: tabs arrive pre-filtered per role; tokens T.* keep
// dark/light theming consistent with every panel.

import { useCallback, useEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import type { CrewTokens } from "./profile-shared";

export type ProfileTabId = "rentals" | "earnings" | "partners" | "documents" | "achievements" | "tools";

export interface ProfileTabDef {
  id: ProfileTabId;
  label: string;
  icon: LucideIcon;
  /** Short hint shown to screen readers / title tooltip. */
  hint?: string;
}

const FADE_PX = 16;
const EDGE_EPSILON = 4;

export function ProfileTabBar({
  tabs,
  activeTab,
  onSelect,
  T,
}: {
  tabs: ProfileTabDef[];
  activeTab: ProfileTabId;
  onSelect: (id: ProfileTabId) => void;
  T: CrewTokens;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  // Pre-measure default: typical compact CrewHeader height + breathing room;
  // corrected live right after mount (SSR renders a sane sticky offset).
  const [topOffset, setTopOffset] = useState(72);
  const [fade, setFade] = useState({ left: 0, right: 0 });

  // Sticky dock offset = live CrewHeader bottom (it compacts on scroll and
  // grows with the Telegram safe-area inset). Guarded setState: only re-render
  // when the height actually crossed a pixel threshold, not on every frame.
  useEffect(() => {
    const header = document.querySelector("header");
    if (!header) return;
    let raf = 0;
    const measure = () => {
      raf = 0;
      const next = Math.round(header.getBoundingClientRect().bottom) + 4;
      setTopOffset((prev) => (Math.abs(prev - next) > 1 ? next : prev));
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const updateFades = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    const left = el.scrollLeft > EDGE_EPSILON ? FADE_PX : 0;
    const right = el.scrollLeft < max - EDGE_EPSILON ? FADE_PX : 0;
    setFade((prev) =>
      prev.left === left && prev.right === right ? prev : { left, right },
    );
  }, []);

  // Re-evaluate fades on mount and whenever the tab set changes (role gates
  // resolving can add/remove pills → overflow appears/disappears).
  useEffect(() => {
    updateFades();
    const el = scrollerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(updateFades);
    ro.observe(el);
    return () => ro.disconnect();
  }, [tabs, updateFades]);

  // Center the active pill horizontally. Fires on mount (session-restored tab
  // may sit off-screen on 360px) and on every switch (a tapped half-visible
  // pill glides to the middle — feels deliberate, not jumpy).
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const pill = el.querySelector<HTMLElement>(`[data-tab-id="${activeTab}"]`);
    if (!pill) return;
    const pr = pill.getBoundingClientRect();
    const sr = el.getBoundingClientRect();
    const target =
      el.scrollLeft + (pr.left - sr.left) - (sr.width - pr.width) / 2;
    const clamped = Math.max(
      0,
      Math.min(target, el.scrollWidth - el.clientWidth),
    );
    if (Math.abs(clamped - el.scrollLeft) > 1) {
      el.scrollTo({ left: clamped, behavior: "smooth" });
    }
  }, [activeTab]);

  // No-op full mask when nothing is scrolled; fades in only the scrolled-in
  // edges. color-independent (the dock bg is a translucent color-mix).
  const maskImage = `linear-gradient(to right, ${
    fade.left
      ? `transparent 0, black ${fade.left}px`
      : "black 0"
  }, ${
    fade.right
      ? `black calc(100% - ${fade.right}px), transparent 100%`
      : "black 100%"
  })`;

  return (
    <div className="sticky z-30" style={{ top: topOffset }}>
      <div
        className="relative overflow-hidden rounded-2xl border backdrop-blur-md"
        style={{
          backgroundColor:
            "color-mix(in srgb, var(--franchize-shell-card) 88%, transparent)",
          borderColor: T.borderSoft,
          boxShadow:
            "0 10px 30px color-mix(in srgb, var(--franchize-shell-accent) 12%, transparent)",
        }}
      >
        <div
          ref={scrollerRef}
          role="tablist"
          aria-label="Разделы профиля"
          onScroll={updateFades}
          className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{
            touchAction: "pan-y pan-x",
            maskImage,
            WebkitMaskImage: maskImage,
          }}
        >
          <div className="flex min-w-max items-center gap-1.5 px-1.5 py-1.5">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const active = tab.id === activeTab;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  id={`profile-tab-${tab.id}`}
                  data-tab-id={tab.id}
                  aria-selected={active}
                  aria-controls={`profile-tabpanel-${tab.id}`}
                  title={tab.hint || tab.label}
                  onClick={() => onSelect(tab.id)}
                  className="flex h-8 items-center gap-1.5 rounded-full px-3 text-[11px] font-semibold whitespace-nowrap transition hover:opacity-85 focus:outline-none focus-visible:ring-2"
                  style={{
                    backgroundColor: active
                      ? T.accent
                      : "color-mix(in srgb, var(--franchize-shell-accent) 10%, transparent)",
                    color: active ? T.accentContrast : T.textMuted,
                    border: `1px solid ${active ? T.accent : T.borderSoft}`,
                    // focus ring color stays themable
                    // (focus-visible:ring-2 above adds the width)
                  }}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
