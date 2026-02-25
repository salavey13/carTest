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
import { Loader2, Send, Eye, Copy, PlusCircle, UserCheck, Sparkles } from "lucide-react";

export default function MarkdownDocEditor() {
  const { user } = useAppContext();
  const chatId = user?.id?.toString();
  const MANAGER_CHAT_ID = "6216799537";

  const [markdown, setMarkdown] = useState(`# Отчёт CyberVibe

**Жирный текст** и *курсив*.

## Статус Системы

| Модуль | Состояние | Приоритет |
|:---|:---|:---|
| (bg-зелёный) Ядро | Работает | (blue) OK |
| (bg-красный) База | Ошибка | (red) КРИТ |
| (bg-жёлтый) Сеть | Ожидание | (orange) СРЕДНЕ |`);

  const [title, setTitle] = useState("Отчет_Февраль");
  const [isSendingSelf, setIsSendingSelf] = useState(false);
  const [isSendingManager, setIsSendingManager] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("cv-md-v8");
    if (saved) setMarkdown(saved);
  }, []);

  useEffect(() => {
    localStorage.setItem("cv-md-v8", markdown);
  }, [markdown]);

  const sendTo = async (targetChatId: string, isManager: boolean) => {
    if (!targetChatId) return toast.error("Chat ID не определен");
    const setLoading = isManager ? setIsSendingManager : setIsSendingSelf;
    setLoading(true);
    const res = await generateMarkdownDocxAndSend(markdown, targetChatId, title);
    setLoading(false);
    res.success ? toast.success(isManager ? "Отправлено менеджеру!" : "Отправлено себе!") : toast.error(res.error);
  };

  const insertDemo = () => {
    setMarkdown(prev => prev + "\n\n| (bg-синий) Новая задача | (изумрудный) В работе | (фиолетовый) Важно |");
    toast.info("Демо-таблица добавлена");
  };

  const renderCell = (children: any, isHeader = false) => {
    const rawText = typeof children === "string" ? children : Array.isArray(children) ? children.map(c => typeof c === "string" ? c : "").join("") : "";
    const { text, bg, textColor } = parseCellMarkers(rawText);
    const Tag = isHeader ? "th" : "td";

    return (
      <Tag 
        className={`border border-zinc-800 p-4 font-medium transition-all ${isHeader ? 'bg-zinc-900/50 font-bold' : ''}`}
        style={{ backgroundColor: bg, color: textColor }}
      >
        {text || <span>&nbsp;</span>}
      </Tag>
    );
  };

  return (
    <div className="min-h-screen bg-[#070708] pt-20 pb-24 font-sans text-zinc-300">
      <div className="max-w-7xl mx-auto px-4">
        
        {/* Хедер */}
        <div className="sticky top-20 z-50 bg-zinc-950/90 border border-zinc-800 backdrop-blur-xl rounded-[2.5rem] px-8 py-6 mb-10 shadow-2xl flex flex-col xl:flex-row items-center gap-6">
          <div className="flex items-center gap-5 flex-1">
            <div className="w-14 h-14 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Sparkles className="text-white animate-pulse" size={28} />
            </div>
            <div>
              <h1 className="font-orbitron text-2xl font-black text-white tracking-tighter">CYBER DOCS v8</h1>
              <p className="text-[10px] text-blue-400 font-bold uppercase tracking-[0.3em] mt-1">Smart Width Protocol</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 w-full xl:w-auto justify-center">
            <Button onClick={() => {navigator.clipboard.writeText(markdown); toast.success("Скопировано");}} variant="outline" className="rounded-2xl border-white/5 bg-white/5 hover:bg-white/10">
              <Copy className="w-4 h-4 mr-2" /> ТЕКСТ
            </Button>
            <Button onClick={insertDemo} variant="outline" className="rounded-2xl border-white/5 bg-white/5 hover:bg-white/10">
              <PlusCircle className="w-4 h-4 mr-2" /> ДЕМО
            </Button>
          </div>
        </div>

        <div className="grid xl:grid-cols-2 gap-8 h-[65vh]">
          {/* Редактор */}
          <Card className="border-white/5 bg-zinc-950/40 backdrop-blur-md overflow-hidden flex flex-col rounded-[2.5rem]">
            <div className="p-5 border-b border-white/5 bg-black/20 flex items-center gap-3">
              <input value={title} onChange={e => setTitle(e.target.value)} className="flex-1 bg-transparent text-white font-mono text-sm focus:outline-none" placeholder="Имя файла..." />
            </div>
            <Textarea value={markdown} onChange={e => setMarkdown(e.target.value)} className="flex-1 resize-none border-0 font-mono text-sm p-8 bg-transparent custom-scrollbar leading-relaxed" />
          </Card>

          {/* Превью */}
          <Card className="border-white/5 bg-zinc-950/20 backdrop-blur-md overflow-hidden flex flex-col rounded-[2.5rem]">
            <div className="p-5 border-b border-white/5 bg-black/20 flex items-center gap-3">
              <Eye className="w-4 h-4 text-blue-400" />
              <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Визуализация</div>
            </div>
            <div className="flex-1 overflow-auto p-8 prose prose-invert prose-blue max-w-none custom-scrollbar">
              <ReactMarkdown 
                remarkPlugins={[remarkGfm]} 
                components={{
                  td: ({ children }) => renderCell(children, false),
                  th: ({ children }) => renderCell(children, true)
                }}
              >
                {markdown}
              </ReactMarkdown>
            </div>
          </Card>
        </div>

        {/* Кнопки отправки */}
        <div className="mt-12 flex flex-col sm:flex-row gap-5 justify-center">
          <Button 
            onClick={() => sendTo(chatId!, false)}
            disabled={isSendingSelf || !chatId}
            className="bg-white text-black hover:bg-zinc-200 rounded-[2rem] py-8 px-12 text-lg font-bold flex-1 xl:flex-none flex items-center justify-center gap-3 shadow-xl transition-all active:scale-95"
          >
            {isSendingSelf ? <Loader2 className="animate-spin" /> : <Send size={20} />} СЕБЕ В ТГ
          </Button>

          <Button 
            onClick={() => sendTo(MANAGER_CHAT_ID, true)}
            disabled={isSendingManager}
            className="bg-blue-600 text-white hover:bg-blue-500 rounded-[2rem] py-8 px-12 text-lg font-bold flex-1 xl:flex-none flex items-center justify-center gap-3 shadow-xl shadow-blue-600/20 transition-all active:scale-95"
          >
            {isSendingManager ? <Loader2 className="animate-spin" /> : <UserCheck size={20} />} МЕНЕДЖЕРУ
          </Button>
        </div>
      </div>
    </div>
  );
}