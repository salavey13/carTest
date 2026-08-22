"use client";

import React from 'react';
import { Button } from "@/components/ui/button";
import { VibeContentRenderer } from '@/components/VibeContentRenderer';
import { StepWrapper } from '../StepWrapper';

interface PaymentOfferDetailsStepProps {
  translations: (key: string, replacements?: Record<string, string | number>) => string;
  onPurchaseFullAnalysis: () => void;
  onBack: () => void;
  isPurchasing: boolean;
  proAccessPrice: number;
  currentLang: 'en' | 'ru';
}

export const PaymentOfferDetailsStep: React.FC<PaymentOfferDetailsStepProps> = ({
  translations: t,
  onPurchaseFullAnalysis,
  onBack,
  isPurchasing,
  proAccessPrice,
  currentLang
}) => {
  return (
    <StepWrapper onBack={onBack} showBackButton className="text-center">
      <div className="bg-card border border-border rounded-xl p-6 shadow-xl my-6 relative overflow-hidden">
        <div className="absolute -top-px -right-px bg-brand-pink text-white text-xs font-bold px-3 py-1 rounded-bl-lg rounded-tr-lg shadow-md transform-gpu">
          {currentLang === 'ru' ? 'ХИТ' : 'POPULAR'}
        </div>
        <h2 className="text-2xl font-orbitron font-bold text-foreground mb-2">{t("prizmaPaymentOfferTitle")}</h2>
        <div className="my-4">
          <span className="text-4xl font-orbitron font-black text-brand-purple">
            {t("prizmaPaymentOfferPrice", { PRICE: proAccessPrice })}
          </span>
          <span className="text-lg text-muted-foreground line-through ml-2">{t("prizmaPaymentOfferPriceOld")}</span>
        </div>
        <VibeContentRenderer content={t("prizmaPaymentOfferFeatures")} className="text-sm text-muted-foreground space-y-1 text-left prose prose-sm max-w-none prose-p:my-0.5 prose-ul:my-1 prose-li:my-0"/>
        <Button onClick={onPurchaseFullAnalysis} disabled={isPurchasing} size="lg" className="w-full mt-6 bg-brand-gradient-purple-blue text-white font-semibold py-3 text-lg shadow-md hover:opacity-90 transition-opacity">
          {isPurchasing ? <VibeContentRenderer content="::FaSpinner className='animate-spin mr-2'::"/> : t("prizmaChoosePayment")}
        </Button>
        <p className="text-xs text-muted-foreground mt-3">{t("prizmaPaymentGuarantee")}</p>
      </div>
    </StepWrapper>
  );
};