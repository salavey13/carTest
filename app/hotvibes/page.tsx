"use client";

import React, { useState, useEffect, Suspense, useCallback, useId } from 'react';
import { useRouter, useSearchParams as useNextSearchParamsHook } from 'next/navigation'; // Переименовал импорт
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { VibeContentRenderer } from "@/components/VibeContentRenderer";
import { cn } from "@/lib/utils";
import TutorialLoader from '../tutorials/TutorialLoader';
import RockstarHeroSection from '../tutorials/RockstarHeroSection';
import { useAppContext } from '@/contexts/AppContext';
import {
  fetchUserCyberFitnessProfile,
  CyberFitnessProfile,
  QUEST_ORDER,
  isQuestUnlocked as checkQuestUnlocked,
  markTutorialAsCompleted,
} from '@/hooks/cyberFitnessSupabase';
import { fetchLeadsForDashboard } from '../leads/actions'; // Предполагаем, что эта функция может искать и по client_nickname, если нужно
import type { LeadRow as LeadDataFromActions } from '../leads/actions';
import { HotVibeCard, HotLeadData, HotVibeCardTheme } from '@/components/hotvibes/HotVibeCard';
import { VipLeadDisplay } from '@/components/hotvibes/VipLeadDisplay'; // Новый компонент для VIP-показа
import { debugLogger as logger } from "@/lib/debugLogger";
import { useAppToast } from '@/hooks/useAppToast';

const pageTranslations = { /* ... как было ... */ };

function mapLeadToHotLeadData(lead: LeadDataFromActions): HotLeadData {
  const demoImageUrl = (lead.supervibe_studio_links as any)?.demo_image_url || 
                       (lead.supervibe_studio_links as any)?.client_avatar_url || // Добавил еще один возможный источник
                       lead.client_avatar_url; // Если есть в таблице leads

  return {
    id: lead.id || `fallback_id_${Math.random()}`,
    kwork_gig_title: lead.client_name || lead.project_description?.substring(0, 50) || "Untitled Gig",
    ai_summary: lead.project_description?.substring(0, 150) || "Краткое описание задачи от AI...", // Увеличил длину summary
    demo_image_url: demoImageUrl,
    potential_earning: lead.budget_range || undefined,
    required_quest_id: (lead as any).required_quest_id_for_hotvibe || "image-swap-mission",
    client_response_snippet: lead.status === 'interested' || lead.status === 'client_responded_positive' ? "Клиент проявил интерес!" : 
                             lead.status === 'new_ai_generated' ? "AI сгенерировал прототип!" : undefined,
    kwork_url: lead.lead_url,
    project_description: lead.project_description,
    ai_generated_proposal_draft: lead.generated_offer,
    status: lead.status,
    project_type_guess: lead.project_type_guess,
    client_name: lead.client_name, // Явно передаем client_name, если он есть
  };
}

function HotVibesContentInternal() { // Переименовал, чтобы избежать путаницы с экспортом по умолчанию
  const router = useRouter();
  const searchParams = useNextSearchParamsHook(); // Используем переименованный импорт
  const { dbUser, isAuthenticated, user: tgUser, isLoading: appCtxLoading, isAuthenticating, platform, startParamPayload } = useAppContext();
  const { addToast } = useAppToast();
  const heroTriggerId = useId().replace(/:/g, "-") + "-hotvibes-hero-trigger";
  const [currentLang, setCurrentLang] = useState<'ru' | 'en'>('ru');

  const [cyberProfile, setCyberProfile] = useState<CyberFitnessProfile | null>(null);
  const [allLeads, setAllLeads] = useState<HotLeadData[]>([]); // Храним все загруженные лиды
  const [vipLeadToShow, setVipLeadToShow] = useState<HotLeadData | null>(null);
  const [lobbyLeads, setLobbyLeads] = useState<HotLeadData[]>([]); // Лиды для обычного лобби
  const [pageLoading, setPageLoading] = useState(true);
  const [processedLeadIdentifier, setProcessedLeadIdentifier] = useState<string | null>(null);


  const t = pageTranslations[currentLang];

  useEffect(() => {
    setCurrentLang(tgUser?.language_code === 'ru' || platform === 'ios' || platform === 'android' ? 'ru' : 'en');
  }, [tgUser?.language_code, platform]);

  const loadPageData = useCallback(async (leadIdentifierFromParam: string | null) => {
    if (appCtxLoading || isAuthenticating) {
      logger.debug("[HotVibes] AppContext still loading/authenticating. Waiting.");
      setPageLoading(true); return;
    }
    setPageLoading(true);
    logger.info(`[HotVibes] loadPageData called. Authenticated: ${isAuthenticated}, DB User ID: ${dbUser?.user_id}, leadIdentifierFromParam: ${leadIdentifierFromParam}`);

    let currentProfile: CyberFitnessProfile | null = null;
    if (isAuthenticated && dbUser?.user_id) {
      const profileResult = await fetchUserCyberFitnessProfile(dbUser.user_id);
      if (profileResult.success && profileResult.data) {
        currentProfile = profileResult.data;
        setCyberProfile(currentProfile);
        logger.info(`[HotVibes] Profile loaded for ${dbUser.user_id}. Level: ${currentProfile.level}`);
      } else {
        addToast(t.errorLoadingProfile, "error");
        logger.error(`[HotVibes] Error fetching profile: ${profileResult.error}`);
      }
    }

    // Загружаем ВСЕ лиды, которые могут быть показаны (например, для админа/саппорта)
    // или только релевантные, если это обычный пользователь
    const leadsResult = await fetchLeadsForDashboard(dbUser?.user_id || "guest", 'all'); // 'guest' или специфичный ID
    let mappedLeads: HotLeadData[] = [];
    if (leadsResult.success && leadsResult.data) {
      mappedLeads = (leadsResult.data as LeadDataFromActions[]).map(mapLeadToHotLeadData);
      setAllLeads(mappedLeads); // Сохраняем все смапленные лиды
      logger.info(`[HotVibes] Fetched and mapped ${mappedLeads.length} total leads.`);
    } else {
      addToast(t.errorLoadingLeads, "error");
      logger.error(`[HotVibes] Error fetching leads: ${leadsResult.error}`);
    }

    if (leadIdentifierFromParam) {
      const foundVipLead = mappedLeads.find(
        (l) => (l.id === leadIdentifierFromParam) || // Поиск по ID, если startapp это ID
               (l.client_name && l.client_name.toLowerCase() === leadIdentifierFromParam.toLowerCase()) || // Поиск по client_name
               (l.kwork_gig_title && l.kwork_gig_title.toLowerCase().includes(leadIdentifierFromParam.toLowerCase())) // Поиск по части заголовка
      );
      if (foundVipLead) {
        setVipLeadToShow(foundVipLead);
        setLobbyLeads([]); // Не показываем лобби, если есть VIP
        addToast(`Демонстрация VIP VIBE для: ${foundVipLead.kwork_gig_title || foundVipLead.client_name}`, "success");
        logger.info(`[HotVibes] VIP Lead found and set: ${foundVipLead.id}`);
        // Очищаем параметр из URL после использования, чтобы F5 не показывал VIP снова
        // router.replace('/hotvibes', { shallow: true }); // Используем shallow routing
      } else {
        addToast(`HotVibe с идентификатором "${leadIdentifierFromParam}" не найден. Показываю общее лобби.`, "warning");
        setVipLeadToShow(null);
        // Показываем обычное лобби, отфильтрованное по правам
        setLobbyLeads(mappedLeads.filter(mLead => currentProfile ? (mLead.required_quest_id ? checkQuestUnlocked(mLead.required_quest_id, currentProfile.completedQuests || [], QUEST_ORDER) : true) : false));
      }
    } else {
      setVipLeadToShow(null);
      // Обычная загрузка для лобби
       setLobbyLeads(mappedLeads.filter(mLead => currentProfile ? (mLead.required_quest_id ? checkQuestUnlocked(mLead.required_quest_id, currentProfile.completedQuests || [], QUEST_ORDER) : true) : (isAuthenticated ? false : true) )); // Показываем все гостю или фильтруем для авторизованного
    }
    setPageLoading(false);
  }, [isAuthenticated, dbUser?.user_id, appCtxLoading, isAuthenticating, addToast, t.errorLoadingLeads, t.errorLoadingProfile, router]);

  useEffect(() => {
    const leadIdFromQuery = searchParams.get('lead_identifier');
    // Загружаем данные только если изменился leadIdFromQuery или если startParamPayload был, но уже обработан
    if (leadIdFromQuery && leadIdFromQuery !== processedLeadIdentifier) {
        loadPageData(leadIdFromQuery);
        setProcessedLeadIdentifier(leadIdFromQuery);
    } else if (!leadIdFromQuery && startParamPayload && startParamPayload !== processedLeadIdentifier) {
        // Это случай, когда AppContext сделал редирект, и query параметр еще не установился в searchParams хука
        loadPageData(startParamPayload);
        setProcessedLeadIdentifier(startParamPayload);
    } else if (!leadIdFromQuery && !startParamPayload && processedLeadIdentifier !== "lobby_loaded") {
        // Первый заход без параметров
        loadPageData(null);
        setProcessedLeadIdentifier("lobby_loaded");
    }
  }, [searchParams, startParamPayload, loadPageData, processedLeadIdentifier]);


  const handleExecuteMission = useCallback(async (leadId: string, questIdFromLead: string | undefined) => {
    // ... (логика как была, но используется `cyberProfile` из стейта)
    if (!isAuthenticated || !dbUser?.user_id || !cyberProfile) {
      addToast("Аутентификация требуется", "error"); return;
    }
    const targetQuestId = questIdFromLead || "image-swap-mission";
    const isActuallyUnlocked = checkQuestUnlocked(targetQuestId, cyberProfile.completedQuests, QUEST_ORDER);

    if (!isActuallyUnlocked) {
      addToast(t.lockedMissionRedirect.replace("...", `'${targetQuestId}'`), "info", 7000);
      if (targetQuestId === "image-swap-mission" && !cyberProfile.completedQuests.includes("image-swap-mission")) {
        logger.info(`[HotVibes] Auto-completing '${targetQuestId}' for courage boost for user ${dbUser.user_id}`);
        await markTutorialAsCompleted(dbUser.user_id, "image-swap-mission");
        const updatedProfileResult = await fetchUserCyberFitnessProfile(dbUser.user_id);
        if (updatedProfileResult.success && updatedProfileResult.data) {
          setCyberProfile(updatedProfileResult.data); // Обновляем профиль в стейте
          addToast(`Навык '${targetQuestId}' экспресс-активирован! Попробуйте снова.`, "success", 3000);
          return;
        }
      }
      router.push(`/tutorials/${targetQuestId}?nextLead=${leadId}&nextQuest=${targetQuestId}`);
      return;
    }
    addToast(`${t.missionActivated} (Lead: ${leadId.substring(0,6)}..., Quest: ${targetQuestId})`, "success");
    router.push(`/repo-xml?leadId=${leadId}&questId=${targetQuestId}&flow=liveFireMission`);
  }, [isAuthenticated, dbUser, cyberProfile, router, t.lockedMissionRedirect, t.missionActivated, addToast]);

  const cardTheme: HotVibeCardTheme = {
    borderColor: "border-brand-red/70", 
    accentGradient: "bg-gradient-to-r from-brand-red via-brand-orange to-yellow-500", 
    modalOverlayGradient: "from-black/70 via-purple-900/50 to-black/80",
    modalAccentColor: "text-brand-cyan", 
    modalCardBg: "bg-black/70",
    modalCardBorder: "border-white/20",
    modalImageOverlayGradient: "bg-gradient-to-t from-black/90 via-black/50 to-transparent",
  };

  if (pageLoading && !vipLeadToShow) return <TutorialLoader />;

  if (vipLeadToShow && !pageLoading) {
    return (
      <div className="relative min-h-screen bg-gradient-to-br from-black via-slate-900 to-purple-900/50 text-foreground overflow-x-hidden py-10 sm:py-12 md:py-16">
        <div className="container mx-auto px-2 sm:px-4 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
            className="w-full max-w-3xl xl:max-w-4xl mx-auto"
          >
            <VipLeadDisplay 
              lead={vipLeadToShow} 
              theme={cardTheme} 
              currentLang={currentLang}
              isMissionUnlocked={cyberProfile ? (vipLeadToShow.required_quest_id ? checkQuestUnlocked(vipLeadToShow.required_quest_id, cyberProfile.completedQuests || [], QUEST_ORDER) : true) : false}
              onExecuteMission={() => handleExecuteMission(vipLeadToShow.id, vipLeadToShow.required_quest_id)}
            />
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-background via-black to-card text-foreground overflow-x-hidden">
      <RockstarHeroSection
        title={t.pageTitle}
        subtitle={t.pageSubtitle}
        triggerElementSelector={`#${heroTriggerId}`}
        backgroundImageObjectUrl="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/bullshitemotions//pooh.png"
        mainBackgroundImageUrl="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix//aPAQbwg_700b-62cff769-b043-4043-923d-76a1e9e4b71f.jpg"
      />
      <div id={heroTriggerId} style={{ height: '130vh' }} aria-hidden="true" />

      <div className="container mx-auto px-2 sm:px-4 py-10 md:py-12 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="w-full max-w-5xl mx-auto"
        >
          <Card className={cn(
              "bg-dark-card/95 backdrop-blur-xl border-2 shadow-2xl",
              "border-brand-red/70 shadow-[0_0_35px_rgba(var(--brand-red-rgb),0.5)]",
              "relative z-20" 
            )}
          >
            <CardHeader className="pb-4 pt-6">
              <CardTitle className={cn("text-2xl sm:text-3xl md:text-4xl font-orbitron flex items-center justify-center gap-2 text-brand-red")}>
                <VibeContentRenderer content={t.lobbyTitle} />
              </CardTitle>
              {cyberProfile && !pageLoading && (
                <CardDescription className="text-muted-foreground font-mono text-center text-xs">
                  Загружено для Агента Уровня {cyberProfile.level} | Доступно вайбов: {lobbyLeads.length}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="p-2 sm:p-4 md:p-6 min-h-[200px]">
              {pageLoading && <TutorialLoader />}
              {!pageLoading && !isAuthenticated && (
                <p className="text-center text-muted-foreground py-8 font-mono text-sm sm:text-base">{t.noHotVibesForGuest}</p>
              )}
              {!pageLoading && isAuthenticated && lobbyLeads.length === 0 && !vipLeadToShow && ( // Добавил !vipLeadToShow
                 <div className="text-center text-muted-foreground py-8 font-mono text-sm sm:text-base">
                    <VibeContentRenderer content={t.noHotVibes} />
                    <div className="mt-4">
                        <Button variant="outline" asChild className="border-brand-orange text-brand-orange hover:bg-brand-orange/10">
                            <Link href="/leads#scraperSectionAnchor">К Скрейперу в /leads</Link>
                        </Button>
                    </div>
                 </div>
              )}
              {!pageLoading && isAuthenticated && lobbyLeads.length > 0 && !vipLeadToShow && ( // Добавил !vipLeadToShow
                <div className="grid grid-cols-2 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3 md:gap-4">
                  {lobbyLeads.map((lead) => (
                    <HotVibeCard
                      key={lead.id}
                      lead={lead}
                      isMissionUnlocked={cyberProfile ? (lead.required_quest_id ? checkQuestUnlocked(lead.required_quest_id, cyberProfile.completedQuests || [], QUEST_ORDER) : true) : false}
                      onExecuteMission={handleExecuteMission} // Для карточек в лобби используется общий обработчик
                      currentLang={currentLang}
                      theme={cardTheme}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}

// Обертка в Suspense остается для обработки ленивой загрузки, если она есть в дочерних компонентах
export default function HotVibesPage() {
  return (
    <Suspense fallback={<TutorialLoader />}>
      <HotVibesContentInternal />
    </Suspense>
  )
}