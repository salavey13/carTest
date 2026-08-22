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

  // Map arbitrary source values to the allowed intent_type / stage check constraints.
  let intentType;
  let stage;
  let urgency = 20;

  switch (source) {
    case "sale_contract":
      intentType = "prebuy";
      stage = "prebuy_started";
      urgency = 85;
      break;
    case "rental_contract":
      intentType = "rent";
      stage = "configured";
      urgency = 90;
      break;
    case "test_drive":
      intentType = "test_ride";
      stage = "test_ride_requested";
      urgency = 85;
      break;
    case "web_callback":
      intentType = "contact_click";
      stage = "contacted";
      urgency = 75;
      break;
    case "app_open":
      intentType = "contact_click";
      stage = "clicked";
      urgency = 20;
      break;
    default:
      intentType = "contact_click";
      stage = "viewed";
      urgency = 20;
  }

  return {
    slug: SLUG,
    bike_id: meta.bikeId || null,
    intent_type: intentType,
    stage,
    source_route: source === "app_open" ? "/backfill" : String(source),
    contact_channel: /^\d+$/.test(String(user.user_id)) ? "telegram_bot" : "web_app",
    urgency_score: urgency,
    telegram_user_id: /^\d+$/.test(String(user.user_id)) ? user.user_id : null,
    phone: normalizePhone(meta.phone),
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

function conflictKey(intent) {
  return `${intent.slug}|${intent.bike_id ?? "_"}|${intent.telegram_user_id ?? "_"}|${intent.intent_type}`;
}

async function main() {
  const since = new Date();
  since.setDate(since.getDate() - LOOKBACK_DAYS);
  since.setHours(0, 0, 0, 0);

  console.log(`Backfilling users created since ${since.toISOString()}...`);

  const { data: users, error } = await supabaseAdmin
    .from("users")
    .select("user_id, full_name, username, metadata, created_at")
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

  // Fetch existing intents to emulate upsert manually (unique constraint may not exist yet).
  const { data: existing, error: existingError } = await supabaseAdmin
    .from("franchize_intents")
    .select("id, slug, bike_id, telegram_user_id, intent_type")
    .eq("slug", SLUG)
    .gte("created_at", since.toISOString());

  if (existingError) {
    console.error("Failed to fetch existing intents:", existingError);
    process.exit(1);
  }

  const existingByKey = new Map();
  for (const row of existing || []) {
    existingByKey.set(conflictKey(row), row.id);
  }

  const toInsert = [];
  const toUpdate = [];

  for (const intent of intents) {
    const id = existingByKey.get(conflictKey(intent));
    if (id) {
      toUpdate.push({ id, ...intent });
    } else {
      toInsert.push(intent);
    }
  }

  if (toInsert.length > 0) {
    const { error: insertError } = await supabaseAdmin
      .from("franchize_intents")
      .insert(toInsert);
    if (insertError) {
      console.error("Failed to insert intents:", insertError);
      process.exit(1);
    }
  }

  if (toUpdate.length > 0) {
    const { error: updateError } = await supabaseAdmin
      .from("franchize_intents")
      .upsert(toUpdate, { onConflict: "id" });
    if (updateError) {
      console.error("Failed to update intents:", updateError);
      process.exit(1);
    }
  }

  console.log(`Backfilled ${intents.length} intent rows: ${toInsert.length} inserted, ${toUpdate.length} updated.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
