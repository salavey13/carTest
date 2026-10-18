// app/franchize/[slug]/season-stats/archive-snapshot.ts
//
// GENERATED FILE — do not edit by hand.
// Source: scripts/season-2026/extraction_v1.json (docs/zip archive accounting).
// Regenerate: python3 scripts/season-2026/build_archive_snapshot.py
//
// Answers the boss question «may/june look too rooky, only 4 or 9?»:
// db = rows actually in Supabase today; docs = rent contracts found in the
// archive; expected = what TOTAL SEASON stats will show after retroimport.

export interface ArchiveMonthRow {
  month: string;
  docs: number;      // rent contracts in the zip archive for this month
  matched: number;   // already linked to a DB rental
  missing: number;   // not in DB yet (retro_backfill_v2 payload)
  db: number;        // non-cancelled rentals in DB for this month
  expected: number;  // db + missing
}

export interface ArchiveSnapshot {
  generatedAt: string;
  filesTotal: number;
  byStatus: Record<string, number>;
  missingMoneyKnownRub: number;
  reviewMoneyKnownRub: number;
  months: ArchiveMonthRow[];
}

export const ARCHIVE_SNAPSHOT: ArchiveSnapshot = {
  "generatedAt": "2026-10-18T21:02:54.299671Z",
  "filesTotal": 145,
  "byStatus": {
    "imported_db": 89,
    "imported_backfill_v1": 2,
    "retro_missing": 14,
    "retro_needs_review": 16,
    "testdrive": 11,
    "sale": 4,
    "template": 9
  },
  "missingMoneyKnownRub": 68500,
  "reviewMoneyKnownRub": 88500,
  "months": [
    {
      "month": "2026-04",
      "docs": 0,
      "matched": 0,
      "missing": 0,
      "db": 0,
      "expected": 0
    },
    {
      "month": "2026-05",
      "docs": 8,
      "matched": 1,
      "missing": 7,
      "db": 4,
      "expected": 11
    },
    {
      "month": "2026-06",
      "docs": 3,
      "matched": 1,
      "missing": 2,
      "db": 7,
      "expected": 9
    },
    {
      "month": "2026-07",
      "docs": 46,
      "matched": 26,
      "missing": 14,
      "db": 32,
      "expected": 46
    },
    {
      "month": "2026-08",
      "docs": 32,
      "matched": 31,
      "missing": 1,
      "db": 81,
      "expected": 82
    },
    {
      "month": "2026-09",
      "docs": 20,
      "matched": 20,
      "missing": 0,
      "db": 104,
      "expected": 104
    },
    {
      "month": "2026-10",
      "docs": 12,
      "matched": 12,
      "missing": 0,
      "db": 31,
      "expected": 31
    }
  ]
};
