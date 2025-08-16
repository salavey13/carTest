"use client";
import React, { useEffect, useState } from "react";
import StreamEditorForm, { defaultStreamTemplate } from "./StreamEditorForm";
import StreamOverlay, { StreamConfig } from "./StreamOverlay";

export default function StreamManager({ initialConfig }: { initialConfig?: StreamConfig | null }) {
  const [config, setConfig] = useState<StreamConfig | null>(initialConfig ?? null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [mode, setMode] = useState<"admin" | "public">("admin");
  const [previewVisible, setPreviewVisible] = useState(false);

  useEffect(() => {
    if (!config) setConfig(defaultStreamTemplate());
  }, [config]);

  useEffect(() => {
    if (!config || !playing) return;
    // auto-advance sections by duration (simple)
    let mounted = true;
    const curr = config.sections[activeIndex];
    const duration = (curr?.durationSec ?? 8) * 1000;
    const timer = setTimeout(() => {
      if (!mounted) return;
      const next = (activeIndex + 1) % (config.sections.length || 1);
      setActiveIndex(next);
    }, duration);
    return () => { mounted = false; clearTimeout(timer); };
  }, [playing, activeIndex, config]);

  if (!config) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => setMode(mode === "admin" ? "public" : "admin")} className="px-3 py-1 rounded bg-slate-100">{mode === "admin" ? "Переключить в PUBLIC (для OBS)" : "Вернуться в ADMIN"}</button>
        <button onClick={() => setPlaying(!playing)} className={`px-3 py-1 rounded ${playing ? "bg-red-500 text-white" : "bg-green-500 text-white"}`}>{playing ? "Стоп" : "Запустить авто-демо"}</button>
        <button onClick={() => setPreviewVisible(!previewVisible)} className="px-3 py-1 rounded bg-slate-100">{previewVisible ? "Скрыть превью" : "Показать превью"}</button>
        <div className="ml-auto text-sm text-slate-600">Активная секция: {activeIndex + 1}/{config.sections.length}</div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <StreamEditorForm
            initial={config}
            onSave={(next) => {
              setConfig(next);
            }}
          />
        </div>

        <aside className="space-y-3">
          <div className="p-3 border rounded bg-white">
            <h4 className="font-semibold mb-2">Контроллер</h4>
            <div className="flex flex-col gap-2">
              <label className="text-xs">Выбрать секцию</label>
              <input type="range" min={0} max={Math.max(0, (config.sections.length || 1) - 1)} value={activeIndex} onChange={(e) => setActiveIndex(Number(e.target.value))} />
              <div className="flex gap-2 mt-2">
                <button onClick={() => setActiveIndex(Math.max(0, activeIndex - 1))} className="px-2 py-1 bg-slate-100 rounded">Prev</button>
                <button onClick={() => setActiveIndex((activeIndex + 1) % Math.max(1, config.sections.length))} className="px-2 py-1 bg-slate-100 rounded">Next</button>
              </div>
              <div className="mt-3 text-xs text-slate-600">
                Режим: <strong>{mode}</strong>. Public mode делает overlay pointer-events: none и подходит для захвата в OBS (наложи chroma-key если секция greenScreen=true).
              </div>
            </div>
          </div>

          <div className="p-3 border rounded bg-white">
            <h4 className="font-semibold mb-2">Превью (публичное)</h4>
            <div className="p-2 bg-slate-50 rounded">
              <div className="text-xs text-slate-600 mb-2">Нажми "Показать превью" чтобы увидеть fullscreen overlay (client-side).</div>
              <div className="flex gap-2">
                <button onClick={() => { setPreviewVisible(true); setMode("public"); }} className="px-2 py-1 bg-brand-cyan text-white rounded">Публичный preview</button>
                <button onClick={() => { setPreviewVisible(true); setMode("admin"); }} className="px-2 py-1 bg-slate-100 rounded">Admin preview</button>
              </div>
            </div>
          </div>

          <div className="p-3 border rounded bg-white">
            <h4 className="font-semibold mb-2">Экспорт / Бот</h4>
            <div className="text-xs text-slate-600 mb-2">Скопировать JSON для бота или быстро получить подсказку — см. редактор.</div>
            <button onClick={() => {
              navigator.clipboard.writeText(JSON.stringify(config, null, 2)).then(() => alert("JSON скопирован"));
            }} className="px-2 py-1 bg-green-400 text-white rounded">Copy JSON</button>
          </div>
        </aside>
      </div>

      {/* overlay render (client) */}
      <StreamOverlay config={config} activeIndex={activeIndex} visible={previewVisible} mode={mode} onClose={() => setPreviewVisible(false)} />
    </div>
  );
}