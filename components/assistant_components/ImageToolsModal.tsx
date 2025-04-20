"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    FaImages, FaXmark, FaUpload, FaCopy, FaCheck, FaSpinner, FaTriangleExclamation,
    FaGoogle, FaImage, FaSync // Added Google, Image, Sync icons
} from 'react-icons/fa6';
import { listPublicBuckets, uploadBatchImages } from '@/app/actions';
import { searchAndGetFirstImageUrl } from '@/app/repo-xml/google_actions'; // Use correct path
import { Bucket } from '@supabase/storage-js';
import { toast } from 'sonner';
import { Tooltip } from '../AICodeAssistant';
import { FileEntry as ParsedFileEntry } from "@/hooks/useCodeParsingAndValidation";
import { logger } from '@/lib/logger'; // Import logger

// --- Helper Type ---
interface ImagePrompt {
    id: string;
    placeholder: string;
    prompt: string;
    status: 'pending' | 'searching' | 'uploading' | 'swapping' | 'swapped_google' | 'swapped_upload' | 'error_search' | 'error_upload' | 'error_swap';
    currentUrl?: string | null;
    errorMessage?: string;
}

// --- Props ---
interface ImageToolsModalProps {
    isOpen: boolean;
    onClose: () => void;
    parsedFiles: ParsedFileEntry[]; // Receive current parsed files
    onUpdateParsedFiles: (updatedFiles: ParsedFileEntry[]) => void; // Callback to update parent state
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
    parsedFiles, // Use prop
    onUpdateParsedFiles // Use prop
}) => {
    // --- State ---
    const [buckets, setBuckets] = useState<Bucket[]>([]);
    const [selectedBucket, setSelectedBucket] = useState<string>('');
    const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
    const [uploadResults, setUploadResults] = useState<UploadResult[]>([]);
    const [isLoadingBuckets, setIsLoadingBuckets] = useState(false);
    const [isUploading, setIsUploading] = useState(false); // For manual batch upload
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [uploadError, setUploadError] = useState<string | null>(null); // For manual batch upload errors
    const [copiedUrlIndex, setCopiedUrlIndex] = useState<number | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null); // For manual batch upload
    const specificUploadInputRef = useRef<HTMLInputElement>(null); // For specific placeholder upload

    // State for image prompts parsed from /prompts_imgs.txt
    const [imagePrompts, setImagePrompts] = useState<ImagePrompt[]>([]);
    // State for loading indicator during "Swap All" operation
    const [isSwappingAll, setIsSwappingAll] = useState(false);

    // --- Effects ---
    // Parse prompts_imgs.txt when modal opens or parsedFiles prop changes
    useEffect(() => {
        if (isOpen && parsedFiles.length > 0) {
            logger.log("ImageToolsModal: Checking for /prompts_imgs.txt");
            const promptsFile = parsedFiles.find(f => f.path === '/prompts_imgs.txt');
            if (promptsFile) {
                // Use toast only if prompts are actually found and parsed
                const lines = promptsFile.content.split('\n');
                const prompts: ImagePrompt[] = lines
                    .map((line, index) => {
                        const match = line.trim().match(/^-?\s*([^:]+):\s*(.+)$/);
                        if (match) {
                            const placeholder = match[1].trim();
                            const prompt = match[2].trim();
                            const existsInCode = parsedFiles.some(f =>
                                f.path !== '/prompts_imgs.txt' && f.content.includes(placeholder)
                            );
                            return {
                                id: `${placeholder}-${index}`,
                                placeholder,
                                prompt,
                                status: existsInCode ? 'pending' : 'error_swap',
                                errorMessage: existsInCode ? undefined : 'Placeholder не найден в коде',
                            } as ImagePrompt;
                        }
                        return null;
                    })
                    .filter((p): p is ImagePrompt => p !== null);

                if (prompts.length > 0) {
                    toast.success(`🤖 Обнаружен файл /prompts_imgs.txt с ${prompts.length} промптами!`);
                    setImagePrompts(prompts);
                    logger.log("Parsed image prompts:", prompts);
                } else {
                    setImagePrompts([]);
                     logger.log("/prompts_imgs.txt found but no valid prompts parsed.");
                 }

            } else {
                setImagePrompts([]);
                logger.log("/prompts_imgs.txt not found.");
            }
        } else if (!isOpen) {
            setImagePrompts([]); // Clear when closing
        }
    }, [isOpen, parsedFiles]); // Rerun when parsedFiles prop changes

    // Fetch buckets on open
    const fetchBuckets = useCallback(async () => {
        setIsLoadingBuckets(true);
        setFetchError(null);
        setBuckets([]);
        setSelectedBucket('');
        try {
            const result = await listPublicBuckets();
            if (result.success && result.data) {
                setBuckets(result.data);
                if (result.data.length > 0) {
                    setSelectedBucket(result.data[0].name);
                } else {
                    setFetchError("Не найдено публичных бакетов. Создайте их в Supabase Storage.");
                    toast.warn("Публичные бакеты не найдены. Создайте их в Supabase Storage.");
                }
            } else {
                const errorMsg = result.error || "Не удалось загрузить список бакетов.";
                setFetchError(errorMsg);
                toast.error(errorMsg);
            }
        } catch (error) {
            const errorMsg = "Ошибка при загрузке бакетов.";
            setFetchError(errorMsg);
            toast.error(errorMsg);
            logger.error("Fetch buckets error:", error);
        } finally {
            setIsLoadingBuckets(false);
        }
    }, []);

    useEffect(() => {
        if (isOpen) {
            fetchBuckets();
            // Reset manual upload state
            setSelectedFiles(null);
            setUploadResults([]);
            setUploadError(null);
            setCopiedUrlIndex(null);
            if (fileInputRef.current) fileInputRef.current.value = "";
            // Keep imagePrompts state as it's derived from parsedFiles
        }
    }, [isOpen, fetchBuckets]);

    // --- Core Image Swapping Logic ---
    const performSwap = useCallback((placeholder: string, newUrl: string, source: 'google' | 'upload'): boolean => {
        let swapOccurred = false;
        const updatedParsedFiles = parsedFiles.map(file => {
            if (file.path === '/prompts_imgs.txt' || !file.content?.includes(placeholder)) {
                return file; // Skip prompts file or files without the placeholder
            }

            logger.log(`Attempting swap for "${placeholder}" in ${file.path}`);
            swapOccurred = true; // Assume swap will happen if placeholder is found
            try {
                // Basic but often sufficient replacement
                // For more robustness, consider context-aware replacement (e.g., only in src="", href="", etc.)
                const newContent = file.content.replaceAll(placeholder, newUrl);
                if (newContent !== file.content) {
                     logger.log(`Successfully swapped "${placeholder}" -> "${newUrl}" in ${file.path}`);
                    return { ...file, content: newContent };
                } else {
                     logger.warn(`Placeholder "${placeholder}" included but replaceAll had no effect in ${file.path}`);
                    return file; // Return original if replaceAll didn't change anything (shouldn't happen if includes() was true)
                 }

            } catch (e) {
                logger.error(`Error during string replaceAll in ${file.path}:`, e);
                return file; // Return original on error
            }
        });

        if (swapOccurred) {
            onUpdateParsedFiles(updatedParsedFiles); // Update parent state
            // Update local prompt status
            setImagePrompts(prev => prev.map(p =>
                p.placeholder === placeholder
                ? { ...p, status: source === 'google' ? 'swapped_google' : 'swapped_upload', currentUrl: newUrl, errorMessage: undefined }
                : p
            ));
            logger.log(`Swap successful for "${placeholder}", updated parent state.`);
            return true;
        } else {
            logger.warn(`performSwap: Placeholder "${placeholder}" not found via includes() in any file content during mapping (unexpected).`);
            // Update status to error if not found during the map phase (might happen with race conditions?)
            setImagePrompts(prev => prev.map(p =>
                p.placeholder === placeholder && p.status !== 'swapped_google' && p.status !== 'swapped_upload' // Avoid overwriting success
                 ? { ...p, status: 'error_swap', errorMessage: 'Placeholder не найден в коде при замене' }
                 : p
             ));
             return false;
        }
    }, [parsedFiles, onUpdateParsedFiles]);

    // --- Handlers for New Buttons ---
    const handleGoogleSwap = useCallback(async (placeholder: string, prompt: string) => {
        logger.log(`Google Swap triggered for: ${placeholder}`);
        setImagePrompts(prev => prev.map(p => p.placeholder === placeholder ? { ...p, status: 'searching' } : p));
        try {
            const result = await searchAndGetFirstImageUrl(prompt);
            if (result.success && result.imageUrl) {
                const swapped = performSwap(placeholder, result.imageUrl, 'google');
                 if (!swapped) {
                    // performSwap already updated status to error_swap
                    toast.error(`Не удалось найти placeholder "${placeholder}" для замены найденной картинкой.`);
                 } else {
                     toast.success(`"${placeholder}" заменен картинкой из Google!`);
                 }
            } else {
                toast.error(`Google Поиск не дал результатов для: "${prompt.substring(0, 30)}..."`);
                setImagePrompts(prev => prev.map(p => p.placeholder === placeholder ? { ...p, status: 'error_search', errorMessage: result.error || 'Google не нашел картинку' } : p));
            }
        } catch (error) {
            toast.error("Ошибка при поиске в Google.");
            logger.error("Google Swap Error:", error);
            setImagePrompts(prev => prev.map(p => p.placeholder === placeholder ? { ...p, status: 'error_search', errorMessage: 'Ошибка сети/сервера' } : p));
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
        const inputElement = event.target; // Keep ref to reset later

        if (!placeholder || !file || !selectedBucket) {
            toast.error("Ошибка: не выбран файл, плейсхолдер или бакет.");
            if (inputElement) inputElement.value = ""; // Reset input
            return;
        }

        logger.log(`Upload & Swap triggered for: ${placeholder} with file ${file.name}`);
        setImagePrompts(prev => prev.map(p => p.placeholder === placeholder ? { ...p, status: 'uploading' } : p));
        setIsUploading(true); // Use general uploading state for specific upload too

        const formData = new FormData();
        formData.append("bucketName", selectedBucket);
        formData.append("files", file);

        try {
            const result = await uploadBatchImages(formData); // Use existing batch action
            if (result.success && result.data && result.data[0]?.url) {
                 const uploadedUrl = result.data[0].url;
                 const swapped = performSwap(placeholder, uploadedUrl, 'upload');
                 if (!swapped) {
                    toast.error(`Не удалось найти placeholder "${placeholder}" для замены загруженной картинкой.`);
                 } else {
                     toast.success(`"${placeholder}" заменен загруженной картинкой!`);
                 }
            } else {
                const errorMsg = result.error || result.failed?.[0]?.error || "Ошибка загрузки";
                toast.error(`Ошибка загрузки для "${placeholder}": ${errorMsg}`);
                setImagePrompts(prev => prev.map(p => p.placeholder === placeholder ? { ...p, status: 'error_upload', errorMessage: errorMsg } : p));
            }
        } catch (error) {
            toast.error(`Крит. ошибка загрузки для "${placeholder}".`);
            logger.error("Specific Upload Error:", error);
            setImagePrompts(prev => prev.map(p => p.placeholder === placeholder ? { ...p, status: 'error_upload', errorMessage: 'Ошибка сети/сервера' } : p));
        } finally {
            setIsUploading(false);
             if (inputElement) inputElement.value = ""; // Reset input value after attempt
        }
    }, [selectedBucket, performSwap]);

    const handleSwapAll = useCallback(async () => {
        const pendingPrompts = imagePrompts.filter(p => p.status === 'pending');
         if (pendingPrompts.length === 0) {
             toast.info("Нет необработанных плейсхолдеров для авто-замены.");
             return;
         }
         setIsSwappingAll(true);
         toast.info(`Запускаю авто-замену ${pendingPrompts.length} картинок через Google...`);
         let successCount = 0;
         let errorCount = 0;

         for (const promptItem of pendingPrompts) {
            setImagePrompts(prev => prev.map(p => p.id === promptItem.id ? { ...p, status: 'searching' } : p));
             try {
                 const result = await searchAndGetFirstImageUrl(promptItem.prompt);
                 if (result.success && result.imageUrl) {
                     const swapped = performSwap(promptItem.placeholder, result.imageUrl, 'google');
                      if (swapped) { successCount++; }
                      else { errorCount++; } // performSwap already updated status
                 } else {
                      setImagePrompts(prev => prev.map(p => p.id === promptItem.id ? { ...p, status: 'error_search', errorMessage: result.error || 'Google не нашел' } : p));
                      errorCount++;
                 }
             } catch (error) {
                 setImagePrompts(prev => prev.map(p => p.id === promptItem.id ? { ...p, status: 'error_search', errorMessage: 'Ошибка сети' } : p));
                 errorCount++;
             }
             // Optional: Add delay between requests to be nicer to Google
             await new Promise(resolve => setTimeout(resolve, 200)); // 200ms delay
         }

         if (successCount > 0) toast.success(`Авто-замена Google завершена: ${successCount} успешно!`);
         if (errorCount > 0) toast.error(`Авто-замена Google: ${errorCount} ошибок.`);
         setIsSwappingAll(false);

     }, [imagePrompts, performSwap]);

    // --- Existing Upload Handlers (Manual Batch Upload) ---
    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setSelectedFiles(event.target.files);
        setUploadResults([]); setUploadError(null); setCopiedUrlIndex(null);
    };

    const handleUpload = async () => {
        if (!selectedBucket || !selectedFiles || selectedFiles.length === 0) {
            toast.warn("Выберите бакет и файлы для загрузки."); return;
        }
        setIsUploading(true); setUploadError(null); setUploadResults([]); setCopiedUrlIndex(null);
        const formData = new FormData(); formData.append("bucketName", selectedBucket);
        const originalFiles = Array.from(selectedFiles); originalFiles.forEach(file => formData.append("files", file));
        try {
            const result = await uploadBatchImages(formData);
            let finalResults: UploadResult[] = [];
            if (result.success && result.data) {
                finalResults = result.data.map(d => ({ name: d.name, url: typeof d.url === 'string' ? d.url : undefined, error: d.error }));
                const successCount = finalResults.filter(r => r.url).length;
                const errorCount = finalResults.filter(r => r.error).length;
                if (successCount > 0) toast.success(`${successCount} из ${originalFiles.length} файлов успешно загружено!`);
                if (errorCount > 0) { const generalErrorMsg = result.error || `${errorCount} файлов не удалось загрузить.`; setUploadError(generalErrorMsg); toast.error(generalErrorMsg); const successfulNames = new Set(finalResults.filter(r => r.url).map(r => r.name)); originalFiles.forEach(file => { if (!successfulNames.has(file.name) && !finalResults.some(r => r.name === file.name && r.error)) { finalResults.push({ name: file.name, error: "Upload failed" }); } }); }
                else if (successCount === 0 && !result.error) { const errorMsg = "Загрузка завершилась, но не удалось получить URL."; setUploadError(errorMsg); toast.error(errorMsg); finalResults = originalFiles.map(file => ({ name: file.name, error: "No URL returned" })); }
            } else { const errorMsg = result.error || "Не удалось загрузить файлы."; setUploadError(errorMsg); toast.error(errorMsg); finalResults = originalFiles.map(file => ({ name: file.name, error: errorMsg })); }
            setUploadResults(finalResults);
        } catch (error) {
            const errorMsg = "Критическая ошибка при загрузке."; setUploadError(errorMsg); toast.error(errorMsg); logger.error("Upload error:", error); setUploadResults(originalFiles.map(file => ({ name: file.name, error: "Critical error" })));
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
            setSelectedFiles(null);
        }
    };

    const copyUrl = (url: string | undefined, index: number) => {
        if (!url || typeof url !== 'string') { toast.error("Неверный URL"); return; }
        navigator.clipboard.writeText(url) .then(() => { setCopiedUrlIndex(index); toast.success("URL скопирован!"); setTimeout(() => setCopiedUrlIndex(null), 1500); }) .catch((err) => { toast.error("Не удалось скопировать URL"); logger.error("Copy URL error:", err); });
    };

    // --- Render ---
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
                        className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-3xl border border-cyan-700/50 relative overflow-hidden flex flex-col max-h-[90vh]"
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

                        {/* Content Area */}
                        <div className="flex-grow overflow-y-auto pr-2 simple-scrollbar space-y-6">

                            {/* --- Section 1: Placeholder Automation --- */}
                            {imagePrompts.length > 0 && (
                                <div className="border border-indigo-600/50 rounded-lg p-4 bg-indigo-900/10">
                                    <div className="flex justify-between items-center mb-3">
                                         <h3 className="text-lg font-medium text-indigo-300">Авто-замена Плейсхолдеров <span className='text-xs opacity-70'>({imagePrompts.length})</span></h3>
                                         <Tooltip text="Автоматически найти все картинки по промптам через Google и заменить плейсхолдеры" position="left">
                                              <button
                                                 onClick={handleSwapAll}
                                                 disabled={isSwappingAll || isUploading || imagePrompts.every(p => p.status !== 'pending')}
                                                 className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full bg-indigo-600 hover:bg-indigo-500 text-white transition shadow disabled:opacity-50 disabled:cursor-not-allowed"
                                             >
                                                 {isSwappingAll ? <FaSpinner className="animate-spin" /> : <FaGoogle />}
                                                 Заменить все (Google)
                                             </button>
                                         </Tooltip>
                                    </div>
                                    <div className="space-y-2 max-h-60 overflow-y-auto simple-scrollbar pr-1">
                                        {imagePrompts.map((item) => (
                                            <div key={item.id} className="flex items-center gap-2 p-2 rounded-md bg-gray-700/50 border border-gray-600/50 text-xs">
                                                {/* Status Indicator */}
                                                <div className="flex-shrink-0 w-4 h-4 flex items-center justify-center">
                                                    {item.status === 'pending' && <FaImage className="text-gray-500" title="Ожидание" />}
                                                    {(item.status === 'searching' || item.status === 'uploading' || item.status === 'swapping') && <FaSpinner className="animate-spin text-blue-400" title="В процессе..." />}
                                                    {(item.status === 'swapped_google' || item.status === 'swapped_upload') && <FaCheck className="text-green-500" title="Заменено!" />}
                                                    {(item.status === 'error_search' || item.status === 'error_upload' || item.status === 'error_swap') &&
                                                        <Tooltip text={item.errorMessage || 'Ошибка'} position="top">
                                                            <FaTriangleExclamation className="text-red-500 cursor-help" title="Ошибка" />
                                                        </Tooltip>
                                                    }
                                                </div>
                                                {/* Placeholder & Prompt */}
                                                <div className="flex-grow overflow-hidden">
                                                    <p className="text-gray-300 font-mono truncate" title={item.placeholder}>
                                                        {item.placeholder}
                                                    </p>
                                                    <p className="text-gray-400 truncate italic" title={item.prompt}>
                                                        {item.prompt}
                                                    </p>
                                                </div>
                                                {/* Action Buttons */}
                                                <div className="flex-shrink-0 flex gap-1.5">
                                                    <Tooltip text="Найти в Google и Заменить" position="top">
                                                         <button
                                                             onClick={() => handleGoogleSwap(item.placeholder, item.prompt)}
                                                             disabled={isUploading || isSwappingAll || item.status === 'searching' || item.status === 'swapping' || item.status === 'swapped_google' || item.status === 'swapped_upload'}
                                                             className="p-1 rounded text-gray-400 hover:text-white hover:bg-blue-600/50 disabled:opacity-50 disabled:cursor-not-allowed"
                                                         >
                                                             <FaGoogle size={12}/>
                                                         </button>
                                                     </Tooltip>
                                                     <Tooltip text="Загрузить свой файл и Заменить" position="top">
                                                         <button
                                                              onClick={() => handleSpecificUploadAndSwap(item.placeholder)}
                                                              disabled={isUploading || isSwappingAll || item.status === 'uploading' || item.status === 'swapping' || item.status === 'swapped_google' || item.status === 'swapped_upload' || !selectedBucket}
                                                              className="p-1 rounded text-gray-400 hover:text-white hover:bg-green-600/50 disabled:opacity-50 disabled:cursor-not-allowed"
                                                         >
                                                             <FaUpload size={12}/>
                                                         </button>
                                                     </Tooltip>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    {/* Hidden input for specific uploads */}
                                     <input
                                         type="file"
                                         ref={specificUploadInputRef}
                                         onChange={handleSpecificFileChange}
                                         accept="image/*, video/*, audio/*"
                                         style={{ display: 'none' }}
                                         aria-hidden="true"
                                     />
                                </div>
                            )}

                            {/* Separator */}
                            {imagePrompts.length > 0 && <hr className="border-gray-600/50 my-4" />}

                            {/* --- Section 2: Manual Batch Upload --- */}
                            <div className="border border-cyan-600/30 rounded-lg p-4 bg-cyan-900/10">
                                <h3 className="text-lg font-medium text-cyan-300 mb-3">Ручная Загрузка Файлов</h3>
                                {/* Bucket Selection */}
                                <div>
                                    <label htmlFor="bucket-select-manual" className="block text-sm font-medium text-gray-300 mb-1">
                                        1. Бакет для загрузки
                                    </label>
                                    {isLoadingBuckets ? (<div className="text-gray-400"><FaSpinner className="animate-spin inline mr-1"/> Загрузка...</div>)
                                     : fetchError ? (<div className="text-red-400 text-sm"><FaTriangleExclamation className="inline mr-1"/> {fetchError}</div>)
                                     : buckets.length > 0 ? ( <select id="bucket-select-manual" name="bucket-select-manual" value={selectedBucket} onChange={(e) => setSelectedBucket(e.target.value)} className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:ring-cyan-500 focus:border-cyan-500 text-sm" disabled={isUploading || isSwappingAll}> {buckets.map((bucket) => (<option key={bucket.id} value={bucket.name}>{bucket.name}</option>))} </select> )
                                     : (<div className="text-yellow-400 text-sm">Публичные бакеты не найдены.</div>)}
                                </div>

                                {/* File Input */}
                                <div className="mt-4">
                                    <label htmlFor="file-upload-manual" className="block text-sm font-medium text-gray-300 mb-1">
                                        2. Выберите файлы
                                    </label>
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
                                            {uploadResults.map((result, index) => (
                                                <li key={`${result.name}-manual-${index}`} className={`flex items-center justify-between p-2 rounded-md text-sm ${result.url ? 'bg-green-900/30 border border-green-700/50' : 'bg-red-900/30 border border-red-700/50'}`}>
                                                    <span className={`truncate font-mono text-xs mr-2 flex-1 ${result.url ? 'text-gray-300' : 'text-red-300'}`} title={result.name}>{result.name}</span>
                                                    {result.url ? (<Tooltip text="Копировать URL" position="left"><button onClick={() => copyUrl(result.url, index)} className={`p-1 rounded transition ${copiedUrlIndex === index ? 'text-green-400 scale-110' : 'text-gray-400 hover:text-cyan-300'}`}>{copiedUrlIndex === index ? <FaCheck /> : <FaCopy />}</button></Tooltip>)
                                                     : (<Tooltip text={result.error || "Ошибка"} position="left"><FaTriangleExclamation className="text-red-400 flex-shrink-0" /></Tooltip>)}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                                {uploadError && uploadResults.length === 0 && ( <div className="mt-4 text-red-400 text-sm flex items-center gap-1"> <FaTriangleExclamation /> {uploadError} </div> )}
                            </div>

                        </div> {/* End Scrollable Content */}

                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

ImageToolsModal.displayName = 'ImageToolsModal';