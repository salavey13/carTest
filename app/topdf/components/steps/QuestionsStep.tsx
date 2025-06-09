"use client";

import React, { useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { VibeContentRenderer } from '@/components/VibeContentRenderer';
import { StepWrapper } from '../StepWrapper';
import { cn } from '@/lib/utils';

interface QuestionsStepProps {
  translations: (key: string, replacements?: Record<string, string | number>) => string;
  markdownInput: string;
  setMarkdownInput: (value: string) => void;
  selectedFile: File | null;
  isLoading: boolean;
  onGenerateDemoQuestions: () => void;
  onCopyToClipboard: () => void;
  onGeneratePdf: () => void;
  onBack: () => void;
  onXlsxFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

export const QuestionsStep: React.FC<QuestionsStepProps> = ({
  translations: t,
  markdownInput, setMarkdownInput,
  selectedFile, isLoading,
  onGenerateDemoQuestions, onCopyToClipboard, onGeneratePdf, onBack,
  onXlsxFileChange
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <StepWrapper title={t("prizmaQuestionsTitle")} onBack={onBack} showBackButton>
      <div className="space-y-4">
        <Button onClick={onGenerateDemoQuestions} variant="outline" className="w-full border-brand-yellow/80 text-brand-yellow hover:bg-brand-yellow/10">
          <span className="flex items-center justify-center">
            <VibeContentRenderer content="::FaCircleQuestion::" className="mr-2"/>{t("generateDemoQuestions")}
          </span>
        </Button>
        <div>
          <Label htmlFor="markdownInput" className="text-sm font-medium text-muted-foreground">
            {t("pasteMarkdown")}
          </Label>
          <textarea
            id="markdownInput"
            value={markdownInput}
            onChange={(e) => setMarkdownInput(e.target.value)}
            placeholder={t('workingAreaMark')}
            rows={15}
            className="w-full mt-1 p-2.5 sm:p-3 input-cyber simple-scrollbar"
            disabled={isLoading}
          />
        </div>
        {(markdownInput) && (
          <div className="mt-4 flex flex-col sm:flex-row gap-3">
            <Button onClick={onCopyToClipboard} variant="outline" className="border-brand-cyan/80 text-brand-cyan hover:bg-brand-cyan/10 flex-1">
              <span className="flex items-center justify-center">
                <VibeContentRenderer content="::FaCopy::" className="mr-2"/>{t("copyPromptAndData")}
              </span>
            </Button>
            <div className="flex-1">
                <Button variant="outline" asChild className="border-brand-blue/80 text-brand-blue hover:bg-brand-blue/10 w-full">
                    <a href="https://aistudio.google.com/" target="_blank" rel="noopener noreferrer">
                        <span className="flex items-center justify-center">
                        <VibeContentRenderer content="::FaGoogle::" className="mr-2"/>{t("goToAiStudio")}
                        </span>
                    </a>
                </Button>
                 <p className="text-xs text-muted-foreground text-center mt-1">{t("goToAiStudioSubtext")}</p>
            </div>
          </div>
        )}
        <details className="mt-4 pt-4 border-t border-border group">
          <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors font-semibold flex items-center gap-1">
            <span className="flex items-center gap-1">
              <VibeContentRenderer content="::FaFileImport::" />
              {t("xlsxUploadOptionalTitle")}
              <VibeContentRenderer content="::FaChevronDown className='ml-auto group-open:rotate-180 transition-transform'::"/>
            </span>
          </summary>
          <div className="mt-3 p-3 border border-dashed border-border rounded-lg bg-background shadow-inner">
            <label
              htmlFor="xlsxFileOptional"
              className={cn(
                "w-full flex flex-col items-center justify-center px-4 py-4 border-2 border-dashed rounded-lg cursor-pointer transition-all duration-200 ease-in-out",
                "border-input-border hover:border-brand-yellow text-muted-foreground hover:text-brand-yellow",
                isLoading ? "opacity-70 cursor-not-allowed" : "hover:bg-brand-yellow/5"
              )}
            >
              <VibeContentRenderer content="::FaUpload::" className="text-xl mb-1" />
              <span className="font-medium text-xs">
                {selectedFile ? t('fileSelected', { FILENAME: selectedFile.name }) : t('selectFile')}
              </span>
              <input
                id="xlsxFileOptional"
                ref={fileInputRef}
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={onXlsxFileChange}
                className="sr-only"
                disabled={isLoading}
              />
            </label>
          </div>
        </details>
      </div>
      <Button onClick={onGeneratePdf} disabled={isLoading || !markdownInput.trim()} size="lg" className="w-full mt-8 bg-brand-gradient-purple-blue text-white font-semibold py-3 text-lg shadow-md hover:opacity-90 transition-opacity">
        {isLoading ? <><VibeContentRenderer content="::FaSpinner className='animate-spin mr-2'::"/>{t("prizmaAnalyzing")}</> : t("prizmaNext")}
      </Button>
    </StepWrapper>
  );
};