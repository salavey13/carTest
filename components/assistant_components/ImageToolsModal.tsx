"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    FaImages, FaXmark, FaUpload, FaCopy, FaCheck, FaSpinner, FaTriangleExclamation,
    FaGoogle, FaImage, FaSync, FaLink, FaPaste, FaPaperPlane // Added ExternalLink, Paste, PaperPlane
} from 'react-icons/fa6';
import { listPublicBuckets, uploadBatchImages } from '@/app/actions';
import { searchAndGetFirstImageUrl } from '@/app/repo-xml/google_actions';
import { Bucket } from '@supabase/storage-js';
import { toast } from 'sonner';
// Removed import from AICodeAssistant as it's now in its own file
// import { Tooltip } from '../AICodeAssistant';
import { Tooltip } from '@/components/ui/Tooltip'; // Correct import
import { FileEntry as ParsedFileEntry } from "@/hooks/useCodeParsingAndValidation";
import { logger } from '@/lib/logger';
import { useAppContext } from '@/contexts/AppContext'; // Import AppContext hook
import { Input } from '@/components/ui/input'; // Import Input component

// --- Helper Type ---
interface ImagePrompt {
    id: string; // Unique ID for React key
    placeholder: string;
    prompt: string;
    status: 'pending' | 'searching' | 'uploading' | 'swapping' | 'swapped_google' | 'swapped_upload' | 'error_search' | 'error_upload' | 'error_swap';
    currentUrl?: string | null; // Store the found/uploaded URL
    errorMessage?: string;
    manualUrlInput: string; // NEW: State for manual URL input
}

// --- Props ---
interface ImageToolsModalProps {
    isOpen: boolean;
    onClose: () => void;
    parsedFiles: ParsedFileEntry[];
    onUpdateParsedFiles: (updatedFiles: ParsedFileEntry[]) => void;
}

// --- Upload Result Type ---
interface UploadResult {
    name: string;
    url?: string;
    error?: string;
}

export const ImageToolsModal: React.FC<ImageToolsModalProps> = ({
    isOpen,
    onClose,
    parsedFiles,
    onUpdateParsedFiles
}) => {
    // --- Context ---
    const { openLink } = useAppContext(); // Get openLink function

    // --- State ---
    const [isMounted, setIsMounted] = useState(false); // <<<--- ADD isMounted STATE
    const [buckets, setBuckets] = useState<Bucket[]>([]);
    const [selectedBucket, setSelectedBucket] = useState<string>('');
    const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
    const [uploadResults, setUploadResults] = useState<UploadResult[]>([]);
    const [isLoadingBuckets, setIsLoadingBuckets] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [copiedUrlIndex, setCopiedUrlIndex] = useState<number | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const specificUploadInputRef = useRef<HTMLInputElement>(null);
    const [imagePrompts, setImagePrompts] = useState<ImagePrompt[]>([]);
    const [isSwappingAll, setIsSwappingAll] = useState(false);
    const [activeManualInput, setActiveManualInput] = useState<string | null>(null); // Track which manual input is active


    // --- Effects ---

    // Set mounted state
    useEffect(() => {
        setIsMounted(true);
        return () => { setIsMounted(false); }; // Optional cleanup
    }, []);

    // Parse prompts_imgs.txt (runs only client-side after mount)
    useEffect(() => {
        // Only run if mounted and modal is open
        if (isMounted && isOpen && parsedFiles.length > 0) {
            logger.log("ImageToolsModal: Checking for /prompts_imgs.txt");
            const promptsFile = parsedFiles.find(f => f.path === '/prompts_imgs.txt');
            if (promptsFile) {
                const lines = promptsFile.content.split('\n');
                const prompts: ImagePrompt[] = lines
                    .map((line, index) => {
                        const match = line.trim().match(/^-?\s*([^:]+):\s*(.+)$/);
                        if (match) {
                            const placeholder = match[1].trim();
                            const prompt = match[2].trim();
                            // Client-side check for existence
                            const existsInCode = parsedFiles.some(f =>
                                f.path !== '/prompts_imgs.txt' && f.content?.includes(placeholder)
                            );
                            return {
                                id: `${placeholder}-${index}-${Math.random().toString(36).substring(7)}`, // More robust ID
                                placeholder, prompt,
                                status: existsInCode ? 'pending' : 'error_swap',
                                errorMessage: existsInCode ? undefined : 'Placeholder не найден в коде',
                                manualUrlInput: '', // Initialize manual input
                            } as ImagePrompt;
                        }
                        return null;
                    })
                    .filter((p): p is ImagePrompt => p !== null);

                if (prompts.length > 0) {
                    // Avoid immediate toast if parsing happens instantly
                    // toast.success(`🤖 Обнаружен /prompts_imgs.txt (${prompts.length} промптов)`);
                    setImagePrompts(prompts);
                    logger.log("Parsed image prompts:", prompts);
                } else { setImagePrompts([]); logger.log("/prompts_imgs.txt found but no valid prompts parsed."); }
            } else { setImagePrompts([]); logger.log("/prompts_imgs.txt not found."); }
        } else if (!isOpen) {
            // Reset prompts when modal closes
            setImagePrompts([]);
        }
    }, [isOpen, parsedFiles, isMounted]); // Add isMounted dependency


    // Fetch buckets (runs only client-side after mount)
    const fetchBuckets = useCallback(async () => {
         if (!isMounted) return; // Don't fetch if not mounted
         setIsLoadingBuckets(true); setFetchError(null); setBuckets([]); setSelectedBucket('');
         try {
             const result = await listPublicBuckets();
             if (!isMounted) return; // Check again after await
             if (result.success && result.data) {
                 setBuckets(result.data);
                 if (result.data.length > 0) setSelectedBucket(result.data[0].name);
                 else { setFetchError("Не найдено публичных бакетов."); toast.warn("Публичные бакеты не найдены."); }
             } else { const e = result.error || "Не удалось загрузить бакеты."; setFetchError(e); toast.error(e); }
         } catch (error) { const e = "Ошибка при загрузке бакетов."; setFetchError(e); toast.error(e); logger.error("Fetch buckets error:", error); }
         finally { if (isMounted) setIsLoadingBuckets(false); }
    }, [isMounted]); // Add isMounted dependency

    useEffect(() => {
        if (isOpen && isMounted) { // Ensure mounted before fetching
            fetchBuckets(); setSelectedFiles(null); setUploadResults([]); setUploadError(null); setCopiedUrlIndex(null);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    }, [isOpen, fetchBuckets, isMounted]); // Add isMounted dependency


    // --- Core Logic ---
    const performSwap = useCallback((placeholder: string, newUrl: string | null | undefined, source: 'google' | 'upload' | 'manual'): boolean => {
        if (!newUrl || typeof newUrl !== 'string' || !newUrl.trim()) {
            toast.error(`URL для замены "${placeholder}" пуст или некорректен.`);
            setImagePrompts(prev => prev.map(p => p.placeholder === placeholder ? { ...p, status: 'error_swap', errorMessage: 'Предоставлен невалидный URL' } : p));
            return false;
        }

        let swapOccurred = false;
        const updatedParsedFiles = parsedFiles.map(file => {
            // Ensure content exists before trying to replace
            if (file.path === '/prompts_imgs.txt' || !file.content || !file.content.includes(placeholder)) return file;

            logger.log(`Attempting swap for "${placeholder}" in ${file.path} with URL from ${source}`);
            swapOccurred = true;
            try {
                const newContent = file.content.replaceAll(placeholder, newUrl);
                if (newContent !== file.content) {
                    logger.log(`Successfully swapped "${placeholder}" -> "${newUrl}" in ${file.path}`);
                    return { ...file, content: newContent };
                } else {
                    logger.warn(`Placeholder "${placeholder}" found via includes(), but replaceAll had no effect in ${file.path}`);
                    return file;
                }
            } catch (e) { logger.error(`Error during string replaceAll in ${file.path}:`, e); return file; }
        });

        if (swapOccurred) {
            onUpdateParsedFiles(updatedParsedFiles); // Update parent state
            setImagePrompts(prev => prev.map(p =>
                p.placeholder === placeholder
                ? { ...p, status: source === 'google' ? 'swapped_google' : (source === 'upload' ? 'swapped_upload' : 'swapped_upload'), currentUrl: newUrl, errorMessage: undefined } // Treat manual like upload for status
                : p
            ));
            logger.log(`Swap successful for "${placeholder}", updated parent state.`);
            return true;
        } else {
            logger.warn(`performSwap: Placeholder "${placeholder}" not found via includes() in any file content during mapping.`);
            // Only set error if not already swapped
            setImagePrompts(prev => prev.map(p =>
                p.placeholder === placeholder && !p.status.startsWith('swapped_')
                 ? { ...p, status: 'error_swap', errorMessage: 'Placeholder не найден при замене' } : p
             ));
             return false;
        }
    }, [parsedFiles, onUpdateParsedFiles]); // Keep dependencies

    // --- Handlers (remain largely the same, wrapped in useCallback) ---
    const handleGoogleSwap = useCallback(async (placeholder: string, prompt: string) => {
        logger.log(`Google Swap triggered for: ${placeholder}`);
        setImagePrompts(prev => prev.map(p => p.placeholder === placeholder ? { ...p, status: 'searching' } : p));
        try {
            const result = await searchAndGetFirstImageUrl(prompt);
            if (result.success && result.imageUrl) {
                const swapped = performSwap(placeholder, result.imageUrl, 'google');
                if (!swapped) toast.error(`Не удалось найти placeholder "${placeholder}" для замены.`);
                else toast.success(`"${placeholder.substring(0, 20)}..." заменен картинкой из Google!`);
            } else {
                toast.error(`Google Поиск не дал результатов для: "${prompt.substring(0, 30)}..."`);
                setImagePrompts(prev => prev.map(p => p.placeholder === placeholder ? { ...p, status: 'error_search', errorMessage: result.error || 'Google не нашел' } : p));
            }
        } catch (error) { toast.error("Ошибка при поиске в Google."); logger.error("Google Swap Error:", error); setImagePrompts(prev => prev.map(p => p.placeholder === placeholder ? { ...p, status: 'error_search', errorMessage: 'Ошибка сети' } : p)); }
    }, [performSwap]);

    const handleOpenGoogleSearch = useCallback((prompt: string) => {
        const searchUrl = `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(prompt)}`;
        logger.log(`Opening Google Image search tab: ${searchUrl}`);
        openLink(searchUrl); // Use context function
    }, [openLink]);

    const handleManualUrlInputChange = useCallback((id: string, value: string) => {
        setImagePrompts(prev => prev.map(p => p.id === id ? { ...p, manualUrlInput: value } : p));
        setActiveManualInput(id); // Track active input
    }, []);

    const handleManualUrlSwap = useCallback((placeholder: string, manualUrl: string) => {
         if (!manualUrl || !manualUrl.trim() || !manualUrl.startsWith('http')) {
             toast.error("Введите валидный URL (https://...)");
             return;
         }
         logger.log(`Manual Swap triggered for: ${placeholder} with URL: ${manualUrl}`);
         setImagePrompts(prev => prev.map(p => p.placeholder === placeholder ? { ...p, status: 'swapping' } : p)); // Indicate swapping
         const swapped = performSwap(placeholder, manualUrl.trim(), 'manual');
         if (swapped) {
            toast.success(`"${placeholder.substring(0, 20)}..." заменен вручную!`);
            // Optionally clear the input after successful swap
             setImagePrompts(prev => prev.map(p => p.placeholder === placeholder ? { ...p, manualUrlInput: '' } : p));
             setActiveManualInput(null);
         } else {
             toast.error(`Не удалось найти placeholder "${placeholder}" для ручной замены.`);
             // Status already set to error_swap by performSwap
         }

    }, [performSwap]);


    const handleSpecificUploadAndSwap = useCallback((placeholder: string) => {
        if (!selectedBucket) { toast.error("Сначала выберите бакет."); return; }
        if (specificUploadInputRef.current) {
            specificUploadInputRef.current.setAttribute('data-placeholder', placeholder);
            specificUploadInputRef.current.click();
        }
    }, [selectedBucket]);

    const handleSpecificFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
        const placeholder = event.target.getAttribute('data-placeholder');
        const file = event.target.files?.[0];
        const inputElement = event.target;
        if (!placeholder || !file || !selectedBucket) { toast.error("Ошибка: не выбран файл, плейсхолдер или бакет."); if (inputElement) inputElement.value = ""; return; }
        logger.log(`Upload & Swap for: ${placeholder} with file ${file.name}`);
        setImagePrompts(prev => prev.map(p => p.placeholder === placeholder ? { ...p, status: 'uploading' } : p));
        setIsUploading(true);
        const formData = new FormData(); formData.append("bucketName", selectedBucket); formData.append("files", file);
        try {
            const result = await uploadBatchImages(formData);
            if (result.success && result.data && result.data[0]?.url) {
                 const uploadedUrl = result.data[0].url;
                 const swapped = performSwap(placeholder, uploadedUrl, 'upload');
                 if (!swapped) toast.error(`Не найден placeholder "${placeholder}" для замены.`);
                 else toast.success(`"${placeholder.substring(0, 20)}..." заменен загруженной картинкой!`);
            } else { const errorMsg = result.error || result.failed?.[0]?.error || "Ошибка загрузки"; toast.error(`Ошибка загрузки для "${placeholder}": ${errorMsg}`); setImagePrompts(prev => prev.map(p => p.placeholder === placeholder ? { ...p, status: 'error_upload', errorMessage: errorMsg } : p)); }
        } catch (error) { toast.error(`Крит. ошибка загрузки для "${placeholder}".`); logger.error("Specific Upload Error:", error); setImagePrompts(prev => prev.map(p => p.placeholder === placeholder ? { ...p, status: 'error_upload', errorMessage: 'Ошибка сети' } : p)); }
        finally { setIsUploading(false); if (inputElement) inputElement.value = ""; }
    }, [selectedBucket, performSwap]);

    const handleSwapAll = useCallback(async () => {
        const pendingPrompts = imagePrompts.filter(p => p.status === 'pending');
        if (pendingPrompts.length === 0) { toast.info("Нет плейсхолдеров для авто-замены."); return; }
        setIsSwappingAll(true); toast.info(`Запускаю авто-замену ${pendingPrompts.length} картинок через Google...`);
        let successCount = 0, errorCount = 0;
        for (const promptItem of pendingPrompts) {
            setImagePrompts(prev => prev.map(p => p.id === promptItem.id ? { ...p, status: 'searching' } : p));
            try {
                const result = await searchAndGetFirstImageUrl(promptItem.prompt);
                if (result.success && result.imageUrl) {
                    const swapped = performSwap(promptItem.placeholder, result.imageUrl, 'google');
                    if (swapped) successCount++; else errorCount++;
                } else { setImagePrompts(prev => prev.map(p => p.id === promptItem.id ? { ...p, status: 'error_search', errorMessage: result.error || 'Google не нашел' } : p)); errorCount++; }
            } catch (error) { setImagePrompts(prev => prev.map(p => p.id === promptItem.id ? { ...p, status: 'error_search', errorMessage: 'Ошибка сети' } : p)); errorCount++; }
            await new Promise(resolve => setTimeout(resolve, 200)); // Small delay
        }
        if (successCount > 0) toast.success(`Авто-замена Google: ${successCount} успешно!`);
        if (errorCount > 0) toast.error(`Авто-замена Google: ${errorCount} ошибок.`);
        setIsSwappingAll(false);
    }, [imagePrompts, performSwap]);

    const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        setSelectedFiles(event.target.files); setUploadResults([]); setUploadError(null); setCopiedUrlIndex(null);
    }, []);

    const handleUpload = useCallback(async () => {
         if (!selectedBucket || !selectedFiles || selectedFiles.length === 0) { toast.warn("Выберите бакет и файлы для загрузки."); return; }
         setIsUploading(true); setUploadError(null); setUploadResults([]); setCopiedUrlIndex(null);
         const formData = new FormData(); formData.append("bucketName", selectedBucket);
         const originalFiles = Array.from(selectedFiles); originalFiles.forEach(file => formData.append("files", file));
         try {
             const result = await uploadBatchImages(formData);
             let finalResults: UploadResult[] = [];
             if (result.success) {
                  if (result.data) {
                      finalResults = result.data.map(d => ({ name: d.name, url: d.url, error: undefined }));
                  }
                  if (result.failed) {
                      finalResults = finalResults.concat(result.failed.map(f => ({ name: f.name, url: undefined, error: f.error })));
                  }
                  const successCount = finalResults.filter(r => r.url).length;
                  const errorCount = finalResults.filter(r => r.error).length;
                  if (successCount > 0) toast.success(`${successCount} из ${originalFiles.length} файлов успешно загружено!`);
                  if (errorCount > 0) { const generalErrorMsg = result.error || `${errorCount} файлов не удалось загрузить.`; setUploadError(generalErrorMsg); toast.error(generalErrorMsg); }
                  // Ensure all original files have a result entry
                   const resultSet = new Set(finalResults.map(r => r.name));
                   originalFiles.forEach(file => { if (!resultSet.has(file.name)) { finalResults.push({ name: file.name, error: "No result returned" }); } });

             } else { // Overall failure
                 const errorMsg = result.error || "Не удалось загрузить файлы."; setUploadError(errorMsg); toast.error(errorMsg); finalResults = originalFiles.map(file => ({ name: file.name, error: errorMsg }));
             }
             setUploadResults(finalResults);
         } catch (error) { const errorMsg = "Критическая ошибка при загрузке."; setUploadError(errorMsg); toast.error(errorMsg); logger.error("Upload error:", error); setUploadResults(originalFiles.map(file => ({ name: file.name, error: "Critical error" }))); }
         finally { setIsUploading(false); if (fileInputRef.current) fileInputRef.current.value = ""; setSelectedFiles(null); }
    }, [selectedBucket, selectedFiles]);

    const copyUrl = useCallback((url: string | undefined, index: number) => {
         if (!url || typeof url !== 'string') { toast.error("Неверный URL"); return; }
         navigator.clipboard.writeText(url).then(() => { setCopiedUrlIndex(index); toast.success("URL скопирован!"); setTimeout(() => setCopiedUrlIndex(null), 1500); }).catch((err) => { toast.error("Не удалось скопировать URL"); logger.error("Copy URL error:", err); });
    }, []);


    // --- Render ---
    const anyLoading = isUploading || isSwappingAll || imagePrompts.some(p => ['searching', 'uploading', 'swapping'].includes(p.status));

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div /* Backdrop */
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[70] p-4"
                    onClick={onClose}
                >
                    <motion.div /* Modal Content */
                        initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                        className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-4xl border border-cyan-700/50 relative overflow-hidden flex flex-col max-h-[90vh]" // Wider max-width
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex-shrink-0 flex justify-between items-center mb-4">
                            <h2 className="text-xl font-semibold text-cyan-300 flex items-center gap-2">
                                <FaImages /> Инструменты для Картинок
                            </h2>
                            <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors p-1 rounded-full hover:bg-gray-700" aria-label="Close modal">
                                <FaXmark size={20} />
                            </button>
                        </div>

                        {/* Content Area - Potentially split view */}
                        <div className="flex-grow overflow-y-auto pr-2 simple-scrollbar grid grid-cols-1 md:grid-cols-2 gap-6">

                            {/* --- Left Column: Placeholder Automation --- */}
                            <div className="border border-indigo-600/50 rounded-lg p-4 bg-indigo-900/10 flex flex-col">
                                <div className="flex justify-between items-center mb-3 flex-shrink-0">
                                     <h3 className="text-lg font-medium text-indigo-300">Авто-замена Плейсхолдеров <span className='text-xs opacity-70'>({imagePrompts.length})</span></h3>
                                     <Tooltip text="Авто-поиск Google и замена для всех ожидающих" position="left">
                                          <button onClick={handleSwapAll} disabled={anyLoading || imagePrompts.every(p => p.status !== 'pending')} className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full bg-indigo-600 hover:bg-indigo-500 text-white transition shadow disabled:opacity-50 disabled:cursor-not-allowed">
                                             {isSwappingAll ? <FaSpinner className="animate-spin" /> : <FaGoogle />} Заменить все
                                         </button>
                                     </Tooltip>
                                </div>

                                {/* <<<--- Wrap Conditional Rendering --- >>> */}
                                {isMounted && ( // Only render this section client-side
                                    <>
                                        {imagePrompts.length === 0 ? (
                                            <p className="text-center text-gray-500 text-sm mt-4 flex-grow flex items-center justify-center">Файл <code className="text-xs bg-gray-700 px-1 rounded mx-1">/prompts_imgs.txt</code> не найден или пуст.</p>
                                        ) : (
                                            <div className="space-y-2 flex-grow overflow-y-auto simple-scrollbar pr-1">
                                                {imagePrompts.map((item) => (
                                                    <div key={item.id} className="flex items-center gap-2 p-2 rounded-md bg-gray-700/50 border border-gray-600/50 text-xs">
                                                        {/* Status Indicator */}
                                                        <div className="flex-shrink-0 w-4 h-4 flex items-center justify-center">
                                                             {item.status === 'pending' && <FaImage className="text-gray-500" title="Ожидание" />} {(item.status === 'searching' || item.status === 'uploading' || item.status === 'swapping') && <FaSpinner className="animate-spin text-blue-400" title="В процессе..." />} {(item.status === 'swapped_google' || item.status === 'swapped_upload') && <FaCheck className="text-green-500" title="Заменено!" />} {(item.status === 'error_search' || item.status === 'error_upload' || item.status === 'error_swap') && <Tooltip text={item.errorMessage || 'Ошибка'} position="top"><FaTriangleExclamation className="text-red-500 cursor-help" title="Ошибка" /></Tooltip>}
                                                        </div>
                                                        {/* Placeholder, Prompt, Manual Input */}
                                                        <div className="flex-grow overflow-hidden space-y-1">
                                                            <p className="text-gray-300 font-mono truncate" title={item.placeholder}>{item.placeholder}</p>
                                                            <p className="text-gray-400 truncate italic" title={item.prompt}>{item.prompt}</p>
                                                            {/* Manual URL Input */}
                                                            <div className="flex items-center gap-1">
                                                                <Input
                                                                    type="url"
                                                                    placeholder="Вставь URL вручную..."
                                                                    value={item.manualUrlInput}
                                                                    onChange={(e) => handleManualUrlInputChange(item.id, e.target.value)}
                                                                    onFocus={() => setActiveManualInput(item.id)}
                                                                    onBlur={() => setTimeout(() => setActiveManualInput(null), 150)} // Delay blur to allow button click
                                                                    disabled={anyLoading || item.status.startsWith('swapped_')}
                                                                    className={`h-6 px-1.5 text-xs bg-gray-600 border-gray-500 placeholder-gray-400 focus:ring-indigo-500 focus:border-indigo-500 flex-grow ${activeManualInput === item.id ? 'ring-1 ring-indigo-500' : ''}`}
                                                                />
                                                                 <Tooltip text="Заменить на URL из поля" position="top">
                                                                    <button
                                                                        onClick={() => handleManualUrlSwap(item.placeholder, item.manualUrlInput)}
                                                                        disabled={anyLoading || !item.manualUrlInput.trim() || !item.manualUrlInput.startsWith('http') || item.status.startsWith('swapped_')}
                                                                        className="p-1 rounded text-gray-400 hover:text-white hover:bg-purple-600/50 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                                                                    > <FaPaperPlane size={11}/> </button>
                                                                 </Tooltip>
                                                            </div>
                                                        </div>
                                                        {/* Action Buttons */}
                                                        <div className="flex-shrink-0 flex flex-col gap-1 ml-2">
                                                            {/* Auto Google Swap */}
                                                            <Tooltip text="Авто-поиск в Google и Замена" position="left">
                                                                 <button onClick={() => handleGoogleSwap(item.placeholder, item.prompt)} disabled={anyLoading || item.status.startsWith('swapped_')} className="p-1 rounded text-gray-400 hover:text-white hover:bg-blue-600/50 disabled:opacity-50 disabled:cursor-not-allowed"> <FaGoogle size={12}/> </button>
                                                             </Tooltip>
                                                             {/* Open Google Search Tab */}
                                                            <Tooltip text="Открыть Google Картинки в новой вкладке" position="left">
                                                                <button onClick={() => handleOpenGoogleSearch(item.prompt)} disabled={anyLoading} className="p-1 rounded text-gray-400 hover:text-white hover:bg-red-600/50 disabled:opacity-50"> <FaLink size={12}/> </button>
                                                            </Tooltip>
                                                            {/* Upload & Swap */}
                                                             <Tooltip text="Загрузить свой файл и Заменить" position="left">
                                                                 <button onClick={() => handleSpecificUploadAndSwap(item.placeholder)} disabled={anyLoading || !selectedBucket || item.status.startsWith('swapped_')} className="p-1 rounded text-gray-400 hover:text-white hover:bg-green-600/50 disabled:opacity-50 disabled:cursor-not-allowed"> <FaUpload size={12}/> </button>
                                                             </Tooltip>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </>
                                )}
                                {!isMounted && ( // Show a placeholder during SSR/initial mount
                                     <div className="text-center text-gray-500 text-sm mt-4 flex-grow flex items-center justify-center">
                                        <FaSpinner className="animate-spin mr-2" /> Загрузка данных...
                                    </div>
                                )}
                                {/* Hidden input for specific uploads */}
                                <input type="file" ref={specificUploadInputRef} onChange={handleSpecificFileChange} accept="image/*, video/*, audio/*" style={{ display: 'none' }} aria-hidden="true"/>
                            </div>

                            {/* --- Right Column: Manual Batch Upload (Unchanged) --- */}
                            <div className="border border-cyan-600/30 rounded-lg p-4 bg-cyan-900/10 flex flex-col">
                                <h3 className="text-lg font-medium text-cyan-300 mb-3 flex-shrink-0">Ручная Загрузка Файлов</h3>
                                <div className="space-y-4 flex-grow overflow-y-auto simple-scrollbar pr-1">
                                    {/* Bucket Selection */}
                                    <div>
                                        <label htmlFor="bucket-select-manual" className="block text-sm font-medium text-gray-300 mb-1">1. Бакет</label>
                                        {isLoadingBuckets ? (<div className="text-gray-400"><FaSpinner className="animate-spin inline mr-1"/> Загрузка...</div>)
                                        : fetchError ? (<div className="text-red-400 text-sm"><FaTriangleExclamation className="inline mr-1"/> {fetchError}</div>)
                                        : buckets.length > 0 ? ( <select id="bucket-select-manual" name="bucket-select-manual" value={selectedBucket} onChange={(e) => setSelectedBucket(e.target.value)} className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:ring-cyan-500 focus:border-cyan-500 text-sm" disabled={isUploading || isSwappingAll}> {buckets.map((bucket) => (<option key={bucket.id} value={bucket.name}>{bucket.name}</option>))} </select> )
                                        : (<div className="text-yellow-400 text-sm">Публичные бакеты не найдены.</div>)}
                                    </div>
                                    {/* File Input */}
                                    <div className="mt-4">
                                        <label htmlFor="file-upload-manual" className="block text-sm font-medium text-gray-300 mb-1">2. Файлы</label>
                                        <input id="file-upload-manual" ref={fileInputRef} type="file" multiple accept="image/*, video/*, audio/*" onChange={handleFileChange} className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-cyan-600/20 file:text-cyan-300 hover:file:bg-cyan-600/40 disabled:opacity-50 disabled:cursor-not-allowed" disabled={isUploading || isSwappingAll || !selectedBucket || buckets.length === 0} aria-label="Choose files for manual upload"/>
                                        {selectedFiles && <p className="text-xs text-gray-400 mt-1"> Выбрано: {selectedFiles.length} файлов </p>}
                                    </div>
                                    {/* Upload Button */}
                                    <button onClick={handleUpload} disabled={isUploading || isSwappingAll || !selectedBucket || !selectedFiles || selectedFiles.length === 0} className="mt-4 w-full flex-shrink-0 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-md font-semibold transition shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none">
                                        {isUploading ? <><FaSpinner className="animate-spin" /> Загрузка...</> : <><FaUpload /> 3. Загрузить выбранные</>}
                                    </button>
                                    {/* Upload Results */}
                                    {uploadResults.length > 0 && (
                                        <div className="border-t border-gray-700 pt-4 mt-4">
                                            <h3 className="text-base font-medium text-gray-300 mb-2">Результаты ручной загрузки:</h3>
                                            <ul className="space-y-2 max-h-40 overflow-y-auto simple-scrollbar pr-1">
                                                {uploadResults.map((result, index) => ( <li key={`${result.name}-manual-${index}`} className={`flex items-center justify-between p-2 rounded-md text-sm ${result.url ? 'bg-green-900/30 border-green-700/50' : 'bg-red-900/30 border-red-700/50'}`}> <span className={`truncate font-mono text-xs mr-2 flex-1 ${result.url ? 'text-gray-300' : 'text-red-300'}`} title={result.name}>{result.name}</span> {result.url ? (<Tooltip text="Копировать URL" position="left"><button onClick={() => copyUrl(result.url, index)} className={`p-1 rounded transition ${copiedUrlIndex === index ? 'text-green-400 scale-110' : 'text-gray-400 hover:text-cyan-300'}`}>{copiedUrlIndex === index ? <FaCheck /> : <FaCopy />}</button></Tooltip>) : (<Tooltip text={result.error || "Ошибка"} position="left"><FaTriangleExclamation className="text-red-400 flex-shrink-0" /></Tooltip>)} </li> ))}
                                            </ul>
                                        </div>
                                    )}
                                    {uploadError && uploadResults.length === 0 && ( <div className="mt-4 text-red-400 text-sm flex items-center gap-1"> <FaTriangleExclamation /> {uploadError} </div> )}
                                </div>
                            </div>
                        </div> {/* End Grid Content Area */}
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

ImageToolsModal.displayName = 'ImageToolsModal'; // Keep display name