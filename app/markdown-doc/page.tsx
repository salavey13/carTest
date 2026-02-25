"use client";

import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { generateAndSendDoc, parseCellData } from "./actions";
import { useAppContext } from "@/contexts/AppContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Send, Eye, Edit3, PlusCircle, ShieldCheck, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

const MANAGER_ID = "6216799537";

export default function MarkdownDocPage() {
  const { user } = useAppContext();
  const [markdown, setMarkdown] = useState("");
  const [activeTab, setActiveTab] = useState<"edit" | "view">("edit");
  const [loading, setLoading] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("cv_pro_v4");
    setMarkdown(saved || "# Отчёт\n\n| (bg-зелёный) Узел | Статус |\n|:---|:---|\n| База | (красный) Error |");
  }, []);

  useEffect(() => {
    if (markdown) localStorage.setItem("cv_pro_v4", markdown);
  }, [markdown]);

  const onSend = async (targetId: string, label: string) => {
    setLoading(label);
    const res = await generateAndSendDoc(markdown, targetId, "Report_PRO");
    setLoading(null);
    if (res.success) toast.success(`Отправлено: ${label}`);
    else toast.error(res.error);
  };

  const insertDemo = () => {
    setMarkdown(prev => prev + "\n\n| (bg-blue) Новый | (желтый) Проект |\n|:---|:---|\n| Данные | (bg-orange) В работе |");
  };

  return (
    <div className="min-h-screen bg-[#050506] text-zinc-200 pt-24 pb-12 px-4">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Elite Header */}
        <header className="bg-zinc-900/80 border border-white/5 p-6 rounded-[2rem] backdrop-blur-3xl shadow-2xl flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(37,99,235,0.4)]">
              <Zap className="text-white fill-white animate-pulse" size={28} />
            </div>
            <div className="text-center md:text-left">
              <h1 className="font-orbitron text-2xl font-black text-white leading-none">MD PRO STUDIO</h1>
              <p className="text-[10px] text-blue-400 font-bold uppercase tracking-[0.3em] mt-2">Wysiwyg Precision Engine</p>
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="outline" size="sm" onClick={insertDemo} className="rounded-xl border-white/10 bg-white/5"><PlusCircle className="mr-2" size={14}/> DEMO</Button>
            <Button size="sm" onClick={() => onSend(user?.id?.toString() || "", "СЕБЕ")} disabled={!!loading} className="bg-zinc-100 text-black hover:bg-white rounded-xl">
              {loading === "СЕБЕ" ? <Loader2 className="animate-spin" /> : <Send size={14} className="mr-2"/>} SELF
            </Button>
            <Button size="sm" onClick={() => onSend(MANAGER_ID, "МЕНЕДЖЕРУ")} disabled={!!loading} className="bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-lg shadow-blue-600/20">
              {loading === "МЕНЕДЖЕРУ" ? <Loader2 className="animate-spin" /> : <ShieldCheck size={14} className="mr-2"/>} MANAGER
            </Button>
          </div>
        </header>

        {/* Workspace */}
        <div className="grid md:grid-cols-2 gap-6 h-[60vh] md:h-[70vh]">
          {/* Editor */}
          <div className={cn("flex flex-col bg-zinc-900/40 border border-white/5 rounded-[2.5rem] overflow-hidden", activeTab === "view" && "hidden md:flex")}>
            <div className="px-6 py-3 border-b border-white/5 bg-black/20 text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
              <Edit3 size={12}/> Editor_Input
            </div>
            <textarea 
              value={markdown}
              onChange={e => setMarkdown(e.target.value)}
              className="flex-1 p-8 bg-transparent text-zinc-300 font-mono text-sm focus:outline-none resize-none custom-scrollbar leading-relaxed"
            />
          </div>

          {/* Preview - ФИКС ЦВЕТОВ */}
          <div className={cn("flex flex-col bg-zinc-950/40 border border-white/5 rounded-[2.5rem] overflow-hidden backdrop-blur-sm", activeTab === "edit" && "hidden md:flex")}>
            <div className="px-6 py-3 border-b border-white/5 bg-black/20 text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
              <Eye size={12}/> Final_Render
            </div>
            <div className="flex-1 p-8 overflow-auto prose prose-invert prose-blue max-w-none custom-scrollbar prose-sm">
              <ReactMarkdown 
                remarkPlugins={[remarkGfm]}
                components={{
                  td: ({ children }) => {
                    const { clean, bg, fg } = parseCellData(String(children));
                    return (
                      <td className="border border-white/5 p-4 transition-all" style={{ 
                        backgroundColor: bg ? `#${bg}33` : undefined, // 33 = 20% opacity
                        color: fg ? `#${fg}` : bg ? `#${bg}` : undefined,
                        borderColor: bg ? `#${bg}66` : undefined
                      }}>
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

        {/* Mobile Nav */}
        <div className="flex md:hidden fixed bottom-6 left-4 right-4 bg-zinc-900 border border-white/10 rounded-2xl p-1 shadow-2xl z-50">
          <button onClick={() => setActiveTab("edit")} className={cn("flex-1 py-3 rounded-xl text-xs font-bold transition-all", activeTab === "edit" ? "bg-white/10 text-white" : "text-zinc-500")}>EDITOR</button>
          <button onClick={() => setActiveTab("view")} className={cn("flex-1 py-3 rounded-xl text-xs font-bold transition-all", activeTab === "view" ? "bg-white/10 text-white" : "text-zinc-500")}>PREVIEW</button>
        </div>
      </div>
    </div>
  );
}