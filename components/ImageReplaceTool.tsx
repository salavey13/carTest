"use client";

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { FaUpload, FaPaperPlane, FaSpinner } from 'react-icons/fa6';
import { toast } from 'sonner';
// .. ИСПОЛЬЗУЕМ ЭКШЕН uploadBatchImages, КАК В МОДАЛКЕ
import { uploadBatchImages } from '@/app/actions';
import { Input } from '@/components/ui/input';
import { debugLogger as logger } from "@/lib/debugLogger"; // Import logger

// --- Helper Function ---
// (Assume this is defined or imported from lib/utils)
const isValidUrl = (url: string): boolean => {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch (_) {
    return false;
  }
};

// Animation variant (assuming childVariants is defined in StickyChatButton)
const childVariants = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { type: "spring", bounce: 0.4 } }, exit: { opacity: 0, transition: { duration: 0.2 } }, };

// --- Props Interface ---
interface ImageReplaceToolProps {
    oldImageUrl: string;
    onReplaceConfirmed: (newImageUrl: string) => void;
    onCancel: () => void;
}

// --- Component ---
export const ImageReplaceTool: React.FC<ImageReplaceToolProps> = ({ oldImageUrl, onReplaceConfirmed, onCancel }) => {
    logger.debug("[Flow 1 - Image Swap] ImageReplaceTool Render", { oldImageUrl }); // Log entry
    const [newImageUrlInput, setNewImageUrlInput] = useState("");
    const [uploadedFile, setUploadedFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
             logger.debug("[Flow 1 - Image Swap] ImageReplaceTool: File selected", { name: file.name, size: file.size });
            setUploadedFile(file);
            setNewImageUrlInput(""); // Clear URL input if file is selected
            setUploadedUrl(null); // Clear previously uploaded URL
            handleUpload(file); // Trigger upload immediately
        }
    };

    const handleUpload = async (file: File) => {
        if (!file) return;
        setIsUploading(true);
        setUploadedUrl(null);
        logger.info("[Flow 1 - Image Swap] ImageReplaceTool: Starting image upload...");
        toast.info("Загрузка картинки...");

        // --- ИСПОЛЬЗУЕМ uploadBatchImages ---
        const formData = new FormData();
        // !!! ВАЖНО: Убедись, что бакет 'about' существует и публичен, или используй другой бакет !!!
        const bucketName = "about"; // TODO: Make this configurable or pass as prop?
        formData.append("bucketName", bucketName);
        formData.append("files", file); // Добавляем один файл

        try {
            const result = await uploadBatchImages(formData); // Вызываем Batch экшен
            logger.debug("[Flow 1 - Image Swap] ImageReplaceTool: Upload action result", { result });

            // Обрабатываем результат batch экшена (ожидаем один файл в ответе)
            if (result.success && result.data && result.data.length > 0 && result.data[0].url) {
                const uploadedUrlResult = result.data[0].url;
                setUploadedUrl(uploadedUrlResult);
                logger.info(`[Flow 1 - Image Swap] ImageReplaceTool: Upload successful. URL: ${uploadedUrlResult}`);
                toast.success("Картинка загружена!");
            } else {
                // Обработка ошибки из batch экшена
                const errorMsg = result.error || result.failed?.[0]?.error || "Не удалось загрузить картинку.";
                throw new Error(errorMsg);
            }
        } catch (error) {
            logger.error("[Flow 1 - Image Swap] ImageReplaceTool: Upload failed:", error);
            toast.error(error instanceof Error ? error.message : "Ошибка загрузки.");
            setUploadedFile(null); // Clear file selection on error
        } finally {
            setIsUploading(false);
             logger.debug("[Flow 1 - Image Swap] ImageReplaceTool: Upload finally block.");
        }
        // --- КОНЕЦ ИСПОЛЬЗОВАНИЯ uploadBatchImages ---
    };

    const handleConfirm = () => {
        const finalNewUrl = uploadedUrl || newImageUrlInput;
        logger.info("[Flow 1 - Image Swap] ImageReplaceTool: Confirm button clicked.", { finalNewUrl, uploadedUrl, newImageUrlInput });
        if (!finalNewUrl || !isValidUrl(finalNewUrl)) {
             logger.warn("[Flow 1 - Image Swap] ImageReplaceTool: Invalid URL on confirm.");
            toast.error("Введите корректный новый URL или загрузите файл.");
            return;
        }
        logger.info("[Flow 1 - Image Swap] ImageReplaceTool: Calling onReplaceConfirmed.");
        onReplaceConfirmed(finalNewUrl);
    };

    const handleCancelClick = () => {
        logger.debug("[Flow 1 - Image Swap] ImageReplaceTool: Cancel clicked.");
        onCancel();
    };

    const canConfirm = !isUploading && (uploadedUrl || (isValidUrl(newImageUrlInput) && !uploadedFile));

    return (
        <motion.div
            variants={childVariants}
            className="w-full mt-2 p-3 pb-16 bg-gray-700/80 backdrop-blur-sm border border-blue-500/50 rounded-lg shadow-lg flex flex-col gap-3"
        >
            <p className="text-xs text-gray-300">Заменить эту картинку:</p>
            <input
                type="text"
                readOnly
                value={oldImageUrl}
                className="w-full p-1 text-xs bg-gray-800 border border-gray-600 rounded text-gray-400 truncate"
                title={oldImageUrl}
            />
            <p className="text-xs text-gray-300">Новой картинкой:</p>
            <div className="flex items-center gap-2">
                <label
                    htmlFor="image-upload-input-tool"
                    className={`flex-shrink-0 p-2 rounded border transition-colors cursor-pointer ${
                        uploadedFile ? 'bg-green-600 border-green-500' : 'bg-gray-600 border-gray-500 hover:bg-gray-500'
                    } ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                 >
                    <FaUpload className={`text-sm ${uploadedFile ? 'text-white' : 'text-gray-300'}`} />
                </label>
                <input
                    id="image-upload-input-tool"
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                    disabled={isUploading}
                />
                <span className="text-xs text-gray-400">или</span>
                <Input
                    type="url"
                    value={newImageUrlInput}
                    onChange={(e) => {
                        const newValue = e.target.value;
                        logger.debug("[Flow 1 - Image Swap] ImageReplaceTool: URL input changed", { newValue });
                        setNewImageUrlInput(newValue);
                        setUploadedFile(null);
                        setUploadedUrl(null);
                    }}
                    placeholder="Вставьте новый URL..."
                    className="flex-grow p-1.5 text-xs h-8 bg-gray-600 border-gray-500 placeholder-gray-400 focus:border-blue-400 focus:ring-1 focus:ring-blue-400 disabled:opacity-50 text-white"
                    disabled={isUploading || !!uploadedFile}
                />
            </div>
             {isUploading && <p className="text-xs text-blue-300 animate-pulse text-center"><FaSpinner className="animate-spin inline mr-1"/>Загрузка файла...</p>}
             {uploadedUrl && <p className="text-xs text-green-400 break-all">Загружен: <span title={uploadedUrl}>{uploadedUrl.substring(0, 40)}...</span></p>}
            <div className="flex justify-end gap-2 mt-2">
                <button
                    onClick={handleCancelClick} // Use dedicated handler
                    className="px-3 py-1 text-xs bg-gray-500 hover:bg-gray-400 text-white rounded transition"
                    disabled={isUploading}
                >
                    Отмена
                </button>
                <button
                    onClick={handleConfirm}
                    disabled={!canConfirm}
                    className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Заменить
                </button>
            </div>
        </motion.div>
    );
};

// Default export for easy import
export default ImageReplaceTool;