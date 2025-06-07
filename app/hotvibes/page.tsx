"use client";

import React, { useState, useEffect, Suspense, useCallback, useId, useMemo } from 'react';
import { useRouter, useSearchParams as useNextSearchParamsHook } from 'next/navigation';
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
import { purchaseProtoCardAction } from './actions'; 
import type { ProtoCardDetails } from './actions';   
import Link from 'next/link'; 

export const ELON_SIMULATOR_CARD_ID = "elon_simulator_access_v1";
export const ELON_SIMULATOR_ACCESS_PRICE_XTR = 13;
export const MISSION_SUPPORT_PRICE_XTR = 13;
export const RUB_TO_XTR_RATE = 1 / 4.2; 

const pageTranslations = {
    ru: {
        pageTitle: "::FaFire:: ГОРЯЧИЕ ВАЙБЫ ::FaFireAlt::",
        pageSubtitle: "Агент! Это твой доступ к самым перспективным возможностям и XTR-играм. Инвестируй в миссии, открывай демо, играй на 'Рынке Маска'!",
        lobbyTitle: "::FaConciergeBell:: Лобби Горячих Возможностей",
        noHotVibes: "Пока нет подходящих вайбов для твоего уровня или по текущему фильтру. Прокачивайся в Тренировках, запускай Скрейпер в /leads или загляни позже!",
        noHotVibesForGuest: "Доступ к горячим вайбам и XTR-картам открывается после базовой аутентификации. Войди через Telegram, чтобы начать!",
        vipLeadNotFound: "Запрошенный VIP VIBE не найден или доступ к нему ограничен. Показываю общее лобби.",
        missionActivated: "Миссия активирована! Перенаправление...",
        errorLoadingLeads: "Ошибка загрузки вайбов.",
        errorLoadingProfile: "Не удалось загрузить профиль CyberFitness.",
        lockedMissionRedirect: "Навык для этой миссии еще не открыт. Начинаем экспресс-тренировку...",
        supportMissionBtnText: `Поддержать за ${MISSION_SUPPORT_PRICE_XTR} XTR`,
        elonSimulatorAccessBtnText: `Доступ к Рынку Маска за ${ELON_SIMULATOR_ACCESS_PRICE_XTR} XTR`,
        supportedText: "Поддержано",
        viewDemoText: "Смотреть Демо",
        goToSimulatorText: "К Симулятору Маска",
        filterAll: "Все Вайбы",
        filterSupported: "Мои ПротоКарты",
        backToLobby: "::FaArrowLeft:: К Лобби Вайбов",
    },
    en: {
        pageTitle: "::FaFire:: HOT VIBES ::FaFire::",
        pageSubtitle: "Agent! Access promising opportunities & XTR games. Invest in missions, unlock demos, play the 'Musk Market'!",
        lobbyTitle: "::FaConciergeBell:: Hot Opportunity Lobby",
        noHotVibes: "No suitable vibes for your level or current filter. Level up in Training, run Scraper in /leads, or check back!",
        noHotVibesForGuest: "Access to Hot Vibes & XTR cards unlocks after auth. Log in via Telegram!",
        vipLeadNotFound: "Requested VIP VIBE not found or access restricted. Showing general lobby.",
        missionActivated: "Mission Activated! Redirecting...",
        errorLoadingLeads: "Error loading vibes.",
        errorLoadingProfile: "Failed to load CyberFitness profile.",
        lockedMissionRedirect: "Skill for this mission not yet unlocked. Initiating express training...",
        supportMissionBtnText: `Support for ${MISSION_SUPPORT_PRICE_XTR} XTR`,
        elonSimulatorAccessBtnText: `Musk Market Access: ${ELON_SIMULATOR_ACCESS_PRICE_XTR} XTR`,
        supportedText: "Supported",
        viewDemoText: "View Demo",
        goToSimulatorText: "To Musk Simulator",
        filterAll: "All Vibes",
        filterSupported: "My ProtoCards",
        backToLobby: "::FaArrowLeft:: Back to Lobby",
    }
};

const extractPriceInRub = (potentialEarning: string | null | undefined): number | null => {
    if (!potentialEarning) return null;
    const rubOnlyMatch = potentialEarning.match(/^(?:до\s*)?(\d+[\s\d]*)\s*₽$/);
    if (rubOnlyMatch && rubOnlyMatch[1]) {
        return parseInt(rubOnlyMatch[1].replace(/\s/g, ''), 10);
    }
    const rangeMatch = potentialEarning.match(/(\d+[\s\d]*)\s*₽\s*\/\s*(?:до\s*)?(\d+[\s\d]*)\s*₽/);
    if (rangeMatch && rangeMatch[1]) { 
        return parseInt(rangeMatch[1].replace(/\s/g, ''), 10);
    }
    const numbers = potentialEarning.match(/\d+[\s\d]*/g);
    if (numbers && numbers.length > 0) {
        return parseInt(numbers[0].replace(/\s/g, ''), 10);
    }
    return null;
};

function mapLeadToHotLeadData(lead: LeadDataFromActions, lang: 'ru' | 'en'): HotLeadData {
  const demoImageUrlProvided = (lead.supervibe_studio_links as any)?.demo_image_url || (lead.supervibe_studio_links as any)?.client_avatar_url || lead.client_avatar_url;
  
  let earningText = lead.budget_range || (lang === 'ru' ? "Бюджет не указан" : "Budget not specified");
  const rubPrice = extractPriceInRub(lead.budget_range);
  if (rubPrice !== null) {
    const xtrPrice = Math.round(rubPrice * RUB_TO_XTR_RATE);
    earningText = `${lead.budget_range} (≈${xtrPrice} XTR)`;
  }

  return {
    id: lead.id || `fallback_id_${Math.random().toString(36).substring(7)}`,
    kwork_gig_title: lead.kwork_title || lead.project_description?.substring(0, 70) || (lang === 'ru' ? "Без названия" : "Untitled Gig"),
    client_name: lead.client_name,
    ai_summary: (lead as any).ai_summary || lead.project_description?.substring(0, 150) || (lang === 'ru' ? "Краткое описание от AI..." : "Brief AI summary..."),
    demo_image_url: demoImageUrlProvided,
    potential_earning: earningText,
    required_quest_id: (lead as any).required_quest_id_for_hotvibe || "image-swap-mission",
    client_response_snippet: lead.status === 'interested' || lead.status === 'client_responded_positive' ? (lang === 'ru' ? "Клиент проявил интерес!" : "Client showed interest!") : 
                             lead.status === 'new_ai_generated' || lead.status === 'demo_generated' ? (lang === 'ru' ? "AI сгенерировал прототип!" : "AI generated prototype!") : undefined,
    kwork_url: lead.lead_url,
    project_description: lead.project_description,
    ai_generated_proposal_draft: lead.generated_offer,
    status: lead.status,
    project_type_guess: lead.project_type_guess,
  };
}

const elonSimulatorProtoCardData: HotLeadData = {
    id: ELON_SIMULATOR_CARD_ID,
    kwork_gig_title: "Симулятор 'Рынка Маска'",
    client_name: "CyberVibe Games",
    ai_summary: "Узнай, как твиты и новости влияют на (фантомные) акции Tesla. Почувствуй VIBE нестабильности за XTR!",
    demo_image_url: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/elon_musk_meme_cybertruck_flames.png", 
    potential_earning: `${ELON_SIMULATOR_ACCESS_PRICE_XTR} XTR`,
    required_quest_id: "none", 
    project_type_guess: "XTR Game/Simulator",
    status: "active_game",
};

function HotVibesClientContent() {
  const router = useRouter();
  const searchParamsHook = useNextSearchParamsHook(); 
  const { dbUser, isAuthenticated, user: tgUser, isLoading: appCtxLoading, isAuthenticating, platform, startParamPayload, refreshDbUser } = useAppContext();
  const { addToast } = useAppToast();
  const heroTriggerId = useId().replace(/:/g, "-") + "-hotvibes-hero-trigger";
  const [currentLang, setCurrentLang] = useState<'ru' | 'en'>('ru');
  const [isPurchasePending, setIsPurchasePending] = useState(false);

  const [cyberProfile, setCyberProfile] = useState<CyberFitnessProfile | null>(null);
  const [vipLeadToShow, setVipLeadToShow] = useState<HotLeadData | null>(null);
  const [initialVipIdentifier, setInitialVipIdentifier] = useState<string | null>(null);
  const [isInitialVipCheckDone, setIsInitialVipCheckDone] = useState(false);
  const [lobbyLeads, setLobbyLeads] = useState<HotLeadData[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all');

  const t = pageTranslations[currentLang];

  useEffect(() => {
    setCurrentLang(tgUser?.language_code === 'ru' || platform === 'ios' || platform === 'android' ? 'ru' : 'en');
  }, [tgUser?.language_code, platform]);

  useEffect(() => {
    if (!appCtxLoading && !isAuthenticating && !isInitialVipCheckDone) {
      const leadIdFromUrl = searchParamsHook.get('lead_identifier');
      const effectiveId = startParamPayload || leadIdFromUrl;
      if (effectiveId) {
        logger.info(`[HotVibes InitialIdEffect] Setting initialVipIdentifier to: ${effectiveId}`);
        setInitialVipIdentifier(effectiveId);
      }
      setIsInitialVipCheckDone(true); 
    }
  }, [startParamPayload, searchParamsHook, appCtxLoading, isAuthenticating, isInitialVipCheckDone]);
  
  const loadPageData = useCallback(async () => {
    logger.info(`[HotVibes loadPageData] Triggered. AppCtxLoading: ${appCtxLoading}, isInitialVipCheckDone: ${isInitialVipCheckDone}, InitialVIP_ID: ${initialVipIdentifier}`);
    
    if (appCtxLoading || !isInitialVipCheckDone) {
      logger.debug("[HotVibes loadPageData] Skipping: AppContext loading or initial VIP check not done.");
      setPageLoading(true); 
      return;
    }
    setPageLoading(true);
    logger.debug("[HotVibes loadPageData] Proceeding with data fetch.");

    let tempCyberProfile: CyberFitnessProfile | null = null;
    if (isAuthenticated && dbUser?.user_id) {
        logger.debug(`[HotVibes loadPageData] Fetching CyberFitness profile for user: ${dbUser.user_id}`);
        const profileResult = await fetchUserCyberFitnessProfile(dbUser.user_id);
        if (profileResult.success && profileResult.data) {
          tempCyberProfile = profileResult.data;
          setCyberProfile(tempCyberProfile);
          logger.debug("[HotVibes loadPageData] CyberFitness profile fetched:", tempCyberProfile);
        } else { 
          addToast(t.errorLoadingProfile, "error"); 
          logger.warn("[HotVibes loadPageData] Failed to fetch CyberFitness profile:", profileResult.error);
        }
    }
    
    logger.debug("[HotVibes loadPageData] Fetching all leads for dashboard.");
    const leadsRes = await fetchLeadsForDashboard(dbUser?.user_id || "guest", 'all');
    let allFetchedLeads: HotLeadData[] = [];
    if (leadsRes.success && leadsRes.data) {
        allFetchedLeads = (leadsRes.data as LeadDataFromActions[]).map(lead => mapLeadToHotLeadData(lead, currentLang));
        setLobbyLeads(allFetchedLeads);
        logger.info(`[HotVibes loadPageData] Total lobby leads fetched: ${allFetchedLeads.length}`);
    } else { 
        addToast(t.errorLoadingLeads, "error"); 
        logger.warn("[HotVibes loadPageData] Failed to fetch leads:", leadsRes.error);
        setLobbyLeads([]);
    }

    if (initialVipIdentifier) {
        logger.debug(`[HotVibes loadPageData] Processing initialVipIdentifier: ${initialVipIdentifier}`);
        if (initialVipIdentifier === ELON_SIMULATOR_CARD_ID) {
            setVipLeadToShow(elonSimulatorProtoCardData);
            logger.info(`[HotVibes loadPageData] Set VIP to Elon Simulator.`);
        } else {
            let vipData = allFetchedLeads.find(l => l.id === initialVipIdentifier);
            if (vipData) {
                setVipLeadToShow(vipData);
                logger.info(`[HotVibes loadPageData] Set VIP (from lobby) to: ${initialVipIdentifier}`);
            } else {
                logger.info(`[HotVibes loadPageData] VIP ${initialVipIdentifier} not in current lobby, fetching specifically.`);
                const vipResult = await fetchLeadByIdentifierOrNickname(initialVipIdentifier, dbUser?.user_id || "guest");
                if (vipResult.success && vipResult.data) {
                    setVipLeadToShow(mapLeadToHotLeadData(vipResult.data as LeadDataFromActions, currentLang));
                    logger.info(`[HotVibes loadPageData] Fetched and set VIP to: ${initialVipIdentifier}`);
                } else {
                    addToast(t.vipLeadNotFound, "warning", { description: `ID: ${initialVipIdentifier}` });
                    logger.warn(`[HotVibes loadPageData] VIP lead ${initialVipIdentifier} not found after specific fetch.`);
                    setVipLeadToShow(null); 
                    setInitialVipIdentifier(null); 
                }
            }
        }
    } else {
      logger.debug("[HotVibes loadPageData] No initialVipIdentifier, ensuring vipLeadToShow is null.");
      setVipLeadToShow(null); 
    }
    setPageLoading(false);
    logger.debug("[HotVibes loadPageData] Finished.");
  }, [isAuthenticated, dbUser, appCtxLoading, isAuthenticating, addToast, t, currentLang, initialVipIdentifier, isInitialVipCheckDone]);

  useEffect(() => {
    if (isInitialVipCheckDone) { 
        loadPageData();
    }
  }, [loadPageData, isInitialVipCheckDone, dbUser?.metadata?.xtr_protocards]); 


  const handleSelectLeadForVip = (lead: HotLeadData) => {
    logger.info(`[HotVibes] Manually selecting lead for VIP display: ${lead.id}`);
    setInitialVipIdentifier(lead.id); 
  };

  const handleBackToLobby = () => {
    logger.info(`[HotVibes] Returning to lobby view.`);
    setInitialVipIdentifier(null); 
    setVipLeadToShow(null); 
  };
  
  const handlePurchaseProtoCard = async (cardToPurchase: HotLeadData) => {
    if (!isAuthenticated || !dbUser?.user_id) {
      addToast("Сначала авторизуйтесь для покупки ПротоКарточки!", "error");
      return;
    }
    if (isPurchasePending) return;

    setIsPurchasePending(true);
    let price = MISSION_SUPPORT_PRICE_XTR;
    let cardType = "mission_support";
    let specificMetadata: Record<string, any> = { 
        associated_lead_id: cardToPurchase.id, 
        lead_title: cardToPurchase.kwork_gig_title,
        demo_link_param: cardToPurchase.client_name 
    };

    if (cardToPurchase.id === ELON_SIMULATOR_CARD_ID) {
        price = ELON_SIMULATOR_ACCESS_PRICE_XTR;
        cardType = "simulation_access";
        specificMetadata = { page_link: "/elon", simulator_name: "Рынок Маска" };
    }
    
    const cardDetails: ProtoCardDetails = {
      cardId: cardToPurchase.id,
      title: cardToPurchase.kwork_gig_title || "ПротоКарточка Доступа",
      description: cardToPurchase.ai_summary || `Доступ к ${cardType === "simulation_access" ? "симулятору" : "демо миссии"}. Цена: ${price} XTR.`,
      amountXTR: price,
      type: cardType,
      metadata: specificMetadata,
    };

    try {
      const result = await purchaseProtoCardAction(dbUser.user_id, cardDetails);
      if (result.success) {
        addToast("Запрос на ПротоКарточку отправлен! Проверьте Telegram для оплаты счета.", "success");
        if(refreshDbUser) {
            logger.info("[HotVibes handlePurchaseProtoCard] Purchase initiated, scheduling dbUser refresh.");
            setTimeout(async () => {
                logger.info("[HotVibes handlePurchaseProtoCard] Executing scheduled dbUser refresh.");
                await refreshDbUser(); 
            }, 5000); 
        }
      } else {
        addToast(result.error || "Не удалось инициировать покупку ПротоКарточки.", "error");
      }
    } catch (error) {
      addToast("Ошибка при запросе на покупку ПротоКарточки.", "error");
      logger.error("[HotVibes] Error purchasing ProtoCard:", error);
    }
    setIsPurchasePending(false);
  };

  const handleExecuteMission = useCallback(async (leadId: string, questIdFromLead: string | undefined) => {
    if (!isAuthenticated || !dbUser?.user_id || !cyberProfile) { 
      addToast("Аутентификация или профиль агента недоступны", "error"); return;
    }
    const targetQuestId = questIdFromLead || "image-swap-mission";
    if (targetQuestId === "none") {
        addToast("Эта карточка открывает доступ к симулятору, а не к миссии в Studio.", "info");
        if (leadId === ELON_SIMULATOR_CARD_ID) router.push("/elon");
        return;
    }
    const isActuallyUnlocked = checkQuestUnlocked(targetQuestId, cyberProfile.completedQuests || [], QUEST_ORDER);

    if (!isActuallyUnlocked) {
      addToast(t.lockedMissionRedirect.replace("...", `'${targetQuestId}'`), "info", 7000);
      if (targetQuestId === "image-swap-mission" && !(cyberProfile.completedQuests || []).includes("image-swap-mission")) {
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
    shadowColor: "shadow-brand-red/40",
    hoverBorderColor: "hover:border-brand-red",
    hoverShadowColor: "hover:shadow-[0_0_25px_rgba(var(--brand-red-rgb),0.6)]",
    textColor: "group-hover:text-brand-red"
  };
  
  const elonCardIsSupportedActually = useMemo(() => {
    const isSupported = !!dbUser?.metadata?.xtr_protocards?.[ELON_SIMULATOR_CARD_ID]?.status === 'active';
    logger.debug(`[HotVibes elonCardIsSupportedActually] Memo re-calc. dbUser metadata exists: ${!!dbUser?.metadata}, xtr_protocards exists: ${!!dbUser?.metadata?.xtr_protocards}, Elon card: ${JSON.stringify(dbUser?.metadata?.xtr_protocards?.[ELON_SIMULATOR_CARD_ID])}, Status: ${dbUser?.metadata?.xtr_protocards?.[ELON_SIMULATOR_CARD_ID]?.status}. Result: ${isSupported}`);
    return isSupported;
  }, [dbUser?.metadata?.xtr_protocards]);

  const displayedLeads = useMemo(() => {
    const elonCardWithStatus = { ...elonSimulatorProtoCardData, isSpecial: true, isSupported: elonCardIsSupportedActually };

    let currentLobbyLeads = lobbyLeads.map(lead => ({
        ...lead, 
        isSpecial: false, 
        isSupported: !!dbUser?.metadata?.xtr_protocards?.[lead.id]?.status === 'active'
    }));

    let filteredForDisplay: Array<HotLeadData & {isSpecial?:boolean, isSupported?:boolean}> = [];

    if (activeFilter === 'supported') {
        filteredForDisplay = currentLobbyLeads.filter(l => l.isSupported && l.id !== ELON_SIMULATOR_CARD_ID);
        if (elonCardWithStatus.isSupported) {
            filteredForDisplay.unshift(elonCardWithStatus);
        }
    } else { 
        const baseFilteredLobby = cyberProfile
            ? currentLobbyLeads.filter(mLead => mLead.required_quest_id && mLead.required_quest_id !== "none" ? checkQuestUnlocked(mLead.required_quest_id, cyberProfile.completedQuests || [], QUEST_ORDER) : true )
            : isAuthenticated ? [] : currentLobbyLeads;
        
        const lobbyWithoutElon = baseFilteredLobby.filter(l => l.id !== ELON_SIMULATOR_CARD_ID);
        filteredForDisplay = [elonCardWithStatus, ...lobbyWithoutElon];
    }
    
    logger.debug(`[HotVibes displayedLeads] Memo re-calc. Filter: ${activeFilter}, ElonSupported: ${elonCardIsSupportedActually}, Lobby size: ${lobbyLeads.length}, CyberProfile: ${!!cyberProfile}, isAuthenticated: ${isAuthenticated}. Output count: ${filteredForDisplay.length}`);
    return filteredForDisplay;

  }, [lobbyLeads, dbUser?.metadata?.xtr_protocards, activeFilter, cyberProfile, isAuthenticated, elonCardIsSupportedActually]);

  if (appCtxLoading && pageLoading && !vipLeadToShow) return <TutorialLoader message="Инициализация VIBE-пространства..."/>;

  if (vipLeadToShow) {
    return (
      <div className="relative min-h-screen bg-gradient-to-br from-black via-slate-900 to-purple-900/50 text-foreground overflow-x-hidden py-20 md:py-24">
        <div className="container mx-auto px-2 sm:px-4 relative z-10">
         <Button onClick={handleBackToLobby} variant="outline" className="mb-4 text-brand-cyan border-brand-cyan hover:bg-brand-cyan/10 fixed top-[calc(var(--header-height,60px)+10px)] left-4 z-[60] backdrop-blur-sm bg-black/50">
            <VibeContentRenderer content={t.backToLobby}/>
          </Button>
          <motion.div
            key={vipLeadToShow.id} 
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
            className="w-full max-w-3xl xl:max-w-4xl mx-auto mt-8"
          >
            <VipLeadDisplay 
              lead={vipLeadToShow} 
              theme={cardTheme} 
              currentLang={currentLang}
              isMissionUnlocked={cyberProfile ? (vipLeadToShow.required_quest_id && vipLeadToShow.required_quest_id !== "none" ? checkQuestUnlocked(vipLeadToShow.required_quest_id, cyberProfile.completedQuests || [], QUEST_ORDER) : true) : false}
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
              "bg-dark-card/95 backdrop-blur-xl border shadow-2xl", 
              theme.borderColor, 
              theme.shadowColor
            )}
          >
            <CardHeader className="pb-4 pt-6">
              <CardTitle className={cn("text-2xl sm:text-3xl md:text-4xl font-orbitron flex items-center justify-center gap-2 text-brand-red")}>
                <VibeContentRenderer content={t.lobbyTitle} />
              </CardTitle>
              {cyberProfile && ( 
                <CardDescription className="text-muted-foreground font-mono text-center text-xs">
                 Агент Ур. {cyberProfile.level} | Показано: {displayedLeads.filter(l => l.id !== ELON_SIMULATOR_CARD_ID || activeFilter === 'supported').length} (Фильтр: {activeFilter === 'all' ? t.filterAll : t.filterSupported})
                </CardDescription>
              )}
              <div className="flex flex-wrap gap-1.5 sm:gap-2 pt-2 justify-center">
                  <Button
                    variant={activeFilter === 'all' ? "default" : "outline"}
                    size="xs"
                    onClick={() => setActiveFilter('all')}
                    className={cn(
                        "text-[0.65rem] sm:text-xs px-2 sm:px-3 py-1 transform hover:scale-105 font-mono", 
                        activeFilter === 'all' 
                            ? `bg-gradient-to-r from-brand-orange to-red-600 text-white shadow-md hover:opacity-95` 
                            : `border-brand-red text-brand-red hover:bg-brand-red/10`
                    )}
                  >
                    {t.filterAll}
                  </Button>
                  <Button
                    variant={activeFilter === 'supported' ? "default" : "outline"}
                    size="xs"
                    onClick={() => setActiveFilter('supported')}
                    className={cn("text-[0.65rem] sm:text-xs px-2 sm:px-3 py-1 transform hover:scale-105 font-mono", activeFilter === 'supported' ? `bg-brand-green text-black shadow-md` : `border-brand-green text-brand-green hover:bg-brand-green/10`)}
                  >
                    <VibeContentRenderer content={t.filterSupported} />
                  </Button>
              </div>
            </CardHeader>
            <CardContent className="p-2 sm:p-4 md:p-6 min-h-[200px]">
              {!isAuthenticated && (
                <p className="text-center text-muted-foreground py-8 font-mono text-sm sm:text-base">{t.noHotVibesForGuest}</p>
              )}
              {isAuthenticated && displayedLeads.length === 0 && !pageLoading && (
                 <div className="text-center text-muted-foreground py-8 font-mono text-sm sm:text-base">
                    <VibeContentRenderer content={t.noHotVibes} />
                     {activeFilter !== 'supported' && 
                        <div className="mt-4">
                            <Button variant="outline" asChild className="border-brand-orange text-brand-orange hover:bg-brand-orange/10">
                                <Link href="/leads#scraperSectionAnchor">К Скрейперу в /leads</Link>
                            </Button>
                        </div>
                    }
                 </div>
              )}
              {pageLoading && displayedLeads.length === 0 && <TutorialLoader message="Обновление матрицы вайбов..." />}
              
              {isAuthenticated && displayedLeads.length > 0 && (
                <div className="grid grid-cols-2 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3 md:gap-4">
                  {displayedLeads.map((leadWithStatus) => {
                      const { isSpecial, isSupported, ...lead } = leadWithStatus;
                      return (
                        <HotVibeCard
                          key={lead.id}
                          lead={lead}
                          isMissionUnlocked={cyberProfile ? (lead.required_quest_id && lead.required_quest_id !== "none" ? checkQuestUnlocked(lead.required_quest_id, cyberProfile.completedQuests || [], QUEST_ORDER) : true) : false}
                          onExecuteMission={() => handleExecuteMission(lead.id, lead.required_quest_id)}
                          onSupportMission={() => handlePurchaseProtoCard(lead)}
                          isSupported={!!isSupported} 
                          isSpecial={!!isSpecial}   
                          onViewVip={handleSelectLeadForVip} 
                          currentLang={currentLang}
                          theme={cardTheme}
                          translations={t}
                          isPurchasePending={isPurchasePending}
                          isAuthenticated={isAuthenticated}
                        />
                      );
                  })}
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