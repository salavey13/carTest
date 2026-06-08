/**
 * VIP Bike Rental — Access Tier Utilities for CatalogClient
 *
 * Client-side helper functions for access tier badges, highlighting,
 * and filtering logic. Pure functions, no side effects.
 *
 * Used by CatalogClient.tsx
 */

import type { AccessTier } from "@/app/lib/ocr-constants";

// ─── Tier badge config ────────────────────────────────────────────────────────

export interface TierBadgeConfig {
  label: string;
  emoji: string;
  bgColor: string;
  borderColor: string;
  textColor: string;
}

export const TIER_BADGE_CONFIG: Record<AccessTier, TierBadgeConfig> = {
  entry: {
    label: "Базовый",
    emoji: "🟢",
    bgColor: "#22c55e30",
    borderColor: "rgba(34, 197, 94, 0.5)",
    textColor: "#86efac",
  },
  mid: {
    label: "Средний",
    emoji: "🟡",
    bgColor: "#eab30830",
    borderColor: "rgba(234, 179, 8, 0.5)",
    textColor: "#fde047",
  },
  pro: {
    label: "Профи",
    emoji: "🔴",
    bgColor: "#ef444430",
    borderColor: "rgba(239, 68, 68, 0.5)",
    textColor: "#fca5a5",
  },
  none: {
    label: "Требуется проверка",
    emoji: "⚪",
    bgColor: "#6b728030",
    borderColor: "rgba(107, 114, 128, 0.5)",
    textColor: "#d1d5db",
  },
};

// ─── Extract access_tier from item's rawSpecs ─────────────────────────────────

export function getItemAccessTier(item: { rawSpecs?: Record<string, unknown> }): AccessTier {
  if (!item.rawSpecs) return "none";

  const tier = item.rawSpecs["access_tier"];
  if (typeof tier === "string" && ["entry", "mid", "pro", "none"].includes(tier)) {
    return tier as AccessTier;
  }

  return "none";
}

// ─── Check if user can access a specific item ──────────────────────────────────

export function canUserAccessItem(userTier: AccessTier, itemTier: AccessTier): boolean {
  if (itemTier === "none") return true; // no restriction
  if (userTier === "none") return true;  // show all by default for unverified users

  const TIER_PRIORITY: Record<AccessTier, number> = {
    none: 0,
    entry: 1,
    mid: 2,
    pro: 3,
  };

  return TIER_PRIORITY[userTier] >= TIER_PRIORITY[itemTier];
}

// ─── Get CSS style for tier badge ─────────────────────────────────────────────

export function getTierBadgeStyle(tier: AccessTier): React.CSSProperties {
  const config = TIER_BADGE_CONFIG[tier];
  return {
    backgroundColor: config.bgColor,
    border: `1px solid ${config.borderColor}`,
    color: config.textColor,
  };
}

// ─── Get highlight style for user-accessible items ────────────────────────────
// When a user has a verified tier, items they CAN access get a subtle glow.
// Items they CANNOT access get a dimmed overlay with a lock indicator.

export function getTierAccessibilityStyle(
  userTier: AccessTier,
  itemTier: AccessTier,
): {
  containerStyle: React.CSSProperties;
  overlayClass: string;
  accessible: boolean;
} {
  const accessible = canUserAccessItem(userTier, itemTier);

  if (userTier === "none") {
    // No tier info — show all items normally, no special styling
    return {
      containerStyle: {},
      overlayClass: "",
      accessible: true,
    };
  }

  if (accessible) {
    // User CAN access this bike — subtle green glow
    return {
      containerStyle: {
        boxShadow: "0 0 0 1px rgba(34, 197, 94, 0.3), 0 0 12px rgba(34, 197, 94, 0.1)",
      },
      overlayClass: "",
      accessible: true,
    };
  }

  // User CANNOT access this bike — dimmed with lock
  return {
    containerStyle: {
      opacity: 0.7,
    },
    overlayClass: "tier-locked-overlay",
    accessible: false,
  };
}