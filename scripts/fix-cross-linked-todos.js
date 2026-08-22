// /home/z/my-project/scripts/fix-cross-linked-todos.js
// Fix the 4 Олег-todos that were accidentally linked to Яков's rental in the
// earlier recovery script (because "Panigale" matched both bikes).
//
// The 4 Олег-todos (by title text) are:
//   - 🔍 Осмотр на повреждения: Ducati Panigale S Electro Black Aero
//   - 🔧 Проверить ТС при возврате: Ducati Panigale S Electro Black Aero (22.08.2026 20...)
//   - 🔑 Принять ключи от Ducati Panigale S Electro Black Aero
//   - 📄 Проверить документы при возврате Ducati Panigale S Electro Black Aero
//   - 📸 Сфотографировать байк при возврате: Ducati Panigale S Electro Black Aero
//
// They should be linked to Олег's rental (cc4bf3d6...) NOT Яков's (7b2bab65...).

const SUPABASE_URL = "https://inmctohsodgdohamhzag.supabase.co";
const SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlubWN0b2hzb2RnZG9oYW1oemFnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczODMzOTU4NSwiZXhwIjoyMDUzOTE1NTg1fQ.xD91Es2o8T1vM-2Ok8iKCn4jGDA5TwBbapD5eqhblLM";
const headers = {
  apikey: SUPABASE_SERVICE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

const YAKOV_RENTAL = "7b2bab65-5327-42f2-aa46-9a1cd3fcac53";
const OLEG_RENTAL = "cc4bf3d6-fbb7-4e29-bb85-ccbfd1c4d4b4";
const OLEG_CHAT_ID = "1440836416";
const OLEG_PHONE = "+79200599059";
const OLEG_NAME = "Ладонежский Олег Борисович";
const OLEG_BIKE = "ducati-panigale-s-electro-black-aero";

async function main() {
  console.log("=== Fetching all todos linked to Яков's rental (rental_id=7b2bab65...) ===");
  const listRes = await fetch(
    `${SUPABASE_URL}/rest/v1/crew_todos?rental_id=eq.${YAKOV_RENTAL}&select=id,title,description`,
    { headers },
  );
  const todos = listRes.ok ? await listRes.json() : [];
  console.log(`Found ${todos.length} todos linked to Яков's rental`);

  // Filter: Олег's todos have title containing "Ducati Panigale S Electro Black Aero"
  const olegTodos = todos.filter((t) => t.title?.includes("Ducati Panigale S Electro Black Aero"));
  console.log(`Found ${olegTodos.length} Олег-todos that need re-linking:`);
  for (const t of olegTodos) {
    console.log(`  ${t.id} — ${t.title}`);
  }

  // Re-link each to Олег's rental
  for (const t of olegTodos) {
    // Parse existing description
    let descObj = {};
    try { descObj = JSON.parse(t.description); } catch {}

    // Update all renter-related fields to Олег
    const updatedDesc = {
      ...descObj,
      lead_id: OLEG_CHAT_ID,
      user_id: OLEG_CHAT_ID,
      phone: OLEG_PHONE,
      lead_phone: OLEG_PHONE,
      lead_name: OLEG_NAME,
      bike_id: OLEG_BIKE,
      rental_id: OLEG_RENTAL,
    };

    const patchRes = await fetch(
      `${SUPABASE_URL}/rest/v1/crew_todos?id=eq.${t.id}`,
      {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          rental_id: OLEG_RENTAL,
          lead_id: OLEG_CHAT_ID,
          description: JSON.stringify(updatedDesc),
        }),
      },
    );
    const ok = patchRes.ok;
    console.log(`  ${ok ? "✅" : "❌"} ${t.id} re-linked to Олег's rental ${OLEG_RENTAL}`);
  }

  // Verify
  console.log("");
  console.log("=== Verification ===");
  const yakovFinal = await fetch(
    `${SUPABASE_URL}/rest/v1/crew_todos?rental_id=eq.${YAKOV_RENTAL}&select=id,title`,
    { headers },
  ).then((r) => r.json());
  console.log(`Todos linked to Яков's rental: ${yakovFinal.length}`);
  for (const t of yakovFinal) console.log(`  ${t.title}`);

  const olegFinal = await fetch(
    `${SUPABASE_URL}/rest/v1/crew_todos?rental_id=eq.${OLEG_RENTAL}&select=id,title`,
    { headers },
  ).then((r) => r.json());
  console.log(`Todos linked to Олег's rental: ${olegFinal.length}`);
  for (const t of olegFinal) console.log(`  ${t.title}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
