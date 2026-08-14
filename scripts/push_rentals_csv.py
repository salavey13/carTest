#!/usr/bin/env python3
"""Push updated rentals CSV to the repo at docs/autoreply/ via git.

Uses the repo's own git remote + stored credentials (no hardcoded token).
Run after export_vip_bike_rentals.py.
"""
import subprocess, sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
DOWNLOAD_DIR = REPO_ROOT / "download"
REPO_DIR = "docs/autoreply"

FILES = [
    ("vip-bike-rentals.csv", "chore(rentals): regenerate active rentals CSV from Supabase"),
]


def git(*args):
    return subprocess.run(["git", "-C", str(REPO_ROOT), *args], capture_output=True, text=True)


def main():
    print("=== Pushing rentals CSV to repo (via git) ===\n")
    all_ok = True
    for filename, message in FILES:
        local_path = DOWNLOAD_DIR / filename
        repo_path = REPO_ROOT / REPO_DIR / filename
        if not local_path.exists():
            print(f"  {filename}: SKIP (local file not found: {local_path})")
            all_ok = False
            continue
        repo_path.parent.mkdir(parents=True, exist_ok=True)
        repo_path.write_bytes(local_path.read_bytes())
        git("add", str(Path(REPO_DIR) / filename))
        print(f"  {filename}: copied to repo ({repo_path})")

    if all_ok:
        r = git("commit", "-m", FILES[0][1], "--only", *(str(Path(REPO_DIR) / f) for f, _ in FILES))
        print("  commit:", (r.stdout or r.stderr).strip() or "nothing to commit")
        if r.returncode == 0:
            p = git("push", "origin", "main")
            print("  push:", (p.stdout or p.stderr).strip())
            all_ok = p.returncode == 0

    print(f"\n=== {'All done' if all_ok else 'Some files failed'} ===")
    return 0 if all_ok else 1


if __name__ == "__main__":
    sys.exit(main())
