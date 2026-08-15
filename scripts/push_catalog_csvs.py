#!/usr/bin/env python3
"""Push updated catalog CSVs to the repo at public/docs/autoreply/ via git.

Uses the repo's own git remote + stored credentials (no hardcoded token).
Run after export_vip_bike_csv.py (now writes directly to public/docs/).

Pushes:
  - vip-bike-rent.csv → public/docs/autoreply/vip-bike-rent.csv
  - vip-bike-sale.csv → public/docs/autoreply/vip-bike-sale.csv
"""
import subprocess, sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SOURCE_DIR = REPO_ROOT / "public" / "docs" / "autoreply"
REPO_DIR = "public/docs/autoreply"

FILES = [
    ("vip-bike-rent.csv", "chore(catalog): regenerate rent CSV from Supabase"),
    ("vip-bike-sale.csv", "chore(catalog): regenerate sale CSV from Supabase"),
]


def git(*args):
    return subprocess.run(["git", "-C", str(REPO_ROOT), *args], capture_output=True, text=True)


def main():
    print("=== Pushing catalog CSVs to repo (via git) ===\n")
    all_ok = True
    for filename, message in FILES:
        source_path = SOURCE_DIR / filename
        if not source_path.exists():
            print(f"  {filename}: SKIP (file not found: {source_path})")
            all_ok = False
            continue
        git("add", str(Path(REPO_DIR) / filename))
        print(f"  {filename}: ready to commit ({source_path})")

    if all_ok:
        msg = "chore(catalog): regenerate rent + sale CSVs from Supabase"
        r = git("commit", "-m", msg, "--only", *(str(Path(REPO_DIR) / f) for f, _ in FILES))
        print("  commit:", (r.stdout or r.stderr).strip() or "nothing to commit")
        if r.returncode == 0:
            p = git("push", "origin", "main")
            print("  push:", (p.stdout or p.stderr).strip())
            all_ok = p.returncode == 0

    print(f"\n=== {'All done' if all_ok else 'Some files failed'} ===")
    return 0 if all_ok else 1


if __name__ == "__main__":
    sys.exit(main())