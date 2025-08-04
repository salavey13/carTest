import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const VERCEL_NOTIFY_ENDPOINT = Deno.env.get("VERCEL_NOTIFICATION_API_ENDPOINT")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET")!;

interface VercelNotificationPayload {
  chatId: number | string;
  message: string;
  keyboardType?: 'inline' | 'reply';
  buttons?: { text: string; url?: string; callback_data?: string; }[][];
  removeKeyboard?: boolean;
}

async function notifyVercel(payload: VercelNotificationPayload) {
  if (!VERCEL_NOTIFY_ENDPOINT) {
    console.error("Vercel notification endpoint is not set.");
    return;
  }
  try {
    await fetch(VERCEL_NOTIFY_ENDPOINT, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${CRON_SECRET}` 
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    console.error("Failed to notify Vercel:", error);
  }
}

serve(async (req: Request) => {
  const { userId, chatId, username, action, location } = await req.json();
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    // We only need to find one active membership for the user
    const { data: crewMember, error: crewError } = await supabaseAdmin
      .from("crew_members")
      .select("crew_id, status, crews(owner_id, name)")
      .eq("user_id", userId)
      .eq("status", "active")
      .single();

    if (crewError || !crewMember) {
      await notifyVercel({ chatId, message: "Вы не являетесь активным участником экипажа." });
      return new Response("ok");
    }

    const { crews: crew, status: live_status } = crewMember;
    if (!crew) {
        throw new Error(`Crew data missing for member ${userId}`);
    }
    const { owner_id: ownerId, name: crewName } = crew;
    
    let updateData: any = {};
    let userMessage = "";
    let ownerMessage = "";

    if (action === 'clock_in' && live_status === 'offline') {
        updateData = { status: 'online' };
        userMessage = "✅ *Смена начата.* Время пошло. Продуктивной работы!";
        ownerMessage = `🟢 @${username} начал смену в экипаже *'${crewName}'*.`;
    } else if (action === 'clock_out' && live_status !== 'offline') {
        updateData = { status: 'offline', last_location: null };
        userMessage = `✅ *Смена завершена.*\nХорошего отдыха!`;
        ownerMessage = `🔴 @${username} завершил смену в экипаже *'${crewName}'*.`;
    } else if (action === 'toggle_ride' && live_status !== 'offline') {
        const newStatus = live_status === 'online' ? 'riding' : 'online';
        updateData = { status: newStatus };
        if (newStatus === 'riding' && location) {
            updateData.last_location = `POINT(${location.longitude} ${location.latitude})`;
            userMessage = "🏍️ Статус: *На Байке*. Ваша геолокация обновлена!";
        } else if (newStatus === 'riding' && !location) {
             userMessage = "📍 Чтобы показать себя на карте, *отправьте геолокацию*.";
        } else { // going back to online
             updateData.last_location = null;
             userMessage = "🏢 Статус: *Онлайн*. Снова в боксе.";
        }
        ownerMessage = `⚙️ Статус @${username} в *'${crewName}'*: ${newStatus === 'riding' ? "На Байке" : "Онлайн"}`;
    } else {
        // Just show the keyboard, no state change
    }

    if (Object.keys(updateData).length > 0) {
        const { error: updateError } = await supabaseAdmin
            .from("crew_members")
            .update(updateData)
            .eq("user_id", userId)
            .eq("status", "active");
        if(updateError) throw updateError;
        
        await notifyVercel({ chatId, message: userMessage, removeKeyboard: true });
        if(ownerId) await notifyVercel({ chatId: ownerId, message: ownerMessage });
    } else {
        const toggleRideLabel = live_status === 'online' ? "🏍️ На Байке" : "🏢 В Боксе";
        const buttons = live_status !== 'offline'
            ? [ [{ text: toggleRideLabel }], [{ text: "❌ Завершить Смену" }] ]
            : [ [{ text: "✅ Начать Смену" }] ];
        await notifyVercel({ chatId, message: "Выберите действие:", keyboardType: 'reply', buttons });
    }

    return new Response("ok");
  } catch (error) {
    console.error("Error in handle-shift-command:", error);
    await notifyVercel({ chatId, message: `🚨 Системная ошибка: \`\`\`${error.message}\`\`\`` });
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});