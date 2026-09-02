// Cleanup: delete the bogus duplicate note keyed by the operator chat id.
// Context: on 2026-09-02 operator 5219192922 added the note "Устно договорились
// до 03.09.26 дали попользоваться перчатки бесплатно" twice — once to the
// correct phone-keyed lead (+79040517675, 13:50) and once to the bogus
// operator-keyed "lead" (356282674, 13:52 — the collapsed operator card from
// the pre-identity-fix era). The second copy sits on a key that no longer
// matches any lead after the identity fix, so it's invisible garbage — remove it.
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  "https://inmctohsodgdohamhzag.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlubWN0b2hzb2RnZG9oYW1oemFnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczODMzOTU4NSwiZXhwIjoyMDUzOTE1NTg1fQ.xD91Es2o8T1vM-2Ok8iKCn4jGDA5TwBbapD5eqhblLM",
  { auth: { persistSession: false } },
);
const CREW_ID = "2d5fde70-1dd3-4f0d-8d72-66ccf6908746";

const { data: before } = await sb.from("lead_notes").select("id, lead_id, text").eq("crew_id", CREW_ID).eq("lead_id", "356282674");
console.log("operator-keyed notes before:", before);

if (before && before.length > 0) {
  const { error } = await sb.from("lead_notes").delete().eq("crew_id", CREW_ID).eq("lead_id", "356282674");
  if (error) { console.error("DELETE FAILED:", error.message); process.exit(1); }
  console.log("deleted", before.length, "bogus operator-keyed note(s)");
}

const { data: after } = await sb.from("lead_notes").select("id, lead_id, text").eq("crew_id", CREW_ID);
console.log("notes after cleanup:", after);
