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
import { Loader2, Download, Send } from "lucide-react";

const COLOR_HELP = `🎨 Как раскрашивать ячейки таблиц:

В любой ячейке таблицы в конце добавь:
• {red}      → красный фон
• {bg-green} → зелёный фон
• {bg-blue;text-white} → синий фон + белый текст
• {#ef4444}  → любой HEX

Примеры:
| Статус          | Значение       |
|-----------------|----------------|
| Всё ок          | 100% {bg-green}|
| Критично        | Ошибка {red}   |
| Важно           | Внимание {bg-amber-500;text-white} |
`;

export default function MarkdownDocEditor() {
  const { user } = useAppContext();
  const chatId = user?.id?.toString();

  const [markdown, setMarkdown] = useState(`# Пример отчёта

**Жирный** и *курсив*.

## Таблица с цветами

| Задача              | Статус               | Приоритет |
|---------------------|----------------------|---------|
| Дизайн              | Готово {bg-green}    | Высокий {red} |
| Код                 | В процессе           | Средний {bg-amber-500;text-white} |
| Тестирование        | Запланировано {#3b82f6} | Низкий  |`);

  const [isSending, setIsSending] = useState(false);
  const [title, setTitle] = useState("Мой_отчёт");

  const handleSend = async () => {
    if (!chatId) {
      toast.error("Откройте бота в Telegram для отправки");
      return;
    }
    setIsSending(true);
    const result = await generateMarkdownDocxAndSend(markdown, chatId, title);
    setIsSending(false);

    if (result.success) {
      toast.success(result.message);
    } else {
      toast.error(result.error || "Ошибка");
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-2rem)]">
          {/* Левая панель — редактор */}
          <Card className="flex-1 flex flex-col border-zinc-800 bg-card overflow-hidden">
            <div className="p-4 border-b border-zinc-800 flex items-center gap-3">
              <h1 className="text-2xl font-orbitron tracking-wider text-white">Markdown → DOCX</h1>
              <div className="flex-1" />
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Имя файла"
                className="input-cyber w-64"
              />
              <Button onClick={handleSend} disabled={isSending || !chatId} className="gap-2">
                {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Отправить в Telegram
              </Button>
            </div>

            <Textarea
              value={markdown}
              onChange={(e) => setMarkdown(e.target.value)}
              className="flex-1 resize-none textarea-cyber font-mono text-sm p-6 border-0 focus:ring-0"
              placeholder="Пишите Markdown здесь..."
            />

            <div className="p-4 border-t border-zinc-800 text-xs text-zinc-500 font-mono">
              {COLOR_HELP.split("\n").map((l, i) => <div key={i}>{l}</div>)}
            </div>
          </Card>

          {/* Правая панель — красивый превью */}
          <Card className="flex-1 flex flex-col border-zinc-800 overflow-hidden">
            <div className="p-4 border-b border-zinc-800 bg-zinc-950 flex items-center gap-2">
              <div className="text-emerald-400">👁️ LIVE PREVIEW</div>
            </div>

            <div className="flex-1 overflow-auto p-8 prose prose-invert prose-sm max-w-none custom-scrollbar bg-[#0a0a0a]">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  td: ({ children, ...props }) => {
                    let content = children;
                    let classes = "border border-zinc-700 p-3";

                    if (typeof children === "string") {
                      const match = children.match(/^(.*)\s*\{(bg-?[^;]+)?(?:; ?text-?([^}]+))?\}\s*$/);
                      if (match) {
                        content = match[1].trim();
                        const bg = match[2];
                        const textC = match[3];

                        if (bg) classes += ` ${bg.startsWith("bg-") ? bg : `bg-[${bg}]`}`;
                        if (textC) classes += ` text-[${textC.startsWith("#") ? textC : `#${textC}`}]`;
                      }
                    }

                    return <td className={classes} {...props}>{content}</td>;
                  },
                }}
              >
                {markdown || "*Ничего не введено*"}
              </ReactMarkdown>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}