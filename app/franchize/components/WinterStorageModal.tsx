"use client";

// Winter-storage offer modal (2026-09-27) — «Зимнее Хранение» pill on the
// vip-bike catalog opens the single «Место хранения» entry: the covered
// facility, what the keeper does during the season, the price and the ПЭП
// checkout promise. The pill lives in the catalog filter row (CatalogClient)
// so the offer is discoverable exactly where renters already browse.
//
// The matching legal document is docs/crewDocs/vip-bike_WINTER_STORAGE_TEMPLATE.html
// (договор ответственного хранения + акт приёма-передачи + акт возврата,
// ПЭП п. 10.2); the flowType="storage" checkout generates it server-side.

import { useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BatteryCharging, Camera, Car, CheckCircle2, FileSignature, Gauge, Home, ShieldCheck, Snowflake } from "lucide-react";

/** vip-bike's single storage place (boss's manual: Стригинский переулок 13Б). */
const STORAGE_PLACE = {
  title: "Место хранения",
  name: "Стригинский переулок, 13Б",
  description:
    "Крытое помещение с ограниченным доступом в Нижнем Новгороде. Мотоцикл стоит на твёрдом покрытии, третьи лица доступ к нему не имеют.",
};

const CARE_POINTS = [
  { icon: Home, text: "Крытое помещение с ограниченным доступом" },
  { icon: BatteryCharging, text: "Отключение и периодическая подзарядка аккумулятора" },
  { icon: Gauge, text: "Контроль давления в шинах, смещение точки контакта" },
  { icon: Car, text: "Укрытие чехлом и защита от грызунов" },
  { icon: Camera, text: "Ежемесячный осмотр, фотоотчёт — по запросу" },
  { icon: ShieldCheck, text: "Ответственность Хранителя в размере оценочной стоимости" },
] as const;

type WinterStorageModalProps = {
  open: boolean;
  onClose: () => void;
  /** Crew handle like «@I_O_S_NN» — builds the manager deep link. */
  telegramHandle: string;
  /** Fallback phone for the «Позвонить» secondary link. */
  phone: string;
};

export function WinterStorageModal({ open, onClose, telegramHandle, phone }: WinterStorageModalProps) {
  const managerHref = useMemo(() => {
    const handle = telegramHandle.replace("@", "").trim();
    return handle ? `https://t.me/${handle}` : "";
  }, [telegramHandle]);

  const phoneHref = useMemo(() => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) return "";
    return `tel:+7${digits.slice(-10)}`;
  }, [phone]);

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (!nextOpen ? onClose() : null)}>
      <DialogContent
        className="max-h-[85vh] overflow-y-auto border-[var(--dialog-border)] bg-[var(--dialog-bg)] text-[var(--dialog-text)] backdrop-blur-md"
        style={
          {
            "--dialog-border": "hsl(var(--border))",
            "--dialog-bg": "hsl(var(--background))",
            "--dialog-text": "hsl(var(--foreground))",
            "--dialog-muted": "hsl(var(--muted-foreground))",
          } as React.CSSProperties
        }
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Snowflake className="h-5 w-5 text-sky-400" aria-hidden="true" />
            Зимнее хранение мотоциклов
          </DialogTitle>
          <DialogDescription className="text-[var(--dialog-muted)]">
            Сезон: обычно октябрь → июнь. Ответственное хранение по договору (гл. 47 ГК РФ).
          </DialogDescription>
        </DialogHeader>

        {/* Место хранения — the single storage place entry */}
        <div className="rounded-xl border border-[var(--dialog-border)] p-3.5" style={{ backgroundColor: "hsl(var(--muted) / 0.35)" }}>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--dialog-muted)]">{STORAGE_PLACE.title}</p>
          <p className="mt-1 text-sm font-bold">{STORAGE_PLACE.name}</p>
          <p className="mt-1 text-xs leading-relaxed text-[var(--dialog-muted)]">{STORAGE_PLACE.description}</p>
        </div>

        {/* What the keeper does (mirrors п. 4.1.3 of the storage contract) */}
        <ul className="space-y-2.5" aria-label="Что входит в хранение">
          {CARE_POINTS.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-start gap-2.5 text-sm">
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" aria-hidden="true" />
              <span className="leading-snug">{text}</span>
            </li>
          ))}
        </ul>

        {/* Money + оформление */}
        <div className="rounded-xl border border-[var(--dialog-border)] p-3.5" style={{ backgroundColor: "hsl(var(--muted) / 0.35)" }}>
          <p className="text-sm">
            <span className="text-lg font-extrabold">от 2 000 ₽ / месяц</span>
            <span className="ml-2 text-xs text-[var(--dialog-muted)]">оплата единовременно за сезон</span>
          </p>
          <p className="mt-2 flex items-start gap-2 text-xs leading-relaxed text-[var(--dialog-muted)]">
            <FileSignature className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>
              Оформление: договор ответственного хранения + акт приёма-передачи с фотофиксацией и акт возврата.
              Подписание — простой электронной подписью (ПЭП) прямо в Telegram.
            </span>
          </p>
        </div>

        {/* CTA row */}
        <div className="flex flex-col gap-2 sm:flex-row">
          {managerHref ? (
            <a
              href={managerHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onClose}
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-sky-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
            >
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              Оставить заявку
            </a>
          ) : null}
          {phoneHref ? (
            <a
              href={phoneHref}
              onClick={onClose}
              className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-[var(--dialog-border)] px-4 py-2.5 text-sm font-semibold transition hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dialog-border)]"
            >
              {phone}
            </a>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
