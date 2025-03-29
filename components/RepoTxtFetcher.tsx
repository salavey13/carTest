"use client";
import React, { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { fetchRepoContents } from "@/app/actions_github/actions";
import { toast } from "sonner";
import { useAppContext } from "@/contexts/AppContext";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { FaTree, FaKey, FaFileAlt, FaClipboard } from "react-icons/fa";

interface FileNode {
  path: string;
  content: string;
}

const RepoTxtFetcher: React.FC = () => {
  const [repoUrl, setRepoUrl] = useState<string>("https://github.com/salavey13/cartest");
  const [token, setToken] = useState<string>("");
  const [files, setFiles] = useState<FileNode[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [extractLoading, setExtractLoading] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [kworkInput, setKworkInput] = useState<string>("");
  const [lastAction, setLastAction] = useState<string | null>(null);
  const [primaryHighlightedPath, setPrimaryHighlightedPath] = useState<string | null>(null);
  const [secondaryHighlightedPaths, setSecondaryHighlightedPaths] = useState<string[]>([]);
  const { user } = useAppContext();

  const searchParams = useSearchParams();
  const highlightedPath = searchParams.get("path") || "";
  const autoFetch = !!highlightedPath;

  const importantFiles = [
    "app/actions.ts",
    "hooks/useTelegram.ts",
    "contexts/AppContext.tsx",
    "types/supabase.ts",
  ];

  const addToast = (message: string) => {
    toast(message, { style: { background: "rgba(34, 34, 34, 0.8)", color: "#E1FF01" } });
  };

  // **Helper Functions**

  /** Maps a route path (e.g., "/repo-xml") to its corresponding page.tsx file path */
  const getPageFilePath = (routePath: string): string => {
     return `${routePath}/page.tsx`;
  };

  /** Extracts import paths from file content */
  const extractImports = (content: string): string[] => {
    const importRegex = /import\s+.*?\s+from\s+['"](.+?)['"]/g;
    const matches = content.matchAll(importRegex);
    return Array.from(matches, (m) => m[1]);
  };

  /** Resolves an import path to an actual file path in the repository */
  const resolveImportPath = (importPath: string, files: FileNode[]): string | null => {
    if (importPath.startsWith("@/")) {
      const relativePath = importPath.replace("@/", "");
      const possiblePaths = [
        `${relativePath}.tsx`,
        `${relativePath}.ts`,
        `${relativePath}/index.tsx`,
        `${relativePath}/index.ts`,
      ];
      for (const path of possiblePaths) {
        if (files.some((file) => file.path === path)) {
          return path;
        }
      }
    }
    return null;
  };

  // **Fetch Handler with Highlighting Logic**
  const handleFetch = async () => {
    setExtractLoading(true);
    setError(null);
    setFiles([]);
    setSelectedFiles(new Set());
    setProgress(0);
    addToast("Извлечение файлов...");

    try {
      const result = await fetchRepoContents(repoUrl, token || undefined);
      if (!result || !result.success) {
        throw new Error(result?.error || "Не удалось загрузить содержимое репозитория");
      }

      const fetchedFiles = result.files || [];
      if (!Array.isArray(fetchedFiles)) {
        throw new Error("Неверный формат данных от fetchRepoContents");
      }

      setFiles(fetchedFiles);
      addToast("Файлы извлечены! Выберите файл для добавления в контекст.");
      const totalFiles = fetchedFiles.length;
      fetchedFiles.forEach((_, index) => {
        setTimeout(() => setProgress(((index + 1) / totalFiles) * 100), index * 50);
      });

      // **Highlighting Logic**
      if (highlightedPath) {
        const pageFilePath = getPageFilePath(highlightedPath);
        setPrimaryHighlightedPath(pageFilePath);
        const pageFile = fetchedFiles.find((file) => file.path === pageFilePath);
        if (pageFile) {
          const imports = extractImports(pageFile.content);
          const secondaryPaths = imports
            .map((imp) => resolveImportPath(imp, fetchedFiles))
            .filter((path): path is string => path !== null);
          setSecondaryHighlightedPaths(secondaryPaths);
        } else {
          console.warn(`Page file "${pageFilePath}" not found in repository`);
        }
      }
    } catch (err: any) {
      const errorMessage = `Ошибка: ${err.message || "Неизвестная ошибка при загрузке репозитория"}`;
      setError(errorMessage);
      addToast(errorMessage);
      console.error("Fetch error:", err);
    } finally {
      setExtractLoading(false);
      setLastAction("fetch");
    }
  };

  // **Auto-Fetch Effect**
  useEffect(() => {
    console.log("Search params:", searchParams.toString(), "Highlighted path:", highlightedPath, "Auto-fetch:", autoFetch);
    if (autoFetch) {
      handleFetch();
      setTimeout(() => document.getElementById("kwork-input")?.scrollIntoView({ behavior: "smooth" }), 100);
      setKworkInput("Введите, что вы хотите изменить...");
      setLastAction("auto_fetch");
    }
  }, [autoFetch, repoUrl, token, highlightedPath]);

  // **Scroll to Primary Highlighted File Effect**
  useEffect(() => {
    if (primaryHighlightedPath && files.length > 0) {
      const fileElement = document.getElementById(`file-${primaryHighlightedPath}`);
      if (fileElement) {
        fileElement.scrollIntoView({ behavior: "smooth" });
      } else {
        console.warn(`Файл с путем "${primaryHighlightedPath}" не найден в списке`);
      }
    }
  }, [files, primaryHighlightedPath]);

  const toggleFileSelection = (path: string) => {
    setSelectedFiles((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(path)) newSet.delete(path);
      else newSet.add(path);
      return newSet;
    });
  };

  const handleAddSelected = () => {
    if (selectedFiles.size === 0) {
      addToast("Выберите хотя бы один файл!");
      return;
    }
    const markdownTxt = files
      .filter((file) => selectedFiles.has(file.path))
      .map((file) => `**${file.path}**\n\`\`\`\n${file.content}\n\`\`\``)
      .join("\n\n");
    setKworkInput((prev) => `${prev}\n\nВыбранные файлы:\n${markdownTxt}`);
    addToast("Нажмите Скопировать, когда закончите писать!;)");
    setLastAction("add_selected");
    setTimeout(() => document.getElementById("kwork-input")?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  const handleAddImportantFiles = () => {
    const importantFilesSet = new Set(importantFiles);
    const importantFilesContent = files
      .filter((file) => importantFilesSet.has(file.path))
      .map((file) => `**${file.path}**\n\`\`\`\n${file.content}\n\`\`\``)
      .join("\n\n");
    setKworkInput((prev) => `${prev}\n\nОсновные файлы:\n${importantFilesContent}`);
    addToast("Основные файлы добавлены в запрос!");
  };

  const handleAddFullTree = () => {
    const treeOnly = files.map((file) => `- ${file.path}`).join("\n");
    setKworkInput((prev) => `${prev}\n\nДерево файлов:\n${treeOnly}`);
    addToast("Дерево файлов добавлено в запрос!");
  };

  const handleCopyToClipboard = () => {
    if (!kworkInput.trim()) {
      addToast("Нечего копировать!");
      return;
    }
    navigator.clipboard.writeText(kworkInput);
    addToast("Скопировано! Спросите Grok, вставьте ответ ниже и не забудьте ссылку на чат!)");
    setLastAction("copy");
    setTimeout(() => document.getElementById("response-input")?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  const getXuinityMessage = () => {
    switch (lastAction) {
      case "auto_fetch":
        return "Введите, что вы хотите изменить!";
      case "fetch":
        return "Выберите файл для добавления в контекст!";
      case "add_selected":
        return "Нажмите 'Скопировать', когда закончите!";
      case "copy":
        return "Спросите Grok, вставьте ответ ниже!";
      default:
        return "Эй, нужна помощь?";
    }
  };

  const groupFilesByFolder = (files: FileNode[]) => {
    const grouped: { folder: string; files: FileNode[] }[] = [];
    const folderMap: { [key: string]: FileNode[] } = {};
    files.forEach((file) => {
      const folder = file.path.substring(0, file.path.lastIndexOf("/")) || "root";
      if (!folderMap[folder]) folderMap[folder] = [];
      folderMap[folder].push(file);
    });
    for (const folder in folderMap) {
      grouped.push({ folder, files: folderMap[folder] });
    }
    return grouped;
  };

  const getDisplayName = (path: string) => path.split("/").pop() || path;

  const getLanguage = (path: string) => {
    if (path.endsWith(".ts") || path.endsWith(".tsx")) return "typescript";
    if (path.endsWith(".css")) return "css";
    return "text";
  };

  return (
    <div className="w-full p-4 bg-gray-900 text-white font-mono rounded-xl shadow-[0_0_15px_rgba(0,255,157,0.3)] relative overflow-hidden">
      {highlightedPath && (
        <p className="text-yellow-400 mb-6 text-center">
          Исправление файлов, связанных с <strong>{highlightedPath}</strong>
        </p>
      )}
      <h2 className="text-2xl font-bold tracking-tight text-[#E1FF01] text-shadow-[0_0_10px_#E1FF01] animate-pulse mb-4">
        Кибер-Экстрактор Кода
      </h2>
      <p className="text-gray-300 mb-6 text-sm">
        Ваш инструмент для извлечения кода из GitHub. Выбирайте файлы и отправляйте запросы боту!
      </p>

      <div className="flex flex-col gap-3 mb-6">
        <div>
          <label className="block text-sm font-medium mb-1">URL репозитория</label>
          <input
            type="text"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            className="w-full p-3 bg-gray-800 rounded-lg border border-gray-700 focus:border-cyan-500 focus:outline-none transition shadow-[0_0_8px_rgba(0,255,157,0.3)] hover:border-cyan-400 text-sm"
            placeholder="https://github.com/username/repository"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Токен GitHub (опционально)</label>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="w-full p-3 bg-gray-800 rounded-lg border border-gray-700 focus:border-cyan-500 focus:outline-none transition shadow-[0_0_8px_rgba(0,255,157,0.3)] hover:border-cyan-400 text-sm"
            placeholder="Введите ваш токен GitHub"
          />
        </div>
        <motion.button
          onClick={handleFetch}
          disabled={extractLoading}
          className={`px-4 py-2 rounded-lg font-semibold text-sm text-white bg-gradient-to-r from-purple-600 to-cyan-500 transition-all shadow-[0_0_12px_rgba(0,255,157,0.3)] ${extractLoading ? "opacity-50 cursor-not-allowed" : "hover:shadow-[0_0_18px_rgba(0,255,157,0.5)]"}`}
          whileHover={{ scale: extractLoading ? 1 : 1.05 }}
          whileTap={{ scale: extractLoading ? 1 : 0.95 }}
        >
          {extractLoading ? "Извлечение..." : "Извлечь файлы"}
        </motion.button>
      </div>

      {extractLoading && (
        <div className="mb-6">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            className="h-1 bg-gradient-to-r from-purple-600 to-cyan-500 rounded-full shadow-[0_0_10px_rgba(0,255,157,0.5)]"
          />
          <p className="text-white text-xs font-mono mt-1">Извлечение: {Math.round(progress)}%</p>
        </div>
      )}

      {error && <p className="text-red-400 mb-6 text-xs font-mono">{error}</p>}

      {files.length > 0 && (
        <div className="mb-6 bg-gray-800 p-4 rounded-xl shadow-[0_0_12px_rgba(0,255,157,0.3)]">
          <h3 className="text-xl font-bold text-cyan-400 mb-3">Консоль файлов</h3>
          <div className="flex flex-col gap-3">
            {groupFilesByFolder(files).map(({ folder, files: folderFiles }, index) => (
              <div key={`${folder}-${index}`} className="bg-gray-900 p-3 rounded-lg border border-gray-700 shadow-[0_0_8px_rgba(0,255,157,0.2)]">
                <h4 className="text-sm font-bold text-purple-400 mb-2">{folder}</h4>
                <ul className="space-y-1">
                  {folderFiles.map((file) => (
                    <li id={`file-${file.path}`} key={file.path} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedFiles.has(file.path)}
                        onChange={() => toggleFileSelection(file.path)}
                        className="w-3 h-3 accent-cyan-500"
                      />
                      <span
                        className={`text-xs ${
                          file.path === primaryHighlightedPath
                            ? "text-yellow-400 font-bold animate-pulse"
                            : secondaryHighlightedPaths.includes(file.path)
                            ? "text-green-400 font-bold animate-pulse"
                            : importantFiles.includes(file.path)
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
          <div className="flex flex-col gap-2 mt-3">
            <motion.button
              onClick={handleAddFullTree}
              className="flex items-center gap-1 px-4 py-2 rounded-lg font-semibold text-sm text-white bg-gradient-to-r from-red-600 to-orange-500 transition-all shadow-[0_0_12px_rgba(255,107,107,0.3)] hover:shadow-[0_0_18px_rgba(255,107,107,0.5)]"
            >
              <FaTree /> Добавить дерево
            </motion.button>
            <motion.button
              onClick={handleAddImportantFiles}
              className="flex items-center gap-1 px-4 py-2 rounded-lg font-semibold text-sm text-white bg-gradient-to-r from-blue-600 to-cyan-500 transition-all shadow-[0_0_12px_rgba(0,255,157,0.3)] hover:shadow-[0_0_18px_rgba(0,255,157,0.5)]"
            >
              <FaKey /> Добавить основные файлы
            </motion.button>
            <motion.button
              onClick={handleAddSelected}
              className="flex items-center gap-1 px-4 py-2 rounded-lg font-semibold text-sm text-white bg-gradient-to-r from-indigo-600 to-purple-500 transition-all shadow-[0_0_12px_rgba(99,102,241,0.3)] hover:shadow-[0_0_18px_rgba(99,102,241,0.5)]"
            >
              <FaFileAlt /> Добавить выбранные файлы
            </motion.button>
          </div>
        </div>
      )}

      {selectedFiles.size > 0 && (
        <div className="mb-6 bg-gray-800 p-4 rounded-xl shadow-[0_0_12px_rgba(0,255,157,0.3)]">
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

      <div className="mb-4 relative">
        <label htmlFor="kwork-input" className="block text-sm font-medium mb-1">Ввод запроса</label>
        <textarea
          id="kwork-input"
          value={kworkInput}
          onChange={(e) => setKworkInput(e.target.value)}
          className="w-full p-3 bg-gray-800 rounded-lg border border-gray-700 focus:border-cyan-500 focus:outline-none transition shadow-[0_0_8px_rgba(0,255,157,0.3)] resize-none text-sm"
          rows={5}
          placeholder="Введите ваш запрос здесь..."
        />
        <motion.button
          onClick={handleCopyToClipboard}
          className="absolute top-2 right-2 p-1 bg-gradient-to-r from-cyan-600 to-teal-500 rounded-full shadow-[0_0_8px_rgba(6,182,212,0.3)] hover:shadow-[0_0_12px_rgba(6,182,212,0.5)] transition-all"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          title="Скопировать в буфер"
        >
          <FaClipboard className="text-white text-lg" />
        </motion.button>
      </div>

      <div className="fixed bottom-4 right-4 bg-gray-700 p-2 rounded-lg shadow-lg">
        <p className="text-sm text-white">{getXuinityMessage()}</p>
      </div>
    </div>
  );
};

export default RepoTxtFetcher;