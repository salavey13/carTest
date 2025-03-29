"use client";
import React, { Suspense, useRef, useImperativeHandle } from "react";
import RepoTxtFetcher from "@/components/RepoTxtFetcher";
import AICodeAssistant from "@/components/AICodeAssistant";
import { RepoXmlPageProvider } from '@/contexts/RepoXmlPageContext'; // Import the provider
import { FaRobot, FaFileCode, FaCode } from "react-icons/fa";
import { motion } from "framer-motion";

// Forward Refs for child components to expose methods
const ForwardedRepoTxtFetcher = React.forwardRef((props, ref) => {
  // Assuming RepoTxtFetcher exposes methods via useImperativeHandle
  return <RepoTxtFetcher {...props} ref={ref} />;
});
ForwardedRepoTxtFetcher.displayName = 'ForwardedRepoTxtFetcher';

const ForwardedAICodeAssistant = React.forwardRef((props, ref) => {
  // Assuming AICodeAssistant exposes methods via useImperativeHandle
  return <AICodeAssistant {...props} ref={ref} />;
});
ForwardedAICodeAssistant.displayName = 'ForwardedAICodeAssistant';


export default function RepoXmlPage() {
  const fetcherRef = useRef<any>(null); // Ref for RepoTxtFetcher methods
  const assistantRef = useRef<any>(null); // Ref for AICodeAssistant methods
  const kworkInputRef = useRef<HTMLTextAreaElement>(null);
  const aiResponseInputRef = useRef<HTMLTextAreaElement>(null);
  const prSectionRef = useRef<HTMLElement>(null); // Ref for the PR section element

  // Original scrollToSection remains for the side nav
  const scrollToSectionNav = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" }); // Use start for nav
    } else {
      console.error(`Element with id "${id}" not found.`);
    }
  };

  return (
    // Wrap the main content area with the Provider
    <RepoXmlPageProvider
        fetcherRef={fetcherRef}
        assistantRef={assistantRef}
        kworkInputRef={kworkInputRef}
        aiResponseInputRef={aiResponseInputRef}
        prSectionRef={prSectionRef}
    >
        <>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes" />
            <div className="min-h-screen bg-gray-900 p-6 pt-24 text-white flex flex-col items-center relative overflow-y-auto">
                {/* Intro Section */}
                <section id="intro" className="mb-12 text-center max-w-2xl">
                    {/* ... (intro content remains the same) ... */}
                     <div className="flex justify-center mb-4">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100" className="w-24 h-12">
                          <circle cx="50" cy="50" r="45" fill="none" stroke="url(#bgGlow)" strokeWidth="10" opacity="0.3" />
                          <circle cx="50" cy="50" r="20" fill="url(#robotFill)" stroke="url(#robotStroke)" strokeWidth="2" />
                          <circle cx="40" cy="45" r="3" fill="#E1FF01" />
                          <circle cx="60" cy="45" r="3" fill="#E1FF01" />
                          <rect x="37" y="53" width="26" height="3" fill="#E1FF01" />
                          <text x="100" y="60" fontSize="40" fill="url(#moneyFill)">💸</text>
                          <defs>
                            <radialGradient id="bgGlow">
                              <stop offset="0%" stopColor="#E1FF01" stopOpacity="1" />
                              <stop offset="100%" stopColor="#000" stopOpacity="0" />
                            </radialGradient>
                            <linearGradient id="robotFill" x1="0%" y1="0%" x2="100%" y2="100%">
                              <stop offset="0%" stopColor="#000" />
                              <stop offset="100%" stopColor="#E1FF01" />
                            </linearGradient>
                            <linearGradient id="robotStroke" x1="0%" y1="0%" x2="100%" y2="100%">
                              <stop offset="0%" stopColor="#E1FF01" />
                              <stop offset="100%" stopColor="#000" />
                            </linearGradient>
                            <linearGradient id="moneyFill" x1="0%" y1="0%" x2="100%" y2="100%">
                              <stop offset="0%" stopColor="#E1FF01" />
                              <stop offset="100%" stopColor="#000" />
                            </linearGradient>
                          </defs>
                        </svg>
                      </div>
                      <h1 className="text-4xl font-bold text-[#E1FF01] text-shadow-[0_0_10px_#E1FF01] animate-pulse">
                        Грок здесь, чтобы исполнить ваши кодовые мечты!
                      </h1>
                      <p className="text-lg text-gray-300 mt-2">
                        Добро пожаловать в мир автоматизации! Это демо покажет, как легко извлечь код из GitHub и создать что-то крутое с помощью бота. Страницы лежат в папке `app`, а компоненты — в `components`. Всё просто, правда?
                      </p>
                      <p className="text-sm text-red-400 mt-4 bg-gray-800 p-2 rounded-lg">
                        ⚠️ Внимание: встроенный бот сейчас без денег, поэтому для анализа используйте{" "}
                        <a
                          href="https://t.me/oneSitePlsBot"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 underline hover:text-blue-300 transition"
                        >
                          t.me/oneSitePlsBot
                        </a>{" "}
                        в Telegram (
                        <a
                          href="https://t.me/webanybot"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 underline hover:text-blue-300 transition"
                        >
                          t.me/webanybot
                        </a>
                        ), а для разработки —{" "}
                        <a
                          href="https://grok.com"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 underline hover:text-blue-300 transition"
                        >
                          Grok
                        </a>
                        . Спасибо за понимание! ;)
                      </p>
                </section>

                {/* Step 1: Formulate Request */}
                <section id="step1" className="mb-12 text-center max-w-2xl">
                    {/* ... (step 1 content remains the same) ... */}
                    <h2 className="text-2xl font-bold text-cyan-400 mb-4">
                        Шаг 1: Сформулируйте запрос для бота с контекстом
                    </h2>
                    <p className="text-gray-300 text-sm">
                        Сначала подумайте, что вы хотите сделать. Например: "Добавить кнопку на сайт" или "Исправить баг в коде". Запишите это в поле ниже в "Ввод запроса". Чтобы бот понял, о чём речь, ему нужен контекст — код вашего проекта. Давайте его извлечём!
                    </p>
                </section>

                {/* RepoTxtFetcher Section with Suspense */}
                <Suspense fallback={<div className="text-white">Загрузка...</div>}>
                    {/* Pass the ref here */}
                    <section id="extractor" className="mb-12 w-full max-w-2xl">
                        <ForwardedRepoTxtFetcher ref={fetcherRef} kworkInputRef={kworkInputRef} />
                    </section>
                </Suspense>

                {/* Step 2: Paste into Executor */}
                <section id="step2" className="mb-12 text-center max-w-2xl">
                   {/* ... (step 2 content remains the same) ... */}
                   <h2 className="text-2xl font-bold text-cyan-400 mb-4">
                        Шаг 2: Вставьте результат в Бота исполнителя
                    </h2>
                    <p className="text-gray-300 text-sm">
                        После того как вы извлекли код и получили анализ от бота, скопируйте результат. Затем вставьте его ниже (или в Grok!), чтобы бот написал новый код — дальше создайте Pull Request на GitHub в один клик. Всё готово для магии!
                    </p>
                </section>

                {/* AICodeAssistant Section */}
                {/* Pass the ref here */}
                 {/* Assign the ref to the wrapping section for scrolling */}
                <section id="executor" ref={prSectionRef} className="mb-12 w-full max-w-2xl pb-16">
                     <ForwardedAICodeAssistant ref={assistantRef} aiResponseInputRef={aiResponseInputRef} />
                </section>

                {/* Fixed Navigation Icons */}
                <nav className="fixed right-2 top-1/2 transform -translate-y-1/2 flex flex-col space-y-4 z-13">
                    <button onClick={() => scrollToSectionNav("intro")} className="p-2 bg-gray-700 rounded-full hover:bg-gray-600 transition" title="Введение"> <FaCode className="text-lg" /> </button>
                    <button onClick={() => scrollToSectionNav("step1")} className="p-2 bg-gray-700 rounded-full hover:bg-gray-600 transition" title="Шаг 1: Запрос"> <FaFileCode className="text-lg" /> </button>
                    <button onClick={() => scrollToSectionNav("extractor")} className="p-2 bg-gray-700 rounded-full hover:bg-gray-600 transition" title="Экстрактор кода"> <FaRobot className="text-lg" /> </button>
                    <button onClick={() => scrollToSectionNav("step2")} className="p-2 bg-gray-700 rounded-full hover:bg-gray-600 transition" title="Шаг 2: Исполнение"> <FaFileCode className="text-lg" /> </button>
                    <button onClick={() => scrollToSectionNav("executor")} className="p-2 bg-gray-700 rounded-full hover:bg-gray-600 transition" title="Исполнитель кода"> <FaRobot className="text-lg" /> </button>
                </nav>
            </div>
        </>
    </RepoXmlPageProvider> // End Provider
  );
}