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
import { ELON_SIMULATOR_CARD_ID, PERSONALITY_REPORT_PDF_CARD_ID } from '@/app/hotvibes/page';

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
  isProcessingThisCard: boolean; // Changed from isPurchasePending
  isAuthenticated: boolean;
}

const PLACEHOLDER_IMAGE_CARD = "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/bullshitemotions//pooh.png"; 

export function HotVibeCard({ 
    lead, 
    isMissionUnlocked, 
    onSupportMission,
    isSupported,
    isSpecial, 
    onViewVip,
    currentLang = 'ru', 
    translations,
    isProcessingThisCard, // Changed from isPurchasePending
    isAuthenticated
}: HotVibeCardProps) {
  
  const imageToDisplayOnCard = lead.demo_image_url || PLACEHOLDER_IMAGE_CARD;
  const isElonSimulatorCard = lead.id === ELON_SIMULATOR_CARD_ID;
  const isPdfGeneratorCard = lead.id === PERSONALITY_REPORT_PDF_CARD_ID;

  let cardGradientClass = "bg-gradient-to-br from-slate-800 via-slate-700 to-slate-900"; 
  let titleTextColorClass = "text-slate-100 group-hover:text-brand-cyan";
  let earningTextColorClass = "text-brand-lime";
  let buttonTextColorClass = "text-black"; 
  let contentBgClass = "bg-slate-800/80"; // Opaque background for content area

  if (isSpecial || isElonSimulatorCard || isPdfGeneratorCard) {
    cardGradientClass = "bg-gradient-to-br from-yellow-500 via-amber-500 to-orange-600";
    titleTextColorClass = "text-white group-hover:text-yellow-200";
    earningTextColorClass = "text-yellow-300 font-bold"; // Made earning text bolder for special cards
    contentBgClass = "bg-yellow-700/80";
  } else if (isSupported) {
    cardGradientClass = "bg-gradient-to-br from-green-500 via-emerald-500 to-teal-600";
    titleTextColorClass = "text-white group-hover:text-lime-200";
    earningTextColorClass = "text-lime-300";
    contentBgClass = "bg-emerald-700/80";
  } else if (isMissionUnlocked) {
     cardGradientClass = "bg-gradient-to-br from-purple-600 via-indigo-600 to-blue-700";
     titleTextColorClass = "text-white group-hover:text-indigo-200";
     earningTextColorClass = "text-indigo-300";
     contentBgClass = "bg-indigo-700/80";
  } else { // Locked
    cardGradientClass = "bg-gradient-to-br from-gray-700 via-gray-800 to-gray-900";
    titleTextColorClass = "text-gray-300 group-hover:text-gray-100";
    earningTextColorClass = "text-gray-400";
    contentBgClass = "bg-gray-800/80";
  }
  // Ensure title text is always light, overriding any potential theme issues for black text
  titleTextColorClass = `${titleTextColorClass} !text-gray-50`;


  const handleCardClick = (event: React.MouseEvent) => {
    if ((event.target as HTMLElement).closest('button, a')) {
      return;
    }
    onViewVip(lead);
  };

  const renderFooterButton = () => {
    const buttonBaseClasses = "w-full font-orbitron text-[0.65rem] sm:text-xs py-2 px-1.5 sm:px-2 rounded-md flex items-center justify-center text-center leading-tight transition-all duration-200 ease-in-out transform group-hover:scale-105 min-h-fit";
    // Disable if processing this card OR if not authenticated (for purchase buttons)
    // For "Go to..." buttons (isSupported=true for special cards), only !isAuthenticated should disable
    let isDisabled = false;
    if (isElonSimulatorCard || isPdfGeneratorCard) {
        if (isSupported) { // "Go to..." button
            isDisabled = !isAuthenticated;
        } else { // "Purchase Access" button
            isDisabled = isProcessingThisCard || !isAuthenticated;
        }
    } else { // Regular mission card
        if (isSupported) { // "View Demo / Supported" button
             isDisabled = !isAuthenticated; // Or never disabled if it just opens VIP
        } else { // "Support Mission" button
            isDisabled = isProcessingThisCard || !isAuthenticated;
        }
    }
    const disabledClasses = isDisabled ? "opacity-70 cursor-not-allowed !scale-100" : "";


    let buttonTextKey = ""; 
    let buttonIconName = ""; 
    let buttonAction = () => onSupportMission(lead); 
    let buttonSpecificClass = "bg-gradient-to-r from-brand-orange via-red-500 to-pink-500 text-white hover:brightness-110";

    if (isElonSimulatorCard) {
      if (isSupported) {
        buttonTextKey = "goToSimulatorText";
        buttonIconName = "FaGamepad";
        buttonAction = () => onViewVip(lead); // Or direct execute if preferred: onExecuteMission(lead.id, lead.required_quest_id)
        buttonSpecificClass = "bg-gradient-to-r from-yellow-400 via-amber-500 to-orange-500 text-black hover:brightness-110";
      } else {
        buttonTextKey = "elonSimulatorAccessBtnText";
        buttonIconName = isProcessingThisCard ? "FaSpinner" : "FaHandHoldingDollar";
        buttonSpecificClass = "bg-gradient-to-r from-yellow-400 via-amber-500 to-orange-600 text-black hover:brightness-110";
      }
    } else if (isPdfGeneratorCard) {
        if (isSupported) {
            buttonTextKey = "goToPdfGeneratorText";
            buttonIconName = "FaFilePdf";
            buttonAction = () => onViewVip(lead); // Or direct execute
            buttonSpecificClass = "bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500 text-white hover:brightness-110";
        } else {
            buttonTextKey = "pdfGeneratorAccessBtnText";
            buttonIconName = isProcessingThisCard ? "FaSpinner" : "FaHandHoldingDollar";
            buttonSpecificClass = "bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 text-white hover:brightness-110";
        }
    } else { // Regular mission leads
      if (isSupported) {
        buttonTextKey = "supportedText"; 
        buttonIconName = "FaEye";
        buttonAction = () => onViewVip(lead); // Opens VIP view
        buttonSpecificClass = "bg-gradient-to-r from-brand-green via-lime-500 to-emerald-600 text-black hover:brightness-110";
      } else {
        buttonTextKey = "supportMissionBtnText";
        buttonIconName = isProcessingThisCard ? "FaSpinner" : "FaHandHoldingDollar";
        // Default specific class already set for this case
      }
    }
    
    let fullButtonText = translations[buttonTextKey] || buttonTextKey;
    if (buttonTextKey === "supportedText" && !isElonSimulatorCard && !isPdfGeneratorCard) {
        fullButtonText = `${translations.supportedText} (${translations.viewDemoText})`;
    }
    if (isProcessingThisCard && (isElonSimulatorCard || isPdfGeneratorCard || !isSupported)) {
        fullButtonText = ""; // Spinner only for purchase actions
    }

    return (
      <Button 
        onClick={buttonAction}
        disabled={isDisabled}
        className={cn(buttonBaseClasses, buttonSpecificClass, buttonTextColorClass, disabledClasses)}
      >
        <VibeContentRenderer content={`::${buttonIconName}::`} className={cn("mr-1 sm:mr-1.5 text-xs", isProcessingThisCard && (isElonSimulatorCard || isPdfGeneratorCard || !isSupported) && "animate-spin")} />
        {fullButtonText}
      </Button>
    );
  };

  return (
    <Card 
      onClick={handleCardClick}
      className={cn(
        "hot-vibe-card group relative flex flex-col overflow-hidden rounded-xl transition-all duration-300 ease-in-out aspect-[3/4] sm:aspect-[4/5]",
        cardGradientClass, 
        "cursor-pointer", 
        (isMissionUnlocked || isSpecial || isSupported) 
          ? "hover:scale-[1.03] hover:-translate-y-0.5" 
          : "opacity-80 hover:opacity-100"
      )}
    >
        <div className="relative aspect-[1/1] w-full overflow-hidden"> 
          <Image
            src={imageToDisplayOnCard}
            alt={lead.kwork_gig_title || 'Hot Vibe Lead'}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover object-center group-hover:scale-110 transition-transform duration-300 ease-in-out"
            onError={(e) => { (e.target as HTMLImageElement).src = PLACEHOLDER_IMAGE_CARD; }}
          />
          <div className={cn(
              "absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent group-hover:from-black/60"
          )} />
          {(lead.status === 'client_responded_positive' || lead.status === 'interested') && !isElonSimulatorCard && !isPdfGeneratorCard && (
            <div className="absolute top-1.5 right-1.5 bg-brand-red text-white text-[0.55rem] font-orbitron uppercase px-2 py-1 rounded-full animate-pulse flex items-center gap-1">
              HOT <VibeContentRenderer content="::FaFireAlt::" className="w-2.5 h-2.5" />
            </div>
          )}
          {isSupported && (
             <div className="absolute top-1.5 left-1.5 bg-brand-green/80 text-black text-[0.55rem] font-orbitron uppercase px-2 py-1 rounded-full flex items-center gap-1">
                <VibeContentRenderer content="::FaCheckCircle::" className="w-3 h-3" /> 
                <span className="leading-none">
                    {isElonSimulatorCard || isPdfGeneratorCard ? (currentLang === 'ru' ? "Доступен" : "Access") : (currentLang === 'ru' ? "Поддержано" : "Supported")}
                </span>
              </div>
          )}
        </div>

        <CardContent className={cn(
            "flex flex-1 flex-col justify-between p-2.5 sm:p-3 text-center space-y-1.5",
            contentBgClass, // Added opaque background for content area
            "backdrop-blur-sm" // Optional: add blur if bg is semi-transparent like /80
            )}
        >
          <div className="min-h-[3.5em] sm:min-h-[4em]"> 
            <h3 
              className={cn(
                "font-orbitron text-sm sm:text-base font-bold leading-tight transition-colors line-clamp-2", 
                titleTextColorClass // This should now be light text on the contentBgClass
              )} 
              title={lead.kwork_gig_title || "Untitled Gig"}
            >
              {lead.kwork_gig_title || (currentLang === 'ru' ? "Без названия" : "Untitled Gig")}
            </h3>
            {lead.ai_summary && (
              <p 
                className={cn(
                    "mt-1 text-[0.6rem] sm:text-[0.7rem] leading-snug line-clamp-2", 
                     "text-gray-300 group-hover:text-gray-200" // This is already light
                )} 
                title={lead.ai_summary}
              >
                {lead.ai_summary}
              </p>
            )}
          </div>
          <div className="text-[0.7rem] sm:text-xs font-orbitron font-semibold">
            {lead.potential_earning && 
                <span className={cn(earningTextColorClass, "text-gray-50")}> {/* Ensure earning text is also light */}
                    {lead.potential_earning}
                </span>
            }
          </div>
        </CardContent>
        
        <CardFooter className={cn("p-2 sm:p-2.5 pt-0 mt-auto", contentBgClass, "rounded-b-xl")}> {/* Ensure footer also has the background */}
            {renderFooterButton()}
        </CardFooter>
    </Card>
  );
}