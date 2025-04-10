// /lib/utils.ts
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
 * Determines the base URL for the application.
 * Prefers VERCEL_URL (includes deployment-specific URLs),
 * then NEXT_PUBLIC_APP_URL (manually set base URL),
 * and falls back to a hardcoded default for local development.
 * @returns The application's base URL string (e.g., "https://myapp.vercel.app").
 */
export function getBaseUrl(): string {
  // 1. Vercel deployment URL (most reliable for Vercel deployments)
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  // 2. Manually configured public URL (useful for custom domains or non-Vercel)
  if (process.env.NEXT_PUBLIC_APP_URL) {
    // Ensure it starts with http:// or https://
    if (!process.env.NEXT_PUBLIC_APP_URL.startsWith('http')) {
        logger.warn(`NEXT_PUBLIC_APP_URL (${process.env.NEXT_PUBLIC_APP_URL}) should include protocol (http:// or https://). Assuming https.`);
        return `https://${process.env.NEXT_PUBLIC_APP_URL.replace(/^.*:\/\//, '')}`; // Add https if missing
    }
    return process.env.NEXT_PUBLIC_APP_URL;
  }

  // 3. Fallback for local development
  const defaultLocalUrl = "http://localhost:3000";
  // Only log warning if explicitly not in production (safer default)
  if (process.env.NODE_ENV !== 'production') {
     logger.warn(`VERCEL_URL and NEXT_PUBLIC_APP_URL are not set. Falling back to default ${defaultLocalUrl}. Ensure NEXT_PUBLIC_APP_URL is set for production builds outside Vercel.`);
  }
  return defaultLocalUrl;

  // Original fallback - less safe as it might expose internal Vercel URLs if NEXT_PUBLIC_APP_URL isn't set
  // return "https://v0-car-test.vercel.app";
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