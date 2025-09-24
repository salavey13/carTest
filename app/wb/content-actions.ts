"use server";

import { logger } from "@/lib/logger";

// WB Content API wrappers & helpers

const WB_CONTENT_TOKEN = process.env.WB_CONTENT_TOKEN;

async function wbApiCall(endpoint: string, method: string = 'GET', body?: any, token: string = WB_CONTENT_TOKEN) {
  try {
    const response = await fetch(`https://content-api.wildberries.ru${endpoint}`, {
      method,
      headers: {
        "Authorization": token,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) {
      let errText;
      try {
        const errData = await response.json();
        errText = errData.errorText || errData.error || "WB API error";
      } catch {
        errText = await response.text() || "Unknown error";
      }
      logger.error(`wbApiCall failed: ${response.status} - ${errText}`);
      return { success: false, error: errText };
    }
    const data = await response.json();
    return { success: true, data };
  } catch (err) {
    logger.error("wbApiCall network error:", err);
    return { success: false, error: (err as Error).message };
  }
}

// Get Products Parent Categories
export async function getWbParentCategories(locale: string = 'ru'): Promise<{ success: boolean; data?: any[]; error?: string }> {
  return wbApiCall(`/content/v2/object/parent/all?locale=${locale}`);
}

// Get Subjects List
export async function getWbSubjects(locale: string = 'ru', name?: string, limit: number = 30, offset: number = 0, parentID?: number): Promise<{ success: boolean; data?: any[]; error?: string }> {
  let query = `/content/v2/object/all?locale=${locale}&limit=${limit}&offset=${offset}`;
  if (name) query += `&name=${encodeURIComponent(name)}`;
  if (parentID) query += `&parentID=${parentID}`;
  return wbApiCall(query);
}

// Get Subject Characteristics
export async function getWbSubjectCharcs(subjectId: number, locale: string = 'ru'): Promise<{ success: boolean; data?: any[]; error?: string }> {
  return wbApiCall(`/content/v2/object/charcs/${subjectId}?locale=${locale}`);
}

// Get Colors
export async function getWbColors(locale: string = 'ru'): Promise<{ success: boolean; data?: any[]; error?: string }> {
  return wbApiCall(`/content/v2/directory/colors?locale=${locale}`);
}

// Get Genders
export async function getWbGenders(locale: string = 'ru'): Promise<{ success: boolean; data?: any[]; error?: string }> {
  return wbApiCall(`/content/v2/directory/kinds?locale=${locale}`);
}

// Get Countries
export async function getWbCountries(locale: string = 'ru'): Promise<{ success: boolean; data?: any[]; error?: string }> {
  return wbApiCall(`/content/v2/directory/countries?locale=${locale}`);
}

// Get Seasons
export async function getWbSeasons(locale: string = 'ru'): Promise<{ success: boolean; data?: any[]; error?: string }> {
  return wbApiCall(`/content/v2/directory/seasons?locale=${locale}`);
}

// Get HS Codes
export async function getWbTnved(subjectID: number, search?: string, locale: string = 'ru'): Promise<{ success: boolean; data?: any[]; error?: string }> {
  let query = `/content/v2/directory/tnved?subjectID=${subjectID}&locale=${locale}`;
  if (search) query += `&search=${search}`;
  return wbApiCall(query);
}

// Generate Barcodes
export async function generateWbBarcodes(count: number = 1): Promise<{ success: boolean; data?: string[]; error?: string }> {
  return wbApiCall('/content/v2/barcodes', 'POST', { count });
}

// Create Product Cards
export async function createWbProductCards(cards: any[]): Promise<{ success: boolean; error?: string }> {
  return wbApiCall('/content/v2/cards/upload', 'POST', cards);
}

// Get product cards list (cursor-based)
export async function getWbProductCardsList(settings: any = {}, locale: string = 'ru'): Promise<{ success: boolean; data?: any; error?: string }> {
  let allCards: any[] = [];
  let cursor: any = { limit: Math.min(settings.limit || 100, 100) };  // Clamp <=100
  let total = 0;
  let pageData: any = null;

  do {
    const effectiveSettings = {
      ...settings,
      filter: settings.filter || { withPhoto: -1 },
      cursor,
    };
    const body = { settings: effectiveSettings };

    const res = await wbApiCall(`/content/v2/get/cards/list?locale=${locale}`, 'POST', body);
    if (!res.success) return res;

    pageData = res.data || {};
    const cards = Array.isArray(pageData.cards) ? pageData.cards : [];

    allCards = [...allCards, ...cards];
    total = pageData.cursor?.total ?? total;

    cursor = {
      limit: cursor.limit,
      updatedAt: pageData.cursor?.updatedAt,
      nmID: pageData.cursor?.nmID,
    };

    logger.info(`Page fetched: ${cards.length} cards, total so far: ${allCards.length}, next cursor: ${JSON.stringify(cursor)}, response total: ${total}`);
  } while ((cursor.updatedAt && cursor.nmID) && ((pageData?.cards?.length ?? 0) >= cursor.limit));

  return { success: true, data: { cards: allCards, total: allCards.length } };
}