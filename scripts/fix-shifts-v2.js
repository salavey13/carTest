// /home/z/my-project/scripts/fix-shifts-v2.js
// Fix shifts for Rustam (7813830016) and Paul (413553377) per operator request.
//
// Issues:
// 1. Yesterday (Aug 21): both had wrong shifts. Paul's is open (no clock_out).
//    Close + correct check_in to 09:30 MSK (06:30 UTC).
// 2. Day before (Aug 20): Rustam's shift is open (no clock_out). Close + correct.
//    Paul's shift check_in needs correction.
// 3. Today (Aug 22): no shifts exist. Create new shifts retroactively at 09:30 MSK.
//
// The operator said the wrong shifts were "10:00 до 22:00" — we correct
// check_in to 09:30 MSK and set check_out to 22:00 MSK (19:00 UTC) for closed ones.
// Hourly rate = 169₽ (from existing shifts).

const SUPABASE_URL = "https://inmctohsodgdohamhzag.supabase.co";
const SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlubWN0b2hzb2RnZG9oYW1oemFnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczODMzOTU4NSwiZXhwIjoyMDUzOTE1NTg1fQ.xD91Es2o8T1vM-2Ok8iKCn4jGDA5TwBbapD5eqhblLM";
const CREW_ID = "2d5fde70-1dd3-4f0d-8d72-66ccf6908746";
const RUSTAM = "7813830016";
const PAUL = "413553377";
const HOURLY_RATE = 169;

const headers = {
  apikey: SUPABASE_SERVICE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

// 09:30 MSK = 06:30 UTC
const CHECK_IN_0930_MSK = (date) => `${date}T06:30:00+00:00`;
// 22:00 MSK = 19:00 UTC
const CHECK_OUT_2200_MSK = (date) => `${date}T19:00:00+00:00`;

function calcDurationAndSalary(checkInIso, checkOutIso) {
  const cin = new Date(checkInIso);
  const cout = new Date(checkOutIso);
  const minutes = Math.round((cout.getTime() - cin.getTime()) / 60000);
  const salary = Math.round((minutes / 60) * HOURLY_RATE * 100) / 100;
  return { duration_minutes: minutes, salary_amount: salary };
}

async function main() {
  const COMMIT = process.argv.includes("--commit");
  console.log(`Mode: ${COMMIT ? "⚠️ COMMIT" : "🔍 DRY RUN"}`);
  console.log("");

  // Fetch existing shifts
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/crew_member_shifts?member_id=in.(${RUSTAM},${PAUL})&select=id,member_id,clock_in_time,clock_out_time,duration_minutes,hourly_rate,salary_amount&order=clock_in_time.desc&limit=15`,
    { headers },
  );
  const allShifts = await res.json();
  console.log(`Found ${allShifts.length} recent shifts:`);
  for (const s of allShifts) {
    const name = s.member_id === RUSTAM ? "Rustam" : "Paul";
    const cin = s.clock_in_time?.slice(0, 16) || "—";
    const cout = s.clock_out_time?.slice(0, 16) || "open";
    console.log(`  [${s.id.slice(0, 8)}] ${name} | in=${cin} | out=${cout} | ${s.duration_minutes ? (s.duration_minutes / 60).toFixed(1) + "h" : "—"} | salary=${s.salary_amount || "—"}`);
  }

  // Fix plan:
  const fixes = [];

  for (const [userId, name] of [[RUSTAM, "Rustam"], [PAUL, "Paul"]]) {
    // Find shifts by date (UTC date)
    const findShift = (dateStr) => allShifts.find(s => {
      if (s.member_id !== userId) return false;
      const d = new Date(s.clock_in_time);
      const mskDate = new Date(d.getTime() + 3 * 3600 * 1000); // convert to MSK
      return mskDate.toISOString().slice(0, 10) === dateStr;
    });

    // Aug 20 (day before yesterday)
    const aug20 = findShift("2026-08-20");
    if (aug20) {
      const newCheckIn = CHECK_IN_0930_MSK("2026-08-20");
      const newCheckOut = CHECK_OUT_2200_MSK("2026-08-20");
      const { duration_minutes, salary_amount } = calcDurationAndSalary(newCheckIn, newCheckOut);
      fixes.push({
        id: aug20.id,
        name,
        date: "Aug 20",
        action: "update",
        payload: {
          clock_in_time: newCheckIn,
          clock_out_time: aug20.clock_out_time || newCheckOut, // keep existing close or set to 22:00
          duration_minutes: aug20.clock_out_time ? null : duration_minutes, // recalc only if we're setting the close
          salary_amount: aug20.clock_out_time ? null : salary_amount,
        },
        note: aug20.clock_out_time ? "fix check_in only" : "fix check_in + close at 22:00 MSK",
      });
    }

    // Aug 21 (yesterday)
    const aug21 = findShift("2026-08-21");
    if (aug21) {
      const newCheckIn = CHECK_IN_0930_MSK("2026-08-21");
      const newCheckOut = CHECK_OUT_2200_MSK("2026-08-21");
      const { duration_minutes, salary_amount } = calcDurationAndSalary(newCheckIn, newCheckOut);
      fixes.push({
        id: aug21.id,
        name,
        date: "Aug 21",
        action: "update",
        payload: {
          clock_in_time: newCheckIn,
          clock_out_time: newCheckOut,
          duration_minutes,
          salary_amount,
        },
        note: "fix check_in to 09:30 + close at 22:00 MSK",
      });
    }

    // Aug 22 (today) — create new shift if none exists
    const aug22 = findShift("2026-08-22");
    if (!aug22) {
      fixes.push({
        id: null,
        name,
        date: "Aug 22",
        action: "create",
        payload: {
          member_id: userId,
          crew_id: CREW_ID,
          clock_in_time: CHECK_IN_0930_MSK("2026-08-22"),
          shift_type: "online",
          hourly_rate: HOURLY_RATE,
        },
        note: "create new shift with check_in=09:30 MSK (open — not closed yet)",
      });
    }
  }

  console.log("");
  console.log("=== Fix plan ===");
  for (const f of fixes) {
    console.log(`  ${f.name} ${f.date}: ${f.action} (${f.note})`);
  }

  if (!COMMIT) {
    console.log("");
    console.log("DRY RUN — run with --commit to apply.");
    return;
  }

  // Apply
  console.log("");
  console.log("=== Applying ===");
  for (const f of fixes) {
    if (f.action === "update") {
      console.log(`  Updating ${f.name} ${f.date} (${f.id.slice(0, 8)})...`);
      const res = await fetch(`${SUPABASE_URL}/rest/v1/crew_member_shifts?id=eq.${f.id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify(f.payload),
      });
      console.log(`    ${res.ok ? "✅" : "❌"} ${res.status}`);
    } else if (f.action === "create") {
      console.log(`  Creating ${f.name} ${f.date}...`);
      const res = await fetch(`${SUPABASE_URL}/rest/v1/crew_member_shifts`, {
        method: "POST",
        headers,
        body: JSON.stringify(f.payload),
      });
      console.log(`    ${res.ok ? "✅" : "❌"} ${res.status}`);
      if (!res.ok) console.log(`    ${await res.text()}`);
    }
  }

  // Verify
  console.log("");
  console.log("=== Verification ===");
  const verifyRes = await fetch(
    `${SUPABASE_URL}/rest/v1/crew_member_shifts?member_id=in.(${RUSTAM},${PAUL})&select=id,member_id,clock_in_time,clock_out_time,duration_minutes,salary_amount&order=clock_in_time.desc&limit=10`,
    { headers },
  );
  const verifyShifts = verifyRes.ok ? await verifyRes.json() : [];
  for (const s of verifyShifts) {
    const name = s.member_id === RUSTAM ? "Rustam" : "Paul";
    const cin = new Date(s.clock_in_time).toLocaleString("ru-RU", { timeZone: "Europe/Moscow" });
    const cout = s.clock_out_time ? new Date(s.clock_out_time).toLocaleString("ru-RU", { timeZone: "Europe/Moscow" }) : "open";
    const hours = s.duration_minutes ? (s.duration_minutes / 60).toFixed(1) + "h" : "—";
    const salary = s.salary_amount ? Math.round(s.salary_amount) + "₽" : "—";
    console.log(`  ${name} | in=${cin} | out=${cout} | ${hours} | ${salary}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
