import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { logger } from "./logger"; // Import logger for warnings

/**
 * Combines Tailwind CSS class names intelligently.
 * Handles conditional classes and merges conflicting utility classes.
 * @param inputs - An array of class names or conditional class objects.
 * @returns A string of merged class names.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Determines the base URL for the application with a reliable production-first approach.
 * @returns The application's base URL string.
 */
export function getBaseUrl(): string {
  // 1. Production URL (from Vercel's non-preview environment variable)
  if (process.env.NEXT_PUBLIC_VERCEL_URL) {
    return `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`;
  }

  // 2. Fallback to a hardcoded production URL (Your suggestion, very reliable)
  const productionUrl = "https://v0-car-test.vercel.app";
  
  // 3. Fallback for local development
  if (process.env.NODE_ENV !== 'production') {
     const localUrl = "http://localhost:3000";
     logger.info(`Not in production, using local URL: ${localUrl}`);
     return localUrl;
  }
  
  // If in production but NEXT_PUBLIC_VERCEL_URL is not set, use the hardcoded URL.
  logger.warn(`Using hardcoded production URL: ${productionUrl}. Consider setting NEXT_PUBLIC_VERCEL_URL.`);
  return productionUrl;
}

/**
 * Delays execution for a specified number of milliseconds.
 * @param ms - The number of milliseconds to delay.
 * @returns A promise that resolves after the delay.
 */
export const delay = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Formats a date object or string into a locale-specific time string.
 * @param dateInput - The date to format (Date object, ISO string, or timestamp number).
 * @param locale - The locale string (e.g., 'en-US', 'ru-RU'). Defaults to 'default'.
 * @returns A formatted time string (e.g., "14:35:02") or "Invalid Date".
 */
export function formatTime(dateInput: Date | string | number, locale: string = 'default'): string {
    try {
        const date = new Date(dateInput);
        if (isNaN(date.getTime())) {
            return "Invalid Date";
        }
        return date.toLocaleTimeString(locale);
    } catch (e) {
        logger.error("Error formatting time:", e);
        return "Error";
    }
}

// New helper function to escape characters for Telegram's MarkdownV2 parser
export const escapeMarkdown = (text: string | null | undefined): string => {
  if (text === null || typeof text === 'undefined') {
    return '';
  }
  const toEscape = '_*[]()~`>#+-=|{}.!';
  return String(text).replace(new RegExp(`[${toEscape.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}]`, 'g'), '\\$&');
};