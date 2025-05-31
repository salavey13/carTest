"use client";

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader as ShadCardHeader, CardTitle as ShadCardTitle, CardDescription as ShadCardDescription } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  // DialogHeader, // DialogHeader will be a custom div for more control
  // DialogTitle, // Will use ShadCardTitle
  // DialogDescription, // Will use ShadCardDescription
  DialogClose,
} from '@/components/ui/dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { VibeContentRenderer } from '@/components/VibeContentRenderer';
import { FaXmark, FaChevronDown, FaChevronUp } from "react-icons/fa6";
import { toast } from 'sonner';

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
}

interface HotVibeCardTheme {
  borderColor: string; // e.g., "border-brand-red/70"
  accentGradient: string; // e.g., "bg-gradient-to-r from-brand-red via-brand-orange to-yellow-500"
  modalOverlayGradient?: string; // e.g., "from-black/80 via-brand-purple/70 to-black/90"
  modalAccentColor?: string; // e.g., "text-brand-cyan"
  modalCardBg?: string; // e.g., "bg-black/50"
  modalCardBorder?: string; // e.g., "border-brand-cyan/30"
}

interface HotVibeCardProps {
  lead: HotLeadData;
  isMissionUnlocked: boolean;
  onExecuteMission: (leadId: string, questId: string | undefined) => void;
  currentLang?: 'ru' | 'en';
  theme: HotVibeCardTheme;
}

const PLACEHOLDER_IMAGE = "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/bullshitemotions//pooh.png";

export function HotVibeCard({ lead, isMissionUnlocked, onExecuteMission, currentLang = 'ru', theme }: HotVibeCardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDescriptionOpen, setIsDescriptionOpen] = useState(false);
  const [isOfferOpen, setIsOfferOpen] = useState(false);
  const imageToDisplay = lead.demo_image_url || PLACEHOLDER_IMAGE;

  const handleExecuteClick = () => {
    onExecuteMission(lead.id, lead.required_quest_id);
    setIsModalOpen(false);
  };
  
  const handleCopyToClipboard = (text: string | null | undefined, message: string) => {
    if (!text) {
      toast.error("Нет текста для копирования.");
      return;
    }
    navigator.clipboard.writeText(text)
      .then(() => toast.success(message))
      .catch(err => toast.error(`Ошибка копирования: ${err.message}`));
  };

  const tModal = {
    ru: { 
        viewOriginal: "Смотреть Оригинал на KWork", 
        clientSays: "Клиент говорит:", 
        draftOffer: "Черновик Оффера:", 
        fullDescription: "Полное Описание:", 
        executeMission: "::FaFireAlt className='mr-2':: Выполнить Миссию Огня!", 
        skillLocked: "::FaLock className='mr-2':: Навык Заблокирован", 
        close: "Закрыть",
        missionBriefing: "::FaListCheck className='mr-2':: Брифинг Миссии",
        budget: "Бюджет:",
        taskType: "Тип Задачи:",
        requiredSkill: "Требуемый Навык:",
        clientStatus: "Статус Клиента:",
        copyOffer: "Копировать Оффер",
     },
    en: { /* ... English translations ... */ }
  };
  const modalText = tModal[currentLang];
  const modalEffectiveOverlayGradient = theme.modalOverlayGradient || "from-black/80 via-brand-purple/70 to-black/90";

  return (
    <Card className={cn(
        "hot-vibe-card group relative flex flex-col overflow-hidden rounded-xl border-2 bg-card/80 backdrop-blur-md shadow-lg transition-all duration-300 ease-in-out focus-within:shadow-[0_0_25px_rgba(var(--brand-red-rgb),0.6)] aspect-[3/4] sm:aspect-[4/5]",
        isMissionUnlocked ? `${theme.borderColor} hover:${theme.borderColor.replace("/70", "")} hover:shadow-[0_0_25px_rgba(var(--brand-red-rgb),0.6)]` : "border-muted/30"
      )}
    >
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogTrigger asChild>
          <div className="relative aspect-[3/2] w-full cursor-pointer overflow-hidden rounded-t-lg">
            <Image
              src={imageToDisplay}
              alt={lead.kwork_gig_title || 'Hot Vibe Lead'}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="object-cover object-center group-hover:scale-105 transition-transform duration-300 ease-in-out"
              onError={(e) => { (e.target as HTMLImageElement).src = PLACEHOLDER_IMAGE; }}
            />
            <div className={cn(
                "absolute inset-0 bg-gradient-to-t opacity-100 group-hover:opacity-60 transition-opacity duration-300",
                isMissionUnlocked ? "from-black/80 via-black/30 to-transparent" : "from-gray-900/90 via-gray-800/50 to-transparent"
            )} />
            {(lead.status === 'client_responded_positive' || lead.status === 'interested') && (
              <div className="absolute top-1.5 right-1.5 bg-brand-red text-destructive-foreground text-[0.6rem] font-orbitron uppercase px-1.5 py-0.5 rounded-full shadow-md animate-pulse flex items-center gap-1">
                HOT! <VibeContentRenderer content="::FaFire className='w-2.5 h-2.5'::" />
              </div>
            )}
          </div>
        </DialogTrigger>

        <CardContent className="flex flex-1 flex-col justify-between p-2 sm:p-3 text-center">
          <div>
            <h3 className={cn("font-orbitron text-xs sm:text-sm font-semibold leading-tight group-hover:text-brand-red transition-colors line-clamp-2", isMissionUnlocked ? "text-light-text" : "text-muted-foreground/70")} title={lead.kwork_gig_title || "Untitled Gig"}>
              {lead.kwork_gig_title || (currentLang === 'ru' ? "Без названия" : "Untitled Gig")}
            </h3>
            {lead.ai_summary && (
              <p className={cn("mt-0.5 text-[0.65rem] sm:text-xs line-clamp-2", isMissionUnlocked ? "text-muted-foreground" : "text-muted-foreground/50")} title={lead.ai_summary}>
                {lead.ai_summary}
              </p>
            )}
            {lead.client_response_snippet && (
              <p className="mt-0.5 text-[0.65rem] sm:text-xs font-mono text-brand-lime italic line-clamp-1">
                "{lead.client_response_snippet}"
              </p>
            )}
          </div>
          <div className="mt-1.5 text-[0.65rem] sm:text-xs font-mono">
            {lead.potential_earning && <span className={cn("font-semibold", isMissionUnlocked ? "text-brand-green" : "text-muted-foreground/60")}>{lead.potential_earning}</span>}
          </div>
        </CardContent>

        <CardFooter className="p-2 sm:p-2.5 pt-0">
          <Button
            onClick={handleExecuteClick} // This will now only open the modal
            // disabled={!isMissionUnlocked} // Button on card always enabled to open modal
            variant="default"
            size="sm"
            className={cn(
              "w-full font-orbitron text-[0.7rem] sm:text-xs py-1.5 sm:py-2",
              isMissionUnlocked ? `${theme.accentGradient} text-black hover:brightness-110 active:scale-95 shadow-md` : "bg-gray-600 text-gray-400 hover:bg-gray-500" // Still show it's locked, but allow opening
            )}
          >
            <VibeContentRenderer content={isMissionUnlocked ? (currentLang === 'ru' ? "::FaBolt:: Взять Миссию!" : "::FaBolt:: Take Mission!") : (currentLang === 'ru' ? "::FaLock:: Навык Закрыт (Инфо)" : "::FaLock:: Skill Locked (Info)")} />
          </Button>
        </CardFooter>

        {/* MODAL CONTENT - IRRESISTIBLE SAUSAGE UNVEILING */}
        <DialogContent 
            className={cn(
            "hotvibe-modal max-w-3xl w-[95vw] sm:w-[90vw] md:w-[80vw] lg:w-[70vw] xl:w-[65vw] max-h-[90vh]", // Slightly wider for better layout
            "bg-dark-card text-light-text p-0 overflow-hidden flex flex-col", 
            "border-2", theme.borderColor, `shadow-[0_0_45px_rgba(var(--brand-cyan-rgb),0.5)]` // Cyan glow for modal
            )}
        >
            {/* Background Image & Gradient Overlay Layer */}
            <div className="absolute inset-0 z-0 pointer-events-none">
                {imageToDisplay && ( // Use imageToDisplay for consistent source
                    <Image
                        src={imageToDisplay}
                        alt="Mission Background"
                        fill
                        className="object-cover opacity-15 blur-md scale-110" // More blur, slight scale
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                )}
                <div className={cn("absolute inset-0", modalEffectiveOverlayGradient, "opacity-80")} />
                 {/* Noise/Pattern Overlay */}
                <div className="absolute inset-0 opacity-[0.02]" style={{backgroundImage: `url('/patterns/cyber-grid.svg')`, backgroundSize: '50px'}}></div>
            </div>

            {/* Modal Header (Custom) */}
            <div className="relative z-10 p-4 pt-5 sm:p-5 border-b border-white/10 flex-shrink-0 flex justify-between items-start bg-black/30 backdrop-blur-sm rounded-t-xl">
                <div className="flex-grow">
                    <ShadCardTitle className={cn("font-orbitron text-lg sm:text-xl md:text-2xl line-clamp-2", theme.modalAccentColor || "text-brand-cyan", "text-glow-cyan")}>
                        {lead.client_name ? `${lead.client_name}: ${lead.kwork_gig_title}` : lead.kwork_gig_title || (currentLang === 'ru' ? "Детали Горячего Вайба" : "Hot Vibe Details")}
                    </ShadCardTitle>
                    {lead.kwork_url && (
                    <ShadCardDescription className="pt-0.5">
                        <Link href={lead.kwork_url} target="_blank" rel="noopener noreferrer" className="text-xs sm:text-sm text-brand-blue hover:underline flex items-center gap-1.5">
                            {modalText.viewOriginal} <VibeContentRenderer content="::FaArrowUpRightFromSquare className='w-3 h-3'::" />
                        </Link>
                    </ShadCardDescription>
                    )}
                </div>
                <DialogClose asChild>
                    <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground w-8 h-8 p-1.5 flex-shrink-0 ml-2">
                        <FaXmark className="w-5 h-5" />
                        <span className="sr-only">{modalText.close}</span>
                    </Button>
                </DialogClose>
            </div>

            {/* Scrollable Content Area */}
            <div className="relative z-10 flex-grow overflow-y-auto p-4 sm:p-5 space-y-4 font-mono simple-scrollbar">
                {/* Main Demo Image - Sharper, Centered */}
                 {imageToDisplay && (
                    <div className="aspect-video relative w-full max-w-md mx-auto rounded-lg overflow-hidden border-2 border-white/20 shadow-2xl mb-4 transform hover:scale-105 transition-transform duration-300">
                    <Image
                        src={imageToDisplay}
                        alt={`Demo for ${lead.kwork_gig_title || 'Hot Vibe Lead'}`}
                        fill
                        className="object-contain"
                        onError={(e) => { (e.target as HTMLImageElement).src = PLACEHOLDER_IMAGE; }}
                    />
                    </div>
                )}

                {/* Mission Briefing Section */}
                <Card className={cn("backdrop-blur-sm border p-3 sm:p-4", theme.modalCardBg, theme.modalCardBorder)}>
                    <ShadCardHeader className="p-0 mb-2">
                        <ShadCardTitle className={cn("text-sm sm:text-base font-orbitron flex items-center", theme.modalAccentColor || "text-brand-cyan")}>
                        <VibeContentRenderer content={modalText.missionBriefing}/>
                        </ShadCardTitle>
                    </ShadCardHeader>
                    <CardContent className="p-0 text-xs space-y-1.5 text-gray-300">
                        {lead.potential_earning && <p><VibeContentRenderer content="::FaMoneyBillWave className='text-brand-green mr-1.5':: "/>{modalText.budget} <span className="font-semibold text-white">{lead.potential_earning}</span></p>}
                        {lead.project_type_guess && <p><VibeContentRenderer content="::FaLightbulb className='text-brand-yellow mr-1.5':: "/>{modalText.taskType} <span className="font-semibold text-white">{lead.project_type_guess}</span></p>}
                        {lead.required_quest_id && <p><VibeContentRenderer content="::FaBoltLightning className='text-brand-orange mr-1.5':: "/>{modalText.requiredSkill} <span className="font-semibold text-white">{lead.required_quest_id}</span></p>}
                        {lead.client_response_snippet && <p className="text-brand-lime"><VibeContentRenderer content="::FaCommentDots className='text-brand-lime mr-1.5':: "/>{modalText.clientStatus} <span className="font-semibold text-white italic">"{lead.client_response_snippet}"</span></p>}
                    </CardContent>
                </Card>

                {/* Full Description (Collapsible) */}
                {lead.project_description && (
                  <Collapsible open={isDescriptionOpen} onOpenChange={setIsDescriptionOpen}>
                    <Card className={cn("backdrop-blur-sm border", theme.modalCardBg, theme.modalCardBorder)}>
                      <CollapsibleTrigger asChild>
                        <ShadCardHeader className="pt-3 pb-2 px-3 sm:px-4 cursor-pointer flex justify-between items-center hover:bg-white/5 transition-colors rounded-t-md">
                          <ShadCardTitle className={cn("text-sm sm:text-base font-orbitron flex items-center", theme.modalAccentColor || "text-brand-purple")}>
                              <VibeContentRenderer content="::FaFileLines className='mr-2'::"/>{modalText.fullDescription}
                          </ShadCardTitle>
                          <Button variant="ghost" size="icon" className="h-6 w-6 p-1 text-gray-400">
                            {isDescriptionOpen ? <FaChevronUp /> : <FaChevronDown />}
                          </Button>
                        </ShadCardHeader>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <CardContent className="p-3 sm:p-4 text-xs text-gray-300 whitespace-pre-wrap break-words max-h-32 sm:max-h-40 overflow-y-auto simple-scrollbar">
                          <VibeContentRenderer content={lead.project_description} />
                        </CardContent>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>
                )}
            
                {/* Offer Draft (Collapsible) */}
                {lead.ai_generated_proposal_draft && (
                  <Collapsible open={isOfferOpen} onOpenChange={setIsOfferOpen}>
                     <Card className={cn("backdrop-blur-sm border", theme.modalCardBg, theme.modalCardBorder)}>
                        <CollapsibleTrigger asChild>
                            <ShadCardHeader className="pt-3 pb-2 px-3 sm:px-4 cursor-pointer flex justify-between items-center hover:bg-white/5 transition-colors rounded-t-md">
                                <ShadCardTitle className={cn("text-sm sm:text-base font-orbitron flex items-center", theme.modalAccentColor || "text-brand-pink")}>
                                    <VibeContentRenderer content="::FaPaperPlane className='mr-2'::"/>{modalText.draftOffer}
                                </ShadCardTitle>
                                <Button variant="ghost" size="icon" className="h-6 w-6 p-1 text-gray-400">
                                    {isOfferOpen ? <FaChevronUp /> : <FaChevronDown />}
                                </Button>
                            </ShadCardHeader>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                            <CardContent className="p-3 sm:p-4 text-xs text-gray-300">
                                <pre className="whitespace-pre-wrap break-words max-h-32 sm:max-h-40 overflow-y-auto simple-scrollbar">{lead.ai_generated_proposal_draft}</pre>
                                <Button variant="outline" size="sm" className={cn("mt-2 text-xs h-auto py-1 px-2", theme.borderColor, theme.modalAccentColor || "text-brand-pink", `hover:bg-opacity-20`)}
                                        onClick={() => handleCopyToClipboard(lead.ai_generated_proposal_draft, "Черновик оффера скопирован!")}>
                                    <VibeContentRenderer content="::FaCopy className='mr-1.5'::"/>{modalText.copyOffer}
                                </Button>
                            </CardContent>
                        </CollapsibleContent>
                    </Card>
                  </Collapsible>
                )}
            </div>

            {/* Modal Footer / CTA */}
            <div className="relative z-10 p-4 sm:p-5 border-t border-white/10 flex-shrink-0 mt-auto bg-black/30 backdrop-blur-sm rounded-b-xl">
                <Button
                onClick={handleExecuteClick}
                disabled={!isMissionUnlocked}
                variant="default"
                size="lg"
                className={cn(
                    "w-full font-orbitron text-sm sm:text-base py-3 shadow-lg",
                    isMissionUnlocked ? `${theme.accentGradient} text-black hover:brightness-110 active:scale-95 shadow-md` : "bg-muted text-muted-foreground cursor-not-allowed"
                )}
                >
                <VibeContentRenderer content={isMissionUnlocked ? modalText.executeMission : modalText.skillLocked} />
                </Button>
            </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}