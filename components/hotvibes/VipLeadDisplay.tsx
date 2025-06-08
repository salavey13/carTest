"use client";

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { 
    Card, 
    CardContent, 
    CardHeader as ShadCardHeader, // Renamed to avoid conflict if CardHeader is used from this file directly
    CardTitle as ShadCardTitle, 
    // CardDescription as ShadCardDescription // Not used here, can be removed
} from '@/components/ui/card';
import { VibeContentRenderer } from '@/components/VibeContentRenderer';
import type { HotLeadData } from './HotVibeCard'; 
import { FaCopy, FaLink, /*FaListCheck, FaCommentsDollar, FaGamepad,*/ FaRocket, FaLock } from "react-icons/fa6"; 
import { toast } from 'sonner';
import { ELON_SIMULATOR_CARD_ID, PERSONALITY_REPORT_PDF_CARD_ID } from '@/app/hotvibes/page'; // Import card IDs

interface VipLeadDisplayProps {
  lead: HotLeadData;
  currentLang?: 'ru' | 'en';
  isMissionUnlocked: boolean; // For regular missions
  onExecuteMission: () => void;
  onSupportMission: (lead: HotLeadData) => void; // Added for purchasing access to special cards
  isSupported: boolean; // To know if the special card is already purchased
  isPurchasePending: boolean; // To disable purchase button during processing
  translations: Record<string, any>; // From parent page
  isAuthenticated: boolean; // To enable/disable purchase button
}

const MODAL_BACKGROUND_FALLBACK_VIP = "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/cyberpunk-cityscape-artistic-4k-ax-1920x1080.jpg";
const PLACEHOLDER_DEMO_IMAGE_VIP = "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/vibe_city_neon_future-2d7a8b9e-a9f9-4b1f-8e4d-9f6a123b4c5d.jpg"; 

const vipPageTranslations = { // Keep local or pass t directly if it includes all these
  ru: {
    pageTitleBase: "VIP Прототип для",
    elonPageTitle: "Симулятор 'Рынка Маска'",
    pdfGenPageTitle: "Генератор PDF: Расшифровка Личности",
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
    goToSimulator: "::FaGamepad className='mr-1.5 sm:mr-2':: К Симулятору Маска",
    goToPdfGenerator: "::FaFilePdf className='mr-1.5 sm:mr-2':: К Генератору PDF",
    purchaseAccess: "::FaKey className='mr-1.5 sm:mr-2':: Купить Доступ",
  },
  en: {
    pageTitleBase: "VIP Prototype for",
    elonPageTitle: "Musk Market Simulator",
    pdfGenPageTitle: "PDF Generator: Personality Insights",
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
    goToSimulator: "::FaGamepad className='mr-1.5 sm:mr-2':: Go to Musk Simulator",
    goToPdfGenerator: "::FaFilePdf className='mr-1.5 sm:mr-2':: Go to PDF Generator",
    purchaseAccess: "::FaKey className='mr-1.5 sm:mr-2':: Purchase Access",
  }
};

export function VipLeadDisplay({ 
    lead, 
    currentLang = 'ru', 
    isMissionUnlocked, 
    onExecuteMission,
    onSupportMission, // For purchase
    isSupported,      // If already purchased
    isPurchasePending,// For purchase button state
    translations: parentTranslations, // Renamed to avoid conflict with local 't'
    isAuthenticated   // For purchase button state
}: VipLeadDisplayProps) {
  const isElonCard = lead.id === ELON_SIMULATOR_CARD_ID;
  const isPdfGeneratorCard = lead.id === PERSONALITY_REPORT_PDF_CARD_ID;
  const isSpecialCard = isElonCard || isPdfGeneratorCard;

  const imageForHeroArea = lead.demo_image_url || MODAL_BACKGROUND_FALLBACK_VIP;
  const actualDemoImage = lead.demo_image_url || PLACEHOLDER_DEMO_IMAGE_VIP; 

  const handleCopyToClipboard = (text: string | null | undefined, message: string) => {
    if (!text) { toast.error("Нет текста для копирования."); return; }
    navigator.clipboard.writeText(text)
      .then(() => toast.success(message))
      .catch(err => toast.error(`Ошибка копирования: ${err.message}`));
  };

  const t = vipPageTranslations[currentLang]; // Use local translations for this component
  let pageTitle = `${t.pageTitleBase} ${lead.client_name || lead.kwork_gig_title || (currentLang === 'ru' ? 'Агента' : 'Agent')}`;
  if (isElonCard) pageTitle = t.elonPageTitle;
  if (isPdfGeneratorCard) pageTitle = t.pdfGenPageTitle;


  const renderActionButton = () => {
    const buttonBaseClasses = "w-full font-orbitron text-sm sm:text-base py-3 sm:py-3.5 shadow-lg hover:shadow-xl active:scale-95 transition-all";
    const disabledClasses = (isPurchasePending || !isAuthenticated) ? "opacity-70 cursor-not-allowed !scale-100" : "hover:brightness-110";

    if (isSpecialCard) {
        if (isSupported) { // Already purchased
            return (
                <Button
                    onClick={onExecuteMission} // This will navigate to /elon or /topdf
                    variant="default"
                    size="lg" 
                    className={cn(buttonBaseClasses, "bg-gradient-to-r from-brand-green via-lime-500 to-emerald-600 text-black", disabledClasses)}
                >
                    <VibeContentRenderer content={isElonCard ? t.goToSimulator : t.goToPdfGenerator} />
                </Button>
            );
        } else { // Not purchased yet
            return (
                 <Button
                    onClick={() => onSupportMission(lead)} 
                    disabled={isPurchasePending || !isAuthenticated}
                    variant="default"
                    size="lg" 
                    className={cn(
                        buttonBaseClasses, 
                        "bg-gradient-to-r from-brand-orange via-red-500 to-pink-600 text-white",
                        disabledClasses
                    )}
                >
                    <VibeContentRenderer content={isPurchasePending ? "::FaSpinner className='animate-spin mr-2'::" : t.purchaseAccess} />
                     {!isPurchasePending && (isElonCard ? ` ${parentTranslations.elonSimulatorAccessBtnText.split('за ')[1]}` : ` ${parentTranslations.pdfGeneratorAccessBtnText.split('за ')[1]}`)}
                </Button>
            );
        }
    } else { // Regular mission
        return (
            <Button
                onClick={onExecuteMission} 
                disabled={!isMissionUnlocked}
                variant="default"
                size="lg" 
                className={cn(
                    buttonBaseClasses,
                    isMissionUnlocked ? `bg-gradient-to-r from-brand-red via-brand-orange to-yellow-500 text-black hover:brightness-110` : "bg-muted text-muted-foreground cursor-not-allowed"
                )}
            >
                <VibeContentRenderer content={isMissionUnlocked ? t.executeMission : t.skillLocked} />
            </Button>
        );
    }
  };


  return (
    <Card className={cn(
        "overflow-hidden rounded-xl sm:rounded-2xl backdrop-blur-lg sm:backdrop-blur-2xl w-full", 
        "border-brand-cyan/70", 
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
        <div className={cn("absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent")} />
        <div className="absolute inset-0 flex flex-col justify-center items-center text-center p-3 sm:p-4 md:p-6 z-10">
            <VibeContentRenderer content={`::${isElonCard ? 'FaGamepad' : isPdfGeneratorCard ? 'FaFilePdf' : 'FaEye'} className="text-5xl sm:text-6xl mb-3 text-brand-cyan opacity-80 text-glow-cyan"::`} />
            <h1 className={cn(
                "font-orbitron text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold line-clamp-3 leading-tight", 
                "text-brand-cyan", 
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
        
        {!isSpecialCard && ( // Only show briefing for regular leads
            <Card className={cn("p-3 sm:p-3.5 shadow-md backdrop-blur-sm rounded-lg bg-black/50 border-white/10")}>
                <ShadCardHeader className="p-0 mb-1.5 sm:mb-2">
                    <ShadCardTitle className={cn("text-sm sm:text-md font-orbitron flex items-center text-brand-cyan")}>
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
                <ShadCardTitle className={cn("text-sm sm:text-md font-orbitron flex items-center text-brand-purple")}>
                    <VibeContentRenderer content={t.fullDescription}/>
                </ShadCardTitle>
            </ShadCardHeader>
            <CardContent className={cn("p-3 sm:p-3.5 rounded-lg text-xs sm:text-sm text-gray-300/90 whitespace-pre-wrap break-words max-h-60 sm:max-h-72 overflow-y-auto simple-scrollbar bg-black/40 border-white/10")}>
                <VibeContentRenderer content={isSpecialCard ? lead.ai_summary || (currentLang === 'ru' ? "Описание этого инструмента/игры." : "Description of this tool/game.") : (lead.project_description || t.noDescription)} />
            </CardContent>
        </div>
        
        {lead.ai_generated_proposal_draft && !isSpecialCard && (
            <div className="pt-0.5">
                 <ShadCardHeader className="p-0 flex flex-row justify-between items-center mb-1 sm:mb-1.5">
                    <ShadCardTitle className={cn("text-sm sm:text-md font-orbitron flex items-center text-brand-pink")}>
                        <VibeContentRenderer content={t.draftOffer}/>
                    </ShadCardTitle>
                    <div className="flex items-center gap-1 sm:gap-1.5">
                        {lead.kwork_url && (
                            <Link href={lead.kwork_url} target="_blank" rel="noopener noreferrer" passHref legacyBehavior>
                            <Button variant="outline" size="xs" className={cn("h-7 sm:h-8 px-2 py-1 text-[0.65rem] sm:text-xs border-brand-blue/50 text-brand-blue hover:bg-brand-blue/10 hover:text-blue-300 focus:ring-brand-blue")} title={t.viewOriginalKwork}>
                                <FaLink className="mr-1 h-3 w-3 sm:h-3.5 sm:w-3.5"/> {t.viewOriginalKwork}
                            </Button>
                            </Link>
                        )}
                        <Button variant="outline" size="xs" className={cn("h-7 sm:h-8 px-2 py-1 text-[0.65rem] sm:text-xs border-brand-pink/50 text-brand-pink hover:bg-brand-pink/10 hover:text-pink-300 focus:ring-brand-pink")}
                                title={t.copyOffer}
                                onClick={() => handleCopyToClipboard(lead.ai_generated_proposal_draft, currentLang === 'ru' ? "Предложение скопировано!" : "Proposal copied!")}>
                            <FaCopy className="mr-1 h-3 w-3 sm:h-3.5 sm:w-3.5"/> {t.copyOffer}
                        </Button>
                    </div>
                </ShadCardHeader>
                <CardContent className={cn("p-3 sm:p-3.5 rounded-lg text-xs sm:text-sm text-gray-300/90 whitespace-pre-wrap break-words max-h-80 sm:max-h-96 overflow-y-auto simple-scrollbar bg-black/40 border-white/10")}>
                     <VibeContentRenderer content={lead.ai_generated_proposal_draft || t.noOffer} />
                </CardContent>
            </div>
        )}

        {lead.demo_image_url && lead.demo_image_url !== imageForHeroArea && !isSpecialCard && ( // Don't show this extra image for special cards if hero is same
             <div className="pt-2 sm:pt-3">
                <ShadCardHeader className="p-0 mb-1 sm:mb-1.5">
                    <ShadCardTitle className={cn("text-sm sm:text-md font-orbitron flex items-center text-brand-green")}>
                        <VibeContentRenderer content="::FaImage className='mr-1.5 sm:mr-2':: Демонстрация Прототипа"/>
                    </ShadCardTitle>
                </ShadCardHeader>
                <div className="aspect-video relative w-full rounded-md sm:rounded-lg overflow-hidden shadow-lg"> 
                    <Image
                        src={actualDemoImage}
                        alt={`Actual demo for ${lead.kwork_gig_title || 'VIP Lead'}`}
                        fill
                        className="object-contain" // Use contain to ensure whole image is visible if aspect ratios differ
                        onError={(e) => { (e.target as HTMLImageElement).src = MODAL_BACKGROUND_FALLBACK_VIP; }}
                    />
                </div>
            </div>
        )}

        <div className="pt-4 sm:pt-6">
            {renderActionButton()}
        </div>
      </div>
    </Card>
  );
}