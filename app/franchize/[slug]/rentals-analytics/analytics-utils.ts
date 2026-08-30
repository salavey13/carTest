// Shared formatting utilities for analytics pages

import { format } from "date-fns";
import { ru } from "date-fns/locale";

export const formatRubles = (amount: number | string | null | undefined): string => {
  if (amount == null) return "—";
  const n = typeof amount === "string" ? Number(amount.replace(/\s/g, "")) : amount;
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
};

export const formatRussianDate = (dateStr: string | null): string => {
  if (!dateStr) return "—";
  try {
    return format(new Date(dateStr), "dd MMM yyyy, HH:mm", { locale: ru });
  } catch {
    return "—";
  }
};

export const formatRussianDateOnly = (dateStr: string | null): string => {
  if (!dateStr) return "—";
  try {
    // iter22 tz fix: `new Date("2026-08-30")` parses as UTC midnight — on
    // devices west of UTC that is still the PREVIOUS local day, so date-fns
    // (device-tz) rendered the wrong calendar date. For pure date-only
    // labels we build the Date from the Y/M/D parts at LOCAL midnight, so
    // the formatted date is the exact calendar date on every device.
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr.trim());
    if (m) {
      const local = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
      return format(local, "dd MMM yyyy", { locale: ru });
    }
    return format(new Date(dateStr), "dd MMM yyyy", { locale: ru });
  } catch {
    return "—";
  }
};
