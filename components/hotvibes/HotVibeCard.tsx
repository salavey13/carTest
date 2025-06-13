"use client";

import React from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { 
    Card, 
    CardContent, 
    CardFooter, 
} from '@/components/ui/card';
import { VibeContentRenderer } from '@/components/VibeContentRenderer';
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

export interface HotLeadData {
  id: string;
  kwork_gig_title?: string | null;
  ai_summary?: string | null;
  demo_image_url?: string | null;
  potential_earning?: string | null;
  required_kilovibes?: number | null;
  required_quest_id?: string | null;
  client_response_snippet?: string | null;
  kwork_url?: string | null;
  project_description?: string | null;
  ai_generated_proposal_draft?: string | null;
  status?: string;
  project_type_guess?: string | null;
  client_name?: string | null;
  notes?: string | null; 
  supervibe_studio_links?: any; 
}

interface HotVibeCardProps {
  lead: HotLeadData;
  isMissionUnlocked: boolean;
  onExecuteMission: (leadId: string, questId: string | undefined) => void;
  onSupportMission: (lead: HotLeadData) => void; 
  isSupported: boolean; 
  isSpecial?: boolean; 
  onViewVip: (lead: HotLeadData) => void; 
  currentLang?: 'ru' | 'en';
  translations: Record<string, any>; 
  isProcessingThisCard: boolean;
  isAuthenticated: boolean;
}

const PLACEHOLDER_IMAGE_CARD = "https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?q=80&w=2071&auto=format&fit=crop"; 

export function HotVibeCard({ 
    lead, 
    isMissionUnlocked, 
    onSupportMission,
    isSupported,
    isSpecial, 
    onViewVip,
    currentLang = 'ru', 
    translations,
    isProcessingThisCard,
    isAuthenticated
}: HotVibeCardProps) {
  
  const imageToDisplayOnCard = lead.demo_image_url || PLACEHOLDER_IMAGE_CARD;
  const isElonSimulatorCard = lead.id === ELON_SIMULATOR_CARD_ID;
  const isPdfGeneratorCard = lead.id === PERSONALITY_REPORT_PDF_CARD_ID;

  let cardClass = "border-slate-700 bg-slate-800";
  let titleClass = "text-slate-100 group-hover:text-brand-cyan";
  
  if (isSpecial || isElonSimulatorCard || isPdfGeneratorCard) {
    cardClass = "border-amber-500/50 bg-gradient-to-br from-yellow-500 via-amber-600 to-orange-700";
    titleClass = "text-white group-hover:text-yellow-200";
  } else if (isSupported) {
    cardClass = "border-emerald-500/50 bg-gradient-to-br from-green-600 via-emerald-600 to-teal-700";
    titleClass = "text-white group-hover:text-lime-200";
  } else if (isMissionUnlocked) {
     cardClass = "border-indigo-500/50 bg-gradient-to-br from-purple-700 via-indigo-700 to-blue-800";
     titleClass = "text-white group-hover:text-indigo-200";
  } else { // Locked
    cardClass = "border-gray-600 bg-gray-800";
    titleClass = "text-gray-300 group-hover:text-gray-100";
  }

  const handleCardClick = (event: React.MouseEvent) => {
    if ((event.target as HTMLElement).closest('button, a')) {
      return;
    }
    onViewVip(lead);
  };

  const renderFooterButton = () => {
    const buttonBaseClasses = "w-full font-orbitron text-xs py-2 px-2 rounded-lg flex items-center justify-center text-center leading-tight transition-all duration-200 ease-in-out transform group-hover:scale-105";
    const isDisabled = isProcessingThisCard || !isAuthenticated;
    const disabledClasses = isDisabled ? "opacity-70 cursor-not-allowed !scale-100" : "";

    let buttonIconName = "";
    let buttonAction = () => onSupportMission(lead);
    let buttonSpecificClass = "";
    let buttonText = "";

    let priceKV: number;
    let priceXTR: number;

    if (isElonSimulatorCard) {
        priceKV = ELON_SIMULATOR_ACCESS_PRICE_KV;
        priceXTR = ELON_SIMULATOR_ACCESS_PRICE_XTR;
    } else if (isPdfGeneratorCard) {
        priceKV = PERSONALITY_REPORT_PDF_ACCESS_PRICE_KV;
        priceXTR = PERSONALITY_REPORT_PDF_ACCESS_PRICE_XTR;
    } else {
        priceKV = MISSION_SUPPORT_PRICE_KV;
        priceXTR = MISSION_SUPPORT_PRICE_XTR;
    }

    if (isSupported) {
        buttonIconName = isSpecial ? "::FaCaretRight::" : "::FaEye::";
        buttonText = isSpecial ? (translations.goToSimulatorText || "Enter") : (translations.viewDemoText || "View");
        buttonAction = () => onViewVip(lead); 
        buttonSpecificClass = "bg-brand-green text-black hover:brightness-110";
    } else {
        buttonIconName = isProcessingThisCard ? "::FaSpinner className='animate-spin'::" : "::FaUnlockAlt::";
        // Compact button text using icons
        buttonText = `::FaBolt:: ${priceKV} / ::FaStar:: ${priceXTR}`;
        buttonSpecificClass = "bg-brand-orange text-white hover:brightness-110";
    }
    
    if (isProcessingThisCard) {
        buttonText = "";
    }

    return (
      <Button 
        onClick={buttonAction}
        disabled={isDisabled}
        className={cn(buttonBaseClasses, buttonSpecificClass, disabledClasses)}
      >
        <VibeContentRenderer content={buttonIconName} className={cn("text-base", isProcessingThisCard && "animate-spin")} />
        <VibeContentRenderer content={buttonText} className="ml-1.5 flex items-center gap-1.5" />
      </Button>
    );
  };

  return (
    <Card 
      onClick={handleCardClick}
      className={cn(
        "hot-vibe-card group relative flex flex-col overflow-hidden rounded-xl transition-all duration-300 ease-in-out border",
        cardClass, 
        "cursor-pointer shadow-lg",
        (isMissionUnlocked || isSpecial || isSupported) 
          ? "hover:scale-[1.03] hover:shadow-xl hover:-translate-y-1" 
          : "opacity-80 hover:opacity-100"
      )}
    >
        <div className="relative aspect-square w-full overflow-hidden"> 
          <Image
            src={imageToDisplayOnCard}
            alt={lead.kwork_gig_title || 'Hot Vibe Lead'}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover object-center group-hover:scale-110 transition-transform duration-300 ease-in-out"
            onError={(e) => { (e.target as HTMLImageElement).src = PLACEHOLDER_IMAGE_CARD; }}
          />
          <div className={cn(
              "absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent group-hover:from-black/70"
          )} />
          {(lead.status === 'client_responded_positive' || lead.status === 'interested') && !isSpecial && (
            <div className="absolute top-1.5 right-1.5 bg-brand-red text-white text-[0.6rem] font-bold uppercase px-2 py-0.5 rounded-full animate-pulse">
              HOT
            </div>
          )}
          {isSupported && (
             <div className="absolute top-1.5 left-1.5 bg-brand-green/90 text-black text-[0.6rem] font-bold uppercase px-2 py-0.5 rounded-full">
                {isSpecial ? (currentLang === 'ru' ? "Доступ" : "Access") : (currentLang === 'ru' ? "Поддержка" : "Supported")}
              </div>
          )}
        </div>

        <CardContent className="flex flex-1 flex-col justify-between p-2.5 space-y-2">
          <div className="flex-grow">
            <h3 
              className={cn(
                "font-orbitron text-sm font-bold leading-tight transition-colors line-clamp-2", 
                titleClass
              )} 
              title={lead.kwork_gig_title || "Untitled Gig"}
            >
              {lead.kwork_gig_title || (currentLang === 'ru' ? "Без названия" : "Untitled Gig")}
            </h3>
            {lead.ai_summary && (
              <p 
                className={cn(
                    "mt-1 text-xs leading-snug line-clamp-2 text-slate-300 group-hover:text-slate-200"
                )} 
                title={lead.ai_summary}
              >
                {lead.ai_summary}
              </p>
            )}
          </div>
        </CardContent>
        
        <CardFooter className="p-2 pt-0 mt-auto"> 
            {renderFooterButton()}
        </CardFooter>
    </Card>
  );
}