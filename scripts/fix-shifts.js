// /home/z/my-project/scripts/fix-shifts.js
// Fix shifts for Rustam (7813830016) and Paul (413553377).
//
// Issues:
// 1. Yesterday (2026-08-21) — both had wrong shifts (10:00-22:00). Close/correct them.
//    Also check day before (2026-08-20).
// 2. Today (2026-08-22) — start new shifts retroactively at 09:30 for both.
//
// Crew ID: 2d5fde70-1dd3-4f0d-8d72-66ccf6908746 (vip-bike)

const SUPABASE_URL = "https://inmctohsodgdohamhzag.supabase.co";
const SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlubWN0b2hzb2RnZG9oYW1oemFnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczODMzOTU4NSwiZXhwIjoyMDUzOTE1NTg1fQ.xD91Es2o8T1vM-2Ok8iKCn4jGDA5TwBbapD5eqhblLM";
const CREW_ID = "2d5fde70-1dd3-4f0d-8d72-66ccf6908746";
const RUSTAM = "7813830016";
const PAUL = "413553377";

const headers = {
  apikey: SUPABASE_SERVICE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

async function main() {
  const COMMIT = process.argv.includes("--commit");

  console.log(`Mode: ${COMMIT ? "⚠️ COMMIT" : "🔍 DRY RUN"}`);
  console.log("");

  // 1. Query existing shifts for the last 3 days (Aug 20, 21, 22)
  console.log("=== Existing shifts (Aug 20-22) ===");
  const shiftRes = await fetch(
    `${SUPABASE_URL}/rest/v1/crew_member_shifts?crew_id=eq.${CREW_ID}&user_id=in.(${RUSTAM},${PAUL})&shift_date=gte.2026-08-20&shift_date=lte.2026-08-22&select=id,user_id,shift_date,check_in_at,check_out_at,shift_type,status,created_at,updated_at&order=shift_date.asc,user_id.asc`,
    { headers },
  );
  if (!shiftRes.ok) {
    console.error(`Query failed: ${shiftRes.status} ${await shiftRes.text()}`);
    return;
  }
  const shifts = await shiftRes.json();
  console.log(`Found ${shifts.length} shifts:`);
  for (const s of shifts) {
    const name = s.user_id === RUSTAM ? "Rustam" : s.user_id === PAUL ? "Paul" : s.user_id;
    console.log(`  [${s.id?.toString().slice(0, 8)}] ${name} | ${s.shift_date} | check_in=${s.check_in_at || "—"} | check_out=${s.check_out_at || "—"} | type=${s.shift_type} | status=${s.status}`);
  }

  // 2. Fix plan:
  //    a) Yesterday (Aug 21): if shifts exist with wrong times, update check_in to 09:30 and check_out to actual end
  //    b) Day before (Aug 20): same check
  //    c) Today (Aug 22): if no shift exists, create one with check_in=09:30

  console.log("");
  console.log("=== Fix plan ===");

  for (const userId of [RUSTAM, PAUL]) {
    const name = userId === RUSTAM ? "Rustam" : "Paul";

    // Check Aug 20
    const aug20 = shifts.find(s => s.user_id === userId && s.shift_date === "2026-08-20");
    if (aug20) {
      console.log(`  ${name} Aug 20: found shift (check_in=${aug20.check_in_at}, check_out=${aug20.check_out_at})`);
      if (aug20.check_in_at && !aug20.check_in_at.includes("09:30")) {
        console.log(`    → check_in is wrong, needs correction to 09:30`);
      }
    }

    // Check Aug 21
    const aug21 = shifts.find(s => s.user_id === userId && s.shift_date === "2026-08-21");
    if (aug21) {
      console.log(`  ${name} Aug 21: found shift (check_in=${aug21.check_in_at}, check_out=${aug21.check_out_at})`);
      if (aug21.check_in_at && !aug21.check_in_at.includes("09:30")) {
        console.log(`    → check_in is wrong, needs correction to 09:30`);
      }
    }

    // Check Aug 22 (today)
    const aug22 = shifts.find(s => s.user_id === userId && s.shift_date === "2026-08-22");
    if (aug22) {
      console.log(`  ${name} Aug 22: found shift (check_in=${aug22.check_in_at}, check_out=${aug22.check_out_at})`);
      if (aug22.check_in_at && !aug22.check_in_at.includes("09:30")) {
        console.log(`    → check_in is wrong, needs correction to 09:30`);
      }
    } else {
      console.log(`  ${name} Aug 22: NO shift found — needs to be created with check_in=09:30`);
    }
  }

  if (!COMMIT) {
    console.log("");
    console.log("DRY RUN — run with --commit to apply fixes.");
    return;
  }

  // 3. Apply fixes
  console.log("");
  console.log("=== Applying fixes ===");

  for (const userId of [RUSTAM, PAUL]) {
    const name = userId === RUSTAM ? "Rustam" : "Paul";

    // Fix Aug 20, 21, 22: update check_in_at to 09:30 MSK (06:30 UTC)
    for (const date of ["2026-08-20", "2026-08-21", "2026-08-22"]) {
      const existing = shifts.find(s => s.user_id === userId && s.shift_date === date);
      if (!existing) {
        // Create new shift for today (Aug 22) with check_in=09:30
        if (date === "2026-08-22") {
          console.log(`  Creating shift for ${name} on ${date} with check_in=09:30 MSK`);
          const createRes = await fetch(`${SUPABASE_URL}/rest/v1/crew_member_shifts`, {
            method: "POST",
            headers,
            body: JSON.stringify({
              crew_id: CREW_ID,
              user_id: userId,
              shift_date: date,
              check_in_at: `${date}T06:30:00+00:00`, // 09:30 MSK = 06:30 UTC
              shift_type: "standard",
              status: "active",
            }),
          });
          if (!createRes.ok) {
            console.log(`    ❌ Create failed: ${createRes.status} ${await createRes.text()}`);
          } else {
            console.log(`    ✅ Created`);
          }
        }
        continue;
      }

      // Update existing shift: set check_in_at to 09:30 MSK
      const newCheckIn = `${date}T06:30:00+00:00`;
      if (existing.check_in_at && existing.check_in_at.includes("09:30")) {
        console.log(`  ${name} ${date}: already 09:30, skipping`);
        continue;
      }

      console.log(`  Updating ${name} ${date}: check_in → 09:30 MSK (was ${existing.check_in_at})`);
      const updateRes = await fetch(
        `${SUPABASE_URL}/rest/v1/crew_member_shifts?id=eq.${existing.id}`,
        {
          method: "PATCH",
          headers,
          body: JSON.stringify({
            check_in_at: newCheckIn,
            updated_at: new Date().toISOString(),
          }),
        },
      );
      if (!updateRes.ok) {
        console.log(`    ❌ Update failed: ${updateRes.status} ${await updateRes.text()}`);
      } else {
        console.log(`    ✅ Updated`);
      }
    }
  }

  // 4. Verify
  console.log("");
  console.log("=== Verification ===");
  const verifyRes = await fetch(
    `${SUPABASE_URL}/rest/v1/crew_member_shifts?crew_id=eq.${CREW_ID}&user_id=in.(${RUSTAM},${PAUL})&shift_date=gte.2026-08-20&shift_date=lte.2026-08-22&select=user_id,shift_date,check_in_at,check_out_at,status&order=shift_date.asc,user_id.asc`,
    { headers },
  );
  const verifyShifts = verifyRes.ok ? await verifyRes.json() : [];
  for (const s of verifyShifts) {
    const name = s.user_id === RUSTAM ? "Rustam" : s.user_id === PAUL ? "Paul" : s.user_id;
    const checkIn = s.check_in_at ? new Date(s.check_in_at).toLocaleTimeString("ru-RU", { timeZone: "Europe/Moscow" }) : "—";
    const checkOut = s.check_out_at ? new Date(s.check_out_at).toLocaleTimeString("ru-RU", { timeZone: "Europe/Moscow" }) : "—";
    console.log(`  ${name} | ${s.shift_date} | in=${checkIn} | out=${checkOut} | ${s.status}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
