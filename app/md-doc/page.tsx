"use client";

import { useState, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { generateMarkdownDocxAndSend } from "./actions";
import { useAppContext } from "@/contexts/AppContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Send, Eye, FileJson, Bold, Table as TableIcon, Save, Download, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export default function MarkdownProEditor() {
  const { user } = useAppContext();
  const [markdown, setMarkdown] = useState("");
  const [title, setTitle] = useState("Daily_Report");
  const [isSending, setIsSending] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Persistence Engine: Загрузка черновика
  useEffect(() => {
    const saved = localStorage.getItem("cv_md_draft");
    if (saved) setMarkdown(saved);
    else setMarkdown("# Новый отчет\n\n| Задача | Статус |\n|:---|:---|\n| (bg-green) Фича | **Готово** |");
    setMounted(true);
  }, []);

  // Автосохранение
  useEffect(() => {
    if (markdown) localStorage.setItem("cv_md_draft", markdown);
  }, [markdown]);

  const handleSend = async () => {
    if (!user?.id) return toast.error("Войдите в систему");
    setIsSending(true);
    const res = await generateMarkdownDocxAndSend(markdown, user.id.toString(), title);
    setIsSending(false);
    if (res.success) toast.success("Документ в твоем Telegram!");
    else toast.error(res.error);
  };

  const insertTool = (type: string) => {
    const tools: Record<string, string> = {
      bold: "**Текст**",
      table: "\n| Заголовок | Статус |\n|:---|:---|\n| (bg-blue) Текст | OK |\n",
      color: "(bg-blue) (white) "
    };
    setMarkdown(prev => prev + tools[type]);
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-[#050505] pt-20 pb-10 px-4 md:px-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Advanced Toolbar Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-zinc-900/80 border border-white/10 p-4 rounded-3xl backdrop-blur-2xl sticky top-24 z-40 shadow-[0_0_50px_-12px_rgba(59,130,246,0.3)]">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-600 rounded-2xl shadow-[0_0_20px_rgba(37,99,235,0.5)]">
              <Sparkles className="text-white w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h1 className="font-orbitron text-xl font-black text-white leading-none">CV PRO EDITOR</h1>
              <p className="text-[10px] text-blue-400 font-bold tracking-tighter uppercase mt-1">Smarter. Faster. Cyber.</p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-black/40 p-1.5 rounded-2xl border border-white/5">
            <Button size="sm" variant="ghost" onClick={() => insertTool('bold')} className="hover:bg-white/10 text-zinc-400 hover:text-white"><Bold size={16}/></Button>
            <Button size="sm" variant="ghost" onClick={() => insertTool('table')} className="hover:bg-white/10 text-zinc-400 hover:text-white"><TableIcon size={16}/></Button>
            <Button size="sm" variant="ghost" onClick={() => insertTool('color')} className="hover:bg-white/10 text-zinc-400 hover:text-white"><FileJson size={16}/></Button>
          </div>

          <div className="flex gap-2">
             <input 
              value={title} 
              onChange={e => setTitle(e.target.value)}
              className="bg-zinc-800/50 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none w-40 hidden sm:block"
            />
            <Button 
              onClick={handleSend} 
              disabled={isSending}
              className="bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-lg shadow-blue-900/40 px-6"
            >
              {isSending ? <Loader2 className="animate-spin" /> : <Send size={18} className="mr-2"/>}
              SEND TO TG
            </Button>
          </div>
        </div>

        {/* Workspace: Side-by-Side */}
        <div className="grid lg:grid-cols-2 gap-8 h-[75vh]">
          {/* Editor Pane */}
          <div className="flex flex-col gap-3 group">
            <div className="flex items-center justify-between px-4">
              <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest group-hover:text-blue-400 transition-colors">Input Stream</span>
              <span className="text-[10px] text-zinc-700 font-mono">UTF-8 / MD_GFM</span>
            </div>
            <textarea
              value={markdown}
              onChange={e => setMarkdown(e.target.value)}
              className="flex-1 bg-zinc-900/20 border border-white/5 rounded-[2.5rem] p-8 font-mono text-sm text-zinc-300 focus:outline-none focus:border-blue-500/50 transition-all resize-none shadow-inner custom-scrollbar"
              placeholder="System awaiting data..."
            />
          </div>

          {/* Preview Pane */}
          <div className="flex flex-col gap-3 group">
            <div className="flex items-center justify-between px-4">
              <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest group-hover:text-emerald-400 transition-colors">Visual Output</span>
              <div className="flex items-center gap-2">
                 <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                 <span className="text-[10px] text-zinc-700 font-mono">LIVE_SYNC</span>
              </div>
            </div>
            <Card className="flex-1 bg-[#080808] border border-white/5 rounded-[2.5rem] p-8 overflow-auto prose prose-invert prose-sm max-w-none custom-scrollbar">
              <ReactMarkdown 
                remarkPlugins={[remarkGfm]}
                components={{
                  td: ({ children }) => {
                    const text = String(children);
                    // Простой парсинг цветов для превью
                    const bg = text.match(/\(bg-([a-zа-я]+)\)/i)?.[1];
                    const fg = text.match(/\(([a-zа-я]+)\)/i)?.[1];
                    const cleanText = text.replace(/\(.*?\)/g, "").trim();
                    
                    const bgClass = bg ? `bg-${bg}-500/20 text-${bg}-400` : "";
                    
                    return (
                      <td className={cn("border border-white/10 p-4 transition-all", bgClass)} style={{ color: fg }}>
                        {cleanText}
                      </td>
                    );
                  }
                }}
              >
                {markdown}
              </ReactMarkdown>
            </Card>
          </div>
        </div>

        {/* Legend / Status Bar */}
        <div className="flex flex-wrap gap-4 justify-center py-6 opacity-50 hover:opacity-100 transition-opacity">
           {['red', 'green', 'blue', 'yellow', 'purple'].map(c => (
             <div key={c} className="flex items-center gap-2 px-3 py-1 bg-zinc-900 border border-white/5 rounded-full text-[10px] text-zinc-400 font-mono">
               <div className={`w-2 h-2 rounded-full bg-${c}-500`} />
               (bg-{c}) / ({c})
             </div>
           ))}
        </div>
      </div>
    </div>
  );
}