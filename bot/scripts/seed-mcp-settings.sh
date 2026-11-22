#!/usr/bin/env bash
# seed-mcp-settings.sh — generate ~/.claude/settings.json for a tenant from template
#
# Usage:
#   bash scripts/seed-mcp-settings.sh --slug=<tenant> [--target-user=claudeclaw]
#
# What it does:
#   1. Reads tenants/<slug>/.env for NOTION_TOKEN, Z_AI_API_KEY, etc.
#   2. Substitutes ${VAR} placeholders in workspace/.claude/settings.template.json
#   3. Drops any mcpServer whose required env vars are missing or empty
#   4. Backs up existing settings.json (with timestamp), then writes the new one
#   5. Sets chown <user>:<user> + chmod 600 on the output file
#
# Dependencies: bash 4+, python3 (stdlib only). No jq needed.

set -euo pipefail

# ─── defaults ───────────────────────────────────────────────────────────────
TARGET_USER="claudeclaw"
SLUG=""

# ─── parse arguments ────────────────────────────────────────────────────────
for arg in "$@"; do
  case "$arg" in
    --slug=*)        SLUG="${arg#*=}" ;;
    --target-user=*) TARGET_USER="${arg#*=}" ;;
    *)
      echo "Unknown argument: $arg" >&2
      echo "Usage: bash scripts/seed-mcp-settings.sh --slug=<tenant> [--target-user=claudeclaw]" >&2
      exit 1
      ;;
  esac
done

if [[ -z "$SLUG" ]]; then
  echo "Error: --slug is required" >&2
  echo "Usage: bash scripts/seed-mcp-settings.sh --slug=<tenant> [--target-user=claudeclaw]" >&2
  exit 1
fi

# ─── paths ──────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

TEMPLATE="$PROJECT_ROOT/workspace/.claude/settings.template.json"
ENV_FILE="$PROJECT_ROOT/tenants/$SLUG/.env"
TARGET_DIR="/home/$TARGET_USER/.claude"
TARGET_FILE="$TARGET_DIR/settings.json"

# ─── preflight ──────────────────────────────────────────────────────────────
command -v python3 >/dev/null 2>&1 || {
  echo "Error: python3 is required but not found. Install with: apt install python3" >&2
  exit 1
}

[[ -f "$TEMPLATE" ]] || {
  echo "Error: template not found: $TEMPLATE" >&2
  exit 1
}

[[ -f "$ENV_FILE" ]] || {
  echo "Error: tenant .env not found: $ENV_FILE" >&2
  echo "  Create tenants/$SLUG/.env with at minimum: NOTION_TOKEN, Z_AI_API_KEY" >&2
  exit 1
}

# ─── ensure target directory ────────────────────────────────────────────────
mkdir -p "$TARGET_DIR"

# ─── backup existing settings.json ──────────────────────────────────────────
if [[ -f "$TARGET_FILE" ]]; then
  BACKUP="${TARGET_FILE}.bak.$(date +%Y%m%d%H%M%S)"
  cp "$TARGET_FILE" "$BACKUP"
  echo "Backup: $BACKUP"
fi

# ─── generate settings via python3 ──────────────────────────────────────────
python3 - "$TEMPLATE" "$ENV_FILE" "$TARGET_FILE" <<'PYEOF'
import sys
import json
import re

template_path = sys.argv[1]
env_path      = sys.argv[2]
out_path      = sys.argv[3]

# ── load env vars from .env file ──────────────────────────────────────────
env = {}
with open(env_path) as f:
    for raw in f:
        line = raw.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        key, _, val = line.partition('=')
        key = key.strip()
        # strip optional surrounding quotes
        val = val.strip()
        if len(val) >= 2 and val[0] in ('"', "'") and val[-1] == val[0]:
            val = val[1:-1]
        if key:
            env[key] = val

# ── load template ─────────────────────────────────────────────────────────
with open(template_path) as f:
    template_data = json.load(f)

servers = template_data.get('mcpServers', {})

active  = {}
skipped = []

VAR_RE = re.compile(r'\$\{([A-Z_][A-Z0-9_]*)\}')

def substitute_str(s):
    return VAR_RE.sub(lambda m: env.get(m.group(1), ''), s)

def substitute_deep(obj):
    if isinstance(obj, str):
        return substitute_str(obj)
    if isinstance(obj, dict):
        return {k: substitute_deep(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [substitute_deep(i) for i in obj]
    return obj

for name, cfg in servers.items():
    cfg_str = json.dumps(cfg)
    refs    = VAR_RE.findall(cfg_str)

    # check every referenced var is present and non-empty
    missing = [r for r in refs if not env.get(r, '').strip()]

    if missing:
        skipped.append((name, missing))
        continue

    active[name] = substitute_deep(cfg)

# ── write output ──────────────────────────────────────────────────────────
out = {'mcpServers': active}
with open(out_path, 'w') as f:
    json.dump(out, f, indent=2, ensure_ascii=False)
    f.write('\n')

# ── summary ───────────────────────────────────────────────────────────────
print(f"MCP servers active: {len(active)}, skipped (missing env): {len(skipped)}")

if active:
    print("  Active:  " + ", ".join(active.keys()))

for name, missing in skipped:
    print(f"  Skipped: {name}  (missing: {', '.join(missing)})")
PYEOF

# ─── ownership and permissions ───────────────────────────────────────────────
chown "$TARGET_USER:$TARGET_USER" "$TARGET_FILE"
chmod 600 "$TARGET_FILE"

echo "Written: $TARGET_FILE"
