"use client";

import React from 'react';
import { VibeContentRenderer } from '@/components/VibeContentRenderer';
import { StepWrapper } from '../StepWrapper';

interface AnalyzingStepProps {
  translations: (key: string, replacements?: Record<string, string | number>) => string;
  statusMessage?: string;
}

export const AnalyzingStep: React.FC<AnalyzingStepProps> = ({ translations: t, statusMessage }) => {
  return (
    <StepWrapper className="text-center">
      <VibeContentRenderer content="::FaSpinner className='text-6xl text-brand-purple mx-auto mb-6 animate-spin'::" />
      <h1 className="text-3xl font-orbitron font-bold text-transparent bg-clip-text bg-gradient-to-r from-brand-pink via-brand-purple to-brand-blue mb-3">
        {t("prizmaAnalyzingTitle")}
      </h1>
      <p className="text-lg text-muted-foreground">{statusMessage || t("prizmaAnalyzing")}</p>
    </StepWrapper>
  );
};