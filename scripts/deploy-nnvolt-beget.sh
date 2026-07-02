#!/usr/bin/env bash
# =============================================================================
# deploy-nnvolt-beget.sh — Build NN Volt static site and deploy to Beget
# =============================================================================
# 
# Usage:
#   ./scripts/deploy-nnvolt-beget.sh [--dry-run] [--build-only]
#
# Requirements:
#   - Node.js 18+ with npm
#   - lftp (for FTP upload) — install: apt install lftp
#   - .env.beget file with credentials (see .env.beget.example)
#
# What it does:
#   1. Syncs nnvolt page from main project to standalone Vite project
#   2. Builds static HTML/CSS/JS bundle
#   3. Uploads to Beget via FTP (lftp mirror)
#
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
STATIC_DIR="$REPO_ROOT/nnvolt-static"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${BLUE}[INFO]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }
success() { echo -e "${GREEN}[OK]${NC} $1"; }

# Parse flags
DRY_RUN=false
BUILD_ONLY=false
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true; warn "DRY RUN mode — will not upload to Beget" ;;
    --build-only) BUILD_ONLY=true; warn "BUILD ONLY mode — will not upload" ;;
  esac
done

cd "$REPO_ROOT"

# ─── Step 1: Sync files ──────────────────────────────────────────────────────
log "Step 1: Syncing nnvolt files to standalone project..."
bash "$SCRIPT_DIR/sync-nnvolt-static.sh"

# ─── Step 2: Install deps (if needed) ────────────────────────────────────────
cd "$STATIC_DIR"

if [[ ! -d "node_modules" ]]; then
  log "Step 2: Installing dependencies (first time)..."
  npm install --no-fund --no-audit 2>&1 | tail -5
else
  log "Step 2: Dependencies already installed, skipping..."
fi

# ─── Step 3: Build ───────────────────────────────────────────────────────────
log "Step 3: Building static site..."

if npm run build 2>&1 | tee "$REPO_ROOT/build-nnvolt.log"; then
  success "Build completed"
else
  error "Build failed. Check build-nnvolt.log for details."
fi

# Check output
if [[ ! -d "dist" ]]; then
  error "Build succeeded but 'dist/' directory not found"
fi

if [[ ! -f "dist/index.html" ]]; then
  error "dist/index.html not found"
fi

# Calculate total size
DIST_SIZE=$(du -sh dist | cut -f1)
FILE_COUNT=$(find dist -type f | wc -l)
success "Static site ready in dist/ ($DIST_SIZE, $FILE_COUNT files)"

# Show what was built
log "Built files:"
find dist -type f | sort | head -20
if [[ $FILE_COUNT -gt 20 ]]; then
  echo "  ... and $((FILE_COUNT - 20)) more files"
fi

if [[ "$BUILD_ONLY" == "true" ]]; then
  success "Build-only mode — skipping upload"
  exit 0
fi

if [[ "$DRY_RUN" == "true" ]]; then
  warn "DRY RUN — skipping upload to Beget"
  log "To upload manually, create .env.beget and run without --dry-run"
  exit 0
fi

# ─── Step 4: Upload to Beget ─────────────────────────────────────────────────
cd "$REPO_ROOT"

# Load Beget credentials
if [[ ! -f ".env.beget" ]]; then
  error "Missing .env.beget file. Copy from .env.beget.example and fill in your credentials."
fi

source .env.beget

# Validate required vars
: "${BEGET_FTP_HOST:?BEGET_FTP_HOST is required in .env.beget}"
: "${BEGET_FTP_USER:?BEGET_FTP_USER is required in .env.beget}"
: "${BEGET_FTP_PASS:?BEGET_FTP_PASS is required in .env.beget}"
: "${BEGET_REMOTE_PATH:?BEGET_REMOTE_PATH is required in .env.beget}"

log "Step 4: Uploading to Beget..."
log "  Host: $BEGET_FTP_HOST"
log "  User: $BEGET_FTP_USER"
log "  Path: $BEGET_REMOTE_PATH"

# Check lftp
if ! command -v lftp &> /dev/null; then
  error "lftp not found. Install with: sudo apt install lftp"
fi

# Upload with lftp mirror (reliable, resumable)
lftp -c "
set ftp:ssl-allow no
set net:max-retries 3
set net:timeout 30
set mirror:parallel-directories yes
open -u $BEGET_FTP_USER,$BEGET_FTP_PASS $BEGET_FTP_HOST
mirror -R --verbose=3 --delete $STATIC_DIR/dist/ $BEGET_REMOTE_PATH/
bye
"

if [[ $? -eq 0 ]]; then
  success "Upload completed!"
  log "Site should be live at your Beget domain shortly"
else
  error "Upload failed"
fi

success "Deploy complete! ⚡"
