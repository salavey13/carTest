#!/usr/bin/env bash
# /home/z/my-project/analytics/boss-commands/lead-stuck-watchdog.sh
#
# Boss command: lead-stuck-watchdog
# Detects leads that have been stuck in the same stage for too long:
#   - new / needs_contact for > 72h (no contact attempt)
#   - contract_sent / awaiting_qr_claim for > 48h (QR not claimed)
#   - documents_missing for > 24h (docs not uploaded)
# Sends an alert so operators can re-engage.
#
# Output: Telegram message ONLY if there are stuck leads (silent otherwise)
# Cron schedule: every 4h 09-21 Moscow = "0 5,9,13,17 * * *"
#
# Usage:
#   ./lead-stuck-watchdog.sh
#   ./lead-stuck-watchdog.sh --dry-run

set -euo pipefail
source "$(dirname "$0")/_lib.sh"

DRY_RUN="${1:-}"
NOW_DISPLAY=$(TZ=Europe/Moscow date +"%H:%M")
NOW_UTC=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

log "Running lead-stuck-watchdog at $NOW_DISPLAY МСК"

# ─── Fetch all active leads (not dismissed, with stageKey) ──────────────────
LEADS_DATA=$(supabase_query "franchize_intents" \
  "select=id,slug,stage,urgency_score,source_route,contact_channel,phone,telegram_user_id,metadata,last_seen_at,created_at,updated_at&slug=eq.${CREW_SLUG}&stage=neq.dismissed&order=urgency_score.desc&limit=200")

# ─── Identify stuck leads ───────────────────────────────────────────────────
# Stuck criteria (in hours since last_seen_at or created_at):
#   - new / hold_created / interest_paid            → stuck if > 72h
#   - contacted / offer_sent / manual_reserved       → stuck if > 72h
#   - contract_generated                              → stuck if > 48h
#   - checkout_started                                → stuck if > 24h
# Build stuck leads list with per-lead deep links
STUCK_LEADS_RAW=$(echo "$LEADS_DATA" | jq -r '
  def hours_since(iso):
    if iso == null then 9999
    else
      (((iso | split(".")[0] | sub("\\+00:00$"; "")) + "Z") | fromdateiso8601) as $t
      | (now - $t) / 3600
    end;

  def stuck_threshold(stage):
    if stage == "new" or stage == "hold_created" or stage == "interest_paid" or stage == "contacted" or stage == "offer_sent" or stage == "manual_reserved" or stage == "alternative_offered" then 72
    elif stage == "contract_generated" then 48
    elif stage == "checkout_started" then 24
    elif stage == "checkout_completed" then 12
    else 999
    end;

  def stuck_label(stage):
    if stage == "new" or stage == "hold_created" or stage == "interest_paid" then "ждёт контакта 72ч+"
    elif stage == "contacted" or stage == "offer_sent" or stage == "manual_reserved" then "ждёт следующего шага 72ч+"
    elif stage == "contract_generated" then "договор готов к отправке 48ч+"
    elif stage == "checkout_started" then "чек-аут ждёт завершения 24ч+"
    else ""
    end;

  map(
    . as $l
    | {
        id: .id,
        stage: .stage,
        urgency: .urgency_score,
        hours_stuck: hours_since(.last_seen_at // .created_at),
        threshold: stuck_threshold(.stage),
        name: (if .metadata and (.metadata | type) == "object" then (.metadata.renterName // .metadata.name // .metadata.full_name // .metadata.clientName // .metadata.firstName // .metadata.customer_name // .metadata.renter_name // "Без имени") else "Без имени" end),
        reason: stuck_label(.stage)
      }
    | select(.hours_stuck > .threshold and .threshold < 999)
  )
  | sort_by(-.hours_stuck)
  | .[0:5]
  | if length == 0 then "STUCK_NONE"
    else
      map("• \(.name) — срочность \(.urgency) — \(.reason) (уже \((.hours_stuck | floor))ч)")
      | join("\n")
    end
')

if [[ "$STUCK_LEADS" == "STUCK_NONE" ]]; then
  log "No stuck leads — staying silent"
  exit 0
fi

# ─── State-aware dedup ──
# Script-level cooldown: only fire once per 12h for the stuck-leads alert type
if already_alerted "lead_stuck_batch" "all" 43200; then
  log "Stuck leads already alerted in last 12h — staying silent"
  exit 0
fi
record_alert "lead_stuck_batch" "all"

STUCK_COUNT=$(echo "$STUCK_LEADS" | wc -l)

# Severity
if [[ "$STUCK_COUNT" -ge 5 ]]; then
  SEVERITY="🔴🔴"
elif [[ "$STUCK_COUNT" -ge 2 ]]; then
  SEVERITY="🔴"
else
  SEVERITY="🟠"
fi

LEADS_LINK="$(lead_segment_link "troubled")"
MESSAGE="${SEVERITY} <b>Лиды ждут развития</b> — ${STUCK_COUNT} шт.

${STUCK_LEADS}

🔔 Проверено в ${NOW_DISPLAY} МСК

💬 Действия:
1. Связаться с каждым клиентом (Telegram/телефон)
2. Обновить стадию вручную если прогресс есть
3. Dismiss если клиент потерян

📋 Проблемные лиды: <a href=\"${LEADS_LINK}\">Открыть</a>"

if [[ "$DRY_RUN" == "--dry-run" ]]; then
  echo "$MESSAGE" | sed 's/<[^>]*>//g'
else
  send_telegram "$MESSAGE" "HTML"
  log "Sent lead-stuck-watchdog ($STUCK_COUNT stuck leads) to chat $ADMIN_CHAT_ID"
fi
