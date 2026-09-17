// Per-crew UI overrides read from metadata.franchize.ui (crew specs jsonb,
// editable via the crew's hydration SQL — no deploy needed for label changes).
// Pure module: no Supabase/next imports, so it is unit-testable in isolation.
//
// Contract (v1):
//   "ui": {
//     "showCreateButton": false,                  // FranchizeProfileButton (default: true)
//     "tabLabels": { "rent": "Заявки", ... },     // CrewHeader rail pill captions
//     "hiddenTabs": ["equipment", "parts"]        // pills to hide from the rail
//   }
// Everything unknown/hostile is dropped; an empty payload yields undefined so
// crews without overrides keep the classic rail bit-for-bit.

export type FranchizeTabKey = "rent" | "sale" | "service" | "equipment" | "parts";

export const FRANCHIZE_TAB_KEYS = [
  "rent",
  "sale",
  "service",
  "equipment",
  "parts",
] as const satisfies readonly FranchizeTabKey[];

export interface FranchizeCrewUiVM {
  showCreateButton?: boolean;
  tabLabels?: Partial<Record<FranchizeTabKey, string>>;
  hiddenTabs?: FranchizeTabKey[];
}

export const DEFAULT_TAB_LABELS: Record<FranchizeTabKey, string> = {
  rent: "Аренда",
  sale: "Продажа",
  service: "Сервис",
  equipment: "Экипировка",
  parts: "Запчасти",
};

// Pills are `px-4 text-xs` — 24 chars keeps the widest label inside the rail
// on a 360px viewport even with the count badge attached.
const MAX_LABEL_LENGTH = 24;

const isFranchizeTabKey = (value: unknown): value is FranchizeTabKey =>
  typeof value === "string" && (FRANCHIZE_TAB_KEYS as readonly string[]).includes(value);

/** Sanitize metadata.franchize.ui → FranchizeCrewUiVM | undefined. Never throws. */
export function buildFranchizeCrewUi(raw: unknown): FranchizeCrewUiVM | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const source = raw as Record<string, unknown>;
  const ui: FranchizeCrewUiVM = {};

  if (typeof source.showCreateButton === "boolean") {
    ui.showCreateButton = source.showCreateButton;
  }

  if (source.tabLabels && typeof source.tabLabels === "object" && !Array.isArray(source.tabLabels)) {
    const labelsSource = source.tabLabels as Record<string, unknown>;
    const labels: Partial<Record<FranchizeTabKey, string>> = {};
    for (const key of FRANCHIZE_TAB_KEYS) {
      const value = labelsSource[key];
      if (typeof value !== "string") continue;
      const trimmed = value.trim().slice(0, MAX_LABEL_LENGTH);
      if (!trimmed) continue;
      labels[key] = trimmed;
    }
    if (Object.keys(labels).length > 0) ui.tabLabels = labels;
  }

  if (Array.isArray(source.hiddenTabs)) {
    const seen = new Set<FranchizeTabKey>();
    for (const entry of source.hiddenTabs) {
      if (!isFranchizeTabKey(entry) || seen.has(entry)) continue;
      seen.add(entry);
    }
    // Never allow hiding ALL pills — the rail would render an empty tablist.
    if (seen.size > 0 && seen.size < FRANCHIZE_TAB_KEYS.length) {
      ui.hiddenTabs = FRANCHIZE_TAB_KEYS.filter((key) => seen.has(key));
    }
  }

  return Object.keys(ui).length > 0 ? ui : undefined;
}

/** Merge sanitized crew overrides over the defaults (partial override wins). */
export function resolveCrewTabLabels(
  ui: FranchizeCrewUiVM | null | undefined,
): Record<FranchizeTabKey, string> {
  return { ...DEFAULT_TAB_LABELS, ...(ui?.tabLabels ?? {}) };
}
