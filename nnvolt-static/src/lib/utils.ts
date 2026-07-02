import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Simple console logger for standalone project
const logger = {
  error: (...args: any[]) => console.error(...args),
  warn: (...args: any[]) => console.warn(...args),
  info: (...args: any[]) => console.info(...args),
};

export function formatDate(dateInput: Date | string | number, locale: string = 'ru-RU'): string {
    try {
        const date = new Date(dateInput);
        if (isNaN(date.getTime())) {
            return "Invalid Date";
        }
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

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function getBaseUrl(): string {
  // For static site, always return Vercel URL (where forward-telegram lives)
  return "https://v0-car-test.vercel.app";
}

export const delay = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

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

// Helper function to escape characters for Telegram's MarkdownV2 parser
export const escapeMarkdown = (text: string | null | undefined): string => {
  if (text === null || typeof text === 'undefined') {
    return '';
  }
  const toEscape = '_*[]()~`>#+-=|{}.!';
  return String(text).replace(new RegExp(`[${toEscape.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}]`, 'g'), '\\$&');
};

export const escapeTelegramMarkdown = escapeMarkdown;
