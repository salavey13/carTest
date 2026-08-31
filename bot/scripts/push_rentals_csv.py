#!/usr/bin/env python3
"""Push updated rentals CSV to GitHub repo at docs/autoreply/."""
import json, urllib.request, base64, os
from pathlib import Path

gh_token = os.environ["GH_TOKEN"]
repo = "salavey13/carTest"
branch = "main"

DOWNLOAD_DIR = Path(os.environ.get("CSV_DIR", "/opt/claudeclaw/vip-bike/data/rentals-csv"))
REPO_DIR = "docs/autoreply"

FILES = [
    ("vip-bike-rentals.csv", "chore(rentals): regenerate active rentals CSV from Supabase"),
]


def push_file(github_path, local_path, message):
    if not os.path.exists(local_path):
        print(f"  {github_path}: SKIP (local file not found: {local_path})")
        return False
    with open(local_path, "rb") as f:
        content = base64.b64encode(f.read()).decode()
    encoded_path = github_path.replace("[", "%5B").replace("]", "%5D")
    sha = ""
    try:
        req = urllib.request.Request(
            f"https://api.github.com/repos/{repo}/contents/{encoded_path}?ref={branch}",
            headers={"Authorization": f"token {gh_token}"}
        )
        resp = urllib.request.urlopen(req)
        sha = json.loads(resp.read()).get("sha", "")
    except Exception:
        pass
    data = {"message": message, "content": content, "branch": branch}
    if sha:
        data["sha"] = sha
    req = urllib.request.Request(
        f"https://api.github.com/repos/{repo}/contents/{encoded_path}",
        method="PUT",
        headers={"Authorization": f"token {gh_token}", "Content-Type": "application/json"},
        data=json.dumps(data).encode()
    )
    try:
        resp = urllib.request.urlopen(req)
        result = json.loads(resp.read())
        ok = 'content' in result
        action = "updated" if sha else "created"
        print(f"  {github_path}: {action} {'OK' if ok else result.get('message','error')[:80]}")
        return ok
    except Exception as e:
        print(f"  {github_path}: ERROR {e}")
        return False


def main():
    print("=== Pushing rentals CSV to repo ===\n")
    all_ok = True
    for filename, message in FILES:
        local_path = DOWNLOAD_DIR / filename
        github_path = f"{REPO_DIR}/{filename}"
        ok = push_file(github_path, local_path, message)
        if not ok:
            all_ok = False
    print(f"\n=== {'All done' if all_ok else 'Some files failed'} ===")
    return 0 if all_ok else 1


if __name__ == "__main__":
    exit(main())
