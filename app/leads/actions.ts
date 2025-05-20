"use server";

import { supabaseAdmin } from '@/hooks/supabase'; // Используем admin клиент для серверных операций
import type { Database } from "@/types/database.types";
import { logger } from '@/lib/logger';
import Papa from 'papaparse';
import * as cheerio from 'cheerio';

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
      const getRowVal = (key: keyof CsvLeadRow) => (row as any)[key.toLowerCase()] ?? (row as any)[key];
      const leadUrlFromCsv = getRowVal('kwork_url') || getRowVal('lead_url');


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
        project_description: getRowVal('project_description')!, 
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
      else if (filter === 'support' && currentUserRole === 'support') query = query.eq('assigned_to_support', currentUserId); 
      else if (filter === 'support' && currentUserStatus === 'admin') query = query.neq('assigned_to_support', null); 
      else if (['new', 'in_progress', 'interested'].includes(filter)) query = query.eq('status', filter);
      else if (filter === 'my' && currentUserRole === 'support') query = query.eq('assigned_to_support', currentUserId);
      else if (filter === 'my' && currentUserStatus === 'admin') { // Админ в "мои" видит все где он либо танк либо кэрри либо саппорт
        query = query.or(`assigned_to_tank.eq.${currentUserId},assigned_to_carry.eq.${currentUserId},assigned_to_support.eq.${currentUserId}`);
      }
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


export async function scrapePageContent(
  targetUrl: string
): Promise<{ success: boolean; content?: string; error?: string }> {
  if (!targetUrl) {
    return { success: false, error: "URL не указан." };
  }

  try {
    logger.info(`[Scraper] Запрос на скрейпинг URL: ${targetUrl}`);
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      signal: AbortSignal.timeout(15000), // Тайм-аут 15 секунд
    });

    if (!response.ok) {
      logger.error(`[Scraper] Ошибка HTTP: ${response.status} ${response.statusText} для URL: ${targetUrl}`);
      return { success: false, error: `Ошибка HTTP: ${response.status} ${response.statusText}` };
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Удаляем ненужные элементы
    $('script, style, noscript, nav, footer, header, aside, form, button, input, textarea, select, iframe, link[rel="stylesheet"], meta, svg, path, img, figure, dialog, dialog, [role="dialog"], [aria-hidden="true"]').remove();
    $('[class*="cookie"], [id*="cookie"], [class*="banner"], [id*="banner"], [class*="popup"], [id*="popup"], [class*="modal"], [id*="modal"]').remove(); // Удаляем попапы и баннеры


    // Пытаемся найти основной контент (эвристика)
    let mainContentSelector = '';
    const contentSelectors = [
        'article', 'main', '[role="main"]', 
        '.content', '#content', '.main-content', '#main-content', 
        '.project-description', '.task__description', '.job-description', // специфичные для Kwork/Habr
        '.entry-content', '.post-body', '.page-content',
        '.text-content', '.article-body', '.job_show_description' // Общие и специфичные
    ];

    let $targetElement = $('body'); // По умолчанию весь body

    for (const selector of contentSelectors) {
        const $candidate = $(selector);
        if ($candidate.length > 0) {
            // Выбираем самый большой контейнер, если их несколько
            let largestCandidateHtml = "";
            $candidate.each((_i, el) => {
                const currentHtml = $(el).html();
                if (currentHtml && currentHtml.length > largestCandidateHtml.length) {
                    largestCandidateHtml = currentHtml;
                    $targetElement = $(el); // Обновляем $targetElement на самый большой
                    mainContentSelector = selector;
                }
            });
            if(largestCandidateHtml) break; // Если нашли хотя бы один подходящий, выходим
        }
    }
    
    if (mainContentSelector) {
        logger.info(`[Scraper] Найден основной контент по селектору: ${mainContentSelector}`);
    } else {
        logger.warn(`[Scraper] Основной контент не найден по селекторам, используется весь body.`);
    }

    // Извлечение текста из выбранного элемента (или body)
    // Сначала получим HTML, чтобы затем работать с текстовыми нодами, избегая ненужных пробелов от display:none
    const targetHtml = $targetElement.html() || "";
    const $temp = cheerio.load(`<body>${targetHtml}</body>`); // Оборачиваем в body для корректной работы .text()
    
    let textContent = "";
    // Собираем текст только из видимых элементов (простая эвристика - элементы без display:none)
    // и из наиболее вероятных текстовых контейнеров
    $temp('body').find('p, div, span, li, td, h1, h2, h3, h4, h5, h6, article, section, pre, code, blockquote, strong, em, b, i, u, dd, dt, label')
        .each(function() {
            // Проверяем, что элемент не содержит только другие блочные элементы
            const $this = $(this);
            // Собираем текст, если он не пустой
            const elementText = $this.text().trim();
            if (elementText) {
                 // Добавляем точку или пробел, если текст не заканчивается знаком препинания
                 if (textContent.length > 0 && !/[\s\.\?!;,:]$/.test(textContent.slice(-1))) {
                    textContent += ". ";
                }
                textContent += elementText + (elementText.match(/[.?!]$/) ? " " : ". ");
            }
        });
    
    // Очистка текста
    textContent = textContent
      .replace(/\s\s+/g, ' ')       // Заменяем множественные пробелы на один
      .replace(/\n\s*\n/g, '\n')    // Удаляем пустые строки или строки только с пробелами
      .replace(/(\r\n|\n|\r)/gm, " ") // Заменяем переносы строк на пробелы для лучшей читаемости AI
      .replace(/\s\s+/g, ' ')
      .trim();
    
    // Фильтрация коротких строк, которые часто являются мусором
    const MIN_LINE_LENGTH_FOR_MEANING = 25; // Минимальная длина строки, чтобы считать ее значащей
    const meaningfulLines = textContent.split('. ') // Разбиваем по точкам (предполагая, что это предложения)
        .map(line => line.trim())
        .filter(line => line.length >= MIN_LINE_LENGTH_FOR_MEANING && line.match(/[а-яА-Яa-zA-Z]{3,}/)) // Строка должна быть не короче N символов и содержать слово
        .join('. ')
        .trim();
    
    textContent = meaningfulLines;

    if (!textContent) {
      logger.warn(`[Scraper] Не удалось извлечь значимый контент из URL: ${targetUrl}. Возможно, страница сильно завязана на JS-рендеринг, имеет нестандартную структуру или содержит только очень короткие строки.`);
      return { success: false, error: "Не удалось извлечь контент. Страница может быть пустой, требовать JS или содержать только короткие строки." };
    }
    
    const MAX_LENGTH = 25000; 
    if (textContent.length > MAX_LENGTH) {
        textContent = textContent.substring(0, MAX_LENGTH) + "\n\n--- СОДЕРЖИМОЕ ОБРЕЗАНО ИЗ-ЗА ПРЕВЫШЕНИЯ ЛИМИТА ---";
        logger.warn(`[Scraper] Контент с URL ${targetUrl} был обрезан до ${MAX_LENGTH} символов.`);
    }

    logger.info(`[Scraper] Успешно собран контент с URL: ${targetUrl}. Длина: ${textContent.length}`);
    return { success: true, content: textContent };

  } catch (error: any) {
    logger.error(`[Scraper] Критическая ошибка при скрейпинге ${targetUrl}: ${error.message}`, error);
    if (error.code === 'UND_ERR_CONNECT_TIMEOUT' || error.message.toLowerCase().includes('timeout')) {
        return { success: false, error: 'Тайм-аут запроса к целевому URL. Сервер не ответил вовремя.' };
    }
    return { success: false, error: `Ошибка скрейпинга: ${error.message}` };
  }
}