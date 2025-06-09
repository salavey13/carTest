"use client";

import React from 'react';
import { Button } from "@/components/ui/button";
import { VibeContentRenderer } from '@/components/VibeContentRenderer';
import { StepWrapper } from '../StepWrapper';

interface BasicAnalysisReadyStepProps {
  translations: (key: string, replacements?: Record<string, string | number>) => string;
  onGetFullAnalysis: () => void;
  onGoToIntro: () => void;
  hasProAccess: boolean;
}

export const BasicAnalysisReadyStep: React.FC<BasicAnalysisReadyStepProps> = ({
  translations: t,
  onGetFullAnalysis,
  onGoToIntro,
  hasProAccess
}) => {
  return (
    <StepWrapper className="text-center">
      <VibeContentRenderer content="::FaCheckCircle className='text-6xl text-green-500 mx-auto mb-4'::" />
      <h1 className="text-3xl font-orbitron font-bold text-transparent bg-clip-text bg-gradient-to-r from-brand-pink via-brand-purple to-brand-blue mb-3">
        {t("prizmaBasicAnalysisReadyTitle")}
      </h1>
      <p className="text-md text-muted-foreground mb-6">
        {t("prizmaBasicAnalysisSent")}
      </p>
      {!hasProAccess && (
        <Button onClick={onGetFullAnalysis} size="lg" className="w-full bg-brand-gradient-pink-purple text-white font-semibold py-3 text-lg shadow-md hover:opacity-90 transition-opacity">
          {t("prizmaGetFullAnalysis")}
        </Button>
      )}
      {hasProAccess && (
        <p className="text-md text-green-600 font-semibold mb-6">{t("prizmaProAnalysisSent")}</p>
      )}
      <Button onClick={onGoToIntro} variant="link" className="text-brand-blue mt-4">
        Вернуться на главный экран
      </Button>
    </StepWrapper>
  );
};