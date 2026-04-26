"use server";

import { supabaseAdmin } from "@/lib/supabase-server";
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

export type PriorityTask = {
  id: string;
  title: string;
  status: string;
  capability: string | null;
  score: number;
  reasoning: string;
};

/**
 * Scores a non‑done franchize task based on status, phase, capability importance,
 * and an optional JSON‑encoded priority (p0/p1/p2) in the `body` field.
 * Returns the 5 tasks with the highest priority score.
 */
export async function getTopPriorityTasks(): Promise<{
  success: boolean;
  data?: PriorityTask[];
  error?: string;
}> {
  try {
    // 1. Fetch all non‑done franchize tasks, including the body
    const { data, error } = await supabaseAdmin
      .from("supaplan_tasks")
      .select("id,title,status,capability,created_at,body")
      .or("capability.like.franchize.%,capability.eq.greenbox.franchize")
      .neq("status", "done")
      .order("created_at", { ascending: false });

    if (error) throw error;
    if (!data || data.length === 0) {
      return { success: true, data: [] };
    }

    // 2. Scoring weights
    const statusScore: Record<string, number> = {
      open: 10,
      claimed: 7,
      running: 5,
      ready_for_pr: 3,
    };

    const phaseMultiplier: Record<string, number> = {
      "Апрель": 1.5,
      "Май": 1.3,
      "Июнь": 1.1,
      "Лето": 0.9,
      "2027": 0.7,
    };

    // Capability priority – bumped ui.ux significantly
    const capabilityImportance: Record<string, number> = {
      "franchize.rental": 1.4,
      "franchize.backend.supabase": 1.4,
      "franchize.ui.ux": 1.8,   // was 1.0 → now top tier
      "franchize.info": 1.2,
      "franchize.telegram": 1.2,
      "franchize.analytics": 1.1,
      "franchize.kpi": 1.1,
      "franchize.onboarding": 1.0,
      "franchize.integration": 0.9,
      "franchize.sales": 0.9,
      "franchize.growth": 0.8,
      "franchize.gamification": 0.7,
    };

    const phaseMap: Record<string, string> = {
      "franchize.info": "Апрель",
      "franchize.rental": "Апрель",
      "franchize.kpi": "Апрель",
      "franchize.telegram": "Апрель",
      "franchize.analytics": "Апрель",
      "franchize.ui.ux": "Апрель",
      "franchize.backend.supabase": "Апрель",
      "franchize.sales": "Май",
      "franchize.onboarding": "Май",
      "franchize.growth": "Май",
      "franchize.integration": "Июнь",
      "franchize.gamification": "Лето",
    };

    // Priority tag multiplier from JSON body (p0, p1, p2)
    const priorityMultiplier: Record<string, number> = {
      p0: 2.2,
      p1: 1.6,
      p2: 1.25,
    };

    // 3. Calculate priority score for each task
    const scored = (data as any[]).map((task: any) => {
      const baseScore = statusScore[task.status] || 0;
      const capability = task.capability || "";
      const phase = phaseMap[capability] || "2027";
      const phaseMult = phaseMultiplier[phase] || 1.0;
      const capImportance = capabilityImportance[capability] || 1.0;

      // Parse body JSON for priority tag
      let priorityMult = 1.0;
      let priorityLabel = "";
      if (task.body) {
        try {
          const bodyObj = typeof task.body === "string" ? JSON.parse(task.body) : task.body;
          if (bodyObj && typeof bodyObj === "object" && bodyObj.priority) {
            const raw = String(bodyObj.priority).toLowerCase();
            if (priorityMultiplier[raw]) {
              priorityMult = priorityMultiplier[raw];
              priorityLabel = ` +${raw.toUpperCase()} (×${priorityMult})`;
            }
          }
        } catch {
          // ignore parse errors
        }
      }

      // Age boost: tasks created more than 7 days ago get +0.5
      const ageDays = (Date.now() - new Date(task.created_at).getTime()) / (1000 * 60 * 60 * 24);
      const ageBoost = ageDays > 7 ? 0.5 : 0;

      const total = baseScore * phaseMult * capImportance * priorityMult + ageBoost;

      let reasoning = `${baseScore} (статус) × ${phaseMult} (фаза ${phase}) × ${capImportance} (важность)`;
      if (priorityLabel) reasoning += priorityLabel;
      if (ageBoost > 0) reasoning += ` +0.5 (старше 7 дней)`;

      return { ...task, score: Math.round(total * 10) / 10, reasoning };
    });

    // 4. Sort descending, pick top 5
    scored.sort((a: any, b: any) => b.score - a.score);
    const top5 = scored.slice(0, 5).map(
      (t: any): PriorityTask => ({
        id: t.id,
        title: t.title,
        status: t.status,
        capability: t.capability,
        score: t.score,
        reasoning: t.reasoning,
      })
    );

    return { success: true, data: top5 };
  } catch (err: any) {
    console.error("[getTopPriorityTasks]", err);
    return { success: false, error: err.message || "Failed to compute priority tasks" };
  }
}