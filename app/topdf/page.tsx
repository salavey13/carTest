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
import { 
    PSYCHO_ANALYSIS_SYSTEM_PROMPT, 
    REFINED_PERSONALITY_QUESTIONS_RU,
    PRO_ADDITIONAL_QUESTIONS_RU, 
    PSYCHO_ANALYSIS_PRO_SYSTEM_PROMPT 
} from './psychoAnalysisPrompt';
import { purchaseProtoCardAction } from '../hotvibes/actions'; 
import type { ProtoCardDetails } from '../hotvibes/actions';   
import Link from 'next/link';

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
    "goToGemini": "Open Gemini AI Studio (for self-analysis)",
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
    "prizmaProAnalysisReadyTitle": "Your FULL PRIZMA analysis is ready!",
    "prizmaProAnalysisSent": "Your full PRIZMA PDF report (Pro version) has been sent to Telegram.",
    "prizmaGetFullAnalysis": "Get Full Analysis",
    "prizmaFullAnalysis": "Full Analysis",
    "prizmaPaymentOfferTitle": "Full Decryption",
    "prizmaPaymentOfferPrice": "$29.90", 
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
    "goToGemini": "Открыть Gemini AI Studio (для самостоятельного анализа)",
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
    "prizmaProAnalysisReadyTitle": "Ваш ПОЛНЫЙ анализ PRIZMA готов!",
    "prizmaProAnalysisSent": "Ваш полный PDF-отчет PRIZMA (Pro версия) отправлен в Telegram.",
    "prizmaGetFullAnalysis": "Получить полный анализ",
    "prizmaFullAnalysis": "Полный анализ",
    "prizmaPaymentOfferTitle": "Полная расшифровка",
    "prizmaPaymentOfferPrice": "2990р", 
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
        const promptForAI = `Ты — высококвалифицированный AI-аналитик...`; 
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
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [userName, setUserName] = useState<string>('');
    const [userAge, setUserAge] = useState<string>('');
    const [userGender, setUserGender] = useState<string>('');
    
    const [hasAccess, setHasAccess] = useState(false); 
    const [hasProAccess, setHasProAccess] = useState(false); 
    const [isCheckingAccess, setIsCheckingAccess] = useState(true);
    const [isPurchasing, setIsPurchasing] = useState(false);

    const [currentStep, setCurrentStep] = useState<PsychoFocusStep>('intro');

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
      if (currentStep !== 'analyzing') { 
        setStatusMessage(t('readyForUserData'));
      }
    }, [t, currentLang, currentStep]);

     useEffect(() => {
        if (!appContextLoading && !appContextAuthenticating) {
            setIsCheckingAccess(true);
            if (isAuthenticated && dbUser) {
                const cards = dbUser.metadata?.xtr_protocards as Record<string, { status: string; type?: string; data?: { page_link?: string } }> | undefined;
                
                const baseAccessCard = cards?.[PERSONALITY_REPORT_PDF_CARD_ID];
                if (baseAccessCard?.status === 'active' && baseAccessCard.type === 'tool_access' && baseAccessCard.data?.page_link === '/topdf') {
                    setHasAccess(true);
                } else { setHasAccess(false); }

                const proAccessCard = cards?.[PSYCHO_ANALYSIS_PRO_ACCESS_CARD_ID];
                if (proAccessCard?.status === 'active' && proAccessCard.type === 'tool_access') { 
                    setHasProAccess(true);
                } else { setHasProAccess(false); }

            } else { 
                setHasAccess(false);
                setHasProAccess(false);
            }
            setIsCheckingAccess(false);
        }
    }, [dbUser, isAuthenticated, appContextLoading, appContextAuthenticating]);

    useEffect(() => {
        if (user?.id && !appContextLoading && !appContextAuthenticating && hasAccess) { 
            loadUserPdfFormData(String(user.id)).then(result => {
                if (result.success && result.data) {
                    setUserName(result.data.userName || (user.first_name || ''));
                    setUserAge(result.data.userAge || '');
                    setUserGender(result.data.userGender || '');
                } else if (!result.data && user.first_name) { setUserName(user.first_name); }
            });
        } else if (user?.first_name && !userName) { setUserName(user.first_name); }
    }, [user?.id, user?.first_name, appContextLoading, appContextAuthenticating, hasAccess, userName]);

    const handleXlsxFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) { setSelectedFile(null); setMarkdownInput(''); setStatusMessage(t('noFileSelected')); return; }
        if (file.size > MAX_FILE_SIZE_BYTES) { toast.error(t('errorFileTooLarge')); setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; return; }
        if (file.type !== 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' && !file.name.endsWith('.xlsx')) { toast.error(t('errorInvalidFileType')); setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; return; }
        
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
            const result = await generatePdfFromMarkdownAndSend( markdownInput, String(user.id), reportFileNameBase, userName.trim() || undefined, userAge.trim() || undefined, userGender.trim() || undefined );
            if (result.success) {
                toast.success(result.message || t('successMessage'));
                if (hasProAccess) {
                    setCurrentStep('paymentSuccess'); // Using paymentSuccess as a generic success screen for Pro
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
    
    const StepContainer: React.FC<{children: React.ReactNode, title?: string, showBackButton?: boolean, onBack?: () => void, className?: string}> = ({ children, title, showBackButton, onBack, className }) => (
        <div className={cn("w-full max-w-md mx-auto p-6 md:p-8 space-y-6 bg-card rounded-xl shadow-xl", className)}>
            {showBackButton && onBack && (
                <Button onClick={onBack} variant="ghost" size="sm" className="absolute top-5 left-5 text-muted-foreground hover:text-foreground">
                    <VibeContentRenderer content="::FaArrowLeft::" className="mr-2"/> {currentLang === 'ru' ? 'Назад' : 'Back'}
                </Button>
            )}
            {title && <h2 className="text-2xl font-orbitron font-bold text-center text-foreground">{title}</h2>}
            {children}
        </div>
    );
    
    return (
        <div className={cn("min-h-screen flex flex-col items-center justify-center pt-[var(--header-height,60px)] pb-10", "bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 text-foreground px-4 font-sans")}>
            <Toaster position="bottom-center" richColors theme="light" toastOptions={{ className: '!font-mono !shadow-lg' }} />
            <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-20">  
                <button onClick={toggleLang} className="p-1.5 sm:p-2 bg-card/80 border border-border rounded-md hover:bg-muted/30 transition-colors flex items-center gap-1 text-xs text-muted-foreground shadow-sm" title={t("toggleLanguage")}> 
                    <VibeContentRenderer content="::FaLanguage::" className="w-4 h-4 sm:w-3.5 sm:h-3.5"/> <span className="hidden sm:inline">{currentLang === 'en' ? 'RU' : 'EN'}</span>
                </button> 
            </div>

            {currentStep === 'intro' && (
                <div className="w-full max-w-md mx-auto p-6 md:p-8 space-y-6 text-center"> 
                    <VibeContentRenderer content="::FaAtom size=80 className='text-brand-purple mx-auto mb-4 animate-pulse-slow'::" /> 
                    <h1 className="text-5xl font-orbitron font-black text-transparent bg-clip-text bg-gradient-to-r from-brand-pink via-brand-purple to-brand-blue mb-3">{t("prizmaIntroTitle")}</h1>
                    <p className="text-lg text-muted-foreground mb-2">{t("prizmaIntroSubtitle")}</p>
                    <p className="text-sm text-muted-foreground mb-8">{t("prizmaIntroDesc")}</p>
                    <Button onClick={handleProceedToUserData} size="lg" className="w-full bg-brand-gradient-purple-blue text-white font-semibold py-3 text-lg shadow-md hover:opacity-90 transition-opacity">
                        {t("prizmaStartAnalysis")} <VibeContentRenderer content="::FaChevronRight className='ml-2'::"/>
                    </Button>
                </div>
            )}

            {currentStep === 'userData' && (
                <StepContainer title={t("prizmaUserDataPrompt")} showBackButton onBack={() => setCurrentStep('intro')}>
                    <div className="space-y-4"> 
                        <div> <Label htmlFor="userName" className="text-sm font-medium text-muted-foreground">{t("userNameLabel")}</Label> <Input id="userName" type="text" value={userName} onChange={(e) => setUserName(e.target.value)} placeholder={currentLang === 'ru' ? "Иван Иванов" : "John Doe"} className="w-full mt-1 input-cyber" /> </div>
                        <div> <Label htmlFor="userAge" className="text-sm font-medium text-muted-foreground">{t("userAgeLabel")}</Label> <Input id="userAge" type="text" value={userAge} onChange={(e) => setUserAge(e.target.value)} placeholder="30" className="w-full mt-1 input-cyber" /> </div>
                        <div> <Label htmlFor="userGender" className="text-sm font-medium text-muted-foreground">{t("userGenderLabel")}</Label> <Input id="userGender" type="text" value={userGender} onChange={(e) => setUserGender(e.target.value)} placeholder={currentLang === 'ru' ? "Мужчина/Женщина" : "Male/Female"} className="w-full mt-1 input-cyber" /> </div>
                    </div>
                    <Button onClick={handleProceedToQuestions} size="lg" className="w-full mt-8 bg-brand-gradient-purple-blue text-white font-semibold py-3 text-lg shadow-md hover:opacity-90 transition-opacity">
                        {t("prizmaContinue")} <VibeContentRenderer content="::FaChevronRight className='ml-2'::"/>
                    </Button>
                </StepContainer>
            )}
            
            {currentStep === 'questions' && (
                 <StepContainer title={t("prizmaQuestionsTitle")} showBackButton onBack={() => setCurrentStep('userData')}>
                    <div className="space-y-4">
                        <Button onClick={handleGenerateDemoQuestionsAndPrompt} variant="outline" className="w-full border-brand-yellow/80 text-brand-yellow hover:bg-brand-yellow/10"> 
                           <span className="flex items-center justify-center">
                                <VibeContentRenderer content="::FaCircleQuestion::" className="mr-2"/>{t("generateDemoQuestions")}
                           </span>
                        </Button>
                        <div> <Label htmlFor="markdownInput" className="text-sm font-medium text-muted-foreground">{t("pasteMarkdown")}</Label> <textarea id="markdownInput" value={markdownInput} onChange={(e) => setMarkdownInput(e.target.value)} placeholder={t('workingAreaMark')} rows={15} className="w-full mt-1 p-2.5 sm:p-3 input-cyber simple-scrollbar" disabled={isLoading}/> </div>
                        {(markdownInput) && ( <div className="mt-4 flex flex-col sm:flex-row gap-3"> 
                            <Button onClick={handleCopyToClipboard} variant="outline" className="border-brand-cyan/80 text-brand-cyan hover:bg-brand-cyan/10 flex-1"> 
                                <span className="flex items-center justify-center">
                                    <VibeContentRenderer content="::FaCopy::" className="mr-2"/>{t("copyPromptAndData")} 
                                </span>
                            </Button> 
                            <Button variant="outline" asChild className="border-brand-blue/80 text-brand-blue hover:bg-brand-blue/10 flex-1"> 
                                <a href="https://aistudio.google.com/" target="_blank" rel="noopener noreferrer" > 
                                    <span className="flex items-center justify-center">
                                        <VibeContentRenderer content="::FaGoogle::" className="mr-2"/>{t("goToGemini")} 
                                    </span>
                                </a> 
                            </Button> 
                        </div> )}
                        <details className="mt-4 pt-4 border-t border-border group">
                            <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors font-semibold flex items-center gap-1">
                                <span className="flex items-center gap-1"> 
                                    <VibeContentRenderer content="::FaFileImport::" />
                                    {t("xlsxUploadOptionalTitle")}
                                    <VibeContentRenderer content="::FaChevronDown className='ml-auto group-open:rotate-180 transition-transform'::"/>
                                </span>
                            </summary>
                            <div className="mt-3 p-3 border border-dashed border-border rounded-lg bg-background shadow-inner">
                                <label htmlFor="xlsxFileOptional" className={cn("w-full flex flex-col items-center justify-center px-4 py-4 border-2 border-dashed rounded-lg cursor-pointer transition-all duration-200 ease-in-out", "border-input-border hover:border-brand-yellow text-muted-foreground hover:text-brand-yellow", isLoading ? "opacity-70 cursor-not-allowed" : "hover:bg-brand-yellow/5")}>
                                    <VibeContentRenderer content="::FaUpload::" className="text-xl mb-1" /> 
                                    <span className="font-medium text-xs">{selectedFile ? t('fileSelected', { FILENAME: selectedFile.name }) : t('selectFile')}</span>
                                    <input id="xlsxFileOptional" ref={fileInputRef} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={handleXlsxFileChange} className="sr-only" disabled={isLoading} />
                                </label>
                            </div>
                        </details>
                    </div>
                    <Button onClick={handleGeneratePdfAndProceed} disabled={isLoading || !markdownInput.trim()} size="lg" className="w-full mt-8 bg-brand-gradient-purple-blue text-white font-semibold py-3 text-lg shadow-md hover:opacity-90 transition-opacity">
                        {isLoading ? <><VibeContentRenderer content="::FaSpinner className='animate-spin mr-2'::"/>{t("prizmaAnalyzing")}</> : t("prizmaNext")}
                    </Button>
                 </StepContainer>
            )}

            {currentStep === 'analyzing' && isLoading && ( 
                 <StepContainer className="text-center">
                    <VibeContentRenderer content="::FaSpinner className='text-6xl text-brand-purple mx-auto mb-6 animate-spin'::" />
                    <h1 className="text-3xl font-orbitron font-bold text-transparent bg-clip-text bg-gradient-to-r from-brand-pink via-brand-purple to-brand-blue mb-3">{t("prizmaAnalyzingTitle")}</h1>
                    <p className="text-lg text-muted-foreground">{statusMessage || t("prizmaAnalyzing")}</p>
                 </StepContainer>
            )}

            {currentStep === 'basicAnalysisReady' && (
                <StepContainer className="text-center">
                    <VibeContentRenderer content="::FaCheckCircle className='text-6xl text-green-500 mx-auto mb-4'::" />
                    <h1 className="text-3xl font-orbitron font-bold text-transparent bg-clip-text bg-gradient-to-r from-brand-pink via-brand-purple to-brand-blue mb-3">
                        {t("prizmaBasicAnalysisReadyTitle")}
                    </h1>
                    <p className="text-md text-muted-foreground mb-6">
                        {t("prizmaBasicAnalysisSent")}
                    </p>
                    {!hasProAccess && (
                        <Button onClick={() => setCurrentStep('paymentOfferDetails')} size="lg" className="w-full bg-brand-gradient-pink-purple text-white font-semibold py-3 text-lg shadow-md hover:opacity-90 transition-opacity">
                            {t("prizmaGetFullAnalysis")}
                        </Button>
                    )}
                     {hasProAccess && (
                        <p className="text-md text-green-600 font-semibold mb-6">{t("prizmaProAnalysisSent")}</p>
                    )}
                    <Button onClick={() => setCurrentStep('intro')} variant="link" className="text-brand-blue mt-4">Вернуться на главный экран</Button>
                </StepContainer>
            )}
            
            {currentStep === 'paymentOfferDetails' && !hasProAccess && (
                <StepContainer showBackButton onBack={() => setCurrentStep('basicAnalysisReady')} className="text-center">
                    <div className="bg-card border border-border rounded-xl p-6 shadow-xl my-6 relative overflow-hidden">
                        <div className="absolute -top-px -right-px bg-brand-pink text-white text-xs font-bold px-3 py-1 rounded-bl-lg rounded-tr-lg shadow-md transform-gpu">{currentLang === 'ru' ? 'ХИТ' : 'POPULAR'}</div>
                        <h2 className="text-2xl font-orbitron font-bold text-foreground mb-2">{t("prizmaPaymentOfferTitle")}</h2>
                        <div className="my-4">
                            <span className="text-4xl font-orbitron font-black text-brand-purple">{currentLang === 'ru' ? `${PSYCHO_ANALYSIS_PRO_ACCESS_PRICE_XTR}р` : `$${(PSYCHO_ANALYSIS_PRO_ACCESS_PRICE_XTR / 100).toFixed(2)}`}</span> {/* Adjust price display as needed */}
                            <span className="text-lg text-muted-foreground line-through ml-2">{t("prizmaPaymentOfferPriceOld")}</span>
                        </div>
                        <VibeContentRenderer content={t("prizmaPaymentOfferFeatures")} className="text-sm text-muted-foreground space-y-1 text-left prose prose-sm max-w-none prose-p:my-0.5 prose-ul:my-1 prose-li:my-0"/>
                        <Button onClick={handlePurchaseFullAnalysis} disabled={isPurchasing} size="lg" className="w-full mt-6 bg-brand-gradient-purple-blue text-white font-semibold py-3 text-lg shadow-md hover:opacity-90 transition-opacity">
                            {isPurchasing ? <VibeContentRenderer content="::FaSpinner className='animate-spin mr-2'::"/> : t("prizmaChoosePayment")}
                        </Button>
                         <p className="text-xs text-muted-foreground mt-3">{t("prizmaPaymentGuarantee")}</p>
                    </div>
                </StepContainer>
            )}
            
            {currentStep === 'paymentSuccess' && ( 
                <StepContainer title={hasProAccess ? t("prizmaProAnalysisReadyTitle") : t("prizmaPaymentSuccessTitle")} className="text-center">
                     <VibeContentRenderer content="::FaCreditCard className='text-6xl text-green-500 mx-auto mb-4'::" />
                    <p className="text-md text-muted-foreground mb-6">
                        {hasProAccess ? t("prizmaProAnalysisSent") : t("prizmaPaymentSuccessDesc", {REMAINING: 5})}
                    </p>
                    <Button onClick={() => setCurrentStep('intro')} size="lg" className="w-full bg-brand-gradient-purple-blue text-white font-semibold py-3 text-lg shadow-md hover:opacity-90 transition-opacity">
                        {t("prizmaContinue")}
                    </Button>
                </StepContainer>
            )}
            
            {currentStep === 'generalError' && ( 
                 <StepContainer title={t("prizmaErrorTitle")} className="text-center">
                    <VibeContentRenderer content="::FaTimesCircle className='text-6xl text-red-500 mx-auto mb-4'::" /> <p className="text-md text-muted-foreground mb-6">{statusMessage || t("prizmaErrorDesc")}</p> <div className="space-y-3"> <Button onClick={() => setCurrentStep('questions')} size="lg" className="w-full bg-brand-gradient-purple-blue text-white font-semibold py-3 text-lg"> {t("prizmaTryAgain")} </Button> <Button onClick={() => { toast.info("Связь с поддержкой в разработке"); }} variant="outline" className="w-full"> {t("prizmaContactSupport")} </Button> </div>
                </StepContainer>
            )}
        </div>
    );
}