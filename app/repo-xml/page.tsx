"use client";

import React, { useState } from "react";
import axios from "axios";
import { motion } from "framer-motion";
import { runCozeAgent, notifyAdmin, sendTelegramMessage } from "@/app/actions";
import { toast } from "sonner";
import { useTelegram } from "@/hooks/useTelegram";
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { FaTree, FaKey, FaFileAlt, FaShareAlt, FaTelegramPlane, FaSave, FaLink } from 'react-icons/fa';

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
  const [analysisComplete, setAnalysisComplete] = useState<boolean>(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  const { user } = useTelegram();

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
    "types/supabase.ts",
  ];

  const addToast = (message: string) => {
    const id = Date.now();
    setToasts((prev) => {
      if (prev.length >= 3) prev.shift(); // Limit to 3 toasts
      return [...prev, { id, message }];
    });
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 2000); // Reduced TTL
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

  const generateTreeOnly = (files: FileNode[]) => {
    return files.map((file) => `- ${file.path}`).join("\n");
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
    setAnalysisComplete(false);
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
      setSelectedOutput(generateSelectedTxt(files));
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
    setAnalysisComplete(false);
    addToast("Генерирую запрос для бота...");

    try {
      const context = selectedOutput || txtOutput || "Контекст репозитория не предоставлен.";
      const fullInput = `Запрос с Kwork: "${kworkInput}"\nКонтекст репозитория:\n${context}`;
      const botId = "7481446329554747397";
      const userId = "341503612082";
      const response = await runCoseAgent(botId, userId, fullInput);
      setTxtOutput(response);
      setAnalysisComplete(true);
      addToast("Анализ завершен!");
    } catch (err) {
      setError("Ошибка генерации запроса для бота.");
      addToast("Ошибка: Генерация не удалась!");
    } finally {
      setBotLoading(false);
    }
  };

  const handleAddFullTree = () => {
    const treeOnly = generateTreeOnly(files);
    setKworkInput((prev) => `${prev}\n\nДерево файлов:\n${treeOnly}`);
    addToast("Дерево файлов добавлено в запрос!");
  };

  const handleAddBriefTree = () => {
    const briefTree = `
      Краткое дерево ключевых файлов:
      - hooks/useTelegram.ts: Хук для получения текущего пользователя Telegram (chat ID и данные).
      - types/supabase.ts: Типы для Supabase, используйте хук Supabase для доступа к \`supabaseAdmin\` клиенту и функциям вроде \`generateCarEmbedding\`.
      - app/layout.tsx: Макет с хедером (pt-24 для отступа) и футером, полезно для новых компонентов.
      - app/actions.ts: Серверные действия: \`sendTelegramMessage\` (отправка сообщений), \`runCoseAgent\` (запуск бота), \`notifyAdmin\` (уведомления админов), \`broadcastMessage\` (рассылка), \`handleWebhookUpdate\` (обработка платежей — обновите для новых подписок).
      - app/repo-xml/page.tsx: Этот инструмент для извлечения текста.
      Остальное генерируется на лету.
    `;
    setKworkInput((prev) => `${prev}\n\n${briefTree}`);
    addToast("Краткое дерево добавлено в запрос!");
  };

  const handleShareWithAdmins = async () => {
    if (!txtOutput) {
      addToast("Нет результатов для отправки!");
      return;
    }

    const message = `Результат анализа Kwork:\n\nЗапрос: ${kworkInput}\n\nАнализ:\n${txtOutput}`;
    try {
      const result = await notifyAdmin(message);
      if (result.success) {
        addToast("Результат отправлен админам!");
      } else {
        addToast("Ошибка при отправке админам!");
      }
    } catch (err) {
      addToast("Ошибка: Не удалось отправить!");
    }
  };

  const handleSendToMe = async () => {
    if (!txtOutput) {
      addToast("Нет результатов для отправки!");
      return;
    }
    if (!user?.id) {
      addToast("Пользователь Telegram не найден!");
      return;
    }

    const markdownMessage = `
*✨ Анализ Kwork от CyberDev ✨*

**Запрос:**
${kworkInput}

**Результат анализа:**
${txtOutput}

*Поделитесь этим с командой, если хотите! 🚀*
    `.trim();

    try {
      const result = await sendTelegramMessage(
        process.env.TELEGRAM_BOT_TOKEN || "",
        markdownMessage,
        [],
        undefined,
        user.id.toString()
      );
      if (result.success) {
        addToast("Анализ отправлен вам в Telegram!");
      } else {
        addToast("Ошибка при отправке вам!");
      }
    } catch (err) {
      addToast("Ошибка: Не удалось отправить!");
    }
  };

  const handleSaveAnalysis = () => {
    if (!txtOutput) {
      addToast("Нет результатов для сохранения!");
      return;
    }
    const blob = new Blob([txtOutput], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'analysis.txt';
    a.click();
    URL.revokeObjectURL(url);
    addToast("Анализ сохранен локально!");
  };

  const handleShareLink = () => {
    if (!txtOutput) {
      addToast("Нет результатов для分享!");
      return;
    }
    const encodedData = encodeURIComponent(txtOutput);
    const shareUrl = `${window.location.origin}/share?analysis=${encodedData}`;
    navigator.clipboard.writeText(shareUrl);
    addToast("Ссылка скопирована в буфер обмена!");
  };

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const groupFilesByFolder = (files: FileNode[]) => {
    const grouped: { [key: string]: FileNode[] } = {};
    files.forEach((file) => {
      const folder = file.path.split("/")[0] || "root";
      if (!grouped[folder]) grouped[folder] = [];
      grouped[folder].push(file);
    });
    return Object.entries(grouped).reduce((acc, [folder, folderFiles]) => {
      acc.push({ folder, files: folderFiles.slice(0, Math.ceil(folderFiles.length / 3)) });
      acc.push({ folder, files: folderFiles.slice(Math.ceil(folderFiles.length / 3), Math.ceil((2 * folderFiles.length) / 3)) });
      acc.push({ folder, files: folderFiles.slice(Math.ceil((2 * folderFiles.length) / 3)) });
      return acc;
    }, [] as { folder: string; files: FileNode[] }[]);
  };

  const groupedFiles = groupFilesByFolder(files);

  const getDisplayName = (path: string) => {
    const parts = path.split("/");
    if (parts[0] === "app" && (path.endsWith("page.tsx") || path.endsWith("route.ts"))) {
      return parts.slice(1).join("/");
    }
    return parts.pop()!;
  };

  return (
    <div className={`w-full p-6 ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-200'} pt-24 rounded-2xl shadow-[0_0_30px_rgba(255,107,107,0.5)] border ${theme === 'dark' ? 'border-gray-700' : 'border-gray-300'} relative overflow-hidden`}>
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-br from-transparent via-purple-900/10 to-cyan-900/10 animate-gradient-shift"></div>

      <h2 className={`text-4xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'} mb-6 tracking-wider animate-pulse text-shadow-neon relative z-10`}>
        Кибер-Экстрактор TXT
      </h2>
      <p className={`${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'} mb-8 text-lg font-mono relative z-10`}>
        Извлекайте текст из GitHub и анализируйте задачи с Kwork в стиле CyberDev!
      </p>

      <div className="fixed top-16 right-4 z-50">
        <motion.button
          onClick={toggleTheme}
          className={`p-2 rounded-full ${theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-gray-300 text-gray-900'} shadow-[0_0_10px_rgba(147,51,234,0.5)]`}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </motion.button>
      </div>

      <div className="flex flex-col gap-4 mb-8 relative z-10">
        <input
          type="text"
          value={repoUrl}
          onChange={(e) => setRepoUrl(e.target.value)}
          placeholder="URL GitHub (например, https://github.com/user/repo)"
          className={`p-4 ${theme === 'dark' ? 'bg-gray-900 border-gray-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'} border rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono shadow-[0_0_10px_rgba(147,51,234,0.3)] transition-all duration-300 hover:border-cyan-500`}
        />
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Токен GitHub (опционально)"
          className={`p-4 ${theme === 'dark' ? 'bg-gray-900 border-gray-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'} border rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono shadow-[0_0_10px_rgba(147,51,234,0.3)] transition-all duration-300 hover:border-cyan-500`}
        />
        <motion.button
          onClick={handleFetch}
          disabled={extractLoading}
          className={`px-6 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-purple-500 to-pink-500 transition-all font-mono shadow-lg ${
            extractLoading ? "opacity-50 cursor-not-allowed" : "hover:shadow-[0_0_15px_rgba(147,51,234,0.7)]"
          }`}
          whileHover={{ scale: extractLoading ? 1 : 1.05, boxShadow: "0 0 15px rgba(147, 51, 234, 0.7)" }}
          whileTap={{ scale: extractLoading ? 1 : 0.95 }}
        >
          {extractLoading ? "Извлечение..." : "Извлечь TXT"}
        </motion.button>
      </div>

      <div className={`mb-8 ${theme === 'dark' ? 'bg-gray-900 border-gray-700' : 'bg-gray-100 border-gray-300'} p-6 rounded-xl border shadow-[0_0_15px_rgba(0,255,157,0.3)] relative z-10`}>
        <h3 className={`text-2xl font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'} mb-4`}>Kwork в Бота</h3>
        <textarea
          value={kworkInput}
          onChange={(e) => setKworkInput(e.target.value)}
          placeholder="Введите запрос с Kwork или задачу Telegram Web App..."
          className={`w-full h-64 p-4 ${theme === 'dark' ? 'bg-gray-900 border-gray-700 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'} border rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono resize-none shadow-[0_0_10px_rgba(0,255,157,0.3)]`}
        />
        <div className="flex gap-4 mt-4 flex-wrap">
          <motion.button
            onClick={handleGenerateBotRequest}
            disabled={botLoading}
            className={`px-6 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-blue-500 to-cyan-500 transition-all font-mono shadow-lg ${
              botLoading ? "opacity-50 cursor-not-allowed" : "hover:shadow-[0_0_15px_rgba(0,255,157,0.7)]"
            }`}
            whileHover={{ scale: botLoading ? 1 : 1.05, boxShadow: "0 0 15px rgba(0, 255, 157, 0.7)" }}
            whileTap={{ scale: botLoading ? 1 : 0.95 }}
          >
            {botLoading ? "Генерация..." : "Анализировать с Ботом"}
          </motion.button>
          <div className="flex flex-col gap-2">
            <h4 className="text-lg font-bold text-white">Добавить в запрос</h4>
            <motion.button onClick={handleAddFullTree} className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-red-500 to-orange-500 transition-all font-mono shadow-lg hover:shadow-[0_0_15px_rgba(255,107,107,0.7)]">
              <FaTree /> Добавить дерево
            </motion.button>
            <motion.button onClick={handleAddBriefTree} className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-green-500 to-lime-500 transition-all font-mono shadow-lg hover:shadow-[0_0_15px_rgba(0,255,157,0.7)]">
              <FaKey /> Добавить ключевые
            </motion.button>
            <motion.button onClick={handleAddSelected} className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-indigo-500 to-purple-500 transition-all font-mono shadow-lg hover:shadow-[0_0_15px_rgba(99,102,241,0.7)]">
              <FaFileAlt /> Добавить выбранные
            </motion.button>
          </div>
          <div className="flex flex-col gap-2">
            <h4 className="text-lg font-bold text-white">Действия с анализом</h4>
            <motion.button onClick={handleShareWithAdmins} disabled={!analysisComplete} className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-yellow-500 to-orange-500 transition-all font-mono shadow-lg ${!analysisComplete ? "opacity-50 cursor-not-allowed" : "hover:shadow-[0_0_15px_rgba(251,191,36,0.7)]"}`}>
              <FaShareAlt /> Поделиться с админами
            </motion.button>
            <motion.button onClick={handleSendToMe} disabled={!analysisComplete || !user?.id} className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-teal-500 to-cyan-500 transition-all font-mono shadow-lg ${!analysisComplete || !user?.id ? "opacity-50 cursor-not-allowed" : "hover:shadow-[0_0_15px_rgba(20,184,166,0.7)]"}`}>
              <FaTelegramPlane /> Отправить себе
            </motion.button>
            <motion.button onClick={handleSaveAnalysis} className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-pink-500 to-purple-500 transition-all font-mono shadow-lg hover:shadow-[0_0_15px_rgba(219,39,119,0.7)]">
              <FaSave /> Сохранить анализ
            </motion.button>
            <motion.button onClick={handleShareLink} className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-cyan-500 to-teal-500 transition-all font-mono shadow-lg hover:shadow-[0_0_15px_rgba(6,182,212,0.7)]">
              <FaLink /> Поделиться ссылкой
            </motion.button>
          </div>
        </div>
      </div>

      {(extractLoading || botLoading) && (
        <div className="mb-8 relative z-10">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            className="h-2 bg-gradient-to-r from-purple-500 to-cyan-500 rounded-full shadow-[0_0_15px_rgba(147,51,234,0.7)]"
          />
          <p className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'} font-mono mt-2`}>
            {extractLoading ? "Извлечение" : "Анализ"}: {Math.round(progress)}%
          </p>
        </div>
      )}

      {error && <p className="text-red-400 mb-8 font-mono relative z-10">{error}</p>}

      {files.length > 0 && (
        <div className={`mb-8 ${theme === 'dark' ? 'bg-gray-900 border-gray-700' : 'bg-gray-100 border-gray-300'} p-6 rounded-xl border shadow-[0_0_15px_rgba(0,255,157,0.3)] relative z-10`}>
          <h3 className={`text-2xl font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'} mb-4`}>Консоль файлов</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {groupedFiles.map(({ folder, files: folderFiles }, index) => (
              <div key={`${folder}-${index}`} className={`${theme === 'dark' ? 'bg-gray-800 border-gray-600' : 'bg-gray-200 border-gray-400'} p-4 rounded-lg border shadow-[0_0_10px_rgba(0,255,157,0.2)]`}>
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
                            : theme === 'dark' ? "text-gray-400 hover:text-white" : "text-gray-600 hover:text-gray-900"
                        }`}
                      >
                        {getDisplayName(file.path)}
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
        <div className={`mb-8 ${theme === 'dark' ? 'bg-gray-900 border-gray-700' : 'bg-gray-100 border-gray-300'} p-6 rounded-xl border shadow-[0_0_15px_rgba(0,255,157,0.3)] relative z-10`}>
          <h3 className={`text-2xl font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'} mb-4`}>Полный TXT</h3>
          <textarea
            value={txtOutput}
            readOnly
            className={`w-full h-96 p-4 ${theme === 'dark' ? 'bg-gray-800 text-gray-300' : 'bg-gray-200 text-gray-700'} rounded-lg text-sm font-mono border ${theme === 'dark' ? 'border-gray-700' : 'border-gray-300'} resize-none overflow-y-auto shadow-[0_0_10px_rgba(0,255,157,0.2)]`}
          />
        </div>
      )}

      {selectedOutput && (
        <div className={`mb-8 ${theme === 'dark' ? 'bg-gray-900 border-gray-700' : 'bg-gray-100 border-gray-300'} p-6 rounded-xl border shadow-[0_0_15px_rgba(0,255,157,0.3)] relative z-10`}>
          <h3 className={`text-2xl font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'} mb-4`}>Выбранный TXT</h3>
          <SyntaxHighlighter language="typescript" style={oneDark} customStyle={{ background: theme === 'dark' ? '#1f2937' : '#f3f4f6', padding: '1rem', borderRadius: '0.5rem', maxHeight: '48rem', overflowY: 'auto' }}>
            {selectedOutput}
          </SyntaxHighlighter>
        </div>
      )}

      <div className="fixed bottom-4 right-4 space-y-2 z-50">
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="bg-purple-500 text-white p-2 rounded-lg shadow-lg font-mono text-sm border border-purple-700 shadow-[0_0_10px_rgba(147,51,234,0.5)]"
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
      <div className="min-h-screen bg-gray-900 grid grid-cols-1 md:grid-cols-3 gap-6 p-6">
        <div className="col-span-1 md:col-span-2">
          <RepoTxtFetcher />
        </div>
        <div className="hidden md:block md:col-span-1">
          <div className="bg-gray-800 p-6 rounded-xl h-full shadow-[0_0_15px_rgba(0,255,157,0.3)]">
            <h3 className="text-xl font-bold text-white">Скоро будет...</h3>
          </div>
        </div>
      </div>
    </>
  );
}
