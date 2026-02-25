"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { FaFileWord, FaPaperPlane, FaEdit, FaEye, FaPalette, FaRocket } from "react-icons/fa";
import { useAppContext } from "@/contexts/AppContext";
import { sendMarkdownAsDocx } from "./actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const COLOR_VARIANTS: Record<string, string> = {
  red: "bg-red-500/20 text-red-400 border-red-500/50",
  green: "bg-emerald-500/20 text-emerald-400 border-emerald-500/50",
  blue: "bg-blue-500/20 text-blue-400 border-blue-500/50",
  yellow: "bg-yellow-500/20 text-yellow-400 border-yellow-500/50",
  orange: "bg-orange-500/20 text-orange-400 border-orange-500/50",
  purple: "bg-purple-500/20 text-purple-400 border-purple-500/50",
};

export default function MarkdownDocPage() {
  const { dbUser } = useAppContext();
  const [activeTab, setActiveTab] = useState<"edit" | "preview">("edit");
  const [text, setText] = useState(`# Отчет PRIZMA 2025\n\n| Параметр | Статус | Приоритет |\n| :--- | :--- | :--- |\n| (bg-green) Сервер | Работает | (blue) OK |\n| (bg-red) База данных | Ошибка | (red) КРИТ |\n| (bg-yellow) Фронтенд | Обновление | (orange) WAIT |\n\nЭто текст с автоматической генерацией в Word.`);

  const handleSendDoc = async () => {
    if (!dbUser?.user_id) return toast.error("Авторизуйтесь через Telegram!");
    
    const promise = sendMarkdownAsDocx(text, dbUser.user_id);
    toast.promise(promise, {
      loading: 'Синхронизация с облаком и отправка...',
      success: 'DOCX улетел в чат!',
      error: 'Ошибка при отправке'
    });
  };

  const components = {
    td: ({ children }: any) => {
      const cellText = children?.[0];
      if (typeof cellText !== 'string') return <td className="p-3 border border-zinc-800">{children}</td>;

      const bgMatch = cellText.match(/^\((bg-)?(\w+)\)/);
      const color = bgMatch ? bgMatch[2] : null;
      const cleanText = cellText.replace(/^\((bg-)?\w+\)\s*/, "");

      return (
        <td className={cn(
          "p-3 border border-zinc-800 transition-colors",
          color && COLOR_VARIANTS[color] ? COLOR_VARIANTS[color] : "bg-transparent"
        )}>
          {cleanText}
        </td>
      );
    }
  };

  return (
    <div className="min-h-screen bg-[#070708] text-zinc-200 pt-24 pb-12 px-4 md:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header Section */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-zinc-900/40 p-6 rounded-3xl border border-zinc-800 backdrop-blur-md">
          <div className="space-y-1">
            <h1 className="text-3xl md:text-4xl font-orbitron font-black tracking-tighter text-white flex items-center gap-3">
              <span className="p-2 bg-blue-600 rounded-lg shadow-blue-600/20 shadow-lg">
                <FaFileWord className="text-white" size={24} />
              </span>
              DOCX.STUDIO
            </h1>
            <p className="text-zinc-500 font-mono text-xs uppercase tracking-[0.2em]">Markdown Export Protocol v2.1</p>
          </div>
          
          <button 
            onClick={handleSendDoc}
            className="w-full md:w-auto group relative flex items-center justify-center gap-3 bg-white text-black px-8 py-4 rounded-2xl font-bold transition-all hover:bg-blue-500 hover:text-white active:scale-95 overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-cyan-500 opacity-0 group-hover:opacity-100 transition-opacity" />
            <FaPaperPlane className="relative z-10 group-hover:rotate-12 transition-transform" />
            <span className="relative z-10">СГЕНЕРИРОВАТЬ ОТЧЕТ</span>
          </button>
        </header>

        {/* Mobile Tabs */}
        <div className="flex md:hidden bg-zinc-900 rounded-xl p-1 border border-zinc-800">
          <button 
            onClick={() => setActiveTab("edit")}
            className={cn("flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-bold transition-all", activeTab === "edit" ? "bg-zinc-800 text-white shadow-lg" : "text-zinc-500")}
          >
            <FaEdit /> РЕДАКТОР
          </button>
          <button 
            onClick={() => setActiveTab("preview")}
            className={cn("flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-bold transition-all", activeTab === "preview" ? "bg-zinc-800 text-white shadow-lg" : "text-zinc-500")}
          >
            <FaEye /> ПРЕВЬЮ
          </button>
        </div>

        {/* Workspace */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-[600px] md:h-[70vh]">
          {/* Editor */}
          <div className={cn(
            "flex flex-col bg-zinc-900/20 border border-zinc-800 rounded-3xl overflow-hidden transition-all",
            activeTab === "preview" ? "hidden md:flex" : "flex"
          )}>
            <div className="px-6 py-4 border-b border-zinc-800 bg-zinc-900/40 flex justify-between items-center">
              <span className="text-xs font-mono font-bold text-zinc-500 flex items-center gap-2 uppercase">
                <FaEdit className="text-blue-500" /> Source_Markdown
              </span>
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="flex-1 p-6 bg-transparent font-mono text-sm focus:outline-none resize-none custom-scrollbar text-zinc-300 leading-relaxed"
              placeholder="Начни писать отчет здесь..."
            />
          </div>

          {/* Preview */}
          <div className={cn(
            "flex flex-col bg-zinc-900/10 border border-zinc-800 rounded-3xl overflow-hidden backdrop-blur-sm transition-all",
            activeTab === "edit" ? "hidden md:flex" : "flex"
          )}>
            <div className="px-6 py-4 border-b border-zinc-800 bg-zinc-900/40 flex justify-between items-center">
              <span className="text-xs font-mono font-bold text-zinc-500 flex items-center gap-2 uppercase">
                <FaEye className="text-emerald-500" /> Rich_Preview
              </span>
            </div>
            <div className="flex-1 p-6 overflow-y-auto custom-scrollbar prose prose-invert prose-blue max-w-none">
              <ReactMarkdown 
                remarkPlugins={[remarkGfm]}
                components={components as any}
              >
                {text}
              </ReactMarkdown>
            </div>
          </div>
        </div>

        {/* Cheat Sheet */}
        <footer className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Красный", code: "(bg-red)", color: "bg-red-500" },
            { label: "Зеленый", code: "(bg-green)", color: "bg-emerald-500" },
            { label: "Синий", code: "(bg-blue)", color: "bg-blue-500" },
            { label: "Желтый", code: "(bg-yellow)", color: "bg-yellow-500" },
          ].map((item) => (
            <div key={item.code} className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-2xl flex items-center gap-3">
              <div className={cn("w-3 h-3 rounded-full shadow-lg", item.color)} />
              <div>
                <p className="text-[10px] text-zinc-500 uppercase font-bold">{item.label}</p>
                <code className="text-xs text-blue-400">{item.code}</code>
              </div>
            </div>
          ))}
        </footer>
      </div>
    </div>
  );
}