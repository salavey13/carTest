"use client";

import React, { useState, useEffect, Suspense, useCallback, useId } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
// import { toast } from "sonner"; // Уже импортируется через useAppToast
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
import { fetchLeadsForDashboard } from '../leads/actions';
import type { LeadRow as LeadDataFromActions } from '../leads/actions';
// Убедимся, что импортируем и тип темы
import { HotVibeCard, HotLeadData, HotVibeCardTheme } from '@/components/hotvibes/HotVibeCard'; 
import { debugLogger as logger } from "@/lib/debugLogger";
import { useAppToast } from '@/hooks/useAppToast';

// Тип HotVibeCardTheme теперь импортируется, определение здесь больше не нужно

const pageTranslations = {
    ru: {
        pageTitle: "::FaFire:: ГОРЯЧИЕ ВАЙБЫ ::FaFireAlt::",
        pageSubtitle: "Агент! Это твой доступ к самым перспективным возможностям. Клиенты УЖЕ ЖДУТ или скоро откликнутся. Выбирай миссию, применяй навыки, зарабатывай KiloVibes и реальный кэш!",
        lobbyTitle: "::FaConciergeBell:: Лобби Горячих Возможностей",
        noHotVibes: "Пока нет подходящих вайбов. Прокачивайся в Тренировках, запускай свой Скрейпер в /leads или загляни позже!",
        noHotVibesForGuest: "Доступ к горячим вайбам открывается после базовой аутентификации. Войди через Telegram, чтобы начать!",
        missionActivated: "Миссия активирована! Перенаправление...",
        errorLoadingLeads: "Ошибка загрузки вайбов.",
        errorLoadingProfile: "Не удалось загрузить профиль CyberFitness.",
        lockedMissionRedirect: "Навык для этой миссии еще не открыт. Начинаем экспресс-тренировку...",
    },
    en: {
        pageTitle: "::FaFire:: HOT VIBES ::FaFire::",
        pageSubtitle: "Agent! This is your access to the most promising opportunities. Clients ARE WAITING or will respond soon. Choose your mission, apply your skills, earn KiloVibes and real cash!",
        lobbyTitle: "::FaConciergeBell:: Hot Opportunity Lobby",
        noHotVibes: "No suitable vibes yet. Level up in Training, run your Scraper in /leads, or check back later!",
        noHotVibesForGuest: "Access to Hot Vibes unlocks after basic authentication. Log in via Telegram to start!",
        missionActivated: "Mission Activated! Redirecting...",
        errorLoadingLeads: "Error loading vibes.",
        errorLoadingProfile: "Failed to load CyberFitness profile.",
        lockedMissionRedirect: "Skill for this mission not yet unlocked. Initiating express training...",
    }
};

function mapLeadToHotLeadData(lead: LeadDataFromActions): HotLeadData {
  const demoImageUrl = (lead.supervibe_studio_links as any)?.demo_image_url || 
                       (lead.supervibe_studio_links as any)?.client_avatar_url;

  return {
    id: lead.id || `fallback_id_${Math.random()}`,
    kwork_gig_title: lead.client_name || lead.project_description?.substring(0, 50) || "Untitled Gig",
    ai_summary: lead.project_description?.substring(0, 100) || "No summary available.",
    demo_image_url: demoImageUrl,
    potential_earning: lead.budget_range || undefined,
    required_quest_id: (lead as any).required_quest_id_for_hotvibe || "image-swap-mission",
    client_response_snippet: lead.status === 'interested' || lead.status === 'client_responded_positive' ? "Клиент проявил интерес!" : undefined,
    kwork_url: lead.lead_url,
    project_description: lead.project_description,
    ai_generated_proposal_draft: lead.generated_offer,
    status: lead.status,
    project_type_guess: lead.project_type_guess,
  };
}

function HotVibesContent() {
  const router = useRouter();
  const { dbUser, isAuthenticated, user: tgUser, isLoading: appCtxLoading, isAuthenticating, platform } = useAppContext();
  const { addToast } = useAppToast();
  const heroTriggerId = useId().replace(/:/g, "-") + "-hotvibes-hero-trigger";
  const [currentLang, setCurrentLang] = useState<'ru' | 'en'>('ru');

  const [cyberProfile, setCyberProfile] = useState<CyberFitnessProfile | null>(null);
  const [hotLeads, setHotLeads] = useState<HotLeadData[]>([]);
  const [pageLoading, setPageLoading] = useState(true);

  const t = pageTranslations[currentLang];

  useEffect(() => {
    setCurrentLang(tgUser?.language_code === 'ru' || platform === 'ios' || platform === 'android' ? 'ru' : 'en');
  }, [tgUser?.language_code, platform]);

  const loadPageData = useCallback(async () => {
    if (appCtxLoading || isAuthenticating) {
        logger.debug("[HotVibes] AppContext still loading/authenticating. Waiting.");
        setPageLoading(true);
        return;
    }
    setPageLoading(true);
    logger.info(`[HotVibes] Attempting to load page data. Authenticated: ${isAuthenticated}, DB User ID: ${dbUser?.user_id}`);

    if (isAuthenticated && dbUser?.user_id) {
      const profileResult = await fetchUserCyberFitnessProfile(dbUser.user_id);
      if (profileResult.success && profileResult.data) {
        setCyberProfile(profileResult.data);
        logger.info(`[HotVibes] Profile loaded for ${dbUser.user_id}. Level: ${profileResult.data.level}`);

        const leadsResult = await fetchLeadsForDashboard(dbUser.user_id, 'all');

        if (leadsResult.success && leadsResult.data) {
          const allFetchedLeads = leadsResult.data as LeadDataFromActions[];
          logger.info(`[HotVibes] Fetched ${allFetchedLeads.length} total leads.`);

          const potentiallyHotLeads = allFetchedLeads.filter(lead =>
            ['new', 'analyzed', 'offer_generated', 'interested', 'demo_generated', 'client_responded_positive'].includes(lead.status || '')
          );
          logger.info(`[HotVibes] Found ${potentiallyHotLeads.length} potentially hot leads after status filter.`);
          
          const typedAndFilteredLeads: HotLeadData[] = potentiallyHotLeads
            .map(mapLeadToHotLeadData)
            .filter(mappedLead => {
              const requiredQuest = mappedLead.required_quest_id;
              if (!profileResult.data) return false; 
              const isUnlocked = requiredQuest
                ? checkQuestUnlocked(requiredQuest, profileResult.data.completedQuests || [], QUEST_ORDER)
                : true;
              if(!isUnlocked) logger.debug(`[HotVibes] Lead ${mappedLead.id} for quest ${requiredQuest} is LOCKED for user.`);
              return isUnlocked;
            });

          setHotLeads(typedAndFilteredLeads);
          logger.info(`[HotVibes] Displaying ${typedAndFilteredLeads.length} accessible hot/potential leads.`);
        } else {
          addToast(t.errorLoadingLeads, "error");
          logger.error(`[HotVibes] Error fetching leads: ${leadsResult.error}`);
          setHotLeads([]);
        }
      } else {
        addToast(t.errorLoadingProfile, "error");
        logger.error(`[HotVibes] Error fetching profile: ${profileResult.error}`);
        setCyberProfile(null);
        setHotLeads([]);
      }
    } else {
      logger.info(`[HotVibes] User not authenticated or no dbUser.`);
      setCyberProfile(null);
      setHotLeads([]);
    }
    setPageLoading(false);
  }, [isAuthenticated, dbUser?.user_id, currentLang, t.errorLoadingLeads, t.errorLoadingProfile, appCtxLoading, isAuthenticating, addToast]);

  useEffect(() => {
    loadPageData();
  }, [loadPageData]);

  const handleExecuteMission = useCallback(async (leadId: string, questIdFromLead: string | undefined) => {
    if (!isAuthenticated || !dbUser?.user_id || !cyberProfile) {
      addToast("Аутентификация требуется", "error");
      return;
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

  // Define the theme for HotVibeCard
  const cardTheme: HotVibeCardTheme = {
    borderColor: "border-brand-red/70", 
    accentGradient: "bg-gradient-to-r from-brand-red via-brand-orange to-yellow-500", 
    modalOverlayGradient: "from-black/70 via-purple-900/50 to-black/80", // Adjusted for more subtlety
    modalAccentColor: "text-brand-cyan", 
    modalCardBg: "bg-black/70",          // Slightly more opaque for better contrast
    modalCardBorder: "border-white/20",  // Slightly more visible border
    modalImageOverlayGradient: "bg-gradient-to-t from-black/90 via-black/50 to-transparent", // Added this new theme property
  };

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
                  Загружено для Агента Уровня {cyberProfile.level} | Доступно вайбов: {hotLeads.length}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="p-2 sm:p-4 md:p-6 min-h-[200px]">
              {pageLoading && <TutorialLoader />}
              {!pageLoading && !isAuthenticated && (
                <p className="text-center text-muted-foreground py-8 font-mono text-sm sm:text-base">{t.noHotVibesForGuest}</p>
              )}
              {!pageLoading && isAuthenticated && hotLeads.length === 0 && (
                 <div className="text-center text-muted-foreground py-8 font-mono text-sm sm:text-base">
                    <VibeContentRenderer content={t.noHotVibes} />
                    <div className="mt-4">
                        <Button variant="outline" asChild className="border-brand-orange text-brand-orange hover:bg-brand-orange/10">
                            <Link href="/leads#scraperSectionAnchor">К Скрейперу в /leads</Link>
                        </Button>
                    </div>
                 </div>
              )}
              {!pageLoading && isAuthenticated && hotLeads.length > 0 && (
                <div className="grid grid-cols-2 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3 md:gap-4">
                  {hotLeads.map((lead) => (
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
    <Suspense fallback={<TutorialLoader />}>
      <HotVibesContent />
    </Suspense>
  )
}