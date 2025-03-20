// /components/CozeExecutor.tsx
"use client";
import { useState, useEffect } from "react";
import {
  createGitHubPullRequest,
  getOpenPullRequests,
  approvePullRequest,
  closePullRequest,
} from "@/app/actions_github/actions";
import { executeCozeAgent, sendTelegramDocument, notifyAdmin } from "@/app/actions";
import { supabaseAdmin } from "@/hooks/supabase";
import { useAppContext } from "@/contexts/AppContext";
import { saveAs } from "file-saver";
import { FaInfoCircle, FaTelegramPlane, FaTrash, FaExternalLinkAlt, FaRobot, FaImage, FaBook, FaPlus } from "react-icons/fa";
import { toast } from 'sonner';

interface FileEntry {
  path: string;
  content: string;
  extension: string;
}

interface CozeResponse {
  id: string;
  bot_id: string;
  user_id: string;
  content: string;
  response: any;
  metadata: any;
  created_at: string;
}

const Tooltip = ({ children, text }: { children: React.ReactNode; text: string }) => {
  const [isVisible, setIsVisible] = useState(false);
  return (
    <div className="relative inline-block">
      <div onMouseEnter={() => setIsVisible(true)} onMouseLeave={() => setIsVisible(false)}>
        {children}
      </div>
      {isVisible && (
        <div className="absolute z-10 p-2 bg-gray-700 text-white text-[10px] rounded shadow-lg w-72 top-[100%] left-0 mt-1 whitespace-pre-line">
          {text}
        </div>
      )}
    </div>
  );
};

export default function CozeExecutor({
  botId = "7483269209293275191",
  userId = "341503612082",
}: {
  botId?: string;
  userId?: string;
}) {
  const [response, setResponse] = useState<string>("");
  const [responseData, setResponseData] = useState<any>(null);
  const [isResponseCollapsed, setIsResponseCollapsed] = useState(false);
  const [content, setContent] = useState<string>("Generate code components");
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [savedFiles, setSavedFiles] = useState<FileEntry[]>([]);
  const [cozeResponses, setCozeResponses] = useState<CozeResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [packageJsonInput, setPackageJsonInput] = useState<string>("");
  const [newModules, setNewModules] = useState<string[]>([]);
  const [customLink, setCustomLink] = useState<string | null>(null);
  const { user } = useAppContext();

  const [repoUrl, setRepoUrl] = useState<string>("https://github.com/salavey13/cartest");
  const [prTitle, setPrTitle] = useState<string>("");
  const [prDescription, setPrDescription] = useState<string>("");
  const [commitMessage, setCommitMessage] = useState<string>("");
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [openPRs, setOpenPRs] = useState<any[]>([]);

  useEffect(() => {
    const loadData = async () => {
      if (!user) return;
      try {
        const { data: userData } = await supabaseAdmin
          .from("users")
          .select("metadata")
          .eq("user_id", user.id)
          .single();
        if (userData?.metadata?.generated_files) {
          setSavedFiles(
            userData.metadata.generated_files.map((f: any) => ({
              path: f.path,
              content: f.code,
              extension: f.extension,
            }))
          );
        }
        if (userData?.metadata?.customLink) {
          setCustomLink(userData.metadata.customLink);
        }
        const { data: responses } = await supabaseAdmin
          .from("coze_responses")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });
        setCozeResponses(responses || []);
      } catch (err) {
        toast.error("Ошибка при загрузке данных: " + (err as Error).message);
      }
    };
    if (user) loadData();
  }, [user]);

  const parseFilesFromText = (text: string): FileEntry[] => {
    const entries: FileEntry[] = [];
    const supportedLanguages = ["typescript", "tsx", "ts", "sql"];
    const importRegex = /import\s+.*\s+from\s+['"]([^'"]+)['"]/g;
    const detectedModules: Set<string> = new Set();

    try {
      const codeBlocks = text.match(/```[\s\S]*?```/g) || [];
      codeBlocks.forEach((block) => {
        const content = block.slice(3, -3).trim();
        const lines = content.split("\n");
        let codeStartIndex = 0;
        let language: string | undefined;
        let path: string | undefined;

        const firstLine = lines[0].trim();
        if (supportedLanguages.includes(firstLine)) {
          language = firstLine;
          codeStartIndex = 1;
        }

        for (let i = codeStartIndex; i < lines.length; i++) {
          const match = lines[i].match(/^\s*\/\/\s*\/?(.+?\.(tsx|ts|sql|json))/);
          if (match) {
            path = match[1].trim();
            codeStartIndex = i + 1;
            break;
          }
        }

        if (!path) path = `unnamed.${language || "txt"}`;
        const codeContent = lines.slice(codeStartIndex).join("\n");
        const extension = path.split(".").pop() || "txt";

        let match;
        while ((match = importRegex.exec(codeContent)) !== null) {
          const moduleName = match[1];
          if (!moduleName.startsWith("@/") && !moduleName.startsWith("./") && !moduleName.startsWith("../")) {
            detectedModules.add(moduleName);
          }
        }

        entries.push({ path, content: codeContent, extension });
      });

      const currentDeps = packageJsonInput ? Object.keys(JSON.parse(packageJsonInput).dependencies || {}) : [];
      const newMods = Array.from(detectedModules).filter((mod) => !currentDeps.includes(mod));
      setNewModules(newMods);
    } catch (err) {
      toast.error("Ошибка при парсинге текста: " + (err as Error).message);
    }
    return entries;
  };

  const extractPRDetails = (data: any, rawText: string) => {
    let title = "Обновление от CozeExecutor";
    let description = "Автоматически сгенерировано CozeExecutor";
    let commitMsg = "Изменения из ответа бота";

    if (data && typeof data === "object") {
      title = data.title || data.subject || title;
      description = data.description || data.body || description;
      commitMsg = data.commitMessage || data.summary || commitMsg;
    }

    const lines = rawText.split("\n").filter((line) => line.trim());
    if (lines.length > 0) {
      for (const line of lines) {
        if (line.toLowerCase().startsWith("title:") || line.toLowerCase().startsWith("заголовок:")) {
          title = line.substring(line.indexOf(":") + 1).trim().substring(0, 100);
        } else if (line.toLowerCase().startsWith("description:") || line.toLowerCase().startsWith("описание:")) {
          description = line.substring(line.indexOf(":") + 1).trim();
        } else if (line.toLowerCase().startsWith("commit:") || line.toLowerCase().startsWith("коммит:")) {
          commitMsg = line.substring(line.indexOf(":") + 1).trim();
        }
      }
      if (!data?.title && title === "Обновление от CozeExecutor") {
        title = lines[0].substring(0, 100);
      }
      if (!data?.description && description === "Автоматически сгенерировано CozeExecutor" && lines.length > 1) {
        description = lines.slice(1).join("\n");
      }
      if (!data?.commitMessage && commitMsg === "Изменения из ответа бота") {
        commitMsg = lines[0].substring(0, 72) + (lines.length > 1 ? "\n\n" + lines.slice(1).join("\n") : "");
      }
    }

    if (files.length > 0 && commitMsg === "Изменения из ответа бота") {
      commitMsg = `Обновлены файлы: ${files.map(f => f.path).join(", ")}`;
    } else if (content && title === "Обновление от CozeExecutor") {
      title = `Изменения для: ${content.substring(0, 50)}`;
    }

    return { title, description, commitMessage: commitMsg };
  };

  const handleExecute = async () => {
    setLoading(true);
    setFiles([]);
    setNewModules([]);
    try {
      const result = await executeCozeAgent(botId, userId, content, { operation: "code_generation" });
      if (result.success) {
        setResponseData(result.data);
        const rawResponse = JSON.stringify(result.data, null, 2);
        setResponse(rawResponse);
        setFiles(parseFilesFromText(rawResponse));
        const { title, description, commitMessage } = extractPRDetails(result.data, rawResponse);
        setPrTitle(title);
        setPrDescription(description);
        setCommitMessage(commitMessage);
      } else {
        toast.error(result.error);
      }
    } catch (err) {
      toast.error("Ошибка при выполнении: " + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleParse = () => {
    setFiles([]);
    setNewModules([]);
    const parsedFiles = parseFilesFromText(response);
    setFiles(parsedFiles);
    const { title, description, commitMessage } = extractPRDetails(null, response);
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
      const { data: existingData } = await supabaseAdmin
        .from("users")
        .select("metadata")
        .eq("user_id", user.id)
        .single();
      const updatedFiles = [
        ...(existingData?.metadata?.generated_files || []).filter(
          (f: any) => !fileData.some((newFile) => newFile.path === f.path)
        ),
        ...fileData,
      ];

      await supabaseAdmin
        .from("users")
        .upsert({ user_id: user.id, metadata: { ...existingData?.metadata, generated_files: updatedFiles } });
      setSavedFiles(updatedFiles.map((f: any) => ({ path: f.path, content: f.code, extension: f.extension })));
      toast.success("Файлы успешно сохранены!");
    } catch (err) {
      toast.error("Ошибка при сохранении файлов: " + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleClearAllSavedFiles = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: existingData } = await supabaseAdmin
        .from("users")
        .select("metadata")
        .eq("user_id", user.id)
        .single();
      await supabaseAdmin
        .from("users")
        .upsert({ user_id: user.id, metadata: { ...existingData?.metadata, generated_files: [] } });
      setSavedFiles([]);
      toast.success("Все сохраненные файлы очищены!");
    } catch (err) {
      toast.error("Ошибка при очистке файлов: " + (err as Error).message);
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
    if (!user) {
      toast.error("Пользователь Telegram не найден");
      return;
    }
    setLoading(true);
    try {
      const result = await sendTelegramDocument(user.id, file.content, file.path.split("/").pop() || "file");
      if (!result.success) throw new Error(result.error);
      toast.success(`Файл "${file.path}" отправлен в ваш чат Telegram!`);
    } catch (err) {
      toast.error(`Ошибка при отправке "${file.path}" в Telegram: ` + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePR = async () => {
    if (!repoUrl || !selectedFiles.size || !commitMessage) {
      toast.error("Пожалуйста, укажите URL репозитория, выберите файлы и укажите сообщение коммита");
      return;
    }
    setLoading(true);
    try {
      const filesToCommit = files.filter((file) => selectedFiles.has(file.path));
      const username = user?.username || user?.id || "unknown";
      const result = await createGitHubPullRequest(
        repoUrl,
        filesToCommit,
        prTitle,
        prDescription,
        username,
        Array.from(selectedFiles)
      );
      if (result.success) {
        toast.success(`PR успешно создан: ${result.prUrl}`);
        await notifyAdmin("system", `Новый PR создан пользователем ${username}: ${result.prUrl}`);
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
    if (!repoUrl) {
      toast.error("Пожалуйста, укажите URL репозитория");
      return;
    }
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

  const handleApprovePR = async (pullNumber: number) => {
    setLoading(true);
    try {
      const result = await approvePullRequest(repoUrl, pullNumber);
      if (result.success) {
        toast.success(`PR #${pullNumber} одобрен`);
        handleGetOpenPRs();
      } else {
        toast.error("Ошибка при одобрении: " + result.error);
      }
    } catch (err) {
      toast.error("Ошибка при одобрении: " + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleClosePR = async (pullNumber: number) => {
    setLoading(true);
    try {
      const result = await closePullRequest(repoUrl, pullNumber);
      if (result.success) {
        toast.success(`PR #${pullNumber} закрыт`);
        handleGetOpenPRs();
      } else {
        toast.error("Ошибка при закрытии: " + result.error);
      }
    } catch (err) {
      toast.error("Ошибка при закрытии: " + (err as Error).message);
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

  const handleUpdatePackageJson = () => {
    if (!packageJsonInput || newModules.length === 0) return;
    try {
      const pkg = JSON.parse(packageJsonInput);
      newModules.forEach((mod) => (pkg.dependencies[mod] = "latest"));
      const updatedPkgJson = JSON.stringify(pkg, null, 2);
      setFiles((prev) => [
        ...prev.filter((f) => f.path !== "package.json"),
        { path: "package.json", content: updatedPkgJson, extension: "json" },
      ]);
      setSelectedFiles((prev) => new Set(prev).add("package.json"));
      toast.success("package.json обновлен и добавлен в файлы!");
    } catch (err) {
      toast.error("Ошибка при обработке package.json: " + (err as Error).message);
    }
  };

  const handleRemoveSavedFile = async (path: string) => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: existingData } = await supabaseAdmin
        .from("users")
        .select("metadata")
        .eq("user_id", user.id)
        .single();
      const updatedFiles = (existingData?.metadata?.generated_files || []).filter((f: any) => f.path !== path);
      await supabaseAdmin
        .from("users")
        .upsert({ user_id: user.id, metadata: { ...existingData?.metadata, generated_files: updatedFiles } });
      setSavedFiles(updatedFiles.map((f: any) => ({ path: f.path, content: f.code, extension: f.extension })));
      toast.success(`Файл "${path}" удален!`);
    } catch (err) {
      toast.error("Ошибка при удалении файла: " + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const setCustomLinkHandler = () => {
    const link = prompt("Введите вашу пользовательскую ссылку:");
    if (link) {
      saveCustomLink(link);
    }
  };

  const saveCustomLink = async (link: string) => {
    if (!user) return;
    try {
      const { data: existingData } = await supabaseAdmin
        .from("users")
        .select("metadata")
        .eq("user_id", user.id)
        .single();
      const updatedMetadata = { ...existingData?.metadata, customLink: link };
      await supabaseAdmin
        .from("users")
        .upsert({ user_id: user.id, metadata: updatedMetadata });
      setCustomLink(link);
      toast.success("Пользовательская ссылка сохранена!");
    } catch (err) {
      toast.error("Ошибка при сохранении пользовательской ссылки: " + (err as Error).message);
    }
  };

  return (
    <div className="p-4 bg-gray-900 text-white min-h-screen font-sans">
      <header className="flex items-center gap-2 mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Coze Executor</h1>
        <Tooltip
          text={`Станьте PROграммистом:\n1) Используйте @oneSitePlsBot или @webanybot для анализа задач.\n2) Вставьте описание задачи здесь или в любого бота.\n3) Разберите файлы из ответа.\n4) Создайте и одобрите PR.\n5) Готово — вы PRO!`}
        >
          <FaInfoCircle className="text-blue-400 cursor-pointer hover:text-blue-300 transition" />
        </Tooltip>
      </header>

      <section className="mb-6 text-gray-300 text-sm">
        <p>1. Введите запрос или вставьте ответ бота.</p>
        <p>2. Разберите файлы из ответа.</p>
        <p>3. Выберите файлы и создайте PR.</p>
        <p>4. Одобрите или очистите по необходимости.</p>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block mb-2 font-medium">Запрос</label>
          <textarea
            className="w-full h-32 p-3 bg-gray-800 rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none transition"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Введите запрос для агента Coze..."
          />
        </div>
        <div>
          <div className="flex items-center gap-2 mb-2">
            <label className="block font-medium">Ответ</label>
            <button
              className="bg-gray-700 px-2 py-1 rounded text-xs hover:bg-gray-600 transition"
              onClick={() => setIsResponseCollapsed(!isResponseCollapsed)}
            >
              {isResponseCollapsed ? "Развернуть" : "Свернуть"}
            </button>
          </div>
          {!isResponseCollapsed && (
            <textarea
              className="w-full h-32 p-3 bg-gray-800 rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none transition"
              value={response}
              onChange={(e) => setResponse(e.target.value)}
              placeholder="Вставьте или отредактируйте ответ от любого бота здесь..."
            />
          )}
        </div>
      </section>

      <section className="flex flex-wrap gap-3 mb-6">
        <button
          className="bg-blue-600 px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-500 transition flex-1 min-w-[120px]"
          onClick={handleExecute}
          disabled={loading}
        >
          {loading ? "Выполняется..." : "Запустить агента"}
        </button>
        <button
          className="bg-yellow-600 px-4 py-2 rounded-lg hover:bg-yellow-700 disabled:bg-gray-500 transition flex-1 min-w-[120px]"
          onClick={handleParse}
          disabled={loading || !response}
        >
          Разобрать файлы
        </button>
        <button
          className="bg-green-600 px-4 py-2 rounded-lg hover:bg-green-700 disabled:bg-gray-500 transition flex-1 min-w-[120px]"
          onClick={handleSaveFiles}
          disabled={loading || files.length === 0}
        >
          Сохранить файлы
        </button>
        <button
          className="bg-purple-600 px-4 py-2 rounded-lg hover:bg-purple-700 disabled:bg-gray-500 transition flex-1 min-w-[120px]"
          onClick={handleDownload}
          disabled={loading || files.length === 0}
        >
          Скачать ZIP
        </button>
      </section>

      <section className="mb-6">
  <a
    href="https://grok.com"
    target="_blank"
    rel="noopener noreferrer"
    className="flex items-center justify-center gap-2 p-4 bg-gray-800 rounded hover:bg-gray-700 transition mb-3"
  >
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" className="w-8 h-8 text-cyan-400">
      <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="5"/>
      <circle cx="35" cy="40" r="5" fill="currentColor"/>
      <circle cx="65" cy="40" r="5" fill="currentColor"/>
      <rect x="30" y="60" width="40" height="10" fill="currentColor"/>
    </svg>
    <span className="text-xl font-bold">Grok</span>
  </a>
  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
    <a
      href="https://chatgpt.com"
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 p-2 bg-gray-800 rounded hover:bg-gray-700 transition"
    >
      <FaRobot className="text-green-500 text-lg" />
      <span>ChatGPT</span>
    </a>
    <a
      href="https://qwenlm.ai"
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 p-2 bg-gray-800 rounded hover:bg-gray-700 transition"
    >
      <FaImage className="text-blue-500 text-lg" />
      <span>QwenLM</span>
    </a>
    <a
      href="https://notebooklm.google.com"
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 p-2 bg-gray-800 rounded hover:bg-gray-700 transition"
    >
      <FaBook className="text-yellow-500 text-lg" />
      <span>NotebookLM</span>
    </a>
    {customLink ? (
      <a
        href={customLink}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 p-2 bg-gray-800 rounded hover:bg-gray-700 transition"
      >
        <FaExternalLinkAlt className="text-purple-500 text-lg" />
        <span>Пользовательская ссылка</span>
      </a>
    ) : (
      <button
        onClick={setCustomLinkHandler}
        className="flex items-center gap-2 p-2 bg-gray-800 rounded hover:bg-gray-700 transition"
      >
        <FaPlus className="text-gray-400 text-lg" />
        <span>Добавить ссылку</span>
      </button>
    )}
  </div>
</section>

      {newModules.length > 0 && (
        <section className="mb-6 bg-gray-800 p-4 rounded-lg">
          <h2 className="text-lg font-semibold text-yellow-400 mb-2">Обнаружены новые модули</h2>
          <p className="text-sm mb-2">Требуются: {newModules.join(", ")}</p>
          <div className="flex items-center gap-2">
            <textarea
              className="w-16 h-6 p-1 bg-gray-700 rounded text-xs resize-none"
              value={packageJsonInput}
              onChange={(e) => setPackageJsonInput(e.target.value)}
              placeholder="Вставьте package.json"
            />
            <button
              className="bg-orange-600 px-2 py-1 rounded hover:bg-orange-700 disabled:bg-gray-500 transition"
              onClick={handleUpdatePackageJson}
              disabled={!packageJsonInput || loading}
            >
              Обновить
            </button>
          </div>
        </section>
      )}

      {files.length > 0 && (
        <section className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-lg font-semibold">Сгенерированные файлы</h2>
            <button
              className="bg-indigo-600 px-2 py-1 rounded hover:bg-indigo-700 disabled:bg-gray-500 transition"
              onClick={handleSelectAllFiles}
              disabled={loading}
            >
              Выбрать все
            </button>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {files.map((file) => (
              <div
                key={file.path}
                className="bg-gray-800 p-2 rounded flex justify-between items-center hover:bg-gray-700 transition"
              >
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedFiles.has(file.path)}
                    onChange={() => toggleFileSelection(file.path)}
                  />
                  <span className="truncate text-sm">{file.path}</span>
                </label>
                <button
                  className="bg-purple-600 p-1 rounded hover:bg-purple-700 disabled:bg-gray-500 transition"
                  onClick={() => downloadFile(file)}
                  disabled={loading}
                >
                  <FaTelegramPlane />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mb-6">
        <h2 className="text-lg font-semibold mb-2">Создать GitHub PR</h2>
        <input
          className="w-full p-2 mb-2 bg-gray-800 rounded border border-gray-700 focus:border-blue-500 transition"
          value={repoUrl}
          onChange={(e) => setRepoUrl(e.target.value)}
          placeholder="URL репозитория GitHub"
        />
        <input
          className="w-full p-2 mb-2 bg-gray-800 rounded border border-gray-700 focus:border-blue-500 transition"
          value={prTitle}
          onChange={(e) => setPrTitle(e.target.value)}
          placeholder="Заголовок PR"
        />
        <textarea
          className="w-full p-2 mb-2 bg-gray-800 rounded border border-gray-700 focus:border-blue-500 transition"
          value={prDescription}
          onChange={(e) => setPrDescription(e.target.value)}
          placeholder="Описание PR"
          rows={2}
        />
        <textarea
          className="w-full p-2 mb-2 bg-gray-800 rounded border border-gray-700 focus:border-blue-500 transition"
          value={commitMessage}
          onChange={(e) => setCommitMessage(e.target.value)}
          placeholder="Сообщение коммита (автоматически заполнено из ответа)"
          rows={3}
        />
        <div className="flex gap-2">
  <button
    className="bg-gradient-to-r from-purple-600 to-cyan-500 text-white px-4 py-2 rounded shadow-glow hover:shadow-glow transition disabled:bg-gray-500 disabled:shadow-none"
    onClick={handleCreatePR}
    disabled={loading || !repoUrl || selectedFiles.size === 0 || !commitMessage}
  >
    Создать PR
  </button>
  <button
    className="bg-cyan-600 text-white px-4 py-2 rounded hover:bg-cyan-700 transition disabled:bg-gray-500"
    onClick={handleGetOpenPRs}
    disabled={loading || !repoUrl}
  >
    Список PR
  </button>
</div>
      </section>

      {openPRs.length > 0 && (
        <section className="mb-6">
          <h2 className="text-lg font-semibold mb-2">Открытые Pull Requests</h2>
          <ul className="space-y-2">
            {openPRs.map((pr) => (
              <li key={pr.number} className="flex items-center gap-2 bg-gray-800 p-2 rounded">
                <a href={pr.html_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                  #{pr.number}: {pr.title}
                </a>
                <button
                  className="bg-green-600 px-2 py-1 rounded hover:bg-green-700 disabled:bg-gray-500 transition"
                  onClick={() => handleApprovePR(pr.number)}
                  disabled={loading}
                >
                  Одобрить
                </button>
                <button
                  className="bg-red-600 px-2 py-1 rounded hover:bg-red-700 disabled:bg-gray-500 transition"
                  onClick={() => handleClosePR(pr.number)}
                  disabled={loading}
                >
                  Закрыть
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {savedFiles.length > 0 && (
        <section className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-lg font-semibold">Сохраненные файлы</h2>
            <button
              className="bg-red-600 px-2 py-1 rounded hover:bg-red-700 disabled:bg-gray-500 transition"
              onClick={handleClearAllSavedFiles}
              disabled={loading}
            >
              Очистить все
            </button>
          </div>
          <div className="space-y-2">
            {savedFiles.map((file) => (
              <div
                key={file.path}
                className="bg-gray-700 p-2 rounded flex justify-between items-center hover:bg-gray-600 transition"
              >
                <span className="truncate text-sm">{file.path}</span>
                <div className="flex gap-2">
                  <button
                    className="bg-purple-600 p-1 rounded hover:bg-purple-700 disabled:bg-gray-500 transition"
                    onClick={() => downloadFile(file)}
                    disabled={loading}
                  >
                    <FaTelegramPlane />
                  </button>
                  <button
                    className="bg-red-600 p-1 rounded hover:bg-red-700 disabled:bg-gray-500 transition"
                    onClick={() => handleRemoveSavedFile(file.path)}
                    disabled={loading}
                  >
                    <FaTrash />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
