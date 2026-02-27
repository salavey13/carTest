"use client";

import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Loader2, Send, UserCheck, Sparkles, Eye, Edit3, FileText } from "lucide-react";
import { sendMarkdownDoc } from "./actions";
import { useAppContext } from "@/contexts/AppContext";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const MANAGER_ID = "6216799537";
const LOCAL_STORAGE_KEY = "markdown_doc_studio_v9";

const DEMO_MARKDOWN = `# Отчёт по задаче

> **Важно:** таблицы в DOCX экспортируются с фиксированной шириной колонок для стабильного отображения.

## Сводка

| **Блок** | **Статус** | **Комментарий** |
|:--|:--:|--:|
| *Авторизация* | ✅ Готово | Поддержка Telegram WebApp |
| **Markdown DOC** | ⚙️ В работе | Исправлены жирный/**курсив** и ширина таблиц |
| Интеграции | 🚀 Запущено | Экспорт в Telegram |

Обычный текст, **жирный текст**, *курсив*, а также ***жирный курсив*** корректно экспортируются в DOCX.`;

export default function MarkdownDocPage() {
  const { user } = useAppContext();
  const [markdown, setMarkdown] = useState("");
  const [activeTab, setActiveTab] = useState<"edit" | "view">("edit");
  const [loading, setLoading] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    setMarkdown(saved || DEMO_MARKDOWN);
  }, []);

  useEffect(() => {
    if (!markdown) return;
    localStorage.setItem(LOCAL_STORAGE_KEY, markdown);
  }, [markdown]);

  const docStats = useMemo(() => {
    const lines = markdown.split(/\r?\n/).filter((line) => line.trim().length > 0).length;
    const tableRows = markdown
      .split(/\r?\n/)
      .filter((line) => line.trim().startsWith("|") && !line.includes("---")).length;

    return { lines, tableRows };
  }, [markdown]);

  const onSend = async (id: string, label: string) => {
    if (!id) {
      toast.error("Не удалось определить получателя");
      return;
    }

    setLoading(label);
    const result = await sendMarkdownDoc(markdown, id);
    setLoading(null);

    if (result.success) {
      toast.success(`DOCX отправлен: ${label}`);
    } else {
      toast.error(result.error || "Ошибка отправки DOCX");
    }
  };

  return (
    <div className="min-h-screen bg-[#050506] pt-28 pb-12 px-4">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="sticky top-20 z-50 rounded-[2.25rem] border border-white/10 bg-zinc-900/85 p-6 shadow-2xl backdrop-blur-3xl">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600">
                <Sparkles className="text-white" />
              </div>
              <div>
                <h1 className="font-orbitron text-xl font-black text-white">Markdown DOC Studio v9</h1>
                <p className="text-xs text-zinc-400">Усиленный рендер таблиц + корректный DOCX для bold/italic</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button
                size="sm"
                onClick={() => setMarkdown(DEMO_MARKDOWN)}
                className="rounded-xl border border-white/20 bg-transparent px-5 text-white hover:bg-white/10"
              >
                <FileText className="mr-2 h-4 w-4" /> ДЕМО
              </Button>
              <Button
                size="sm"
                onClick={() => onSend(user?.id?.toString() || "", "СЕБЕ")}
                disabled={!!loading}
                className="rounded-xl bg-white px-5 text-black"
              >
                {loading === "СЕБЕ" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                СЕБЕ
              </Button>
              <Button
                size="sm"
                onClick={() => onSend(MANAGER_ID, "МЕНЕДЖЕРУ")}
                disabled={!!loading}
                className="rounded-xl bg-blue-600 px-5 text-white"
              >
                {loading === "МЕНЕДЖЕРУ" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserCheck className="mr-2 h-4 w-4" />}
                МЕНЕДЖЕРУ
              </Button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2 text-xs text-zinc-400">
            <span className="rounded-full border border-white/15 px-3 py-1">Строк: {docStats.lines}</span>
            <span className="rounded-full border border-white/15 px-3 py-1">Табличных строк: {docStats.tableRows}</span>
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-emerald-300">DOCX layout: fixed table width</span>
          </div>
        </header>

        <section className="grid h-[64vh] gap-6 md:grid-cols-2">
          <article
            className={cn(
              "flex flex-col overflow-hidden rounded-[2.25rem] border border-white/10 bg-zinc-950/70",
              activeTab === "view" && "hidden md:flex",
            )}
          >
            <div className="border-b border-white/10 px-5 py-3 text-xs font-semibold text-zinc-400">Markdown editor</div>
            <textarea
              value={markdown}
              onChange={(e) => setMarkdown(e.target.value)}
              className="custom-scrollbar h-full flex-1 resize-none bg-transparent p-6 font-mono text-sm text-zinc-200 outline-none"
              placeholder="Вставьте markdown..."
            />
          </article>

          <article
            className={cn(
              "flex flex-col overflow-hidden rounded-[2.25rem] border border-white/10 bg-zinc-950/40 backdrop-blur-sm",
              activeTab === "edit" && "hidden md:flex",
            )}
          >
            <div className="border-b border-white/10 px-5 py-3 text-xs font-semibold text-zinc-400">Live preview</div>
            <div className="markdown-doc-preview custom-scrollbar flex-1 overflow-auto p-6">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
            </div>
          </article>
        </section>

        <div className="fixed bottom-6 left-4 right-4 z-50 flex rounded-2xl border border-white/10 bg-zinc-900 p-1 shadow-2xl md:hidden">
          <button
            onClick={() => setActiveTab("edit")}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-xs font-bold",
              activeTab === "edit" ? "bg-white/10 text-white" : "text-zinc-500",
            )}
          >
            <Edit3 size={14} /> ТЕКСТ
          </button>
          <button
            onClick={() => setActiveTab("view")}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-xs font-bold",
              activeTab === "view" ? "bg-white/10 text-white" : "text-zinc-500",
            )}
          >
            <Eye size={14} /> ОБЗОР
          </button>
        </div>
      </div>

      <style jsx global>{`
        .markdown-doc-preview {
          color: #e4e4e7;
          line-height: 1.6;
        }

        .markdown-doc-preview table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
          display: table;
          border: 1px solid rgba(255, 255, 255, 0.16);
          margin: 1rem 0;
          background: rgba(24, 24, 27, 0.4);
        }

        .markdown-doc-preview th,
        .markdown-doc-preview td {
          border: 1px solid rgba(255, 255, 255, 0.16);
          padding: 0.65rem;
          vertical-align: top;
          word-break: break-word;
          overflow-wrap: anywhere;
        }

        .markdown-doc-preview th {
          background: rgba(255, 255, 255, 0.06);
          font-weight: 700;
        }

        .markdown-doc-preview em {
          font-style: italic;
          color: #c4b5fd;
        }

        .markdown-doc-preview strong {
          font-weight: 700;
          color: #fff;
        }
      `}</style>
    </div>
  );
}
