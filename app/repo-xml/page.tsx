"use client"; // Client-side component for Next.js App Router

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

  // Fetch repo contents recursively
  const fetchRepoContents = async (owner: string, repo: string, path: string = "") => {
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
    const response = await axios.get(url, { headers: { Accept: "application/vnd.github.v3+json" } });
    const contents = response.data;

    const files: { path: string; content: string }[] = [];
    for (const item of contents) {
      if (item.type === "file") {
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
      setError("Failed to fetch repo. Double-check the URL (e.g., https://github.com/user/repo) and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-gray-50 rounded-lg shadow-lg pt-20">
      <h2 className="text-3xl font-bold text-gray-800 mb-4">Get Your Project’s XML</h2>
      <p className="text-gray-600 mb-6">
        Yo, newbie! Want to use a bot to help build your project? You need something called “XML”—it’s like a map of all your code files that bots can read. Drop a GitHub URL here (like the example), hit the button, and boom—you’ve got your XML to feed to a bot. No clue what you’re doing? Just use the default URL and see what happens!
      </p>
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <input
          type="text"
          value={repoUrl}
          onChange={(e) => setRepoUrl(e.target.value)}
          placeholder="Enter GitHub repo URL (e.g., https://github.com/user/repo)"
          className="flex-grow p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={handleFetch}
          disabled={loading}
          className={`px-6 py-3 rounded-lg text-white font-semibold ${
            loading ? "bg-gray-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
          } transition-colors`}
        >
          {loading ? "Fetching..." : "Grab XML"}
        </button>
      </div>
      {error && <p className="text-red-500 mb-4">{error}</p>}
      {xmlOutput && (
        <div className="bg-white p-4 rounded-lg shadow-inner">
          <h3 className="text-xl font-semibold text-gray-700 mb-2">Your XML Output</h3>
          <pre className="bg-gray-100 p-4 rounded-lg text-sm text-gray-800 overflow-auto max-h-96">
            {xmlOutput}
          </pre>
        </div>
      )}
      {/* Load fast-xml-parser from CDN */}
      <script src="https://unpkg.com/fast-xml-parser@4.2.7/dist/fxp.min.js" async></script>
    </div>
  );
};

// Page Component
export default function RepoXMLPage() {
  return (
    <div className="min-h-screen pt-20 bg-gray-100">
      <header className="fixed top-0 left-0 right-0 bg-white shadow-md p-4 z-10">
        <h1 className="text-2xl font-bold text-gray-800">XML Generator for Bot Devs</h1>
      </header>
      <main className="container mx-auto">
        <RepoXMLFetcher />
      </main>
    </div>
  );
}
