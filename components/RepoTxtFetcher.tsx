"use client";
import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { fetchRepoContents } from "@/app/actions_github/actions";
import { toast } from "sonner";
import { useAppContext } from "@/contexts/AppContext";
import { FaFileAlt, FaClipboard } from "react-icons/fa";

interface FileNode {
  path: string;
  content: string;
}

interface RepoTxtFetcherProps {
  highlightedPath: string;
  autoFetch: boolean;
}

const RepoTxtFetcher: React.FC<RepoTxtFetcherProps> = ({ highlightedPath, autoFetch }) => {
  const [repoUrl, setRepoUrl] = useState<string>("https://github.com/salavey13/cartest");
  const [token, setToken] = useState<string>("");
  const [files, setFiles] = useState<FileNode[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [extractLoading, setExtractLoading] = useState<boolean>(false);
  const [kworkInput, setKworkInput] = useState<string>("");
  const [lastAction, setLastAction] = useState<string | null>(null);
  const { user } = useAppContext();

  const addToast = (message: string) => {
    toast(message, { style: { background: "rgba(34, 34, 34, 0.8)", color: "#00ff9d" } });
  };

  const handleFetch = async () => {
    setExtractLoading(true);
    setFiles([]);
    setSelectedFiles(new Set());
    addToast("Fetching files...");

    try {
      const result = await fetchRepoContents(repoUrl, token || undefined);
      if (!result.success) throw new Error(result.error || "Failed to fetch repository contents");

      setFiles(result.files);
      addToast("Files fetched! Select a file to add to context.");
      if (highlightedPath) {
        setTimeout(() => {
          const fileElement = document.getElementById(`file-${highlightedPath}`);
          if (fileElement) fileElement.scrollIntoView({ behavior: "smooth" });
        }, 100);
      }
    } catch (err: any) {
      addToast(`Error: ${err.message}`);
    } finally {
      setExtractLoading(false);
      setLastAction("fetch");
    }
  };

  useEffect(() => {
    if (autoFetch) {
      handleFetch();
      setTimeout(() => document.getElementById("kwork-input")?.scrollIntoView({ behavior: "smooth" }), 100);
      setKworkInput("Enter what you want to change...");
      setLastAction("auto_fetch");
    }
  }, [autoFetch]);

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
      addToast("Select at least one file!");
      return;
    }
    const markdownTxt = files
      .filter((file) => selectedFiles.has(file.path))
      .map((file) => `**${file.path}**\n\`\`\`\n${file.content}\n\`\`\``)
      .join("\n\n");
    setKworkInput((prev) => `${prev}\n\nSelected files:\n${markdownTxt}`);
    addToast("Press this when you're done writing!");
    setLastAction("add_selected");
    setTimeout(() => document.getElementById("kwork-input")?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  const handleCopyToClipboard = () => {
    if (!kworkInput.trim()) {
      addToast("Nothing to copy!");
      return;
    }
    navigator.clipboard.writeText(kworkInput);
    addToast("Copied! Go ask Grok, paste the response below, and don’t forget the chat link!");
    setLastAction("copy");
    setTimeout(() => document.getElementById("response-input")?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  const getXuinityMessage = () => {
    switch (lastAction) {
      case "auto_fetch":
        return "Enter what you want to change!";
      case "fetch":
        return "Select a file to add to context!";
      case "add_selected":
        return "Press 'Add Selected' when you're done!";
      case "copy":
        return "Go ask Grok, paste the response below!";
      default:
        return "Yo, need help?";
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

  return (
    <div className="w-full p-4 bg-gray-900 text-white font-mono rounded-xl shadow-[0_0_15px_rgba(0,255,157,0.3)] relative overflow-hidden">
      <h2 className="text-2xl font-bold text-cyan-400 mb-4">Code Extractor</h2>
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Repository URL</label>
        <input
          type="text"
          value={repoUrl}
          onChange={(e) => setRepoUrl(e.target.value)}
          className="w-full p-2 bg-gray-800 rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-cyan-500"
          placeholder="https://github.com/username/repository"
        />
      </div>
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">GitHub Token (optional)</label>
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          className="w-full p-2 bg-gray-800 rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-cyan-500"
          placeholder="Enter your GitHub token"
        />
      </div>
      <button
        onClick={handleFetch}
        className="mb-4 p-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition"
        disabled={extractLoading}
      >
        {extractLoading ? "Fetching..." : "Fetch Files"}
      </button>

      {files.length > 0 && (
        <div className="mb-6 bg-gray-800 p-4 rounded-xl shadow-[0_0_12px_rgba(0,255,157,0.3)]">
          <h3 className="text-xl font-bold text-cyan-400 mb-3">File Console</h3>
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
                          file.path === highlightedPath
                            ? "text-yellow-400 font-bold animate-pulse"
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
          <button
            onClick={handleAddSelected}
            className="mt-4 p-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition"
          >
            Add Selected Files
          </button>
        </div>
      )}

      <div className="mb-4">
        <label htmlFor="kwork-input" className="block text-sm font-medium mb-1">Request Input</label>
        <textarea
          id="kwork-input"
          value={kworkInput}
          onChange={(e) => setKworkInput(e.target.value)}
          className="w-full p-2 bg-gray-800 rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-cyan-500"
          rows={5}
          placeholder="Enter your request here..."
        />
        <button
          onClick={handleCopyToClipboard}
          className="mt-2 p-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition flex items-center gap-1"
        >
          <FaClipboard /> Copy to Clipboard
        </button>
      </div>

      <div className="fixed bottom-4 right-4 bg-gray-700 p-2 rounded-lg shadow-lg">
        <p className="text-sm text-white">{getXuinityMessage()}</p>
      </div>
    </div>
  );
};

export default RepoTxtFetcher;