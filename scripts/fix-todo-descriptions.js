// /home/z/my-project/scripts/fix-todo-descriptions.js
// Fix description JSONB for the 11 crew_todos created today (recovery cleanup).
// Previously the rental_id was null in description JSONB even though the
// rental_id column was updated. Now we sync the description JSONB to match.

const SUPABASE_URL = "https://inmctohsodgdohamhzag.supabase.co";
const SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlubWN0b2hzb2RnZG9oYW1oemFnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczODMzOTU4NSwiZXhwIjoyMDUzOTE1NTg1fQ.xD91Es2o8T1vM-2Ok8iKCn4jGDA5TwBbapD5eqhblLM";
const headers = {
  apikey: SUPABASE_SERVICE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

// Rentals we manually created yesterday
const RENTALS = [
  {
    rentalId: "7b2bab65-5327-42f2-aa46-9a1cd3fcac53",
    renterChatId: "1317807980",
    renterName: "Головин Яков Алексеевич",
    renterPhone: "+79040695691",
    bikeId: "ducati-1199-panigale-2012",
    rentEndDate: "22.08.2026",
    titleHints: ["1199", "Panigale"],
  },
  {
    rentalId: "cc4bf3d6-fbb7-4e29-bb85-ccbfd1c4d4b4",
    renterChatId: "1440836416",
    renterName: "Ладонежский Олег Борисович",
    renterPhone: "+79200599059",
    bikeId: "ducati-panigale-s-electro-black-aero",
    rentEndDate: "22.08.2026",
    titleHints: ["Aero", "Black Aero"],
  },
];

async function main() {
  for (const rental of RENTALS) {
    console.log(`=== ${rental.renterName} (${rental.bikeId}) ===`);

    // Fetch the 10 todos for this rental (already linked via rental_id column)
    const listRes = await fetch(
      `${SUPABASE_URL}/rest/v1/crew_todos?rental_id=eq.${rental.rentalId}&select=id,title,description`,
      { headers },
    );
    const todos = listRes.ok ? await listRes.json() : [];
    console.log(`Found ${todos.length} todos to update`);

    for (const t of todos) {
      // Parse existing description (it's stored as JSON string)
      let descObj = {};
      try { descObj = typeof t.description === "string" ? JSON.parse(t.description) : (t.description || {}); } catch {}

      // Only update if bike_id in description matches OUR bike (otherwise it's a
      // cross-linked todo that belongs to a different rental — fix-cross-linked-todos.js
      // handles those separately).
      const descBikeId = descObj.bike_id;
      if (descBikeId && descBikeId !== rental.bikeId) {
        console.log(`  ⏭️  ${t.id} — bike mismatch (desc says ${descBikeId}, we expected ${rental.bikeId}), skipping`);
        continue;
      }

      // Update the renter-related fields
      const updatedDesc = {
        ...descObj,
        lead_id: rental.renterChatId,
        user_id: rental.renterChatId,
        phone: rental.renterPhone,
        lead_phone: rental.renterPhone,
        lead_name: rental.renterName,
        bike_id: rental.bikeId,
        rental_id: rental.rentalId,
        rent_end_date: rental.rentEndDate,
      };

      const patchRes = await fetch(
        `${SUPABASE_URL}/rest/v1/crew_todos?id=eq.${t.id}`,
        {
          method: "PATCH",
          headers,
          body: JSON.stringify({ description: JSON.stringify(updatedDesc) }),
        },
      );
      const ok = patchRes.ok;
      console.log(`  ${ok ? "✅" : "❌"} ${t.id} — ${t.title?.slice(0, 60)}`);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
