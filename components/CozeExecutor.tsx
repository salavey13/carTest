// components/CozeExecutor.tsx
"use client";
import { useState, useEffect } from "react";
import { executeCozeAgent } from "@/app/actions";
import { supabaseAdmin } from "@/hooks/supabase";
import { useTelegram } from "@/hooks/useTelegram";
import { saveAs } from "file-saver";

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

export default function CozeExecutor({
  botId = "7483269209293275191",
  userId = "341503612082",
}: {
  botId?: string;
  userId?: string;
}) {
  // State Definitions
  const [response, setResponse] = useState<any>(null);
  const [content, setContent] = useState<string>("Generate code components");
  const [jsonInput, setJsonInput] = useState<string>("");
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
          setSavedFiles(parseFilesFromJson(userData.metadata.generated_files));
          setJsonInput(
            JSON.stringify(userData.metadata.generated_files, null, 2)
          );
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

  // Parse JSON to extract file entries
  const parseFilesFromJson = (json: any): FileEntry[] => {
    const entries: FileEntry[] = [];
    try {
      json.new_components?.forEach((c: any) => {
        const match = c.code.match(/\/\/ File: (.+)\n/);
        if (match) {
          entries.push({
            path: match[1],
            content: c.code,
            extension: match[1].split(".").pop() || "tsx",
          });
        }
      });

      json.new_pages?.forEach((p: any) => {
        entries.push({
          path: p.route,
          content: p.code,
          extension: p.route.split(".").pop() || "tsx",
        });
      });

      json.new_actions?.forEach((a: any) => {
        entries.push({
          path: `app/actions/${a.name}.ts`,
          content: a.code,
          extension: "ts",
        });
      });

      json.supabase_migrations?.forEach((m: any) => {
        entries.push({
          path: `supabase/migrations/${m.name}.sql`,
          content: m.sql,
          extension: "sql",
        });
      });
    } catch (err) {
      setError("Error parsing files");
    }
    return entries;
  };

  // Handle execution of Coze agent
  const handleExecute = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await executeCozeAgent(botId, userId, content, {
        operation: "code_generation",
      });
      setResponse(result);
      setJsonInput(JSON.stringify(result, null, 2));
      setFiles(parseFilesFromJson(result));

      // Refetch Coze responses to include the latest one
      if (user) {
        const { data: responses } = await supabaseAdmin
          .from("coze_responses")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });
        setCozeResponses(responses || []);
      }
    } catch (err) {
      setError("Execution failed: " + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // Handle re-parsing of JSON input
  const handleParse = () => {
    try {
      const parsed = JSON.parse(jsonInput);
      setFiles(parseFilesFromJson(parsed));
      setError("");
    } catch (err) {
      setError("Invalid JSON format");
    }
  };

  // Download a file
  const downloadFile = (file: FileEntry) => {
    const blob = new Blob([file.content], { type: "text/plain" });
    saveAs(blob, file.path.split("/").pop() || "file");
  };

  // JSX Rendering
  return (
    <div className="p-2 sm:p-4 bg-gray-900 text-white text-xs sm:text-sm">
      {/* Content Input */}
      <div className="mb-4">
        <label className="block mb-2">Query for Coze Agent</label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="w-full h-24 p-2 bg-gray-800 text-white"
          placeholder="Enter your query here..."
        />
      </div>

      {/* Buttons */}
      <div className="mb-4 flex gap-2">
        <button
          onClick={handleExecute}
          disabled={loading}
          className="bg-blue-500 p-2 rounded flex-1 sm:flex-none"
        >
          {loading ? "Running..." : "Run Agent"}
        </button>
        <button
          onClick={handleParse}
          className="bg-green-500 p-2 rounded flex-1 sm:flex-none"
        >
          Re-parse JSON
        </button>
      </div>

      {/* Error Display */}
      {error && <div className="text-red-500 mb-4">{error}</div>}

      {/* JSON Response and Parsed Files Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {/* JSON Response */}
        <div>
          <h3 className="text-base font-bold mb-2">JSON Response</h3>
          <textarea
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
            className="w-full h-64 bg-gray-800 p-2 text-white"
          />
        </div>

        {/* Parsed Files */}
        <div>
          <h3 className="text-base font-bold mb-2">Parsed Files</h3>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {files.map((file, index) => (
              <div key={index} className="bg-gray-800 p-2 rounded">
                <div className="flex justify-between items-center">
                  <span className="truncate">{file.path}</span>
                  <button
                    onClick={() => downloadFile(file)}
                    className="bg-purple-500 p-1 rounded ml-2"
                  >
                    Download
                  </button>
                </div>
              </div>
            ))}
            {files.length === 0 && (
              <p className="text-gray-400">No files generated yet.</p>
            )}
          </div>
        </div>
      </div>

      {/* Coze Responses Table */}
      <div className="mt-6">
        <h3 className="text-base font-bold mb-2">Coze Responses</h3>
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
                    <td className="p-2">
                      {JSON.stringify(resp.response).slice(0, 30)}...
                    </td>
                    <td className="p-2">
                      {new Date(resp.created_at).toLocaleString()}
                    </td>
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
      <div className="mt-6">
        <h3 className="text-base font-bold mb-2">Saved Files</h3>
        <div className="space-y-2">
          {savedFiles.map((file, index) => (
            <div key={index} className="bg-gray-700 p-2 rounded">
              <div className="flex justify-between items-center">
                <span className="truncate">{file.path}</span>
                <button
                  onClick={() => downloadFile(file)}
                  className="bg-purple-500 p-1 rounded ml-2"
                >
                  Download
                </button>
              </div>
            </div>
          ))}
          {savedFiles.length === 0 && (
            <p className="text-gray-400">No saved files yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
