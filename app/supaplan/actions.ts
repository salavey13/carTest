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
  if (error) throw error;
  return data;
}

export async function updateTaskStatus(taskId: string, status: string) {
  const { error } = await supabaseAdmin
    .from("supaplan_tasks")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", taskId);
  if (error) throw error;
}

export async function logTaskProgressEvent(taskId: string, summary: string) {
  const { error } = await supabaseAdmin.from("supaplan_events").insert({
    source: "dashboard",
    type: "task_progress",
    payload: { taskId, summary },
  });
  if (error) throw error;
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

  if (!result.success) return { success: false, error: result.error };
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
 * Priority scoring engine – franchize tasks only (ignores greenbox.*).
 *
 * Factors:
 * - Status weight: Open=10, Claimed=7, Running=5, Ready for PR=3
 * - Phase multiplier from metadata.phase:
 *   launch-blocker 2.0, launch-quality 1.6, security 1.5, performance 1.3,
 *   polishing 1.2, ux-fix 1.2, seo 1.1, code-quality 1.0, tech-debt 0.8, post-launch 0.7
 * - Capability base weight (higher = more foundational).
 * - Priority tag (from metadata.priority or body JSON) → critical 2.5, high 2.0, medium 1.5, low 1.0.
 *   Tags like "p0", "p1", "p2" in body also mapped: p0=2.5, p2=1.5.
 *   The strongest multiplier wins.
 * - Freshness boost: 2.0 if created within last 48h, 1.5 if within last 7d,
 *   0.8 if older than 30d (to slightly demote stale tasks).
 * - Quick win bonus: +1.0 if estimated_hours ≤ 4.
 */
export async function getTopPriorityTasks(): Promise<{
  success: boolean;
  data?: PriorityTask[];
  error?: string;
}> {
  try {
    const { data, error } = await supabaseAdmin
      .from("supaplan_tasks")
      .select("id,title,status,capability,created_at,body,metadata")
      .or("capability.like.franchize.%")
      .neq("status", "done")
      .order("created_at", { ascending: false });

    if (error) throw error;
    if (!data || data.length === 0) return { success: true, data: [] };

    const statusScore: Record<string, number> = {
      open: 10,
      claimed: 7,
      running: 5,
      ready_for_pr: 3,
    };

    const phaseMultiplier: Record<string, number> = {
      "launch-blocker": 2.0,
      "launch-quality": 1.6,
      "security": 1.5,
      "performance": 1.3,
      "polishing": 1.2,
      "ux-fix": 1.2,
      "seo": 1.1,
      "code-quality": 1.0,
      "tech-debt": 0.8,
      "post-launch": 0.7,
    };

    const capabilityImportance: Record<string, number> = {
      "franchize.rental": 1.4,
      "franchize.backend.supabase": 1.4,
      "franchize.ui.ux": 1.8,
      "franchize.finance": 1.3,
      "franchize.security": 1.5,
      "franchize.performance": 1.2,
      "franchize.code-quality": 1.0,
      "franchize.accessibility": 0.9,
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

    const priorityTextMultiplier: Record<string, number> = {
      critical: 2.5,
      high: 2.0,
      medium: 1.5,
      low: 1.0,
    };

    const scored = data.map((task: any) => {
      const base = statusScore[task.status] || 0;
      const capability = task.capability || "";
      const capWeight = capabilityImportance[capability] || 1.0;

      // metadata parsing
      let metaPhase = "";
      let metaPriorityText = "";
      let estimatedHours = 0;
      if (task.metadata) {
        try {
          const meta = typeof task.metadata === "string" ? JSON.parse(task.metadata) : task.metadata;
          metaPhase = meta.phase || "";
          metaPriorityText = (meta.priority || "").toLowerCase();
          estimatedHours = Number(meta.estimated_hours) || 0;
        } catch {}
      }

      // body parsing for p0/p1/p2
      let bodyPriorityTag = "";
      if (task.body) {
        try {
          const bodyObj = typeof task.body === "string" ? JSON.parse(task.body) : task.body;
          if (bodyObj && typeof bodyObj === "object" && bodyObj.priority) {
            bodyPriorityTag = String(bodyObj.priority).toLowerCase();
          }
        } catch {}
      }

      // Phase multiplier
      const phaseKey = metaPhase || "";
      const phaseMult = phaseMultiplier[phaseKey] || 1.0;

      // Priority multiplier: take strongest from text or tag
      let priorityMult = 1.0;
      let priorityLabel = "";
      const fromTag = bodyPriorityTag === "p0" ? 2.5 : bodyPriorityTag === "p1" ? 2.0 : bodyPriorityTag === "p2" ? 1.5 : 0;
      const fromText = priorityTextMultiplier[metaPriorityText] || 0;
      const maxPriority = Math.max(fromTag, fromText, 1.0);
      if (maxPriority > 1.0) {
        priorityMult = maxPriority;
        priorityLabel = fromTag >= maxPriority ? ` ${bodyPriorityTag.toUpperCase()}` : ` ${metaPriorityText}`;
      }

      // Freshness boost
      const ageDays = (Date.now() - new Date(task.created_at).getTime()) / (1000 * 60 * 60 * 24);
      let freshnessMult = 1.0;
      let freshnessLabel = "";
      if (ageDays <= 2) {
        freshnessMult = 2.0;
        freshnessLabel = "новое (≤2 дн)";
      } else if (ageDays <= 7) {
        freshnessMult = 1.5;
        freshnessLabel = "свежее (≤7 дн)";
      } else if (ageDays > 30) {
        freshnessMult = 0.8;
        freshnessLabel = "старое (>30 дн)";
      }

      // Quick win bonus
      let quickWinBonus = 0;
      let quickWinLabel = "";
      if (estimatedHours > 0 && estimatedHours <= 4) {
        quickWinBonus = 1.0;
        quickWinLabel = "quick win";
      }

      const total =
        base * capWeight * phaseMult * priorityMult * freshnessMult + quickWinBonus;

      let reasoning = `${base} × cap:${capWeight} × phase:"${phaseKey}"${phaseMult}`;
      if (priorityLabel) reasoning += ` × приоритет:${priorityLabel}(${priorityMult})`;
      if (freshnessLabel) reasoning += ` × ${freshnessLabel}(${freshnessMult})`;
      if (quickWinBonus) reasoning += ` + ${quickWinBonus} (${quickWinLabel})`;

      return { ...task, score: Math.round(total * 10) / 10, reasoning };
    });

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