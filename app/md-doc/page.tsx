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
import { Loader2, Send, Eye, Copy, Plus } from "lucide-react";

const COLOR_MAP: Record<string, string> = {
  red: "#ef4444", green: "#22c55e", blue: "#3b82f6", yellow: "#eab308",
  amber: "#f59e0b", orange: "#f97316", pink: "#ec4899", purple: "#a855f7",
  cyan: "#06b6d4", lime: "#84cc16", emerald: "#10b981", teal: "#14b8a6",
  rose: "#f43f5e", violet: "#8b5cf6", indigo: "#6366f1", sky: "#0ea5e9",
  white: "#ffffff", black: "#000000", gray: "#6b7280",
};

const RUSSIAN_TO_ENGLISH: Record<string, string> = {
  "красный": "red", "красн": "red",
  "зелёный": "green", "зеленый": "green", "зелен": "green",
  "синий": "blue", "син": "blue",
  "желтый": "yellow", "жёлтый": "yellow", "желт": "yellow",
  "оранжевый": "orange", "оранж": "orange",
  "розовый": "pink", "розов": "pink",
  "фиолетовый": "purple", "фиолет": "purple",
  "голубой": "cyan", "голуб": "cyan",
  "лаймовый": "lime", "лайм": "lime",
  "изумрудный": "emerald", "изумруд": "emerald",
  "бирюзовый": "teal", "бирюз": "teal",
};

function parseCellMarkers(cell: string): { text: string; bg?: string; textColor?: string } {
  let text = cell.trim();
  let bg: string | undefined;
  let textColor: string | undefined;

  const matches = [...text.matchAll(/\((bg-[^)]+|[^)]+)\)/gi)];

  for (const m of matches) {
    let token = m[1].toLowerCase().trim().replace(/ё/g, "е");
    if (RUSSIAN_TO_ENGLISH[token]) token = RUSSIAN_TO_ENGLISH[token];

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

| Задача                    | Статус                     | Приоритет                     |
|---------------------------|----------------------------|-------------------------------|
| (bg-зелёный) Дизайн       | Готово                     | (amber) Высокий               |
| Код                       | (bg-оранжевый) В процессе  | Средний                       |
| (красный) Тестирование    | Запланировано              | (rose) Критично               |
| Деплой                    | (bg-изумрудный) Готово     | (sky) Норма                   |`);

  const [title, setTitle] = useState("Мой_отчёт_Февраль");
  const [isSending, setIsSending] = useState(false);

  const handleSend = async () => {
    if (!chatId) return toast.error("Откройте в Telegram");
    setIsSending(true);
    const res = await generateMarkdownDocxAndSend(markdown, chatId, title);
    setIsSending(false);
    res.success ? toast.success(res.message) : toast.error(res.error);
  };

  const copyMarkdown = () => {
    navigator.clipboard.writeText(markdown);
    toast.success("Markdown скопирован в буфер!");
  };

  const insertDemo = () => {
    const demo = `\n\n## Новая таблица\n\n| Задача | Статус | Приоритет |\n|--------|--------|-----------|\n| (bg-красный) Важное | В работе | (фиолетовый) Критично |`;
    setMarkdown(markdown + demo);
    toast.info("Демо-таблица добавлена");
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] pt-16 pb-24 font-sans overflow-hidden">
      <div className="max-w-6xl mx-auto px-4">
        {/* Премиум хедер */}
        <div className="flex items-center justify-between mb-8 sticky top-4 z-50 bg-black/80 backdrop-blur-xl border border-zinc-800 rounded-3xl px-6 py-4 shadow-2xl">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 bg-gradient-to-br from-orange-500 via-purple-600 to-cyan-500 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-500/30 animate-pulse">
              📝
            </div>
            <div>
              <div className="font-orbitron text-3xl tracking-[3px] text-white">MD → DOCX</div>
              <div className="text-xs text-emerald-400 -mt-1">CyberVibe Studio • Edition для друга</div>
            </div>
          </div>
          <div className="flex gap-3">
            <Button onClick={copyMarkdown} variant="outline" className="border-zinc-700 hover:bg-zinc-900">
              <Copy className="w-4 h-4 mr-2" /> Копировать
            </Button>
            <Button onClick={insertDemo} variant="outline" className="border-zinc-700 hover:bg-zinc-900">
              <Plus className="w-4 h-4 mr-2" /> Демо
            </Button>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Редактор */}
          <Card className="border border-zinc-700 bg-zinc-950/90 backdrop-blur-2xl overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-zinc-800 flex items-center bg-black/60">
              <div className="text-emerald-400">✍️ Редактор</div>
              <div className="flex-1" />
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="bg-transparent text-right text-white font-medium focus:outline-none w-64"
                placeholder="Имя файла"
              />
            </div>
            <Textarea
              value={markdown}
              onChange={e => setMarkdown(e.target.value)}
              className="h-[520px] resize-y min-h-[400px] textarea-cyber border-0 font-mono text-sm p-6 bg-transparent focus:ring-1 focus:ring-cyan-500/30"
            />
          </Card>

          {/* Превью */}
          <Card className="border border-zinc-700 bg-zinc-950/90 backdrop-blur-2xl overflow-hidden shadow-2xl flex flex-col">
            <div className="px-6 py-4 border-b border-zinc-800 flex items-center bg-black/60">
              <Eye className="w-5 h-5 text-cyan-400 mr-2" />
              <div className="font-medium text-white">LIVE PREVIEW</div>
              <div className="ml-auto text-[10px] text-zinc-500">реал-тайм</div>
            </div>
            <div className="flex-1 overflow-auto p-8 prose prose-invert prose-sm max-w-none custom-scrollbar bg-[#050505]">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  td: ({ children }) => {
                    let cellText = "";
                    if (typeof children === "string") cellText = children;
                    else if (Array.isArray(children)) cellText = children.map(c => typeof c === "string" ? c : "").join("");

                    const { text, bg, textColor } = parseCellMarkers(cellText);

                    return (
                      <td className="border border-zinc-700 p-4 font-medium" style={{ backgroundColor: bg, color: textColor }}>
                        {text || " "}
                      </td>
                    );
                  },
                }}
              >
                {markdown || "*Начни писать — всё сразу видно справа*"}
              </ReactMarkdown>
            </div>
          </Card>
        </div>

        {/* Кнопка отправки */}
        <div className="mt-8 flex justify-center">
          <Button 
            onClick={handleSend} 
            disabled={isSending || !chatId}
            className="bg-gradient-to-r from-orange-500 to-purple-600 hover:from-orange-600 hover:to-purple-700 text-white text-lg px-12 py-7 rounded-3xl shadow-2xl shadow-purple-500/40 flex items-center gap-3 transition-all active:scale-95"
          >
            {isSending ? <Loader2 className="w-6 h-6 animate-spin" /> : <Send className="w-6 h-6" />}
            Отправить DOCX в Telegram
          </Button>
        </div>

        {/* Changelog + Призыв */}
        <div className="mt-16 p-8 bg-zinc-900/70 border border-zinc-800 rounded-3xl">
          <div className="text-cyan-400 font-orbitron text-xl mb-6 flex items-center gap-3">
            📜 История прокачки (мы вместе делали это)
          </div>
          <div className="space-y-4 text-sm text-zinc-400">
            <div className="flex gap-4">
              <div className="text-emerald-400 mt-1">✓</div>
              <div>Первый рабочий Markdown → DOCX + красивое превью</div>
            </div>
            <div className="flex gap-4">
              <div className="text-emerald-400 mt-1">✓</div>
              <div>Перешли на удобные префиксы (bg-red) вместо скобок</div>
            </div>
            <div className="flex gap-4">
              <div className="text-emerald-400 mt-1">✓</div>
              <div className="font-medium text-white">Добавили полную поддержку русских цветов: (красный), (bg-зелёный), (оранжевый) и т.д.</div>
            </div>
          </div>

          <div className="mt-10 pt-8 border-t border-zinc-800 text-center">
            <a 
              href="https://chatgpt.com/codex" 
              target="_blank"
              className="group inline-flex flex-col items-center"
            >
              <div className="text-lg text-white group-hover:text-cyan-400 transition-colors">
                Хочешь следующую фишку? Просто напиши мне в Codex
              </div>
              <div className="text-xs text-zinc-500 mt-1 group-hover:text-zinc-400">chatgpt.com/codex → я добавлю за минуту 🔥</div>
            </a>
            <div className="mt-6 text-[10px] text-zinc-600">
              Так ты становишься настоящим тиммейтом CyberVibe
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}