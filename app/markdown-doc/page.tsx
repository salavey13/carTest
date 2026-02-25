"use client";

import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { generateMarkdownDocxAndSend } from "./actions";
import { parseCellMarkers } from "@/lib/parseCellMarkers";
import { useAppContext } from "@/contexts/AppContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Send, Eye, Edit3, Copy, ShieldCheck, UserCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const MANAGER_ID = "6216799537";

export default function MarkdownDocPage() {
  const { user } = useAppContext();
  const [markdown, setMarkdown] = useState("");
  const [activeTab, setActiveTab] = useState<"edit" | "view">("edit");
  const [loading, setLoading] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("cv_v8_final");
    setMarkdown(saved || "# Отчёт\n\n| (bg-зелёный) Параметр | Значение |\n|:---|:---|\n| Статус | (синий) Работает |");
  }, []);

  useEffect(() => {
    if (markdown) localStorage.setItem("cv_v8_final", markdown);
  }, [markdown]);

  const send = async (id: string, label: string) => {
    setLoading(label);
    const res = await generateMarkdownDocxAndSend(markdown, id, "CyberVibe_Report");
    setLoading(null);
    if (res.success) toast.success(`Отправлено: ${label}`);
    else toast.error(res.error);
  };

  const renderCell = (children: any, isHeader = false) => {
    const rawText = typeof children === "string" ? children : Array.isArray(children) ? children.map(c => typeof c === "string" ? c : "").join("") : "";
    const { text, bg, textColor } = parseCellMarkers(rawText);
    const Tag = isHeader ? "th" : "td";

    return (
      <Tag 
        className={cn("border border-zinc-800 p-4 font-medium transition-all", isHeader && "font-bold bg-zinc-900/50")}
        style={{ backgroundColor: bg, color: textColor }}
      >
        {text || <span className="opacity-20">пусто</span>}
      </Tag>
    );
  };

  return (
    <div className="min-h-screen bg-[#050506] pt-24 pb-12 px-4 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Elite Sticky Header */}
        <header className="sticky top-24 z-50 bg-zinc-950/80 border border-white/10 p-5 rounded-[2.5rem] backdrop-blur-3xl shadow-2xl flex flex-col xl:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/30">
              <ShieldCheck className="text-white" size={24} />
            </div>
            <div>
              <h1 className="font-orbitron text-2xl font-black text-white tracking-tighter">MD STUDIO v8</h1>
              <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-[0.2em] mt-1">Russian Sync Protocol Active</p>
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => {navigator.clipboard.writeText(markdown); toast.success("Markdown скопирован");}} className="rounded-xl text-zinc-400 hover:text-white">
              <Copy size={14} className="mr-2"/> КОПИРОВАТЬ
            </Button>
            <Button size="sm" onClick={() => send(user?.id?.toString() || "", "СЕБЕ")} disabled={!!loading} className="bg-white text-black hover:bg-zinc-200 rounded-xl px-6 font-bold">
              {loading === "СЕБЕ" ? <Loader2 className="animate-spin" /> : <Send size={14} className="mr-2"/>} СЕБЕ
            </Button>
            <Button size="sm" onClick={() => send(MANAGER_ID, "МЕНЕДЖЕРУ")} disabled={!!loading} className="bg-blue-600 text-white hover:bg-blue-500 rounded-xl px-6 font-bold shadow-lg shadow-blue-600/20">
              {loading === "МЕНЕДЖЕРУ" ? <Loader2 className="animate-spin" /> : <UserCircle size={14} className="mr-2"/>} МЕНЕДЖЕРУ
            </Button>
          </div>
        </header>

        {/* Editor & Preview */}
        <div className="grid md:grid-cols-2 gap-6 h-[60vh] md:h-[70vh]">
          <div className={cn("flex flex-col bg-zinc-900/30 border border-white/5 rounded-[2.5rem] overflow-hidden", activeTab === "view" && "hidden md:flex")}>
             <div className="px-6 py-3 border-b border-white/5 bg-black/20 text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2"><Edit3 size={12}/> Editor</div>
             <textarea value={markdown} onChange={e => setMarkdown(e.target.value)} className="flex-1 p-8 bg-transparent text-zinc-300 font-mono text-sm focus:outline-none resize-none custom-scrollbar leading-relaxed" />
          </div>

          <div className={cn("flex flex-col bg-zinc-950/20 border border-white/5 rounded-[2.5rem] overflow-hidden backdrop-blur-sm", activeTab === "edit" && "hidden md:flex")}>
             <div className="px-6 py-3 border-b border-white/5 bg-black/20 text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2"><Eye size={12}/> Preview</div>
             <div className="flex-1 p-8 overflow-auto prose prose-invert prose-blue max-w-none custom-scrollbar prose-sm">
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
          </div>
        </div>

        {/* Mobile Tabs */}
        <div className="md:hidden fixed bottom-6 left-4 right-4 bg-zinc-900 border border-white/10 rounded-2xl p-1 z-50 flex shadow-2xl">
          <button onClick={() => setActiveTab("edit")} className={cn("flex-1 py-4 rounded-xl text-xs font-bold transition-all", activeTab === "edit" ? "bg-white/10 text-white" : "text-zinc-500")}>РЕДАКТОР</button>
          <button onClick={() => setActiveTab("view")} className={cn("flex-1 py-4 rounded-xl text-xs font-bold transition-all", activeTab === "view" ? "bg-white/10 text-white" : "text-zinc-500")}>ПРЕВЬЮ</button>
        </div>
      </div>
    </div>
  );
}