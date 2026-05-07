"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useAppContext } from "@/contexts/AppContext";
import { submitRentalReview, type FranchizeTheme, type RentalReviewVM } from "../../../actions";
import { crewPaletteForSurface } from "../../../lib/theme";

interface ReviewFormProps {
  slug: string;
  rentalId: string;
  bikeTitle: string;
  status: string;
  renterUserId: string;
  theme: FranchizeTheme;
  existingReview?: RentalReviewVM;
}

export function ReviewForm({ slug, rentalId, bikeTitle, status, renterUserId, theme, existingReview }: ReviewFormProps) {
  const { dbUser, initData, isLoading } = useAppContext();
  const [rating, setRating] = useState(existingReview?.rating ?? 5);
  const [text, setText] = useState(existingReview?.text ?? "");
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();
  const surface = crewPaletteForSurface(theme);
  const isCompleted = status === "completed";
  const isRenter = Boolean(dbUser?.user_id) && dbUser?.user_id === renterUserId;
  const canSubmit = isCompleted && isRenter;

  const onSubmit = () => {
    if (!dbUser?.user_id) {
      toast.error("Откройте ссылку из Telegram WebApp, чтобы сохранить отзыв.");
      return;
    }
    if (!initData) {
      toast.error("Не удалось подтвердить Telegram WebApp-сессию. Откройте отзыв из Telegram.");
      return;
    }
    startTransition(async () => {
      const result = await submitRentalReview({ slug, rentalId, initData, rating, text });
      if (!result.success) {
        toast.error(result.error || "Не удалось сохранить отзыв");
        return;
      }
      setSaved(true);
      toast.success("Спасибо! Отзыв сохранён.");
    });
  };

  return (
    <div className="mx-auto w-full max-w-xl rounded-3xl border p-4 shadow-2xl sm:p-6" style={surface.card}>
      <p className="text-xs uppercase tracking-[0.18em]" style={{ color: theme.palette.accentMain }}>friend review</p>
      <h1 className="mt-2 text-2xl font-semibold">Как прошла аренда?</h1>
      <p className="mt-2 text-sm" style={surface.mutedText}>{bikeTitle}</p>

      {!isCompleted ? (
        <div className="mt-4 rounded-2xl border p-3 text-sm" style={surface.subtleCard}>
          Отзыв откроется после статуса <b>completed</b>. Сейчас: <b>{status || "unknown"}</b>.
        </div>
      ) : null}

      {isCompleted && dbUser?.user_id && !isRenter ? (
        <div className="mt-4 rounded-2xl border p-3 text-sm" style={surface.subtleCard}>
          Этот отзыв привязан к Telegram-профилю арендатора. Откройте ссылку из аккаунта, который оформлял аренду.
        </div>
      ) : null}

      <div className="mt-5 flex gap-2" aria-label="rating">
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setRating(value)}
            className="h-11 flex-1 rounded-2xl border text-lg font-bold transition active:scale-95 disabled:opacity-60"
            style={{
              borderColor: value <= rating ? theme.palette.accentMain : theme.palette.borderSoft,
              backgroundColor: value <= rating ? theme.palette.accentMain : "transparent",
              color: value <= rating ? "#16130A" : theme.palette.textPrimary,
            }}
            disabled={!canSubmit || isPending}
          >
            ★
          </button>
        ))}
      </div>

      <label className="mt-4 block text-sm font-medium">
        Пара слов для друзей
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={5}
          className="mt-2 w-full rounded-2xl border px-3 py-2 text-sm outline-none"
          style={{ borderColor: theme.palette.borderSoft, backgroundColor: theme.palette.bgBase, color: theme.palette.textPrimary }}
          placeholder="Что понравилось, кому подойдёт байк, как прошла выдача..."
          disabled={!canSubmit || isPending}
          maxLength={1200}
        />
      </label>

      <button
        type="button"
        onClick={onSubmit}
        disabled={!canSubmit || isPending || isLoading}
        className="mt-4 w-full rounded-2xl px-4 py-3 text-sm font-bold transition active:scale-[0.99] disabled:opacity-60"
        style={{ backgroundColor: theme.palette.accentMain, color: "#16130A" }}
      >
        {isPending ? "Сохраняем..." : saved || existingReview ? "Обновить отзыв" : "Сохранить отзыв"}
      </button>

      <Link href={`/franchize/${slug}`} className="mt-4 inline-flex text-sm underline underline-offset-4" style={{ color: theme.palette.accentMain }}>
        Вернуться в каталог
      </Link>
    </div>
  );
}
