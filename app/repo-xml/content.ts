/**
 * @file The content repository and Vibe manifest for the SUPERVIBE STUDIO.
 * This is the single source of truth for all user-facing text and philosophical tenets.
 * Last Overhauled By: The Architect
 */

export const CYBERWTF_BADGE_URL = "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/IMG_20250623_004400_844-152720e6-ad84-48d1-b4e7-e0f238b7442b.png";
export const XUINITY_EMBLEM_URL = "https://github.com/user-attachments/assets/910a623e-1c9d-4630-a8b4-7c361565dc97";

// --- Onboarding Content ---
export const onboardingContent = {
  en: {
    title: "🧬 Welcome to CYBERVIBE STUDIO /repo-xml 🧬",
    intro: `If you’re reading this, you’re not lost. You’re exactly where the next level starts.\nThis is not a regular dev page. This is your portal to the SUPERVIBE ENGINE:\n- AI-powered\n- Gamified\n- 100% WTF\n- Built for devs, dreamers, and reality remixers`,
    tldr: [
      "<strong>Scroll.</strong> Let your brain catch up—yes, it’s a lot.",
      "<strong>Click “Extract Files”.</strong> Instantly fetch source code to remix, patch, or build on.",
      "<strong>Drop your AI request or idea.</strong> Use the text box. Think: “Add dark mode”, “Fix this error”, “Make it cyberpunk”.",
      "<strong>AI + YOU = PR</strong> The bot will generate code, explain it, and let you instantly create a PR—no local setup, no git voodoo.",
      "<strong>Level Up.</strong> Every action unlocks perks, quests, and new features (tracked in your CyberFitness profile). See your progress, unlock achievements, and flex with the VIBE TRIBE."
    ],
    whatisit: `/repo-xml = AI-powered remix lab for this project.\nSUPERVIBE ENGINE: Recursive workflow: Extract context → Feed to AI → Build, patch, merge → Repeat\nNo install, no gatekeeping, just instant hacking and learning.`,
    youare: `You’re not just using a tool.  \nYou’re co-piloting an AI-powered, cyberpunk, recursive dev studio.  \nYou’re not asking “how do I code this?”  \nYou’re asking “how do I LEVEL UP?”`,
    levelsTitle: "🏆 BADGES, LEVELS, & QUESTS",
    levels: `- Every PR, code fetch, or AI action = progress\n- Quests like “Fix a broken image”, “Ship an idea”, “Remix the matrix”, “Inception Swap”\n- Your CyberFitness Profile evolves: Level up, unlock perks, collect badges, and see your “Cognitive OS Version” change as you grow.`,
    faq: [
      { q: "Why does this look like a game?", a: "Because learning, shipping, and leveling up should feel like one." },
      { q: "Why is there a DNA helix and neon everywhere?", a: "Because you’re hacking the code of your DEV DNA—and it should look awesome." },
      { q: "Why is this better than a regular code editor?", a: "No setup, no fear, no gatekeeping. Just create, remix, and WIN." },
      { q: "What if I break something?", a: "You can’t. Everything is sandboxed, safe, and tracked. Every PR is reviewed before merging." },
      { q: `"I still don’t get it."`, a: "Scroll back up. Click something. You’ll get it once you vibe." },
    ],
    tribe: [
      { label: "CYBERVIBE Sandbox (this page)", url: "/repo-xml" },
      { label: "Telegram entrypoint", url: "https://t.me/oneSitePlsBot" },
      { label: "CYBERFITNESS Engine (Gamified)", url: "https://t.me/oneSitePlsBot/app" },
      { label: "Full achievement history, perks, and code", url: "https://github.com/salavey13/carTest/blob/main/hooks/cyberFitnessSupabase.ts" },
    ],
    ready: "Ready? Let’s f*cking go. Welcome to CYBERVIBE."
  },
  ru: {
    title: "🧬 Добро пожаловать в CYBERVIBE STUDIO /repo-xml 🧬",
    intro: `Если ты это читаешь – ты не потерялся. Ты именно там, где начинается следующий уровень.\nЭто не обычная страница для разработчиков. Это твой портал в SUPERVIBE ENGINE:\n- ИИ внутри\n- Геймифицировано\n- 100% WTF\n- Для кодеров, мечтателей и всех, кто хочет создавать без барьеров`,
    tldr: [
      "<strong>Прокрути вниз.</strong> Пусть мозг привыкнет – да, тут много нового.",
      "<strong>Жми “Извлечь файлы”.</strong> Мгновенно получи исходники этого репозитория для экспериментов, фиксов и апгрейдов.",
      "<strong>Опиши свою идею или вопрос для ИИ.</strong> Просто напиши: “Добавь темную тему”, “Исправь ошибку”, “Сделай по-киберпанковски”.",
      "<strong>ИИ + ТЫ = PR</strong> Бот сгенерирует код, объяснит, и даст сразу создать Pull Request — без локальной сборки, без гита-колдунства.",
      "<strong>Прокачка!</strong> Любое действие открывает новые перки, квесты и фичи (всё записывается в твой профиль CyberFitness). Следи за прогрессом, собирай ачивки, и становись частью VIBE TRIBE."
    ],
    whatisit: `/repo-xml = лаборатория ремиксов на базе ИИ для этого проекта.\nSUPERVIBE ENGINE: Рекурсивный воркфлоу: Извлекай контекст → Кидай в ИИ → Собирай, чини, мержи → Повтори\nБез установки, без барьеров, мгновенный старт и обучение.`,
    youare: `Ты не просто пользуешься тулзой.  \nТы ко-пилотируешь ИИ-киберпанк студию, где каждое действие — новый левел.  \nТут не спрашивают “как это закодить”,  \nтут спрашивают “как ПРОКАЧАТЬСЯ?”`,
    levelsTitle: "🏆 АЧИВКИ, УРОВНИ И КВЕСТЫ",
    levels: `- Любой PR, файл или запрос к ИИ = прогресс\n- Квесты: “Почини картинку”, “Запусти идею”, “Ремиксуй матрицу”, “Inception Swap” и другие\n- Твой CyberFitness профиль растет: Новый уровень, перки, ачивки, и “Cognitive OS Version” — как у персонажа.`,
    faq: [
      { q: "Почему это похоже на игру?", a: "Потому что учиться, пилить и прокачиваться — должно быть весело." },
      { q: "Зачем ДНК и неон?", a: "Ты реально меняешь свой кодовый ДНК, и пусть это будет красиво." },
      { q: "Это лучше обычного редактора?", a: "Да — не нужно ничего ставить, бояться и разбираться. Просто создавай, ремиксуй и выигрывай." },
      { q: "А если я что-то сломаю?", a: "Не бойся — всё работает в песочнице, ничего не сломать. Каждый PR проходит ревью." },
      { q: "Всё равно не понял(а)!", a: "Пролистай вверх. Кликни. Попробуй. Ты поймешь, когда начнешь вайбить." },
    ],
    tribe: [
      { label: "CYBERVIBE Sandbox (эта страница)", url: "/repo-xml" },
      { label: "Вход в Telegram", url: "https://t.me/oneSitePlsBot" },
      { label: "CYBERFITNESS Engine (Геймифицировано)", url: "https://t.me/oneSitePlsBot/app" },
      { label: "Вся история ачивок, перков и кода", url: "https://github.com/salavey13/carTest/blob/main/hooks/cyberFitnessSupabase.ts" },
    ],
    ready: "Готов(а)? Погнали! Добро пожаловать в CYBERVIBE."
  }
};

// --- Core Page Translations ---
export const translations = {
  en: {
    loading: "Booting SUPERVIBE ENGINE...",
    pageTitle: "SUPERVIBE STUDIO 2.0",
    philosophyTitle: "Your Vibe Path: The Autonomy Slider (Karpathy + Salavey13)",
    philosophyCore: `<strong>The Goal (inspired by Andrej Karpathy): Build an Iron Man suit, not just an autonomous robot.</strong><br/>You are Tony Stark. The AI is your suit. You are always in the loop, augmented, and in control.<br/>Your core task is to make the <strong>Generation-Verification loop</strong> as fast as possible. The AI generates, but you, the human, are the verifier. A good GUI (like visual diffs) is crucial because it uses your brain's "vision GPU" to make verification instant.<br/><b>To go fast, we keep the AI on a leash.</b> Small, incremental, auditable changes are better than a 10,000-line PR you can't review.`,
    philosophyLvl0_1: `<div class="bg-[#18181b] text-[#f1f5f9] p-3 rounded-xl mb-2"><b>Lv.0 → 1 <VibeContentRenderer content="::FaBolt::" /> (Full Auto, "One-Click Fix")</b><br/>🟢 <b>Autonomy Slider:</b> <span class="text-cyan-400">100% agent</span> → <span class="text-gray-500">0% human</span><br/>Fix a broken image. Paste link → Upload replacement. <b>PR is auto-created.</b> You simply review the final result and merge. The agent handles everything.</div>`,
    philosophyLvl1_2: `<div class="bg-[#262833] text-[#f1f5f9] p-3 rounded-xl mb-2"><b>Lv.1 → 2 <VibeContentRenderer content="::FaToolbox::" /> (Prompt+File)</b><br/>🟢 <b>Autonomy Slider:</b> <span class="text-cyan-400">80% agent</span> → <span class="text-gray-500">20% human</span><br/>Describe a tiny change (text/button) + pick 1 file. You say it, AI does it. You verify the diff.</div>`,
    philosophyLvl2_3: `<div class="bg-[#18181b] text-[#f1f5f9] p-3 rounded-xl mb-2"><b>Lv.2 → 3 <VibeContentRenderer content="::FaCode::" /> (Multi-File, "Orchestra")</b><br/>🟢 <b>Autonomy Slider:</b> <span class="text-cyan-400">60% agent</span> → <span class="text-gray-500">40% human</span><br/>Bigger refactor? Select 2-5 files, describe the change. You provide more context and verification becomes crucial. You are the orchestrator.</div>`,
    philosophyLvl3_4: `<div class="bg-[#262833] text-[#f1f5f9] p-3 rounded-xl mb-2"><b>Lv.3 → 4 <VibeContentRenderer content="::FaBug::" /> (Debug/Logs)</b><br/>🟢 <b>Autonomy Slider:</b> <span class="text-cyan-400">50% agent</span> → <span class="text-gray-500">50% human</span><br/>Build fails? Copy the error/log, feed it with code to the AI. This is a true partnership. You provide the problem, AI suggests a fix, you approve.</div>`,
    philosophyLvl4_5: `<div class="bg-[#18181b] text-[#f1f5f9] p-3 rounded-xl mb-2"><b>Lv.4 → 5 <VibeContentRenderer content="::FaLink::" /> (Proactive / Icon Hunt)</b><br/>🟢 <b>Autonomy Slider:</b> <span class="text-cyan-400">40% agent</span> → <span class="text-gray-500">60% human</span><br/>You're now leading. You teach the agent new tricks: find icons, fix warnings proactively. You're not just reacting, you're guiding the system's evolution.</div>`,
    philosophyLvl5_6: `<div class="bg-[#262833] text-[#f1f5f9] p-3 rounded-xl mb-2"><b>Lv.5 → 6 <VibeContentRenderer content="::FaMicrophone::" />/<VibeContentRenderer content="::FaVideo::" /> (Multimodal)</b><br/>🟢 <b>Autonomy Slider:</b> <span class="text-cyan-400">Variable</span>. You choose the input method that's fastest for you. You're in full command.</div>`,
    philosophyLvl6_7: `<div class="bg-[#18181b] text-[#f1f5f9] p-3 rounded-xl mb-2"><b>Lv.6 → 7 <VibeContentRenderer content="::FaDatabase::" /> (Data/SQL)</b><br/>🟢 <b>Autonomy Slider:</b> <span class="text-cyan-400">50% agent</span> → <span class="text-gray-500">50% human</span><br/>Let AI generate SQL. The agent proposes, but only you, the master of the data, approve the merge. High stakes, high trust.</div>`,
    philosophyLvl8_10: `<div class="bg-[#262833] text-[#f1f5f9] p-3 rounded-xl mb-2"><b>Lv.8-10+ <VibeContentRenderer content="::FaServer::" />/<VibeContentRenderer content="::FaRocket::" /> (Independence)</b><br/>🟢 <b>Autonomy Slider:</b> <span class="text-cyan-400">You are the system architect.</span><br/>Deploy your own CyberVibe. Plug in your own keys, bots, and XTRs. You now control the entire system.</div>`,
    philosophyEnd: `<div class="bg-card text-card-foreground p-4 rounded-xl mt-4 font-bold border border-brand-green/50">Every level is a new notch on your <b>autonomy slider</b>. You start by trusting the agent with small, verifiable tasks, then bigger ones. Eventually, you and the agent are true co-pilots in your Iron Man suit.<br/><b>The future isn't "full auto"—it's <span class="text-brand-green">human + agent, in a fast, verifiable loop. Always learning. Always leveling up.</span></b></div>`,
  },
  ru: {
    loading: "Запуск SUPERVIBE ДВИЖКА...",
    pageTitle: "SUPERVIBE СТУДИЯ 2.0",
    philosophyTitle: "Твой Путь Вайба: Слайдер Автономии (Karpathy + Salavey13)",
    philosophyCore: `<strong>Цель (по Карпати): Построить костюм Железного Человека, а не автономного робота.</strong><br/>Ты — Тони Старк. AI — твой костюм. Ты всегда в центре, усилен и всё контролируешь.<br/>Твоя главная задача — ускорить цикл <strong>«Генерация → Верификация»</strong>. AI предлагает, но проверяешь ТЫ. Хороший GUI (визуальный дифф) решает, потому что он использует «GPU для зрения» в твоей голове и делает проверку мгновенной.<br/><b>Чтобы двигаться быстро, мы держим AI на коротком поводке.</b> Маленькие, понятные, проверяемые изменения лучше, чем PR на 10,000 строк, который ты не сможешь проверить.`,
    philosophyLvl0_1: `<div class="bg-[#18181b] text-[#f1f5f9] p-3 rounded-xl mb-2"><b>Лв.0 → 1 <VibeContentRenderer content="::FaBolt::" /> (Полный автомат, "Фикс в один клик")</b><br/>🟢 <b>Слайдер автономии:</b> <span class="text-cyan-400">100% агент</span> → <span class="text-gray-500">0% человек</span><br/>Починить битую картинку. Вставил ссылку → Загрузил новую. <b>PR создается сам.</b> Ты просто смотришь на результат и мёржишь. Агент делает всё. <strong>ЛЮБОЙ</strong> может это прямо сейчас.</div>`,
    philosophyLvl1_2: `<div class="bg-[#262833] text-[#f1f5f9] p-3 rounded-xl mb-2"><b>Лв.1 → 2 <VibeContentRenderer content="::FaToolbox::" /> (Промпт + 1 Файл)</b><br/>🟢 <b>Слайдер автономии:</b> <span class="text-cyan-400">80% агент</span> → <span class="text-gray-500">20% человек</span><br/>Опиши простую правку (текст/кнопка) + выбери 1 файл. <strong>Ты сказал — AI сделал.</strong> Ты проверяешь дифф.</div>`,
    philosophyLvl2_3: `<div class="bg-[#18181b] text-[#f1f5f9] p-3 rounded-xl mb-2"><b>Лв.2 → 3 <VibeContentRenderer content="::FaCode::" /> (Мульти-файл, "Оркестр")</b><br/>🟢 <b>Слайдер автономии:</b> <span class="text-cyan-400">60% агент</span> → <span class="text-gray-500">40% человек</span><br/>Рефакторинг? 2-5 файлов, твой промпт. Ты даешь больше контекста, и твоя проверка становится важнее. Ты — дирижер.</div>`,
    philosophyLvl3_4: `<div class="bg-[#262833] text-[#f1f5f9] p-3 rounded-xl mb-2"><b>Лв.3 → 4 <VibeContentRenderer content="::FaBug::" /> (Дебаг/Логи)</b><br/>🟢 <b>Слайдер автономии:</b> <span class="text-cyan-400">50% агент</span> → <span class="text-gray-500">50% человек</span><br/>Сборка упала? Копируй ошибку, логи, кидай в AI с кодом. Это настоящее партнерство. Ты даешь проблему, AI предлагает решение, ты утверждаешь.</div>`,
    philosophyLvl4_5: `<div class="bg-[#18181b] text-[#f1f5f9] p-3 rounded-xl mb-2"><b>Лв.4 → 5 <VibeContentRenderer content="::FaLink::" /> (Проактивность/Охота за иконками)</b><br/>🟢 <b>Слайдер автономии:</b> <span class="text-cyan-400">40% агент</span> → <span class="text-gray-500">60% человек</span><br/>Теперь ты ведешь. Учишь агента новым трюкам: ищешь иконки, чинишь ворнинги проактивно. Ты не реагируешь, а направляешь эволюцию системы.</div>`,
    philosophyLvl5_6: `<div class="bg-[#262833] text-[#f1f5f9] p-3 rounded-xl mb-2"><b>Лв.5 → 6 <VibeContentRenderer content="::FaMicrophone::" />/<VibeContentRenderer content="::FaVideo::" /> (Мультимодал)</b><br/>🟢 <b>Слайдер автономии:</b> <span class="text-cyan-400">Вариативно.</span> Ты выбираешь способ ввода, который для тебя быстрее. Ты полностью командуешь процессом.</div>`,
    philosophyLvl6_7: `<div class="bg-[#18181b] text-[#f1f5f9] p-3 rounded-xl mb-2"><b>Лв.6 → 7 <VibeContentRenderer content="::FaDatabase::" /> (Данные/SQL)</b><br/>🟢 <b>Слайдер автономии:</b> <span class="text-cyan-400">50% агент</span> → <span class="text-gray-500">50% человек</span><br/>AI генерит SQL. Агент предлагает, но только ты, хозяин данных, одобряешь мерж. Высокие ставки, высокое доверие.</div>`,
    philosophyLvl8_10: `<div class="bg-[#262833] text-[#f1f5f9] p-3 rounded-xl mb-2"><b>Лв.8-10+ <VibeContentRenderer content="::FaServer::" />/<VibeContentRenderer content="::FaRocket::" /> (Независимость)</b><br/>🟢 <b>Слайдер автономии:</b> <span class="text-cyan-400">Ты — архитектор системы.</span><br/>Разворачиваешь свой CyberVibe. Свои ключи, боты, XTR-ы. Ты контролируешь всю систему, а не только промпты.</div>`,
    philosophyEnd: `<div class="bg-card text-card-foreground p-4 rounded-xl mt-4 font-bold border border-brand-green/50">Каждый уровень — это новая отметка на твоём <b>слайдере автономии</b>. Ты начинаешь доверять агенту мелкие, проверяемые задачи, потом — крупнее. В итоге вы — настоящие ко-пилоты в твоём костюме Железного Человека.<br/><b>Когда ты освоил шаг, предыдущий кажется тебе «для дебилов». Это и есть эволюция. Добро пожаловать, Нео.</b></div>`,
  }
};