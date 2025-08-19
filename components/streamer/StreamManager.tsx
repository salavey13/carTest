// /components/streamer/StreamManager.tsx
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
          className="px-3 py-1 rounded-lg bg-muted border border-border text-foreground text-sm hover:bg-muted/80 transition"
        >
          {mode === "admin"
            ? "Переключить в PUBLIC (OBS)"
            : "Вернуться в ADMIN"}
        </button>
        <button
          onClick={() => setPlaying(!playing)}
          className={`px-3 py-1 rounded-lg text-sm shadow transition ${
            playing
              ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
              : "bg-accent text-accent-foreground hover:bg-accent/90"
          }`}
        >
          {playing ? "Стоп" : "Запустить авто-демо"}
        </button>
        <button
          onClick={() => setPreviewVisible(!previewVisible)}
          className="px-3 py-1 rounded-lg bg-muted border border-border text-foreground text-sm hover:bg-muted/80 transition"
        >
          {previewVisible ? "Скрыть превью" : "Показать превью"}
        </button>
        <div className="ml-auto text-xs text-muted-foreground">
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
          <div className="p-4 border border-border rounded-lg bg-card shadow-sm">
            <h4 className="font-semibold mb-2 text-foreground">Контроллер</h4>
            <div className="flex flex-col gap-2">
              <label className="text-xs text-muted-foreground">
                Выбрать секцию
              </label>
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
                  className="px-2 py-1 bg-muted border border-border rounded text-foreground text-sm hover:bg-muted/80"
                >
                  Prev
                </button>
                <button
                  onClick={() =>
                    setActiveIndex(
                      (activeIndex + 1) % Math.max(1, config.sections.length)
                    )
                  }
                  className="px-2 py-1 bg-muted border border-border rounded text-foreground text-sm hover:bg-muted/80"
                >
                  Next
                </button>
              </div>
              <div className="mt-3 text-xs text-muted-foreground">
                Режим: <strong>{mode}</strong>. В Public overlay получает
                pointer-events: none для OBS. Если секция greenScreen=true —
                фон #00ff00 для хромакея.
              </div>
            </div>
          </div>

          <div className="p-4 border border-border rounded-lg bg-card shadow-sm">
            <h4 className="font-semibold mb-2 text-foreground">
              Превью (публичное)
            </h4>
            <div className="p-2 bg-muted rounded">
              <div className="text-xs text-muted-foreground mb-2">
                Нажми &quot;Показать превью&quot; чтобы увидеть fullscreen
                overlay.
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setPreviewVisible(true);
                    setMode("public");
                  }}
                  className="px-2 py-1 bg-primary text-primary-foreground rounded text-sm shadow hover:bg-primary/90 transition"
                >
                  Публичный preview
                </button>
                <button
                  onClick={() => {
                    setPreviewVisible(true);
                    setMode("admin");
                  }}
                  className="px-2 py-1 bg-muted border border-border rounded text-foreground text-sm hover:bg-muted/80 transition"
                >
                  Admin preview
                </button>
              </div>
            </div>
          </div>

          <div className="p-4 border border-border rounded-lg bg-card shadow-sm">
            <h4 className="font-semibold mb-2 text-foreground">
              Экспорт / Бот
            </h4>
            <div className="text-xs text-muted-foreground mb-2">
              Скопировать JSON для бота или сервера.
            </div>
            <button
              onClick={() => {
                navigator.clipboard
                  .writeText(JSON.stringify(config, null, 2))
                  .then(() => alert("JSON скопирован"));
              }}
              className="px-2 py-1 bg-accent text-accent-foreground rounded text-sm shadow hover:bg-accent/90 transition"
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