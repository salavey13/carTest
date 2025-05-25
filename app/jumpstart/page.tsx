"use client";

import React, { useState, useEffect, useMemo } from "react"; 
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAppContext } from "@/contexts/AppContext";
import VibeContentRenderer from "@/components/VibeContentRenderer";
import { debugLogger } from "@/lib/debugLogger";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import SupportForm from "@/components/SupportForm";
import { jumpstartTranslations } from "@/components/translations_jumpstart"; 

const PLACEHOLDER_URL = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAwIiBoZWlnaHQ9IjQ1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iODAwIiBoZWlnaHQ9IjQ1MCIgZmlsbD0iIzQwNDA0MCIvPjwvc3ZnPg==";

export default function JumpstartPage() {
  const { user } = useAppContext();
  const [isMounted, setIsMounted] = useState(false);
  
  const initialLang = useMemo(() => {
      const browserLang = typeof navigator !== 'undefined' ? navigator.language.split('-')[0] : 'en';
      return user?.language_code === 'ru' || (!user?.language_code && browserLang === 'ru') ? 'ru' : 'en';
  }, [user?.language_code]);
  const [language, setLanguage] = useState<"en" | "ru">(initialLang);
  
  const userName = user?.first_name || 'Viberider';

  useEffect(() => {
    setIsMounted(true);
    if (user?.language_code) {
        const newLang = user.language_code === 'ru' ? 'ru' : 'en';
        if (newLang !== language) {
            setLanguage(newLang);
        }
    }
    debugLogger.log("[JumpstartPage] Mounted. Initial Lang:", language);
  }, [user?.language_code, language]);

  const t = jumpstartTranslations[language] || jumpstartTranslations['en'];

  if (!isMounted) {
    return (
      <div className="flex justify-center items-center min-h-screen pt-20 bg-gradient-to-br from-gray-900 via-black to-gray-800">
        <p className="text-brand-green animate-pulse text-xl font-mono">{t.loading}</p>
      </div>
    );
  }

  return ( 
    <div className="relative min-h-screen overflow-hidden pt-20 pb-10 bg-gradient-to-br from-gray-950 via-black to-purple-900/20 text-gray-200">
       <div
         className="absolute inset-0 bg-repeat opacity-[0.03] z-0"
         style={{
           backgroundImage: `linear-gradient(to right, rgba(174, 255, 0, 0.5) 1px, transparent 1px),
                             linear-gradient(to bottom, rgba(174, 255, 0, 0.5) 1px, transparent 1px)`,
           backgroundSize: '40px 40px',
         }}
       ></div>

 
        <div className="relative z-10 container mx-auto px-4">
         <div className="mb-8 flex justify-center md:justify-end">
            <div className="flex space-x-1 bg-dark-card p-1 rounded-full border border-gray-700 shadow-inner">
              <Button variant="ghost" onClick={() => setLanguage('en')} className={cn("px-4 py-1.5 rounded-full text-xs", language === 'en' ? 'bg-neon-lime/20 text-neon-lime' : 'text-gray-400 hover:text-white hover:bg-gray-700/50')} size="sm">EN</Button>
              <Button variant="ghost" onClick={() => setLanguage('ru')} className={cn("px-4 py-1.5 rounded-full text-xs", language === 'ru' ? 'bg-neon-lime/20 text-neon-lime' : 'text-gray-400 hover:text-white hover:bg-gray-700/50')} size="sm">RU</Button>
            </div>
          </div>

          <Card className="max-w-5xl mx-auto bg-black/90 backdrop-blur-xl text-white rounded-3xl border-2 border-neon-lime/50 shadow-[0_0_40px_rgba(174,255,0,0.4)]">
            <CardHeader className="text-center border-b border-neon-lime/30 pb-6 pt-8">
              <VibeContentRenderer content="::FaGift::" className="text-7xl text-neon-lime mx-auto mb-5 animate-pulse" />
              <CardTitle className="text-4xl md:text-6xl font-bold text-neon-lime cyber-text glitch uppercase tracking-widest" data-text={t.pageTitle}>
                {t.pageTitle}
              </CardTitle>
              <p className="text-lg md:text-xl text-gray-300 mt-5 font-mono max-w-3xl mx-auto" dangerouslySetInnerHTML={{ __html: t.pageSubtitle }} />
            </CardHeader>

            <CardContent className="space-y-16 p-5 md:p-10">

              <section className="space-y-5">
                <h2 className="flex items-center text-3xl md:text-4xl font-semibold text-brand-pink mb-4">
                  <VibeContentRenderer content="::FaRoad::" className="mr-4 text-brand-pink/80 flex-shrink-0" /> {t.section1.title}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                  <div>
                     <p className="text-gray-300 text-lg md:text-xl leading-relaxed">
                       {t.section1.p1} <Link href="/selfdev" className="text-brand-blue hover:underline font-semibold">{t.section1.link1}</Link> {t.section1.p1_cont} <Link href="/purpose-profit" className="text-brand-purple hover:underline font-semibold">PP</Link>. {language === 'ru' ? 'И геймифицируй путь с помощью' : 'And gamify the path using the'} <Link href="/selfdev/gamified" className="text-brand-yellow hover:underline font-semibold">Gamified SelfDev <VibeContentRenderer content="::FaGamepad::" className="inline ml-1"/></Link> {language === 'ru' ? 'метода!' : 'method!'}
                     </p>
                     <p className="mt-4 text-gray-400 text-base leading-relaxed">
                       {t.section1.p2} (<Link href="/about" className="text-brand-blue hover:underline font-semibold">Pavel</Link>){t.section1.p2_cont} <strong className="text-white">{t.section1.p2_highlight}</strong>{t.section1.p2_end}
                     </p>
                     <p className="mt-4 text-brand-pink font-bold text-xl">{t.section1.p3_highlight} <strong className="text-white">{t.section1.p3_cont}</strong>{t.section1.p3_end}</p>
                  </div>
                  <div className="p-2 border border-brand-pink/40 rounded-lg bg-black/40 shadow-lg">
                     <Image src={PLACEHOLDER_URL} alt={t.section1.img_alt} width={600} height={338} className="rounded-md opacity-80" loading="lazy" />
                     <p className="text-xs text-center text-gray-500 mt-1 italic">{t.section1.img_caption}</p>
                  </div>
                </div>
              </section>

              <section className="space-y-5 bg-gradient-to-br from-neon-lime/10 via-black/50 to-brand-purple/10 border-2 border-neon-lime/30 p-6 md:p-8 rounded-2xl shadow-glow-lg">
                <h2 className="flex items-center text-3xl md:text-4xl font-semibold text-neon-lime mb-5 justify-center">
                  <VibeContentRenderer content="::FaBolt::" className="mr-4 text-neon-lime/90 flex-shrink-0" /> {t.section2.title}
                </h2>
                 <p className="text-center text-gray-200 text-lg md:text-xl leading-relaxed mb-6 max-w-3xl mx-auto" dangerouslySetInnerHTML={{ __html: t.section2.intro }} />
                 <ul className="list-disc list-inside space-y-2 text-gray-300 pl-4 text-base md:text-lg leading-relaxed max-w-2xl mx-auto mb-6 text-center">
                    <li><VibeContentRenderer content="::FaMoneyBillWave::" className="inline mr-2 text-brand-green"/> {t.section2.feature1}</li>
                    <li><VibeContentRenderer content="::FaEnvelopeOpenText::" className="inline mr-2 text-brand-blue"/> {t.section2.feature2}</li>
                    <li><VibeContentRenderer content="::FaRobot::" className="inline mr-2 text-brand-purple"/> {t.section2.feature3}</li>
                    <li><VibeContentRenderer content="::FaFileCode::" className="inline mr-2 text-brand-orange"/> {t.section2.feature4}</li>
                 </ul>
                 <p className="text-center text-gray-200 text-lg md:text-xl leading-relaxed mb-6 max-w-3xl mx-auto" dangerouslySetInnerHTML={{ __html: t.section2.outro }}/>
                 <div className="p-2 border border-neon-lime/30 rounded-lg bg-black/30 my-6 max-w-3xl mx-auto">
                   <Image src={PLACEHOLDER_URL} alt={t.section2.img_alt} width={800} height={450} className="rounded-md opacity-70" loading="lazy" />
                   <p className="text-xs text-center text-gray-400 mt-1 italic">{t.section2.img_caption}</p>
                 </div>
              </section>

              <section className="space-y-6">
                <h2 className="flex items-center justify-center text-3xl md:text-4xl font-semibold text-brand-blue mb-6">
                  <VibeContentRenderer content="::FaGamepad::" className="mr-3 text-brand-blue/80" /> {t.section3.title}
                </h2>
                <div className="p-2 border border-brand-blue/30 rounded-lg bg-black/30 my-6 max-w-4xl mx-auto">
                  <Image src={PLACEHOLDER_URL} alt={t.section3.img_alt} width={800} height={450} className="rounded-md opacity-70" loading="lazy" />
                  <p className="text-xs text-center text-gray-400 mt-1 italic">{t.section3.img_caption}</p>
                </div>

                <div className="space-y-6">
                  <Card className="bg-gray-900/60 border border-gray-600 hover:border-gray-400 transition-colors">
                    <CardHeader><CardTitle className="text-xl text-gray-300">{t.section3.level1.title} <VibeContentRenderer content="::FaPlay::" className="inline ml-2 text-green-500"/></CardTitle></CardHeader>
                    <CardContent><p className="text-sm text-gray-300">{t.section3.level1.desc} <strong className="text-white">{t.section3.level1.quest}</strong> {t.section3.level1.tactic}</p></CardContent>
                  </Card>
                   <Card className="bg-purple-900/30 border border-brand-purple/40 hover:border-purple-300 transition-colors">
                    <CardHeader><CardTitle className="text-xl text-brand-purple">{t.section3.level2.title} <VibeContentRenderer content="::FaBullseye::" className="inline ml-2 text-purple-400"/></CardTitle></CardHeader>
                    <CardContent><p className="text-sm text-gray-300">{t.section3.level2.desc} <strong className="text-brand-purple">{t.section3.level2.quest}</strong> {t.section3.level2.reward} {t.section3.level2.tactic}</p></CardContent>
                  </Card>
                   <Card className="bg-green-900/30 border border-brand-green/40 hover:border-green-300 transition-colors">
                    <CardHeader><CardTitle className="text-xl text-brand-green">{t.section3.level3.title} <VibeContentRenderer content="::FaArrowsSpin::" className="inline ml-2 text-green-400"/></CardTitle></CardHeader>
                    <CardContent><p className="text-sm text-gray-300">{t.section3.level3.desc} <strong className="text-brand-green">{t.section3.level3.quest}</strong> {t.section3.level3.reward} {t.section3.level3.tactic}</p></CardContent>
                  </Card>
                  <Card className="bg-orange-900/30 border border-brand-orange/40 hover:border-orange-300 transition-colors">
                     <CardHeader><CardTitle className="text-xl text-brand-orange">{t.section3.level4.title} <VibeContentRenderer content="::FaUsers::" className="inline ml-2 text-orange-400"/></CardTitle></CardHeader>
                     <CardContent><p className="text-sm text-gray-300">{t.section3.level4.desc} <strong className="text-brand-orange">{t.section3.level4.quest}</strong> {t.section3.level4.tactic}</p></CardContent>
                  </Card>
                   <Card className="bg-neon-lime/10 border-2 border-neon-lime/50 shadow-glow-md hover:border-neon-lime transition-colors">
                     <CardHeader><CardTitle className="text-xl text-neon-lime">{t.section3.level5.title} <VibeContentRenderer content="::FaInfinity::" className="inline ml-2 text-lime-300"/></CardTitle></CardHeader>
                     <CardContent><p className="text-sm text-gray-200">{t.section3.level5.desc} <strong className="text-neon-lime">{t.section3.level5.quest}</strong> {t.section3.level5.reward} {t.section3.level5.tactic}</p></CardContent>
                  </Card>
                </div>
                 <p className="text-center text-gray-400 mt-4 text-sm">{language === 'ru' ? "Нужна структура игры? Зацени" : "Need a game structure? Check out"} <Link href="/selfdev/gamified" className="text-brand-yellow hover:underline">Gamified SelfDev</Link>.</p>
              </section>

              <section className="space-y-5 pt-8 border-t border-gray-700">
                <h2 className="flex items-center justify-center text-3xl md:text-4xl font-semibold text-brand-cyan mb-4">
                  <VibeContentRenderer content="::FaCubes::" className="mr-3 text-brand-cyan/80" /> {t.section4.title}
                </h2>
                <p className="text-center text-gray-400 text-base md:text-lg leading-relaxed max-w-3xl mx-auto">
                  {t.section4.p1} <Link href="/about" className="text-brand-blue hover:underline">{t.section4.link1}</Link>, {t.section4.p1_cont} <Link href="/repo-xml" className="text-brand-blue hover:underline">{t.section4.link2}</Link> {t.section4.p1_cont2} <strong className="text-gray-200">oneSitePls</strong> {t.section4.p1_end}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center mt-6">
                    <div className="p-5 bg-gray-800/60 rounded-xl border border-gray-700">
                        <VibeContentRenderer content="::FaRobot::" className="text-5xl text-brand-purple mx-auto mb-3"/>
                        <h4 className="font-semibold text-xl text-brand-purple mb-1">{t.section4.engine1_title}</h4>
                        <p className="text-sm text-gray-400">{t.section4.engine1_desc}</p>
                    </div>
                     <div className="p-5 bg-gray-800/60 rounded-xl border border-gray-700">
                        <VibeContentRenderer content="::FaGamepad::" className="text-5xl text-brand-blue mx-auto mb-3"/>
                        <h4 className="font-semibold text-xl text-brand-blue mb-1">{t.section4.engine2_title}</h4>
                        <p className="text-sm text-gray-400">{t.section4.engine2_desc}</p>
                    </div>
                     <div className="p-5 bg-gray-800/60 rounded-xl border border-gray-700">
                        <VibeContentRenderer content="::FaShieldHalved::" className="text-5xl text-brand-green mx-auto mb-3"/>
                        <h4 className="font-semibold text-xl text-brand-green mb-1">{t.section4.engine3_title}</h4>
                        <p className="text-sm text-gray-400">{t.section4.engine3_desc}</p>
                    </div>
                 </div>
              </section>

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
                  <VibeContentRenderer content="::FaRocket::" className="mr-3"/> {t.cta.button}
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