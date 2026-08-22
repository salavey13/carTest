// /components/streamer/StreamEditorForm.tsx
"use client";
import React, { useState } from "react";
import type { StreamConfig, StreamSection } from "./StreamOverlay";
import { v4 as uuidv4 } from "uuid";

export const defaultStreamTemplate = (): StreamConfig => ({
  id: uuidv4(),
  title: "Demo Stream",
  description: "Это базовый шаблон для стрима.",
  sections: [
    {
      id: uuidv4(),
      title: "Приветствие",
      type: "text",
      text: "Добро пожаловать на наш стрим! 🚀",
      durationSec: 6,
      overlayOpacity: 1,
      showDecorations: true,
    },
  ],
  lastUpdated: Date.now(),
});

export default function StreamEditorForm({
  initial,
  onSave,
}: {
  initial: StreamConfig;
  onSave: (cfg: StreamConfig) => void;
}) {
  const [config, setConfig] = useState<StreamConfig>(initial);

  const updateSection = (id: string, patch: Partial<StreamSection>) => {
    setConfig((prev) => ({
      ...prev,
      sections: prev.sections.map((s) =>
        s.id === id ? { ...s, ...patch } : s
      ),
      lastUpdated: Date.now(),
    }));
  };

  const addSection = (type: StreamSection["type"]) => {
    const newSection: StreamSection = {
      id: uuidv4(),
      title: type === "text" ? "Новый текст" : "Медиа",
      type,
      durationSec: 6,
      overlayOpacity: 1,
    };
    setConfig((prev) => ({
      ...prev,
      sections: [...prev.sections, newSection],
      lastUpdated: Date.now(),
    }));
  };

  const removeSection = (id: string) => {
    setConfig((prev) => ({
      ...prev,
      sections: prev.sections.filter((s) => s.id !== id),
      lastUpdated: Date.now(),
    }));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    // Basic validation
    const invalidSections = config.sections.filter(s => 
      (s.type !== "text" && !s.mediaUrl) || (s.type === "text" && !s.text)
    );
    if (invalidSections.length > 0) {
      alert("Пожалуйста, заполните все обязательные поля в секциях (mediaUrl или text).");
      return;
    }
    onSave(config);
  };

  return (
    <form
      onSubmit={handleSave}
      className="space-y-6"
    >
      {/* Основные настройки */}
      <div className="p-4 bg-card border border-border rounded-lg shadow-sm">
        <h3 className="text-lg font-semibold text-foreground mb-3">
          Основные настройки
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">Название стрима</span>
            <input
              type="text"
              value={config.title}
              onChange={(e) =>
                setConfig({ ...config, title: e.target.value })
              }
              className="input-cyber"
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm md:col-span-2">
            <span className="text-muted-foreground">Описание</span>
            <textarea
              value={config.description || ""}
              onChange={(e) =>
                setConfig({ ...config, description: e.target.value })
              }
              className="textarea-cyber min-h-[80px]"
            />
          </label>
        </div>
      </div>

      {/* Секции */}
      <div className="p-4 bg-card border border-border rounded-lg shadow-sm">
        <h3 className="text-lg font-semibold text-foreground mb-3">
          Секции
        </h3>
        <div className="space-y-4">
          {config.sections.map((s, idx) => (
            <div
              key={s.id}
              className="p-3 border border-border rounded-md bg-muted space-y-2"
            >
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-sm text-foreground">
                  {idx + 1}. {s.title || "Без названия"}
                </h4>
                <button
                  type="button"
                  onClick={() => removeSection(s.id)}
                  className="px-2 py-1 rounded bg-destructive text-destructive-foreground text-xs hover:bg-destructive/90 transition"
                >
                  Удалить
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="flex flex-col text-xs gap-1">
                  <span className="text-muted-foreground">Заголовок</span>
                  <input
                    value={s.title}
                    onChange={(e) =>
                      updateSection(s.id, { title: e.target.value })
                    }
                    className="input-cyber"
                  />
                </label>
                <label className="flex flex-col text-xs gap-1">
                  <span className="text-muted-foreground">Тип</span>
                  <select
                    value={s.type}
                    onChange={(e) =>
                      updateSection(s.id, {
                        type: e.target.value as StreamSection["type"],
                      })
                    }
                    className="input-cyber"
                  >
                    <option value="text">Текст</option>
                    <option value="image">Изображение</option>
                    <option value="video">Видео</option>
                  </select>
                </label>
                {s.type !== "text" && (
                  <label className="flex flex-col text-xs gap-1 md:col-span-2">
                    <span className="text-muted-foreground">Media URL</span>
                    <input
                      value={s.mediaUrl || ""}
                      onChange={(e) =>
                        updateSection(s.id, { mediaUrl: e.target.value })
                      }
                      placeholder="https://..."
                      className="input-cyber"
                      required
                    />
                  </label>
                )}
                {s.type === "text" && (
                  <label className="flex flex-col text-xs gap-1 md:col-span-2">
                    <span className="text-muted-foreground">Текст</span>
                    <textarea
                      value={s.text || ""}
                      onChange={(e) =>
                        updateSection(s.id, { text: e.target.value })
                      }
                      className="textarea-cyber min-h-[60px]"
                      required
                    />
                  </label>
                )}
                <label className="flex flex-col text-xs gap-1">
                  <span className="text-muted-foreground">Длительность (сек)</span>
                  <input
                    type="number"
                    value={s.durationSec || 6}
                    onChange={(e) =>
                      updateSection(s.id, {
                        durationSec: Number(e.target.value),
                      })
                    }
                    className="input-cyber"
                  />
                </label>
                <label className="flex flex-col text-xs gap-1">
                  <span className="text-muted-foreground">Прозрачность</span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.1}
                    value={s.overlayOpacity ?? 1}
                    onChange={(e) =>
                      updateSection(s.id, {
                        overlayOpacity: Number(e.target.value),
                      })
                    }
                  />
                </label>
              </div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-4">
          <button
            type="button"
            onClick={() => addSection("text")}
            className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm hover:bg-muted/80 transition"
          >
            + Текст
          </button>
          <button
            type="button"
            onClick={() => addSection("image")}
            className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm hover:bg-muted/80 transition"
          >
            + Изображение
          </button>
          <button
            type="button"
            onClick={() => addSection("video")}
            className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm hover:bg-muted/80 transition"
          >
            + Видео
          </button>
        </div>
      </div>

      {/* Submit */}
      <button
        type="submit"
        className="w-full px-4 py-2 rounded-lg bg-primary text-primary-foreground text-base font-medium shadow hover:bg-primary/90 transition"
      >
        Сохранить настройки
      </button>
    </form>
  );
}