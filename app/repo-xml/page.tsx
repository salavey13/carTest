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
  const [allSelected, setAllSelected] = useState<boolean>(false);
  const [extractLoading, setExtractLoading] = useState<boolean>(false);
  const [botLoading, setBotLoading] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<{ id: number; message: string }[]>([]);
  const [kworkInput, setKworkInput] = useState<string>("");

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
    setExtractLoading(true);
    setError(null);
    setTxtOutput("");
    setSelectedOutput("");
    setFiles([]);
    setSelectedFiles(new Set());
    setAllSelected(false);
    setProgress(0);
    addToast("Запускаю извлечение...");

    try {
      const { owner, repo } = parseRepoUrl(repoUrl);
      const fetchedFiles = await fetchRepoContents(owner, repo);
      setFiles(fetchedFiles);
      const txt = generateTxt(fetchedFiles);
      setTxtOutput(txt);
      addToast("Извлечение завершено!");
    } catch (err: any) {
      setError(`Ошибка загрузки: ${err.message}. Проверьте URL или токен.`);
      addToast("Ошибка: Извлечение не удалось!");
    } finally {
      setExtractLoading(false);
      setProgress(100);
    }
  };

  const toggleFileSelection = (path: string) => {
    const newSelected = new Set(selectedFiles);
    if (newSelected.has(path)) newSelected.delete(path);
    else newSelected.add(path);
    setSelectedFiles(newSelected);
    setSelectedOutput(generateSelectedTxt(files));
    setAllSelected(newSelected.size === files.length);
  };

  const handleSelectAll = () => {
    if (allSelected) {
      setSelectedFiles(new Set());
      setSelectedOutput("");
      addToast("Все файлы сняты с выбора");
    } else {
      const allPaths = files.map((file) => file.path);
      setSelectedFiles(new Set(allPaths));
      setSelectedOutput(generateTxt(files));
      addToast("Все файлы выбраны");
    }
    setAllSelected(!allSelected);
  };

  const handleGenerateBotRequest = async () => {
    if (!kworkInput.trim()) {
      toast.error("Введите запрос с Kwork!");
      return;
    }

    setBotLoading(true);
    addToast("Генерирую запрос для бота...");

    try {
      const context = selectedOutput || txtOutput || "Контекст репозитория не предоставлен.";
      const fullInput = `Запрос с Kwork: "${kworkInput}"\nКонтекст репозитория:\n${context}`;
      const botId = "7481446329554747397"; // Замените на ваш ID бота
      const userId = "341503612082"; // Замените на ваш ID пользователя
      const response = await runCoseAgent(botId, userId, fullInput);
      setTxtOutput(response);
      addToast("Запрос для бота сгенерирован!");
    } catch (err) {
      setError("Ошибка генерации запроса для бота.");
      addToast("Ошибка: Генерация не удалась!");
    } finally {
      setBotLoading(false);
    }
  };

  return (
    <div className="w-full p-6 bg-gray-800 rounded-2xl shadow-[0_0_20px_rgba(255,107,107,0.3)] border border-gray-700 repo-xml-content-wrapper">
      <h2 className="text-4xl font-bold text-white mb-6 tracking-wider">
        Кибер-Экстрактор TXT
      </h2>
      <p className="text-gray-300 mb-8 text-lg font-mono">
        Извлекайте текст из репозиториев GitHub (.ts, .tsx, .css, .sql) и генерируйте запросы для ботов с контекстом!
      </p>

      {/* Repo Input Section */}
      <div className="flex flex-col gap-4 mb-8">
        <input
          type="text"
          value={repoUrl}
          onChange={(e) => setRepoUrl(e.target.value)}
          placeholder="URL GitHub (например, https://github.com/user/repo)"
          className="p-4 bg-gray-900 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono"
        />
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Токен GitHub (опционально)"
          className="p-4 bg-gray-900 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono"
        />
        <button
          onClick={handleFetch}
          disabled={extractLoading}
          className={`w-full p-4 rounded-xl font-semibold text-white ${
            extractLoading
              ? "bg-gray-600 cursor-not-allowed"
              : "bg-purple-500 hover:bg-purple-600"
          } transition-all font-mono`}
        >
          {extractLoading ? "Извлечение..." : "Извлечь TXT"}
        </button>
      </div>

      {/* Kwork Input Section */}
      <div className="mb-8 bg-gray-900 p-6 rounded-xl border border-gray-700">
        <h3 className="text-2xl font-semibold text-white mb-4">Kwork в Бота</h3>
        <textarea
          value={kworkInput}
          onChange={(e) => setKworkInput(e.target.value)}
          placeholder="Введите запрос с Kwork (например, 'Нужен бот для квизов со статистикой')"
          className="w-full h-32 p-4 bg-gray-900 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono resize-none"
        />
        <button
          onClick={handleGenerateBotRequest}
          disabled={botLoading}
          className={`w-full p-4 rounded-xl font-semibold text-white ${
            botLoading
              ? "bg-gray-600 cursor-not-allowed"
              : "bg-purple-500 hover:bg-purple-600"
          } transition-all font-mono`}
        >
          {botLoading ? "Генерация..." : "Сгенерировать запрос для бота"}
        </button>
      </div>

      {(extractLoading || botLoading) && (
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          className="h-2 bg-purple-500 rounded-full mb-8"
        />
      )}

      {error && (
        <p className="text-red-400 mb-8 font-mono">{error}</p>
      )}

      {files.length > 0 && (
        <div className="mb-8 bg-gray-900 p-6 rounded-xl border border-gray-700">
          <h3 className="text-2xl font-semibold text-white mb-4">Дерево файлов</h3>
          <button
            onClick={handleSelectAll}
            className="mb-4 p-2 bg-purple-500 text-white rounded hover:bg-purple-600 font-mono"
          >
            {allSelected ? "Снять все" : "Выбрать все"}
          </button>
          <ul className="space-y-2">
            {files.map((file) => (
              <li key={file.path} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedFiles.has(file.path)}
                  onChange={() => toggleFileSelection(file.path)}
                  className="w-4 h-4 accent-purple-500"
                />
                <span className="text-gray-400 font-mono hover:text-white">
                  {file.path}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {txtOutput && (
        <div className="mb-8 bg-gray-900 p-6 rounded-xl border border-gray-700">
          <h3 className="text-2xl font-semibold text-white mb-4">Полный TXT</h3>
          <textarea
            value={txtOutput}
            readOnly
            className="w-full h-64 bg-gray-800 p-4 rounded-lg text-sm text-gray-300 font-mono border border-gray-700 resize-none"
          />
        </div>
      )}

      {selectedOutput && (
        <div className="mb-8 bg-gray-900 p-6 rounded-xl border border-gray-700">
          <h3 className="text-2xl font-semibold text-white mb-4">Выбранный TXT</h3>
          <textarea
            value={selectedOutput}
            readOnly
            className="w-full h-64 bg-gray-800 p-4 rounded-lg text-sm text-gray-300 font-mono border border-gray-700 resize-none"
          />
        </div>
      )}

      <div className="fixed bottom-4 right-4 space-y-2 z-50">
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="bg-purple-500 text-white p-3 rounded-lg shadow-lg font-mono"
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
      {/* Desktop viewport for this page only */}
      <meta name="viewport" content="width=1024, initial-scale=0.7, maximum-scale=5.0, user-scalable=yes" />
      <div className="min-h-screen bg-gray-900">
        <main className="py-6">
          <RepoTxtFetcher />
        </main>
      </div>
    </>
  );
}
