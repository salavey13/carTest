"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react'; // Добавлен useRef
// ... остальные импорты ...
import { PROMPT_INTERGALACTIC_PIPELINE } from './prompt_intergalactic_pipeline'; // Импорт нового промпта

// ... интерфейс Lead ...
// ... interface TeamUser ...

const LeadGenerationHQPage = () => {
  const { user: tgUserContext, dbUser } = useAppContext(); 
  const currentUserId = dbUser?.user_id || tgUserContext?.id?.toString(); 

  const [rawKworksInput, setRawKworksInput] = useState('');
  const [processedCsvForUpload, setProcessedCsvForUpload] = useState(''); 
  const [leads, setLeads] = useState<Lead[]>([]); 
  const [isLoading, setIsLoading] = useState(false);
  const [currentFilter, setCurrentFilter] = useState('all'); 
  // const [teamMembers, setTeamMembers] = useState<TeamUser[]>([]); // Пока закомментируем

  // --- Refs для скролла ---
  const rolesSectionRef = useRef<HTMLDivElement>(null);
  const arsenalSectionRef = useRef<HTMLDivElement>(null);
  const offerSectionRef = useRef<HTMLDivElement>(null);
  const workflowSectionRef = useRef<HTMLDivElement>(null);
  const assetsSectionRef = useRef<HTMLDivElement>(null);
  const zionSectionRef = useRef<HTMLDivElement>(null);
  const dashboardSectionRef = useRef<HTMLDivElement>(null);


  // --- Тексты (только русский) ---
  const t = { 
    // ... (все тексты из предыдущего ответа) ...
    // Добавляем тексты для новых ссылок
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
    // --- Тексты для кнопок навигации по странице ---
    navToRoles: "К Ролям Отряда",
    navToArsenal: "К Арсеналу Саппорта",
    navToOffer: "К Генератору Офферов",
    navToWorkflow: "К Боевому Порядку",
    navToAssets: "К Активам CyberVibe",
    navToZion: "К Цитадели 'Зион'",
    navToDashboard: "К Дашборду Лидов",
  };

  const pageTheme = { /* ... (как в предыдущем ответе) ... */ };
  const kworkSearchLinks = [ /* ... (расширенный список как выше) ... */ ];

  const scrollToSection = useCallback((ref: React.RefObject<HTMLDivElement>) => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const handleCopyToClipboard = useCallback((textToCopy: string, successMessage: string) => {
    navigator.clipboard.writeText(textToCopy)
      .then(() => toast.success(successMessage, {duration: 2000}))
      .catch(err => toast.error("Ошибка копирования: " + err.message));
  }, []);
  
  const handleUploadCsvToSupabase = useCallback(async () => { /* ... (как в предыдущем) ... */ }, [processedCsvForUpload, currentUserId, fetchLeadsFromSupabase, currentFilter]);
  const handleUpdateLeadStatus = useCallback(async (leadId: string, newStatus: string) => { /* ... (как в предыдущем) ... */ }, [currentUserId, fetchLeadsFromSupabase, currentFilter]);
  const handleAssignLead = useCallback(async (leadId: string, assigneeType: 'tank' | 'carry' | 'support', assigneeId: string | null) => { /* ... (как в предыдущем) ... */ }, [currentUserId, fetchLeadsFromSupabase, currentFilter]);
  
  const fetchLeadsFromSupabaseCallback = useCallback(async (filter: string) => {
    if (!currentUserId) {
        setLeads([]); 
        return;
    }
    setIsLoading(true);
    const result = await fetchLeadsForDashboard(currentUserId, filter as any); // Приведение типа, т.к. Server Action ожидает более конкретный тип
    if (result.success && result.data) {
        setLeads(result.data);
        if (result.data.length === 0 && filter !== 'all') { // Не показываем тост для 'all', если пусто
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

  // --- Улучшенные тексты с интерлинками ---
  const rolesSubtitle = `Экипаж машины боевой, заряженный на VIBE-победу и тотальное превосходство. Узнай больше о нашей философии в ${t.linkToSelfDev} и ${t.linkToPurposeProfit}.`;
  const carryRoleDesc = `Верховный Архитектор, Движитель Инноваций. Создает и внедряет прорывные фичи в ${t.linkToRepoXml}. Решает нетривиальные задачи разработки, определяя вектор эволюции платформы. Его код – закон. Смотри ${t.linkToAbout} Кэрри.`;
  const tanksRoleLeverages = `Основное вооружение: ${t.linkToTutorials} (включая Замену Изображений, Охоту на Иконки, Видео-Интеграцию, Inception Swap-Маневры).`;
  const supportArsenalSubtitle = `Высокотехнологичное снаряжение для информационной войны и эффективной вербовки. Геймеры, это для вас – превращаем рутину в квест в нашем ${t.linkToCyberDevOS}!`;
  const phase3Point1 = `**Для Танков (Кастомизация/Адаптация):** Генерировать прямые целеуказания (ссылки ${t.linkToRepoXml}) с параметрами \`path\` (к базовому модулю) и \`idea\` (спецификация клиента). Пример: \`/repo-xml?path=/components/OrderForm.tsx&idea=Добавить опцию 'экспресс-доставка' с калькуляцией\`. Сохранять в \`supervibe_studio_links\` (JSONB).`;
  const offerP2 = `Это предложение всегда должно показывать клиенту **'профит для него здесь и сейчас'** – быстрая проверка гипотез, минимизация рисков, фокус на его уникальной ценности. Философия ${t.linkToJumpstart} – наш козырь.`;
  const workflowStep3 = `3. ::FaComments:: **Клиент:** При положительном ответе – сеанс связи (созвон) или доразведка. ${t.linkToGamePlan} – стратегическая карта для этих переговоров. Детали стратегии также в ${t.linkToPPlan}.`;
  const assetJumpstartDesc = `Наш главный таран для прорыва обороны. Предложите AI-сгенерированный каркас TWA на основе идеи клиента. Мгновенная демонстрация мощи и скорости. Подробнее о ${t.linkToJumpstart}.`;
  const assetStudioDesc = `Основной движок для Танков и Кэрри. Саппорты генерируют гиперссылки-целеуказания в ${t.linkToRepoXml} для конкретных операций по кастомизации.`;
  const ctaSubtitle = `Система в боевой готовности. КиберОтряд укомплектован. Саппорты, к оружию! Начинаем сбор кибер-трофеев в ${t.linkToLeads}. Да пребудет с нами VIBE и AI!`;


  return (
    <div className="relative min-h-screen bg-gradient-to-br from-gray-950 via-black to-purple-900/30 text-gray-200 pt-24 pb-20 overflow-x-hidden">
      {/* ... (фоновый грид) ... */}
      <div className="fixed top-[80px] left-4 z-50 flex flex-col space-y-1 bg-black/50 p-1 rounded-md border border-gray-700 max-h-[calc(100vh-100px)] overflow-y-auto simple-scrollbar">
        {/* Навигационные кнопки по секциям страницы */}
        <Button variant="ghost" size="sm" onClick={() => scrollToSection(rolesSectionRef)} className="text-xs text-gray-300 hover:bg-gray-700 justify-start"><VibeContentRenderer content="::FaUserShield:: Роли"/></Button>
        <Button variant="ghost" size="sm" onClick={() => scrollToSection(arsenalSectionRef)} className="text-xs text-gray-300 hover:bg-gray-700 justify-start"><VibeContentRenderer content="::FaTools:: Арсенал"/></Button>
        <Button variant="ghost" size="sm" onClick={() => scrollToSection(offerSectionRef)} className="text-xs text-gray-300 hover:bg-gray-700 justify-start"><VibeContentRenderer content="::FaBullhorn:: Оффер"/></Button>
        <Button variant="ghost" size="sm" onClick={() => scrollToSection(workflowSectionRef)} className="text-xs text-gray-300 hover:bg-gray-700 justify-start"><VibeContentRenderer content="::FaProjectDiagram:: Процесс"/></Button>
        <Button variant="ghost" size="sm" onClick={() => scrollToSection(assetsSectionRef)} className="text-xs text-gray-300 hover:bg-gray-700 justify-start"><VibeContentRenderer content="::FaCubes:: Активы"/></Button>
        <Button variant="ghost" size="sm" onClick={() => scrollToSection(zionSectionRef)} className="text-xs text-gray-300 hover:bg-gray-700 justify-start"><VibeContentRenderer content="::FaComments:: Зион"/></Button>
        <Button variant="ghost" size="sm" onClick={() => scrollToSection(dashboardSectionRef)} className="text-xs text-gray-300 hover:bg-gray-700 justify-start"><VibeContentRenderer content="::FaTableList:: Дашборд"/></Button>
      </div>

      <div className="relative z-10 container mx-auto px-4">
        <header className="text-center mb-12 md:mb-16">
          <VibeContentRenderer content={`::FaCrosshairs className="mx-auto text-7xl mb-5 ${pageTheme.primaryColor} animate-pulse"::`} /> {/* Заменил иконку */}
          <h1 className={cn("text-4xl sm:text-5xl md:text-6xl font-orbitron font-bold cyber-text glitch mb-4", pageTheme.primaryColor)} data-text={t.pageTitle}>
            <VibeContentRenderer content={t.pageTitle} />
          </h1>
          <CardDescription className="text-md sm:text-lg md:text-xl text-gray-300 font-mono max-w-3xl mx-auto">
            <VibeContentRenderer content={t.pageSubtitle} />
          </CardDescription>
        </header>

        <div className="space-y-12 md:space-y-16">
          {/* Roles Section */}
          <div ref={rolesSectionRef}>
            <Card className={cn("bg-black/70 backdrop-blur-md border-2", pageTheme.borderColor, pageTheme.shadowColor)}>
              <CardHeader>
                <CardTitle className={cn("text-3xl font-orbitron flex items-center gap-3", pageTheme.primaryColor)}>
                  <VibeContentRenderer content={t.rolesTitle} />
                </CardTitle>
                <CardDescription className="font-mono text-gray-400"><VibeContentRenderer content={rolesSubtitle} /></CardDescription>
              </CardHeader>
              <CardContent className="grid md:grid-cols-3 gap-6 font-mono">
                <div className={cn("p-5 border-2 rounded-xl bg-gray-950/50", pageTheme.borderColor, `hover:${pageTheme.shadowColor} transition-shadow duration-300`)}>
                  <h3 className={cn("text-2xl font-bold mb-2 flex items-center gap-2", pageTheme.secondaryColor)}><VibeContentRenderer content={t.carryRoleTitle} /></h3>
                  <p className="text-sm text-gray-300 leading-relaxed"><VibeContentRenderer content={carryRoleDesc} /></p>
                </div>
                <div className={cn("p-5 border-2 rounded-xl bg-gray-950/50", pageTheme.borderColor, `hover:${pageTheme.shadowColor} transition-shadow duration-300`)}>
                  <h3 className={cn("text-2xl font-bold mb-2 flex items-center gap-2", pageTheme.secondaryColor)}><VibeContentRenderer content={t.tanksRoleTitle} /></h3>
                  <p className="text-sm text-gray-300 leading-relaxed"><VibeContentRenderer content={t.tanksRoleDesc} /></p>
                  <p className={cn("text-xs text-gray-400 mt-2 pt-2 border-t", `${pageTheme.borderColor}/30`)}><VibeContentRenderer content={tanksRoleLeverages} /></p>
                </div>
                <div className={cn("p-5 border-2 rounded-xl bg-gray-950/50", pageTheme.borderColor, `hover:${pageTheme.shadowColor} transition-shadow duration-300`)}>
                  <h3 className={cn("text-2xl font-bold mb-2 flex items-center gap-2", pageTheme.secondaryColor)}><VibeContentRenderer content={t.supportRoleTitle} /></h3>
                  <p className="text-sm text-gray-300 leading-relaxed"><VibeContentRenderer content={t.supportRoleDesc} /></p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Support's Arsenal */}
          <div ref={arsenalSectionRef}>
            <Card className={cn("bg-black/70 backdrop-blur-md border-2", pageTheme.borderColor, pageTheme.shadowColor)}>
              <CardHeader>
                <CardTitle className={cn("text-3xl font-orbitron flex items-center gap-3", pageTheme.primaryColor)}>
                  <VibeContentRenderer content={t.supportArsenalTitle} />
                </CardTitle>
                <CardDescription className="font-mono text-gray-400"><VibeContentRenderer content={supportArsenalSubtitle} /></CardDescription>
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
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3"> {/* Изменено на lg:grid-cols-3 */}
                      <Button 
                          variant="secondary" 
                          onClick={() => {
                              const textToCopy = PROMPT_KWORKS_TO_CSV.replace("{{RAW_KWORKS_TEXT_BLOCK}}", rawKworksInput || "СКОПИРУЙТЕ_СЮДА_ТЕКСТ_С_KWORK");
                              handleCopyToClipboard(textToCopy, "Промпт 'KWorks -> CSV' скопирован! Отдайте его AI.");
                              if (arsenalSectionRef.current && offerSectionRef.current) { // Авто-скролл к следующему важному шагу
                                setTimeout(() => scrollToSection(offerSectionRef), 300);
                              }
                          }}
                          disabled={!rawKworksInput.trim()}
                          className="bg-brand-blue/20 text-brand-blue border-brand-blue/50 hover:bg-brand-blue/30 flex items-center justify-center gap-2 py-3 text-xs sm:text-sm"
                      >
                          <VibeContentRenderer content="::FaCopy::" /> <VibeContentRenderer content={t.promptButtonKworksToCsv}/>
                      </Button>
                      {/* Кнопка ВСЁ СРАЗУ */}
                       <Button 
                          variant="destructive" 
                          onClick={() => {
                              const intergalacticPrompt = PROMPT_INTERGALACTIC_PIPELINE(rawKworksInput || "СЫРЫЕ ДАННЫЕ С KWORK ОТСУТСТВУЮТ. ПРОВЕРЬТЕ ВВОД.");
                              handleCopyToClipboard(intergalacticPrompt, "МЕЖГАЛАКТИЧЕСКИЙ ПРОМПТ СКОПИРОВАН! AI, ГОТОВЬСЯ К ПЕРЕГРУЗКЕ!");
                               if (arsenalSectionRef.current && offerSectionRef.current) { 
                                setTimeout(() => scrollToSection(offerSectionRef), 300);
                              }
                          }}
                          disabled={!rawKworksInput.trim()}
                          className="bg-gradient-to-r from-red-500 via-pink-500 to-purple-600 text-white border-pink-500/50 hover:opacity-90 flex items-center justify-center gap-2 py-3 text-xs sm:text-sm font-bold col-span-1 sm:col-span-2 lg:col-span-1" // Адаптация для разных экранов
                      >
                          <VibeContentRenderer content="::FaMeteor:: ВСЁ СРАЗУ В AI!" />
                      </Button>
                      <Button 
                          variant="secondary" 
                          onClick={() => handleCopyToClipboard(PROMPT_OFFER_V2_CYBERVIBE_OUTREACH, "Промпт 'CSV + Оффер' скопирован! Передайте AI вместе с CSV.")}
                          className="bg-brand-purple/20 text-brand-purple border-brand-purple/50 hover:bg-brand-purple/30 flex items-center justify-center gap-2 py-3 text-xs sm:text-sm"
                      >
                          <VibeContentRenderer content="::FaCopy::" /> <VibeContentRenderer content={t.promptButtonCsvToOffer}/>
                      </Button>
                      <Button 
                          variant="secondary" 
                          onClick={() => handleCopyToClipboard(PROMPT_FIND_TWEAKS, "Промпт 'CSV + Твики' скопирован! Передайте AI вместе с CSV.")}
                          className="bg-brand-pink/20 text-brand-pink border-brand-pink/50 hover:bg-brand-pink/30 flex items-center justify-center gap-2 py-3 text-xs sm:text-sm"
                      >
                          <VibeContentRenderer content="::FaCopy::" /> <VibeContentRenderer content={t.promptButtonCsvToTweaks}/>
                      </Button>
                      <Button 
                          variant="secondary" 
                          onClick={() => handleCopyToClipboard(PROMPT_FIND_MISSING_FEATURES, "Промпт 'CSV + Фичи' скопирован! Передайте AI вместе с CSV.")}
                          className="bg-brand-green/20 text-brand-green border-brand-green/50 hover:bg-brand-green/30 flex items-center justify-center gap-2 py-3 text-xs sm:text-sm"
                      >
                          <VibeContentRenderer content="::FaCopy::" /> <VibeContentRenderer content={t.promptButtonCsvToFeatures}/>
                      </Button>
                  </div>
                  <p className="text-xs text-gray-400 mt-3 pl-2"><VibeContentRenderer content={t.promptButtonInstruction}/></p>
                </div>
              
                {/* Upload Processed Leads */}
                <div ref={offerSectionRef}> {/* Используем ref от предыдущей секции как триггер для авто-скролла сюда */}
                  <h4 className={cn("text-xl font-bold mb-4 flex items-center gap-2 pt-6 border-t", pageTheme.accentColor, `${pageTheme.borderColor}/30`)}><VibeContentRenderer content={t.finalCsvInputTitle}/></h4>
                  <p className="text-sm text-gray-300 mb-3 pl-2"><VibeContentRenderer content={t.finalCsvInputDesc} /></p>
                  <Textarea 
                      value={processedCsvForUpload}
                      onChange={(e) => setProcessedCsvForUpload(e.target.value)}
                      placeholder={t.finalCsvInputPlaceholder}
                      rows={5}
                      className="w-full p-2 mb-3 border rounded bg-gray-800/70 border-brand-lime/50 text-gray-200 focus:ring-2 focus:ring-brand-lime outline-none placeholder-gray-500 font-mono text-sm scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800"
                  />
                  <Button 
                      onClick={handleUploadCsvToSupabase} 
                      disabled={isLoading || !processedCsvForUpload.trim()}
                      className={cn("bg-brand-lime/80 text-black hover:bg-brand-lime flex items-center justify-center gap-2 py-3 text-base", (isLoading || !processedCsvForUpload.trim()) && "opacity-50 cursor-not-allowed")}
                  >
                      <VibeContentRenderer content={isLoading ? "::FaSpinner className='animate-spin':: ДЕСАНТИРОВАНИЕ..." : t.uploadLeadsButton}/>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Leads Dashboard */}
          <div ref={dashboardSectionRef}>
            <Card className={cn("bg-black/70 backdrop-blur-md border-2", pageTheme.borderColor, pageTheme.shadowColor)}>
              <CardHeader>
                  <CardTitle className={cn("text-3xl font-orbitron flex items-center gap-3", pageTheme.primaryColor)}>
                      <VibeContentRenderer content={t.leadsDashboardTitle} />
                  </CardTitle>
                  <CardDescription className="font-mono text-gray-400"><VibeContentRenderer content={t.leadsDashboardDesc} /></CardDescription>
                  <div className="flex flex-wrap gap-2 pt-2">
                      {['all', 'my', 'support', 'tank', 'carry', 'new', 'in_progress', 'interested'].map(filter => ( // Добавил 'my'
                          <Button
                              key={filter}
                              variant={currentFilter === filter ? "default" : "outline"}
                              size="sm"
                              onClick={() => {
                                  setCurrentFilter(filter);
                                  // fetchLeadsFromSupabaseCallback(filter); // Можно вызвать сразу или положиться на useEffect
                              }}
                              className={cn(
                                  "text-xs px-3 py-1",
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
                              filter === 'new' ? 'Новые' :
                              filter === 'in_progress' ? 'В Работе' :
                              filter === 'interested' ? 'Интерес' :
                              filter.charAt(0).toUpperCase() + filter.slice(1)
                            }
                          </Button>
                      ))}
                  </div>
              </CardHeader>
              <CardContent className="font-mono">
                  {leads.length === 0 && !isLoading ? (
                      <p className="text-gray-400 text-center py-4">По фильтру '{currentFilter}' активных лидов не найдено. Время для 'Сбора трофеев' в <Link href="#rawKworksInputAnchor" onClick={(e) => {e.preventDefault(); scrollToSection(arsenalSectionRef);}} className="text-brand-orange hover:underline">Арсенале Саппорта</Link>!</p>
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
                                      <th scope="col" className="px-3 py-2">Ответственный</th>
                                      <th scope="col" className="px-3 py-2">Действия</th>
                                  </tr>
                              </thead>
                              <tbody>
                                  {leads.map(lead => (
                                      <tr key={lead.id} className="bg-gray-900/50 border-b border-gray-800 hover:bg-gray-800/70">
                                          <td className="px-3 py-2 font-medium text-gray-200 whitespace-nowrap">
                                              <a href={lead.lead_url || '#'} target="_blank" rel="noopener noreferrer" className="hover:underline text-brand-cyan flex items-center gap-1">
                                                  {lead.client_name || 'N/A'} <VibeContentRenderer content="::FaSquareArrowUpRight className='text-2xs'::"/>
                                              </a>
                                          </td>
                                          <td className="px-3 py-2 text-gray-300 truncate max-w-xs hidden md:table-cell" title={lead.project_description}>{lead.project_description?.substring(0,70)}...</td>
                                          <td className="px-3 py-2 text-gray-400 hidden lg:table-cell">{lead.budget_range || '-'}</td>
                                          <td className="px-3 py-2">
                                              <select 
                                                  value={lead.status} 
                                                  onChange={(e) => lead.id && handleUpdateLeadStatus(lead.id, e.target.value)}
                                                  disabled={isLoading}
                                                  className="bg-gray-700 border border-gray-600 text-gray-200 text-xs rounded-md focus:ring-brand-orange focus:border-brand-orange p-1.5 appearance-none"
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
                                            {lead.assigned_to_tank ? `Танк: ${lead.assigned_to_tank.substring(0,6)}..` : 
                                             lead.assigned_to_carry ? `Кэрри: ${lead.assigned_to_carry.substring(0,6)}..` :
                                             lead.assigned_to_support ? `Саппорт: ${lead.assigned_to_support.substring(0,6)}..` : 
                                             'Никому'}
                                          </td>
                                          <td className="px-3 py-2 text-xs space-x-1">
                                              <Button variant="ghost" size="icon" className="text-brand-yellow hover:text-yellow-300 h-6 w-6" title="Детали (WIP)" disabled={isLoading}><VibeContentRenderer content="::FaInfoCircle::"/></Button>
                                              {/* WIP: Кнопки назначения (можно сделать модалку или выпадающий список с teamMembers) */}
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
                  <VibeContentRenderer content={`3. ${workflowStep3}`} /> {/* Используем улучшенный текст */}
                  <div>
                      <VibeContentRenderer content={`4. ${t.workflowStep4}`} />
                      <ul className="list-disc list-inside pl-6 mt-1 space-y-1">
                          <li><VibeContentRenderer content={t.tanksRoleDesc.split(".")[0] + "."} /></li> {/* Краткое описание из роли */}
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
                  <div key={asset.titleKey} className={cn("p-4 border-2 rounded-xl bg-gray-950/50", pageTheme.borderColor, `hover:${pageTheme.shadowColor} transition-shadow duration-300`)}>
                    <h5 className={cn("font-bold mb-1.5 flex items-center gap-2", pageTheme.accentColor)}>
                      <VibeContentRenderer content={asset.icon} />
                      <VibeContentRenderer content={t[asset.titleKey as keyof typeof t]} />
                    </h5>
                    <p className="text-gray-300 text-xs leading-snug"><VibeContentRenderer content={t[asset.descKey as keyof typeof t].replace('{{LINK}}', t[asset.linkKey as keyof typeof t] || '').replace('{{SECONDARY_LINK}}', asset.secondaryLinkKey ? (t[asset.secondaryLinkKey as keyof typeof t] || '') : '')} /></p>
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
                <p><VibeContentRenderer content={t.zionP1.replace("{{LINK_TO_ZION}}", t.linkToZion)} /></p>
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
              <VibeContentRenderer content={ctaSubtitle} />
            </p>
            <Button 
                size="xl" 
                onClick={() => scrollToSection(arsenalSectionRef)} // Кнопка CTA теперь скроллит к арсеналу саппорта
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