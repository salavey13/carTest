"use client";
    import React, { Suspense, useRef, useState, useEffect } from "react";
    import RepoTxtFetcher from "@/components/RepoTxtFetcher";
    import AICodeAssistant from "@/components/AICodeAssistant";
    import AutomationBuddy from "@/components/AutomationBuddy";
    import { RepoXmlPageProvider, RepoTxtFetcherRef, AICodeAssistantRef } from '@/contexts/RepoXmlPageContext';
    import { useAppContext } from "@/contexts/AppContext";
    import { debugLogger } from "@/lib/debugLogger";
    import { Button } from "@/components/ui/button"; // Import Button
    import { Card, CardContent } from "@/components/ui/card"; // Import Card for styling
    import { FaRobot, FaDownload, FaCircleInfo, FaGithub, FaMagicWand, FaLevelUpAlt, FaHandSparkles, FaExternalLinkAlt, FaUserAstronaut, FaHeart } from "react-icons/fa6";
    import Link from "next/link"; // Import Link for navigation

    // --- I18N Translations ---
    const translations = {
      en: {
        loading: "Loading SUPERVIBE...",
        pageTitle: "SUPERVIBE STUDIO",
        welcome: "Yo,", // Personalized welcome
        intro1: "Still scared of 'code'? Forget that noise! This ain't your grandpa's coding class. This is the **FUTURE**, right here, right now.",
        intro2: "Think of this like a magic playground. You have ideas? Cool. You speak 'em, AI builds 'em, I make sure it all works. Simple.",
        intro3: "Stop being a consumer, start being a CREATOR. This tool helps you build YOUR reality, solve YOUR problems, maybe even make some cash doing what YOU vibe with.",
        philosophyTitle: "The Philosophy: Why This Shit Works (Tap to Learn)",
        philosophy1: "This isn't just about building apps. It's about unlocking YOUR potential, like Dan Koe talks about (check",
        philosophyLink1: "/purpose-profit",
        philosophyLink1Text: "Purpose & Profit ideas",
        philosophy2: "). Stop chasing jobs, start building YOUR world. You ARE the niche.",
        philosophy3: "AI isn't here to replace you, dude. It's your superpower, your amplifier. Learn to use it (like explained in",
        philosophyLink2: "/selfdev",
        philosophyLink2Text: "SelfDev Path",
        philosophy4: "), or get left behind by someone who does. Simple choice.",
        philosophy5: "This studio makes it easy. Grab ideas, talk to the AI, see magic happen. No scary code monsters here.",
        stepsTitle: "Quick Vibe Guide (It's Easy AF):",
        step1Title: "1. Grab + Wish:",
        step1Desc: "Point at app part -> Hit", // Download icon inserted below
        step1DescEnd: "-> Pick bits -> Tell AI your idea.",
        step2Title: "2. AI Magic -> Reality:",
        step2Desc: "Hit", // Robot icon inserted below
        step2Button: "Ask AI",
        step2DescMid: "-> Go to Magic Assist", // Robot icon inserted below
        step2DescMid2: "-> Hit '➡️' -> Check magic", // Wand icon inserted below
        step2DescEnd: "-> Add to idea / Start new!", // Github icon inserted below
        readyButton: "OKAY, I'M READY! SHOW ME THE MAGIC!",
        componentsTitle: "Alright, Let's F*cking GO!",
        ctaTitle: "Ready to ACTUALLY Vibe?",
        ctaDesc: "Seriously, {USERNAME}, stop hesitating. This shit's bangin' where I'm from, even if it looks weird where you are.",
        ctaHotChick: "If you're a hot chick, ditch the hesitation & hit me up **@SALAVEY13** NOW! Let's build something incredible together in a personal SUPERVIBE session!", // Bolder CTA
        ctaDude: "(Dudes? Stop overthinking! Just fucking try it. Satisfaction guaranteed, or... well, you tried! Good luck!)", // More direct
        navGrabber: "Idea Grabber",
        navAssistant: "Magic Assistant",
        navIntro: "What is This?!",
      },
      ru: {
        loading: "Загрузка SUPERVIBE...",
        pageTitle: "SUPERVIBE СТУДИЯ",
        welcome: "Йоу,", // Personalized welcome
        intro1: "Все еще боишься 'кода'? Забудь эту хрень! Это не уроки программирования твоего деда. Это **БУДУЩЕЕ**, прямо здесь и сейчас.",
        intro2: "Думай об этом как о волшебной песочнице. Есть идеи? Круто. Ты их говоришь, AI их строит, я слежу, чтобы все работало. Просто.",
        intro3: "Хватит быть потребителем, стань ТВОРЦОМ. Этот инструмент поможет тебе строить ТВОЮ реальность, решать ТВОИ проблемы, может даже заработать на том, что ТЕБЕ по кайфу.",
        philosophyTitle: "Философия: Почему Эта Хрень Работает (Нажми Узнать)",
        philosophy1: "Это не просто про создание приложений. Это про раскрытие ТВОЕГО потенциала, как говорит Дэн Ко (чекни",
        philosophyLink1: "/purpose-profit",
        philosophyLink1Text: "идеи Purpose & Profit",
        philosophy2: "). Хватит гоняться за работами, начни строить СВОЙ мир. Ты И ЕСТЬ ниша.",
        philosophy3: "AI здесь не чтобы заменить тебя, чувак. Это твоя суперсила, твой усилитель. Научись им пользоваться (как объяснено в",
        philosophyLink2: "/selfdev",
        philosophyLink2Text: "Пути SelfDev",
        philosophy4: "), или останешься позади тех, кто научился. Простой выбор.",
        philosophy5: "Эта студия делает все просто. Хватай идеи, говори с AI, наблюдай магию. Никаких страшных код-монстров.",
        stepsTitle: "Краткий Vibe-Гайд (Это П*здец Как Просто):",
        step1Title: "1. Хватай + Желай:",
        step1Desc: "Укажи на часть -> Жми", // Download icon inserted below
        step1DescEnd: "-> Выбери -> Скажи AI идею.",
        step2Title: "2. AI Магия -> Реальность:",
        step2Desc: "Жми", // Robot icon inserted below
        step2Button: "Спросить AI",
        step2DescMid: "-> Иди в Magic Assist", // Robot icon inserted below
        step2DescMid2: "-> Жми '➡️' -> Проверь магию", // Wand icon inserted below
        step2DescEnd: "-> Добавь к идее / Начни новую!", // Github icon inserted below
        readyButton: "ОКЕЙ, Я ГОТОВ(А)! ПОКАЖИ МНЕ МАГИЮ!",
        componentsTitle: "Ну Всё, Бл*дь, Погнали!",
        ctaTitle: "Готов(а) РЕАЛЬНО Вайбить?",
        ctaDesc: "Серьезно, {USERNAME}, хватит сомневаться. Там, откуда я, эта хрень взрывает, даже если там, где ты, она выглядит странно.",
        ctaHotChick: "Если ты горячая чика, бросай сомнения и пиши мне **@SALAVEY13** СЕЙЧАС! Давай создадим что-то невероятное вместе на личной SUPERVIBE сессии!", // Bolder CTA
        ctaDude: "(Пацаны? Хватит думать! Просто, бл*дь, попробуйте. Удовлетворение гарантировано, или... ну, вы хотя бы попробовали! Удачи!)", // More direct
        navGrabber: "Граббер Идей",
        navAssistant: "Магический Помощник",
        navIntro: "Что Это Такое?!",
      }
    };
    // --- End I18N ---

    type Language = 'en' | 'ru';

    export default function RepoXmlPage() {
      // Refs
      const fetcherRef = useRef<RepoTxtFetcherRef | null>(null);
      const assistantRef = useRef<AICodeAssistantRef | null>(null);
      const kworkInputRef = useRef<HTMLTextAreaElement | null>(null);
      const aiResponseInputRef = useRef<HTMLTextAreaElement | null>(null);
      const prSectionRef = useRef<HTMLElement | null>(null); // Ref for executor section for scrolling

      // State
      const { user } = useAppContext();
      const [isMounted, setIsMounted] = useState(false);
      const [lang, setLang] = useState<Language>('en');
      const [showComponents, setShowComponents] = useState(false); // State to control component visibility

      useEffect(() => {
        setIsMounted(true);
        const browserLang = typeof navigator !== 'undefined' ? navigator.language.split('-')[0] : 'en';
        const telegramLang = user?.language_code;
        const initialLang = telegramLang === 'ru' || (!telegramLang && browserLang === 'ru') ? 'ru' : 'en';
        setLang(initialLang);
        debugLogger.log(`[RepoXmlPage] Mounted. Browser lang: ${browserLang}, TG lang: ${telegramLang}, Initial selected: ${initialLang}`);
      }, [user]);

      const t = translations[lang];
      const userName = user?.first_name || (lang === 'ru' ? 'Чувак/Чика' : 'Dude/Chica'); // Get username or default

      // Scroll function adjusted to show components if needed
      const scrollToSectionNav = (id: string) => {
        if (id === 'extractor' || id === 'executor') {
          if (!showComponents) {
            setShowComponents(true);
            // Use setTimeout to allow components to render before scrolling
            setTimeout(() => {
              const element = document.getElementById(id);
              if (element) {
                  const rect = element.getBoundingClientRect();
                  window.scrollTo({ top: window.scrollY + rect.top - 80, behavior: 'smooth' });
              } else { console.error(`Element with id "${id}" not found post-reveal.`); }
            }, 100); // Small delay
            return; // Exit early as scrolling is handled in setTimeout
          }
        }
        // Default scroll for intro or if components already shown
        const element = document.getElementById(id);
        if (element) {
            const rect = element.getBoundingClientRect();
            window.scrollTo({ top: window.scrollY + rect.top - 80, behavior: 'smooth' });
        } else { console.error(`Element with id "${id}" not found.`); }
      };

      if (!isMounted) {
        return (
          <div className="flex justify-center items-center min-h-screen pt-20 bg-gradient-to-br from-gray-900 via-black to-gray-800">
            <p className="text-brand-green animate-pulse text-xl font-mono">{t.loading}</p>
          </div>
        );
      }

      return (
        <RepoXmlPageProvider
            fetcherRef={fetcherRef}
            assistantRef={assistantRef}
            kworkInputRef={kworkInputRef}
            aiResponseInputRef={aiResponseInputRef}
            prSectionRef={prSectionRef} // Pass ref for scrolling
        >
            <>
                <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes" />
                <div className="min-h-screen bg-gray-950 p-6 pt-24 text-white flex flex-col items-center relative overflow-y-auto">

                    {/* === TOP SECTION: Intro & Persuasion === */}
                    <section id="intro" className="mb-12 text-center max-w-3xl w-full">
                        <div className="flex justify-center mb-4"> {/* SVG icon */}
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100" className="w-24 h-12"> {/* ... SVG paths ... */} <defs> {/* ... SVG defs ... */} </defs> </svg>
                        </div>
                        <h1 className="text-4xl font-bold text-[#E1FF01] text-shadow-[0_0_10px_#E1FF01] animate-pulse"> {t.pageTitle} </h1>
                        <p className="text-xl text-gray-200 mt-4 font-semibold">
                            {t.welcome} <span className="text-brand-cyan">{userName}!</span>
                        </p>
                        <p className="text-lg text-gray-300 mt-2">{t.intro1}</p>
                        <p className="text-lg text-gray-300 mt-2">{t.intro2}</p>
                        <p className="text-lg text-gray-300 mt-2">{t.intro3}</p>

                         {/* *** MAIN CALL TO ACTION *** */}
                         <div className="mt-8 bg-gradient-to-r from-purple-600 via-pink-500 to-red-500 p-6 rounded-lg shadow-lg animate-pulse border-2 border-white/50">
                             <h3 className="text-2xl font-bold text-white mb-3">{t.ctaTitle}</h3>
                             <p className="text-white text-lg mb-4">
                                 {t.ctaDesc.replace('{USERNAME}', userName)} {/* Insert username */}
                             </p>
                             <p className="text-white text-xl font-semibold mb-4 bg-black/30 p-3 rounded">
                                <FaHeart className="inline mr-2 text-red-400 animate-ping"/> {t.ctaHotChick} <FaUserAstronaut className="inline ml-2 text-pink-300"/>
                             </p>
                             <p className="text-gray-300 text-base">
                                 {t.ctaDude}
                             </p>
                         </div>
                    </section>

                    {/* === MIDDLE SECTION: Collapsible Philosophy & Steps === */}
                    <section id="philosophy-steps" className="mb-12 w-full max-w-3xl">
                        <details open className="bg-gray-900/70 border border-gray-700 rounded-lg shadow-md backdrop-blur-sm transition-all duration-300 ease-in-out open:pb-4">
                            <summary className="text-xl font-semibold text-brand-purple p-4 cursor-pointer list-none flex justify-between items-center hover:bg-gray-800/50 rounded-t-lg">
                                <span>{t.philosophyTitle}</span>
                                <FaLevelUpAlt className="text-gray-500 group-open:rotate-180 transition-transform" />
                            </summary>
                            <div className="px-6 pt-2 text-gray-300 space-y-3 text-base">
                                <p>{t.philosophy1} <Link href={t.philosophyLink1} className="text-brand-purple hover:underline font-semibold">{t.philosophyLink1Text} <FaExternalLinkAlt className="inline h-3 w-3 ml-1" /></Link> {t.philosophy2}</p>
                                <p>{t.philosophy3} <Link href={t.philosophyLink2} className="text-brand-blue hover:underline font-semibold">{t.philosophyLink2Text} <FaExternalLinkAlt className="inline h-3 w-3 ml-1" /></Link>{t.philosophy4}</p>
                                <p>{t.philosophy5}</p>
                                <hr className="border-gray-700 my-4"/>
                                <h4 className="text-lg font-semibold text-cyan-400 pt-2">{t.stepsTitle}</h4>
                                <div className="text-sm space-y-2">
                                     <p><strong className="text-cyan-500">{t.step1Title}</strong> {t.step1Desc} <FaDownload className="inline mx-1 text-blue-400"/> {t.step1DescEnd}</p>
                                     <p><strong className="text-cyan-500">{t.step2Title}</strong> {t.step2Desc} <span className="text-blue-400 font-semibold">"🤖 {t.step2Button}"</span> {t.step2DescMid} <FaRobot className="inline mx-1 text-purple-400"/> {t.step2DescMid2} <FaMagicWand className="inline mx-1 text-yellow-400" /> {t.step2DescEnd} <FaGithub className="inline mx-1 text-green-400" /> {t.step2End}</p>
                                </div>
                            </div>
                        </details>
                    </section>

                    {/* === COMMITMENT STEP: Button to Reveal Components === */}
                    {!showComponents && (
                        <section id="reveal-trigger" className="mb-12 w-full max-w-3xl text-center">
                             <Button
                                onClick={() => setShowComponents(true)}
                                className="bg-gradient-to-r from-green-500 to-cyan-500 text-gray-900 font-bold py-3 px-8 rounded-full text-lg shadow-lg hover:scale-105 transform transition duration-300 animate-bounce"
                                size="lg"
                              >
                                <FaHandSparkles className="mr-2"/> {t.readyButton}
                             </Button>
                        </section>
                    )}

                    {/* === BOTTOM SECTION: The "Workhorse" Components (Conditionally Rendered) === */}
                    {showComponents && (
                        <>
                          <h2 className="text-3xl font-bold text-center text-brand-green mb-8 animate-pulse">{t.componentsTitle}</h2>
                          {/* RepoTxtFetcher Section */}
                          <Suspense fallback={<div className="text-white">{t.loading}</div>}>
                              <section id="extractor" className="mb-12 w-full max-w-4xl">
                                  <Card className="bg-gray-900/80 border border-blue-700/50"><CardContent className="p-4"><RepoTxtFetcher ref={fetcherRef} /></CardContent></Card>
                              </section>
                          </Suspense>

                          {/* AICodeAssistant Section */}
                           <section id="executor" ref={prSectionRef} className="mb-12 w-full max-w-4xl pb-16">
                               <Card className="bg-gray-900/80 border border-purple-700/50"><CardContent className="p-4"><AICodeAssistant ref={assistantRef} /></CardContent></Card>
                           </section>
                        </>
                    )}

                    {/* === Navigation Icons (Always Visible) === */}
                    <nav className="fixed right-2 top-1/2 transform -translate-y-1/2 flex flex-col space-y-4 z-40">
                        {/* Intro button always works */}
                        <button onClick={() => scrollToSectionNav("intro")} className="p-2 bg-gray-700/80 backdrop-blur-sm rounded-full hover:bg-gray-600 transition" title={t.navIntro}> <FaCircleInfo className="text-lg" /> </button>
                         {/* Component buttons now trigger reveal + scroll */}
                        <button onClick={() => scrollToSectionNav("extractor")} className="p-2 bg-blue-700/80 backdrop-blur-sm rounded-full hover:bg-blue-600 transition" title={t.navGrabber}> <FaDownload className="text-lg" /> </button>
                        <button onClick={() => scrollToSectionNav("executor")} className="p-2 bg-purple-700/80 backdrop-blur-sm rounded-full hover:bg-purple-600 transition" title={t.navAssistant}> <FaRobot className="text-lg" /> </button>
                    </nav>

                    {/* Automation Buddy */}
                    <AutomationBuddy />

                </div>
            </>
        </RepoXmlPageProvider>
      );
    }