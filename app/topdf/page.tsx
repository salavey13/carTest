"use client";

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUpload, faFilePdf, faSpinner, faCheckCircle, faTriangleExclamation, faLanguage, faFileExcel, faBrain } from '@fortawesome/free-solid-svg-icons';
import { convertXlsxToPdfAndSend } from '@/app/topdf/actions';
import { logger } from '@/lib/logger';
import { Toaster, toast } from 'sonner';
import { cn } from "@/lib/utils";
import VibeContentRenderer from '@/components/VibeContentRenderer'; 

const translations: Record<string, Record<string, string>> = {
  en: {
    "pageTitle": "AI Financial Report Analyzer (XLSX to PDF)",
    "pageSubtitle": "Upload your XLSX financial report. Our AI will analyze it, generate a summary, and send a PDF report to your Telegram.",
    "selectFile": "Select XLSX Report",
    "noFileSelected": "No file selected",
    "fileSelected": "File: %%FILENAME%%",
    "analyzeAndSend": "Analyze & Send PDF Report",
    "processing": "Processing...",
    "parsingXlsx": "Parsing XLSX...",
    "analyzingData": "AI Analyzing Data...",
    "generatingPdf": "Generating PDF Report...",
    "sendingPdf": "Sending PDF to Telegram...",
    "errorNoFile": "Please select an XLSX file first.",
    "errorNoUser": "User information not available. Please ensure you are logged in via Telegram.",
    "errorFileTooLarge": "File is too large. Maximum size: 5MB.",
    "errorInvalidFileType": "Invalid file type. Only .xlsx files are accepted.",
    "successMessage": "Success! Your AI-generated PDF report has been sent to your Telegram chat.",
    "processFailed": "Processing failed. Please try again.",
    "aiAnalysisFailed": "AI Analysis Failed: %%ERROR%%",
    "pdfGenerationFailed": "PDF Generation Failed: %%ERROR%%",
    "telegramSendFailed": "Failed to send PDF to Telegram: %%ERROR%%",
    "unexpectedError": "An unexpected error occurred: %%ERROR%%",
    "loadingUser": "Loading user data...",
    "status": "Status",
    "ready": "Ready for AI analysis.",
    "toggleLanguage": "Toggle Language",
  },
  ru: {
    "pageTitle": "AI Анализатор Фин. Отчетов (XLSX в PDF)",
    "pageSubtitle": "Загрузите ваш XLSX фин. отчет. Наш AI проанализирует его, создаст сводку и отправит PDF-отчет в ваш Telegram.",
    "selectFile": "Выберите XLSX Отчет",
    "noFileSelected": "Файл не выбран",
    "fileSelected": "Файл: %%FILENAME%%",
    "analyzeAndSend": "Анализировать и Отправить PDF",
    "processing": "Обработка...",
    "parsingXlsx": "Парсинг XLSX...",
    "analyzingData": "AI Анализирует Данные...",
    "generatingPdf": "Генерация PDF Отчета...",
    "sendingPdf": "Отправка PDF в Telegram...",
    "errorNoFile": "Пожалуйста, сначала выберите XLSX файл.",
    "errorNoUser": "Информация о пользователе недоступна. Убедитесь, что вы авторизованы через Telegram.",
    "errorFileTooLarge": "Файл слишком большой. Максимальный размер: 5МБ.",
    "errorInvalidFileType": "Неверный тип файла. Принимаются только .xlsx файлы.",
    "successMessage": "Успешно! Ваш AI-сгенерированный PDF отчет отправлен в ваш Telegram чат.",
    "processFailed": "Ошибка обработки. Пожалуйста, попробуйте снова.",
    "aiAnalysisFailed": "Ошибка AI Анализа: %%ERROR%%",
    "pdfGenerationFailed": "Ошибка Генерации PDF: %%ERROR%%",
    "telegramSendFailed": "Не удалось отправить PDF в Telegram: %%ERROR%%",
    "unexpectedError": "Произошла непредвиденная ошибка: %%ERROR%%",
    "loadingUser": "Загрузка данных пользователя...",
    "status": "Статус",
    "ready": "Готово к AI анализу.",
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
    }, [t, currentLang]); 

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            if (file.size > MAX_FILE_SIZE_BYTES) {
                toast.error(t('errorFileTooLarge'));
                setSelectedFile(null);
                if (fileInputRef.current) fileInputRef.current.value = ""; 
                return;
            }
            if (file.type !== 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' && !file.name.endsWith('.xlsx')) {
                toast.error(t('errorInvalidFileType'));
                setSelectedFile(null);
                if (fileInputRef.current) fileInputRef.current.value = ""; 
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
        if (!selectedFile) { toast.error(t('errorNoFile')); return; }
        if (!user?.id) { toast.error(t('errorNoUser')); return; }
        if (!isInTelegramContext && process.env.NODE_ENV !== 'development') {
            toast.error("This feature is intended for use within Telegram."); return;
        }

        setIsLoading(true);
        setStatusMessage(t('parsingXlsx'));

        const formData = new FormData();
        formData.append('xlsxFile', selectedFile);

        // Sequence of status updates
        const statusUpdates = [
            t('analyzingData'),
            t('generatingPdf'),
            t('sendingPdf')
        ];
        let currentStatusIdx = 0;
        const intervalId = setInterval(() => {
            if(isLoading && currentStatusIdx < statusUpdates.length -1){ // don't update past last message if still loading
                 currentStatusIdx = (currentStatusIdx + 1);
                 setStatusMessage(statusUpdates[currentStatusIdx]);
            } else {
                // setStatusMessage(statusUpdates[statusUpdates.length-1]); // Ensure last message is set
            }

        }, 3000); // Update status every 3 seconds


        try {
            // The action now handles all steps including AI analysis
            const result = await convertXlsxToPdfAndSend(formData, String(user.id), String(user.id) /* Pass user.id for Coze */);
            clearInterval(intervalId);

            if (result.success) {
                toast.success(result.message || t('successMessage'));
                setStatusMessage(result.message || t('successMessage'));
                setSelectedFile(null); 
                if (fileInputRef.current) fileInputRef.current.value = ""; 
            } else {
                let errorKey = 'processFailed';
                if (result.error?.includes("AI analysis failed")) errorKey = 'aiAnalysisFailed';
                else if (result.error?.includes("PDF Generation Failed")) errorKey = 'pdfGenerationFailed';
                else if (result.error?.includes("Telegram")) errorKey = 'telegramSendFailed';
                
                toast.error(t(errorKey, { ERROR: result.error || t('processFailed') }), { duration: 7000 });
                setStatusMessage(t(errorKey, { ERROR: result.error || t('processFailed') }));
                logger.error('XLSX to AI PDF failed:', result.error);
            }
        } catch (error) {
            clearInterval(intervalId);
            toast.error(t('unexpectedError', { ERROR: (error as Error).message || 'Unknown client error' }), { duration: 7000 });
            setStatusMessage(t('unexpectedError', { ERROR: (error as Error).message || 'Unknown client error' }));
            logger.error('Client-side error during XLSX to AI PDF submission:', error);
        } finally {
            setIsLoading(false);
             if (intervalId) clearInterval(intervalId);
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
            "bg-gradient-to-br from-purple-900/30 via-black to-blue-900/30 text-gray-200 px-4"
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

            <div className="w-full max-w-xl p-6 md:p-8 border border-brand-pink/30 rounded-lg bg-black/70 backdrop-blur-lg shadow-2xl shadow-brand-pink/20 text-center">
                <VibeContentRenderer content="::FaBrain::" className="text-6xl text-brand-pink mb-5 animate-pulse" />
                <h1 className="text-3xl md:text-4xl font-bold text-center text-brand-pink cyber-text glitch mb-2" data-text={t("pageTitle")}>
                    {t("pageTitle")}
                </h1>
                <p className="text-sm text-gray-400 mb-8">
                    {t("pageSubtitle")}
                </p>

                <div className="mb-8">
                    <label
                        htmlFor="xlsxFile"
                        className={cn(
                            "w-full flex items-center justify-center px-4 py-3.5 border-2 border-dashed rounded-lg cursor-pointer transition-colors",
                            "border-brand-lime/50 hover:border-brand-lime hover:bg-brand-lime/10 text-brand-lime"
                        )}
                    >
                        <FontAwesomeIcon icon={faFileExcel} className="mr-3 text-2xl" />
                        <span className="font-semibold text-base">{selectedFile ? t('fileSelected', { FILENAME: selectedFile.name }) : t('selectFile')}</span>
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
                        "w-full px-6 py-4 rounded-md text-xl font-semibold transition duration-150 flex items-center justify-center gap-3 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black shadow-lg",
                        isLoading || !selectedFile || !user?.id
                            ? "bg-gray-700 text-gray-500 cursor-not-allowed"
                            : "bg-gradient-to-r from-brand-pink via-brand-purple to-brand-blue text-white hover:shadow-brand-pink/40 hover:brightness-110 focus:ring-brand-pink"
                    )}
                >
                    {isLoading ? (
                        <>
                            <FontAwesomeIcon icon={faSpinner} spin className="text-xl"/>
                            <span className="text-lg">{statusMessage || t('processing')}</span>
                        </>
                    ) : (
                        <>
                             <VibeContentRenderer content="::FaRocket::" className="text-xl"/>
                            <span className="text-lg">{t('analyzeAndSend')}</span>
                        </>
                    )}
                </button>

                <div className="mt-8 text-xs text-gray-500 min-h-[20px] font-orbitron">
                   <span className="uppercase">{t('status')}:</span> {isLoading ? statusMessage : (selectedFile ? t('ready') : t('noFileSelected'))}
                </div>
            </div>
             <p className="text-center text-xs text-gray-600 mt-8">
                {language === 'ru' ? 'Эта фича использует AI для анализа. Качество отчета зависит от предоставленных данных и возможностей AI.' : 'This feature uses AI for analysis. Report quality depends on the provided data and AI capabilities.'}
            </p>
        </div>
    );
}