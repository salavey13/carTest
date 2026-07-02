#!/usr/bin/env bash
# =============================================================================
# sync-nnvolt-static.sh — Sync files from main rental repo to nnvolt-static
# =============================================================================
# 
# This script copies the nnvolt page and its dependencies from the main
# Next.js project into the standalone Vite project for static deployment.
#
# Usage: ./scripts/sync-nnvolt-static.sh
#
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
STATIC_DIR="$REPO_ROOT/nnvolt-static"

cd "$REPO_ROOT"

echo "Syncing nnvolt page to standalone project..."

# 1. Copy page.tsx → App.tsx (with import path adjustments)
echo "  Copying page.tsx → src/App.tsx"
cp app/nnvolt/page.tsx "$STATIC_DIR/src/App.tsx"

# 2. Copy styles.css
echo "  Copying styles.css → src/styles.css"
cp app/nnvolt/styles.css "$STATIC_DIR/src/styles.css"

# 3. Copy UI components
echo "  Copying UI components..."
COMPONENTS=(button card input textarea accordion badge separator sheet scroll-area)
for comp in "${COMPONENTS[@]}"; do
  if [[ -f "components/ui/$comp.tsx" ]]; then
    cp "components/ui/$comp.tsx" "$STATIC_DIR/src/components/ui/$comp.tsx"
  fi
done

# 4. Copy lib/utils.ts (cn helper)
echo "  Copying lib/utils.ts"
mkdir -p "$STATIC_DIR/src/lib"
cp lib/utils.ts "$STATIC_DIR/src/lib/utils.ts"

# 5. Copy public assets
echo "  Copying public assets..."
mkdir -p "$STATIC_DIR/public/images"

# Copy images
if [[ -d "public/images" ]]; then
  cp -r public/images/* "$STATIC_DIR/public/images/" 2>/dev/null || true
fi

# Copy logo and downloadable files
[[ -f "public/logo.svg" ]] && cp public/logo.svg "$STATIC_DIR/public/"
[[ -f "public/pricelist-nn-volt.xlsx" ]] && cp public/pricelist-nn-volt.xlsx "$STATIC_DIR/public/"
[[ -f "public/zapros-smeti-nn-volt.txt" ]] && cp public/zapros-smeti-nn-volt.txt "$STATIC_DIR/public/"

echo "✓ Sync complete!"
echo ""
echo "Next steps:"
echo "  cd nnvolt-static"
echo "  npm install  (if not done yet)"
echo "  npm run build"
