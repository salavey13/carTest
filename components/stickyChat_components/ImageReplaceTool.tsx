"use client";

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { uploadBatchImages } from '@/app/actions';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import VibeContentRenderer from '@/components/VibeContentRenderer';

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
const childVariants = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { type: "spring", bounce: 0.4 } }, exit: { opacity: 0, transition: { duration: 0.2 } }, };

// --- Props Interface ---
interface ImageReplaceToolProps {
    oldImageUrl: string;
    onReplaceConfirmed: (newImageUrl: string) => void;
    onCancel: () => void;
}

// --- Constants ---
const MAX_VIDEO_SIZE_MB = 13;
const MAX_VIDEO_SIZE_BYTES = MAX_VIDEO_SIZE_MB * 1024 * 1024;

// --- Component ---
export const ImageReplaceTool: React.FC<ImageReplaceToolProps> = ({ oldImageUrl, onReplaceConfirmed, onCancel }) => {
    const [newImageUrlInput, setNewImageUrlInput] = useState("");
    const [uploadedFile, setUploadedFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            if (file.type.startsWith("video/") && file.size > MAX_VIDEO_SIZE_BYTES) {
                toast.error(`Видео файл слишком большой! Макс. размер: ${MAX_VIDEO_SIZE_MB}MB.`);
                setUploadedFile(null);
                event.target.value = ""; // Clear the input
                return;
            }
            setUploadedFile(file);
            setNewImageUrlInput("");
            setUploadedUrl(null);
            handleUpload(file);
        }
    };

    const handleUpload = async (file: File) => {
        if (!file) return;
        setIsUploading(true);
        setUploadedUrl(null);
        toast.info(`Загрузка ${file.type.startsWith("video/") ? 'видео' : 'картинки'}...`);

        const formData = new FormData();
        const bucketName = "about";
        formData.append("bucketName", bucketName);
        formData.append("files", file);

        try {
            const result = await uploadBatchImages(formData);

            if (result.success && result.data && result.data.length > 0 && result.data[0].url) {
                const uploadedUrlResult = result.data[0].url;
                setUploadedUrl(uploadedUrlResult);
                toast.success(`${file.type.startsWith("video/") ? 'Видео' : 'Картинка'} загруженa!`);
            } else {
                const errorMsg = result.error || result.failed?.[0]?.error || `Не удалось загрузить ${file.type.startsWith("video/") ? 'видео' : 'картинку'}.`;
                throw new Error(errorMsg);
            }
        } catch (error) {
            console.error("Upload failed:", error);
            toast.error(error instanceof Error ? error.message : "Ошибка загрузки.");
            setUploadedFile(null);
        } finally {
            setIsUploading(false);
        }
    };

    const handleConfirm = () => {
        const finalNewUrl = uploadedUrl || newImageUrlInput;
        if (!finalNewUrl || !isValidUrl(finalNewUrl)) {
            toast.error("Введите корректный новый URL или загрузите файл.");
            return;
        }
        onReplaceConfirmed(finalNewUrl);
    };

    const canConfirm = !isUploading && (uploadedUrl || (isValidUrl(newImageUrlInput) && !uploadedFile));

    return (
        <motion.div
            variants={childVariants}
            className="w-full mt-2 p-3 bg-gray-700/80 backdrop-blur-sm border border-blue-500/50 rounded-lg shadow-lg flex flex-col gap-3"
        >
            <p className="text-xs text-gray-300">Заменить это изображение/видео:</p>
            <Input
                type="text"
                readOnly
                value={oldImageUrl}
                className="w-full p-1 text-xs bg-gray-800 border border-gray-600 rounded text-gray-400 truncate"
                title={oldImageUrl}
            />
            <p className="text-xs text-gray-300">Новым изображением/видео (до {MAX_VIDEO_SIZE_MB}MB для видео):</p>

            {/* Блок загрузки файла */}
            <Button
                variant="outline"
                asChild
                disabled={isUploading}
                className={`w-full h-10 text-sm flex items-center justify-center gap-x-2 ${
                    uploadedFile
                        ? 'border-green-500 hover:bg-green-600/20 text-green-300'
                        : 'border-gray-500 hover:bg-gray-600/20 text-gray-300'
                } ${isUploading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
                <label
                    htmlFor="image-upload-input-tool"
                    // Добавляем классы для курсора и полного заполнения, если не загружается
                    className={`flex items-center justify-center w-full h-full ${isUploading ? '' : 'cursor-pointer'}`}
                >
                    <VibeContentRenderer content={uploadedFile ? "::FaCircleCheck className='text-green-400'::" : "::FaUpload className='text-gray-300'::"} />
                    <span className="truncate max-w-[calc(100%-40px)] ml-2"> {/* Ограничиваем ширину текста имени файла */}
                        {uploadedFile ? `${uploadedFile.name}` : "Загрузить с устройства"}
                    </span>
                </label>
            </Button>
            <input
                id="image-upload-input-tool"
                type="file"
                accept="image/*,video/mp4"
                onChange={handleFileChange}
                className="hidden"
                disabled={isUploading}
            />

            {/* Разделитель "или" */}
            <div className="flex items-center">
                <div className="flex-grow border-t border-gray-600"></div>
                <span className="flex-shrink mx-2 text-xs text-gray-400">или</span>
                <div className="flex-grow border-t border-gray-600"></div>
            </div>

            {/* Поле ввода URL */}
            <Input
                type="url"
                value={newImageUrlInput}
                onChange={(e) => {
                    setNewImageUrlInput(e.target.value);
                    setUploadedFile(null);
                    setUploadedUrl(null);
                }}
                placeholder="Вставьте URL изображения/видео..."
                className="w-full p-1.5 text-xs h-10 bg-gray-600 border-gray-500 placeholder-gray-400 focus:border-blue-400 focus:ring-1 focus:ring-blue-400 disabled:opacity-50 text-white"
                disabled={isUploading || !!uploadedFile} // Блокируем, если есть загруженный файл или идет загрузка
            />

            {isUploading && <p className="text-xs text-blue-300 animate-pulse text-center"><VibeContentRenderer content="::FaSpinner className='animate-spin inline mr-1'::" />Загрузка файла...</p>}
            {uploadedUrl && !newImageUrlInput && <p className="text-xs text-green-400 break-all">Загружен: <span title={uploadedUrl}>{uploadedUrl.substring(0, 40)}{uploadedUrl.length > 40 ? '...' : ''}</span></p>}

            <div className="flex justify-end gap-2 mt-2">
                <Button
                    onClick={onCancel}
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    disabled={isUploading}
                >
                    Отмена
                </Button>
                <Button
                    onClick={handleConfirm}
                    disabled={!canConfirm}
                    size="sm"
                    className="text-xs bg-blue-600 hover:bg-blue-500 flex items-center"
                >
                    <VibeContentRenderer content="::FaPaperPlane className='mr-1.5 text-xs'::" />
                    <span>Заменить</span>
                </Button>
            </div>
        </motion.div>
    );
};

export default ImageReplaceTool;