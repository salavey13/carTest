"use client";

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { generatePdfFromMarkdownAndSend, saveUserPdfFormData, loadUserPdfFormData, notifyAdminAction } from '@/app/topdf/actions';
import { logger } from '@/lib/logger';
import { debugLogger } from '@/lib/debugLogger';
import { Toaster, toast } from 'sonner';
import { cn } from "@/lib/utils";
import { VibeContentRenderer } from '@/components/VibeContentRenderer'; 
// import * as XLSX from 'xlsx'; // Not used directly in this file anymore
// import { Button } from "@/components/ui/button"; // Used in step components
// import { Input } from '@/components/ui/input'; // Used in step components
// import { Label } from '@/components/ui/label'; // Used in step components
// import Image from 'next/image'; // Used in IntroStep
import { 
    PSYCHO_ANALYSIS_SYSTEM_PROMPT, 
    REFINED_PERSONALITY_QUESTIONS_RU,
    PRO_ADDITIONAL_QUESTIONS_RU, 
    PSYCHO_ANALYSIS_PRO_SYSTEM_PROMPT 
} from './psychoAnalysisPrompt';
import { purchaseProtoCardAction } from '../hotvibes/actions'; 
import type { ProtoCardDetails } from '../hotvibes/actions';   
import Link from 'next/link';

// Step Components
import { IntroStep } from './components/steps/IntroStep';
import { UserDataStep } from './components/steps/UserDataStep';
import { QuestionsStep } from './components/steps/QuestionsStep';
import { AnalyzingStep } from './components/steps/AnalyzingStep';
import { BasicAnalysisReadyStep } from './components/steps/BasicAnalysisReadyStep';
import { PaymentOfferDetailsStep } from './components/steps/PaymentOfferDetailsStep';
import { PaymentSuccessStep } from './components/steps/PaymentSuccessStep';
import { GeneralErrorStep } from './components/steps/GeneralErrorStep';
import { Button } from '@/components/ui/button';


const HERO_IMAGE_URL = "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/IMG_20250609_005358-9e5fdb54-31ed-4231-83c4-610a7c8d9336.jpg"; 

const PERSONALITY_REPORT_PDF_CARD_ID = "personality_pdf_generator_v1";
const PERSONALITY_REPORT_PDF_ACCESS_PRICE_XTR = 7; 

const PSYCHO_ANALYSIS_PRO_ACCESS_CARD_ID = "personality_pdf_pro_access_v1";
const PSYCHO_ANALYSIS_PRO_ACCESS_PRICE_XTR = 2990; 

type PsychoFocusStep = 
  | 'intro' 
  | 'userData' 
  | 'questions' 
  | 'analyzing'
  | 'basicAnalysisReady' 
  | 'paymentOfferDetails' 
  | 'paymentSuccess' 
  | 'paymentError'
  | 'generalError';

const translations: Record<string, Record<string, string>> = {
  en: {
    "pageTitle": "PRIZMA: Personality Analysis", 
    "pageSubtitle": "Generate a personalized PDF report based on your answers.", 
    "step1Title": "Step 1: Your Data",
    "generateDemoQuestions": "Fill with Demo Questions",
    "demoQuestionsGenerated": "Demo questions & user data prepared! Copied to Markdown area.",
    "userDataTitle": "User Data for Report", 
    "userNameLabel": "Name",
    "userAgeLabel": "Age",
    "userGenderLabel": "Gender",
    "step2Title": "Step 2: Answer Questions", 
    "pasteMarkdown": "Paste your detailed answers to the questions here:", 
    "copyPromptAndData": "Copy My Answers & AI Prompt",
    "goToAiStudio": "Open AI Studio",
    "goToAiStudioSubtext": "(for self-analysis)",
    "step3Title": "Step 3: Generate Report",
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
    "promptCopySuccess": "Full AI prompt (data + answers + system instructions) copied to clipboard!", 
    "promptCopyError": "Failed to copy. Please copy manually.",
    "unexpectedError": "An unexpected error occurred: %%ERROR%%",
    "loadingUser": "Loading user data...",
    "status": "Status",
    "readyForUserData": "Ready for user data.",
    "readyForPdf": "Ready to generate PDF.", 
    "toggleLanguage": "Toggle Language",
    "xlsxUploadOptionalTitle": "Optional: Upload XLSX for AI Analysis (Alternative Flow)",
    "selectFile": "Select XLSX Report (Optional)",
    "noFileSelected": "No file selected",
    "fileSelected": "File: %%FILENAME%%",
    "errorFileTooLarge": "File is too large. Maximum size: 5MB.",
    "errorInvalidFileType": "Invalid file type. Only .xlsx files are accepted.",
    "formDataSaved": "User data saved for this session.",
    "formDataError": "Error saving user data for session.",
    "accessDeniedTitle": "Access to PRIZMA Denied!",
    "accessDeniedSubtitle": "To use the AI PDF Report Generator, please purchase an Access ProtoCard.",
    "purchaseAccessButton": "Purchase Access for %%PRICE%% XTR",
    "purchasingInProgress": "Processing Purchase...",
    "errorNotAuthenticated": "Please log in via Telegram to purchase access.",
    "purchaseSuccessMessage": "Access request sent! Check Telegram to complete payment.",
    "purchaseErrorMessage": "Failed to initiate access purchase. %%ERROR%%",
    "backToHotVibes": "::FaArrowLeft:: Back to Hot Vibes",
    "promptGenerated": "AI prompt for XLSX prepared and copied to Markdown area.",
    "workingAreaMark": "YOUR WORKSPACE: Paste AI responses or final answers here for PDF generation.",
    "prizmaIntroTitle": "PRIZMA",
    "prizmaIntroSubtitle": "Your personal AI psychologist and mentor",
    "prizmaIntroDesc": "Take a voice survey and learn more about yourself. It was, it is, it will be.",
    "prizmaStartAnalysis": "Start Analysis",
    "prizmaUserDataPrompt": "Let's get acquainted! Enter your basic details for your audit.",
    "prizmaContinue": "Continue",
    "prizmaQuestionsTitle": "Tell us about your main values in life",
    "prizmaNext": "Next",
    "prizmaAnalyzing": "Analyzing your answers...",
    "prizmaBasicAnalysisReadyTitle": "Your basic analysis is ready!",
    "prizmaBasicAnalysisSent": "Your basic PDF report has been sent to Telegram.",
    "prizmaGetFullAnalysis": "Get Full Analysis",
    "prizmaPaymentOfferTitle": "Full Decryption",
    "prizmaPaymentOfferPrice": "$%%PRICE%%", 
    "prizmaPaymentOfferPriceOld": "$60.00", 
    "prizmaPaymentOfferFeatures": "Free Decryption<br>10 Page Analysis<br>3 Basic Methods<br>General Recommendations<br>Analysis in 24 hours<br>---<br>12 Professional Techniques<br>50+ Personalized Recommendations<br>Individual Psychologist Support",
    "prizmaChoosePayment": "Choose Payment Method",
    "prizmaPaymentGuarantee": "Secure Payment · Data Protection",
    "prizmaPaymentSuccessTitle": "Payment Successful!",
    "prizmaPaymentSuccessDesc": "To get your full analysis, complete the survey. %%REMAINING%% questions left.",
    "prizmaErrorTitle": "Something went wrong!",
    "prizmaErrorDesc": "A technical error occurred. Please try again or contact support.",
    "prizmaTryAgain": "Try Again",
    "prizmaContactSupport": "Contact Support",
    "prizmaAnalyzingTitle": "Analyzing your answers",
    "prizmaProAnalysisReadyTitle": "Your FULL PRIZMA analysis is ready!",
    "prizmaProAnalysisSent": "Your full PRIZMA PDF report (Pro version) has been sent to Telegram.",
    "prizmaFullAnalysis": "Full Analysis",
  },
  ru: {
    "pageTitle": "PRIZMA: Психологический Анализ", 
    "pageSubtitle": "Создайте персонализированный PDF-отчет на основе ваших ответов.", 
    "step1Title": "Шаг 1: Ваши Данные",
    "generateDemoQuestions": "Заполнить демо-вопросами",
    "demoQuestionsGenerated": "Демо-вопросы и данные пользователя подготовлены! Скопированы в область Markdown.",
    "userDataTitle": "Данные Пользователя для Отчета", 
    "userNameLabel": "Имя",
    "userAgeLabel": "Возраст",
    "userGenderLabel": "Пол",
    "step2Title": "Шаг 2: Ответы на Вопросы", 
    "pasteMarkdown": "Вставьте сюда ваши развернутые ответы на вопросы:", 
    "copyPromptAndData": "Копировать мои ответы и промпт для AI",
    "goToAiStudio": "Открыть AI Studio",
    "goToAiStudioSubtext": "(для самостоятельного анализа)",
    "step3Title": "Шаг 3: Генерация Отчета",
    "generateAndSendPdf": "Сгенерировать PDF и Отправить в Telegram",
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
    "promptCopySuccess": "Полный промпт для AI (данные + ответы + системные инструкции) скопирован в буфер обмена!", 
    "promptCopyError": "Не удалось скопировать. Скопируйте вручную.",
    "unexpectedError": "Произошла непредвиденная ошибка: %%ERROR%%",
    "loadingUser": "Загрузка данных пользователя...",
    "status": "Статус",
    "readyForUserData": "Готово к вводу данных.",
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
    "accessDeniedTitle": "Доступ к PRIZMA Закрыт!",
    "accessDeniedSubtitle": "Для использования AI Генератора PDF Отчетов, пожалуйста, приобретите ПротоКарточку Доступа.",
    "purchaseAccessButton": "Купить Доступ за %%PRICE%% XTR",
    "purchasingInProgress": "Обработка покупки...",
    "errorNotAuthenticated": "Пожалуйста, авторизуйтесь через Telegram для покупки доступа.",
    "purchaseSuccessMessage": "Запрос на доступ отправлен! Проверьте Telegram для завершения оплаты.",
    "purchaseErrorMessage": "Не удалось инициировать покупку доступа. %%ERROR%%",
    "backToHotVibes": "::FaArrowLeft:: Назад в Горячие Вайбы",
    "promptGenerated": "AI промпт для XLSX подготовлен и скопирован в область Markdown.",
    "workingAreaMark": "ВАША РАБОЧАЯ ОБЛАСТЬ: Сюда вставляйте ответы AI или финальные ответы для генерации PDF.",
    "prizmaIntroTitle": "PRIZMA",
    "prizmaIntroSubtitle": "Ваш личный ИИ психолог и наставник",
    "prizmaIntroDesc": "Пройдите голосовой опрос и узнайте о себе больше. То что было, то и есть, тому и быть.",
    "prizmaStartAnalysis": "Начать анализ",
    "prizmaUserDataPrompt": "Давайте познакомимся! Введите свои данные для аудита.",
    "prizmaContinue": "Продолжить",
    "prizmaQuestionsTitle": "Расскажите о своих главных ценностях в жизни",
    "prizmaNext": "Далее",
    "prizmaAnalyzing": "Анализируем ваши ответы...",
    "prizmaBasicAnalysisReadyTitle": "Ваш базовый анализ готов!",
    "prizmaBasicAnalysisSent": "Ваш базовый PDF-отчет отправлен в Telegram.",
    "prizmaGetFullAnalysis": "Получить полный анализ",
    "prizmaPaymentOfferTitle": "Полная расшифровка",
    "prizmaPaymentOfferPrice": "%%PRICE%%р", 
    "prizmaPaymentOfferPriceOld": "6000р", 
    "prizmaPaymentOfferFeatures": "Бесплатная расшифровка<br>10 стр анализа<br>3 базовые методики<br>Общие рекомендации<br>Анализ занимает 24 часа<br>---<br>12 профессиональных методик<br>50+ персонализированных рекомендаций<br>Индивидуальный психолог",
    "prizmaChoosePayment": "Выбрать способ оплаты",
    "prizmaPaymentGuarantee": "Безопасная оплата · Защита данных",
    "prizmaPaymentSuccessTitle": "Оплата успешно прошла!",
    "prizmaPaymentSuccessDesc": "Чтобы получить полную расшифровку, пройдите опрос. Вам осталось пройти еще %%REMAINING%% вопросов.",
    "prizmaErrorTitle": "Что-то пошло не так!",
    "prizmaErrorDesc": "Произошла техническая ошибка. Пожалуйста, попробуйте еще раз или обратитесь в поддержку.",
    "prizmaTryAgain": "Попробовать снова",
    "prizmaContactSupport": "Написать в поддержку",
    "prizmaAnalyzingTitle": "Анализируем ваши ответы",
    "prizmaProAnalysisReadyTitle": "Ваш ПОЛНЫЙ анализ PRIZMA готов!",
    "prizmaProAnalysisSent": "Ваш полный PDF-отчет PRIZMA (Pro версия) отправлен в Telegram.",
    "prizmaFullAnalysis": "Полный анализ",
  }
};

const MAX_FILE_SIZE_MB = 5;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const generateUserDataAndQuestionsForAI = (userName?: string, userAge?: string, userGender?: string, hasProAccess?: boolean): string => {
    const name = userName || "Пользователь";
    let content = `# Расшифровка Личности для ${name}\n\n`;
    if (userAge) content += `**Возраст:** ${userAge}\n`;
    if (userGender) content += `**Пол:** ${userGender}\n\n`;
    content += `## Ответы на вопросы (пожалуйста, предоставьте развернутые ответы):\n\n`;
    
    let questions = [...REFINED_PERSONALITY_QUESTIONS_RU];
    if (hasProAccess) {
        questions = questions.concat(PRO_ADDITIONAL_QUESTIONS_RU);
    }
    content += questions.map((q, i) => `${i + 1}. ${q}\n  *Ответ:* ...`).join("\n\n");
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
    const [markdownInput, setMarkdownInput] = useState<string>('');
    // const fileInputRef = useRef<HTMLInputElement>(null); // Moved to QuestionsStep
    const pageContainerRef = useRef<HTMLDivElement>(null); 

    const [userName, setUserName] = useState<string>('');
    const [userAge, setUserAge] = useState<string>('');
    const [userGender, setUserGender] = useState<string>('');
    
    const [hasAccess, setHasAccess] = useState(false); 
    const [hasProAccess, setHasProAccess] = useState(false); 
    const [isCheckingAccess, setIsCheckingAccess] = useState(true);
    const [isPurchasing, setIsPurchasing] = useState(false);

    const [currentStep, setCurrentStep] = useState<PsychoFocusStep>('intro');
    const firstLoadDoneRef = useRef(false); 

    const initialLang = useMemo(() => (user?.language_code === 'ru' ? 'ru' : 'en'), [user?.language_code]);
    const [currentLang, setCurrentLang] = useState<'en' | 'ru'>(initialLang);

    useEffect(() => {
        if (pageContainerRef.current) {
            window.scrollTo(0,0); 
        }
    }, [currentStep]);

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
      if (currentStep !== 'analyzing') { 
        setStatusMessage(t('readyForUserData'));
      }
    }, [t, currentLang, currentStep]);

     useEffect(() => {
        if (!appContextLoading && !appContextAuthenticating) {
            setIsCheckingAccess(true);
            debugLogger.info("[ToPdfPage AccessCheck] Starting. isAuthenticated:", isAuthenticated, "dbUser exists:", !!dbUser);
            if (isAuthenticated && dbUser) {
                const cards = dbUser.metadata?.xtr_protocards as Record<string, { status: string; type?: string; data?: { page_link?: string } }> | undefined;
                debugLogger.info("[ToPdfPage AccessCheck] User cards:", cards);
                
                const baseAccessCard = cards?.[PERSONALITY_REPORT_PDF_CARD_ID];
                if (baseAccessCard?.status === 'active' && baseAccessCard.type === 'tool_access' && baseAccessCard.data?.page_link === '/topdf') {
                    setHasAccess(true);
                    debugLogger.info("[ToPdfPage AccessCheck] Basic access GRANTED.");
                } else { 
                    setHasAccess(false); 
                    debugLogger.info("[ToPdfPage AccessCheck] Basic access DENIED. Card:", baseAccessCard);
                }

                const proAccessCard = cards?.[PSYCHO_ANALYSIS_PRO_ACCESS_CARD_ID];
                if (proAccessCard?.status === 'active' && proAccessCard.type === 'tool_access') { 
                    setHasProAccess(true);
                    debugLogger.info("[ToPdfPage AccessCheck] Pro access GRANTED.");
                } else { 
                    setHasProAccess(false); 
                    debugLogger.info("[ToPdfPage AccessCheck] Pro access DENIED. Card:", proAccessCard);
                }

            } else { 
                setHasAccess(false);
                setHasProAccess(false);
                debugLogger.info("[ToPdfPage AccessCheck] No auth or dbUser, all access DENIED.");
            }
            setIsCheckingAccess(false);
        }
    }, [dbUser, isAuthenticated, appContextLoading, appContextAuthenticating]);

    useEffect(() => {
        if (user?.id && !appContextLoading && !appContextAuthenticating && hasAccess) { 
            if (!firstLoadDoneRef.current) { 
                loadUserPdfFormData(String(user.id)).then(result => {
                    if (result.success && result.data) {
                        if (userName === '') setUserName(result.data.userName || (user.first_name || ''));
                        if (userAge === '') setUserAge(result.data.userAge || '');
                        if (userGender === '') setUserGender(result.data.userGender || '');
                    } else if (!result.data && user.first_name && userName === '') { 
                        setUserName(user.first_name);
                    }
                    firstLoadDoneRef.current = true; 
                });
            }
        } else if (user?.first_name && userName === '' && !appContextLoading && !appContextAuthenticating && !firstLoadDoneRef.current) {
            setUserName(user.first_name);
            firstLoadDoneRef.current = true;
        }
    }, [user?.id, user?.first_name, appContextLoading, appContextAuthenticating, hasAccess, userName, userAge, userGender]);


    const handleXlsxFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) { setSelectedFile(null); setMarkdownInput(''); setStatusMessage(t('noFileSelected')); return; }
        // Assuming MAX_FILE_SIZE_BYTES is defined elsewhere
        if (file.size > MAX_FILE_SIZE_BYTES) { toast.error(t('errorFileTooLarge')); setSelectedFile(null); if (event.target) event.target.value = ""; return; }
        if (file.type !== 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' && !file.name.endsWith('.xlsx')) { toast.error(t('errorInvalidFileType')); setSelectedFile(null); if (event.target) event.target.value = ""; return; }
        
        setSelectedFile(file);
        setIsLoading(true); setCurrentStep('analyzing'); setStatusMessage(t('parsingXlsx'));
        const result = await handleXlsxFileAndPreparePromptInternal(file, userName, userAge, userGender, t, setIsLoading, setStatusMessage);
        if(result.success && result.prompt){
            setMarkdownInput(result.prompt); setStatusMessage(t('promptGenerated')); toast.success(t('promptGenerated'));
            setCurrentStep('questions'); 
        } else {
            toast.error(t('unexpectedError', { ERROR: result.error || 'Failed to process XLSX' })); setStatusMessage(t('readyForUserData'));
            setCurrentStep('questions'); 
        }
        setIsLoading(false); 
    };

    const handleGenerateDemoQuestionsAndPrompt = () => {
        const userDataAndQuestions = generateUserDataAndQuestionsForAI(userName, userAge, userGender, hasProAccess);
        setMarkdownInput(userDataAndQuestions); 
        toast.success(t('demoQuestionsGenerated'));
        setStatusMessage(t('readyForPdf'));
    };

    const handleCopyToClipboard = () => {
        let textToCopy = markdownInput.trim(); 
        if (!textToCopy) {
             if(userName || userAge || userGender) { textToCopy = generateUserDataAndQuestionsForAI(userName,userAge,userGender, hasProAccess); } 
             else { toast.info(currentLang === 'ru' ? "Сначала введите данные или сгенерируйте вопросы." : "Enter user data or generate questions first."); return; }
        }
        const systemPromptToUse = hasProAccess ? PSYCHO_ANALYSIS_PRO_SYSTEM_PROMPT : PSYCHO_ANALYSIS_SYSTEM_PROMPT;
        const fullTextForAI = `${textToCopy}\n\n---\n${systemPromptToUse}`;
        navigator.clipboard.writeText(fullTextForAI).then(() => toast.success(t('promptCopySuccess'))).catch(err => { toast.error(t('promptCopyError')); logger.error('Clipboard copy failed:', err); });
    };

    const handleGeneratePdfAndProceed = async () => {
        if (!markdownInput.trim()) { toast.error(t('errorNoMarkdown')); return; }
        if (!user?.id) { toast.error(t('errorNoUser')); setCurrentStep('generalError'); return; }
        
        const reportFileNameBase = userName ? `PRIZMA_${hasProAccess ? 'Pro_' : ''}Анализ_${userName.replace(/\s/g, '_')}` : `PRIZMA_${hasProAccess ? 'Pro_' : ''}Анализ_Личности`;

        setIsLoading(true); setCurrentStep('analyzing'); setStatusMessage(t('generatingPdf'));
        try {
            const result = await generatePdfFromMarkdownAndSend( markdownInput, String(user.id), reportFileNameBase, userName.trim() || undefined, userAge.trim() || undefined, userGender.trim() || undefined, hasProAccess ? undefined : HERO_IMAGE_URL );
            if (result.success) {
                toast.success(result.message || t('successMessage'));
                if (hasProAccess) {
                    setCurrentStep('paymentSuccess'); 
                    setStatusMessage(t('prizmaProAnalysisSent'));
                } else {
                    setCurrentStep('basicAnalysisReady'); 
                }
            } else {
                toast.error(t('pdfGenerationFailed', { ERROR: result.error || 'Unknown error' }), { duration: 7000 });
                setCurrentStep('generalError'); setStatusMessage(t('pdfGenerationFailed', { ERROR: result.error || 'Unknown error' }));
            }
        } catch (error) {
            toast.error(t('unexpectedError', { ERROR: (error as Error).message }), { duration: 7000 });
            setCurrentStep('generalError'); setStatusMessage(t('unexpectedError', { ERROR: (error as Error).message }));
        } finally { setIsLoading(false); }
    };
    
    const handlePurchaseAccess = async () => { 
        if (!isAuthenticated || !dbUser?.user_id) { toast.error(t('errorNotAuthenticated')); return; }
        setIsPurchasing(true);
        const cardDetails: ProtoCardDetails = {
          cardId: PERSONALITY_REPORT_PDF_CARD_ID,
          title: currentLang === 'ru' ? `Доступ к PRIZMA Анализатору` : `PRIZMA Analyzer Access`,
          description: currentLang === 'ru' ? `Разблокировать AI Генератор PDF для психологических расшифровок PRIZMA. Цена: ${PERSONALITY_REPORT_PDF_ACCESS_PRICE_XTR} XTR.` : `Unlock the AI PDF Generator for PRIZMA personality insights. Price: ${PERSONALITY_REPORT_PDF_ACCESS_PRICE_XTR} XTR.`,
          amountXTR: PERSONALITY_REPORT_PDF_ACCESS_PRICE_XTR,
          type: "tool_access",
          metadata: { page_link: "/topdf", tool_name: "PRIZMA PDF Generator", photo_url: HERO_IMAGE_URL }
        };
        try {
          const result = await purchaseProtoCardAction(dbUser.user_id, cardDetails);
          if (result.success) { toast.success(t('purchaseSuccessMessage')); if(refreshDbUser) { setTimeout(async () => { await refreshDbUser(); }, 7000); }}
          else { toast.error(t('purchaseErrorMessage', { ERROR: result.error || '' }));}
        } catch (error) { toast.error(t('purchaseErrorMessage', { ERROR: (error as Error).message || '' }));}
        setIsPurchasing(false);
    };

    const handlePurchaseFullAnalysis = async () => { 
        if (!isAuthenticated || !dbUser?.user_id) { toast.error(t('errorNotAuthenticated')); return; }
        setIsPurchasing(true);
        const cardDetails: ProtoCardDetails = {
          cardId: PSYCHO_ANALYSIS_PRO_ACCESS_CARD_ID,
          title: currentLang === 'ru' ? `PRIZMA: ${t('prizmaFullAnalysis')}` : `PRIZMA: ${t('prizmaFullAnalysis')}`,
          description: currentLang === 'ru' ? `Разблокировать полный анализ PRIZMA с расширенным набором вопросов (50) и углубленной интерпретацией. Цена: ${PSYCHO_ANALYSIS_PRO_ACCESS_PRICE_XTR} XTR.` : `Unlock the full PRIZMA analysis with 50 questions and in-depth interpretation. Price: ${PSYCHO_ANALYSIS_PRO_ACCESS_PRICE_XTR} XTR.`,
          amountXTR: PSYCHO_ANALYSIS_PRO_ACCESS_PRICE_XTR,
          type: "tool_access", 
          metadata: { 
            tool_name: "PRIZMA PDF Pro Analysis", 
            feature_description: "Access to 50 questions and advanced AI system prompt for psychoanalysis PDF."
          }
        };
        try {
          const result = await purchaseProtoCardAction(dbUser.user_id, cardDetails);
          if (result.success) { 
            toast.success(t('purchaseSuccessMessage')); 
            if(refreshDbUser) { 
                setTimeout(async () => { 
                    await refreshDbUser(); 
                    setCurrentStep('questions'); 
                    toast.info(currentLang === 'ru' ? "Pro-доступ активирован! Теперь вам доступны все вопросы." : "Pro access activated! All questions are now available to you.");
                }, 7000); 
            }
          }
          else { toast.error(t('purchaseErrorMessage', { ERROR: result.error || '' }));}
        } catch (error) { toast.error(t('purchaseErrorMessage', { ERROR: (error as Error).message || '' }));}
        setIsPurchasing(false);
    };

    const handleContactSupport = async () => {
        if (!user?.id) {
            toast.error(t("errorNoUser"));
            return;
        }
        setIsLoading(true);
        const result = await notifyAdminAction(
            String(user.id), 
            user.username || user.first_name,
            `Пользователь столкнулся с проблемой на странице PRIZMA на шаге "${currentStep}". Текущее сообщение статуса: "${statusMessage}"`
        );
        setIsLoading(false);
        if (result.success) {
            toast.success(currentLang === 'ru' ? "Ваш запрос отправлен в поддержку!" : "Your support request has been sent!");
        } else {
            toast.error(currentLang === 'ru' ? "Не удалось отправить запрос. Попробуйте позже." : "Failed to send request. Please try again later.");
        }
    };

    const handleProceedToUserData = () => setCurrentStep('userData');
    const handleProceedToQuestions = () => {
      if (!userName.trim()) { toast.error(currentLang === 'ru' ? "Пожалуйста, введите ваше имя." : "Please enter your name."); return; }
      if (user?.id) { saveUserPdfFormData(String(user.id), { userName, userAge, userGender }); }
      setCurrentStep('questions');
    };
    const toggleLang = useCallback(() => setCurrentLang(p => p === 'en' ? 'ru' : 'en'), []);

    if (appContextLoading || appContextAuthenticating || isCheckingAccess) { 
        return ( <div className="flex flex-col justify-center items-center min-h-screen pt-20 bg-background text-foreground"> <VibeContentRenderer content="::FaSpinner className='animate-spin text-brand-purple text-4xl'::" /> <span className="mt-4 text-lg font-mono">{t('loadingUser')}</span> </div> );
    }
    if (!hasAccess) { 
        return ( <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6 text-center text-foreground">
            <VibeContentRenderer content="::FaLock className='text-7xl text-brand-red mb-6 animate-pulse'::" />
            <h1 className="text-3xl sm:text-4xl font-orbitron font-bold text-brand-red mb-4">{t("accessDeniedTitle")}</h1>
            <p className="text-md sm:text-lg text-muted-foreground mb-8 max-w-md">{t("accessDeniedSubtitle")}</p>
            <Button onClick={handlePurchaseAccess} disabled={isPurchasing || !isAuthenticated} size="lg" className="bg-gradient-to-r from-brand-orange to-red-600 text-white font-orbitron font-bold py-3 px-8 rounded-lg text-lg hover:from-brand-orange/90 hover:to-red-600/90 transition-all shadow-lg hover:shadow-yellow-500/50">
              {isPurchasing ? <VibeContentRenderer content="::FaSpinner className='animate-spin mr-2'::" /> : <VibeContentRenderer content="::FaKey::" className="mr-2" />}
              {isPurchasing ? t("purchasingInProgress") : t("purchaseAccessButton", { PRICE: PERSONALITY_REPORT_PDF_ACCESS_PRICE_XTR })}
            </Button>
            {!isAuthenticated && <p className="text-xs text-red-400 mt-3">{t("errorNotAuthenticated")}</p>}
            <Link href="/hotvibes" className="block mt-10">
                <Button variant="outline" className="border-brand-blue text-brand-blue hover:bg-brand-blue/10 text-sm"> <VibeContentRenderer content={t("backToHotVibes")}/> </Button>
            </Link>
        </div> );
    }
        
    const renderStep = () => {
        switch (currentStep) {
            case 'intro':
                return <IntroStep translations={t} onStartAnalysis={handleProceedToUserData} heroImageUrl={HERO_IMAGE_URL} />;
            case 'userData':
                return <UserDataStep translations={t} userName={userName} setUserName={setUserName} userAge={userAge} setUserAge={setUserAge} userGender={userGender} setUserGender={setUserGender} onContinue={handleProceedToQuestions} onBack={() => setCurrentStep('intro')} currentLang={currentLang} />;
            case 'questions':
                return <QuestionsStep translations={t} markdownInput={markdownInput} setMarkdownInput={setMarkdownInput} selectedFile={selectedFile} isLoading={isLoading} onGenerateDemoQuestions={handleGenerateDemoQuestionsAndPrompt} onCopyToClipboard={handleCopyToClipboard} onGeneratePdf={handleGeneratePdfAndProceed} onBack={() => setCurrentStep('userData')} onXlsxFileChange={handleXlsxFileChange} />;
            case 'analyzing':
                return <AnalyzingStep translations={t} statusMessage={statusMessage} />;
            case 'basicAnalysisReady':
                return <BasicAnalysisReadyStep translations={t} onGetFullAnalysis={() => setCurrentStep('paymentOfferDetails')} onGoToIntro={() => setCurrentStep('intro')} hasProAccess={hasProAccess} />;
            case 'paymentOfferDetails':
                return <PaymentOfferDetailsStep translations={t} onPurchaseFullAnalysis={handlePurchaseFullAnalysis} onBack={() => setCurrentStep('basicAnalysisReady')} isPurchasing={isPurchasing} proAccessPrice={PSYCHO_ANALYSIS_PRO_ACCESS_PRICE_XTR} currentLang={currentLang} />;
            case 'paymentSuccess':
                return <PaymentSuccessStep translations={t} onContinue={() => setCurrentStep(hasProAccess ? 'intro' : 'questions')} hasProAccess={hasProAccess} />;
            case 'generalError':
                return <GeneralErrorStep translations={t} statusMessage={statusMessage} onTryAgain={() => setCurrentStep('questions')} onContactSupport={handleContactSupport} isLoading={isLoading} />;
            default:
                debugLogger.warn(`[ToPdfPage] Unknown step: ${currentStep}. Defaulting to intro.`);
                return <IntroStep translations={t} onStartAnalysis={handleProceedToUserData} heroImageUrl={HERO_IMAGE_URL} />;
        }
    };
    
    return (
        <div ref={pageContainerRef} className={cn("min-h-screen flex flex-col items-center justify-center pt-10 sm:pt-12 pb-10", "bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 text-foreground px-4 font-sans")}>
            <Toaster position="bottom-center" richColors theme="light" toastOptions={{ className: '!font-mono !shadow-lg' }} />
            <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-20">  
                <button onClick={toggleLang} className="p-1.5 sm:p-2 bg-card/80 border border-border rounded-md hover:bg-muted/30 transition-colors flex items-center gap-1 text-xs text-muted-foreground shadow-sm" title={t("toggleLanguage")}> 
                    <VibeContentRenderer content="::FaLanguage::" className="w-4 h-4 sm:w-3.5 sm:h-3.5"/> <span className="hidden sm:inline">{currentLang === 'en' ? 'RU' : 'EN'}</span>
                </button> 
            </div>
            {renderStep()}
        </div>
    );
}