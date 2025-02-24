"use client";

import React, { useState } from "react";
import axios from "axios";
import { motion } from "framer-motion";

interface FileNode {
  path: string;
  content: string;
}

const RepoXMLFetcher: React.FC = () => {
  const [repoUrl, setRepoUrl] = useState<string>("https://github.com/salavey13/cartest");
  const [txtOutput, setTxtOutput] = useState<string>("");
  const [selectedOutput, setSelectedOutput] = useState<string>("");
  const [files, setFiles] = useState<FileNode[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<{ id: number; message: string }[]>([]);

  const GITHUB_TOKEN = "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";

  const addToast = (message: string) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
  };

  const parseRepoUrl = (url: string) => {
    const match = url.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (!match) throw new Error("Неверный URL GitHub");
    return { owner: match[1], repo: match[2] };
  };

  const fetchRepoContents = async (owner: string, repo: string, path: string = "") => {
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
    const headers = { Accept: "application/vnd.github.v3+json", Authorization: `token ${GITHUB_TOKEN}` };

    try {
      const response = await axios.get(url, { headers });
      const contents = response.data;

      const files: FileNode[] = [];
      const allowedExtensions = [".ts", ".tsx", ".css", ".sql"];
      let total = contents.length;
      let processed = 0;

      for (const item of contents) {
        processed++;
        setProgress((processed / total) * 100);

        if (
          item.type === "file" &&
          allowedExtensions.some((ext) => item.path.endsWith(ext)) &&
          !item.path.startsWith("components/ui/")
        ) {
          addToast(`Сканирую ${item.path}...`);
          try {
            const contentResponse = await axios.get(item.download_url);
            files.push({ path: item.path, content: contentResponse.data });
          } catch (contentErr) {
            console.error(`Ошибка загрузки ${item.path}:`, contentErr);
            addToast(`Ошибка: ${item.path} не загружен`);
          }
        } else if (item.type === "dir") {
          const subFiles = await fetchRepoContents(owner, repo, item.path);
          files.push(...subFiles);
        }
      }
      return files;
    } catch (err) {
      console.error("Ошибка API:", err);
      throw err;
    }
  };

  const generateTxt = (files: FileNode[]) => {
    return files.map((file) => `--- ${file.path} ---\n${file.content}`).join("\n\n");
  };

  const generateSelectedTxt = (files: FileNode[]) => {
    return files
      .filter((file) => selectedFiles.has(file.path))
      .map((file) => `--- ${file.path} ---\n${file.content}`)
      .join("\n\n");
  };

  const handleFetch = async () => {
    setLoading(true);
    setError(null);
    setTxtOutput("");
    setSelectedOutput("");
    setFiles([]);
    setSelectedFiles(new Set());
    setProgress(0);
    addToast("Запускаю кибер-извлечение...");

    try {
      const { owner, repo } = parseRepoUrl(repoUrl);
      const fetchedFiles = await fetchRepoContents(owner, repo);
      setFiles(fetchedFiles);
      const txt = generateTxt(fetchedFiles);
      setTxtOutput(txt);
      addToast("Извлечение завершено. TXT готов!");
    } catch (err: any) {
      setError(`Ошибка загрузки: ${err.message}. Проверь URL.`);
      addToast("Ошибка: Извлечение прервано!");
    } finally {
      setLoading(false);
      setProgress(100);
    }
  };

  const toggleFileSelection = (path: string) => {
    const newSelected = new Set(selectedFiles);
    if (newSelected.has(path)) newSelected.delete(path);
    else newSelected.add(path);
    setSelectedFiles(newSelected);
    setSelectedOutput(generateSelectedTxt(files));
  };

  return (
    <div className="max-w-5xl mx-auto p-6 bg-card rounded-xl shadow-lg border border-muted">
      <h2 className="text-4xl font-bold cyber-text mb-4">Кибер-Экстрактор TXT</h2>
      <p className="text-muted-foreground mb-6 text-lg font-mono">
        Новичок? Не парься. Это выдернет все файлы в один TXT для ботов, чтобы прокачать твой проект. Вставь URL GitHub, жми кнопку и хватай TXT. Берет только .ts, .tsx, .css, .sql, пропускает components/ui/*—чисто и компактно.
      </p>
      <div className="flex flex-col gap-4 mb-6">
        <input
          type="text"
          value={repoUrl}
          onChange={(e) => setRepoUrl(e.target.value)}
          placeholder="Вставь URL GitHub (например, https://github.com/user/repo)"
          className="flex-grow p-3 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-glow font-mono"
        />
        <button
          onClick={handleFetch}
          disabled={loading}
          className={`px-6 py-3 rounded-lg font-semibold text-primary-foreground ${
            loading ? "bg-muted cursor-not-allowed" : "bg-primary hover:bg-secondary"
          } transition-colors text-glow font-mono`}
        >
          {loading ? "Взламываю..." : "Извлечь TXT"}
        </button>
      </div>

      {loading && (
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          className="h-2 bg-primary rounded-full mb-6 shadow-[0_0_10px_rgba(255,107,107,0.8)]"
        />
      )}

      {error && <p className="text-destructive mb-4 font-mono">{error}</p>}

      {files.length > 0 && (
        <div className="mb-6 bg-popover p-4 rounded-lg shadow-inner border border-border">
          <h3 className="text-2xl font-semibold text-secondary mb-2 cyber-text">Дерево файлов</h3>
          <ul className="space-y-2">
            {files.map((file) => (
              <li key={file.path} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedFiles.has(file.path)}
                  onChange={() => toggleFileSelection(file.path)}
                  className="w-4 h-4 accent-primary"
                />
                <span className="text-muted-foreground font-mono text-sm hover:text-foreground transition-colors">
                  {file.path}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {txtOutput && (
        <div className="mb-6 bg-popover p-4 rounded-lg shadow-inner border border-border">
          <h3 className="text-2xl font-semibold text-secondary mb-2 cyber-text">Полный TXT</h3>
          <textarea
            value={txtOutput}
            readOnly
            className="w-full h-64 bg-card p-4 rounded-lg text-sm text-muted-foreground font-mono border border-muted resize-none"
          />
        </div>
      )}

      {selectedOutput && (
        <div className="bg-popover p-4 rounded-lg shadow-inner border border-border">
          <h3 className="text-2xl font-semibold text-secondary mb-2 cyber-text">Выбранные файлы (TXT)</h3>
          <textarea
            value={selectedOutput}
            readOnly
            className="w-full h-64 bg-card p-4 rounded-lg text-sm text-muted-foreground font-mono border border-muted resize-none"
            placeholder="Выбери файлы для их содержимого здесь..."
          />
        </div>
      )}

      <div className="fixed bottom-4 right-4 space-y-2 z-50">
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 50 }}
            className="bg-primary text-primary-foreground p-3 rounded-lg shadow-[0_0_10px_rgba(255,107,107,0.5)] font-mono text-sm"
          >
            {toast.message}
          </motion.div>
        ))}
      </div>

      <script src="https://unpkg.com/axios/dist/axios.min.js" async></script>
    </div>
  );
};

export default function RepoXMLPage() {
  return (
    <div className="min-h-screen pt-24 bg-background bg-grid-pattern">
      <header className="fixed top-0 left-0 right-0 bg-card shadow-md p-4 z-10 border-b border-muted">
        <h1 className="text-3xl font-bold text-gradient cyber-text">Генератор Кибер-TXT</h1>
      </header>
      <main className="container mx-auto pt-8">
        <RepoXMLFetcher />
      </main>
    </div>
  );
}
