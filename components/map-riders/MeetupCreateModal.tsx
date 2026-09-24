"use client";

// /components/map-riders/MeetupCreateModal.tsx
// Модалка создания meetup-точки с карты: название + ОПЦИОНАЛЬНОЕ фото
// («please allow to add respective photo (to be used for icon on map)»).
// Фото сжимается на клиенте (тот же reduceImageResolution, что у стены) —
// на сервер уходит уже лёгкий blob; маркер на карте носит фото круглой
// аватаркой (photo_url в map_rider_meetups, миграция 20260925120000).

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { reduceImageResolution } from "@/lib/client-image-compress";

type MeetupCreateModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (value: string, photoFile: File | null) => void;
  title: string;
  placeholder?: string;
  defaultValue?: string;
  saving?: boolean;
};

const MEETUP_PHOTO_MAX_EDGE = 1280;

export function MeetupCreateModal({
  open,
  onClose,
  onSubmit,
  title,
  placeholder = "Введите значение",
  defaultValue = "",
  saving = false,
}: MeetupCreateModalProps) {
  const [value, setValue] = useState(defaultValue);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [compressing, setCompressing] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  // Revoke the previous blob when the preview URL changes or the modal unmounts
  // (a 10–25 MB source must not stay retained in the session).
  const prevPreviewRef = useRef<string | null>(null);

  useEffect(() => {
    if (open) {
      setValue(defaultValue);
    } else {
      // Closed (cancel / X / Escape / успешный сабмит) — состояние модалки
      // сбрасывается ЦЕЛИКОМ здесь: и файл, и превью. Превью без файла —
      // ловушка «UI показывает фото, но createMeetup уйдёт без него».
      setPhotoFile(null);
      setPhotoPreviewUrl(null); // revoke делает revoke-эффект ниже
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  }, [open, defaultValue]);

  useEffect(() => {
    if (prevPreviewRef.current && prevPreviewRef.current !== photoPreviewUrl) {
      URL.revokeObjectURL(prevPreviewRef.current);
    }
    prevPreviewRef.current = photoPreviewUrl;
  }, [photoPreviewUrl]);

  useEffect(() => {
    return () => {
      if (prevPreviewRef.current) URL.revokeObjectURL(prevPreviewRef.current);
    };
  }, []);

  const pickPhoto = async (file: File | undefined | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Это не похоже на фото — выбери изображение");
      return;
    }
    setCompressing(true);
    try {
      const blob = await reduceImageResolution(file, { maxSize: MEETUP_PHOTO_MAX_EDGE, quality: 0.7 });
      const compressed = new File([blob], "meetup-photo.jpg", { type: blob.type || "image/jpeg" });
      setPhotoFile(compressed);
      setPhotoPreviewUrl(URL.createObjectURL(compressed));
    } catch {
      toast.error("Не удалось обработать фото — попробуй другое");
    } finally {
      setCompressing(false);
    }
  };

  const removePhoto = () => {
    setPhotoFile(null);
    setPhotoPreviewUrl(null);
    if (photoInputRef.current) photoInputRef.current.value = "";
  };

  // Минимум 2 символа — тот же контракт, что валидирует useMeetupCreator;
  // кнопка не даёт сабмитить заведомо невалидное название (фото не теряется
  // на неуспешной попытке — модалка остаётся открытой родителем).
  const titleTooShort = value.trim().length < 2;

  const submit = () => {
    if (titleTooShort) return;
    // Файл/превью СОЗНАТЕЛЬНО не чистятся здесь: родитель решает, закрыть
    // модалку (успех → open-effect всё сбросит) или оставить открытой
    // (ошибка валидации → текст и фото сохраняются для повторной попытки).
    onSubmit(value, photoFile);
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (!nextOpen ? onClose() : null)}>
      <DialogContent className="border-[var(--dialog-border)] bg-[var(--dialog-bg)] text-[var(--dialog-text)] backdrop-blur-md" style={
        {
          "--dialog-border": "hsl(var(--border))",
          "--dialog-bg": "hsl(var(--background))",
          "--dialog-text": "hsl(var(--foreground))",
        } as React.CSSProperties
      }>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="text-[var(--dialog-muted)]" style={
            {
              "--dialog-muted": "hsl(var(--muted-foreground))",
            } as React.CSSProperties
          }>Название — обязательно, фото — по желанию: точка на карте будет носить его круглой аватаркой.</DialogDescription>
        </DialogHeader>

        <Input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={placeholder}
          autoFocus
        />

        {/* Photo picker: compact preview + remove, no photo → dashed slot.
            Same hidden-input pattern as the wall composer. */}
        <div className="flex items-center gap-3">
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              void pickPhoto(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          {photoPreviewUrl ? (
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full border border-[hsl(var(--border))]">
              {/* eslint-disable-next-line @next/next/no-img-element -- local blob: preview URL, same pattern as the map popups */}
              <img src={photoPreviewUrl} alt="Фото точки" className="h-16 w-16 object-cover" />
              <button
                type="button"
                onClick={removePhoto}
                aria-label="Убрать фото"
                className="absolute inset-x-0 bottom-0 min-h-[24px] bg-black/70 py-1 text-center text-[11px] font-semibold text-white"
              >
                убрать
              </button>
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => photoInputRef.current?.click()}
            disabled={compressing}
            className="min-h-[44px] flex-1 rounded-xl border border-dashed border-[hsl(var(--border))] px-3 text-xs font-medium text-[hsl(var(--muted-foreground))] transition hover:border-amber-400 disabled:opacity-50"
          >
            {compressing ? "Готовим фото…" : photoFile ? "Заменить фото" : "Добавить фото (необязательно)"}
          </button>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Отмена
          </Button>
          <Button
            type="button"
            className="bg-amber-400 text-black hover:bg-amber-300 focus-visible:ring-amber-400"
            onClick={submit}
            disabled={saving || compressing || titleTooShort}
            title={titleTooShort ? "Название — минимум 2 символа" : undefined}
          >
            {saving ? "Сохраняем…" : "Подтвердить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
