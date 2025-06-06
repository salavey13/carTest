"use client";

import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { uploadBatchImages } from '@/app/actions';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import VibeContentRenderer from '@/components/VibeContentRenderer';
import { debugLogger as logger } from '@/lib/debugLogger';

// --- Helper Function ---
const isValidUrl = (url: string): boolean => {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch (_) {
    return false;
  }
};

// Animation variant
const toolVariants = {
    hidden: { opacity: 0, y: 20, scale: 0.95 },
    visible: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", bounce: 0.4, duration: 0.3 } },
    exit: { opacity: 0, y: 10, scale: 0.95, transition: { duration: 0.2 } },
};

// --- Props Interface ---
interface SimpleImageUploadToolProps {
    onUploadComplete: (url: string) => void;
    onCancel: () => void;
}

// --- Constants ---
const MAX_VIDEO_SIZE_MB = 13;
const MAX_VIDEO_SIZE_BYTES = MAX_VIDEO_SIZE_MB * 1024 * 1024;

// --- Component ---
export const SimpleImageUploadTool: React.FC<SimpleImageUploadToolProps> = ({ onUploadComplete, onCancel }) => {
    const [uploadedFile, setUploadedFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);

    const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            logger.debug(`[SimpleImageUploadTool] File selected: ${file.name}, size: ${file.size}, type: ${file.type}`);
            if (file.type.startsWith("video/") && file.size > MAX_VIDEO_SIZE_BYTES) {
                toast.error(`Видео файл слишком большой! Макс. размер: ${MAX_VIDEO_SIZE_MB}MB.`);
                setUploadedFile(null);
                event.target.value = ""; // Clear the input
                return;
            }
            setUploadedFile(file);
            setUploadedUrl(null);
            await handleUpload(file);
        }
    }, []);

    const handleUpload = async (file: File) => {
        if (!file) return;
        setIsUploading(true);
        setUploadedUrl(null);
        const uploadToastId = toast.loading(
            <div className="flex items-center">
                <VibeContentRenderer content="::FaSpinner className='animate-spin mr-2'::" />
                {`Загрузка ${file.type.startsWith("video/") ? 'видео' : 'файла'}...`}
            </div>
        );

        const formData = new FormData();
        const bucketName = "about"; // Or make this configurable if needed
        formData.append("bucketName", bucketName);
        formData.append("files", file);

        try {
            logger.info(`[SimpleImageUploadTool] Starting upload for ${file.name} to bucket ${bucketName}`);
            const result = await uploadBatchImages(formData);
            logger.debug("[SimpleImageUploadTool] uploadBatchImages result:", result);


            if (!result) { // Check if result itself is undefined
                throw new Error("Результат загрузки не определен.");
            }

            if (result.success && result.data && result.data.length > 0 && result.data[0].url) {
                const url = result.data[0].url;
                setUploadedUrl(url);
                logger.info(`[SimpleImageUploadTool] Upload success: ${url}`);
                toast.success(`${file.type.startsWith("video/") ? 'Видео' : 'Файл'} загружен!`, { id: uploadToastId });
                onUploadComplete(url); // Notify parent
            } else {
                const errorMsg = result.error || result.failed?.[0]?.error || `Не удалось загрузить ${file.type.startsWith("video/") ? 'файл' : 'файл'}. Подробности: ${JSON.stringify(result)}`;
                throw new Error(errorMsg);
            }
        } catch (error: any) {
            logger.error("[SimpleImageUploadTool] Upload failed:", error, { errorMessage: error.message, stack: error.stack });
            toast.error(error.message || "Ошибка загрузки.", { id: uploadToastId });
            setUploadedFile(null);
        } finally {
            setIsUploading(false);
        }
    };

    const handleCopyUrl = useCallback(() => {
        if (uploadedUrl) {
            navigator.clipboard.writeText(uploadedUrl);
            toast.success("URL скопирован в буфер обмена!");
            logger.debug(`[SimpleImageUploadTool] Copied URL: ${uploadedUrl}`);
        }
    }, [uploadedUrl]);

    return (
        <motion.div
            key="simple-image-upload-tool"
            variants={toolVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="w-full mt-2 p-3 bg-gray-800/90 backdrop-blur-md border border-teal-500/50 rounded-lg shadow-xl flex flex-col gap-3"
        >
            <div className="flex justify-between items-center">
                <p className="text-sm text-gray-200 font-semibold flex items-center">
                    <VibeContentRenderer content="::FaUpload className='mr-2 text-teal-400'::" />
                    Загрузить файл & получить URL
                </p>
            </div>
            
            {!uploadedUrl && (
                 <div className="flex flex-col items-center gap-2">
                    <Button
                        variant="outline"
                        asChild
                        disabled={isUploading}
                        className={`w-full h-12 bg-gray-700 hover:bg-gray-600 border-gray-600 hover:border-teal-500 text-gray-300 hover:text-teal-300 transition-colors duration-150
                                    ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        <label
                            htmlFor="simple-upload-input-tool"
                            className="cursor-pointer flex items-center justify-center w-full h-full text-sm"
                        >
                            {isUploading ? (
                                <VibeContentRenderer content="::FaSpinner className='animate-spin mr-2':: Загрузка..." />
                            ) : uploadedFile ? (
                                <VibeContentRenderer content={`::FaCircleCheck className='text-green-400 mr-2':: Файл: ${uploadedFile.name.substring(0,20)}...`} />
                            ) : (
                                <VibeContentRenderer content={`::FaPaperclip className='mr-2':: Выбрать файл (до ${MAX_VIDEO_SIZE_MB}MB видео)`} />
                            )}
                        </label>
                    </Button>
                    <input
                        id="simple-upload-input-tool"
                        type="file"
                        accept="image/*,video/mp4" // Accept images and mp4 videos
                        onChange={handleFileChange}
                        className="hidden"
                        disabled={isUploading}
                    />
                    <p className="text-xs text-gray-400">Файл будет загружен в бакет 'about'.</p>
                </div>
            )}


            {uploadedUrl && (
                <div className="flex flex-col gap-2 mt-2">
                    <p className="text-xs text-green-400">Файл успешно загружен:</p>
                    <Input
                        type="text"
                        readOnly
                        value={uploadedUrl}
                        className="w-full p-1.5 text-xs bg-gray-700 border-gray-600 rounded text-gray-300 truncate selection:bg-teal-500 selection:text-white"
                        title={uploadedUrl}
                        onFocus={(e) => e.target.select()}
                    />
                    <Button
                        onClick={handleCopyUrl}
                        size="sm"
                        className="w-full bg-teal-600 hover:bg-teal-500 text-white text-xs"
                    >
                        <VibeContentRenderer content="::FaCopy className='mr-1.5':: Копировать URL" />
                    </Button>
                </div>
            )}

            <div className="flex justify-end gap-2 mt-3">
                <Button
                    onClick={onCancel}
                    variant="ghost"
                    size="sm"
                    className="text-xs text-gray-400 hover:text-gray-200 hover:bg-gray-700"
                >
                    {uploadedUrl ? "Закрыть" : "Отмена"}
                </Button>
            </div>
        </motion.div>
    );
};

SimpleImageUploadTool.displayName = 'SimpleImageUploadTool';

export default SimpleImageUploadTool;