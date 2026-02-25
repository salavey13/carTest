"use client";

import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { generateMarkdownDocxAndSend } from "./actions";
import { useAppContext } from "@/contexts/AppContext";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Send, Eye, Edit3, Copy, PlusCircle, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const UI_COLORS: Record<string, string> = {
  red: "bg-red-500/20 text-red-400", красный: "bg-red-500/20 text-red-400",
  green: "bg-emerald-500/20 text-emerald-400", зеленый: "bg-emerald-500/20 text-emerald-400", зелёный: "bg-emerald-500/20 text-emerald-400",
  blue: "bg-blue-500/20 text-blue-400", синий: "bg-blue-500/20 text-blue-400",
  yellow: "bg-yellow-500/20 text-yellow-400", желтый: "bg-yellow-500/20 text-yellow-400",
};

export default function MarkdownDocPage() {
  const { user } = useAppContext();
  const [markdown, setMarkdown] = useState("");
  const [activeTab, setActiveTab] = useState<"edit" | "view">("edit");
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    const draft = localStorage.getItem("md_pro_draft");
    setMarkdown(draft || "# Отчёт\n\n| (bg-зеленый) Статус | Приоритет |\n|:---|:---|\n| (синий) Работает | (bg-красный) КРИТ |");
  }, []);

  useEffect(() => {
    if (markdown) localStorage.setItem("md_pro_draft", markdown);
  }, [markdown]);

  const handleSend = async () => {
    if (!user?.id) return toast.error("Доступно только в Telegram");
    setIsSending(true);
    const res = await generateMarkdownDocxAndSend(markdown, user.id.toString(), "CyberVibe_Doc");
    setIsSending(false);
    if (res.success) toast.success("Документ отправлен в чат!");
  };

  const insertDemo = () => {
    setMarkdown(prev => prev + "\n\n| (bg-синий) Новая | Ячейка |\n|:---|:---|\n| Контент | (желтый) Важно |");
    toast.info("Демо-таблица добавлена");
  };

  return (
    <div className="min-h-screen bg-[#080809] pt-24 pb-10 px-4">
      <div className="max-w-6xl mx-auto space-y-4 md:space-y-6">
        
        {/* Responsive Header */}
        <header className="bg-zinc-900/60 border border-white/5 p-4 md:p-6 rounded-[2.5rem] backdrop-blur-3xl shadow-2xl">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-tr from-blue-600 to-cyan-400 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                <Sparkles className="text-white animate-pulse" />
              </div>
              <div className="text-center sm:text-left">
                <h1 className="font-orbitron text-2xl font-black text-white tracking-tighter">MD.STUDIO</h1>
                <p className="text-[10px] text-zinc-500 uppercase tracking-[0.3em]">AI Enhanced Export</p>
              </div>
            </div>

            <div className="flex flex-wrap justify-center gap-2 w-full sm:w-auto">
              <Button size="sm" variant="outline" onClick={() => {navigator.clipboard.writeText(markdown); toast.success("Скопировано");}} className="rounded-xl border-white/5 bg-white/5 text-zinc-400 flex-1 sm:flex-none">
                <Copy size={14} className="mr-2" /> COPY
              </Button>
              <Button size="sm" variant="outline" onClick={insertDemo} className="rounded-xl border-white/5 bg-white/5 text-zinc-400 flex-1 sm:flex-none">
                <PlusCircle size={14} className="mr-2" /> DEMO
              </Button>
              <Button size="sm" onClick={handleSend} disabled={isSending} className="rounded-xl bg-blue-600 hover:bg-blue-500 text-white w-full sm:w-auto px-8">
                {isSending ? <Loader2 className="animate-spin" /> : <Send size={14} className="mr-2" />} SEND
              </Button>
            </div>
          </div>
        </header>

        {/* Mobile Tab Switcher */}
        <div className="flex md:hidden bg-zinc-900 rounded-2xl p-1 border border-white/5">
          <button onClick={() => setActiveTab("edit")} className={cn("flex-1 py-3 rounded-xl text-xs font-bold transition-all", activeTab === "edit" ? "bg-white/10 text-white" : "text-zinc-500")}>EDITOR</button>
          <button onClick={() => setActiveTab("view")} className={cn("flex-1 py-3 rounded-xl text-xs font-bold transition-all", activeTab === "view" ? "bg-white/10 text-white" : "text-zinc-500")}>PREVIEW</button>
        </div>

        {/* Two-Column Workspace */}
        <div className="grid md:grid-cols-2 gap-4 md:gap-8 h-[60vh] md:h-[65vh]">
          {/* Editor */}
          <div className={cn("flex flex-col bg-zinc-950/50 border border-white/5 rounded-[2.5rem] overflow-hidden", activeTab === "view" && "hidden md:flex")}>
            <div className="px-6 py-3 border-b border-white/5 bg-black/20 flex items-center justify-between">
               <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2"><Edit3 size={12}/> Editor_Core</span>
            </div>
            <textarea 
              value={markdown}
              onChange={e => setMarkdown(e.target.value)}
              className="flex-1 p-6 md:p-8 bg-transparent text-zinc-300 font-mono text-sm focus:outline-none resize-none custom-scrollbar leading-relaxed"
            />
          </div>

          {/* Preview */}
          <div className={cn("flex flex-col bg-zinc-950/20 border border-white/5 rounded-[2.5rem] overflow-hidden backdrop-blur-sm", activeTab === "edit" && "hidden md:flex")}>
            <div className="px-6 py-3 border-b border-white/5 bg-black/20 flex items-center justify-between">
               <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2"><Eye size={12}/> Render_Engine</span>
            </div>
            <div className="flex-1 p-6 md:p-8 overflow-auto prose prose-invert prose-blue max-w-none custom-scrollbar prose-sm">
              <ReactMarkdown 
                remarkPlugins={[remarkGfm]}
                components={{
                  td: ({ children }) => {
                    const raw = String(children);
                    const bgMatch = raw.match(/\((?:bg-|фон-)?([a-zа-яё0-9]+)\)/i);
                    const colorKey = bgMatch?.[1]?.toLowerCase()?.replace(/ё/g, "е");
                    const isBg = raw.includes("bg-") || raw.includes("фон-");
                    
                    const clean = raw.replace(/\(.*?\)/g, "").trim();
                    const bgClass = (isBg && colorKey && UI_COLORS[colorKey]) ? UI_COLORS[colorKey] : "";
                    const textClass = (!isBg && colorKey && UI_COLORS[colorKey]) ? UI_COLORS[colorKey].split(" ")[1] : "";

                    return (
                      <td className={cn("border border-white/5 p-4 font-medium", bgClass, textClass)}>
                        {clean}
                      </td>
                    );
                  }
                }}
              >
                {markdown}
              </ReactMarkdown>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}