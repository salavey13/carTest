"use client";

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUpload, faFilePdf, faSpinner, faCheckCircle, faTriangleExclamation, faLanguage, faFileExcel } from '@fortawesome/free-solid-svg-icons';
import { convertXlsxToPdfAndSend } from '@/app/topdf/actions';
import { logger } from '@/lib/logger';
import { Toaster, toast } from 'sonner';
import { cn } from "@/lib/utils";
import VibeContentRenderer from '@/components/VibeContentRenderer'; // For icons in buttons

// --- Translations ---
const translations: Record<string, Record<string, string>> = {
  en: {
    "pageTitle": "XLSX to PDF Converter",
    "pageSubtitle": "Upload your XLSX file, and we'll convert it to a PDF and send it to your Telegram chat.",
    "selectFile": "Select XLSX File",
    "noFileSelected": "No file selected",
    "fileSelected": "File: %%FILENAME%%",
    "convertToPdfAndSend": "Convert & Send to Telegram",
    "uploading": "Uploading...",
    "converting": "Converting...",
    "sending": "Sending PDF...",
    "errorNoFile": "Please select an XLSX file first.",
    "errorNoUser": "User information not available. Please ensure you are logged in via Telegram.",
    "errorFileTooLarge": "File is too large. Maximum size: 5MB.",
    "errorInvalidFileType": "Invalid file type. Only .xlsx files are accepted.",
    "successMessage": "Success! Your PDF has been sent to your Telegram chat.",
    "uploadFailed": "Upload failed. Please try again.",
    "conversionFailed": "Conversion failed: %%ERROR%%",
    "telegramSendFailed": "Failed to send PDF to Telegram: %%ERROR%%",
    "unexpectedError": "An unexpected error occurred: %%ERROR%%",
    "loadingUser": "Loading user data...",
    "status": "Status",
    "ready": "Ready for conversion.",
    "toggleLanguage": "Toggle Language",
  },
  ru: {
    "pageTitle": "Конвертер XLSX в PDF",
    "pageSubtitle": "Загрузите ваш XLSX файл, мы сконвертируем его в PDF и отправим в ваш Telegram чат.",
    "selectFile": "Выберите XLSX Файл",
    "noFileSelected": "Файл не выбран",
    "fileSelected": "Файл: %%FILENAME%%",
    "convertToPdfAndSend": "Конвертировать и Отправить в Telegram",
    "uploading": "Загрузка...",
    "converting": "Конвертация...",
    "sending": "Отправка PDF...",
    "errorNoFile": "Пожалуйста, сначала выберите XLSX файл.",
    "errorNoUser": "Информация о пользователе недоступна. Убедитесь, что вы авторизованы через Telegram.",
    "errorFileTooLarge": "Файл слишком большой. Максимальный размер: 5МБ.",
    "errorInvalidFileType": "Неверный тип файла. Принимаются только .xlsx файлы.",
    "successMessage": "Успешно! Ваш PDF файл отправлен в ваш Telegram чат.",
    "uploadFailed": "Ошибка загрузки. Пожалуйста, попробуйте снова.",
    "conversionFailed": "Ошибка конвертации: %%ERROR%%",
    "telegramSendFailed": "Не удалось отправить PDF в Telegram: %%ERROR%%",
    "unexpectedError": "Произошла непредвиденная ошибка: %%ERROR%%",
    "loadingUser": "Загрузка данных пользователя...",
    "status": "Статус",
    "ready": "Готово к конвертации.",
    "toggleLanguage": "Переключить язык",
  }
};

const MAX_FILE_SIZE_MB = 5;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export default function ToPdfPage() {
    const { user, isAuthLoading, isInTelegramContext } = useAppContext();
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [statusMessage, setStatusMessage] = useState<string>('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const initialLang = useMemo(() => {
        const userLang = user?.language_code;
        return userLang === 'ru' ? 'ru' : 'en';
    }, [user?.language_code]);
    const [currentLang, setCurrentLang] = useState<'en' | 'ru'>(initialLang);

    useEffect(() => {
        const userLang = user?.language_code;
        const newLangBasedOnUser = userLang === 'ru' ? 'ru' : 'en';
        if (newLangBasedOnUser !== currentLang) {
            setCurrentLang(newLangBasedOnUser);
        }
    }, [user?.language_code, currentLang]);

    const t = useCallback((key: string, replacements?: Record<string, string | number>): string => {
        let translation = translations[currentLang]?.[key] || translations['en']?.[key] || key;
        if (replacements) {
            Object.keys(replacements).forEach(placeholder => {
                const regex = new RegExp(`%%${placeholder.toUpperCase()}%%`, 'g');
                translation = translation.replace(regex, String(replacements[placeholder]));
            });
        }
        return translation;
    }, [currentLang]);

    const toggleLang = useCallback(() => {
        setCurrentLang(prevLang => prevLang === 'en' ? 'ru' : 'en');
    }, []);

     useEffect(() => {
        setStatusMessage(t('ready'));
    }, [t, currentLang]); // Update status message when language changes

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            if (file.size > MAX_FILE_SIZE_BYTES) {
                toast.error(t('errorFileTooLarge'));
                setSelectedFile(null);
                if (fileInputRef.current) fileInputRef.current.value = ""; // Reset file input
                return;
            }
            if (file.type !== 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' && !file.name.endsWith('.xlsx')) {
                toast.error(t('errorInvalidFileType'));
                setSelectedFile(null);
                if (fileInputRef.current) fileInputRef.current.value = ""; // Reset file input
                return;
            }
            setSelectedFile(file);
            setStatusMessage(t('fileSelected', { FILENAME: file.name }));
        } else {
            setSelectedFile(null);
            setStatusMessage(t('noFileSelected'));
        }
    };

    const handleSubmit = async () => {
        if (!selectedFile) {
            toast.error(t('errorNoFile'));
            return;
        }
        if (!user?.id) {
            toast.error(t('errorNoUser'));
            return;
        }
        if (!isInTelegramContext && process.env.NODE_ENV !== 'development') {
            // Optional: Restrict usage outside Telegram if needed, except in dev
            toast.error("This feature is intended for use within Telegram.");
            return;
        }


        setIsLoading(true);
        setStatusMessage(t('uploading'));

        const formData = new FormData();
        formData.append('xlsxFile', selectedFile);

        try {
            setStatusMessage(t('converting'));
            const result = await convertXlsxToPdfAndSend(formData, String(user.id));

            if (result.success) {
                toast.success(result.message || t('successMessage'));
                setStatusMessage(result.message || t('successMessage'));
                setSelectedFile(null); // Clear selection on success
                if (fileInputRef.current) fileInputRef.current.value = ""; // Reset file input
            } else {
                const errorKey = result.error?.includes("Telegram") ? 'telegramSendFailed' : 'conversionFailed';
                toast.error(t(errorKey, { ERROR: result.error || t('uploadFailed') }), { duration: 7000 });
                setStatusMessage(t(errorKey, { ERROR: result.error || t('uploadFailed') }));
                logger.error('XLSX to PDF conversion failed:', result.error);
            }
        } catch (error) {
            toast.error(t('unexpectedError', { ERROR: (error as Error).message || 'Unknown client error' }), { duration: 7000 });
            setStatusMessage(t('unexpectedError', { ERROR: (error as Error).message || 'Unknown client error' }));
            logger.error('Client-side error during XLSX to PDF submission:', error);
        } finally {
            setIsLoading(false);
        }
    };

    if (isAuthLoading) {
        return (
            <div className="flex justify-center items-center min-h-screen pt-20 bg-black">
                <FontAwesomeIcon icon={faSpinner} spin size="2x" className="text-brand-cyan" />
                <span className="ml-3 text-brand-cyan font-mono">{t('loadingUser')}</span>
            </div>
        );
    }

    return (
        <div className={cn(
            "min-h-screen flex flex-col items-center justify-center pt-24 pb-10 font-mono",
            "bg-gradient-to-br from-gray-900 via-black to-gray-800 text-gray-200 px-4"
        )}>
            <Toaster position="bottom-center" richColors toastOptions={{
                 className: '!bg-gray-800/90 !border !border-brand-purple/50 !text-gray-200 !font-mono !shadow-lg !backdrop-blur-sm',
            }} />

            <div className="absolute top-4 right-4">
                <button
                    onClick={toggleLang}
                    className="p-2 bg-gray-700/50 rounded-md hover:bg-gray-600/70 transition-colors flex items-center gap-1.5 text-xs text-cyan-300"
                    aria-label={t("toggleLanguage")}
                    title={t("toggleLanguage")}
                >
                    <FontAwesomeIcon icon={faLanguage} />
                    {currentLang === 'en' ? 'RU' : 'EN'}
                </button>
            </div>

            <div className="w-full max-w-lg p-6 md:p-8 border border-brand-cyan/30 rounded-lg bg-black/60 backdrop-blur-md shadow-2xl shadow-brand-cyan/20 text-center">
                <FontAwesomeIcon icon={faFilePdf} className="text-5xl text-brand-cyan mb-4" />
                <h1 className="text-3xl md:text-4xl font-bold text-center text-brand-cyan cyber-text glitch mb-2" data-text={t("pageTitle")}>
                    {t("pageTitle")}
                </h1>
                <p className="text-sm text-gray-400 mb-6">
                    {t("pageSubtitle")}
                </p>

                <div className="mb-6">
                    <label
                        htmlFor="xlsxFile"
                        className={cn(
                            "w-full flex items-center justify-center px-4 py-3 border-2 border-dashed rounded-md cursor-pointer transition-colors",
                            "border-brand-yellow/50 hover:border-brand-yellow hover:bg-brand-yellow/10 text-brand-yellow"
                        )}
                    >
                        <FontAwesomeIcon icon={faFileExcel} className="mr-3 text-xl" />
                        <span className="font-semibold">{selectedFile ? t('fileSelected', { FILENAME: selectedFile.name }) : t('selectFile')}</span>
                        <input
                            id="xlsxFile"
                            ref={fileInputRef}
                            type="file"
                            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                            onChange={handleFileChange}
                            className="sr-only"
                            disabled={isLoading}
                        />
                    </label>
                </div>


                <button
                    onClick={handleSubmit}
                    disabled={isLoading || !selectedFile || !user?.id}
                    className={cn(
                        "w-full px-6 py-3 rounded-md text-lg font-semibold transition duration-150 flex items-center justify-center gap-3 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black",
                        isLoading || !selectedFile || !user?.id
                            ? "bg-gray-600 text-gray-400 cursor-not-allowed"
                            : "bg-brand-green/80 hover:bg-brand-green text-black focus:ring-brand-green"
                    )}
                >
                    {isLoading ? (
                        <>
                            <FontAwesomeIcon icon={faSpinner} spin />
                            <span>{statusMessage || t('converting')}</span>
                        </>
                    ) : (
                        <>
                             <VibeContentRenderer content="::FaPaperPlane::" />
                            <span>{t('convertToPdfAndSend')}</span>
                        </>
                    )}
                </button>

                <div className="mt-6 text-xs text-gray-500 min-h-[20px]">
                    {t('status')}: {isLoading ? statusMessage : (selectedFile ? t('ready') : t('noFileSelected'))}
                </div>
            </div>
        </div>
    );
}