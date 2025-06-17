// /components/hotvibes/VipLeadDisplay.tsx
"use client";

import React from 'react';
import Image from 'next/image';
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
import { FaCopy, FaArrowUpRightFromSquare } from "react-icons/fa6"; 
import { toast } from 'sonner';
import { 
    ELON_SIMULATOR_CARD_ID, 
    PERSONALITY_REPORT_PDF_CARD_ID,
    ELON_SIMULATOR_ACCESS_PRICE_KV,
    PERSONALITY_REPORT_PDF_ACCESS_PRICE_KV,
    MISSION_SUPPORT_PRICE_KV,
    ELON_SIMULATOR_ACCESS_PRICE_XTR,
    PERSONALITY_REPORT_PDF_ACCESS_PRICE_XTR,
    MISSION_SUPPORT_PRICE_XTR
} from '@/app/hotvibes/HotVibesClientContent';
import { useAppContext } from '@/contexts/AppContext';
import { CyberFitnessProfile } from '@/hooks/cyberFitnessSupabase';

interface VipLeadDisplayProps {
  lead: HotLeadData;
  cyberProfile: CyberFitnessProfile | null;
  currentLang?: 'ru' | 'en';
  isMissionUnlocked: boolean; 
  onExecuteMission: () => void; 
  onSupportMission: (lead: HotLeadData, paymentMethod: 'KV' | 'XTR') => void; 
  isSupported: boolean; 
  isProcessingThisCard: boolean; 
  translations: Record<string, any>; 
  isAuthenticated: boolean; 
}

// Using a more abstract/cool background from Unsplash
const MODAL_BACKGROUND_FALLBACK_VIP = "https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?q=80&w=2071&auto=format&fit=crop";

const vipPageTranslations = { 
  ru: {
    pageTitleBase: "VIP-Доступ:",
    elonPageTitle: "Симулятор 'Рынка Маска'",
    pdfGenPageTitle: "Генератор PDF: Расшифровка Личности",
    missionBriefing: "Брифинг Миссии",
    budget: "Потенциал", 
    taskType: "Тип Задачи", 
    requiredSkill: "Ключевой Навык", 
    fullDescription: "Полное Описание", 
    draftOffer: "Готовый Оффер", 
    viewOriginalKwork: "Заказ", 
    copyOffer: "Копи", 
    executeMission: "Открыть Доступ", 
    skillLocked: "Навык Заблокирован",
    noDescription: "Детальное описание проекта не предоставлено.",
    noOffer: "Предложение для этого проекта пока не сформировано.",
    purchaseWithKv: "За KiloVibes",
    purchaseWithXtr: "За XTR",
    insufficientKv: "Недостаточно KV",
  },
  en: {
    pageTitleBase: "VIP Access:",
    elonPageTitle: "Musk Market Simulator",
    pdfGenPageTitle: "PDF Generator: Personality Insights",
    missionBriefing: "Mission Briefing",
    budget: "Potential", 
    taskType: "Task Type", 
    requiredSkill: "Key Skill", 
    fullDescription: "Full Description", 
    draftOffer: "Ready Proposal", 
    viewOriginalKwork: "Order", 
    copyOffer: "Copy", 
    executeMission: "Open Access", 
    skillLocked: "Skill Locked",
    noDescription: "Detailed project description not provided.",
    noOffer: "A proposal for this project has not been drafted yet.",
    purchaseWithKv: "For KiloVibes",
    purchaseWithXtr: "For XTR",
    insufficientKv: "Insufficient KV",
  }
};

export function VipLeadDisplay({ 
    lead, 
    cyberProfile,
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

  const handleCopyToClipboard = (text: string | null | undefined, message: string) => {
    if (!text) { toast.error(currentLang === 'ru' ? "Нет текста для копирования." : "Nothing to copy."); return; }
    navigator.clipboard.writeText(text)
      .then(() => toast.success(message))
      .catch(err => toast.error(`${currentLang === 'ru' ? "Ошибка копирования" : "Copy error"}: ${err.message}`));
  };

  const t = vipPageTranslations[currentLang]; 
  let pageTitle = `${t.pageTitleBase} ${lead.kwork_gig_title || (currentLang === 'ru' ? 'Миссия' : 'Mission')}`;
  if (isElonCard) pageTitle = t.elonPageTitle;
  if (isPdfGeneratorCard) pageTitle = t.pdfGenPageTitle;

  const renderActionButtons = () => {
    const buttonBaseClasses = "w-full font-orbitron text-sm sm:text-base py-3 shadow-lg hover:shadow-xl active:scale-95 transition-all duration-200 ease-in-out flex items-center justify-center gap-2 rounded-lg";
    
    // --- STATE 1: ALREADY OWNED ---
    if (isSupported) {
        let iconName = isElonCard ? "::FaGamepad::" : isPdfGeneratorCard ? "::FaFilePdf::" : "::FaRocket::";
        return (
            <Button type="button" onClick={onExecuteMission} disabled={!isAuthenticated || isProcessingThisCard} variant="default" size="lg" className={cn(buttonBaseClasses, "bg-gradient-to-r from-brand-green to-emerald-500 text-black hover:brightness-110", (!isAuthenticated || isProcessingThisCard) && "opacity-70 cursor-not-allowed")}>
                <VibeContentRenderer content={isProcessingThisCard ? "::FaSpinner className='animate-spin'::" : iconName} />
                {t.executeMission}
            </Button>
        );
    }
    
    // --- STATE 2: NOT OWNED (PURCHASE OPTIONS) ---
    let priceKV: number;
    let priceXTR: number;

    if (isElonCard) {
        priceKV = ELON_SIMULATOR_ACCESS_PRICE_KV;
        priceXTR = ELON_SIMULATOR_ACCESS_PRICE_XTR;
    } else if (isPdfGeneratorCard) {
        priceKV = PERSONALITY_REPORT_PDF_ACCESS_PRICE_KV;
        priceXTR = PERSONALITY_REPORT_PDF_ACCESS_PRICE_XTR;
    } else {
        priceKV = MISSION_SUPPORT_PRICE_KV;
        priceXTR = MISSION_SUPPORT_PRICE_XTR;
    }

    const hasSufficientKV = cyberProfile ? cyberProfile.kiloVibes >= priceKV : false;
    const isKvButtonDisabled = !hasSufficientKV || !isAuthenticated || isProcessingThisCard;
    const isXtrButtonDisabled = !isAuthenticated || isProcessingThisCard;

    if (!isMissionUnlocked && !isSpecialCard) {
        return (
            <Button type="button" disabled={true} variant="secondary" size="lg" className={cn(buttonBaseClasses, "cursor-not-allowed")}>
                <VibeContentRenderer content="::FaLock::" /> {t.skillLocked}
            </Button>
        );
    }

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {/* KV Purchase Button */}
            <Button 
                type="button" 
                onClick={() => onSupportMission(lead, 'KV')} 
                disabled={isKvButtonDisabled} 
                variant="outline" 
                size="lg"
                className={cn(
                    buttonBaseClasses, 
                    "border-brand-purple/80 text-brand-purple hover:bg-brand-purple/10 hover:text-white hover:border-brand-purple",
                    isKvButtonDisabled && "opacity-60 cursor-not-allowed hover:bg-transparent"
                )}
            >
                <VibeContentRenderer content={isProcessingThisCard ? "::FaSpinner className='animate-spin'::" : "::FaBolt::"} />
                <div className="flex flex-col items-center">
                    <span className="leading-tight">{priceKV} KiloVibes</span>
                    {!hasSufficientKV && isAuthenticated && <span className="text-xs opacity-80 leading-tight">({t.insufficientKv})</span>}
                </div>
            </Button>

            {/* XTR Purchase Button */}
            <Button 
                type="button" 
                onClick={() => onSupportMission(lead, 'XTR')} 
                disabled={isXtrButtonDisabled}
                variant="default"
                size="lg"
                className={cn(
                    buttonBaseClasses, 
                    "bg-gradient-to-r from-brand-orange to-red-500 text-white hover:brightness-110",
                    isXtrButtonDisabled && "opacity-70 cursor-not-allowed"
                )}
            >
                <VibeContentRenderer content={isProcessingThisCard ? "::FaSpinner className='animate-spin'::" : "::FaStar::"} />
                <span>{priceXTR} XTR</span>
            </Button>
        </div>
    );
  };

  return (
    <Card className={cn(
        "overflow-hidden rounded-2xl w-full border border-slate-800", 
        "bg-black/70 backdrop-blur-xl"
    )}>
      {/* --- HERO SECTION --- */}
      <div className="relative w-full h-[40vh] sm:h-[45vh] group overflow-hidden">
        <Image
            src={imageForHeroArea}
            alt={`${lead.kwork_gig_title || 'VIP Lead'} background`}
            fill
            priority
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
        />
        <div className={cn("absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent")} />
        <div className="absolute inset-0 flex flex-col justify-end p-4 sm:p-6 md:p-8 z-10">
            <h1 className={cn(
                "font-orbitron text-2xl sm:text-3xl md:text-4xl font-bold line-clamp-3 leading-tight text-white", 
                "drop-shadow-[0_2px_4px_rgba(0,0,0,0.7)]"
                )}
            >
                {pageTitle}
            </h1>
            {lead.ai_summary && <p className="text-sm text-slate-300/90 mt-2 line-clamp-2 font-mono max-w-2xl">{lead.ai_summary}</p>}
        </div>
      </div>

      {/* --- CONTENT SECTION --- */}
      <div className="p-4 sm:p-6 space-y-5 sm:space-y-6 font-mono">
        
        {!isSpecialCard && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div className="flex flex-col">
                    <span className="text-xs text-slate-400 uppercase tracking-wider">{t.budget}</span>
                    <span className="font-semibold text-brand-lime mt-1">{lead.potential_earning || '-'}</span>
                </div>
                <div className="flex flex-col">
                    <span className="text-xs text-slate-400 uppercase tracking-wider">{t.taskType}</span>
                    <span className="font-semibold text-white mt-1">{lead.project_type_guess || '-'}</span>
                </div>
                <div className="flex flex-col">
                    <span className="text-xs text-slate-400 uppercase tracking-wider">{t.requiredSkill}</span>
                    <span className="font-semibold text-brand-orange mt-1">{lead.required_quest_id !== 'none' ? lead.required_quest_id : 'None'}</span>
                </div>
            </div>
        )}

        <div>
            <ShadCardTitle className="text-md font-orbitron text-slate-300 mb-2">{t.fullDescription}</ShadCardTitle>
            <CardContent className="p-3.5 rounded-lg text-sm text-slate-300 whitespace-pre-wrap break-words max-h-60 overflow-y-auto simple-scrollbar bg-slate-900/70 border border-slate-800">
                <VibeContentRenderer content={isSpecialCard ? lead.ai_summary || t.noDescription : (lead.project_description || t.noDescription)} />
            </CardContent>
        </div>
        
        {lead.ai_generated_proposal_draft && !isSpecialCard && (
            <div>
                 <div className="flex justify-between items-center mb-2">
                    <ShadCardTitle className="text-md font-orbitron text-slate-300">{t.draftOffer}</ShadCardTitle>
                    <div className="flex items-center gap-2">
                        {lead.kwork_url && (
                            <Button onClick={() => openLink(lead.kwork_url!)} variant="ghost" size="sm" className="h-8 px-2 text-slate-400 hover:bg-slate-800 hover:text-white">
                                <FaArrowUpRightFromSquare className="mr-1.5 h-3.5 w-3.5"/> {t.viewOriginalKwork}
                            </Button>
                        )}
                        <Button onClick={() => handleCopyToClipboard(lead.ai_generated_proposal_draft, "Оффер скопирован!")} variant="ghost" size="sm" className="h-8 px-2 text-slate-400 hover:bg-slate-800 hover:text-white">
                            <FaCopy className="mr-1.5 h-3.5 w-3.5"/> {t.copyOffer}
                        </Button>
                    </div>
                </div>
                <CardContent className="p-3.5 rounded-lg text-sm text-slate-300 whitespace-pre-wrap break-words max-h-80 overflow-y-auto simple-scrollbar bg-slate-900/70 border border-slate-800">
                     <VibeContentRenderer content={lead.ai_generated_proposal_draft || t.noOffer} />
                </CardContent>
            </div>
        )}

        {/* --- ACTION BUTTONS AREA --- */}
        <div className="pt-4">
            {renderActionButtons()}
        </div>
      </div>
    </Card>
  );
}