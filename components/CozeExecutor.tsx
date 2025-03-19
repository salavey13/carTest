// components/CozeExecutor.tsx
"use client";
import { useState, useEffect } from "react";
import { executeCozeAgent, sendTelegramDocument } from "@/app/actions";
import { supabaseAdmin } from "@/hooks/supabase";
import { useTelegram } from "@/hooks/useTelegram";
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

  // Load initial data from Supabase when user is available
  useEffect(() => {
    const loadData = async () => {
      if (!user) {
        console.log("Waiting for Telegram user to load...");
        return;
      }
      try {
        console.log("Loading data for user_id:", user.id);
        setError(""); // Clear initial "No user" error once user loads

        const { data: userData, error: userError } = await supabaseAdmin
          .from("users")
          .select("metadata")
          .eq("user_id", user.id)
          .single();
        if (userError) throw userError;
        if (userData?.metadata?.generated_files) {
          const parsedSavedFiles = parseFilesFromText(JSON.stringify(userData.metadata.generated_files));
          setSavedFiles(parsedSavedFiles);
          console.log("Loaded saved files:", parsedSavedFiles);
        } else {
          console.log("No saved files found in metadata");
        }

        const { data: responses, error: responsesError } = await supabaseAdmin
          .from("coze_responses")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });
        if (responsesError) throw responsesError;
        setCozeResponses(responses || []);
        console.log("Loaded Coze responses:", responses);
      } catch (err) {
        setError("Failed to load data: " + (err as Error).message);
        console.error("Load data error:", err);
      }
    };

    // Only run loadData if user is defined
    if (user) {
      loadData();
    }
  }, [user]);

  // Improved file parsing to handle both language and filename on first line
  const parseFilesFromText = (text: string): FileEntry[] => {
    const entries: FileEntry[] = [];
    const supportedLanguages = ["typescript", "tsx", "ts", "sql"];
    try {
      const codeBlocks = text.match(/```[\s\S]*?```/g) || [];
      codeBlocks.forEach((block) => {
        const content = block.slice(3, -3).trim();
        const lines = content.split("\n");
        const firstLine = lines[0].trim();

        // Check if first line is a language or filename
        let language = supportedLanguages.find((lang) => firstLine === lang);
        let codeStartIndex = language ? 1 : 0;
        let defaultPath = "unnamed";

        // If first line looks like a filename (e.g., "SleepReminderAdmin.tsx")
        if (!language && firstLine.match(/^[a-zA-Z0-9_-]+\.(tsx|ts|sql|typescript)$/)) {
          defaultPath = firstLine;
          codeStartIndex = 1; // Skip the filename line
          language = firstLine.split(".").pop() || "text";
        } else if (!language) {
          language = "text"; // Default if no match
        }

        const codeContent = lines.slice(codeStartIndex).join("\n");
        const fileMatch = codeContent.match(/(?:\/\/|--)\s*File:\s*(.+)/i);

        const path = fileMatch ? fileMatch[1].trim() : defaultPath;
        const extension = path.split(".").pop() || (language === "sql" ? "sql" : "txt");

        entries.push({
          path,
          content: codeContent,
          extension,
        });
      });
    } catch (err) {
      setError("Error parsing files from text: " + (err as Error).message);
    }
    return entries;
  };

  // Handle execution of the Coze agent
  const handleExecute = async () => {
    setLoading(true);
    setError("");
    setFiles([]);
    try {
      const result = await executeCozeAgent(botId, userId, content, {
        operation: "code_generation",
      });
      if (result.success) {
        setResponse(result.data);
        const parsedFiles = parseFilesFromText(result.data);
        setFiles(parsedFiles);

        if (user) {
          const { data: responses } = await supabaseAdmin
            .from("coze_responses")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false });
          setCozeResponses(responses || []);
        }
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError("Execution failed: " + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // Handle manual parsing of response textarea
  const handleParse = () => {
    setError("");
    setFiles([]);
    const parsedFiles = parseFilesFromText(response);
    setFiles(parsedFiles);
    if (parsedFiles.length === 0) {
      setError("No files found in the response");
    }
  };

  // Save all parsed files to user's metadata
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
        .upsert(
          {
            user_id: user.id,
            metadata: { generated_files: fileData },
          },
          { onConflict: "user_id" }
        );

      if (error) throw error;

      setSavedFiles(files);
      setError("Files saved successfully!");
      console.log("Saved files to Supabase:", fileData);
    } catch (err) {
      setError("Failed to save files: " + (err as Error).message);
      console.error("Save files error:", err);
    } finally {
      setLoading(false);
    }
  };

  // Save an individual file to user's metadata
  const handleSaveFile = async (file: FileEntry) => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: userData } = await supabaseAdmin
        .from("users")
        .select("metadata")
        .eq("user_id", user.id)
        .single();

      const existingFiles = userData?.metadata?.generated_files || [];
      const updatedFiles = [
        ...existingFiles.filter((f: any) => f.path !== file.path),
        { path: file.path, code: file.content, extension: file.extension },
      ];

      const { error } = await supabaseAdmin
        .from("users")
        .upsert(
          {
            user_id: user.id,
            metadata: { generated_files: updatedFiles },
          },
          { onConflict: "user_id" }
        );

      if (error) throw error;

      setSavedFiles(updatedFiles.map((f: any) => ({
        path: f.path,
        content: f.code,
        extension: f.extension,
      })));
      setError(`File "${file.path}" saved successfully!`);
    } catch (err) {
      setError(`Failed to save file "${file.path}": ` + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // Send file to Telegram chat using the server-side action
  const downloadFile = async (file: FileEntry) => {
    if (!user) {
      setError("No Telegram user detected");
      return;
    }
    setLoading(true);
    try {
      const result = await sendTelegramDocument(
        user.id,
        file.content,
        file.path.split("/").pop() || "file"
      );

      if (!result.success) {
        throw new Error(result.error);
      }

      setError(`File "${file.path}" sent to your Telegram chat successfully!`);
    } catch (err) {
      setError(`Failed to send file "${file.path}" to Telegram: ` + (err as Error).message);
      console.error("Send document error:", err);
    } finally {
      setLoading(false);
    }
  };

  // Render response with syntax highlighting
  const renderResponse = (text: string) => {
    if (!text) return null;
    const parts = text.split(/(```[\s\S]*?```)/g);
    return parts.map((part, index) => {
      if (part.startsWith("```") && part.endsWith("```")) {
        const code = part.slice(3, -3).trim();
        const firstLine = code.split("\n")[0].trim();
        const languageMatch = ["typescript", "tsx", "ts", "sql"].includes(firstLine);
        const language = languageMatch ? firstLine : "text";
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

      {/* Response Textarea */}
      <div className="mb-4">
        <h3 className="text-base font-bold mb-2">Response</h3>
        <textarea
          value={response}
          onChange={(e) => setResponse(e.target.value)}
          className="w-full h-64 p-2 bg-gray-800 text-white rounded overflow-auto"
          placeholder="Paste a response here to parse files or wait for Coze execution..."
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
          onClick={handleParse}
          disabled={loading || !response}
          className="bg-yellow-500 p-2 rounded flex-1 sm:flex-none hover:bg-yellow-600"
        >
          Parse Files
        </button>
        <button
          onClick={handleSaveFiles}
          disabled={loading || files.length === 0}
          className="bg-green-500 p-2 rounded flex-1 sm:flex-none hover:bg-green-600"
        >
          Save All Files
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

      {/* Rendered Response */}
      {response && (
        <div className="mb-4">
          <h3 className="text-base font-bold mb-2">Rendered Response</h3>
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
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSaveFile(file)}
                      disabled={loading}
                      className="bg-green-500 p-1 rounded hover:bg-green-600 disabled:bg-gray-400"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => downloadFile(file)}
                      disabled={loading}
                      className="bg-purple-500 p-1 rounded hover:bg-purple-600 disabled:bg-gray-400"
                    >
                      Send to Chat
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Coze Responses Table */}
      {cozeResponses.length > 0 && (
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
                {cozeResponses.map((resp) => (
                  <tr key={resp.id} className="border-b border-gray-700">
                    <td className="p-2">{resp.id.slice(0, 8)}...</td>
                    <td className="p-2">{resp.bot_id}</td>
                    <td className="p-2">{resp.content.slice(0, 30)}...</td>
                    <td className="p-2">{resp.response.slice(0, 30)}...</td>
                    <td className="p-2">{new Date(resp.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
                    disabled={loading}
                    className="bg-purple-500 p-1 rounded ml-2 hover:bg-purple-600 disabled:bg-gray-400"
                  >
                    Send to Chat
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
