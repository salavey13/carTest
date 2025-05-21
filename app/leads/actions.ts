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
  initial_relevance_score?: string; // Добавлено, PapaParse читает все как строки сначала
  project_type_guess?: string;   // Добавлено
}

// Массив User-Agent'ов для большей вариативности (пока не используется активно)
// const USER_AGENTS = [
//   'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
//   'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Safari/605.1.15',
//   'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.107 Safari/537.36',
//   'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:90.0) Gecko/20100101 Firefox/90.0'
// ];

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
      transform: (value, header) => {
        const trimmedValue = typeof value === 'string' ? value.trim() : value;
        if (header === 'initial_relevance_score') {
          const num = parseInt(trimmedValue as string, 10);
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
      // transformHeader уже привел все заголовки к lowerCase, поэтому обращаемся напрямую по lowerCase ключу
      const getRowVal = (key: keyof CsvLeadRow) => (row as any)[key.toLowerCase()];
      const leadUrlFromCsv = getRowVal('kwork_url'); // 'kwork_url' это уже 'lead_url' после transformHeader

      if (!getRowVal('project_description')) {
        localErrors.push(`Пропущена строка: отсутствует 'project_description'. URL: ${leadUrlFromCsv || 'N/A'}`);
        continue;
      }
      
      let tweaksJson: any = null;
      const identifiedTweaksCsv = getRowVal('identified_tweaks');
      if (identifiedTweaksCsv && typeof identifiedTweaksCsv === 'string') {
        try { tweaksJson = JSON.parse(identifiedTweaksCsv); }
        catch (e) { localErrors.push(`Ошибка парсинга JSON для 'identified_tweaks' в лиде с URL ${leadUrlFromCsv}: ${(e as Error).message}`); }
      } else if (typeof identifiedTweaksCsv === 'object') { // Если PapaParse уже распарсил как объект (маловероятно для строки CSV, но на всякий случай)
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
        initial_relevance_score: typeof getRowVal('initial_relevance_score') === 'number' ? getRowVal('initial_relevance_score') : null,
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
  // const userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]; // Раскомментировать для случайного User-Agent
  const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
  logger.info(`[Scraper] Запрос на скрейпинг URL: ${targetUrl} с User-Agent: ${userAgent}`);

  try {
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
        // 'Cache-Control': 'no-cache', // Можно добавить для попытки получить свежую версию
        // 'Pragma': 'no-cache',
      },
      signal: AbortSignal.timeout(20000), // Увеличил тайм-аут до 20 секунд
    });
    logger.info(`[Scraper] Получен ответ от ${targetUrl}. Статус: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Не удалось прочитать тело ошибки");
      logger.error(`[Scraper] Ошибка HTTP: ${response.status} ${response.statusText} для URL: ${targetUrl}. Тело ответа (если есть): ${errorText.substring(0,500)}`);
      return { success: false, error: `Ошибка HTTP: ${response.status} ${response.statusText}` };
    }

    const html = await response.text();
    logger.debug(`[Scraper] HTML получен, длина: ${html.length}. Начинаю парсинг Cheerio.`);
    const $ = cheerio.load(html);
    
    logger.debug(`[Scraper] HTML перед удалением элементов (первые 500 симв.): ${$('body').html()?.substring(0,500)}`);
    // Удаляем ненужные элементы
    $('script, style, noscript, nav, footer, header, aside, form, button, input, textarea, select, iframe, link[rel="stylesheet"], meta, svg, path, img, figure, dialog, [role="dialog"], [aria-hidden="true"]').remove();
    $('[class*="cookie"], [id*="cookie"], [class*="banner"], [id*="banner"], [class*="popup"], [id*="popup"], [class*="modal"], [id*="modal"]').remove(); // Удаляем попапы и баннеры
    logger.debug(`[Scraper] Ненужные элементы удалены.`);

    // Пытаемся найти основной контент (эвристика)
    let mainContentSelector = '';
    const contentSelectors = [
        'article', 'main', '[role="main"]', 
        '.content', '#content', '.main-content', '#main-content', 
        '.project-description', '.task__description', '.job-description', // специфичные для Kwork/Habr
        '.entry-content', '.post-body', '.page-content',
        '.text-content', '.article-body', '.job_show_description', '.description', // Общие и специфичные
        '[itemprop="description"]' // Часто используется для описаний
    ];
    logger.debug(`[Scraper] Поиск основного контента по селекторам: ${contentSelectors.join(', ')}`);

    let $targetElement = $('body'); 
    let foundSpecificContent = false;

    for (const selector of contentSelectors) {
        const $candidate = $(selector);
        if ($candidate.length > 0) {
            let largestCandidateHtml = "";
            $candidate.each((_i, el) => {
                const currentHtml = $(el).html();
                if (currentHtml && currentHtml.length > largestCandidateHtml.length) {
                    largestCandidateHtml = currentHtml;
                    $targetElement = $(el); 
                    mainContentSelector = selector;
                    foundSpecificContent = true;
                }
            });
            if(largestCandidateHtml) {
                logger.info(`[Scraper] Найден основной контент по селектору: ${mainContentSelector}. Длина HTML: ${largestCandidateHtml.length}`);
                break; 
            }
        }
    }
    
    if (!foundSpecificContent) {
        logger.warn(`[Scraper] Основной контент не найден по селекторам, используется весь body.`);
    }
    logger.debug(`[Scraper] HTML выбранного элемента ('${mainContentSelector || 'body'}') перед извлечением текста (первые 500 симв.): ${$targetElement.html()?.substring(0,500)}`);

    const targetHtmlForText = $targetElement.html() || "";
    const $tempForText = cheerio.load(`<body>${targetHtmlForText}</body>`); 
    
    let extractedTexts: string[] = [];
    $tempForText('body').find('p, div, span, li, td, th, h1, h2, h3, h4, h5, h6, article, section, pre, code, blockquote, strong, em, b, i, u, dd, dt, label, a')
        .each(function() {
            const $this = $(this);
            const elementText = $this.clone().children().remove().end().text().trim();

            if (elementText) {
                extractedTexts.push(elementText);
            }
        });
    
    logger.debug(`[Scraper] Извлечено ${extractedTexts.length} текстовых фрагментов. Пример: "${extractedTexts.slice(0,5).join(' | ')}"`);
    let textContent = extractedTexts.join(". "); // Соединяем фрагменты через точку и пробел
    
    logger.debug(`[Scraper] Текст после первичного соединения (до очистки, первые 500 симв.): ${textContent.substring(0,500)}`);
    // Очистка текста
    textContent = textContent
      .replace(/\s\s+/g, ' ')       // Заменяем множественные пробелы на один
      .replace(/\s+\./g, '.')       // Убираем пробел перед точкой (например, "слово . " -> "слово.")
      .replace(/\.{2,}/g, '.')      // Заменяем многоточия или двойные точки на одну
      .replace(/\s*\.\s*/g, '. ')   // Нормализуем точки: "слово.слово" -> "слово. слово", "слово .слово" -> "слово. слово"
      .replace(/(\r\n|\n|\r)/gm, " ") // Заменяем переносы строк на пробелы
      .replace(/\s\s+/g, ' ')       // Повторно убираем множественные пробелы
      .trim();
    logger.debug(`[Scraper] Текст после основной очистки (первые 500 симв.): ${textContent.substring(0,500)}`);
    
    const MIN_LINE_LENGTH_FOR_MEANING = 15; // Снизил порог для большей гибкости
    const MIN_SIGNIFICANT_CONTENT_LENGTH = 100; // Минимальная общая длина контента, чтобы считать его не пустым

    const meaningfulLines = textContent.split('.') 
        .map(line => line.trim())
        .filter(line => {
            if (line.length < MIN_LINE_LENGTH_FOR_MEANING) return false;
            return /[a-zA-Zа-яА-Я]{3,}/.test(line) && !/^[^\w\s\p{P}]*$/.test(line.replace(/\s/g, '')); // Учитываем пунктуацию в не-мусорных строках
        })
        .map(line => line.endsWith('.') ? line : line + '.') 
        .join(' ') 
        .trim();
    
    logger.debug(`[Scraper] Текст после фильтрации осмысленных строк (длина: ${meaningfulLines.length}, первые 500 симв.): ${meaningfulLines.substring(0,500)}`);
    textContent = meaningfulLines;

    if (!textContent || textContent.length < MIN_SIGNIFICANT_CONTENT_LENGTH) {
      logger.warn(`[Scraper] Не удалось извлечь значимый контент (длина ${textContent?.length || 0}) из URL: ${targetUrl}. Возможно, это honeypot, страница-заглушка, капча, или требует JS-рендеринга / имеет нестандартную структуру.`);
      return { success: false, error: `Не удалось извлечь контент (длина ${textContent?.length || 0}). Страница может быть пустой, требовать JS или быть honeypot.` };
    }
    
    const MAX_LENGTH = 25000; 
    if (textContent.length > MAX_LENGTH) {
        textContent = textContent.substring(0, MAX_LENGTH) + "\n\n--- СОДЕРЖИМОЕ ОБРЕЗАНО ИЗ-ЗА ПРЕВЫШЕНИЯ ЛИМИТА ---";
        logger.warn(`[Scraper] Контент с URL ${targetUrl} был обрезан до ${MAX_LENGTH} символов.`);
    }

    logger.info(`[Scraper] Успешно собран контент с URL: ${targetUrl}. Финальная длина: ${textContent.length}`);
    return { success: true, content: textContent };

  } catch (error: any) {
    logger.error(`[Scraper] Критическая ошибка при скрейпинге ${targetUrl}: ${error.message}`, error.stack);
    if (error.name === 'AbortError' || error.code === 'UND_ERR_CONNECT_TIMEOUT' || error.message.toLowerCase().includes('timeout')) {
        return { success: false, error: 'Тайм-аут запроса к целевому URL. Сервер не ответил вовремя.' };
    }
    if (error.message.toLowerCase().includes('invalidcharactererror')) {
        return { success: false, error: 'Ошибка парсинга HTML: невалидный символ. Возможно, проблема с кодировкой страницы.'};
    }
    return { success: false, error: `Ошибка скрейпинга: ${error.message}` };
  }
}