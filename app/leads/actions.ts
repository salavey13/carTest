"use server";

import { supabaseAdmin } from '@/hooks/supabase'; // Используем admin клиент для серверных операций
import type { Database } from "@/types/database.types";
import { logger } from '@/lib/logger';
import Papa from 'papaparse';

type LeadInsert = Database["public"]["Tables"]["leads"]["Insert"];
type LeadRow = Database["public"]["Tables"]["leads"]["Row"];

interface CsvLeadRow {
  client_name?: string;
  kwork_url?: string;
  project_description: string; // Обязательное поле
  budget_range?: string;
  deadline_info?: string;
  client_kwork_history?: string;
  current_kwork_offers_count?: string;
  raw_html_description?: string;
  generated_offer?: string;
  identified_tweaks?: string; // Предполагаем, что это строка JSON
  missing_features?: string; // Предполагаем, что это строка JSON
  status?: string; // Добавим статус из CSV, если есть
  source?: string; // Добавим источник из CSV
  // Другие поля из твоего CSV, если есть
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
  currentUserId: string // ID пользователя, выполняющего действие
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
      transformHeader: header => header.trim(),
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
      if (!row.project_description) {
        localErrors.push(`Пропущена строка: отсутствует 'project_description'. URL: ${row.kwork_url || 'N/A'}`);
        continue;
      }
      
      let tweaksJson: any = null;
      if (row.identified_tweaks) {
        try { tweaksJson = JSON.parse(row.identified_tweaks); }
        catch (e) { localErrors.push(`Ошибка парсинга JSON для 'identified_tweaks' в лиде с URL ${row.kwork_url}: ${(e as Error).message}`); }
      }

      let featuresJson: any = null;
      if (row.missing_features) {
        try { featuresJson = JSON.parse(row.missing_features); }
        catch (e) { localErrors.push(`Ошибка парсинга JSON для 'missing_features' в лиде с URL ${row.kwork_url}: ${(e as Error).message}`); }
      }

      leadsToUpsert.push({
        client_name: row.client_name || null,
        lead_url: row.kwork_url || null, // Должен быть UNIQUE, если не NULL
        project_description: row.project_description,
        budget_range: row.budget_range || null,
        deadline_info: row.deadline_info || null,
        client_kwork_history: row.client_kwork_history || null,
        current_kwork_offers_count: row.current_kwork_offers_count || null,
        raw_html_description: row.raw_html_description || null,
        generated_offer: row.generated_offer || null,
        identified_tweaks: tweaksJson,
        missing_features: featuresJson,
        status: row.status || 'raw_data', // Если статус приходит из CSV
        source: row.source || 'csv_upload', // Можно добавить колонку source в CSV
        // assigned_to_support: currentUserId, // Автоматически назначаем Саппорту, который загрузил
      });
    }

    if (leadsToUpsert.length === 0 && localErrors.length > 0) {
        return { success: false, message: "Нет валидных лидов для загрузки.", errors: localErrors };
    }
    if (leadsToUpsert.length === 0) {
        return { success: false, message: "Нет данных для загрузки после обработки CSV."};
    }

    // Используем onConflict для обновления, если lead_url уже существует
    const { data, error, count } = await supabaseAdmin
      .from('leads')
      .upsert(leadsToUpsert, { onConflict: 'lead_url', ignoreDuplicates: false }) // ignoreDuplicates: false чтобы count отражал кол-во затронутых строк
      .select();

    if (error) {
      logger.error("Ошибка загрузки/обновления лидов в Supabase:", error);
      return { success: false, message: `Ошибка базы данных: ${error.message}`, errors: localErrors };
    }

    const message = `Успешно обработано ${count || 0} из ${parseResult.data.length} лидов. ${localErrors.length > 0 ? `Обнаружено ${localErrors.length} ошибок в CSV.` : '' }`;
    logger.info(message);
    return { success: true, message, insertedCount: count || 0, errors: localErrors.length > 0 ? localErrors : undefined };

  } catch (error) {
    logger.error('Критическая ошибка во время загрузки CSV лидов:', error);
    return { success: false, message: error instanceof Error ? error.message : 'Неожиданная серверная ошибка.' };
  }
}

export async function updateLeadStatus(
  leadId: string, 
  newStatus: string,
  currentUserId: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  
  const lead = await supabaseAdmin.from('leads').select('assigned_to_tank, assigned_to_carry, assigned_to_support').eq('id', leadId).single();
  let canUpdate = false;
  if (lead.data) {
    canUpdate = await verifyUserPermissions(currentUserId, 
        (lead.data.assigned_to_tank === currentUserId && ['tank']) || 
        (lead.data.assigned_to_carry === currentUserId && ['carry']) || 
        (lead.data.assigned_to_support === currentUserId && ['support']) || 
        ['support'] // Саппорт может менять статус любого лида
    , ['admin']);
  } else {
     canUpdate = await verifyUserPermissions(currentUserId, ['support'], ['admin']); // Если лид не найден, только админ/саппорт могут создать его через этот путь (маловероятно)
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
  assigneeId: string | null, // null для снятия назначения
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
    const successMsg = `Лид ${leadId.substring(0,8)}... ${assigneeId ? `назначен на ${assigneeType} ${assigneeId.substring(0,8)}...` : `снят с назначения ${assigneeType}`}.`;
    logger.info(successMsg);
    return { success: true, message: successMsg };
  } catch (error) {
    logger.error('Критическая ошибка при назначении лида:', error);
    return { success: false, message: error instanceof Error ? error.message : 'Неожиданная серверная ошибка.' };
  }
}


export async function fetchLeadsForDashboard(
  currentUserId: string,
  filter: 'all' | 'my' | 'support' | 'tank' | 'carry' // Добавил 'my' для универсальности
): Promise<{ success: boolean; data?: LeadRow[]; error?: string }> {
  if (!supabaseAdmin) return { success: false, error: "Клиент БД не инициализирован" };

  try {
    // Сначала получаем роль и статус текущего пользователя
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
      // Админы и Саппорты видят все или отфильтрованные по роли других
      if (filter === 'tank') query = query.neq('assigned_to_tank', null); // Показываем все, где есть назначенный танк
      else if (filter === 'carry') query = query.neq('assigned_to_carry', null); // Показываем все, где есть назначенный кэрри
      // 'all' и 'support' для них означают все лиды
    } else if (currentUserRole === 'tank') {
      // Танки видят только свои лиды
      query = query.eq('assigned_to_tank', currentUserId);
    } else if (currentUserRole === 'carry') {
      // Кэрри видят только свои лиды
      query = query.eq('assigned_to_carry', currentUserId);
    } else {
      // Другие роли (или если роль не определена) не видят ничего, кроме своих (если есть такой фильтр)
       if (filter === 'my') { // Общий фильтр "мои", если вдруг понадобится
         query = query.or(`assigned_to_tank.eq.${currentUserId},assigned_to_carry.eq.${currentUserId},assigned_to_support.eq.${currentUserId}`);
       } else {
        return { success: true, data: [] }; // По умолчанию ничего не показываем
       }
    }
    
    // Применяем общий фильтр, если он не 'all' и пользователь не админ/саппорт (для которых 'all' уже применен)
    if (filter !== 'all' && !(currentUserStatus === 'admin' || currentUserRole === 'support')) {
        if (filter === 'support' && currentUserRole === 'support') query = query.eq('assigned_to_support', currentUserId);
        // Фильтры 'tank' и 'carry' уже применены выше для соответствующих ролей
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