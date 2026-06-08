# VIP Bike Doc Creation Skill - Complete Installer
# ===============================================
#
# ZAI Agent can parse this file to recreate all components for
# VLM-based document extraction and rental/sale contract generation.
#
# FORMAT: Each code block starts with: // FILE: path/to/file
# ZAI should extract code between ``` markers and create files.
#
# ===============================================
# QUICK START FOR ZAI:
# ===============================================
#
# 1. Use RepoTxtFetcher "DocX" button to get all 20 files
# 2. Only 2 env vars needed:
#    - SUPABASE_URL
#    - SUPABASE_SERVICE_ROLE_KEY
# 3. No ZAI SDK needed - ZAI web agent has native VLM!
#
# ===============================================
# FILE STRUCTURE:
# ===============================================
#
# Skills (2):
#   - skills/rental-contract-from-photos/SKILL.md
#   - skills/deal-contract-from-photos/SKILL.md
#
# Scripts (3):
#   - scripts/make-rental-contract-skill.mjs
#   - scripts/make-deal-contract-skill.mjs
#   - scripts/supabase-access-skill.mjs
#
# Library (1):
#   - lib/htmlToDocx.mjs
#
# Templates (2):
#   - docs/RENTAL_DEAL_TEMPLATE.html
#   - docs/SALE_DEAL_TEMPLATE.html
#
# Migrations (5):
#   - supabase/migrations/20240101000000_init.sql
#   - supabase/migrations/20260304_private_scheme.sql
#   - supabase/migrations/20260601000000_user_rental_secrets.sql
#   - supabase/migrations/20260607000000_create_sale_contract_artifacts.sql
#   - supabase/migrations/20260508090000_repair_private_crew_secrets.sql
#
# API & Dashboard (4):
#   - app/api/forward-telegram/route.ts
#   - app/franchize/[slug]/rentals-analytics/page.tsx
#   - app/franchize/[slug]/rentals-analytics/RentalsAnalyticsClient.tsx
#   - app/franchize/server-actions/rentals-dashboard.ts
#
# ===============================================
# ENVIRONMENT VARIABLES (only 2!):
# ===============================================
#
# SUPABASE_URL=https://xxx.supabase.co
# SUPABASE_SERVICE_ROLE_KEY=eyJxxx...
#
# That's it! No ZAI keys needed.
#
# ===============================================
# SUPABASE ACCESS PATTERN:
# ===============================================
#
# READ bike from public.cars:
# GET {SUPABASE_URL}/rest/v1/cars?id=eq.{bikeId}&type=eq.bike
# Headers: apikey: {SUPABASE_SERVICE_ROLE_KEY}, Authorization: Bearer {SUPABASE_SERVICE_ROLE_KEY}
#
# WRITE to private.user_rental_secrets:
# POST {SUPABASE_URL}/rest/v1/user_rental_secrets
# Headers: apikey: {SUPABASE_SERVICE_ROLE_KEY}, Authorization: Bearer {SUPABASE_SERVICE_ROLE_KEY}, Accept-Profile: private
# Body: { doc_sha256, renter_full_name, renter_passport, ... }
#
# ===============================================
# QR CODE FORMAT:
# ===============================================
#
# https://t.me/oneBikePlsBot/app?startapp=rent_{bikeId}_{docSha256}
#
# ===============================================
# FORWARD-TELEGRAM API (optional):
# ===============================================
#
# POST https://v0-car-test.vercel.app/api/forward-telegram
# {
#   "chat_id": "123456789",
#   "method": "sendDocument",
#   "payload": { "caption": "Your document" },
#   "files": {
#     "document": { "data": "<base64_docx>", "filename": "contract.docx" }
#   }
# }
#
# ===============================================
# WORKFLOW FOR ZAI:
# ===============================================
#
# 1. Extract data from passport/license photos (use native VLM)
# 2. Read bike data from Supabase public.cars (type='bike')
# 3. Generate DOCX from HTML template (cheerio + docx)
# 4. Save to Supabase private schema via REST API
# 5. Optional: Send via forward-telegram API
# 6. Generate QR code for next rental
#
# ===============================================
