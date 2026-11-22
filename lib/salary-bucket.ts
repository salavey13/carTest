// lib/salary-bucket.ts
//
// Task 98 (2026-10-16): pure bucket aggregation for the category-bonus
// breakdown («Аренда (Обычные): 5 × бонусы · 5 /doc» lines).
//
// WHY A HELPER: computeCategoryBonuses had a copy-paste-era bug — the fresh
// bucket object was mutated but never written back into the Map
// (`byRentalCategory.set(label, bucket)` was missing), so the rental lines
// silently vanished from every breakdown (profile «Детализация», the docx
// report section 3) while the TOTAL still included the money. Sales had the
// .set() and always showed. The boss noticed exactly this: «за аренды не
// вижу такого красивого списочка».
//
// Pure — no imports — unit-tested in tests/franchize/task98-salary-alignment.spec.ts.

export interface SalaryBucket {
  count: number;
  amount: number;
  /** attribution source → count (e.g. doc_command: 4, handout: 2) */
  sources: Map<string, number>;
}

export type SalaryBucketMap = Map<string, SalaryBucket>;

/**
 * Accumulate one item into the per-label bucket AND write it back.
 * The write-back is the whole point — see module docblock.
 */
export function accumulateSalaryBucket(
  map: SalaryBucketMap,
  label: string,
  amount: number,
  source: string,
): void {
  const bucket = map.get(label) ?? { count: 0, amount: 0, sources: new Map<string, number>() };
  bucket.count += 1;
  bucket.amount += amount;
  bucket.sources.set(source, (bucket.sources.get(source) ?? 0) + 1);
  map.set(label, bucket);
}

export interface SalaryBucketDetail {
  type: string;
  amount: number;
  description: string;
}

/** Convert buckets → breakdown details (deterministic order: insertion). */
export function salaryBucketsToDetails(
  map: SalaryBucketMap,
  opts: {
    type: string;
    /** ru noun for the line, e.g. «Аренда» / «Продажа» */
    noun: string;
    /** label → human label overrides (identity when omitted) */
    labelTitles?: Map<string, string>;
    /** ru label for each attribution source, e.g. doc_command → «/doc» */
    sourceLabels: Record<string, string>;
  },
): SalaryBucketDetail[] {
  const details: SalaryBucketDetail[] = [];
  for (const [label, agg] of map) {
    const title = opts.labelTitles?.get(label) || label;
    const sourceParts = Array.from(agg.sources.entries())
      .map(([src, n]) => `${n} ${opts.sourceLabels[src] || src}`)
      .join(", ");
    details.push({
      type: opts.type,
      amount: agg.amount,
      description: `${opts.noun} (${title}): ${agg.count} × бонусы${sourceParts ? ` · ${sourceParts}` : ""}`,
    });
  }
  return details;
}
