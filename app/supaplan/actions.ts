"use server";

import { supabaseAdmin } from "@/hooks/supabase";
import { sendTelegramMessageCore } from "@/app/core/telegram_actions";

type TaskNotifyInput = {
  taskId: string;
  taskTitle: string;
  capability?: string | null;
  todoPath?: string | null;
  chatId?: string | null;
};

export async function claimTask(capability: string, agentId: string) {
  const { data, error } = await supabaseAdmin.rpc("supaplan_claim_task", {
    p_capability: capability,
    p_agent: agentId,
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function updateTaskStatus(taskId: string, status: string) {
  const { error } = await supabaseAdmin
    .from("supaplan_tasks")
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", taskId);

  if (error) {
    throw error;
  }
}

export async function logTaskProgressEvent(taskId: string, summary: string) {
  const { error } = await supabaseAdmin.from("supaplan_events").insert({
    source: "dashboard",
    type: "task_progress",
    payload: { taskId, summary },
  });

  if (error) {
    throw error;
  }

  return { success: true };
}

export async function notifyTaskPickInTelegram(input: TaskNotifyInput) {
  const scopeLine = input.todoPath ? `\nОбласть: ${input.todoPath}` : "";
  const capabilityLine = input.capability ? `\nСпособность: ${input.capability}` : "";
  const deepLink = `https://t.me/oneBikePlsBot/app?startapp=supaplan`;
  const appLink = `https://v0-car-test.vercel.app/supaplan`;

  const message = [
    "📌 *Сигнал из СупаПлана*",
    `Задача: ${input.taskTitle}`,
    `ID задачи: ${input.taskId}`,
    `${capabilityLine}${scopeLine}`,
    "",
    "Открой ВебАпп и быстро забери задачу.",
  ]
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");

  const result = await sendTelegramMessageCore(message, [
    { text: "Открыть СупаПлан", url: appLink },
    { text: "Телеграм ВебАпп", url: deepLink },
  ], undefined, input.chatId ?? undefined);

  if (!result.success) {
    return { success: false, error: result.error };
  }

  await logTaskProgressEvent(input.taskId, "Задача отправлена в Телеграм из панели");

  return { success: true };
}
