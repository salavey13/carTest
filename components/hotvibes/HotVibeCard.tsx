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
  DialogClose,
} from '@/components/ui/dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { VibeContentRenderer } from '@/components/VibeContentRenderer';
import { FaXmark, FaChevronDown, FaChevronUp, FaCopy } from "react-icons/fa6"; // Добавили FaCopy
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

export interface HotVibeCardTheme { // Экспортируем тип для использования в page.tsx
  borderColor: string;
  accentGradient: string;
  modalOverlayGradient?: string;
  modalAccentColor?: string;
  modalCardBg?: string;
  modalCardBorder?: string;
  modalImageOverlayGradient?: string; // Новый градиент для изображения
}

interface HotVibeCardProps {
  lead: HotLeadData;
  isMissionUnlocked: boolean;
  onExecuteMission: (leadId: string, questId: string | undefined) => void;
  currentLang?: 'ru' | 'en';
  theme: HotVibeCardTheme;
}

const PLACEHOLDER_IMAGE = "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/bullshitemotions//pooh.png"; // Можно заменить на более нейтральный плейсхолдер для модала

export function HotVibeCard({ lead, isMissionUnlocked, onExecuteMission, currentLang = 'ru', theme }: HotVibeCardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDescriptionOpen, setIsDescriptionOpen] = useState(false);
  const [isOfferOpen, setIsOfferOpen] = useState(false);
  const imageToDisplayOnCard = lead.demo_image_url || PLACEHOLDER_IMAGE; // Для карточки может быть один
  const imageForModalBackground = lead.demo_image_url || "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/aPAQbwg_700b-62cff769-b043-4043-923d-76a1e9e4b71f.jpg"; // Более абстрактный или качественный для фона модала

  const handleExecuteClick = () => {
    if (!isMissionUnlocked) {
        // Можно показать toast или просто ничего не делать, т.к. кнопка будет disabled
        toast.error(modalText.skillLocked.replace("::FaLock className='mr-2'::", "").trim() + " Требуется: " + (lead.required_quest_id || "Базовый навык"));
        return;
    }
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
  const modalEffectiveOverlayGradient = theme.modalOverlayGradient || "from-black/50 via-purple-900/40 to-black/70"; // Сделал чуть прозрачнее
  const modalImageEffectiveOverlayGradient = theme.modalImageOverlayGradient || "bg-gradient-to-t from-black/90 via-black/50 to-transparent";


  return (
    <Card className={cn(
        "hot-vibe-card group relative flex flex-col overflow-hidden rounded-xl border-2 bg-card/80 backdrop-blur-md shadow-lg transition-all duration-300 ease-in-out focus-within:shadow-[0_0_25px_rgba(var(--brand-red-rgb),0.6)] aspect-[3/4] sm:aspect-[4/5]",
        isMissionUnlocked ? `${theme.borderColor} hover:${theme.borderColor.replace("/70", "")} hover:shadow-[0_0_25px_rgba(var(--brand-red-rgb),0.6)]` : "border-muted/30"
      )}
    >
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogTrigger asChild>
          {/* Этот div - триггер для модала, нажимаем на всю карточку (кроме кнопки) или только на картинку */}
          <button className="relative aspect-[3/2] w-full cursor-pointer overflow-hidden rounded-t-lg block text-left focus:outline-none focus:ring-2 focus:ring-brand-red focus:ring-offset-2 focus:ring-offset-card">
            <Image
              src={imageToDisplayOnCard}
              alt={lead.kwork_gig_title || 'Hot Vibe Lead'}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="object-cover object-center group-hover:scale-105 transition-transform duration-300 ease-in-out"
              onError={(e) => { (e.target as HTMLImageElement).src = PLACEHOLDER_IMAGE; }}
            />
            <div className={cn(
                "absolute inset-0 opacity-100 group-hover:opacity-60 transition-opacity duration-300",
                modalImageEffectiveOverlayGradient, // Применяем градиент на изображение карточки
                isMissionUnlocked ? "" : "bg-gray-900/50" // Затемнение если заблокировано
            )} />
            {(lead.status === 'client_responded_positive' || lead.status === 'interested') && (
              <div className="absolute top-1.5 right-1.5 bg-brand-red text-destructive-foreground text-[0.6rem] font-orbitron uppercase px-1.5 py-0.5 rounded-full shadow-md animate-pulse flex items-center gap-1">
                HOT! <VibeContentRenderer content="::FaFire className='w-2.5 h-2.5'::" />
              </div>
            )}
          </button>
        </DialogTrigger>

        {/* ... остальная часть карточки (CardContent, CardFooter) без изменений ... */}
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
          <DialogTrigger asChild> {/* Обернули кнопку в DialogTrigger */}
            <Button
              // onClick={handleExecuteClick} // Теперь клик открывает модал
              variant="default"
              size="sm"
              className={cn(
                "w-full font-orbitron text-[0.7rem] sm:text-xs py-1.5 sm:py-2",
                isMissionUnlocked ? `${theme.accentGradient} text-black hover:brightness-110 active:scale-95 shadow-md` : "bg-gray-600 text-gray-400 hover:bg-gray-500"
              )}
            >
              <VibeContentRenderer content={isMissionUnlocked ? (currentLang === 'ru' ? "::FaBolt:: Взять Миссию!" : "::FaBolt:: Take Mission!") : (currentLang === 'ru' ? "::FaLock:: Навык Закрыт (Инфо)" : "::FaLock:: Skill Locked (Info)")} />
            </Button>
          </DialogTrigger>
        </CardFooter>

        {/* MODAL CONTENT - IRRESISTIBLE SAUSAGE UNVEILING - EPIC OVERHAUL */}
        <DialogContent 
            className={cn(
            "hotvibe-modal max-w-3xl w-[95vw] sm:w-[90vw] md:w-[80vw] lg:w-[500px] max-h-[95vh] sm:max-h-[85vh]", // Сделал уже для мобилок
            "bg-dark-card text-light-text p-0 overflow-hidden flex flex-col", 
            "border-2", theme.borderColor, `shadow-[0_0_50px_rgba(var(--brand-cyan-rgb),0.6)]` // Ярче циан глоу
            )}
            onOpenAutoFocus={(e) => e.preventDefault()} // Предотвращаем авто-фокус на первый элемент
        >
            {/* Верхняя половина - Изображение с градиентом */}
            <div className="relative w-full h-[45vh] sm:h-[50vh] flex-shrink-0 overflow-hidden group">
                {imageForModalBackground && (
                    <Image
                        src={imageForModalBackground}
                        alt="Mission Epic Background"
                        fill
                        className="object-cover scale-105 group-hover:scale-110 transition-transform duration-500 ease-out"
                        priority
                        onError={(e) => { (e.target as HTMLImageElement).src = PLACEHOLDER_IMAGE; }}
                    />
                )}
                {/* Градиент поверх изображения, чтобы текст снизу читался */}
                <div className={cn("absolute inset-0", modalImageEffectiveOverlayGradient, "opacity-100")} />
                
                {/* Заголовок и кнопка закрытия поверх изображения */}
                <div className="absolute top-0 left-0 right-0 p-4 sm:p-5 flex justify-between items-start z-20 bg-gradient-to-b from-black/70 via-black/40 to-transparent pb-10">
                    <div className="flex-grow">
                        <ShadCardTitle className={cn("font-orbitron text-xl sm:text-2xl md:text-3xl line-clamp-3 leading-tight", theme.modalAccentColor || "text-brand-cyan", "text-glow-cyan")}>
                            {lead.client_name ? `${lead.client_name}: ${lead.kwork_gig_title}` : lead.kwork_gig_title || (currentLang === 'ru' ? "Детали Горячего Вайба" : "Hot Vibe Details")}
                        </ShadCardTitle>
                        {lead.kwork_url && (
                        <ShadCardDescription className="pt-1">
                            <Link href={lead.kwork_url} target="_blank" rel="noopener noreferrer" className="text-xs sm:text-sm text-brand-blue hover:underline flex items-center gap-1.5 opacity-80 hover:opacity-100">
                                {modalText.viewOriginal} <VibeContentRenderer content="::FaArrowUpRightFromSquare className='w-3 h-3'::" />
                            </Link>
                        </ShadCardDescription>
                        )}
                    </div>
                    <DialogClose asChild>
                        <Button variant="ghost" size="icon" className="text-gray-300 hover:text-white w-9 h-9 p-2 flex-shrink-0 ml-2 rounded-full bg-black/30 hover:bg-black/50 backdrop-blur-sm">
                            <FaXmark className="w-5 h-5" />
                            <span className="sr-only">{modalText.close}</span>
                        </Button>
                    </DialogClose>
                </div>
            </div>
            
            {/* Нижняя половина - Контент (скроллабл) */}
            <div className={cn(
                "relative z-10 flex-grow overflow-y-auto p-4 sm:p-5 space-y-3 sm:space-y-4 font-mono simple-scrollbar",
                "bg-dark-bg" // Добавил фон для контентной части
              )}
            >
                {/* Mission Briefing Section */}
                <Card className={cn("border p-3 sm:p-4 shadow-md", theme.modalCardBg, theme.modalCardBorder)}>
                    <ShadCardHeader className="p-0 mb-2 sm:mb-3">
                        <ShadCardTitle className={cn("text-base sm:text-lg font-orbitron flex items-center", theme.modalAccentColor || "text-brand-cyan")}>
                        <VibeContentRenderer content={modalText.missionBriefing}/>
                        </ShadCardTitle>
                    </ShadCardHeader>
                    <CardContent className="p-0 text-xs sm:text-sm space-y-1.5 text-gray-200">
                        {lead.potential_earning && <p><VibeContentRenderer content="::FaMoneyBillWave className='text-brand-green mr-1.5':: "/>{modalText.budget} <span className="font-semibold text-white">{lead.potential_earning}</span></p>}
                        {lead.project_type_guess && <p><VibeContentRenderer content="::FaLightbulb className='text-brand-yellow mr-1.5':: "/>{modalText.taskType} <span className="font-semibold text-white">{lead.project_type_guess}</span></p>}
                        {lead.required_quest_id && <p><VibeContentRenderer content="::FaBoltLightning className='text-brand-orange mr-1.5':: "/>{modalText.requiredSkill} <span className="font-semibold text-white">{lead.required_quest_id}</span></p>}
                        {lead.client_response_snippet && <p className="text-brand-lime"><VibeContentRenderer content="::FaCommentDots className='text-brand-lime mr-1.5':: "/>{modalText.clientStatus} <span className="font-semibold text-white italic">"{lead.client_response_snippet}"</span></p>}
                    </CardContent>
                </Card>

                {/* Full Description (Collapsible) */}
                {lead.project_description && (
                  <Collapsible open={isDescriptionOpen} onOpenChange={setIsDescriptionOpen} className="rounded-lg overflow-hidden">
                    <Card className={cn("border-0 shadow-none", theme.modalCardBg)}>
                      <CollapsibleTrigger asChild>
                        <ShadCardHeader className={cn("pt-3 pb-2 px-3 sm:px-4 cursor-pointer flex justify-between items-center transition-colors rounded-t-md", isDescriptionOpen ? `${theme.modalCardBorder} bg-white/5` : `${theme.modalCardBorder} hover:bg-white/5`)}>
                          <ShadCardTitle className={cn("text-sm sm:text-base font-orbitron flex items-center", theme.modalAccentColor || "text-brand-purple")}>
                              <VibeContentRenderer content="::FaFileLines className='mr-2'::"/>{modalText.fullDescription}
                          </ShadCardTitle>
                          <Button variant="ghost" size="icon" className="h-7 w-7 p-1 text-gray-400">
                            {isDescriptionOpen ? <FaChevronUp /> : <FaChevronDown />}
                          </Button>
                        </ShadCardHeader>
                      </CollapsibleTrigger>
                      <CollapsibleContent className={cn("border-x border-b rounded-b-md",theme.modalCardBorder)}>
                        <CardContent className="p-3 sm:p-4 text-xs text-gray-300 whitespace-pre-wrap break-words max-h-32 sm:max-h-40 overflow-y-auto simple-scrollbar">
                          <VibeContentRenderer content={lead.project_description} />
                        </CardContent>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>
                )}
            
                {/* Offer Draft (Collapsible) */}
                {lead.ai_generated_proposal_draft && (
                  <Collapsible open={isOfferOpen} onOpenChange={setIsOfferOpen} className="rounded-lg overflow-hidden">
                     <Card className={cn("border-0 shadow-none", theme.modalCardBg)}>
                        <CollapsibleTrigger asChild>
                            <ShadCardHeader className={cn("pt-3 pb-2 px-3 sm:px-4 cursor-pointer flex justify-between items-center transition-colors rounded-t-md", isOfferOpen ? `${theme.modalCardBorder} bg-white/5` : `${theme.modalCardBorder} hover:bg-white/5`)}>
                                <ShadCardTitle className={cn("text-sm sm:text-base font-orbitron flex items-center", theme.modalAccentColor || "text-brand-pink")}>
                                    <VibeContentRenderer content="::FaPaperPlane className='mr-2'::"/>{modalText.draftOffer}
                                </ShadCardTitle>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 p-1 text-gray-400">
                                    {isOfferOpen ? <FaChevronUp /> : <FaChevronDown />}
                                </Button>
                            </ShadCardHeader>
                        </CollapsibleTrigger>
                        <CollapsibleContent className={cn("border-x border-b rounded-b-md",theme.modalCardBorder)}>
                            <CardContent className="p-3 sm:p-4 text-xs text-gray-300">
                                <pre className="whitespace-pre-wrap break-words max-h-32 sm:max-h-40 overflow-y-auto simple-scrollbar">{lead.ai_generated_proposal_draft}</pre>
                                <Button variant="outline" size="sm" className={cn("mt-2 text-xs h-auto py-1.5 px-2.5", theme.borderColor, theme.modalAccentColor || "text-brand-pink", `hover:bg-opacity-20 focus:ring-2 focus:ring-offset-0 ${(theme.modalAccentColor || "text-brand-pink").replace('text-','ring-')}`)}
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
            <div className="relative z-10 p-3 sm:p-4 border-t border-white/10 flex-shrink-0 mt-auto bg-black/40 backdrop-blur-sm rounded-b-xl">
                <Button
                onClick={handleExecuteClick} // Теперь этот клик действительно выполняет миссию
                disabled={!isMissionUnlocked}
                variant="default"
                size="lg"
                className={cn(
                    "w-full font-orbitron text-sm sm:text-base py-2.5 sm:py-3 shadow-lg", // Уменьшил паддинг для лучшего вида
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