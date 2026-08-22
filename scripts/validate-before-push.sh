#!/usr/bin/env bash
# scripts/validate-before-push.sh
#
# Run this BEFORE pushing to GitHub. Catches ALL build/lint/type errors at once
# instead of discovering them one-at-a-time via Vercel deploy failures.
#
# Usage:
#   ./scripts/validate-before-push.sh          # full check (lint + typecheck + build)
#   ./scripts/validate-before-push.sh --fast   # skip build (lint + typecheck only, ~10s)
#
# Requirements:
#   - bun (or npm) installed
#   - node_modules installed (run `bun install` first)
#
# Exit codes:
#   0 = all checks passed, safe to push
#   1 = one or more checks failed, DO NOT push

set -euo pipefail

MODE="${1:-full}"
FAST=0
if [[ "$MODE" == "--fast" ]]; then
  FAST=1
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  VIP Bike — pre-push validation"
echo "  Mode: $(if [[ $FAST == 1 ]]; then echo "fast (lint + typecheck)"; else echo "full (lint + typecheck + build)"; fi)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

cd "$(dirname "$0")/.."  # cd to repo root

FAILURES=0

# ── Check 1: ESLint ──────────────────────────────────────────────────────
echo ""
echo "▶ [1/3] ESLint (catches rules-of-hooks, unused vars, etc.)..."
if [[ -f node_modules/.bin/next ]]; then
  if bun run lint 2>&1 | tail -30; then
    echo "  ✓ ESLint passed"
  else
    echo "  ✗ ESLint FAILED"
    FAILURES=$((FAILURES + 1))
  fi
else
  echo "  ⚠ node_modules not found — run 'bun install' first"
  echo "  ⚠ Skipping lint (cannot validate)"
  FAILURES=$((FAILURES + 1))
fi

# ── Check 2: TypeScript type-check ───────────────────────────────────────
echo ""
echo "▶ [2/3] TypeScript type-check (catches type errors, missing imports)..."
if [[ -f node_modules/.bin/tsc ]]; then
  if npx tsc --noEmit --skipLibCheck 2>&1 | tail -40; then
    echo "  ✓ TypeScript passed"
  else
    echo "  ✗ TypeScript FAILED"
    FAILURES=$((FAILURES + 1))
  fi
else
  echo "  ⚠ tsc not found — run 'bun install' first"
  echo "  ⚠ Skipping typecheck (cannot validate)"
  FAILURES=$((FAILURES + 1))
fi

# ── Check 3: Production build (only in full mode) ────────────────────────
if [[ $FAST == 0 ]]; then
  echo ""
  echo "▶ [3/3] Production build (catches webpack/Next.js build errors)..."
  if bun run build 2>&1 | tail -50; then
    echo "  ✓ Build passed"
  else
    echo "  ✗ Build FAILED"
    FAILURES=$((FAILURES + 1))
  fi
else
  echo ""
  echo "▶ [3/3] Skipped (--fast mode)"
fi

# ── Summary ──────────────────────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [[ $FAILURES == 0 ]]; then
  echo "  ✓ ALL CHECKS PASSED — safe to push"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  exit 0
else
  echo "  ✗ $FAILURES CHECK(S) FAILED — DO NOT PUSH"
  echo ""
  echo "  Fix the errors above, then re-run this script."
  echo "  If you push anyway, Vercel will fail with the same errors."
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  exit 1
fi
