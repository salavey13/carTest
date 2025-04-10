// /app/repo-xml/page.tsx
"use client";
    import React, { Suspense, useRef } from "react";
    import RepoTxtFetcher from "@/components/RepoTxtFetcher";
    import AICodeAssistant from "@/components/AICodeAssistant";
    import AutomationBuddy from "@/components/AutomationBuddy"; // Restore import
    import { RepoXmlPageProvider, RepoTxtFetcherRef, AICodeAssistantRef } from '@/contexts/RepoXmlPageContext';
    import { FaRobot, FaFileCode, FaCode, FaDownload, FaCircleInfo, FaGithub, FaWandMagicSparkles } from "react-icons/fa6";

    export default function RepoXmlPage() {
      // Refs for Component APIs (Passed to Provider)
      const fetcherRef = useRef<RepoTxtFetcherRef | null>(null);
      const assistantRef = useRef<AICodeAssistantRef | null>(null);

      // Refs for DOM Elements (Passed to Provider)
      const kworkInputRef = useRef<HTMLTextAreaElement | null>(null);
      const aiResponseInputRef = useRef<HTMLTextAreaElement | null>(null);
      const prSectionRef = useRef<HTMLElement | null>(null);

      // Side nav scroll
      const scrollToSectionNav = (id: string) => {
        const element = document.getElementById(id);
        if (element) {
            const rect = element.getBoundingClientRect();
            window.scrollTo({
                top: window.scrollY + rect.top - 80, // Adjust offset
                behavior: 'smooth'
            });
        } else {
          console.error(`Element with id "${id}" not found.`);
        }
      };

      return (
        // Provider wraps the page content
        <RepoXmlPageProvider
            fetcherRef={fetcherRef}
            assistantRef={assistantRef}
            kworkInputRef={kworkInputRef}
            aiResponseInputRef={aiResponseInputRef}
            prSectionRef={prSectionRef}
        >
            <>
                <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes" />
                <div className="min-h-screen bg-gray-950 p-6 pt-24 text-white flex flex-col items-center relative overflow-y-auto"> {/* Darker bg */}

                    {/* RepoTxtFetcher Section */}
                    <Suspense fallback={<div className="text-white">Загрузка Экстрактора...</div>}>
                        <section id="extractor" className="mb-12 w-full max-w-4xl">
                            <RepoTxtFetcher ref={fetcherRef} />
                        </section>
                    </Suspense>

                    {/* AICodeAssistant Section */}
                    <section id="executor" ref={prSectionRef} className="mb-12 w-full max-w-4xl pb-16">
                         <AICodeAssistant ref={assistantRef} />
                    </section>

                    {/* Intro Section */}
                    <section id="intro" className="mb-12 text-center max-w-3xl">
                         <div className="flex justify-center mb-4"> <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100" className="w-24 h-12"> <circle cx="50" cy="50" r="45" fill="none" stroke="url(#bgGlow)" strokeWidth="10" opacity="0.3" /> <circle cx="50" cy="50" r="20" fill="url(#robotFill)" stroke="url(#robotStroke)" strokeWidth="2" /> <circle cx="40" cy="45" r="3" fill="#E1FF01" /> <circle cx="60" cy="45" r="3" fill="#E1FF01" /> <rect x="37" y="53" width="26" height="3" fill="#E1FF01" /> <text x="100" y="60" fontSize="40" fill="url(#moneyFill)">💸</text> <defs> <radialGradient id="bgGlow"><stop offset="0%" stopColor="#E1FF01" stopOpacity="1" /><stop offset="100%" stopColor="#000" stopOpacity="0" /></radialGradient> <linearGradient id="robotFill" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#000" /><stop offset="100%" stopColor="#E1FF01" /></linearGradient> <linearGradient id="robotStroke" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#E1FF01" /><stop offset="100%" stopColor="#000" /></linearGradient> <linearGradient id="moneyFill" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#E1FF01" /><stop offset="100%" stopColor="#000" /></linearGradient> </defs> </svg> </div>
                          <h1 className="text-4xl font-bold text-[#E1FF01] text-shadow-[0_0_10px_#E1FF01] animate-pulse"> CYBER STUDIO </h1>
                          <p className="text-lg text-gray-300 mt-2"> Автоматизация GitHub рутины: извлеки код → <span className="text-blue-400 font-semibold">получи ответ Gemini</span> → создай PR в один клик! </p>
                          <p className="text-sm text-green-400 mt-4 bg-gray-800/50 p-2 rounded-lg">
                              ✅ Интегрирован Google Gemini API! Используй кнопку <FaRobot className="inline mx-1" /> Спросить AI в Экстракторе.
                              <span className="text-gray-400 block mt-1">(Внешние AI: <a href="https://aistudio.google.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline hover:text-blue-300 transition">Grok/Gemini</a>, <a href="https://chat.openai.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline hover:text-blue-300 transition">ChatGPT</a>, <a href="https://t.me/webanybot" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline hover:text-blue-300 transition">@WebAnyBot</a> все еще доступны для ручного копирования/вставки.)</span>
                          </p>
                           <p className="text-sm text-cyan-400 mt-4 bg-gray-800/50 p-2 rounded-lg">
                               ✅ Теперь можно извлекать файлы из веток открытых PR или указать ветку вручную!
                           </p>
                    </section>

                    {/* Step Guides (Updated instructions) */}
                    <section id="step1" className="mb-12 text-center max-w-3xl">
                        <h2 className="text-2xl font-bold text-cyan-400 mb-4"> Шаг 1: Запрос + Контекст </h2>
                        <p className="text-gray-300 text-sm"> Укажи репозиторий, выбери ветку (опционально), извлеки файлы (<FaDownload className="inline mx-1"/>), выбери нужные для контекста, опиши задачу AI в поле ввода. </p>
                    </section>
                    <section id="step2" className="mb-12 text-center max-w-3xl">
                       <h2 className="text-2xl font-bold text-cyan-400 mb-4"> Шаг 2: Ответ AI → PR </h2>
                        <p className="text-gray-300 text-sm"> Нажми <span className="text-blue-400 font-semibold">"🤖 Спросить AI"</span> или добавь/скопируй ответ вручную. В Ассистенте Кода (<FaRobot className="inline mx-1"/>) нажми '➡️', проверь/исправь <FaWandMagicSparkles className="inline mx-1" />, выбери файлы и создай PR <FaGithub className="inline mx-1" />! </p>
                    </section>

                    {/* Fixed Navigation Icons */}
                    <nav className="fixed right-2 top-1/2 transform -translate-y-1/2 flex flex-col space-y-4 z-40">
                        <button onClick={() => scrollToSectionNav("extractor")} className="p-2 bg-blue-700/80 backdrop-blur-sm rounded-full hover:bg-blue-600 transition" title="Экстрактор кода (GitHub)"> <FaDownload className="text-lg" /> </button>
                        <button onClick={() => scrollToSectionNav("executor")} className="p-2 bg-purple-700/80 backdrop-blur-sm rounded-full hover:bg-purple-600 transition" title="Ассистент Кода (AI Ответ)"> <FaRobot className="text-lg" /> </button>
                        <button onClick={() => scrollToSectionNav("intro")} className="p-2 bg-gray-700/80 backdrop-blur-sm rounded-full hover:bg-gray-600 transition" title="Введение"> <FaCircleInfo className="text-lg" /> </button>
                    </nav>

                    {/* Automation Buddy RESTORED */}
                    <AutomationBuddy />

                </div>
            </>
        </RepoXmlPageProvider> // End Provider
      );
    }