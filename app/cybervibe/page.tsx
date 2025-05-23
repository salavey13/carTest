"use client";

import React, { useState, useEffect, useId } from "react"; // Added useId
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAppContext } from "@/contexts/AppContext";
import { VibeContentRenderer } from "@/components/VibeContentRenderer";
import { debugLogger as logger } from "@/lib/debugLogger";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import RockstarHeroSection from "../tutorials/RockstarHeroSection"; // Added import

type Language = 'en' | 'ru';

const STORAGE_BASE_URL_CV = "https://placehold.co"; 
const PLACEHOLDER_BLUR_URL_CV = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="; 

const pageTranslations = {
  ru: {
    pageTitle: "КиберВайб Апгрейд",
    pageSubtitle: "Главный ключ к твоему лучшему будущему – ЭТО ТЫ. Пришло время стать больше, чем ты есть, по заветам Джима Рона.",
    sections: [
      {
        id: "personal-development",
        icon: "::FaUserAstronaut::",
        title: "Фундамент: Ты – Главный Актив",
        points: [
          "Джим Рон говорил: <strong class='text-brand-yellow'>\"Работай над собой усерднее, чем над своей работой.\"</strong> Это ядро КиберВайба. Твоё личное развитие – это главный рычаг.",
          "Твой доход и успех редко превышают уровень твоего личного развития. Хочешь больше? Становись больше!",
          "Инвестируй в свои знания, навыки и мышление. Это самые ценные активы в быстро меняющемся кибер-мире.",
          "Здесь не просто платформа, это твоя <Link href='/selfdev' class='text-brand-blue hover:underline font-semibold'>SelfDev Лаборатория</Link> для прокачки.",
        ],
        imageUrl: `${STORAGE_BASE_URL_CV}/600x338/1a1a2e/FFEE00/png?text=ТЫ+-+Актив`,
        imageAlt: "Концептуальное изображение личного развития как основного актива",
      },
      {
        id: "goal-setting",
        icon: "::FaBullseye::",
        title: "Карта Сокровищ: Сила Целей",
        points: [
          "Рон утверждал: <strong class='text-brand-yellow'>\"Если у тебя нет списка целей, я могу угадать твой банковский баланс с точностью до нескольких сотен долларов.\"</strong>",
          "Запиши свои цели: экономические, материальные, личное развитие. Сделай их конкретными, измеримыми, достижимыми, релевантными и ограниченными по времени (SMART).",
          "<strong class='text-brand-yellow'>Причины важнее ответов.</strong> Найди свои 'почему' – личные, семейные, даже мелкие 'nitty-gritty' причины, которые зажгут в тебе огонь.",
          "Твой <Link href='/game-plan' class='text-brand-blue hover:underline font-semibold'>Game Plan</Link> – это твоя стратегия, а <Link href='/p-plan' class='text-brand-blue hover:underline font-semibold'>P-Plan</Link> – твой тактический дневник для её воплощения.",
        ],
        imageUrl: `${STORAGE_BASE_URL_CV}/600x338/1a1a2e/00FFEE/png?text=Карта+Целей`,
        imageAlt: "Визуализация карты целей и пути к ним",
      },
      {
        id: "life-laws",
        icon: "::FaCanadianMapleLeaf::",
        title: "Законы Вселенной КиберВайба (Времена Года)",
        points: [
          "<strong class='text-brand-red'>Зима (Трудности):</strong> Неизбежны. Не желай, чтобы было легче; желай, чтобы ты был лучше. Учись справляться, становись сильнее.",
          "<strong class='text-brand-green'>Весна (Возможности):</strong> Всегда приходит после зимы. Используй её! 'Сей весной или проси осенью.' Запускай новые проекты, учись новому.",
          "<strong class='text-brand-orange'>Лето (Защита):</strong> Всё хорошее будет атаковано. Защищай свои достижения, идеи, ценности. Будь бдителен.",
          "<strong class='text-brand-yellow'>Осень (Жатва):</strong> Собирай урожай без жалоб (если он мал) и без извинений (если он велик). Принимай полную ответственность за свои результаты.",
          "Прокачай свое <Link href='/expmind' class='text-brand-blue hover:underline font-semibold'>Мышление Экспериментатора</Link> для навигации по этим сезонам.",
        ],
        imageUrl: `${STORAGE_BASE_URL_CV}/600x338/1a1a2e/FF9900/png?text=Сезоны+Жизни`,
        imageAlt: "Иллюстрация четырех времен года как метафоры жизненных циклов",
      },
      {
        id: "action-discipline",
        icon: "::FaBolt::",
        title: "Двигатель Прогресса: Действие и Дисциплина",
        points: [
          "<strong class='text-brand-yellow'>\"Не то, что случается, определяет твою жизнь, а то, что ТЫ ДЕЛАЕШЬ с тем, что случается.\"</strong>",
          "Дисциплина – мост между целями и их достижением. Начни с малых шагов, вырабатывай привычку действовать.",
          "Самомотивация – твой внутренний огонь. Не жди, что кто-то придёт и 'включит' тебя. Найди свои причины и действуй.",
          "Начни действовать прямо сейчас в <Link href='/repo-xml' class='text-brand-blue hover:underline font-semibold'>SuperVibe Studio</Link>, применяя новые знания.",
        ],
        imageUrl: `${STORAGE_BASE_URL_CV}/600x338/1a1a2e/FF00FF/png?text=Действие!`,
        imageAlt: "Символ молнии, представляющий действие и энергию",
      },
      {
        id: "attitude-diseases",
        icon: "::FaHeadSideVirus::",
        title: "Антивирус для Разума: Болезни Отношения",
        points: [
          "<strong class='text-brand-yellow'>Излишняя Осторожность:</strong> Жизнь рискованна по своей сути. 'Если думаешь, что пытаться рискованно, подожди, пока тебе выставят счет за то, что ты не пытался.'",
          "<strong class='text-brand-yellow'>Пессимизм:</strong> Ищи хорошее, а не плохое. Стакан всегда наполовину полон для того, кто хочет видеть возможности.",
          "<strong class='text-brand-yellow'>Жалобы:</strong> 'Потрать пять минут на жалобы, и ты впустую потратил пять минут.' Сосредоточься на решениях, а не на проблемах.",
          "Твоё <Link href='/expmind' class='text-brand-blue hover:underline font-semibold'>Мышление</Link> – это твоя операционная система. Обновляй её регулярно.",
        ],
        imageUrl: `${STORAGE_BASE_URL_CV}/600x338/1a1a2e/FF4500/png?text=Позитивный+Настрой`,
        imageAlt: "Щит, отражающий негативные мысли, символизирующий сильное мышление",
      },
      {
        id: "emotions-for-change",
        icon: "::FaFire::",
        title: "Эмоциональный Реактор: Топливо для Перемен",
        points: [
          "Джим Рон выделял эмоции, способные изменить жизнь за один день:",
          "<strong class='text-brand-red'>Отвращение:</strong> Сказать 'С меня хватит!' текущей ситуации.",
          "<strong class='text-brand-cyan'>Решение:</strong> Принять твердое решение измениться, действовать.",
          "<strong class='text-brand-yellow'>Желание:</strong> Зажечь сильное, страстное желание достичь цели.",
          "<strong class='text-brand-purple'>Решимость:</strong> Сказать 'Я сделаю это!' и не отступать.",
        ],
        imageUrl: `${STORAGE_BASE_URL_CV}/600x338/1a1a2e/9400D3/png?text=Эмоции+Перемен`,
        imageAlt: "Яркое пламя, символизирующее силу эмоций",
      },
      {
        id: "sowing-reaping",
        icon: "::FaSeedling::",
        title: "Вселенский Принцип: Посев и Жатва",
        points: [
          "<strong class='text-brand-yellow'>Что посеешь, то и пожнёшь.</strong> И часто пожнёшь гораздо больше, чем посеял.",
          "Этот закон работает во всех сферах: знания, усилия, отношения, финансы.",
          "Сей щедро и с умом. Твои действия сегодня формируют твою завтрашнюю жатву.",
          "Создавая ценность (<Link href='/purpose-profit' class='text-brand-blue hover:underline font-semibold'>Purpose</Link>), ты обеспечиваешь себе богатый урожай (<Link href='/purpose-profit' class='text-brand-blue hover:underline font-semibold'>Profit</Link>).",
        ],
        imageUrl: `${STORAGE_BASE_URL_CV}/600x338/1a1a2e/32CD32/png?text=Посев+и+Жатва`,
        imageAlt: "Росток, пробивающийся из земли, и зрелые колосья",
      },
      {
        id: "law-of-use",
        icon: "::FaDumbbell::",
        title: "Закон Активации: Используй или Потеряешь",
        points: [
          "<strong class='text-brand-yellow'>Любой талант, не используемый, угасает. Любые знания, не применяемые, забываются.</strong>",
          "Активно используй свои навыки, идеи, связи. Не давай им 'заржаветь'.",
          "Притча о талантах: тот, кто не использовал свой талант, потерял его.",
          "Постоянная практика и применение – ключ к сохранению и приумножению твоего потенциала.",
        ],
        imageUrl: `${STORAGE_BASE_URL_CV}/600x338/1a1a2e/4682B4/png?text=Используй+или+Потеряешь`,
        imageAlt: "Сильная рука, держащая инструмент, символизирующая активное использование",
      },
      {
        id: "reading-learning",
        icon: "::FaBookOpenReader::",
        title: "Топливо для Роста: Чтение и Обучение",
        points: [
          "<strong class='text-brand-yellow'>Все успешные люди – ненасытные читатели и ученики.</strong>",
          "Одна книга может сэкономить тебе пять лет жизни, предостерегая от ошибок или открывая новые пути.",
          "Не оставляй свой успех и развитие на волю случая. Сделай их предметом изучения.",
          "Погружайся в <Link href='/selfdev' class='text-brand-blue hover:underline font-semibold'>SelfDev</Link>, читай, анализируй, применяй. Это твой путь к мастерству в КиберВайбе.",
        ],
        imageUrl: `${STORAGE_BASE_URL_CV}/600x338/1a1a2e/8B4513/png?text=Чтение+-+Сила`,
        imageAlt: "Открытая книга, из которой исходит свет знания",
      },
    ]
  },
  en: {
    pageTitle: "CyberVibe Upgrade",
    pageSubtitle: "The major key to your better future is YOU. It's time to become more than you are, inspired by Jim Rohn.",
    sections: [
      {
        id: "personal-development",
        icon: "::FaUserAstronaut::",
        title: "Foundation: You Are The Main Asset",
        points: [
          "Jim Rohn said: <strong class='text-brand-yellow'>\"Work harder on yourself than you do on your job.\"</strong> This is the core of CyberVibe. Your personal development is the main lever.",
          "Your income and success rarely exceed your personal development. Want more? Become more!",
          "Invest in your knowledge, skills, and mindset. These are the most valuable assets in the rapidly changing cyber-world.",
          "This isn't just a platform; it's your <Link href='/selfdev' class='text-brand-blue hover:underline font-semibold'>SelfDev Laboratory</Link> for leveling up.",
        ],
        imageUrl: `${STORAGE_BASE_URL_CV}/600x338/1a1a2e/FFEE00/png?text=YOU+-+Asset`,
        imageAlt: "Conceptual image of personal development as the main asset",
      },
      {
        id: "goal-setting",
        icon: "::FaBullseye::",
        title: "Treasure Map: The Power of Goals",
        points: [
          "Rohn stated: <strong class='text-brand-yellow'>\"If you don't have a list of your goals, I can guess your bank balance to within a few hundred dollars.\"</strong>",
          "Write down your goals: economic, material, personal development. Make them specific, measurable, achievable, relevant, and time-bound (SMART).",
          "<strong class='text-brand-yellow'>Reasons come first, answers second.</strong> Find your 'whys' – personal, family, even small 'nitty-gritty' reasons that will ignite your fire.",
          "Your <Link href='/game-plan' class='text-brand-blue hover:underline font-semibold'>Game Plan</Link> is your strategy, and your <Link href='/p-plan' class='text-brand-blue hover:underline font-semibold'>P-Plan</Link> is your tactical journal for its execution.",
        ],
        imageUrl: `${STORAGE_BASE_URL_CV}/600x338/1a1a2e/00FFEE/png?text=Goal+Map`,
        imageAlt: "Visualization of a goal map and the path to achieve them",
      },
      {
        id: "life-laws",
        icon: "::FaCanadianMapleLeaf::",
        title: "Laws of the CyberVibe Universe (The Seasons)",
        points: [
          "<strong class='text-brand-red'>Winter (Difficulties):</strong> They are inevitable. Don't wish it were easier; wish you were better. Learn to cope, become stronger.",
          "<strong class='text-brand-green'>Spring (Opportunities):</strong> Always comes after winter. Use it! 'Sow in the spring or beg in the fall.' Launch new projects, learn new things.",
          "<strong class='text-brand-orange'>Summer (Protection):</strong> All good things will be attacked. Protect your achievements, ideas, values. Be vigilant.",
          "<strong class='text-brand-yellow'>Autumn (Harvest):</strong> Reap without complaint (if it's small) and without apology (if it's large). Take full responsibility for your results.",
          "Upgrade your <Link href='/expmind' class='text-brand-blue hover:underline font-semibold'>Experimental Mindset</Link> to navigate these seasons.",
        ],
        imageUrl: `${STORAGE_BASE_URL_CV}/600x338/1a1a2e/FF9900/png?text=Seasons+of+Life`,
        imageAlt: "Illustration of the four seasons as a metaphor for life cycles",
      },
      {
        id: "action-discipline",
        icon: "::FaBolt::",
        title: "Engine of Progress: Action & Discipline",
        points: [
          "<strong class='text-brand-yellow'>\"It's not what happens that determines your life, but what YOU DO with what happens.\"</strong>",
          "Discipline is the bridge between goals and accomplishment. Start with small steps, build a habit of action.",
          "Self-motivation is your inner fire. Don't wait for someone to come and 'turn you on.' Find your reasons and act.",
          "Start acting now in the <Link href='/repo-xml' class='text-brand-blue hover:underline font-semibold'>SuperVibe Studio</Link>, applying new knowledge.",
        ],
        imageUrl: `${STORAGE_BASE_URL_CV}/600x338/1a1a2e/FF00FF/png?text=Action!`,
        imageAlt: "Lightning bolt symbol representing action and energy",
      },
      {
        id: "attitude-diseases",
        icon: "::FaHeadSideVirus::",
        title: "Mind Antivirus: Diseases of Attitude",
        points: [
          "<strong class='text-brand-yellow'>Over-Caution:</strong> Life is inherently risky. 'If you think trying is risky, wait till they hand you the bill for not trying.'",
          "<strong class='text-brand-yellow'>Pessimism:</strong> Look for the good, not the bad. The glass is always half full for those who want to see opportunities.",
          "<strong class='text-brand-yellow'>Complaining:</strong> 'Spend five minutes complaining, and you've wasted five minutes.' Focus on solutions, not problems.",
          "Your <Link href='/expmind' class='text-brand-blue hover:underline font-semibold'>Mindset</Link> is your operating system. Update it regularly.",
        ],
        imageUrl: `${STORAGE_BASE_URL_CV}/600x338/1a1a2e/FF4500/png?text=Positive+Mindset`,
        imageAlt: "A shield reflecting negative thoughts, symbolizing a strong mindset",
      },
      {
        id: "emotions-for-change",
        icon: "::FaFire::",
        title: "Emotional Reactor: Fuel for Change",
        points: [
          "Jim Rohn highlighted emotions capable of changing life in a single day:",
          "<strong class='text-brand-red'>Disgust:</strong> Saying 'I've had enough!' with the current situation.",
          "<strong class='text-brand-cyan'>Decision:</strong> Making a firm decision to change, to act.",
          "<strong class='text-brand-yellow'>Desire:</strong> Igniting a strong, passionate desire to achieve a goal.",
          "<strong class='text-brand-purple'>Resolve:</strong> Saying 'I will do it!' and not backing down.",
        ],
        imageUrl: `${STORAGE_BASE_URL_CV}/600x338/1a1a2e/9400D3/png?text=Emotions+of+Change`,
        imageAlt: "A bright flame symbolizing the power of emotions",
      },
      {
        id: "sowing-reaping",
        icon: "::FaSeedling::",
        title: "Universal Principle: Sowing & Reaping",
        points: [
          "<strong class='text-brand-yellow'>What you sow, you will reap.</strong> And often, you will reap much more than you sowed.",
          "This law works in all areas: knowledge, effort, relationships, finances.",
          "Sow generously and wisely. Your actions today shape your harvest tomorrow.",
          "By creating value (<Link href='/purpose-profit' class='text-brand-blue hover:underline font-semibold'>Purpose</Link>), you ensure a rich harvest (<Link href='/purpose-profit' class='text-brand-blue hover:underline font-semibold'>Profit</Link>).",
        ],
        imageUrl: `${STORAGE_BASE_URL_CV}/600x338/1a1a2e/32CD32/png?text=Sowing+Reaping`,
        imageAlt: "A sprout breaking through soil and mature ears of wheat",
      },
      {
        id: "law-of-use",
        icon: "::FaDumbbell::",
        title: "Law of Activation: Use It or Lose It",
        points: [
          "<strong class='text-brand-yellow'>Any talent not used, fades. Any knowledge not applied, is forgotten.</strong>",
          "Actively use your skills, ideas, connections. Don't let them 'rust'.",
          "The parable of talents: he who did not use his talent, lost it.",
          "Constant practice and application are key to preserving and multiplying your potential.",
        ],
        imageUrl: `${STORAGE_BASE_URL_CV}/600x338/1a1a2e/4682B4/png?text=Use+It+or+Lose+It`,
        imageAlt: "A strong hand holding a tool, symbolizing active use",
      },
      {
        id: "reading-learning",
        icon: "::FaBookOpenReader::",
        title: "Fuel for Growth: Reading & Learning",
        points: [
          "<strong class='text-brand-yellow'>All successful people are voracious readers and learners.</strong>",
          "One book can save you five years of life, warning against mistakes or opening new paths.",
          "Don't leave your success and development to chance. Make them a subject of study.",
          "Dive into <Link href='/selfdev' class='text-brand-blue hover:underline font-semibold'>SelfDev</Link>, read, analyze, apply. This is your path to mastery in CyberVibe.",
        ],
        imageUrl: `${STORAGE_BASE_URL_CV}/600x338/1a1a2e/8B4513/png?text=Reading+is+Power`,
        imageAlt: "An open book emitting the light of knowledge",
      },
    ]
  }
};

export default function CyberVibePage() {
  const { user } = useAppContext();
  const [isMounted, setIsMounted] = useState(false);
  const [selectedLang, setSelectedLang] = useState<Language>('ru'); 
  const heroTriggerId = useId().replace(/:/g, "-") + "-hero-trigger"; // Added for RockstarHeroSection

  useEffect(() => {
    setIsMounted(true);
    const browserLang = typeof navigator !== 'undefined' ? navigator.language.split('-')[0] : 'ru';
    const initialLang = user?.language_code === 'ru' || (!user?.language_code && browserLang === 'ru') ? 'ru' : 'en'; 
    setSelectedLang(initialLang);
    logger.log(`[CyberVibePage] Mounted. Browser lang: ${browserLang}, Initial selected: ${initialLang}`);
  }, [user?.language_code]); 

  const t = pageTranslations[selectedLang];

  if (!isMounted || !t) {
    return (
      <div className="flex justify-center items-center min-h-screen pt-20 bg-gradient-to-br from-gray-900 via-black to-gray-800">
        <p className="text-brand-yellow animate-pulse text-xl font-mono">Загрузка КиберВайб Матрицы...</p>
      </div>
    );
  }
  
  const themePalette = ["brand-yellow", "brand-cyan", "brand-orange", "brand-pink", "brand-red", "brand-purple", "brand-green", "brand-blue", "neon-lime"];

  return (
    <div className="relative min-h-screen bg-background text-foreground overflow-x-hidden">
      <RockstarHeroSection
        title={t.pageTitle}
        subtitle={t.pageSubtitle}
        triggerElementSelector={`#${heroTriggerId}`}
        backgroundImageObjectUrl="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/appStore/oneSitePls_transparent_icon.png"
      >
        <div className="flex space-x-2">
          <Button
            variant={selectedLang === 'ru' ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => setSelectedLang('ru')}
            className={cn(
              "border-brand-yellow/50 font-orbitron text-xs backdrop-blur-sm",
              selectedLang === 'ru' ? 'bg-brand-yellow/20 text-brand-yellow hover:bg-brand-yellow/30' : 'bg-black/30 text-gray-300 hover:bg-gray-700 hover:text-gray-100'
            )}
          >
            🇷🇺 Русский
          </Button>
          <Button
            variant={selectedLang === 'en' ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => setSelectedLang('en')}
            className={cn(
              "border-brand-blue/50 font-orbitron text-xs backdrop-blur-sm",
              selectedLang === 'en' ? 'bg-brand-blue/20 text-brand-blue hover:bg-brand-blue/30' : 'bg-black/30 text-gray-300 hover:bg-gray-700 hover:text-gray-100'
            )}
          >
            🇬🇧 English
          </Button>
        </div>
      </RockstarHeroSection>
      
      <div id={heroTriggerId} style={{ height: '150vh' }} aria-hidden="true" />

      <div className="relative z-10 container mx-auto px-4 pt-10 pb-10"> {/* Added pt-10 */}
        <Card className="max-w-4xl mx-auto bg-black/85 backdrop-blur-xl text-white rounded-2xl border-2 border-brand-yellow/50 shadow-[0_0_35px_theme(colors.brand-yellow/0.5)]">
          {/* CardHeader removed as title/subtitle are in RockstarHeroSection now */}
          <CardContent className="space-y-12 p-4 md:p-8 pt-8"> {/* Added pt-8 */}
            {/* Language toggle buttons were moved to RockstarHeroSection children */}

            {t.sections.map((section, index) => {
              const currentThemeColor = themePalette[index % themePalette.length];
              const textColorClass = `text-${currentThemeColor}`;
              const borderColorClass = `border-${currentThemeColor}/60`;
              const shadowColorClass = `hover:shadow-${currentThemeColor}/30`;

              return (
                <motion.section 
                  key={section.id} 
                  className={cn(
                    `space-y-4 border-l-4 pl-4 md:pl-6 py-4 rounded-r-lg bg-dark-card/50 transition-shadow duration-300`,
                     borderColorClass,
                     shadowColorClass
                  )}
                  initial={{ opacity: 0, x: -30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                >
                  <h2 className={cn(`flex items-center text-2xl md:text-3xl font-semibold mb-3 font-orbitron`, textColorClass)}>
                    <span className={cn(`mr-3 text-current/80`)}>
                      <VibeContentRenderer content={section.icon} />
                    </span>
                    <VibeContentRenderer content={section.title} />
                  </h2>

                  {section.points.map((point, i) => (
                    <div key={i} className="text-gray-300 text-base md:text-lg leading-relaxed prose prose-sm md:prose-base prose-invert max-w-none prose-strong:font-orbitron prose-a:text-brand-blue hover:prose-a:text-brand-cyan prose-li:marker:text-current">
                        <VibeContentRenderer content={`• ${point}`} />
                    </div>
                  ))}
                  
                  {section.imageUrl && (
                    <div className={cn(`my-5 p-1 border rounded-md bg-black/20 max-w-sm mx-auto`, borderColorClass.replace('/60','/30'))}>
                       <div className="aspect-video w-full h-auto overflow-hidden rounded bg-gray-800/40 relative">
                        <Image
                            src={section.imageUrl} alt={section.imageAlt} width={600} height={338}
                            className="w-full h-full object-cover opacity-80 hover:opacity-100 transition-opacity duration-300"
                            loading="lazy" placeholder="blur" blurDataURL={PLACEHOLDER_BLUR_URL_CV}
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                       </div>
                      <p className="text-xs text-center text-gray-400 mt-1 italic">{section.imageAlt}</p>
                    </div>
                  )}
                </motion.section>
              );
            })}

            <section className="text-center pt-10 border-t border-brand-yellow/20 mt-10">
               <VibeContentRenderer 
                  content="Джим Рон оставил наследие мудрости. Твоя задача – взять эти принципы, пропустить через фильтр своего КиберВайба и построить жизнь, достойную легенды. <strong class='text-brand-yellow'>Ты – архитектор своего будущего.</strong>" 
                  className="text-lg text-gray-300 italic prose prose-invert max-w-none prose-strong:text-brand-yellow"
                />
                <div className="mt-8 flex flex-wrap justify-center gap-3">
                    <Button asChild variant="outline" className="border-brand-blue text-brand-blue hover:bg-brand-blue/10 font-orbitron">
                        <Link href="/selfdev">SelfDev Лаборатория</Link>
                    </Button>
                     <Button asChild variant="outline" className="border-brand-green text-brand-green hover:bg-brand-green/10 font-orbitron">
                        <Link href="/purpose-profit">Цель и Прибыль</Link>
                    </Button>
                    <Button asChild variant="outline" className="border-brand-pink text-brand-pink hover:bg-brand-pink/10 font-orbitron">
                        <Link href="/expmind">Мышление Экспериментатора</Link>
                    </Button>
                </div>
            </section>

          </CardContent>
        </Card>
      </div>
    </div>
  );
}