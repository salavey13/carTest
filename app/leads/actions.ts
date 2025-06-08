"use server";

import { supabaseAdmin } from '@/hooks/supabase'; 
import type { Database } from "@/types/database.types";
import Papa from 'papaparse';
import * as cheerio from 'cheerio';

type LeadInsert = Database["public"]["Tables"]["leads"]["Insert"];
type LeadRow = Database["public"]["Tables"]["leads"]["Row"];
type UserRole = Database["public"]["Tables"]["users"]["Row"]["role"];

interface CsvLeadRow {
  client_name?: string;
  kwork_url?: string; 
  project_description: string; 
  budget_range?: string;
  deadline_info?: string; 
  client_kwork_history?: string; 
  current_kwork_offers_count?: string; 
  raw_html_description?: string;
  generated_offer?: string;
  identified_tweaks?: string; 
  missing_features?: string; 
  status?: string;
  source?: string;
  initial_relevance_score?: string; 
  project_type_guess?: string; 
}

async function verifyUserPermissions(userId: string, allowedRoles: UserRole[], allowedStatuses: string[] = ['admin']): Promise<boolean> {
  if (!userId) return false;
  if (!supabaseAdmin) {
    console.error("[LeadsActions verifyUserPermissions] Supabase admin client is not available.");
    return false;
  }
  try {
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('role, status')
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error(`[LeadsActions verifyUserPermissions] Error fetching user ${userId}: ${error.message}`);
      return false;
    }
    if (!user) {
      console.warn(`[LeadsActions verifyUserPermissions] User ${userId} not found.`);
      return false;
    }
    const statusMatch = allowedStatuses.includes(user.status || '');
    const roleMatch = user.role ? allowedRoles.includes(user.role) : false;
    
    return statusMatch || roleMatch;
  } catch (e: any) {
    console.error(`[LeadsActions verifyUserPermissions] Exception for ${userId}:`, e.message);
    return false;
  }
}

export async function uploadLeadsFromCsv(
  csvContent: string,
  currentUserId: string 
): Promise<{ success: boolean; message: string; insertedCount?: number; updatedCount?: number; errors?: string[] }> {
  
  const canUpload = await verifyUserPermissions(currentUserId, ['support' as UserRole], ['admin']);
  if (!canUpload) {
    return { success: false, message: "Ошибка: У вас нет прав для выполнения этой операции (только Саппорт или Админ)." };
  }

  if (!csvContent || !csvContent.trim()) {
    return { success: false, message: "Ошибка: CSV данные отсутствуют." };
  }
  if (!supabaseAdmin) {
    console.error("[LeadsActions uploadLeadsFromCsv] Supabase admin client is not available.");
    return { success: false, message: "Ошибка: Клиент базы данных недоступен." };
  }

  try {
    const parseResult = Papa.parse<CsvLeadRow>(csvContent.trim(), {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: header => {
        const trimmedHeader = header.trim().toLowerCase();
        if (trimmedHeader === 'kwork_url') return 'lead_url'; 
        if (trimmedHeader === 'initial_relevance_score') return 'similarity_score';
        return trimmedHeader; 
      },
      transform: (value, header) => {
        const trimmedValue = typeof value === 'string' ? value.trim() : value;
        if (header === 'similarity_score') { 
          const num = parseFloat(trimmedValue as string); 
          return isNaN(num) ? null : num;
        }
        return trimmedValue;
      }
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
      const getRowVal = (key: keyof CsvLeadRow | 'lead_url' | 'similarity_score') => (row as any)[key.toLowerCase()]; 
      const leadUrlFromCsv = getRowVal('lead_url');

      if (!getRowVal('project_description')) {
        localErrors.push(`Пропущена строка: отсутствует 'project_description'. URL: ${leadUrlFromCsv || 'N/A'}`);
        continue;
      }
      
      let tweaksJson: any = null;
      const identifiedTweaksCsv = getRowVal('identified_tweaks');
      if (identifiedTweaksCsv && typeof identifiedTweaksCsv === 'string') {
        try { tweaksJson = JSON.parse(identifiedTweaksCsv); }
        catch (e) { localErrors.push(`Ошибка парсинга JSON для 'identified_tweaks' в лиде с URL ${leadUrlFromCsv}: ${(e as Error).message}`); }
      } else if (typeof identifiedTweaksCsv === 'object') { 
        tweaksJson = identifiedTweaksCsv;
      }

      let featuresJson: any = null;
      const missingFeaturesCsv = getRowVal('missing_features');
      if (missingFeaturesCsv && typeof missingFeaturesCsv === 'string') {
        try { featuresJson = JSON.parse(missingFeaturesCsv); }
        catch (e) { localErrors.push(`Ошибка парсинга JSON для 'missing_features' в лиде с URL ${leadUrlFromCsv}: ${(e as Error).message}`); }
      } else if (typeof missingFeaturesCsv === 'object') {
        featuresJson = missingFeaturesCsv;
      }
      
      const leadEntry: LeadInsert = {
        client_name: getRowVal('client_name') || null,
        lead_url: leadUrlFromCsv || null, 
        project_description: getRowVal('project_description')!, 
        budget_range: getRowVal('budget_range') || null,
        raw_html_description: getRowVal('raw_html_description') || null,
        generated_offer: getRowVal('generated_offer') || null,
        identified_tweaks: tweaksJson,
        missing_features: featuresJson,
        status: getRowVal('status') || 'raw_data', 
        source: getRowVal('source') || 'csv_upload',
        similarity_score: typeof getRowVal('similarity_score') === 'number' ? getRowVal('similarity_score') : null, 
        project_type_guess: getRowVal('project_type_guess') || null, 
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
      console.error("[LeadsActions uploadLeadsFromCsv] Ошибка загрузки/обновления лидов в Supabase:", error);
      return { success: false, message: `Ошибка базы данных: ${error.message}`, errors: localErrors };
    }

    const actualUpsertedCount = count ?? 0;
    
    let message = `Успешно вставлено/обновлено ${actualUpsertedCount} из ${leadsToUpsert.length} валидных лидов. Всего строк в CSV: ${parseResult.data.length}.`;

    if (actualUpsertedCount === 0 && leadsToUpsert.length > 0 && !error) {
      message = `Обработано ${leadsToUpsert.length} валидных лидов. ${localErrors.length > 0 ? `Обнаружено ${localErrors.length} ошибок в CSV. ` : ''}0 лидов было вставлено или обновлено (возможно, все уже существовали и не требовали обновления). Всего строк в CSV: ${parseResult.data.length}.`;
    } else if (localErrors.length > 0) {
        message += ` Обнаружено ${localErrors.length} ошибок в CSV.`;
    }
    
    console.log(`[LeadsActions uploadLeadsFromCsv] ${message}`);
    return { 
        success: true, 
        message, 
        insertedCount: actualUpsertedCount,
        errors: localErrors.length > 0 ? localErrors : undefined 
    };

  } catch (error: any) {
    console.error('[LeadsActions uploadLeadsFromCsv] Критическая ошибка:', error.message);
    return { success: false, message: error.message || 'Неожиданная серверная ошибка.' };
  }
}

export async function updateLeadStatus(
  leadId: string, 
  newStatus: string,
  currentUserId: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  
  const { data: leadData, error: leadError } = await supabaseAdmin.from('leads').select('assigned_to_tank, assigned_to_carry, assigned_to_support').eq('id', leadId).single();
  let canUpdate = false;
  if (leadError) {
      console.error(`[LeadsActions updateLeadStatus] Lead ${leadId} not found: ${leadError.message}`);
      canUpdate = await verifyUserPermissions(currentUserId, ['support' as UserRole], ['admin']);
      if (!canUpdate) return { success: false, message: "Ошибка: Лид не найден и нет прав на создание." };
  } else if (leadData) {
    const assignedTank = leadData.assigned_to_tank === currentUserId;
    const assignedCarry = leadData.assigned_to_carry === currentUserId;
    const assignedSupport = leadData.assigned_to_support === currentUserId;
    
    const assignedRoles: UserRole[] = [];
    if (assignedTank) assignedRoles.push('tank');
    if (assignedCarry) assignedRoles.push('carry');
    if (assignedSupport) assignedRoles.push('support');

    canUpdate = await verifyUserPermissions(currentUserId, ['support' as UserRole, ...assignedRoles], ['admin']);
  }
  
  if (!canUpdate) {
    return { success: false, message: "Ошибка: Недостаточно прав для обновления статуса этого лида." };
  }
  if (!supabaseAdmin) {
    console.error("[LeadsActions updateLeadStatus] Клиент БД не инициализирован");
    return { success: false, error: "Клиент БД не инициализирован" };
  }

  try {
    const { error } = await supabaseAdmin
      .from('leads')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', leadId);

    if (error) {
      console.error(`[LeadsActions updateLeadStatus] Ошибка обновления статуса лида ${leadId}:`, error);
      return { success: false, message: `Ошибка БД: ${error.message}` };
    }
    const successMsg = `Статус лида ${leadId.substring(0,8)}... обновлен на '${newStatus}'.`;
    console.log(`[LeadsActions updateLeadStatus] ${successMsg}`);
    return { success: true, message: successMsg };
  } catch (error: any) {
    console.error('[LeadsActions updateLeadStatus] Критическая ошибка:', error.message);
    return { success: false, message: error.message || 'Неожиданная серверная ошибка.' };
  }
}

export async function assignLead(
  leadId: string,
  assigneeType: 'tank' | 'carry' | 'support',
  assigneeId: string | null, 
  currentUserId: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  const canAssign = await verifyUserPermissions(currentUserId, ['support' as UserRole], ['admin']);
  if (!canAssign) {
    return { success: false, message: "Ошибка: Только Саппорт или Админ могут назначать ответственных." };
  }
   if (!supabaseAdmin) {
    console.error("[LeadsActions assignLead] Клиент БД не инициализирован");
    return { success: false, error: "Клиент БД не инициализирован" };
  }

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
      console.error(`[LeadsActions assignLead] Ошибка назначения лида ${leadId} на ${assigneeType} ${assigneeId}:`, error);
      return { success: false, message: `Ошибка БД: ${error.message}` };
    }
    const successMsg = `Лид ${leadId.substring(0,8)}... ${assigneeId ? `назначен на ${assigneeType} ${(assigneeId).substring(0,8)}...` : `снят с назначения ${assigneeType}`}.`;
    console.log(`[LeadsActions assignLead] ${successMsg}`);
    return { success: true, message: successMsg };
  } catch (error: any) {
    console.error('[LeadsActions assignLead] Критическая ошибка:', error.message);
    return { success: false, message: error.message || 'Неожиданная серверная ошибка.' };
  }
}

export async function fetchLeadsForDashboard(
  currentUserId: string,
  filter: 'all' | 'my' | 'support' | 'tank' | 'carry' | 'new' | 'in_progress' | 'interested' | string 
): Promise<{ success: boolean; data?: LeadRow[]; error?: string }> {
  if (!supabaseAdmin) {
    console.error("[LeadsActions fetchLeadsForDashboard] Клиент БД не инициализирован");
    return { success: false, error: "Клиент БД не инициализирован" };
  }

  try {
    const { data: currentUserData, error: userError } = await supabaseAdmin
      .from('users')
      .select('role, status')
      .eq('user_id', currentUserId)
      .single();

    if (userError || !currentUserData) {
      console.error(`[LeadsActions fetchLeadsForDashboard] Ошибка получения данных пользователя ${currentUserId}: ${userError?.message || 'Пользователь не найден'}`);
      return { success: false, error: "Не удалось получить данные пользователя." };
    }

    const { role: currentUserRole, status: currentUserStatus } = currentUserData;
    let query = supabaseAdmin.from('leads').select('*').order('created_at', { ascending: false });

    const predefinedFilters = ['all', 'my', 'support', 'tank', 'carry', 'new', 'in_progress', 'interested'];

    if (predefinedFilters.includes(filter)) {
      if (currentUserStatus === 'admin' || currentUserRole === 'support') {
        if (filter === 'tank') query = query.neq('assigned_to_tank', null);
        else if (filter === 'carry') query = query.neq('assigned_to_carry', null);
        else if (filter === 'support' && currentUserRole === 'support') query = query.eq('assigned_to_support', currentUserId); 
        else if (filter === 'support' && currentUserStatus === 'admin') query = query.neq('assigned_to_support', null); 
        else if (['new', 'in_progress', 'interested'].includes(filter)) query = query.eq('status', filter);
        else if (filter === 'my' && currentUserRole === 'support') query = query.eq('assigned_to_support', currentUserId);
        else if (filter === 'my' && currentUserStatus === 'admin') { 
          query = query.or(`assigned_to_tank.eq.${currentUserId},assigned_to_carry.eq.${currentUserId},assigned_to_support.eq.${currentUserId}`);
        }
      } else if (currentUserRole === 'tank') {
        query = query.eq('assigned_to_tank', currentUserId);
        if (['new', 'in_progress', 'interested'].includes(filter) && filter !== 'all' && filter !== 'my') query = query.eq('status', filter);
      } else if (currentUserRole === 'carry') {
        query = query.eq('assigned_to_carry', currentUserId);
        if (['new', 'in_progress', 'interested'].includes(filter) && filter !== 'all' && filter !== 'my') query = query.eq('status', filter);
      } 
    } else {
      query = query.ilike('client_name', filter.trim()); 
    }
    
    const { data, error } = await query;

    if (error) {
      console.error("[LeadsActions fetchLeadsForDashboard] Ошибка загрузки лидов:", error);
      return { success: false, error: `Ошибка БД: ${error.message}` };
    }
    
    console.log(`[LeadsActions fetchLeadsForDashboard] Fetched ${data?.length || 0} leads with filter: ${filter}`);
    return { success: true, data: data || [] };

  } catch (error: any) {
    console.error('[LeadsActions fetchLeadsForDashboard] Критическая ошибка:', error.message);
    return { success: false, error: error.message || 'Неожиданная серверная ошибка.' };
  }
}

export async function fetchLeadByIdentifierOrNickname(
  identifierOrNickname: string,
  currentUserId: string 
): Promise<{ success: boolean; data?: LeadRow; error?: string }> {
  if (!supabaseAdmin) {
    console.error("[LeadsActions fetchLeadByIdentifierOrNickname] Клиент БД не инициализирован");
    return { success: false, error: "Клиент БД не инициализирован" };
  }
  if (!identifierOrNickname) {
    return { success: false, error: "Идентификатор или никнейм лида не указан." };
  }

  try {
    let query = supabaseAdmin.from('leads').select('*').eq('id', identifierOrNickname).maybeSingle();
    let { data, error } = await query;

    if (error && error.code !== 'PGRST116') { 
      console.error(`[LeadsActions fetchLeadByIdentifierOrNickname] Ошибка поиска по ID ${identifierOrNickname}:`, error);
      return { success: false, error: `Ошибка БД при поиске по ID: ${error.message}` };
    }

    if (data) {
      console.log(`[LeadsActions fetchLeadByIdentifierOrNickname] Лид найден по ID: ${identifierOrNickname}`);
      return { success: true, data };
    }

    console.log(`[LeadsActions fetchLeadByIdentifierOrNickname] Лид по ID ${identifierOrNickname} не найден, ищем по client_name (никнейму).`);
    query = supabaseAdmin.from('leads').select('*').ilike('client_name', identifierOrNickname).maybeSingle();
    ({ data, error } = await query);

    if (error && error.code !== 'PGRST116') {
      console.error(`[LeadsActions fetchLeadByIdentifierOrNickname] Ошибка поиска по никнейму ${identifierOrNickname}:`, error);
      return { success: false, error: `Ошибка БД при поиске по никнейму: ${error.message}` };
    }

    if (data) {
      console.log(`[LeadsActions fetchLeadByIdentifierOrNickname] Лид найден по никнейму: ${identifierOrNickname}`);
      return { success: true, data };
    }

    console.warn(`[LeadsActions fetchLeadByIdentifierOrNickname] Лид с идентификатором/никнеймом '${identifierOrNickname}' не найден.`);
    return { success: false, error: `Лид '${identifierOrNickname}' не найден.` };

  } catch (e: any) {
    console.error(`[LeadsActions fetchLeadByIdentifierOrNickname] Критическая ошибка для '${identifierOrNickname}':`, e.message);
    return { success: false, error: e.message || 'Неожиданная серверная ошибка при поиске лида.' };
  }
}


export async function scrapePageContent(
  targetUrl: string
): Promise<{ success: boolean; content?: string; error?: string }> {
  if (!targetUrl || typeof targetUrl !== 'string' || !targetUrl.trim()) {
    console.warn(`[Scraper Action] Попытка скрейпинга с невалидным URL: ${targetUrl}`);
    return { success: false, error: "URL не указан или имеет неверный формат." };
  }
  
  const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
  console.log(`[Scraper Action] Запрос на скрейпинг URL: ${targetUrl} с User-Agent: ${userAgent}`);

  try {
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      signal: AbortSignal.timeout(20000), 
    });
    console.log(`[Scraper Action] Получен ответ от ${targetUrl}. Статус: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Не удалось прочитать тело ошибки");
      console.error(`[Scraper Action] Ошибка HTTP: ${response.status} ${response.statusText} для URL: ${targetUrl}. Тело ответа (если есть): ${errorText.substring(0,500)}`);
      return { success: false, error: `Ошибка HTTP: ${response.status} ${response.statusText}` };
    }

    const html = await response.text();
    console.log(`[Scraper Action] HTML получен, длина: ${html.length}. Начинаю парсинг Cheerio.`);
    const $ = cheerio.load(html);
    
    console.log(`[Scraper Action] HTML перед удалением элементов (первые 500 симв.): ${$('body').html()?.substring(0,500)}`);
    $('script, style, noscript, nav, footer, header, aside, form, button, input, textarea, select, iframe, link[rel="stylesheet"], meta, svg, path, img, figure, dialog, [role="dialog"], [aria-hidden="true"]').remove();
    $('[class*="cookie"], [id*="cookie"], [class*="banner"], [id*="banner"], [class*="popup"], [id*="popup"], [class*="modal"], [id*="modal"]').remove();
    console.log(`[Scraper Action] Ненужные элементы удалены.`);

    const contentSelectors = [
      'article', '.article-content', '.entry-content', '.post-body', '.post-content', 
      'main[role="main"]', 'main', 
      '.project-description', '.task__description', '.job-description', '.vacancy-description', 
      '.product-description', '[itemprop="description"]', 
      '.text-content', '.content-text', '.article-text', 
      '.job_show_description', '.b-description__text', 
      '.page-content', '.content', '#content', '.main-content', '#main-content', 
      'section', 
    ];
    console.log(`[Scraper Action] Поиск основного контента по селекторам: ${contentSelectors.join(', ')}`);

    let $targetElement: cheerio.Cheerio<cheerio.Element> | null = null;
    let maxTextLength = 0;
    let mainContentSelectorUsed = 'body (fallback)';

    for (const selector of contentSelectors) {
        const $candidates = $(selector);
        if ($candidates.length > 0) {
            console.log(`[Scraper Action] Найдены кандидаты по селектору '${selector}': ${$candidates.length} шт.`);
            $candidates.each((_i, el) => {
                const $currentCandidate = $(el);
                const $clone = $currentCandidate.clone();
                $clone.find('script, style, nav, footer, header, aside, form, button, input, textarea, select, iframe, link, meta, svg, img, figure').remove();
                const textSample = $clone.text().replace(/\s\s+/g, ' ').trim();
                
                if (textSample.length > maxTextLength) {
                    maxTextLength = textSample.length;
                    $targetElement = $currentCandidate; 
                    mainContentSelectorUsed = selector;
                    console.log(`[Scraper Action] Новый лучший кандидат по селектору '${selector}', длина текста: ${maxTextLength}`);
                }
            });
        }
    }

    if (!$targetElement || maxTextLength < 100) { 
      $targetElement = $('body');
      mainContentSelectorUsed = 'body (fallback)';
      console.warn(`[Scraper Action] Специфичный контент не найден или слишком мал (maxTextLength: ${maxTextLength}). Используется весь body.`);
    } else {
      console.log(`[Scraper Action] Финально выбран контент по селектору: ${mainContentSelectorUsed}.`);
    }
    
    console.log(`[Scraper Action] HTML выбранного элемента ('${mainContentSelectorUsed}') перед извлечением текста (первые 500 симв.): ${$targetElement.html()?.substring(0,500)}`);
    
    const targetHtmlForText = $targetElement.html() || "";
    const $tempForText = cheerio.load(`<body>${targetHtmlForText}</body>`); 
    
    let extractedTexts: string[] = [];
    $tempForText('body').find('p, div, span, li, td, th, h1, h2, h3, h4, h5, h6, article, section, pre, code, blockquote, strong, em, b, i, u, dd, dt, label, a, .break-words') 
        .each(function() {
            const $this = $(this);
            const elementText = $this.clone().children().remove().end().text().replace(/\s\s+/g, ' ').trim();
            if (elementText) {
                extractedTexts.push(elementText);
            }
        });
    
    console.log(`[Scraper Action] Извлечено ${extractedTexts.length} текстовых фрагментов. Пример: "${extractedTexts.slice(0,5).join(' | ')}"`);
    let textContent = extractedTexts.join(". "); 
    
    console.log(`[Scraper Action] Текст после первичного соединения (до очистки, первые 500 симv.): ${textContent.substring(0,500)}`);
    textContent = textContent
      .replace(/\s\s+/g, ' ')       
      .replace(/\s+\./g, '.')       
      .replace(/\.{2,}/g, '.')      
      .replace(/\s*\.\s*/g, '. ')   
      .replace(/(\r\n|\n|\r)+/gm, " ") 
      .replace(/\s\s+/g, ' ')       
      .trim();
    console.log(`[Scraper Action] Текст после основной очистки (первые 500 симв.): ${textContent.substring(0,500)}`);
    
    const MIN_LINE_LENGTH_FOR_MEANING = 10; 
    const MIN_SIGNIFICANT_CONTENT_LENGTH = 50; 

    const meaningfulLines = textContent.split('.') 
        .map(line => line.trim())
        .filter(line => {
            if (line.length < MIN_LINE_LENGTH_FOR_MEANING) return false;
            return /[a-zA-Zа-яА-Я]{2,}/.test(line) && !/^[^\w\s\p{P}]*$/.test(line.replace(/\s/g, ''));
        })
        .map(line => line.endsWith('.') ? line : line + '.') 
        .join(' ') 
        .trim();
    
    console.log(`[Scraper Action] Текст после фильтрации осмысленных строк (длина: ${meaningfulLines.length}, первые 500 симв.): ${meaningfulLines.substring(0,500)}`);
    textContent = meaningfulLines;

    if (!textContent || textContent.length < MIN_SIGNIFICANT_CONTENT_LENGTH) {
      console.warn(`[Scraper Action] Не удалось извлечь значимый контент (длина ${textContent?.length || 0}) из URL: ${targetUrl}. HTML выбранного элемента: ${$targetElement.html()?.substring(0, 2000)}`);
      return { success: false, error: `Не удалось извлечь контент (длина ${textContent?.length || 0}). Страница может быть пустой, требовать JS или быть honeypot.` };
    }
    
    const MAX_LENGTH = 35000; 
    if (textContent.length > MAX_LENGTH) {
        textContent = textContent.substring(0, MAX_LENGTH) + "\n\n--- СОДЕРЖИМОЕ ОБРЕЗАНО ИЗ-ЗА ПРЕВЫШЕНИЯ ЛИМИТА ---";
        console.warn(`[Scraper Action] Контент с URL ${targetUrl} был обрезан до ${MAX_LENGTH} символов.`);
    }

    console.log(`[Scraper Action] Успешно собран контент с URL: ${targetUrl}. Финальная длина: ${textContent.length}. Фрагмент: ${textContent.substring(0, 200)}...`);
    return { success: true, content: textContent };

  } catch (error: any) {
    console.error(`[Scraper Action] Критическая ошибка при скрейпинге ${targetUrl}: ${error.message}`, error.stack);
    if (error.name === 'AbortError' || error.code === 'UND_ERR_CONNECT_TIMEOUT' || error.message.toLowerCase().includes('timeout')) {
        return { success: false, error: 'Тайм-аут запроса к целевому URL. Сервер не ответил вовремя.' };
    }
    if (error.message.toLowerCase().includes('invalidcharactererror')) { 
        return { success: false, error: 'Ошибка парсинга HTML: невалидный символ. Возможно, проблема с кодировкой страницы.'};
    }
    return { success: false, error: `Ошибка скрейпинга: ${error.message}` };
  }
}

export async function updateUserRole(
  targetUserId: string,
  newRole: UserRole,
  currentUserId: string 
): Promise<{ success: boolean; message?: string; error?: string }> {
  console.log(`[LeadsActions updateUserRole] Attempting to update role for ${targetUserId} to ${newRole} by ${currentUserId}`);

  if (!supabaseAdmin) {
    console.error("[LeadsActions updateUserRole] Supabase admin client is not available.");
    return { success: false, error: "Клиент БД не инициализирован." };
  }

  const isAdmin = await verifyUserPermissions(currentUserId, ['vprAdmin' as UserRole, 'admin' as UserRole], ['admin']);
  
  if (targetUserId === currentUserId && (newRole === 'tank' || newRole === 'support')) {
    // Allowed
  } else if (!isAdmin) { 
      console.warn(`[LeadsActions updateUserRole] User ${currentUserId} (not admin or invalid self-assign) attempted to change role for ${targetUserId} to ${newRole}. Denied.`);
      return { success: false, error: "Недостаточно прав для этой операции." };
  }

  const validRoles: UserRole[] = ['tank', 'support', 'carry', 'guest', 'admin', 'vprAdmin', null];
  if (!validRoles.includes(newRole)) { 
      console.error(`[LeadsActions updateUserRole] Invalid role specified: ${newRole}`);
      return { success: false, error: `Недопустимая роль: ${newRole}.` };
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('users')
      .update({ role: newRole, updated_at: new Date().toISOString() })
      .eq('user_id', targetUserId)
      .select() 
      .single();

    if (error) {
      console.error(`[LeadsActions updateUserRole] Error updating role for user ${targetUserId} to ${newRole}:`, error);
      return { success: false, error: `Ошибка базы данных при обновлении роли: ${error.message}` };
    }

    if (!data) {
      console.warn(`[LeadsActions updateUserRole] User ${targetUserId} not found for role update, or no change made.`);
      return { success: false, error: `Пользователь ${targetUserId} не найден или роль не была изменена.` };
    }

    const successMsg = `Роль пользователя ${targetUserId} (${data.username || 'ID'}) успешно обновлена на '${newRole}'.`;
    console.log(`[LeadsActions updateUserRole] ${successMsg}`);
    return { success: true, message: successMsg };

  } catch (e: any) {
    console.error(`[LeadsActions updateUserRole] Critical error updating role for ${targetUserId}:`, e.message);
    return { success: false, error: `Критическая ошибка сервера: ${e.message}` };
  }
}