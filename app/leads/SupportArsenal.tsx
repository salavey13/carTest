"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from '@/components/ui/textarea';
import { VibeContentRenderer } from '@/components/VibeContentRenderer';
import { cn } from '@/lib/utils';
import { PROMPT_KWORKS_TO_CSV } from './prompt_kworks_to_csv';
import { PROMPT_OFFER_V2_CYBERVIBE_OUTREACH } from './prompt_offer';
import { PROMPT_FIND_TWEAKS } from './prompt_find_tweaks';
import { PROMPT_FIND_MISSING_FEATURES } from './prompt_find_missing_features';
import { PROMPT_INTERGALACTIC_PIPELINE } from './prompt_intergalactic_pipeline';

interface KworkSearchLink {
  name: string;
  url: string;
}

interface SupportArsenalProps {
  rawKworksInput: string;
  processedCsvForUpload: string;
  isLoading: boolean;
  onRawKworksInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onProcessedCsvChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onCopyToClipboard: (textToCopy: string, successMessage: string) => void;
  onUploadCsvToSupabase: () => void;
  onScrollToSection: (ref: React.RefObject<HTMLDivElement>) => void;
  kworkSearchLinks: KworkSearchLink[];
  t: Record<string, any>;
  pageTheme: {
    primaryColor: string;
    accentColor: string;
    borderColor: string;
    shadowColor: string;
  };
  offerSectionRef: React.RefObject<HTMLDivElement>;
}

const SupportArsenal: React.FC<SupportArsenalProps> = ({
  rawKworksInput,
  processedCsvForUpload,
  isLoading,
  onRawKworksInputChange,
  onProcessedCsvChange,
  onCopyToClipboard,
  onUploadCsvToSupabase,
  onScrollToSection,
  kworkSearchLinks,
  t,
  pageTheme,
  offerSectionRef,
}) => {
  return (
    <Card className={cn("bg-black/70 backdrop-blur-md border-2", pageTheme.borderColor, pageTheme.shadowColor)}>
      <CardHeader>
        <CardTitle className={cn("text-2xl sm:text-3xl font-orbitron flex items-center gap-2 sm:gap-3", pageTheme.primaryColor)}>
          <VibeContentRenderer content={t.supportArsenalTitle} />
        </CardTitle>
        <CardDescription className="font-mono text-xs sm:text-sm text-gray-400">
          <VibeContentRenderer content={t.supportArsenalSubtitle} />
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8 sm:space-y-10 font-mono">
        <div id="rawKworksInputAnchor">
          <h4 className={cn("text-lg sm:text-xl font-bold mb-3 sm:mb-4 flex items-center gap-2", pageTheme.accentColor)}>
            <VibeContentRenderer content={t.rawKworksInputTitle} />
          </h4>
          <p className="text-xs sm:text-sm text-gray-300 mb-3 pl-2">
            <VibeContentRenderer content={t.rawKworksInputDesc} />
          </p>
          <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-3 sm:mb-4 pl-2">
            {kworkSearchLinks.map(link => (
              <Button key={link.name} variant="outline" size="xs" asChild className={cn("text-[0.65rem] sm:text-xs py-1 px-1.5 sm:px-2", pageTheme.borderColor, pageTheme.primaryColor, `hover:${pageTheme.primaryColor}/80 hover:bg-black/20 transform hover:scale-105`)}>
                <a href={link.url} target="_blank" rel="noopener noreferrer"><VibeContentRenderer content={link.name} /></a>
              </Button>
            ))}
          </div>
          <Textarea
            value={rawKworksInput}
            onChange={onRawKworksInputChange}
            placeholder={t.rawKworksInputPlaceholder}
            rows={8}
            className="w-full p-2 sm:p-3 border rounded bg-gray-800/70 border-brand-orange/50 text-gray-200 focus:ring-2 focus:ring-brand-orange outline-none placeholder-gray-500 font-mono text-xs sm:text-sm scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800 shadow-inner"
          />
        </div>

        <div>
          <h4 className={cn("text-lg sm:text-xl font-bold mb-3 sm:mb-4 flex items-center gap-2", pageTheme.accentColor)}>
            <VibeContentRenderer content={t.promptButtonsTitle} />
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            <Button
              variant="secondary"
              onClick={() => {
                const textToCopy = PROMPT_KWORKS_TO_CSV.replace("{{RAW_KWORKS_TEXT_BLOCK}}", rawKworksInput || "СКОПИРУЙТЕ_СЮДА_ТЕКСТ_С_KWORK");
                onCopyToClipboard(textToCopy, "Промпт 'KWorks -> CSV' скопирован! Шаг 1 пройден, оперативник!");
              }}
              disabled={!rawKworksInput.trim()}
              className="w-full bg-brand-blue/20 text-brand-blue border-brand-blue/50 hover:bg-brand-blue/30 flex items-center justify-start text-left gap-2 py-2.5 sm:py-3 text-xs sm:text-sm transform hover:scale-105 px-3"
            >
              <VibeContentRenderer content="::facopy::" />
              <span className="flex-grow whitespace-normal">
                <VibeContentRenderer content={t.promptButtonKworksToCsv} />
              </span>
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                const intergalacticPrompt = PROMPT_INTERGALACTIC_PIPELINE(rawKworksInput || "СЫРЫЕ ДАННЫЕ С KWORK ОТСУТСТВУЮТ. ПРОВЕРЬТЕ ВВОД.");
                onCopyToClipboard(intergalacticPrompt, "МЕЖГАЛАКТИЧЕСКИЙ ПРОМПТ СКОПИРОВАН! AI, ГОТОВЬСЯ К ПЕРЕГРУЗКЕ!");
                if (offerSectionRef.current) {
                  setTimeout(() => onScrollToSection(offerSectionRef), 300);
                }
              }}
              disabled={!rawKworksInput.trim()}
              className="w-full bg-gradient-to-r from-red-500 via-pink-500 to-purple-600 text-white border-pink-500/50 hover:opacity-90 flex items-center justify-center gap-2 py-2.5 sm:py-3 text-xs sm:text-sm font-bold transform hover:scale-105 px-3"
            >
              <VibeContentRenderer content="::fameteor:: ВСЁ СРАЗУ В AI!" />
            </Button>
            <Button
              variant="secondary"
              onClick={() => onCopyToClipboard(PROMPT_OFFER_V2_CYBERVIBE_OUTREACH, "Промпт 'CSV + Оффер' скопирован! Передайте AI вместе с CSV.")}
              className="w-full bg-brand-purple/20 text-brand-purple border-brand-purple/50 hover:bg-brand-purple/30 flex items-center justify-start text-left gap-2 py-2.5 sm:py-3 text-xs sm:text-sm transform hover:scale-105 px-3"
            >
              <VibeContentRenderer content="::facopy::" />
              <span className="flex-grow whitespace-normal">
                <VibeContentRenderer content={t.promptButtonCsvToOffer} />
              </span>
            </Button>
            <Button
              variant="secondary"
              onClick={() => onCopyToClipboard(PROMPT_FIND_TWEAKS, "Промпт 'CSV + Твики' скопирован! Передайте AI вместе с CSV.")}
              className="w-full bg-brand-pink/20 text-brand-pink border-brand-pink/50 hover:bg-brand-pink/30 flex items-center justify-start text-left gap-2 py-2.5 sm:py-3 text-xs sm:text-sm transform hover:scale-105 px-3"
            >
              <VibeContentRenderer content="::facopy::" />
              <span className="flex-grow whitespace-normal">
                <VibeContentRenderer content={t.promptButtonCsvToTweaks} />
              </span>
            </Button>
            <Button
              variant="secondary"
              onClick={() => onCopyToClipboard(PROMPT_FIND_MISSING_FEATURES, "Промпт 'CSV + Фичи' скопирован! Передайте AI вместе с CSV.")}
              className="w-full bg-brand-green/20 text-brand-green border-brand-green/50 hover:bg-brand-green/30 flex items-center justify-start text-left gap-2 py-2.5 sm:py-3 text-xs sm:text-sm transform hover:scale-105 px-3"
            >
              <VibeContentRenderer content="::facopy::" />
              <span className="flex-grow whitespace-normal">
                <VibeContentRenderer content={t.promptButtonCsvToFeatures} />
              </span>
            </Button>
          </div>
          <p className="text-[0.7rem] sm:text-xs text-gray-400 mt-3 pl-2">
            <VibeContentRenderer content={t.promptButtonInstruction} />
          </p>
        </div>

        <div ref={offerSectionRef} id="finalCsvUploadAnchor">
          <h4 className={cn("text-lg sm:text-xl font-bold mb-3 sm:mb-4 flex items-center gap-2 pt-4 sm:pt-6 border-t", pageTheme.accentColor, `${pageTheme.borderColor}/30`)}>
            <VibeContentRenderer content={t.finalCsvInputTitle} />
          </h4>
          <p className="text-xs sm:text-sm text-gray-300 mb-3 pl-2">
            <VibeContentRenderer content={t.finalCsvInputDesc} />
          </p>
          <Textarea
            value={processedCsvForUpload}
            onChange={onProcessedCsvChange}
            placeholder={t.finalCsvInputPlaceholder}
            rows={6}
            className="w-full p-2 sm:p-3 mb-3 border rounded bg-gray-800/70 border-brand-lime/50 text-gray-200 focus:ring-2 focus:ring-brand-lime outline-none placeholder-gray-500 font-mono text-xs sm:text-sm scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800 shadow-inner"
          />
          <Button
            onClick={onUploadCsvToSupabase}
            disabled={isLoading || !processedCsvForUpload.trim()}
            className={cn("w-full sm:w-auto bg-brand-lime/80 text-black hover:bg-brand-lime flex items-center justify-center gap-2 py-2.5 sm:py-3 text-sm sm:text-base transform hover:scale-105", (isLoading || !processedCsvForUpload.trim()) && "opacity-50 cursor-not-allowed")}
          >
            <VibeContentRenderer content={isLoading ? "::faspinner className='animate-spin':: ДЕСАНТИРОВАНИЕ..." : t.uploadLeadsButton} />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default SupportArsenal;