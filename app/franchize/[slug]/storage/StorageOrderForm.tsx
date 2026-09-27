"use client";

// /app/franchize/[slug]/storage/StorageOrderForm.tsx
// 2026-09-27 — the self-service «Заявка на зимнее хранение» checkout.
// This is the missing UI half of flowType="storage": the server already
// generates the consolidated Договор хранения (docs/crewDocs/
// vip-bike_WINTER_STORAGE_TEMPLATE.html) via createFranchizeOrderCheckout.
// The form submits a SYNTHETIC single-line payload (itemId "storage" — not a
// catalog item, the per-bike loop skips it; the consolidated storage branch
// builds the contract) so every battle-tested checkout guard comes for free:
// idempotency, money sanitation, ПЭП HMAC verification, TG fan-out, rate
// limits — and the new persistence: the season lands on the «Хранение» wall.

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Loader2, PenLine, Snowflake } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useAppContext } from "@/contexts/AppContext";
import { createFranchizeOrderCheckout } from "@/app/franchize/actions";
import { getTelegramInitData } from "@/lib/telegram-webapp-init-data";
import { formatRuDateFromISO } from "@/app/franchize/lib/date-utils";
import { formatStorageMonthsLabel } from "@/app/franchize/lib/storage-season";
import {
  storageMonthsCount,
  storageSeasonDefaults,
  storageFormatRub,
} from "@/app/franchize/lib/storage";

const storageOrderSchema = z.object({
  // ── Владелец (контракт раздел 11) ──
  recipient: z.string().trim().min(2, "Укажите ФИО владельца").max(120),
  phone: z.string().trim().min(6, "Укажите телефон").max(32),
  noticeAddress: z.string().trim().max(300).optional().or(z.literal("")),
  // ── Мото-транспорт (п. 1.1–1.3) ──
  bikeTitle: z.string().trim().min(2, "Укажите марку и модель").max(120),
  regNumber: z.string().trim().max(40).optional().or(z.literal("")),
  vin: z.string().trim().max(40).optional().or(z.literal("")),
  year: z.string().trim().max(10).optional().or(z.literal("")),
  color: z.string().trim().max(60).optional().or(z.literal("")),
  mileageKm: z.string().trim().max(20).optional().or(z.literal("")),
  accessories: z.string().trim().max(600).optional().or(z.literal("")),
  estimatedValueRub: z.coerce.number({ invalid_type_error: "Укажите оценочную стоимость" })
    .positive("Оценочная стоимость должна быть больше нуля").max(100_000_000),
  monthlyPriceRub: z.coerce.number().min(0).max(10_000_000).default(2000),
  // ── Сезон (п. 2.1) ──
  seasonStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Выберите дату начала"),
  seasonEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Выберите дату окончания"),
  // ── Паспорт владельца (assertStorageIdentityDocs) ──
  passportSeries: z.string().trim().min(2, "Серия паспорта обязательна — договор оформляется на владельца").max(10),
  passportNumber: z.string().trim().min(2, "Номер паспорта обязателен — договор оформляется на владельца").max(10),
  passportIssueDate: z.string().trim().max(32).optional().or(z.literal("")),
  passportIssuedBy: z.string().trim().max(300).optional().or(z.literal("")),
  // ── ПЭП (ст. 5–6 ФЗ-63) ──
  pepConsent: z.boolean().optional(),
});

type StorageOrderFormValues = z.infer<typeof storageOrderSchema>;

const inputStyle = {
  backgroundColor: "hsl(var(--background))",
  borderColor: "hsl(var(--border))",
  color: "hsl(var(--foreground))",
} as const;

function Field({
  label,
  error,
  children,
  hint,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">{label}</span>
      {children}
      {error ? <span className="block text-xs font-medium text-red-500">{error}</span> : hint ? <span className="block text-xs text-zinc-400">{hint}</span> : null}
    </label>
  );
}

const inputClass =
  "h-11 w-full rounded-xl border px-3 text-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-400/30";

export function StorageOrderForm({
  slug,
  crewName,
  storagePlace,
  defaultMonthlyPriceRub,
  seasonStartMMDD,
  seasonEndMMDD,
}: {
  slug: string;
  crewName: string;
  storagePlace: string;
  /** Config entry price (admin/crewowner) — pre-fill only, staff confirms the final rate. */
  defaultMonthlyPriceRub?: number;
  /** Config season anchors (MM-DD) — pre-fill only. */
  seasonStartMMDD?: string;
  seasonEndMMDD?: string;
}) {
  const { user, dbUser, isInTelegramContext } = useAppContext();
  const defaults = useMemo(
    () =>
      storageSeasonDefaults(new Date(), {
        start: seasonStartMMDD || "10-15",
        end: seasonEndMMDD || "06-01",
      }),
    [seasonStartMMDD, seasonEndMMDD],
  );
  const [pepInitData, setPepInitData] = useState<string | null>(null);
  const [pepUserOptedOut, setPepUserOptedOut] = useState(false);
  const [submitPhase, setSubmitPhase] = useState<"idle" | "sending">("idle");
  const submitLockRef = useRef(false);
  // Stable per-mount orderId: the checkout idempotency guard keys on it —
  // a retry of the SAME form session must never mint a second contract.
  const orderIdRef = useRef(`storage-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`);
  const [success, setSuccess] = useState<{ pepSigned: boolean; total: number } | null>(null);

  // ПЭП default-on inside Telegram (same recipe as the rental checkout):
  // submitting implies contract acceptance, so the verified Telegram identity
  // signs by default and the card below lets the owner opt OUT.
  useEffect(() => {
    if (pepInitData || pepUserOptedOut) return;
    const initData = getTelegramInitData();
    if (initData && initData.length >= 32) setPepInitData(initData);
  }, [isInTelegramContext, pepInitData, pepUserOptedOut]);

  const { register, handleSubmit, watch, formState: { errors } } = useForm<StorageOrderFormValues>({
    resolver: zodResolver(storageOrderSchema),
    mode: "onBlur",
    defaultValues: {
      monthlyPriceRub: defaultMonthlyPriceRub ?? 2000,
      seasonStart: defaults.start,
      seasonEnd: defaults.end,
      recipient: dbUser?.full_name || "",
    },
  });

  const values = watch();
  const months = storageMonthsCount(values.seasonStart, values.seasonEnd);
  const monthsLabel = formatStorageMonthsLabel(values.seasonStart, values.seasonEnd);
  const monthly = Number(values.monthlyPriceRub) || 0;
  const total = Math.round(monthly * months);
  const datesValid = months > 0;

  const onSubmitValid = handleSubmit((formValues) => {
    if (submitLockRef.current) return;
    if (!datesValid) {
      toast.error("Проверьте сезон: дата окончания должна быть позже даты начала.");
      return;
    }
    submitLockRef.current = true;
    setSubmitPhase("sending");

    const totalRub = Math.round(Number(formValues.monthlyPriceRub) * months);
    const seasonLine = `Сезон ${formatRuDateFromISO(formValues.seasonStart)} → ${formatRuDateFromISO(formValues.seasonEnd)}`;

    const run = async () => {
      let result: Awaited<ReturnType<typeof createFranchizeOrderCheckout>> | undefined;
      try {
        result = await createFranchizeOrderCheckout({
          slug,
          orderId: orderIdRef.current,
          telegramUserId: String(user?.id ?? "manual-order"),
          recipient: formValues.recipient.trim(),
          phone: formValues.phone.trim(),
          time: seasonLine,
          comment: formValues.noticeAddress ? `Адрес для уведомлений: ${formValues.noticeAddress.trim()}` : "",
          rentalStartDate: formValues.seasonStart,
          rentalEndDate: formValues.seasonEnd,
          passportSeries: formValues.passportSeries.trim(),
          passportNumber: formValues.passportNumber.trim(),
          passportIssueDate: formValues.passportIssueDate || undefined,
          passportIssuedBy: formValues.passportIssuedBy || undefined,
          registrationAddress: formValues.noticeAddress?.trim() || undefined,
          hasLicense: true,
          signatureName: formValues.recipient.trim(),
          signatureAccepted: true,
          signatureFingerprint: user?.id ? `tg:${user.id}` : "manual-sign",
          payment: "cash", // оплата единовременно за сезон — при сдаче байка
          delivery: "pickup",
          subtotal: totalRub,
          extrasTotal: 0,
          promoDiscount: 0,
          totalAmount: totalRub,
          extras: [],
          cartLines: [
            {
              lineId: "storage-line",
              itemId: "storage", // NOT a catalog item — the per-bike loop skips it
              qty: 1,
              pricePerDay: Number(formValues.monthlyPriceRub),
              lineTotal: totalRub,
              options: {
                package: "Зимнее хранение",
                duration: monthsLabel || "сезон",
                perk: "Стандарт",
                auction: "Без аукциона",
              },
            },
          ],
          depositAmount: 0,
          checkoutBlockers: [],
          requiredDocs: [],
          flowType: "storage",
          storageDetails: {
            bikeMake: formValues.bikeTitle.trim(),
            bikeRegNumber: formValues.regNumber?.trim() || undefined,
            bikeColor: formValues.color?.trim() || undefined,
            bikeVin: formValues.vin?.trim() || undefined,
            bikeYear: formValues.year?.trim() || undefined,
            bikeMileage: formValues.mileageKm?.trim() || undefined,
            bikeAccessories: formValues.accessories?.trim() || undefined,
            bikeEstimatedValueRub: Number(formValues.estimatedValueRub),
            storageAddress: storagePlace,
            monthlyPriceRub: Number(formValues.monthlyPriceRub),
            noticeAddress: formValues.noticeAddress?.trim() || undefined,
          },
          pepInitData: pepInitData ?? undefined,
        });
      } catch (submitError) {
        console.warn("[storage] checkout action aborted", submitError);
        toast.error("Не удалось отправить заявку — соединение прервано. Проверьте чат: возможно, договор уже отправлен.", { duration: 10000 });
        return;
      }
      if (!result || typeof result !== "object" || !result.success) {
        toast.error((result && result.error) ?? "Не удалось отправить заявку.", { duration: 10000 });
        return;
      }
      setSuccess({ pepSigned: Boolean(pepInitData), total: totalRub });
    };

    run()
      .catch((err) => {
        console.warn("[storage] unexpected submit failure", err);
        toast.error("Неожиданная ошибка отправки. Попробуйте ещё раз.");
      })
      .finally(() => {
        submitLockRef.current = false;
        setSubmitPhase("idle");
      });
  });

  if (success) {
    return (
      <div className="rounded-2xl border border-sky-500/40 p-6 text-center" style={{ backgroundColor: "hsl(var(--card))" }}>
        <Snowflake className="mx-auto h-10 w-10 text-sky-400" aria-hidden="true" />
        <h2 className="mt-3 text-lg font-extrabold">Заявка принята ❄️</h2>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Договор хранения с актом приёма-передачи уже сгенерирован
          {success.pepSigned ? " и подписан вашей ПЭП (Telegram)" : ""}.
          {isInTelegramContext ? " Он отправлен вам в чат." : " Менеджер свяжется с вами для передачи байка."}
        </p>
        <p className="mt-2 text-sm font-bold">Итого за сезон: {storageFormatRub(success.total)} ₽</p>
        <div className="mt-5 flex flex-col gap-2">
          {isInTelegramContext ? (
            <Link
              href={`/franchize/${slug}/storage`}
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-sky-500 px-4 text-sm font-bold text-white transition hover:bg-sky-400"
            >
              🧊 Моё хранение — следить за статусом
            </Link>
          ) : null}
          <Link
            href={`/franchize/${slug}`}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border px-4 text-sm font-semibold transition active:scale-[0.98]"
            style={inputStyle}
          >
            В каталог {crewName}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmitValid} className="space-y-4">
      <div className="rounded-2xl border p-4" style={{ borderColor: "hsl(var(--border))", backgroundColor: "hsl(var(--card))" }}>
        <h1 className="flex items-center gap-2 text-lg font-extrabold">
          <Snowflake className="h-5 w-5 text-sky-400" aria-hidden="true" />
          Заявка на зимнее хранение
        </h1>
        <p className="mt-1 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
          Договор ответственного хранения + акт приёма-передачи с фотофиксацией.
          Место: {storagePlace}. Мотоцикл на хранении <b>не сдаётся в аренду</b>.
        </p>
      </div>

      {/* Владелец */}
      <section className="space-y-3 rounded-2xl border p-4" style={{ borderColor: "hsl(var(--border))", backgroundColor: "hsl(var(--card))" }}>
        <h2 className="text-sm font-extrabold">Владелец</h2>
        <Field label="ФИО (как в паспорте) *" error={errors.recipient?.message}>
          <input {...register("recipient")} className={inputClass} style={inputStyle} placeholder="Михалёв Роман Викторович" autoComplete="name" />
        </Field>
        <Field label="Телефон *" error={errors.phone?.message}>
          <input {...register("phone")} className={inputClass} style={inputStyle} placeholder="+7 909 283-82-49" inputMode="tel" autoComplete="tel" />
        </Field>
        <Field label="Адрес для уведомлений" error={errors.noticeAddress?.message} hint="Куда слать юридические уведомления (Акт приёма-передачи). Если пусто — используем адрес регистрации из паспорта.">
          <input {...register("noticeAddress")} className={inputClass} style={inputStyle} placeholder="г. Н. Новгород, ул. …" />
        </Field>
      </section>

      {/* Мото-транспорт */}
      <section className="space-y-3 rounded-2xl border p-4" style={{ borderColor: "hsl(var(--border))", backgroundColor: "hsl(var(--card))" }}>
        <h2 className="text-sm font-extrabold">Мотоцикл</h2>
        <Field label="Марка и модель *" error={errors.bikeTitle?.message}>
          <input {...register("bikeTitle")} className={inputClass} style={inputStyle} placeholder="SYM LM 25" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Гос. номер" error={errors.regNumber?.message}>
            <input {...register("regNumber")} className={inputClass} style={inputStyle} placeholder="1110 XX52" />
          </Field>
          <Field label="Год" error={errors.year?.message}>
            <input {...register("year")} className={inputClass} style={inputStyle} placeholder="2011" inputMode="numeric" />
          </Field>
          <Field label="VIN" error={errors.vin?.message}>
            <input {...register("vin")} className={inputClass} style={inputStyle} placeholder="RFGLM30WYB…" />
          </Field>
          <Field label="Цвет" error={errors.color?.message}>
            <input {...register("color")} className={inputClass} style={inputStyle} placeholder="чёрный" />
          </Field>
          <Field label="Пробег, км" error={errors.mileageKm?.message}>
            <input {...register("mileageKm")} className={inputClass} style={inputStyle} placeholder="35400" inputMode="numeric" />
          </Field>
          <Field label="Оценочная стоимость, ₽ *" error={errors.estimatedValueRub?.message} hint="Якорь ответственности Хранителя (п. 1.3/5.1 договора)">
            <input {...register("estimatedValueRub")} className={inputClass} style={inputStyle} placeholder="200000" inputMode="numeric" />
          </Field>
        </div>
        <Field label="Комплектность" error={errors.accessories?.message} hint="Что сдаётся вместе с байком — зафиксируем в Акте приёма-передачи">
          <textarea {...register("accessories")} rows={2} className="w-full rounded-xl border p-3 text-sm outline-none" style={inputStyle} placeholder="Чехол, кофр, ключи, документы…" />
        </Field>
      </section>

      {/* Сезон и цена */}
      <section className="space-y-3 rounded-2xl border p-4" style={{ borderColor: "hsl(var(--border))", backgroundColor: "hsl(var(--card))" }}>
        <h2 className="text-sm font-extrabold">Сезон и цена</h2>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Начало сезона *" error={errors.seasonStart?.message}>
            <input type="date" {...register("seasonStart")} className={inputClass} style={inputStyle} />
          </Field>
          <Field label="Окончание *" error={errors.seasonEnd?.message}>
            <input type="date" {...register("seasonEnd")} className={inputClass} style={inputStyle} />
          </Field>
        </div>
        {!datesValid ? (
          <p className="text-xs font-medium text-red-500">Дата окончания должна быть позже даты начала.</p>
        ) : null}
        <Field label="Ставка за месяц, ₽" error={errors.monthlyPriceRub?.message} hint="Менеджер подтвердит итоговую ставку при приёме байка">
          <input type="number" {...register("monthlyPriceRub")} className={inputClass} style={inputStyle} inputMode="numeric" min={0} step={500} />
        </Field>
        <div className="rounded-xl p-3" style={{ backgroundColor: "hsl(var(--muted) / 0.4)" }}>
          <p className="text-sm">
            {monthsLabel ? `Сезон: ${monthsLabel}. ` : ""}
            <b>Итого: {storageFormatRub(total)} ₽</b>
            <span className="ml-1 text-xs text-zinc-400">— оплата единовременно при сдаче байка (наличные / перевод)</span>
          </p>
        </div>
      </section>

      {/* Паспорт */}
      <section className="space-y-3 rounded-2xl border p-4" style={{ borderColor: "hsl(var(--border))", backgroundColor: "hsl(var(--card))" }}>
        <h2 className="text-sm font-extrabold">Паспорт владельца</h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Договор хранения подписывает ВЛАДЕЛЕЦ (не арендатор) — реквизиты обязательны.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Серия *" error={errors.passportSeries?.message}>
            <input {...register("passportSeries")} className={inputClass} style={inputStyle} placeholder="2218" inputMode="numeric" />
          </Field>
          <Field label="Номер *" error={errors.passportNumber?.message}>
            <input {...register("passportNumber")} className={inputClass} style={inputStyle} placeholder="847941" inputMode="numeric" />
          </Field>
        </div>
        <Field label="Дата выдачи" error={errors.passportIssueDate?.message}>
          <input {...register("passportIssueDate")} className={inputClass} style={inputStyle} placeholder="12.05.2010" />
        </Field>
        <Field label="Кем выдан" error={errors.passportIssuedBy?.message}>
          <input {...register("passportIssuedBy")} className={inputClass} style={inputStyle} placeholder="Отделением УФМС…" />
        </Field>
      </section>

      {/* ПЭП */}
      <section className="rounded-2xl border p-4" style={{ borderColor: pepInitData ? "rgba(14,165,233,0.5)" : "hsl(var(--border))", backgroundColor: pepInitData ? "rgba(14,165,233,0.08)" : "hsl(var(--card))" }}>
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={Boolean(pepInitData)}
            onChange={() => {
              if (pepInitData) {
                setPepInitData(null);
                setPepUserOptedOut(true);
                return;
              }
              const initData = getTelegramInitData();
              if (!initData || initData.length < 32) {
                toast.error("ПЭП-подпись доступна в Telegram — откройте приложение через бота. Заявку можно отправить и без подписи.");
                return;
              }
              setPepInitData(initData);
              toast.success("Договор будет подписан вашей ПЭП (аккаунт Telegram).");
            }}
            className="mt-1 h-4 w-4"
          />
          <span className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">
            <PenLine className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />
            <b>ПЭП — простая электронная подпись (ст. 5–6 63-ФЗ).</b>{" "}
            {pepInitData
              ? "Договор будет подписан вашим Telegram-аккаунтом при отправке заявки."
              : "Нажав «Отправить заявку», вы соглашаетесь с договором; подпись Telegram можно поставить в мини-аппе."}
          </span>
        </label>
      </section>

      <button
        type="submit"
        disabled={submitPhase === "sending"}
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-sky-500 text-sm font-extrabold text-white transition hover:bg-sky-400 active:scale-[0.99] disabled:opacity-60"
      >
        {submitPhase === "sending" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Snowflake className="h-4 w-4" aria-hidden="true" />}
        {submitPhase === "sending" ? "Оформляем…" : `Отправить заявку · ${storageFormatRub(total)} ₽`}
      </button>
      <p className="pb-4 text-center text-xs text-zinc-400">
        Нажимая кнопку, вы соглашаетесь с условиями договора ответственного хранения и обработкой персональных данных (152-ФЗ).
      </p>
    </form>
  );
}
