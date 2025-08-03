"use client";

import React, { Suspense, useState, useEffect, useMemo } from "react";
import { useSearchParams } from 'next/navigation';
import { RepoXmlPageProvider, useRepoXmlPageContext } from '@/contexts/RepoXmlPageContext';
import { useAppContext } from "@/contexts/AppContext";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { motion } from 'framer-motion';
import VibeContentRenderer from '@/components/VibeContentRenderer';
import RepoTxtFetcher from "@/components/RepoTxtFetcher";
import AICodeAssistant from "@/components/AICodeAssistant";
import AutomationBuddy from "@/components/AutomationBuddy";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { translations, onboardingContent, styleGuideContent, CYBERWTF_BADGE_URL } from './content';

const OnboardingBlock: React.FC<{ lang: "en" | "ru" }> = ({ lang }) => {
  const t = onboardingContent[lang];
  return (
    <div className="p-2 sm:p-4">
        <div className="flex flex-col items-center py-4">
            <img 
              src={CYBERWTF_BADGE_URL} 
              alt="CYBERWTF VIBE TRIBE badge" 
              className="w-full max-w-[320px] sm:max-w-[380px] drop-shadow-[0_0_15px_rgba(255,102,178,0.5)]" />
        </div>
        <div className="space-y-4 text-sm text-card-foreground prose prose-sm max-w-none prose-strong:text-accent-text">
            <VibeContentRenderer content={t.intro.replace(/\n/g, "<br/>")} />
            <div className="not-prose bg-gradient-to-r from-green-900/10 to-purple-900/10 border-l-4 border-pink-500 rounded p-3 shadow-inner">
                <div className="mb-2 font-bold">🚦 <span className="text-pink-400">TL;DR / Быстрый старт:</span></div>
                <ul className="list-disc ml-5 space-y-1 text-xs sm:text-sm">
                    {t.tldr.map((l, i) => <li key={i}><VibeContentRenderer content={l} /></li>)}
                </ul>
            </div>
             <details className="not-prose mt-3 bg-muted/70 rounded p-3 border-l-4 border-fuchsia-600">
              <summary className="font-bold cursor-pointer text-base">{lang === "en" ? "FAQ (Still lost? Read this!)" : "FAQ (Всё ещё WTF? Читай это!)"}</summary>
              <ul className="mt-2 space-y-2 text-xs">
                {t.faq.map((f, i) => (<li key={i}><b>{f.q}</b><br /><span>{f.a}</span></li>))}
              </ul>
            </details>
        </div>
    </div>
  );
};

const PhilosophyBlock: React.FC<{ t: (typeof translations.ru) }> = ({ t }) => (
    <div className="px-2 sm:px-4 py-2 space-y-4 text-sm prose prose-sm max-w-none prose-p:text-card-foreground prose-strong:text-accent-text">
        <VibeContentRenderer content={t.philosophyCore} />
        <hr className="border-border my-3"/>
        <h4 className="text-base font-semibold text-brand-cyan pt-1">Level Progression (Autonomy Slider):</h4>
        <div className="not-prose space-y-2">
            {[t.philosophyLvl0_1, t.philosophyLvl1_2, t.philosophyLvl2_3, t.philosophyLvl3_4, t.philosophyLvl4_5, t.philosophyLvl5_6, t.philosophyLvl6_7, t.philosophyLvl8_10].map((item, i) => 
                <VibeContentRenderer key={i} content={item} />
            )}
        </div>
        <hr className="border-border my-3"/>
        <div className="not-prose"><VibeContentRenderer content={t.philosophyEnd} /></div>
    </div>
);

const StyleGuideBlock: React.FC<{ content: typeof styleGuideContent.ru }> = ({ content }) => (
    <div className="px-2 sm:px-4 py-2 space-y-4 text-sm text-card-foreground">
        <p>{content.intro}</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {content.principles.map((p, i) => (
                 <Card key={i} className="bg-muted/50 border-border"> 
                    <CardHeader>
                        <CardTitle className="font-orbitron text-accent-text flex items-center gap-2 text-base">
                            <VibeContentRenderer content={p.icon} /> {p.title}
                        </CardTitle>
                        <CardDescription className="font-mono">{p.subtitle}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-xs">{p.description}</p>
                    </CardContent>
                </Card>
            ))}
        </div>
         <div className="mt-4 p-4 rounded-lg bg-muted/50 border border-border"> 
            <h4 className="font-bold mb-2 font-orbitron text-accent-text flex items-center gap-2"><VibeContentRenderer content="::FaScroll::" /> {content.caseStudy.title}</h4>
            <p className="text-xs prose prose-sm max-w-none prose-strong:text-accent-text">
                <VibeContentRenderer content={content.caseStudy.content} />
            </p>
        </div>
    </div>
);

function ActualPageContent({ initialPath, initialIdea }: { initialPath: string | null; initialIdea: string | null; }) {
    const { user } = useAppContext();
    const { fetcherRef, assistantRef, kworkInputRef, aiResponseInputRef } = useRepoXmlPageContext();
    const [lang, setLang] = useState<'ru' | 'en'>('ru');
    const t = useMemo(() => translations[lang], [lang]);

    useEffect(() => { setLang(user?.language_code === 'en' ? 'en' : 'ru'); }, [user]);

    if (!t) {
        return <div className="flex h-screen w-full items-center justify-center bg-background"><VibeContentRenderer content="::FaSpinner className='animate-spin text-4xl text-accent-text'::" /></div>;
    }

    return (
        <div className="min-h-screen bg-background p-2 sm:p-4 pt-20 md:pt-24 text-foreground flex flex-col items-center relative overflow-x-hidden">
            <main className="w-full max-w-7xl mx-auto grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-6">
                
                <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.1 }}>
                    <Accordion type="single" collapsible defaultValue="item-1" className="w-full bg-card/80 backdrop-blur-sm border border-border rounded-xl shadow-lg">
                        <AccordionItem value="item-1" className="border-b border-border">
                            <AccordionTrigger className="text-lg font-bold text-brand-pink hover:no-underline px-4 text-left">
                                <VibeContentRenderer content={onboardingContent[lang].title} />
                            </AccordionTrigger>
                            <AccordionContent><OnboardingBlock lang={lang} /></AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="item-2" className="border-b border-border">
                            <AccordionTrigger className="text-lg font-bold text-brand-green hover:no-underline px-4 text-left">
                                <VibeContentRenderer content={t.philosophyTitle} />
                            </AccordionTrigger>
                            <AccordionContent><PhilosophyBlock t={t} /></AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="item-3" className="border-none">
                            <AccordionTrigger className="text-lg font-bold text-brand-gold hover:no-underline px-4 text-left">
                                <VibeContentRenderer content={styleGuideContent.ru.title} />
                            </AccordionTrigger>
                            <AccordionContent><StyleGuideBlock content={styleGuideContent.ru} /></AccordionContent>
                        </AccordionItem>
                    </Accordion>
                </motion.div>

                <div className="flex flex-col gap-4 md:gap-6">
                    <motion.section id="extractor" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }}>
                        <RepoTxtFetcher 
                            ref={fetcherRef} 
                            highlightedPathProp={initialPath} 
                            ideaProp={initialIdea} 
                        />
                    </motion.section>
                    <motion.section id="executor" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.5 }}>
                        <AICodeAssistant 
                            ref={assistantRef}
                            kworkInputRefPassed={kworkInputRef}
                            aiResponseInputRefPassed={aiResponseInputRef}
                        />
                    </motion.section>
                </div>
            </main>
            <AutomationBuddy />
        </div>
    );
}

function RepoXmlPageInternalContent() {
  const searchParams = useSearchParams();
  const path = searchParams.get('path');
  const idea = searchParams.get('idea');
  return <ActualPageContent initialPath={path} initialIdea={idea} />;
}

export default function RepoXmlPage() {
    return (
        <Suspense fallback={<div className="flex h-screen items-center justify-center bg-background text-accent-text">Initializing Studio...</div>}>
            <RepoXmlPageProvider>
                <RepoXmlPageInternalContent />
            </RepoXmlPageProvider>
        </Suspense>
    );
}