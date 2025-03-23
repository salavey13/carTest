"use client";
import { useState, useEffect } from "react";
import { createGitHubPullRequest, getOpenPullRequests, notifyAdmin } from "@/app/actions_github/actions";
import { supabaseAdmin } from "@/hooks/supabase";
import { useAppContext } from "@/contexts/AppContext";
import { saveAs } from "file-saver";
import { FaArrowRight, FaEllipsisV, FaTelegramPlane, FaTrash, FaList, FaTools, FaPlus, FaInfoCircle, FaRobot, FaImage, FaBook, FaDatabase, FaRocket, FaCode, FaLink } from "react-icons/fa";
import { toast } from "sonner";
import { sendTelegramDocument } from "@/app/actions";

interface FileEntry { path: string; content: string; extension: string; }

const Tooltip = ({ children, text }: { children: React.ReactNode; text: string }) => {
  const [isVisible, setIsVisible] = useState(false);
  return (
    <div className="relative inline-block">
      <div onMouseEnter={() => setIsVisible(true)} onMouseLeave={() => setIsVisible(false)}>
        {children}
      </div>
      {isVisible && (
        <div className="absolute z-10 p-2 bg-gray-700 text-white text-[13px] rounded shadow-lg w-42 top-[100%] right-[-13px] mt-1 whitespace-pre-line">
          {text}
        </div>
      )}
    </div>
  );
};

// pat
export default function AICodeAssistant() {
  const { user } = useAppContext();
  const [response, setResponse] = useState<string>("");
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [savedFiles, setSavedFiles] = useState<FileEntry[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [repoUrl, setRepoUrl] = useState<string>("https://github.com/salavey13/cartest");
  const [prTitle, setPrTitle] = useState<string>("");
  const [prDescription, setPrDescription] = useState<string>("");
  const [commitMessage, setCommitMessage] = useState<string>("");
  const [openPRs, setOpenPRs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showFileMenu, setShowFileMenu] = useState(false);
  const [showSavedFileMenu, setShowSavedFileMenu] = useState(false);
  const [showPRDetails, setShowPRDetails] = useState(false);
  const [showToolsMenu, setShowToolsMenu] = useState(false);
  const [customLinks, setCustomLinks] = useState<{ name: string; url: string }[]>([]);

  const predefinedLinks = [
    { name: "ChatGPT", url: "https://chatgpt.com", icon: <FaRobot className="text-green-500" /> },
    { name: "QwenLM", url: "https://qwenlm.ai", icon: <FaImage className="text-blue-500" /> },
    { name: "NotebookLM", url: "https://notebooklm.google.com", icon: <FaBook className="text-yellow-500" /> },
    { name: "Supabase", url: "https://supabase.com", icon: <FaDatabase className="text-teal-500" /> },
    { name: "Vercel", url: "https://vercel.com", icon: <FaRocket className="text-black" /> },
    { name: "Coze.com", url: "https://coze.com", icon: <FaCode className="text-purple-500" /> },
  ];

  useEffect(() => {
    const loadData = async () => {
      if (user) {
        const { data: userData } = await supabaseAdmin
          .from("users")
          .select("metadata")
          .eq("user_id", user.id)
          .single();
        if (userData?.metadata?.generated_files) {
          setSavedFiles(userData.metadata.generated_files.map((f: any) => ({
            path: f.path,
            content: f.code,
            extension: f.extension,
          })));
        }
        if (userData?.metadata?.customLinks) setCustomLinks(userData.metadata.customLinks);
      }
    };
    loadData();
  }, [user]);

  const parseFilesFromText = (text: string): FileEntry[] => {
    const entries: FileEntry[] = [];
    const codeBlocks = text.match(/