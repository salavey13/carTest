"use client";

import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { sendMarkdownDoc } from "./actions";
import { parseCellMarkers } from "@/lib/parseCellMarkers";
import { useAppContext } from "@/contexts/AppContext";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Send, Eye, Edit3, UserCheck, Sparkles, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

const MANAGER_ID = "6216799537";

export default function MarkdownDocPage() {
  const { user } = useAppContext();
  const [markdown, setMarkdown] = useState("");
  const [activeTab, setActiveTab] = useState<"edit" | "view">("edit");
  const [loading, setLoading] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("cv_v8_fixed");
    setMarkdown(saved || "# Отчёт\n\n| (bg-зелёный) **Участник** | **Действие** |\n|:---|:---|\n| Алиса | (синий) Запрос |");
  }, []);

  useEffect(() => {
    localStorage.setItem("cv_v8_fixed", markdown);
  }, [markdown]);

  // РЕКУРСИВНАЯ ФУНКЦИЯ ДЛЯ ИЗВЛЕЧЕНИЯ ТЕКСТА
  const extractText = (node: any): string => {
    if (!node) return "";
    if (typeof node === "string") return node;
    if (Array.isArray(node)) return node.map(extractText).join("");
    if (node.props?.children) return extractText(node.props.children);
    return "";
  };

  const onSend = async (id: string, label: string) => {
    setLoading(label);
    const res = await sendMarkdownDoc(markdown, id);
    setLoading(null);
    if (res.success) toast.success(`Отправлено: ${label}`);
  };

  const renderCell = (children: any, isHeader = false) => {
    const rawText = extractText(children); // БОЛЬШЕ НИКАКИХ [object Object]
    const { text, bg, textColor } = parseCellMarkers(rawText);
    const Tag = isHeader ? "th" : "td";

    return (
      <Tag 
        className={cn("border border-zinc-800 p-4 transition-all text-sm", isHeader && "bg-zinc-900/50 font-bold")}
        style={{ backgroundColor: bg ? `${bg}33` : undefined, color: textColor || bg }}
      >
        {text || children}
      </Tag>
    );
  };

  return (
    <div className="min-h-screen bg-[#050506] pt-28 pb-12 px-4">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Хедер с хорошим падингом */}
        <header className="bg-zinc-900/90 border border-white/10 p-6 rounded-[2.5rem] backdrop-blur-3xl flex flex-col md:flex-row justify-between items-center gap-6 shadow-2xl sticky top-20 z-50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center">
              <Sparkles className="text-white fill-white" />
            </div>
            <h1 className="font-orbitron text-xl font-black text-white">MD STUDIO 8.2</h1>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <Button size="sm" onClick={() => onSend(user?.id?.toString() || "", "СЕБЕ")} disabled={!!loading} className="bg-white text-black rounded-xl px-6">
              {loading === "СЕБЕ" ? <Loader2 className="animate-spin" /> : <Send size={14} className="mr-2"/>} СЕБЕ
            </Button>
            <Button size="sm" onClick={() => onSend(MANAGER_ID, "МЕНЕДЖЕРУ")} disabled={!!loading} className="bg-blue-600 text-white rounded-xl px-6">
              <UserCheck size={14} className="mr-2"/> МЕНЕДЖЕРУ
            </Button>
          </div>
        </header>

        {/* Воркспейс */}
        <div className="grid md:grid-cols-2 gap-6 h-[60vh] md:h-[65vh]">
          <div className={cn("flex flex-col bg-zinc-950/50 border border-white/5 rounded-[2.5rem] overflow-hidden", activeTab === "view" && "hidden md:flex")}>
            <textarea value={markdown} onChange={e => setMarkdown(e.target.value)} className="flex-1 p-8 bg-transparent text-zinc-300 font-mono text-sm focus:outline-none resize-none custom-scrollbar" />
          </div>

          <div className={cn("flex flex-col bg-zinc-950/20 border border-white/5 rounded-[2.5rem] overflow-hidden backdrop-blur-sm", activeTab === "edit" && "hidden md:flex")}>
            <div className="flex-1 p-8 overflow-auto prose prose-invert prose-sm max-w-none custom-scrollbar">
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
                  td: ({ children }) => renderCell(children, false),
                  th: ({ children }) => renderCell(children, true)
                }}>
                {markdown}
              </ReactMarkdown>
            </div>
          </div>
        </div>

        {/* Мобильные табы */}
        <div className="md:hidden fixed bottom-6 left-4 right-4 bg-zinc-900 border border-white/10 rounded-2xl p-1 z-50 flex shadow-2xl">
          <button onClick={() => setActiveTab("edit")} className={cn("flex-1 py-4 rounded-xl text-xs font-bold", activeTab === "edit" ? "bg-white/10 text-white" : "text-zinc-500")}>ТЕКСТ</button>
          <button onClick={() => setActiveTab("view")} className={cn("flex-1 py-4 rounded-xl text-xs font-bold", activeTab === "view" ? "bg-white/10 text-white" : "text-zinc-500")}>ОБЗОР</button>
        </div>
      </div>
    </div>
  );
}