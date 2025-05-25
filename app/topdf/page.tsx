"use client";

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUpload, faFilePdf, faSpinner, faCheckCircle, faTriangleExclamation, faLanguage, faFileExcel, faBrain, faCopy, faPaste, faExternalLinkAlt, faMagic } from '@fortawesome/free-solid-svg-icons';
import { generatePdfFromMarkdownAndSend } from '@/app/topdf/actions';
import { logger } from '@/lib/logger';
import { Toaster, toast } from 'sonner';
import { cn } from "@/lib/utils";
import VibeContentRenderer from '@/components/VibeContentRenderer'; 
import * as XLSX from 'xlsx';

const translations: Record<string, Record<string, string>> = {
  en: {
    "pageTitle": "XLSX Insights via Gemini AI ✨",
    "pageSubtitle": "Generate an AI-powered financial analysis of your XLSX report using Google AI Studio (Gemini).",
    "step1Title": "Step 1: Upload & Prepare Data for AI",
    "selectFile": "Select XLSX Report",
    "noFileSelected": "No file selected",
    "fileSelected": "File: %%FILENAME%%",
    "promptGenerated": "Prompt for Gemini AI generated!",
    "copyPromptAndData": "Copy Prompt & Data for Gemini",
    "goToGemini": "Open Google AI Studio (Gemini)",
    "step2Title": "Step 2: Get Analysis from Gemini AI",
    "pasteMarkdown": "Paste the full Markdown response from Gemini AI here:",
    "generateAndSendPdf": "Generate PDF & Send to Telegram",
    "processing": "Processing...",
    "parsingXlsx": "Parsing XLSX...",
    "generatingPrompt": "Generating AI Prompt...",
    "generatingPdf": "Generating PDF Report...",
    "sendingPdf": "Sending PDF to Telegram...",
    "errorNoFile": "Please select an XLSX file first.",
    "errorNoUser": "User information not available. Please ensure you are logged in via Telegram.",
    "errorFileTooLarge": "File is too large. Maximum size: 5MB.",
    "errorInvalidFileType": "Invalid file type. Only .xlsx files are accepted.",
    "errorNoMarkdown": "Please paste the Markdown response from Gemini AI.",
    "successMessage": "Success! Your AI-analyzed PDF report has been sent to your Telegram chat.",
    "processFailed": "Processing failed. Please try again.",
    "pdfGenerationFailed": "PDF Generation Failed: %%ERROR%%",
    "telegramSendFailed": "Failed to send PDF to Telegram: %%ERROR%%",
    "promptCopySuccess": "Prompt and data copied to clipboard!",
    "promptCopyError": "Failed to copy prompt. Please copy manually.",
    "unexpectedError": "An unexpected error occurred: %%ERROR%%",
    "loadingUser": "Loading user data...",
    "status": "Status",
    "readyForUpload": "Ready to upload XLSX.",
    "readyForGemini": "Ready for Gemini AI. Prompt copied.",
    "readyForPdf": "Ready to generate PDF from Markdown.",
    "toggleLanguage": "Toggle Language",
    "manualCopyPrompt": "Manual Copy Area (if auto-copy fails):",
  },
  ru: {
    "pageTitle": "XLSX Аналитика через Gemini AI ✨",
    "pageSubtitle": "Сгенерируйте AI-анализ вашего XLSX фин. отчета с помощью Google AI Studio (Gemini).",
    "step1Title": "Шаг 1: Загрузите и Подготовьте Данные для AI",
    "selectFile": "Выберите XLSX Отчет",
    "noFileSelected": "Файл не выбран",
    "fileSelected": "Файл: %%FILENAME%%",
    "promptGenerated": "Промпт для Gemini AI сгенерирован!",
    "copyPromptAndData": "Скопировать Промпт и Данные для Gemini",
    "goToGemini": "Открыть Google AI Studio (Gemini)",
    "step2Title": "Шаг 2: Получите Анализ от Gemini AI",
    "pasteMarkdown": "Вставьте полный Markdown-ответ от Gemini AI сюда:",
    "generateAndSendPdf": "Создать PDF и Отправить в Telegram",
    "processing": "Обработка...",
    "parsingXlsx": "Парсинг XLSX...",
    "generatingPrompt": "Генерация AI Промпта...",
    "generatingPdf": "Генерация PDF Отчета...",
    "sendingPdf": "Отправка PDF в Telegram...",
    "errorNoFile": "Пожалуйста, сначала выберите XLSX файл.",
    "errorNoUser": "Информация о пользователе недоступна. Убедитесь, что вы авторизованы через Telegram.",
    "errorFileTooLarge": "Файл слишком большой. Максимальный размер: 5МБ.",
    "errorInvalidFileType": "Неверный тип файла. Принимаются только .xlsx файлы.",
    "errorNoMarkdown": "Пожалуйста, вставьте Markdown-ответ от Gemini AI.",
    "successMessage": "Успешно! Ваш PDF отчет с AI-анализом отправлен в ваш Telegram чат.",
    "processFailed": "Ошибка обработки. Пожалуйста, попробуйте снова.",
    "pdfGenerationFailed": "Ошибка Генерации PDF: %%ERROR%%",
    "telegramSendFailed": "Не удалось отправить PDF в Telegram: %%ERROR%%",
    "promptCopySuccess": "Промпт и данные скопированы в буфер обмена!",
    "promptCopyError": "Не удалось скопировать промпт. Скопируйте вручную.",
    "unexpectedError": "Произошла непредвиденная ошибка: %%ERROR%%",
    "loadingUser": "Загрузка данных пользователя...",
    "status": "Статус",
    "readyForUpload": "Готово к загрузке XLSX.",
    "readyForGemini": "Готово для Gemini AI. Промпт скопирован.",
    "readyForPdf": "Готово к генерации PDF из Markdown.",
    "toggleLanguage": "Переключить язык",
    "manualCopyPrompt": "Область для ручного копирования (если авто-копирование не удалось):",
  }
};

const MAX_FILE_SIZE_MB = 5;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export default function ToPdfPageWithGemini() {
    const { user, isAuthLoading, isInTelegramContext } = useAppContext();
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [statusMessage, setStatusMessage] = useState<string>('');
    const [currentStage, setCurrentStage] = useState<'upload' | 'gemini' | 'pdf'>('upload');
    const [generatedPrompt, setGeneratedPrompt] = useState<string>('');
    const [markdownInput, setMarkdownInput] = useState<string>('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const initialLang = useMemo(() => (user?.language_code === 'ru' ? 'ru' : 'en'), [user?.language_code]);
    const [currentLang, setCurrentLang] = useState<'en' | 'ru'>(initialLang);

    useEffect(() => {
        const newLang = user?.language_code === 'ru' ? 'ru' : 'en';
        if (newLang !== currentLang) setCurrentLang(newLang);
    }, [user?.language_code, currentLang]);

    const t = useCallback((key: string, replacements?: Record<string, string | number>): string => {
        let translation = translations[currentLang]?.[key] || translations['en']?.[key] || key;
        if (replacements) {
            Object.keys(replacements).forEach(placeholder => {
                translation = translation.replace(new RegExp(`%%${placeholder.toUpperCase()}%%`, 'g'), String(replacements[placeholder]));
            });
        }
        return translation;
    }, [currentLang]);

    const toggleLang = useCallback(() => setCurrentLang(p => p === 'en' ? 'ru' : 'en'), []);

    useEffect(() => {
        if (currentStage === 'upload') setStatusMessage(t('readyForUpload'));
        else if (currentStage === 'gemini') setStatusMessage(t('readyForGemini'));
        else if (currentStage === 'pdf') setStatusMessage(t('readyForPdf'));
    }, [t, currentStage, currentLang]);

    const handleFileChangeAndPreparePrompt = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) {
            setSelectedFile(null);
            setGeneratedPrompt('');
            setCurrentStage('upload');
            setStatusMessage(t('noFileSelected'));
            return;
        }

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
        setIsLoading(true);
        setStatusMessage(t('parsingXlsx'));

        try {
            const arrayBuffer = await file.arrayBuffer();
            const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const csvDataString = XLSX.utils.sheet_to_csv(worksheet);

            setStatusMessage(t('generatingPrompt'));
            const promptForAI = `
You are a highly skilled financial analyst AI. Your task is to analyze the provided financial data from an XLSX report and generate a comprehensive summary in Markdown format.
The original filename of the report was: "${file.name}".
The data is from sheet: "${firstSheetName}".

**Analysis Request:**
Please perform a thorough analysis of the financial data below. Focus on:
1.  **Executive Summary:** A concise (3-5 sentences) overview of the company's financial health and performance based on the data.
2.  **Key Financial Metrics & Trends:** Identify and discuss important metrics (e.g., revenue, profit margins, expenses, growth rates). Highlight significant trends, positive or negative. Use bullet points for clarity.
3.  **Potential Insights & Observations:** What interesting patterns, anomalies, or insights can be derived from the data? Are there areas of strength or concern?
4.  **Recommendations (Optional but Preferred):** Based on your analysis, suggest 1-3 high-level recommendations or areas for further investigation.
5.  **Data Period:** If discernible from the data, state the period the report likely covers.

**Output Format Requirements:**
- Your entire response MUST be in **Markdown format**.
- Use headings (e.g., \`# Executive Summary\`, \`## Key Findings\`) to structure your report.
- Use bullet points (\`* \` or \`- \`) for lists (e.g., key findings, recommendations).
- Use bold (\`**text**\`) for emphasis where appropriate.
- If you include tables, ensure they are Markdown-formatted tables.

**Here is the financial data (extracted from the XLSX sheet and converted to CSV format for your convenience):**
\`\`\`csv
${csvDataString.substring(0, 25000)} 
\`\`\`
(Note: Data may be truncated if very large. Focus on the provided segment.)

Please provide a detailed and insightful Markdown report.
`;
            setGeneratedPrompt(promptForAI);
            setCurrentStage('gemini');
            setStatusMessage(t('promptGenerated'));
            toast.success(t('promptGenerated'));
            handleCopyToClipboard(promptForAI, t('promptCopySuccess'));
        } catch (error) {
            logger.error("Error parsing XLSX for AI prompt:", error);
            toast.error(t('unexpectedError', { ERROR: (error as Error).message }));
            setCurrentStage('upload');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCopyToClipboard = (text: string, successMessage: string) => {
        navigator.clipboard.writeText(text)
            .then(() => toast.success(successMessage))
            .catch(err => {
                toast.error(t('promptCopyError'));
                logger.error('Clipboard copy failed:', err);
            });
    };

    const handleGeneratePdf = async () => {
        if (!markdownInput.trim()) {
            toast.error(t('errorNoMarkdown'));
            return;
        }
        if (!user?.id) {
            toast.error(t('errorNoUser'));
            return;
        }
         if (!selectedFile?.name) { // Ensure we have the original filename
            toast.error("Original file context lost. Please re-upload.");
            setCurrentStage('upload');
            return;
        }


        setIsLoading(true);
        setStatusMessage(t('generatingPdf'));

        try {
            const result = await generatePdfFromMarkdownAndSend(markdownInput, String(user.id), selectedFile.name);
            if (result.success) {
                toast.success(result.message || t('successMessage'));
                setStatusMessage(result.message || t('successMessage'));
                setMarkdownInput('');
                setSelectedFile(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
                setGeneratedPrompt('');
                setCurrentStage('upload');
            } else {
                toast.error(t('pdfGenerationFailed', { ERROR: result.error || 'Unknown error' }));
                setStatusMessage(t('pdfGenerationFailed', { ERROR: result.error || 'Unknown error' }));
            }
        } catch (error) {
            toast.error(t('unexpectedError', { ERROR: (error as Error).message }));
            setStatusMessage(t('unexpectedError', { ERROR: (error as Error).message }));
        } finally {
            setIsLoading(false);
        }
    };
    
    if (isAuthLoading) { /* ... loading spinner ... */ }

    return (
        <div className={cn("min-h-screen flex flex-col items-center pt-24 pb-10 font-mono", "bg-gradient-to-br from-slate-900 via-black to-indigo-900/50 text-gray-200 px-4")}>
            <Toaster position="bottom-center" richColors toastOptions={{ className: '!bg-gray-800/90 !border !border-brand-purple/50 !text-gray-200 !font-mono !shadow-lg !backdrop-blur-sm' }} />
            <div className="absolute top-4 right-4"> <button onClick={toggleLang} className="p-2 bg-gray-700/50 rounded-md hover:bg-gray-600/70 transition-colors flex items-center gap-1.5 text-xs text-cyan-300" title={t("toggleLanguage")}> <FontAwesomeIcon icon={faLanguage} /> {currentLang === 'en' ? 'RU' : 'EN'} </button> </div>

            <div className="w-full max-w-2xl p-6 md:p-8 border border-brand-orange/40 rounded-xl bg-black/70 backdrop-blur-xl shadow-2xl shadow-brand-orange/25">
                <VibeContentRenderer content="::FaMagic::" className="text-6xl text-brand-orange mx-auto mb-5" />
                <h1 className="text-3xl md:text-4xl font-bold text-center text-brand-orange cyber-text glitch mb-2" data-text={t("pageTitle")}>{t("pageTitle")}</h1>
                <p className="text-sm text-center text-gray-400 mb-8">{t("pageSubtitle")}</p>

                {/* Step 1: Upload and Prepare Prompt */}
                <div className={cn("p-5 border border-dashed border-brand-yellow/30 rounded-lg mb-8 bg-slate-800/30", currentStage !== 'upload' && "opacity-50")}>
                    <h2 className="text-xl font-semibold text-brand-yellow mb-3 flex items-center"><VibeContentRenderer content="::FaFileUpload::" className="mr-2"/>{t("step1Title")}</h2>
                    <label htmlFor="xlsxFile" className={cn("w-full flex items-center justify-center px-4 py-3 border-2 border-dashed rounded-md cursor-pointer transition-colors mb-4", "border-brand-yellow/50 hover:border-brand-yellow hover:bg-brand-yellow/10 text-brand-yellow", isLoading && currentStage === 'upload' && "opacity-70 cursor-not-allowed")}>
                        <FontAwesomeIcon icon={faFileExcel} className="mr-3 text-xl" />
                        <span className="font-semibold">{selectedFile ? t('fileSelected', { FILENAME: selectedFile.name }) : t('selectFile')}</span>
                        <input id="xlsxFile" ref={fileInputRef} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={handleFileChangeAndPreparePrompt} className="sr-only" disabled={isLoading && currentStage === 'upload'} />
                    </label>
                    {generatedPrompt && currentStage === 'gemini' && (
                        <div className="space-y-3">
                            <p className="text-sm text-green-400"><FontAwesomeIcon icon={faCheckCircle} className="mr-2"/>{t("promptGenerated")}</p>
                             <textarea readOnly value={generatedPrompt} rows={5} className="w-full p-2 text-xs bg-slate-700/50 border border-slate-600 rounded-md text-gray-300 simple-scrollbar" title={t("manualCopyPrompt")}/>
                            <div className="flex flex-col sm:flex-row gap-3">
                                <Button onClick={() => handleCopyToClipboard(generatedPrompt, t('promptCopySuccess'))} variant="outline" className="border-brand-cyan text-brand-cyan hover:bg-brand-cyan/10 hover:text-brand-cyan flex-1">
                                    <FontAwesomeIcon icon={faCopy} className="mr-2"/>{t("copyPromptAndData")}
                                </Button>
                                <a href="https://aistudio.google.com/" target="_blank" rel="noopener noreferrer" className={cn(Button.styles.variants.outline, "border-brand-blue text-brand-blue hover:bg-brand-blue/10 hover:text-brand-blue flex-1 flex items-center justify-center")}>
                                    <FontAwesomeIcon icon={faExternalLinkAlt} className="mr-2"/>{t("goToGemini")}
                                </a>
                            </div>
                        </div>
                    )}
                </div>

                {/* Step 2: Paste Markdown and Generate PDF */}
                <div className={cn("p-5 border border-dashed border-brand-pink/30 rounded-lg bg-slate-800/30", currentStage !== 'gemini' && currentStage !== 'pdf' && "opacity-50 pointer-events-none")}>
                    <h2 className="text-xl font-semibold text-brand-pink mb-3 flex items-center"><VibeContentRenderer content="::FaPaste::" className="mr-2"/>{t("step2Title")}</h2>
                    <textarea
                        value={markdownInput}
                        onChange={(e) => setMarkdownInput(e.target.value)}
                        placeholder={t("pasteMarkdown")}
                        rows={8}
                        className="w-full p-3 border rounded-md bg-slate-700/50 border-slate-600 text-gray-200 focus:ring-2 focus:ring-brand-pink outline-none placeholder-gray-500 font-mono text-sm simple-scrollbar mb-4"
                        disabled={isLoading || currentStage !== 'gemini'}
                    />
                    <Button onClick={handleGeneratePdf} disabled={isLoading || !markdownInput.trim() || !user?.id || currentStage !== 'gemini'} className={cn("w-full text-lg py-3 bg-gradient-to-r from-brand-pink via-brand-purple to-brand-blue text-white hover:shadow-brand-pink/40 hover:brightness-110 focus:ring-brand-pink", (isLoading || !markdownInput.trim() || currentStage !== 'gemini') && "opacity-60 cursor-not-allowed")}>
                        {isLoading && currentStage === 'pdf' ? (<><FontAwesomeIcon icon={faSpinner} spin className="mr-2"/> {statusMessage || t('processing')}</>) : <><VibeContentRenderer content="::FaFilePdf::" className="mr-2"/> {t('generateAndSendPdf')}</>}
                    </Button>
                </div>
                
                <div className="mt-6 text-xs text-center text-gray-500 min-h-[20px] font-orbitron uppercase">
                   {t('status')}: {isLoading ? statusMessage : (currentStage === 'upload' ? (selectedFile ? t('fileSelected', {FILENAME: selectedFile.name}) : t('readyForUpload')) : (currentStage === 'gemini' ? t('readyForGemini') : t('readyForPdf'))) }
                </div>
                 <p className="text-center text-xs text-gray-600 mt-6">
                    {currentLang === 'ru' ? 'Эта фича использует Google Gemini AI. Качество отчета зависит от качества данных и возможностей AI.' : 'This feature uses Google Gemini AI. Report quality depends on data quality and AI capabilities.'}
                </p>
            </div>
        </div>
    );
}