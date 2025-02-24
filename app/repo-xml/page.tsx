"use client"; // Add this if using Next.js App Router to make it a Client Component

import React, { useState } from "react";
import axios from "axios";

// Define the component
const RepoXMLFetcher: React.FC = () => {
  const [repoUrl, setRepoUrl] = useState<string>("");
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
    const response = await axios.get(url, {
      headers: { Accept: "application/vnd.github.v3+json" },
    });
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
    // Access fast-xml-parser from window object (loaded via CDN)
    const { XMLBuilder } = (window as any)["fast-xml-parser"];
    const builder = new XMLBuilder({ ignoreAttributes: false, format: true });
    const xmlObj = {
      repository: {
        files: files.map((file) => ({
          file: {
            "@_path": file.path,
            content: file.content,
          },
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
      setError("Failed to fetch repository contents. Check the URL and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>Get Repository XML</h2>
      <input
        type="text"
        value={repoUrl}
        onChange={(e) => setRepoUrl(e.target.value)}
        placeholder="Enter GitHub repo URL (e.g., https://github.com/owner/repo)"
        style={{ width: "300px", marginRight: "10px" }}
      />
      <button onClick={handleFetch} disabled={loading}>
        {loading ? "Fetching..." : "Fetch XML"}
      </button>
      {error && <p style={{ color: "red" }}>{error}</p>}
      {xmlOutput && (
        <pre style={{ background: "#f4f4f4", padding: "10px", maxHeight: "500px", overflow: "auto" }}>
          {xmlOutput}
        </pre>
      )}
      {/* Load fast-xml-parser from CDN */}
      <script src="https://unpkg.com/fast-xml-parser@4.2.7/dist/fxp.min.js" async></script>
    </div>
  );
};

// Page component
export default function RepoXMLPage() {
  return (
    <div>
      <h1>Repository XML Generator</h1>
      <RepoXMLFetcher />
    </div>
  );
}
