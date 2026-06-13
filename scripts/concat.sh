#!/usr/bin/env bash
# concat.sh — Bundle multiple source files into a single "one file" deliverable.
# See SKILL.md for full formatting rules.
#
# Usage:
#   bash concat.sh \
#     --output /path/to/output.txt \
#     --title "MY-TITLE" \
#     --header "Optional description" \
#     --changes "Fix 1 description" \
#     --changes "Fix 2 description" \
#     --file "/app/path/in/project.ts:/fs/path/on/disk.ts" \
#     --file "/app/another.ts:/fs/another.ts" \
#     --dry-run
#
# The script guarantees:
#   1. Opening and closing ``` fences are always on their own line
#   2. First line inside each code block is // /project/path (no FILE: prefix)
#   3. No duplicate path comment if the file already starts with one
#   4. Source files without trailing newline still produce correct fence
#   5. Language hint derived from file extension
#   6. Exactly one blank line between code blocks
#   7. Project paths validated to start with /

set -euo pipefail

# ── Defaults ──
OUTPUT=""
TITLE="CONCATENATED-FILES"
HEADER=""
CHANGES=()
FILES=()
DRY_RUN=false

# ── Parse arguments ──
while [[ $# -gt 0 ]]; do
  case "$1" in
    --output)  OUTPUT="$2";  shift 2 ;;
    --title)   TITLE="$2";   shift 2 ;;
    --header)  HEADER="$2";  shift 2 ;;
    --changes)
      # Each --changes takes exactly one argument (repeat the flag for multiple)
      CHANGES+=("$2")
      shift 2
      ;;
    --file)
      FILES+=("$2")
      shift 2
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    -h|--help)
      sed -n '2,15p' "$0" | sed 's/^# //'
      exit 0
      ;;
    *)
      echo "Error: unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

# ── Validate ──
if [[ "$DRY_RUN" == "false" && -z "$OUTPUT" ]]; then
  echo "Error: --output is required (or use --dry-run)" >&2
  exit 1
fi
if [[ ${#FILES[@]} -eq 0 ]]; then
  echo "Error: at least one --file is required" >&2
  exit 1
fi

# Validate every project path starts with /
for entry in "${FILES[@]}"; do
  PROJECT_PATH="${entry%%:*}"
  if [[ "$PROJECT_PATH" != /* ]]; then
    echo "Error: project path must start with /, got: $PROJECT_PATH" >&2
    echo "  Fix: use --file \"/app/path/file.ts:/disk/path/file.ts\"" >&2
    exit 1
  fi
  if [[ "$PROJECT_PATH" == *:* ]]; then
    echo "Error: project path contains ':', which is the separator — use a different path format" >&2
    exit 1
  fi
done

# ── Resolve language hint from extension ──
lang_hint() {
  local ext="${1##*.}"
  case "$ext" in
    tsx)  echo "tsx" ;;
    jsx)  echo "jsx" ;;
    ts)   echo "typescript" ;;
    js)   echo "javascript" ;;
    mjs)  echo "javascript" ;;
    cjs)  echo "javascript" ;;
    css)  echo "css" ;;
    html) echo "html" ;;
    json) echo "json" ;;
    py)   echo "python" ;;
    sh)   echo "bash" ;;
    md)   echo "markdown" ;;
    sql)  echo "sql" ;;
    yaml) echo "yaml" ;;
    yml)  echo "yaml" ;;
    *)    echo "" ;;
  esac
}

# ── Check if file's first line is already a matching path comment ──
# Returns "match" if the first line of the file is a comment that contains
# the expected project path, "nomatch" otherwise.
has_existing_path_comment() {
  local fs_path="$1"
  local project_path="$2"

  # Read first line safely (handles files with no newline)
  local first_line
  first_line=$(head -n1 "$fs_path" 2>/dev/null || true)

  if [[ -z "$first_line" ]]; then
    echo "nomatch"
    return
  fi

  # Check if first line is a comment containing the project path
  # Matches: // /path, # /path, -- /path, /* /path, etc.
  if [[ "$first_line" =~ ^[[:space:]]*(//|#|--|/\*)[[:space:]]* ]]; then
    # It's a comment line — does it contain the project path?
    if [[ "$first_line" == *"$project_path"* ]]; then
      echo "match"
      return
    fi
  fi

  echo "nomatch"
}

# ── Build output ──
build_output() {
  # ── Header ──
  echo "================================================================"
  echo "  $TITLE"
  if [[ -n "$HEADER" ]]; then
    echo "  $HEADER"
  fi
  echo "================================================================"

  if [[ ${#CHANGES[@]} -gt 0 ]]; then
    echo ""
    echo "FIXES APPLIED:"
    for change in "${CHANGES[@]}"; do
      echo "  $change"
    done
  fi

  echo ""
  echo "================================================================"
  echo ""

  # ── Append each file ──
  local first=true
  for entry in "${FILES[@]}"; do
    # Parse project_path:filesystem_path
    local PROJECT_PATH FS_PATH
    PROJECT_PATH="${entry%%:*}"
    FS_PATH="${entry#*:}"

    if [[ ! -f "$FS_PATH" ]]; then
      echo "Warning: file not found, skipping: $FS_PATH" >&2
      continue
    fi

    # Blank line between code blocks (not before the first one)
    if [[ "$first" == "true" ]]; then
      first=false
    else
      echo ""
    fi

    # Language hint from extension
    local EXT HINT
    EXT="${PROJECT_PATH##*.}"
    HINT=$(lang_hint "$EXT")

    # Opening fence with language hint
    printf '%s%s\n' '```' "$HINT"

    # Path comment — skip if file already has one as first line
    local existing
    existing=$(has_existing_path_comment "$FS_PATH" "$PROJECT_PATH")
    if [[ "$existing" == "nomatch" ]]; then
      echo "// $PROJECT_PATH"
    fi

    # File contents — ensure it ends with a newline for clean fence placement
    # Using cat + explicit newline handling prevents the closing fence from
    # drifting onto the last line of content
    cat "$FS_PATH"

    # Guarantee a trailing newline before closing fence.
    # If the file already ends with \n, this adds one blank line (which is fine —
    # it separates content from fence). If it doesn't end with \n, this adds
    # the missing newline that keeps the fence on its own line.
    echo ""

    # Closing fence — always on its own line, nothing else
    printf '%s\n' '```'
  done
}

# ── Write output ──
if [[ "$DRY_RUN" == "true" ]]; then
  build_output
else
  build_output > "$OUTPUT"
  LINES=$(wc -l < "$OUTPUT")
  echo "✓ Wrote $LINES lines to $OUTPUT"
fi
