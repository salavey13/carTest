"use client";
import React, { Suspense, useRef, useState, useEffect, ReactNode, useCallback, useMemo } from "react";
import { useSearchParams } from 'next/navigation';
import RepoTxtFetcher from "@/components/RepoTxtFetcher";
import AICodeAssistant from "@/components/AICodeAssistant";
import AutomationBuddy from "@/components/AutomationBuddy";
import {
    useRepoXmlPageContext, RepoXmlPageProvider,
    RepoTxtFetcherRef, AICodeAssistantRef, ImageReplaceTask,
    RepoXmlPageContextType, FileNode, TargetPrData, PendingFlowDetails
} from '@/contexts/RepoXmlPageContext';
import { useAppContext } from "@/contexts/AppContext";
import { debugLogger as logger } from "@/lib/debugLogger";
import { useAppToast } from "@/hooks/useAppToast";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"; 
import {
    FaRobot, FaDownload, FaCircleInfo, FaGithub, FaWandMagicSparkles, FaUpLong,
    FaHandSparkles, FaArrowUpRightFromSquare, FaUserAstronaut, FaHeart, FaBullseye,
    FaAtom, FaBrain, FaCodeBranch, FaPlus, FaCopy, FaSpinner, FaBolt,
    FaToolbox, FaCode, FaVideo, FaDatabase, FaBug, FaMicrophone, FaLink, FaServer, FaRocket,
    FaMagnifyingGlass, FaMemory, FaKeyboard, FaBriefcase, FaMagnifyingGlassChart, FaTree, FaEye,
    FaUsers, FaQuoteLeft, FaQuoteRight, FaCircleXmark, FaAnglesDown, FaAnglesUp, FaVideoSlash, FaCommentDots, FaTrophy
} from "react-icons/fa6";
import Link from "next/link";
import { motion } from 'framer-motion';
import VibeContentRenderer from '@/components/VibeContentRenderer';

const CYBERWTF_BADGE = "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/IMG_20250623_004400_844-152720e6-ad84-48d1-b4e7-e0f238b7442b.png";
const XUINITY_EMBLEM = "https://github.com/user-attachments/assets/910a623e-1c9d-4630-a8b4-7c361565dc97";

const onboardingBlocks = {
  en: {
    title: "🧬 Welcome to CYBERVIBE STUDIO /repo-xml 🧬",
    badge: "CYBERWTF VIBE TRIBE",
    intro: `If you’re reading this, you’re not lost. You’re exactly where the next level starts.
This is not a regular dev page. This is your portal to the SUPERVIBE ENGINE:
- AI-powered
- Gamified
- 100% WTF
- Built for devs, dreamers, and reality remixers`,
    tldr: [
      "<strong>Scroll.</strong> Let your brain catch up—yes, it’s a lot.",
      "<strong>Click “Extract Files”.</strong> Instantly fetch source code to remix, patch, or build on.",
      "<strong>Drop your AI request or idea.</strong> Use the text box. Think: “Add dark mode”, “Fix this error”, “Make it cyberpunk”.",
      "<strong>AI + YOU = PR</strong> The bot will generate code, explain it, and let you instantly create a PR—no local setup, no git voodoo.",
      "<strong>Level Up.</strong> Every action unlocks perks, quests, and new features (tracked in your CyberFitness profile). See your progress, unlock achievements, and flex with the VIBE TRIBE."
    ],
    whatisit: `/repo-xml = AI-powered remix lab for this project.
SUPERVIBE ENGINE: Recursive workflow: Extract context → Feed to AI → Build, patch, merge → Repeat
No install, no gatekeeping, just instant hacking and learning.`,
    youare: `You’re not just using a tool.  
You’re co-piloting an AI-powered, cyberpunk, recursive dev studio.  
You’re not asking “how do I code this?”  
You’re asking “how do I LEVEL UP?”`,
    levels: `- Every PR, code fetch, or AI action = progress
- Quests like “Fix a broken image”, “Ship an idea”, “Remix the matrix”, “Inception Swap”
- Your CyberFitness Profile evolves: Level up, unlock perks, collect badges, and see your “Cognitive OS Version” change as you grow.`,
    levelsTitle: "🏆 BADGES, LEVELS, & QUESTS",
    faq: [
      { q: "Why does this look like a game?", a: "Because learning, shipping, and leveling up should feel like one." },
      { q: "Why is there a DNA helix and neon everywhere?", a: "Because you’re hacking the code of your DEV DNA—and it should look awesome." },
      { q: "Why is this better than a regular code editor?", a: "No setup, no fear, no gatekeeping. Just create, remix, and WIN." },
      { q: "What if I break something?", a: "You can’t. Everything is sandboxed, safe, and tracked. Every PR is reviewed before merging." },
      { q: `"I still don’t get it."`, a: "Scroll back up. Click something. You’ll get it once you vibe." },
    ],
    tribe: [
      { label: "CYBERVIBE Sandbox (this page)", url: "https://github.com/salavey13/carTest/app/repo-xml" },
      { label: "Telegram entrypoint", url: "https://t.me/oneSitePlsBot" },
      { label: "CYBERFITNESS Engine (Gamified)", url: "https://t.me/oneSitePlsBot/app" },
      { label: "Full achievement history, perks, and code", url: "https://github.com/salavey13/carTest/blob/main/hooks/cyberFitnessSupabase.ts" },
    ],
    ready: "Ready? Let’s f*cking go. Welcome to CYBERVIBE."
  },
  ru: {
    title: "🧬 Добро пожаловать в CYBERVIBE STUDIO /repo-xml 🧬",
    badge: "CYBERWTF VIBE TRIBE",
    intro: `Если ты это читаешь – ты не потерялся. Ты именно там, где начинается следующий уровень.
Это не обычная страница для разработчиков. Это твой портал в SUPERVIBE ENGINE:
- ИИ внутри
- Геймифицировано
- 100% WTF
- Для кодеров, мечтателей и всех, кто хочет создавать без барьеров`,
    tldr: [
      "<strong>Прокрути вниз.</strong> Пусть мозг привыкнет – да, тут много нового.",
      "<strong>Жми “Извлечь файлы”.</strong> Мгновенно получи исходники этого репозитория для экспериментов, фиксов и апгрейдов.",
      "<strong>Опиши свою идею или вопрос для ИИ.</strong> Просто напиши: “Добавь темную тему”, “Исправь ошибку”, “Сделай по-киберпанковски”.",
      "<strong>ИИ + ТЫ = PR</strong> Бот сгенерирует код, объяснит, и даст сразу создать Pull Request — без локальной сборки, без гита-колдунства.",
      "<strong>Прокачка!</strong> Любое действие открывает новые перки, квесты и фичи (всё записывается в твой профиль CyberFitness). Следи за прогрессом, собирай ачивки, и становись частью VIBE TRIBE."
    ],
    whatisit: `/repo-xml = лаборатория ремиксов на базе ИИ для этого проекта.
SUPERVIBE ENGINE: Рекурсивный воркфлоу: Извлекай контекст → Кидай в ИИ → Собирай, чини, мержи → Повтори
Без установки, без барьеров, мгновенный старт и обучение.`,
    youare: `Ты не просто пользуешься тулзой.  
Ты ко-пилотируешь ИИ-киберпанк студию, где каждое действие — новый левел.  
Тут не спрашивают “как это закодить”,  
тут спрашивают “как ПРОКАЧАТЬСЯ?”`,
    levels: `- Любой PR, файл или запрос к ИИ = прогресс
- Квесты: “Почини картинку”, “Запусти идею”, “Ремиксуй матрицу”, “Inception Swap” и другие
- Твой CyberFitness профиль растет: Новый уровень, перки, ачивки, и “Cognitive OS Version” — как у персонажа.`,
    levelsTitle: "🏆 АЧИВКИ, УРОВНИ И КВЕСТЫ",
    faq: [
      { q: "Почему это похоже на игру?", a: "Потому что учиться, пилить и прокачиваться — должно быть весело." },
      { q: "Зачем ДНК и неон?", a: "Ты реально меняешь свой кодовый ДНК, и пусть это будет красиво." },
      { q: "Это лучше обычного редактора?", a: "Да — не нужно ничего ставить, бояться и разбираться. Просто создавай, ремиксуй и выигрывай." },
      { q: "А если я что-то сломаю?", a: "Не бойся — всё работает в песочнице, ничего не сломать. Каждый PR проходит ревью." },
      { q: "Всё равно не понял(а)!", a: "Пролистай вверх. Кликни. Попробуй. Ты поймешь, когда начнешь вайбить." },
    ],
    tribe: [
      { label: "CYBERVIBE Sandbox (эта страница)", url: "https://github.com/salavey13/carTest/app/repo-xml" },
      { label: "Вход в Telegram", url: "https://t.me/oneSitePlsBot" },
      { label: "CYBERFITNESS Engine (Геймифицировано)", url: "https://t.me/oneSitePlsBot/app" },
      { label: "Вся история ачивок, перков и кода", url: "https://github.com/salavey13/carTest/blob/main/hooks/cyberFitnessSupabase.ts" },
    ],
    ready: "Готов(а)? Погнали! Добро пожаловать в CYBERVIBE."
  }
};

function LangOnboardingBlock({ lang }: { lang: "en" | "ru" }) {
  const t = onboardingBlocks[lang];
  return (
    <Card className="relative z-10 w-full max-w-3xl mx-auto mb-10 bg-black/60 backdrop-blur-md border border-fuchsia-600 shadow-2xl rounded-3xl p-0 overflow-hidden">
      <div className="flex flex-col items-center py-6 px-4">
        <img 
          src={CYBERWTF_BADGE} 
          alt="CYBERWTF badge" 
          className="w-full max-w-[420px] mb-2 drop-shadow-glow" />
      </div>
      <CardHeader className="pt-0">
        <CardTitle className="text-2xl md:text-3xl font-bold text-center text-fuchsia-400 font-orbitron px-4">{t.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-base md:text-lg text-gray-200">
        <div className="whitespace-pre-line">{t.intro}</div>
        <div className="bg-gradient-to-r from-green-400/10 via-pink-400/10 to-purple-800/20 border-l-4 border-pink-500 rounded p-4 my-2 text-lg font-bold shadow-inner">
          <div className="mb-1">🚦 <span className="text-pink-300 font-extrabold">TL;DR / Быстрый старт:</span></div>
          <ul className="list-disc ml-7 space-y-1">
            {t.tldr.map((l, i) => <li key={i}><VibeContentRenderer content={l} /></li>)}
          </ul>
        </div>
        <div>
          <b>🌀 {lang === "en" ? "What even is this?" : "Что это вообще?"}</b>
          <div className="whitespace-pre-line mt-2">{t.whatisit}</div>
        </div>
        <div className="italic text-pink-300 whitespace-pre-line">{t.youare}</div>
        
        <div className="mt-4 p-4 rounded-lg bg-gradient-to-br from-fuchsia-900/40 to-purple-900/60 border border-fuchsia-500/50 shadow-inner">
          <h3 className="font-bold text-xl mb-2 text-fuchsia-300 flex items-center gap-2"><VibeContentRenderer content={t.levelsTitle}/></h3>
          <div className="whitespace-pre-line text-gray-300"><VibeContentRenderer content={t.levels} /></div>
        </div>

        <details className="mt-3 bg-slate-900/80 rounded p-3 border-l-4 border-fuchsia-600">
          <summary className="font-bold cursor-pointer">{lang === "en" ? "FAQ (Still lost? Read this!)" : "FAQ (Всё ещё WTF? Читай это!)"}</summary>
          <ul className="mt-2 space-y-1">
            {t.faq.map((f, i) => (
              <li key={i}><b>{f.q}</b><br /><span>{f.a}</span></li>
            ))}
          </ul>
        </details>
        <div className="mt-4">
          <b>🔥 {lang === "en" ? "Join the Tribe:" : "Присоединяйся к Tribe:"}</b>
          <ul className="mt-1 space-y-1">
            {t.tribe.map((l, i) => (
              <li key={i}><a href={l.url} target="_blank" rel="noopener noreferrer" className="text-fuchsia-400 underline hover:text-pink-400">{l.label}</a></li>
            ))}
          </ul>
        </div>
        <p className="text-center mt-6 text-2xl font-bold text-pink-400">{t.ready}</p>
      </CardContent>
    </Card>
  );
}

// --- I18N Translations ---
const translations = {
  en: {
    loading: "Booting SUPERVIBE ENGINE...",
    pageTitle: "SUPERVIBE STUDIO 2.0",
    welcome: "Yo,",
    intro1: "Code scary? Forget that noise! This is the <strong>NOW</strong>. Your personal <strong>dev accelerator</strong>. Instant Level UP!",
    intro2: "Think: Magic Playground. Got ideas? Speak 'em. AI builds, system checks, PR ships. <strong>Boom.</strong> You guide the process.",
    intro3: "Stop consuming, start <strong>CREATING</strong>. Build YOUR reality, crush YOUR problems, <strong>validate ideas INSTANTLY</strong>. This is how you vibe.",
    cyberVibeTitle: "The Vibe Loop: Your Level Up Engine <FaUpLong/>",
    cyberVibe1: "This ain't just tools – it's a <strong>compounding feedback loop</strong>. Every action levels you up, makes the next step easier. You evolve.",
    cyberVibe2: "<FaGithub class='inline mr-1 text-gray-400 align-baseline'/> is your <strong>cyberchest</strong>. This Studio + AI? Your interface to <strong>remix and transmute</strong> that knowledge into new vibes, features, fixes... <strong>instantly</strong>.",
    cyberVibe3: "You're not <em>learning</em> code; you're <strong>remixing the matrix</strong>. You interact, you understand structure, you <strong>command the AI</strong>. You're the Vibe Master.",
    cyberVibe4: "It's <strong>co-creation</strong> with the machine. Push boundaries. Earn bandwidth. Infinite context. Infinite power. This is <strong>CYBERVIBE 2.0</strong>.",
    communityWisdomTitle: "Community Wisdom <FaUsers/>",
    quote1: "Sam Altman on the dream: 'Getting the whole app after a prompt.' That's what we're building. Full app from a thought. <a href='https://youtube.com/clip/Ugkx1LAX6-gO4J8hC6HoHbg0_KMlBHcsKX3V' target='_blank' class='text-brand-blue hover:underline font-semibold'>(Clip <FaArrowUpRightFromSquare class='inline h-3 w-3 ml-px align-baseline'/>)</a>",
    quote2: "Vibecoding? 'Yeah, he does.' From video idea to gamified app. Turning vision into interactive reality. <a href='https://youtube.com/clip/UgkxZVMHbEo2XwO-sayoxskH89zzrDdN6vsx' target='_blank' class='text-brand-blue hover:underline font-semibold'>(Clip <FaArrowUpRightFromSquare class='inline h-3 w-3 ml-px align-baseline'/>)</a>",
    quote3: "Monetization: 'Sell outcomes, not just pickaxes.' Automated, 10x cheaper solutions. That's the real product. <a href='https://youtube.com/clip/UgkxvGYsRm3HezCgOyqszCbn5DfDDx7LixPE' target='_blank' class='text-brand-blue hover:underline font-semibold'>(Clip <FaArrowUpRightFromSquare class='inline h-3 w-3 ml-px align-baseline'/>)</a>",
    ctaHotChickQuote: "Got the fire? Let's build something epic. Hit me up <strong>@SALAVEY13</strong> NOW!",
    philosophyTitle: "Your Vibe Path: Level Up & the Autonomy Slider (Andrej Karpathy + Salavey13)",
    philosophyVideoTitle: "🎥 Watch: Vibe Level System (Salavey13) + Karpathy's 'Software is Changing (Again)'",
    philosophyCore: `
<strong>The Goal (inspired by Andrej Karpathy): Build an Iron Man suit, not just an autonomous robot.</strong><br/>
You are Tony Stark. The AI is your suit. You are always in the loop, augmented, and in control.<br/>
Your core task is to make the <strong>Generation-Verification loop</strong> as fast as possible. The AI generates, but you, the human, are the verifier. A good GUI (like visual diffs) is crucial because it uses your brain's "vision GPU" to make verification instant.<br/>
<b>To go fast, we keep the AI on a leash.</b> Small, incremental, auditable changes are better than a 10,000-line PR you can't review.
`,
    philosophyLvl0_1: `
<div style="background:#f8fafc;color:#0f172a;padding:12px 16px;border-radius:12px;margin-bottom:8px;">
<b>Lv.0 → 1 <FaBolt className="inline text-yellow-500" /> (Full Auto, "One-Click Fix")</b><br/>
<span>
🟢 <b>Autonomy Slider:</b> <span style="color:#0ea5e9;">100% agent</span> <span style="color:#64748b;">→</span> <span style="color:#0ea5e9;">0% human</span><br/>
Fix a broken image. Paste link → Upload replacement. <b>PR is auto-created.</b> You simply review the final result and merge. The agent handles everything.
</span>
</div>
`,
    philosophyLvl1_2: `
<div style="background:#e0e7ef;color:#0f172a;padding:12px 16px;border-radius:12px;margin-bottom:8px;">
<b>Lv.1 → 2 <FaToolbox className="inline text-blue-600" /> (Prompt+File, "Vibe Request")</b><br/>
🟢 <b>Autonomy Slider:</b> <span style="color:#0ea5e9;">80% agent</span> <span style="color:#64748b;">→</span> <span style="color:#0ea5e9;">20% human</span><br/>
Describe a tiny change (text/button) + pick 1 file. The AI does the coding, you check the diff. Your input is the idea; the agent does the work.
</div>
`,
    philosophyLvl2_3: `
<div style="background:#f1f5f9;color:#0f172a;padding:12px 16px;border-radius:12px;margin-bottom:8px;">
<b>Lv.2 → 3 <FaCode className="inline text-pink-600" /> (Multi-File, "Prompt Orchestra")</b><br/>
🟢 <b>Autonomy Slider:</b> <span style="color:#0ea5e9;">60% agent</span> <span style="color:#64748b;">→</span> <span style="color:#0ea5e9;">40% human</span><br/>
Bigger refactor? Select 2-5 files, describe the change. You provide more context and the verification becomes more important. You are the orchestrator.
</div>
`,
    philosophyLvl3_4: `
<div style="background:#f8fafc;color:#0f172a;padding:12px 16px;border-radius:12px;margin-bottom:8px;">
<b>Lv.3 → 4 <FaBug className="inline text-red-600" /> (Debug/Logs, "AI as Rubber Duck")</b><br/>
🟢 <b>Autonomy Slider:</b> <span style="color:#0ea5e9;">50% agent</span> <span style="color:#64748b;">→</span> <span style="color:#0ea5e9;">50% human</span><br/>
Build fails? Copy the error/log, feed it with code to the AI. This is a true partnership. You provide the problem, AI suggests a fix, you approve.
</div>
`,
    philosophyLvl4_5: `
<div style="background:#e0e7ef;color:#0f172a;padding:12px 16px;border-radius:12px;margin-bottom:8px;">
<b>Lv.4 → 5 <FaLink className="inline text-green-600" /> (Proactive / Icon Hunt)</b><br/>
🟢 <b>Autonomy Slider:</b> <span style="color:#0ea5e9;">40% agent</span> <span style="color:#64748b;">→</span> <span style="color:#0ea5e9;">60% human</span><br/>
You're now leading. You teach the agent new tricks: find icons, fix warnings proactively. You're not just reacting, you're guiding the system's evolution.
</div>
`,
    philosophyLvl5_6: `
<div style="background:#f1f5f9;color:#0f172a;padding:12px 16px;border-radius:12px;margin-bottom:8px;">
<b>Lv.5 → 6 <FaMicrophone className="inline text-fuchsia-600" />/<FaVideo className="inline text-blue-400" /> (Multimodal Inputs)</b><br/>
🟢 <b>Autonomy Slider:</b> <span style="color:#0ea5e9;">Variable</span>. You choose the input method that's fastest for you. You're fully in command of the workflow.
</div>
`,
    philosophyLvl6_7: `
<div style="background:#f8fafc;color:#0f172a;padding:12px 16px;border-radius:12px;margin-bottom:8px;">
<b>Lv.6 → 7 <FaDatabase className="inline text-cyan-600" /> (Data/SQL, "AI DB Assistant")</b><br/>
🟢 <b>Autonomy Slider:</b> <span style="color:#0ea5e9;">50% agent</span> <span style="color:#64748b;">→</span> <span style="color:#0ea5e9;">50% human</span><br/>
Let AI generate SQL or data scripts. The agent proposes, but only you, the master of the data, approve the merge. High stakes, high trust.
</div>
`,
    philosophyLvl8_10: `
<div style="background:#e0e7ef;color:#0f172a;padding:12px 16px;border-radius:12px;margin-bottom:8px;">
<b>Lv.8-10+ <FaServer className="inline text-green-700" />/<FaRocket className="inline text-orange-500" /> (Full Independence)</b><br/>
🟢 <b>Autonomy Slider:</b> <span style="color:#0ea5e9;">You are the system architect.</span><br/>
Deploy your own CyberVibe. Plug in your own keys, bots, and XTRs. You now control the entire system, not just the prompts. You are running your own AI-powered studio.
</div>
`,
    philosophyEnd: `
<div style="background:#fff;color:#0f172a;padding:14px 18px;border-radius:16px;margin-top:18px;font-weight:bold;">
Every level is a new notch on your <b>autonomy slider</b>. You start by trusting the agent with small, verifiable tasks. Then bigger ones. Eventually, you and the agent are true co-pilots in your Iron Man suit.<br/>
<b>The future isn't "full auto"—it's <span style="color:#22c55e">human + agent, in a fast, verifiable loop. Always learning. Always leveling up.</span></b>
</div>
`,
    stepsTitle: "Краткий Гайд:",
    step1Title: "1. Хватай Репу / Укажи Желание:",
    step1Desc: "Введи GitHub URL -> Жми <FaDownload class='inline mx-1 text-purple-400 align-baseline'/> OR Spot bug/idea -> Activate Buddy <FaRobot class='inline mx-1 text-indigo-400 align-baseline'/> -> Describe.",
    step1DescEnd: "Для картинок (Лв.1): Copy broken URL, paste in Buddy/Input.",
    step2Title: "2. AI Магия & Ship:",
    step2Desc: "If needed (Lv.2+), use <span class='text-blue-400 font-semibold'>\"🤖 Спросить AI\"</span> -> Check Assistant <FaWandMagicSparkles class='inline mx-1 text-yellow-400 align-baseline'/> -> Hit <FaGithub class='inline mx-1 text-green-400 align-baseline'/> PR Button.",
    step2DescEnd: "<strong>DONE.</strong> Site updates automagically.",
    readyButton: "LET'S F*CKING GO!",
    componentsTitle: "Врубай Движки Вайба!",
    ctaTitle: "Ready to Level Up, {USERNAME}?",
    ctaDesc: "Seriously. Stop doubting. Start <strong>DOING</strong>. That first level is calling. Level up NOW!",
    ctaHotChick: "Got the fire? Let's build something epic. Hit me up <strong>@SALAVEY13</strong> NOW!",
    ctaDude: "(Everyone else? Just f*cking try it. Level 1 is a button click away. You got this!)",
    navGrabber: "Grabber <FaDownload/>",
    navAssistant: "Assistant <FaRobot/>",
    navOnboarding: "Welcome <FaUserAstronaut/>",
    navIntro: "Intro <FaCircleInfo/>",
    navCyberVibe: "Vibe Loop <FaUpLong/>",
    collapseAll: "Collapse All Sections",
    expandAll: "Expand All Sections",
  },
  ru: {
    loading: "Запуск SUPERVIBE ДВИЖКА...",
    pageTitle: "SUPERVIBE СТУДИЯ 2.0",
    welcome: "Йоу,",
    intro1: "Код пугает? Забудь! Это <strong>СЕЙЧАС</strong>. Твой личный <strong>dev-ускоритель</strong>. Мгновенный Level UP!",
    intro2: "Думай: Волшебная Песочница. Есть идеи? Говори. AI строит, система чекает, PR улетает. <strong>Бум.</strong> Ты рулишь процессом.",
    intro3: "Хватит потреблять, стань <strong>ТВОРЦОМ</strong>. Строй СВОЮ реальность, решай СВОИ проблемы, <strong>валидируй идеи МГНОВЕННО</strong>. Вот это вайб.",
    cyberVibeTitle: "Петля Вайба: Твой Движок Прокачки <FaUpLong/>",
    cyberVibe1: "Это не просто тулзы – это <strong>накопительная петля обратной связи</strong>. Каждое действие качает тебя, делает следующий шаг легче. Ты эволюционируешь.",
    cyberVibe2: "<FaGithub class='inline mr-1 text-gray-400 align-baseline'/> - твой <strong>кибер-сундук</strong>. Эта Студия + AI? Твой интерфейс для <strong>ремикса и трансмутации</strong> этих знаний в новые вайбы, фичи, фиксы... <strong>мгновенно</strong>.",
    cyberVibe3: "Ты не <em>учишь</em> код; ты <strong>ремиксуешь матрицу</strong>. Взаимодействуешь, понимаешь структуру, <strong>командуешь AI</strong>. Ты - Вайб Мастер.",
    cyberVibe4: "Это <strong>со-творчество</strong> с машиной. Двигай границы. Зарабатывай bandwidth. Бесконечный контекст. Бесконечная мощь. Это <strong>CYBERVIBE 2.0</strong>.",
    communityWisdomTitle: "Мудрость Сообщества <FaUsers/>",
    quote1: "Сэм Альтман о мечте: 'Получить целое приложение после промпта.' Это то, что мы строим. Целое приложение из мысли. <a href='https://youtube.com/clip/Ugkx1LAX6-gO4J8hC6HoHbg0_KMlBHcsKX3V' target='_blank' class='text-brand-blue hover:underline font-semibold'>(Альтман чухает фишку <FaArrowUpRightFromSquare class='inline h-3 w-3 ml-px align-baseline'/>)</a>",
    quote2: "Вайбкодинг? 'Ага, он могёт.' От идеи видео до геймифицированного приложения. Превращение видения в интерактивную реальность. <a href='https://youtube.com/clip/UgkxZVMHbEo2XwO-sayoxskH89zzrDdN6vsx' target='_blank' class='text-brand-blue hover:underline font-semibold'>(I do vibe <FaArrowUpRightFromSquare class='inline h-3 w-3 ml-px align-baseline'/>)</a>",
    quote3: "Монетизация: 'Продавай результаты, а не просто кирки.' Автоматизированные, в 10 раз дешевле решения. Вот настоящий продукт. <a href='https://youtube.com/clip/UgkxvGYsRm3HezCgOyqszCbn5DfDDx7LixPE' target='_blank' class='text-brand-blue hover:underline font-semibold'>('Fucking ez' <FaArrowUpRightFromSquare class='inline h-3 w-3 ml-px align-baseline'/>)</a>",
    ctaHotChickQuote: "Есть искра? Давай замутим что-то эпичное. Пиши <strong>@SALAVEY13</strong> СЕЙЧАС!",
    philosophyTitle: "Твой Путь Вайба: Слайдер Автономии (Karpathy + Salavey13)",
    philosophyVideoTitle: "🎥 Смотри: Система Уровней (Salavey13) + Карпати 'Software is Changing (Again)'",
    philosophyCore: `
<strong>Цель (по Карпати): Построить костюм Железного Человека, а не автономного робота.</strong><br/>
Ты — Тони Старк. AI — твой костюм. Ты всегда в центре, усилен и всё контролируешь.<br/>
Твоя главная задача — ускорить цикл <strong>«Генерация → Верификация»</strong>. AI предлагает, но проверяешь ТЫ. Хороший GUI (визуальный дифф) решает, потому что он использует «GPU для зрения» в твоей голове и делает проверку мгновенной.<br/>
<b>Чтобы двигаться быстро, мы держим AI на коротком поводке.</b> Маленькие, понятные, проверяемые изменения лучше, чем PR на 10,000 строк, который ты не сможешь проверить.
`,
    philosophyLvl0_1: `
<div style="background:#18181b;color:#f1f5f9;padding:12px 16px;border-radius:12px;margin-bottom:8px;">
<b>Лв.0 → 1 <FaBolt className="inline text-yellow-400" /> (Полный автомат, "Фикс в один клик")</b><br/>
🟢 <b>Слайдер автономии:</b> <span style="color:#22d3ee;">100% агент</span> <span style="color:#64748b;">→</span> <span style="color:#22d3ee;">0% человек</span><br/>
Починить битую картинку. Вставил ссылку → Загрузил новую. <b>PR создается сам.</b> Ты просто смотришь на результат и мёржишь. Агент делает всё. <strong>ЛЮБОЙ</strong> может это прямо сейчас.
</div>
`,
    philosophyLvl1_2: `
<div style="background:#262833;color:#f1f5f9;padding:12px 16px;border-radius:12px;margin-bottom:8px;">
<b>Лв.1 → 2 <FaToolbox className="inline text-blue-400" /> (Промпт + 1 Файл)</b><br/>
🟢 <b>Слайдер автономии:</b> <span style="color:#22d3ee;">80% агент</span> <span style="color:#64748b;">→</span> <span style="color:#22d3ee;">20% человек</span><br/>
Опиши простую правку (текст/кнопка) + выбери 1 файл. <strong>Ты сказал — AI сделал.</strong> Ты проверяешь дифф.
</div>
`,
    philosophyLvl2_3: `
<div style="background:#18181b;color:#f1f5f9;padding:12px 16px;border-radius:12px;margin-bottom:8px;">
<b>Лв.2 → 3 <FaCode className="inline text-pink-400" /> (Мульти-файл, "Оркестр")</b><br/>
🟢 <b>Слайдер автономии:</b> <span style="color:#22d3ee;">60% агент</span> <span style="color:#64748b;">→</span> <span style="color:#22d3ee;">40% человек</span><br/>
Рефакторинг? 2-5 файлов, твой промпт. Ты даешь больше контекста, и твоя проверка становится важнее. Ты — дирижер.
</div>
`,
    philosophyLvl3_4: `
<div style="background:#262833;color:#f1f5f9;padding:12px 16px;border-radius:12px;margin-bottom:8px;">
<b>Лв.3 → 4 <FaBug className="inline text-red-400" /> (Дебаг/Логи)</b><br/>
🟢 <b>Слайдер автономии:</b> <span style="color:#22d3ee;">50% агент</span> <span style="color:#64748b;">→</span> <span style="color:#22d3ee;">50% человек</span><br/>
Сборка упала? Копируй ошибку, логи, кидай в AI с кодом. Это настоящее партнерство. Ты даешь проблему, AI предлагает решение, ты утверждаешь.
</div>
`,
    philosophyLvl4_5: `
<div style="background:#18181b;color:#f1f5f9;padding:12px 16px;border-radius:12px;margin-bottom:8px;">
<b>Лв.4 → 5 <FaLink className="inline text-green-400" /> (Проактивность/Охота за иконками)</b><br/>
🟢 <b>Слайдер автономии:</b> <span style="color:#22d3ee;">40% агент</span> <span style="color:#64748b;">→</span> <span style="color:#22d3ee;">60% человек</span><br/>
Теперь ты ведешь. Учишь агента новым трюкам: ищешь иконки, чинишь ворнинги проактивно. Ты не реагируешь, а направляешь эволюцию системы.
</div>
`,
    philosophyLvl5_6: `
<div style="background:#262833;color:#f1f5f9;padding:12px 16px;border-radius:12px;margin-bottom:8px;">
<b>Лв.5 → 6 <FaMicrophone className="inline text-fuchsia-400" />/<FaVideo className="inline text-blue-400" /> (Мультимодал)</b><br/>
🟢 <b>Слайдер автономии:</b> <span style="color:#22d3ee;">Вариативно.</span> Ты выбираешь способ ввода, который для тебя быстрее. Ты полностью командуешь процессом.
</div>
`,
    philosophyLvl6_7: `
<div style="background:#18181b;color:#f1f5f9;padding:12px 16px;border-radius:12px;margin-bottom:8px;">
<b>Лв.6 → 7 <FaDatabase className="inline text-cyan-300" /> (Данные/SQL)</b><br/>
🟢 <b>Слайдер автономии:</b> <span style="color:#22d3ee;">50% агент</span> <span style="color:#64748b;">→</span> <span style="color:#22d3ee;">50% человек</span><br/>
AI генерит SQL. Агент предлагает, но только ты, хозяин данных, одобряешь мерж. Высокие ставки, высокое доверие.
</div>
`,
    philosophyLvl8_10: `
<div style="background:#262833;color:#f1f5f9;padding:12px 16px;border-radius:12px;margin-bottom:8px;">
<b>Лв.8-10+ <FaServer className="inline text-green-400" />/<FaRocket className="inline text-orange-400" /> (Полная Независимость)</b><br/>
🟢 <b>Слайдер автономии:</b> <span style="color:#22d3ee;">Ты — архитектор системы.</span><br/>
Разворачиваешь свой CyberVibe. Свои ключи, боты, XTR-ы. Ты контролируешь всю систему, а не только промпты. Ты управляешь своей AI-студией.
</div>
`,
    philosophyEnd: `
<div style="background:#18181b;color:#f1f5f9;padding:14px 18px;border-radius:16px;margin-top:18px;font-weight:bold;">
Каждый уровень — это новая отметка на твоём <b>слайдере автономии</b>. Ты начинаешь доверять агенту мелкие, проверяемые задачи. Потом — крупнее. В итоге вы — настоящие ко-пилоты в твоём костюме Железного Человека.<br/>
<b>Когда ты освоил шаг, предыдущий кажется тебе «для дебилов». Это и есть эволюция. Добро пожаловать, Нео.</b>
</div>
`,
    stepsTitle: "Краткий Гайд:",
    step1Title: "1. Хватай Репу / Укажи Желание:",
    step1Desc: "Введи GitHub URL -> Жми <FaDownload class='inline mx-1 text-purple-400 align-baseline'/> ИЛИ Видишь баг/идею -> Вызови Бадди <FaRobot class='inline mx-1 text-indigo-400 align-baseline'/> -> Опиши.",
    step1DescEnd: "Для картинок (Лв.1): Скопируй битый URL, вставь Бадди/в Инпут.",
    step2Title: "2. AI Магия & Отправка:",
    step2Desc: "Если нужно (Лв.2+), юзай <span class='text-blue-400 font-semibold'>\"🤖 Спросить AI\"</span> -> Проверь Ассистента <FaWandMagicSparkles class='inline mx-1 text-yellow-400 align-baseline'/> -> Жми <FaGithub class='inline mx-1 text-green-400 align-baseline'/> Кнопку PR.",
    step2DescEnd: "<strong>ГОТОВО.</strong> Сайт обновляется авто-магически.",
    readyButton: "ПОГНАЛИ, БЛ*ТЬ!",
    componentsTitle: "Врубай Движки Вайба!",
    ctaTitle: "Готов(а) Апнуться, {USERNAME}?",
    ctaDesc: "Серьезно. Хватит сомневаться. Начни <strong>ДЕЛАТЬ</strong>. Первый левел зовет. Качайся СЕЙЧАС!",
    ctaHotChick: "Есть искра? Давай замутим что-то эпичное. Пиши <strong>@SALAVEY13</strong> СЕЙЧАС!",
    ctaDude: "(Все остальные? Просто, бл*ть, попробуйте. Левел 1 - это клик мышки. У вас получится!)",
    navGrabber: "Граббер <FaDownload/>",
    navAssistant: "Ассистент <FaRobot/>",
    navOnboarding: "Велком <FaUserAstronaut/>",
    navIntro: "Интро <FaCircleInfo/>",
    navCyberVibe: "Петля Вайба <FaUpLong/>",
    collapseAll: "Свернуть Все Секции",
    expandAll: "Развернуть Все Секции",
  }
};
// --- End I18N ---

// --- Fallback component for AutomationBuddy ---
function LoadingBuddyFallback() {
    return ( <div className="fixed bottom-4 right-4 z-50 w-12 h-12 rounded-full bg-gradient-to-br from-purple-600 to-indigo-700 animate-pulse" aria-hidden="true" ></div> );
}

// --- getPlainText helper ---
const getPlainText = (htmlString: string | null | undefined): string => {
    if (typeof htmlString !== 'string' || !htmlString) { return ''; }
    try {
        let text = htmlString.replace(/<Fa[A-Z][a-zA-Z0-9]+(?:\s+[^>]*?)?\s*\/?>/g, ''); 
        text = text.replace(/::(Fa[A-Z][a-zA-Z0-9]+.*?)::/g, ''); 
        text = text.replace(/\[\?\]/g, '');
        text = text.replace(/\[ICON ERR!\]/g, '');
        text = text.replace(/<[^>]*>/g, ''); 
        return text.replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').trim();
    } catch (e) {
        console.error("[getPlainText] Error stripping HTML for title:", e, "Input:", htmlString);
        return htmlString.replace(/<[^>]*>/g, '').trim();
    }
};

// --- ActualPageContent Component ---
interface ActualPageContentProps {
  initialPath: string | null;
  initialIdea: string | null;
}
function ActualPageContent({ initialPath, initialIdea }: ActualPageContentProps) {
    const log = logger.log;
    const debug = logger.debug;
    const error = logger.error;

    log("[ActualPageContent] START Render - Top Level");

    const { user } = useAppContext();
    const pageContext = useRepoXmlPageContext();
    const { info: toastInfo, error: toastError } = useAppToast();

    const [lang, setLang] = useState<keyof typeof translations>('en');
    const [t, setT] = useState<typeof translations.en | null>(null);
    const [isPageLoading, setIsPageLoading] = useState<boolean>(true);
    
    // State for sections visibility
    const [isOnboardingVisible, setIsOnboardingVisible] = useState(false);
    const [isIntroVisible, setIsIntroVisible] = useState(true);
    const [isCyberVibeVisible, setIsCyberVibeVisible] = useState(true);
    const [isCommunityWisdomVisible, setIsCommunityWisdomVisible] = useState(true);
    const [isPhilosophyStepsVisible, setIsPhilosophyStepsVisible] = useState(true);
    const [isCtaVisible, setIsCtaVisible] = useState(true); 
    const [sectionsCollapsed, setSectionsCollapsed] = useState(false);

    if (!pageContext || typeof pageContext.addToast !== 'function') {
         error("[ActualPageContent] CRITICAL: RepoXmlPageContext is missing or invalid!");
         return <div className="text-red-500 p-4">Критическая ошибка: Контекст страницы не загружен.</div>;
    }

    const {
        fetcherRef, assistantRef, kworkInputRef,
        showComponents, setShowComponents,
    } = pageContext;

    useEffect(() => {
      debug("[Effect Lang] START");
      const browserLang = typeof navigator !== 'undefined' ? navigator.language.split('-')[0] : 'en';
      const userLang = user?.language_code;
      const resolvedLang: keyof typeof translations = userLang === 'ru' || (!userLang && browserLang === 'ru') ? 'ru' : 'en';
      setLang(resolvedLang);
      const newTranslations = translations[resolvedLang] ?? translations.en;
      setT(newTranslations);
      log(`[Effect Lang] Language set to: ${resolvedLang}. Translations loaded.`);
    }, [user]);

    useEffect(() => {
        log("[ActualPageContent Effect] Loading status check.");
        setIsPageLoading(!t);
        log(`[ActualPageContent Effect] Loading check: translations=${!!t}, resulting isPageLoading=${!t}`);
    }, [t]);

    const toggleAllSections = useCallback(() => {
        setSectionsCollapsed(prev => !prev);
    }, []);

    useEffect(() => {
        if (!t) return; // Don't run if translations are not loaded
        const newVisibility = !sectionsCollapsed;
        // Onboarding is handled by details/summary, not this global toggle
        setIsIntroVisible(newVisibility);
        setIsCyberVibeVisible(newVisibility);
        setIsCommunityWisdomVisible(newVisibility);
        setIsPhilosophyStepsVisible(newVisibility);
        setIsCtaVisible(newVisibility);
        log(`[Effect SectionsToggle] Info sections visibility set to: ${newVisibility}.`);
    }, [sectionsCollapsed, t]); 

    const memoizedGetPlainText = useCallback(getPlainText, []);
    const scrollToSectionNav = useCallback((id: string) => {
        debug(`[CB ScrollNav] Attempting scroll to: ${id}`);
        const sectionsRequiringReveal = ['extractor', 'executor', 'cybervibe-section', 'philosophy-steps', 'community-wisdom-section'];
        const targetElement = document.getElementById(id);
        const headerOffset = 80; 

        const scroll = (element: HTMLElement) => {
             try {
                if (id === 'onboarding' && element.tagName === 'DETAILS' && !element.hasAttribute('open')) {
                    element.setAttribute('open', '');
                }
                const elementTop = element.getBoundingClientRect().top + window.scrollY;
                const offsetTop = elementTop - headerOffset;
                window.scrollTo({ top: offsetTop, behavior: 'smooth' });
                log(`[CB ScrollNav] Scrolled to "${id}" at offsetTop: ${offsetTop}`);
            } catch (e) {
                error(`[CB ScrollNav] Error scrolling to "${id}":`, e);
            }
        };

        if (sectionsRequiringReveal.includes(id) && !showComponents) {
            log(`[CB ScrollNav] Revealing components for "${id}"`);
            setShowComponents(true);
            setIsCtaVisible(true); // Ensure CTA is visible when components are shown for the first time
            requestAnimationFrame(() => {
                const el = document.getElementById(id);
                if (el) {
                    scroll(el);
                } else {
                    error(`[CB ScrollNav] Target "${id}" not found after reveal and animation frame.`);
                }
            });
        } else if (targetElement) {
            scroll(targetElement);
        } else {
            error(`[CB ScrollNav] Target element "${id}" not found.`);
        }
    }, [showComponents, setShowComponents, log, debug, error]);

    const handleShowComponents = useCallback(() => {
        log("[Button Click] handleShowComponents (Reveal)");
        setShowComponents(true);
        if (sectionsCollapsed) { // If user had previously collapsed all, expand them when showing components
            setSectionsCollapsed(false);
        }
        toastInfo("Компоненты загружены!", { duration: 1500 });
        setTimeout(() => scrollToSectionNav('extractor'), 100);
    }, [setShowComponents, toastInfo, log, scrollToSectionNav, sectionsCollapsed]);

     if (isPageLoading) {
         log(`[Render] ActualPageContent: Rendering Loading State (Waiting for translations)`);
         const loadingLang = typeof navigator !== 'undefined' && navigator.language.startsWith('ru') ? 'ru' : 'en';
         const loadingText = translations[loadingLang]?.loading ?? translations.en.loading;
         return ( <div className="flex justify-center items-center min-h-screen pt-20 bg-dark-bg"> <FaSpinner className="text-brand-green animate-spin text-3xl mr-4" /> <p className="text-brand-green animate-pulse text-xl font-mono">{loadingText}</p> </div> );
     }
     if (!t) {
         error("[Render] ActualPageContent: Critical - translations (t) are null after loading.");
         return <div className="text-red-500 p-4">Критическая ошибка: Не удалось загрузить тексты страницы.</div>;
     }

    const userName = user?.first_name || 'Vibe Master';
    const navTitleOnboarding = memoizedGetPlainText(t.navOnboarding);
    const navTitleIntro = memoizedGetPlainText(t.navIntro);
    const navTitleVibeLoop = memoizedGetPlainText(t.navCyberVibe);
    const navTitleGrabber = memoizedGetPlainText(t.navGrabber);
    const navTitleAssistant = memoizedGetPlainText(t.navAssistant);
    const masterToggleTitle = sectionsCollapsed ? t.expandAll : t.collapseAll;

    const CloseButton = ({ onClick, ariaLabel }: { onClick: () => void; ariaLabel: string }) => (
        <button
            onClick={onClick}
            className="absolute top-2 right-2 text-slate-400 hover:text-white z-20 p-1 rounded-full hover:bg-black/30 transition-colors"
            aria-label={ariaLabel}
        >
            <FaCircleXmark className="w-5 h-5" />
        </button>
    );

    log("[ActualPageContent] Preparing to render JSX...");

    try {
       return (
            <>
                <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
                <div className="min-h-screen bg-dark-bg p-4 sm:p-6 pt-24 text-light-text flex flex-col items-center relative overflow-x-hidden">
                    
                    <motion.img
                        src={XUINITY_EMBLEM}
                        alt="CyberVibe Mascot"
                        className="fixed top-0 right-0 h-screen w-auto object-contain pointer-events-none"
                        style={{ transform: 'translateX(50%)' }}
                        initial={{ x: "100%", opacity: 0 }}
                        animate={{ x: "50%", opacity: 0.15 }}
                        transition={{ duration: 1.5, ease: "circOut" }}
                    />

                    <button
                        onClick={toggleAllSections}
                        className="fixed top-20 left-4 sm:left-6 text-slate-300 hover:text-white z-50 p-2 rounded-full bg-dark-card/70 hover:bg-dark-card/90 backdrop-blur-sm shadow-lg border border-slate-700 hover:border-slate-500 transition-all"
                        title={masterToggleTitle}
                        aria-label={masterToggleTitle}
                    >
                        {sectionsCollapsed ? <FaAnglesUp className="w-5 h-5" /> : <FaAnglesDown className="w-5 h-5" />}
                    </button>

                    <details id="onboarding" className="w-full max-w-3xl mb-10 transition-all duration-300 ease-in-out group" onToggle={(e) => setIsOnboardingVisible((e.target as HTMLDetailsElement).open)}>
                        <summary className="text-xl font-bold text-fuchsia-400 p-4 cursor-pointer list-none flex justify-between items-center bg-dark-card/80 border border-fuchsia-700/50 rounded-lg shadow-lg backdrop-blur-sm hover:bg-fuchsia-900/50 group-open:rounded-b-none">
                            <VibeContentRenderer content={t.title} />
                            <span className="text-xs text-gray-400 group-open:rotate-180 transition-transform duration-300">▼</span>
                        </summary>
                        <LangOnboardingBlock lang={lang} />
                    </details>
                    

                    {isIntroVisible && (
                        <section id="intro" className="mb-12 text-center max-w-3xl w-full relative">
                            <CloseButton onClick={() => setIsIntroVisible(false)} ariaLabel="Close Intro Section" />
                            <div className="flex justify-center mb-4"> <FaBolt className="w-16 h-16 text-brand-yellow text-shadow-[0_0_15px_hsl(var(--brand-yellow))] animate-pulse" /> </div>
                            <h1 className="text-4xl md:text-5xl font-orbitron font-bold text-brand-yellow text-shadow-[0_0_10px_hsl(var(--brand-yellow))] mb-4">
                               <VibeContentRenderer content={t.pageTitle} />
                            </h1>
                            <p className="text-xl md:text-2xl text-light-text mt-4 font-semibold">
                               <VibeContentRenderer content={t.welcome} /> <span className="text-brand-cyan">{userName}!</span>
                            </p>
                            <div className="text-lg md:text-xl text-muted-foreground mt-3 space-y-3 prose prose-invert prose-p:my-2 prose-strong:text-brand-yellow prose-em:text-brand-purple prose-a:text-brand-blue max-w-none">
                                <VibeContentRenderer content={t.intro1} />
                                <VibeContentRenderer content={t.intro2} />
                                <div className="font-semibold text-brand-green"><VibeContentRenderer content={t.intro3} /></div>
                            </div>
                        </section>
                    )}

                    {isCyberVibeVisible && (
                        <section id="cybervibe-section" className="mb-12 w-full max-w-3xl relative">
                            <CloseButton onClick={() => setIsCyberVibeVisible(false)} ariaLabel="Close Vibe Loop Section" />
                            <Card className="bg-gradient-to-br from-purple-900/40 via-black/60 to-indigo-900/40 border border-purple-600/60 shadow-xl rounded-lg p-6 backdrop-blur-sm bg-dark-card/80">
                                 <CardHeader className="p-0 mb-4">
                                     <CardTitle className="text-2xl md:text-3xl font-bold text-center text-brand-purple flex items-center justify-center gap-2">
                                        <FaAtom className="animate-spin-slow"/> <VibeContentRenderer content={t.cyberVibeTitle} /> <FaBrain className="animate-pulse"/>
                                    </CardTitle>
                                 </CardHeader>
                                 <CardContent className="p-0 text-muted-foreground text-base md:text-lg space-y-3 prose prose-invert prose-p:my-2 prose-strong:text-brand-purple prose-em:text-brand-cyan prose-a:text-brand-blue max-w-none">
                                    <VibeContentRenderer content={t.cyberVibe1} />
                                    <VibeContentRenderer content={t.cyberVibe2} />
                                    <VibeContentRenderer content={t.cyberVibe3} />
                                    <div className="text-purple-300 font-semibold"><VibeContentRenderer content={t.cyberVibe4} /></div>
                                 </CardContent>
                             </Card>
                         </section>
                     )}
                    
                    {isCommunityWisdomVisible && (
                        <section id="community-wisdom-section" className="mb-12 w-full max-w-3xl relative">
                            <CloseButton onClick={() => setIsCommunityWisdomVisible(false)} ariaLabel="Close Community Wisdom Section" />
                            <h3 className="text-2xl md:text-3xl font-orbitron text-brand-cyan mb-6 text-center flex items-center justify-center gap-2">
                               <VibeContentRenderer content={t.communityWisdomTitle} />
                            </h3>
                            <div className="space-y-8">
                                {[
                                    { videoId: "ctcMA6chfDY", start: 1261, title: "YouTube: Sam Altman's Dream", quote: t.quote1, borderColor: "border-brand-cyan", inspiredBy: "- Inspired by Sam Altman" },
                                    { videoId: "dq8MhTFCs80", start: 1197, title: "YouTube: Do you Vibecode?", quote: t.quote2, borderColor: "border-brand-pink", inspiredBy: "- Inspired by Vibe Master" },
                                    { videoId: "xlQB_0Nzoog", start: 743, title: "YouTube: Really F*cking EZ!", quote: t.quote3, borderColor: "border-brand-yellow", inspiredBy: "- Inspired by Strategic Thinking" }
                                ].map(item => (
                                    <div key={item.videoId}>
                                        <div className={`aspect-video w-full rounded-lg overflow-hidden border-2 ${item.borderColor}/50 shadow-lg`}>
                                            <iframe className="w-full h-full" src={`https://www.youtube.com/embed/${item.videoId}?start=${item.start}`} title={item.title} allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen></iframe>
                                        </div>
                                        <div className={`mt-3 p-3 bg-dark-card/70 border-l-4 ${item.borderColor} rounded-r-md text-muted-foreground max-w-none`}>
                                            <div className="flex items-start">
                                                <VibeContentRenderer content="::FaQuoteLeft className='text-current opacity-70 text-lg mr-2 shrink-0'::" />
                                                <div className="prose prose-sm prose-invert max-w-none flex-grow">
                                                    <VibeContentRenderer content={item.quote} />
                                                </div>
                                                <VibeContentRenderer content="::FaQuoteRight className='text-current opacity-70 text-lg mr-2 shrink-0'::" />
                                            </div>
                                            <p className="text-xs text-right opacity-70 mt-1">{item.inspiredBy}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {isPhilosophyStepsVisible && (
                        <section id="philosophy-steps" className="mb-12 w-full max-w-3xl relative">
                            <CloseButton onClick={() => setIsPhilosophyStepsVisible(false)} ariaLabel="Close Philosophy/Steps Section" />
                            <details className="bg-dark-card/80 border border-border rounded-lg shadow-md backdrop-blur-sm transition-all duration-300 ease-in-out open:pb-4 open:shadow-lg open:border-indigo-500/50" open={!sectionsCollapsed}>
                                <summary className="text-xl md:text-2xl font-semibold text-brand-green p-4 cursor-pointer list-none flex justify-between items-center hover:bg-card/50 rounded-t-lg transition-colors group">
                                    <span className="flex items-center gap-2"><FaCodeBranch /> <VibeContentRenderer content={t.philosophyTitle} /></span>
                                    <span className="text-xs text-gray-500 group-open:rotate-180 transition-transform duration-300">▼</span>
                                </summary>
                                <div className="px-6 pt-2 text-muted-foreground space-y-4 text-base prose prose-invert prose-p:my-2 prose-li:my-1 prose-strong:text-brand-yellow prose-em:text-brand-cyan prose-a:text-brand-blue max-w-none">
                                     <div className="my-4 not-prose">
                                         <h4 className="text-lg font-semibold text-brand-cyan mb-2"><VibeContentRenderer content={t.philosophyVideoTitle} /></h4>
                                         <div className="aspect-video w-full rounded-lg overflow-hidden border border-cyan-700/50 shadow-lg">
                                             <iframe className="w-full h-full" src="https://www.youtube.com/embed/imxzYWYKCyQ" title="YouTube video player - Vibe Level Explanation by Salavey13" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen></iframe>
                                         </div>
                                     </div>
                                    <hr className="border-border my-3"/>
                                     <div className="p-4 bg-gradient-to-tr from-purple-900/50 to-indigo-900/40 rounded-lg border border-purple-500/30 shadow-inner">
                                        <VibeContentRenderer content={t.philosophyCore} />
                                     </div>
                                     <hr className="border-border my-3"/>
                                    <h4 className="text-lg font-semibold text-brand-cyan pt-1">Level Progression (Your Autonomy Slider):</h4>
                                    <div className="list-none space-y-2 p-0 text-sm md:text-base not-prose">
                                        {[t.philosophyLvl0_1, t.philosophyLvl1_2, t.philosophyLvl2_3, t.philosophyLvl3_4, t.philosophyLvl4_5, t.philosophyLvl5_6, t.philosophyLvl6_7, t.philosophyLvl8_10].map((levelContent, index) => (
                                            <div key={`std-lvl-${index}`}><VibeContentRenderer content={levelContent} /></div>
                                        ))}
                                    </div>
                                    <hr className="border-border my-3"/>
                                    <div className="not-prose"><VibeContentRenderer content={t.philosophyEnd} /></div>
                                    <hr className="border-border my-4"/>
                                    <h4 className="text-lg font-semibold text-brand-cyan pt-2"><VibeContentRenderer content={t.stepsTitle} /></h4>
                                    <ol className="list-decimal list-inside text-sm space-y-1">
                                         <li><VibeContentRenderer content={"Настрой <FaCodeBranch title='Настройки' class='inline text-cyan-400'/>"} /></li>
                                         <li><VibeContentRenderer content={"Жми <span class='font-bold text-purple-400 mx-1'>\"Извлечь файлы\"</span>"} /></li>
                                         <li><VibeContentRenderer content={"Выбери файлы или <span class='font-bold text-teal-400 mx-1'>связанные</span> / <span class='font-bold text-orange-400 mx-1'>важные</span>"} /></li>
                                         <li><VibeContentRenderer content={"Опиши задачу ИЛИ добавь файлы <FaPlus title='Добавить выбранные в запрос' class='inline text-sm'/> / все <FaTree title='Добавить все файлы в запрос' class='inline text-sm'/>"} /></li>
                                         <li><VibeContentRenderer content={"Скопируй <FaCopy title='Скопировать запрос' class='inline text-sm mx-px'/> или передай дальше"} /></li>
                                    </ol>
                                </div>
                            </details>
                        </section>
                    )}

                    {!showComponents && (
                        <section id="reveal-trigger" className="mb-12 w-full max-w-3xl text-center">
                            <Button onClick={handleShowComponents} className="bg-gradient-to-r from-brand-green via-brand-cyan to-brand-purple text-black font-bold py-3 px-8 rounded-full text-lg shadow-lg hover:scale-105 transform transition duration-300 animate-bounce hover:animate-none ring-2 ring-offset-2 ring-offset-dark-bg ring-transparent hover:ring-brand-cyan" size="lg">
                                <FaHandSparkles className="mr-2"/> <VibeContentRenderer content={t.readyButton} />
                            </Button>
                        </section>
                    )}

                    {showComponents && ( // Core components are always shown if showComponents is true
                         <>
                            <h2 className="text-3xl font-bold text-center text-brand-green mb-8 animate-pulse"><VibeContentRenderer content={t.componentsTitle} /></h2>
                             <section id="extractor" className="mb-12 w-full max-w-4xl">
                                 <Card className="bg-dark-card/80 border border-blue-700/50 shadow-lg backdrop-blur-sm">
                                     <CardContent className="p-4">
                                         <RepoTxtFetcher
                                             ref={fetcherRef}
                                             highlightedPathProp={initialPath}
                                             ideaProp={initialIdea}
                                         />
                                     </CardContent>
                                 </Card>
                             </section>

                             <section id="executor" className="mb-12 w-full max-w-4xl pb-16">
                                 <Card className="bg-dark-card/80 border border-purple-700/50 shadow-lg backdrop-blur-sm">
                                     <CardContent className="p-4">
                                         <AICodeAssistant ref={assistantRef} kworkInputRefPassed={kworkInputRef} aiResponseInputRefPassed={pageContext.aiResponseInputRef} />
                                     </CardContent>
                                 </Card>
                             </section>
                         </>
                     )}

                    {isCtaVisible && ( 
                        <section id="cta-final" className="w-full max-w-3xl mt-4 mb-12 text-center">
                            {/* Outer Border Div */}
                            <div className="relative p-1.5 rounded-xl bg-gradient-to-b from-blue-800 to-purple-700 shadow-2xl">
                                {/* Middle Border Div */}
                                <div className="p-1 rounded-lg bg-gradient-to-b from-orange-400 via-pink-400 to-purple-700">
                                    {/* Content Div */}
                                    <div className="relative bg-gradient-to-b from-indigo-600 via-pink-600 to-orange-500 p-6 rounded-md prose-strong:text-yellow-200 prose-a:text-brand-blue max-w-none">
                                        <button 
                                            onClick={() => setIsCtaVisible(false)} 
                                            className="absolute top-2 right-2 text-white/70 hover:text-white z-20 p-1 rounded-full hover:bg-black/50 transition-colors"
                                            aria-label="Close CTA"
                                        >
                                            <FaCircleXmark className="w-6 h-6" />
                                        </button>
                                        <h3 className="text-2xl font-bold text-white mb-3 prose-invert"><VibeContentRenderer content={t?.ctaTitle?.replace('{USERNAME}', userName) ?? ''} /></h3>
                                        <div className="text-white text-lg mb-4 prose-invert"> <VibeContentRenderer content={t.ctaDesc} /> </div>
                                        
                                        <div className="aspect-video w-full rounded-lg overflow-hidden border-2 border-orange-500/70 shadow-lg my-6">
                                            <iframe className="w-full h-full" src={`https://www.youtube.com/embed/qCkPM_f3V5c?autoplay=1&mute=0`} title="YouTube: GTA Vibe" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen></iframe>
                                        </div>
                                        
                                        <div className="mt-3 mb-4 p-3 bg-black/50 border-l-4 border-pink-500 rounded-r-md text-white max-w-none">
                                            <div className="flex items-center">
                                                <VibeContentRenderer content="::FaQuoteLeft className='text-current opacity-80 text-xl mr-2 shrink-0'::" />
                                                <div className="prose prose-sm prose-invert text-center flex-grow max-w-none">
                                                    <VibeContentRenderer content={t.ctaHotChickQuote} />
                                                </div>
                                                <VibeContentRenderer content="::FaQuoteRight className='text-current opacity-80 text-xl ml-2 shrink-0'::" />
                                            </div>
                                            <p className="text-xs text-right opacity-70 mt-1">- Vibe by @SALAVEY13</p>
                                        </div>

                                        
                                        <div className="text-slate-300 text-base prose-invert"> <VibeContentRenderer content={t.ctaDude} /> </div>
                                    </div>
                                </div>
                            </div>
                        </section>
                    )}

                     <motion.nav className="fixed right-2 sm:right-3 top-1/2 transform -translate-y-1/2 flex flex-col space-y-3 z-40" animate={{ scale: [1, 1.03, 1] }} transition={{ duration: 2.0, repeat: Infinity, repeatType: 'reverse', ease: "easeInOut" }}>
                         {isOnboardingVisible && <button onClick={() => scrollToSectionNav("onboarding")} className="p-2 bg-fuchsia-600/80 backdrop-blur-sm rounded-full hover:bg-fuchsia-600/70 transition shadow-md" title={navTitleOnboarding} aria-label={navTitleOnboarding || "Scroll to Welcome"} > <FaUserAstronaut className="text-lg text-white" /> </button>}
                         {isIntroVisible && <button onClick={() => scrollToSectionNav("intro")} className="p-2 bg-muted/80 backdrop-blur-sm rounded-full hover:bg-muted/60 transition shadow-md" title={navTitleIntro} aria-label={navTitleIntro || "Scroll to Intro"} > <FaCircleInfo className="text-lg text-foreground/80" /> </button>}
                         {isCyberVibeVisible && <button onClick={() => scrollToSectionNav("cybervibe-section")} className="p-2 bg-brand-purple/80 backdrop-blur-sm rounded-full hover:bg-brand-purple/70 transition shadow-md" title={navTitleVibeLoop} aria-label={navTitleVibeLoop || "Scroll to Vibe Loop"} > <FaUpLong className="text-lg text-white" /> </button>}
                         {showComponents && ( /* Navigation for components is always available if showComponents is true, regardless of sectionsCollapsed */
                            <>
                                <button onClick={() => scrollToSectionNav("extractor")} className="p-2 bg-brand-blue/80 backdrop-blur-sm rounded-full hover:bg-brand-blue/70 transition shadow-md" title={navTitleGrabber} aria-label={navTitleGrabber || "Scroll to Grabber"} > <FaDownload className="text-lg text-white" /> </button>
                                <button onClick={() => scrollToSectionNav("executor")} className="p-2 bg-brand-cyan/80 backdrop-blur-sm rounded-full hover:bg-brand-cyan/70 transition shadow-md" title={navTitleAssistant} aria-label={navTitleAssistant || "Scroll to Assistant"} > <FaRobot className="text-lg text-white" /> </button>
                            </> 
                         )}
                    </motion.nav>

                    <Suspense fallback={<LoadingBuddyFallback />}>
                        <AutomationBuddy />
                    </Suspense>
                </div>
            </>
       );
    } catch (renderError: any) {
         error("[ActualPageContent] CRITICAL RENDER ERROR in return JSX:", renderError);
         return <div className="text-red-500 p-4">Критическая ошибка рендеринга страницы: {renderError.message}</div>;
    } finally {
        log("[ActualPageContent] END Render");
    }
}

function RepoXmlPageInternalContent() {
  const searchParams = useSearchParams();
  const path = searchParams.get('path');
  const idea = searchParams.get('idea');
  logger.log(`[RepoXmlPageInternalContent] Extracted from URL - path: ${path}, idea: ${idea ? idea.substring(0,30)+'...' : null}`);
  return <ActualPageContent initialPath={path} initialIdea={idea} />;
}

function RepoXmlPageLayout() {
    const log = logger.log;
    const error = logger.error;

    log("[RepoXmlPageLayout] START Render");
    try {
      return (
           <RepoXmlPageProvider>
               <RepoXmlPageInternalContent />
           </RepoXmlPageProvider>
       );
    } catch (layoutError: any) {
      error("[RepoXmlPageLayout] CRITICAL RENDER ERROR:", layoutError);
      return <div className="text-red-500 p-4">Критическая ошибка в слое разметки: {layoutError.message}</div>;
    } finally {
       log("[RepoXmlPageLayout] END Render");
    }
}

export default function RepoXmlPage() {
     const log = logger.log;
     const error = logger.error;

     log("[RepoXmlPage] START Render (Exported Component)");
    const fallbackLoadingLang = typeof navigator !== 'undefined' && navigator.language.startsWith('ru') ? 'ru' : 'en';
    const fallbackLoadingText = translations[fallbackLoadingLang]?.loading ?? translations.en.loading;
    const fallbackLoading = ( <div className="flex justify-center items-center min-h-screen pt-20 bg-dark-bg"> <FaSpinner className="text-brand-green animate-spin text-3xl mr-4" /> <p className="text-brand-green animate-pulse text-xl font-mono">{fallbackLoadingText}</p> </div> );

    try {
        return (
            <Suspense fallback={fallbackLoading}>
                <RepoXmlPageLayout />
            </Suspense>
        );
    } catch (pageError: any) {
         error("[RepoXmlPage] CRITICAL RENDER ERROR:", pageError);
         return <div className="text-red-500 p-4">Критическая ошибка рендеринга компонента страницы: {pageError.message}</div>;
    } finally {
        log("[RepoXmlPage] END Render (Exported Component)");
    }
}