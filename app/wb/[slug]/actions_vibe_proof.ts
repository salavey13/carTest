"use server";

import { supabaseAdmin } from "@/hooks/supabase";

/**
 * Генерирует "Доказательство работы" (Proof of Work)
 * Считает GV и RUB на основе сырых логов из смен, а не из счетчиков.
 */
export async function verifyVibeMining(userId: string, crewId: string, days = 1) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const { data: shifts } = await supabaseAdmin
    .from('crew_member_shifts')
    .select('actions')
    .eq('member_id', userId)
    .eq('crew_id', crewId)
    .gte('clock_in_time', startDate.toISOString());

  let offloadTotal = 0;
  let onloadTotal = 0;

  shifts?.forEach(shift => {
    const actions = (shift.actions as any[]) || [];
    actions.forEach(action => {
      if (action.type === 'offload') offloadTotal += Math.abs(action.qty || 0);
      if (action.type === 'onload') onloadTotal += Math.abs(action.qty || 0);
    });
  });

  // Математика Системы:
  const calculatedSalary = offloadTotal * 50; // Например, 50р за выгрузку
  const calculatedGV = (offloadTotal * 7) + (onloadTotal * 3);
  const squadTax = Math.floor(calculatedSalary * 0.13);

  return {
    success: true,
    proof: {
      offloadTotal,
      onloadTotal,
      calculatedSalary,
      calculatedGV,
      squadTax,
      verified_at: new Date().toISOString()
    }
  };
}