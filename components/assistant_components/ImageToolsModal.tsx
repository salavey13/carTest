"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaImages, FaXmark, FaUpload, FaCopy, FaCheck, FaSpinner, FaTriangleExclamation } from 'react-icons/fa6';
import { listPublicBuckets, uploadBatchImages } from '@/app/actions'; // Assuming action path
import { Bucket } from '@supabase/storage-js';
import { toast } from 'sonner';
import { Tooltip } from '../AICodeAssistant'; // Assuming Tooltip is accessible

interface ImageToolsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

interface UploadResult {
    name: string;
    url?: string; // Should be a string URL or undefined
    error?: string;
}

export const ImageToolsModal: React.FC<ImageToolsModalProps> = ({ isOpen, onClose }) => {
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
            console.error("Fetch buckets error:", error);
        } finally {
            setIsLoadingBuckets(false);
        }
    }, []);

    // Effect to fetch buckets when modal opens and reset state
    useEffect(() => {
        if (isOpen) {
            fetchBuckets();
            setSelectedFiles(null);
            setUploadResults([]);
            setUploadError(null);
            setCopiedUrlIndex(null);
            if (fileInputRef.current) {
                fileInputRef.current.value = ""; // Clear file input visually
            }
        }
    }, [isOpen, fetchBuckets]);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setSelectedFiles(event.target.files);
        setUploadResults([]); // Clear previous results
        setUploadError(null);
        setCopiedUrlIndex(null); // Reset copied state
    };

    const handleUpload = async () => {
        if (!selectedBucket || !selectedFiles || selectedFiles.length === 0) {
            toast.warn("Выберите бакет и файлы для загрузки.");
            return;
        }

        setIsUploading(true);
        setUploadError(null);
        setUploadResults([]);
        setCopiedUrlIndex(null);

        const formData = new FormData();
        formData.append("bucketName", selectedBucket);
        const originalFiles = Array.from(selectedFiles); // Keep original list for error reporting
        originalFiles.forEach(file => formData.append("files", file));

        try {
            const result = await uploadBatchImages(formData);
            let finalResults: UploadResult[] = [];

            if (result.success && result.data) {
                // Assume result.data contains { name: string, url?: string (MUST be string), error?: string }
                finalResults = result.data.map(d => ({
                    name: d.name,
                    // IMPORTANT: Ensure d.url is treated as string or undefined
                    url: typeof d.url === 'string' ? d.url : undefined,
                    error: d.error
                }));

                const successCount = finalResults.filter(r => r.url).length;
                const errorCount = finalResults.filter(r => r.error).length;
                const totalAttempted = originalFiles.length;

                if (successCount > 0) {
                    toast.success(`${successCount} из ${totalAttempted} файлов успешно загружено!`);
                }
                if (errorCount > 0) {
                     const generalErrorMsg = result.error || `${errorCount} файлов не удалось загрузить.`;
                     setUploadError(generalErrorMsg); // Set general error if provided
                     toast.error(generalErrorMsg);
                     // Ensure errors are reflected in the results list
                     const successfulNames = new Set(finalResults.filter(r => r.url).map(r => r.name));
                     originalFiles.forEach(file => {
                         if (!successfulNames.has(file.name) && !finalResults.some(r => r.name === file.name && r.error)) {
                             finalResults.push({ name: file.name, error: "Upload failed" });
                         }
                     });

                } else if (successCount === 0 && !result.error) {
                    // Case where action returns success:true but data is empty or invalid
                    const errorMsg = "Загрузка завершилась, но не удалось получить URL.";
                    setUploadError(errorMsg);
                    toast.error(errorMsg);
                    finalResults = originalFiles.map(file => ({ name: file.name, error: "No URL returned" }));
                }

            } else { // result.success is false or data is missing
                const errorMsg = result.error || "Не удалось загрузить файлы (общая ошибка).";
                setUploadError(errorMsg);
                toast.error(errorMsg);
                // Mark all files as failed
                finalResults = originalFiles.map(file => ({ name: file.name, error: errorMsg }));
            }
            setUploadResults(finalResults);

        } catch (error) {
            const errorMsg = "Критическая ошибка при загрузке.";
            setUploadError(errorMsg);
            toast.error(errorMsg);
            console.error("Upload error:", error);
            // Mark all files as failed on critical error
            setUploadResults(originalFiles.map(file => ({ name: file.name, error: "Critical error" })));
        } finally {
            setIsUploading(false);
            // Clear the file input after upload attempt
            if (fileInputRef.current) {
                 fileInputRef.current.value = "";
            }
            setSelectedFiles(null); // Also clear the state
        }
    };

    const copyUrl = (url: string | undefined, index: number) => {
        if (!url || typeof url !== 'string') {
            toast.error("Неверный URL для копирования");
            return;
        }
        navigator.clipboard.writeText(url)
            .then(() => {
                setCopiedUrlIndex(index);
                toast.success("URL скопирован!");
                setTimeout(() => setCopiedUrlIndex(null), 1500); // Reset after 1.5s
            })
            .catch((err) => {
                toast.error("Не удалось скопировать URL");
                console.error("Copy URL error:", err);
            });
    };


    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[70] p-4" // Increased z-index
                    onClick={onClose} // Close on backdrop click
                >
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                        className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-lg border border-cyan-700/50 relative overflow-hidden flex flex-col max-h-[90vh]" // Flex column and max height
                        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside modal
                    >
                        {/* Header */}
                        <div className="flex-shrink-0 flex justify-between items-center mb-4">
                            <h2 className="text-xl font-semibold text-cyan-300 flex items-center gap-2">
                                <FaImages /> Инструменты для Картинок
                            </h2>
                            <button
                                onClick={onClose}
                                className="text-gray-400 hover:text-white transition-colors p-1 rounded-full hover:bg-gray-700"
                                aria-label="Close modal"
                            >
                                <FaXmark size={20} />
                            </button>
                        </div>

                        {/* Content Area (Scrollable) */}
                        <div className="flex-grow overflow-y-auto pr-2 simple-scrollbar space-y-4">
                            {/* Bucket Selection */}
                            <div>
                                <label htmlFor="bucket-select" className="block text-sm font-medium text-gray-300 mb-1">
                                    1. Выберите Бакет (публичный)
                                </label>
                                {isLoadingBuckets ? (
                                    <div className="flex items-center gap-2 text-gray-400">
                                        <FaSpinner className="animate-spin" /> Загрузка бакетов...
                                    </div>
                                ) : fetchError ? (
                                    <div className="text-red-400 text-sm flex items-center gap-1">
                                        <FaTriangleExclamation /> {fetchError}
                                    </div>
                                ) : buckets.length > 0 ? (
                                    <select
                                        id="bucket-select"
                                        name="bucket-select" // Added name attribute
                                        value={selectedBucket}
                                        onChange={(e) => setSelectedBucket(e.target.value)}
                                        className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:ring-cyan-500 focus:border-cyan-500 text-sm"
                                        disabled={isUploading}
                                        aria-label="Select storage bucket"
                                    >
                                        {buckets.map((bucket) => (
                                            <option key={bucket.id} value={bucket.name}>
                                                {bucket.name}
                                            </option>
                                        ))}
                                    </select>
                                ) : (
                                    <div className="text-yellow-400 text-sm">Публичные бакеты не найдены.</div>
                                )}
                            </div>

                            {/* File Input */}
                            <div>
                                <label htmlFor="file-upload" className="block text-sm font-medium text-gray-300 mb-1">
                                    2. Выберите Файлы (можно несколько)
                                </label>
                                <input
                                    id="file-upload"
                                    ref={fileInputRef}
                                    type="file"
                                    multiple
                                    accept="image/*, video/*, audio/*" // Allow more types
                                    onChange={handleFileChange}
                                    className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-cyan-600/20 file:text-cyan-300 hover:file:bg-cyan-600/40 disabled:opacity-50 disabled:cursor-not-allowed"
                                    disabled={isUploading || !selectedBucket || buckets.length === 0} // Also disable if no buckets
                                    aria-label="Choose files to upload"
                                />
                                {selectedFiles && (
                                    <p className="text-xs text-gray-400 mt-1">
                                        Выбрано: {selectedFiles.length} файлов
                                    </p>
                                )}
                            </div>

                            {/* Upload Button */}
                             <button
                                onClick={handleUpload}
                                disabled={isUploading || !selectedBucket || !selectedFiles || selectedFiles.length === 0}
                                className="w-full flex-shrink-0 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-md font-semibold transition shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                            >
                                {isUploading ? (
                                    <>
                                        <FaSpinner className="animate-spin" /> Загрузка...
                                    </>
                                ) : (
                                    <>
                                        <FaUpload /> 3. Загрузить
                                    </>
                                )}
                            </button>

                            {/* Upload Results */}
                            {uploadResults.length > 0 && (
                                <div className="border-t border-gray-700 pt-4">
                                    <h3 className="text-base font-medium text-gray-300 mb-2">Результаты загрузки:</h3>
                                    <ul className="space-y-2">
                                        {uploadResults.map((result, index) => (
                                            <li key={`${result.name}-${index}`} className={`flex items-center justify-between p-2 rounded-md text-sm ${result.url ? 'bg-green-900/30 border border-green-700/50' : 'bg-red-900/30 border border-red-700/50'}`}>
                                                <span className={`truncate font-mono text-xs mr-2 flex-1 ${result.url ? 'text-gray-300' : 'text-red-300'}`} title={result.name}>
                                                    {result.name}
                                                </span>
                                                {result.url ? (
                                                    <Tooltip text="Копировать URL" position="left">
                                                        <button
                                                            onClick={() => copyUrl(result.url, index)}
                                                            className={`p-1 rounded transition ${copiedUrlIndex === index ? 'text-green-400 scale-110' : 'text-gray-400 hover:text-cyan-300'}`}
                                                            aria-label={`Copy URL for ${result.name}`}
                                                        >
                                                            {copiedUrlIndex === index ? <FaCheck /> : <FaCopy />}
                                                        </button>
                                                    </Tooltip>
                                                ) : (
                                                    <Tooltip text={result.error || "Ошибка"} position="left">
                                                        <FaTriangleExclamation className="text-red-400 flex-shrink-0" />
                                                    </Tooltip>
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            {/* Display general upload error if it exists and there are no specific results yet */}
                            {uploadError && uploadResults.length === 0 && (
                                <div className="mt-4 text-red-400 text-sm flex items-center gap-1">
                                    <FaTriangleExclamation /> {uploadError}
                                </div>
                            )}
                        </div> {/* End Scrollable Content */}

                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

ImageToolsModal.displayName = 'ImageToolsModal'; // For better debugging/React DevTools

// Simple scrollbar utility class (add to your global CSS or a utility CSS file)
/*
.simple-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.simple-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.simple-scrollbar::-webkit-scrollbar-thumb {
  background-color: rgba(107, 114, 128, 0.5); // gray-500 with opacity
  border-radius: 3px;
}
.simple-scrollbar::-webkit-scrollbar-thumb:hover {
  background-color: rgba(107, 114, 128, 0.7); // darker on hover
}
*/