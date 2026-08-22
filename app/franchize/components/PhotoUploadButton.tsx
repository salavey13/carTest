"use client";

import { useState, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface PhotoUploadButtonProps {
  docType: "passport_mainpage" | "passport_registration" | "drivers_licence";
  rentalId: string;
  chatId: string;
  onSuccess?: () => void;
}

/**
 * Уменьшает разрешение изображения (client-side).
 * Максимальный размер: 1920px по большей стороне.
 * Качество JPEG: 85%.
 */
async function reduceImageResolution(file: File, maxSize = 1920): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      reject(new Error("Canvas context not available"));
      return;
    }

    img.onload = () => {
      let { width, height } = img;

      // Уменьшаем если больше maxSize
      if (width > maxSize || height > maxSize) {
        if (width > height) {
          height = Math.round((height * maxSize) / width);
          width = maxSize;
        } else {
          width = Math.round((width * maxSize) / height);
          height = maxSize;
        }
      }

      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error("Failed to create blob"));
          }
        },
        "image/jpeg",
        0.85
      );
    };

    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = URL.createObjectURL(file);
  });
}

export function PhotoUploadButton({ docType, rentalId, chatId, onSuccess }: PhotoUploadButtonProps) {
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Валидация
    if (!file.type.startsWith("image/")) {
      setMessage({ type: "error", text: "Пожалуйста, выберите изображение" });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setMessage({ type: "error", text: "Файл слишком большой (макс. 10 МБ)" });
      return;
    }

    setUploading(true);
    setMessage(null);

    try {
      // 1. Уменьшаем разрешение
      const reducedBlob = await reduceImageResolution(file);

      // 2. Загружаем в Supabase Storage (docpix bucket)
      const storagePath = `${rentalId}/${docType}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from("docpix")
        .upload(storagePath, reducedBlob, {
          contentType: "image/jpeg",
          upsert: true,
        });

      if (uploadError) {
        throw new Error(`Загрузка не удалась: ${uploadError.message}`);
      }

      // 3. Fire-and-forget POST на VPS OCR API
      // Не ждем ответа - пользователь продолжает заполнять форму
      fetch("https://rental.vip-bike.ru/api/docphotoocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storagePath,
          rentalId,
          docType,
          chatId,
        }),
      }).catch((err) => {
        console.error("[OCR] Fire-and-forget failed:", err);
        // Не показываем ошибку пользователю - это background процесс
      });

      // 4. Показываем success message
      const successMessages = {
        passport_mainpage: "✅ Главная страница паспорта загружена! Данные будут обработаны автоматически.",
        passport_registration: "✅ Страница с пропиской загружена! Данные будут обработаны автоматически.",
        drivers_licence: "✅ Водительское удостоверение загружено! Данные будут обработаны автоматически.",
      };
      setMessage({
        type: "success",
        text: successMessages[docType],
      });

      // 5. Вызываем onSuccess callback
      onSuccess?.();

      // 6. Очищаем file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (err) {
      console.error("[PhotoUpload] Error:", err);
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Ошибка загрузки",
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      {/* Скрытый file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment" // Камера на мобильных
        onChange={handleFileSelect}
        disabled={uploading}
        className="hidden"
      />

      {/* Кнопка загрузки */}
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className="flex items-center gap-2 rounded-xl border border-dashed px-4 py-3 text-sm transition-all hover:border-solid disabled:opacity-50"
        style={{
          borderColor: uploading ? "#9ca3af" : "#3b82f6",
          color: uploading ? "#9ca3af" : "#3b82f6",
        }}
      >
        {uploading ? (
          <>
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span>Загрузка...</span>
          </>
        ) : (
          <>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
              />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span>
              {docType === "passport_mainpage" && "Загрузить главную страницу паспорта"}
              {docType === "passport_registration" && "Загрузить страницу с пропиской"}
              {docType === "drivers_licence" && "Загрузить водительское удостоверение"}
            </span>
          </>
        )}
      </button>

      {/* Сообщение */}
      {message && (
        <div
          className="rounded-lg px-3 py-2 text-xs"
          style={{
            backgroundColor: message.type === "success" ? "#d1fae5" : "#fee2e2",
            color: message.type === "success" ? "#065f46" : "#991b1b",
          }}
        >
          {message.text}
        </div>
      )}

      {/* Подсказка */}
      <p className="text-xs" style={{ color: "#6b7280" }}>
        {docType === "passport_mainpage" && "Сфотографируйте разворот паспорта с фото и основными данными"}
        {docType === "passport_registration" && "Сфотографируйте страницу паспорта с адресом регистрации (пропиской)"}
        {docType === "drivers_licence" && "Сфотографируйте лицевую сторону водительского удостоверения"}
      </p>
    </div>
  );
}
