#!/usr/bin/env python3
"""Push updated catalog CSVs to GitHub repo at public/docs/autoreply/.

Pushes:
  - vip-bike-rent.csv      → public/docs/autoreply/vip-bike-rent.csv
  - vip-bike-sale-new.csv  → public/docs/autoreply/vip-bike-sale-new.csv
  - vip-bike-sale-used.csv → public/docs/autoreply/vip-bike-sale-used.csv
  (2026-09-22: единый vip-bike-sale.csv заменён парой new/used по
   specs.condition — см. scripts/export_vip_bike_csv.py)

Uses the repository's own git remote (credential.helper store) instead of
hardcoded tokens or machine-specific paths — run from the repo checkout.
"""
import subprocess
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
FILES = [
    ("public/docs/autoreply/vip-bike-rent.csv", "chore(catalog): regenerate rent CSV from Supabase"),
    ("public/docs/autoreply/vip-bike-sale-new.csv", "chore(catalog): regenerate sale NEW CSV from Supabase"),
    ("public/docs/autoreply/vip-bike-sale-used.csv", "chore(catalog): regenerate sale USED CSV from Supabase"),
]
BRANCH = "main"


def run(*args, check=True, capture=True):
    return subprocess.run(
        ["git", "-C", str(REPO_ROOT), *args],
        check=check, capture_output=capture, text=True,
    )


def main():
    print("=== Pushing catalog CSVs to repo (via git) ===\n")

    commits_made = 0
    for rel, msg in FILES:
        path = REPO_ROOT / rel
        if not path.exists():
            print(f"  {rel}: SKIP (local file not found: {path})")
            continue
        run("add", str(path))
        # `git commit` exits 1 when nothing is staged (CSV unchanged) —
        # detect that first and skip, instead of crashing the whole cron run.
        staged = run("diff", "--cached", "--quiet", check=False)
        if staged.returncode != 0:
            run("commit", "-m", msg)
            print(f"  commit: {run('log', '-1', '--oneline').stdout.strip()}")
            commits_made += 1
        else:
            print(f"  {rel}: unchanged — no commit")

    if commits_made == 0:
        print("  no changes — nothing to push")
        return 0

    result = run("push", "origin", BRANCH, check=False)
    if result.returncode != 0:
        print(f"  push: FAILED\n{result.stderr}")
        return 1
    print(f"  push: {result.stdout.strip()}")

    print("\n=== All done ===")
    return 0


if __name__ == "__main__":
    exit(main())