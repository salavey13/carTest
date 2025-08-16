"use client";
import React, { useEffect, useState } from "react";
import type { StreamConfig, StreamSection } from "./StreamOverlay";

function makeId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Default template for a new stream config */
export const defaultStreamTemplate = (): StreamConfig => ({
  id: `stream-${Date.now()}`,
  slug: `demo-stream-${Date.now()}`,
  title: "Demo Stream — VIP Overlay",
  description: "Пример стрима: секции, картинки и тексты для overlay",
  startAt: null,
  endAt: null,
  lastUpdated: Date.now(),
  sections: [
    {
      id: makeId(),
      title: "Быстрый вход — что сегодня",
      type: "text",
      text: "Привет, фанаты! Сегодня: IRL sauna meet & chill. Поддержите стрим!",
      durationSec: 20,
      greenScreen: false,
      showDecorations: true,
      overlayOpacity: 1,
    } as StreamSection,
    {
      id: makeId(),
      title: "Sauna Pack — мерч & IRL experience",
      type: "image",
      mediaUrl: "https://source.unsplash.com/random/1200x800/?sauna&sig=1",
      durationSec: 18,
      greenScreen: false,
      showDecorations: true,
      overlayOpacity: 1,
    } as StreamSection,
    {
      id: makeId(),
      title: "Залёт VIP: как получить доступ",
      type: "text",
      text: "Купи Sauna Pack или стань VIP — ссылка в профиле. Это реальный IRL-опыт, не просто стикер.",
      durationSec: 25,
      greenScreen: false,
      showDecorations: true,
      overlayOpacity: 1,
    } as StreamSection,
  ],
});

export default function StreamEditorForm({
  initial,
  storageKey = "stream:demo:config",
  onSave,
}: {
  initial?: StreamConfig | null;
  storageKey?: string;
  onSave?: (cfg: StreamConfig) => Promise<void> | void;
}) {
  const [cfg, setCfg] = useState<StreamConfig>(initial ?? defaultStreamTemplate());
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [editingJson, setEditingJson] = useState<string>("");
  const [isJsonMode, setIsJsonMode] = useState(false);

  useEffect(() => {
    // load from localStorage if exists
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw && !initial) {
        const parsed = JSON.parse(raw);
        setCfg(parsed);
      } else {
        setCfg(initial ?? defaultStreamTemplate());
      }
    } catch (e) {
      // ignore
    }
  }, [initial, storageKey]);

  useEffect(() => {
    setEditingJson(JSON.stringify(cfg, null, 2));
  }, [cfg]);

  const saveLocal = (nextCfg?: StreamConfig) => {
    const toSave = nextCfg ?? cfg;
    localStorage.setItem(storageKey, JSON.stringify(toSave));
    if (onSave) onSave(toSave);
    setCfg({ ...toSave, lastUpdated: Date.now() });
  };

  const addSection = (type: StreamSection["type"]) => {
    const s: StreamSection =
      type === "text"
        ? {
            id: makeId(),
            title: "Новая текстовая секция",
            type: "text",
            text: "Текст для показа",
            durationSec: 15,
            greenScreen: false,
            showDecorations: true,
            overlayOpacity: 1,
          }
        : type === "video"
        ? {
            id: makeId(),
            title: "Новая видео-секция",
            type: "video",
            mediaUrl: "",
            durationSec: 20,
            greenScreen: false,
            showDecorations: true,
            overlayOpacity: 1,
          }
        : {
            id: makeId(),
            title: "Новая картинка",
            type: "image",
            mediaUrl: "",
            durationSec: 12,
            greenScreen: false,
            showDecorations: true,
            overlayOpacity: 1,
          };

    const next = { ...cfg, sections: [...(cfg.sections || []), s], lastUpdated: Date.now() };
    setCfg(next);
    saveLocal(next);
    setActiveIndex(next.sections.length - 1);
  };

  const updateSection = (idx: number, patch: Partial<StreamSection>) => {
    const next = { ...cfg, sections: cfg.sections.map((s, i) => (i === idx ? { ...s, ...patch } : s)), lastUpdated: Date.now() };
    setCfg(next);
  };

  const removeSection = (idx: number) => {
    const next = { ...cfg, sections: cfg.sections.filter((_, i) => i !== idx), lastUpdated: Date.now() };
    setCfg(next);
    saveLocal(next);
    setActiveIndex(Math.max(0, Math.min(next.sections.length - 1, idx)));
  };

  const copyJsonToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(cfg, null, 2));
      alert("JSON сконфигурирован и скопирован в буфер — отправь боту или сохрани на сервер.");
    } catch (e) {
      alert("Ошибка копирования JSON в буфер.");
    }
  };

  const generateBotPrompt = () => {
    const prompt = `Сгенерируй JSON-конфиг для stream overlay по структуре:
    
- title: строка
- description: строка
- sections: массив секций
  - id (опционально)
  - title
  - type: image|video|text
  - mediaUrl (для image/video) - полный URL
  - text (для text) - текст с возможными <br/> разрывами
  - durationSec - сколько секция показывается
  - greenScreen - true/false (если true, задний фон -> #00ff00)
  
Отвечай только валидным JSON'ом (ни слова лишнего), не добавляй пояснений.`;
    navigator.clipboard.writeText(prompt).then(() => {
      alert("Подсказка для бота скопирована. Вставь её в любимого бота, он вернёт JSON.");
    });
  };

  const applyJsonText = () => {
    try {
      const parsed = JSON.parse(editingJson);
      setCfg(parsed);
      saveLocal(parsed);
      setIsJsonMode(false);
      alert("JSON применён.");
    } catch (e) {
      alert("Ошибка парсинга JSON: " + (e as Error).message);
    }
  };

  // optional: attempt to persist to server endpoint (placeholder)
  const saveToServer = async () => {
    try {
      // try POST to /api/cars (reuse table) — server must accept this shape
      await fetch("/api/cars", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "stream", payload: cfg }),
      });
      alert("Попытка сохранить на сервер отправлена (если есть endpoint).");
    } catch (e) {
      alert("Ошибка при попытке сохранить на сервер. Проверьте /api/cars.");
    }
  };

  return (
    <div className="p-4 bg-white border border-slate-100 rounded-lg shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-lg font-semibold">{cfg.title}</h3>
          <p className="text-xs text-slate-600">{cfg.description}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => saveLocal()} className="px-3 py-1 bg-brand-cyan text-white rounded text-sm">Сохранить (локально)</button>
          <button onClick={saveToServer} className="px-3 py-1 bg-slate-800 text-white rounded text-sm">Сохранить на сервер</button>
        </div>
      </div>

      {/* sections list */}
      <div className="mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => addSection("text")} className="px-2 py-1 bg-slate-100 rounded text-sm">+ Текст</button>
          <button onClick={() => addSection("image")} className="px-2 py-1 bg-slate-100 rounded text-sm">+ Картинка</button>
          <button onClick={() => addSection("video")} className="px-2 py-1 bg-slate-100 rounded text-sm">+ Видео</button>
          <button onClick={generateBotPrompt} className="px-2 py-1 bg-amber-400 rounded text-sm">Сгенерировать JSON (бот)</button>
          <button onClick={copyJsonToClipboard} className="px-2 py-1 bg-green-400 rounded text-sm">Копировать JSON</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-1">
          <div className="space-y-2">
            {cfg.sections.map((s, idx) => (
              <div key={s.id} onClick={() => setActiveIndex(idx)} className={`p-2 rounded border ${idx === activeIndex ? "border-brand-cyan bg-slate-50" : "border-slate-100 bg-white"} cursor-pointer`}>
                <div className="text-sm font-medium">{s.title}</div>
                <div className="text-xs text-slate-500">{s.type} • {s.durationSec ?? "—"}s</div>
                <div className="mt-2 flex gap-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); updateSection(idx, { greenScreen: !s.greenScreen }); saveLocal({ ...cfg, sections: cfg.sections }); }}
                    className="text-xs px-2 py-1 bg-slate-100 rounded"
                  >
                    {s.greenScreen ? "Green: ON" : "Green: OFF"}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeSection(idx); }}
                    className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded"
                  >
                    Удалить
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* editor for active section */}
        <div className="md:col-span-2">
          {cfg.sections[activeIndex] ? (
            <div className="p-3 border border-slate-100 rounded bg-white space-y-3">
              <label className="text-xs text-slate-600">Заголовок</label>
              <input value={cfg.sections[activeIndex].title} onChange={(e) => updateSection(activeIndex, { title: e.target.value })} className="w-full p-2 border rounded" />

              <label className="text-xs text-slate-600">Тип секции</label>
              <select value={cfg.sections[activeIndex].type} onChange={(e) => updateSection(activeIndex, { type: e.target.value as StreamSection["type"] })} className="w-full p-2 border rounded">
                <option value="text">text</option>
                <option value="image">image</option>
                <option value="video">video</option>
              </select>

              {cfg.sections[activeIndex].type !== "text" && (
                <>
                  <label className="text-xs text-slate-600">URL медиа (image / video)</label>
                  <input value={cfg.sections[activeIndex].mediaUrl || ""} onChange={(e) => updateSection(activeIndex, { mediaUrl: e.target.value })} className="w-full p-2 border rounded" />
                </>
              )}

              {cfg.sections[activeIndex].type === "text" && (
                <>
                  <label className="text-xs text-slate-600">Текст (можно переносы)</label>
                  <textarea value={cfg.sections[activeIndex].text || ""} onChange={(e) => updateSection(activeIndex, { text: e.target.value })} className="w-full p-2 border rounded h-28" />
                </>
              )}

              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs text-slate-600">Длительность (сек)</label>
                <input type="number" value={cfg.sections[activeIndex].durationSec ?? 15} onChange={(e) => updateSection(activeIndex, { durationSec: Number(e.target.value) || 1 })} className="p-2 border rounded" />
                <label className="text-xs text-slate-600">Прозрачность (0-1)</label>
                <input type="number" step="0.1" min={0} max={1} value={cfg.sections[activeIndex].overlayOpacity ?? 1} onChange={(e) => updateSection(activeIndex, { overlayOpacity: Number(e.target.value) })} className="p-2 border rounded" />
              </div>

              <div className="flex gap-2">
                <button onClick={() => saveLocal()} className="px-3 py-1 bg-brand-cyan text-white rounded">Сохранить</button>
                <button onClick={() => { setIsJsonMode(true); setEditingJson(JSON.stringify(cfg, null, 2)); }} className="px-3 py-1 bg-slate-100 rounded">Редактировать JSON</button>
              </div>
            </div>
          ) : (
            <div className="p-3 border border-slate-100 rounded bg-white">Нет секций.</div>
          )}
        </div>
      </div>

      {/* JSON editor area */}
      {isJsonMode && (
        <div className="mt-4">
          <label className="text-xs text-slate-600 mb-1 block">JSON конфиг (редактирование вручную)</label>
          <textarea value={editingJson} onChange={(e) => setEditingJson(e.target.value)} className="w-full h-48 p-3 border rounded font-mono text-xs" />
          <div className="flex gap-2 mt-2">
            <button onClick={applyJsonText} className="px-3 py-1 bg-green-500 text-white rounded">Применить JSON</button>
            <button onClick={() => { setIsJsonMode(false); setEditingJson(JSON.stringify(cfg, null, 2)); }} className="px-3 py-1 bg-slate-100 rounded">Отмена</button>
          </div>
        </div>
      )}
    </div>
  );
}