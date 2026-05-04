export type SpeedBand = {
  minInclusive: number;
  maxExclusive: number;
  colorClass: string;
  colorHex: string;
  label: string;
};

export const SPEED_BANDS: SpeedBand[] = [
  { minInclusive: 0, maxExclusive: 10, colorClass: "bg-sky-400", colorHex: "#38bdf8", label: "0-10" },
  { minInclusive: 10, maxExclusive: 25, colorClass: "bg-emerald-500", colorHex: "#22c55e", label: "10-25" },
  { minInclusive: 25, maxExclusive: 40, colorClass: "bg-amber-500", colorHex: "#f59e0b", label: "25-40" },
  { minInclusive: 40, maxExclusive: Number.POSITIVE_INFINITY, colorClass: "bg-red-500", colorHex: "#ef4444", label: "40+" },
];

export function speedToBand(speedKmh: number): SpeedBand {
  return SPEED_BANDS.find((band) => speedKmh >= band.minInclusive && speedKmh < band.maxExclusive) ?? SPEED_BANDS[SPEED_BANDS.length - 1];
}

export function speedToSegmentColor(speedKmh: number): string {
  return speedToBand(speedKmh).colorHex;
}
