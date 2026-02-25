"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { generateMarkdownDocxAndSend } from "./actions";
import { useAppContext } from "@/contexts/AppContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Send, Eye } from "lucide-react";

const COLOR_MAP: Record<string, string> = {
  red: "#ef4444", green: "#22c55e", blue: "#3b82f6", yellow: "#eab308",
  amber: "#f59e0b", orange: "#f97316", pink: "#ec4899", purple: "#a855f7",
  cyan: "#06b6d4", lime: "#84cc16", emerald: "#10b981", teal: "#14b8a6",
  rose: "#f43f5e", violet: "#8b5cf6", indigo: "#6366f1", sky: "#0ea5e9",
  white: "#ffffff", black: "#000000", gray: "#6b7280",
};

function parseCellMarkers(cell: string): { text: string; bg?: string; textColor?: string } {
  let text = cell.trim();
  let bg: string | undefined;
  let textColor: string | undefined;

  const matches = [...text.matchAll(/\((bg-[^)]+|[^)]+)\)/gi)];

  for (const m of matches) {
    const token = m[1].toLowerCase().trim();
    if (token.startsWith("bg-")) {
      const key = token.slice(3);
      bg = COLOR_MAP[key] || (key.startsWith("#") ? key : undefined);
    } else {
      textColor = COLOR_MAP[token] || (token.startsWith("#") ? token : undefined);
    }
  }

  text = text.replace(/\((bg-[^)]+|[^)]+)\)\s*/gi, "").trim();
  return { text, bg, textColor };
}

export default function MarkdownDocEditor() {
  const { user } = useAppContext();
  const chatId = user?.id?.toString();

  const [markdown, setMarkdown] = useState(`# Пример отчёта

**Жирный** и *курсив*.

## Таблица с цветами

| Задача              | Статус                    | Приоритет                     |
|---------------------|---------------------------|-------------------------------|
| (bg-green) Дизайн   | Готово                    | (amber) Высокий               |
| Код                 | (bg-orange) В процессе    | Средний                       |
| (bg-red) Тестирование | Запланировано            | (rose) Критично               |
| Деплой              | (bg-emerald) Готово       | (sky) Норма                   |`);

  const [title, setTitle] = useState("Мой_отчёт_Февраль");
  const [isSending, setIsSending] = useState(false);

  const handleSend = async () => {
    if (!chatId) return toast.error("Откройте в Telegram");
    setIsSending(true);
    const res = await generateMarkdownDocxAndSend(markdown, chatId, title);
    setIsSending(false);
    res.success ? toast.success(res.message) : toast.error(res.error);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] pt-14 pb-20 font-sans">
      <div className="max-w-5xl mx-auto px-4">
        {/* Заголовок */}
        <div className="flex items-center justify-between mb-6 sticky top-4 z-50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-orange-500 to-purple-600 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-xl">📝</span>
            </div>
            <div>
              <div className="text-white font-orbitron text-2xl tracking-widest">MD → DOCX</div>
              <div className="text-xs text-zinc-500">CyberVibe Editor</div>
            </div>
          </div>
          
          <Button 
            onClick={handleSend} 
            disabled={isSending || !chatId}
            className="bg-white text-black hover:bg-white/90 font-medium px-6 h-11 rounded-2xl flex items-center gap-2"
          >
            {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Отправить в Telegram
          </Button>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Редактор */}
          <Card className="border-zinc-800 bg-zinc-950/80 backdrop-blur-xl overflow-hidden">
            <div className="p-4 border-b border-zinc-800 flex items-center gap-3 bg-black/50">
              <div className="text-emerald-400">✍️</div>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="flex-1 bg-transparent text-white font-medium focus:outline-none"
                placeholder="Имя файла (можно по-русски)"
              />
            </div>
            
            <Textarea
              value={markdown}
              onChange={e => setMarkdown(e.target.value)}
              className="h-[calc(100vh-220px)] resize-y min-h-[400px] textarea-cyber border-0 font-mono text-sm p-6 bg-transparent"
            />
          </Card>

          {/* Превью */}
          <Card className="border-zinc-800 bg-zinc-950/80 backdrop-blur-xl overflow-hidden flex flex-col">
            <div className="p-4 border-b border-zinc-800 flex items-center gap-3 bg-black/50">
              <Eye className="w-5 h-5 text-cyan-400" />
              <div className="font-medium text-white">LIVE PREVIEW</div>
            </div>
            
            <div className="flex-1 overflow-auto p-8 prose prose-invert max-w-none custom-scrollbar">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  td: ({ children }) => {
                    // children может быть строкой или массивом ReactNode
                    let cellText = "";
                    if (typeof children === "string") cellText = children;
                    else if (Array.isArray(children)) {
                      cellText = children.map(c => typeof c === "string" ? c : "").join("");
                    }

                    const { text, bg, textColor } = parseCellMarkers(cellText);

                    return (
                      <td 
                        className="border border-zinc-700 p-3 font-medium"
                        style={{ 
                          backgroundColor: bg, 
                          color: textColor 
                        }}
                      >
                        {text || " "}
                      </td>
                    );
                  },
                }}
              >
                {markdown || "*Начни писать...*"}
              </ReactMarkdown>
            </div>
          </Card>
        </div>

        {/* Новый хелп */}
        <div className="mt-8 p-6 bg-zinc-900/70 border border-zinc-800 rounded-2xl text-sm text-zinc-300">
          🎨 <strong>Раскрашивание ячеек:</strong><br/>
          Просто добавь префикс в нужную ячейку.<br/><br/>
          <strong>Фон:</strong> <code>(bg-red)</code>, <code>(bg-green)</code>, <code>(bg-blue)</code>, <code>(bg-yellow)</code>, <code>(bg-orange)</code>, <code>(bg-purple)</code><br/>
          <strong>Цвет текста (превью + DOCX):</strong> <code>(red)</code>, <code>(white)</code>, <code>(amber)</code> и т.д.<br/><br/>
          Пример: <code>| (bg-red) Критическая ошибка |</code>
        </div>
      </div>
    </div>
  );
}