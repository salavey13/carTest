"use client";

import React from 'react';
import { Button } from "@/components/ui/button";
import { VibeContentRenderer } from '@/components/VibeContentRenderer';
import { StepWrapper } from '../StepWrapper';

interface GeneralErrorStepProps {
  translations: (key: string, replacements?: Record<string, string | number>) => string;
  statusMessage?: string;
  onTryAgain: () => void;
  onContactSupport: () => void;
  isLoading: boolean;
}

export const GeneralErrorStep: React.FC<GeneralErrorStepProps> = ({
  translations: t,
  statusMessage,
  onTryAgain,
  onContactSupport,
  isLoading
}) => {
  return (
    <StepWrapper title={t("prizmaErrorTitle")} className="text-center">
      <VibeContentRenderer content="::FaCircleXmark className='text-6xl text-red-500 mx-auto mb-4'::" />
      <p className="text-md text-muted-foreground mb-6">{statusMessage || t("prizmaErrorDesc")}</p>
      <div className="space-y-3">
        <Button onClick={onTryAgain} size="lg" className="w-full bg-brand-gradient-purple-blue text-white font-semibold py-3 text-lg">
          {t("prizmaTryAgain")}
        </Button>
        <Button onClick={onContactSupport} disabled={isLoading} variant="outline" className="w-full">
          {isLoading ? <VibeContentRenderer content="::FaSpinner className='animate-spin mr-2'::"/> : t("prizmaContactSupport")}
        </Button>
      </div>
    </StepWrapper>
  );
};