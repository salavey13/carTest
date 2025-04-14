// /components/assistant_components/ImageToolsModal.tsx
"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaImages, FaTimes, FaUpload, FaCopy, FaCheck, FaSpinner, FaExclamationTriangle } from 'react-icons/fa6';
import { listPublicBuckets, uploadBatchImages } from '@/app/actions';
import { Bucket } from '@supabase/storage-js';
import { toast } from 'sonner';
import { Tooltip } from '../AICodeAssistant'; // Assuming Tooltip is accessible

interface ImageToolsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

interface UploadResult {
    name: string;
    url?: string;
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
                // Default select first bucket if available
                if (result.data.length > 0) {
                    setSelectedBucket(result.data[0].name);
                } else {
                    setFetchError("Не найдено публичных бакетов. Создайте их в Supabase Storage.");
                }
            } else {
                setFetchError(result.error || "Не удалось загрузить список бакетов.");
            }
        } catch (error) {
            setFetchError("Ошибка при загрузке бакетов.");
            console.error("Fetch buckets error:", error);
        } finally {
            setIsLoadingBuckets(false);
        }
    }, []);

    useEffect(() => {
        if (isOpen) {
            fetchBuckets();
            // Reset state on open
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
        setUploadResults([]); // Clear previous results when new files selected
        setUploadError(null);
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
        for (let i = 0; i < selectedFiles.length; i++) {
            formData.append("files", selectedFiles[i]);
        }

        try {
            const result = await uploadBatchImages(formData);
            if (result.success && result.data) {
                 setUploadResults(result.data.map(d => ({ name: d.name, url: d.url })));
                 toast.success(`${result.data.length} файлов загружено!`);
                 if (result.error) { // Partial success with errors
                     setUploadError(result.error);
                     toast.warn(result.error);
                     // Add error placeholders in results
                     const failedNames = new Set(result.data.map(d => d.name));
                     const errorsToAdd: UploadResult[] = Array.from(selectedFiles)
                        .filter(file => !failedNames.has(file.name))
                        .map(file => ({ name: file.name, error: "Upload failed (see details above)" }));
                     setUploadResults(prev => [...prev, ...errorsToAdd]);
                 }
            } else {
                setUploadError(result.error || "Не удалось загрузить файлы.");
                toast.error(result.error || "Не удалось загрузить файлы.");
                 // Show errors for all files if total failure
                 setUploadResults(Array.from(selectedFiles).map(file => ({ name: file.name, error: result.error || "Upload failed" })));
            }
        } catch (error) {
            setUploadError("Критическая ошибка при загрузке.");
            toast.error("Критическая ошибка при загрузке.");
            console.error("Upload error:", error);
            // Show errors for all files on critical failure
            setUploadResults(Array.from(selectedFiles).map(file => ({ name: file.name, error: "Critical error" })));
        } finally {
            setIsUploading(false);
        }
    };

    const copyUrl = (url: string, index: number) => {
        navigator.clipboard.writeText(url)
            .then(() => {
                setCopiedUrlIndex(index);
                setTimeout(() => setCopiedUrlIndex(null), 1500); // Reset after 1.5s
            })
            .catch(() => toast.error("Не удалось скопировать URL"));
    };


    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
                    onClick={onClose} // Close on backdrop click
                >
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                        className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-lg border border-cyan-700/50 relative overflow-hidden"
                        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside modal
                    >
                        <button
                            onClick={onClose}
                            className="absolute top-3 right-3 text-gray-400 hover:text-white transition-colors p-1 rounded-full hover:bg-gray-700"
                            aria-label="Close modal"
                        >
                            <FaTimes size={20} />
                        </button>

                        <h2 className="text-xl font-semibold text-cyan-300 mb-4 flex items-center gap-2">
                            <FaImages /> Инструменты для Картинок
                        </h2>

                        {/* Bucket Selection */}
                        <div className="mb-4">
                            <label htmlFor="bucket-select" className="block text-sm font-medium text-gray-300 mb-1">
                                1. Выберите Бакет (публичный)
                            </label>
                            {isLoadingBuckets ? (
                                <div className="flex items-center gap-2 text-gray-400">
                                    <FaSpinner className="animate-spin" /> Загрузка бакетов...
                                </div>
                            ) : fetchError ? (
                                <div className="text-red-400 text-sm flex items-center gap-1">
                                    <FaExclamationTriangle /> {fetchError}
                                </div>
                            ) : buckets.length > 0 ? (
                                <select
                                    id="bucket-select"
                                    value={selectedBucket}
                                    onChange={(e) => setSelectedBucket(e.target.value)}
                                    className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:ring-cyan-500 focus:border-cyan-500 text-sm"
                                    disabled={isUploading}
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
                        <div className="mb-4">
                            <label htmlFor="file-upload" className="block text-sm font-medium text-gray-300 mb-1">
                                2. Выберите Файлы (можно несколько)
                            </label>
                            <input
                                id="file-upload"
                                ref={fileInputRef}
                                type="file"
                                multiple
                                accept="image/*"
                                onChange={handleFileChange}
                                className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-cyan-600/20 file:text-cyan-300 hover:file:bg-cyan-600/40 disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={isUploading || !selectedBucket}
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
                            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-md font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isUploading ? (
                                <>
                                    <FaSpinner className="animate-spin" /> Загрузка...
                                </>
                            ) : (
                                <>
                                    <FaUpload /> 3. Загрузить Картинки
                                </>
                            )}
                        </button>

                        {/* Upload Results */}
                        {uploadResults.length > 0 && (
                             <div className="mt-6 border-t border-gray-700 pt-4">
                                <h3 className="text-base font-medium text-gray-300 mb-2">Результаты загрузки:</h3>
                                <ul className="space-y-2 max-h-48 overflow-y-auto pr-2 simple-scrollbar">
                                    {uploadResults.map((result, index) => (
                                        <li key={index} className={`flex items-center justify-between p-2 rounded-md text-sm ${result.url ? 'bg-gray-700/50' : 'bg-red-900/30 border border-red-700/50'}`}>
                                             <span className="truncate font-mono text-xs flex-1 mr-2" title={result.name}>
                                                 {result.name}
                                             </span>
                                             {result.url ? (
                                                 <Tooltip text="Копировать URL" position="left">
                                                     <button
                                                         onClick={() => copyUrl(result.url!, index)}
                                                         className={`p-1 rounded transition ${copiedUrlIndex === index ? 'text-green-400' : 'text-gray-400 hover:text-cyan-300'}`}
                                                     >
                                                         {copiedUrlIndex === index ? <FaCheck /> : <FaCopy />}
                                                     </button>
                                                 </Tooltip>
                                             ) : (
                                                 <Tooltip text={result.error || "Ошибка"} position="left">
                                                     <FaExclamationTriangle className="text-red-400 flex-shrink-0" />
                                                 </Tooltip>
                                             )}
                                         </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                         {uploadError && uploadResults.length === 0 && ( // Show general error if no individual results shown
                             <div className="mt-4 text-red-400 text-sm flex items-center gap-1">
                                <FaExclamationTriangle /> {uploadError}
                             </div>
                         )}

                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

ImageToolsModal.displayName = 'ImageToolsModal';