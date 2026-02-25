"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { FaFileWord, FaPaperPlane, FaInfoCircle, FaPalette } from "react-icons/fa";
import { useAppContext } from "@/contexts/AppContext";
import { sendMarkdownAsDocx } from "./actions";
import { toast } from "sonner";

export default function MarkdownDocPage() {
  const { dbUser } = useAppContext();
  const [text, setText] = useState(`# Заголовок проекта\n\n| Задача | Статус | Приоритет |\n| :--- | :--- | :--- |\n| (bg-green) Дизайн | Готово | Низкий |\n| (bg-red) Код | В процессе | (red) КРИТИЧНО |\n| (bg-blue) Тесты | Ожидание | Средний |\n\nНапиши здесь что-нибудь...`);

  const handleSendDoc = async () => {
    if (!dbUser?.user_id) return toast.error("Сначала авторизуйтесь в ТГ!");
    
    const promise = sendMarkdownAsDocx(text, dbUser.user_id);
    
    toast.promise(promise, {
      loading: 'Генерируем DOCX и отправляем в Telegram...',
      success: 'Файл успешно отправлен!',
      error: (err) => `Ошибка: ${err}`
    });
  };

  // --- БОНУС: Кастомный рендерер для раскраски таблиц ---
  const components = {
    td: ({ children }: any) => {
      let content = children;
      let style: React.CSSProperties = {};

      if (typeof children?.[0] === 'string') {
        const str = children[0];
        // Логика: (red) -> текст красный, (bg-blue) -> фон синий
        if (str.startsWith('(red)')) {
          style.color = '#ef4444';
          content = str.replace('(red)', '');
        } else if (str.startsWith('(bg-red)')) {
          style.backgroundColor = '#7f1d1d';
          style.color = 'white';
          content = str.replace('(bg-red)', '');
        } else if (str.startsWith('(bg-green)')) {
          style.backgroundColor = '#064e3b';
          style.color = 'white';
          content = str.replace('(bg-green)', '');
        } else if (str.startsWith('(bg-blue)')) {
          style.backgroundColor = '#1e3a8a';
          style.color = 'white';
          content = str.replace('(bg-blue)', '');
        }
      }

      return <td style={style} className="px-4 py-2 border border-zinc-700">{content}</td>;
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100 p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-zinc-800 pb-6">
          <div>
            <h1 className="text-3xl font-orbitron font-bold tracking-tighter flex items-center gap-3">
              <FaFileWord className="text-blue-500" /> DOCX GEN 2025
            </h1>
            <p className="text-zinc-500 text-sm font-mono mt-1">MARKDOWN TO TELEGRAM DOCS PROTOCOL</p>
          </div>
          
          <button 
            onClick={handleSendDoc}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-bold transition-all hover:scale-105 active:scale-95 shadow-lg shadow-blue-900/20"
          >
            <FaPaperPlane /> ОТПРАВИТЬ В TG
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[70vh]">
          {/* Editor Area */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-xs font-mono text-zinc-500 px-2 uppercase tracking-widest">
              <FaPalette /> Markdown Input
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="flex-1 w-full bg-[#111] border border-zinc-800 rounded-2xl p-6 font-mono text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none custom-scrollbar"
              placeholder="Введите ваш текст..."
            />
          </div>

          {/* Preview Area */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-xs font-mono text-zinc-500 px-2 uppercase tracking-widest">
              <FaInfoCircle /> Live Render
            </div>
            <div className="flex-1 bg-zinc-900/30 border border-zinc-800 rounded-2xl p-6 overflow-y-auto custom-scrollbar prose prose-invert prose-blue max-w-none">
              <ReactMarkdown 
                remarkPlugins={[remarkGfm]}
                components={components as any}
              >
                {text}
              </ReactMarkdown>
            </div>
          </div>
        </div>

        {/* Bonus Instructions */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
          <h3 className="text-lg font-orbitron mb-4 flex items-center gap-2">
             💡 Как пользоваться раскраской таблиц?
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono text-zinc-400">
            <div className="bg-black/40 p-3 rounded-lg border border-zinc-800">
              <p className="text-blue-400 mb-1">Цветной текст:</p>
              <code>(red) Текст</code>
            </div>
            <div className="bg-black/40 p-3 rounded-lg border border-zinc-800">
              <p className="text-blue-400 mb-1">Фон ячейки:</p>
              <code>(bg-red)</code>, <code>(bg-green)</code>, <code>(bg-blue)</code>
            </div>
            <div className="bg-black/40 p-3 rounded-lg border border-zinc-800">
              <p className="text-blue-400 mb-1">Пример:</p>
              <code>| (bg-green) Готово |</code>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}