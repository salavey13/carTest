#!/usr/bin/env node
// Backfill all public.users created in the last 30 days into franchize_intents as leads.
// Run: node scripts/backfill-recent-users-to-leads.mjs
//
// This is idempotent: it upserts by (slug, bike_id, telegram_user_id, intent_type),
// so repeated runs only refresh metadata and last_seen_at.

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const SLUG = "vip-bike";
const LOOKBACK_DAYS = 30;

function normalizePhone(phone) {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, "");
  if (digits.length < 10) return null;
  return `+${digits}`;
}

function toIntent(user) {
  const meta = user.metadata || {};
  const source = meta.source || "app_open";
  const isContract = ["rental_contract", "sale_contract", "test_drive"].includes(source);
  const intentType = source === "sale_contract" ? "sale" : source === "rental_contract" ? "rent" : source === "test_drive" ? "test_drive" : "app_open";
  const stage = isContract ? "contract_generated" : "viewed";
  const urgency = source === "sale_contract" ? 85 : source === "rental_contract" ? 90 : source === "test_drive" ? 85 : 20;

  return {
    slug: SLUG,
    bike_id: meta.bikeId || null,
    intent_type: intentType,
    stage,
    source_route: source === "app_open" ? "/backfill" : String(source),
    contact_channel: /^\d+$/.test(String(user.user_id)) ? "telegram_bot" : "web_app",
    urgency_score: urgency,
    telegram_user_id: /^\d+$/.test(String(user.user_id)) ? user.user_id : null,
    phone: normalizePhone(user.phone || meta.phone),
    metadata: {
      name: user.full_name || meta.name || null,
      username: user.username || meta.username || null,
      bikeTitle: meta.bikeTitle || null,
      backfilledAt: new Date().toISOString(),
      originalCreatedAt: user.created_at,
      originalSource: source,
    },
    last_seen_at: user.created_at || new Date().toISOString(),
    created_at: user.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

async function main() {
  const since = new Date();
  since.setDate(since.getDate() - LOOKBACK_DAYS);
  since.setHours(0, 0, 0, 0);

  console.log(`Backfilling users created since ${since.toISOString()}...`);

  const { data: users, error } = await supabaseAdmin
    .from("users")
    .select("user_id, full_name, username, phone, metadata, created_at")
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch users:", error);
    process.exit(1);
  }

  console.log(`Found ${users?.length || 0} users.`);

  const intents = (users || []).map(toIntent);
  if (intents.length === 0) {
    console.log("Nothing to backfill.");
    process.exit(0);
  }

  const { error: upsertError } = await supabaseAdmin
    .from("franchize_intents")
    .upsert(intents, { onConflict: "slug,bike_id,telegram_user_id,intent_type" });

  if (upsertError) {
    console.error("Failed to upsert intents:", upsertError);
    process.exit(1);
  }

  console.log(`Backfilled ${intents.length} intent rows.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
