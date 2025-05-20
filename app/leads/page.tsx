"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from '@/components/ui/textarea';
import { VibeContentRenderer } from '@/components/VibeContentRenderer';
import { cn } from '@/lib/utils';
import { useAppContext } from '@/contexts/AppContext'; 
import { PROMPT_OFFER_V2_CYBERVIBE_OUTREACH } from './prompt_offer';
import { PROMPT_KWORKS_TO_CSV } from './prompt_kworks_to_csv';
import { PROMPT_FIND_TWEAKS } from './prompt_find_tweaks';
import { PROMPT_FIND_MISSING_FEATURES } from './prompt_find_missing_features';
import { PROMPT_INTERGALACTIC_PIPELINE } from './prompt_intergalactic_pipeline';
import { uploadLeadsFromCsv, updateLeadStatus, assignLead, fetchLeadsForDashboard } from './actions'; 
import { toast } from 'sonner';


interface Lead {
  id?: string; 
  source?: string;
  lead_url?: string;
  client_name?: string | null; // client_name может быть null
  project_description?: string;
  raw_html_description?: string | null;
  budget_range?: string | null;
  posted_at?: string | null; 
  similarity_score?: number | null; 
  status?: string;
  assigned_to_tank?: string | null;
  assigned_to_carry?: string | null;
  assigned_to_support?: string | null;
  notes?: string | null;
  supervibe_studio_links?: any; 
  github_issue_links?: any; 
  generated_offer?: string | null;
  identified_tweaks?: any; 
  missing_features?: any; 
  created_at?: string; 
  updated_at?: string; 
}

interface TeamUser { // Упрощенный тип для отображения в UI
  user_id: string;
  username?: string | null;
  role?: string | null;
}

const LeadGenerationHQPage = () => {
  const { user: tgUserContext, dbUser } = useAppContext(); 
  const currentUserId = dbUser?.user_id || tgUserContext?.id?.toString(); 

  const [rawKworksInput, setRawKworksInput] = useState('');
  const [processedCsvForUpload, setProcessedCsvForUpload] = useState(''); 
  const [leads, setLeads] = useState<Lead[]>([]); 
  const [isLoading, setIsLoading] = useState(false);
  const [currentFilter, setCurrentFilter] = useState('all'); 
  const [teamMembers, setTeamMembers] = useState<TeamUser[]>([]); // Для селекторов назначения

  // --- Refs для скролла ---
  const rolesSectionRef = useRef<HTMLDivElement>(null);
  const arsenalSectionRef = useRef<HTMLDivElement>(null);
  const offerSectionRef = useRef<HTMLDivElement>(null); // Ref для секции с полем финального CSV
  const workflowSectionRef = useRef<HTMLDivElement>(null);
  const assetsSectionRef = useRef<HTMLDivElement>(null);
  const zionSectionRef = useRef<HTMLDivElement>(null);
  const dashboardSectionRef = useRef<HTMLDivElement>(null);

  // --- Тексты (только русский) ---
  const t_dynamic_links = { // Динамические ссылки вынесены для VibeContentRenderer
    linkToRepoXml: "<Link href='/repo-xml' class='text-brand-purple hover:underline'>SUPERVIBE Studio</Link>",
    linkToJumpstart: "<Link href='/jumpstart' class='text-brand-lime hover:underline'>Jumpstart Kit</Link>",
    linkToSelfDev: "<Link href='/selfdev' class='text-brand-green hover:underline'>Кодекс SelfDev</Link>",
    linkToPurposeProfit: "<Link href='/purpose-profit' class='text-brand-pink hover:underline'>скрижали 'Цель и Прибыль'</Link>",
    linkToGamePlan: "<Link href='/game-plan' class='text-brand-blue hover:underline'>Гейм План</Link>",
    linkToPPlan: "<Link href='/p-plan' class='text-brand-yellow hover:underline'>VIBE План</Link>",
    linkToTutorials: "<Link href='/start-training' class='text-brand-cyan hover:underline'>Арсенал Приемов и Тактик</Link>",
    linkToCyberDevOS: "<Link href='/selfdev/gamified' class='text-brand-orange hover:underline'>CyberDev OS</Link>",
    linkToAbout: "<Link href='/about' class='text-brand-purple hover:underline'>личное дело</Link>",
    linkToLeads: "<Link href='/leads' class='text-brand-orange hover:underline'>КОЦ 'Сетевой Дозор'</Link>",
    linkToZion: "<Link href='https://t.me/salavey_channel' target='_blank' rel='noopener noreferrer' class='text-brand-cyan hover:underline'>Цитадель 'Зион' (@salavey_channel)</Link>",
  };
  
  const t = { 
    pageTitle: "КОЦ 'Сетевой Дозор'",
    pageSubtitle: `Бойцы КиберОтряда! Это ваш командный пункт для захвата лидов и доминации в Supervibe-стиле. Роли распределены, цели определены, VIBE активирован. Трансмутируем инфу в профит!`,
    rolesTitle: "::FaUserShield:: КиберОтряд: Роли и Протоколы Действий",
    rolesSubtitle: `Экипаж машины боевой, заряженный на VIBE-победу и тотальное превосходство. Узнай больше о нашей философии в ${t_dynamic_links.linkToSelfDev} и ${t_dynamic_links.linkToPurposeProfit}.`,
    carryRoleTitle: "::FaBrain:: Кэрри (Ты, Павел)",
    carryRoleDesc: `Верховный Архитектор, Движитель Инноваций. Создаешь и внедряешь прорывные фичи в ${t_dynamic_links.linkToRepoXml}. Решаешь нетривиальные задачи разработки, определяя вектор эволюции платформы. Твой код – закон. Смотри ${t_dynamic_links.linkToAbout} Кэрри.`,
    tanksRoleTitle: "::FaShieldHalved:: Танки (Штурмовики Кастомизации)",
    tanksRoleDesc: "Броневой кулак кастомизации и адаптации. Принимают на себя 'урон' от сложных клиентских запросов, AI-артефактов. Трансмутируют базовые модули в уникальные клиентские решения, используя реактивную мощь Supervibe Studio. Их девиз: 'Прорвемся и Улучшим!'",
    tanksRoleLeverages: `Основное вооружение: ${t_dynamic_links.linkToTutorials} (включая Замену Изображений, Охоту на Иконки, Видео-Интеграцию, Inception Swap-Маневры).`,
    supportRoleTitle: "::FaHeadset:: Саппорт (Дозорные Сети)",
    supportRoleDesc: `Информационно-логистический хаб и голос отряда. Идентифицируют, фильтруют и обрабатывают входящие сигналы (лиды). Готовят разведданные, CSV для AI-обработки и целеуказания для Танков и Кэрри. Ведут первичные переговоры, обеспечивая бесперебойную связь и снабжение отряда задачами.`,
    supportArsenalTitle: "::FaTools:: Арсенал Саппорта: Протоколы Автоматизации 'Судный День'",
    supportArsenalSubtitle: `Высокотехнологичное снаряжение для информационной войны и эффективной вербовки. Геймеры, это для вас – превращаем рутину в квест в нашем ${t_dynamic_links.linkToCyberDevOS}!`,
    rawKworksInputTitle: "::FaBinoculars:: Этап 1: 'Сбор трофеев' (Поток KWorks)",
    rawKworksInputDesc: "Саппорт! Копируй сюда ВСЮ страницу с проектами Kwork или другой биржи. Наш AI-парсер, как верный дрон, извлечет из этого хаоса структурированные данные о лидах. Чем больше данных, тем точнее прицел!",
    rawKworksInputPlaceholder: "Ctrl+A, Ctrl+C со страницы Kwork... и Ctrl+V сюда, оперативник!",
    promptButtonsTitle: "::FaBolt:: Этап 2: 'Нейро-алхимия' (AI-Обработка Лидов):",
    promptButtonKworksToCsv: "1. 'Трансмутация Хаоса': Текст KWorks -> CSV Таблицу Лидов",
    promptButtonCsvToOffer: "2. 'Заряд Убеждения': CSV + Промпт Оффера -> CSV с Колонкой 'Оффер'",
    promptButtonCsvToTweaks: "3. 'Чертежи для Танков': CSV + Промпт Твиков -> CSV с Колонкой 'Твики'",
    promptButtonCsvToFeatures: "4. 'R&D для Кэрри': CSV + Промпт Фич -> CSV с Колонкой 'Новые Фичи'",
    promptButtonInstruction: "Инструкция для Саппорта-Геймера: 1. Заполни поле 'Сбор трофеев'. 2. Жми кнопку 'Трансмутация Хаоса', скопируй промпт. 3. Скармливай AI (ChatGPT/Claude) этот промпт + текст из поля -> получишь CSV-код. 4. Копируй этот CSV-код. 5. Жми кнопки 2, 3, 4 последовательно. Каждый раз копируй промпт и отдавай AI ВМЕСТЕ с ПОСЛЕДНИМ полученным CSV-кодом. AI будет ДОБАВЛЯТЬ новые колонки. Финальный CSV – в поле ниже.",
    finalCsvInputTitle: "::FaFileUpload:: Этап 3: 'Десант в ЦОД' (Загрузка Финального CSV)",
    finalCsvInputDesc: "Саппорт, сюда вставляй ПОЛНОСТЬЮ обработанный AI CSV-файл (уже с колонками 'generated_offer', 'identified_tweaks', 'missing_features'). Одна кнопка – и лиды улетают в нашу базу Supabase, а команда получает уведомления!",
    finalCsvInputPlaceholder: "Вставь сюда финальный CSV-код от AI...",
    uploadLeadsButton: "::FaCloudUploadAlt:: ДЕСАНТИРОВАТЬ ЛИДЫ В SUPABASE!",
    leadsDashboardTitle: "::FaTableList:: Оперативный Дашборд 'Око Войны'",
    leadsDashboardDesc: "КиберОтряд, здесь ваши цели! Обновляйте статусы, назначайте ответственных, координируйте атаку! Фильтруйте задачи по ролям – каждый видит свой фронт работ.",
    kworkSearchLink1: "::FaSquareArrowUpRight:: TWA (Kwork)", 
    kworkSearchLink2: "::FaSquareArrowUpRight:: Mini Apps (Kwork)",
    kworkSearchLink3: "::FaSquareArrowUpRight:: Нейро-Боты (Kwork)",
    kworkSearchLink4: "::FaSquareArrowUpRight:: AI Разработка (Kwork)",
    offerTitle: "::FaBullhorn:: Протокол 'Сирена': Создание Убойного Предложения", 
    offerSubtitle: "AI-заряженное послание, превращающее цели в союзников.",
    workflowTitle: "::FaProjectDiagram:: Боевой Порядок: От Сигнала до VIBE-Победы",
    workflowSubtitle: "Скоординированная атака нашего КиберОтряда.",
    workflowStep1: "1. ::FaSearchDollar:: **Саппорт:** Обнаруживает сигнал (лид) на Kwork/др., собирает первичные данные, передает Оракулу для квалификации, готовит целеуказания.",
    workflowStep2: "2. ::FaRobot:: **Саппорт/AI-Оракул:** Генерирует и отправляет персонализированное предложение (возможно, с AI-сгенерированным концептом/макетом).",
    workflowStep3: `3. ::FaComments:: **Клиент:** При положительном ответе – сеанс связи (созвон) или доразведка. ${t_dynamic_links.linkToGamePlan} – стратегическая карта для этих переговоров. Детали стратегии также в ${t_dynamic_links.linkToPPlan}.`,
    workflowStep4: "4. **Развертывание Сил:**",
    workflowStep4Tank: `::FaShieldHalved:: **Танки:** Берут на себя кастомизацию по целеуказаниям Саппорта (ссылки ${t_dynamic_links.linkToRepoXml}). Применяют всю огневую мощь Студии для штурма клиентских задач.`,
    workflowStep4Carry: `::FaBrain:: **Кэрри (Павел):** Работает по ТЗ от Саппорта (GitHub Issues) над созданием новых вооружений и улучшением ядра ${t_dynamic_links.linkToRepoXml}.`,
    workflowStep5: "5. ::FaRocket:: **VIBE-Доставка:** Клиент получает свой AI-форсированный Telegram Web App, собранный с кибернетической скоростью и точностью.",
    workflowStep6: `6. ::FaBolt:: **Анализ Результатов и Адаптация:** <Link href='/repo-xml#cybervibe-section' class='text-brand-cyan hover:underline'>Петля CyberVibe</Link> обеспечивает непрерывную оптимизацию и адаптацию на основе боевого опыта и эволюции ваших технологий.`,
    assetsTitle: "::FaCubes:: Использование Трофейных Активов CyberVibe",
    assetsSubtitle: "Наш внутренний арсенал для внешнего доминирования.",
    assetJumpstartTitle: "Jumpstart Kit: 'Первый Удар'",
    assetJumpstartDesc: `Наш главный таран для прорыва обороны. Предложите AI-сгенерированный каркас TWA на основе идеи клиента. Мгновенная демонстрация мощи и скорости. Подробнее о ${t_dynamic_links.linkToJumpstart}.`,
    assetStudioTitle: "SUPERVIBE Studio: 'Кузница Гефеста'",
    assetStudioDesc: `Основной движок для Танков и Кэрри. Саппорты генерируют гиперссылки-целеуказания в ${t_dynamic_links.linkToRepoXml} для конкретных операций по кастомизации.`,
    assetPhilosophyTitle: "Кодекс SelfDev & Скрижали 'Цель и Прибыль'",
    assetPhilosophyDesc: `Идеологический фундамент. Определяет наш стиль коммуникации, акцентируя внимание на ценности, решении реальных проблем и создании аутентичных продуктов, а не бездушного кода. См. ${t_dynamic_links.linkToSelfDev} и ${t_dynamic_links.linkToPurposeProfit}.`,
    assetPlansTitle: "Гейм План & VIBE План: 'Карты Войны'",
    assetPlansDesc: `Секретные стратегические директивы. Саппорт черпает из них тактические приемы для формирования предложений и построения долгосрочного видения для клиента. Изучи ${t_dynamic_links.linkToGamePlan} и ${t_dynamic_links.linkToPPlan}.`,
    assetTutorialsTitle: "Арсенал Приемов и Тактик (Туториалы)",
    assetTutorialsDesc: `Демонстрируют конкретные боевые возможности (замена медиа, деактивация мин). Можно показывать клиентам для иллюстрации простоты модификаций или использовать для подготовки новобранцев в отряд Танков. Доступны в ${t_dynamic_links.linkToTutorials}.`,
    assetCyberDevOSTitle: "CyberDev OS (Геймификация): 'Путь Воина'",
    assetCyberDevOSDesc: `Демонстрирует философию 'непрерывной прокачки'. Уникальное УБП – клиенты не просто заказывают приложение, они подключаются к саморазвивающейся экосистеме. Вперед, в ${t_dynamic_links.linkToCyberDevOS}!`,
    zionTitle: "::FaComments:: Цитадель 'Зион': Комьюнити-Реактор",
    zionSubtitle: "Ваш Telegram-канал/чат: узел связи КиберОтряда и вербовочный пункт для будущих VIBE-адептов.",
    zionP1: `**Зион (${t_dynamic_links.linkToZion}):** Это не просто флудилка, это ваш оперативный штаб, центр поддержки и инкубатор гениальных идей.`,
    zionList1: "**Координация Танков:** Обсуждение сложных маневров кастомизации, обмен боевым опытом, разработка новых тактик.",
    zionList2: "**Разведсводки от Саппорта:** Саппорт докладывает о ситуации на 'передовой' (общение с лидами), помогая корректировать предложения и выявлять новые потребности рынка.",
    zionList3: "**Прогрев Целей (Мягкая Сила):** Потенциальные клиенты (при стратегическом добавлении) наблюдают за боевой активностью, видят решение проблем и проникаются VIBE-атмосферой.",
    zionList4: "**Школа Молодого Бойца:** Перспективные члены комьюнити, проявившие талант, могут проходить подготовку для зачисления в отряд Танков.",
    ctaTitle: "АКТИВИРОВАТЬ ПРОТОКОЛ 'СЕТЕВОЙ ДОЗОР'!", 
    ctaSubtitle: `Система в боевой готовности. КиберОтряд укомплектован. Саппорты, к оружию! Начинаем сбор кибер-трофеев в этом ${t_dynamic_links.linkToLeads}. Да пребудет с нами VIBE и AI!`,
    ctaButtonText: "::FaBolt:: НАЧАТЬ ШТУРM РЫНКА!", 
    navToRoles: "::FaUserShield:: К Ролям",
    navToArsenal: "::FaTools:: К Арсеналу",
    navToOffer: "::FaBullhorn:: К Офферам", // Ref для offerSectionRef теперь указывает на секцию с полем финального CSV
    navToWorkflow: "::FaProjectDiagram:: К Процессу",
    navToAssets: "::FaCubes:: К Активам",
    navToZion: "::FaComments:: К Зиону",
    navToDashboard: "::FaTableList:: К Дашборду",
  };

  const pageTheme = {
    primaryColor: "text-brand-orange", 
    secondaryColor: "text-brand-yellow", 
    accentColor: "text-brand-cyan",     
    borderColor: "border-brand-orange/50", 
    shadowColor: "shadow-[0_0_25px_rgba(255,108,0,0.5)]", 
    buttonGradient: "bg-gradient-to-r from-brand-orange to-brand-yellow", 
  };

   const kworkSearchLinks = [
    { name: t.kworkSearchLink1, url: "https://kwork.ru/projects?c=all&q=telegram+web+app&keyword=telegram" },
    { name: t.kworkSearchLink2, url: "https://kwork.ru/projects?c=all&q=telegram+mini+app&keyword=telegram" },
    { name: t.kworkSearchLink3, url: "https://kwork.ru/projects?c=all&q=telegram+%D0%B1%D0%BE%D1%82+%D0%BD%D0%B5%D0%B9%D1%80%D0%BE%D1%81%D0%B5%D1%82%D1%8C&keyword=telegram" }, 
    { name: t.kworkSearchLink4, url: "https://kwork.ru/projects?c=all&q=AI+разработка&keyword=AI" },
    { name: "::FaSquareArrowUpRight:: TWA React (Kwork)", url: "https://kwork.ru/projects?c=all&q=TWA+React&keyword=TWA" },
    { name: "::FaSquareArrowUpRight:: Telegram App Next.js (Kwork)", url: "https://kwork.ru/projects?c=all&q=Telegram+App+Next.js&keyword=Telegram" },
    { name: "::FaSquareArrowUpRight:: Миниприложение Telegram (Kwork)", url: "https://kwork.ru/projects?c=all&q=Миниприложение+Telegram&keyword=Telegram" },
    { name: "::FaSquareArrowUpRight:: Разработка WebApp Telegram (Kwork)", url: "https://kwork.ru/projects?c=all&q=Разработка+WebApp+Telegram&keyword=Telegram" },
    { name: "::FaSquareArrowUpRight:: Supabase Telegram (Kwork)", url: "https://kwork.ru/projects?c=all&q=Supabase+Telegram&keyword=Supabase" },
    { name: "::FaSquareArrowUpRight:: AI Telegram Bot (Kwork)", url: "https://kwork.ru/projects?c=all&q=AI+Telegram+Bot&keyword=AI" },
  ];

  const scrollToSection = useCallback((ref: React.RefObject<HTMLDivElement>) => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); // Изменено на 'center' для лучшего позиционирования
    // Добавим небольшую подсветку при скролле для UX
    if (ref.current) {
      ref.current.classList.add('ring-2', 'ring-brand-orange', 'transition-all', 'duration-1000', 'ease-out');
      setTimeout(() => {
        ref.current?.classList.remove('ring-2', 'ring-brand-orange', 'transition-all', 'duration-1000', 'ease-out');
      }, 1500);
    }
  }, []);

  const handleCopyToClipboard = useCallback((textToCopy: string, successMessage: string) => {
    navigator.clipboard.writeText(textToCopy)
      .then(() => toast.success(successMessage, {duration: 2000}))
      .catch(err => toast.error("Ошибка копирования: " + err.message));
  }, []);
  
  const fetchLeadsFromSupabaseCallback = useCallback(async (filter: string) => {
    if (!currentUserId) {
        setLeads([]); 
        return;
    }
    setIsLoading(true);
    const result = await fetchLeadsForDashboard(currentUserId, filter as any);
    if (result.success && result.data) {
        setLeads(result.data);
        if (result.data.length === 0 && filter !== 'all') {
             toast.info(`По фильтру '${filter}' активных лидов не найдено.`, {duration: 2000});
        } else if (result.data.length === 0 && filter === 'all') {
            toast.info("База лидов пуста. Время для 'Сбора трофеев'!", {duration: 3000});
        }
    } else {
        toast.error(result.error || "Ошибка загрузки лидов.");
        setLeads([]);
    }
    setIsLoading(false);
  }, [currentUserId]);

  useEffect(() => {
    fetchLeadsFromSupabaseCallback(currentFilter);
  }, [currentFilter, fetchLeadsFromSupabaseCallback]);

  const handleUploadCsvToSupabase = useCallback(async () => {
    if (!processedCsvForUpload.trim()) {
        toast.error("Нет данных CSV для десантирования. Сначала обработайте 'Поток KWorks'!");
        return;
    }
    if (!currentUserId) {
        toast.error("Ошибка: ID оперативника не определен. Требуется авторизация.");
        return;
    }
    setIsLoading(true);
    toast.info("Идет десантирование лидов в ЦОД... Приготовьтесь к бою!");
    
    const result = await uploadLeadsFromCsv(processedCsvForUpload, currentUserId);

    if (result.success) {
        toast.success(result.message);
        setProcessedCsvForUpload(''); 
        fetchLeadsFromSupabaseCallback(currentFilter); 
    } else {
        toast.error(result.message, { duration: 7000 });
        if (result.errors && result.errors.length > 0) {
            result.errors.forEach(err => toast.warning(`Ошибка в CSV: ${err}`, {duration: 5000}));
        }
    }
    setIsLoading(false);
  }, [processedCsvForUpload, currentUserId, fetchLeadsFromSupabaseCallback, currentFilter]);

  const handleUpdateLeadStatus = useCallback(async (leadId: string, newStatus: string) => {
    if (!leadId || !newStatus || !currentUserId) {
        toast.error("Ошибка: Необходимы ID лида, новый статус и ID оперативника.");
        return;
    }
    setIsLoading(true);
    const result = await updateLeadStatus(leadId, newStatus, currentUserId);
    if (result.success) {
        toast.success(result.message || "Статус лида обновлен. Так держать, боец!");
        fetchLeadsFromSupabaseCallback(currentFilter); 
    } else {
        toast.error(result.message || "Провал операции: не удалось обновить статус лида.");
    }
    setIsLoading(false);
  }, [currentUserId, fetchLeadsFromSupabaseCallback, currentFilter]);

  const handleAssignLeadCallback = useCallback(async (leadId: string, assigneeType: 'tank' | 'carry' | 'support', assigneeId: string | null) => {
    if (!leadId || !assigneeType || !currentUserId) {
        toast.error("Ошибка: Необходимы ID лида, тип и ID оперативника.");
        return;
    }
    setIsLoading(true);
    const result = await assignLead(leadId, assigneeType, assigneeId, currentUserId);
    if (result.success) {
        toast.success(result.message || "Лид назначен/снят с назначения. Вперед, к победе!");
        fetchLeadsFromSupabaseCallback(currentFilter); 
    } else {
        toast.error(result.message || "Ошибка операции: не удалось назначить/снять лид.");
    }
    setIsLoading(false);
  }, [currentUserId, fetchLeadsFromSupabaseCallback, currentFilter]);

  // ЗАГЛУШКА: Загрузка списка членов команды. Реализуй Server Action.
  useEffect(() => {
    const fetchTeam = async () => {
      setTeamMembers([
        { user_id: 'ID_Танка_1', username: 'Танк_Альфа', role: 'tank' },
        { user_id: 'ID_Танка_2', username: 'Танк_Бета', role: 'tank' },
        { user_id: 'ID_Кэрри_1', username: 'Кэрри_Омега (Павел)', role: 'carry' },
        { user_id: 'ID_Саппорта_1', username: 'Саппорт_Гамма', role: 'support' },
      ]);
    };
    fetchTeam();
  }, []);


  return (
    <div className="relative min-h-screen bg-gradient-to-br from-gray-950 via-black to-purple-900/30 text-gray-200 pt-24 pb-20 overflow-x-hidden">
      <div
        className="absolute inset-0 bg-repeat opacity-[0.03] z-0" // Чуть уменьшил грид
        style={{
          backgroundImage: `linear-gradient(to right, hsl(var(--brand-orange-hsl)) 0.5px, transparent 0.5px),
                            linear-gradient(to bottom, hsl(var(--brand-orange-hsl)) 0.5px, transparent 0.5px)`,
          backgroundSize: '40px 40px', 
        }}
      ></div>
      
      {/* Плавающая навигация по странице */}
      <div className="fixed top-[80px] left-2 md:left-4 z-50 flex flex-col space-y-1 bg-black/60 backdrop-blur-sm p-1.5 rounded-lg border border-gray-700/50 max-h-[calc(100vh-100px)] overflow-y-auto simple-scrollbar shadow-xl">
        { [
            { ref: rolesSectionRef, labelKey: 'navToRoles' }, { ref: arsenalSectionRef, labelKey: 'navToArsenal' },
            { ref: offerSectionRef, labelKey: 'navToOffer' }, { ref: workflowSectionRef, labelKey: 'navToWorkflow' },
            { ref: assetsSectionRef, labelKey: 'navToAssets' }, { ref: zionSectionRef, labelKey: 'navToZion' },
            { ref: dashboardSectionRef, labelKey: 'navToDashboard' }
          ].map(item => (
             <Button key={item.labelKey} variant="ghost" size="sm" onClick={() => scrollToSection(item.ref)} className="text-xs text-gray-300 hover:bg-brand-orange/20 hover:text-brand-orange justify-start px-2 py-1 h-auto">
                <VibeContentRenderer content={t[item.labelKey as keyof typeof t]} />
             </Button>
        ))}
      </div>


      <div className="relative z-10 container mx-auto px-4">
        <header className="text-center mb-12 md:mb-16">
          <VibeContentRenderer content={`::FaCrosshairs className="mx-auto text-7xl mb-5 ${pageTheme.primaryColor} animate-ping animation-delay-1000"::`} />
          <h1 className={cn("text-4xl sm:text-5xl md:text-6xl font-orbitron font-bold cyber-text glitch mb-4", pageTheme.primaryColor)} data-text={t.pageTitle}>
            <VibeContentRenderer content={t.pageTitle} />
          </h1>
          <CardDescription className="text-md sm:text-lg md:text-xl text-gray-300 font-mono max-w-3xl mx-auto">
            <VibeContentRenderer content={t.pageSubtitle} />
          </CardDescription>
        </header>

        <div className="space-y-12 md:space-y-16">
          {/* Roles Section */}
          <div ref={rolesSectionRef} id="rolesSectionAnchor">
            <Card className={cn("bg-black/70 backdrop-blur-md border-2", pageTheme.borderColor, pageTheme.shadowColor)}>
              <CardHeader>
                <CardTitle className={cn("text-3xl font-orbitron flex items-center gap-3", pageTheme.primaryColor)}>
                  <VibeContentRenderer content={t.rolesTitle} />
                </CardTitle>
                <CardDescription className="font-mono text-gray-400"><VibeContentRenderer content={rolesSubtitle} /></CardDescription>
              </CardHeader>
              <CardContent className="grid md:grid-cols-3 gap-6 font-mono">
                <div className={cn("p-5 border-2 rounded-xl bg-gray-950/50", pageTheme.borderColor, `hover:${pageTheme.shadowColor} transition-shadow duration-300 transform hover:-translate-y-1`)}>
                  <h3 className={cn("text-2xl font-bold mb-2 flex items-center gap-2", pageTheme.secondaryColor)}><VibeContentRenderer content={t.carryRoleTitle} /></h3>
                  <p className="text-sm text-gray-300 leading-relaxed"><VibeContentRenderer content={carryRoleDesc} /></p>
                </div>
                <div className={cn("p-5 border-2 rounded-xl bg-gray-950/50", pageTheme.borderColor, `hover:${pageTheme.shadowColor} transition-shadow duration-300 transform hover:-translate-y-1`)}>
                  <h3 className={cn("text-2xl font-bold mb-2 flex items-center gap-2", pageTheme.secondaryColor)}><VibeContentRenderer content={t.tanksRoleTitle} /></h3>
                  <p className="text-sm text-gray-300 leading-relaxed"><VibeContentRenderer content={t.tanksRoleDesc} /></p>
                  <p className={cn("text-xs text-gray-400 mt-2 pt-2 border-t", `${pageTheme.borderColor}/30`)}><VibeContentRenderer content={tanksRoleLeverages} /></p>
                </div>
                <div className={cn("p-5 border-2 rounded-xl bg-gray-950/50", pageTheme.borderColor, `hover:${pageTheme.shadowColor} transition-shadow duration-300 transform hover:-translate-y-1`)}>
                  <h3 className={cn("text-2xl font-bold mb-2 flex items-center gap-2", pageTheme.secondaryColor)}><VibeContentRenderer content={t.supportRoleTitle} /></h3>
                  <p className="text-sm text-gray-300 leading-relaxed"><VibeContentRenderer content={t.supportRoleDesc} /></p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Support's Arsenal - Enhanced for Automation */}
          <div ref={arsenalSectionRef} id="arsenalSectionAnchor">
            <Card className={cn("bg-black/70 backdrop-blur-md border-2", pageTheme.borderColor, pageTheme.shadowColor)}>
              <CardHeader>
                <CardTitle className={cn("text-3xl font-orbitron flex items-center gap-3", pageTheme.primaryColor)}>
                  <VibeContentRenderer content={t.supportArsenalTitle} />
                </CardTitle>
                <CardDescription className="font-mono text-gray-400"><VibeContentRenderer content={supportArsenalSubtitle} /></CardDescription>
              </CardHeader>
              <CardContent className="space-y-10 font-mono">
                {/* Kwork Recon & Data Ingestion */}
                <div id="rawKworksInputAnchor"> {/* Якорь для скролла к этому полю */}
                  <h4 className={cn("text-xl font-bold mb-4 flex items-center gap-2", pageTheme.accentColor)}><VibeContentRenderer content={t.rawKworksInputTitle} /></h4>
                  <p className="text-sm text-gray-300 mb-3 pl-2"><VibeContentRenderer content={t.rawKworksInputDesc} /></p>
                  <div className="flex flex-wrap gap-2 mb-4 pl-2">
                      {kworkSearchLinks.map(link => (
                          <Button key={link.name} variant="outline" size="sm" asChild className={cn("text-xs py-1 px-2", pageTheme.borderColor, pageTheme.primaryColor, `hover:${pageTheme.primaryColor}/80 hover:bg-black/20 transform hover:scale-105`)}>
                          <a href={link.url} target="_blank" rel="noopener noreferrer"><VibeContentRenderer content={link.name} /></a>
                          </Button>
                      ))}
                  </div>
                  <Textarea 
                      value={rawKworksInput}
                      onChange={(e) => setRawKworksInput(e.target.value)}
                      placeholder={t.rawKworksInputPlaceholder}
                      rows={10} // Увеличил для удобства
                      className="w-full p-3 border rounded bg-gray-800/70 border-brand-orange/50 text-gray-200 focus:ring-2 focus:ring-brand-orange outline-none placeholder-gray-500 font-mono text-sm scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800 shadow-inner"
                  />
                </div>

                {/* Prompt Generation Buttons */}
                <div>
                  <h4 className={cn("text-xl font-bold mb-4 flex items-center gap-2", pageTheme.accentColor)}><VibeContentRenderer content={t.promptButtonsTitle} /></h4>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4"> {/* Увеличил gap */}
                      <Button 
                          variant="secondary" 
                          onClick={() => {
                              const textToCopy = PROMPT_KWORKS_TO_CSV.replace("{{RAW_KWORKS_TEXT_BLOCK}}", rawKworksInput || "СКОПИРУЙТЕ_СЮДА_ТЕКСТ_С_KWORK");
                              handleCopyToClipboard(textToCopy, "Промпт 'KWorks -> CSV' скопирован! Шаг 1 пройден, оперативник!");
                              // Авто-скролл не нужен здесь, т.к. следующий шаг - использование AI
                          }}
                          disabled={!rawKworksInput.trim()}
                          className="bg-brand-blue/20 text-brand-blue border-brand-blue/50 hover:bg-brand-blue/30 flex items-center justify-center gap-2 py-3 text-xs sm:text-sm transform hover:scale-105"
                      >
                          <VibeContentRenderer content="::FaCopy::" /> <VibeContentRenderer content={t.promptButtonKworksToCsv}/>
                      </Button>
                       <Button 
                          variant="destructive" 
                          onClick={() => {
                              const intergalacticPrompt = PROMPT_INTERGALACTIC_PIPELINE(rawKworksInput || "СЫРЫЕ ДАННЫЕ С KWORK ОТСУТСТВУЮТ. ПРОВЕРЬТЕ ВВОД.");
                              handleCopyToClipboard(intergalacticPrompt, "МЕЖГАЛАКТИЧЕСКИЙ ПРОМПТ СКОПИРОВАН! AI, ГОТОВЬСЯ К ПЕРЕГРУЗКЕ!");
                              if (offerSectionRef.current) { 
                                setTimeout(() => scrollToSection(offerSectionRef), 300);
                              }
                          }}
                          disabled={!rawKworksInput.trim()}
                          className="bg-gradient-to-r from-red-500 via-pink-500 to-purple-600 text-white border-pink-500/50 hover:opacity-90 flex items-center justify-center gap-2 py-3 text-xs sm:text-sm font-bold transform hover:scale-105" 
                      >
                          <VibeContentRenderer content="::FaMeteor:: ВСЁ СРАЗУ В AI!" />
                      </Button>
                      <Button 
                          variant="secondary" 
                          onClick={() => handleCopyToClipboard(PROMPT_OFFER_V2_CYBERVIBE_OUTREACH, "Промпт 'CSV + Оффер' скопирован! Передайте AI вместе с CSV.")}
                          className="bg-brand-purple/20 text-brand-purple border-brand-purple/50 hover:bg-brand-purple/30 flex items-center justify-center gap-2 py-3 text-xs sm:text-sm transform hover:scale-105"
                      >
                          <VibeContentRenderer content="::FaCopy::" /> <VibeContentRenderer content={t.promptButtonCsvToOffer}/>
                      </Button>
                      <Button 
                          variant="secondary" 
                          onClick={() => handleCopyToClipboard(PROMPT_FIND_TWEAKS, "Промпт 'CSV + Твики' скопирован! Передайте AI вместе с CSV.")}
                          className="bg-brand-pink/20 text-brand-pink border-brand-pink/50 hover:bg-brand-pink/30 flex items-center justify-center gap-2 py-3 text-xs sm:text-sm transform hover:scale-105"
                      >
                          <VibeContentRenderer content="::FaCopy::" /> <VibeContentRenderer content={t.promptButtonCsvToTweaks}/>
                      </Button>
                      <Button 
                          variant="secondary" 
                          onClick={() => handleCopyToClipboard(PROMPT_FIND_MISSING_FEATURES, "Промпт 'CSV + Фичи' скопирован! Передайте AI вместе с CSV.")}
                          className="bg-brand-green/20 text-brand-green border-brand-green/50 hover:bg-brand-green/30 flex items-center justify-center gap-2 py-3 text-xs sm:text-sm transform hover:scale-105"
                      >
                          <VibeContentRenderer content="::FaCopy::" /> <VibeContentRenderer content={t.promptButtonCsvToFeatures}/>
                      </Button>
                  </div>
                 <p className="text-xs text-gray-400 mt-3 pl-2"><VibeContentRenderer content={t.promptButtonInstruction}/></p>
              </div>
              
              {/* Upload Processed Leads */}
              <div ref={offerSectionRef} id="finalCsvUploadAnchor"> {/* Якорь и ref */}
                <h4 className={cn("text-xl font-bold mb-4 flex items-center gap-2 pt-6 border-t", pageTheme.accentColor, `${pageTheme.borderColor}/30`)}><VibeContentRenderer content={t.finalCsvInputTitle}/></h4>
                <p className="text-sm text-gray-300 mb-3 pl-2"><VibeContentRenderer content={t.finalCsvInputDesc} /></p>
                <Textarea 
                    value={processedCsvForUpload}
                    onChange={(e) => setProcessedCsvForUpload(e.target.value)}
                    placeholder={t.finalCsvInputPlaceholder}
                    rows={8} // Увеличил для удобства
                    className="w-full p-3 mb-3 border rounded bg-gray-800/70 border-brand-lime/50 text-gray-200 focus:ring-2 focus:ring-brand-lime outline-none placeholder-gray-500 font-mono text-sm scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800 shadow-inner"
                />
                <Button 
                    onClick={handleUploadCsvToSupabase} 
                    disabled={isLoading || !processedCsvForUpload.trim()}
                    className={cn("bg-brand-lime/80 text-black hover:bg-brand-lime flex items-center justify-center gap-2 py-3 text-base transform hover:scale-105", (isLoading || !processedCsvForUpload.trim()) && "opacity-50 cursor-not-allowed")}
                >
                    <VibeContentRenderer content={isLoading ? "::FaSpinner className='animate-spin':: ДЕСАНТИРОВАНИЕ..." : t.uploadLeadsButton}/>
                </Button>
              </div>
            </CardContent>
          </Card>
          </div>
          
          {/* Leads Dashboard */}
          <div ref={dashboardSectionRef} id="dashboardSectionAnchor">
            <Card className={cn("bg-black/70 backdrop-blur-md border-2", pageTheme.borderColor, pageTheme.shadowColor)}>
            <CardHeader>
                <CardTitle className={cn("text-3xl font-orbitron flex items-center gap-3", pageTheme.primaryColor)}>
                    <VibeContentRenderer content={t.leadsDashboardTitle} />
                </CardTitle>
                <CardDescription className="font-mono text-gray-400"><VibeContentRenderer content={t.leadsDashboardDesc} /></CardDescription>
                 <div className="flex flex-wrap gap-2 pt-2">
                    {['all', 'my', 'support', 'tank', 'carry', 'new', 'in_progress', 'interested'].map(filter => ( 
                        <Button
                            key={filter}
                            variant={currentFilter === filter ? "default" : "outline"}
                            size="sm"
                            onClick={() => {
                                setCurrentFilter(filter);
                                fetchLeadsFromSupabaseCallback(filter); 
                            }}
                            className={cn(
                                "text-xs px-3 py-1 transform hover:scale-105",
                                currentFilter === filter 
                                ? `${pageTheme.buttonGradient} text-black shadow-md` 
                                : `${pageTheme.borderColor} ${pageTheme.primaryColor} hover:bg-opacity-20 hover:text-white`
                            )}
                        >
                           {filter === 'all' ? 'Все Лиды' : 
                              filter === 'my' ? 'Мои Задачи' : 
                              filter === 'support' ? 'Задачи Саппорта' :
                              filter === 'tank' ? 'Задачи Танков' :
                              filter === 'carry' ? 'Задачи Кэрри' :
                              filter === 'new' ? '::FaExclamationCircle:: Новые' : // Добавил иконки статусам
                              filter === 'in_progress' ? '::FaHourglassHalf:: В Работе' :
                              filter === 'interested' ? '::FaFire:: Интерес' :
                              filter.charAt(0).toUpperCase() + filter.slice(1)
                           }
                        </Button>
                    ))}
                 </div>
            </CardHeader>
            <CardContent className="font-mono">
                {leads.length === 0 && !isLoading ? (
                    <p className="text-gray-400 text-center py-4">По фильтру '{currentFilter}' кибер-целей не обнаружено. Время для <Button variant="link" onClick={() => scrollToSection(arsenalSectionRef)} className={cn("p-0 h-auto text-base", pageTheme.primaryColor)}>'Сбора трофеев'</Button>!</p>
                ) : isLoading && leads.length === 0 ? (
                    <div className="text-center py-4"><VibeContentRenderer content="::FaSpinner className='animate-spin text-2xl text-brand-orange':: Загрузка данных из ЦОД..." /></div>
                ) : (
                    <div className="overflow-x-auto simple-scrollbar">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-brand-orange uppercase bg-gray-950/70">
                                <tr>
                                    <th scope="col" className="px-3 py-2">Клиент</th>
                                    <th scope="col" className="px-3 py-2 hidden md:table-cell">Проект (суть)</th>
                                    <th scope="col" className="px-3 py-2 hidden lg:table-cell">Бюджет</th>
                                    <th scope="col" className="px-3 py-2">Статус</th>
                                    <th scope="col" className="px-3 py-2">Назначен</th>
                                    <th scope="col" className="px-3 py-2">Действия</th>
                                </tr>
                            </thead>
                            <tbody>
                                {leads.map(lead => (
                                    <tr key={lead.id} className="bg-gray-900/50 border-b border-gray-800 hover:bg-gray-800/70 transition-colors">
                                        <td className="px-3 py-2 font-medium text-gray-200 whitespace-nowrap">
                                            <a href={lead.lead_url || '#'} target="_blank" rel="noopener noreferrer" className="hover:underline text-brand-cyan flex items-center gap-1">
                                                {lead.client_name || 'N/A'} <VibeContentRenderer content="::FaSquareArrowUpRight className='text-2xs'::"/>
                                            </a>
                                            {lead.similarity_score && <span className='block text-xs text-gray-500' title={`Сходство: ${lead.similarity_score}%`}>S: {lead.similarity_score}%</span>}
                                        </td>
                                        <td className="px-3 py-2 text-gray-300 truncate max-w-[200px] md:max-w-xs hidden md:table-cell" title={lead.project_description}>{lead.project_description?.substring(0,70)}...</td>
                                        <td className="px-3 py-2 text-gray-400 hidden lg:table-cell">{lead.budget_range || '-'}</td>
                                        <td className="px-3 py-2">
                                            <select 
                                                value={lead.status} 
                                                onChange={(e) => lead.id && handleUpdateLeadStatus(lead.id, e.target.value)}
                                                disabled={isLoading}
                                                className={cn(
                                                    "bg-gray-700 border border-gray-600 text-gray-200 text-xs rounded-md focus:ring-brand-orange focus:border-brand-orange p-1.5 appearance-none",
                                                    lead.status === 'new' && 'ring-2 ring-yellow-400',
                                                    lead.status === 'in_progress' && 'ring-2 ring-blue-400',
                                                    lead.status === 'interested' && 'ring-2 ring-pink-400',
                                                    lead.status === 'closed_won' && 'bg-green-700/50 ring-2 ring-green-400',
                                                    lead.status === 'closed_lost' && 'bg-red-700/50 ring-2 ring-red-400',
                                                  )}
                                            >
                                                <option value="new">Новый</option>
                                                <option value="raw_data">Сырые</option>
                                                <option value="analyzed">Анализ</option>
                                                <option value="offer_generated">Оффер</option>
                                                <option value="contacted">Контакт</option>
                                                <option value="interested">Интерес</option>
                                                <option value="in_progress">В работе</option>
                                                <option value="closed_won">Успех!</option>
                                                <option value="closed_lost">Провал</option>
                                            </select>
                                        </td>
                                        <td className="px-3 py-2 text-gray-400">
                                          {/* WIP: Выпадающий список для назначения */}
                                          <select
                                            value={lead.assigned_to_tank || lead.assigned_to_carry || lead.assigned_to_support || ''}
                                            onChange={(e) => {
                                                const value = e.target.value;
                                                const [role, id] = value.split(':');
                                                if (lead.id) {
                                                   if (value === "unassign_tank") handleAssignLeadCallback(lead.id, 'tank', null);
                                                   else if (value === "unassign_carry") handleAssignLeadCallback(lead.id, 'carry', null);
                                                   else if (value === "unassign_support") handleAssignLeadCallback(lead.id, 'support', null);
                                                   else if (role && id) handleAssignLeadCallback(lead.id, role as 'tank'|'carry'|'support', id);
                                                }
                                            }}
                                            disabled={isLoading}
                                            className="bg-gray-700 border border-gray-600 text-gray-200 text-xs rounded-md focus:ring-brand-orange focus:border-brand-orange p-1.5 appearance-none"
                                          >
                                            <option value="">Никому</option>
                                            <optgroup label="Танки">
                                                {teamMembers.filter(m => m.role === 'tank').map(tm => <option key={tm.user_id} value={`tank:${tm.user_id}`}>{tm.username || tm.user_id.substring(0,6)}</option>)}
                                                {lead.assigned_to_tank && <option value="unassign_tank" className="text-red-400">Снять Танка</option>}
                                            </optgroup>
                                            <optgroup label="Кэрри">
                                                 {teamMembers.filter(m => m.role === 'carry').map(tm => <option key={tm.user_id} value={`carry:${tm.user_id}`}>{tm.username || tm.user_id.substring(0,6)}</option>)}
                                                 {lead.assigned_to_carry && <option value="unassign_carry" className="text-red-400">Снять Кэрри</option>}
                                            </optgroup>
                                             <optgroup label="Саппорт">
                                                 {teamMembers.filter(m => m.role === 'support').map(tm => <option key={tm.user_id} value={`support:${tm.user_id}`}>{tm.username || tm.user_id.substring(0,6)}</option>)}
                                                 {lead.assigned_to_support && <option value="unassign_support" className="text-red-400">Снять Саппорта</option>}
                                            </optgroup>
                                          </select>
                                        </td>
                                        <td className="px-3 py-2 text-xs space-x-1">
                                            {/* TODO: Модалка с деталями лида, включая сгенерированный оффер, твики, фичи */}
                                            <Button variant="ghost" size="icon" className="text-brand-yellow hover:text-yellow-300 h-7 w-7 p-1" title="Детали Лида (WIP)" disabled={isLoading}><VibeContentRenderer content="::FaCircleInfo::"/></Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </CardContent>
          </Card>
          </div>

          {/* Workflow Section */}
          <div ref={workflowSectionRef}>
            <Card className={cn("bg-black/70 backdrop-blur-md border-2", pageTheme.borderColor, pageTheme.shadowColor)}>
              <CardHeader>
                <CardTitle className={cn("text-3xl font-orbitron flex items-center gap-3", pageTheme.primaryColor)}>
                  <VibeContentRenderer content={t.workflowTitle} />
                </CardTitle>
                <CardDescription className="font-mono text-gray-400"><VibeContentRenderer content={t.workflowSubtitle} /></CardDescription>
              </CardHeader>
              <CardContent className="font-mono text-sm text-gray-300 space-y-4">
                  <VibeContentRenderer content={`1. ${t.workflowStep1}`} />
                  <VibeContentRenderer content={`2. ${t.workflowStep2}`} />
                  <VibeContentRenderer content={`3. ${t.workflowStep3}`} />
                  <div>
                      <VibeContentRenderer content={`4. ${t.workflowStep4}`} />
                      <ul className="list-disc list-inside pl-6 mt-1 space-y-1">
                          <li><VibeContentRenderer content={t.tanksRoleDesc.split(".")[0] + "."} /></li>
                          <li><VibeContentRenderer content={t.carryRoleDesc.split(".")[0] + "."} /></li>
                      </ul>
                  </div>
                  <VibeContentRenderer content={`5. ${t.workflowStep5}`} />
                  <VibeContentRenderer content={`6. ${t.workflowStep6}`} />
              </CardContent>
            </Card>
          </div>

          {/* Assets Section */}
          <div ref={assetsSectionRef}>
             <Card className={cn("bg-black/70 backdrop-blur-md border-2", pageTheme.borderColor, pageTheme.shadowColor)}>
              <CardHeader>
                <CardTitle className={cn("text-3xl font-orbitron flex items-center gap-3", pageTheme.primaryColor)}>
                  <VibeContentRenderer content={t.assetsTitle} />
                </CardTitle>
                <CardDescription className="font-mono text-gray-400"><VibeContentRenderer content={t.assetsSubtitle} /></CardDescription>
              </CardHeader>
              <CardContent className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 font-mono text-sm">
                {[
                  { titleKey: 'assetJumpstartTitle', descKey: 'assetJumpstartDesc', linkKey: 'linkToJumpstart', icon: '::FaRocket::' },
                  { titleKey: 'assetStudioTitle', descKey: 'assetStudioDesc', linkKey: 'linkToRepoXml', icon: '::FaWandMagicSparkles::' },
                  { titleKey: 'assetPhilosophyTitle', descKey: 'assetPhilosophyDesc', linkKey: 'linkToSelfDev', secondaryLinkKey: 'linkToPurposeProfit', icon: '::FaBookOpen::' },
                  { titleKey: 'assetPlansTitle', descKey: 'assetPlansDesc', linkKey: 'linkToGamePlan', secondaryLinkKey: 'linkToPPlan', icon: '::FaClipboardList::' },
                  { titleKey: 'assetTutorialsTitle', descKey: 'assetTutorialsDesc', linkKey: 'linkToTutorials', icon: '::FaGraduationCap::' },
                  { titleKey: 'assetCyberDevOSTitle', descKey: 'assetCyberDevOSDesc', linkKey: 'linkToCyberDevOS', icon: '::FaGamepad::' },
                ].map(asset => (
                  <div key={asset.titleKey} className={cn("p-4 border-2 rounded-xl bg-gray-950/50", pageTheme.borderColor, `hover:${pageTheme.shadowColor} transition-shadow duration-300 transform hover:-translate-y-0.5`)}>
                    <h5 className={cn("font-bold mb-1.5 flex items-center gap-2", pageTheme.accentColor)}>
                      <VibeContentRenderer content={asset.icon} />
                      <VibeContentRenderer content={t[asset.titleKey as keyof typeof t]} />
                    </h5>
                    <div className="text-gray-300 text-xs leading-snug"><VibeContentRenderer content={t[asset.descKey as keyof typeof t]} /></div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Zion Section */}
          <div ref={zionSectionRef}>
            <Card className={cn("bg-black/70 backdrop-blur-md border-2", pageTheme.borderColor, pageTheme.shadowColor)}>
              <CardHeader>
                <CardTitle className={cn("text-3xl font-orbitron flex items-center gap-3", pageTheme.primaryColor)}>
                  <VibeContentRenderer content={t.zionTitle} />
                </CardTitle>
                <CardDescription className="font-mono text-gray-400"><VibeContentRenderer content={t.zionSubtitle} /></CardDescription>
              </CardHeader>
             <CardContent className="font-mono text-sm text-gray-300 space-y-3">
              <p><VibeContentRenderer content={t.zionP1} /></p>
              <ul className="list-disc list-inside pl-4 space-y-2">
                <li><VibeContentRenderer content={t.zionList1} /></li>
                <li><VibeContentRenderer content={t.zionList2} /></li>
                <li><VibeContentRenderer content={t.zionList3} /></li>
                <li><VibeContentRenderer content={t.zionList4} /></li>
              </ul>
            </CardContent>
          </Card>
          </div>
          
          {/* Call to Action */}
          <section className="text-center mt-16 py-10">
            <VibeContentRenderer content={`::FaRocket className="mx-auto text-7xl mb-8 ${pageTheme.primaryColor} animate-bounce"::`} />
            <h2 className={cn("text-4xl md:text-5xl font-orbitron font-bold mb-6 cyber-text glitch", pageTheme.primaryColor)} data-text={t.ctaTitle}>
              <VibeContentRenderer content={t.ctaTitle} />
            </h2>
            <p className="text-xl text-gray-300 font-mono max-w-2xl mx-auto mb-10">
              <VibeContentRenderer content={t.ctaSubtitle} />
            </p>
            <Button 
                size="xl" 
                onClick={() => scrollToSection(arsenalSectionRef)} 
                className={cn("font-orbitron text-xl py-5 px-12 rounded-full text-black font-extrabold shadow-glow-lg hover:scale-105 transform transition duration-300 active:scale-95", pageTheme.buttonGradient, `hover:shadow-[0_0_30px_rgba(255,108,0,0.8)]`)}
            >
              <VibeContentRenderer content={t.ctaButtonText} />
            </Button>
          </section>
        </div>
      </div>
    </div>
  );
};

export default LeadGenerationHQPage;