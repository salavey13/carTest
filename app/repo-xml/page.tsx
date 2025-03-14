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
  const [extractLoading, setExtractLoading] = useState<boolean>(false);
  const [botLoading, setBotLoading] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<{ id: number; message: string }[]>([]);
  const [kworkInput, setKworkInput] = useState<string>("");

  const importantFiles = [
    "app/actions.ts",
    "app/layout.tsx",
    "app/repo-xml/page.tsx",
    "app/api/auth/jwt/route.ts",
    "app/api/telegramWebhook/route.ts",
    "components/Header.tsx",
    "components/Footer.tsx",
    "lib/utils.ts",
    "hooks/useTelegram.ts",
    "types/database.types.ts",
    "types/supabase.ts",
  ];

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
    setSelectedFiles((prev) => {
      const newSelected = new Set(prev);
      if (newSelected.has(path)) newSelected.delete(path);
      else newSelected.add(path);
      setSelectedOutput(generateSelectedTxt(files)); // Immediate update
      return newSelected;
    });
  };

  const handleAddSelected = () => {
    if (selectedFiles.size === 0) {
      addToast("Выберите хотя бы один файл!");
      return;
    }
    const selectedTxt = generateSelectedTxt(files);
    setKworkInput((prev) => `${prev}\n\nВыбранные файлы:\n${selectedTxt}`);
    addToast("Выбранные файлы добавлены в запрос!");
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
      const botId = "7481446329554747397";
      const userId = "341503612082";
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

  const handleAddFullTree = () => {
    const fullTree = generateTxt(files);
    setKworkInput((prev) => `${prev}\n\nПолное дерево файлов:\n${fullTree}`);
    addToast("Полное дерево добавлено в запрос!");
  };

  const handleAddBriefTree = () => {
    const briefTree = `
      Краткое дерево ключевых файлов:
      - app/actions.ts: Серверные действия, включая runCoseAgent для вызовов бота.
      - app/layout.tsx: Основной макет приложения с хедером, футером и главным контентом.
      - app/repo-xml/page.tsx: Этот инструмент для извлечения текста из GitHub.
      - app/api/auth/jwt/route.ts: Логика аутентификации через JWT.
      - app/api/telegramWebhook/route.ts: Интеграция с Telegram через вебхуки.
      - components/Header.tsx: Компонент хедера приложения.
      - components/Footer.tsx: Компонент футера приложения.
      - lib/utils.ts: Утилиты общего назначения.
      - hooks/useTelegram.ts: Хук для работы с Telegram API.
      - types/database.types.ts: Типы для базы данных.
      - types/supabase.ts: Типы для Supabase интеграции.
      - supabase/: База данных с таблицами, хранилищем, edge-функциями (generate-embeddings) и скриптом инициализации (init.sql).
      Остальное может быть сгенерировано на лету.
    `;
    setKworkInput((prev) => `${prev}\n\n${briefTree}`);
    addToast("Краткое дерево добавлено в запрос!");
  };

  const groupFilesByFolder = (files: FileNode[]) => {
    const grouped: { [key: string]: FileNode[] } = {};
    files.forEach((file) => {
      const folder = file.path.split("/")[0] || "root";
      if (!grouped[folder]) grouped[folder] = [];
      grouped[folder].push(file);
    });
    return grouped;
  };

  const groupedFiles = groupFilesByFolder(files);

  return (
    <div className="w-full p-6 bg-gray-800 pt-24 rounded-2xl shadow-[0_0_30px_rgba(255,107,107,0.5)] border border-gray-700 repo-xml-content-wrapper">
      <h2 className="text-4xl font-bold text-white mb-6 tracking-wider animate-pulse text-shadow-neon">
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
        <motion.button
          onClick={handleFetch}
          disabled={extractLoading}
          className={`px-6 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 transition-all font-mono shadow-lg ${
            extractLoading ? "opacity-50 cursor-not-allowed" : "hover:scale-105"
          }`}
          whileHover={{ scale: extractLoading ? 1 : 1.05 }}
          whileTap={{ scale: extractLoading ? 1 : 0.95 }}
        >
          {extractLoading ? "Извлечение..." : "Извлечь TXT"}
        </motion.button>
      </div>

      {/* Kwork Input Section */}
      <div className="mb-8 bg-gray-900 p-6 rounded-xl border border-gray-700 shadow-[0_0_15px_rgba(0,255,157,0.3)]">
        <h3 className="text-2xl font-semibold text-white mb-4">Kwork в Бота</h3>
        <textarea
          value={kworkInput}
          onChange={(e) => setKworkInput(e.target.value)}
          placeholder="Введите запрос с Kwork (например, 'Нужен бот для квизов со статистикой')"
          className="w-full h-32 p-4 bg-gray-900 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono resize-none"
        />
        <div className="flex gap-4 mt-4 flex-wrap">
          <motion.button
            onClick={handleGenerateBotRequest}
            disabled={botLoading}
            className={`px-6 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 transition-all font-mono shadow-lg ${
              botLoading ? "opacity-50 cursor-not-allowed" : "hover:scale-105"
            }`}
            whileHover={{ scale: botLoading ? 1 : 1.05 }}
            whileTap={{ scale: botLoading ? 1 : 0.95 }}
          >
            {botLoading ? "Генерация..." : "Сгенерировать запрос для бота"}
          </motion.button>
          <motion.button
            onClick={handleAddFullTree}
            className="px-6 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 transition-all font-mono shadow-lg hover:scale-105"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Добавить дерево файлов
          </motion.button>
          <motion.button
            onClick={handleAddBriefTree}
            className="px-6 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-green-500 to-lime-500 hover:from-green-600 hover:to-lime-600 transition-all font-mono shadow-lg hover:scale-105"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Добавить ключевые файлы
          </motion.button>
          <motion.button
            onClick={handleAddSelected}
            className="px-6 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 transition-all font-mono shadow-lg hover:scale-105"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Добавить выбранные
          </motion.button>
        </div>
      </div>

      {(extractLoading || botLoading) && (
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          className="h-2 bg-purple-500 rounded-full mb-8 shadow-[0_0_10px_rgba(147,51,234,0.7)]"
        />
      )}

      {error && (
        <p className="text-red-400 mb-8 font-mono">{error}</p>
      )}

      {files.length > 0 && (
        <div className="mb-8 bg-gray-900 p-6 rounded-xl border border-gray-700 shadow-[0_0_15px_rgba(0,255,157,0.3)]">
          <h3 className="text-2xl font-semibold text-white mb-4">Консоль файлов</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(groupedFiles).map(([folder, folderFiles]) => (
              <div key={folder} className="bg-gray-800 p-4 rounded-lg border border-gray-600">
                <h4 className="text-lg font-bold text-purple-400 mb-2">{folder}</h4>
                <ul className="space-y-2">
                  {folderFiles.map((file) => (
                    <li key={file.path} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedFiles.has(file.path)}
                        onChange={() => toggleFileSelection(file.path)}
                        className="w-4 h-4 accent-purple-500"
                      />
                      <span
                        className={`font-mono text-sm ${
                          importantFiles.includes(file.path)
                            ? "text-cyan-400 font-bold animate-pulse"
                            : "text-gray-400 hover:text-white"
                        }`}
                      >
                        {file.path.split("/").pop()}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {txtOutput && (
        <div className="mb-8 bg-gray-900 p-6 rounded-xl border border-gray-700 shadow-[0_0_15px_rgba(0,255,157,0.3)]">
          <h3 className="text-2xl font-semibold text-white mb-4">Полный TXT</h3>
          <textarea
            value={txtOutput}
            readOnly
            className="w-full h-[768px] bg-gray-800 p-4 rounded-lg text-sm text-gray-300 font-mono border border-gray-700 resize-none"
          />
        </div>
      )}

      {selectedOutput && (
        <div className="mb-8 bg-gray-900 p-6 rounded-xl border border-gray-700 shadow-[0_0_15px_rgba(0,255,157,0.3)]">
          <h3 className="text-2xl font-semibold text-white mb-4">Выбранный TXT</h3>
          <textarea
            value={selectedOutput}
            readOnly
            className="w-full h-[768px] bg-gray-800 p-4 rounded-lg text-sm text-gray-300 font-mono border border-gray-700 resize-y min-h-[768px] max-h-[1536px]"
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
            className="bg-purple-500 text-white p-3 rounded-lg shadow-lg font-mono border border-purple-700"
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
      <meta name="viewport" content="width=1024, initial-scale=0.7, maximum-scale=5.0, user-scalable=yes" />
      <div className="min-h-screen bg-gray-900">
        <main className="py-6">
          <RepoTxtFetcher />
        </main>
      </div>
    </>
  );
}
