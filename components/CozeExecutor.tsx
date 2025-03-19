// components/CozeExecutor.tsx
"use client";
import { useState, useEffect } from "react";
import { executeCozeAgent } from "@/app/actions";
import { supabaseAdmin } from "@/lib/supabase";
import { useTelegram } from "@/hooks/useTelegram";
import { saveAs } from 'file-saver';

interface FileEntry {
  path: string;
  content: string;
  extension: string;
}

export default function CozeExecutor({
  botId = "7483269209293275191",
  userId = "341503612082"
}: {
  botId?: string;
  userId?: string;
}) {
  const [response, setResponse] = useState<any>(null);
  const [jsonInput, setJsonInput] = useState<string>("");
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [savedFiles, setSavedFiles] = useState<FileEntry[]>([]);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const { user } = useTelegram();

  // Load saved state from Supabase metadata
  useEffect(() => {
    const loadSavedState = async () => {
      if (!user) return;
      const { data } = await supabaseAdmin
        .from("users")
        .select("metadata")
        .eq("id", user.id)
        .single();
        
      if (data?.metadata?.generated_files) {
        setSavedFiles(parseFilesFromJson(data.metadata.generated_files));
        setJsonInput(JSON.stringify(data.metadata.generated_files, null, 2));
      }
    };
    loadSavedState();
  }, [user]);

  const parseFilesFromJson = (json: any): FileEntry[] => {
    const entries: FileEntry[] = [];
    try {
      // Parse components
      json.new_components?.forEach((c: any) => {
        const match = c.code.match(/\/\/ File: (.+)\n/);
        if (match) {
          entries.push({
            path: match[1],
            content: c.code,
            extension: match[1].split(".").pop() || "tsx"
          });
        }
      });

      // Parse pages
      json.new_pages?.forEach((p: any) => {
        entries.push({
          path: p.route,
          content: p.code,
          extension: p.route.split(".").pop() || "tsx"
        });
      });

      // Parse actions
      json.new_actions?.forEach((a: any) => {
        entries.push({
          path: `app/actions/${a.name}.ts`,
          content: a.code,
          extension: "ts"
        });
      });

      // Parse migrations
      json.supabase_migrations?.forEach((m: any) => {
        entries.push({
          path: `supabase/migrations/${m.name}.sql`,
          content: m.sql,
          extension: "sql"
        });
      });
    } catch (err) {
      setError("Error parsing files");
    }
    return entries;
  };

  const handleExecute = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await executeCozeAgent(
        botId,
        userId,
        "Generate code components",
        { operation: "code_generation" }
      );
      
      setResponse(result);
      setJsonInput(JSON.stringify(result, null, 2));
      setFiles(parseFilesFromJson(result));
      
      // Save to Supabase
      if (user) {
        await supabaseAdmin
          .from("users")
          .update({
            metadata: {
              ...user.metadata,
              generated_files: result
            }
          })
          .eq("id", user.id);
      }
    } catch (err) {
      setError("Execution failed: " + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleParse = () => {
    try {
      const parsed = JSON.parse(jsonInput);
      setFiles(parseFilesFromJson(parsed));
      setError("");
    } catch (err) {
      setError("Invalid JSON format");
    }
  };

  const downloadFile = (file: FileEntry) => {
    const blob = new Blob([file.content], { type: "text/plain" });
    saveAs(blob, file.path.split("/").pop() || "file");
  };

  return (
    <div className="p-4 bg-gray-900 text-white">
      <div className="mb-4">
        <button 
          onClick={handleExecute}
          disabled={loading}
          className="bg-blue-500 p-2 rounded mr-2"
        >
          Run Agent
        </button>
        
        <button 
          onClick={handleParse}
          className="bg-green-500 p-2 rounded"
        >
          Re-parse JSON
        </button>
      </div>

      {error && <div className="text-red-500 mb-4">{error}</div>}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <h3 className="text-lg">JSON Response</h3>
          <textarea
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
            className="w-full h-64 bg-gray-800 p-2 text-white"
          />
        </div>

        <div>
          <h3 className="text-lg">Parsed Files</h3>
          <div className="space-y-2">
            {files.map((file, index) => (
              <div key={index} className="bg-gray-800 p-2 rounded">
                <div className="flex justify-between items-center">
                  <span>{file.path}</span>
                  <button 
                    onClick={() => downloadFile(file)}
                    className="bg-purple-500 p-1 rounded"
                  >
                    Download .{file.extension}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <h3 className="text-lg mt-4">Saved Files</h3>
      <div className="space-y-2">
        {savedFiles.map((file, index) => (
          <div key={index} className="bg-gray-700 p-2 rounded">
            <div className="flex justify-between items-center">
              <span>{file.path}</span>
              <button 
                onClick={() => downloadFile(file)}
                className="bg-purple-500 p-1 rounded"
              >
                Download .{file.extension}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
