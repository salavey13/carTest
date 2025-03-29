"use client";
import React, { useState, useEffect, useImperativeHandle, forwardRef, MutableRefObject } from "react";
import { createGitHubPullRequest, getOpenPullRequests } from "@/app/actions_github/actions";
import { notifyAdmin, sendTelegramDocument } from "@/app/actions";
import { supabaseAdmin } from "@/hooks/supabase";
import { useAppContext } from "@/contexts/AppContext";
import { useRepoXmlPageContext } from "@/contexts/RepoXmlPageContext";
import { saveAs } from "file-saver";

// Import icons from fa (older set)
import { FaInfoCircle, FaTrashAlt as FaTrashAltFa } from "react-icons/fa"; // Import needed older icons

// Import icons from fa6 (newer set)
import {
    FaArrowRight, FaBook, FaSquareCheck, FaCode, FaCopy, FaDatabase, FaEllipsisVertical,
    FaImage, FaLink, FaList, FaPlus, FaRightLeft, FaRobot, FaRocket, FaRotate, FaPaperPlane,
    FaScrewdriverWrench, FaStar, FaCircleCheck, FaCircleExclamation, FaClipboardQuestion,
    FaWandMagicSparkles, FaBroom // Added new icons
} from "react-icons/fa6";
import { toast } from "sonner";
import clsx from 'clsx';
import { motion, AnimatePresence } from "framer-motion";

// Tooltip Component (Position Adjustment)
const Tooltip = ({ children, text, position = 'bottom' }: { children: React.ReactNode; text: string; position?: 'top' | 'bottom' | 'left' | 'right' }) => {
  const [isVisible, setIsVisible] = useState(false);

  const positionClasses = {
      top: 'bottom-full left-1/2 transform -translate-x-1/2 mb-1',
      bottom: 'top-full left-1/2 transform -translate-x-1/2 mt-1',
      left: 'right-full top-1/2 transform -translate-y-1/2 mr-1',
      right: 'left-full top-1/2 transform -translate-y-1/2 ml-1',
  };

  return (
    <div className="relative inline-block group"> {/* Added group for potential parent control */}
      <div onMouseEnter={() => setIsVisible(true)} onMouseLeave={() => setIsVisible(false)}>
        {children}
      </div>
      <AnimatePresence>
          {isVisible && (
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.15 }}
                className={clsx(
                    "absolute z-[70] p-2 bg-gray-700 text-white text-[13px] rounded shadow-lg w-max max-w-xs whitespace-pre-line",
                    positionClasses[position]
                )}
            >
              {text}
            </motion.div>
          )}
      </AnimatePresence>
    </div>
  );
};
Tooltip.displayName = 'Tooltip';

// --- Interfaces ---
interface FileEntry {
  id: string; // Added unique ID for stable key prop
  path: string;
  content: string;
  extension: string;
}

interface ValidationIssue {
    id: string;
    fileId: string; // Link to FileEntry id
    filePath: string;
    type: 'icon' | 'useClient' | 'skippedContent' | 'syntax';
    message: string;
    details?: any; // e.g., { badIcon: 'FaSync', goodIcon: 'FaRotate' }
    fixable: boolean; // Can this issue be auto-fixed?
}

type ValidationStatus = 'idle' | 'validating' | 'success' | 'error' | 'warning';

interface AICodeAssistantProps {
    aiResponseInputRef: MutableRefObject<HTMLTextAreaElement | null>;
}

// --- Swap Modal Component --- (Keep as is)
interface SwapModalProps { /* ... */ }
const SwapModal: React.FC<SwapModalProps> = ({ isOpen, onClose, onSwap }) => { /* ... */ };
SwapModal.displayName = 'SwapModal';

// --- Main Component ---
const AICodeAssistant = forwardRef<any, AICodeAssistantProps>(({ aiResponseInputRef }, ref) => {
  // --- Hooks ---
  const { user } = useAppContext();
  const repoContext = useRepoXmlPageContext();

  // --- Context Values ---
  const {
      setAiResponseHasContent = () => {},
      setFilesParsed = () => {},
      setSelectedAssistantFiles = () => {},
      scrollToSection = () => {},
      setAssistantLoading = () => {},
      assistantLoading = false // Get loading state too
  } = repoContext ?? {}; // Provide defaults if context is null

  // --- State ---
  const [response, setResponse] = useState<string>("");
  const [parsedFiles, setParsedFiles] = useState<FileEntry[]>([]);
  const [savedFiles, setSavedFiles] = useState<FileEntry[]>([]);
  const [selectedParsedFiles, setSelectedParsedFilesState] = useState<Set<string>>(new Set()); // Uses FileEntry.id now
  const [repoUrl, setRepoUrl] = useState<string>("https://github.com/salavey13/cartest");
  const [prTitle, setPrTitle] = useState<string>("");
  const [prDescription, setPrDescription] = useState<string>(""); // This will be generated dynamically
  const [commitMessage, setCommitMessage] = useState<string>(""); // This too
  const [rawDescription, setRawDescription] = useState(""); // Store the extracted non-code text
  const [openPRs, setOpenPRs] = useState<any[]>([]);
  const [loadingPRs, setLoadingPRs] = useState(false);
  const [showFileMenu, setShowFileMenu] = useState(false);
  const [showSavedFileMenu, setShowSavedFileMenu] = useState(false);
  const [showPRDetails, setShowPRDetails] = useState(false);
  const [showToolsMenu, setShowToolsMenu] = useState(false);
  const [customLinks, setCustomLinks] = useState<{ name: string; url: string }[]>([]);
  const [showSwapModal, setShowSwapModal] = useState(false);
  // Validation State
  const [validationStatus, setValidationStatus] = useState<ValidationStatus>('idle');
  const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([]);


  // --- Constants ---
  const predefinedLinks = [ /* ... */ ]; // Keep as is

   // Icon replacement map (Example - expand this!)
    const iconReplacements: Record<string, string> = {
        'FaSync': 'FaRotate',
        'FaTools': 'FaScrewdriverWrench',
        'FaCheckSquare': 'FaSquareCheck',
        'FaTelegramPlane': 'FaPaperPlane',
        'FaEllipsisV': 'FaEllipsisVertical',
        'FaTrashAlt': 'FaTrashCan', // Assuming FaTrashCan is preferred from fa6
        // Add more known bad -> good mappings
        // 'FaInfoCircle': 'FaCircleInfo', // If FaCircleInfo is preferred from fa6
    };
    const badIconImports = ['react-icons/fa', 'react-icons/fa5']; // Example import paths to check

   // --- Effects ---
    useEffect(() => {
        setAiResponseHasContent(response.trim().length > 0);
        if (response.trim().length > 0) {
            setFilesParsed(false); // Reset parsing status if response changes
            setSelectedAssistantFiles(new Set());
            setValidationStatus('idle'); // Reset validation status
            setValidationIssues([]);
        } else {
            // Clear everything if response is empty
             setParsedFiles([]);
             setSelectedParsedFilesState(new Set());
             setFilesParsed(false);
             setSelectedAssistantFiles(new Set());
             setValidationStatus('idle');
             setValidationIssues([]);
             setPrTitle('');
             setPrDescription('');
             setCommitMessage('');
             setRawDescription('');
        }
    }, [response, setAiResponseHasContent, setFilesParsed, setSelectedAssistantFiles]);

   useEffect(() => { /* ... loadData effect ... */ }, [user]);

   // --- Helper: Generate Unique ID ---
   const generateId = () => '_' + Math.random().toString(36).substring(2, 9);

  // --- Helper Functions ---
   const parseFilesFromText = (text: string): { files: FileEntry[], description: string } => {
        const files: FileEntry[] = [];
        let lastIndex = 0;
        const descriptionParts: string[] = [];
        const codeBlockRegex = /(?:(?:^\s*(?:\/\/|\/\*|--|#)\s*File:\s*(.+?)\s*(?:\*\/)?\s*$)|(?:^\s*))\n*^```(\w+)?\n([\s\S]*?)\n^```(?:\n*(?:^\s*(?:\/\/|\/\*|--|#)\s*File:\s*(.+?)\s*(?:\*\/)?\s*$))?/gm;
        let match;

        while ((match = codeBlockRegex.exec(text)) !== null) {
            // Add text between code blocks (or start of text) to description
            if (match.index > lastIndex) {
                descriptionParts.push(text.substring(lastIndex, match.index).trim());
            }
            lastIndex = codeBlockRegex.lastIndex; // Update last index

            // Extract file info (same logic as before)
            let path = (match[4] || match[1] || `unnamed-${files.length + 1}`).trim();
            let content = match[3].trim();
            let extension = path.split('.').pop() || 'txt';

             if (path.startsWith('unnamed-')) {
                const lines = content.split('\n');
                const potentialPathLine = lines[0].trim();
                const pathCommentMatch = potentialPathLine.match(/^(?:\/\/|\/\*|--|#)\s*([\w\-\/\.]+?\.\w+)/);
                const plainPathMatch = potentialPathLine.match(/^[\w\-\/\.]+?\.\w+$/) && lines.length > 1;
                if (pathCommentMatch) {
                    path = pathCommentMatch[1].trim(); content = lines.slice(1).join('\n').trim(); extension = path.split('.').pop() || 'txt';
                } else if (plainPathMatch) {
                     path = potentialPathLine; content = lines.slice(1).join('\n').trim(); extension = path.split('.').pop() || 'txt';
                }
            }
            path = path.replace(/^[\/\\]+/, '');
            files.push({ id: generateId(), path, content, extension });
        }

        // Add any remaining text after the last code block
        if (lastIndex < text.length) {
            descriptionParts.push(text.substring(lastIndex).trim());
        }

        const description = descriptionParts.filter(Boolean).join('\n\n'); // Join non-empty parts
        return { files, description };
    };

   const extractPRDetails = (extractedDescription: string): { title: string; commitSubject: string } => {
        // Simpler extraction: Use first line of description as title/subject
        const lines = extractedDescription.split('\n');
        const firstLine = lines[0]?.trim() || "AI Assistant Update";
        const title = firstLine.substring(0, 70); // Limit title
        const commitSubject = firstLine.substring(0, 50); // Limit commit subject
        return { title, commitSubject };
   };

   // --- NEW: Validation Function ---
   const validateParsedFiles = async (files: FileEntry[]) => {
        setValidationStatus('validating');
        setValidationIssues([]);
        const issues: ValidationIssue[] = [];
        const clientHookPatterns = /(useState|useEffect|useRef|useContext|useReducer|useCallback|useMemo|useLayoutEffect|useImperativeHandle|useDebugValue)\s*\(/;
        const skippedContentPatterns = /(\.\.\.|\[\.\.\.\]|\/\/ \.\.\.|\/\* \.\.\. \*\/)/;
        // Very basic check for unclosed common tags (simplified, not foolproof)
        const unclosedTagRegex = /<(div|span|p|ul|li|button|a)(?![^>]*\/>)[^>]*>([\s\S]*?)(?!<\/\1>)/i;

        for (const file of files) {
            // 1. Icon Check
            const iconImportRegex = /import\s+{([^}]*)}\s+from\s+['"](react-icons\/(?:fa|fa5))['"]/g;
            let importMatch;
            while ((importMatch = iconImportRegex.exec(file.content)) !== null) {
                const importedIcons = importMatch[1].split(',').map(i => i.trim()).filter(Boolean);
                importedIcons.forEach(iconName => {
                    if (iconReplacements[iconName]) {
                        issues.push({
                            id: generateId(), fileId: file.id, filePath: file.path, type: 'icon',
                            message: `Иконка ${iconName} из ${importMatch[2]} может быть устаревшей. Рекомендуется: ${iconReplacements[iconName]} из 'react-icons/fa6'.`,
                            details: { badIcon: iconName, goodIcon: iconReplacements[iconName] },
                            fixable: true
                        });
                    }
                });
            }
             // Check icon usage directly if needed (more complex regex)
             // const iconUsageRegex = /<([A-Z][a-zA-Z]+)/g; ... compare against iconReplacements keys ...

            // 2. "use client" Check
            if (file.extension === 'tsx' || file.extension === 'ts' || file.extension === 'jsx' || file.extension === 'js') {
                const lines = file.content.split('\n');
                const firstCodeLine = lines.find(line => line.trim() !== '' && !line.trim().startsWith('//') && !line.trim().startsWith('/*'));
                const hasUseClient = firstCodeLine?.trim() === '"use client";' || firstCodeLine?.trim() === "'use client';";

                if (!hasUseClient && clientHookPatterns.test(file.content)) {
                    issues.push({
                        id: generateId(), fileId: file.id, filePath: file.path, type: 'useClient',
                        message: `Обнаружены хуки React (${clientHookPatterns.exec(file.content)?.[1]}), но отсутствует директива "use client".`,
                        details: null,
                        fixable: true
                    });
                }
            }

            // 3. Skipped Content Check
            if (skippedContentPatterns.test(file.content)) {
                 issues.push({
                    id: generateId(), fileId: file.id, filePath: file.path, type: 'skippedContent',
                    message: `Обнаружены маркеры пропуска (${skippedContentPatterns.exec(file.content)?.[1]}), код может быть неполным.`,
                    details: null,
                    fixable: false // Cannot auto-fix reliably
                });
            }

             // 4. Basic Syntax Check (Example: unclosed tags)
            // if (unclosedTagRegex.test(file.content)) {
            //     issues.push({
            //         id: generateId(), fileId: file.id, filePath: file.path, type: 'syntax',
            //         message: `Возможно, не закрыт тег ${unclosedTagRegex.exec(file.content)?.[1]} или есть другая ошибка синтаксиса.`,
            //         details: null,
            //         fixable: false
            //     });
            // }
        }

        // Simulate validation time
        await new Promise(resolve => setTimeout(resolve, 300));

        setValidationIssues(issues);
        if (issues.length > 0) {
             // If any issue is not fixable, status is 'error', otherwise 'warning'
             const hasUnfixable = issues.some(issue => !issue.fixable);
             setValidationStatus(hasUnfixable ? 'error' : 'warning');
             toast.warning(`Обнаружено ${issues.length} потенциальных проблем.`);
        } else {
            setValidationStatus('success');
            toast.success("Проверка кода пройдена успешно!");
        }
    };

   // --- Action Handlers ---
   const handleParse = async () => {
        if (!repoContext) return;
        setAssistantLoading(true);
        setValidationStatus('idle'); // Reset validation
        setValidationIssues([]);
        setParsedFiles([]);
        setSelectedParsedFilesState(new Set());
        setFilesParsed(false);
        setSelectedAssistantFiles(new Set());

        const { files, description: extractedDesc } = parseFilesFromText(response);
        setParsedFiles(files); // Update local state first
        setRawDescription(extractedDesc); // Store the raw description text

        if (files.length > 0) {
            const { title, commitSubject } = extractPRDetails(extractedDesc || response); // Use extracted desc or full response
            setPrTitle(title);
            // Don't set description/commit here, generate later
            // setPrDescription(description);
            setCommitMessage(commitSubject); // Use subject for commit message base
            setFilesParsed(true); // Set context: parsing SUCCEEDED
            toast.success(`${files.length} файлов разобрано! Запускаю проверку...`);
            selectAllParsedFiles(); // Auto-select parsed files
            setShowPRDetails(false); // Keep details closed initially

            // Run validation AFTER parsing
            await validateParsedFiles(files);

        } else {
            toast.info("В ответе не найдено файлов кода для разбора.");
            setFilesParsed(false); // Set context: parsing FAILED (no files)
            setPrTitle('');
            // setPrDescription('');
            setCommitMessage('');
            setRawDescription('');
            setValidationStatus('idle');
        }
        setAssistantLoading(false); // Set loading false after parsing and validation attempt
    };

   // --- NEW: Auto-Fix Handler ---
   const handleAutoFixIssues = () => {
       if (!validationIssues.some(issue => issue.fixable)) return;

       let changesMade = false;
       const updatedFiles = parsedFiles.map(file => {
           let newContent = file.content;
           const fileIssues = validationIssues.filter(issue => issue.fileId === file.id && issue.fixable);

           if (fileIssues.length === 0) return file; // No fixable issues for this file

           fileIssues.forEach(issue => {
               if (issue.type === 'icon' && issue.details?.badIcon && issue.details?.goodIcon) {
                   // Basic replacement (might need regex for robustness)
                   const bad = issue.details.badIcon;
                   const good = issue.details.goodIcon;
                   // Replace import statements carefully
                    newContent = newContent.replace(
                        new RegExp(`import\\s+{[^}]*${bad}[^}]*}\\s+from\\s+['"]react-icons/fa['"]`, 'g'),
                        (match) => match.replace(bad, good) // Be careful not to break other imports
                    );
                    // Replace usage (simple case)
                    newContent = newContent.replaceAll(`<${bad}`, `<${good}`);
                    newContent = newContent.replaceAll(`</${bad}>`, `</${good}>`);
                   changesMade = true;
               } else if (issue.type === 'useClient') {
                    if (!newContent.trim().startsWith('"use client"') && !newContent.trim().startsWith("'use client'")) {
                         newContent = `"use client";\n\n${newContent}`;
                         changesMade = true;
                    }
               }
           });
           return { ...file, content: newContent };
       });

       if (changesMade) {
            setParsedFiles(updatedFiles);
            toast.success("Автоматические исправления применены! Проверьте результат.");
            // Re-validate or just clear issues? Clearing is simpler.
            setValidationStatus('success'); // Assume fixed, user can re-parse if needed
            setValidationIssues([]);
       } else {
            toast.info("Не найдено проблем для автоматического исправления.");
       }
   };

   // --- NEW: Copy Fix Prompt Handler ---
   const handleCopyFixPrompt = () => {
        const skippedFiles = validationIssues
            .filter(issue => issue.type === 'skippedContent')
            .map(issue => `- ${issue.filePath}`)
            .join('\n');

        if (!skippedFiles) {
             toast.info("Не обнаружено проблем с пропуском контента.");
             return;
        }

        const prompt = `Пожалуйста, предоставь ПОЛНУЮ версию следующих файлов, так как в предыдущем ответе был пропущен код (обнаружены маркеры '...'):\n${skippedFiles}\n\nУбедись, что каждый файл представлен в виде отдельного блока кода с указанием пути перед ним, например:\n// path/to/your/file.tsx\n\`\`\`tsx\n// full code here\n\`\`\``;

        navigator.clipboard.writeText(prompt)
            .then(() => toast.success("Инструкция для AI скопирована! Вставьте ее в чат."))
            .catch(err => toast.error("Не удалось скопировать инструкцию."));
   };


  // --- Existing Handlers (Keep logic, maybe adjust loading/context calls if needed) ---
  const handleSaveFiles = async () => { /* ... */ };
  const handleDownload = async () => { /* ... */ };
  const downloadFile = async (file: FileEntry) => { /* ... */ };
  const handleClearAllSavedFiles = async () => { /* ... */ };
  const toggleParsedFileSelection = (path: string) => {
      // Use File ID for selection state now
        setSelectedParsedFilesState((prev) => {
            const targetFile = parsedFiles.find(f => f.path === path); // Find by path
            if (!targetFile) return prev; // Should not happen

            const newSelected = new Set(prev);
            if (newSelected.has(targetFile.id)) {
                newSelected.delete(targetFile.id);
            } else {
                newSelected.add(targetFile.id);
            }
            // Update context with the SET OF PATHS still, as action expects paths
            const selectedPaths = new Set(
                Array.from(newSelected).map(id => parsedFiles.find(f => f.id === id)?.path).filter(Boolean) as string[]
            );
            setSelectedAssistantFiles(selectedPaths);
            return newSelected;
        });
     };
  const selectAllParsedFiles = () => {
      const allParsedIds = new Set(parsedFiles.map(file => file.id));
      const allParsedPaths = new Set(parsedFiles.map(file => file.path));
      setSelectedParsedFilesState(allParsedIds);
      setSelectedAssistantFiles(allParsedPaths); // Update context with paths
      if (allParsedPaths.size > 0) {
         toast.info(`${allParsedPaths.size} файлов выбрано для PR.`);
      }
  };
  const handleGetOpenPRs = async () => { /* ... */ };
  const handleAddCustomLink = async () => { /* ... */ };

  const handleCreatePR = async () => {
    // --- Dynamic Description/Commit Generation ---
    const selectedFileObjects = parsedFiles.filter(f => selectedParsedFiles.has(f.id));
    if (!repoUrl || selectedFileObjects.length === 0 || !prTitle) {
        toast.error("Укажите URL, Заголовок PR и выберите файлы.");
        setShowPRDetails(true);
        return;
    }
    if (!repoContext) return;

    // 1. Generate PR Description
    let finalDescription = rawDescription.substring(0, 2000); // Start with AI explanation (limit initial part)
    if (rawDescription.length > 2000) {
        finalDescription += "\n\n... (описание от AI усечено)";
    }
    finalDescription += `\n\n**Файлы в этом PR (${selectedFileObjects.length}):**\n`;
    finalDescription += selectedFileObjects.map(f => `- \`${f.path}\``).join('\n');

    // Add info about skipped files if any were *not* selected
    const unselectedUnnamed = parsedFiles.filter(f => f.path.startsWith('unnamed-') && !selectedParsedFiles.has(f.id));
    if (unselectedUnnamed.length > 0) {
        finalDescription += `\n\n**Примечание:** ${unselectedUnnamed.length} блоков кода без имени файла не были включены.`;
    }

    // 2. Generate Commit Message
    // Use extracted subject, add file count, maybe first few lines of description
    const commitSubject = prTitle.substring(0, 50); // Use PR title as base
    let commitBody = `Обновляет ${selectedFileObjects.length} файлов на основе ответа AI.\n\n`;
    commitBody += rawDescription.split('\n').slice(0, 5).join('\n').substring(0, 500); // First few lines of explanation
    if (rawDescription.split('\n').length > 5 || rawDescription.length > 500) commitBody += "...";
    const finalCommitMessage = `${commitSubject}\n\n${commitBody}`;
    // --- End Generation ---


    setAssistantLoading(true);
    setLoading(true);
    try {
        const filesToCommit = selectedFileObjects.map(f => ({ path: f.path, content: f.content }));

        const result = await createGitHubPullRequest(
            repoUrl,
            filesToCommit,
            prTitle, // Use the user-edited or auto-extracted title
            finalDescription, // Use dynamically generated description
            finalCommitMessage // Use dynamically generated commit message
        );
        if (result.success && result.prUrl) { /* ... handle success ... */ }
        else { /* ... handle error ... */ }
    } catch (err) { /* ... handle error ... */ }
    finally {
        setAssistantLoading(false);
        setLoading(false);
    }
  };

  // --- Text Area Utility Handlers --- (Keep as is)
  const handleClearResponse = () => { /* ... */ };
  const handleCopyResponse = () => { /* ... */ };
  const handleSwap = (find: string, replace: string) => { /* ... */ };

  // Expose methods via ref
  useImperativeHandle(ref, () => ({ handleParse, selectAllParsedFiles, handleCreatePR, }));

  // --- Validation Status UI ---
    const ValidationIndicator = () => {
        switch (validationStatus) {
            case 'validating':
                return <Tooltip text="Идет проверка кода..." position="left"><FaRotate size={16} className="text-blue-400 animate-spin" /></Tooltip>;
            case 'success':
                return <Tooltip text="Проверка пройдена успешно!" position="left"><FaCircleCheck size={16} className="text-green-500" /></Tooltip>;
            case 'warning': // Fixable issues found
                return <Tooltip text={`Найдены исправимые проблемы (${validationIssues.length})`} position="left"><FaCircleExclamation size={16} className="text-yellow-500" /></Tooltip>;
            case 'error': // Unfixable issues found (or mixed)
                 return <Tooltip text={`Найдены проблемы (${validationIssues.length}), требующие внимания`} position="left"><FaCircleExclamation size={16} className="text-red-500" /></Tooltip>;
            case 'idle':
            default:
                return null; // Or a placeholder like FaClipboardQuestion
        }
    };

    const canAutoFix = validationIssues.some(issue => issue.fixable);
    const hasSkippedContent = validationIssues.some(issue => issue.type === 'skippedContent');

  // --- RENDER ---
  return (
    <div className="p-4 bg-gray-900 text-white font-mono rounded-xl shadow-[0_0_15px_rgba(0,255,157,0.3)] relative overflow-hidden">
        {/* Header */}
        <header className="flex items-center gap-2 mb-4"> {/* Reduced margin */}
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[#E1FF01] text-shadow-[0_0_10px_#E1FF01] animate-pulse">
                AI Code Assistant
            </h1>
            <Tooltip text={`Вставьте ответ AI → '➡️' → Проверьте/Исправьте → Выберите файлы → Создать PR`}>
                <FaInfoCircle className="text-blue-400 cursor-help hover:text-blue-300 transition" />
            </Tooltip>
        </header>

        {/* AI Response Input Section */}
         <div className="mb-4"> {/* Reduced margin */}
            <label htmlFor="response-input" className="block text-sm font-medium mb-1">2. Ввод ответа AI</label>
             <p className="text-yellow-400 mb-2 text-xs md:text-sm"> {/* Smaller text on mobile */}
                2️⃣ Вставьте сюда ПОЛНЫЙ ОТВЕТ от вашего AI. Затем нажмите '➡️'.
            </p>
            <div className="relative group">
                <textarea
                    id="response-input"
                    ref={aiResponseInputRef}
                    className="w-full p-3 pr-16 bg-gray-800 rounded-lg border border-gray-700 focus:border-cyan-500 focus:outline-none transition shadow-[0_0_8px_rgba(0,255,157,0.3)] text-sm min-h-[180px] resize-y" // Increased min-height & pr
                    value={response}
                    onChange={(e) => setResponse(e.target.value)}
                    placeholder="Вставьте ПОЛНЫЙ ОТВЕТ от AI здесь..."
                    disabled={assistantLoading}
                />
                {/* Utility Icons - positioned LEFT of parse button now */}
                <div className="absolute top-2 right-10 flex flex-col gap-1.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-200 z-10">
                      <Tooltip text="Заменить текст" position="left">
                         <motion.button className="p-1.5 rounded-full bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 disabled:cursor-not-allowed shadow-md" onClick={() => setShowSwapModal(true)} disabled={!response || assistantLoading} whileHover={{ scale: (!response || assistantLoading) ? 1 : 1.1 }} whileTap={{ scale: (!response || assistantLoading) ? 1 : 0.95 }}>
                            <FaRightLeft size={14}/>
                         </motion.button>
                     </Tooltip>
                     <Tooltip text="Скопировать все" position="left">
                          <motion.button className="p-1.5 rounded-full bg-teal-600 hover:bg-teal-500 text-white disabled:opacity-50 disabled:cursor-not-allowed shadow-md" onClick={handleCopyResponse} disabled={!response || assistantLoading} whileHover={{ scale: (!response || assistantLoading) ? 1 : 1.1 }} whileTap={{ scale: (!response || assistantLoading) ? 1 : 0.95 }}>
                            <FaCopy size={14}/>
                          </motion.button>
                     </Tooltip>
                     <Tooltip text="Очистить поле" position="left">
                         <motion.button className="p-1.5 rounded-full bg-red-600 hover:bg-red-500 text-white disabled:opacity-50 disabled:cursor-not-allowed shadow-md" onClick={handleClearResponse} disabled={!response || assistantLoading} whileHover={{ scale: (!response || assistantLoading) ? 1 : 1.1 }} whileTap={{ scale: (!response || assistantLoading) ? 1 : 0.95 }}>
                            <FaTrashAltFa size={14}/>
                          </motion.button>
                     </Tooltip>
                </div>
                {/* Parse Button - now aligned with other icons */}
                 <div className="absolute top-2 right-2 flex flex-col gap-1.5 z-10">
                     <Tooltip text="Разобрать и Проверить Ответ AI" position="left">
                         <motion.button
                            className="p-1.5 rounded-full bg-gradient-to-r from-purple-600 to-cyan-500 text-white disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_8px_rgba(0,255,157,0.3)] hover:shadow-[0_0_12px_rgba(0,255,157,0.5)]"
                            onClick={handleParse}
                            disabled={assistantLoading || !response}
                            whileHover={{ scale: (assistantLoading || !response) ? 1 : 1.1 }}
                            whileTap={{ scale: (assistantLoading || !response) ? 1 : 0.95 }}
                         >
                           {assistantLoading && validationStatus === 'idle' ? <FaRotate size={14} className="animate-spin"/> : <FaArrowRight size={14}/> }
                         </motion.button>
                     </Tooltip>
                     {/* Validation Indicator below Parse button */}
                     <div className="flex justify-center mt-1 h-4">
                        <ValidationIndicator />
                     </div>
                 </div>
            </div>
            {/* Validation Actions Area */}
            {validationIssues.length > 0 && validationStatus !== 'validating' && (
                 <div className="mt-2 flex gap-2 justify-end items-center flex-wrap">
                     {canAutoFix && (
                         <button
                             onClick={handleAutoFixIssues}
                             className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-green-600 hover:bg-green-500 text-white transition shadow"
                         >
                             <FaBroom /> Исправить проблемы
                         </button>
                     )}
                     {hasSkippedContent && (
                          <button
                              onClick={handleCopyFixPrompt}
                              className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-orange-600 hover:bg-orange-500 text-white transition shadow"
                          >
                              <FaClipboardQuestion/> Скопировать Prompt для AI (Fix)
                          </button>
                     )}
                     {/* Add details/expand button later if needed */}
                 </div>
            )}
        </div>

        {/* Parsed Files Section */}
        {parsedFiles.length > 0 && (
             <div className="mb-4 bg-gray-800 p-4 rounded-xl shadow-[0_0_12px_rgba(0,255,157,0.3)]">
                 <div className="flex justify-between items-center mb-3">
                     <h2 className="text-lg font-semibold text-cyan-400">Разобранные файлы ({parsedFiles.length})</h2>
                     <div className="relative">
                         <button className="p-1 text-gray-400 hover:text-white" onClick={() => setShowFileMenu(!showFileMenu)} title="Опции">
                             <FaEllipsisVertical />
                         </button>
                         {showFileMenu && ( <motion.div /* ... dropdown ... */ >{/* ... buttons ... */}</motion.div> )}
                     </div>
                 </div>
                 <div className="space-y-1.5 max-h-48 overflow-y-auto pr-2 simple-scrollbar">
                     {parsedFiles.map((file) => (
                     <div key={file.id} className={`flex items-center gap-2 cursor-pointer hover:bg-gray-700 px-1 py-0.5 rounded transition-colors duration-150 ${validationIssues.some(i => i.fileId === file.id) ? 'ring-1 ring-red-500/50' : ''}`} onClick={() => toggleParsedFileSelection(file.path)} title={validationIssues.find(i => i.fileId === file.id)?.message}>
                         <input type="checkbox" checked={selectedParsedFiles.has(file.id)} onChange={(e) => { e.stopPropagation(); toggleParsedFileSelection(file.path); }} className="w-3.5 h-3.5 accent-cyan-500 cursor-pointer flex-shrink-0"/>
                         <span className={`truncate text-sm ${selectedParsedFiles.has(file.id) ? 'text-white font-medium' : 'text-gray-400'}`} > {file.path} </span>
                          {validationIssues.some(i => i.fileId === file.id) && <FaCircleExclamation className="text-red-500 flex-shrink-0" size={12}/>}
                         <Tooltip text={`Отправить ${file.path.split('/').pop()} в Telegram`} position="left">
                             <button onClick={(e) => { e.stopPropagation(); downloadFile(file); }} disabled={loading || !user} className="ml-auto text-purple-500 hover:text-purple-400 disabled:opacity-50 disabled:cursor-not-allowed transition p-0.5"> <FaPaperPlane size={14}/> </button>
                         </Tooltip>
                     </div>
                     ))}
                 </div>
             </div>
         )}

        {/* Saved Files Section */}
        {savedFiles.length > 0 && ( <details /* ... */ > {/* ... */} </details> )}

        {/* Pull Request Section */}
        <section id="pr-section" className="mb-4">
            <div className="flex flex-col sm:flex-row justify-between items-center mb-3 gap-2">
                <h2 className="text-lg font-semibold text-cyan-400">Pull Request ({parsedFiles.filter(f => selectedParsedFiles.has(f.id)).length} файлов)</h2>
                <div className="flex gap-2 items-center">
                    <motion.button className="px-4 py-2 rounded-lg font-semibold text-sm text-white bg-gradient-to-r from-green-500 to-emerald-500 transition-all shadow-[0_0_12px_rgba(16,185,129,0.4)] hover:shadow-[0_0_18px_rgba(16,185,129,0.6)] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none" onClick={handleCreatePR} disabled={assistantLoading || parsedFiles.filter(f => selectedParsedFiles.has(f.id)).length === 0 || !prTitle } whileHover={{ scale: (assistantLoading || parsedFiles.filter(f => selectedParsedFiles.has(f.id)).length === 0) ? 1 : 1.05 }} whileTap={{ scale: (assistantLoading || parsedFiles.filter(f => selectedParsedFiles.has(f.id)).length === 0) ? 1 : 0.95 }}>
                         {assistantLoading ? <FaRotate className="animate-spin inline mr-1" /> : null} Создать PR
                    </motion.button>
                     {/* PR List Tooltip: Use standard Tooltip component */}
                     <Tooltip text="Обновить список открытых PR" position="top">
                         <button className="p-2 text-gray-400 hover:text-white transition disabled:opacity-50" onClick={handleGetOpenPRs} disabled={loadingPRs || !repoUrl}>
                             {loadingPRs ? <FaRotate className="animate-spin"/> : <FaList />}
                        </button>
                     </Tooltip>
                     <Tooltip text="Показать/скрыть детали PR" position="top">
                        <button className="text-blue-400 hover:text-blue-300 transition text-sm p-1" onClick={() => setShowPRDetails(!showPRDetails)}> {showPRDetails ? "Скрыть детали" : "Показать детали"} </button>
                    </Tooltip>
                </div>
            </div>
             {/* PR Details Form */}
             <AnimatePresence> {showPRDetails && ( <motion.div /* ... */ > {/* ... form inputs ... */} </motion.div> )} </AnimatePresence>
        </section>

         {/* Open PRs List Section */}
        {openPRs.length > 0 && ( <section /* ... */ > {/* ... */} </section> )}

         {/* Tools Menu Section */}
        <div className="mb-4"> {/* ... */} </div>

         {/* Swap Modal */}
         <AnimatePresence> {showSwapModal && ( <SwapModal isOpen={showSwapModal} onClose={() => setShowSwapModal(false)} onSwap={handleSwap} /> )} </AnimatePresence>
    </div>
  );
});

AICodeAssistant.displayName = 'AICodeAssistant';
export default AICodeAssistant;