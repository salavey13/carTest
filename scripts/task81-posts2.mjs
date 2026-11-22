// Task 81: search crew_posts for surge/69k sale post.
import { writeFileSync } from "node:fs";
import { createClient } from "/home/z/cartest/node_modules/@supabase/supabase-js/dist/main/index.js";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const out = {};

const { data: posts, error } = await sb.from("crew_posts").select("id, crew_id, author_id, author_scope, kind, body, is_hidden, created_at, metadata")
  .or("body.ilike.*surge*,body.ilike.*y-volt*,body.ilike.*сурдж*,metadata->>bike_id.eq.y-volt-surge-v")
  .order("created_at", { ascending: false }).limit(30);
out.error = error?.message || null;
out.posts = (posts || []).map((p) => ({
  id: p.id, crew: p.crew_id, author: p.author_id, kind: p.kind, hidden: p.is_hidden,
  at: p.created_at, body: (p.body || "").slice(0, 300), meta: p.metadata,
}));
// posts by the bike link table
const { data: pb, error: pbErr } = await sb.from("crew_post_bikes").select("post_id, bike_id, position").eq("bike_id", "y-volt-surge-v").limit(20);
out.postBikesErr = pbErr?.message || null;
out.postBikes = pb || [];
if (pb?.length) {
  const ids = pb.map((x) => x.post_id);
  const { data: p2 } = await sb.from("crew_posts").select("id, crew_id, author_id, kind, body, is_hidden, created_at").in("id", ids);
  out.linkedPosts = p2 || [];
}
writeFileSync("/home/z/cartest/scripts/task81-posts2-out.json", JSON.stringify(out, null, 1));
console.log("written");
