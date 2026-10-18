#!/usr/bin/env python3
"""Regenerate archive-snapshot.ts (season-stats page) from extraction_v1.json.

Repo version — run from scripts/season-2026/:
    python3 scripts/season-2026/build_archive_snapshot.py
Prereq: extraction_accounting.py has produced extraction_v1.json in this dir.
"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "extraction_v1.json")
DST = os.path.join(HERE, "..", "..", "app", "franchize", "[slug]", "season-stats", "archive-snapshot.ts")

d = json.load(open(SRC))
recon = d["reconciliation_by_month"]
months = []
for key in ("2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"):
    v = recon.get(key)
    if not v:
        months.append({"month": key, "docs": 0, "matched": 0, "missing": 0, "db": 0, "expected": 0})
        continue
    months.append({
        "month": key,
        "docs": v["docs_rent_total"],
        "matched": v["docs_matched"],
        "missing": v["docs_missing_net_of_dups"],
        "db": v["db_rows_noncancelled"],
        "expected": v["expected_after_import"],
    })

s = d["summary"]
payload = {
    "generatedAt": s["generated_at"],
    "filesTotal": s["files_total"],
    "byStatus": s["by_status"],
    "missingMoneyKnownRub": s["missing_money_known_rub"],
    "reviewMoneyKnownRub": s["review_money_known_rub"],
    "months": months,
}

ts = """// app/franchize/[slug]/season-stats/archive-snapshot.ts
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

export const ARCHIVE_SNAPSHOT: ArchiveSnapshot = %s;
""" % json.dumps(payload, ensure_ascii=False, indent=2)

with open(DST, "w", encoding="utf-8") as f:
    f.write(ts)
print("written", os.path.abspath(DST))
