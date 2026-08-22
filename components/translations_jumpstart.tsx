import React from "react"; // Import React
import { FaMoneyBillWave, FaEnvelopeOpenText, FaRobot, FaFileCode, FaShieldHalved, FaGamepad, FaAtom, FaBrain, FaGithub } from "react-icons/fa6";
import Link from 'next/link'; // Import Link for the new section

// Define the translation structure
export const jumpstartTranslations = {
  en: {
    loading: "Loading Supervibe Protocol...",
    pageTitle: "Supervibe Jumpstart Kit",
    pageSubtitle: "**Pimp Your Friend's** (or Your Own) **Dream:** Get a FREE, AI-Powered Biz Engine. Ready for XTRs in Minutes.",
    section1: { title: "Skip the Bullshit Setup Grind.", p1: "Building from scratch? That's old matrix code. Takes forever. Reading", link1: "philosophy", p1_cont: "is cool, but doesn't pay *today*.", p2: "I (", p2_cont: ") did the hard yards. Years of code, security, VIBE.", p2_highlight: "My grind = your gain.", p2_end: "It's in the kit.", p3_highlight: "You don't need my history.", p3_cont: "You need a **working engine** + **AI buddies**.", p3_end: "Reality, 2025.", img_alt: "Old setup vs Instant Kit", img_caption: "Stop wiring. Start VIBING." },
    section2: { title: "Instant Biz Engine: Plug & Play!", intro: "A **launchpad**. Fork, set **ONE** TG Token, deploy. Bam! Working site ready for:", feature1: "Donations / Tips (XTR ready!)", feature2: "Support Invoices", feature3: "Basic Bot Mgmt", feature4: "Easy Content Updates", outro: "Powered by **Bot Crew** & **Supervibe OS**. 0 cost. 87/13% Vibe Pact on profit.", img_alt: "5-Min Setup Visual", img_caption: "Fork -> Token -> Deploy -> Profit? (Needs *your* vibe)." },
    section3: { title: "The Game: Level Up Vibe & XTRs", img_alt: "Gamified HUD Mockup", img_caption: "Less spreadsheet, more high score.", level1: { title: "ONLINE", desc: "Deploy kit (5m). Bot guides niche.", quest: "Quest: Engine running.", tactic: "Tactic: Niche Definition." }, level2: { title: "ENGAGE", desc: "Bot probes market, you talk.", quest: "Quest: 1st interaction/payment.", reward: "Rilmonetometer GO!", tactic: "VIBE tips. Tactic: Research + Feedback." }, level3: { title: "AUTOMATE", desc: "Train Bot Manager. See profit.", quest: "Quest: Positive XTR flow.", reward: "Learn `SelfDev`. Earn XTRs!", tactic: "Tactic: Acc. Chart, Pick Page." }, level4: { title: "EXPAND", desc: "Deploy Bots. Focus on *your* value.", quest: "Quest: Scale profit OR free time.", tactic: "Tactic: Skills Maps, Team Agreements." }, level5: { title: "THRIVE", desc: "System hums. You guide/strategize.", quest: "Quest: Sustain profit, min ops.", reward: "F*ck Off Independence.", tactic: "Max XTR! Tactic: CEO Clarity, Run As If To Sell." } },
    section4: { title: "Built on Supervibe Tech", p1: "Runs on", link1: "VIBE", p1_cont: ", AI via", link2: "Studio", p1_cont2: ", secure", p1_end: "infra. We handle backend, you handle VIBE.", engine1_title: "Smart Bot Crew", engine1_desc: "Handles grind, learns.", engine2_title: "VIBE OS", engine2_desc: "Intuitive control.", engine3_title: "Solid Foundation", engine3_desc: "Secure, scalable tech.", },
    // --- NEW CyberVibe Section ---
    cyberVibeSection: {
        title: "The Secret Sauce: CyberVibe ⚛️",
        p1: "This Jumpstart isn't just a template; it's your entry point into the **CyberVibe feedback loop**.",
        p2: "Use the <Link href='/repo-xml' class='text-brand-blue hover:underline font-semibold'>Supervibe Studio</Link> to interact with your kit's code (<FaGithub class='inline mx-1'/>). AI helps you **transmute** ideas into features, building on the existing structure.",
        p3: "Each iteration refines your understanding and the system's capabilities. Your GitHub becomes your **cyberchest**, your history becomes your context. It's **co-creation**, not just coding.",
        p4: "This kit is your first step into that **infinite context** future. Plug in, Neo.",
        testimonial: "<FaAtom class='inline text-purple-400 mr-1'/>Feels like Tony Stark building his suit – complex stuff done, now customize & fly. Supervibe Studio is the Jarvis. Pure **CyberVibe!**<FaBrain class='inline text-purple-400 ml-1'/>" // Testimonial added here
    },
    // --- End NEW ---
    cta: { title: "Pimp Your Future, {userName}.", p1: "Stop waiting. Start *doing*. Get Jumpstart. Help a friend. Build future, faster.", link1: "my story", cost: "Launch Cost: 0 XTR. Success Tip: 13% Profit.", button: "GET MY INSTANT AI-BIZ KIT!", form_title: "Apply / Ask:" }
  },
  ru: {
    loading: "Загрузка Supervibe...",
    pageTitle: "Supervibe Jumpstart",
    pageSubtitle: "**Прокачай Мечту** (Свою/Друга): БЕСПЛАТНЫЙ AI-Движок. Готов к XTR за минуты.",
    section1: { title: "Нах*й Гринд.", p1: "С нуля? Старая матрица. Вечность. Читать", link1: "философию", p1_cont: "круто, но не платит *сегодня*.", p2: "Я (", p2_cont: ") прошел хардкор. Код, безопасность, VIBE.", p2_highlight: "Мой гринд = твой буст.", p2_end: "Все в ките.", p3_highlight: "Не нужен мой опыт.", p3_cont: "Нужен **движок** + **AI-кореша**.", p3_end: "Реальность, 2025.", img_alt: "Старый сетап vs Instant Kit", img_caption: "Хватит паять. Вайби!" },
    section2: { title: "Движок: Plug & Play!", intro: "**Лончпад**. Форк, **1** Токен, деплой. Бум! Рабочий сайт готов к:", feature1: "Донатам/Чаевым (XTR!)", feature2: "Счетам Поддержки", feature3: "Упр. Ботом (Дашборд)", feature4: "Обновл. Контента", outro: "На **Bot Crew** & **Supervibe OS**. 0 затрат. 87/13% Vibe Пакт.", img_alt: "5-Мин Сетап", img_caption: "Форк->Токен->Деплой->Профит? (Нужен твой вайб)." },
    section3: { title: "Игра: Качай Вайб & XTRs", img_alt: "HUD Дашборда", img_caption: "Меньше таблиц, больше очков.", level1: { title: "СТАРТ", desc: "Деплой (5м). Бот -> ниша.", quest: "Квест: Запусти движок.", tactic: "Тактика: Опред. Ниши." }, level2: { title: "КОНТАКТ", desc: "Бот -> рынок, ты -> люди.", quest: "Квест: 1я сделка.", reward: "Рилмонетометр ЗАПУЩЕН!", tactic: "VIBE типсы. Тактика: Рисерч + Фидбек." }, level3: { title: "АВТОМАТ", desc: "Тренируй Bot Manager. Следи за $.", quest: "Квест: Плюс XTR.", reward: "Изучи `SelfDev`. Заработай XTR!", tactic: "Тактика: Acc. Chart, Pick Page." }, level4: { title: "МАСШТАБ", desc: "Деплой Ботов. Фокус -> твоя ценность.", quest: "Квест: Рост $ ИЛИ время.", tactic: "Тактика: Skills Maps, Team Agreements." }, level5: { title: "ПОЛЕТ", desc: "Система жужжит. Ты -> стратегия.", quest: "Квест: Стабильный $, мин. опс.", reward: "F*ck Off Независимость.", tactic: "Макс XTR! Тактика: Ясность CEO." } },
    section4: { title: "На Supervibe Tech", p1: "На", link1: "VIBE", p1_cont: ", AI через", link2: "Студию", p1_cont2: ", безоп.", p1_end: "инфра. Мы -> бэк, ты -> ВАЙБ.", engine1_title: "Bot Crew", engine1_desc: "Рутина, учится.", engine2_title: "VIBE OS", engine2_desc: "Твой контроль.", engine3_title: "Фундамент", engine3_desc: "Надежно, масштабно.", },
    // --- NEW CyberVibe Section ---
    cyberVibeSection: {
        title: "Секретный Соус: CyberVibe ⚛️",
        p1: "Jumpstart – не просто шаблон; это вход в **петлю CyberVibe**.",
        p2: "Используй <Link href='/repo-xml' class='text-brand-blue hover:underline font-semibold'>Supervibe Studio</Link> для кода (<FaGithub class='inline mx-1'/>). AI помогает **трансмутировать** идеи в фичи.",
        p3: "Итерации углубляют понимание. GitHub – **кибер-сундук**, история – контекст. Это **со-творчество**.",
        p4: "Кит – твой шаг в **бесконечный контекст**. Включайся, Нео.",
        testimonial: "<FaAtom class='inline text-purple-400 mr-1'/>Как Тони Старк – инженерия сделана, теперь кастом и полёт. Supervibe Studio – Джарвис. Чистый **CyberVibe!**<FaBrain class='inline text-purple-400 ml-1'/>" // Testimonial added here
    },
    // --- End NEW ---
    cta: { title: "Прокачай Будущее, {userName}.", p1: "Хватит ждать. Делай. Бери Jumpstart. Помоги другу. Строй будущее быстрее.", link1: "мою историю", cost: "Старт: 0 XTR. Успех: 13% Профита.", button: "ПОЛУЧИТЬ INSTANT AI-BIZ KIT!", form_title: "Заявка / Вопросы:" }
  }
};

// Helper component to render content with potential links and icons
const RenderJumpstartContent: React.FC<{ content: string }> = ({ content }) => {
    // Match **bold**, <Link>, <FaIcon/>
    const segments = content.split(/(\*\*.*?\*\*|<Link.*?<\/Link>|<Fa\w+\s*.*?\/?>)/g).filter(Boolean);
    return (
      <>
        {segments.map((segment, index) => {
          if (segment.startsWith('**') && segment.endsWith('**')) {
            return <strong key={index} className="text-white">{segment.slice(2, -2)}</strong>;
          }
          const linkMatch = segment.match(/<Link href='([^']*)' class='([^']*)'>(.*?)<\/Link>/);
          if (linkMatch) {
            return <Link key={index} href={linkMatch[1]} className={linkMatch[2]}>{linkMatch[3]}</Link>;
          }
           const iconMatch = segment.match(/<Fa(\w+)\s*(?:class(?:Name)?="([^"]*)")?\s*\/?>/i);
           if (iconMatch) {
              const iconName = `Fa${iconMatch[1]}`;
              const className = iconMatch[2] || "";
              const IconComponent = FaIcons[iconName as keyof typeof FaIcons];
              if (IconComponent) {
                  const finalClassName = `${className} inline-block align-middle`;
                  return React.createElement(IconComponent, { key: index, className: finalClassName });
              } else {
                  console.warn(`[RenderJumpstart] Icon "${iconName}" not found.`);
                  return <span key={index} className="text-red-500 font-mono">[? {iconName}]</span>;
              }
           }
          return <React.Fragment key={index}>{segment}</React.Fragment>;
        })}
      </>
    );
};


export type JumpstartTranslations = typeof jumpstartTranslations;
export type JumpstartLanguageKey = keyof JumpstartTranslations;
// Export the helper component if needed elsewhere, otherwise keep it local
export { RenderJumpstartContent };