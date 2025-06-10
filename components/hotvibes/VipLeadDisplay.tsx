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
} from '@/components/ui/card';
import { VibeContentRenderer } from '@/components/VibeContentRenderer';
import type { HotLeadData } from './HotVibeCard'; 
import { FaCopy, FaLink, FaRocket, FaLock, FaArrowUpRightFromSquare } from "react-icons/fa6"; 
import { toast } from 'sonner';
import { ELON_SIMULATOR_CARD_ID, PERSONALITY_REPORT_PDF_CARD_ID } from '@/app/hotvibes/page';
import { useAppContext } from '@/contexts/AppContext';

interface VipLeadDisplayProps {
  lead: HotLeadData;
  currentLang?: 'ru' | 'en';
  isMissionUnlocked: boolean; 
  onExecuteMission: () => void; 
  onSupportMission: (lead: HotLeadData) => void; 
  isSupported: boolean; 
  isProcessingThisCard: boolean; 
  translations: Record<string, any>; 
  isAuthenticated: boolean; 
}

const MODAL_BACKGROUND_FALLBACK_VIP = "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/cyberpunk-cityscape-artistic-4k-ax-1920x1080.jpg";
const PLACEHOLDER_DEMO_IMAGE_VIP = "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/vibe_city_neon_future-2d7a8b9e-a9f9-4b1f-8e4d-9f6a123b4c5d.jpg"; 

const vipPageTranslations = { 
  ru: {
    pageTitleBase: "VIP Прототип для",
    elonPageTitle: "Симулятор 'Рынка Маска'",
    pdfGenPageTitle: "Генератор PDF: Расшифровка Личности",
    missionBriefingIcon: "::FaListCheck::",
    missionBriefing: "Брифинг Ультра-Миссии",
    budgetIcon: "::FaMoneyBillWave::",
    budget: "Бюджет:", 
    taskTypeIcon: "::FaLightbulb::",
    taskType: "Тип Задачи:", 
    requiredSkillIcon: "::FaBoltLightning::",
    requiredSkill: "Ключевой Навык:", 
    clientStatusIcon: "::FaCommentDots::",
    clientStatus: "Статус Клиента:",
    fullDescriptionIcon: "::FaClipboardList::",
    fullDescription: "Полное Техзадание", 
    draftOfferIcon: "::FaCommentsDollar::",
    draftOffer: "Наше Готовое Предложение", 
    viewOriginalKwork: "Оригинал", 
    copyOffer: "Копи", 
    executeMissionIcon: "::FaRocket::",
    executeMission: "Активировать VIBE!", 
    skillLockedIcon: "::FaLock::",
    skillLocked: "Навык Заблокирован",
    noDescription: "Детальное описание проекта не предоставлено.",
    noOffer: "Предложение для этого проекта пока не сформировано.",
    goToSimulatorIcon: "::FaGamepad::",
    goToSimulator: "К Симулятору Маска",
    goToPdfGeneratorIcon: "::FaFilePdf::",
    goToPdfGenerator: "К Генератору PDF",
    purchaseAccessIcon: "::FaKey::",
    purchaseAccess: "Купить Доступ",
    activateGenericLeadAction: "Копировать Оффер & Открыть Заказ",
    activateGenericLeadIcon: "::FaCopy::",
  },
  en: {
    pageTitleBase: "VIP Prototype for",
    elonPageTitle: "Musk Market Simulator",
    pdfGenPageTitle: "PDF Generator: Personality Insights",
    missionBriefingIcon: "::FaListCheck::",
    missionBriefing: "Ultra-Mission Briefing",
    budgetIcon: "::FaMoneyBillWave::",
    budget: "Budget:", 
    taskTypeIcon: "::FaLightbulb::",
    taskType: "Task Type:", 
    requiredSkillIcon: "::FaBoltLightning::",
    requiredSkill: "Key Skill:", 
    clientStatusIcon: "::FaCommentDots::",
    clientStatus: "Client Status:",
    fullDescriptionIcon: "::FaClipboardList::",
    fullDescription: "Full Task Description", 
    draftOfferIcon: "::FaCommentsDollar::",
    draftOffer: "Our Ready-Made Proposal", 
    viewOriginalKwork: "Order", 
    copyOffer: "Copy", 
    executeMissionIcon: "::FaRocket::",
    executeMission: "Activate VIBE!", 
    skillLockedIcon: "::FaLock::",
    skillLocked: "Skill Locked",
    noDescription: "Detailed project description not provided.",
    noOffer: "A proposal for this project has not been drafted yet.",
    goToSimulatorIcon: "::FaGamepad::",
    goToSimulator: "Go to Musk Simulator",
    goToPdfGeneratorIcon: "::FaFilePdf::",
    goToPdfGenerator: "Go to PDF Generator",
    purchaseAccessIcon: "::FaKey::",
    purchaseAccess: "Purchase Access",
    activateGenericLeadAction: "Copy Offer & Open Order",
    activateGenericLeadIcon: "::FaCopy::",
  }
};

export function VipLeadDisplay({ 
    lead, 
    currentLang = 'ru', 
    isMissionUnlocked, 
    onExecuteMission, 
    onSupportMission, 
    isSupported,      
    isProcessingThisCard, 
    translations: parentTranslations, 
    isAuthenticated   
}: VipLeadDisplayProps) {
  const { openLink } = useAppContext();
  const isElonCard = lead.id === ELON_SIMULATOR_CARD_ID;
  const isPdfGeneratorCard = lead.id === PERSONALITY_REPORT_PDF_CARD_ID;
  const isSpecialCard = isElonCard || isPdfGeneratorCard;

  const imageForHeroArea = lead.demo_image_url || MODAL_BACKGROUND_FALLBACK_VIP;
  const actualDemoImage = lead.demo_image_url || PLACEHOLDER_DEMO_IMAGE_VIP; 

  const handleCopyToClipboard = (text: string | null | undefined, message: string) => {
    if (!text) { toast.error(currentLang === 'ru' ? "Нет текста для копирования." : "Nothing to copy."); return false; }
    navigator.clipboard.writeText(text)
      .then(() => { toast.success(message); return true; })
      .catch(err => { toast.error(`${currentLang === 'ru' ? "Ошибка копирования" : "Copy error"}: ${err.message}`); return false; });
    return true; 
  };

  const t = vipPageTranslations[currentLang]; 
  let pageTitle = `${t.pageTitleBase} ${lead.client_name || lead.kwork_gig_title || (currentLang === 'ru' ? 'Агента' : 'Agent')}`;
  if (isElonCard) pageTitle = t.elonPageTitle;
  if (isPdfGeneratorCard) pageTitle = t.pdfGenPageTitle;

  const handleGenericLeadAction = () => {
    let offerCopied = false;
    if (lead.ai_generated_proposal_draft) {
      offerCopied = handleCopyToClipboard(lead.ai_generated_proposal_draft, currentLang === 'ru' ? "Оффер скопирован!" : "Offer copied!");
    } else {
      toast.info(currentLang === 'ru' ? "Нет готового оффера для копирования." : "No offer draft to copy.");
    }

    let linkOpened = false;
    if (lead.kwork_url) {
      openLink(lead.kwork_url);
      linkOpened = true;
    } else {
      toast.info(currentLang === 'ru' ? "Нет ссылки на оригинальный заказ." : "No original order link.");
    }

    if (offerCopied && linkOpened) {
      toast.success(currentLang === 'ru' ? "Оффер скопирован, заказ открыт!" : "Offer copied, order opened!");
    } else if (offerCopied) {
      toast.info(currentLang === 'ru' ? "Оффер скопирован (ссылки на заказ нет)." : "Offer copied (no order link).");
    } else if (linkOpened) {
      toast.info(currentLang === 'ru' ? "Заказ открыт (оффера для копирования нет)." : "Order opened (no offer to copy).");
    }
  };

  const renderActionButton = () => {
    const buttonBaseClasses = "w-full font-orbitron text-sm sm:text-base py-3 sm:py-3.5 shadow-lg hover:shadow-xl active:scale-95 transition-all";
    
    let iconName = "";
    let buttonText = "";
    let specificStyling = "";
    let isDisabled = false;
    let actionToCall = onExecuteMission; 

    if (isSpecialCard) {
        if (isSupported) { 
            iconName = isElonCard ? t.goToSimulatorIcon.replace(/::/g, '') : t.goToPdfGeneratorIcon.replace(/::/g, '');
            buttonText = isElonCard ? t.goToSimulator : t.goToPdfGenerator;
            specificStyling = "bg-gradient-to-r from-brand-green via-lime-500 to-emerald-600 text-black hover:brightness-110";
            isDisabled = !isAuthenticated; 
            actionToCall = onExecuteMission; 
        } else { 
            iconName = isProcessingThisCard ? "FaSpinner" : t.purchaseAccessIcon.replace(/::/g, '');
            buttonText = isProcessingThisCard ? "" : t.purchaseAccess;
            const priceText = isElonCard ? ` ${parentTranslations.elonSimulatorAccessBtnText.split('за ')[1]}` : ` ${parentTranslations.pdfGeneratorAccessBtnText.split('за ')[1]}`;
            specificStyling = "bg-gradient-to-r from-brand-orange via-red-500 to-pink-600 text-white hover:brightness-110";
            isDisabled = isProcessingThisCard || !isAuthenticated;
            actionToCall = () => onSupportMission(lead);
             return ( 
                 <Button onClick={actionToCall} disabled={isDisabled} variant="default" size="lg" className={cn(buttonBaseClasses, specificStyling, isDisabled && "opacity-70 cursor-not-allowed !scale-100")} >
                    <VibeContentRenderer content={`::${iconName}::`} className={cn("mr-1.5 sm:mr-2", isProcessingThisCard && "animate-spin")} /> {buttonText} {!isProcessingThisCard && priceText}
                </Button>
            );
        }
    } else { 
        iconName = t.activateGenericLeadIcon.replace(/::/g, ''); 
        buttonText = t.activateGenericLeadAction;
        specificStyling = isMissionUnlocked 
            ? `bg-gradient-to-r from-brand-red via-brand-orange to-yellow-500 text-black hover:brightness-110` 
            : "bg-muted text-muted-foreground"; 
        isDisabled = !isAuthenticated; 
        actionToCall = handleGenericLeadAction;
    }
    
    return (
        <Button onClick={actionToCall} disabled={isDisabled} variant="default" size="lg" className={cn(buttonBaseClasses, specificStyling, isDisabled && "opacity-70 cursor-not-allowed !scale-100")} >
             <VibeContentRenderer content={`::${iconName}::`} className="mr-1.5 sm:mr-2" /> {buttonText}
        </Button>
    );
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
            <VibeContentRenderer content={`::${isElonCard ? 'FaGamepad' : isPdfGeneratorCard ? 'FaFilePdf' : 'FaEye'}::`} className="text-5xl sm:text-6xl mb-3 text-brand-cyan opacity-80 text-glow-cyan" />
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
        
        {!isSpecialCard && (
            <Card className={cn("p-3 sm:p-3.5 shadow-md backdrop-blur-sm rounded-lg bg-black/50 border-white/10")}>
                <ShadCardHeader className="p-0 mb-1.5 sm:mb-2">
                    <ShadCardTitle className={cn("text-sm sm:text-md font-orbitron flex items-center text-brand-cyan")}>
                        <VibeContentRenderer content={t.missionBriefingIcon} className="mr-1.5 sm:mr-2 text-base sm:text-lg"/>{t.missionBriefing}
                    </ShadCardTitle>
                </ShadCardHeader>
                <CardContent className="p-0 text-xs space-y-1 text-gray-200/90">
                    {lead.potential_earning && <p><VibeContentRenderer content={t.budgetIcon} className='text-brand-green mr-1.5 sm:mr-2'/>{t.budget} <span className="font-semibold text-white">{lead.potential_earning}</span></p>}
                    {lead.project_type_guess && <p><VibeContentRenderer content={t.taskTypeIcon} className='text-brand-yellow mr-1.5 sm:mr-2'/>{t.taskType} <span className="font-semibold text-white">{lead.project_type_guess}</span></p>}
                    {lead.required_quest_id && lead.required_quest_id !== "none" && <p><VibeContentRenderer content={t.requiredSkillIcon} className='text-brand-orange mr-1.5 sm:mr-2'/>{t.requiredSkill} <span className="font-semibold text-white">{lead.required_quest_id}</span></p>}
                    {lead.client_response_snippet && <p className="text-brand-lime"><VibeContentRenderer content={t.clientStatusIcon} className='text-brand-lime mr-1.5 sm:mr-2'/>{t.clientStatus} <span className="font-semibold text-white italic">"{lead.client_response_snippet}"</span></p>}
                </CardContent>
            </Card>
        )}

        <div className="pt-0.5">
            <ShadCardHeader className="p-0 mb-1 sm:mb-1.5">
                <ShadCardTitle className={cn("text-sm sm:text-md font-orbitron flex items-center text-brand-purple")}>
                    <VibeContentRenderer content={t.fullDescriptionIcon} className="mr-1.5 sm:mr-2 text-base sm:text-lg"/>{t.fullDescription}
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
                        <VibeContentRenderer content={t.draftOfferIcon} className="mr-1.5 sm:mr-2 text-base sm:text-lg"/>{t.draftOffer}
                    </ShadCardTitle>
                    <div className="flex items-center gap-1 sm:gap-1.5">
                        {lead.kwork_url && (
                            <Button 
                                variant="outline" 
                                size="xs" 
                                className={cn("h-7 sm:h-8 px-2 py-1 text-[0.65rem] sm:text-xs border-brand-blue/50 text-brand-blue hover:bg-brand-blue/10 hover:text-blue-300 focus:ring-brand-blue")} 
                                title={t.viewOriginalKwork}
                                onClick={() => openLink(lead.kwork_url!)}
                            >
                                <FaArrowUpRightFromSquare className="mr-1 h-3 w-3 sm:h-3.5 sm:w-3.5"/> {t.viewOriginalKwork}
                            </Button>
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

        {lead.demo_image_url && lead.demo_image_url !== imageForHeroArea && !isSpecialCard && (
             <div className="pt-2 sm:pt-3">
                <ShadCardHeader className="p-0 mb-1 sm:mb-1.5">
                    <ShadCardTitle className={cn("text-sm sm:text-md font-orbitron flex items-center text-brand-green")}>
                        <VibeContentRenderer content="::FaImage::" className="mr-1.5 sm:mr-2"/> Демонстрация Прототипа
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
            {renderActionButton()}
        </div>
      </div>
    </Card>
  );
}