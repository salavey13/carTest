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
import Image from 'next/image'; 

const HERO_IMAGE_URL = "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/page-specific-assets/topdf_hero_psycho_v3_wide.png"; 

const translations: Record<string, Record<string, string>> = {
  en: {
    "pageTitle": "AI PDF Report Generator ✨", 
    "pageSubtitle": "Generate a personalized PDF report. Input user data and answers, or analyze an XLSX with AI.", 
    "step1Title": "Step 1: User Data & Questions for AI",
    "generateDemoQuestions": "Generate Demo Questions & AI Prompt",
    "demoQuestionsGenerated": "Demo questions & AI prompt prepared!",
    "userDataTitle": "User Data for Report", 
    "userNameLabel": "User's Name",
    "userAgeLabel": "User's Age",
    "userGenderLabel": "User's Gender",
    "step2Title": "Step 2: Report Content (Paste AI Response or Final Answers)", 
    "pasteMarkdown": "Paste Markdown content here (e.g., AI analysis, or user's final answers to questions):", 
    "copyPromptAndData": "Copy Prompt & Data for AI",
    "goToGemini": "Open Gemini AI Studio",
    "step3Title": "Step 3: Create & Send PDF",
    "generateAndSendPdf": "Generate PDF & Send to Telegram",
    "processing": "Processing...",
    "parsingXlsx": "Parsing XLSX...", 
    "generatingPrompt": "Generating AI Prompt...", 
    "generatingPdf": "Generating PDF Report...",
    "sendingPdf": "Sending PDF to Telegram...",
    "errorNoUser": "User information not available. Please ensure you are logged in via Telegram.",
    "errorNoMarkdown": "Please paste the report content for the PDF.", 
    "successMessage": "Success! Your PDF report has been sent to your Telegram chat.",
    "processFailed": "Processing failed. Please try again.",
    "pdfGenerationFailed": "PDF Generation Failed: %%ERROR%%",
    "telegramSendFailed": "Failed to send PDF to Telegram: %%ERROR%%",
    "promptCopySuccess": "Prompt & data for AI copied to clipboard!",
    "promptCopyError": "Failed to copy. Please copy manually.",
    "unexpectedError": "An unexpected error occurred: %%ERROR%%",
    "loadingUser": "Loading user data...",
    "status": "Status",
    "readyForUserData": "Ready for user data and report content.",
    "readyForPdf": "Ready to generate PDF from content.", 
    "toggleLanguage": "Toggle Language",
    "manualCopyPrompt": "Manual Copy Area (if auto-copy fails):",
    "xlsxUploadOptionalTitle": "Optional: Upload XLSX for AI Analysis (Alternative Flow)",
    "selectFile": "Select XLSX Report (Optional)",
    "noFileSelected": "No file selected",
    "fileSelected": "File: %%FILENAME%%",
    "errorFileTooLarge": "File is too large. Maximum size: 5MB.",
    "errorInvalidFileType": "Invalid file type. Only .xlsx files are accepted.",
  },
  ru: {
    "pageTitle": "AI Генератор PDF Отчетов ✨", 
    "pageSubtitle": "Создайте персонализированный PDF-отчет. Введите данные пользователя и ответы, или проанализируйте XLSX с помощью AI.", 
    "step1Title": "Шаг 1: Данные Пользователя и Вопросы для AI",
    "generateDemoQuestions": "Сгенерировать Демо-Вопросы и Промпт для AI",
    "demoQuestionsGenerated": "Демо-вопросы и промпт для AI подготовлены!",
    "userDataTitle": "Данные Пользователя для Отчета", 
    "userNameLabel": "Имя пользователя",
    "userAgeLabel": "Возраст пользователя",
    "userGenderLabel": "Пол пользователя",
    "step2Title": "Шаг 2: Содержимое Отчета (Вставьте Ответ AI или Финальные Ответы)", 
    "pasteMarkdown": "Вставьте сюда Markdown-контент (например, анализ от AI или финальные ответы пользователя на вопросы):", 
    "copyPromptAndData": "Копировать Промпт и Данные для AI",
    "goToGemini": "Открыть Gemini AI Studio",
    "step3Title": "Шаг 3: Создать и Отправить PDF",
    "generateAndSendPdf": "PDF в Telegram",
    "processing": "Обработка...",
    "parsingXlsx": "Парсинг XLSX...", 
    "generatingPrompt": "Генерация AI Промпта...", 
    "generatingPdf": "Генерация PDF Отчета...",
    "sendingPdf": "Отправка PDF в Telegram...",
    "errorNoUser": "Информация о пользователе недоступна. Убедитесь, что вы авторизованы через Telegram.",
    "errorNoMarkdown": "Пожалуйста, вставьте содержимое отчета для PDF.", 
    "successMessage": "Успешно! Ваш PDF отчет отправлен в ваш Telegram чат.",
    "processFailed": "Ошибка обработки. Пожалуйста, попробуйте снова.",
    "pdfGenerationFailed": "Ошибка Генерации PDF: %%ERROR%%",
    "telegramSendFailed": "Не удалось отправить PDF в Telegram: %%ERROR%%",
    "promptCopySuccess": "Промпт и данные для AI скопированы в буфер обмена!",
    "promptCopyError": "Не удалось скопировать. Скопируйте вручную.",
    "unexpectedError": "Произошла непредвиденная ошибка: %%ERROR%%",
    "loadingUser": "Загрузка данных пользователя...",
    "status": "Статус",
    "readyForUserData": "Готово к вводу данных и контента.",
    "readyForPdf": "Готово к генерации PDF.", 
    "toggleLanguage": "Переключить язык",
    "manualCopyPrompt": "Область для ручного копирования (если авто-копирование не удалось):",
    "xlsxUploadOptionalTitle": "Опционально: Загрузка XLSX для Анализа AI (Альтернативный Сценарий)",
    "selectFile": "Выберите XLSX Отчет (Опционально)",
    "noFileSelected": "Файл не выбран",
    "fileSelected": "Файл: %%FILENAME%%",
    "errorFileTooLarge": "Файл слишком большой. Максимальный размер: 5МБ.",
    "errorInvalidFileType": "Неверный тип файла. Принимаются только .xlsx файлы.",
  }
};

const MAX_FILE_SIZE_MB = 5;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const generateFullPromptForAI = (userName?: string, userAge?: string, userGender?: string): string => {
    const name = userName || "Пользователь";
    let fullPrompt = `**Системный Промпт для AI (Gemini/Claude/ChatGPT):**
Ты — эмпатичный AI-психолог и аналитик личности. Твоя задача — на основе предоставленных данных о пользователе и его ответов на 15 вопросов составить глубокую, но позитивную и вдохновляющую "расшифровку личности". Отчет должен быть структурирован, легок для восприятия и полезен пользователю для самопознания.
ВАЖНО: Твой ответ ДОЛЖЕН БЫТЬ ПОЛНОСТЬЮ НА РУССКОМ ЯЗЫКЕ и в формате Markdown.

**Информация о пользователе:**
Имя: ${userName || "Не указано"}
Возраст: ${userAge || "Не указан"}
Пол: ${userGender || "Не указан"}

**Инструкции для отчета:**
1.  **Общее Впечатление и Ключевые Черты (Markdown Заголовок \`## Общее впечатление и ключевые черты\`):**
    *   Начни с теплого приветствия.
    *   Основываясь на ответах, выдели 3-5 наиболее ярких положительных черт личности. Опиши каждую кратко.
    *   Дай общую позитивную характеристику.
2.  **Анализ Ответов по Темам (Markdown Заголовок \`## Анализ ответов по темам\`):**
    *   Сгруппируй вопросы и ответы по возможным темам (например, "Ценности и Убеждения", "Отношение к Успеху и Трудностям", "Самовосприятие и Мечты", "Взаимодействие с Миром").
    *   Для каждой темы дай краткий анализ ответов, подсвечивая интересные моменты и возможные интерпретации. Избегай категоричных суждений, используй мягкие формулировки ("возможно, это указывает на...", "складывается впечатление, что...").
3.  **Потенциальные Сильные Стороны и Ресурсы (Markdown Заголовок \`## Ваши сильные стороны и ресурсы\`):**
    *   Перечисли выявленные сильные стороны, которые могут помочь пользователю в достижении целей.
4.  **Рекомендации для Саморазвития (Markdown Заголовок \`## Направления для дальнейшего роста\`):**
    *   Предложи 1-3 мягкие, конструктивные рекомендации или вопросы для дальнейшего самоанализа, основанные на ответах.
5.  **Вдохновляющее Заключение (Markdown Заголовок \`### Заключение\`):**
    *   Заверши отчет позитивным и мотивирующим посланием.

**Требования к формату вывода (Markdown на русском языке):**
- Используй заголовки Markdown (\`#\`, \`##\`, \`###\`).
- Используй маркированные списки (\`* \` или \`- \`) для перечислений.
- Используй выделение жирным шрифтом (\`**текст**\`) и курсивом (\`*текст*\`) для акцентов.

---
**ДАННЫЕ ОТ ПОЛЬЗОВАТЕЛЯ ДЛЯ АНАЛИЗА:**

# Расшифровка Личности для ${name}
`;
    if (userAge) fullPrompt += `**Возраст:** ${userAge}\n`;
    if (userGender) fullPrompt += `**Пол:** ${userGender}\n\n`;
    fullPrompt += `## Ответы на вопросы (пожалуйста, предоставьте развернутые ответы):\n\n`;
    
    const demoQuestions = [
        "1. Опишите себя тремя словами.", "2. Какое ваше самое яркое детское воспоминание и почему?", "3. Что для вас значит успех?",
        "4. Если бы вы могли изменить одну вещь в мире, что бы это было?", "5. Какая книга или фильм оказали на вас наибольшее влияние и почему?",
        "6. Что вас больше всего вдохновляет?", "7. Как вы справляетесь со стрессом или трудностями?", "8. Опишите идеальный для вас день.",
        "9. Какие качества вы больше всего цените в других людях?", "10. Какая ваша самая большая мечта или цель в жизни на данный момент?",
        "11. Что бы вы посоветовали себе 10-летней давности?", "12. В какой ситуации вы чувствуете себя наиболее комфортно и уверенно?",
        "13. Есть ли у вас хобби или увлечение, которое много для вас значит? Расскажите о нем.", "14. Как вы видите себя через 5 лет?",
        "15. Если бы вам нужно было выбрать саундтрек к вашей жизни, какая песня это была бы и почему?"
    ];
    fullPrompt += demoQuestions.map(q => `* ${q}\n  *Ответ:* ...`).join("\n\n");
    return fullPrompt;
};

export default function ToPdfPageWithPsychoFocus() {
    const { user, isAuthLoading } = useAppContext();
    const [selectedFile, setSelectedFile] = useState<File | null>(null); 
    const [isLoading, setIsLoading] = useState(false);
    const [statusMessage, setStatusMessage] = useState<string>('');
    const [generatedDataForAI, setGeneratedDataForAI] = useState<string>('');
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
        setStatusMessage(t('readyForUserData'));
    }, [t, currentLang]);

    const handleGenerateDemoQuestionsAndPrompt = () => {
        const fullPromptText = generateFullPromptForAI(userName, userAge, userGender);
        setGeneratedDataForAI(fullPromptText);
        setMarkdownInput(fullPromptText); 
        toast.success(t('demoQuestionsGenerated'));
        setStatusMessage(t('readyForPdf'));
    };
    
    const handleCopyToClipboard = () => {
        const textToCopy = generatedDataForAI.trim();
        if (!textToCopy) {
            toast.info(currentLang === 'ru' ? "Сначала сгенерируйте данные для AI." : "First, generate data for AI.");
            return;
        }
        navigator.clipboard.writeText(textToCopy)
            .then(() => toast.success(t('promptCopySuccess')))
            .catch(err => {
                toast.error(t('promptCopyError'));
                logger.error('Clipboard copy failed:', err);
            });
    };

    const handleGeneratePdf = async () => {
        if (!markdownInput.trim()) { toast.error(t('errorNoMarkdown')); return; }
        if (!user?.id) { toast.error(t('errorNoUser')); return; }
        
        const reportFileNameBase = selectedFile?.name || (userName ? `Расшифровка_${userName.replace(/\s/g, '_')}` : "Отчет_Расшифровка_Личности");

        setIsLoading(true); setStatusMessage(t('generatingPdf'));

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
                setGeneratedDataForAI(''); setUserName(''); setUserAge(''); setUserGender('');
                setStatusMessage(t('readyForUserData'));
            } else {
                toast.error(t('pdfGenerationFailed', { ERROR: result.error || 'Unknown error' }), { duration: 7000 });
                setStatusMessage(t('pdfGenerationFailed', { ERROR: result.error || 'Unknown error' }));
            }
        } catch (error) {
            toast.error(t('unexpectedError', { ERROR: (error as Error).message }), { duration: 7000 });
            setStatusMessage(t('unexpectedError', { ERROR: (error as Error).message }));
        } finally {
            setIsLoading(false);
        }
    };
    
    if (isAuthLoading) {
        return (
            <div className="flex justify-center items-center min-h-screen pt-20 bg-gray-900">
                <VibeContentRenderer content="::FaSpinner className='animate-spin text-brand-cyan text-2xl'::" />
                <span className="ml-3 text-brand-cyan font-mono">{t('loadingUser')}</span>
            </div>
        );
    }

    return (
        <div className={cn("min-h-screen flex flex-col items-center pt-16 sm:pt-20 pb-10", "bg-gradient-to-br from-slate-800 via-purple-900 to-blue-900 text-gray-100 px-4 font-mono")}>
            <Toaster position="bottom-center" richColors toastOptions={{ className: '!bg-gray-800/90 !border !border-brand-purple/50 !text-gray-200 !font-mono !shadow-lg !backdrop-blur-sm' }} />
            <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-20"> 
                <button onClick={toggleLang} className="p-1.5 sm:p-2 bg-slate-700/50 rounded-md hover:bg-slate-600/70 transition-colors flex items-center gap-1 text-xs text-cyan-300 shadow-md" title={t("toggleLanguage")}> 
                    <VibeContentRenderer content="::FaLanguage::" className="w-4 h-4 sm:w-3.5 sm:h-3.5"/> <span className="hidden sm:inline">{currentLang === 'en' ? 'RU' : 'EN'}</span>
                </button> 
            </div>

            <div className="w-full max-w-2xl lg:max-w-3xl p-5 sm:p-6 md:p-8 border-2 border-brand-purple/70 rounded-xl bg-black/75 backdrop-blur-xl shadow-2xl shadow-brand-purple/60 -mt-2 mb-6 sm:-mt-4 sm:mb-8 md:-mt-6 md:mb-10">
                <div className="relative w-full h-40 sm:h-48 md:h-56 -mt-10 sm:-mt-12 md:-mt-14 mb-4 sm:mb-6 rounded-lg overflow-hidden shadow-lg shadow-pink-glow/70">
                    <Image src={HERO_IMAGE_URL} alt="Personality Insights Hero" layout="fill" objectFit="cover" className="opacity-90" priority />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/0"></div>
                </div>
                
                <h1 
                    className="font-orbitron text-3xl sm:text-4xl md:text-5xl font-bold text-center mb-2 sm:mb-3 text-transparent bg-clip-text bg-gradient-to-r from-pink-400 via-purple-400 to-cyan-400 animate-glitch" 
                    data-text={t("pageTitle")}
                    style={{filter: "drop-shadow(0 0 10px hsl(var(--brand-pink))) drop-shadow(0 0 5px hsl(var(--brand-cyan)/0.7))"}}
                >
                    {t("pageTitle")}
                </h1>
                <p className="text-sm sm:text-base text-center text-gray-300 mb-8 sm:mb-10">{t("pageSubtitle")}</p>

                 <div className={cn("p-4 sm:p-5 border-2 border-dashed border-brand-blue/70 rounded-xl mb-6 sm:mb-8 bg-slate-800/70 shadow-md hover:shadow-blue-glow/40 transition-shadow duration-300")}>
                    <h2 className="text-lg sm:text-xl font-semibold text-brand-blue mb-3 sm:mb-4 flex items-center">
                        <VibeContentRenderer content="::FaUserEdit::" className="mr-2 w-5 h-5"/>
                        {t("step1Title")}
                    </h2>
                    <div className="space-y-3 sm:space-y-4">
                        <div>
                            <Label htmlFor="userName" className="text-xs text-gray-400">{t("userNameLabel")}</Label>
                            <Input id="userName" type="text" value={userName} onChange={(e) => setUserName(e.target.value)} placeholder="Иван Иванов" className="w-full p-2 text-sm bg-slate-700/80 border-slate-600/70 rounded-md focus:ring-brand-blue focus:border-brand-blue placeholder-gray-500" />
                        </div>
                        <div className="grid grid-cols-2 gap-3 sm:gap-4">
                            <div>
                                <Label htmlFor="userAge" className="text-xs text-gray-400">{t("userAgeLabel")}</Label>
                                <Input id="userAge" type="text" value={userAge} onChange={(e) => setUserAge(e.target.value)} placeholder="30" className="w-full p-2 text-sm bg-slate-700/80 border-slate-600/70 rounded-md focus:ring-brand-blue focus:border-brand-blue placeholder-gray-500" />
                            </div>
                            <div>
                                <Label htmlFor="userGender" className="text-xs text-gray-400">{t("userGenderLabel")}</Label>
                                <Input id="userGender" type="text" value={userGender} onChange={(e) => setUserGender(e.target.value)} placeholder="Мужчина/Женщина" className="w-full p-2 text-sm bg-slate-700/80 border-slate-600/70 rounded-md focus:ring-brand-blue focus:border-brand-blue placeholder-gray-500" />
                            </div>
                        </div>
                        <Button onClick={handleGenerateDemoQuestions} variant="outline" className="w-full mt-2 sm:mt-3 border-brand-yellow/80 text-brand-yellow hover:bg-brand-yellow/20 hover:text-brand-yellow py-2 text-xs sm:text-sm shadow-sm hover:shadow-yellow-glow/40">
                            <VibeContentRenderer content="::FaQuestionCircle::" className="mr-2"/>{t("generateDemoQuestions")}
                        </Button>
                    </div>
                </div>

                <div className={cn("p-4 sm:p-5 border-2 border-dashed border-brand-cyan/70 rounded-xl mb-6 sm:mb-8 bg-slate-800/70 shadow-md hover:shadow-cyan-glow/40 transition-shadow duration-300")}>
                    <h2 className="text-lg sm:text-xl font-semibold text-brand-cyan mb-3 sm:mb-4 flex items-center">
                        <VibeContentRenderer content="::FaKeyboard::" className="mr-2 w-5 h-5"/>
                        {t("step2Title")}
                    </h2>
                     <label htmlFor="markdownInput" className="text-sm text-gray-300 block mt-2 mb-1.5">{t("pasteMarkdown")}</label>
                     <textarea
                        id="markdownInput"
                        value={markdownInput}
                        onChange={(e) => setMarkdownInput(e.target.value)}
                        placeholder={currentLang === 'ru' ? "Вставьте сюда ответы на вопросы или текст отчета от AI..." : "Paste user's answers or AI report content here..."}
                        rows={12}
                        className="w-full p-2.5 sm:p-3 border rounded-md bg-slate-900/80 border-slate-600/70 text-gray-200 focus:ring-2 focus:ring-brand-pink outline-none placeholder-gray-500 font-mono text-xs sm:text-sm simple-scrollbar shadow-sm"
                        disabled={isLoading}
                    />
                    {(generatedDataForAI || markdownInput) && (
                        <div className="mt-4 flex flex-col sm:flex-row gap-3">
                             <Button onClick={handleCopyToClipboard} variant="outline" className="border-brand-cyan/80 text-brand-cyan hover:bg-brand-cyan/20 hover:text-brand-cyan flex-1 py-2.5 text-xs sm:text-sm shadow-sm hover:shadow-cyan-glow/30">
                                <VibeContentRenderer content="::FaCopy::" className="mr-2"/>{t("copyPromptAndData")}
                            </Button>
                            <Button variant="outline" asChild className="border-brand-blue/80 text-brand-blue hover:bg-brand-blue/20 hover:text-brand-blue flex-1 py-2.5 text-xs sm:text-sm shadow-sm hover:shadow-blue-glow/30">
                              <a href="https://aistudio.google.com/" target="_blank" rel="noopener noreferrer" >
                                <VibeContentRenderer content="::FaGoogle::" className="mr-2"/>{t("goToGemini")}
                              </a>
                            </Button>
                        </div>
                    )}
                </div>
                
                <div className={cn("p-4 sm:p-5 border-2 border-dashed border-brand-pink/70 rounded-xl bg-slate-800/70 shadow-md hover:shadow-pink-glow/40 transition-shadow duration-300", !markdownInput.trim() && "opacity-60 blur-sm pointer-events-none")}>
                     <h2 className="text-lg sm:text-xl font-semibold text-brand-pink mb-3 sm:mb-4 flex items-center">
                        <VibeContentRenderer content="::FaFilePdf::" className="mr-2 w-5 h-5"/>
                        {t("step3Title")}
                     </h2>
                    <Button onClick={handleGeneratePdf} disabled={isLoading || !markdownInput.trim() || !user?.id } className={cn("w-full text-base sm:text-lg py-3 sm:py-3.5 bg-gradient-to-r from-pink-500 via-purple-600 to-blue-600 text-white hover:shadow-purple-600/70 hover:brightness-110 focus:ring-purple-500 shadow-xl transition-all duration-200 active:scale-95", (isLoading || !markdownInput.trim()) && "opacity-50 cursor-not-allowed")}>
                        {isLoading
                            ? (<span className="flex items-center justify-center text-sm">
                                <VibeContentRenderer content="::FaSpinner className='animate-spin mr-2.5'::" /> {statusMessage || t('processing')}
                              </span>) 
                            : <><VibeContentRenderer content="::FaPaperPlane::" className="mr-2.5"/> {t('generateAndSendPdf')}</>
                        }
                    </Button>
                </div>
                
                <div className="mt-6 sm:mt-8 text-xs text-center text-gray-400 min-h-[20px] font-orbitron uppercase tracking-wider">
                   {t('status')}: {isLoading ? statusMessage : (!markdownInput.trim() ? t('readyForUserData') : t('readyForPdf'))}
                </div>

                <details className="mt-8 pt-6 border-t border-slate-700/60 group">
                    <summary className="text-sm text-gray-500 cursor-pointer hover:text-gray-300 transition-colors font-semibold flex items-center gap-2">
                        <VibeContentRenderer content="::FaFileExcel::"/>
                        {t("xlsxUploadOptionalTitle")}
                        <VibeContentRenderer content="::FaChevronDown className='ml-auto group-open:rotate-180 transition-transform'::"/>
                    </summary>
                    <div className="mt-4 p-4 sm:p-5 border-2 border-dashed border-brand-yellow/40 rounded-xl bg-slate-800/40 shadow-inner">
                        <label htmlFor="xlsxFileOptional" className={cn("w-full flex flex-col items-center justify-center px-4 py-5 border-2 border-dashed rounded-lg cursor-pointer transition-all duration-200 ease-in-out", "border-brand-yellow/60 hover:border-brand-yellow text-brand-yellow/80 hover:text-brand-yellow", isLoading ? "opacity-70 cursor-not-allowed" : "hover:bg-brand-yellow/10")}>
                            <VibeContentRenderer content="::FaCloudUploadAlt::" className="text-2xl mb-1.5" />
                            <span className="font-medium text-xs">{selectedFile ? t('fileSelected', { FILENAME: selectedFile.name }) : t('selectFile')}</span>
                            <input id="xlsxFileOptional" ref={fileInputRef} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={handleXlsxFileChange} className="sr-only" disabled={isLoading} />
                        </label>
                    </div>
                </details>
            </div>
        </div>
    );
}