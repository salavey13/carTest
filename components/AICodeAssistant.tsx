"use client";
import { useState } from "react";
import { createGitHubPullRequest } from "@/app/actions_github/actions";
import { notifyAdmin } from "@/app/actions";
import { useAppContext } from "@/contexts/AppContext";
import { toast } from "sonner";

interface FileEntry {
  path: string;
  content: string;
  extension: string;
}

export default function AICodeAssistant() {
  const [response, setResponse] = useState<string>("");
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [repoUrl, setRepoUrl] = useState<string>("https://github.com/salavey13/cartest");
  const [prTitle, setPrTitle] = useState<string>("");
  const [prDescription, setPrDescription] = useState<string>("");
  const [commitMessage, setCommitMessage] = useState<string>("");
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const { user } = useAppContext();

  const parseFilesFromText = (text: string): FileEntry[] => {
    const entries: FileEntry[] = [];
    const codeBlocks = text.match(/^```[\s\S]*?^```/gm) || [];
    codeBlocks.forEach((block) => {
      const content = block.slice(3, -3).trim();
      const lines = content.split("\n");
      let codeStartIndex = 0;
      let path: string | undefined;
      for (let i = 0; i < lines.length; i++) {
        const match = lines[i].match(/^\s*\/\/\s*\/?(.+?\.\w+)/);
        if (match) {
          path = match[1].trim();
          codeStartIndex = i + 1;
          break;
        }
      }
      if (!path) path = "unnamed.txt";
      const codeContent = lines.slice(codeStartIndex).join("\n");
      const extension = path.split(".").pop() || "txt";
      entries.push({ path, content: codeContent, extension });
    });
    return entries;
  };

  const handleParse = () => {
    const parsedFiles = parseFilesFromText(response);
    setFiles(parsedFiles);
    if (parsedFiles.length === 0) toast.info("No files found in response");
    const title = "Update from AI Assistant";
    const description = `Generated changes based on request:\n${response.split("\n")[0]}`;
    const commitMsg = "Automated changes from AI response";
    setPrTitle(title);
    setPrDescription(description);
    setCommitMessage(commitMsg);
  };

  const handleCreatePR = async () => {
    if (!repoUrl || !selectedFiles.size || !prTitle || !prDescription || !commitMessage) {
      toast.error("Please provide repo URL, select files, PR title, description, and commit message");
      return;
    }
    setLoading(true);
    try {
      const filesToCommit = files
        .filter((file) => selectedFiles.has(file.path))
        .map((file) => ({ path: file.path, content: file.content }));
      const username = user?.username || user?.id || "unknown";
      const enrichedPrDescription = `${prDescription}\n\nCreated by: ${username}\nFiles: ${Array.from(selectedFiles).join(", ")}`;
      const result = await createGitHubPullRequest(repoUrl, filesToCommit, prTitle, enrichedPrDescription);
      if (result.success) {
        toast.success(`PR created: ${result.prUrl}`);
        await notifyAdmin(`New PR by ${username}: ${result.prUrl}`);
        document.getElementById("pr-section")?.scrollIntoView({ behavior: "smooth" });
      } else {
        toast.error("Failed to create PR: " + result.error);
      }
    } catch (err) {
      toast.error("Error creating PR: " + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const toggleFileSelection = (path: string) => {
    setSelectedFiles((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(path)) newSet.delete(path);
      else newSet.add(path);
      return newSet;
    });
  };

  return (
    <div className="p-4 bg-gray-900 text-white min-h-screen font-sans">
      <h1 className="text-2xl font-bold mb-4">AI Code Assistant</h1>
      <textarea
        id="response-input"
        value={response}
        onChange={(e) => setResponse(e.target.value)}
        className="w-full p-2 bg-gray-800 rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-cyan-500"
        rows={5}
        placeholder="Paste Grok's response here..."
      />
      <button
        onClick={handleParse}
        className="mt-2 p-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition"
        disabled={loading || !response}
      >
        Parse Response
      </button>

      {files.length > 0 && (
        <div className="mt-6">
          <h2 className="text-lg font-semibold mb-2">Generated Files</h2>
          {files.map((file) => (
            <div key={file.path} className="mb-4 p-3 bg-gray-800 rounded-lg">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedFiles.has(file.path)}
                  onChange={() => toggleFileSelection(file.path)}
                  className="w-3 h-3 accent-cyan-500"
                />
                <span className="text-sm">{file.path}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <section id="pr-section" className="mt-6">
        <h2 className="text-lg font-semibold mb-2">Create GitHub PR</h2>
        <input
          type="text"
          value={repoUrl}
          onChange={(e) => setRepoUrl(e.target.value)}
          className="w-full p-2 mb-2 bg-gray-800 rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-cyan-500"
          placeholder="Repository URL"
        />
        <input
          type="text"
          value={prTitle}
          onChange={(e) => setPrTitle(e.target.value)}
          className="w-full p-2 mb-2 bg-gray-800 rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-cyan-500"
          placeholder="PR Title"
        />
        <textarea
          value={prDescription}
          onChange={(e) => setPrDescription(e.target.value)}
          className="w-full p-2 mb-2 bg-gray-800 rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-cyan-500"
          rows={3}
          placeholder="PR Description"
        />
        <input
          type="text"
          value={commitMessage}
          onChange={(e) => setCommitMessage(e.target.value)}
          className="w-full p-2 mb-2 bg-gray-800 rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-cyan-500"
          placeholder="Commit Message"
        />
        <button
          onClick={handleCreatePR}
          className="p-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition"
          disabled={loading}
        >
          {loading ? "Creating PR..." : "Create PR"}
        </button>
      </section>
    </div>
  );
}