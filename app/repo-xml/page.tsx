"use client"; // Client-side for Next.js App Router

import React, { useState } from "react";
import axios from "axios";

// RepoXMLFetcher Component
const RepoXMLFetcher: React.FC = () => {
  const [repoUrl, setRepoUrl] = useState<string>("https://github.com/salavey13/cartest"); // Your repo as default
  const [xmlOutput, setXmlOutput] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Parse GitHub URL
  const parseRepoUrl = (url: string) => {
    const match = url.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (!match) throw new Error("Invalid GitHub URL");
    return { owner: match[1], repo: match[2] };
  };

  // Fetch repo contents recursively, filter .ts, .tsx, .css, .sql
  const fetchRepoContents = async (owner: string, repo: string, path: string = "") => {
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
    const response = await axios.get(url, { headers: { Accept: "application/vnd.github.v3+json" } });
    const contents = response.data;

    const files: { path: string; content: string }[] = [];
    const allowedExtensions = [".ts", ".tsx", ".css", ".sql"];

    for (const item of contents) {
      if (item.type === "file" && allowedExtensions.some((ext) => item.path.endsWith(ext))) {
        const contentResponse = await axios.get(item.download_url);
        files.push({ path: item.path, content: contentResponse.data });
      } else if (item.type === "dir") {
        const subFiles = await fetchRepoContents(owner, repo, item.path);
        files.push(...subFiles);
      }
    }
    return files;
  };

  // Generate XML using fast-xml-parser from CDN
  const generateXML = (files: { path: string; content: string }[]) => {
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

  // Handle form submission
  const handleFetch = async () => {
    setLoading(true);
    setError(null);
    setXmlOutput("");

    try {
      const { owner, repo } = parseRepoUrl(repoUrl);
      const files = await fetchRepoContents(owner, repo);
      const xml = generateXML(files);
      setXmlOutput(xml);
    } catch (err) {
      setError("Repo fetch failed. Check your URL (e.g., https://github.com/user/repo).");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-6 bg-card rounded-xl shadow-lg border border-muted">
      <h2 className="text-4xl font-bold cyber-text mb-4">XML Cyber-Extractor</h2>
      <p className="text-muted-foreground mb-6 text-lg">
        Новичок? Расслабься. Это берёт «XML» — карту кода для ботов, чтобы подзарядить твой проект. Вставь URL с GitHub (например, крутой стандартный), нажми кнопку и забери свой XML. Хватает только файлы .ts, .tsx, .css и .sql — всё чётко для твоих бот-хозяев. Для текущего проекта "carTest" это идеально впишется в процесс!
      </p>
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <input
          type="text"
          value={repoUrl}
          onChange={(e) => setRepoUrl(e.target.value)}
          placeholder="Drop GitHub URL (e.g., https://github.com/user/repo)"
          className="flex-grow p-3 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-glow"
        />
        <button
          onClick={handleFetch}
          disabled={loading}
          className={`px-6 py-3 rounded-lg font-semibold text-primary-foreground ${
            loading ? "bg-muted cursor-not-allowed" : "bg-primary hover:bg-secondary"
          } transition-colors text-glow`}
        >
          {loading ? "Hacking..." : "Extract XML"}
        </button>
      </div>
      {error && <p className="text-destructive mb-4">{error}</p>}
      {xmlOutput && (
        <div className="bg-popover p-4 rounded-lg shadow-inner border border-border">
          <h3 className="text-2xl font-semibold text-secondary mb-2 cyber-text">Your XML Payload</h3>
          <pre className="bg-card p-4 rounded-lg text-sm text-muted-foreground overflow-auto max-h-96">
            {xmlOutput}
          </pre>
        </div>
      )}
      {/* Load fast-xml-parser from CDN */}
      <script src="https://unpkg.com/axios/dist/axios.min.js" async></script>
      <script src="https://unpkg.com/fast-xml-parser@4.2.7/dist/fxp.min.js" async></script>
    </div>
  );
};

// Page Component
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
