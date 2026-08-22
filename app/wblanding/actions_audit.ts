"use server";

import { supabaseAdmin } from "@/lib/supabase-server";

export async function getWarehouseAuditState(userId: string) {
  if (!userId) {
    return { success: false, error: "Missing userId" };
  }

  const { data: progress, error: progressError } = await supabaseAdmin
    .from("audit_progress")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (progressError) {
    return { success: false, error: progressError.message };
  }

  if (progress) {
    const timeDiff = Date.now() - new Date(progress.updated_at).getTime();
    const hoursDiff = timeDiff / (1000 * 60 * 60);

    if (hoursDiff >= 24) {
      await supabaseAdmin.from("audit_progress").delete().eq("user_id", userId);
    }
  }

  const { data: lastAudit, error: auditError } = await supabaseAdmin
    .from("audit_reports")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (auditError) {
    return { success: false, error: auditError.message };
  }

  return {
    success: true,
    progress,
    lastAudit,
  };
}

export async function saveWarehouseAuditProgress(input: {
  userId: string;
  currentStep: number;
  answersSnapshot: Record<string, unknown>;
}) {
  if (!input.userId) return { success: false, error: "Missing userId" };

  const { error } = await supabaseAdmin.from("audit_progress").upsert(
    {
      user_id: input.userId,
      current_step: input.currentStep,
      answers_snapshot: input.answersSnapshot,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: "user_id",
      ignoreDuplicates: false,
    },
  );

  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function clearWarehouseAuditProgress(userId: string) {
  if (!userId) return { success: false, error: "Missing userId" };

  const { error } = await supabaseAdmin.from("audit_progress").delete().eq("user_id", userId);
  if (error) return { success: false, error: error.message };

  return { success: true };
}
