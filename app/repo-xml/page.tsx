"use client";
import React, { Suspense, useRef } from "react"; // Removed useImperativeHandle if not used directly in page.tsx
import RepoTxtFetcher from "@/components/RepoTxtFetcher";
import AICodeAssistant from "@/components/AICodeAssistant";
import InstructionPanel from "@/components/InstructionPanel"; // Import the new component
import { RepoXmlPageProvider } from '@/contexts/RepoXmlPageContext';
import { FaRobot, FaFileCode, FaCode, FaCircleInfo, FaDatabase, FaCirclePlay } from "react-icons/fa6"; // Added new icons
import { motion } from "framer-motion";

// Forward Refs remain the same
const ForwardedRepoTxtFetcher = React.forwardRef((props, ref) => {
  return <RepoTxtFetcher {...props} ref={ref} />;
});
ForwardedRepoTxtFetcher.displayName = 'ForwardedRepoTxtFetcher';

const ForwardedAICodeAssistant = React.forwardRef((props, ref) => {
  return <AICodeAssistant {...props} ref={ref} />;
});
ForwardedAICodeAssistant.displayName = 'ForwardedAICodeAssistant';

export default function RepoXmlPage() {
  const fetcherRef = useRef<any>(null);
  const assistantRef = useRef<any>(null);
  const kworkInputRef = useRef<HTMLTextAreaElement>(null);
  const aiResponseInputRef = useRef<HTMLTextAreaElement>(null);
  const prSectionRef = useRef<HTMLElement>(null); // Keep this if AICodeAssistant section needs direct ref

  // --- Content Definitions (RU & EN) ---

  const introContentRu = (
    <>
      <p className="text-lg text-gray-300 mt-2">
        Добро пожаловать в мир автоматизации! Это демо покажет, как легко извлечь код или даже <strong className="text-amber-400">SQL-скрипты</strong> из GitHub и создать что-то крутое с помощью бота. Страницы лежат в папке `app`, а компоненты — в `components`. Всё просто, правда?
      </p>
      <p className="text-sm text-red-400 mt-4 bg-gray-800 p-3 rounded-lg border border-red-600">
        ⚠️ <strong className="font-semibold">Внимание:</strong> Встроенный бот сейчас без активного API ключа (экономим!), поэтому для полноценного анализа и генерации кода используйте внешние инструменты:
        <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
            <li>
                Анализ кода/текста:{" "}
                <a href="https://t.me/oneSitePlsBot" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline hover:text-blue-300 transition">
                   t.me/oneSitePlsBot
                </a> (или{" "}
                 <a href="https://t.me/webanybot" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline hover:text-blue-300 transition">
                   t.me/webanybot
                 </a>)
            </li>
            <li>
                Генерация кода/PR:{" "}
                <a href="https://aistudio.google.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline hover:text-blue-300 transition">
                  Google AI Studio
                </a> (Gemini) или аналог.
            </li>
        </ul>
         Спасибо за понимание! ;) Эта демо-страница показывает сам *процесс* и *инструменты*.
      </p>
    </>
  );

  const introContentEn = (
    <>
      <p className="text-lg text-gray-300 mt-2">
        Welcome to the world of automation! This demo shows how easily you can extract code or even <strong className="text-amber-400">SQL scripts</strong> from GitHub and create something cool with a bot. Pages are in the `app` folder, and components are in `components`. Simple, right?
      </p>
      <p className="text-sm text-red-400 mt-4 bg-gray-800 p-3 rounded-lg border border-red-600">
       ⚠️ <strong className="font-semibold">Attention:</strong> The built-in bot currently lacks an active API key (saving costs!), so for full analysis and code generation, please use external tools:
       <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
           <li>
               Code/Text Analysis:{" "}
               <a href="https://t.me/oneSitePlsBot" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline hover:text-blue-300 transition">
                  t.me/oneSitePlsBot
               </a> (or{" "}
                <a href="https://t.me/webanybot" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline hover:text-blue-300 transition">
                  t.me/webanybot
                </a>)
           </li>
           <li>
               Code/PR Generation:{" "}
               <a href="https://aistudio.google.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline hover:text-blue-300 transition">
                 Google AI Studio
               </a> (Gemini) or similar.
           </li>
       </ul>
       Thanks for understanding! ;) This demo page illustrates the *process* and the *tools*.
      </p>
    </>
  );

  const step1ContentRu = (
     <p className="text-gray-300 text-base leading-relaxed">
       Сначала подумайте, что вы хотите сделать. Например: "Добавить кнопку на страницу", "Исправить багу в компоненте X", или "Создать SQL-скрипт для добавления тестовых данных".
       <br /><br />
       Запишите это в поле "Ввод запроса" в секции <strong className="text-purple-400">"Исполнитель"</strong> ниже.
       <br /><br />
       Чтобы бот понял, о чём речь, ему нужен <strong className="text-yellow-400">контекст</strong> — код вашего проекта или структура базы данных. Используйте секцию <strong className="text-blue-400">"Экстрактор"</strong> выше, чтобы получить нужные файлы из репозитория GitHub. Вы можете извлекать не только файлы кода (`.tsx`, `.css`, `.ts`), но и <strong className="text-amber-400">`.sql` файлы</strong> для задач, связанных с базой данных (например, генерация миграций, сидов для тестов).
       <br /><br />
       Скопируйте извлечённый код/SQL и добавьте его к вашему запросу в поле "Ввод запроса".
     </p>
  );

  const step1ContentEn = (
    <p className="text-gray-300 text-base leading-relaxed">
      First, think about what you want to achieve. For example: "Add a button to the page," "Fix a bug in component X," or "Create an SQL script to add test data."
      <br /><br />
      Write this down in the "Enter Prompt" field in the <strong className="text-purple-400">"Executor"</strong> section below.
      <br /><br />
      For the bot to understand the context, it needs the relevant code from your project or the database structure. Use the <strong className="text-blue-400">"Extractor"</strong> section above to fetch the necessary files from a GitHub repository. You can extract not only code files (`.tsx`, `.css`, `.ts`) but also <strong className="text-amber-400">`.sql` files</strong> for database-related tasks (e.g., generating migrations, seeding test data).
      <br /><br />
      Copy the extracted code/SQL and add it to your prompt in the "Enter Prompt" field.
    </p>
  );

  const step2ContentRu = (
    <p className="text-gray-300 text-base leading-relaxed">
      После того как вы отправили запрос с контекстом (извлечённым кодом/SQL) внешнему боту (например, через Telegram или AI Studio), скопируйте его <strong className="text-green-400">ответ</strong> (сгенерированный код, SQL-скрипт или текстовое описание).
      <br /><br />
      Вставьте этот ответ в поле <strong className="text-purple-400">"Ответ AI"</strong> в секции <strong className="text-purple-400">"Исполнитель"</strong>.
      <br /><br />
      Теперь вы готовы <strong className="text-yellow-400">создать Pull Request</strong> на GitHub одним кликом, используя кнопку в секции "Исполнитель". Всё готово для интеграции изменений!
    </p>
  );

  const step2ContentEn = (
    <p className="text-gray-300 text-base leading-relaxed">
      After sending your prompt with context (extracted code/SQL) to an external bot (e.g., via Telegram or AI Studio), copy its <strong className="text-green-400">response</strong> (generated code, SQL script, or text description).
      <br /><br />
      Paste this response into the <strong className="text-purple-400">"AI Response"</strong> field in the <strong className="text-purple-400">"Executor"</strong> section.
      <br /><br />
      Now you are ready to <strong className="text-yellow-400">create a Pull Request</strong> on GitHub with a single click using the button in the "Executor" section. Everything is set for integrating the changes!
    </p>
  );


  // Smooth scroll function
  const scrollToSectionNav = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      // Calculate offset based on potential fixed header height (adjust 80 if you have one)
      const offset = 80;
      const bodyRect = document.body.getBoundingClientRect().top;
      const elementRect = element.getBoundingClientRect().top;
      const elementPosition = elementRect - bodyRect;
      const offsetPosition = elementPosition - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth"
      });
    } else {
      console.error(`Element with id "${id}" not found.`);
    }
  };

  return (
    <RepoXmlPageProvider
        fetcherRef={fetcherRef}
        assistantRef={assistantRef}
        kworkInputRef={kworkInputRef}
        aiResponseInputRef={aiResponseInputRef}
        prSectionRef={prSectionRef} // Keep if needed for direct scroll target
    >
        <>
            {/* Metadata */}
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes" />
            <style jsx global>{`
              /* Optional: Add Tailwind CSS base styles if not already present */
              /* @tailwind base; */
              @tailwind components;
              @tailwind utilities;
              html { scroll-behavior: smooth; }
              body { background-color: #111827; color: white; } /* bg-gray-900 */
              /* Custom scrollbar for better aesthetics */
              ::-webkit-scrollbar { width: 8px; }
              ::-webkit-scrollbar-track { background: #1f2937; } /* bg-gray-800 */
              ::-webkit-scrollbar-thumb { background: #4b5563; border-radius: 4px;} /* bg-gray-600 */
              ::-webkit-scrollbar-thumb:hover { background: #6b7280; } /* bg-gray-500 */
            `}</style>

            {/* Main Content Area */}
            <div className="min-h-screen bg-gray-900 p-6 pt-24 text-white flex flex-col items-center relative overflow-y-auto">

                {/* Intro Section (Kept separate for unique structure, but uses InstructionPanel for main text) */}
                 <section id="intro" className="mb-12 text-center max-w-2xl w-full">
                    <div className="flex justify-center mb-4">
                       {/* SVG remains the same */}
                         <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100" className="w-24 h-12">
                           <circle cx="50" cy="50" r="45" fill="none" stroke="url(#bgGlow)" strokeWidth="10" opacity="0.3" />
                           <circle cx="50" cy="50" r="20" fill="url(#robotFill)" stroke="url(#robotStroke)" strokeWidth="2" />
                           <circle cx="40" cy="45" r="3" fill="#E1FF01" />
                           <circle cx="60" cy="45" r="3" fill="#E1FF01" />
                           <rect x="37" y="53" width="26" height="3" fill="#E1FF01" />
                           <text x="100" y="60" fontSize="40" fill="url(#moneyFill)">💸</text>
                           <defs>
                             <radialGradient id="bgGlow"> <stop offset="0%" stopColor="#E1FF01" stopOpacity="1" /> <stop offset="100%" stopColor="#000" stopOpacity="0" /> </radialGradient>
                             <linearGradient id="robotFill" x1="0%" y1="0%" x2="100%" y2="100%"> <stop offset="0%" stopColor="#000" /> <stop offset="100%" stopColor="#E1FF01" /> </linearGradient>
                             <linearGradient id="robotStroke" x1="0%" y1="0%" x2="100%" y2="100%"> <stop offset="0%" stopColor="#E1FF01" /> <stop offset="100%" stopColor="#000" /> </linearGradient>
                             <linearGradient id="moneyFill" x1="0%" y1="0%" x2="100%" y2="100%"> <stop offset="0%" stopColor="#E1FF01" /> <stop offset="100%" stopColor="#000" /> </linearGradient>
                           </defs>
                         </svg>
                    </div>
                    <h1 className="text-4xl font-bold text-[#E1FF01] text-shadow-[0_0_10px_#E1FF01] animate-pulse">
                        CYBER STUDIO
                    </h1>
                     {/* Use InstructionPanel for the main text block */}
                     <InstructionPanel
                        id="intro-text" // Different ID if needed, or remove if covered by parent section
                        titleRu="Введение / Как это работает"
                        titleEn="Introduction / How It Works"
                        contentRu={introContentRu}
                        contentEn={introContentEn}
                        icon={<FaCircleInfo />}
                        className="text-left mt-6" // Adjust styling as needed
                        defaultCollapsed={false} // Maybe start expanded?
                     />
                </section>

                {/* Step 1: Formulate Request */}
                 <InstructionPanel
                    id="step1"
                    titleRu="Шаг 1: Сформулируйте Запрос + Контекст"
                    titleEn="Step 1: Formulate Prompt + Context"
                    contentRu={step1ContentRu}
                    contentEn={step1ContentEn}
                    icon={<FaFileCode />}
                 />

                {/* RepoTxtFetcher Section */}
                <Suspense fallback={<div className="text-white w-full max-w-2xl text-center p-4">Загрузка Экстрактора...</div>}>
                    <section id="extractor" className="mb-12 w-full max-w-2xl">
                        <ForwardedRepoTxtFetcher ref={fetcherRef} kworkInputRef={kworkInputRef} />
                    </section>
                </Suspense>

                {/* Step 2: Paste into Executor */}
                 <InstructionPanel
                    id="step2"
                    titleRu="Шаг 2: Используйте Ответ Бота"
                    titleEn="Step 2: Use the Bot's Response"
                    contentRu={step2ContentRu}
                    contentEn={step2ContentEn}
                    icon={<FaCirclePlay />}
                 />

                {/* AICodeAssistant Section */}
                <section id="executor" ref={prSectionRef} className="mb-12 w-full max-w-2xl pb-16">
                     <ForwardedAICodeAssistant ref={assistantRef} aiResponseInputRef={aiResponseInputRef} />
                </section>


                {/* --- Improved Fixed Navigation --- */}
                <nav className="fixed right-0 top-1/2 transform -translate-y-1/2 flex flex-col space-y-2 p-3 bg-gray-800 bg-opacity-80 backdrop-blur-sm rounded-l-lg shadow-lg border border-gray-700 z-30">
                    {/* Grouping: Info */}
                    <NavButton id="intro" title="Intro / Введение" icon={<FaCircleInfo />} onClick={scrollToSectionNav} color="gray" />
                    <NavButton id="step1" title="Step 1 / Шаг 1" icon={<FaFileCode />} onClick={scrollToSectionNav} color="gray" />
                     <NavButton id="step2" title="Step 2 / Шаг 2" icon={<FaCirclePlay />} onClick={scrollToSectionNav} color="gray" />

                    {/* Divider */}
                     <hr className="border-gray-600 my-2" />

                    {/* Grouping: Actions */}
                    <NavButton id="extractor" title="Extractor / Экстрактор" icon={<FaDatabase />} onClick={scrollToSectionNav} color="blue" />
                    <NavButton id="executor" title="Executor / Исполнитель" icon={<FaRobot />} onClick={scrollToSectionNav} color="purple" />
                </nav>
            </div>
        </>
    </RepoXmlPageProvider>
  );
}

// Helper component for Navigation Buttons
interface NavButtonProps {
    id: string;
    title: string;
    icon: ReactNode;
    onClick: (id: string) => void;
    color?: 'gray' | 'blue' | 'purple';
}

const NavButton: React.FC<NavButtonProps> = ({ id, title, icon, onClick, color = 'gray' }) => {
    const colorClasses = {
        gray: 'bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white',
        blue: 'bg-blue-700 hover:bg-blue-600 text-blue-100 hover:text-white',
        purple: 'bg-purple-700 hover:bg-purple-600 text-purple-100 hover:text-white',
    };

    return (
        <button
            onClick={() => onClick(id)}
            className={`group flex items-center space-x-2 p-2 rounded-md transition duration-200 ${colorClasses[color]}`}
            title={title} // Keep title for accessibility fallback
        >
            <span className="text-lg">{icon}</span>
            <span className="hidden group-hover:inline-block text-xs whitespace-nowrap pr-2">
                {title.split('/')[0].trim()} {/* Show first part of title on hover */}
            </span>
             {/* Or always show text: */}
             {/* <span className="text-xs whitespace-nowrap">{title.split('/')[0].trim()}</span> */}
        </button>
    );
};