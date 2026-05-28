// app/franchize/components/cart/SpecBadge.tsx
"use client";

import type { FranchizeTheme } from "../../actions";
import { withAlpha } from "../../lib/theme";
import { Zap, Battery, Gauge, Palette } from "lucide-react";

interface SpecBadgeProps {
  icon: React.ReactNode;
  value: string;
  theme: FranchizeTheme;
}

export function SpecBadge({ icon, value, theme }: SpecBadgeProps) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium"
      style={{
        backgroundColor: withAlpha(theme.palette.bgBase, 0.6),
        border: `1px solid ${withAlpha(theme.palette.borderSoft, 0.5)}`,
        color: theme.palette.textPrimary,
      }}
    >
      <span style={{ color: theme.palette.accentMain }}>{icon}</span>
      {value}
    </span>
  );
}

/** Convenience wrapper that renders up to 4 spec badges from item.specs JSONB */
interface SpecBadgesProps {
  specs: Record<string, unknown> | undefined;
  theme: FranchizeTheme;
}

export function SpecBadges({ specs, theme }: SpecBadgesProps) {
  const extracted = extractSpecs(specs);
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      <SpecBadge icon={<Zap className="h-3 w-3" />} value={extracted.power} theme={theme} />
      <SpecBadge icon={<Battery className="h-3 w-3" />} value={extracted.battery} theme={theme} />
      <SpecBadge icon={<Gauge className="h-3 w-3" />} value={extracted.range} theme={theme} />
      {extracted.color && (
        <SpecBadge icon={<Palette className="h-3 w-3" />} value={extracted.color} theme={theme} />
      )}
    </div>
  );
}

/** Extract spec values from item.specs JSONB — handles multiple key names from different data sources */
function extractSpecs(specs: Record<string, unknown> | undefined) {
  const colorVal = specs?.color ?? specs?.цвет ?? null;
  return {
    power: String(specs?.power_kw ?? specs?.power ?? "—") + " кВт",
    battery: String(specs?.battery_label ?? specs?.battery ?? `${specs?.battery_v ?? ""}V ${specs?.battery_ah ?? ""}Ah`),
    range: "до " + String(specs?.range_km ?? specs?.range ?? "—") + " км",
    color: colorVal ? String(colorVal) : null,
  };
}
