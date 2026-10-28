// lib/salary-split.ts
//
// TASK158 (boss 2026-10-29) — pure helpers for the GENERATED
// «Оператор (ЗП)» cell and the integer-ruble commission split.
//
// The CSV builder writes ONE cell per rental listing every engaged operator
// with their reduced fraction; the tableview (split pills, operator filter,
// optimistic role edits) parses the same cell back — one format, one parser,
// both sides unit-tested so the sheet can never disagree with itself.
//
//   single operator   →  «@I_O_S_NN»
//   2/3 + 1/3         →  «@I_O_S_NN (2/3) + Гундермурд (1/3)»
//   1/2 + 1/2         →  «@salavey13 (1/2) + @DJORUDJOV (1/2)»
//
// Labels never contain " + " or "(n/d)" (compactUserLabel = @username /
// full_name / raw id), so the round-trip is lossless for every real roster.

export interface SalarySplitCellPart {
  label: string;
  /** Reduced fraction; {1,1} parts print WITHOUT the "(n/d)" tail. */
  fraction: { n: number; d: number };
}

/** Greatest common divisor — fractions stay reduced. */
export function splitGcd(a: number, b: number): number {
  return b === 0 ? a : splitGcd(b, a % b);
}

/** «@I_O_S_NN (2/3) + Гундермурд (1/3)» — fraction 1/1 prints bare. */
export function formatSalarySplitCell(parts: ReadonlyArray<SalarySplitCellPart>): string {
  return parts
    .filter((p) => p.label && p.label.trim().length > 0)
    .map((p) => {
      const g = splitGcd(p.fraction.n, p.fraction.d);
      const n = p.fraction.n / g;
      const d = p.fraction.d / g;
      return d === 1 ? p.label : `${p.label} (${n}/${d})`;
    })
    .join(" + ");
}

/**
 * Parse the generated cell back into label+fraction parts. Tolerates plain
 * single-label cells (old sheets, sales rows), whitespace and empty cells.
 * Unknown formats degrade to ONE part with fraction 1/1 — the pills then
 * treat the row like the old single-operator world instead of losing money.
 */
export function parseSalarySplitCell(cell: string | null | undefined): SalarySplitCellPart[] {
  const raw = (cell || "").trim();
  if (!raw) return [];
  const parts: SalarySplitCellPart[] = [];
  for (const chunk of raw.split(" + ")) {
    const t = chunk.trim();
    if (!t) continue;
    const m = /^(.*?)\s*\((\d+)\s*\/\s*(\d+)\)$/.exec(t);
    if (m && Number(m[2]) > 0 && Number(m[3]) > 0) {
      parts.push({ label: m[1].trim(), fraction: { n: Number(m[2]), d: Number(m[3]) } });
    } else {
      parts.push({ label: t, fraction: { n: 1, d: 1 } });
    }
  }
  return parts;
}

/**
 * Integer-ruble split of `total` by the given fractions. Math.round per
 * share first; the rounding remainder (±1..2 ₽) lands on the LARGEST share
 * so the parts always sum to EXACTLY `total` — the boss's sheet and the
 * profile math can never disagree by a stray ruble. Ties → earliest index
 * (stable: the first appearance order of the split).
 */
export function splitAmountByFractions(
  total: number,
  fractions: ReadonlyArray<{ n: number; d: number }>,
): number[] {
  const clean = Number.isFinite(total) && total > 0 ? Math.round(total) : 0;
  if (fractions.length === 0) return [];
  const amounts = fractions.map((f) =>
    f.d > 0 ? Math.round((clean * f.n) / f.d) : 0,
  );
  let diff = clean - amounts.reduce((a, b) => a + b, 0);
  if (diff !== 0) {
    let best = 0;
    for (let i = 1; i < fractions.length; i += 1) {
      if (fractions[i].n * fractions[best].d > fractions[best].n * fractions[i].d) best = i;
    }
    amounts[best] += diff;
  }
  return amounts;
}
