#!/usr/bin/env python3
"""Push updated rentals CSV to GitHub repo at public/docs/autoreply/.

Uses the repository's own git remote (credential.helper store) instead of
hardcoded tokens or machine-specific paths — run from the repo checkout.
"""
import subprocess, sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SOURCE = REPO_ROOT / "public" / "docs" / "autoreply" / "vip-bike-rentals.csv"
GITHUB_REL = "public/docs/autoreply/vip-bike-rentals.csv"
COMMIT_MSG = "chore(rentals): regenerate active rentals CSV from Supabase"
BRANCH = "main"


def run(*args, check=True, capture=True):
    return subprocess.run(
        ["git", "-C", str(REPO_ROOT), *args],
        check=check, capture_output=capture, text=True,
    )


def main():
    print("=== Pushing rentals CSV to repo (via git) ===\n")

    if not SOURCE.exists():
        print(f"  {GITHUB_REL}: SKIP (local file not found: {SOURCE})")
        return 1

    run("add", str(SOURCE))
    staged = run("diff", "--cached", "--name-only").stdout.strip()
    if GITHUB_REL not in staged:
        print(f"  {GITHUB_REL}: no changes — nothing to push")
        return 0

    run("commit", "-m", COMMIT_MSG)
    print(f"  commit: {run('log', '-1', '--oneline').stdout.strip()}")

    result = run("push", "origin", BRANCH, check=False)
    if result.returncode != 0:
        print(f"  push: FAILED\n{result.stderr}")
        return 1
    print(f"  push: {result.stdout.strip()}")

    print("\n=== All done ===")
    return 0


if __name__ == "__main__":
    exit(main())