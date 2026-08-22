// /lib/rental-date-utils.ts
/**
 * Rental date utilities for converting TEXT dates (DD.MM.YYYY) to TIMESTAMPTZ.
 * Used by skill script and doc-manual for unified rental tracking.
 */

/**
 * Parse Russian date format DD.MM.YYYY or DD.MM.YY into components.
 * @param dateStr - Date string in "17.06.2026" or "17.06.26" format
 * @returns Object with d (day), m (month 0-indexed), y (year) or null
 */
export function parseRuDateParts(dateStr: string): { d: number; m: number; y: number } | null {
  const match = String(dateStr || '').trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
  if (!match) return null;

  let [, d, m, y] = match;
  const day = parseInt(d, 10);
  const month = parseInt(m, 10) - 1; // JS months are 0-indexed
  let year = parseInt(y, 10);

  // Convert 2-digit year to 4-digit
  if (year < 100) {
    year = year > 50 ? 1900 + year : 2000 + year;
  }

  if (isNaN(day) || isNaN(month) || isNaN(year)) {
    return null;
  }

  return { d: day, m: month, y: year };
}

/**
 * Convert TEXT date + time to ISO timestamp.
 * Assumes input is in local timezone and converts to UTC by subtracting offset.
 *
 * @param dateText - Date in "DD.MM.YYYY" format
 * @param timeText - Time in "HH:MM" format (minutes optional, defaults to 00)
 * @param timezoneOffset - Hour offset from UTC (default: 3 for Moscow)
 * @returns ISO timestamp string or null if invalid
 *
 * @example
 * convertTextDateToTimestamp('17.06.2026', '18:00', 3)
 * // returns '2026-06-17T15:00:00.000Z'
 */
export function convertTextDateToTimestamp(
  dateText: string,
  timeText: string,
  timezoneOffset: number = 3
): string | null {
  const parsed = parseRuDateParts(dateText);
  if (!parsed) return null;

  // Parse time HH:MM, default to 00:00 if minutes missing
  const timeMatch = String(timeText || '').trim().match(/^(\d{1,2})(:(\d{1,2}))?$/);
  if (!timeMatch) return null;

  const hh = parseInt(timeMatch[1], 10);
  const mm = timeMatch[2] ? parseInt(timeMatch[3] || '0', 10) : 0;

  if (isNaN(hh) || isNaN(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) {
    return null;
  }

  // Create date in UTC (treating input as if it were UTC time)
  const utcDate = new Date(Date.UTC(parsed.y, parsed.m, parsed.d, hh, mm));

  if (isNaN(utcDate.getTime())) {
    return null;
  }

  // Convert from target timezone to UTC by subtracting the offset
  // Example: 18:00 in Moscow (UTC+3) should be 15:00 UTC
  const actualUtc = new Date(utcDate.getTime() - timezoneOffset * 60 * 60 * 1000);

  return actualUtc.toISOString();
}

/**
 * Parse time string HH:MM into total minutes.
 * @param timeText - Time in "HH:MM" or "H" format
 * @returns Total minutes from midnight, or null if invalid
 */
export function parseTimeToMinutes(timeText: string): number | null {
  const timeMatch = String(timeText || '').trim().match(/^(\d{1,2})(:(\d{2}))?$/);
  if (!timeMatch) return null;

  const hh = parseInt(timeMatch[1], 10);
  const mm = timeMatch[2] ? parseInt(timeMatch[2].substring(1), 10) : 0;

  if (isNaN(hh) || isNaN(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) {
    return null;
  }

  return hh * 60 + mm;
}

/**
 * Resolve crew owner's telegram chat_id from a bike's crew_id.
 * Used to set placeholder user_id when creating rentals from bot contracts.
 *
 * @param supabase - Supabase client instance
 * @param crewId - The crew ID from bike.crew_id
 * @returns Crew owner's chat_id, or null if not found
 */
export async function resolveCrewOwnerChatId(
  supabase: any,
  crewId: string
): Promise<string | null> {
  if (!crewId) return null;

  try {
    // Get crew slug from crew_id
    const { data: crew } = await supabase
      .from('crews')
      .select('slug')
      .eq('id', crewId)
      .maybeSingle();

    if (!crew?.slug) return null;

    // Get crew owner (user with 'owner' role in this crew).
    //
    // ⚠️ MULTIPLE-OWNER GUARD (added 2026-08-21):
    // Previously used `.maybeSingle()` which THROWS `PGRST116` ("JSON object
    // requested, multiple (or no) rows returned") when there's >1 owner in
    // crew_members. This caused two /doc rentals to fail silently on
    // 2026-08-21 because someone had accidentally promoted 3 members to
    // role='owner'. The throw was caught by the outer try/catch and returned
    // null, which propagated up as "No crew owner found for crew_id: ..." —
    // and the operator saw a misleading "✅ Contract generated!" success
    // message while the rental was never actually created.
    //
    // Fix: use `.limit(1)` + sort by `joined_at` ASC (oldest owner wins,
    // matching the semantic of "original founder"). Even if multiple owners
    // exist due to a future accident, we still resolve to one and the
    // /doc flow keeps working. A separate audit can detect the multi-owner
    // state and surface it for cleanup.
    const { data: members } = await supabase
      .from('crew_members')
      .select('user_id')
      .eq('crew_id', crewId)
      .eq('role', 'owner')
      .order('joined_at', { ascending: true })
      .limit(1);

    return members?.[0]?.user_id || null;
  } catch (error) {
    console.error('[resolveCrewOwnerChatId] Failed:', error);
    return null;
  }
}
