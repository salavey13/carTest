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
  markTutorialAsCompleted, // For the "tinted lock" auto-completion idea
} from '@/hooks/cyberFitnessSupabase';
import { fetchLeadsForDashboard } from '../leads/actions';
import type { Lead as LeadDataFromActions } from '../leads/actions'; // Type from actions.ts
import { HotVibeCard, HotLeadData } from '@/components/hotvibes/HotVibeCard';
import { debugLogger as logger } from "@/lib/debugLogger";
import { useAppToast } from '@/hooks/useAppToast';

const pageTranslations = {
    ru: {
        pageTitle: "::FaFireAlt:: ГОРЯЧИЕ ВАЙБЫ ::FaFireAlt::",
        pageSubtitle: "Агент! Это твой доступ к самым перспективным возможностям. Клиенты уже ждут. Выбирай миссию, применяй навыки, зарабатывай KiloVibes и реальный кэш!",
        lobbyTitle: "::FaConciergeBell:: Лобби Горячих Возможностей",
        noHotVibes: "Пока нет горячих вайбов, подходящих твоему уровню. Прокачивайся в Тренировках или загляни позже!",
        noHotVibesForGuest: "Доступ к горячим вайбам открывается после базовой аутентификации. Войди через Telegram, чтобы начать!",
        missionActivated: "Миссия активирована! Перенаправление...",
        errorLoadingLeads: "Ошибка загрузки горячих вайбов.",
        errorLoadingProfile: "Не удалось загрузить профиль CyberFitness.",
        lockedMissionRedirect: "Навык для этой миссии еще не открыт. Начинаем экспресс-тренировку 'Сапёр Иконок'...",
    },
    en: {
        pageTitle: "::FaFireAlt:: HOT VIBES ::FaFireAlt::",
        pageSubtitle: "Agent! This is your access to the most promising opportunities. Clients are waiting. Choose your mission, apply your skills, earn KiloVibes and real cash!",
        lobbyTitle: "::FaConciergeBell:: Hot Opportunity Lobby",
        noHotVibes: "No hot vibes matching your level yet. Level up in Training or check back later!",
        noHotVibesForGuest: "Access to Hot Vibes unlocks after basic authentication. Log in via Telegram to start!",
        missionActivated: "Mission Activated! Redirecting...",
        errorLoadingLeads: "Error loading hot vibes.",
        errorLoadingProfile: "Failed to load CyberFitness profile.",
        lockedMissionRedirect: "Skill for this mission not yet unlocked. Initiating express 'Icon Sweeper' training...",
    }
};

// Ensure HotLeadData includes all necessary fields from LeadDataFromActions
// For simplicity, we can make HotLeadData an extension or ensure it covers all fields.
// Here, we assume HotLeadData is compatible or you'll map fields.

function HotVibesContent() {
  const router = useRouter();
  const { dbUser, isAuthenticated, user: tgUser, isLoading: appCtxLoading, isAuthenticating } = useAppContext();
  const { addToast } = useAppToast();
  const heroTriggerId = useId().replace(/:/g, "-") + "-hotvibes-hero-trigger";
  const [currentLang, setCurrentLang] = useState<'ru' | 'en'>('ru');

  const [cyberProfile, setCyberProfile] = useState<CyberFitnessProfile | null>(null);
  const [hotLeads, setHotLeads] = useState<HotLeadData[]>([]);
  const [pageLoading, setPageLoading] = useState(true);

  const t = pageTranslations[currentLang];

  useEffect(() => {
    setCurrentLang(tgUser?.language_code === 'ru' ? 'ru' : 'en');
  }, [tgUser?.language_code]);

  const loadPageData = useCallback(async () => {
    if (appCtxLoading || isAuthenticating) {
        logger.debug("[HotVibes] AppContext still loading/authenticating. Waiting.");
        return;
    }
    setPageLoading(true);
    logger.info(`[HotVibes] Attempting to load page data. Authenticated: ${isAuthenticated}, DB User ID: ${dbUser?.user_id}`);

    if (isAuthenticated && dbUser?.user_id) {
      const profileResult = await fetchUserCyberFitnessProfile(dbUser.user_id);
      if (profileResult.success && profileResult.data) {
        setCyberProfile(profileResult.data);
        logger.info(`[HotVibes] Profile loaded for ${dbUser.user_id}. Level: ${profileResult.data.level}, Completed Quests: ${profileResult.data.completedQuests.join(', ')}`);

        // Fetch leads with a status indicating client has responded positively
        // Using 'interested' as the placeholder for "client_responded_hot"
        const leadsResult = await fetchLeadsForDashboard(dbUser.user_id, 'interested');
        
        if (leadsResult.success && leadsResult.data) {
          const allHotLeadsFromDb = leadsResult.data as LeadDataFromActions[];
          const typedHotLeads: HotLeadData[] = allHotLeadsFromDb.map(lead => ({
            id: lead.id || `fallback_id_${Math.random()}`,
            kwork_gig_title: lead.client_name || lead.project_description?.substring(0,50), // Example mapping
            ai_summary: lead.project_description?.substring(0, 100), // Example
            demo_image_url: lead.supervibe_studio_links?.demo_image_url || undefined, // Assuming this structure
            potential_earning: lead.budget_range || undefined,
            required_kilovibes: undefined, // This would need to be set on the lead or derived
            // @ts-ignore - Assuming lead object might have required_quest_id; ensure it's in your LeadDataFromActions or add logic
            required_quest_id: lead.required_quest_id || undefined,
            client_response_snippet: lead.notes?.substring(0, 50) || undefined, // Example
            kwork_url: lead.lead_url,
            project_description: lead.project_description,
            ai_generated_proposal_draft: lead.generated_offer,
            status: lead.status,
          }));
          setHotLeads(typedHotLeads);
          logger.info(`[HotVibes] Fetched ${typedHotLeads.length} leads with 'interested' status (or your 'hot' filter).`);
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
      logger.info(`[HotVibes] User not authenticated. Clearing profile and leads.`);
      setCyberProfile(null);
      setHotLeads([]);
    }
    setPageLoading(false);
  }, [isAuthenticated, dbUser?.user_id, currentLang, t, appCtxLoading, isAuthenticating, addToast]);

  useEffect(() => {
    loadPageData();
  }, [loadPageData]);

  const handleExecuteMission = useCallback(async (leadId: string, questIdFromLead: string | undefined) => {
    if (!isAuthenticated || !dbUser?.user_id || !cyberProfile) {
      addToast("Аутентификация требуется", "error");
      return;
    }

    const requiredQuestId = questIdFromLead || "icon-swap-mission"; // Default to icon-swap if not specified
    
    const isUnlocked = checkQuestUnlocked(requiredQuestId, cyberProfile.completedQuests, QUEST_ORDER);

    if (!isUnlocked) {
      addToast(t.lockedMissionRedirect, "info", 5000);
      // Auto-complete the prerequisite quest (e.g., icon-swap) if this is the desired "tinted lock" behavior
      // For this example, we'll assume icon-swap is the universal prerequisite if not specified.
      await markTutorialAsCompleted(dbUser.user_id, "icon-swap-mission"); // The ID of the first basic tutorial
      // Re-fetch profile to reflect unlocked quest
      const updatedProfileResult = await fetchUserCyberFitnessProfile(dbUser.user_id);
      if (updatedProfileResult.success && updatedProfileResult.data) {
        setCyberProfile(updatedProfileResult.data);
      }
      // Then redirect to the tutorial page for that skill.
      router.push(`/tutorials/${requiredQuestId}`); // Redirect to the specific tutorial for "training"
      return;
    }

    addToast(`${t.missionActivated} (Lead: ${leadId.substring(0,6)}..., Quest: ${requiredQuestId})`, "success");
    router.push(`/repo-xml?leadId=${leadId}&questId=${requiredQuestId}&flow=liveFireMission`);

  }, [isAuthenticated, dbUser, cyberProfile, router, t, addToast]);


  return (
    <div className="relative min-h-screen bg-gradient-to-br from-background via-black to-card text-foreground overflow-x-hidden">
      <RockstarHeroSection
        title={t.pageTitle}
        subtitle={t.pageSubtitle}
        triggerElementSelector={`#${heroTriggerId}`}
        backgroundImageObjectUrl="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/appStore/webanybot_logo_stacked_transparent_glowing.png"
        mainBackgroundImageUrl="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/abstract_bg_002-246689a1-5d5d-474d-871b-435431844157.jpg"
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
                  Загружено для Агента Уровня {cyberProfile.level} | Доступно горячих вайбов: {hotLeads.length}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="p-2 sm:p-4 md:p-6 min-h-[200px]">
              {pageLoading && <TutorialLoader />}
              {!pageLoading && !isAuthenticated && (
                <p className="text-center text-muted-foreground py-8 font-mono text-sm sm:text-base">{t.noHotVibesForGuest}</p>
              )}
              {!pageLoading && isAuthenticated && hotLeads.length === 0 && (
                <p className="text-center text-muted-foreground py-8 font-mono text-sm sm:text-base">{t.noHotVibes}</p>
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