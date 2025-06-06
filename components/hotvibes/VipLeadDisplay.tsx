"use client";

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { 
    Card, 
    CardContent, 
    CardHeader as ShadCardHeader, 
    CardTitle as ShadCardTitle, 
    CardDescription as ShadCardDescription 
} from '@/components/ui/card';
import { VibeContentRenderer } from '@/components/VibeContentRenderer';
import type { HotLeadData, HotVibeCardTheme } from './HotVibeCard'; 
import { FaCopy, FaLink, FaClipboardList, FaLightbulb, FaCommentsDollar, FaGamepad } from "react-icons/fa6"; 
import { toast } from 'sonner';
import { ELON_SIMULATOR_CARD_ID } from '@/app/hotvibes/page'; // Import constant

interface VipLeadDisplayProps {
  lead: HotLeadData;
  theme: HotVibeCardTheme;
  currentLang?: 'ru' | 'en';
  isMissionUnlocked: boolean;
  onExecuteMission: () => void;
}

const MODAL_BACKGROUND_FALLBACK_VIP = "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/cyberpunk-cityscape-artistic-4k-ax-1920x1080.jpg";
const PLACEHOLDER_DEMO_IMAGE_VIP = "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/vibe_city_neon_future-2d7a8b9e-a9f9-4b1f-8e4d-9f6a123b4c5d.jpg"; 

const vipPageTranslations = {
  ru: {
    pageTitleBase: "VIP Прототип для",
    elonPageTitle: "Симулятор 'Рынка Маска'",
    missionBriefing: "::FaListCheck className='mr-2 text-lg':: Брифинг Ультра-Миссии",
    budget: "Бюджет:", 
    taskType: "Тип Задачи:", 
    requiredSkill: "Ключевой Навык:", 
    clientStatus: "Статус Клиента:",
    fullDescription: "::FaClipboardList className='mr-2 text-lg':: Полное Техзадание", 
    draftOffer: "::FaCommentsDollar className='mr-2 text-lg':: Наше Готовое Предложение", 
    viewOriginalKwork: "Оригинал Заказа на KWork",
    copyOffer: "Копировать Предложение",
    executeMission: "::FaRocket className='mr-2':: Активировать VIBE & Запустить Миссию!",
    skillLocked: "::FaLock className='mr-2':: Требуется Апгрейд Навыка",
    noDescription: "Детальное описание проекта не предоставлено.",
    noOffer: "Предложение для этого проекта пока не сформировано.",
    goToSimulator: "::FaGamepad className='mr-2':: Перейти к Симулятору Маска"
  },
  en: {
    pageTitleBase: "VIP Prototype for",
    elonPageTitle: "Musk Market Simulator",
    missionBriefing: "::FaListCheck className='mr-2 text-lg':: Ultra-Mission Briefing",
    budget: "Budget:", 
    taskType: "Task Type:", 
    requiredSkill: "Key Skill:", 
    clientStatus: "Client Status:",
    fullDescription: "::FaClipboardList className='mr-2 text-lg':: Full Task Description", 
    draftOffer: "::FaCommentsDollar className='mr-2 text-lg':: Our Ready-Made Proposal", 
    viewOriginalKwork: "Original Order on KWork",
    copyOffer: "Copy Proposal",
    executeMission: "::FaRocket className='mr-2':: Activate VIBE & Launch Mission!",
    skillLocked: "::FaLock className='mr-2':: Skill Upgrade Required",
    noDescription: "Detailed project description not provided.",
    noOffer: "A proposal for this project has not been drafted yet.",
    goToSimulator: "::FaGamepad className='mr-2':: Go to Musk Simulator"
  }
};

export function VipLeadDisplay({ lead, theme, currentLang = 'ru', isMissionUnlocked, onExecuteMission }: VipLeadDisplayProps) {
  const isElonCard = lead.id === ELON_SIMULATOR_CARD_ID;
  const imageForHeroArea = lead.demo_image_url || MODAL_BACKGROUND_FALLBACK_VIP;
  const actualDemoImage = lead.demo_image_url || PLACEHOLDER_DEMO_IMAGE_VIP; 

  const handleCopyToClipboard = (text: string | null | undefined, message: string) => {
    if (!text) { toast.error("Нет текста для копирования."); return; }
    navigator.clipboard.writeText(text)
      .then(() => toast.success(message))
      .catch(err => toast.error(`Ошибка копирования: ${err.message}`));
  };

  const t = vipPageTranslations[currentLang];
  const pageTitle = isElonCard ? t.elonPageTitle : `${t.pageTitleBase} ${lead.client_name || lead.kwork_gig_title || (currentLang === 'ru' ? 'Агента' : 'Agent')}`;

  return (
    <Card className={cn(
        "overflow-hidden rounded-2xl border-2 backdrop-blur-2xl shadow-2xl w-full", 
        theme.borderColor, 
        `shadow-[0_0_70px_-20px_rgba(var(--brand-cyan-rgb),0.7)]`, 
        "bg-gradient-to-br from-dark-card/90 via-black/85 to-dark-card/90" 
    )}>
      <div className="relative w-full h-[40vh] sm:h-[50vh] md:h-[55vh] group overflow-hidden">
        <Image
            src={imageForHeroArea}
            alt={`${lead.kwork_gig_title || 'VIP Lead'} - Hero Background`}
            fill
            priority
            className="object-cover opacity-40 group-hover:opacity-50 transition-opacity duration-500 ease-out scale-105 group-hover:scale-110"
        />
        <div className={cn("absolute inset-0", theme.modalImageOverlayGradient || "bg-gradient-to-t from-black/90 via-black/40 to-transparent")} />
        <div className="absolute inset-0 flex flex-col justify-center items-center text-center p-4 sm:p-6 md:p-8 z-10">
            <VibeContentRenderer content={`::${isElonCard ? 'FaGamepad' : 'FaEye'} className="text-6xl sm:text-7xl mb-4 ${theme.modalAccentColor || 'text-brand-cyan'} opacity-80 text-glow-cyan"::`} />
            <h1 className={cn(
                "font-orbitron text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold line-clamp-3 leading-tight", 
                theme.modalAccentColor || "text-brand-cyan", 
                "text-glow-cyan drop-shadow-2xl"
                )}
                data-text={pageTitle}
            >
                {pageTitle}
            </h1>
            {lead.ai_summary && <p className="text-sm sm:text-base text-gray-300/90 mt-3 line-clamp-3 font-mono max-w-xl">{lead.ai_summary}</p>}
        </div>
      </div>

      <div className="p-4 sm:p-6 md:p-8 space-y-5 sm:space-y-6 font-mono">
        
        {!isElonCard && (
            <Card className={cn("border p-3.5 sm:p-4 shadow-lg backdrop-blur-sm", theme.modalCardBg || "bg-black/60", theme.modalCardBorder || "border-white/15")}>
                <ShadCardHeader className="p-0 mb-2 sm:mb-2.5">
                    <ShadCardTitle className={cn("text-md sm:text-lg font-orbitron flex items-center", theme.modalAccentColor || "text-brand-cyan")}>
                        <VibeContentRenderer content={t.missionBriefing}/>
                    </ShadCardTitle>
                </ShadCardHeader>
                <CardContent className="p-0 text-xs sm:text-sm space-y-1.5 text-gray-200">
                    {lead.potential_earning && <p><VibeContentRenderer content="::FaMoneyBillWave className='text-brand-green mr-2':: "/>{t.budget} <span className="font-semibold text-white">{lead.potential_earning}</span></p>}
                    {lead.project_type_guess && <p><VibeContentRenderer content="::FaLightbulb className='text-brand-yellow mr-2':: "/>{t.taskType} <span className="font-semibold text-white">{lead.project_type_guess}</span></p>}
                    {lead.required_quest_id && lead.required_quest_id !== "none" && <p><VibeContentRenderer content="::FaBoltLightning className='text-brand-orange mr-2':: "/>{t.requiredSkill} <span className="font-semibold text-white">{lead.required_quest_id}</span></p>}
                    {lead.client_response_snippet && <p className="text-brand-lime"><VibeContentRenderer content="::FaCommentDots className='text-brand-lime mr-2':: "/>{t.clientStatus} <span className="font-semibold text-white italic">"{lead.client_response_snippet}"</span></p>}
                </CardContent>
            </Card>
        )}

        <div className="pt-1">
            <ShadCardHeader className="p-0 mb-1.5 sm:mb-2">
                <ShadCardTitle className={cn("text-md sm:text-lg font-orbitron flex items-center", theme.modalAccentColor || "text-brand-purple")}>
                    <VibeContentRenderer content={t.fullDescription}/>
                </ShadCardTitle>
            </ShadCardHeader>
            <CardContent className={cn("p-3.5 sm:p-4 rounded-lg text-sm sm:text-base text-gray-300/95 whitespace-pre-wrap break-words max-h-72 overflow-y-auto simple-scrollbar border", theme.modalCardBg, theme.modalCardBorder)}>
                <VibeContentRenderer content={lead.project_description || t.noDescription} />
            </CardContent>
        </div>
        
        {lead.ai_generated_proposal_draft && !isElonCard && (
            <div className="pt-1">
                 <ShadCardHeader className="p-0 flex flex-row justify-between items-center mb-1.5 sm:mb-2">
                    <ShadCardTitle className={cn("text-md sm:text-lg font-orbitron flex items-center", theme.modalAccentColor || "text-brand-pink")}>
                        <VibeContentRenderer content={t.draftOffer}/>
                    </ShadCardTitle>
                    <div className="flex items-center gap-1.5 sm:gap-2">
                        {lead.kwork_url && (
                            <Link href={lead.kwork_url} target="_blank" rel="noopener noreferrer" passHref legacyBehavior>
                            <Button variant="outline" size="sm" className={cn("h-8 px-2.5 py-1 text-xs border-brand-blue/60 text-brand-blue hover:bg-brand-blue/10 hover:text-blue-300", `focus:ring-brand-blue`)} title={t.viewOriginalKwork}>
                                <FaLink className="mr-1.5 h-3.5 w-3.5"/> {currentLang === 'ru' ? 'KWork' : 'Order'}
                            </Button>
                            </Link>
                        )}
                        <Button variant="outline" size="sm" className={cn("h-8 px-2.5 py-1 text-xs border-brand-pink/60 text-brand-pink hover:bg-brand-pink/10 hover:text-pink-300", `focus:ring-brand-pink`)}
                                title={t.copyOffer}
                                onClick={() => handleCopyToClipboard(lead.ai_generated_proposal_draft, currentLang === 'ru' ? "Предложение скопировано!" : "Proposal copied!")}>
                            <FaCopy className="mr-1.5 h-3.5 w-3.5"/> {currentLang === 'ru' ? 'Копи' : 'Copy'}
                        </Button>
                    </div>
                </ShadCardHeader>
                <CardContent className={cn("p-3.5 sm:p-4 rounded-lg text-sm sm:text-base text-gray-300/95 whitespace-pre-wrap break-words max-h-96 overflow-y-auto simple-scrollbar border", theme.modalCardBg, theme.modalCardBorder)}>
                     <VibeContentRenderer content={lead.ai_generated_proposal_draft || t.noOffer} />
                </CardContent>
            </div>
        )}

        {lead.demo_image_url && lead.demo_image_url !== imageForHeroArea && !isElonCard && (
             <div className="pt-3">
                <ShadCardHeader className="p-0 mb-1.5 sm:mb-2">
                    <ShadCardTitle className={cn("text-md sm:text-lg font-orbitron flex items-center", theme.modalAccentColor || "text-brand-green")}>
                        <VibeContentRenderer content="::FaImage:: Демонстрация Прототипа"/>
                    </ShadCardTitle>
                </ShadCardHeader>
                <div className="aspect-video relative w-full rounded-lg overflow-hidden border-2 border-white/20 shadow-xl">
                    <Image
                        src={actualDemoImage}
                        alt={`Actual demo for ${lead.kwork_gig_title || 'VIP Lead'}`}
                        fill
                        className="object-contain"
                        onError={(e) => { (e.target as HTMLImageElement).src = MODAL_BACKGROUND_FALLBACK_VIP; }}
                    />
                </div>
            </div>
        )}

        <div className="pt-5 sm:pt-8">
            <Button
            onClick={onExecuteMission} // This will handle navigation for Elon card too
            disabled={!isMissionUnlocked && !isElonCard} // Elon card doesn't need mission unlock, but has access check
            variant="default"
            size="lg" 
            className={cn(
                "w-full font-orbitron text-base sm:text-lg py-3.5 shadow-xl hover:shadow-2xl",
                (isMissionUnlocked || isElonCard) ? `${theme.accentGradient} text-black hover:brightness-125 active:scale-95` : "bg-muted text-muted-foreground cursor-not-allowed"
            )}
            >
            <VibeContentRenderer content={isElonCard ? t.goToSimulator : (isMissionUnlocked ? t.executeMission : t.skillLocked)} />
            </Button>
        </div>
      </div>
    </Card>
  );
}