"use client";
import React, { useState, useEffect, useImperativeHandle, forwardRef, MutableRefObject } from "react"; // Import necessary hooks
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { fetchRepoContents } from "@/app/actions_github/actions";
import { toast } from "sonner";
import { useAppContext } from "@/contexts/AppContext";
import { useRepoXmlPageContext } from "@/contexts/RepoXmlPageContext"; // Import the context hook
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { FaTree, FaKey, FaFileAlt, FaClipboard, FaDownload, FaSync } from "react-icons/fa";

export interface FileNode { // Make sure this is exported or defined commonly
  path: string;
  content: string;
}

interface RepoTxtFetcherProps {
    kworkInputRef: MutableRefObject<HTMLTextAreaElement | null>; // Receive ref
}

const RepoTxtFetcher = forwardRef<any, RepoTxtFetcherProps>(({ kworkInputRef }, ref) => {
  const [repoUrl, setRepoUrl] = useState<string>("https://github.com/salavey13/cartest");
  const [token, setToken] = useState<string>("");
  const [files, setFiles] = useState<FileNode[]>([]);
  const [selectedFiles, setSelectedFilesState] = useState<Set<string>>(new Set()); // Local state for UI checkbox
  const [extractLoading, setExtractLoading] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [kworkInput, setKworkInput] = useState<string>("");
  const [primaryHighlightedPath, setPrimaryHighlightedPath] = useState<string | null>(null);
  const [secondaryHighlightedPaths, setSecondaryHighlightedPaths] = useState<string[]>([]);
  const { user } = useAppContext();
  const {
    setRepoUrlEntered,
    setFilesFetched,
    setSelectedFetcherFiles,
    setKworkInputHasContent,
    setRequestCopied,
    scrollToSection,
  } = useRepoXmlPageContext(); // Use the context

  const searchParams = useSearchParams();
  const highlightedPathFromUrl = searchParams.get("path") || "";
  const autoFetch = !!highlightedPathFromUrl;

  const importantFiles = [
    "app/actions.ts",
    "hooks/useTelegram.ts",
    "contexts/AppContext.tsx",
    "types/supabase.ts",
    "contexts/RepoXmlPageContext.tsx", // Add context itself if needed
  ];

  const addToast = (message: string) => {
    toast(message, { style: { background: "rgba(34, 34, 34, 0.8)", color: "#E1FF01" } });
  };

  // Update context when repoUrl changes
  useEffect(() => {
      setRepoUrlEntered(repoUrl.trim().length > 0);
  }, [repoUrl, setRepoUrlEntered]);

  // Update context when kworkInput changes
  useEffect(() => {
      setKworkInputHasContent(kworkInput.trim().length > 0);
      // Reset copied status if user edits the input after copying
      if (kworkInput.trim().length > 0) {
          setRequestCopied(false);
      }
  }, [kworkInput, setKworkInputHasContent, setRequestCopied]);


  // **Helper Functions** (getPageFilePath, extractImports, resolveImportPath remain the same)
    const getPageFilePath = (routePath: string): string => {
        // Adjust if using route groups like (app) etc.
        const cleanPath = routePath.replace(/^\(.*\)/, ''); // Remove potential group like (app)
        return `app${cleanPath}/page.tsx`; // Assuming structure is app/route/page.tsx
    };
    const extractImports = (content: string): string[] => {
        const importRegex = /import\s+.*?\s+from\s+['"](.+?)['"]/g;
        const matches = content.matchAll(importRegex);
        return Array.from(matches, (m) => m[1]);
    };
    const resolveImportPath = (importPath: string, currentFilePath: string, allFiles: FileNode[]): string | null => {
        if (importPath.startsWith('@/')) {
            const relativePath = importPath.replace('@/', '');
            const possibleExtensions = ['.tsx', '.ts', '/index.tsx', '/index.ts'];
            for (const ext of possibleExtensions) {
                const potentialPath = `${relativePath}${ext}`;
                if (allFiles.some(file => file.path === potentialPath)) {
                    return potentialPath;
                }
            }
        } else if (importPath.startsWith('.')) {
            // Basic relative path resolution (needs improvement for ../)
            const currentDir = currentFilePath.substring(0, currentFilePath.lastIndexOf('/'));
            const resolved = new URL(importPath, `file://${currentDir}/`).pathname.substring(1); // Crude simulation
             const possibleExtensions = ['', '.tsx', '.ts', '/index.tsx', '/index.ts'];
             for (const ext of possibleExtensions) {
                const potentialPath = `${resolved}${ext}`;
                 if (allFiles.some(file => file.path === potentialPath)) {
                    return potentialPath;
                }
             }
        }
        // Add more resolution logic if needed (node_modules, etc.)
        return null;
    };


  // **Fetch Handler**
  const handleFetch = async () => {
    setExtractLoading(true);
    setError(null);
    setFiles([]);
    setSelectedFilesState(new Set()); // Reset local UI state
    setProgress(0);
    setFilesFetched(false); // Update context: fetching started
    setSelectedFetcherFiles(new Set()); // Reset context selection
    addToast("Извлечение файлов...");

    try {
      const result = await fetchRepoContents(repoUrl, token || undefined);
      if (!result || !result.success || !Array.isArray(result.files)) {
        throw new Error(result?.error || "Не удалось загрузить содержимое репозитория или неверный формат данных");
      }
      const fetchedFiles = result.files;
      setFiles(fetchedFiles); // Update local state for rendering list
      setProgress(100);

      let primaryPath: string | null = null;
      let secondaryPaths: string[] = [];

      if (highlightedPathFromUrl) {
          primaryPath = getPageFilePath(highlightedPathFromUrl);
          setPrimaryHighlightedPath(primaryPath); // Update local state for styling
          const pageFile = fetchedFiles.find((file) => file.path === primaryPath);
          if (pageFile) {
              const imports = extractImports(pageFile.content);
              secondaryPaths = imports
                  .map((imp) => resolveImportPath(imp, pageFile.path, fetchedFiles))
                  .filter((path): path is string => path !== null);
              setSecondaryHighlightedPaths(secondaryPaths); // Update local state for styling
          } else {
              console.warn(`Page file "${primaryPath}" not found in repository`);
              primaryPath = null; // Don't highlight if not found
          }
      }

      setFilesFetched(true, primaryPath, secondaryPaths); // Update context: fetch succeeded with highlight info
      addToast("Файлы извлечены! Готов к следующему шагу.");

    } catch (err: any) {
      const errorMessage = `Ошибка: ${err.message || "Неизвестная ошибка при загрузке репозитория"}`;
      setError(errorMessage);
      addToast(errorMessage);
      console.error("Fetch error:", err);
      setFilesFetched(false); // Update context: fetch failed
    } finally {
      setExtractLoading(false);
    }
  };

  // **Auto-Fetch Effect**
  useEffect(() => {
    if (autoFetch) {
        console.log("Auto-fetching for path:", highlightedPathFromUrl);
        handleFetch(); // Trigger fetch automatically
        // Auto-scroll and set Kwork input is handled by StickyChatButton now based on context
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightedPathFromUrl]); // Only run when the highlighted path changes


   // **Select Highlighted Files** (Callable via ref/context)
    const selectHighlightedFiles = () => {
        const filesToSelect = new Set<string>();
        if (primaryHighlightedPath && files.some(f => f.path === primaryHighlightedPath)) {
            filesToSelect.add(primaryHighlightedPath);
        }
        secondaryHighlightedPaths.forEach(path => {
            if (files.some(f => f.path === path)) {
                filesToSelect.add(path);
            }
        });
        importantFiles.forEach(path => {
            if (files.some(f => f.path === path)) {
                filesToSelect.add(path); // Also select important files automatically
            }
        });

        setSelectedFilesState(filesToSelect); // Update local UI
        setSelectedFetcherFiles(filesToSelect); // Update context
        addToast("Подсвеченные и важные файлы выбраны!");
        // Optionally auto-add to kwork? Or let user click next action.
        handleAddSelected(filesToSelect); // Automatically add them to Kwork
    };

  // Update context when selection changes
  const toggleFileSelection = (path: string) => {
    const newSet = new Set(selectedFiles);
    if (newSet.has(path)) newSet.delete(path);
    else newSet.add(path);
    setSelectedFilesState(newSet); // Update local UI state
    setSelectedFetcherFiles(newSet); // Update context state
  };

  // Modified to accept optional set of files (for auto-select)
  const handleAddSelected = (filesToAdd?: Set<string>) => {
      const setToAdd = filesToAdd || selectedFiles;
      if (setToAdd.size === 0) {
          addToast("Выберите хотя бы один файл!");
          return;
      }
      const markdownTxt = files
          .filter((file) => setToAdd.has(file.path))
          .map((file) => `\`${file.path}\`:\n\`\`\`${getLanguage(file.path)}\n${file.content}\n\`\`\``) // Add language hint
          .join("\n\n");

      setKworkInput((prev) => `${prev ? prev + '\n\n' : ''}Контекст:\n${markdownTxt}`);
      addToast("Файлы добавлены. Опишите задачу и нажмите 'Скопировать'.");
      scrollToSection('kworkInput');
  };


  const handleAddImportantFiles = () => {
    const importantFilesSet = new Set(importantFiles);
    const filesToAdd = new Set(selectedFiles); // Start with current selection
    let addedCount = 0;
    importantFiles.forEach(path => {
        if (files.some(f => f.path === path) && !filesToAdd.has(path)) {
            filesToAdd.add(path);
            addedCount++;
        }
    });

    if (addedCount === 0 && selectedFiles.size > 0) {
         addToast("Важные файлы уже выбраны или добавлены.");
         return;
    }
     if (addedCount === 0 && selectedFiles.size === 0) {
         addToast("Важные файлы не найдены в репозитории.");
         return;
    }

    setSelectedFilesState(filesToAdd); // Update local UI
    setSelectedFetcherFiles(filesToAdd); // Update context
    handleAddSelected(filesToAdd); // Add them to kwork
    addToast(`${addedCount} важных файлов добавлено в выборку и запрос!`);
  };

  const handleAddFullTree = () => {
    const treeOnly = files.map((file) => `- ${file.path}`).join("\n");
    setKworkInput((prev) => `${prev}\n\nСтруктура проекта:\n\`\`\`\n${treeOnly}\n\`\`\``);
    addToast("Дерево файлов добавлено в запрос!");
    scrollToSection('kworkInput');
  };

  const handleCopyToClipboard = () => {
    if (!kworkInput.trim()) {
      addToast("Нечего копировать!");
      return;
    }
    navigator.clipboard.writeText(kworkInput);
    addToast("Скопировано! Вставьте в AI, затем результат вставьте ниже.");
    setRequestCopied(true); // Update context
    scrollToSection('aiResponseInput'); // Scroll to next logical step
  };

  // Expose methods via ref for the parent/context
  useImperativeHandle(ref, () => ({
    handleFetch,
    selectHighlightedFiles,
    handleAddSelected: () => handleAddSelected(), // Ensure it uses current selectedFiles state
    handleCopyToClipboard,
    // Add other methods if needed
  }));

  const getDisplayName = (path: string) => path.split("/").pop() || path;
  const getLanguage = (path: string) => {
      const extension = path.split('.').pop();
      switch(extension) {
          case 'ts': return 'typescript';
          case 'tsx': return 'typescript'; // or 'jsx' depending on highlighter
          case 'js': return 'javascript';
          case 'jsx': return 'javascript'; // or 'jsx'
          case 'css': return 'css';
          case 'html': return 'html';
          case 'json': return 'json';
          case 'py': return 'python';
          case 'md': return 'markdown';
          default: return 'text';
      }
  };
  const groupFilesByFolder = (files: FileNode[]) => {
    const grouped: { folder: string; files: FileNode[] }[] = [];
    const folderMap: { [key: string]: FileNode[] } = {};
    files.forEach((file) => {
      const folder = file.path.includes('/') ? file.path.substring(0, file.path.lastIndexOf("/")) : "root";
      if (!folderMap[folder]) folderMap[folder] = [];
      folderMap[folder].push(file);
    });
    // Sort folders, root first
    const sortedFolders = Object.keys(folderMap).sort((a, b) => {
        if (a === 'root') return -1;
        if (b === 'root') return 1;
        return a.localeCompare(b);
    });
    sortedFolders.forEach(folder => {
        // Sort files within folder
        folderMap[folder].sort((a, b) => a.path.localeCompare(b.path));
        grouped.push({ folder, files: folderMap[folder] });
    })
    return grouped;
  };


  // --- RENDER ---
  return (
    <div className="w-full p-4 bg-gray-900 text-white font-mono rounded-xl shadow-[0_0_15px_rgba(0,255,157,0.3)] relative overflow-hidden">
        {/* ... Header, Repo URL, Token Input ... */}
        <h2 className="text-2xl font-bold tracking-tight text-[#E1FF01] text-shadow-[0_0_10px_#E1FF01] animate-pulse mb-4">
          Кибер-Экстрактор Кода
        </h2>
        {highlightedPathFromUrl && (
            <p className="text-yellow-400 mb-4 text-center text-sm">
            Запрос на изменение страницы: <strong>{highlightedPathFromUrl}</strong>
            </p>
        )}
        <p className="text-gray-300 mb-6 text-sm">
            Извлеките код, выберите файлы для контекста, опишите задачу и скопируйте запрос для AI.
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
                disabled={extractLoading}
            />
            </div>
            <div>
            <label className="block text-sm font-medium mb-1">Токен GitHub (опционально, для приватных репо)</label>
            <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="w-full p-3 bg-gray-800 rounded-lg border border-gray-700 focus:border-cyan-500 focus:outline-none transition shadow-[0_0_8px_rgba(0,255,157,0.3)] hover:border-cyan-400 text-sm"
                placeholder="Введите ваш токен GitHub"
                 disabled={extractLoading}
            />
            </div>
            <motion.button
            onClick={handleFetch}
            disabled={extractLoading || !repoUrlEntered}
            className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm text-white bg-gradient-to-r from-purple-600 to-cyan-500 transition-all shadow-[0_0_12px_rgba(0,255,157,0.3)] ${extractLoading || !repoUrlEntered ? "opacity-50 cursor-not-allowed" : "hover:shadow-[0_0_18px_rgba(0,255,157,0.5)]"}`}
            whileHover={{ scale: (extractLoading || !repoUrlEntered) ? 1 : 1.05 }}
            whileTap={{ scale: (extractLoading || !repoUrlEntered) ? 1 : 0.95 }}
            >
             {extractLoading ? <FaSync className="animate-spin" /> : <FaDownload />}
            {extractLoading ? "Извлечение..." : "Извлечь файлы"}
            </motion.button>
        </div>

        {/* ... Progress Bar, Error Message ... */}
        {extractLoading && (
            <div className="mb-6">
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.5 }}
                    className="h-1 bg-gradient-to-r from-purple-600 to-cyan-500 rounded-full shadow-[0_0_10px_rgba(0,255,157,0.5)]"
                />
                <p className="text-white text-xs font-mono mt-1">Извлечение: {Math.round(progress)}%</p>
            </div>
        )}
        {error && <p className="text-red-400 mb-6 text-xs font-mono">{error}</p>}


        {/* File List */}
        {files.length > 0 && !extractLoading && (
            <div className="mb-6 bg-gray-800 p-4 rounded-xl shadow-[0_0_12px_rgba(0,255,157,0.3)]">
            <h3 className="text-xl font-bold text-cyan-400 mb-3">Консоль файлов ({files.length})</h3>
            <div className="max-h-60 overflow-y-auto pr-2 space-y-3"> {/* Added max-height and scroll */}
                 {groupFilesByFolder(files).map(({ folder, files: folderFiles }) => (
                    <div key={folder} className="bg-gray-900 p-3 rounded-lg border border-gray-700 shadow-[0_0_8px_rgba(0,255,157,0.2)]">
                        <h4 className="text-sm font-semibold text-purple-400 mb-2 sticky top-0 bg-gray-900 py-1">{folder}</h4> {/* Sticky folder header */}
                        <ul className="space-y-1.5"> {/* Increased spacing */}
                            {folderFiles.map((file) => (
                                <li id={`file-${file.path}`} key={file.path} className="flex items-center gap-2 cursor-pointer hover:bg-gray-700 px-1 rounded" onClick={() => toggleFileSelection(file.path)}>
                                <input
                                    type="checkbox"
                                    checked={selectedFiles.has(file.path)}
                                    onChange={(e) => { e.stopPropagation(); toggleFileSelection(file.path); }} // Prevent li click, handle directly
                                    className="w-3.5 h-3.5 accent-cyan-500 cursor-pointer flex-shrink-0" // Slightly larger checkbox
                                />
                                <span
                                    className={`text-xs flex-grow truncate ${
                                    file.path === primaryHighlightedPath
                                        ? "text-yellow-300 font-bold ring-1 ring-yellow-400 rounded px-1" // More visible highlight
                                        : secondaryHighlightedPaths.includes(file.path)
                                        ? "text-green-400 font-semibold ring-1 ring-green-500 rounded px-1"
                                        : importantFiles.includes(file.path)
                                        ? "text-cyan-300 font-medium"
                                        : "text-gray-400" // Default
                                    } ${selectedFiles.has(file.path) ? 'text-white' : ''} `} // White text if selected
                                    title={file.path} // Tooltip with full path
                                >
                                    {getDisplayName(file.path)}
                                </span>
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>
            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-2 mt-4">
                 <motion.button
                    onClick={() => handleAddSelected()}
                    disabled={selectedFiles.size === 0}
                    className={`flex-1 flex items-center justify-center gap-1 px-4 py-2 rounded-lg font-semibold text-sm text-white bg-gradient-to-r from-indigo-600 to-purple-500 transition-all shadow-[0_0_12px_rgba(99,102,241,0.3)] ${selectedFiles.size === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-[0_0_18px_rgba(99,102,241,0.5)]'}`}
                    whileHover={{ scale: selectedFiles.size === 0 ? 1 : 1.05 }}
                    whileTap={{ scale: selectedFiles.size === 0 ? 1 : 0.95 }}
                    >
                    <FaFileAlt /> Добавить выбранные ({selectedFiles.size})
                </motion.button>
                <motion.button
                    onClick={handleAddImportantFiles}
                    className="flex-1 flex items-center justify-center gap-1 px-4 py-2 rounded-lg font-semibold text-sm text-white bg-gradient-to-r from-blue-600 to-cyan-500 transition-all shadow-[0_0_12px_rgba(0,255,157,0.3)] hover:shadow-[0_0_18px_rgba(0,255,157,0.5)]"
                    whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                    >
                    <FaKey /> Добавить важные
                </motion.button>
                <motion.button
                    onClick={handleAddFullTree}
                    className="flex-1 flex items-center justify-center gap-1 px-4 py-2 rounded-lg font-semibold text-sm text-white bg-gradient-to-r from-red-600 to-orange-500 transition-all shadow-[0_0_12px_rgba(255,107,107,0.3)] hover:shadow-[0_0_18px_rgba(255,107,107,0.5)]"
                    whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                    >
                    <FaTree /> Добавить дерево
                </motion.button>
            </div>
            </div>
        )}

        {/* Kwork Input Area */}
        <div className="mb-4 relative">
            <label htmlFor="kwork-input" className="block text-sm font-medium mb-1">Ввод запроса</label>
            <textarea
                id="kwork-input"
                ref={kworkInputRef} // Assign the ref
                value={kworkInput}
                onChange={(e) => setKworkInput(e.target.value)}
                className="w-full p-3 bg-gray-800 rounded-lg border border-gray-700 focus:border-cyan-500 focus:outline-none transition shadow-[0_0_8px_rgba(0,255,157,0.3)] resize-y min-h-[100px] text-sm" // Allow vertical resize
                placeholder="Опишите здесь вашу задачу...\nЗатем добавьте контекст с помощью кнопок выше."
            />
            <motion.button
                onClick={handleCopyToClipboard}
                disabled={!kworkInputHasContent}
                className={`absolute top-2 right-2 p-1.5 bg-gradient-to-r from-cyan-600 to-teal-500 rounded-full shadow-[0_0_8px_rgba(6,182,212,0.3)] transition-all ${!kworkInputHasContent ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-[0_0_12px_rgba(6,182,212,0.5)]'}`}
                whileHover={{ scale: !kworkInputHasContent ? 1 : 1.1 }}
                whileTap={{ scale: !kworkInputHasContent ? 1 : 0.9 }}
                title="Скопировать запрос в буфер"
            >
                <FaClipboard className="text-white text-base" /> {/* Slightly smaller icon */}
            </motion.button>
        </div>


        {/* Selected Files Preview (Optional but helpful) */}
        {selectedFiles.size > 0 && (
            <details className="mb-6 bg-gray-800 p-4 rounded-xl shadow-[0_0_12px_rgba(0,255,157,0.3)]">
            <summary className="text-lg font-bold text-cyan-400 cursor-pointer">Предпросмотр выбранных файлов ({selectedFiles.size})</summary>
            <div className="mt-3 max-h-96 overflow-y-auto space-y-4">
                {Array.from(selectedFiles).map((path) => {
                    const file = files.find((f) => f.path === path);
                    if (!file) return null;
                    const lang = getLanguage(file.path);
                    return (
                    <div key={file.path} className="bg-gray-900 rounded-lg overflow-hidden border border-gray-700">
                        <h4 className="text-xs font-bold text-purple-400 px-3 py-1 bg-gray-700">{file.path}</h4>
                        <SyntaxHighlighter
                            language={lang}
                            style={oneDark}
                            customStyle={{ background: "#111827", padding: "0.75rem", margin: 0, fontSize: "0.75rem" }}
                            showLineNumbers={true} // Add line numbers
                        >
                        {file.content.length > 1000 ? file.content.substring(0, 1000) + '\n... (усечено)' : file.content}
                        </SyntaxHighlighter>
                    </div>
                    );
                })}
            </div>
            </details>
        )}

        {/* Removed the fixed bottom message - Xuinity handles this now */}

    </div>
  );
});

RepoTxtFetcher.displayName = 'RepoTxtFetcher'; // Add display name

export default RepoTxtFetcher;