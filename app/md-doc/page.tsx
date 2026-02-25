"use client";

import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { generateMarkdownDocxAndSend } from "./actions";
import { parseCellMarkers } from "@/lib/parseCellMarkers";
import { useAppContext } from "@/contexts/AppContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Send, Eye, Copy, PlusCircle, UserCheck } from "lucide-react";

export default function MarkdownDocEditor() {
  const { user } = useAppContext();
  const chatId = user?.id?.toString();
  const MANAGER_CHAT_ID = "6216799537";

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
  const [isSendingSelf, setIsSendingSelf] = useState(false);
  const [isSendingManager, setIsSendingManager] = useState(false);

  // Автосохранение
  useEffect(() => {
    const saved = localStorage.getItem("md-doc-draft");
    if (saved) setMarkdown(saved);
  }, []);

  useEffect(() => {
    localStorage.setItem("md-doc-draft", markdown);
  }, [markdown]);

  const sendTo = async (targetChatId: string, isManager: boolean) => {
    const setLoading = isManager ? setIsSendingManager : setIsSendingSelf;
    setLoading(true);
    const res = await generateMarkdownDocxAndSend(markdown, targetChatId, title);
    setLoading(false);
    res.success 
      ? toast.success(isManager ? "✅ Отправлено менеджеру!" : `✅ ${res.message}`)
      : toast.error(res.error);
  };

  const copyMarkdown = () => {
    navigator.clipboard.writeText(markdown);
    toast.success("Markdown скопирован!");
  };

  const insertDemo = () => {
    const demo = `\n\n## Новая таблица\n\n| Задача | Статус | Приоритет |
|--------|--------|-----------|
| (bg-красный) Критично | В работе | (фиолетовый) Важно |`;
    setMarkdown(markdown + demo);
    toast.info("Демо-таблица добавлена");
  };

  // Рекурсивная функция для извлечения чистого текста из React-нод (фикс [object Object])
  const extractText = (node: any): string => {
    if (!node) return "";
    if (typeof node === "string") return node;
    if (Array.isArray(node)) return node.map(extractText).join("");
    if (node.props?.children) return extractText(node.props.children);
    return "";
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] pt-16 pb-24 font-sans">
      <div className="max-w-7xl mx-auto px-4">
        {/* Премиум хедер */}
        <div className="sticky top-4 z-50 bg-zinc-950/95 border border-zinc-800 backdrop-blur-2xl rounded-3xl px-6 py-5 mb-8 shadow-2xl flex flex-col xl:flex-row items-center gap-4">
          <div className="flex items-center gap-4 flex-1">
            <div className="w-12 h-12 bg-gradient-to-br from-orange-500 via-purple-600 to-cyan-500 rounded-2xl flex items-center justify-center text-3xl shadow-xl">📝</div>
            <div>
              <div className="font-orbitron text-3xl tracking-[2px] text-white">MD → DOCX</div>
              <div className="text-xs text-emerald-400">CyberVibe Studio • v8.1</div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 w-full xl:w-auto justify-center">
            <Button onClick={copyMarkdown} variant="outline" className="border-zinc-700 hover:bg-zinc-900 rounded-2xl">
              <Copy className="w-4 h-4 mr-2" /> Копировать
            </Button>
            <Button onClick={insertDemo} variant="outline" className="border-zinc-700 hover:bg-zinc-900 rounded-2xl">
              <PlusCircle className="w-4 h-4 mr-2" /> Демо
            </Button>
          </div>
        </div>

        <div className="grid xl:grid-cols-2 gap-8">
          {/* Редактор */}
          <Card className="border-zinc-800 bg-zinc-950/80 backdrop-blur-xl overflow-hidden">
            <div className="p-4 border-b border-zinc-800 flex items-center gap-3 bg-black/60">
              <div className="text-emerald-400">✍️</div>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="flex-1 bg-transparent text-white font-medium focus:outline-none"
                placeholder="Имя файла"
              />
            </div>
            <Textarea
              value={markdown}
              onChange={e => setMarkdown(e.target.value)}
              className="h-[calc(100vh-300px)] resize-y min-h-[500px] textarea-cyber border-0 font-mono text-sm p-6 bg-transparent"
            />
          </Card>

          {/* Превью — текст на цветном фоне теперь виден */}
          <Card className="border-zinc-800 bg-zinc-950/80 backdrop-blur-xl overflow-hidden flex flex-col">
            <div className="p-4 border-b border-zinc-800 flex items-center gap-3 bg-black/60">
              <Eye className="w-5 h-5 text-cyan-400" />
              <div className="font-medium text-white">ЖИВОЕ ПРЕВЬЮ</div>
            </div>
            <div className="flex-1 overflow-auto p-8 prose prose-invert max-w-none custom-scrollbar">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  td: ({ children }) => {
                    const rawText = extractText(children); // Рекурсивно вытаскиваем чистый текст
                    const { text, bg, textColor } = parseCellMarkers(rawText);

                    return (
                      <td 
                        className="border border-zinc-700 p-4 font-medium"
                        style={{ 
                          backgroundColor: bg ? `${bg}33` : undefined, // полупрозрачный фон
                          color: textColor || (bg ? "#ffffff" : undefined) // белый текст на тёмном фоне
                        }}
                      >
                        {children} {/* Оставляем оригинальный контент с жирным/курсивом */}
                      </td>
                    );
                  },
                  th: ({ children }) => {
                    const rawText = extractText(children);
                    const { text, bg, textColor } = parseCellMarkers(rawText);

                    return (
                      <th 
                        className="border border-zinc-700 p-4 font-bold"
                        style={{ 
                          backgroundColor: bg ? `${bg}33` : undefined, 
                          color: textColor || (bg ? "#ffffff" : undefined) 
                        }}
                      >
                        {children}
                      </th>
                    );
                  },
                }}
              >
                {markdown || "*Начни писать — цвета сразу видно*"}
              </ReactMarkdown>
            </div>
          </Card>
        </div>

        {/* Кнопки отправки */}
        <div className="mt-10 flex flex-col xl:flex-row gap-4 justify-center">
          <Button 
            onClick={() => sendTo(chatId!, false)}
            disabled={isSendingSelf || !chatId}
            className="bg-gradient-to-r from-orange-500 to-purple-600 hover:from-orange-600 hover:to-purple-700 text-white rounded-3xl py-7 px-12 text-lg flex-1 xl:flex-none flex items-center justify-center gap-3 shadow-xl"
          >
            {isSendingSelf ? <Loader2 className="animate-spin" /> : <Send />} Отправить себе
          </Button>

          <Button 
            onClick={() => sendTo(MANAGER_CHAT_ID, true)}
            disabled={isSendingManager}
            className="bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 text-white rounded-3xl py-7 px-12 text-lg flex-1 xl:flex-none flex items-center justify-center gap-3 shadow-xl"
          >
            {isSendingManager ? <Loader2 className="animate-spin" /> : <UserCheck />} Отправить менеджеру
          </Button>
        </div>

        {/* Changelog + Призыв */}
        <div className="mt-16 p-8 bg-zinc-900/70 border border-zinc-800 rounded-3xl text-sm">
          <div className="text-cyan-400 font-orbitron text-xl mb-6">📜 История прокачки (мы вместе)</div>
          <div className="space-y-3 text-zinc-400">
            <div>• v1 — Первый редактор + DOCX</div>
            <div>• v2 — Удобные префиксы</div>
            <div>• v3 — Русские цвета</div>
            <div className="text-emerald-400">• v8.1 — Широкие колонки + текст на цветном фоне</div>
          </div>

          <div className="mt-10 text-center">
            <a href="https://chatgpt.com/codex" target="_blank" className="text-white hover:text-cyan-400 text-lg transition-colors">
              Хочешь новую фичу? Напиши в Codex — я добавлю за минуту 🔥
            </a>
            <div className="text-xs text-zinc-500 mt-2">Так ты становишься тиммейтом CyberVibe</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Рекурсивная функция для извлечения чистого текста из React-нод
function extractText(node: any): string {
  if (!node) return "";
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (node.props?.children) return extractText(node.props.children);
  return "";
}