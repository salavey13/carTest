#!/usr/bin/env bash
# Rename storage folder: falcon-gt-2025/ → falcon-gt-2026/
# Downloads each image, uploads to new path, deletes old.
# Run this BEFORE applying the SQL migration (so gallery URLs match after DB update).

set -euo pipefail

URL="https://inmctohsodgdohamhzag.supabase.co"
KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlubWN0b2hzb2RnZG9oYW1oemFnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczODMzOTU4NSwiZXhwIjoyMDUzOTE1NTg1fQ.xD91Es2o8T1vM-2Ok8iKCn4jGDA5TwBbapD5eqhblLM"
BUCKET="carpix"
OLD_PREFIX="falcon-gt-2025"
NEW_PREFIX="falcon-gt-2026"

echo "=== Listing all objects in $OLD_PREFIX/ ==="
OBJECTS=$(curl -s "$URL/storage/v1/object/list/$BUCKET" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d "{\"prefix\":\"$OLD_PREFIX/\",\"limit\":100}" | python3 -c "
import json,sys
d = json.load(sys.stdin)
for o in d:
    print(o['name'])
")

COUNT=0
for NAME in $OBJECTS; do
  COUNT=$((COUNT + 1))
  OLD_PATH="$OLD_PREFIX/$NAME"
  NEW_PATH="$NEW_PREFIX/$NAME"
  TMP_FILE="/tmp/falcon_gt_rename_$COUNT"

  echo ""
  echo "[$COUNT] $OLD_PATH → $NEW_PATH"

  # Download
  curl -s -o "$TMP_FILE" "$URL/storage/v1/object/public/$BUCKET/$OLD_PATH"
  if [ ! -s "$TMP_FILE" ]; then
    echo "  ERROR: download failed (empty file)"
    continue
  fi

  # Detect content type
  case "$NAME" in
    *.jpg|*.jpeg) CT="image/jpeg" ;;
    *.png) CT="image/png" ;;
    *.webp) CT="image/webp" ;;
    *) CT="application/octet-stream" ;;
  esac

  # Upload to new path
  UPLOAD_RESP=$(curl -s -X POST "$URL/storage/v1/object/$BUCKET/$NEW_PATH" \
    -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
    -H "Content-Type: $CT" \
    --data-binary @"$TMP_FILE" 2>&1)

  if echo "$UPLOAD_RESP" | grep -q '"Key"'; then
    echo "  ✅ uploaded"
  else
    echo "  ❌ upload failed: $UPLOAD_RESP"
    continue
  fi

  # Delete old file
  DEL_RESP=$(curl -s -X DELETE "$URL/storage/v1/object/$BUCKET/$OLD_PATH" \
    -H "apikey: $KEY" -H "Authorization: Bearer $KEY" 2>&1)

  if echo "$DEL_RESP" | grep -q "Successfully deleted"; then
    echo "  🗑️  old deleted"
  else
    echo "  ⚠️  delete failed: $DEL_RESP"
  fi

  rm -f "$TMP_FILE"
done

echo ""
echo "=== Done: $COUNT files renamed ==="
echo ""
echo "=== Verification ==="
echo "New folder ($NEW_PREFIX/):"
curl -s "$URL/storage/v1/object/list/$BUCKET" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d "{\"prefix\":\"$NEW_PREFIX/\",\"limit\":20}" | python3 -c "
import json,sys
d = json.load(sys.stdin)
print(f'  Objects: {len(d)}')
for o in d[:5]:
    print(f'    {o[\"name\"]}')
" 2>&1

echo "Old folder ($OLD_PREFIX/):"
curl -s "$URL/storage/v1/object/list/$BUCKET" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d "{\"prefix\":\"$OLD_PREFIX/\",\"limit\":20}" | python3 -c "
import json,sys
d = json.load(sys.stdin)
print(f'  Objects: {len(d)}')
" 2>&1
