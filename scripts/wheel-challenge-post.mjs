#!/usr/bin/env node
// scripts/wheel-challenge-post.mjs
// Boss request (2026-10-11): «Suggest to create post about it — those who get
// >13 likes get free ride for a friend». Creates the promo wall post on the
// vip-bike crew wall announcing the wheel of fortune + the >13-likes challenge.
// Idempotent: skips when the post (marker tag) already exists.
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  (also accepts SUPABASE_SERVICE_KEY;
// new sb_secret_ keys work as the value too). Env-only: no hardcoded fallbacks.
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || "https://inmctohsodgdohamhzag.supabase.co";
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY;
if (!SUPABASE_KEY) {
  console.error("ENV MISSING: export SUPABASE_SERVICE_ROLE_KEY (legacy JWT or new sb_secret_ key) before running this script");
  process.exit(1);
}

// Маркер для идемпотентности (в теле поста) — по нему же админ найдёт пост.
const MARKER = "#колесофортуны";
const SLUG = "vip-bike";
// Автор — salavey13 (admin экипажа, ADMIN_CHAT_ID).
const AUTHOR_ID = "413553377";

const BODY = [
  "🎰 КОЛЕСО ФОРТУНЫ ЗАРАБОТАЛО!",
  "",
  "Заходи на витрину экипажа → «Колесо фортуны» и крути: на колесе скидки 1 000 ₽, 2 000 ₽, 5 000 ₽ и 15% на аренду или покупку. Одна крутка в сутки, промокод приходит в личку и сразу применяется в корзине.",
  "",
  "🔥 ЧЕЛЛЕНДЖ: этот пост собирает лайки — как только наберёт БОЛЬШЕ 13 ЛАЙКОВ, мы разыгрываем бесплатную поездку для друга: приведи кореша, и один прокат за наш счёт.",
  "",
  "Ставь ❤️, крути колесо и забирай друга на прогулку!",
  "",
  MARKER,
].join("\n");

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

async function main() {
  // 1) crew id
  const { data: crew, error: crewErr } = await supabase
    .from("crews")
    .select("id, slug, name")
    .eq("slug", SLUG)
    .maybeSingle();
  if (crewErr || !crew) throw new Error(`crew lookup failed: ${crewErr?.message ?? "not found"}`);

  // 2) idempotency: пост с маркером уже есть?
  const { data: existing } = await supabase
    .from("crew_posts")
    .select("id, created_at")
    .eq("crew_id", crew.id)
    .ilike("body", `%${MARKER}%`)
    .limit(1)
    .maybeSingle();
  if (existing) {
    console.log(`Post already exists: ${existing.id} (${existing.created_at}) — skipping.`);
    return;
  }

  // 3) author must exist (FK) — auto-provision like ensureUserProfile
  const { data: author } = await supabase
    .from("users")
    .select("user_id")
    .eq("user_id", AUTHOR_ID)
    .maybeSingle();
  if (!author) {
    const { error: insErr } = await supabase
      .from("users")
      .insert({ user_id: AUTHOR_ID, metadata: { source: "wheel-challenge-post" } });
    if (insErr) throw new Error(`author provisioning failed: ${insErr.message}`);
    console.log("Provisioned author user row (id only).");
  }

  // 4) insert the post (author is crew admin → author_scope 'crew')
  const { data: post, error: postErr } = await supabase
    .from("crew_posts")
    .insert({
      crew_id: crew.id,
      author_id: AUTHOR_ID,
      author_scope: "crew",
      kind: "post",
      body: BODY,
      is_hidden: false,
    })
    .select("id, created_at")
    .single();
  if (postErr) throw new Error(`post insert failed: ${postErr.message}`);

  console.log(`Wall post created: ${post.id} at ${post.created_at}`);
  console.log(`Wall URL: https://v0-car-test.vercel.app/franchize/${SLUG}/community`);
}

main().catch((error) => {
  console.error("FAILED:", error?.message ?? error);
  process.exit(1);
});
