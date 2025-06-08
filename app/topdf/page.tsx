"use client";

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { generatePdfFromMarkdownAndSend, saveUserPdfFormData, loadUserPdfFormData } from '@/app/topdf/actions';
import { logger } from '@/lib/logger';
import { debugLogger } from '@/lib/debugLogger';
import { Toaster, toast } from 'sonner';
import { cn } from "@/lib/utils";
import { VibeContentRenderer } from '@/components/VibeContentRenderer'; 
import * as XLSX from 'xlsx'; 
import { Button } from "@/components/ui/button"; 
import { Input } from '@/components/ui/input'; 
import { Label } from '@/components/ui/label'; 
import Image from 'next/image'; 
import { PSYCHO_ANALYSIS_SYSTEM_PROMPT, REFINED_PERSONALITY_QUESTIONS_RU } from './psychoAnalysisPrompt';
import { purchaseProtoCardAction } from '../hotvibes/actions'; 
import type { ProtoCardDetails } from '../hotvibes/actions';   
import Link from 'next/link';


const HERO_IMAGE_URL = "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/page-specific-assets/topdf_hero_psycho_v3_wide.png"; 

const PERSONALITY_REPORT_PDF_CARD_ID = "personality_pdf_generator_v1";
const PERSONALITY_REPORT_PDF_ACCESS_PRICE_XTR = 7;

const translations: Record<string, Record<string, string>> = {
  en: {
    "pageTitle": "AI PDF Report Generator ✨", 
    "pageSubtitle": "Generate a personalized PDF report. Input user data and answers, or analyze an XLSX with AI.", 
    "step1Title": "Step 1: User Data & Questions for AI",
    "generateDemoQuestions": "Demo Q's & Data",
    "demoQuestionsGenerated": "Demo questions & user data prepared! Copied to Markdown area.",
    "userDataTitle": "User Data for Report", 
    "userNameLabel": "User's Name",
    "userAgeLabel": "User's Age",
    "userGenderLabel": "User's Gender",
    "step2Title": "Step 2: Report Content (Paste AI Response or Final Answers)", 
    "pasteMarkdown": "Paste Markdown content here (e.g., AI analysis, or user's final answers to questions):", 
    "copyPromptAndData": "Copy AI Prompt",
    "goToGemini": "Open Gemini AI Studio",
    "step3Title": "Step 3: Create & Send PDF",
    "generateAndSendPdf": "Generate PDF & Send to Telegram",
    "processing": "Processing...",
    "parsingXlsx": "Parsing XLSX...", 
    "generatingPromptForXlsx": "Generating AI Prompt for XLSX...",
    "generatingPdf": "Generating PDF Report...",
    "sendingPdf": "Sending PDF to Telegram...",
    "errorNoUser": "User information not available. Please ensure you are logged in via Telegram.",
    "errorNoMarkdown": "Please paste the report content for the PDF.", 
    "successMessage": "Success! Your PDF report has been sent to your Telegram chat.",
    "processFailed": "Processing failed. Please try again.",
    "pdfGenerationFailed": "PDF Generation Failed: %%ERROR%%",
    "telegramSendFailed": "Failed to send PDF to Telegram: %%ERROR%%",
    "promptCopySuccess": "Full AI prompt (user data + system instructions) copied to clipboard!", 
    "promptCopyError": "Failed to copy. Please copy manually.",
    "unexpectedError": "An unexpected error occurred: %%ERROR%%",
    "loadingUser": "Loading user data...",
    "status": "Status",
    "readyForUserData": "Ready for user data and report content.",
    "readyForPdf": "Ready to generate PDF from content.", 
    "toggleLanguage": "Toggle Language",
    "xlsxUploadOptionalTitle": "Optional: Upload XLSX for AI Analysis (Alternative Flow)",
    "selectFile": "Select XLSX Report (Optional)",
    "noFileSelected": "No file selected",
    "fileSelected": "File: %%FILENAME%%",
    "errorFileTooLarge": "File is too large. Maximum size: 5MB.",
    "errorInvalidFileType": "Invalid file type. Only .xlsx files are accepted.",
    "formDataSaved": "User data saved for this session.",
    "formDataError": "Error saving user data for session.",
    "accessDeniedTitle": "Access to PDF Generator Denied!",
    "accessDeniedSubtitle": "To use the AI PDF Report Generator, please purchase an access ProtoCard.",
    "purchaseAccessButton": "Purchase Access for %%PRICE%% XTR",
    "purchasingInProgress": "Processing Purchase...",
    "errorNotAuthenticated": "Please log in via Telegram to purchase access.",
    "purchaseSuccessMessage": "Access request sent! Check Telegram to complete payment.",
    "purchaseErrorMessage": "Failed to initiate access purchase. %%ERROR%%",
    "backToHotVibes": "::FaArrowLeft:: Back to Hot Vibes",
    "promptGenerated": "AI prompt for XLSX prepared and copied to Markdown area.",
  },
  ru: {
    "pageTitle": "AI Генератор PDF Отчетов ✨", 
    "pageSubtitle": "Создайте персонализированный PDF-отчет. Введите данные пользователя и ответы, или проанализируйте XLSX с помощью AI.", 
    "step1Title": "Шаг 1: Данные Пользователя и Вопросы для AI",
    "generateDemoQuestions": "Демо-Вопросы и Данные",
    "demoQuestionsGenerated": "Демо-вопросы и данные пользователя подготовлены! Скопированы в область Markdown.",
    "userDataTitle": "Данные Пользователя для Отчета", 
    "userNameLabel": "Имя пользователя",
    "userAgeLabel": "Возраст пользователя",
    "userGenderLabel": "Пол пользователя",
    "step2Title": "Шаг 2: Содержимое Отчета (Вставьте Ответ AI или Финальные Ответы)", 
    "pasteMarkdown": "Вставьте сюда Markdown-контент (например, анализ от AI или финальные ответы пользователя на вопросы):", 
    "copyPromptAndData": "Копировать Промпт AI",
    "goToGemini": "Открыть Gemini AI Studio",
    "step3Title": "Шаг 3: Создать и Отправить PDF",
    "generateAndSendPdf": "PDF в Telegram",
    "processing": "Обработка...",
    "parsingXlsx": "Парсинг XLSX...", 
    "generatingPromptForXlsx": "Генерация AI Промпта для XLSX...",
    "generatingPdf": "Генерация PDF Отчета...",
    "sendingPdf": "Отправка PDF в Telegram...",
    "errorNoUser": "Информация о пользователе недоступна. Убедитесь, что вы авторизованы через Telegram.",
    "errorNoMarkdown": "Пожалуйста, вставьте содержимое отчета для PDF.", 
    "successMessage": "Успешно! Ваш PDF отчет отправлен в ваш Telegram чат.",
    "processFailed": "Ошибка обработки. Пожалуйста, попробуйте снова.",
    "pdfGenerationFailed": "Ошибка Генерации PDF: %%ERROR%%",
    "telegramSendFailed": "Не удалось отправить PDF в Telegram: %%ERROR%%",
    "promptCopySuccess": "Полный промпт для AI (данные пользователя + системные инструкции) скопирован в буфер обмена!", 
    "promptCopyError": "Не удалось скопировать. Скопируйте вручную.",
    "unexpectedError": "Произошла непредвиденная ошибка: %%ERROR%%",
    "loadingUser": "Загрузка данных пользователя...",
    "status": "Статус",
    "readyForUserData": "Готово к вводу данных и контента.",
    "readyForPdf": "Готово к генерации PDF.", 
    "toggleLanguage": "Переключить язык",
    "xlsxUploadOptionalTitle": "Опционально: Загрузка XLSX для Анализа AI (Альтернативный Сценарий)",
    "selectFile": "Выберите XLSX Отчет (Опционально)",
    "noFileSelected": "Файл не выбран",
    "fileSelected": "Файл: %%FILENAME%%",
    "errorFileTooLarge": "Файл слишком большой. Максимальный размер: 5МБ.",
    "errorInvalidFileType": "Неверный тип файла. Принимаются только .xlsx файлы.",
    "formDataSaved": "Данные пользователя сохранены для этой сессии.",
    "formDataError": "Ошибка сохранения данных пользователя для сессии.",
    "accessDeniedTitle": "Доступ к Генератору PDF Закрыт!",
    "accessDeniedSubtitle": "Для использования AI Генератора PDF Отчетов, пожалуйста, приобретите ПротоКарточку Доступа.",
    "purchaseAccessButton": "Купить Доступ за %%PRICE%% XTR",
    "purchasingInProgress": "Обработка покупки...",
    "errorNotAuthenticated": "Пожалуйста, авторизуйтесь через Telegram для покупки доступа.",
    "purchaseSuccessMessage": "Запрос на доступ отправлен! Проверьте Telegram для завершения оплаты.",
    "purchaseErrorMessage": "Не удалось инициировать покупку доступа. %%ERROR%%",
    "backToHotVibes": "::FaArrowLeft:: Назад в Горячие Вайбы",
    "promptGenerated": "AI промпт для XLSX подготовлен и скопирован в область Markdown.",
  }
};

const MAX_FILE_SIZE_MB = 5;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const generateUserDataAndQuestionsForAI = (userName?: string, userAge?: string, userGender?: string): string => {
    const name = userName || "Пользователь";
    let content = `# Расшифровка Личности для ${name}\n\n`;
    if (userAge) content += `**Возраст:** ${userAge}\n`;
    if (userGender) content += `**Пол:** ${userGender}\n\n`;
    content += `## Ответы на вопросы (пожалуйста, предоставьте развернутые ответы):\n\n`;
    
    content += REFINED_PERSONALITY_QUESTIONS_RU.map(q => `* ${q}\n  *Ответ:* ...`).join("\n\n");
    return content;
};

const handleXlsxFileAndPreparePromptInternal = async (
    file: File, 
    currentUserName: string, 
    currentUserAge: string, 
    currentUserGender: string,
    translateFunc: (key: string, replacements?: Record<string, string | number>) => string,
    setLoadingFunc: React.Dispatch<React.SetStateAction<boolean>>, 
    setStatusMsgFunc: React.Dispatch<React.SetStateAction<string>> 
): Promise<{ success: boolean, prompt?: string, error?: string}> => {
    setLoadingFunc(true); 
    setStatusMsgFunc(translateFunc('parsingXlsx'));
    try {
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const csvDataString = XLSX.utils.sheet_to_csv(worksheet);
        setStatusMsgFunc(translateFunc('generatingPromptForXlsx'));
        const promptForAI = `Ты — высококвалифицированный AI-аналитик. Твоя задача — проанализировать предоставленные данные из отчета (возможно, XLSX) и составить подробное резюме в формате Markdown.
ВАЖНО: Твой ответ ДОЛЖЕН БЫТЬ ПОЛНОСТЬЮ НА РУССКОМ ЯЗЫКЕ.

Исходное имя файла отчета: "${file.name}".
Данные взяты с листа: "${firstSheetName}".

Информация о пользователе (если предоставлена для контекста анализа):
Имя: ${currentUserName || "Не указано"}
Возраст: ${currentUserAge || "Не указан"}
Пол: ${currentUserGender || "Не указан"}

**Запрос на Анализ Данных из Файла:**
Пожалуйста, проведи тщательный анализ данных ниже. Сконцентрируйся на следующем:
1.  **Краткое резюме (Executive Summary):** Сжатый (3-5 предложений) обзор ключевой информации из данных.
2.  **Основные тезисы и наблюдения:** Выдели значительные моменты. Используй маркированные списки.
3.  **Потенциальные инсайты:** Какие интересные закономерности или выводы можно сделать?

**Требования к формату вывода (Markdown на русском языке):**
- Используй заголовки (например, \`# Анализ файла ${file.name}\`).
- Используй маркированные списки (\`* \` или \`- \`).
- Используй выделение жирным шрифтом (\`**текст**\`).

**Данные из XLSX (могут быть усечены):**
\`\`\`csv
${csvDataString.substring(0, 15000)} 
\`\`\`

Пожалуйста, предоставь подробный и содержательный отчет.
`;
        return { success: true, prompt: promptForAI };
    } catch (error) {
        logger.error("Error parsing XLSX for AI prompt:", error);
        return { success: false, error: (error as Error).message };
    } finally {
        setLoadingFunc(false);
    }
};

export default function ToPdfPageWithPsychoFocus() {
    const { user, dbUser, isAuthenticated, isLoading: appContextLoading, isAuthenticating: appContextAuthenticating, refreshDbUser } = useAppContext();
    const [selectedFile, setSelectedFile] = useState<File | null>(null); 
    const [isLoading, setIsLoading] = useState(false);
    const [statusMessage, setStatusMessage] = useState<string>('');
    const [generatedDataForAI, setGeneratedDataForAI] = useState<string>('');
    const [markdownInput, setMarkdownInput] = useState<string>('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [userName, setUserName] = useState<string>('');
    const [userAge, setUserAge] = useState<string>('');
    const [userGender, setUserGender] = useState<string>('');
    
    const [hasAccess, setHasAccess] = useState(false);
    const [isCheckingAccess, setIsCheckingAccess] = useState(true);
    const [isPurchasing, setIsPurchasing] = useState(false);

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

    useEffect(() => {
        setStatusMessage(t('readyForUserData'));
    }, [t, currentLang]);

     useEffect(() => {
        if (!appContextLoading && !appContextAuthenticating) {
            setIsCheckingAccess(true);
            if (isAuthenticated && dbUser) {
                const cards = dbUser.metadata?.xtr_protocards as Record<string, { status: string }> | undefined;
                if (cards && cards[PERSONALITY_REPORT_PDF_CARD_ID]?.status === 'active') {
                    setHasAccess(true);
                    debugLogger.info(`[ToPdfPage] User ${dbUser.user_id} has access to PDF Generator.`);
                } else {
                    setHasAccess(false);
                    debugLogger.info(`[ToPdfPage] User ${dbUser.user_id} does NOT have access. Cards:`, cards);
                }
            } else {
                setHasAccess(false); 
                 debugLogger.info(`[ToPdfPage] No access: User not authenticated or dbUser missing. isAuthenticated: ${isAuthenticated}`);
            }
            setIsCheckingAccess(false);
        }
    }, [dbUser, isAuthenticated, appContextLoading, appContextAuthenticating]);

    useEffect(() => {
        if (user?.id && !appContextLoading && !appContextAuthenticating && hasAccess) { 
            setIsLoading(true);
            loadUserPdfFormData(String(user.id)).then(result => {
                if (result.success && result.data) {
                    setUserName(result.data.userName || '');
                    setUserAge(result.data.userAge || '');
                    setUserGender(result.data.userGender || '');
                    debugLogger.info("[ToPdfPage] User PDF form data loaded.", result.data);
                } else if (result.error) {
                    debugLogger.warn("[ToPdfPage] Error loading user PDF form data:", result.error);
                }
            }).finally(() => setIsLoading(false));
        }
    }, [user?.id, appContextLoading, appContextAuthenticating, hasAccess]);


    const handleXlsxFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) {
            setSelectedFile(null); setGeneratedDataForAI(''); setStatusMessage(t('noFileSelected'));
            return;
        }
        if (file.size > MAX_FILE_SIZE_BYTES) {
            toast.error(t('errorFileTooLarge')); setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; return;
        }
        if (file.type !== 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' && !file.name.endsWith('.xlsx')) {
            toast.error(t('errorInvalidFileType')); setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; return;
        }
        setSelectedFile(file);
        const result = await handleXlsxFileAndPreparePromptInternal(file, userName, userAge, userGender, t, setIsLoading, setStatusMessage);
        if(result.success && result.prompt){
            setGeneratedDataForAI(result.prompt); 
            setMarkdownInput(result.prompt); 
            setStatusMessage(t('promptGenerated'));
            toast.success(t('promptGenerated'));
        } else {
            toast.error(t('unexpectedError', { ERROR: result.error || 'Failed to process XLSX' }));
            setStatusMessage(t('readyForUserData'));
        }
    };

    const handleGenerateDemoQuestionsAndPrompt = () => {
        const userDataAndQuestions = generateUserDataAndQuestionsForAI(userName, userAge, userGender);
        setGeneratedDataForAI(userDataAndQuestions); 
        setMarkdownInput(userDataAndQuestions); 
        toast.success(t('demoQuestionsGenerated'));
        setStatusMessage(t('readyForPdf'));
        if (user?.id) { 
            saveUserPdfFormData(String(user.id), { userName, userAge, userGender }).then(res => {
                 if(res.success) toast.info(t('formDataSaved'), {duration: 1500});
            });
        }
    };
    
    const handleCopyToClipboard = () => {
        let textForUserAndQuestions = generatedDataForAI.trim(); 
        if (!textForUserAndQuestions && markdownInput.trim()) { 
            textForUserAndQuestions = markdownInput.trim();
        }
        if (!textForUserAndQuestions) {
             if(userName || userAge || userGender) {
                textForUserAndQuestions = generateUserDataAndQuestionsForAI(userName,userAge,userGender);
             } else {
                toast.info(currentLang === 'ru' ? "Введите данные пользователя и сгенерируйте вопросы, или введите текст в поле содержимого." : "Enter user data and generate questions, or input content in the markdown field.");
                return;
             }
        }
        // Corrected order: User data first, then system prompt
        const fullTextForAI = `${textForUserAndQuestions}\n\n---\n${PSYCHO_ANALYSIS_SYSTEM_PROMPT}`;
        
        navigator.clipboard.writeText(fullTextForAI)
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
                setMarkdownInput(''); 
                setGeneratedDataForAI(''); 
                if (selectedFile && (!userName && !userAge && !userGender)) { 
                    setSelectedFile(null); 
                    if (fileInputRef.current) fileInputRef.current.value = "";
                }
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

    const handlePurchaseAccess = async () => {
        if (!isAuthenticated || !dbUser?.user_id) {
          toast.error(t('errorNotAuthenticated'));
          return;
        }
        setIsPurchasing(true);
        const cardDetails: ProtoCardDetails = {
          cardId: PERSONALITY_REPORT_PDF_CARD_ID,
          title: currentLang === 'ru' ? `Доступ к Генератору PDF Отчетов` : `PDF Report Generator Access`,
          description: currentLang === 'ru' ? `Разблокировать AI Генератор PDF для психологических расшифровок. Цена: ${PERSONALITY_REPORT_PDF_ACCESS_PRICE_XTR} XTR.` : `Unlock the AI PDF Generator for personality insights. Price: ${PERSONALITY_REPORT_PDF_ACCESS_PRICE_XTR} XTR.`,
          amountXTR: PERSONALITY_REPORT_PDF_ACCESS_PRICE_XTR,
          type: "tool_access",
          metadata: { page_link: "/topdf", tool_name: "AI PDF Generator - PsychoVibe" }
        };
    
        try {
          const result = await purchaseProtoCardAction(dbUser.user_id, cardDetails);
          if (result.success) {
            toast.success(t('purchaseSuccessMessage'));
            if(refreshDbUser) { 
                setTimeout(async () => { await refreshDbUser(); }, 7000);
            }
          } else {
            toast.error(t('purchaseErrorMessage', { ERROR: result.error || '' }));
          }
        } catch (error) {
          toast.error(t('purchaseErrorMessage', { ERROR: (error as Error).message || '' }));
          logger.error("[ToPdfPage] Error purchasing access ProtoCard:", error);
        }
        setIsPurchasing(false);
      };
    
    const toggleLang = useCallback(() => setCurrentLang(p => p === 'en' ? 'ru' : 'en'), []);

    if (appContextLoading || appContextAuthenticating || isCheckingAccess) {
        return (
            <div className="flex justify-center items-center min-h-screen pt-20 bg-gray-900">
                <VibeContentRenderer content="::FaSpinner className='animate-spin text-brand-cyan text-2xl'::" />
                <span className="ml-3 text-brand-cyan font-mono">{t('loadingUser')}</span>
            </div>
        );
    }

    if (!hasAccess) {
        return (
          <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-purple-950 to-blue-900 p-6 text-center text-gray-100">
            <VibeContentRenderer content="::FaLock className='text-7xl text-brand-red mb-6 animate-pulse'::" />
            <h1 className="text-3xl sm:text-4xl font-orbitron font-bold text-brand-red mb-4">{t("accessDeniedTitle")}</h1>
            <p className="text-md sm:text-lg text-gray-300 mb-8 max-w-md">{t("accessDeniedSubtitle")}</p>
            <Button
              onClick={handlePurchaseAccess}
              disabled={isPurchasing || !isAuthenticated}
              size="lg"
              className="bg-gradient-to-r from-brand-orange to-red-600 text-white font-orbitron font-bold py-3 px-8 rounded-lg text-lg hover:from-brand-orange/90 hover:to-red-600/90 transition-all shadow-lg hover:shadow-yellow-500/50"
            >
              {isPurchasing 
                ? <VibeContentRenderer content="::FaSpinner className='animate-spin mr-2'::" /> 
                : <VibeContentRenderer content="::FaKey::" className="mr-2" />
              }
              {isPurchasing ? t("purchasingInProgress") : t("purchaseAccessButton", { PRICE: PERSONALITY_REPORT_PDF_ACCESS_PRICE_XTR })}
            </Button>
            {!isAuthenticated && <p className="text-xs text-red-400 mt-3">{t("errorNotAuthenticated")}</p>}
             <Link href="/hotvibes" className="block mt-10">
                <Button variant="outline" className="border-brand-cyan text-brand-cyan hover:bg-brand-cyan/10 text-sm">
                    <VibeContentRenderer content={t("backToHotVibes")}/>
                </Button>
            </Link>
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
                <div className="relative w-full h-[50vh] -mx-5 sm:-mx-6 md:-mx-8 -mt-10 sm:-mt-12 md:-mt-14 mb-4 sm:mb-6 rounded-t-lg overflow-hidden ">
                    <Image src={HERO_IMAGE_URL} alt="Personality Insights Hero" layout="fill" objectFit="cover" className="opacity-90" priority />
                    <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-[hsl(var(--card-rgb))] via-[hsl(var(--card-rgb)/0.7)] to-transparent"></div> 
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
                        <VibeContentRenderer content="::FaUserCog::" className="mr-2 w-5 h-5"/>
                        {t("step1Title")}
                    </h2>
                    <div className="space-y-3 sm:space-y-4">
                        <div>
                            <Label htmlFor="userName" className="text-xs text-gray-400">{t("userNameLabel")}</Label>
                            <Input id="userName" type="text" value={userName} onChange={(e) => setUserName(e.target.value)} placeholder={currentLang === 'ru' ? "Иван Иванов" : "John Doe"} className="w-full p-2 text-sm bg-slate-700/80 border-slate-600/70 rounded-md focus:ring-brand-blue focus:border-brand-blue placeholder-gray-500" />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                            <div>
                                <Label htmlFor="userAge" className="text-xs text-gray-400">{t("userAgeLabel")}</Label>
                                <Input id="userAge" type="text" value={userAge} onChange={(e) => setUserAge(e.target.value)} placeholder="30" className="w-full p-2 text-sm bg-slate-700/80 border-slate-600/70 rounded-md focus:ring-brand-blue focus:border-brand-blue placeholder-gray-500" />
                            </div>
                            <div>
                                <Label htmlFor="userGender" className="text-xs text-gray-400">{t("userGenderLabel")}</Label>
                                <Input id="userGender" type="text" value={userGender} onChange={(e) => setUserGender(e.target.value)} placeholder={currentLang === 'ru' ? "Мужчина/Женщина" : "Male/Female"} className="w-full p-2 text-sm bg-slate-700/80 border-slate-600/70 rounded-md focus:ring-brand-blue focus:border-brand-blue placeholder-gray-500" />
                            </div>
                        </div>
                        <Button onClick={handleGenerateDemoQuestionsAndPrompt} variant="outline" className="w-full mt-2 sm:mt-3 border-brand-yellow/80 text-brand-yellow hover:bg-brand-yellow/20 hover:text-brand-yellow py-2 text-xs sm:text-sm shadow-sm hover:shadow-yellow-glow/40">
                            <VibeContentRenderer content="::FaCircleQuestion::" className="mr-2"/>{t("generateDemoQuestions")}
                        </Button>
                    </div>
                </div>

                <div className={cn("p-4 sm:p-5 border-2 border-dashed border-brand-cyan/70 rounded-xl mb-6 sm:mb-8 bg-slate-800/70 shadow-md hover:shadow-cyan-glow/40 transition-shadow duration-300")}>
                    <h2 className="text-lg sm:text-xl font-semibold text-brand-cyan mb-3 sm:mb-4 flex items-center">
                        <VibeContentRenderer content="::FaPencilAlt::" className="mr-2 w-5 h-5"/>
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
                        <VibeContentRenderer content="::FaFileDownload::" className="mr-2 w-5 h-5"/>
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
                        <VibeContentRenderer content="::FaFileImport::" />
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