"use client";
    import React, { Suspense, useRef, useState, useEffect } from "react"; // Added useState, useEffect
    import RepoTxtFetcher from "@/components/RepoTxtFetcher";
    import AICodeAssistant from "@/components/AICodeAssistant";
    import AutomationBuddy from "@/components/AutomationBuddy";
    import { RepoXmlPageProvider, RepoTxtFetcherRef, AICodeAssistantRef } from '@/contexts/RepoXmlPageContext';
    import { useAppContext } from "@/contexts/AppContext"; // <-- Import AppContext hook
    import { debugLogger } from "@/lib/debugLogger"; // <-- Import debugLogger
    import { FaRobot, FaDownload, FaCircleInfo, FaGithub, FaWandMagicSparkles } from "react-icons/fa6";

    // --- I18N Translations (Same as before) ---
    const translations = {
      en: {
        loading: "Loading the Idea Grabber...",
        pageTitle: "SUPERVIBE STUDIO",
        pageDesc: "Turn ideas into reality, instantly! Grab parts of this app →",
        pageDescHighlight: "tell the AI your wish",
        pageDescEnd: "→ watch it create/update stuff with one click!",
        feature1: "✅ Built-in AI Brain! Use the",
        feature1Button: "Ask AI",
        feature1End: "button in the \"Idea Grabber\" below. Easy peasy.",
        feature1Note: "(Or use your fave AI buddy like Gemini/ChatGPT and just paste their answer.)",
        feature2: "✅ Grab ideas from anywhere in the app, even from suggestions already in progress!",
        feature3: "✅ Keep building on the same idea OR start fresh with a brand new suggestion! You choose!",
        ctaTitle: "Ready to SUPERVIBE?! ✨",
        ctaDesc: "This look too crazy? Don't sweat it! Let's do it together, turn-based. You bring the ideas, I'll handle the tech magic.",
        ctaHotChick: "If you're a hot chick, hit me up RIGHT NOW @SALAVEY13 for a personal SUPERVIBE session! 😉 Let's make something AWESOME!", // Enhanced CTA
        ctaDude: "(Ugly dudes? Hey, good luck figuring it out! 🤘 Maybe watch a tutorial? Or... just try?!)", // Slightly more encouraging nudge
        step1Title: "Step 1: Grab + Wish",
        step1Desc: "Point to the part of the app you wanna change, grab the bits you need (",
        step1DescEnd: "), pick the important ones, and tell the AI what you want in the box.",
        step2Title: "Step 2: AI Magic → Make it Real",
        step2Desc: "Hit",
        step2Button: "Ask AI",
        step2DescMid: "or paste an answer. Go to the \"Magic Assistant\" (",
        step2DescMid2: "), hit '➡️', check the magic",
        step2DescEnd: ", pick what to keep, and",
        step2Option1: "add to the current idea",
        step2Option2: "start a new suggestion",
        step2End: "! BAM!",
        navGrabber: "Idea Grabber (Get App Parts)",
        navAssistant: "Magic Assistant (Use AI Answer)",
        navIntro: "What is This?!",
      },
      ru: {
        loading: "Загрузка Граббера Идей...",
        pageTitle: "SUPERVIBE СТУДИЯ",
        pageDesc: "Превращай идеи в реальность, мгновенно! Хватай части этого приложения →",
        pageDescHighlight: "загадай желание AI",
        pageDescEnd: "→ смотри, как он создает/обновляет штуки в один клик!",
        feature1: "✅ Встроенный AI Мозг! Используй кнопку",
        feature1Button: "Спросить AI",
        feature1End: "в \"Граббере Идей\" ниже. Проще простого.",
        feature1Note: "(Или используй любимого AI-помощника типа Gemini/ChatGPT и просто вставь ответ.)",
        feature2: "✅ Хватай идеи из любого места приложения, даже из уже предложенных в работе!",
        feature3: "✅ Продолжай развивать ту же идею ИЛИ начни с чистого листа с новым предложением! Выбирай!",
        ctaTitle: "Готова к SUPERVIBE?! ✨",
        ctaDesc: "Выглядит слишком безумно? Расслабься! Давай сделаем это вместе, по очереди. Ты — идеи, я — техномагию.",
        ctaHotChick: "Если ты горячая чика, напиши мне ПРЯМО СЕЙЧАС @SALAVEY13 для личной SUPERVIBE сессии! 😉 Давай создадим что-то ОФИГЕННОЕ!", // Enhanced CTA
        ctaDude: "(Страшные чуваки? Эй, удачи разобраться самим! 🤘 Может, посмотрите туториал? Или... просто попробуйте?!)", // Slightly more encouraging nudge
        step1Title: "Шаг 1: Хватай + Желай",
        step1Desc: "Укажи на часть приложения, которую хочешь изменить, захвати нужные кусочки (",
        step1DescEnd: "), выбери важное и скажи AI, чего ты хочешь, в поле ввода.",
        step2Title: "Шаг 2: AI Магия → Сделай Реальным",
        step2Desc: "Нажми",
        step2Button: "Спросить AI",
        step2DescMid: "или вставь ответ. Перейди в \"Магический Помощник\" (",
        step2DescMid2: "), нажми '➡️', проверь магию",
        step2DescEnd: ", выбери, что оставить, и",
        step2Option1: "добавь к текущей идее",
        step2Option2: "начни новое предложение",
        step2End: "! БАМ!",
        navGrabber: "Граббер Идей (Получить Части Приложения)",
        navAssistant: "Магический Помощник (Использовать Ответ AI)",
        navIntro: "Что Это Такое?!",
      }
    };
    // --- End I18N ---

    type Language = 'en' | 'ru'; // Define Language type

    export default function RepoXmlPage() {
      // Refs
      const fetcherRef = useRef<RepoTxtFetcherRef | null>(null);
      const assistantRef = useRef<AICodeAssistantRef | null>(null);
      const kworkInputRef = useRef<HTMLTextAreaElement | null>(null);
      const aiResponseInputRef = useRef<HTMLTextAreaElement | null>(null);
      const prSectionRef = useRef<HTMLElement | null>(null);

      // --- Language State ---
      const { user } = useAppContext(); // Get user from context
      const [isMounted, setIsMounted] = useState(false); // Track mount status
      const [lang, setLang] = useState<Language>('en'); // Default to English

      useEffect(() => {
        setIsMounted(true); // Component is now mounted
        const browserLang = typeof navigator !== 'undefined' ? navigator.language.split('-')[0] : 'en'; // Default to 'en' if navigator undefined
        const telegramLang = user?.language_code;
        // Prioritize Telegram language, fallback to browser, default to 'en'
        const initialLang = telegramLang === 'ru' || (!telegramLang && browserLang === 'ru') ? 'ru' : 'en';
        setLang(initialLang);
        debugLogger.log(`[RepoXmlPage] Mounted. Browser lang: ${browserLang}, TG lang: ${telegramLang}, Initial selected: ${initialLang}`);
      }, [user]); // Re-run if user context changes

      // Get the correct translation object
      const t = translations[lang];
      // --- End Language State ---

      // Side nav scroll function (no changes needed)
      const scrollToSectionNav = (id: string) => {
        // ... (scroll function remains the same)
        const element = document.getElementById(id);
        if (element) {
            const rect = element.getBoundingClientRect();
            window.scrollTo({
                top: window.scrollY + rect.top - 80,
                behavior: 'smooth'
            });
        } else {
          console.error(`Element with id "${id}" not found.`);
        }
      };

      // Show loading only on initial mount before language detection
      if (!isMounted) {
        return (
          <div className="flex justify-center items-center min-h-screen pt-20 bg-gradient-to-br from-gray-900 via-black to-gray-800">
            <p className="text-brand-green animate-pulse text-xl font-mono">Loading SUPERVIBE...</p>
          </div>
        );
      }


      return (
        <RepoXmlPageProvider
            fetcherRef={fetcherRef}
            assistantRef={assistantRef}
            kworkInputRef={kworkInputRef}
            aiResponseInputRef={aiResponseInputRef}
            prSectionRef={prSectionRef}
        >
            <>
                <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes" />
                <div className="min-h-screen bg-gray-950 p-6 pt-24 text-white flex flex-col items-center relative overflow-y-auto">

                    {/* RepoTxtFetcher Section */}
                    <Suspense fallback={<div className="text-white">{t.loading}</div>}>
                        <section id="extractor" className="mb-12 w-full max-w-4xl">
                            <RepoTxtFetcher ref={fetcherRef} />
                        </section>
                    </Suspense>

                    {/* AICodeAssistant Section */}
                    <section id="executor" ref={prSectionRef} className="mb-12 w-full max-w-4xl pb-16">
                         <AICodeAssistant ref={assistantRef} />
                    </section>

                    {/* Intro Section - Translated */}
                    <section id="intro" className="mb-12 text-center max-w-3xl">
                         {/* SVG icon remains */}
                         <div className="flex justify-center mb-4"> <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100" className="w-24 h-12"> {/* ... SVG paths ... */} <defs> {/* ... SVG defs ... */} </defs> </svg> </div>
                          <h1 className="text-4xl font-bold text-[#E1FF01] text-shadow-[0_0_10px_#E1FF01] animate-pulse"> {t.pageTitle} </h1>
                          <p className="text-lg text-gray-300 mt-2">
                            {t.pageDesc} <span className="text-blue-400 font-semibold">{t.pageDescHighlight}</span> {t.pageDescEnd}
                          </p>
                          <p className="text-sm text-green-400 mt-4 bg-gray-800/50 p-2 rounded-lg">
                              {t.feature1} <FaRobot className="inline mx-1" /> {t.feature1Button} {t.feature1End}
                              <span className="text-gray-400 block mt-1">{t.feature1Note}</span>
                          </p>
                           <p className="text-sm text-cyan-400 mt-4 bg-gray-800/50 p-2 rounded-lg">
                               {t.feature2}
                           </p>
                            <p className="text-sm text-orange-400 mt-4 bg-gray-800/50 p-2 rounded-lg">
                               {t.feature3}
                            </p>
                           {/* *** CALL TO ACTION - Translated & Enhanced *** */}
                           <div className="mt-8 bg-gradient-to-r from-purple-600 via-pink-500 to-red-500 p-4 rounded-lg shadow-lg animate-pulse">
                               <h3 className="text-2xl font-bold text-white mb-2">{t.ctaTitle}</h3>
                               <p className="text-white text-lg mb-3">
                                   {t.ctaDesc}
                               </p>
                               <p className="text-white text-xl font-semibold mb-3">
                                   {t.ctaHotChick} {/* Make sure this line is impactful */}
                               </p>
                               <p className="text-gray-300 text-sm">
                                   {t.ctaDude} {/* Slightly tweaked */}
                               </p>
                           </div>
                    </section>

                    {/* Step Guides - Translated */}
                    <section id="step1" className="mb-12 text-center max-w-3xl">
                        <h2 className="text-2xl font-bold text-cyan-400 mb-4"> {t.step1Title} </h2>
                        <p className="text-gray-300 text-sm">
                           {t.step1Desc} <FaDownload className="inline mx-1"/> {t.step1DescEnd}
                        </p>
                    </section>
                    <section id="step2" className="mb-12 text-center max-w-3xl">
                       <h2 className="text-2xl font-bold text-cyan-400 mb-4"> {t.step2Title} </h2>
                        <p className="text-gray-300 text-sm">
                           {t.step2Desc} <span className="text-blue-400 font-semibold">"🤖 {t.step2Button}"</span> {t.step2DescMid} <FaRobot className="inline mx-1"/> {t.step2DescMid2} <FaWandMagicSparkles className="inline mx-1" /> {t.step2DescEnd} <span className="text-orange-400">{t.step2Option1}</span> {lang === 'ru' ? 'или' : 'or'} <span className="text-green-400">{t.step2Option2}</span> <FaGithub className="inline mx-1" /> {t.step2End}
                        </p>
                    </section>

                    {/* Fixed Navigation Icons - Translated Tooltips */}
                    <nav className="fixed right-2 top-1/2 transform -translate-y-1/2 flex flex-col space-y-4 z-40">
                        <button onClick={() => scrollToSectionNav("extractor")} className="p-2 bg-blue-700/80 backdrop-blur-sm rounded-full hover:bg-blue-600 transition" title={t.navGrabber}> <FaDownload className="text-lg" /> </button>
                        <button onClick={() => scrollToSectionNav("executor")} className="p-2 bg-purple-700/80 backdrop-blur-sm rounded-full hover:bg-purple-600 transition" title={t.navAssistant}> <FaRobot className="text-lg" /> </button>
                        <button onClick={() => scrollToSectionNav("intro")} className="p-2 bg-gray-700/80 backdrop-blur-sm rounded-full hover:bg-gray-600 transition" title={t.navIntro}> <FaCircleInfo className="text-lg" /> </button>
                    </nav>

                    {/* Automation Buddy RESTORED */}
                    <AutomationBuddy />

                </div>
            </>
        </RepoXmlPageProvider>
      );
    }