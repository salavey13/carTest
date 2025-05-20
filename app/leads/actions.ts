"use server";

import { supabaseAdmin } from '@/hooks/supabase'; // Используем admin клиент для серверных операций
import type { Database } from "@/types/database.types";
import { logger } from '@/lib/logger';
import Papa from 'papaparse';

type LeadInsert = Database["public"]["Tables"]["leads"]["Insert"];
type LeadRow = Database["public"]["Tables"]["leads"]["Row"];

interface CsvLeadRow {
  client_name?: string;
  kwork_url?: string; // Это будет lead_url в transformHeader
  project_description: string; // Обязательное поле
  budget_range?: string;
  // Поля ниже присутствуют в CSV от AI, но не все есть в таблице `leads`
  deadline_info?: string; 
  client_kwork_history?: string; 
  current_kwork_offers_count?: string; 
  raw_html_description?: string;
  generated_offer?: string;
  identified_tweaks?: string; 
  missing_features?: string; 
  status?: string;
  source?: string;
}

async function verifyUserPermissions(userId: string, allowedRoles: string[], allowedStatuses: string[] = ['admin']): Promise<boolean> {
  if (!userId) return false;
  if (!supabaseAdmin) {
    logger.error("Supabase admin client is not available for permission check.");
    return false;
  }
  try {
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('role, status')
      .eq('user_id', userId)
      .single();

    if (error) {
      logger.error(`Error fetching user ${userId} for permission check: ${error.message}`);
      return false;
    }
    if (!user) {
      logger.warn(`User ${userId} not found for permission check.`);
      return false;
    }
    return allowedStatuses.includes(user.status || '') || allowedRoles.includes(user.role || '');
  } catch (e) {
    logger.error(`Exception during permission check for ${userId}:`, e);
    return false;
  }
}

export async function uploadLeadsFromCsv(
  csvContent: string,
  currentUserId: string 
): Promise<{ success: boolean; message: string; insertedCount?: number; updatedCount?: number; errors?: string[] }> {
  
  const canUpload = await verifyUserPermissions(currentUserId, ['support'], ['admin']);
  if (!canUpload) {
    return { success: false, message: "Ошибка: У вас нет прав для выполнения этой операции (только Саппорт или Админ)." };
  }

  if (!csvContent || !csvContent.trim()) {
    return { success: false, message: "Ошибка: CSV данные отсутствуют." };
  }
  if (!supabaseAdmin) {
    return { success: false, message: "Ошибка: Клиент базы данных недоступен." };
  }

  try {
    const parseResult = Papa.parse<CsvLeadRow>(csvContent.trim(), {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: header => {
        const trimmedHeader = header.trim().toLowerCase();
        if (trimmedHeader === 'kwork_url') return 'lead_url'; // Маппинг для upsert
        return trimmedHeader; // Используем lowercase для сопоставления с CsvLeadRow
      },
      transform: value => (typeof value === 'string' ? value.trim() : value),
    });

    if (parseResult.errors.length > 0) {
      const firstError = parseResult.errors[0];
      return { success: false, message: `Ошибка парсинга CSV (Строка ${firstError.row + 1}): ${firstError.message}. Проверьте формат.` };
    }
    if (!parseResult.data || parseResult.data.length === 0) {
      return { success: false, message: "Ошибка: CSV не содержит данных." };
    }

    const leadsToUpsert: LeadInsert[] = [];
    const localErrors: string[] = [];

    for (const row of parseResult.data) {
      // Используем lowercase ключи из parseResult.meta.fields для доступа к данным строки,
      // так как transformHeader привел их к lowercase.
      // Papa.parse<CsvLeadRow> ожидает, что ключи row будут соответствовать CsvLeadRow.
      // Если transformHeader меняет 'kwork_url' на 'lead_url', то в row будет row.lead_url
      
      const leadUrlFromCsv = row.kwork_url; // Исходное имя из CSV до transformHeader
                                       // или row.lead_url, если Papa.parse типизирует по transformHeader
                                       // Для безопасности, лучше проверить оба или нормализовать ключи row.

      // Нормализуем доступ к полям, если transformHeader не отражается в типизации row
      const getRowVal = (key: keyof CsvLeadRow) => (row as any)[key.toLowerCase()] ?? (row as any)[key];


      if (!getRowVal('project_description')) {
        localErrors.push(`Пропущена строка: отсутствует 'project_description'. URL: ${leadUrlFromCsv || 'N/A'}`);
        continue;
      }
      
      let tweaksJson: any = null;
      const identifiedTweaksCsv = getRowVal('identified_tweaks');
      if (identifiedTweaksCsv) {
        try { tweaksJson = JSON.parse(identifiedTweaksCsv); }
        catch (e) { localErrors.push(`Ошибка парсинга JSON для 'identified_tweaks' в лиде с URL ${leadUrlFromCsv}: ${(e as Error).message}`); }
      }

      let featuresJson: any = null;
      const missingFeaturesCsv = getRowVal('missing_features');
      if (missingFeaturesCsv) {
        try { featuresJson = JSON.parse(missingFeaturesCsv); }
        catch (e) { localErrors.push(`Ошибка парсинга JSON для 'missing_features' в лиде с URL ${leadUrlFromCsv}: ${(e as Error).message}`); }
      }
      
      const leadEntry: LeadInsert = {
        client_name: getRowVal('client_name') || null,
        lead_url: leadUrlFromCsv || null, 
        project_description: getRowVal('project_description')!, // Уверены, что есть из-за проверки выше
        budget_range: getRowVal('budget_range') || null,
        raw_html_description: getRowVal('raw_html_description') || null,
        generated_offer: getRowVal('generated_offer') || null,
        identified_tweaks: tweaksJson,
        missing_features: featuresJson,
        status: getRowVal('status') || 'raw_data', 
        source: getRowVal('source') || 'csv_upload',
      };

      if (leadEntry.lead_url === '') {
        leadEntry.lead_url = null;
      }
      
      leadsToUpsert.push(leadEntry);
    }

    if (leadsToUpsert.length === 0 && localErrors.length > 0) {
        return { success: false, message: "Нет валидных лидов для загрузки.", errors: localErrors };
    }
    if (leadsToUpsert.length === 0) {
        return { success: false, message: "Нет данных для загрузки после обработки CSV."};
    }
    
    const { data: upsertedData, error, count } = await supabaseAdmin
      .from('leads')
      .upsert(leadsToUpsert, { onConflict: 'lead_url', ignoreDuplicates: false }) 
      .select();

    if (error) {
      logger.error("Ошибка загрузки/обновления лидов в Supabase:", error);
      return { success: false, message: `Ошибка базы данных: ${error.message}`, errors: localErrors };
    }

    const actualUpsertedCount = count ?? 0;
    
    let message = `Успешно вставлено/обновлено ${actualUpsertedCount} из ${leadsToUpsert.length} валидных лидов. Всего строк в CSV: ${parseResult.data.length}.`;

    if (actualUpsertedCount === 0 && leadsToUpsert.length > 0 && !error) {
      message = `Обработано ${leadsToUpsert.length} валидных лидов. ${localErrors.length > 0 ? `Обнаружено ${localErrors.length} ошибок в CSV. ` : ''}0 лидов было вставлено или обновлено (возможно, все уже существовали и не требовали обновления). Всего строк в CSV: ${parseResult.data.length}.`;
    } else if (localErrors.length > 0) {
        message += ` Обнаружено ${localErrors.length} ошибок в CSV.`;
    }
    
    logger.info(message);
    return { 
        success: true, 
        message, 
        insertedCount: actualUpsertedCount,
        errors: localErrors.length > 0 ? localErrors : undefined 
    };

  } catch (error) {
    logger.error('Критическая ошибка во время загрузки CSV лидов:', error);
    return { success: false, message: error instanceof Error ? error.message : 'Неожиданная серверная ошибка.' };
  }
}

// Остальные функции (updateLeadStatus, assignLead, fetchLeadsForDashboard) остаются без изменений,
// так как проблема была связана с uploadLeadsFromCsv и форматом CSV.
export async function updateLeadStatus(
  leadId: string, 
  newStatus: string,
  currentUserId: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  
  const { data: leadData, error: leadError } = await supabaseAdmin.from('leads').select('assigned_to_tank, assigned_to_carry, assigned_to_support').eq('id', leadId).single();
  let canUpdate = false;
  if (leadError) {
      logger.error(`Lead ${leadId} not found for status update: ${leadError.message}`);
      canUpdate = await verifyUserPermissions(currentUserId, ['support'], ['admin']);
      if (!canUpdate) return { success: false, message: "Ошибка: Лид не найден и нет прав на создание." };
  } else if (leadData) {
    const assignedTank = leadData.assigned_to_tank === currentUserId;
    const assignedCarry = leadData.assigned_to_carry === currentUserId;
    const assignedSupport = leadData.assigned_to_support === currentUserId;
    
    const assignedRoles: string[] = [];
    if (assignedTank) assignedRoles.push('tank');
    if (assignedCarry) assignedRoles.push('carry');
    if (assignedSupport) assignedRoles.push('support');

    canUpdate = await verifyUserPermissions(currentUserId, ['support', ...assignedRoles], ['admin']);
  }
  
  if (!canUpdate) {
    return { success: false, message: "Ошибка: Недостаточно прав для обновления статуса этого лида." };
  }
  if (!supabaseAdmin) return { success: false, error: "Клиент БД не инициализирован" };

  try {
    const { error } = await supabaseAdmin
      .from('leads')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', leadId);

    if (error) {
      logger.error(`Ошибка обновления статуса лида ${leadId}:`, error);
      return { success: false, message: `Ошибка БД: ${error.message}` };
    }
    const successMsg = `Статус лида ${leadId.substring(0,8)}... обновлен на '${newStatus}'.`;
    logger.info(successMsg);
    return { success: true, message: successMsg };
  } catch (error) {
    logger.error('Критическая ошибка при обновлении статуса лида:', error);
    return { success: false, message: error instanceof Error ? error.message : 'Неожиданная серверная ошибка.' };
  }
}

export async function assignLead(
  leadId: string,
  assigneeType: 'tank' | 'carry' | 'support',
  assigneeId: string | null, 
  currentUserId: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  const canAssign = await verifyUserPermissions(currentUserId, ['support'], ['admin']);
  if (!canAssign) {
    return { success: false, message: "Ошибка: Только Саппорт или Админ могут назначать ответственных." };
  }
   if (!supabaseAdmin) return { success: false, error: "Клиент БД не инициализирован" };

  try {
    const updatePayload: Partial<LeadInsert> = { updated_at: new Date().toISOString() };
    if (assigneeType === 'tank') updatePayload.assigned_to_tank = assigneeId;
    else if (assigneeType === 'carry') updatePayload.assigned_to_carry = assigneeId;
    else if (assigneeType === 'support') updatePayload.assigned_to_support = assigneeId;
    else return { success: false, message: "Ошибка: Неверный тип ответственного."};

    const { error } = await supabaseAdmin
      .from('leads')
      .update(updatePayload)
      .eq('id', leadId);

    if (error) {
      logger.error(`Ошибка назначения лида ${leadId} на ${assigneeType} ${assigneeId}:`, error);
      return { success: false, message: `Ошибка БД: ${error.message}` };
    }
    const successMsg = `Лид ${leadId.substring(0,8)}... ${assigneeId ? `назначен на ${assigneeType} ${(assigneeId).substring(0,8)}...` : `снят с назначения ${assigneeType}`}.`;
    logger.info(successMsg);
    return { success: true, message: successMsg };
  } catch (error) {
    logger.error('Критическая ошибка при назначении лида:', error);
    return { success: false, message: error instanceof Error ? error.message : 'Неожиданная серверная ошибка.' };
  }
}

export async function fetchLeadsForDashboard(
  currentUserId: string,
  filter: 'all' | 'my' | 'support' | 'tank' | 'carry' | 'new' | 'in_progress' | 'interested' 
): Promise<{ success: boolean; data?: LeadRow[]; error?: string }> {
  if (!supabaseAdmin) return { success: false, error: "Клиент БД не инициализирован" };

  try {
    const { data: currentUserData, error: userError } = await supabaseAdmin
      .from('users')
      .select('role, status')
      .eq('user_id', currentUserId)
      .single();

    if (userError || !currentUserData) {
      logger.error(`Ошибка получения данных пользователя ${currentUserId} для дашборда: ${userError?.message || 'Пользователь не найден'}`);
      return { success: false, error: "Не удалось получить данные пользователя." };
    }

    const { role: currentUserRole, status: currentUserStatus } = currentUserData;
    let query = supabaseAdmin.from('leads').select('*').order('created_at', { ascending: false });

    if (currentUserStatus === 'admin' || currentUserRole === 'support') {
      if (filter === 'tank') query = query.neq('assigned_to_tank', null);
      else if (filter === 'carry') query = query.neq('assigned_to_carry', null);
      else if (filter === 'support' && currentUserRole === 'support') query = query.eq('assigned_to_support', currentUserId); // Саппорт видит свои назначенные
      else if (filter === 'support' && currentUserStatus === 'admin') query = query.neq('assigned_to_support', null); // Админ видит все где есть саппорт
      else if (['new', 'in_progress', 'interested'].includes(filter)) query = query.eq('status', filter);
      else if (filter === 'my' && currentUserRole === 'support') query = query.eq('assigned_to_support', currentUserId);
    } else if (currentUserRole === 'tank') {
      query = query.eq('assigned_to_tank', currentUserId);
      if (['new', 'in_progress', 'interested'].includes(filter) && filter !== 'all' && filter !== 'my') query = query.eq('status', filter);
    } else if (currentUserRole === 'carry') {
      query = query.eq('assigned_to_carry', currentUserId);
      if (['new', 'in_progress', 'interested'].includes(filter) && filter !== 'all' && filter !== 'my') query = query.eq('status', filter);
    } else {
      return { success: true, data: [] };
    }
    
    const { data, error } = await query;

    if (error) {
      logger.error("Ошибка загрузки лидов для дашборда:", error);
      return { success: false, error: `Ошибка БД: ${error.message}` };
    }
    
    return { success: true, data: data || [] };

  } catch (error) {
    logger.error('Критическая ошибка при загрузке лидов для дашборда:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Неожиданная серверная ошибка.' };
  }
}