// /app/hotvibes/page.tsx
"use client";

import React, { useState, useEffect, Suspense, useCallback, useId } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
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
import type { LeadRow as LeadDataFromActions } from '../leads/actions'; // Use LeadRow from actions
import { HotVibeCard, HotLeadData } from '@/components/hotvibes/HotVibeCard'; // Ensure HotLeadData is well-defined
import { debugLogger as logger } from "@/lib/debugLogger";
import { useAppToast } from '@/hooks/useAppToast';

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
        lockedMissionRedirect: "Навык для этой миссии еще не открыт. Начинаем экспресс-тренировку...", // Generic message
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

// Ensure your leads table has a column like 'required_quest_id_for_hotvibe' TEXT NULLABLE
// or derive it based on project_type_guess or other logic in fetchLeadsForDashboard
// For HotLeadData, make sure all fields are optional or have fallbacks
function mapLeadToHotLeadData(lead: LeadDataFromActions): HotLeadData {
  return {
    id: lead.id || `fallback_id_${Math.random()}`,
    kwork_gig_title: lead.client_name || lead.project_description?.substring(0, 50) || "Untitled Gig",
    ai_summary: lead.project_description?.substring(0, 100) || "No summary available.",
    // Assuming you'll add a specific field for demo images in your 'leads' table
    // For now, using a placeholder or a field if it exists
    demo_image_url: (lead.supervibe_studio_links as any)?.demo_image_url || undefined,
    potential_earning: lead.budget_range || undefined,
    // required_kilovibes: lead.required_kilovibes_for_hotvibe || undefined, // Example field
    // required_quest_id: lead.required_quest_id_for_hotvibe || undefined, // Example field
    // For testing, let's assign a default quest if none is specified for the lead
    required_quest_id: (lead as any).required_quest_id_for_hotvibe || "image-swap-mission", // TEMP: Default for display
    client_response_snippet: lead.status === 'interested' ? "Client showed interest!" : undefined, // Example
    kwork_url: lead.lead_url,
    project_description: lead.project_description,
    ai_generated_proposal_draft: lead.generated_offer,
    status: lead.status,
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
    setCurrentLang(tgUser?.language_code === 'ru' || platform === 'ios' || platform === 'android' ? 'ru' : 'en'); // Default to RU for mobile TG
  }, [tgUser?.language_code, platform]);

  const loadPageData = useCallback(async () => {
    if (appCtxLoading || isAuthenticating) {
        logger.debug("[HotVibes] AppContext still loading/authenticating. Waiting.");
        setPageLoading(true); // Ensure loading state is true
        return;
    }
    setPageLoading(true);
    logger.info(`[HotVibes] Attempting to load page data. Authenticated: ${isAuthenticated}, DB User ID: ${dbUser?.user_id}`);

    if (isAuthenticated && dbUser?.user_id) {
      const profileResult = await fetchUserCyberFitnessProfile(dbUser.user_id);
      if (profileResult.success && profileResult.data) {
        setCyberProfile(profileResult.data);
        logger.info(`[HotVibes] Profile loaded for ${dbUser.user_id}. Level: ${profileResult.data.level}, Completed Quests: ${profileResult.data.completedQuests.join(', ')}`);

        // UNHARDENED FILTER: Fetch 'new', 'analyzed', 'offer_generated', or 'interested' leads
        // This will likely fetch many. Consider pagination in fetchLeadsForDashboard if it becomes an issue.
        // For now, fetching all that could potentially be "hot" or become "hot".
        // The "filter" param in fetchLeadsForDashboard needs to support an array of statuses or a special keyword.
        // Let's assume for now 'all' fetches everything an admin/support can see, and we filter client-side.
        // Or, if 'all' is too much, start with 'new' or 'analyzed'.
        const leadsResult = await fetchLeadsForDashboard(dbUser.user_id, 'all'); // Fetching more broadly

        if (leadsResult.success && leadsResult.data) {
          const allFetchedLeads = leadsResult.data as LeadDataFromActions[];
          logger.info(`[HotVibes] Fetched ${allFetchedLeads.length} total leads for potential display.`);

          // Filter for statuses that could be "hot" or "pre-hot"
          const potentiallyHotLeads = allFetchedLeads.filter(lead =>
            ['new', 'analyzed', 'offer_generated', 'interested', 'demo_generated', 'client_responded_positive'].includes(lead.status || '')
          );
          logger.info(`[HotVibes] Found ${potentiallyHotLeads.length} potentially hot leads after status filter.`);

          const typedAndFilteredLeads: HotLeadData[] = potentiallyHotLeads
            .map(mapLeadToHotLeadData) // Map to HotLeadData structure
            .filter(mappedLead => { // Now filter by quest unlock on the mapped data
              const requiredQuest = mappedLead.required_quest_id;
              // For now, if profile is loading, assume quests are locked to avoid premature display flicker.
              // Or, always show but disable button if profile not loaded yet.
              // Here, assuming we wait for profile.
              if (!profileResult.data) return false; // Don't show if profile isn't loaded
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
      logger.info(`[HotVibes] User not authenticated or no dbUser. Clearing profile and leads.`);
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

    const targetQuestId = questIdFromLead || "icon-swap-mission"; // Default prerequisite
    const isActuallyUnlocked = checkQuestUnlocked(targetQuestId, cyberProfile.completedQuests, QUEST_ORDER);

    if (!isActuallyUnlocked) {
      addToast(t.lockedMissionRedirect.replace("...", `'${targetQuestId}'`), "info", 7000);
      // Attempt to auto-complete the 'icon-swap-mission' as the universal basic skill.
      // This simulates the "tinted lock" auto-training for the very first barrier.
      // For other quests, you might just redirect to their specific tutorial.
      if (targetQuestId === "icon-swap-mission" && !cyberProfile.completedQuests.includes("icon-swap-mission")) {
        await markTutorialAsCompleted(dbUser.user_id, "icon-swap-mission");
        const updatedProfileResult = await fetchUserCyberFitnessProfile(dbUser.user_id); // Re-fetch
        if (updatedProfileResult.success && updatedProfileResult.data) {
          setCyberProfile(updatedProfileResult.data);
          // Now it *should* be unlocked, try to proceed to repo-xml
          // Or, better, redirect to the tutorial to reinforce, then they come back
           router.push(`/tutorials/icon-swap?nextLead=${leadId}&nextQuest=${targetQuestId}`);
           return;
        }
      } else {
         router.push(`/tutorials/${targetQuestId}?nextLead=${leadId}&nextQuest=${targetQuestId}`); // Redirect to the specific tutorial
         return;
      }
    }

    // If skill is already unlocked, proceed to execution
    addToast(`${t.missionActivated} (Lead: ${leadId.substring(0,6)}..., Quest: ${targetQuestId})`, "success");
    router.push(`/repo-xml?leadId=${leadId}&questId=${targetQuestId}&flow=liveFireMission`);

  }, [isAuthenticated, dbUser, cyberProfile, router, t.lockedMissionRedirect, t.missionActivated, addToast]);

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
          <Card className={cn("bg-dark-card/90 backdrop-blur-xl border-2 shadow-2xl border-brand-red/70 shadow-[0_0_35px_rgba(var(--brand-red-rgb),0.5)]")}>
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