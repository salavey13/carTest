// components/CozeExecutor.tsx
"use client";
import { useState, useEffect } from "react";
import { executeCozeAgent } from "@/app/actions";
import { supabaseAdmin } from "@/hooks/supabase";
import { useTelegram } from "@/hooks/useTelegram";
import { saveAs } from "file-saver";
import { Light as SyntaxHighlighter } from "react-syntax-highlighter";
import { docco } from "react-syntax-highlighter/dist/esm/styles/hljs";

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
  response: string;
  metadata: any;
  created_at: string;
}

export default function CozeExecutor({
  botId = "7483269209293275191",
  userId = "341503612082",
}: {
  botId?: string;
  userId?: string;
}) {
  const [response, setResponse] = useState<string>("");
  const [content, setContent] = useState<string>("Generate code components");
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [savedFiles, setSavedFiles] = useState<FileEntry[]>([]);
  const [cozeResponses, setCozeResponses] = useState<CozeResponse[]>([]);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const { user } = useTelegram();

  // Load initial data from Supabase
  useEffect(() => {
    const loadData = async () => {
      if (!user) return;
      try {
        // Fetch saved files from user metadata
        const { data: userData } = await supabaseAdmin
          .from("users")
          .select("metadata")
          .eq("id", user.id)
          .single();
        if (userData?.metadata?.generated_files) {
          setSavedFiles(parseFilesFromText(JSON.stringify(userData.metadata.generated_files)));
        }

        // Fetch Coze responses
        const { data: responses } = await supabaseAdmin
          .from("coze_responses")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });
        setCozeResponses(responses || []);
      } catch (err) {
        setError("Failed to load data");
      }
    };
    loadData();
  }, [user]);

  // Parse files from text response
  const parseFilesFromText = (text: string): FileEntry[] => {
    const entries: FileEntry[] = [];
    try {
      const codeBlocks = text.match(/```[\s\S]*?```/g) || [];
      codeBlocks.forEach((block) => {
        const content = block.slice(3, -3).trim();
        const lines = content.split("\n");
        const firstLine = lines[0];
        const languageMatch = firstLine.match(/^([a-z]+)$/i); // e.g., "typescript"
        const codeStartIndex = languageMatch ? 1 : 0;
        const codeContent = lines.slice(codeStartIndex).join("\n");

        // Extract file path from comments like "// File: path/to/file.tsx"
        const fileMatch = codeContent.match(/\/\/\s*File:\s*(.+)/i);
        if (fileMatch) {
          const path = fileMatch[1].trim();
          entries.push({
            path,
            content: codeContent,
            extension: path.split(".").pop() || "txt",
          });
        }
      });
    } catch (err) {
      setError("Error parsing files from text");
    }
    return entries;
  };

  // Handle execution of the Coze agent
  const handleExecute = async () => {
    setLoading(true);
    setError("");
    setResponse("");
    setFiles([]);
    try {
      const result = await executeCozeAgent(botId, userId, content, {
        operation: "code_generation",
      });
      if (result.success) {
        setResponse(result.data);
        const parsedFiles = parseFilesFromText(result.data);
        setFiles(parsedFiles);

        // Refresh the responses table
        const { data: responses } = await supabaseAdmin
          .from("coze_responses")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });
        setCozeResponses(responses || []);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError("Execution failed: " + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // Save parsed files to user's metadata
  const handleSaveFiles = async () => {
    if (!user || files.length === 0) return;
    setLoading(true);
    try {
      const fileData = files.map((file) => ({
        path: file.path,
        code: file.content,
        extension: file.extension,
      }));

      const { error } = await supabaseAdmin
        .from("users")
        .update({
          metadata: {
            generated_files: fileData,
          },
        })
        .eq("id", user.id);

      if (error) throw error;

      setSavedFiles(files);
      setError("Files saved successfully!");
    } catch (err) {
      setError("Failed to save files: " + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // Download a file
  const downloadFile = (file: FileEntry) => {
    const blob = new Blob([file.content], { type: "text/plain" });
    saveAs(blob, file.path.split("/").pop() || "file");
  };

  // Render response with syntax highlighting
  const renderResponse = (text: string) => {
    if (!text) return null;
    const parts = text.split(/(```[\s\S]*?```)/g);
    return parts.map((part, index) => {
      if (part.startsWith("```") && part.endsWith("```")) {
        const code = part.slice(3, -3).trim();
        const firstLine = code.split("\n")[0];
        const languageMatch = firstLine.match(/^([a-z]+)$/i);
        const language = languageMatch ? languageMatch[1] : "text";
        const codeContent = languageMatch ? code.split("\n").slice(1).join("\n") : code;
        return (
          <SyntaxHighlighter key={index} language={language} style={docco}>
            {codeContent}
          </SyntaxHighlighter>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  return (
    <div className="p-2 sm:p-4 bg-gray-900 text-white text-xs sm:text-sm">
      {/* Content Input */}
      <div className="mb-4">
        <label className="block mb-2">Query for Coze Agent</label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="w-full h-24 p-2 bg-gray-800 text-white rounded"
          placeholder="Enter your query here..."
        />
      </div>

      {/* Buttons */}
      <div className="mb-4 flex gap-2">
        <button
          onClick={handleExecute}
          disabled={loading}
          className="bg-blue-500 p-2 rounded flex-1 sm:flex-none hover:bg-blue-600"
        >
          {loading ? "Running..." : "Run Agent"}
        </button>
        <button
          onClick={handleSaveFiles}
          disabled={loading || files.length === 0}
          className="bg-green-500 p-2 rounded flex-1 sm:flex-none hover:bg-green-600"
        >
          Save Files
        </button>
        <button
          onClick={() => {
            setResponse("");
            setContent("");
            setFiles([]);
          }}
          className="bg-gray-500 p-2 rounded flex-1 sm:flex-none hover:bg-gray-600"
        >
          Clear
        </button>
      </div>

      {/* Error/Success Display */}
      {error && (
        <div
          className={`mb-4 ${
            error.includes("successfully") ? "text-green-500" : "text-red-500"
          }`}
        >
          {error}
        </div>
      )}

      {/* Text Response */}
      {response && (
        <div className="mb-4">
          <h3 className="text-base font-bold mb-2">Response</h3>
          <div className="w-full h-64 p-2 bg-gray-800 text-white overflow-auto rounded">
            {renderResponse(response)}
          </div>
        </div>
      )}

      {/* Parsed Files */}
      {files.length > 0 && (
        <div className="mb-4">
          <h3 className="text-base font-bold mb-2">Parsed Files</h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {files.map((file, index) => (
              <div key={index} className="bg-gray-800 p-2 rounded">
                <div className="flex justify-between items-center">
                  <span className="truncate">{file.path}</span>
                  <button
                    onClick={() => downloadFile(file)}
                    className="bg-purple-500 p-1 rounded ml-2 hover:bg-purple-600"
                  >
                    Download
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Coze Responses Table */}
      <div className="mt-6">
        <h3 className="text-base font-bold mb-2">Previous Responses</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="bg-gray-800">
                <th className="p-2">ID</th>
                <th className="p-2">Bot ID</th>
                <th className="p-2">Content</th>
                <th className="p-2">Response</th>
                <th className="p-2">Created At</th>
              </tr>
            </thead>
            <tbody>
              {cozeResponses.length > 0 ? (
                cozeResponses.map((resp) => (
                  <tr key={resp.id} className="border-b border-gray-700">
                    <td className="p-2">{resp.id.slice(0, 8)}...</td>
                    <td className="p-2">{resp.bot_id}</td>
                    <td className="p-2">{resp.content.slice(0, 30)}...</td>
                    <td className="p-2">{resp.response.slice(0, 30)}...</td>
                    <td className="p-2">{new Date(resp.created_at).toLocaleString()}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="p-2 text-center text-gray-400">
                    No responses yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Saved Files */}
      {savedFiles.length > 0 && (
        <div className="mt-6">
          <h3 className="text-base font-bold mb-2">Saved Files</h3>
          <div className="space-y-2">
            {savedFiles.map((file, index) => (
              <div key={index} className="bg-gray-700 p-2 rounded">
                <div className="flex justify-between items-center">
                  <span className="truncate">{file.path}</span>
                  <button
                    onClick={() => downloadFile(file)}
                    className="bg-purple-500 p-1 rounded ml-2 hover:bg-purple-600"
                  >
                    Download
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
