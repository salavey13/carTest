"use client"; // Client-side for Next.js App Router

import React, { useState } from "react";
import axios from "axios";
import { motion } from "framer-motion";

interface FileNode {
  path: string;
  content: string;
}

const RepoXMLFetcher: React.FC = () => {
  const [repoUrl, setRepoUrl] = useState<string>("https://github.com/salavey13/cartest");
  const [xmlOutput, setXmlOutput] = useState<string>("");
  const [selectedOutput, setSelectedOutput] = useState<string>("");
  const [files, setFiles] = useState<FileNode[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<{ id: number; message: string }[]>([]);

  // Add toast
  const addToast = (message: string) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
  };

  // Parse GitHub URL
  const parseRepoUrl = (url: string) => {
    const match = url.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (!match) throw new Error("Invalid GitHub URL");
    return { owner: match[1], repo: match[2] };
  };

  // Fetch repo contents with progress
  const fetchRepoContents = async (owner: string, repo: string, path: string = "") => {
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
    const response = await axios.get(url, { headers: { Accept: "application/vnd.github.v3+json" } });
    const contents = response.data;

    const files: FileNode[] = [];
    const allowedExtensions = [".ts", ".tsx", ".css", ".sql"];
    let total = contents.length;
    let processed = 0;

    for (const item of contents) {
      processed++;
      setProgress((processed / total) * 100);

      if (item.type === "file" && allowedExtensions.some((ext) => item.path.endsWith(ext))) {
        addToast(`Scanning ${item.path}...`);
        const contentResponse = await axios.get(item.download_url);
        files.push({ path: item.path, content: contentResponse.data });
      } else if (item.type === "dir") {
        const subFiles = await fetchRepoContents(owner, repo, item.path);
        files.push(...subFiles);
      }
    }
    return files;
  };

  // Generate XML
  const generateXML = (files: FileNode[]) => {
    const { XMLBuilder } = (window as any)["fast-xml-parser"];
    const builder = new XMLBuilder({ ignoreAttributes: false, format: true });
    const xmlObj = {
      repository: {
        files: files.map((file) => ({
          file: { "@_path": file.path, content: file.content },
        })),
      },
    };
    return builder.build(xmlObj);
  };

  // Generate Markdown for selected files
  const generateSelectedMarkdown = (files: FileNode[]) => {
    return files
      .filter((file) => selectedFiles.has(file.path))
      .map((file) => `\`\`\`\n${file.path}\n${file.content}\n\`\`\``)
      .join("\n\n");
  };

  // Handle fetch
  const handleFetch = async () => {
    setLoading(true);
    setError(null);
    setXmlOutput("");
    setSelectedOutput("");
    setFiles([]);
    setSelectedFiles(new Set());
    setProgress(0);
    addToast("Initiating cyber-extraction...");

    try {
      const { owner, repo } = parseRepoUrl(repoUrl);
      const fetchedFiles = await fetchRepoContents(owner, repo);
      setFiles(fetchedFiles);
      const xml = generateXML(fetchedFiles);
      setXmlOutput(xml);
      addToast("Extraction complete. XML ready!");
    } catch (err) {
      setError("Repo fetch failed. Check your URL (e.g., https://github.com/user/repo).");
      addToast("Error: Extraction aborted!");
    } finally {
      setLoading(false);
      setProgress(100);
    }
  };

  // Handle file selection
  const toggleFileSelection = (path: string) => {
    const newSelected = new Set(selectedFiles);
    if (newSelected.has(path)) newSelected.delete(path);
    else newSelected.add(path);
    setSelectedFiles(newSelected);
    setSelectedOutput(generateSelectedMarkdown(files));
  };

  return (
    <div className="max-w-5xl mx-auto p-6 bg-card rounded-xl shadow-lg border border-muted">
      <h2 className="text-4xl font-bold cyber-text mb-4">XML Cyber-Extractor</h2>
      <p className="text-muted-foreground mb-6 text-lg font-mono">
        Newbie? Relax. This rips “XML”—a code blueprint for bots to turbocharge your project. Drop a GitHub URL, smash the button, and grab your XML. Filters to .ts, .tsx, .css, .sql—lean and mean for bot domination.
      </p>
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <input
          type="text"
          value={repoUrl}
          onChange={(e) => setRepoUrl(e.target.value)}
          placeholder="Drop GitHub URL (e.g., https://github.com/user/repo)"
          className="flex-grow p-3 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-glow font-mono"
        />
        <button
          onClick={handleFetch}
          disabled={loading}
          className={`px-6 py-3 rounded-lg font-semibold text-primary-foreground ${
            loading ? "bg-muted cursor-not-allowed" : "bg-primary hover:bg-secondary"
          } transition-colors text-glow font-mono`}
        >
          {loading ? "Hacking..." : "Extract XML"}
        </button>
      </div>

      {/* Progress Bar */}
      {loading && (
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          className="h-2 bg-primary rounded-full mb-6 shadow-[0_0_10px_rgba(255,107,107,0.8)]"
        />
      )}

      {error && <p className="text-destructive mb-4 font-mono">{error}</p>}

      {/* File Tree with Checkboxes */}
      {files.length > 0 && (
        <div className="mb-6 bg-popover p-4 rounded-lg shadow-inner border border-border">
          <h3 className="text-2xl font-semibold text-secondary mb-2 cyber-text">File Tree</h3>
          <ul className="space-y-2">
            {files.map((file) => (
              <li key={file.path} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedFiles.has(file.path)}
                  onChange={() => toggleFileSelection(file.path)}
                  className="w-4 h-4 accent-primary"
                />
                <span className="text-muted-foreground font-mono text-sm hover:text-foreground transition-colors">
                  {file.path}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* XML Output */}
      {xmlOutput && (
        <div className="mb-6 bg-popover p-4 rounded-lg shadow-inner border border-border">
          <h3 className="text-2xl font-semibold text-secondary mb-2 cyber-text">Full XML Payload</h3>
          <pre className="bg-card p-4 rounded-lg text-sm text-muted-foreground overflow-auto max-h-96 font-mono">
            {xmlOutput}
          </pre>
        </div>
      )}

      {/* Selected Files Markdown */}
      {selectedOutput && (
        <div className="bg-popover p-4 rounded-lg shadow-inner border border-border">
          <h3 className="text-2xl font-semibold text-secondary mb-2 cyber-text">Selected Files (Markdown)</h3>
          <textarea
            value={selectedOutput}
            readOnly
            className="w-full h-64 bg-card p-4 rounded-lg text-sm text-muted-foreground font-mono border border-muted resize-none"
            placeholder="Select files to see their contents here..."
          />
        </div>
      )}

      {/* Toasts */}
      <div className="fixed bottom-4 right-4 space-y-2 z-50">
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 50 }}
            className="bg-primary text-primary-foreground p-3 rounded-lg shadow-[0_0_10px_rgba(255,107,107,0.5)] font-mono text-sm"
          >
            {toast.message}
          </motion.div>
        ))}
      </div>

      {/* CDN Scripts */}
      <script src="https://unpkg.com/axios/dist/axios.min.js" async></script>
      <script src="https://unpkg.com/fast-xml-parser@4.2.7/dist/fxp.min.js" async></script>
    </div>
  );
};

export default function RepoXMLPage() {
  return (
    <div className="min-h-screen pt-24 bg-background bg-grid-pattern">
      <header className="fixed top-0 left-0 right-0 bg-card shadow-md p-4 z-10 border-b border-muted">
        <h1 className="text-3xl font-bold text-gradient cyber-text">Cyber XML Generator</h1>
      </header>
      <main className="container mx-auto">
        <RepoXMLFetcher />
      </main>
    </div>
  );
}
