#!/usr/bin/env python3
"""Push updated catalog CSVs to GitHub repo at public/docs/autoreply/.

Pushes:
  - vip-bike-rent.csv → public/docs/autoreply/vip-bike-rent.csv
  - vip-bike-sale.csv → public/docs/autoreply/vip-bike-sale.csv

Uses the repository's own git remote (credential.helper store) instead of
hardcoded tokens or machine-specific paths — run from the repo checkout.
"""
import subprocess
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
FILES = [
    ("public/docs/autoreply/vip-bike-rent.csv", "chore(catalog): regenerate rent CSV from Supabase"),
    ("public/docs/autoreply/vip-bike-sale.csv", "chore(catalog): regenerate sale CSV from Supabase"),
]
BRANCH = "main"


def run(*args, check=True, capture=True):
    return subprocess.run(
        ["git", "-C", str(REPO_ROOT), *args],
        check=check, capture_output=capture, text=True,
    )


def main():
    print("=== Pushing catalog CSVs to repo (via git) ===\n")

    staged = False
    for rel, msg in FILES:
        path = REPO_ROOT / rel
        if not path.exists():
            print(f"  {rel}: SKIP (local file not found: {path})")
            continue
        run("add", str(path))
        run("commit", "-m", msg)
        print(f"  commit: {run('log', '-1', '--oneline').stdout.strip()} {rel}")
        staged = True

    if not staged:
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