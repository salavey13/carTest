"use client";
import React, { useEffect, useState } from "react";
import StreamEditorForm, { defaultStreamTemplate } from "./StreamEditorForm";
import StreamOverlay, { StreamConfig } from "./StreamOverlay";
import { useAppContext } from "@/contexts/AppContext";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

export default function StreamManager({
  initialConfig,
}: {
  initialConfig?: StreamConfig | null;
}) {
  const { dbUser, refreshDbUser } = useAppContext();
  const supabase = getSupabaseBrowserClient();
  const [config, setConfig] = useState<StreamConfig | null>(
    initialConfig ?? null
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [mode, setMode] = useState<"admin" | "public">("admin");
  const [previewVisible, setPreviewVisible] = useState(false);

  useEffect(() => {
    if (!config) {
      const savedConfig = dbUser?.metadata?.streamConfig as StreamConfig | undefined;
      setConfig(savedConfig || defaultStreamTemplate());
    }
  }, [config, dbUser]);

  useEffect(() => {
    if (!config || !playing) return;
    let mounted = true;
    const curr = config.sections[activeIndex];
    const duration = (curr?.durationSec ?? 8) * 1000;
    const timer = setTimeout(() => {
      if (!mounted) return;
      const next = (activeIndex + 1) % (config.sections.length || 1);
      setActiveIndex(next);
    }, duration);
    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [playing, activeIndex, config]);

  const handleSave = async (next: StreamConfig) => {
    setConfig(next);
    if (dbUser) {
      const currentMeta = dbUser.metadata || {};
      await supabase
        .from("users")
        .update({ metadata: { ...currentMeta, streamConfig: next } })
        .eq("user_id", dbUser.user_id);
      refreshDbUser();
    }
  };

  if (!config) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={() => setMode(mode === "admin" ? "public" : "admin")}
          className="px-3 py-1 rounded-lg bg-gray-800 border border-border text-white text-sm hover:bg-gray-700 transition" // Dark bg, white text
        >
          {mode === "admin"
            ? "Переключить в PUBLIC (OBS)"
            : "Вернуться в ADMIN"}
        </button>
        <button
          onClick={() => setPlaying(!playing)}
          className={`px-3 py-1 rounded-lg text-sm shadow transition ${
            playing
              ? "bg-destructive text-white hover:bg-destructive/90"
              : "bg-green-500 text-white hover:bg-green-600"
          }`} // White text
        >
          {playing ? "Стоп" : "Запустить авто-демо"}
        </button>
        <button
          onClick={() => setPreviewVisible(!previewVisible)}
          className="px-3 py-1 rounded-lg bg-gray-800 border border-border text-white text-sm hover:bg-gray-700 transition" // Dark bg, white text
        >
          {previewVisible ? "Скрыть превью" : "Показать превью"}
        </button>
        <div className="ml-auto text-xs text-gray-300">
          Активная секция: {activeIndex + 1}/{config.sections.length}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <StreamEditorForm
            initial={config}
            onSave={handleSave}
          />
        </div>

        <aside className="space-y-4">
          <div className="p-4 border border-border rounded-lg bg-gray-900 shadow-sm"> {/* Dark bg */}
            <h4 className="font-semibold mb-2 text-white">Контроллер</h4> {/* White text */}
            <div className="flex flex-col gap-2">
              <label className="text-xs text-gray-300">
                Выбрать секцию
              </label> {/* Light gray */}
              <input
                type="range"
                min={0}
                max={Math.max(0, (config.sections.length || 1) - 1)}
                value={activeIndex}
                onChange={(e) => setActiveIndex(Number(e.target.value))}
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => setActiveIndex(Math.max(0, activeIndex - 1))}
                  className="px-2 py-1 bg-gray-800 border border-border rounded text-white text-sm hover:bg-gray-700" // Dark bg, white text
                >
                  Prev
                </button>
                <button
                  onClick={() =>
                    setActiveIndex(
                      (activeIndex + 1) % Math.max(1, config.sections.length)
                    )
                  }
                  className="px-2 py-1 bg-gray-800 border border-border rounded text-white text-sm hover:bg-gray-700" // Dark bg, white text
                >
                  Next
                </button>
              </div>
              <div className="mt-3 text-xs text-gray-300">
                Режим: <strong>{mode}</strong>. В Public overlay получает
                pointer-events: none для OBS. Если секция greenScreen=true —
                фон #00ff00 для хромакея.
              </div> {/* Light gray */}
            </div>
          </div>

          <div className="p-4 border border-border rounded-lg bg-gray-900 shadow-sm"> {/* Dark bg */}
            <h4 className="font-semibold mb-2 text-white">
              Превью (публичное)
            </h4> {/* White text */}
            <div className="p-2 bg-gray-800 rounded"> {/* Darker bg */}
              <div className="text-xs text-gray-300 mb-2">
                Нажми &quot;Показать превью&quot; чтобы увидеть fullscreen
                overlay.
              </div> {/* Light gray */}
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setPreviewVisible(true);
                    setMode("public");
                  }}
                  className="px-2 py-1 bg-brand-cyan text-white rounded text-sm shadow hover:bg-brand-cyan/90 transition" // White text
                >
                  Публичный preview
                </button>
                <button
                  onClick={() => {
                    setPreviewVisible(true);
                    setMode("admin");
                  }}
                  className="px-2 py-1 bg-gray-800 border border-border rounded text-white text-sm hover:bg-gray-700 transition" // Dark bg, white text
                >
                  Admin preview
                </button>
              </div>
            </div>
          </div>

          <div className="p-4 border border-border rounded-lg bg-gray-900 shadow-sm"> {/* Dark bg */}
            <h4 className="font-semibold mb-2 text-white">
              Экспорт / Бот
            </h4> {/* White text */}
            <div className="text-xs text-gray-300 mb-2">
              Скопировать JSON для бота или сервера.
            </div> {/* Light gray */}
            <button
              onClick={() => {
                navigator.clipboard
                  .writeText(JSON.stringify(config, null, 2))
                  .then(() => alert("JSON скопирован"));
              }}
              className="px-2 py-1 bg-green-500 text-white rounded text-sm shadow hover:bg-green-600 transition" // White text
            >
              Copy JSON
            </button>
          </div>
        </aside>
      </div>

      <StreamOverlay
        config={config}
        activeIndex={activeIndex}
        visible={previewVisible}
        mode={mode}
        onClose={() => setPreviewVisible(false)}
      />
    </div>
  );
}