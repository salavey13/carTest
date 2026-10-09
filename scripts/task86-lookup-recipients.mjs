// Task 86: look up vip-bike co-owners (i_o_s_nn, roman) telegram chat ids
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb = createClient(url, key);

// 1) find crew id for vip-bike
const { data: crews, error: ce } = await sb
  .from("crews")
  .select("id, slug, name")
  .eq("slug", "vip-bike");
if (ce) { console.error("crews error:", ce.message); process.exit(1); }
const crew = crews?.[0];
console.log("crew:", crew?.id, crew?.slug, crew?.name);

// 2) members of vip-bike
const { data: members, error: me } = await sb
  .from("crew_members")
  .select("user_id, role, membership_status")
  .eq("crew_id", crew.id);
if (me) { console.error("members error:", me.message); process.exit(1); }
console.log(`members: ${members?.length ?? 0}`);
const byId = new Map();
for (const m of members ?? []) byId.set(m.user_id, m);

// 3) users rows for those ids (batched)
const ids = [...byId.keys()];
const users = new Map();
for (let i = 0; i < ids.length; i += 50) {
  const chunk = ids.slice(i, i + 50);
  const { data: us, error: ue } = await sb
    .from("users")
    .select("id, username, telegram_chat_id, telegram_username, full_name, first_name, last_name")
    .in("id", chunk);
  if (ue) { console.error("users error:", ue.message); continue; }
  for (const u of us ?? []) users.set(u.id, u);
}

for (const [uid, m] of byId) {
  const u = users.get(uid);
  console.log(JSON.stringify({
    user_id: uid,
    role: m.role,
    status: m.membership_status,
    username: u?.username,
    telegram_username: u?.telegram_username ?? null,
    telegram_chat_id: u?.telegram_chat_id ?? null,
    name: [u?.first_name, u?.last_name].filter(Boolean).join(" ") || u?.full_name || null,
  }));
}
console.log("done");
