"use client";
import React, { useState } from "react";
import { motion } from "framer-motion";
import { runCozeAgent, notifyAdmin, sendTelegramMessage, sendTelegramDocument } from "@/app/actions";
import { createGitHubPullRequest, fetchRepoContents } from "@/app/actions_github/actions"; // Import new function
import { toast } from "sonner";
import { useAppContext } from "@/contexts/AppContext";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { FaTree, FaKey, FaFileAlt, FaShareAlt, FaTelegramPlane, FaSave, FaLink, FaClipboard } from "react-icons/fa";

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
  const [contextUsed, setContextUsed] = useState<string>("Контекст репозитория не предоставлен.");
  const { user } = useAppContext();

  const DEFAULT_CONTEXT = "Контекст репозитория не предоставлен.";

  const importantFiles = [
    "app/actions.ts",
    "app/layout.tsx",
    "app/repo-xml/page.tsx",
    "app/actions_github/actions.ts",
    "components/CozeExecutor.tsx",
    "components/RepoTxtFetcher.tsx",
    "hooks/useTelegram.ts",
    "contexts/AppContext.tsx",
    "lib/utils.ts",
    "types/supabase.ts",
  ];

  const addToast = (message: string) => {
    const id = Date.now();
    setToasts((prev) => {
      if (prev.length >= 3) prev.shift();
      return [...prev, { id, message }];
    });
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 2000);
  };

  const parseRepoUrl = (url: string) => {
    const match = url.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (!match) throw new Error("Неверный URL GitHub");
    return { owner: match[1], repo: match[2] };
  };

  const getLanguage = (path: string) => {
    if (path.endsWith(".ts") || path.endsWith(".tsx")) return "typescript";
    if (path.endsWith(".css")) return "css";
    return "text";
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
      const result = await fetchRepoContents(repoUrl, token || undefined);
      if (!result.success) {
        throw new Error(result.error || "Не удалось загрузить содержимое репозитория");
      }

      const files = result.files;
      setFiles(files);

      // Simulate progress for UI feedback
      const totalFiles = files.length;
      files.forEach((_, index) => {
        setTimeout(() => setProgress(((index + 1) / totalFiles) * 100), index * 50);
      });

      const txt = generateTxt(files);
      setTxtOutput(txt);
      addToast("Извлечение завершено!");
    } catch (err: any) {
      setError(`Ошибка загрузки: ${err.message}. Проверьте URL или токен.`);
      addToast("Ошибка: Извлечение не удалось!");
    } finally {
      setExtractLoading(false);
    }
  };

  const generateTxt = (files: FileNode[]) => {
    return files.map((file) => `--- ${file.path} ---\n${file.content}`).join("\n\n");
  };

  const generateTreeOnly = (files: FileNode[]) => {
    return files.map((file) => `- ${file.path}`).join("\n");
  };

  const generateMarkdownSelectedTxt = (files: FileNode[]) => {
    return files
      .filter((file) => selectedFiles.has(file.path))
      .map((file) => {
        const lang = getLanguage(file.path);
        return `\`\`\`${lang}\n${file.content}\n\`\`\``;
      })
      .join("\n\n");
  };

  const toggleFileSelection = (path: string) => {
    setSelectedFiles((prev) => {
      const newSelected = new Set(prev);
      if (newSelected.has(path)) newSelected.delete(path);
      else newSelected.add(path);
      setSelectedOutput(generateTxt(files.filter((file) => newSelected.has(file.path))));
      return newSelected;
    });
  };

  const handleAddSelected = () => {
    if (selectedFiles.size === 0) {
      addToast("Выберите хотя бы один файл!");
      return;
    }
    const markdownTxt = generateMarkdownSelectedTxt(files);
    setKworkInput((prev) => `${prev}\n\nВыбранные файлы:\n${markdownTxt}`);
    addToast("Выбранные файлы добавлены в запрос!");
  };

  const handleAddImportantFiles = () => {
    const importantFilesSet = new Set(importantFiles);
    const importantFilesContent = files
      .filter((file) => importantFilesSet.has(file.path))
      .map((file) => {
        const lang = getLanguage(file.path);
        return `\`\`\`${lang}\n${file.content}\n\`\`\``;
      })
      .join("\n\n");
    setKworkInput((prev) => `${prev}\n\nОсновные файлы:\n${importantFilesContent}`);
    addToast("Основные файлы добавлены в запрос!");
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
      const context = selectedOutput || txtOutput || DEFAULT_CONTEXT;
      setContextUsed(context);
      const fullInput = `Запрос с Kwork: "${kworkInput}"\nКонтекст репозитория:\n${context}`;
      const botId = "7481446329554747397";
      const userId = "341503612082";
      const response = await runCozeAgent(botId, userId, fullInput);
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
      - hooks/useAppContext.ts: Хук для доступа к данным Telegram через контекст.
      - contexts/AppContext.tsx: Контекст приложения с данными пользователя.
      - app/actions.ts: Серверные действия: отправка сообщений, запуск бота, уведомления.
      - components/CozeExecutor.tsx: Генерация кода и создание PR.
      - components/RepoTxtFetcher.tsx: Этот инструмент для извлечения контекста.
      - app/repo-xml/page.tsx: Главная страница с компонентами.
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
      if (result.success) addToast("Результат отправлен админам!");
      else addToast("Ошибка при отправке админам!");
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
      if (result.success) addToast("Анализ отправлен вам в Telegram!");
      else addToast("Ошибка при отправке вам!");
    } catch (err) {
      addToast("Ошибка: Не удалось отправить!");
    }
  };

  const handleSaveAnalysis = () => {
    if (!txtOutput) {
      addToast("Нет результатов для сохранения!");
      return;
    }
    const blob = new Blob([txtOutput], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "analysis.txt";
    a.click();
    URL.revokeObjectURL(url);
    addToast("Анализ сохранен локально!");
  };

  const handleCopyContextToClipboard = () => {
    if (!contextUsed || contextUsed === DEFAULT_CONTEXT) {
      addToast("Контекст пуст или не изменен!");
      return;
    }
    navigator.clipboard.writeText(contextUsed);
    addToast("Контекст скопирован в буфер обмена!");
  };

  const handleSendContextAsFile = async () => {
    if (!contextUsed || contextUsed === DEFAULT_CONTEXT) {
      addToast("Контекст пуст или не изменен!");
      return;
    }
    if (!user?.id) {
      addToast("Пользователь Telegram не найден!");
      return;
    }
    try {
      const result = await sendTelegramDocument(user.id.toString(), contextUsed, "Context.txt");
      if (result.success) addToast("Контекст отправлен как Context.txt в Telegram!");
      else addToast(`Ошибка при отправке: ${result.error}`);
    } catch (err) {
      addToast("Ошибка: Не удалось отправить файл!");
    }
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

  const handleUpdateImports = async () => {
    if (files.length === 0) {
      addToast("Нет файлов для обновления!");
      return;
    }
    setBotLoading(true);
    addToast("Обновляю импорты...");
    const updatedFiles = files
      .filter((file) => file.path !== "contexts/AppContext.tsx")
      .map((file) => {
        let content = file.content;
        content = content.replace(
          /import\s+{\s*useTelegram\s*(?:,\s*[^}]+)?}\s+from\s+['"]@\/hooks\/useTelegram['"]/g,
          (match) => {
            const imports = match.match(/{\s*useTelegram\s*(?:,\s*[^}]+)?}/)![0];
            const otherImports = imports.replace("useTelegram", "useAppContext").replace(/\s+/g, " ");
            return `import ${otherImports} from "@/contexts/AppContext"`;
          }
        );
        content = content.replace(
          /const\s+{([^}]+)}\s*=\s*useTelegram\(\)/g,
          `const {$1} = useAppContext()`
        );
        return { path: file.path, content };
      })
      .concat(files.filter((file) => file.path === "contexts/AppContext.tsx"));

    const branchName = `cyber-swap-matrix-${Date.now()}`;

    try {
      const result = await createGitHubPullRequest(
        repoUrl,
        updatedFiles,
        "Переход с useTelegram на useAppContext",
        "Автоматически обновлены импорты и использование хука в файлах для использования AppContext вместо Telegram.",
        branchName
      );
      if (result.success) {
        addToast(`PR создан: ${result.prUrl}`);
        setFiles(updatedFiles);
        setTxtOutput(generateTxt(updatedFiles));
        setSelectedOutput(generateTxt(updatedFiles.filter((file) => selectedFiles.has(file.path))));
      } else {
        throw new Error(result.error || "Неизвестная ошибка при создании PR");
      }
    } catch (err) {
      addToast(`Ошибка: ${(err as Error).message}`);
    } finally {
      setBotLoading(false);
    }
  };

  const groupFilesByFolder = (files: FileNode[]) => {
    const grouped: { [key: string]: FileNode[] } = {};
    files.forEach((file) => {
      const folder = file.path.split("/")[0] || "root";
      if (!grouped[folder]) grouped[folder] = [];
      grouped[folder].push(file);
    });
    return Object.entries(grouped).map(([folder, folderFiles]) => ({ folder, files: folderFiles }));
  };

  const getDisplayName = (path: string) => {
    const parts = path.split("/");
    if (parts[0] === "app") return parts.slice(1).join("/");
    return path;
  };

  return (
    <div className="w-full p-4 bg-gray-900 text-white font-mono rounded-xl shadow-[0_0_15px_rgba(0,255,157,0.3)] relative overflow-hidden">
      <h2 className="text-2xl font-bold tracking-tight text-[#E1FF01] text-shadow-[0_0_10px_#E1FF01] animate-pulse mb-4">
        Кибер-Экстрактор TXT
      </h2>
      <p className="text-gray-300 mb-6 text-sm">
        Ваш инструмент для извлечения кода из GitHub. Выбирайте файлы, отправляйте боту или обновляйте код с PR!
      </p>

      <div className="flex flex-col gap-3 mb-6 relative z-10">
        <input
          type="text"
          value={repoUrl}
          onChange={(e) => setRepoUrl(e.target.value)}
          placeholder="URL GitHub (https://github.com/salavey13/cartest)"
          className="p-3 bg-gray-800 border border-gray-700 rounded-lg focus:border-cyan-500 focus:outline-none transition shadow-[0_0_8px_rgba(0,255,157,0.3)] hover:border-cyan-400 text-sm"
        />
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Токен GitHub (опционально)"
          className="p-3 bg-gray-800 border border-gray-700 rounded-lg focus:border-cyan-500 focus:outline-none transition shadow-[0_0_8px_rgba(0,255,157,0.3)] hover:border-cyan-400 text-sm"
        />
        <motion.button
          onClick={handleFetch}
          disabled={extractLoading}
          className={`px-4 py-2 rounded-lg font-semibold text-sm text-white bg-gradient-to-r from-purple-600 to-cyan-500 transition-all shadow-[0_0_12px_rgba(0,255,157,0.3)] ${extractLoading ? "opacity-50 cursor-not-allowed" : "hover:shadow-[0_0_18px_rgba(0,255,157,0.5)]"}`}
          whileHover={{ scale: extractLoading ? 1 : 1.05 }}
          whileTap={{ scale: extractLoading ? 1 : 0.95 }}
        >
          {extractLoading ? "Извлечение..." : "Извлечь TXT"}
        </motion.button>
      </div>

      <div className="mb-6 bg-gray-800 p-4 rounded-xl shadow-[0_0_12px_rgba(0,255,157,0.3)] relative z-10">
        <h3 className="text-xl font-bold text-cyan-400 mb-3">Kwork в Бота</h3>
        <textarea
          value={kworkInput}
          onChange={(e) => setKworkInput(e.target.value)}
          placeholder="Введите запрос с Kwork или задачу Telegram Web App..."
          className="w-full h-48 p-3 bg-gray-900 border border-gray-700 rounded-lg focus:border-cyan-500 focus:outline-none transition shadow-[0_0_8px_rgba(0,255,157,0.3)] resize-none text-sm"
        />
        <div className="flex flex-col gap-3 mt-3">
          <motion.button
            onClick={handleGenerateBotRequest}
            disabled={botLoading}
            className={`px-4 py-2 rounded-lg font-semibold text-sm text-white bg-gradient-to-r from-blue-600 to-cyan-500 transition-all shadow-[0_0_12px_rgba(0,255,157,0.3)] ${botLoading ? "opacity-50 cursor-not-allowed" : "hover:shadow-[0_0_18px_rgba(0,255,157,0.5)]"}`}
            whileHover={{ scale: botLoading ? 1 : 1.05 }}
            whileTap={{ scale: botLoading ? 1 : 0.95 }}
          >
            {botLoading ? "Генерация..." : "Анализировать с Ботом"}
          </motion.button>
          <div className="flex flex-col gap-2">
            <h4 className="text-sm font-bold text-purple-400">Добавить в запрос</h4>
            <motion.button
              onClick={handleAddFullTree}
              className="flex items-center gap-1 px-4 py-2 rounded-lg font-semibold text-sm text-white bg-gradient-to-r from-red-600 to-orange-500 transition-all shadow-[0_0_12px_rgba(255,107,107,0.3)] hover:shadow-[0_0_18px_rgba(255,107,107,0.5)]"
            >
              <FaTree /> Добавить дерево
            </motion.button>
            <motion.button
              onClick={handleAddBriefTree}
              className="flex items-center gap-1 px-4 py-2 rounded-lg font-semibold text-sm text-white bg-gradient-to-r from-green-600 to-lime-500 transition-all shadow-[0_0_12px_rgba(0,255,157,0.3)] hover:shadow-[0_0_18px_rgba(0,255,157,0.5)]"
            >
              <FaKey /> Добавить ключевые
            </motion.button>
            {files.length > 0 && (
              <>
                <motion.button
                  onClick={handleAddSelected}
                  className="flex items-center gap-1 px-4 py-2 rounded-lg font-semibold text-sm text-white bg-gradient-to-r from-indigo-600 to-purple-500 transition-all shadow-[0_0_12px_rgba(99,102,241,0.3)] hover:shadow-[0_0_18px_rgba(99,102,241,0.5)]"
                >
                  <FaFileAlt /> Добавить выбранные
                </motion.button>
                <motion.button
                  onClick={handleAddImportantFiles}
                  className="flex items-center gap-1 px-4 py-2 rounded-lg font-semibold text-sm text-white bg-gradient-to-r from-blue-600 to-cyan-500 transition-all shadow-[0_0_12px_rgba(0,255,157,0.3)] hover:shadow-[0_0_18px_rgba(0,255,157,0.5)]"
                >
                  <FaFileAlt /> Добавить основные файлы
                </motion.button>
              </>
            )}
          </div>
          {contextUsed !== DEFAULT_CONTEXT && (
            <div className="flex flex-col gap-2">
              <h4 className="text-sm font-bold text-purple-400">Действия с контекстом</h4>
              <motion.button
                onClick={handleCopyContextToClipboard}
                className="flex items-center gap-1 px-4 py-2 rounded-lg font-semibold text-sm text-white bg-gradient-to-r from-cyan-600 to-teal-500 transition-all shadow-[0_0_12px_rgba(6,182,212,0.3)] hover:shadow-[0_0_18px_rgba(6,182,212,0.5)]"
              >
                <FaClipboard /> Скопировать контекст
              </motion.button>
              {user?.id && (
                <motion.button
                  onClick={handleSendContextAsFile}
                  className="flex items-center gap-1 px-4 py-2 rounded-lg font-semibold text-sm text-white bg-gradient-to-r from-teal-600 to-cyan-500 transition-all shadow-[0_0_12px_rgba(20,184,166,0.3)] hover:shadow-[0_0_18px_rgba(20,184,166,0.5)]"
                >
                  <FaTelegramPlane /> Отправить Context.txt
                </motion.button>
              )}
            </div>
          )}
          {analysisComplete && (
            <div className="flex flex-col gap-2">
              <h4 className="text-sm font-bold text-purple-400">Действия с анализом</h4>
              <motion.button
                onClick={handleShareWithAdmins}
                className="flex items-center gap-1 px-4 py-2 rounded-lg font-semibold text-sm text-white bg-gradient-to-r from-yellow-600 to-orange-500 transition-all shadow-[0_0_12px_rgba(251,191,36,0.3)] hover:shadow-[0_0_18px_rgba(251,191,36,0.5)]"
              >
                <FaShareAlt /> Поделиться с админами
              </motion.button>
              {user?.id && (
                <motion.button
                  onClick={handleSendToMe}
                  className="flex items-center gap-1 px-4 py-2 rounded-lg font-semibold text-sm text-white bg-gradient-to-r from-teal-600 to-cyan-500 transition-all shadow-[0_0_12px_rgba(20,184,166,0.3)] hover:shadow-[0_0_18px_rgba(20,184,166,0.5)]"
                >
                  <FaTelegramPlane /> Отправить себе
                </motion.button>
              )}
              <motion.button
                onClick={handleSaveAnalysis}
                className="flex items-center gap-1 px-4 py-2 rounded-lg font-semibold text-sm text-white bg-gradient-to-r from-pink-600 to-purple-500 transition-all shadow-[0_0_12px_rgba(219,39,119,0.3)] hover:shadow-[0_0_18px_rgba(219,39,119,0.5)]"
              >
                <FaSave /> Сохранить анализ
              </motion.button>
              <motion.button
                onClick={handleShareLink}
                className="flex items-center gap-1 px-4 py-2 rounded-lg font-semibold text-sm text-white bg-gradient-to-r from-cyan-600 to-teal-500 transition-all shadow-[0_0_12px_rgba(6,182,212,0.3)] hover:shadow-[0_0_18px_rgba(6,182,212,0.5)]"
              >
                <FaLink /> Поделиться ссылкой
              </motion.button>
            </div>
          )}
        </div>
      </div>

      {(extractLoading || botLoading) && (
        <div className="mb-6 relative z-10">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            className="h-1 bg-gradient-to-r from-purple-600 to-cyan-500 rounded-full shadow-[0_0_10px_rgba(0,255,157,0.5)]"
          />
          <p className="text-white text-xs font-mono mt-1">
            {extractLoading ? "Извлечение" : "Обновление"}: {Math.round(progress)}%
          </p>
        </div>
      )}

      {error && <p className="text-red-400 mb-6 text-xs font-mono relative z-10">{error}</p>}

      {files.length > 0 && (
        <div className="mb-6 bg-gray-800 p-4 rounded-xl shadow-[0_0_12px_rgba(0,255,157,0.3)] relative z-10">
          <h3 className="text-xl font-bold text-cyan-400 mb-3">Консоль файлов</h3>
          <motion.button
            onClick={handleUpdateImports}
            disabled={botLoading}
            className={`mb-3 px-4 py-2 rounded-lg font-semibold text-sm text-white bg-gradient-to-r from-purple-600 to-cyan-500 transition-all shadow-[0_0_12px_rgba(0,255,157,0.3)] ${botLoading ? "opacity-50 cursor-not-allowed" : "hover:shadow-[0_0_18px_rgba(0,255,157,0.5)]"}`}
            whileHover={{ scale: botLoading ? 1 : 1.05 }}
            whileTap={{ scale: botLoading ? 1 : 0.95 }}
          >
            {botLoading ? "Обновление..." : "Обновить useTelegram на useAppContext"}
          </motion.button>
          <div className="flex flex-col gap-3">
            {groupFilesByFolder(files).map(({ folder, files: folderFiles }, index) => (
              <div key={`${folder}-${index}`} className="bg-gray-900 p-3 rounded-lg border border-gray-700 shadow-[0_0_8px_rgba(0,255,157,0.2)]">
                <h4 className="text-sm font-bold text-purple-400 mb-2">{folder}</h4>
                <ul className="space-y-1">
                  {folderFiles.map((file) => (
                    <li key={file.path} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedFiles.has(file.path)}
                        onChange={() => toggleFileSelection(file.path)}
                        className="w-3 h-3 accent-cyan-500"
                      />
                      <span
                        className={`text-xs ${
                          importantFiles.includes(file.path)
                            ? "text-[#E1FF01] font-bold animate-pulse"
                            : "text-gray-400 hover:text-white"
                        } truncate`}
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

      {selectedFiles.size > 0 && (
        <div className="mb-6 bg-gray-800 p-4 rounded-xl shadow-[0_0_12px_rgba(0,255,157,0.3)] relative z-10">
          <h3 className="text-xl font-bold text-cyan-400 mb-3">Выбранные файлы</h3>
          {Array.from(selectedFiles).map((path) => {
            const file = files.find((f) => f.path === path);
            if (!file) return null;
            const lang = getLanguage(file.path);
            return (
              <div key={file.path} className="mb-4">
                <h4 className="text-sm font-bold text-purple-400 mb-1">{file.path}</h4>
                <SyntaxHighlighter
                  language={lang}
                  style={oneDark}
                  customStyle={{ background: "#1f2937", padding: "0.75rem", borderRadius: "0.5rem", fontSize: "0.75rem" }}
                >
                  {file.content}
                </SyntaxHighlighter>
              </div>
            );
          })}
        </div>
      )}

      {txtOutput && (
        <div className="mb-6 bg-gray-800 p-4 rounded-xl shadow-[0_0_12px_rgba(0,255,157,0.3)] relative z-10">
          <h3 className="text-xl font-bold text-cyan-400 mb-3">Полный TXT</h3>
          <textarea
            value={txtOutput}
            readOnly
            className="w-full h-80 p-3 bg-gray-900 text-gray-300 rounded-lg text-xs border border-gray-700 resize-none overflow-y-auto shadow-[0_0_8px_rgba(0,255,157,0.2)]"
          />
        </div>
      )}

      <div className="fixed bottom-2 right-2 space-y-1 z-50">
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="bg-purple-600 text-white p-1 rounded-lg shadow-[0_0_8px_rgba(147,51,234,0.5)] text-xs"
          >
            {toast.message}
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default RepoTxtFetcher;