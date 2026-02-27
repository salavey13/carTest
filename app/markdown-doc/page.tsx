"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Loader2, Send, UserCheck, Sparkles, Eye, Edit3, FileText, ListChecks } from "lucide-react";
import { loadFrancheezeStatusMarkdown, sendMarkdownDoc } from "./actions";
import { parseCellMarkers } from "@/lib/parseCellMarkers";
import { useAppContext } from "@/contexts/AppContext";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const MANAGER_ID = "6216799537";
const LOCAL_STORAGE_KEY = "markdown_doc_studio_v9";

const DEMO_MARKDOWN = `# Отчёт по задаче

> **Важно:** таблицы в DOCX экспортируются с адекватной шириной колонок и корректно читаются в разных viewer.

## Сводка

| (bg-emerald) **Блок** | **Статус** | **Комментарий** |
|:--|:--:|--:|
| (фиолет) *Авторизация* | ✅ Готово | Поддержка Telegram WebApp |
| **Markdown DOC** | ⚙️ В работе | Исправлены жирный/**курсив** и ширина таблиц |
| (bg-cyan) Интеграции | 🚀 Запущено | Экспорт в Telegram |

Обычный текст, **жирный текст**, *курсив*, а также ***жирный курсив*** корректно экспортируются в DOCX.`;

function extractText(node: ReactNode): string {
  if (!node) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (typeof node === "object" && "props" in node) {
    return extractText((node as { props?: { children?: ReactNode } }).props?.children);
  }

  return "";
}

function renderCell(children: ReactNode, isHeader = false) {
  const rawText = extractText(children);
  const { text, bg, textColor } = parseCellMarkers(rawText);
  const Tag = isHeader ? "th" : "td";
  const hasColorMarker = Boolean(bg || textColor);

  return (
    <Tag
      className="markdown-cell"
      style={{
        backgroundColor: bg ? `${bg}22` : undefined,
        color: textColor || undefined,
      }}
    >
      {hasColorMarker ? text : children}
    </Tag>
  );
}

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

  const loadStatusDemo = async () => {
    try {
      setLoading("STATUS");
      const content = await loadFrancheezeStatusMarkdown();
      setMarkdown(content);
      toast.success("Загружен docs/THE_FRANCHEEZEPLAN_STATUS.MD");
    } catch (error: any) {
      toast.error(error?.message || "Не удалось загрузить статус-файл");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#050506] px-4 pb-24 pt-24 md:pb-12 md:pt-28">
      <div className="mx-auto max-w-6xl space-y-4 md:space-y-6">
        <header className="z-40 rounded-[1.75rem] border border-white/10 bg-zinc-900/85 p-4 shadow-2xl backdrop-blur-3xl md:sticky md:top-20 md:rounded-[2.25rem] md:p-6">
          <div className="flex flex-col gap-4 md:gap-5">
            <div className="flex items-center gap-3 md:gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 md:h-12 md:w-12 md:rounded-2xl">
                <Sparkles className="h-5 w-5 text-white md:h-6 md:w-6" />
              </div>
              <div>
                <h1 className="font-orbitron text-lg font-black text-white md:text-xl">Markdown DOC Studio</h1>
                <p className="text-[11px] text-zinc-400 md:text-xs">robust tables + correct DOCX emphasis</p>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2 sm:flex sm:flex-wrap sm:items-center">
              <Button
                size="sm"
                onClick={() => setMarkdown(DEMO_MARKDOWN)}
                className="h-10 rounded-xl border border-white/20 bg-transparent px-2 text-white hover:bg-white/10 sm:px-4"
              >
                <FileText className="h-4 w-4" />
                <span className="hidden sm:inline">ДЕМО</span>
              </Button>
              <Button
                size="sm"
                onClick={loadStatusDemo}
                disabled={!!loading}
                className="h-10 rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-2 text-cyan-100 hover:bg-cyan-500/20 sm:px-4"
              >
                {loading === "STATUS" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ListChecks className="h-4 w-4" />}
                <span className="hidden sm:inline">STATUS</span>
              </Button>
              <Button
                size="sm"
                onClick={() => onSend(user?.id?.toString() || "", "СЕБЕ")}
                disabled={!!loading}
                className="h-10 rounded-xl bg-white px-2 text-black sm:px-4"
              >
                {loading === "СЕБЕ" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                <span className="hidden sm:inline">СЕБЕ</span>
              </Button>
              <Button
                size="sm"
                onClick={() => onSend(MANAGER_ID, "МЕНЕДЖЕРУ")}
                disabled={!!loading}
                className="h-10 rounded-xl bg-blue-600 px-2 text-white sm:px-4"
              >
                {loading === "МЕНЕДЖЕРУ" ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4" />}
                <span className="hidden sm:inline">МЕНЕДЖЕРУ</span>
              </Button>
            </div>
          </div>

          <div className="mt-3 hidden flex-wrap gap-2 text-xs text-zinc-400 md:flex">
            <span className="rounded-full border border-white/15 px-3 py-1">Строк: {docStats.lines}</span>
            <span className="rounded-full border border-white/15 px-3 py-1">Табличных строк: {docStats.tableRows}</span>
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-emerald-300">adaptive table preview</span>
          </div>
        </header>

        <section className="grid h-[66vh] gap-4 md:h-[64vh] md:gap-6 md:grid-cols-2">
          <article
            className={cn(
              "flex flex-col overflow-hidden rounded-[1.75rem] border border-white/10 bg-zinc-950/70 md:rounded-[2.25rem]",
              activeTab === "view" && "hidden md:flex",
            )}
          >
            <div className="border-b border-white/10 px-4 py-3 text-xs font-semibold text-zinc-400">Markdown editor</div>
            <textarea
              value={markdown}
              onChange={(e) => setMarkdown(e.target.value)}
              className="custom-scrollbar h-full flex-1 resize-none bg-transparent p-4 font-mono text-sm text-zinc-200 outline-none md:p-6"
              placeholder="Вставьте markdown..."
            />
          </article>

          <article
            className={cn(
              "flex flex-col overflow-hidden rounded-[1.75rem] border border-white/10 bg-zinc-950/40 backdrop-blur-sm md:rounded-[2.25rem]",
              activeTab === "edit" && "hidden md:flex",
            )}
          >
            <div className="border-b border-white/10 px-4 py-3 text-xs font-semibold text-zinc-400">Live preview</div>
            <div className="markdown-doc-preview custom-scrollbar flex-1 overflow-auto p-4 md:p-6">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  table: ({ children }) => (
                    <div className="markdown-table-wrap">
                      <table>{children}</table>
                    </div>
                  ),
                  td: ({ children }) => renderCell(children, false),
                  th: ({ children }) => renderCell(children, true),
                }}
              >
                {markdown}
              </ReactMarkdown>
            </div>
          </article>
        </section>

        <div className="fixed bottom-4 left-4 right-4 z-50 flex rounded-2xl border border-white/10 bg-zinc-900/95 p-1 shadow-2xl md:hidden">
          <button
            onClick={() => setActiveTab("edit")}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold",
              activeTab === "edit" ? "bg-white/10 text-white" : "text-zinc-500",
            )}
          >
            <Edit3 size={14} />
            <span className="max-[380px]:hidden">ТЕКСТ</span>
          </button>
          <button
            onClick={() => setActiveTab("view")}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold",
              activeTab === "view" ? "bg-white/10 text-white" : "text-zinc-500",
            )}
          >
            <Eye size={14} />
            <span className="max-[380px]:hidden">ОБЗОР</span>
          </button>
        </div>
      </div>

      <style jsx global>{`
        .markdown-doc-preview {
          color: #e4e4e7;
          line-height: 1.6;
        }

        .markdown-table-wrap {
          width: 100%;
          overflow-x: auto;
          margin: 1rem 0;
          border: 1px solid rgba(255, 255, 255, 0.16);
          border-radius: 0.75rem;
          background: rgba(24, 24, 27, 0.4);
        }

        .markdown-doc-preview table {
          width: 100%;
          min-width: 520px;
          border-collapse: collapse;
          table-layout: auto;
          margin: 0;
        }

        .markdown-doc-preview th,
        .markdown-doc-preview td,
        .markdown-doc-preview .markdown-cell {
          border: 1px solid rgba(255, 255, 255, 0.16);
          padding: 0.65rem;
          vertical-align: top;
          word-break: normal;
          overflow-wrap: break-word;
          white-space: normal;
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
