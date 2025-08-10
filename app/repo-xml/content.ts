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
    intro: `You landed exactly where the next level starts.\nThis isn't a boring dev page — it's a live studio that turns tiny ideas into real, deployable changes. Paste a link, type an idea, and watch the engine do the heavy lifting.\nNo installs. No git voodoo. Immediate results.`,
    tldr: [
      "<strong>Scroll.</strong> Get the vibe.",
      "<strong>Click “Extract Files”.</strong> Pull the code you want to edit.",
      "<strong>Paste your idea.</strong> Type: “Replace image”, “Change button text”, “Make it dark”.",
      "<strong>AI + You = PR</strong> The bot crafts the code and prepares a Pull Request. You review, merge, deploy.",
      "<strong>Level Up.</strong> Each action unlocks perks and new abilities. From one-click fixes to multi-file refactors — you’ll see progress."
    ],
    whatisit: `/repo-xml = an AI-powered remix lab.\nFlow: Extract → Prompt → AI generates → PR → Merge. Fast, verifiable, repeat.`,
    youare: `You’re not tinkering in private. \nYou’re leveling up on real projects — small steps, visible wins, and real deploys. \nThis is about getting hands-on and improving, not theory.`,
    levelsTitle: "🏆 BADGES, LEVELS, & QUESTS",
    levels: `Start with one-click fixes and climb to full multi-file orchestration. Every PR, every fix, every merge = XP. Unlock perks, claim badges, and join the VIBE TRIBE.`,
    faq: [
      { q: "Why does this look like a game?", a: "Because earning real outcomes should be fun and motivating." },
      { q: "Who is this for?", a: "Anyone who wants to actually ship — designers, juniors, curious devs, and folks who hate setup." },
      { q: "What if I break something?", a: "Sandbox + PR flow. You review before merge. Rollbacks available." },
      { q: "How fast can I level?", a: "From zero to useful in minutes. From newbie to confident in a few days of actual edits." },
    ],
    tribe: [
      { label: "CYBERVIBE Sandbox (this page)", url: "/repo-xml" },
      { label: "Telegram entrypoint", url: "https://t.me/oneSitePlsBot" },
      { label: "CYBERFITNESS Engine (Gamified)", url: "https://t.me/oneSitePlsBot/app" },
      { label: "Full achievement history, perks, and code", url: "https://github.com/salavey13/carTest/blob/main/hooks/cyberFitnessSupabase.ts" },
    ],
    ready: "Ready? Say “I’m in” and let’s ship."
  },
  ru: {
    title: "🧬 Добро пожаловать в CYBERVIBE STUDIO /repo-xml 🧬",
    intro: `Ты попал ровно туда, где начинается апгрейд. Это не скучный дев-пейдж — это живая студия, где идея → код → деплой за несколько кликов. Вставил ссылку, написал, нажал — и сайт обновился.\nБез установки, без гит-магии, только результат.`,
    tldr: [
      "<strong>Прокрути вниз.</strong> Поймай вайб.",
      "<strong>Жми “Извлечь файлы”.</strong> Затащи код, с которым хочешь работать.",
      "<strong>Опиши задачу.</strong> Напиши: «Поменять картинку», «Изменить текст кнопки», «Добавить тёмную тему».",
      "<strong>ИИ + ТЫ = PR</strong> Бот генерит изменения и формирует Pull Request. Ты проверяешь, мёрдишь, деплоишь.",
      "<strong>Прокачка!</strong> Каждый PR и правка дают XP. Начни с одного клика — вырастешь до оркестра из 20+ файлов."
    ],
    whatisit: `/repo-xml = лаборатория ремиксов с ИИ.\nВоркфлоу: Извлекаем → Промптим → AI пишет → PR → Мёржим. Быстро, безопасно, наглядно.`,
    youare: `Ты не просто правишь сайт. \nТы прокачиваешь скилл на реальном проекте — шаг за шагом, с видимым результатом. \nНе теория, а реальные правки и деплой.`,
    levelsTitle: "🏆 УРОВНИ, АЧИВКИ И КВЕСТЫ",
    levels: `От одного клика до мультифайлового рефактора. Любой PR = прогресс. Открывай перки, собери ачивки, войди в VIBE TRIBE.`,
    faq: [
      { q: "Почему тут ощущение игры?", a: "Потому что реальные результаты и прокачка должны приносить кайф." },
      { q: "Кому это подходит?", a: "Дизайнерам, джунам, тимлидам и всем, кто хочет реально доставлять, а не настраивать среду." },
      { q: "А если я что-то сломаю?", a: "Песочница + PR-поток. Ты всегда проверяешь перед мержем. Откат есть." },
      { q: "Сколько времени займет прокачка?", a: "От нуля до полезного правки — минуты. До уверенности — несколько дней правок на реальных задачах." },
    ],
    tribe: [
      { label: "CYBERVIBE Sandbox (эта страница)", url: "/repo-xml" },
      { label: "Вход в Telegram", url: "https://t.me/oneSitePlsBot" },
      { label: "CYBERFITNESS Engine (Геймифицировано)", url: "https://t.me/oneSitePlsBot/app" },
      { label: "Вся история ачивок, перков и кода", url: "https://github.com/salavey13/carTest/blob/main/hooks/cyberFitnessSupabase.ts" },
    ],
    ready: "Готов(а)? Напиши «я в деле» — и мы тебя поднимем. Простые шаги → реальные правки → реальные деплои."
  }
};

// --- Core Page Translations ---
export const translations = {
  en: {
    loading: "Booting SUPERVIBE ENGINE...",
    pageTitle: "SUPERVIBE STUDIO 2.0",
    philosophyTitle: "Your Vibe Path: The Autonomy Slider (Karpathy + Salavey13)",
    philosophyCore: `<strong>The Goal (inspired by Andrej Karpathy): Build an Iron Man suit, not just an autonomous robot.</strong><br/>You are Tony Stark. The AI is your suit. You are always in the loop, augmented, and in control.<br/>Your core task is to make the <strong>Generation-Verification loop</strong> as fast as possible. The AI generates, but you, the human, are the verifier. A good GUI (like visual diffs) is crucial because it uses your brain's "vision GPU" to make verification instant.<br/><b>To go fast, we keep the AI on a leash.</b> Small, incremental, auditable changes are better than a 10,000-line PR you can't review.`,
    philosophyLvl0_1: `<div class="bg-muted/60 text-muted-foreground p-3 rounded-xl mb-2"><b>Lv.0 → 1 <VibeContentRenderer content="::FaBolt::" /> (Full Auto, "One-Click Fix")</b><br/>🟢 <b>Autonomy Slider:</b> <span class="text-accent">100% agent</span> → <span class="opacity-50">0% human</span><br/>Fix a broken image. Paste link → Upload replacement. <b>PR is auto-created.</b> You simply review the final result and merge. The agent handles everything.</div>`,
    philosophyLvl1_2: `<div class="bg-muted/60 text-muted-foreground p-3 rounded-xl mb-2"><b>Lv.1 → 2 <VibeContentRenderer content="::FaToolbox::" /> (Prompt+File)</b><br/>🟢 <b>Autonomy Slider:</b> <span class="text-accent">80% agent</span> → <span class="opacity-50">20% human</span><br/>Describe a tiny change (text/button) + pick 1 file. You say it, AI does it. You verify the diff.</div>`,
    philosophyLvl2_3: `<div class="bg-muted/60 text-muted-foreground p-3 rounded-xl mb-2"><b>Lv.2 → 3 <VibeContentRenderer content="::FaCode::" /> (Multi-File, "Orchestra")</b><br/>🟢 <b>Autonomy Slider:</b> <span class="text-accent">60% agent</span> → <span class="opacity-50">40% human</span><br/>Bigger refactor? Select 2-5 files, describe the change. You provide more context and verification becomes crucial. You are the orchestrator.</div>`,
    philosophyLvl3_4: `<div class="bg-muted/60 text-muted-foreground p-3 rounded-xl mb-2"><b>Lv.3 → 4 <VibeContentRenderer content="::FaBug::" /> (Debug/Logs)</b><br/>🟢 <b>Autonomy Slider:</b> <span class="text-accent">50% agent</span> → <span class="opacity-50">50% human</span><br/>Build fails? Copy the error/log, feed it with code to the AI. This is a true partnership. You provide the problem, AI suggests a fix, you approve.</div>`,
    philosophyLvl4_5: `<div class="bg-muted/60 text-muted-foreground p-3 rounded-xl mb-2"><b>Lv.4 → 5 <VibeContentRenderer content="::FaLink::" /> (Proactive / Icon Hunt)</b><br/>🟢 <b>Autonomy Slider:</b> <span class="text-accent">40% agent</span> → <span class="opacity-50">60% human</span><br/>You're now leading. You teach the agent new tricks: find icons, fix warnings proactively. You're not just reacting, you're guiding the system's evolution.</div>`,
    philosophyLvl5_6: `<div class="bg-muted/60 text-muted-foreground p-3 rounded-xl mb-2"><b>Lv.5 → 6 <VibeContentRenderer content="::FaMicrophone::" />/<VibeContentRenderer content="::FaVideo::" /> (Multimodal)</b><br/>🟢 <b>Autonomy Slider:</b> <span class="text-accent">Variable</span>. You choose the input method that's fastest for you. You're in full command.</div>`,
    philosophyLvl6_7: `<div class="bg-muted/60 text-muted-foreground p-3 rounded-xl mb-2"><b>Lv.6 → 7 <VibeContentRenderer content="::FaDatabase::" /> (Data/SQL)</b><br/>🟢 <b>Autonomy Slider:</b> <span class="text-accent">50% agent</span> → <span class="opacity-50">50% human</span><br/>Let AI generate SQL. The agent proposes, but only you, the master of the data, approve the merge. High stakes, high trust.</div>`,
    philosophyLvl8_10: `<div class="bg-muted/60 text-muted-foreground p-3 rounded-xl mb-2"><b>Lv.8-10+ <VibeContentRenderer content="::FaServer::" />/<VibeContentRenderer content="::FaRocket::" /> (Independence)</b><br/>🟢 <b>Autonomy Slider:</b> <span class="text-accent">You are the system architect.</span><br/>Deploy your own CyberVibe. Plug in your own keys, bots, and XTRs. You now control the entire system.</div>`,
    philosophyEnd: `<div class="bg-card text-card-foreground p-4 rounded-xl mt-4 font-bold border border-green-500/50">Every level is a new notch on your <b>autonomy slider</b>. You start by trusting the agent with small, verifiable tasks, then bigger ones. Eventually, you and the agent are true co-pilots in your Iron Man suit.<br/><b>The future isn't "full auto"—it's <span class="text-green-500">human + agent, in a fast, verifiable loop. Always learning. Always leveling up.</span></b></div>`,
  },
  ru: {
    loading: "Запуск SUPERVIBE ДВИЖКА...",
    pageTitle: "SUPERVIBE СТУДИЯ 2.0",
    philosophyTitle: "Твой Путь Вайба: Слайдер Автономии (Karpathy + Salavey13)",
    philosophyCore: `<strong>Цель (по Карпати): Построить костюм Железного Человека, а не автономного робота.</strong><br/>Ты — Тони Старк. AI — твой костюм. Ты всегда в центре, усилен и всё контролируешь.<br/>Твоя главная задача — ускорить цикл <strong>«Генерация → Верификация»</strong>. AI предлагает, но проверяешь ТЫ. Хороший GUI (визуальный дифф) решает, потому что он использует «GPU для зрения» в твоей голове и делает проверку мгновенной.<br/><b>Чтобы двигаться быстро, мы держим AI на коротком поводке.</b> Маленькие, понятные, проверяемые изменения лучше, чем PR на 10,000 строк, который ты не сможешь проверить.`,
    philosophyLvl0_1: `<div class="bg-muted/60 text-muted-foreground p-3 rounded-xl mb-2"><b>Лв.0 → 1 <VibeContentRenderer content="::FaBolt::" /> (Полный автомат, "Фикс в один клик")</b><br/>🟢 <b>Слайдер автономии:</b> <span class="text-accent-text">100% агент</span> → <span class="opacity-50">0% человек</span><br/>Починить битую картинку. Вставил ссылку → Загрузил новую. <b>PR создается сам.</b> Ты просто смотришь на результат и мёржишь. Агент делает всё. <strong>ЛЮБОЙ</strong> может это прямо сейчас.</div>`,
    philosophyLvl1_2: `<div class="bg-muted/60 text-muted-foreground p-3 rounded-xl mb-2"><b>Лв.1 → 2 <VibeContentRenderer content="::FaToolbox::" /> (Промпт + 1 Файл)</b><br/>🟢 <b>Слайдер автономии:</b> <span class="text-accent-text">80% агент</span> → <span class="opacity-50">20% человек</span><br/>Опиши простую правку (текст/кнопка) + выбери 1 файл. <strong>Ты сказал — AI сделал.</strong> Ты проверяешь дифф.</div>`,
    philosophyLvl2_3: `<div class="bg-muted/60 text-muted-foreground p-3 rounded-xl mb-2"><b>Лв.2 → 3 <VibeContentRenderer content="::FaCode::" /> (Мульти-файл, "Оркестр")</b><br/>🟢 <b>Слайдер автономии:</b> <span class="text-accent-text">60% агент</span> → <span class="opacity-50">40% человек</span><br/>Рефакторинг? 2-5 файлов, твой промпт. Ты даешь больше контекста, и твоя проверка становится важнее. Ты — дирижер.</div>`,
    philosophyLvl3_4: `<div class="bg-muted/60 text-muted-foreground p-3 rounded-xl mb-2"><b>Лв.3 → 4 <VibeContentRenderer content="::FaBug::" /> (Дебаг/Логи)</b><br/>🟢 <b>Слайдер автономии:</b> <span class="text-accent-text">50% агент</span> → <span class="opacity-50">50% человек</span><br/>Сборка упала? Копируй ошибку, логи, кидай в AI с кодом. Это настоящее партнерство. Ты даешь проблему, AI предлагает решение, ты утверждаешь.</div>`,
    philosophyLvl4_5: `<div class="bg-muted/60 text-muted-foreground p-3 rounded-xl mb-2"><b>Лв.4 → 5 <VibeContentRenderer content="::FaLink::" /> (Проактивность/Охота за иконками)</b><br/>🟢 <b>Слайдер автономии:</b> <span class="text-accent-text">40% агент</span> → <span class="opacity-50">60% человек</span><br/>Теперь ты ведешь. Учишь агента новым трюкам: ищешь иконки, чинишь ворнинги проактивно. Ты не реагируешь, а направляешь эволюцию системы.</div>`,
    philosophyLvl5_6: `<div class="bg-muted/60 text-muted-foreground p-3 rounded-xl mb-2"><b>Лв.5 → 6 <VibeContentRenderer content="::FaMicrophone::" />/<VibeContentRenderer content="::FaVideo::" /> (Мультимодал)</b><br/>🟢 <b>Слайдер автономии:</b> <span class="text-accent-text">Вариативно.</span> Ты выбираешь способ ввода, который для тебя быстрее. Ты полностью командуешь процессом.</div>`,
    philosophyLvl6_7: `<div class="bg-muted/60 text-muted-foreground p-3 rounded-xl mb-2"><b>Лв.6 → 7 <VibeContentRenderer content="::FaDatabase::" /> (Данные/SQL)</b><br/>🟢 <b>Слайдер автономии:</b> <span class="text-accent-text">50% агент</span> → <span class="opacity-50">50% человек</span><br/>AI генерит SQL. Агент предлагает, но только ты, хозяин данных, одобряешь мерж. Высокие ставки, высокое доверие.</div>`,
    philosophyLvl8_10: `<div class="bg-muted/60 text-muted-foreground p-3 rounded-xl mb-2"><b>Лв.8-10+ <VibeContentRenderer content="::FaServer::" />/<VibeContentRenderer content="::FaRocket::" /> (Независимость)</b><br/>🟢 <b>Слайдер автономии:</b> <span class="text-accent-text">Ты — архитектор системы.</span><br/>Разворачиваешь свой CyberVibe. Свои ключи, боты, XTR-ы. Ты контролируешь всю систему, а не только промпты.</div>`,
    philosophyEnd: `<div class="bg-card text-card-foreground p-4 rounded-xl mt-4 font-bold border border-green-500/50">Каждый уровень — это новая отметка на твоём <b>слайдере автономии</b>. Ты начинаешь доверять агенту мелкие, проверяемые задачи, потом — крупнее. В итоге вы — настоящие ко-пилоты в твоём костюме Железного Человека.<br/><b>Будущее — не «полный автопилот», а <span class="text-green-500">человек + агент в быстром, верифицируемом цикле. Всегда учиться. Всегда прокачиваться.</span></b></div>`,
  }
};

export const styleGuideContent = {
  ru: {
    title: "Философия VIBE-КОДИНГА",
    intro: "Интерактивное руководство по методологии Vibe Coding и ее визуальным компонентам. Это не просто стиль, это производственный процесс.",
    principles: [
      {
        icon: "::FaLeaf::",
        title: "1. Фокусируйся на «листьях»",
        subtitle: "Изолируй риски",
        description: "Нормально, если в 'листьях' (изолированных UI-компонентах) есть техдолг, ведь от них ничего не зависит. Они вряд ли будут меняться. Это идеальное место, чтобы дать ИИ творить."
      },
      {
        icon: "::FaUserTie::",
        title: "2. Будь PM-ом для ИИ",
        subtitle: "Обеспечь полный контекст",
        description: "Если бы к тебе пришел джун, ты бы не сказал 'сделай фичу'. Ты бы провел экскурсию по коду, объяснил требования и ограничения. Сделай то же самое для ИИ, чтобы он преуспел."
      },
      {
        icon: "::FaEye::",
        title: "3. Проектируй для верификации",
        subtitle: "Доверяй, но проверяй",
        description: "Проектируй систему так, чтобы входы и выходы были легко проверяемы человеком. Создавай стресс-тесты для стабильности, чтобы быть уверенным в результате, не читая каждую строчку кода."
      },
    ],
    caseStudy: {
      title: "Кейс: PR на 22,000 строк",
      content: "Мы смержили изменение на 22,000 строк в прод, написанное в основном Claude. Как? <strong>1. Мы были PM-ами для Claude.</strong> Изменение касалось в основном 'листьев', где мы допускали техдолг. <strong>2. Мы сделали ревью кода</strong> для критически важных частей. <strong>3. Мы спроектировали стресс-тесты</strong> для стабильности и создали легко проверяемые человеком контрольные точки. В итоге мы были уверены в этом изменении так же, как и в любом другом, но доставили его за ничтожную долю времени и усилий."
    }
  }
};