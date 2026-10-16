// Follow-up: find djorudjov (ilike) + dump vip-bike crew_members with statuses.
import { createClient } from "@supabase/supabase-js";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb = createClient(url, key, { auth: { persistSession: false } });

const { data: users } = await sb
  .from("users")
  .select("user_id, username, status, role")
  .ilike("username", "%djor%")
  .limit(10);
console.log("== users ilike %djor% ==", JSON.stringify(users, null, 2));

const vipBikeId = "2d5fde70-1dd3-4f0d-8d72-66ccf6908746";
const { data: mem } = await sb
  .from("crew_members")
  .select("user_id, role, membership_status, joined_at")
  .eq("crew_id", vipBikeId);
console.log("\n== vip-bike crew_members ==", JSON.stringify(mem, null, 2));

// usernames for those member ids
if (mem?.length) {
  const ids = mem.map((m) => m.user_id);
  const { data: us } = await sb.from("users").select("user_id, username").in("user_id", ids);
  console.log("\n== their usernames ==", JSON.stringify(us, null, 2));
}

// owner of vip-bike
const { data: crew } = await sb.from("crews").select("slug, name, owner_id, metadata").eq("id", vipBikeId).maybeSingle();
console.log("\n== vip-bike crew row ==", JSON.stringify({ ...crew, metadata: crew?.metadata ? Object.keys(crew.metadata) : null }, null, 2));
