// scripts/task78-fix-goollil-shift.mjs
//
// Task 78 (boss 2026-10-07): «regarding Goollil shifts - yes, please fix as
// well :)» — the monster flagged at the end of Task 77:
//
// DATA (verified live before writing this script):
//   Goollil (687580818, co_owner of vip-bike) has EXACTLY ONE shift row:
//     id 556c2494-aad9-4614-a6b9-a5d4b0c2bc8a
//     clock_in  2026-07-12T19:31:55.92+00:00   (22:31 MSK, «warehouse»)
//     clock_out 2026-08-17T09:11:22.045+00:00  (12:11 MSK)
//     duration  51 219 min = 853.7 h  × 169 ₽/h = 144 266.85 ₽
//   • The API refuses to open a new shift while one is open (409) — the same
//     forgotten-clock-out freeze that hit djorudjov / Paul / firdbradsen.
//   • Only 2 «warehouse» rows exist in the whole crew (the other is Paul's
//     2-minute 2025-11 test) → NO standard warehouse hours to lean on.
//   • Rate era: 169 ₽/h is correct for July (crew switched to 500 on 09-11,
//     Paul's own era ended 02.09) → no re-rating needed.
//   • crew_members.live_status = offline — no zombie online flag.
//
// REPAIR (same doctrine as Task 76 djorudjov / Task 77 Paul & firdbradsen):
//   The monster → its START day. Shift = 12.07 evening 19:31 → 23:59 UTC
//   (end of the start day; a 36-day tail is dropped, nobody works 854 h).
//   The trigger trg_calc_shift_salary recomputes duration/salary on update:
//   267 min × 169/60 ≈ 752 ₽ (was 144 266.85 ₽).
//   NOT INVENTED (flagged in the audit, restored on the boss's word):
//   • 13.07–16.08 — inside the monster span; no evidence Goollil worked.
//   • 17.08–07.10 — no rows at all after the close event.
//
// AUDIT: crews.metadata.owner_fix_20261007_shifts_goollil (owner_ prefix =
// double-invisible in member UI), alongside the previous owner_fix_* blocks.
//
// Run:  node --env-file=.env.local scripts/task78-fix-goollil-shift.mjs          (dry-run)
//       node --env-file=.env.local scripts/task78-fix-goollil-shift.mjs --apply  (execute)
import { createClient } from "../node_modules/@supabase/supabase-js/dist/main/index.js";

const APPLY = process.argv.includes("--apply");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const sb = createClient(url, key);

const GOOLLIL = "687580818";
const CREW_ID = "2d5fde70-1dd3-4f0d-8d72-66ccf6908746"; // VIP_BIKE
const AUDIT_KEY = "owner_fix_20261007_shifts_goollil";
const MONSTER_ID = "556c2494-aad9-4614-a6b9-a5d4b0c2bc8a";
const NEW_OUT = "2026-07-12T23:59:00+00:00"; // end of the START day

const log = (...a) => console.log(...a);

// ── fetch current state ──────────────────────────────────────────────────────
const { data: shifts, error } = await sb
  .from("crew_member_shifts")
  .select("*")
  .eq("member_id", GOOLLIL)
  .eq("crew_id", CREW_ID)
  .order("clock_in_time", { ascending: true });
if (error) {
  console.error("fetch failed:", error.message);
  process.exit(1);
}
const monster = shifts.find((s) => s.id === MONSTER_ID);
log(`goollil shifts: ${shifts.length} rows, open: ${shifts.filter((s) => !s.clock_out_time).length}`);
if (!monster) {
  log("monster row not found — nothing to fix (already repaired?)");
  process.exit(0);
}
const durMin = (a, b) => Math.round((new Date(b) - new Date(a)) / 60000);
const oldMin = durMin(monster.clock_in_time, monster.clock_out_time);
const newMin = durMin(monster.clock_in_time, NEW_OUT);
const newSalary = Math.round(((newMin / 60) * monster.hourly_rate + Number.EPSILON) * 100) / 100;
log(`monster: ${monster.clock_in_time} → ${monster.clock_out_time} (${oldMin} min, ${monster.salary_amount} ₽ @ ${monster.hourly_rate}/h)`);
log(`plan:    clock_out → ${NEW_OUT}  (~${newMin} min → ≈${newSalary} ₽ @ ${monster.hourly_rate}/h; trigger recomputes)`);

// ── audit block (read-modify-write, previous owner_fix_* preserved) ─────────
const { data: crewRow } = await sb.from("crews").select("metadata").eq("id", CREW_ID).maybeSingle();
const meta = { ...(crewRow?.metadata || {}) };
const auditEntry = {
  fixed_at: new Date().toISOString(),
  actor: "salavey13 (boss request, Task 78)",
  member: { user_id: GOOLLIL, name: "Goollil", crew_role: "co_owner" },
  operations: [
    {
      op: "UPDATE",
      id: MONSTER_ID,
      reason: "монстр-смена 12.07→17.08 (853.7 ч / 144 266.85 ₽, забыл закрыть — API не пускал открыть новую) → реальный день старта: закрытие 12.07 23:59 UTC, ставка 169 оставлена (июльская эра), хвост выброшен",
      from: { clock_out_time: monster.clock_out_time, duration_minutes: monster.duration_minutes, salary_amount: monster.salary_amount },
      to: { clock_out_time: NEW_OUT, expected_salary_approx: newSalary },
    },
  ],
  not_invented: [
    "13.07–16.08 (внутри монстра) — нет данных, что Goollil работал: восстановим по слову босса",
    "17.08–07.10 — после монстра строк нет вообще: восстановим по слову босса",
  ],
  notes: "ставка 169 корректна для июля (переход на 500 — 11.09); live_status уже offline; складских смен-образцов в экипаже нет, конец дня старта = консервативная оценка",
};

if (!APPLY) {
  log("\n[DRY-RUN] would update 1 row + write audit key", AUDIT_KEY);
  log(JSON.stringify(auditEntry.operations, null, 2));
  process.exit(0);
}

// ── apply: single UPDATE (trigger recomputes duration/salary) ────────────────
const { error: upErr } = await sb
  .from("crew_member_shifts")
  .update({ clock_out_time: NEW_OUT })
  .eq("id", MONSTER_ID)
  .eq("member_id", GOOLLIL); // belt & suspenders
if (upErr) {
  console.error("update failed:", upErr.message);
  process.exit(1);
}

// ── verify the trigger did its job ───────────────────────────────────────────
const { data: after } = await sb.from("crew_member_shifts").select("*").eq("id", MONSTER_ID).single();
log(`after: duration ${after.duration_minutes} min, salary ${after.salary_amount} ₽, out ${after.clock_out_time}`);

// append notes to the row itself (same convention as previous repairs)
const { error: noteErr } = await sb
  .from("crew_member_shifts")
  .update({
    notes: [after.notes, "исправлено 07.10.2026: монстр 12.07→17.08 приведён к реальному дню старта (забыл закрыть)"].filter(Boolean).join(" | "),
  })
  .eq("id", MONSTER_ID);
if (noteErr) log("warn: notes append failed:", noteErr.message);

// ── write audit ──────────────────────────────────────────────────────────────
const prev = meta[AUDIT_KEY];
const history = Array.isArray(prev) ? prev : prev ? [prev] : [];
meta[AUDIT_KEY] = [...history, auditEntry];
meta[AUDIT_KEY].__updated_at = new Date().toISOString();
const { error: metaErr } = await sb.from("crews").update({ metadata: meta }).eq("id", CREW_ID);
if (metaErr) {
  console.error("audit write failed:", metaErr.message);
  process.exit(1);
}
log(`audit written: crews.metadata.${AUDIT_KEY}`);
log("DONE");
