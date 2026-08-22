"use server";

import { revalidatePath } from "next/cache";

import { supabaseAdmin } from "@/lib/supabase-server";

type IrrigationActionState = {
  ok: boolean;
  message: string;
};

export async function enqueueIrrigationCycle(
  _prevState: IrrigationActionState,
  formData: FormData,
): Promise<IrrigationActionState> {
  const zone = String(formData.get("zone") ?? "tomato-main");
  const intensity = String(formData.get("intensity") ?? "gentle");

  try {
    const admin = supabaseAdmin as any;
    const { error } = await admin.from("greenbox_irrigation_queue").insert({
      zone,
      intensity,
      status: "queued",
      requested_at: new Date().toISOString(),
      source: "greenbox-ui",
    });

    if (error) {
      throw error;
    }

    revalidatePath("/greenbox");

    return {
      ok: true,
      message: "Полив добавлен в журнал очереди. Можно спокойно наблюдать за садом.",
    };
  } catch {
    return {
      ok: false,
      message: "Не удалось записать цикл в журнал. Проверьте миграцию greenbox_irrigation_queue.",
    };
  }
}
