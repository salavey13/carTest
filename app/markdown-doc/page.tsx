"use client";

import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { generateAndSendDoc } from "./actions";
import { useAppContext } from "@/contexts/AppContext";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Send, Eye, Edit3, PlusCircle, ShieldCheck, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

const MANAGER_ID = "6216799537";

// Повторим логику парсинга на фронте для мгновенного превью
const RU_MAP: Record<string, string> = { "красный": "red", "зеленый": "green", "зелёный": "green", "синий": "blue", "желтый": "yellow", "жёлтый": "yellow" };
const HEX_MAP: Record<string, string> = { red: "EF4444", green: "22C55E", blue: "3B82F6", yellow: "EAB308" };

export default function MarkdownDocPage() {
  const { user } = useAppContext();
  const [markdown, setMarkdown] = useState("");
  const [activeTab, setActiveTab] = useState<"edit" | "view">("edit");
  const [loading, setLoading] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("cv_v5_final");
    setMarkdown(saved || "# Отчёт\n\n| (bg-зелёный) Узел | Статус |\n|:---|:---|\n| Сервер | (красный) Ошибка |");
  }, []);

  useEffect(() => {
    if (markdown) localStorage.setItem("cv_v5_final", markdown);
  }, [markdown]);

  const onSend = async (targetId: string, label: string) => {
    setLoading(label);
    const res = await generateAndSendDoc(markdown, targetId, "CyberReport");
    setLoading(null);
    if (res.success) toast.success(`Отправлено: ${label}`);
  };

  // Хелпер для извлечения текста из React children
  const extractText = (node: any): string => {
    if (!node) return "";
    if (typeof node === "string") return node;
    if (Array.isArray(node)) return node.map(extractText).join("");
    if (node.props?.children) return extractText(node.props.children);
    return "";
  };

  return (
    <div className="min-h-screen bg-[#050506] pt-24 pb-12 px-4">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Elite Header */}
        <header className="bg-zinc-900/80 border border-white/5 p-6 rounded-[2rem] backdrop-blur-3xl shadow-2xl flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center">
              <Zap className="text-white fill-white" size={28} />
            </div>
            <div className="text-center md:text-left">
              <h1 className="font-orbitron text-2xl font-black text-white leading-none tracking-tighter">MD PRO</h1>
              <p className="text-[10px] text-blue-400 font-bold uppercase tracking-[0.3em] mt-2">V5.0 Precision Render</p>
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-2">
            <Button size="sm" onClick={() => onSend(user?.id?.toString() || "", "СЕБЕ")} disabled={!!loading} className="bg-white text-black rounded-xl">
              {loading === "СЕБЕ" ? <Loader2 className="animate-spin" /> : <Send size={14} className="mr-2"/>} SELF
            </Button>
            <Button size="sm" onClick={() => onSend(MANAGER_ID, "МЕНЕДЖЕРУ")} disabled={!!loading} className="bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-600/20">
              {loading === "МЕНЕДЖЕРУ" ? <Loader2 className="animate-spin" /> : <ShieldCheck size={14} className="mr-2"/>} MANAGER
            </Button>
          </div>
        </header>

        {/* Workspace */}
        <div className="grid md:grid-cols-2 gap-6 h-[60vh] md:h-[70vh]">
          {/* Editor */}
          <div className={cn("flex flex-col bg-zinc-950/50 border border-white/5 rounded-[2.5rem] overflow-hidden", activeTab === "view" && "hidden md:flex")}>
            <div className="px-6 py-3 border-b border-white/5 bg-black/20 text-[10px] font-bold text-zinc-500 uppercase">Editor</div>
            <textarea 
              value={markdown}
              onChange={e => setMarkdown(e.target.value)}
              className="flex-1 p-8 bg-transparent text-zinc-300 font-mono text-sm focus:outline-none resize-none custom-scrollbar"
            />
          </div>

          {/* Preview */}
          <div className={cn("flex flex-col bg-zinc-950/20 border border-white/5 rounded-[2.5rem] overflow-hidden backdrop-blur-sm", activeTab === "edit" && "hidden md:flex")}>
            <div className="px-6 py-3 border-b border-white/5 bg-black/20 text-[10px] font-bold text-zinc-500 uppercase">Render</div>
            <div className="flex-1 p-8 overflow-auto prose prose-invert max-w-none custom-scrollbar prose-sm">
              <ReactMarkdown 
                remarkPlugins={[remarkGfm]}
                components={{
                  td: ({ children }) => {
                    const text = extractText(children);
                    const matches = [...text.matchAll(/\((bg-|фон-)?([a-zа-яё#0-9-]+)\)/gi)];
                    let bg, fg, clean = text.replace(/\(.*?\)/g, "").trim();
                    
                    matches.forEach(m => {
                      const isBg = m[1] === "bg-" || m[1] === "фон-";
                      const val = m[2].toLowerCase().replace(/ё/g, "е");
                      const hex = HEX_MAP[RU_MAP[val] || val];
                      if (hex) { if (isBg) bg = hex; else fg = hex; }
                    });

                    return (
                      <td className="border border-white/5 p-4 transition-all" style={{ 
                        backgroundColor: bg ? `#${bg}44` : undefined, 
                        color: fg ? `#${fg}` : bg ? `#${bg}` : undefined 
                      }}>
                        {clean || " "}
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
        <div className="flex md:hidden fixed bottom-6 left-4 right-4 bg-zinc-900 border border-white/10 rounded-2xl p-1 z-50">
          <button onClick={() => setActiveTab("edit")} className={cn("flex-1 py-3 rounded-xl text-xs font-bold transition-all", activeTab === "edit" ? "bg-white/10 text-white" : "text-zinc-500")}>EDITOR</button>
          <button onClick={() => setActiveTab("view")} className={cn("flex-1 py-3 rounded-xl text-xs font-bold transition-all", activeTab === "view" ? "bg-white/10 text-white" : "text-zinc-500")}>PREVIEW</button>
        </div>
      </div>
    </div>
  );
}