"use client";
// Ensure client-side rendering
// "use jumpstart"; // Your custom directive :) <-- Commented out as it's not a standard directive

import React, { useState, useEffect } from "react"; // Import React explicitly if needed by bundler/setup
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAppContext } from "@/contexts/AppContext";

import {
  FaRocket, FaGamepad, FaBoxOpen, FaBullseye, FaHandHoldingDollar, FaBrain, FaCubes, FaUsers, FaChartLine, FaRobot, FaMoneyBillWave, FaArrowUpRightFromSquare, FaLightbulb, FaRoad, FaFileCode, FaEye, FaArrowsSpin, FaNetworkWired, FaComments, FaWandMagicSparkles, FaListCheck, FaEnvelopeOpenText, FaPlay, FaInfinity, FaBolt, FaGift, FaGithub, FaCode, FaTelegram, FaShieldHalved // Added missing FaShieldHalved
} from "react-icons/fa6";
import { debugLogger } from "@/lib/debugLogger";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import SupportForm from "@/components/SupportForm";
import { jumpstartTranslations } from "@/components/translations_jumpstart"; // Import translations

// Placeholder URL
const PLACEHOLDER_URL = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAwIiBoZWlnaHQ9IjQ1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iODAwIiBoZWlnaHQ9IjQ1MCIgZmlsbD0iIzQwNDA0MCIvPjwvc3ZnPg==";

export default function JumpstartPage() {
  const { user } = useAppContext();
  const [isMounted, setIsMounted] = useState(false);
  const [language, setLanguage] = useState<"en" | "ru">('en'); // Default to EN
  const userName = user?.first_name || 'Viberider';

  useEffect(() => {
    setIsMounted(true);
    // Set language based on user preference or browser default
    const browserLang = typeof navigator !== 'undefined' ? navigator.language.split('-')[0] : 'en';
    const initialLang = user?.language_code === 'ru' || (!user?.language_code && browserLang === 'ru') ? 'ru' : 'en';
    setLanguage(initialLang);
    debugLogger.log("[JumpstartPage] Mounted. Initial Lang:", initialLang);
  }, [user?.language_code]);

  // Get translations based on selected language
  // Add a check in case translations are not loaded yet (though unlikely here)
  const t = jumpstartTranslations[language] || jumpstartTranslations['en'];

  if (!isMounted) {
    return (
      <div className="flex justify-center items-center min-h-screen pt-20 bg-gradient-to-br from-gray-900 via-black to-gray-800">
        <p className="text-brand-green animate-pulse text-xl font-mono">{t.loading}</p>
      </div>
    );
  }

  return ( // Ensure main JSX is wrapped
    <div className="relative min-h-screen overflow-hidden pt-20 pb-10 bg-gradient-to-br from-gray-950 via-black to-purple-900/20 text-gray-200">
      {/* Subtle Background Grid */}
       <div
         className="absolute inset-0 bg-repeat opacity-[0.03] z-0"
         style={{
           backgroundImage: `linear-gradient(to right, rgba(174, 255, 0, 0.5) 1px, transparent 1px),
                             linear-gradient(to bottom, rgba(174, 255, 0, 0.5) 1px, transparent 1px)`,
           backgroundSize: '40px 40px',
         }}
       ></div>

 
        <div className="relative z-10 container mx-auto px-4">
         {/* Language Switcher */}
         <div className="mb-8 flex justify-center md:justify-end">
            <div className="flex space-x-1 bg-dark-card p-1 rounded-full border border-gray-700 shadow-inner">
              <Button variant="ghost" onClick={() => setLanguage('en')} className={cn("px-4 py-1.5 rounded-full text-xs", language === 'en' ? 'bg-neon-lime/20 text-neon-lime' : 'text-gray-400 hover:text-white hover:bg-gray-700/50')} size="sm">EN</Button>
              <Button variant="ghost" onClick={() => setLanguage('ru')} className={cn("px-4 py-1.5 rounded-full text-xs", language === 'ru' ? 'bg-neon-lime/20 text-neon-lime' : 'text-gray-400 hover:text-white hover:bg-gray-700/50')} size="sm">RU</Button>
            </div>
          </div>

          <Card className="max-w-5xl mx-auto bg-black/90 backdrop-blur-xl text-white rounded-3xl border-2 border-neon-lime/50 shadow-[0_0_40px_rgba(174,255,0,0.4)]">
            <CardHeader className="text-center border-b border-neon-lime/30 pb-6 pt-8">
              <FaGift className="text-7xl text-neon-lime mx-auto mb-5 animate-pulse" />
              <CardTitle className="text-4xl md:text-6xl font-bold text-neon-lime cyber-text glitch uppercase tracking-widest" data-text={t.pageTitle}>
                {t.pageTitle}
              </CardTitle>
              <p className="text-lg md:text-xl text-gray-300 mt-5 font-mono max-w-3xl mx-auto" dangerouslySetInnerHTML={{ __html: t.pageSubtitle }} />
            </CardHeader>

            <CardContent className="space-y-16 p-5 md:p-10">

              {/* Section 1: Why Start from Zero? */}
              <section className="space-y-5">
                <h2 className="flex items-center text-3xl md:text-4xl font-semibold text-brand-pink mb-4">
                  <FaRoad className="mr-4 text-brand-pink/80 flex-shrink-0" /> {t.section1.title}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                  <div>
                     <p className="text-gray-300 text-lg md:text-xl leading-relaxed">
                       {t.section1.p1} <Link href="/selfdev" className="text-brand-blue hover:underline font-semibold">{t.section1.link1}</Link> {t.section1.p1_cont} <Link href="/purpose-profit" className="text-brand-purple hover:underline font-semibold">PP</Link>. {language === 'ru' ? 'И геймифицируй путь с помощью' : 'And gamify the path using the'} <Link href="/selfdev/gamified" className="text-brand-yellow hover:underline font-semibold">Gamified SelfDev <FaGamepad className="inline ml-1"/></Link> {language === 'ru' ? 'метода!' : 'method!'}
                     </p>
                     <p className="mt-4 text-gray-400 text-base leading-relaxed">
                       {t.section1.p2} (<Link href="/about" className="text-brand-blue hover:underline font-semibold">Pavel</Link>){t.section1.p2_cont} <strong className="text-white">{t.section1.p2_highlight}</strong>{t.section1.p2_end}
                     </p>
                     <p className="mt-4 text-brand-pink font-bold text-xl">{t.section1.p3_highlight} <strong className="text-white">{t.section1.p3_cont}</strong>{t.section1.p3_end}</p>
                  </div>
                  <div className="p-2 border border-brand-pink/40 rounded-lg bg-black/40 shadow-lg">
                     {/* // TODO: Add visual: [Prompt: Image comparing a complex, confusing blueprint (old way) vs a sleek, plug-and-play cybernetic module labeled 'Supervibe Jumpstart Kit'] */}
                     <Image src={PLACEHOLDER_URL} alt={t.section1.img_alt} width={600} height={338} className="rounded-md opacity-80" loading="lazy" />
                     <p className="text-xs text-center text-gray-500 mt-1 italic">{t.section1.img_caption}</p>
                  </div>
                </div>
              </section>

              {/* Section 2: Get Your Engine (The Golden Brick) */}
              <section className="space-y-5 bg-gradient-to-br from-neon-lime/10 via-black/50 to-brand-purple/10 border-2 border-neon-lime/30 p-6 md:p-8 rounded-2xl shadow-glow-lg">
                <h2 className="flex items-center text-3xl md:text-4xl font-semibold text-neon-lime mb-5 justify-center">
                  <FaBolt className="mr-4 text-neon-lime/90 flex-shrink-0" /> {t.section2.title}
                </h2>
                 <p className="text-center text-gray-200 text-lg md:text-xl leading-relaxed mb-6 max-w-3xl mx-auto" dangerouslySetInnerHTML={{ __html: t.section2.intro }} />
                 <ul className="list-disc list-inside space-y-2 text-gray-300 pl-4 text-base md:text-lg leading-relaxed max-w-2xl mx-auto mb-6 text-center">
                    <li><FaMoneyBillWave className="inline mr-2 text-brand-green"/> {t.section2.feature1}</li>
                    <li><FaEnvelopeOpenText className="inline mr-2 text-brand-blue"/> {t.section2.feature2}</li>
                    <li><FaRobot className="inline mr-2 text-brand-purple"/> {t.section2.feature3}</li>
                    <li><FaFileCode className="inline mr-2 text-brand-orange"/> {t.section2.feature4}</li>
                 </ul>
                 <p className="text-center text-gray-200 text-lg md:text-xl leading-relaxed mb-6 max-w-3xl mx-auto" dangerouslySetInnerHTML={{ __html: t.section2.outro }}/>
                  {/* // TODO: Add visual: [Prompt: Animated GIF or short video showing: 1. GitHub Fork button click -> 2. Vercel deploy screen with one ENV VAR field -> 3. Live site preview with working donation button] */}
                 <div className="p-2 border border-neon-lime/30 rounded-lg bg-black/30 my-6 max-w-3xl mx-auto">
                   <Image src={PLACEHOLDER_URL} alt={t.section2.img_alt} width={800} height={450} className="rounded-md opacity-70" loading="lazy" />
                   <p className="text-xs text-center text-gray-400 mt-1 italic">{t.section2.img_caption}</p>
                 </div>
              </section>

              {/* Section 3: The Speedrun Game */}
              <section className="space-y-6">
                <h2 className="flex items-center justify-center text-3xl md:text-4xl font-semibold text-brand-blue mb-6">
                  <FaGamepad className="mr-3 text-brand-blue/80" /> {t.section3.title}
                </h2>
                 {/* // TODO: Add visual: [Prompt: Cyberpunk game HUD interface mockup showing 'Rilmonetometer (XTR)', 'Active Bots: 1/5', 'Next Quest: First Sale', 'VIBE Skill: Validation Unlocked'] */}
                <div className="p-2 border border-brand-blue/30 rounded-lg bg-black/30 my-6 max-w-4xl mx-auto">
                  <Image src={PLACEHOLDER_URL} alt={t.section3.img_alt} width={800} height={450} className="rounded-md opacity-70" loading="lazy" />
                  <p className="text-xs text-center text-gray-400 mt-1 italic">{t.section3.img_caption}</p>
                </div>

                <div className="space-y-6">
                  {/* Levels */}
                  <Card className="bg-gray-900/60 border border-gray-600 hover:border-gray-400 transition-colors">
                    <CardHeader><CardTitle className="text-xl text-gray-300">{t.section3.level1.title} <FaPlay className="inline ml-2 text-green-500"/></CardTitle></CardHeader>
                    <CardContent><p className="text-sm text-gray-300">{t.section3.level1.desc} <strong className="text-white">{t.section3.level1.quest}</strong> {t.section3.level1.tactic}</p></CardContent>
                  </Card>
                   <Card className="bg-purple-900/30 border border-brand-purple/40 hover:border-purple-300 transition-colors">
                    <CardHeader><CardTitle className="text-xl text-brand-purple">{t.section3.level2.title} <FaBullseye className="inline ml-2 text-purple-400"/></CardTitle></CardHeader>
                    <CardContent><p className="text-sm text-gray-300">{t.section3.level2.desc} <strong className="text-brand-purple">{t.section3.level2.quest}</strong> {t.section3.level2.reward} {t.section3.level2.tactic}</p></CardContent>
                  </Card>
                   <Card className="bg-green-900/30 border border-brand-green/40 hover:border-green-300 transition-colors">
                    <CardHeader><CardTitle className="text-xl text-brand-green">{t.section3.level3.title} <FaArrowsSpin className="inline ml-2 text-green-400"/></CardTitle></CardHeader>
                    <CardContent><p className="text-sm text-gray-300">{t.section3.level3.desc} <strong className="text-brand-green">{t.section3.level3.quest}</strong> {t.section3.level3.reward} {t.section3.level3.tactic}</p></CardContent>
                  </Card>
                  <Card className="bg-orange-900/30 border border-brand-orange/40 hover:border-orange-300 transition-colors">
                     <CardHeader><CardTitle className="text-xl text-brand-orange">{t.section3.level4.title} <FaUsers className="inline ml-2 text-orange-400"/></CardTitle></CardHeader>
                     <CardContent><p className="text-sm text-gray-300">{t.section3.level4.desc} <strong className="text-brand-orange">{t.section3.level4.quest}</strong> {t.section3.level4.tactic}</p></CardContent>
                  </Card>
                   <Card className="bg-neon-lime/10 border-2 border-neon-lime/50 shadow-glow-md hover:border-neon-lime transition-colors">
                     <CardHeader><CardTitle className="text-xl text-neon-lime">{t.section3.level5.title} <FaInfinity className="inline ml-2 text-lime-300"/></CardTitle></CardHeader>
                     <CardContent><p className="text-sm text-gray-200">{t.section3.level5.desc} <strong className="text-neon-lime">{t.section3.level5.quest}</strong> {t.section3.level5.reward} {t.section3.level5.tactic}</p></CardContent>
                  </Card>
                  {/* Level 6 implicit: You repeat the cycle or exit */}
                </div>
                 {/* // TODO: Link specific quests to unlocking features in the dashboard or enabling new bot capabilities. */}
                 {/* // TODO: Integrate Configame mention maybe in Level 1 or as a related tool. */}
                 <p className="text-center text-gray-400 mt-4 text-sm">{language === 'ru' ? "Нужна структура игры? Зацени" : "Need a game structure? Check out"} <Link href="/selfdev/gamified" className="text-brand-yellow hover:underline">Gamified SelfDev</Link>.</p>
              </section>

              {/* Section 4: The Engine */}
              <section className="space-y-5 pt-8 border-t border-gray-700">
                <h2 className="flex items-center justify-center text-3xl md:text-4xl font-semibold text-brand-cyan mb-4">
                  <FaCubes className="mr-3 text-brand-cyan/80" /> {t.section4.title}
                </h2>
                <p className="text-center text-gray-400 text-base md:text-lg leading-relaxed max-w-3xl mx-auto">
                  {t.section4.p1} <Link href="/about" className="text-brand-blue hover:underline">{t.section4.link1}</Link>, {t.section4.p1_cont} <Link href="/repo-xml" className="text-brand-blue hover:underline">{t.section4.link2}</Link> {t.section4.p1_cont2} <strong className="text-gray-200">oneSitePls</strong> {t.section4.p1_end}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center mt-6">
                     {/* // TODO: Add visual: [Prompt: Abstract neon graphic showing interconnected nodes: 'User Dashboard', 'Bot Crew AI', 'VIBE OS', 'oneSitePls Infra', 'XTR Ledger'] */}
                    <div className="p-5 bg-gray-800/60 rounded-xl border border-gray-700">
                        <FaRobot className="text-5xl text-brand-purple mx-auto mb-3"/>
                        <h4 className="font-semibold text-xl text-brand-purple mb-1">{t.section4.engine1_title}</h4>
                        <p className="text-sm text-gray-400">{t.section4.engine1_desc}</p>
                    </div>
                     <div className="p-5 bg-gray-800/60 rounded-xl border border-gray-700">
                        <FaGamepad className="text-5xl text-brand-blue mx-auto mb-3"/>
                        <h4 className="font-semibold text-xl text-brand-blue mb-1">{t.section4.engine2_title}</h4>
                        <p className="text-sm text-gray-400">{t.section4.engine2_desc}</p>
                    </div>
                     <div className="p-5 bg-gray-800/60 rounded-xl border border-gray-700">
                        <FaShieldHalved className="text-5xl text-brand-green mx-auto mb-3"/>
                        <h4 className="font-semibold text-xl text-brand-green mb-1">{t.section4.engine3_title}</h4>
                        <p className="text-sm text-gray-400">{t.section4.engine3_desc}</p>
                    </div>
                 </div>
              </section>

              {/* Section 5: Call to Action */}
              <section className="text-center border-t-2 border-neon-lime/40 pt-12 mt-12">
                <h2 className="text-4xl md:text-5xl font-bold text-neon-lime mb-6 uppercase tracking-wide">{t.cta.title.replace("{userName}", userName)}</h2>
                <p className="text-gray-300 text-lg md:text-xl leading-relaxed mb-5 max-w-3xl mx-auto">
                   {t.cta.p1} (<Link href="/about" className="text-brand-blue hover:underline">{t.cta.link1}</Link>).
                </p>
                <p className="font-semibold text-xl text-neon-lime mb-6">
                    {t.cta.cost}
                </p>
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-neon-lime via-brand-green to-cyan-400 text-black font-extrabold py-4 px-10 rounded-full text-xl shadow-glow-lg hover:scale-105 transform transition duration-300 animate-bounce"
                  onClick={() => {
                    const formElement = document.getElementById('jumpstart-form');
                    formElement?.scrollIntoView({ behavior: 'smooth' });
                   }}
                >
                  <FaRocket className="mr-3"/> {t.cta.button}
                </Button>

                 <div id="jumpstart-form" className="mt-16 max-w-lg mx-auto">
                    <h3 className="text-2xl font-semibold text-neon-lime mb-5">{t.cta.form_title}</h3>
                    <SupportForm />
                 </div>
              </section>

            </CardContent>
          </Card>
        </div>
      
    </div>
  );
}