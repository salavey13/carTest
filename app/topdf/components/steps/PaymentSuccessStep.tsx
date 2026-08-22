"use client";

import React from 'react';
import { Button } from "@/components/ui/button";
import { VibeContentRenderer } from '@/components/VibeContentRenderer';
import { StepWrapper } from '../StepWrapper';
import { PRO_ADDITIONAL_QUESTIONS_RU } from '../../psychoAnalysisPrompt'; // To get count for remaining questions

interface PaymentSuccessStepProps {
  translations: (key: string, replacements?: Record<string, string | number>) => string;
  onContinue: () => void;
  hasProAccess: boolean; // To determine which message to show
}

export const PaymentSuccessStep: React.FC<PaymentSuccessStepProps> = ({ translations: t, onContinue, hasProAccess }) => {
  return (
    <StepWrapper 
        title={hasProAccess ? t("prizmaProAnalysisReadyTitle") : t("prizmaPaymentSuccessTitle")} 
        className="text-center"
    >
      <VibeContentRenderer content="::FaCreditCard className='text-6xl text-green-500 mx-auto mb-4'::" />
      <p className="text-md text-muted-foreground mb-6">
        {hasProAccess 
            ? t("prizmaProAnalysisSent") 
            : t("prizmaPaymentSuccessDesc", {REMAINING: PRO_ADDITIONAL_QUESTIONS_RU.length})
        }
      </p>
      <Button onClick={onContinue} size="lg" className="w-full bg-brand-gradient-purple-blue text-white font-semibold py-3 text-lg shadow-md hover:opacity-90 transition-opacity">
        {t("prizmaContinue")}
      </Button>
    </StepWrapper>
  );
};