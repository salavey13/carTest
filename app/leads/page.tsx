"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { VibeContentRenderer } from '@/components/VibeContentRenderer';
import { cn } from '@/lib/utils';
import { useAppContext } from '@/contexts/AppContext'; 
import { uploadLeadsFromCsv, updateLeadStatus, assignLead, fetchLeadsForDashboard, updateUserRole } from './actions'; 
import { toast } from 'sonner';
import LeadsPageRightNav from './LeadsPageRightNav';
import SupportArsenal from './SupportArsenal';
import GeneralPurposeScraper from './GeneralPurposeScraper';
import LeadsDashboard from './LeadsDashboard';
import { checkAndUnlockFeatureAchievement } from '@/hooks/cyberFitnessSupabase';
import { useAppToast } from "@/hooks/useAppToast";

interface Lead {
  id?: string; 
  source?: string;
  lead_url?: string;
  client_name?: string | null; 
  project_description?: string;
  raw_html_description?: string | null;
  budget_range?: string | null;
  posted_at?: string | null; 
  similarity_score?: number | null; 
  initial_relevance_score?: number | null;
  project_type_guess?: string | null;
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

interface TeamUser { 
  user_id: string;
  username?: string | null;
  role?: string | null;
}

interface PredefinedSearchButton {
  id: string;
  label: string;
  site: "kwork" | "upwork" | "freelancer" | string; 
  keywords: string;
  siteUrlFormat: string;
  isLikelyWorking?: boolean; 
}

const LeadGenerationHQPage = () => {
  const appContext = useAppContext();
  const { user: tgUserContext, dbUser, refreshDbUser } = appContext;
  const currentUserId = dbUser?.user_id || tgUserContext?.id?.toString(); 
  const { addToast } = useAppToast();

  const [rawKworksInput, setRawKworksInput] = useState('');
  const [processedCsvForUpload, setProcessedCsvForUpload] = useState(''); 
  const [leads, setLeads] = useState<Lead[]>([]); 
  const [isLoading, setIsLoading] = useState(false);
  const [currentFilter, setCurrentFilter] = useState('all'); 
  const [teamMembers, setTeamMembers] = useState<TeamUser[]>([]); 
  const [sectionsCollapsed, setSectionsCollapsed] = useState(true);

  const pageTopRef = useRef<HTMLDivElement>(null);
  const headerSectionRef = useRef<HTMLDivElement>(null);
  const rolesSectionRef = useRef<HTMLDivElement>(null);
  const arsenalSectionRef = useRef<HTMLDivElement>(null);
  const offerSectionRef = useRef<HTMLDivElement>(null); 
  const workflowSectionRef = useRef<HTMLDivElement>(null);
  const assetsSectionRef = useRef<HTMLDivElement>(null);
  const zionSectionRef = useRef<HTMLDivElement>(null);
  const dashboardSectionRef = useRef<HTMLDivElement>(null);
  const scraperSectionRef = useRef<HTMLDivElement>(null);
  const ctaSectionRef = useRef<HTMLDivElement>(null);

  const renderTextWithLinks = useCallback((text: string, links: { [key: string]: { href: string; label: string; className?: string; target?: string; rel?: string } }) => {
    let result: (string | JSX.Element)[] = [text];
    let keyCounter = 0;

    Object.entries(links).forEach(([placeholder, linkProps]) => {
        const regex = new RegExp(placeholder.replace(/([.?*+^$[\]\\(){}|-])/g, "\\$1"), "g");
        const newResult: (string | JSX.Element)[] = [];

        result.forEach(segment => {
            if (typeof segment === 'string') {
                const parts = segment.split(regex);
                parts.forEach((part, index) => {
                    if (part) {
                        newResult.push(part);
                    }
                    if (index < parts.length - 1) {
                        newResult.push(
                            <Link key={`link-${linkProps.href}-${keyCounter++}`} href={linkProps.href} className={linkProps.className} target={linkProps.target} rel={linkProps.rel}>
                                {linkProps.label}
                            </Link>
                        );
                    }
                });
            } else {
                newResult.push(segment);
            }
        });
        result = newResult;
    });

    return result.map((el, idx) => <React.Fragment key={idx}>{el}</React.Fragment>);
  }, []);

  const t_links_config = { 
    "{linkToRepoXml}": { href: "/repo-xml", label: "SUPERVIBE Studio", className: "text-brand-purple hover:underline" },
    "{linkToJumpstart}": { href: "/jumpstart", label: "Jumpstart Kit", className: "text-brand-lime hover:underline" },
    "{linkToSelfDev}": { href: "/selfdev", label: "Кодекс SelfDev", className: "text-brand-green hover:underline" },
    "{linkToPurposeProfit}": { href: "/purpose-profit", label: "скрижали 'Цель и Прибыль'", className: "text-brand-pink hover:underline" },
    "{linkToGamePlan}": { href: "/game-plan", label: "Гейм План", className: "text-brand-blue hover:underline" },
    "{linkToPPlan}": { href: "/p-plan", label: "VIBE План", className: "text-brand-yellow hover:underline" },
    "{linkToTutorials}": { href: "/start-training", label: "Арсенал Приемов и Тактик", className: "text-brand-cyan hover:underline" },
    "{linkToCyberDevOS}": { href: "/selfdev/gamified", label: "CyberDev OS", className: "text-brand-orange hover:underline" },
    "{linkToAboutCarry}": { href: "/about#carry-section", label: "личное дело Кэрри", className: "text-brand-purple hover:underline" }, 
    "{linkToLeads}": { href: "/leads", label: "КОЦ 'Сетевой Дозор'", className: "text-brand-orange hover:underline" },
    "{linkToZion}": { href: "https://t.me/salavey_channel", label: "Цитадель 'Зион' (@salavey_channel)", className: "text-brand-cyan hover:underline", target: "_blank", rel: "noopener noreferrer" },
    "{linkToCyberVibeLoop}": { href: "/repo-xml#cybervibe-section", label: "Петля CyberVibe", className: "text-brand-cyan hover:underline" },
  };
  
  const t = { 
    pageTitle: "КОЦ 'Сетевой Дозор'",
    pageSubtitle: `Бойцы КиберОтряда! Это ваш командный пункт для захвата лидов и доминации в Supervibe-стиле. Роли распределены, цели определены, VIBE активирован. Трансмутируем инфу в профит!`,
    rolesTitle: "::FaShieldCat:: КиберОтряд: Роли и Протоколы Действий",
    rolesSubtitle: `Экипаж машины боевой, заряженный на VIBE-победу и тотальное превосходство. Узнай больше о нашей философии в {linkToSelfDev} и {linkToPurposeProfit}.`,
    carryRoleTitle: "::FaBrain:: Кэрри (SALAVEY13)",
    carryRoleDesc: `Верховный Архитектор, Движитель Инноваций. Создает и внедряет прорывные фичи в {linkToRepoXml}. Решает нетривиальные задачи разработки, определяя вектор эволюции платформы. Его код – закон. Смотри {linkToAboutCarry}.`,
    tanksRoleTitle: `::FaShieldHalved:: Танки (${dbUser?.username || 'Воин Кастомизации'}?)`,
    tanksRoleDesc: "Броневой кулак кастомизации и адаптации. Принимают на себя 'урон' от сложных клиентских запросов, AI-артефактов. Трансмутируют базовые модули в уникальные клиентские решения, используя реактивную мощь Supervibe Studio. Их девиз: 'Прорвемся и Улучшим!'",
    tanksRoleLeverages: `Основное вооружение: {linkToTutorials} (включая Замену Изображений, Охоту на Иконки, Видео-Интеграцию, Inception Swap-Маневры).`,
    supportRoleTitle: `::FaHeadset:: Саппорт (${dbUser?.username || 'Дозорный Сети'}?)`,
    supportRoleDesc: `Информационно-логистический хаб и голос отряда. Идентифицируют, фильтруют и обрабатывают входящие сигналы (лиды). Готовят разведданные, CSV для AI-обработки и целеуказания для Танков и Кэрри. Ведут первичные переговоры, обеспечивая бесперебойную связь и снабжение отряда задачами.`,
    supportArsenalTitle: "::FaToolbox:: Арсенал Саппорта: Протоколы Автоматизации 'Судный День'",
    supportArsenalSubtitle: `Высокотехнологичное снаряжение для информационной войны и эффективной вербовки. Геймеры, это для вас – превращаем рутину в квест в нашем {linkToCyberDevOS}!`,
    rawKworksInputTitle: "::FaBinoculars:: Этап 1: 'Сбор трофеев' (Поток KWorks)",
    rawKworksInputDesc: "Саппорт! Копируй сюда ВСЮ страницу с проектами Kwork или другой биржи. Наш AI-парсер, как верный дрон, извлечет из этого хаоса структурированные данные о лидах. Чем больше данных, тем точнее прицел!",
    rawKworksInputPlaceholder: "Ctrl+A, Ctrl+C со страницы Kwork... и Ctrl+V сюда, оперативник!",
    promptButtonsTitle: "::FaBolt:: Этап 2: 'Нейро-алхимия' (AI-Обработка Лидов):",
    promptButtonKworksToCsv: "1. 'Трансмутация Хаоса': Текст KWorks -> CSV Таблицу Лидов",
    promptButtonCsvToOffer: "2. 'Заряд Убеждения': CSV + Промпт Оффера -> CSV с Колонкой 'Оффер'",
    promptButtonCsvToTweaks: "3. 'Чертежи для Танков': CSV + Промпт Твиков -> CSV с Колонкой 'Твики'",
    promptButtonCsvToFeatures: "4. 'R&D для Кэрри': CSV + Промпт Фич -> CSV с Колонкой 'Новые Фичи'",
    promptButtonInstruction: "Инструкция для Саппорта-Геймера: 1. Заполни поле 'Сбор трофеев'. 2. Жми кнопку 'Трансмутация Хаоса', скопируй промпт. 3. Скармливай AI (ChatGPT/Claude) этот промпт + текст из поля -> получишь CSV-код. 4. Копируй этот CSV-код. 5. Жми кнопки 2, 3, 4 последовательно. Каждый раз копируй промпт и отдавай AI ВМЕСТЕ с ПОСЛЕДНИМ полученным CSV-кодом. AI будет ДОБАВЛЯТЬ новые колонки. Финальный CSV – в поле ниже.",
    finalCsvInputTitle: "::FaFileArrowUp:: Этап 3: 'Десант в ЦОД' (Загрузка Финального CSV)",
    finalCsvInputDesc: "Саппорт, сюда вставляй ПОЛНОСТЬЮ обработанный AI CSV-файл (уже с колонками 'generated_offer', 'identified_tweaks', 'missing_features'). Одна кнопка – и лиды улетают в нашу базу Supabase, а команда получает уведомления!",
    finalCsvInputPlaceholder: "Вставь сюда финальный CSV-код от AI...",
    uploadLeadsButton: "::FaCloudArrowUp:: ДЕСАНТИРОВАТЬ ЛИДЫ В SUPABASE!",
    leadsDashboardTitle: "::FaTableList:: Оперативный Дашборд 'Око Войны'",
    leadsDashboardDesc: "КиберОтряд, здесь ваши цели! Обновляйте статусы, назначайте ответственных, координируйте атаку! Фильтруйте задачи по ролям – каждый видит свой фронт работ.",
    offerTitle: "::FaBullhorn:: Протокол 'Сирена': Создание Убойного Предложения", 
    offerSubtitle: "AI-заряженное послание, превращающее цели в союзников.",
    workflowTitle: "::FaDiagramProject:: Боевой Порядок: От Сигнала до VIBE-Победы",
    workflowSubtitle: "Скоординированная атака нашего КиберОтряда.",
    workflowStep1: "1. ::FaSearchDollar:: **Саппорт:** Обнаруживает сигнал (лид) на Kwork/др., собирает первичные данные, передает Оракулу для квалификации, готовит целеуказания.",
    workflowStep2: "2. ::FaRobot:: **Саппорт/AI-Оракул:** Генерирует и отправляет персонализированное предложение (возможно, с AI-сгенерированным концептом/макетом).",
    workflowStep3: `3. ::FaComments:: **Клиент:** При положительном ответе – сеанс связи (созвон) или доразведка. {linkToGamePlan} – стратегическая карта для этих переговоров. Детали стратегии также в {linkToPPlan}.`,
    workflowStep4: "4. **Развертывание Сил:**",
    workflowStep4Tank: `::FaShieldHalved:: **Танки:** {linkToRepoXml} Берут на себя кастомизацию по целеуказаниям Саппорта. Применяют всю огневую мощь Студии для штурма клиентских задач.`,
    workflowStep4Carry: `::FaBrain:: **Кэрри (SALAVEY13):** {linkToRepoXml} Работает по ТЗ от Саппорта (GitHub Issues) над созданием новых вооружений и улучшением ядра.`,
    workflowStep5: "5. ::FaRocket:: **VIBE-Доставка:** Клиент получает свой AI-форсированный Telegram Web App, собранный с кибернетической скоростью и точностью.",
    workflowStep6: `6. ::FaBolt:: **Анализ Результатов и Адаптация:** {linkToCyberVibeLoop} обеспечивает непрерывную оптимизацию и адаптацию на основе боевого опыта и эволюции ваших технологий.`,
    assetsTitle: "::FaCubes:: Использование Трофейных Активов CyberVibe",
    assetsSubtitle: "Наш внутренний арсенал для внешнего доминирования.",
    assetJumpstartTitle: "Jumpstart Kit: 'Первый Удар'",
    assetJumpstartDesc: `Наш главный таран для прорыва обороны. Предложите AI-сгенерированный каркас TWA на основе идеи клиента. Мгновенная демонстрация мощи и скорости. Подробнее о {linkToJumpstart}.`,
    assetStudioTitle: "SUPERVIBE Studio: 'Кузница Гефеста'",
    assetStudioDesc: `Основной движок для Танков и Кэрри. Саппорты генерируют гиперссылки-целеуказания в {linkToRepoXml} для конкретных операций по кастомизации.`,
    assetPhilosophyTitle: "Кодекс SelfDev & Скрижали 'Цель и Прибыль'",
    assetPhilosophyDesc: `Идеологический фундамент. Определяет наш стиль коммуникации, акцентируя внимание на ценности, решении реальных проблем и создании аутентичных продуктов, а не бездушного кода. См. {linkToSelfDev} и {linkToPurposeProfit}.`,
    assetPlansTitle: "Гейм План & VIBE План: 'Карты Войны'",
    assetPlansDesc: `Секретные стратегические директивы. Саппорт черпает из них тактические приемы для формирования предложений и построения долгосрочного видения для клиента. Изучи {linkToGamePlan} и {linkToPPlan}.`,
    assetTutorialsTitle: "Арсенал Приемов и Тактик (Туториалы)",
    assetTutorialsDesc: `Демонстрируют конкретные боевые возможности (замена медиа, деактивация мин). Можно показывать клиентам для иллюстрации простоты модификаций или использовать для подготовки новобранцев в отряд Танков. Доступны в {linkToTutorials}.`,
    assetCyberDevOSTitle: "CyberDev OS (Геймификация): 'Путь Воина'",
    assetCyberDevOSDesc: `Демонстрирует философию 'непрерывной прокачки'. Уникальное УБП – клиенты не просто заказывают приложение, они подключаются к саморазвивающейся экосистеме. Вперед, в {linkToCyberDevOS}!`,
    zionTitle: "::FaComments:: Цитадель 'Зион': Комьюнити-Реактор",
    zionSubtitle: "Ваш Telegram-канал/чат: узел связи КиберОтряда и вербовочный пункт для будущих VIBE-адептов.",
    zionP1: `**Зион ({linkToZion}):** Это не просто флудилка, это ваш оперативный штаб, центр поддержки и инкубатор гениальных идей.`,
    zionList1: "**Координация Танков:** Обсуждение сложных маневров кастомизации, обмен боевым опытом, разработка новых тактик.",
    zionList2: "**Разведсводки от Саппорта:** Саппорт докладывает о ситуации на 'передовой' (общение с лидами), помогая корректировать предложения и выявлять новые потребности рынка.",
    zionList3: "**Прогрев Целей (Мягкая Сила):** Потенциальные клиенты (при стратегическом добавлении) наблюдают за боевой активностью, видят решение проблем и проникаются VIBE-атмосферой.",
    zionList4: "**Школа Молодого Бойца:** Перспективные члены комьюнити, проявившие талант, могут проходить подготовку для зачисления в отряд Танков.",
    ctaTitle: "АКТИВИРОВАТЬ ПРОТОКОЛ 'СЕТЕВОЙ ДОЗОР'!", 
    ctaSubtitle: `Система в боевой готовности. КиберОтряд укомплектован. Саппорты, к оружию! Начинаем сбор кибер-трофеев в этом {linkToLeads}. Да пребудет с нами VIBE и AI!`,
    ctaButtonText: "::FaBolt:: НАЧАТЬ ШТУРM РЫНКА!", 
    navToTop: "::FaChevronUp:: К Началу",
    navToRoles: "::FaShieldCat:: К Ролям",
    navToArsenal: "::FaToolbox:: К Арсеналу",
    navToOffer: "::FaBullhorn:: К Офферам", 
    navToWorkflow: "::FaDiagramProject:: К Процессу",
    navToAssets: "::FaCubes:: К Активам",
    navToZion: "::FaComments:: К Зиону",
    navToDashboard: "::FaTableList:: К Дашборду",
    navToScraper: "::FaSpider:: К Скрейперу",
    collapseAllSections: "::FaAnglesUp:: Свернуть Инфо-Блоки", 
    expandAllSections: "::FaAnglesDown:: Развернуть Инфо-Блоки", 
  };

  const pageTheme = {
    primaryColor: "text-brand-cyan", 
    secondaryColor: "text-brand-purple", 
    accentColor: "text-brand-lime",     
    borderColor: "border-brand-cyan/60", 
    shadowColor: "shadow-[0_0_15px_hsla(var(--cyan-rgb),0.2),_0_0_8px_hsla(var(--purple-rgb),0.15),_0_0_5px_hsla(var(--lime-rgb),0.1)]", 
    buttonGradient: "bg-gradient-to-r from-brand-cyan to-brand-purple", 
  };

  const predefinedSearchButtons: PredefinedSearchButton[] = [
    { id: "freelancer_twa_dev_highlight", label: "TWA (Freelancer)", site: "freelancer", keywords: "telegram web app", siteUrlFormat: "https://www.freelancer.com/jobs/?keyword={keywords}", isLikelyWorking: true },
    { id: "kwork_twa_app_highlight", label: "TWA App (Kwork)", site: "kwork", keywords: "app", siteUrlFormat: "https://kwork.ru/projects?a=1&keyword={keywords}", isLikelyWorking: true },
    { id: "kwork_twa_next_supabase", label: "TWA Next Supabase (Kwork)", site: "kwork", keywords: "telegram web app next.js supabase", siteUrlFormat: "https://kwork.ru/projects?c=11&keyword={keywords}&a=1" },
    { id: "kwork_mini_app_react", label: "Mini App React (Kwork)", site: "kwork", keywords: "telegram mini app react", siteUrlFormat: "https://kwork.ru/projects?c=11&keyword={keywords}&a=1" },
    { id: "kwork_ai_bot_python", label: "AI Бот Python (Kwork)", site: "kwork", keywords: "телеграм бот нейросеть python", siteUrlFormat: "https://kwork.ru/projects?c=11&keyword={keywords}&a=1" },
    { id: "kwork_admin_panel_next", label: "Админка Next.js (Kwork)", site: "kwork", keywords: "админ панель next.js", siteUrlFormat: "https://kwork.ru/projects?c=11&keyword={keywords}&a=1" },
    { id: "kwork_car_rental_twa", label: "Аренда Авто TWA (Kwork)", site: "kwork", keywords: "twa аренда авто", siteUrlFormat: "https://kwork.ru/projects?c=11&keyword={keywords}&a=1" },
    { id: "kwork_fitness_club_twa", label: "Фитнес TWA (Kwork)", site: "kwork", keywords: "twa фитнес", siteUrlFormat: "https://kwork.ru/projects?c=11&keyword={keywords}&a=1" },
    { id: "kwork_crm_twa", label: "CRM TWA (Kwork)", site: "kwork", keywords: "twa crm", siteUrlFormat: "https://kwork.ru/projects?c=11&keyword={keywords}&a=1" },
    { id: "kwork_marketplace_twa", label: "Маркетплейс TWA (Kwork)", site: "kwork", keywords: "twa маркетплейс", siteUrlFormat: "https://kwork.ru/projects?c=11&keyword={keywords}&a=1" },
    { id: "kwork_booking_twa", label: "Бронирование TWA (Kwork)", site: "kwork", keywords: "twa бронирование", siteUrlFormat: "https://kwork.ru/projects?c=11&keyword={keywords}&a=1" },
    { id: "kwork_parser_supabase", label: "Парсер Supabase (Kwork)", site: "kwork", keywords: "парсер supabase", siteUrlFormat: "https://kwork.ru/projects?c=11&keyword={keywords}&a=1" },
    { id: "upwork_telegram_mini_app", label: "TWA (Upwork)", site: "upwork", keywords: "telegram mini app", siteUrlFormat: "https://www.upwork.com/nx/jobs/search/?q={keywords}" },
];


   const kworkSearchLinks = [ 
    { name: "TWA (Kwork)", url: "https://kwork.ru/projects?c=all&q=telegram+web+app&keyword=telegram", icon: "::FaSquareArrowUpRight::" },
    { name: "Mini Apps (Kwork)", url: "https://kwork.ru/projects?c=all&q=telegram+mini+app&keyword=telegram", icon: "::FaSquareArrowUpRight::" },
    { name: "Нейро-Боты (Kwork)", url: "https://kwork.ru/projects?c=all&q=telegram+%D0%B1%D0%BE%D1%82+%D0%BD%D0%B5%D0%B9%D1%80%D0%BE%D1%81%D0%B5%D1%82%D1%8C&keyword=telegram", icon: "::FaSquareArrowUpRight::" }, 
    { name: "AI Разработка (Kwork)", url: "https://kwork.ru/projects?c=all&q=AI+разработка&keyword=AI", icon: "::FaSquareArrowUpRight::" },
    { name: "TWA React (Kwork)", url: "https://kwork.ru/projects?c=all&q=TWA+React&keyword=TWA", icon: "::FaSquareArrowUpRight::" },
    { name: "Telegram App Next.js (Kwork)", url: "https://kwork.ru/projects?c=all&q=Telegram+App+Next.js&keyword=Telegram", icon: "::FaSquareArrowUpRight::" },
    { name: "Миниприложение Telegram (Kwork)", url: "https://kwork.ru/projects?c=all&q=Миниприложение+Telegram&keyword=Telegram", icon: "::FaSquareArrowUpRight::" },
    { name: "Разработка WebApp Telegram (Kwork)", url: "https://kwork.ru/projects?c=all&q=Разработка+WebApp+Telegram&keyword=Telegram", icon: "::FaSquareArrowUpRight::" },
    { name: "Supabase Telegram (Kwork)", url: "https://kwork.ru/projects?c=all&q=Supabase+Telegram&keyword=Supabase", icon: "::FaSquareArrowUpRight::" },
    { name: "AI Telegram Bot (Kwork)", url: "https://kwork.ru/projects?c=all&q=AI+Telegram+Bot&keyword=AI", icon: "::FaSquareArrowUpRight::" },
  ];

  const scrollToSection = useCallback((ref: React.RefObject<HTMLDivElement>) => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); 
    if (ref.current) {
      ref.current.classList.add('ring-2', 'ring-brand-lime', 'transition-all', 'duration-1000', 'ease-out'); 
      setTimeout(() => {
        ref.current?.classList.remove('ring-2', 'ring-brand-lime', 'transition-all', 'duration-1000', 'ease-out');
      }, 1500);
    }
  }, []);

  const handleCopyToClipboard = useCallback(async (textToCopy: string, successMessage: string, achievementId?: string) => {
    navigator.clipboard.writeText(textToCopy)
      .then(() => {
        toast.success(successMessage, {duration: 2000});
        if (achievementId && dbUser?.user_id) {
          checkAndUnlockFeatureAchievement(dbUser.user_id, achievementId)
            .then(({ newAchievements }) => {
              newAchievements?.forEach(ach => addToast(`🏆 Ачивка: ${ach.name}!`, "success", 5000, { description: ach.description }));
            });
        }
      })
      .catch(err => toast.error("Ошибка копирования: " + err.message));
  }, [dbUser, addToast]);
  
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
    if (!currentUserId || !dbUser?.user_id) {
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
        checkAndUnlockFeatureAchievement(dbUser.user_id, 'leads_first_csv_upload')
            .then(({ newAchievements }) => {
                newAchievements?.forEach(ach => addToast(`🏆 Ачивка: ${ach.name}!`, "success", 5000, { description: ach.description }));
            });
    } else {
        toast.error(result.message, { duration: 7000 });
        if (result.errors && result.errors.length > 0) {
            result.errors.forEach(err => toast.warning(`Ошибка в CSV: ${err}`, {duration: 5000}));
        }
    }
    setIsLoading(false);
  }, [processedCsvForUpload, currentUserId, dbUser, fetchLeadsFromSupabaseCallback, currentFilter, addToast]);

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
        if (assigneeId && dbUser?.user_id) { // Log achievement if lead is assigned (not unassigned)
            checkAndUnlockFeatureAchievement(dbUser.user_id, `lead_assigned_to_${assigneeType}_ever`)
            .then(() => checkAndUnlockFeatureAchievement(dbUser.user_id, 'leads_role_commander')) // Check composite achievement
            .then(({ newAchievements }) => {
                newAchievements?.forEach(ach => addToast(`🏆 Ачивка: ${ach.name}!`, "success", 5000, { description: ach.description }));
            });
        }
    } else {
        toast.error(result.message || "Ошибка операции: не удалось назначить/снять лид.");
    }
    setIsLoading(false);
  }, [currentUserId, dbUser, fetchLeadsFromSupabaseCallback, currentFilter, addToast]);

  useEffect(() => {
    const fetchTeam = async () => {
      setTeamMembers([
        { user_id: 'ID_Танка_1', username: 'Танк_Альфа', role: 'tank' },
        { user_id: 'ID_Танка_2', username: 'Танк_Бета', role: 'tank' },
        { user_id: 'ID_Кэрри_1', username: 'SALAVEY13', role: 'carry' }, 
        { user_id: 'ID_Саппорта_1', username: 'Саппорт_Гамма', role: 'support' },
      ]);
    };
    fetchTeam();
  }, []);

  const toggleAllSections = useCallback(() => {
    setSectionsCollapsed(prev => !prev);
  }, []);

  const rightNavSectionRefs = {
    topRef: pageTopRef,
    rolesRef: rolesSectionRef,
    scraperRef: scraperSectionRef, 
    arsenalRef: arsenalSectionRef,
    dashboardRef: dashboardSectionRef,
    workflowRef: workflowSectionRef,
    assetsRef: assetsSectionRef,
    zionRef: zionSectionRef,
  };
  const rightNavLabels = {
    navToTop: t.navToTop,
    navToRoles: t.navToRoles,
    navToScraper: t.navToScraper,
    navToArsenal: t.navToArsenal,
    navToDashboard: t.navToDashboard,
    navToWorkflow: t.navToWorkflow,
    navToAssets: t.navToAssets,
    navToZion: t.navToZion,
  };

  const handleSuccessfulScrape = useCallback(() => {
    if (dbUser?.user_id) {
      checkAndUnlockFeatureAchievement(dbUser.user_id, 'leads_first_scrape_success')
        .then(({ newAchievements }) => {
          newAchievements?.forEach(ach => addToast(`🏆 Ачивка: ${ach.name}!`, "success", 5000, { description: ach.description }));
        });
    }
  }, [dbUser, addToast]);

  const handleScrapedData = (data: string) => {
    const newDataBlock = `\n\n--- Собрано Скрейпером (${new Date().toLocaleTimeString()}) ---\n${data}`.trim();
    if (!rawKworksInput.includes(data)) { 
        setRawKworksInput(prev => `${prev}${newDataBlock}`);
        toast.info("Собранные данные добавлены в 'Сбор трофеев'.");
    } else {
        toast.info("Эти данные уже были собраны ранее.");
    }
    scrollToSection(arsenalSectionRef); 
  };

  const handleSelfAssignRole = async (newRole: 'tank' | 'support') => {
    if (!currentUserId || !dbUser) {
        toast.error("Ошибка: Пользователь не аутентифицирован.");
        return;
    }
    setIsLoading(true);
    const result = await updateUserRole(currentUserId, newRole, currentUserId);
    setIsLoading(false);

    if (result.success) {
        toast.success(`Вы успешно стали ${newRole === 'tank' ? 'Танком' : 'Саппортом'}! Ваши новые задачи ждут на Дашборде.`);
        if (refreshDbUser) await refreshDbUser(); // Обновляем данные пользователя в контексте
    } else {
        toast.error(result.error || `Не удалось сменить роль на ${newRole}.`);
    }
};


  return (
    <div ref={pageTopRef} className="relative min-h-screen bg-gradient-to-br from-background via-black to-card text-foreground pt-20 sm:pt-24 pb-20 overflow-x-hidden"> {/* Updated background gradient */}
      <div
        className="absolute inset-0 bg-repeat opacity-[0.03] z-0" 
        style={{
          backgroundImage: `linear-gradient(to right, hsla(var(--cyan-rgb), 0.05) 0.5px, transparent 0.5px),
                            linear-gradient(to bottom, hsla(var(--cyan-rgb), 0.05) 0.5px, transparent 0.5px)`, 
          backgroundSize: '40px 40px', // Slightly larger grid
        }}
      ></div>

      <Button
        onClick={toggleAllSections}
        variant="outline"
        size="icon"
        className="fixed top-[calc(var(--header-height,60px)+8px)] sm:top-[calc(var(--header-height,70px)+12px)] left-3 z-50 bg-black/60 hover:bg-brand-cyan/20 hover:text-brand-cyan backdrop-blur-sm text-gray-300 border-border w-9 h-9 sm:w-10 sm:h-10 shadow-lg hover:shadow-cyan-glow/30"
        title={sectionsCollapsed ? t.expandAllSections : t.collapseAllSections}
      >
        <VibeContentRenderer content={sectionsCollapsed ? "::FaAnglesDown className='w-5 h-5'::" : "::FaAnglesUp className='w-5 h-5'::"} />
      </Button>
      
      <LeadsPageRightNav 
        scrollToSection={scrollToSection}
        sectionRefs={rightNavSectionRefs}
        labels={rightNavLabels}
        sectionsCollapsed={sectionsCollapsed}
      />
      
      <div className="relative z-10 container mx-auto px-4 sm:px-6">
        {!sectionsCollapsed && (
          <div ref={headerSectionRef}>
            <header className="text-center mb-10 md:mb-16">
            <VibeContentRenderer content={`::FaCrosshairs className="mx-auto text-5xl sm:text-6xl md:text-7xl mb-4 sm:mb-5 ${pageTheme.primaryColor} animate-ping"::`} />
            <h1 className={cn("text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-orbitron font-bold cyber-text glitch mb-3 sm:mb-4", pageTheme.primaryColor)} data-text={t.pageTitle}>
                <VibeContentRenderer content={t.pageTitle} />
            </h1>
            <CardDescription className="text-sm sm:text-base md:text-lg lg:text-xl text-muted-foreground font-mono max-w-xl sm:max-w-2xl md:max-w-3xl mx-auto">
                {renderTextWithLinks(t.pageSubtitle, t_links_config)}
            </CardDescription>
            </header>
          </div>
        )}

        <div className="space-y-10 md:space-y-16">
          {!sectionsCollapsed && (
            <div ref={rolesSectionRef} id="rolesSectionAnchor">
                <Card className={cn("bg-card/80 backdrop-blur-lg border-2", pageTheme.borderColor, pageTheme.shadowColor)}>
                <CardHeader>
                    <CardTitle className={cn("text-2xl sm:text-3xl font-orbitron flex items-center gap-2 sm:gap-3", pageTheme.primaryColor)}>
                    <VibeContentRenderer content={t.rolesTitle} />
                    </CardTitle>
                    <CardDescription className="font-mono text-xs sm:text-sm text-muted-foreground">{renderTextWithLinks(t.rolesSubtitle, t_links_config)}</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 font-mono">
                    <div className={cn("p-4 sm:p-5 border-2 rounded-xl bg-background/50", pageTheme.borderColor, `hover:${pageTheme.shadowColor} transition-shadow duration-300 transform hover:-translate-y-1`)}>
                      <h3 className={cn("text-xl sm:text-2xl font-orbitron font-bold mb-2 flex items-center gap-2", pageTheme.secondaryColor)}><VibeContentRenderer content={t.carryRoleTitle} /></h3>
                      <p className="text-xs sm:text-sm text-foreground leading-relaxed">{renderTextWithLinks(t.carryRoleDesc, t_links_config)}</p>
                    </div>
                    <div className={cn("p-4 sm:p-5 border-2 rounded-xl bg-background/50", pageTheme.borderColor, `hover:${pageTheme.shadowColor} transition-shadow duration-300 transform hover:-translate-y-1`)}>
                      <h3 className={cn("text-xl sm:text-2xl font-orbitron font-bold mb-2 flex items-center gap-2", pageTheme.secondaryColor)}><VibeContentRenderer content={t.tanksRoleTitle} /></h3>
                      <p className="text-xs sm:text-sm text-foreground leading-relaxed">{renderTextWithLinks(t.tanksRoleDesc, t_links_config)}</p>
                      <p className={cn("text-xs text-muted-foreground mt-2 pt-2 border-t", `${pageTheme.borderColor}/30`)}>{renderTextWithLinks(t.tanksRoleLeverages, t_links_config)}</p>
                      {dbUser && dbUser.role !== 'tank' && (
                        <Button onClick={() => handleSelfAssignRole('tank')} size="sm" className={cn("mt-3 w-full", pageTheme.buttonGradient, "text-black hover:opacity-90")}>Стать Танком!</Button>
                      )}
                    </div>
                    <div className={cn("p-4 sm:p-5 border-2 rounded-xl bg-background/50", pageTheme.borderColor, `hover:${pageTheme.shadowColor} transition-shadow duration-300 transform hover:-translate-y-1`)}>
                      <h3 className={cn("text-xl sm:text-2xl font-orbitron font-bold mb-2 flex items-center gap-2", pageTheme.secondaryColor)}><VibeContentRenderer content={t.supportRoleTitle} /></h3>
                      <p className="text-xs sm:text-sm text-foreground leading-relaxed">{renderTextWithLinks(t.supportRoleDesc, t_links_config)}</p>
                       {dbUser && dbUser.role !== 'support' && (
                        <Button onClick={() => handleSelfAssignRole('support')} size="sm" className={cn("mt-3 w-full", pageTheme.buttonGradient, "text-black hover:opacity-90")}>Стать Саппортом!</Button>
                      )}
                    </div>
                </CardContent>
                </Card>
            </div>
          )}
           <div ref={scraperSectionRef} id="scraperSectionAnchor">
            <GeneralPurposeScraper
              pageTheme={pageTheme}
              predefinedSearchButtons={predefinedSearchButtons}
              onScrapedData={handleScrapedData}
              onSuccessfulScrape={handleSuccessfulScrape}
            />
          </div>

          <div ref={arsenalSectionRef} id="arsenalSectionAnchor">
            <SupportArsenal
              rawKworksInput={rawKworksInput}
              processedCsvForUpload={processedCsvForUpload}
              isLoading={isLoading}
              onRawKworksInputChange={(e) => setRawKworksInput(e.target.value)}
              onProcessedCsvChange={(e) => setProcessedCsvForUpload(e.target.value)}
              onCopyToClipboard={handleCopyToClipboard}
              onUploadCsvToSupabase={handleUploadCsvToSupabase}
              onScrollToSection={scrollToSection}
              kworkSearchLinks={kworkSearchLinks}
              t={t} 
              pageTheme={pageTheme}
              offerSectionRef={offerSectionRef}
            />
          </div>
          
          <div ref={dashboardSectionRef} id="dashboardSectionAnchor">
            <LeadsDashboard
              leads={leads}
              isLoading={isLoading}
              currentFilter={currentFilter}
              teamMembers={teamMembers}
              pageTheme={pageTheme}
              t={t}
              onFilterChange={(filter) => {
                setCurrentFilter(filter);
                fetchLeadsFromSupabaseCallback(filter);
                if (dbUser?.user_id) { // Log filter usage for achievement
                    checkAndUnlockFeatureAchievement(dbUser.user_id, `leads_filter_${filter}_used`)
                        .then(() => checkAndUnlockFeatureAchievement(dbUser.user_id, 'leads_filter_master'))
                        .then(({ newAchievements }) => {
                            newAchievements?.forEach(ach => addToast(`🏆 Ачивка: ${ach.name}!`, "success", 5000, { description: ach.description }));
                        });
                }
              }}
              onUpdateStatus={handleUpdateLeadStatus}
              onAssignLead={handleAssignLeadCallback}
              onScrollToSection={scrollToSection}
              arsenalSectionRef={arsenalSectionRef}
            />
          </div>

          {!sectionsCollapsed && (
            <div ref={workflowSectionRef}>
                <Card className={cn("bg-card/80 backdrop-blur-lg border-2", pageTheme.borderColor, pageTheme.shadowColor)}>
                <CardHeader>
                    <CardTitle className={cn("text-2xl sm:text-3xl font-orbitron flex items-center gap-2 sm:gap-3", pageTheme.primaryColor)}>
                    <VibeContentRenderer content={t.workflowTitle} />
                    </CardTitle>
                    <CardDescription className="font-mono text-xs sm:text-sm text-muted-foreground">{renderTextWithLinks(t.workflowSubtitle,t_links_config)}</CardDescription>
                </CardHeader>
                <CardContent className="font-mono text-xs sm:text-sm text-foreground space-y-3 sm:space-y-4">
                    <p>{renderTextWithLinks(t.workflowStep1, t_links_config)}</p>
                    <p>{renderTextWithLinks(t.workflowStep2, t_links_config)}</p>
                    <p>{renderTextWithLinks(t.workflowStep3, t_links_config)}</p> 
                    <div>
                       <VibeContentRenderer content={t.workflowStep4} /> 
                        <ul className="list-none pl-4 sm:pl-6 mt-1 space-y-1"> 
                            <li>
                                {renderTextWithLinks(t.workflowStep4Tank, t_links_config).map((segment, index) => (
                                    <React.Fragment key={`tank-seg-${index}`}>
                                        {typeof segment === 'string' ? <VibeContentRenderer content={segment} /> : segment}
                                    </React.Fragment>
                                ))}
                            </li>
                           <li>
                               {renderTextWithLinks(t.workflowStep4Carry, t_links_config).map((segment, index) => (
                                    <React.Fragment key={`carry-seg-${index}`}>
                                        {typeof segment === 'string' ? <VibeContentRenderer content={segment} /> : segment}
                                    </React.Fragment>
                                ))}
                           </li>
                        </ul>
                    </div>
                    <p>{renderTextWithLinks(t.workflowStep5, t_links_config)}</p>
                    <p>{renderTextWithLinks(t.workflowStep6, t_links_config)}</p>
                </CardContent>
                </Card>
            </div>
          )}

          {!sectionsCollapsed && (
            <div ref={assetsSectionRef}>
                <Card className={cn("bg-card/80 backdrop-blur-lg border-2", pageTheme.borderColor, pageTheme.shadowColor)}>
                <CardHeader>
                    <CardTitle className={cn("text-2xl sm:text-3xl font-orbitron flex items-center gap-2 sm:gap-3", pageTheme.primaryColor)}>
                    <VibeContentRenderer content={t.assetsTitle} />
                    </CardTitle>
                    <CardDescription className="font-mono text-xs sm:text-sm text-muted-foreground">{renderTextWithLinks(t.assetsSubtitle, t_links_config)}</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5 font-mono text-xs sm:text-sm">
                    {[
                    { titleKey: 'assetJumpstartTitle', descKey: 'assetJumpstartDesc', icon: '::FaRocket::' },
                    { titleKey: 'assetStudioTitle', descKey: 'assetStudioDesc', icon: '::FaWandMagicSparkles::' },
                    { titleKey: 'assetPhilosophyTitle', descKey: 'assetPhilosophyDesc', icon: '::FaBookOpen::' },
                    { titleKey: 'assetPlansTitle', descKey: 'assetPlansDesc', icon: '::FaClipboardList::' },
                    { titleKey: 'assetTutorialsTitle', descKey: 'assetTutorialsDesc', icon: '::FaGraduationCap::' },
                    { titleKey: 'assetCyberDevOSTitle', descKey: 'assetCyberDevOSDesc', icon: '::FaGamepad::' },
                    ].map(asset => (
                    <div key={asset.titleKey} className={cn("p-3 sm:p-4 border-2 rounded-xl bg-background/50", pageTheme.borderColor, `hover:${pageTheme.shadowColor} transition-shadow duration-300 transform hover:-translate-y-0.5`)}>
                        <h5 className={cn("font-orbitron font-bold mb-1 sm:mb-1.5 flex items-center gap-1.5 sm:gap-2", pageTheme.accentColor)}>
                        <VibeContentRenderer content={asset.icon} />
                        <VibeContentRenderer content={t[asset.titleKey as keyof typeof t]} />
                        </h5>
                        <div className="text-foreground text-[0.7rem] sm:text-xs leading-snug">{renderTextWithLinks(t[asset.descKey as keyof typeof t], t_links_config)}</div>
                    </div>
                    ))}
                </CardContent>
                </Card>
            </div>
          )}

          {!sectionsCollapsed && (
            <div ref={zionSectionRef}>
                <Card className={cn("bg-card/80 backdrop-blur-lg border-2", pageTheme.borderColor, pageTheme.shadowColor)}>
                <CardHeader>
                    <CardTitle className={cn("text-2xl sm:text-3xl font-orbitron flex items-center gap-2 sm:gap-3", pageTheme.primaryColor)}>
                    <VibeContentRenderer content={t.zionTitle} />
                    </CardTitle>
                    <CardDescription className="font-mono text-xs sm:text-sm text-muted-foreground">{renderTextWithLinks(t.zionSubtitle, t_links_config)}</CardDescription>
                </CardHeader>
                <CardContent className="font-mono text-xs sm:text-sm text-foreground space-y-2 sm:space-y-3">
                <p>{renderTextWithLinks(t.zionP1, t_links_config)}</p>
                <ul className="list-disc list-inside pl-3 sm:pl-4 space-y-1.5 sm:space-y-2">
                    <li>{renderTextWithLinks(t.zionList1, t_links_config)}</li>
                    <li>{renderTextWithLinks(t.zionList2, t_links_config)}</li>
                    <li>{renderTextWithLinks(t.zionList3, t_links_config)}</li>
                    <li>{renderTextWithLinks(t.zionList4, t_links_config)}</li>
                </ul>
                </CardContent>
            </Card>
            </div>
          )}
          
          {!sectionsCollapsed && (
            <section ref={ctaSectionRef} className="text-center mt-12 sm:mt-16 py-8 sm:py-10">
                <VibeContentRenderer content={`::FaRocket className="mx-auto text-5xl sm:text-7xl mb-6 sm:mb-8 ${pageTheme.primaryColor} animate-bounce"::`} />
                <h2 className={cn("text-3xl sm:text-4xl md:text-5xl font-orbitron font-bold mb-4 sm:mb-6 cyber-text glitch", pageTheme.primaryColor)} data-text={t.ctaTitle}>
                <VibeContentRenderer content={t.ctaTitle} />
                </h2>
                <p className="text-lg sm:text-xl text-muted-foreground font-mono max-w-md sm:max-w-2xl mx-auto mb-8 sm:mb-10">
                {renderTextWithLinks(t.ctaSubtitle, t_links_config)}
                </p>
                <Button 
                    size="lg" 
                    onClick={() => scrollToSection(arsenalSectionRef)} 
                    className={cn("font-orbitron text-lg sm:text-xl py-3.5 sm:py-5 px-8 sm:px-12 rounded-full text-black font-extrabold shadow-glow-lg hover:scale-105 transform transition duration-300 active:scale-95", pageTheme.buttonGradient, `hover:shadow-[0_0_30px_rgba(var(--cyan-rgb),0.5),_0_0_15px_rgba(var(--purple-rgb),0.4)]`)} 
                >
                <VibeContentRenderer content={t.ctaButtonText} />
                </Button>
            </section>
          )}
        </div>
      </div>
    </div>
  );
};

export default LeadGenerationHQPage;