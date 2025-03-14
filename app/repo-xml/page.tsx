"use client";

import React, { useState } from "react";
import axios from "axios";
import { motion } from "framer-motion";
import { runCoseAgent } from "@/app/actions";
import { toast } from "sonner";

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
  const [kworkInput, setKworkInput] = useState<string>("");
  const [botRequest, setBotRequest] = useState<string>("");

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

  const handleGenerateBotRequest = async () => {
    if (!kworkInput.trim()) {
      toast.error("Введи запрос с Kwork!");
      return;
    }

    setLoading(true);
    setBotRequest("");
    addToast("Генерирую запрос для бота...");

    try {
      const context = selectedOutput || txtOutput || "No repo context provided.";
      const fullInput = `Kwork request: "${kworkInput}"\nRepo context:\n${context}`;
      const botId = "7481446329554747397"; // Replace with your KworkBotConverter bot ID
      const userId = "341503612082"; // Replace with your Coze user ID
      const response = await runCoseAgent(botId, userId, fullInput);
      setBotRequest(response);
      toast.success("Запрос для бота готов!");
    } catch (err) {
      setError("Ошибка генерации запроса для бота.");
      addToast("Ошибка: Генерация заглохла!");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full p-8 bg-card rounded-2xl shadow-[0_0_20px_rgba(255,107,107,0.3)] border border-muted animate-[drift_20s_infinite]">
      <h2 className="text-5xl font-bold text-white mb-6 tracking-wider glitch" data-text="Кибер-Экстрактор TXT">
        Кибер-Экстрактор TXT
      </h2>
      <p className="text-gray-300 mb-8 text-xl font-mono leading-relaxed">
        Кидай URL GitHub, токен (для приватных реп), жми кнопку—получай TXT из .ts, .tsx, .css, .sql. Плюс: превращай запросы с Kwork в техзадания для ботов с учётом моего арсенала (CAPTCHA, Bullshit Detector, Wheel of Fortune). Выбирай файлы для контекста!
      </p>

      {/* Repo Input Section */}
      <div className="flex flex-col gap-6 mb-8">
        <input
          type="text"
          value={repoUrl}
          onChange={(e) => setRepoUrl(e.target.value)}
          placeholder="Вставь URL GitHub (например, https://github.com/user/repo)"
          className="flex-grow p-4 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-4 focus:ring-purple-500/50 font-mono text-lg shadow-[inset_0_0_10px_rgba(255,107,107,0.2)]"
        />
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Токен GitHub (для приватных реп или лимитов)"
          className="flex-grow p-4 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-4 focus:ring-purple-500/50 font-mono text-lg shadow-[inset_0_0_10px_rgba(255,107,107,0.2)]"
        />
        <button
          onClick={handleFetch}
          disabled={loading}
          className={`px-8 py-4 rounded-xl font-semibold text-white ${
            loading
              ? "bg-gray-600 cursor-not-allowed animate-pulse"
              : "bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 hover:shadow-[0_0_15px_rgba(255,107,107,0.7)]"
          } transition-all font-mono text-lg`}
        >
          {loading ? "Взламываю..." : "Извлечь TXT"}
        </button>
      </div>

      {/* Kwork Input Section */}
      <div className="mb-8 bg-gray-800 p-6 rounded-xl shadow-inner border border-gray-700">
        <h3 className="text-3xl font-semibold text-white mb-4 glitch" data-text="Kwork в Бота">
          Kwork в Бота
        </h3>
        <textarea
          value={kworkInput}
          onChange={(e) => setKworkInput(e.target.value)}
          placeholder="Вставь запрос с Kwork (например, 'Нужен бот для квизов с статистикой')"
          className="w-full h-32 p-4 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-4 focus:ring-purple-500/50 font-mono text-lg shadow-[inset_0_0_10px_rgba(255,107,107,0.2)] resize-none scrollbar-thin scrollbar-thumb-purple-500 scrollbar-track-gray-700"
        />
        <button
          onClick={handleGenerateBotRequest}
          disabled={loading}
          className={`mt-4 px-8 py-4 rounded-xl font-semibold text-white ${
            loading
              ? "bg-gray-600 cursor-not-allowed animate-pulse"
              : "bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 hover:shadow-[0_0_15px_rgba(255,107,107,0.7)]"
          } transition-all font-mono text-lg`}
        >
          {loading ? "Генерирую..." : "Сгенерировать запрос"}
        </button>
      </div>

      {loading && (
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          className="h-3 bg-purple-500 rounded-full mb-8 shadow-[0_0_15px_rgba(255,107,107,0.8)]"
        />
      )}

      {error && (
        <p className="text-red-400 mb-8 font-mono text-lg animate-[neon_2s_infinite]">{error}</p>
      )}

      {files.length > 0 && (
        <div className="mb-8 bg-gray-800 p-6 rounded-xl shadow-inner border border-gray-700">
          <h3 className="text-3xl font-semibold text-white mb-4 glitch" data-text="Дерево файлов">
            Дерево файлов
          </h3>
          <ul className="space-y-3">
            {files.map((file) => (
              <li key={file.path} className="flex items-center gap-3 group">
                <input
                  type="checkbox"
                  checked={selectedFiles.has(file.path)}
                  onChange={() => toggleFileSelection(file.path)}
                  className="w-5 h-5 accent-purple-500 rounded focus:ring-2 focus:ring-purple-500/50"
                />
                <span className="text-gray-400 font-mono text-base group-hover:text-white transition-colors duration-300">
                  {file.path}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {txtOutput && (
        <div className="mb-8 bg-gray-800 p-6 rounded-xl shadow-inner border border-gray-700">
          <h3 className="text-3xl font-semibold text-white mb-4 glitch" data-text="Полный TXT">
            Полный TXT
          </h3>
          <textarea
            value={txtOutput}
            readOnly
            className="w-full h-72 bg-gray-900 p-4 rounded-lg text-sm text-gray-300 font-mono border border-gray-700 resize-none scrollbar-thin scrollbar-thumb-purple-500 scrollbar-track-gray-700"
          />
        </div>
      )}

      {selectedOutput && (
        <div className="mb-8 bg-gray-800 p-6 rounded-xl shadow-inner border border-gray-700">
          <h3 className="text-3xl font-semibold text-white mb-4 glitch" data-text="Выбранные файлы (TXT)">
            Выбранные файлы (TXT)
          </h3>
          <textarea
            value={selectedOutput}
            readOnly
            className="w-full h-72 bg-gray-900 p-4 rounded-lg text-sm text-gray-300 font-mono border border-gray-700 resize-none scrollbar-thin scrollbar-thumb-purple-500 scrollbar-track-gray-700"
          />
        </div>
      )}

      {botRequest && (
        <div className="mb-8 bg-gray-800 p-6 rounded-xl shadow-inner border border-gray-700">
          <h3 className="text-3xl font-semibold text-white mb-4 glitch" data-text="Запрос для Бота">
            Запрос для Бота
          </h3>
          <textarea
            value={botRequest}
            readOnly
            className="w-full h-72 bg-gray-900 p-4 rounded-lg text-sm text-gray-300 font-mono border border-gray-700 resize-none scrollbar-thin scrollbar-thumb-purple-500 scrollbar-track-gray-700"
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
            className="bg-purple-500 text-white p-4 rounded-lg shadow-[0_0_15px_rgba(255,107,107,0.7)] font-mono text-base border border-purple-500/50"
          >
            {toast.message}
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default function RepoXmlPage() {
  return (
    <>
      {/* Apply repo-xml-specific viewport */}
      <meta name="viewport" content="width=1024, initial-scale=0.7, maximum-scale=5.0, user-scalable=yes" />
      <div className="min-h-screen bg-gray-900 bg-grid-pattern animate-[drift_30s_infinite]">
        <div className="repo-xml-content-wrapper">
          <main className="w-full">
            <RepoTxtFetcher />
          </main>
        </div>
      </div>
    </>
  );
}
