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
import { ELON_SIMULATOR_CARD_ID, PERSONALITY_REPORT_PDF_CARD_ID } from '@/app/hotvibes/page'; // Import PDF ID too

// Ensure HotLeadData interface is consistent with /app/hotvibes/page.tsx
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
  notes?: string | null; // For PDF generator card link
  supervibe_studio_links?: any; // Keep if used
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
  isPurchasePending: boolean;
  isAuthenticated: boolean;
}

const PLACEHOLDER_IMAGE_CARD = "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/bullshitemotions//pooh.png"; 

export function HotVibeCard({ 
    lead, 
    isMissionUnlocked, 
    // onExecuteMission is not directly used for card click, but kept for buttons
    onSupportMission,
    isSupported,
    isSpecial, 
    onViewVip,
    currentLang = 'ru', 
    translations,
    isPurchasePending,
    isAuthenticated
}: HotVibeCardProps) {
  
  const imageToDisplayOnCard = lead.demo_image_url || PLACEHOLDER_IMAGE_CARD;
  const isElonSimulatorCard = lead.id === ELON_SIMULATOR_CARD_ID;
  const isPdfGeneratorCard = lead.id === PERSONALITY_REPORT_PDF_CARD_ID;

  // Define base gradient and text color based on card type or status
  let cardGradientClass = "bg-gradient-to-br from-slate-800 via-slate-900 to-black"; // Default
  let titleTextColorClass = "text-light-text group-hover:text-brand-cyan";
  let earningTextColorClass = "text-brand-green";

  if (isSpecial || isElonSimulatorCard || isPdfGeneratorCard) {
    cardGradientClass = "bg-gradient-to-br from-yellow-600 via-amber-700 to-orange-800";
    titleTextColorClass = "text-brand-yellow group-hover:text-yellow-300";
    earningTextColorClass = "text-yellow-300";
  } else if (isSupported) {
    cardGradientClass = "bg-gradient-to-br from-green-700 via-emerald-800 to-teal-900";
    titleTextColorClass = "text-brand-green group-hover:text-lime-300";
    earningTextColorClass = "text-lime-400";
  } else if (isMissionUnlocked) {
     cardGradientClass = "bg-gradient-to-br from-purple-700 via-indigo-800 to-blue-900";
     titleTextColorClass = "text-brand-purple group-hover:text-indigo-300";
     earningTextColorClass = "text-indigo-400";
  }


  const handleCardClick = (event: React.MouseEvent) => {
    // Prevent click from bubbling if it's on a button or a link inside the card
    if ((event.target as HTMLElement).closest('button, a')) {
      return;
    }
    // Only trigger VIP view if the card is supported (and not Elon, as Elon card button handles its own nav)
    // Or if it's a special card that should go to VIP view directly
    if (isSupported || isSpecial) {
        onViewVip(lead);
    }
  };

  const renderFooterButton = () => {
    const buttonBaseClasses = "w-full font-orbitron text-[0.65rem] sm:text-xs py-2 px-1.5 sm:px-2 rounded-lg flex items-center justify-center text-center leading-tight transition-all duration-200 ease-in-out transform group-hover:scale-105 min-h-fit";
    const disabledClasses = (isPurchasePending || !isAuthenticated) ? "opacity-60 cursor-not-allowed !scale-100" : "";

    let buttonText = "";
    let buttonIcon = "";
    let buttonAction = () => onSupportMission(lead);
    let buttonSpecificClass = "bg-gradient-to-r from-brand-orange via-red-600 to-pink-600 text-white hover:brightness-110";

    if (isElonSimulatorCard) {
      if (isSupported) {
        buttonText = translations.goToSimulatorText;
        buttonIcon = "::FaGamepad::";
        buttonAction = () => onViewVip(lead); // Elon card will be handled by VIP display's execute mission
        buttonSpecificClass = "bg-gradient-to-r from-yellow-400 via-brand-orange to-orange-500 text-black hover:brightness-110";
      } else {
        buttonText = translations.elonSimulatorAccessBtnText;
        buttonIcon = isPurchasePending ? "::FaSpinner className='animate-spin'::" : "::FaHandHoldingDollar::";
        buttonSpecificClass = "bg-gradient-to-r from-yellow-400 via-brand-orange to-orange-600 text-black hover:brightness-110";
      }
    } else if (isPdfGeneratorCard) {
        if (isSupported) {
            buttonText = translations.goToPdfGeneratorText;
            buttonIcon = "::FaFilePdf::";
            buttonAction = () => onViewVip(lead); // PDF gen card also handled by VIP display
            buttonSpecificClass = "bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 text-white hover:brightness-110";
        } else {
            buttonText = translations.pdfGeneratorAccessBtnText;
            buttonIcon = isPurchasePending ? "::FaSpinner className='animate-spin'::" : "::FaHandHoldingDollar::";
            buttonSpecificClass = "bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-700 text-white hover:brightness-110";
        }
    }
    else { // Regular mission cards
      if (isSupported) {
        buttonText = `${translations.supportedText} (${translations.viewDemoText})`;
        buttonIcon = "::FaEye::";
        buttonAction = () => onViewVip(lead);
        buttonSpecificClass = "bg-gradient-to-r from-brand-green via-lime-600 to-emerald-700 text-black hover:brightness-110";
      } else {
        buttonText = translations.supportMissionBtnText;
        buttonIcon = isPurchasePending ? "::FaSpinner className='animate-spin'::" : "::FaHandHoldingDollar::";
        // Use default buttonSpecificClass
      }
    }

    return (
      <Button 
        onClick={buttonAction}
        disabled={(isPurchasePending || !isAuthenticated) && !(isSupported && (isElonSimulatorCard || isPdfGeneratorCard))} // Don't disable "Go To" buttons if supported
        className={cn(buttonBaseClasses, buttonSpecificClass, disabledClasses)}
      >
        <VibeContentRenderer content={`${buttonIcon} className='mr-1 sm:mr-1.5 text-xs':: ${buttonText}`} />
      </Button>
    );
  };

  return (
    <Card 
      onClick={handleCardClick}
      className={cn(
        "hot-vibe-card group relative flex flex-col overflow-hidden rounded-xl transition-all duration-300 ease-in-out aspect-[3/4] sm:aspect-[4/5]",
        cardGradientClass, // Apply gradient background
        (isSupported || isSpecial || isMissionUnlocked) 
          ? "hover:scale-[1.03] hover:-translate-y-0.5" 
          : "opacity-80 hover:opacity-100", 
        (isSupported || isSpecial) ? "cursor-pointer" : "cursor-default"
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
          {/* Overlay for text contrast - removed heavy opacity, rely on gradient */}
          <div className={cn(
              "absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent group-hover:from-black/60"
          )} />
          {(lead.status === 'client_responded_positive' || lead.status === 'interested') && !isElonSimulatorCard && !isPdfGeneratorCard && (
            <div className="absolute top-1.5 right-1.5 bg-brand-red text-white text-[0.55rem] font-orbitron uppercase px-2 py-1 rounded-full animate-pulse flex items-center gap-1 ring-1 ring-white/30">
              HOT <VibeContentRenderer content="::FaFireAlt className='w-2.5 h-2.5'::" />
            </div>
          )}
          {isSupported && (
             <div className="absolute top-1.5 left-1.5 bg-brand-green/80 text-black text-[0.55rem] font-orbitron uppercase px-2 py-1 rounded-full flex items-center gap-1 ring-1 ring-black/20">
                <VibeContentRenderer content="::FaCheckCircle className='w-3 h-3'::" /> 
                <span className="leading-none">
                    {isElonSimulatorCard || isPdfGeneratorCard ? (currentLang === 'ru' ? "Доступен" : "Access") : (currentLang === 'ru' ? "Поддержано" : "Supported")}
                </span>
              </div>
          )}
        </div>

        <CardContent className="flex flex-1 flex-col justify-between p-2.5 sm:p-3 text-center space-y-1.5">
          <div className="min-h-[3.5em] sm:min-h-[4em]"> 
            <h3 
              className={cn(
                "font-orbitron text-sm sm:text-base font-bold leading-tight transition-colors line-clamp-2", 
                titleTextColorClass
              )} 
              title={lead.kwork_gig_title || "Untitled Gig"}
            >
              {lead.kwork_gig_title || (currentLang === 'ru' ? "Без названия" : "Untitled Gig")}
            </h3>
            {lead.ai_summary && (
              <p 
                className={cn(
                    "mt-1 text-[0.6rem] sm:text-[0.7rem] leading-snug line-clamp-2", 
                     "text-gray-300 group-hover:text-gray-200"
                )} 
                title={lead.ai_summary}
              >
                {lead.ai_summary}
              </p>
            )}
          </div>
          <div className="text-[0.7rem] sm:text-xs font-orbitron font-semibold">
            {lead.potential_earning && 
                <span className={cn(earningTextColorClass)}>
                    {lead.potential_earning}
                </span>
            }
          </div>
        </CardContent>
        
        <CardFooter className="p-2 sm:p-2.5 pt-0 mt-auto">
            {renderFooterButton()}
        </CardFooter>
    </Card>
  );
}