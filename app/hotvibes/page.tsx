"use client";

import React, { useState, useEffect, Suspense, useCallback, useId } from 'react';
import { useRouter, usePathname, useSearchParams as useNextSearchParamsHook } from 'next/navigation';
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
import { fetchLeadsForDashboard, fetchLeadByIdentifierOrNickname } from '../leads/actions'; 
import type { LeadRow as LeadDataFromActions } from '../leads/actions';
import { HotVibeCard, HotLeadData, HotVibeCardTheme } from '@/components/hotvibes/HotVibeCard'; 
import { VipLeadDisplay } from '@/components/hotvibes/VipLeadDisplay'; 
import { debugLogger as logger } from "@/lib/debugLogger";
import { useAppToast } from '@/hooks/useAppToast';

const pageTranslations = {
    ru: {
        pageTitle: "::FaFire:: ГОРЯЧИЕ ВАЙБЫ ::FaFireAlt::",
        pageSubtitle: "Агент! Это твой доступ к самым перспективным возможностям. Клиенты УЖЕ ЖДУТ или скоро откликнутся. Выбирай миссию, применяй навыки, зарабатывай KiloVibes и реальный кэш!",
        lobbyTitle: "::FaConciergeBell:: Лобби Горячих Возможностей",
        noHotVibes: "Пока нет подходящих вайбов для твоего уровня. Прокачивайся в Тренировках, запускай Скрейпер в /leads или загляни позже!",
        noHotVibesForGuest: "Доступ к горячим вайбам открывается после базовой аутентификации. Войди через Telegram, чтобы начать!",
        vipLeadNotFound: "Запрошенный VIP VIBE не найден или доступ к нему ограничен. Показываю общее лобби.",
        missionActivated: "Миссия активирована! Перенаправление...",
        errorLoadingLeads: "Ошибка загрузки вайбов.",
        errorLoadingProfile: "Не удалось загрузить профиль CyberFitness.",
        lockedMissionRedirect: "Навык для этой миссии еще не открыт. Начинаем экспресс-тренировку...",
    },
    en: {
        pageTitle: "::FaFire:: HOT VIBES ::FaFire::",
        pageSubtitle: "Agent! This is your access to the most promising opportunities. Clients ARE WAITING or will respond soon. Choose your mission, apply your skills, earn KiloVibes and real cash!",
        lobbyTitle: "::FaConciergeBell:: Hot Opportunity Lobby",
        noHotVibes: "No suitable vibes for your level yet. Level up in Training, run your Scraper in /leads, or check back later!",
        noHotVibesForGuest: "Access to Hot Vibes unlocks after basic authentication. Log in via Telegram to start!",
        vipLeadNotFound: "Requested VIP VIBE not found or access restricted. Showing general lobby.",
        missionActivated: "Mission Activated! Redirecting...",
        errorLoadingLeads: "Error loading vibes.",
        errorLoadingProfile: "Failed to load CyberFitness profile.",
        lockedMissionRedirect: "Skill for this mission not yet unlocked. Initiating express training...",
    }
};

function mapLeadToHotLeadData(lead: LeadDataFromActions): HotLeadData {
  const demoImageUrl = (lead.supervibe_studio_links as any)?.demo_image_url || 
                       (lead.supervibe_studio_links as any)?.client_avatar_url ||
                       lead.client_avatar_url; 

  return {
    id: lead.id || `fallback_id_${Math.random()}`,
    kwork_gig_title: lead.kwork_title || lead.project_description?.substring(0, 70) || "Untitled Gig",
    client_name: lead.client_name,
    ai_summary: (lead as any).ai_summary || lead.project_description?.substring(0, 150) || "Краткое описание задачи от AI...",
    demo_image_url: demoImageUrl,
    potential_earning: lead.budget_range || undefined,
    required_quest_id: (lead as any).required_quest_id_for_hotvibe || "image-swap-mission",
    client_response_snippet: lead.status === 'interested' || lead.status === 'client_responded_positive' ? "Клиент проявил интерес!" : 
                             lead.status === 'new_ai_generated' || lead.status === 'demo_generated' ? "AI сгенерировал прототип!" : undefined,
    kwork_url: lead.lead_url,
    project_description: lead.project_description,
    ai_generated_proposal_draft: lead.generated_offer,
    status: lead.status,
    project_type_guess: lead.project_type_guess,
  };
}

function HotVibesClientContent() { // Переименовано в HotVibesClientContent для ясности
  const router = useRouter();
  const searchParams = useNextSearchParamsHook(); 
  const { dbUser, isAuthenticated, user: tgUser, isLoading: appCtxLoading, isAuthenticating, platform, startParamPayload } = useAppContext();
  const { addToast } = useAppToast();
  const heroTriggerId = useId().replace(/:/g, "-") + "-hotvibes-hero-trigger";
  const [currentLang, setCurrentLang] = useState<'ru' | 'en'>('ru');

  const [cyberProfile, setCyberProfile] = useState<CyberFitnessProfile | null>(null);
  const [vipLeadToShow, setVipLeadToShow] = useState<HotLeadData | null>(null);
  const [lobbyLeads, setLobbyLeads] = useState<HotLeadData[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [currentLeadIdentifierForPage, setCurrentLeadIdentifierForPage] = useState<string | null>(null); // Renamed to avoid conflict with other variables
  const [hasRoutedForStartParam, setHasRoutedForStartParam] = useState(false);


  const t = pageTranslations[currentLang];

  useEffect(() => {
    setCurrentLang(tgUser?.language_code === 'ru' || platform === 'ios' || platform === 'android' ? 'ru' : 'en');
  }, [tgUser?.language_code, platform]);

  useEffect(() => {
    if (startParamPayload && !appCtxLoading && !isAuthenticating && !searchParams.has('lead_identifier') && !hasRoutedForStartParam) {
        logger.info(`[HotVibes] AppContext has startParamPayload: ${startParamPayload}, but URL doesn't. Routing.`);
        router.push(`/hotvibes?lead_identifier=${startParamPayload}`);
        setHasRoutedForStartParam(true); 
    }
  }, [startParamPayload, appCtxLoading, isAuthenticating, searchParams, router, hasRoutedForStartParam]);


  const loadPageData = useCallback(async (identifierToLoad: string | null) => {
    logger.info(`[HotVibes loadPageData] Called with identifier: ${identifierToLoad}. AppContext Loading: ${appCtxLoading}, Authenticating: ${isAuthenticating}`);
    if (appCtxLoading || isAuthenticating) {
      setPageLoading(true); return;
    }
    setPageLoading(true);

    let loadedProfile: CyberFitnessProfile | null = null;
    if (isAuthenticated && dbUser?.user_id) {
      const profileResult = await fetchUserCyberFitnessProfile(dbUser.user_id);
      if (profileResult.success && profileResult.data) {
        loadedProfile = profileResult.data;
        setCyberProfile(loadedProfile);
      } else { addToast(t.errorLoadingProfile, "error"); }
    }

    if (identifierToLoad) {
      logger.info(`[HotVibes] Attempting to fetch VIP lead: ${identifierToLoad}`);
      const vipResult = await fetchLeadByIdentifierOrNickname(identifierToLoad, dbUser?.user_id || "guest");
      if (vipResult.success && vipResult.data) {
        const mappedVipLead = mapLeadToHotLeadData(vipResult.data as LeadDataFromActions);
        setVipLeadToShow(mappedVipLead);
        setLobbyLeads([]);
        addToast(`Демонстрация VIP VIBE для: ${mappedVipLead.kwork_gig_title || mappedVipLead.client_name}`, "success");
        
        const currentQueryLeadId = searchParams.get('lead_identifier');
        if(currentQueryLeadId === identifierToLoad) {
            // router.replace('/hotvibes', { shallow: true }); // Using undefined to remove query params
            router.replace('/hotvibes', undefined);
        }
      } else {
        addToast(t.vipLeadNotFound, "warning", { description: `Идентификатор: ${identifierToLoad}` });
        setVipLeadToShow(null);
        const leadsRes = await fetchLeadsForDashboard(dbUser?.user_id || "guest", 'all');
        if (leadsRes.success && leadsRes.data) {
            const mappedLobby = (leadsRes.data as LeadDataFromActions[]).map(mapLeadToHotLeadData);
            setLobbyLeads(mappedLobby.filter(mLead => loadedProfile ? (mLead.required_quest_id ? checkQuestUnlocked(mLead.required_quest_id, loadedProfile.completedQuests || [], QUEST_ORDER) : true) : (isAuthenticated ? false : true)));
        }
      }
    } else { 
      logger.info("[HotVibes] No VIP identifier. Loading lobby.");
      setVipLeadToShow(null);
      const leadsRes = await fetchLeadsForDashboard(dbUser?.user_id || "guest", 'all');
      if (leadsRes.success && leadsRes.data) {
        const mappedLobby = (leadsRes.data as LeadDataFromActions[]).map(mapLeadToHotLeadData);
        setLobbyLeads(mappedLobby.filter(mLead => loadedProfile ? (mLead.required_quest_id ? checkQuestUnlocked(mLead.required_quest_id, loadedProfile.completedQuests || [], QUEST_ORDER) : true) : (isAuthenticated ? false : true) ));
        logger.info(`[HotVibes loadPageData] Lobby leads loaded: ${lobbyLeads.length}`);
      } else { addToast(t.errorLoadingLeads, "error"); }
    }
    setPageLoading(false);
  }, [isAuthenticated, dbUser?.user_id, appCtxLoading, isAuthenticating, addToast, t, router, searchParams]);

  useEffect(() => {
    const leadIdFromQuery = searchParams.get('lead_identifier');
    logger.debug(`[HotVibes useEffect[searchParams, loadPageData]] leadIdFromQuery: ${leadIdFromQuery}, currentProcessed: ${currentLeadIdentifierForPage}`);

    if (leadIdFromQuery) {
        if (leadIdFromQuery !== currentLeadIdentifierForPage) {
            setCurrentLeadIdentifierForPage(leadIdFromQuery);
            loadPageData(leadIdFromQuery);
        }
    } else { 
        if (currentLeadIdentifierForPage !== "lobby_loaded_after_vip_or_initial") { 
            setCurrentLeadIdentifierForPage("lobby_loaded_after_vip_or_initial");
            loadPageData(null); 
        }
    }
  }, [searchParams, loadPageData, currentLeadIdentifierForPage]);


  const handleExecuteMission = useCallback(async (leadId: string, questIdFromLead: string | undefined) => {
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
          setCyberProfile(updatedProfileResult.data);
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

  if (pageLoading) return <TutorialLoader message="Загрузка VIBE-пространства..."/>;

  if (vipLeadToShow) {
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

  // Обычный рендеринг лобби
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
              {cyberProfile && ( 
                <CardDescription className="text-muted-foreground font-mono text-center text-xs">
                  Загружено для Агента Уровня {cyberProfile.level} | Доступно вайбов: {lobbyLeads.length}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="p-2 sm:p-4 md:p-6 min-h-[200px]">
              {!isAuthenticated && ( // Показываем если не аутентифицирован, независимо от pageLoading (который уже false)
                <p className="text-center text-muted-foreground py-8 font-mono text-sm sm:text-base">{t.noHotVibesForGuest}</p>
              )}
              {isAuthenticated && lobbyLeads.length === 0 && ( // Показываем если аутентифицирован, но нет лидов для лобби
                 <div className="text-center text-muted-foreground py-8 font-mono text-sm sm:text-base">
                    <VibeContentRenderer content={t.noHotVibes} />
                    <div className="mt-4">
                        <Button variant="outline" asChild className="border-brand-orange text-brand-orange hover:bg-brand-orange/10">
                            <Link href="/leads#scraperSectionAnchor">К Скрейперу в /leads</Link>
                        </Button>
                    </div>
                 </div>
              )}
              {isAuthenticated && lobbyLeads.length > 0 && (
                <div className="grid grid-cols-2 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3 md:gap-4">
                  {lobbyLeads.map((lead) => (
                    <HotVibeCard
                      key={lead.id}
                      lead={lead}
                      isMissionUnlocked={cyberProfile ? (lead.required_quest_id ? checkQuestUnlocked(lead.required_quest_id, cyberProfile.completedQuests || [], QUEST_ORDER) : true) : false}
                      onExecuteMission={handleExecuteMission}
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

export default function HotVibesPage() {
  return (
    <Suspense fallback={<TutorialLoader message="Загрузка Кибер-Пространства..." />}>
      <HotVibesClientContent />
    </Suspense>
  );
}