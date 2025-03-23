"use client";
import { useState, useEffect } from "react";
import { createGitHubPullRequest, getOpenPullRequests, notifyAdmin } from "@/app/actions_github/actions";
import { supabaseAdmin } from "@/hooks/supabase";
import { useAppContext } from "@/contexts/AppContext";
import { saveAs } from "file-saver";
import { FaArrowRight, FaEllipsisV, FaTelegramPlane, FaTrash, FaList, FaTools, FaPlus, FaInfoCircle, FaRobot, FaImage, FaBook, FaDatabase, FaRocket, FaCode, FaLink } from "react-icons/fa";
import { toast } from "sonner";
import { sendTelegramDocument } from "@/app/actions";

interface FileEntry { path: string; content: string; extension: string; }

const Tooltip = ({ children, text }: { children: React.ReactNode; text: string }) => {
  const [isVisible, setIsVisible] = useState(false);
  return (
    <div className="relative inline-block">
      <div onMouseEnter={() => setIsVisible(true)} onMouseLeave={() => setIsVisible(false)}>
        {children}
      </div>
      {isVisible && (
        <div className="absolute z-10 p-2 bg-gray-700 text-white text-[13px] rounded shadow-lg w-42 top-[100%] right-[-13px] mt-1 whitespace-pre-line">
          {text}
        </div>
      )}
    </div>
  );
};

// pat
export default function AICodeAssistant() {
  const { user } = useAppContext();
  const [response, setResponse] = useState<string>("");
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [savedFiles, setSavedFiles] = useState<FileEntry[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [repoUrl, setRepoUrl] = useState<string>("https://github.com/salavey13/cartest");
  const [prTitle, setPrTitle] = useState<string>("");
  const [prDescription, setPrDescription] = useState<string>("");
  const [commitMessage, setCommitMessage] = useState<string>("");
  const [openPRs, setOpenPRs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showFileMenu, setShowFileMenu] = useState(false);
  const [showSavedFileMenu, setShowSavedFileMenu] = useState(false);
  const [showPRDetails, setShowPRDetails] = useState(false);
  const [showToolsMenu, setShowToolsMenu] = useState(false);
  const [customLinks, setCustomLinks] = useState<{ name: string; url: string }[]>([]);

  const predefinedLinks = [
    { name: "ChatGPT", url: "https://chatgpt.com", icon: <FaRobot className="text-green-500" /> },
    { name: "QwenLM", url: "https://qwenlm.ai", icon: <FaImage className="text-blue-500" /> },
    { name: "NotebookLM", url: "https://notebooklm.google.com", icon: <FaBook className="text-yellow-500" /> },
    { name: "Supabase", url: "https://supabase.com", icon: <FaDatabase className="text-teal-500" /> },
    { name: "Vercel", url: "https://vercel.com", icon: <FaRocket className="text-black" /> },
    { name: "Coze.com", url: "https://coze.com", icon: <FaCode className="text-purple-500" /> },
  ];

  useEffect(() => {
    const loadData = async () => {
      if (user) {
        const { data: userData } = await supabaseAdmin
          .from("users")
          .select("metadata")
          .eq("user_id", user.id)
          .single();
        if (userData?.metadata?.generated_files) {
          setSavedFiles(userData.metadata.generated_files.map((f: any) => ({
            path: f.path,
            content: f.code,
            extension: f.extension,
          })));
        }
        if (userData?.metadata?.customLinks) setCustomLinks(userData.metadata.customLinks);
      }
    };
    loadData();
  }, [user]);

  const parseFilesFromText = (text: string): FileEntry[] => {
    const entries: FileEntry[] = [];
    const codeBlocks = text.match(/^```[\s\S]*?^```/gm) || [];
    codeBlocks.forEach((block) => {
      const content = block.slice(3, -3).trim();
      const lines = content.split("\n");
      let codeStartIndex = 0;
      let path: string | undefined;
      for (let i = codeStartIndex; i < lines.length; i++) {
        const match = lines[i].match(/^\s*\/\/\s*\/?(.+?\.(tsx|ts|sql|json))/);
        if (match) {
          path = match[1].trim();
          codeStartIndex = i + 1;
          break;
        }
      }
      if (!path) path = `unnamed.txt`;
      entries.push({ path, content: lines.slice(codeStartIndex).join("\n"), extension: path.split(".").pop() || "txt" });
    });
    return entries;
  };

  const extractPRDetails = (rawText: string) => {
    let title = "Обновление от AI Code Assistant";
    let description = "Автоматически сгенерировано AI Code Assistant";
    let commitMsg = "Изменения из ответа бота";
    const lines = rawText.split("\n").filter((line) => line.trim());
    if (lines.length > 0) {
      for (const line of lines) {
        if (line.toLowerCase().startsWith("title:")) title = line.substring(6).trim().substring(0, 100);
        else if (line.toLowerCase().startsWith("description:")) description = line.substring(11).trim();
        else if (line.toLowerCase().startsWith("commit:")) commitMsg = line.substring(7).trim();
      }
      if (title === "Обновление от AI Code Assistant") title = lines[0].substring(0, 100);
      if (description === "Автоматически сгенерировано AI Code Assistant" && lines.length > 1) description = lines.slice(1).join("\n");
      if (commitMsg === "Изменения из ответа бота") commitMsg = lines[0].substring(0, 72) + (lines.length > 1 ? "\n\n" + lines.slice(1).join("\n") : "");
    }
    return { title, description, commitMessage: commitMsg };
  };

  const handleParse = () => {
    setFiles([]);
    const parsedFiles = parseFilesFromText(response);
    setFiles(parsedFiles);
    const { title, description, commitMessage } = extractPRDetails(response);
    setPrTitle(title);
    setPrDescription(description);
    setCommitMessage(commitMessage);
    if (parsedFiles.length === 0) toast.info("В ответе не найдено файлов");
  };

  const handleSaveFiles = async () => {
    if (!user || files.length === 0) return;
    setLoading(true);
    try {
      const fileData = files.map((file) => ({ path: file.path, code: file.content, extension: file.extension }));
      const { data: existingData } = await supabaseAdmin.from("users").select("metadata").eq("user_id", user.id).single();
      const updatedFiles = [
        ...(existingData?.metadata?.generated_files || []).filter((f: any) => !fileData.some((newFile) => newFile.path === f.path)),
        ...fileData,
      ];
      await supabaseAdmin.from("users").upsert({ user_id: user.id, metadata: { ...existingData?.metadata, generated_files: updatedFiles } });
      setSavedFiles(updatedFiles.map((f: any) => ({ path: f.path, content: f.code, extension: f.extension })));
      toast.success("Файлы успешно сохранены!");
    } catch (err) {
      toast.error("Ошибка при сохранении файлов: " + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();
    files.forEach((file) => zip.file(file.path, file.content));
    const blob = await zip.generateAsync({ type: "blob" });
    saveAs(blob, "coze_files.zip");
  };

  const downloadFile = async (file: FileEntry) => {
    if (!user) return toast.error("Пользователь Telegram не найден");
    setLoading(true);
    try {
      const result = await sendTelegramDocument(user.id, file.content, file.path.split("/").pop() || "file");
      if (result.success) toast.success(`Файл "${file.path}" отправлен в ваш чат Telegram!`);
      else throw new Error(result.error);
    } catch (err) {
      toast.error(`Ошибка при отправке "${file.path}" в Telegram: ` + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleClearAllSavedFiles = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: existingData } = await supabaseAdmin.from("users").select("metadata").eq("user_id", user.id).single();
      await supabaseAdmin.from("users").upsert({ user_id: user.id, metadata: { ...existingData?.metadata, generated_files: [] } });
      setSavedFiles([]);
      toast.success("Все сохраненные файлы очищены!");
    } catch (err) {
      toast.error("Ошибка при очистке файлов: " + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePR = async () => {
    if (!repoUrl || !selectedFiles.size || !prTitle || !prDescription || !commitMessage) {
      toast.error("Пожалуйста, укажите URL репозитория, выберите файлы, заголовок PR, описание и сообщение коммита");
      return;
    }
    setLoading(true);
    try {
      const filesToCommit = Array.from(selectedFiles).map((path) => {
        const parsedFile = files.find((f) => f.path === path);
        const savedFile = savedFiles.find((f) => f.path === path);
        const file = parsedFile || savedFile;
        return file ? { path: file.path, content: file.content } : null;
      }).filter(Boolean) as { path: string; content: string }[];
      if (filesToCommit.length === 0) {
        toast.error("Нет выбранных файлов для коммита");
        return;
      }
      const username = user?.username || user?.id || "неизвестный";
      const enrichedPrDescription = `${prDescription}\n\nСоздано: ${username}\nФайлы: ${Array.from(selectedFiles).join(", ")}`;
      const result = await createGitHubPullRequest(repoUrl, filesToCommit, prTitle, enrichedPrDescription);
      if (result.success) {
        toast.success(`PR успешно создан: ${result.prUrl}`);
        await notifyAdmin(`Новый PR создан ${username}: ${result.prUrl}`);
        handleGetOpenPRs();
      } else {
        toast.error("Ошибка при создании PR: " + result.error);
      }
    } catch (err) {
      toast.error("Ошибка при создании PR: " + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleGetOpenPRs = async () => {
    if (!repoUrl) return toast.error("Пожалуйста, укажите URL репозитория");
    setLoading(true);
    try {
      const result = await getOpenPullRequests(repoUrl);
      if (result.success) setOpenPRs(result.pullRequests);
      else toast.error("Ошибка при получении PR: " + result.error);
    } catch (err) {
      toast.error("Ошибка при получении PR: " + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const toggleFileSelection = (path: string) => {
    setSelectedFiles((prev) => {
      const newSelected = new Set(prev);
      newSelected.has(path) ? newSelected.delete(path) : newSelected.add(path);
      return newSelected;
    });
  };

  const handleSelectAllFiles = () => setSelectedFiles(new Set(files.map((file) => file.path)));

  const handleAddCustomLink = async () => {
    const name = prompt("Введите название ссылки:");
    const url = prompt("Введите URL ссылки:");
    if (name && url) {
      const newLink = { name, url };
      const updatedLinks = [...customLinks, newLink];
      setCustomLinks(updatedLinks);
      if (user) {
        const { data: existingData } = await supabaseAdmin.from("users").select("metadata").eq("user_id", user.id).single();
        await supabaseAdmin.from("users").upsert({ user_id: user.id, metadata: { ...existingData?.metadata, customLinks: updatedLinks } });
      }
    }
  };

  return (
    <div className="p-4 bg-gray-900 text-white min-h-screen font-sans">
      <header className="flex items-center gap-2 mb-6">
        <h1 className="text-3xl font-bold tracking-tight">AI Code Assistant</h1>
        <Tooltip text="Шаги для создания PR:\n1. Вставьте ответ бота.\n2. Разберите файлы.\n3. Выберите файлы.\n4. Создайте PR.">
          <FaInfoCircle className="text-blue-400 cursor-pointer hover:text-blue-300 transition" />
        </Tooltip>
      </header>

      <div className="mb-6">
        <p className="text-yellow-400 mb-2 text-sm">
          Примечание: Встроенный бот Coze в настоящее время неактивен из-за проблем с финансированием. Пожалуйста, используйте других ботов для генерации ответа и вставьте его здесь.
        </p>
        <div className="relative">
          <textarea
            className="w-full p-3 pr-12 bg-gray-800 rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none transition text-sm"
            rows={3}
            value={response}
            onChange={(e) => setResponse(e.target.value)}
            placeholder="Вставьте ответ бота здесь..."
            disabled={loading}
          />
          <button
            className="absolute right-2 bottom-2 p-2 rounded-full bg-purple-600 hover:bg-purple-700 transition disabled:bg-gray-500"
            onClick={handleParse}
            disabled={loading || !response}
          >
            <FaArrowRight className="text-white" />
          </button>
        </div>
      </div>

      {files.length > 0 && (
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-lg font-semibold">Разобранные файлы</h2>
            <div className="relative">
              <button className="p-1" onClick={() => setShowFileMenu(!showFileMenu)}>
                <FaEllipsisV className="text-gray-400" />
              </button>
              {showFileMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-gray-800 rounded shadow-lg z-10">
                  <button className="block w-full text-left px-4 py-2 hover:bg-gray-700 text-sm" onClick={handleSaveFiles}>Сохранить файлы</button>
                  <button className="block w-full text-left px-4 py-2 hover:bg-gray-700 text-sm" onClick={handleDownload}>Скачать ZIP</button>
                  <button className="block w-full text-left px-4 py-2 hover:bg-gray-700 text-sm" onClick={handleSelectAllFiles}>Выбрать все</button>
                </div>
              )}
            </div>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {files.map((file) => (
              <div key={file.path} className="flex items-center gap-2">
                <input type="checkbox" checked={selectedFiles.has(file.path)} onChange={() => toggleFileSelection(file.path)} />
                <span className="truncate text-sm">{file.path}</span>
                <button onClick={() => downloadFile(file)} disabled={loading}><FaTelegramPlane className="text-purple-500" /></button>
              </div>
            ))}
          </div>
        </div>
      )}

      {savedFiles.length > 0 && (
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-lg font-semibold">Сохраненные файлы</h2>
            <div className="relative">
              <button className="p-1" onClick={() => setShowSavedFileMenu(!showSavedFileMenu)}>
                <FaEllipsisV className="text-gray-400" />
              </button>
              {showSavedFileMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-gray-800 rounded shadow-lg z-10">
                  <button className="block w-full text-left px-4 py-2 hover:bg-gray-700 text-sm" onClick={handleClearAllSavedFiles}>Очистить все сохраненные файлы</button>
                </div>
              )}
            </div>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {savedFiles.map((file) => (
              <div key={file.path} className="flex items-center gap-2">
                <input type="checkbox" checked={selectedFiles.has(file.path)} onChange={() => toggleFileSelection(file.path)} />
                <span className="truncate text-sm">{file.path}</span>
                <button onClick={() => downloadFile(file)} disabled={loading}><FaTelegramPlane className="text-purple-500" /></button>
              </div>
            ))}
          </div>
        </div>
      )}

      <section className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-lg font-semibold">Pull Request</h2>
          <div className="flex gap-2">
            <button
              className="bg-gradient-to-r from-purple-600 to-cyan-500 text-white px-4 py-2 rounded shadow-glow hover:shadow-glow transition disabled:bg-gray-500 disabled:shadow-none text-sm"
              onClick={handleCreatePR}
              disabled={loading || !repoUrl || selectedFiles.size === 0 || !commitMessage}
            >
              Создать PR
            </button>
            <button
              className="p-2"
              onClick={handleGetOpenPRs}
              disabled={loading || !repoUrl}
            >
              <FaList className="text-gray-400" />
            </button>
          </div>
        </div>
        <button
          className="text-blue-400 hover:underline text-sm"
          onClick={() => setShowPRDetails(!showPRDetails)}
        >
          {showPRDetails ? "Скрыть детали PR" : "Показать детали PR"}
        </button>
        {showPRDetails && (
          <div className="mt-2 space-y-2">
            <p className="text-gray-400 text-xs">Эти поля автоматически заполнены из ответа бота.</p>
            <input
              className="w-full p-2 bg-gray-800 rounded border border-gray-700 focus:border-blue-500 transition text-sm"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="URL репозитория GitHub"
            />
            <input
              className="w-full p-2 bg-gray-800 rounded border border-gray-700 focus:border-blue-500 transition text-sm"
              value={prTitle}
              onChange={(e) => setPrTitle(e.target.value)}
              placeholder="Заголовок PR"
            />
            <textarea
              className="w-full p-2 bg-gray-800 rounded border border-gray-700 focus:border-blue-500 transition text-sm"
              value={prDescription}
              onChange={(e) => setPrDescription(e.target.value)}
              placeholder="Описание PR"
              rows={2}
            />
            <textarea
              className="w-full p-2 bg-gray-800 rounded border border-gray-700 focus:border-blue-500 transition text-sm"
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              placeholder="Сообщение коммита (автоматически заполнено из ответа)"
              rows={3}
            />
          </div>
        )}
      </section>

      {openPRs.length > 0 && (
        <section className="mb-6">
          <h2 className="text-lg font-semibold mb-2">Открытые Pull Requests</h2>
          <ul className="space-y-2">
            {openPRs.map((pr) => (
              <li key={pr.number} className="flex items-center gap-2 bg-gray-800 p-2 rounded text-sm">
                <a href={pr.html_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                  #{pr.number}: {pr.title}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mb-6">
        <div className="relative">
          <button className="flex items-center gap-2 p-2 bg-gray-800 rounded hover:bg-gray-700 transition" onClick={() => setShowToolsMenu(!showToolsMenu)}>
            <FaTools className="text-gray-400" />
            <span className="text-sm">Дополнительные инструменты</span>
          </button>
          {showToolsMenu && (
            <div className="absolute right-0 mt-2 w-48 bg-gray-800 rounded shadow-lg z-10">
              {predefinedLinks.map((link) => (
                <a key={link.name} href={link.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2 hover:bg-gray-700 text-sm">
                  {link.icon}
                  <span>{link.name}</span>
                </a>
              ))}
              {customLinks.map((link) => (
                <a key={link.name} href={link.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2 hover:bg-gray-700 text-sm">
                  <FaLink className="text-gray-400" />
                  <span>{link.name}</span>
                </a>
              ))}
              <button className="block w-full text-left px-4 py-2 hover:bg-gray-700 text-sm" onClick={handleAddCustomLink}>
                <FaPlus className="inline mr-2" /> Добавить ссылку
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}