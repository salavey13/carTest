"use client";

import React, { useState } from "react";
import axios from "axios";
import { motion } from "framer-motion";

interface FileNode {
  path: string;
  content: string;
}

const RepoTxtFetcher: React.FC = () => {
  const [repoUrl, setRepoUrl] = useState<string>("https://github.com/salavey13/cartest");
  const [token, setToken] = useState<string>("");
  const [txtOutput, setTxtOutput] = useState<string>("");
  const [selectedOutput, setSelectedOutput] = useState<string>("");
  const [files, setFiles] = useState<FileNode[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<{ id: number; message: string }[]>([]);

  const addToast = (message: string) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  };

  const parseRepoUrl = (url: string) => {
    const match = url.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (!match) throw new Error("Неверный URL GitHub");
    return { owner: match[1], repo: match[2] };
  };

  const fetchRepoContents = async (owner: string, repo: string, path: string = "") => {
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
    const headers: any = { Accept: "application/vnd.github.v3+json" };
    if (token) headers.Authorization = `token ${token}`;

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
      addToast("Извлечение завершено. TXT в кармане!");
    } catch (err: any) {
      setError(`Ошибка загрузки: ${err.message}. Проверь URL или токен.`);
      addToast("Ошибка: Извлечение заглохло!");
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
    <div className="max-w-5xl mx-auto p-8 bg-card rounded-2xl shadow-[0_0_20px_rgba(255,107,107,0.3)] border border-muted animate-[drift_20s_infinite]">
      <h2 className="text-5xl font-bold cyber-text mb-6 tracking-wider glitch" data-text="Кибер-Экстрактор TXT">
        Кибер-Экстрактор TXT
      </h2>
      <p className="text-muted-foreground mb-8 text-xl font-mono leading-relaxed">
        Новичок? Забей. Это выгребает файлы в один TXT для ботов, чтобы твой проект взлетел. Кидай URL GitHub, токен (чтоб GitHub не выпендривался), жми кнопку и забирай TXT. Только .ts, .tsx, .css, .sql, без мусора из components/ui/*—чисто и по делу.
      </p>
      <div className="flex flex-col gap-6 mb-8">
        <input
          type="text"
          value={repoUrl}
          onChange={(e) => setRepoUrl(e.target.value)}
          placeholder="Вставь URL GitHub (например, https://github.com/user/repo)"
          className="flex-grow p-4 bg-input border border-border rounded-xl text-foreground focus:outline-none focus:ring-4 focus:ring-primary/50 text-glow font-mono text-lg shadow-[inset_0_0_10px_rgba(255,107,107,0.2)]"
        />
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Токен GitHub (для приватных реп или лимитов)"
          className="flex-grow p-4 bg-input border border-border rounded-xl text-foreground focus:outline-none focus:ring-4 focus:ring-primary/50 text-glow font-mono text-lg shadow-[inset_0_0_10px_rgba(255,107,107,0.2)]"
        />
        <button
          onClick={handleFetch}
          disabled={loading}
          className={`px-8 py-4 rounded-xl font-semibold text-primary-foreground ${
            loading
              ? "bg-muted cursor-not-allowed animate-pulse"
              : "bg-primary hover:bg-secondary hover:shadow-[0_0_15px_rgba(255,107,107,0.7)]"
          } transition-all text-glow font-mono text-lg`}
        >
          {loading ? "Взламываю..." : "Извлечь TXT"}
        </button>
      </div>

      {loading && (
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          className="h-3 bg-primary rounded-full mb-8 shadow-[0_0_15px_rgba(255,107,107,0.8)]"
        />
      )}

      {error && (
        <p className="text-destructive mb-8 font-mono text-lg animate-[neon_2s_infinite]">{error}</p>
      )}

      {files.length > 0 && (
        <div className="mb-8 bg-popover p-6 rounded-xl shadow-inner border border-border">
          <h3 className="text-3xl font-semibold text-secondary mb-4 cyber-text glitch" data-text="Дерево файлов">
            Дерево файлов
          </h3>
          <ul className="space-y-3">
            {files.map((file) => (
              <li key={file.path} className="flex items-center gap-3 group">
                <input
                  type="checkbox"
                  checked={selectedFiles.has(file.path)}
                  onChange={() => toggleFileSelection(file.path)}
                  className="w-5 h-5 accent-primary rounded focus:ring-2 focus:ring-primary/50"
                />
                <span className="text-muted-foreground font-mono text-base group-hover:text-foreground transition-colors duration-300">
                  {file.path}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {txtOutput && (
        <div className="mb-8 bg-popover p-6 rounded-xl shadow-inner border border-border">
          <h3 className="text-3xl font-semibold text-secondary mb-4 cyber-text glitch" data-text="Полный TXT">
            Полный TXT
          </h3>
          <textarea
            value={txtOutput}
            readOnly
            className="w-full h-72 bg-card p-4 rounded-lg text-sm text-muted-foreground font-mono border border-muted resize-none scrollbar-thin scrollbar-thumb-primary scrollbar-track-muted"
          />
        </div>
      )}

      {selectedOutput && (
        <div className="bg-popover p-6 rounded-xl shadow-inner border border-border">
          <h3
            className="text-3xl font-semibold text-secondary mb-4 cyber-text glitch"
            data-text="Выбранные файлы (TXT)"
          >
            Выбранные файлы (TXT)
          </h3>
          <textarea
            value={selectedOutput}
            readOnly
            className="w-full h-72 bg-card p-4 rounded-lg text-sm text-muted-foreground font-mono border border-muted resize-none scrollbar-thin scrollbar-thumb-primary scrollbar-track-muted"
            placeholder="Выбери файлы для их содержимого здесь..."
          />
        </div>
      )}

      <div className="fixed bottom-6 right-6 space-y-3 z-50">
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 50 }}
            className="bg-primary text-primary-foreground p-4 rounded-lg shadow-[0_0_15px_rgba(255,107,107,0.7)] font-mono text-base border border-primary/50"
          >
            {toast.message}
          </motion.div>
        ))}
      </div>

      <script src="https://unpkg.com/axios/dist/axios.min.js" async></script>
    </div>
  );
};

export default function RepoTxtPage() {
  return (
    <div className="min-h-screen pt-24 bg-background bg-grid-pattern animate-[drift_30s_infinite]">
      <header className="fixed top-0 left-0 right-0 bg-card shadow-md p-6 z-10 border-b border-muted">
        <h1
          className="text-4xl font-bold text-gradient cyber-text glitch"
          data-text="Генератор Кибер-TXT"
        >
          Генератор Кибер-TXT
        </h1>
      </header>
      <main className="container mx-auto pt-10">
        <RepoTxtFetcher />
      </main>
    </div>
  );
}

// Glitch effect CSS (add to globals.css if not present)
const glitchStyle = `
  .glitch {
    position: relative;
  }
  .glitch::before,
  .glitch::after {
    content: attr(data-text);
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
  }
  .glitch::before {
    color: #ff6b6b;
    animation: glitch 1s infinite alternate-reverse;
    clip-path: polygon(0 0, 100% 0, 100% 20%, 0 20%);
  }
  .glitch::after {
    color: #4ecdc4;
    animation: glitch 1.5s infinite alternate;
    clip-path: polygon(0 80%, 100% 80%, 100% 100%, 0 100%);
  }
  @keyframes glitch {
    0% { transform: translate(0); }
    20% { transform: translate(-2px, 2px); }
    40% { transform: translate(2px, -2px); }
    60% { transform: translate(-2px, 0); }
    80% { transform: translate(2px, 2px); }
    100% { transform: translate(0); }
  }
`;
