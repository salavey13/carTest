"use client";

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { generatePdfFromMarkdownAndSend } from '@/app/topdf/actions';
import { logger } from '@/lib/logger';
import { Toaster, toast } from 'sonner';
import { cn } from "@/lib/utils";
import { VibeContentRenderer } from '@/components/VibeContentRenderer'; 
import * as XLSX from 'xlsx';
import { Button } from "@/components/ui/button"; 
import { Input } from '@/components/ui/input'; 
import { Label } from '@/components/ui/label'; 

const translations: Record<string, Record<string, string>> = {
  en: {
    "pageTitle": "Personality Report PDF Generator ✨", // Updated Title
    "pageSubtitle": "Enter user data and their answers to generate a personalized PDF report.", // Updated Subtitle
    "step1Title": "Step 1: Upload XLSX & Prepare Data for AI (Optional for other reports)",
    "selectFile": "Select XLSX Report (Optional)",
    "noFileSelected": "No file selected",
    "fileSelected": "File: %%FILENAME%%",
    "promptGenerated": "Prompt for Gemini AI generated!",
    "copyPromptAndData": "Copy AI Prompt & Data",
    "goToGemini": "Open Google AI Studio",
    "step2Title": "Step 2: Input User Answers & Report Content", // Updated Title
    "pasteMarkdown": "Paste user's answers and any additional report content here (Markdown format):", // Updated Label
    "generateAndSendPdf": "Generate PDF & Send to Telegram",
    "processing": "Processing...",
    "parsingXlsx": "Parsing XLSX...",
    "generatingPrompt": "Generating AI Prompt...",
    "generatingPdf": "Generating PDF Report...",
    "sendingPdf": "Sending PDF to Telegram...",
    "errorNoFileForPrompt": "To generate a prompt for AI from XLSX, please select an XLSX file first.",
    "errorNoUser": "User information not available. Please ensure you are logged in via Telegram.",
    "errorFileTooLarge": "File is too large. Maximum size: 5MB.",
    "errorInvalidFileType": "Invalid file type. Only .xlsx files are accepted.",
    "errorNoMarkdown": "Please paste the user's answers or report content for the PDF.", // Updated error
    "successMessage": "Success! Your PDF report has been sent to your Telegram chat.",
    "processFailed": "Processing failed. Please try again.",
    "pdfGenerationFailed": "PDF Generation Failed: %%ERROR%%",
    "telegramSendFailed": "Failed to send PDF to Telegram: %%ERROR%%",
    "promptCopySuccess": "Prompt and data copied to clipboard!",
    "promptCopyError": "Failed to copy prompt. Please copy manually.",
    "unexpectedError": "An unexpected error occurred: %%ERROR%%",
    "loadingUser": "Loading user data...",
    "status": "Status",
    "readyForUpload": "Ready for user data and report content.", // Updated status
    "readyForGemini": "Ready for Gemini AI (if XLSX used). Prompt generated.",
    "readyForPdf": "Ready to generate PDF from content.", // Updated status
    "toggleLanguage": "Toggle Language",
    "manualCopyPrompt": "Manual Copy Area (if auto-copy fails):",
    "step3Title": "Step 3: Create PDF",
    "userDataTitle": "User Data for Personality Report", // Updated title
    "userNameLabel": "User's Name",
    "userAgeLabel": "User's Age",
    "userGenderLabel": "User's Gender",
  },
  ru: {
    "pageTitle": "Генератор PDF: Расшифровка Личности ✨", // Updated Title
    "pageSubtitle": "Введите данные пользователя и его ответы на вопросы для создания персонализированного PDF-отчета.", // Updated Subtitle
    "step1Title": "Шаг 1: Загрузите XLSX и Подготовьте Данные для AI (Опционально для других отчетов)",
    "selectFile": "Выберите XLSX Отчет (Опционально)",
    "noFileSelected": "Файл не выбран",
    "fileSelected": "Файл: %%FILENAME%%",
    "promptGenerated": "Промпт для Gemini AI сгенерирован!",
    "copyPromptAndData": "Копировать AI Промпт",
    "goToGemini": "Перейти в Gemini",
    "step2Title": "Шаг 2: Введите Ответы Пользователя и Содержимое Отчета", // Updated Title
    "pasteMarkdown": "Вставьте сюда ответы пользователя и любой дополнительный текст для отчета (в формате Markdown):", // Updated Label
    "generateAndSendPdf": "PDF в Telegram",
    "processing": "Обработка...",
    "parsingXlsx": "Парсинг XLSX...",
    "generatingPrompt": "Генерация AI Промпта...",
    "generatingPdf": "Генерация PDF Отчета...",
    "sendingPdf": "Отправка PDF в Telegram...",
    "errorNoFileForPrompt": "Для генерации промпта для AI из XLSX, пожалуйста, сначала выберите XLSX файл.",
    "errorNoUser": "Информация о пользователе недоступна. Убедитесь, что вы авторизованы через Telegram.",
    "errorFileTooLarge": "Файл слишком большой. Максимальный размер: 5МБ.",
    "errorInvalidFileType": "Неверный тип файла. Принимаются только .xlsx файлы.",
    "errorNoMarkdown": "Пожалуйста, вставьте ответы пользователя или текст отчета для PDF.", // Updated error
    "successMessage": "Успешно! Ваш PDF отчет отправлен в ваш Telegram чат.",
    "processFailed": "Ошибка обработки. Пожалуйста, попробуйте снова.",
    "pdfGenerationFailed": "Ошибка Генерации PDF: %%ERROR%%",
    "telegramSendFailed": "Не удалось отправить PDF в Telegram: %%ERROR%%",
    "promptCopySuccess": "Промпт и данные скопированы в буфер обмена!",
    "promptCopyError": "Не удалось скопировать промпт. Скопируйте вручную.",
    "unexpectedError": "Произошла непредвиденная ошибка: %%ERROR%%",
    "loadingUser": "Загрузка данных пользователя...",
    "status": "Статус",
    "readyForUpload": "Готово к вводу данных пользователя и контента отчета.", // Updated status
    "readyForGemini": "Готово для Gemini AI (если используется XLSX). Промпт сгенерирован.",
    "readyForPdf": "Готово к генерации PDF из контента.", // Updated status
    "toggleLanguage": "Переключить язык",
    "manualCopyPrompt": "Область для ручного копирования (если авто-копирование не удалось):",
    "step3Title": "Шаг 3: Создать PDF",
    "userDataTitle": "Данные Пользователя для Расшифровки Личности", // Updated title
    "userNameLabel": "Имя пользователя",
    "userAgeLabel": "Возраст пользователя",
    "userGenderLabel": "Пол пользователя",
  }
};

const MAX_FILE_SIZE_MB = 5;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export default function ToPdfPageWithGemini() {
    const { user, isAuthLoading } = useAppContext();
    const [selectedFile, setSelectedFile] = useState<File | null>(null); 
    const [isLoading, setIsLoading] = useState(false);
    const [statusMessage, setStatusMessage] = useState<string>('');
    const [currentStage, setCurrentStage] = useState<'upload' | 'gemini' | 'pdf'>('upload');
    const [generatedPrompt, setGeneratedPrompt] = useState<string>('');
    const [markdownInput, setMarkdownInput] = useState<string>('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [userName, setUserName] = useState<string>('');
    const [userAge, setUserAge] = useState<string>('');
    const [userGender, setUserGender] = useState<string>('');

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
        else if (currentStage === 'gemini' && generatedPrompt) setStatusMessage(t('readyForGemini'));
        else if (currentStage === 'gemini' && !generatedPrompt) setStatusMessage(t('readyForPdf'));
        else if (currentStage === 'pdf') setStatusMessage(t('readyForPdf'));
    }, [t, currentStage, currentLang, generatedPrompt]);

    // --- Адаптированный `handleFileChangeAndPreparePrompt` ---
    // Эта функция теперь в основном для сценария XLSX, но мы ее оставляем.
    // Для "расшифровки личности" она НЕ будет главным источником данных для PDF.
    const handleFileChangeAndPreparePrompt = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) {
            setSelectedFile(null); setGeneratedPrompt(''); setCurrentStage('upload'); setStatusMessage(t('noFileSelected'));
            return;
        }
        // ... (остальная часть функции без изменений, она для XLSX) ...
        if (file.size > MAX_FILE_SIZE_BYTES) {
            toast.error(t('errorFileTooLarge')); setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = "";
            return;
        }
        if (file.type !== 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' && !file.name.endsWith('.xlsx')) {
            toast.error(t('errorInvalidFileType')); setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = "";
            return;
        }
        
        setSelectedFile(file); setIsLoading(true); setStatusMessage(t('parsingXlsx'));

        try {
            const arrayBuffer = await file.arrayBuffer();
            const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const csvDataString = XLSX.utils.sheet_to_csv(worksheet);

            setStatusMessage(t('generatingPrompt'));
            // ОБНОВЛЕННЫЙ ПРОМПТ (ОРИЕНТИРОВАН НА ОБЩИЙ АНАЛИЗ XLSX, А НЕ ПСИХОЛОГИЮ)
            // Если AI нужен для психо-отчета, этот промпт нужно будет адаптировать или создать отдельный.
            // Сейчас он больше для финансовой аналитики, как было изначально.
            const promptForAI = `Ты — высококвалифицированный AI-аналитик. Твоя задача — проанализировать предоставленные данные из отчета (возможно, XLSX) и составить подробное резюме в формате Markdown.
ВАЖНО: Твой ответ ДОЛЖЕН БЫТЬ ПОЛНОСТЬЮ НА РУССКОМ ЯЗЫКЕ.

Исходное имя файла отчета (если был загружен): "${file.name}".
Данные взяты с листа (если был загружен): "${firstSheetName}".

Информация о пользователе (если предоставлена):
Имя: ${userName || "Не указано"}
Возраст: ${userAge || "Не указан"}
Пол: ${userGender || "Не указан"}

**Запрос на Анализ (если есть данные из файла):**
Пожалуйста, проведи тщательный анализ данных ниже. Сконцентрируйся на следующем:
1.  **Краткое резюме (Executive Summary):** Сжатый (3-5 предложений) обзор ключевой информации из данных.
2.  **Основные тезисы и наблюдения:** Выдели значительные моменты. Используй маркированные списки.
3.  **Потенциальные инсайты:** Какие интересные закономерности или выводы можно сделать?

**Если данные из файла НЕ предоставлены, или ты анализируешь другой текст (например, ответы на вопросы, вставленные пользователем):**
Составь структурированный отчет на основе предоставленного текста в поле "Содержимое Отчета". Учитывай информацию о пользователе (имя, возраст, пол), если она есть. Отчет должен быть в формате Markdown на русском языке.

**Требования к формату вывода (Markdown на русском языке):**
- Используй заголовки (например, \`# Расшифровка для ${userName || 'Пользователя'}\`, \`## Ответы на вопросы\`).
- Используй маркированные списки (\`* \` или \`- \`).
- Используй выделение жирным шрифтом (\`**текст**\`).

**Данные из XLSX (если были загружены, могут быть усечены):**
\`\`\`csv
${csvDataString.substring(0, 15000)} 
\`\`\`

Пожалуйста, предоставь подробный и содержательный отчет.
`;
            setGeneratedPrompt(promptForAI);
            setCurrentStage('gemini');
            setStatusMessage(t('promptGenerated')); 
            toast.success(t('promptGenerated'));
        } catch (error) {
            logger.error("Error parsing XLSX for AI prompt:", error);
            toast.error(t('unexpectedError', { ERROR: (error as Error).message }));
            setCurrentStage('upload');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCopyToClipboard = (text: string, successMessageKey: string) => {
        if (!text && selectedFile) { // Если промпт не сгенерирован, но есть XLSX файл
             toast.error(t('errorNoFileForPrompt')); // Или другая ошибка, если XLSX не для промпта
             return;
        }
        if (!text && !selectedFile) { // Если нет ни промпта, ни файла XLSX
            toast.info("Сначала загрузите XLSX или введите текст для AI.");
            return;
        }
        navigator.clipboard.writeText(text)
            .then(() => toast.success(t(successMessageKey)))
            .catch(err => {
                toast.error(t('promptCopyError'));
                logger.error('Clipboard copy failed:', err);
            });
    };

    const handleGeneratePdf = async () => {
        if (!markdownInput.trim()) { toast.error(t('errorNoMarkdown')); return; }
        if (!user?.id) { toast.error(t('errorNoUser')); return; }
        
        const reportFileNameBase = selectedFile?.name || (userName ? `Отчет_для_${userName.replace(/\s/g, '_')}` : "Пользовательский_Отчет");

        setIsLoading(true); setStatusMessage(t('generatingPdf')); setCurrentStage('pdf');

        try {
            const result = await generatePdfFromMarkdownAndSend(
                markdownInput, 
                String(user.id), 
                reportFileNameBase,
                userName.trim() || undefined,
                userAge.trim() || undefined,
                userGender.trim() || undefined
            );
            if (result.success) {
                toast.success(result.message || t('successMessage'));
                setStatusMessage(result.message || t('successMessage'));
                setMarkdownInput(''); setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = "";
                setGeneratedPrompt(''); setUserName(''); setUserAge(''); setUserGender('');
                setCurrentStage('upload');
            } else {
                toast.error(t('pdfGenerationFailed', { ERROR: result.error || 'Unknown error' }), { duration: 7000 });
                setStatusMessage(t('pdfGenerationFailed', { ERROR: result.error || 'Unknown error' }));
                setCurrentStage('gemini'); 
            }
        } catch (error) {
            toast.error(t('unexpectedError', { ERROR: (error as Error).message }), { duration: 7000 });
            setStatusMessage(t('unexpectedError', { ERROR: (error as Error).message }));
            setCurrentStage('gemini');
        } finally {
            setIsLoading(false);
        }
    };
    
    if (isAuthLoading) {
        return (
            <div className="flex justify-center items-center min-h-screen pt-20 bg-black">
                <VibeContentRenderer content="::FaSpinner className='animate-spin text-brand-cyan text-2xl'::" />
                <span className="ml-3 text-brand-cyan font-mono">{t('loadingUser')}</span>
            </div>
        );
    }

    return (
        <div className={cn("min-h-screen flex flex-col items-center pt-24 pb-10", "bg-gradient-to-br from-slate-900 via-black to-indigo-900/50 text-gray-200 px-4 font-mono")}>
            <Toaster position="bottom-center" richColors toastOptions={{ className: '!bg-gray-800/90 !border !border-brand-purple/50 !text-gray-200 !font-mono !shadow-lg !backdrop-blur-sm' }} />
            <div className="absolute top-4 right-4 z-20"> 
                <button onClick={toggleLang} className="p-2 bg-slate-700/50 rounded-md hover:bg-slate-600/70 transition-colors flex items-center gap-1.5 text-xs text-cyan-300 shadow-md" title={t("toggleLanguage")}> 
                    <VibeContentRenderer content="::FaLanguage::" /> {currentLang === 'en' ? 'RU' : 'EN'} 
                </button> 
            </div>

            <div className="w-full max-w-2xl p-6 md:p-8 border border-brand-orange/40 rounded-xl bg-black/80 backdrop-blur-xl shadow-2xl shadow-brand-orange/30">
                <VibeContentRenderer content="::FaUserCheck::" className="text-6xl text-brand-orange mx-auto mb-5 animate-pulse" /> 
                <h1 
                    className="font-sans text-4xl md:text-5xl font-extrabold text-center text-white uppercase cyber-text glitch mb-2" 
                    data-text={t("pageTitle")}
                    style={{ textShadow: '2px 2px 0px #000000, 4px 4px 0px #EF9A3F' }}
                >
                    {t("pageTitle")}
                </h1>
                <p className="text-sm text-center text-gray-400 mb-10">{t("pageSubtitle")}</p>

                {/* Step 1: Upload XLSX (Optional) */}
                <div className={cn("p-5 border-2 border-dashed border-brand-yellow/40 rounded-xl mb-8 bg-slate-800/40 shadow-inner shadow-black/30")}>
                    <h2 className="text-xl font-semibold text-brand-yellow mb-4 flex items-center">
                        <VibeContentRenderer content="::FaArrowUpFromBracket::" className="mr-2 w-5 h-5"/>
                        {t("step1Title")}
                    </h2>
                    <label htmlFor="xlsxFile" className={cn("w-full flex flex-col items-center justify-center px-4 py-6 border-2 border-dashed rounded-lg cursor-pointer transition-all duration-200 ease-in-out", "border-brand-yellow/60 hover:border-brand-yellow hover:bg-brand-yellow/10 text-brand-yellow", isLoading && currentStage === 'upload' ? "opacity-70 cursor-not-allowed" : "hover:scale-105")}>
                        <VibeContentRenderer content="::FaFileExcel::" className="mr-3 text-3xl mb-2" />
                        <span className="font-semibold text-sm">{selectedFile ? t('fileSelected', { FILENAME: selectedFile.name }) : t('selectFile')}</span>
                        <input id="xlsxFile" ref={fileInputRef} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={handleFileChangeAndPreparePrompt} className="sr-only" disabled={isLoading && currentStage === 'upload'} />
                    </label>
                    {generatedPrompt && ( // Only show copy/go to AI if prompt is generated (meaning XLSX was processed)
                        <div className="mt-4 space-y-3">
                             <textarea
                                id="geminiPrompt"
                                readOnly
                                value={generatedPrompt}
                                rows={5}
                                className="w-full p-2.5 text-xs bg-slate-900/70 border border-slate-700 rounded-md text-gray-300 simple-scrollbar shadow-sm"
                            />
                            <div className="flex flex-col sm:flex-row gap-3">
                                <Button onClick={() => handleCopyToClipboard(generatedPrompt, 'promptCopySuccess')} variant="outline" className="border-brand-cyan text-brand-cyan hover:bg-brand-cyan/20 hover:text-brand-cyan flex-1 py-2.5 text-sm">
                                    <VibeContentRenderer content="::FaCopy::" className="mr-2"/>{t("copyPromptAndData")}
                                </Button>
                                <Button variant="outline" asChild className="border-brand-blue text-brand-blue hover:bg-brand-blue/20 hover:text-brand-blue flex-1 py-2.5 text-sm">
                                  <a href="https://aistudio.google.com/" target="_blank" rel="noopener noreferrer" >
                                    <VibeContentRenderer content="::FaGoogle::" className="mr-2"/>{t("goToGemini")}
                                  </a>
                                </Button>
                            </div>
                        </div>
                    )}
                </div>

                {/* User Data Inputs */}
                 <div className={cn("p-5 border-2 border-dashed border-brand-blue/40 rounded-xl mb-8 bg-slate-800/40 shadow-inner shadow-black/30")}>
                    <h2 className="text-xl font-semibold text-brand-blue mb-4 flex items-center">
                        <VibeContentRenderer content="::FaUserEdit::" className="mr-2 w-5 h-5"/>
                        {t("userDataTitle")}
                    </h2>
                    <div className="space-y-3">
                        <div>
                            <Label htmlFor="userName" className="text-xs text-gray-400">{t("userNameLabel")}</Label>
                            <Input id="userName" type="text" value={userName} onChange={(e) => setUserName(e.target.value)} placeholder="Иван Иванов" className="w-full p-2 text-sm bg-slate-700/50 border-slate-600 rounded-md focus:ring-brand-blue focus:border-brand-blue" />
                        </div>
                        <div>
                            <Label htmlFor="userAge" className="text-xs text-gray-400">{t("userAgeLabel")}</Label>
                            <Input id="userAge" type="text" value={userAge} onChange={(e) => setUserAge(e.target.value)} placeholder="30" className="w-full p-2 text-sm bg-slate-700/50 border-slate-600 rounded-md focus:ring-brand-blue focus:border-brand-blue" />
                        </div>
                        <div>
                            <Label htmlFor="userGender" className="text-xs text-gray-400">{t("userGenderLabel")}</Label>
                            <Input id="userGender" type="text" value={userGender} onChange={(e) => setUserGender(e.target.value)} placeholder="Мужчина/Женщина" className="w-full p-2 text-sm bg-slate-700/50 border-slate-600 rounded-md focus:ring-brand-blue focus:border-brand-blue" />
                        </div>
                    </div>
                </div>

                {/* Step 2: Markdown Input */}
                <div className={cn("p-5 border-2 border-dashed border-brand-cyan/40 rounded-xl mb-8 bg-slate-800/40 shadow-inner shadow-black/30")}>
                    <h2 className="text-xl font-semibold text-brand-cyan mb-4 flex items-center">
                        <VibeContentRenderer content="::FaKeyboard::" className="mr-2 w-5 h-5"/>
                        {t("step2Title")}
                    </h2>
                     <label htmlFor="markdownInput" className="text-sm text-gray-300 block mt-4 mb-1.5">{t("pasteMarkdown")}</label>
                     <textarea
                        id="markdownInput"
                        value={markdownInput}
                        onChange={(e) => setMarkdownInput(e.target.value)}
                        placeholder="Пример:\n# Расшифровка для Ивана\n## Ответы на вопросы:\n* Вопрос 1: Ответ Ивана...\n* Вопрос 2: Другой ответ..."
                        rows={10}
                        className="w-full p-3 border rounded-md bg-slate-900/70 border-slate-700 text-gray-200 focus:ring-2 focus:ring-brand-pink outline-none placeholder-gray-500 font-mono text-sm simple-scrollbar shadow-sm"
                        disabled={isLoading}
                    />
                </div>
                
                {/* Step 3: Generate PDF */}
                <div className={cn("p-5 border-2 border-dashed border-brand-pink/40 rounded-xl bg-slate-800/40 shadow-inner shadow-black/30", !markdownInput.trim() && "opacity-60 blur-sm pointer-events-none")}>
                     <h2 className="text-xl font-semibold text-brand-pink mb-4 flex items-center">
                        <VibeContentRenderer content="::FaFilePdf::" className="mr-2 w-5 h-5"/>
                        {t("step3Title")}
                     </h2>
                    <Button onClick={handleGeneratePdf} disabled={isLoading || !markdownInput.trim() || !user?.id } className={cn("w-full text-lg py-3.5 bg-gradient-to-r from-brand-pink via-brand-purple to-brand-blue text-white hover:shadow-brand-pink/50 hover:brightness-125 focus:ring-brand-pink shadow-lg", (isLoading || !markdownInput.trim()) && "opacity-50 cursor-not-allowed")}>
                        {isLoading && currentStage === 'pdf' 
                            ? (<span className="flex items-center justify-center text-sm">
                                <VibeContentRenderer content="::FaSpinner className='animate-spin mr-2.5'::" /> {statusMessage || t('processing')}
                              </span>) 
                            : <><VibeContentRenderer content="::FaPaperPlane::" className="mr-2.5"/> {t('generateAndSendPdf')}</>
                        }
                    </Button>
                </div>
                
                <div className="mt-8 text-xs text-center text-gray-400 min-h-[20px] font-orbitron uppercase tracking-wider">
                   {t('status')}: {isLoading ? statusMessage : (!markdownInput.trim() ? t('readyForUpload') : t('readyForPdf'))}
                </div>
                 <p className="text-center text-xs text-gray-500 mt-6">
                    {currentLang === 'ru' ? 'Для анализа XLSX используется Gemini AI. Для генерации PDF из Markdown AI не требуется.' : 'XLSX analysis uses Google Gemini AI. PDF generation from Markdown does not require AI.'}
                </p>
            </div>
        </div>
    );
}