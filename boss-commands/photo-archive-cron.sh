#!/usr/bin/env bash
# /home/z/my-project/boss-commands/photo-archive-cron.sh
#
# I4 — Nightly photo retention cron.
# Runs two passes:
#   1. ARCHIVE: move photos older than 12 months from `rental-photos` →
#      `rental-photos-archive` bucket. Sets `rental_photos.archived_at`.
#   2. TRASH HARD-DELETE: permanently delete files in `rental-photos/_trash/`
#      that are older than 30 days. Removes the corresponding `rental_photos`
#      metadata rows (hard delete).
#
# Cron schedule: nightly at 03:00 Moscow = 00:00 UTC = "0 0 * * *"
#
# Usage:
#   ./photo-archive-cron.sh              # runs both passes
#   ./photo-archive-cron.sh --dry-run    # prints what would happen, no changes
#   ./photo-archive-cron.sh --archive-only
#   ./photo-archive-cron.sh --trash-only
#
# PRD: docs/RENTAL_PHOTO_UPLOAD_PRD.md v1.3 §6 (Phase 4)
# Meta: docs/META_PRD_ITERATIVE_IMPLEMENTATION_PLAN.md I4

set -euo pipefail
source "$(dirname "$0")/_lib.sh"

DRY_RUN="${1:-}"
MODE="both"
if [[ "$DRY_RUN" == "--archive-only" ]]; then DRY_RUN=""; MODE="archive"; fi
if [[ "$DRY_RUN" == "--trash-only" ]]; then DRY_RUN=""; MODE="trash"; fi
if [[ "$DRY_RUN" == "--dry-run" ]]; then DRY_RUN="--dry-run"; fi

NOW_DISPLAY=$(TZ=Europe/Moscow date +"%H:%M")
log "Running photo-archive-cron (mode=$MODE, dry_run=${DRY_RUN:-no}) at $NOW_DISPLAY МСК"

# ─── Configuration ──────────────────────────────────────────────────────────
RETENTION_MONTHS="${PHOTO_RETENTION_MONTHS:-12}"
TRASH_HARD_DELETE_DAYS="${PHOTO_TRASH_DELETE_DAYS:-30}"
ARCHIVE_BUCKET="rental-photos-archive"
ACTIVE_BUCKET="rental-photos"

# Cutoff timestamps (UTC, for DB comparison)
ARCHIVE_CUTOFF=$(date -u -d "${RETENTION_MONTHS} months ago" +"%Y-%m-%dT%H:%M:%SZ")
TRASH_CUTOFF=$(date -u -d "${TRASH_HARD_DELETE_DAYS} days ago" +"%Y-%m-%dT%H:%M:%SZ")

log "Archive cutoff: photos created before $ARCHIVE_CUTOFF (>${RETENTION_MONTHS} months old)"
log "Trash cutoff:   trash entries before $TRASH_CUTOFF (>${TRASH_HARD_DELETE_DAYS} days old)"

ARCHIVED_COUNT=0
HARD_DELETED_COUNT=0

# ─── Pass 1: Archive old photos ─────────────────────────────────────────────
if [[ "$MODE" == "archive" || "$MODE" == "both" ]]; then
  log "─── Pass 1: Archive photos older than ${RETENTION_MONTHS} months ───"

  # Fetch photos to archive (not already archived, not soft-deleted)
  PHOTOS_TO_ARCHIVE=$(supabase_query "rental_photos" \
    "select=id,storage_path,rental_id,photo_type&created_at=lt.${ARCHIVE_CUTOFF}&archived_at=is.null&deleted_at=is.null&order=created_at.asc&limit=100" \
    "public")

  ARCHIVE_COUNT=$(echo "$PHOTOS_TO_ARCHIVE" | jq 'length')
  log "Found $ARCHIVE_COUNT photos to archive"

  if [[ "$ARCHIVE_COUNT" -gt 0 ]]; then
    # Ensure archive bucket exists
    # (Supabase storage API — create bucket via REST if missing)
    BUCKET_EXISTS=$(curl -s -o /dev/null -w "%{http_code}" \
      -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
      "$URL/storage/v1/bucket/${ARCHIVE_BUCKET}")
    if [[ "$BUCKET_EXISTS" != "200" ]]; then
      log "Creating archive bucket: $ARCHIVE_BUCKET"
      if [[ "$DRY_RUN" != "--dry-run" ]]; then
        curl -s -X POST \
          -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
          -H "Content-Type: application/json" \
          -d "{\"id\":\"$ARCHIVE_BUCKET\",\"name\":\"$ARCHIVE_BUCKET\",\"public\":false}" \
          "$URL/storage/v1/bucket" > /dev/null
      fi
    fi

    # Process each photo
    echo "$PHOTOS_TO_ARCHIVE" | jq -c '.[]' | while read -r photo; do
      PHOTO_ID=$(echo "$photo" | jq -r '.id')
      STORAGE_PATH=$(echo "$photo" | jq -r '.storage_path')
      RENTAL_ID=$(echo "$photo" | jq -r '.rental_id')

      log "  Archiving: $PHOTO_ID ($STORAGE_PATH)"

      if [[ "$DRY_RUN" == "--dry-run" ]]; then
        log "    [DRY RUN] would move to $ARCHIVE_BUCKET/$STORAGE_PATH + set archived_at"
        continue
      fi

      # Download from active bucket
      DOWNLOAD_URL="$URL/storage/v1/object/${ACTIVE_BUCKET}/${STORAGE_PATH}"
      PHOTO_DATA=$(curl -s -H "apikey: $KEY" -H "Authorization: Bearer $KEY" "$DOWNLOAD_URL")
      if [[ $? -ne 0 ]]; then
        log "    ERROR: download failed for $STORAGE_PATH — skipping"
        continue
      fi

      # Upload to archive bucket (same path)
      UPLOAD_URL="$URL/storage/v1/object/${ARCHIVE_BUCKET}/${STORAGE_PATH}"
      UPLOAD_RESULT=$(echo "$PHOTO_DATA" | curl -s -X POST \
        -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
        -H "Content-Type: image/jpeg" \
        --data-binary @- \
        "$UPLOAD_URL")
      if echo "$UPLOAD_RESULT" | jq -e '.error' > /dev/null 2>&1; then
        log "    ERROR: archive upload failed — skipping"
        continue
      fi

      # Remove from active bucket
      curl -s -X DELETE \
        -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
        "$URL/storage/v1/object/${ACTIVE_BUCKET}/${STORAGE_PATH//\//%2F}" > /dev/null

      # Update metadata row: set archived_at
      supabase_query "rental_photos" \
        "id=eq.${PHOTO_ID}" \
        "public" > /dev/null 2>&1 || true
      # Use direct PATCH via REST API
      curl -s -X PATCH \
        -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
        -H "Content-Type: application/json" \
        -d "{\"archived_at\":\"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\"}" \
        "$URL/rest/v1/rental_photos?id=eq.${PHOTO_ID}" > /dev/null

      ARCHIVED_COUNT=$((ARCHIVED_COUNT + 1))
      log "    ✓ archived"
    done

    log "Pass 1 complete: $ARCHIVED_COUNT photos archived"
  else
    log "Pass 1: no photos to archive"
  fi
fi

# ─── Pass 2: Hard-delete old trash ──────────────────────────────────────────
if [[ "$MODE" == "trash" || "$MODE" == "both" ]]; then
  log "─── Pass 2: Hard-delete trash older than ${TRASH_HARD_DELETE_DAYS} days ───"

  # Fetch soft-deleted photos where deleted_at < cutoff
  TRASH_TO_DELETE=$(supabase_query "rental_photos" \
    "select=id,storage_path&deleted_at=lt.${TRASH_CUTOFF}&order=deleted_at.asc&limit=100" \
    "public")

  TRASH_COUNT=$(echo "$TRASH_TO_DELETE" | jq 'length')
  log "Found $TRASH_COUNT trash entries to hard-delete"

  if [[ "$TRASH_COUNT" -gt 0 ]]; then
    echo "$TRASH_TO_DELETE" | jq -c '.[]' | while read -r photo; do
      PHOTO_ID=$(echo "$photo" | jq -r '.id')
      STORAGE_PATH=$(echo "$photo" | jq -r '.storage_path')

      log "  Hard-deleting: $PHOTO_ID ($STORAGE_PATH)"

      if [[ "$DRY_RUN" == "--dry-run" ]]; then
        log "    [DRY RUN] would delete file + metadata row"
        continue
      fi

      # Delete file from storage (path should be in _trash/ prefix)
      curl -s -X DELETE \
        -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
        "$URL/storage/v1/object/${ACTIVE_BUCKET}/${STORAGE_PATH//\//%2F}" > /dev/null

      # Hard-delete metadata row
      curl -s -X DELETE \
        -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
        "$URL/rest/v1/rental_photos?id=eq.${PHOTO_ID}" > /dev/null

      HARD_DELETED_COUNT=$((HARD_DELETED_COUNT + 1))
      log "    ✓ hard-deleted"
    done

    log "Pass 2 complete: $HARD_DELETED_COUNT trash entries hard-deleted"
  else
    log "Pass 2: no trash to hard-delete"
  fi
fi

# ─── Summary ────────────────────────────────────────────────────────────────
log "─── Summary ───"
log "Archived:      $ARCHIVED_COUNT photos (→ $ARCHIVE_BUCKET)"
log "Hard-deleted:  $HARD_DELETED_COUNT trash entries"

if [[ "$DRY_RUN" == "--dry-run" ]]; then
  log "[DRY RUN] No actual changes made."
fi

# ─── Notify on anomaly (optional) ───────────────────────────────────────────
# Alert if archived_count + hard_deleted_count is unusually high (>50 in one run)
TOTAL_PROCESSED=$((ARCHIVED_COUNT + HARD_DELETED_COUNT))
if [[ "$TOTAL_PROCESSED" -gt 50 && "$DRY_RUN" != "--dry-run" ]]; then
  send_telegram "📦 Photo retention cron processed $TOTAL_PROCESSED items (archive=$ARCHIVED_COUNT, hard_delete=$HARD_DELETED_COUNT). Unusually high — check for bulk operations." "HTML"
fi

log "Done."
