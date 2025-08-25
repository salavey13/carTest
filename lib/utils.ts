// /lib/utils.ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { logger } from "./logger"; // Import logger for warnings
import { BigNumber, ethers } from 'ethers';

/**
 * feeBps = 9 => 0.09%
 * calcFee: returns wei string for fee
 */
export function calcFee(amountWei: string, feeBps: number, round: 'floor' | 'round' = 'round') {
  const amt = BigNumber.from(amountWei);
  const numerator = amt.mul(feeBps);
  const denom = 10_000;
  // rounding choice:
  const raw = numerator.div(denom);
  if (round === 'floor') return raw.toString();
  // simple rounding: if remainder*2 >= denom -> +1
  const rem = numerator.mod(denom);
  const add = rem.mul(2).gte(denom) ? BigNumber.from(1) : BigNumber.from(0);
  return raw.add(add).toString();
}

/**
 * reverseAmountWithFee: given repay = loan + fee,
 * compute loan from repay and feeBps
 */
export function reverseAmountWithFee(repayWei: string, feeBps: number) {
  const r = BigNumber.from(repayWei);
  // loan = floor(repay * 10000 / (10000 + feeBps))
  const loan = r.mul(10000).div(10000 + feeBps);
  return loan.toString();
}

// helper: convert decimal amount to wei string (token decimals)
export function decimalsToWei(amount: string, decimals: number) {
  return ethers.utils.parseUnits(amount, decimals).toString();
}
/**
 * Formats a date into a readable string like "10.08.2025".
 * @param dateInput - The date to format (Date object, ISO string, or timestamp number).
 * @param locale - The locale string (e.g., 'ru-RU').
 * @returns A formatted date string or "Invalid Date".
 */
export function formatDate(dateInput: Date | string | number, locale: string = 'ru-RU'): string {
    try {
        const date = new Date(dateInput);
        if (isNaN(date.getTime())) {
            return "Invalid Date";
        }
        // Используем опции для получения формата ДД.ММ.ГГГГ
        const options: Intl.DateTimeFormatOptions = {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        };
        return new Intl.DateTimeFormat(locale, options).format(date);
    } catch (e) {
        logger.error("Error formatting date:", e);
        return "Error";
    }
}

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