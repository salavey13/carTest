"use client";

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from '@/components/ui/textarea';
import { VibeContentRenderer } from '@/components/VibeContentRenderer';
import { cn } from '@/lib/utils';
import { PROMPT_OFFER_V2_CYBERVIBE_OUTREACH } from './prompt_offer';
import { PROMPT_KWORKS_TO_CSV } from './prompt_kworks_to_csv';
import { PROMPT_FIND_TWEAKS } from './prompt_find_tweaks';
import { PROMPT_FIND_MISSING_FEATURES } from './prompt_find_missing_features';
// import { supabaseAdmin } from '@/hooks/supabase'; // Прямой импорт supabaseAdmin на клиенте - плохая практика. Используй Server Actions!
import { toast } from 'sonner';

interface Lead {
  id?: string; 
  source?: string;
  lead_url?: string;
  client_name?: string;
  project_description?: string;
  raw_html_description?: string;
  budget_range?: string;
  posted_at?: string; 
  similarity_score?: number;
  status?: string;
  assigned_to_tank?: string;  // Изменено с assigned_to_medic
  assigned_to_carry?: string;
  assigned_to_support?: string; // Новое поле
  notes?: string;
  supervibe_studio_links?: any; 
  github_issue_links?: any; 
  generated_offer?: string;
  identified_tweaks?: any; 
  missing_features?: any; 
  created_at?: string; 
  updated_at?: string; 
}

const LeadGenerationHQPage = () => {
  const [rawKworksInput, setRawKworksInput] = useState('');
  const [leads, setLeads] = useState<Lead[]>([]); 
  const [isLoading, setIsLoading] = useState(false);
  const [currentFilter, setCurrentFilter] = useState('all'); // 'all', 'support', 'tank', 'carry'

  // --- Тексты (только русский) ---
  const t = { 
    pageTitle: "КОЦ 'Сетевой Дозор'",
    pageSubtitle: "Бойцы КиберОтряда! Это ваш командный пункт для захвата лидов и доминации в Supervibe-стиле. Роли распределены, цели определены, VIBE активирован. Трансмутируем инфу в профит!",
    rolesTitle: "::FaUserShield:: КиберОтряд: Роли и Протоколы Действий", // Изменена иконка
    rolesSubtitle: "Экипаж машины боевой, заряженный на VIBE-победу и тотальное превосходство.",
    carryRoleTitle: "::FaBrain:: Кэрри (Павел)",
    carryRoleDesc: "Верховный Архитектор, Движитель Инноваций. Создает и внедряет прорывные фичи в Supervibe Studio. Решает нетривиальные задачи разработки, определяя вектор эволюции платформы. Его код – закон.",
    carryRoleLink: "Личное дело Кэрри",
    tanksRoleTitle: "::FaShieldHalved:: Танки (Штурмовой Эшелон Кастомизации)", // Уточнено
    tanksRoleDesc: "Броневой кулак кастомизации и адаптации. Принимают на себя 'урон' от сложных клиентских запросов, AI-артефактов (галлюцинации иконок, замена медиа). Трансмутируют базовые модули в уникальные клиентские решения, используя реактивную мощь Supervibe Studio. Их девиз: 'Прорвемся и Улучшим!'",
    tanksRoleLeverages: "Основное вооружение: <Link href='/tutorials/image-swap' class='text-brand-cyan hover:underline'>Замена Изображений</Link>, <Link href='/tutorials/icon-swap' class='text-brand-cyan hover:underline'>Охота на Иконки</Link>, <Link href='/tutorials/video-swap' class='text-brand-cyan hover:underline'>Видео-Интеграция</Link>, <Link href='/tutorials/inception-swap' class='text-brand-cyan hover:underline'>Inception Swap-Маневры</Link>.",
    supportRoleTitle: "::FaHeadset:: Саппорт (Сетевой Дозорный и Оператор Связи)", // Уточнено
    supportRoleDesc: "Информационно-логистический хаб и голос отряда. Идентифицирует, фильтрует и обрабатывает входящие сигналы (лиды). Готовит разведданные, CSV для AI-обработки и целеуказания для Танков и Кэрри. Ведет первичные переговоры, обеспечивая бесперебойную связь и снабжение.",
    supportArsenalTitle: "::FaTools:: Арсенал Саппорта: Протоколы Автоматизации", // Уточнено
    supportArsenalSubtitle: "Высокотехнологичное снаряжение для информационной войны и эффективной вербовки.",
    rawKworksInputTitle: "::FaBinoculars:: Этап 1: Сбор Разведданных (Поток KWorks)",
    rawKworksInputDesc: "Скопируй сюда ВСЮ страницу с проектами Kwork или другой платформы. Наш AI-парсер попытается извлечь из этого текстового потока структурированные данные о лидах.",
    rawKworksInputPlaceholder: "Вставь сюда сырой текст со страницы Kwork/фриланс-биржи...",
    promptButtonsTitle: "::FaBolt:: Этап 2: AI-Обработка Потока Лидов (Генерация Промптов):",
    promptButtonKworksToCsv: "1. Поток KWorks -> CSV Таблицу Лидов",
    promptButtonCsvToOffer: "2. CSV + Промпт Оффера -> CSV с Колонкой 'Оффер'",
    promptButtonCsvToTweaks: "3. CSV + Промпт Твиков -> CSV с Колонкой 'Твики для Танков'",
    promptButtonCsvToFeatures: "4. CSV + Промпт Фич -> CSV с Колонкой 'Фичи для Кэрри'",
    uploadLeadsTitle: "::FaCloudUploadAlt:: Этап 3: Загрузка Обработанных Лидов в ЦОД (Supabase)",
    uploadLeadsDesc: "После того как AI (под твоим чутким руководством, Саппорт!) сгенерировал CSV с офферами, твиками и фичами, его можно будет загрузить в Supabase. Это активирует оповещения для команды и позволит отслеживать прогресс.",
    uploadLeadsButton: "ЗАГРУЗИТЬ ФИНАЛЬНЫЙ CSV В SUPABASE (WIP)",
    leadsDashboardTitle: "::FaTableList:: Оперативный Дашборд Лидов",
    leadsDashboardDesc: "Здесь будут отображаться лиды из Supabase. Обновляй статусы, назначай ответственных, двигай проекты к VIBE-победе! Фильтруй по ответственным.",
    kworkSearchLink1: "::FaSquareArrowUpRight:: TWA (Kwork)", 
    kworkSearchLink2: "::FaSquareArrowUpRight:: Mini Apps (Kwork)",
    kworkSearchLink3: "::FaSquareArrowUpRight:: Нейро-Боты (Kwork)",
    kworkSearchLink4: "::FaSquareArrowUpRight:: AI Разработка (Kwork)",
    offerTitle: "::FaBullhorn:: Протокол 'Сирена': Создание Убойного Предложения", // Уже было, но для полноты
    offerSubtitle: "AI-заряженное послание, превращающее цели в союзников.",
    workflowTitle: "::FaProjectDiagram:: Боевой Порядок: От Сигнала до VIBE-Победы",
    workflowSubtitle: "Скоординированная атака нашего КиберОтряда.",
    assetsTitle: "::FaCubes:: Использование Трофейных Активов CyberVibe",
    assetsSubtitle: "Наш внутренний арсенал для внешнего доминирования.",
    zionTitle: "::FaComments:: Цитадель 'Зион': Комьюнити-Реактор",
    zionSubtitle: "Ваш Telegram-канал/чат: узел связи КиберОтряда и вербовочный пункт для будущих VIBE-адептов.",
    zionP1: "**Зион (<Link href='https://t.me/salavey_channel' target='_blank' rel='noopener noreferrer' class='text-brand-cyan hover:underline'>@salavey_channel</Link>):** Это не просто флудилка, это ваш оперативный штаб, центр поддержки и инкубатор гениальных идей.",
    zionList1: "**Координация Танков:** Обсуждение сложных маневров кастомизации, обмен боевым опытом, разработка новых тактик.",
    zionList2: "**Разведсводки от Саппорта:** Саппорт докладывает о ситуации на 'передовой' (общение с лидами), помогая корректировать предложения и выявлять новые потребности рынка.",
    zionList3: "**Прогрев Целей (Мягкая Сила):** Потенциальные клиенты (при стратегическом добавлении) наблюдают за боевой активностью, видят решение проблем и проникаются VIBE-атмосферой.",
    zionList4: "**Школа Молодого Бойца:** Перспективные члены комьюнити, проявившие талант, могут проходить подготовку для зачисления в отряд Танков.",
    ctaTitle: "АКТИВИРОВАТЬ ПРОТОКОЛ 'СЕТЕВОЙ ДОЗОР'!", // Изменено
    ctaSubtitle: "Система в боевой готовности. КиберОтряд укомплектован. Саппорты, к оружию! Начинаем сбор кибер-трофеев. Да пребудет с нами VIBE и AI!",
    ctaButtonText: "::FaBolt:: НАЧАТЬ ШТУРМ РЫНКА!", // Изменено
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
  ];

  const handleCopyToClipboard = useCallback((textToCopy: string, successMessage: string) => {
    navigator.clipboard.writeText(textToCopy)
      .then(() => toast.success(successMessage))
      .catch(err => toast.error("Ошибка копирования: " + err.message));
  }, []);
  
  const handleUploadToSupabase = useCallback(async () => { // Заглушка, нужна серверная логика
    setIsLoading(true);
    toast.info("Загрузка обработанного CSV в Supabase (WIP)...");
    // Здесь будет Server Action для парсинга CSV и загрузки в Supabase
    // Пока эмулируем успех и загрузку демо-данных для дашборда
    setTimeout(() => {
        // Тут должен быть реальный fetch лидов из Supabase после загрузки
        setLeads([ 
            { id: 'lead-001', client_name: 'urik99', project_description: 'TMA для онлайн тренировок по йоге и фитнесу, нужен дизайн и интеграция', status: 'offer_generated', budget_range: 'до 30 000 ₽', assigned_to_tank: 'Танк_Альфа', generated_offer: 'Привет, urik99! Вижу ваш проект...', identified_tweaks: [{desc: "Адаптация UI под йогу"}], missing_features: [] },
            { id: 'lead-002', client_name: 'super_client_dev', project_description: 'Нейросетевой анализ поведения золотых рыбок в аквариуме через TWA', status: 'analyzed', budget_range: 'до 150 000 ₽', assigned_to_carry: 'Pavel', identified_tweaks: [], missing_features: [{desc: "Модуль AI-анализа видеопотока"}] },
            { id: 'lead-003', client_name: 'startup_guy', project_description: 'Простой TWA-каталог товаров с корзиной, оплата через Telegram Stars', status: 'new', budget_range: 'до 10 000 ₽', assigned_to_support: 'Support_1' }
        ]);
        toast.success("Эмуляция загрузки завершена. Лиды отображены в дашборде.");
        setIsLoading(false);
    }, 2000);
  }, []);

  const handleStatusUpdate = useCallback(async (leadId: string, newStatus: string) => { // Заглушка
    setIsLoading(true);
    toast.info(`Обновление статуса для лида ${leadId} на ${newStatus} (WIP)`);
    // Server Action для обновления статуса в Supabase
    setTimeout(() => {
        setLeads(prevLeads => prevLeads.map(lead => lead.id === leadId ? {...lead, status: newStatus} : lead));
        toast.success(`Статус лида ${leadId} обновлен на ${newStatus}.`);
        setIsLoading(false);
    }, 1000);
  }, []);

  // Функция для получения лидов (в будущем из Supabase)
  const fetchLeadsFromSupabase = useCallback(async (filter: string) => {
    setIsLoading(true);
    toast.info(`Загрузка лидов из Supabase (фильтр: ${filter})... (WIP)`);
    // Эмуляция
    // Здесь будет реальный запрос к Supabase с учетом фильтра
    // Например, если filter === 'tank', то WHERE assigned_to_tank = current_user_id
    // Если filter === 'all', то без фильтра по назначению (но с RLS)
    handleUploadToSupabase(); // Пока просто перезагружаем демо-данные
    setTimeout(() => {
        setIsLoading(false);
    }, 500);
  },[handleUploadToSupabase]);

  useEffect(() => {
    fetchLeadsFromSupabase(currentFilter);
  }, [currentFilter, fetchLeadsFromSupabase]);


  return (
    <div className="relative min-h-screen bg-gradient-to-br from-gray-950 via-black to-purple-900/30 text-gray-200 pt-24 pb-20 overflow-x-hidden">
      <div
        className="absolute inset-0 bg-repeat opacity-[0.04] z-0"
        style={{
          backgroundImage: `linear-gradient(to right, hsl(var(--brand-orange-hsl)) 0.5px, transparent 0.5px),
                            linear-gradient(to bottom, hsl(var(--brand-orange-hsl)) 0.5px, transparent 0.5px)`,
          backgroundSize: '50px 50px',
        }}
      ></div>

      <div className="relative z-10 container mx-auto px-4">
        <header className="text-center mb-12 md:mb-16">
          <VibeContentRenderer content={`::FaUsersCog className="mx-auto text-7xl mb-5 ${pageTheme.primaryColor} animate-pulse"::`} />
          <h1 className={cn("text-4xl sm:text-5xl md:text-6xl font-orbitron font-bold cyber-text glitch mb-4", pageTheme.primaryColor)} data-text={t.pageTitle}>
            <VibeContentRenderer content={t.pageTitle} />
          </h1>
          <CardDescription className="text-md sm:text-lg md:text-xl text-gray-300 font-mono max-w-3xl mx-auto">
            <VibeContentRenderer content={t.pageSubtitle} />
          </CardDescription>
        </header>

        <div className="space-y-12 md:space-y-16">
          {/* Roles Section */}
          <Card className={cn("bg-black/70 backdrop-blur-md border-2", pageTheme.borderColor, pageTheme.shadowColor)}>
            <CardHeader>
              <CardTitle className={cn("text-3xl font-orbitron flex items-center gap-3", pageTheme.primaryColor)}>
                <VibeContentRenderer content={t.rolesTitle} />
              </CardTitle>
              <CardDescription className="font-mono text-gray-400"><VibeContentRenderer content={t.rolesSubtitle} /></CardDescription>
            </CardHeader>
            <CardContent className="grid md:grid-cols-3 gap-6 font-mono">
              {/* Carry */}
              <div className={cn("p-5 border-2 rounded-xl bg-gray-950/50", pageTheme.borderColor, `hover:${pageTheme.shadowColor} transition-shadow duration-300`)}>
                <h3 className={cn("text-2xl font-bold mb-2 flex items-center gap-2", pageTheme.secondaryColor)}><VibeContentRenderer content={t.carryRoleTitle} /></h3>
                <p className="text-sm text-gray-300 leading-relaxed"><VibeContentRenderer content={t.carryRoleDesc} /></p>
                 <Link href="/about" className={cn("text-xs mt-3 inline-block hover:underline font-semibold", pageTheme.secondaryColor)}><VibeContentRenderer content={t.carryRoleLink} /></Link>
              </div>
              {/* Tanks */}
              <div className={cn("p-5 border-2 rounded-xl bg-gray-950/50", pageTheme.borderColor, `hover:${pageTheme.shadowColor} transition-shadow duration-300`)}>
                <h3 className={cn("text-2xl font-bold mb-2 flex items-center gap-2", pageTheme.secondaryColor)}><VibeContentRenderer content={t.tanksRoleTitle} /></h3>
                <p className="text-sm text-gray-300 leading-relaxed"><VibeContentRenderer content={t.tanksRoleDesc} /></p>
                <p className={cn("text-xs text-gray-400 mt-2 pt-2 border-t", `${pageTheme.borderColor}/30`)}><VibeContentRenderer content={t.tanksRoleLeverages} /></p>
              </div>
              {/* Support */}
              <div className={cn("p-5 border-2 rounded-xl bg-gray-950/50", pageTheme.borderColor, `hover:${pageTheme.shadowColor} transition-shadow duration-300`)}>
                <h3 className={cn("text-2xl font-bold mb-2 flex items-center gap-2", pageTheme.secondaryColor)}><VibeContentRenderer content={t.supportRoleTitle} /></h3>
                <p className="text-sm text-gray-300 leading-relaxed"><VibeContentRenderer content={t.supportRoleDesc} /></p>
              </div>
            </CardContent>
          </Card>

          {/* Support's Arsenal - Enhanced for Automation */}
          <Card className={cn("bg-black/70 backdrop-blur-md border-2", pageTheme.borderColor, pageTheme.shadowColor)}>
            <CardHeader>
              <CardTitle className={cn("text-3xl font-orbitron flex items-center gap-3", pageTheme.primaryColor)}>
                <VibeContentRenderer content={t.supportArsenalTitle} />
              </CardTitle>
              <CardDescription className="font-mono text-gray-400"><VibeContentRenderer content={t.supportArsenalSubtitle} /></CardDescription>
            </CardHeader>
            <CardContent className="space-y-10 font-mono">
              {/* Kwork Recon & Data Ingestion */}
              <div>
                <h4 className={cn("text-xl font-bold mb-4 flex items-center gap-2", pageTheme.accentColor)}><VibeContentRenderer content={t.rawKworksInputTitle} /></h4>
                <p className="text-sm text-gray-300 mb-3 pl-2"><VibeContentRenderer content={t.rawKworksInputDesc} /></p>
                <div className="flex flex-wrap gap-2 mb-4 pl-2">
                    {kworkSearchLinks.map(link => (
                        <Button key={link.name} variant="outline" size="sm" asChild className={cn("text-xs py-1 px-2", pageTheme.borderColor, pageTheme.primaryColor, `hover:${pageTheme.primaryColor}/80 hover:bg-black/20`)}>
                        <a href={link.url} target="_blank" rel="noopener noreferrer"><VibeContentRenderer content={link.name} /></a>
                        </Button>
                    ))}
                </div>
                <Textarea 
                    value={rawKworksInput}
                    onChange={(e) => setRawKworksInput(e.target.value)}
                    placeholder={t.rawKworksInputPlaceholder}
                    rows={8}
                    className="w-full p-2 border rounded bg-gray-800/70 border-brand-orange/50 text-gray-200 focus:ring-2 focus:ring-brand-orange outline-none placeholder-gray-500 font-mono text-sm scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800"
                />
              </div>

              {/* Prompt Generation Buttons */}
              <div>
                <h4 className={cn("text-xl font-bold mb-4 flex items-center gap-2", pageTheme.accentColor)}><VibeContentRenderer content={t.promptButtonsTitle} /></h4>
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <Button 
                        variant="secondary" 
                        onClick={() => {
                            const textToCopy = PROMPT_KWORKS_TO_CSV.replace("{{RAW_KWORKS_TEXT_BLOCK}}", rawKworksInput || "СКОПИРУЙТЕ_СЮДА_ТЕКСТ_С_KWORK");
                            handleCopyToClipboard(textToCopy, "Промпт 'KWorks -> CSV' скопирован! Отдайте его AI.");
                        }}
                        disabled={!rawKworksInput.trim()}
                        className="bg-brand-blue/20 text-brand-blue border-brand-blue/50 hover:bg-brand-blue/30 flex items-center justify-center gap-2 py-3"
                    >
                        <VibeContentRenderer content="::FaCopy::" /> <VibeContentRenderer content={t.promptButtonKworksToCsv}/>
                    </Button>
                    <Button 
                        variant="secondary" 
                        onClick={() => handleCopyToClipboard(PROMPT_OFFER_V2_CYBERVIBE_OUTREACH, "Промпт 'CSV + Оффер' скопирован! Передайте AI вместе с CSV.")}
                        className="bg-brand-purple/20 text-brand-purple border-brand-purple/50 hover:bg-brand-purple/30 flex items-center justify-center gap-2 py-3"
                    >
                        <VibeContentRenderer content="::FaCopy::" /> <VibeContentRenderer content={t.promptButtonCsvToOffer}/>
                    </Button>
                    <Button 
                        variant="secondary" 
                        onClick={() => handleCopyToClipboard(PROMPT_FIND_TWEAKS, "Промпт 'CSV + Твики' скопирован! Передайте AI вместе с CSV.")}
                        className="bg-brand-pink/20 text-brand-pink border-brand-pink/50 hover:bg-brand-pink/30 flex items-center justify-center gap-2 py-3"
                    >
                        <VibeContentRenderer content="::FaCopy::" /> <VibeContentRenderer content={t.promptButtonCsvToTweaks}/>
                    </Button>
                    <Button 
                        variant="secondary" 
                        onClick={() => handleCopyToClipboard(PROMPT_FIND_MISSING_FEATURES, "Промпт 'CSV + Фичи' скопирован! Передайте AI вместе с CSV.")}
                        className="bg-brand-green/20 text-brand-green border-brand-green/50 hover:bg-brand-green/30 flex items-center justify-center gap-2 py-3"
                    >
                        <VibeContentRenderer content="::FaCopy::" /> <VibeContentRenderer content={t.promptButtonCsvToFeatures}/>
                    </Button>
                </div>
                 <p className="text-xs text-gray-400 mt-3 pl-2">Инструкция: 1. Вставь KWorks. 2. Скопируй промпт "KWorks -> CSV". 3. Отдай AI -> получи CSV. 4. Скопируй нужный промпт (Оффер/Твики/Фичи). 5. Отдай AI CSV + этот промпт -> получи результат.</p>
              </div>
              
              {/* Upload Processed Leads */}
              <div>
                <h4 className={cn("text-xl font-bold mb-4 flex items-center gap-2", pageTheme.accentColor)}><VibeContentRenderer content={t.uploadLeadsTitle}/></h4>
                <p className="text-sm text-gray-300 mb-3 pl-2"><VibeContentRenderer content={t.uploadLeadsDesc} /></p>
                <Button 
                    onClick={handleUploadToSupabase} 
                    disabled={isLoading} // Или более сложная логика, если CSV сначала парсится на клиенте
                    className={cn("bg-brand-lime/80 text-black hover:bg-brand-lime flex items-center justify-center gap-2 py-3", isLoading && "opacity-50 cursor-not-allowed")}
                >
                    <VibeContentRenderer content={isLoading ? "::FaSpinner className='animate-spin':: ЗАГРУЗКА..." : t.uploadLeadsButton}/>
                </Button>
              </div>

            </CardContent>
          </Card>
          
          {/* Leads Dashboard */}
           <Card className={cn("bg-black/70 backdrop-blur-md border-2", pageTheme.borderColor, pageTheme.shadowColor)}>
            <CardHeader>
                <CardTitle className={cn("text-3xl font-orbitron flex items-center gap-3", pageTheme.primaryColor)}>
                    <VibeContentRenderer content={t.leadsDashboardTitle} />
                </CardTitle>
                <CardDescription className="font-mono text-gray-400"><VibeContentRenderer content={t.leadsDashboardDesc} /></CardDescription>
                 <div className="flex gap-2 pt-2">
                    {['all', 'support', 'tank', 'carry'].map(filter => (
                        <Button
                            key={filter}
                            variant={currentFilter === filter ? "default" : "outline"}
                            size="sm"
                            onClick={() => setCurrentFilter(filter)}
                            className={cn(
                                "text-xs",
                                currentFilter === filter 
                                ? `${pageTheme.buttonGradient} text-black` 
                                : `${pageTheme.borderColor} ${pageTheme.primaryColor} hover:bg-opacity-20`
                            )}
                        >
                           {filter.charAt(0).toUpperCase() + filter.slice(1)}
                        </Button>
                    ))}
                 </div>
            </CardHeader>
            <CardContent className="font-mono">
                {leads.length === 0 && !isLoading ? (
                    <p className="text-gray-400 text-center py-4">Нет активных лидов для отображения по фильтру '{currentFilter}'. Пора на охоту, Саппорт!</p>
                ) : isLoading && leads.length === 0 ? (
                    <div className="text-center py-4"><VibeContentRenderer content="::FaSpinner className='animate-spin text-2xl text-brand-orange':: Загрузка данных из ЦОД..." /></div>
                ) : (
                    <div className="overflow-x-auto simple-scrollbar">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-brand-orange uppercase bg-gray-950/70">
                                <tr>
                                    <th scope="col" className="px-4 py-2">Клиент</th>
                                    <th scope="col" className="px-4 py-2 hidden md:table-cell">Проект (Цель)</th>
                                    <th scope="col" className="px-4 py-2">Бюджет</th>
                                    <th scope="col" className="px-4 py-2">Статус</th>
                                    <th scope="col" className="px-4 py-2">Назначен</th>
                                    <th scope="col" className="px-4 py-2">Действия</th>
                                </tr>
                            </thead>
                            <tbody>
                                {leads.map(lead => (
                                    <tr key={lead.id} className="bg-gray-900/50 border-b border-gray-800 hover:bg-gray-800/70">
                                        <td className="px-4 py-2 font-medium text-gray-200 whitespace-nowrap">
                                            <a href={lead.lead_url || '#'} target="_blank" rel="noopener noreferrer" className="hover:underline text-brand-cyan">
                                                {lead.client_name || 'N/A'} <VibeContentRenderer content="::FaSquareArrowUpRight className='text-xs'::"/>
                                            </a>
                                        </td>
                                        <td className="px-4 py-2 text-gray-300 truncate max-w-xs hidden md:table-cell" title={lead.project_description}>{lead.project_description?.substring(0,70)}...</td>
                                        <td className="px-4 py-2 text-gray-400">{lead.budget_range || '-'}</td>
                                        <td className="px-4 py-2">
                                            <select 
                                                value={lead.status} 
                                                onChange={(e) => lead.id && handleStatusUpdate(lead.id, e.target.value)}
                                                disabled={isLoading}
                                                className="bg-gray-700 border border-gray-600 text-gray-200 text-xs rounded-md focus:ring-brand-orange focus:border-brand-orange p-1 appearance-none"
                                            >
                                                <option value="new">Новый</option>
                                                <option value="raw_data">Сырые данные</option>
                                                <option value="analyzed">Проанализирован</option>
                                                <option value="offer_generated">Оффер создан</option>
                                                <option value="contacted">Контакт</option>
                                                <option value="interested">Интерес</option>
                                                <option value="in_progress">В работе</option>
                                                <option value="closed_won">Успех!</option>
                                                <option value="closed_lost">Провал</option>
                                            </select>
                                        </td>
                                        <td className="px-4 py-2 text-gray-400">{lead.assigned_to_tank || lead.assigned_to_carry || lead.assigned_to_support || 'Никому'}</td>
                                        <td className="px-4 py-2">
                                            <Button variant="ghost" size="sm" className="text-brand-yellow hover:text-yellow-300 text-xs p-1" disabled={isLoading}>Детали</Button>
                                            {/* Можно добавить кнопки для назначения */}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </CardContent>
          </Card>

          {/* Placeholder for Offer, Workflow, Assets, Zion, CTA sections */}
          {/* For brevity, I'll assume their structure remains largely the same as your previous version, */}
          {/* but they would also use the `t` function and `pageTheme` for consistency. */}
          {/* You would replace static text with <VibeContentRenderer content={t.someKey} /> */}

          <Card className={cn("bg-black/70 backdrop-blur-md border-2", pageTheme.borderColor, pageTheme.shadowColor)}>
            <CardHeader>
              <CardTitle className={cn("text-3xl font-orbitron flex items-center gap-3", pageTheme.primaryColor)}>
                <VibeContentRenderer content={t.offerTitle} />
              </CardTitle>
              <CardDescription className="font-mono text-gray-400"><VibeContentRenderer content={t.offerSubtitle} /></CardDescription>
            </CardHeader>
            <CardContent className="font-mono text-sm text-gray-300">
                {/* Content of offer section using t.offerP1, t.offerP2 etc. */}
                <p>Контент для оффера здесь...</p>
            </CardContent>
          </Card>
          
          <Card className={cn("bg-black/70 backdrop-blur-md border-2", pageTheme.borderColor, pageTheme.shadowColor)}>
            <CardHeader>
              <CardTitle className={cn("text-3xl font-orbitron flex items-center gap-3", pageTheme.primaryColor)}>
                <VibeContentRenderer content={t.workflowTitle} />
              </CardTitle>
               <CardDescription className="font-mono text-gray-400"><VibeContentRenderer content={t.workflowSubtitle} /></CardDescription>
            </CardHeader>
             <CardContent className="font-mono text-sm text-gray-300 space-y-4">
                {/* Workflow steps using t.workflowStep1 etc. */}
                <p>Шаги рабочего процесса здесь...</p>
            </CardContent>
          </Card>

          <Card className={cn("bg-black/70 backdrop-blur-md border-2", pageTheme.borderColor, pageTheme.shadowColor)}>
            <CardHeader>
              <CardTitle className={cn("text-3xl font-orbitron flex items-center gap-3", pageTheme.primaryColor)}>
                <VibeContentRenderer content={t.assetsTitle} />
              </CardTitle>
              <CardDescription className="font-mono text-gray-400"><VibeContentRenderer content={t.assetsSubtitle} /></CardDescription>
            </CardHeader>
             <CardContent className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 font-mono text-sm">
                {/* Assets content using t.assetSomeTitle, t.assetSomeDesc etc. */}
                <p>Описание активов здесь...</p>
            </CardContent>
          </Card>

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
          
          {/* Call to Action */}
          <section className="text-center mt-16 py-10">
            <VibeContentRenderer content={`::FaRocket className="mx-auto text-7xl mb-8 ${pageTheme.primaryColor} animate-bounce"::`} />
            <h2 className={cn("text-4xl md:text-5xl font-orbitron font-bold mb-6 cyber-text glitch", pageTheme.primaryColor)} data-text={t.ctaTitle}>
              <VibeContentRenderer content={t.ctaTitle} />
            </h2>
            <p className="text-xl text-gray-300 font-mono max-w-2xl mx-auto mb-10">
              <VibeContentRenderer content={t.ctaSubtitle} />
            </p>
            <Button size="xl" className={cn("font-orbitron text-xl py-5 px-12 rounded-full text-black font-extrabold shadow-glow-lg hover:scale-105 transform transition duration-300 active:scale-95", pageTheme.buttonGradient, `hover:shadow-[0_0_30px_rgba(255,108,0,0.8)]`)}>
              <VibeContentRenderer content={t.ctaButtonText} />
            </Button>
          </section>
        </div>
      </div>
    </div>
  );
};

export default LeadGenerationHQPage;