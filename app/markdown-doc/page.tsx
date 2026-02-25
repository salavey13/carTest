"use client";

import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { sendMarkdownDoc } from "./actions";
import { parseCellMarkers } from "@/lib/parseCellMarkers";
import { useAppContext } from "@/contexts/AppContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Send, Eye, Edit3, ShieldAlert, UserPlus, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

const MANAGER_ID = "6216799537";

export default function MarkdownDocPage() {
  const { user } = useAppContext();
  const [markdown, setMarkdown] = useState("");
  const [activeTab, setActiveTab] = useState<"edit" | "view">("edit");
  const [loading, setLoading] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("cv_v7_final");
    setMarkdown(saved || "# CyberVibe Report\n\n| (bg-зеленый) Система | Статус |\n|:---|:---|\n| Ядро | (синий) Работает |");
  }, []);

  useEffect(() => {
    localStorage.setItem("cv_v7_final", markdown);
  }, [markdown]);

  const onHandleSend = async (id: string, label: string) => {
    setLoading(label);
    const res = await sendMarkdownDoc(markdown, id, "Report_V7");
    setLoading(null);
    if (res.success) toast.success(`Отправлено: ${label}`);
    else toast.error(res.error);
  };

  return (
    <div className="min-h-screen bg-[#060607] pt-24 pb-12 px-4 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/10 blur-[120px] rounded-full pointer-events-none" />
      
      <div className="max-w-6xl mx-auto space-y-6 relative z-10">
        
        {/* Pro Header */}
        <header className="bg-zinc-900/80 border border-white/5 p-6 rounded-[2.5rem] backdrop-blur-3xl shadow-2xl flex flex-col xl:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
              <ShieldAlert className="text-white" size={24} />
            </div>
            <div className="text-center xl:text-left">
              <h1 className="font-orbitron text-2xl font-black text-white tracking-tighter">DOCX GEN v7.0</h1>
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-1">Shared Parsing Protocol Active</p>
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-3">
            <Button variant="outline" size="sm" onClick={() => {navigator.clipboard.writeText(markdown); toast.success("Copied!");}} className="rounded-xl bg-white/5 border-white/10 hover:bg-white/10">
              <Copy size={14} className="mr-2"/> COPY
            </Button>
            <Button size="sm" onClick={() => onHandleSend(user?.id?.toString() || "", "СЕБЕ")} disabled={!!loading} className="bg-zinc-100 text-black hover:bg-white rounded-xl font-bold px-6">
              {loading === "СЕБЕ" ? <Loader2 className="animate-spin" /> : <Send size={14} className="mr-2"/>} SEND SELF
            </Button>
            <Button size="sm" onClick={() => onHandleSend(MANAGER_ID, "МЕНЕДЖЕРУ")} disabled={!!loading} className="bg-indigo-600 text-white hover:bg-indigo-500 rounded-xl font-bold px-6 shadow-lg shadow-indigo-600/20">
              {loading === "МЕНЕДЖЕРУ" ? <Loader2 className="animate-spin" /> : <UserPlus size={14} className="mr-2"/>} MANAGER
            </Button>
          </div>
        </header>

        {/* Two-Column Editor */}
        <div className="grid md:grid-cols-2 gap-6 h-[60vh] md:h-[70vh]">
          {/* Editor */}
          <div className={cn("flex flex-col bg-zinc-950/50 border border-white/5 rounded-[2.5rem] overflow-hidden", activeTab === "view" && "hidden md:flex")}>
            <div className="px-6 py-3 border-b border-white/5 bg-black/20 text-[10px] font-bold text-zinc-600 uppercase tracking-widest flex items-center gap-2">
              <Edit3 size={12}/> Editor_Draft
            </div>
            <textarea 
              value={markdown}
              onChange={e => setMarkdown(e.target.value)}
              className="flex-1 p-8 bg-transparent text-zinc-300 font-mono text-sm focus:outline-none resize-none custom-scrollbar leading-relaxed"
              placeholder="System Ready..."
            />
          </div>

          {/* Preview - СИНХРОННЫЙ ПАРСИНГ ТУТ */}
          <div className={cn("flex flex-col bg-zinc-950/20 border border-white/5 rounded-[2.5rem] overflow-hidden backdrop-blur-sm shadow-inner", activeTab === "edit" && "hidden md:flex")}>
            <div className="px-6 py-3 border-b border-white/5 bg-black/20 text-[10px] font-bold text-zinc-600 uppercase tracking-widest flex items-center gap-2">
              <Eye size={12}/> Output_Stream
            </div>
            <div className="flex-1 p-8 overflow-auto prose prose-invert prose-blue max-w-none custom-scrollbar prose-sm">
              <ReactMarkdown 
                remarkPlugins={[remarkGfm]}
                components={{
                  td: ({ children }) => {
                    const rawText = String(children);
                    // Используем ту же самую синхронную функцию из /lib
                    const { text, bg, textColor } = parseCellMarkers(rawText);

                    return (
                      <td className="border border-white/5 p-4 transition-all" style={{ 
                        backgroundColor: bg ? `${bg}22` : undefined, // Добавляем прозрачность для UI
                        color: textColor || (bg ? bg : undefined),
                        borderLeft: bg ? `4px solid ${bg}` : undefined
                      }}>
                        {text || <span className="opacity-20">empty</span>}
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

        {/* Mobile Navbar */}
        <div className="flex md:hidden fixed bottom-6 left-4 right-4 bg-zinc-900 border border-white/10 rounded-2xl p-1 z-50 shadow-2xl">
          <button onClick={() => setActiveTab("edit")} className={cn("flex-1 py-4 rounded-xl text-xs font-bold transition-all uppercase tracking-widest", activeTab === "edit" ? "bg-white/10 text-white shadow-inner" : "text-zinc-500")}>Edit</button>
          <button onClick={() => setActiveTab("view")} className={cn("flex-1 py-4 rounded-xl text-xs font-bold transition-all uppercase tracking-widest", activeTab === "view" ? "bg-white/10 text-white shadow-inner" : "text-zinc-500")}>View</button>
        </div>
      </div>
    </div>
  );
}