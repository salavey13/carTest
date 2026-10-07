"use client";

// ProfileTabBar — task 79 (2026-10-07) boss-review refactor.
// ──────────────────────────────────────────────────────────────────────────
// The profile page used to stack up to 10 panels vertically (~15 phone
// screens for the owner — boss-review verdict 4/10, «страница-свалка»).
// The composition is now tabbed: this component owns ONLY the pill rail
// (visual sibling of the CrewHeader rail) — visibility, composition and
// keep-mounted rendering live in ProfileClient.
//
// Pure presentational: tabs arrive pre-filtered per role; tokens T.* keep
// dark/light theming consistent with every panel.

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
  return (
    <div
      role="tablist"
      aria-label="Разделы профиля"
      className="-mx-1 overflow-x-auto pb-1"
      style={{ touchAction: "pan-y pan-x" }}
    >
      <div className="flex min-w-max items-center gap-2 px-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`profile-tab-${tab.id}`}
              aria-selected={active}
              aria-controls={`profile-tabpanel-${tab.id}`}
              title={tab.hint || tab.label}
              onClick={() => onSelect(tab.id)}
              className="flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold whitespace-nowrap transition hover:opacity-85 focus:outline-none focus-visible:ring-2"
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
  );
}
