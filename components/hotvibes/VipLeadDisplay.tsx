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
import { ELON_SIMULATOR_CARD_ID } from '@/app/hotvibes/page'; 

interface VipLeadDisplayProps {
  lead: HotLeadData;
  theme: HotVibeCardTheme; // Убедимся, что theme всегда передается
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
    missionBriefing: "::FaListCheck className='mr-1.5 sm:mr-2 text-base sm:text-lg':: Брифинг Ультра-Миссии",
    budget: "Бюджет:", 
    taskType: "Тип Задачи:", 
    requiredSkill: "Ключевой Навык:", 
    clientStatus: "Статус Клиента:",
    fullDescription: "::FaClipboardList className='mr-1.5 sm:mr-2 text-base sm:text-lg':: Полное Техзадание", 
    draftOffer: "::FaCommentsDollar className='mr-1.5 sm:mr-2 text-base sm:text-lg':: Наше Готовое Предложение", 
    viewOriginalKwork: "Оригинал", 
    copyOffer: "Копи", 
    executeMission: "::FaRocket className='mr-1.5 sm:mr-2':: Активировать VIBE!", 
    skillLocked: "::FaLock className='mr-1.5 sm:mr-2':: Навык Заблокирован",
    noDescription: "Детальное описание проекта не предоставлено.",
    noOffer: "Предложение для этого проекта пока не сформировано.",
    goToSimulator: "::FaGamepad className='mr-1.5 sm:mr-2':: К Симулятору Маска"
  },
  en: {
    pageTitleBase: "VIP Prototype for",
    elonPageTitle: "Musk Market Simulator",
    missionBriefing: "::FaListCheck className='mr-1.5 sm:mr-2 text-base sm:text-lg':: Ultra-Mission Briefing",
    budget: "Budget:", 
    taskType: "Task Type:", 
    requiredSkill: "Key Skill:", 
    clientStatus: "Client Status:",
    fullDescription: "::FaClipboardList className='mr-1.5 sm:mr-2 text-base sm:text-lg':: Full Task Description", 
    draftOffer: "::FaCommentsDollar className='mr-1.5 sm:mr-2 text-base sm:text-lg':: Our Ready-Made Proposal", 
    viewOriginalKwork: "Order", 
    copyOffer: "Copy", 
    executeMission: "::FaRocket className='mr-1.5 sm:mr-2':: Activate VIBE!", 
    skillLocked: "::FaLock className='mr-1.5 sm:mr-2':: Skill Locked",
    noDescription: "Detailed project description not provided.",
    noOffer: "A proposal for this project has not been drafted yet.",
    goToSimulator: "::FaGamepad className='mr-1.5 sm:mr-2':: Go to Musk Simulator"
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
        "overflow-hidden rounded-xl sm:rounded-2xl backdrop-blur-lg sm:backdrop-blur-2xl shadow-xl sm:shadow-2xl w-full", 
        theme.borderColor ? `border ${theme.borderColor}` : "border-transparent", // Управляем рамкой через theme
        `shadow-[0_0_30px_-10px_rgba(var(--brand-cyan-rgb),0.5)] sm:shadow-[0_0_70px_-20px_rgba(var(--brand-cyan-rgb),0.7)]`, 
        "bg-gradient-to-br from-black/80 via-slate-900/70 to-black/80" 
    )}>
      <div className="relative w-full h-[35vh] sm:h-[45vh] md:h-[50vh] group overflow-hidden">
        <Image
            src={imageForHeroArea}
            alt={`${lead.kwork_gig_title || 'VIP Lead'} - Hero Background`}
            fill
            priority
            className="object-cover opacity-30 sm:opacity-40 group-hover:opacity-40 sm:group-hover:opacity-50 transition-opacity duration-500 ease-out scale-105 group-hover:scale-110"
        />
        <div className={cn("absolute inset-0", theme.modalImageOverlayGradient || "bg-gradient-to-t from-black/80 via-black/30 to-transparent")} />
        <div className="absolute inset-0 flex flex-col justify-center items-center text-center p-3 sm:p-4 md:p-6 z-10">
            <VibeContentRenderer content={`::${isElonCard ? 'FaGamepad' : 'FaEye'} className="text-5xl sm:text-6xl mb-3 ${theme.modalAccentColor || 'text-brand-cyan'} opacity-80 text-glow-cyan"::`} />
            <h1 className={cn(
                "font-orbitron text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold line-clamp-3 leading-tight", 
                theme.modalAccentColor || "text-brand-cyan", 
                "text-glow-cyan drop-shadow-lg sm:drop-shadow-2xl"
                )}
                data-text={pageTitle}
            >
                {pageTitle}
            </h1>
            {lead.ai_summary && <p className="text-xs sm:text-sm text-gray-300/80 mt-2 sm:mt-3 line-clamp-2 sm:line-clamp-3 font-mono max-w-md sm:max-w-xl px-2">{lead.ai_summary}</p>}
        </div>
      </div>

      <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-5 font-mono">
        
        {!isElonCard && (
            <Card className={cn("p-3 sm:p-3.5 shadow-md backdrop-blur-sm rounded-lg", theme.modalCardBg || "bg-black/50", theme.modalCardBorder ? `border ${theme.modalCardBorder}` : "border-transparent")}>
                <ShadCardHeader className="p-0 mb-1.5 sm:mb-2">
                    <ShadCardTitle className={cn("text-sm sm:text-md font-orbitron flex items-center", theme.modalAccentColor || "text-brand-cyan")}>
                        <VibeContentRenderer content={t.missionBriefing}/>
                    </ShadCardTitle>
                </ShadCardHeader>
                <CardContent className="p-0 text-xs space-y-1 text-gray-200/90">
                    {lead.potential_earning && <p><VibeContentRenderer content="::FaMoneyBillWave className='text-brand-green mr-1.5 sm:mr-2':: "/>{t.budget} <span className="font-semibold text-white">{lead.potential_earning}</span></p>}
                    {lead.project_type_guess && <p><VibeContentRenderer content="::FaLightbulb className='text-brand-yellow mr-1.5 sm:mr-2':: "/>{t.taskType} <span className="font-semibold text-white">{lead.project_type_guess}</span></p>}
                    {lead.required_quest_id && lead.required_quest_id !== "none" && <p><VibeContentRenderer content="::FaBoltLightning className='text-brand-orange mr-1.5 sm:mr-2':: "/>{t.requiredSkill} <span className="font-semibold text-white">{lead.required_quest_id}</span></p>}
                    {lead.client_response_snippet && <p className="text-brand-lime"><VibeContentRenderer content="::FaCommentDots className='text-brand-lime mr-1.5 sm:mr-2':: "/>{t.clientStatus} <span className="font-semibold text-white italic">"{lead.client_response_snippet}"</span></p>}
                </CardContent>
            </Card>
        )}

        <div className="pt-0.5">
            <ShadCardHeader className="p-0 mb-1 sm:mb-1.5">
                <ShadCardTitle className={cn("text-sm sm:text-md font-orbitron flex items-center", theme.modalAccentColor || "text-brand-purple")}>
                    <VibeContentRenderer content={t.fullDescription}/>
                </ShadCardTitle>
            </ShadCardHeader>
            <CardContent className={cn("p-3 sm:p-3.5 rounded-lg text-xs sm:text-sm text-gray-300/90 whitespace-pre-wrap break-words max-h-60 sm:max-h-72 overflow-y-auto simple-scrollbar", theme.modalCardBg || "bg-black/40", theme.modalCardBorder ? `border ${theme.modalCardBorder}` : "border-transparent" )}>
                <VibeContentRenderer content={lead.project_description || t.noDescription} />
            </CardContent>
        </div>
        
        {lead.ai_generated_proposal_draft && !isElonCard && (
            <div className="pt-0.5">
                 <ShadCardHeader className="p-0 flex flex-row justify-between items-center mb-1 sm:mb-1.5">
                    <ShadCardTitle className={cn("text-sm sm:text-md font-orbitron flex items-center", theme.modalAccentColor || "text-brand-pink")}>
                        <VibeContentRenderer content={t.draftOffer}/>
                    </ShadCardTitle>
                    <div className="flex items-center gap-1 sm:gap-1.5">
                        {lead.kwork_url && (
                            <Link href={lead.kwork_url} target="_blank" rel="noopener noreferrer" passHref legacyBehavior>
                            <Button variant="outline" size="xs" className={cn("h-7 sm:h-8 px-2 py-1 text-[0.65rem] sm:text-xs border-brand-blue/50 text-brand-blue hover:bg-brand-blue/10 hover:text-blue-300", `focus:ring-brand-blue`)} title={t.viewOriginalKwork}>
                                <FaLink className="mr-1 h-3 w-3 sm:h-3.5 sm:w-3.5"/> {t.viewOriginalKwork}
                            </Button>
                            </Link>
                        )}
                        <Button variant="outline" size="xs" className={cn("h-7 sm:h-8 px-2 py-1 text-[0.65rem] sm:text-xs border-brand-pink/50 text-brand-pink hover:bg-brand-pink/10 hover:text-pink-300", `focus:ring-brand-pink`)}
                                title={t.copyOffer}
                                onClick={() => handleCopyToClipboard(lead.ai_generated_proposal_draft, currentLang === 'ru' ? "Предложение скопировано!" : "Proposal copied!")}>
                            <FaCopy className="mr-1 h-3 w-3 sm:h-3.5 sm:w-3.5"/> {t.copyOffer}
                        </Button>
                    </div>
                </ShadCardHeader>
                <CardContent className={cn("p-3 sm:p-3.5 rounded-lg text-xs sm:text-sm text-gray-300/90 whitespace-pre-wrap break-words max-h-80 sm:max-h-96 overflow-y-auto simple-scrollbar", theme.modalCardBg || "bg-black/40", theme.modalCardBorder ? `border ${theme.modalCardBorder}` : "border-transparent" )}>
                     <VibeContentRenderer content={lead.ai_generated_proposal_draft || t.noOffer} />
                </CardContent>
            </div>
        )}

        {lead.demo_image_url && lead.demo_image_url !== imageForHeroArea && !isElonCard && (
             <div className="pt-2 sm:pt-3">
                <ShadCardHeader className="p-0 mb-1 sm:mb-1.5">
                    <ShadCardTitle className={cn("text-sm sm:text-md font-orbitron flex items-center", theme.modalAccentColor || "text-brand-green")}>
                        <VibeContentRenderer content="::FaImage className='mr-1.5 sm:mr-2':: Демонстрация Прототипа"/>
                    </ShadCardTitle>
                </ShadCardHeader>
                <div className="aspect-video relative w-full rounded-md sm:rounded-lg overflow-hidden shadow-lg"> 
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

        <div className="pt-4 sm:pt-6">
            <Button
            onClick={onExecuteMission} 
            disabled={!isMissionUnlocked && !isElonCard}
            variant="default"
            size="lg" 
            className={cn(
                "w-full font-orbitron text-sm sm:text-base py-3 sm:py-3.5 shadow-lg hover:shadow-xl",
                (isMissionUnlocked || isElonCard) ? `${theme.accentGradient} text-black hover:brightness-110 active:scale-95` : "bg-muted text-muted-foreground cursor-not-allowed"
            )}
            >
            <VibeContentRenderer content={isElonCard ? t.goToSimulator : (isMissionUnlocked ? t.executeMission : t.skillLocked)} />
            </Button>
        </div>
      </div>
    </Card>
  );
}