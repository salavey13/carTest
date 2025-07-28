import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const VERCEL_NOTIFY_ENDPOINT = Deno.env.get("VERCEL_NOTIFICATION_API_ENDPOINT");
const CRON_SECRET = Deno.env.get("CRON_SECRET");

async function notifyVercel(payload: object) {
  if (!VERCEL_NOTIFY_ENDPOINT || !CRON_SECRET) {
    console.error("Vercel notification endpoint or secret not configured.");
    return;
  }
  try {
    await fetch(VERCEL_NOTIFY_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${CRON_SECRET}` },
      body: JSON.stringify(payload)
    });
  } catch (e) {
    console.error("Error triggering Vercel notification API:", e.message);
  }
}

serve(async (req) => {
  const { userId, chatId, username, action } = await req.json();

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const { data: crewMember, error: crewError } = await supabaseAdmin
      .from("crew_members")
      .select("crew_id, crews(owner_id, name)")
      .eq("user_id", userId)
      .eq("status", "active")
      .single();

    if (crewError || !crewMember) {
      await notifyVercel({ chatId, message: "Вы не являетесь активным участником экипажа. Команда `/shift` недоступна." });
      return new Response("ok");
    }

    const { crew_id, crews: crew } = crewMember;
    const { owner_id: ownerId, name: crewName } = crew;

    const { data: activeShift, error: shiftError } = await supabaseAdmin
      .from("crew_member_shifts")
      .select("id, clock_in_time, shift_type")
      .eq("member_id", userId)
      .is("clock_out_time", null)
      .single();

    if (shiftError && shiftError.code !== 'PGRST116') throw shiftError;
    
    // --- Main Action Logic ---
    if (action === 'clock_in' && !activeShift) {
        await supabaseAdmin.from("crew_member_shifts").insert({ member_id: userId, crew_id, shift_type: 'online' });
        await notifyVercel({ chatId, message: "✅ *Смена начата.* Время пошло. Продуктивной работы!", removeKeyboard: true });
        await notifyVercel({ chatId: ownerId, message: `🟢 Участник @${username} начал смену в экипаже *'${crewName}'*.` });
    } else if (action === 'clock_out' && activeShift) {
        const { data: updated } = await supabaseAdmin.from("crew_member_shifts").update({ clock_out_time: new Date().toISOString() }).eq("id", activeShift.id).select('duration_minutes').single();
        const duration = updated?.duration_minutes || 0;
        const hours = Math.floor(duration / 60);
        const minutes = Math.round(duration % 60);
        await notifyVercel({ chatId, message: `✅ *Смена завершена.*\nПродолжительность: *${hours} ч ${minutes} мин.*\nХорошего отдыха!`, removeKeyboard: true });
        await notifyVercel({ chatId: ownerId, message: `🔴 Участник @${username} завершил смену в экипаже *'${crewName}'*.` });
    } else if (action === 'toggle_ride' && activeShift) {
        const newShiftType = activeShift.shift_type === 'online' ? 'riding' : 'online';
        await supabaseAdmin.from("crew_member_shifts").update({ shift_type: newShiftType }).eq("id", activeShift.id);
        const statusMessage = newShiftType === 'riding' ? "🏍️ Статус изменен на *'На Байке'*. Поездка началась!" : "🏢 Статус изменен на *'Онлайн'*. Вы снова в боксе.";
        await notifyVercel({ chatId, message: statusMessage, removeKeyboard: true });
        await notifyVercel({ chatId: ownerId, message: `⚙️ Статус участника @${username} в *'${crewName}'*: ${newShiftType === 'riding' ? "На Байке" : "Онлайн"}` });
    } else {
      // --- Display Keyboard ---
      let buttons = [];
      if (activeShift) {
          const toggleRideLabel = activeShift.shift_type === 'online' ? "🏍️ Начать Поездку" : "🏢 Завершить Поездку";
          buttons = [ [{ text: toggleRideLabel }], [{ text: "❌ Завершить Смену" }] ];
      } else {
          buttons = [ [{ text: "✅ Начать Смену" }] ];
      }
      await notifyVercel({ chatId, message: "Выберите действие:", keyboardType: 'reply', buttons });
    }

    return new Response("ok");
  } catch (error) {
    console.error("Error in handle-shift-command:", error);
    await notifyVercel({ chatId, message: `🚨 Системная ошибка: \`\`\`${error.message}\`\`\`` });
    return new Response("error", { status: 500 });
  }
});