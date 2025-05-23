"use client";

import React, { useState, useEffect, useId } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAppContext } from "@/contexts/AppContext";
import { VibeContentRenderer } from "@/components/VibeContentRenderer";
import { debugLogger as logger } from "@/lib/debugLogger";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import RockstarHeroSection from "../tutorials/RockstarHeroSection";

type Language = 'en' | 'ru';

const STORAGE_BASE_URL_VT = "https://placehold.co"; // Using a new base URL for placeholders
const PLACEHOLDER_BLUR_URL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="; 

const pageTranslations = {
  ru: {
    pageTitle: "Что не так с ИИ и Обучением",
    pageSubtitle: "Дерек Мюллер (Veritasium) о том, почему технологии не революционизируют образование, и как работает наш мозг.",
    source: "По мотивам лекции Veritasium: What Everyone Gets Wrong About AI and Learning",
    sections: [
      {
        id: "intro-revolution",
        icon: "::FaRocket::",
        title: "Обещания Революции и Реальность",
        points: [
          "ИИ-тьюторы впечатляют, но история полна обещаний о революции в образовании (кино, радио, ТВ, компьютеры, MOOCs).",
          "Томас Эдисон в 1922 году предсказывал, что кино заменит учебники. Этого не произошло.",
          "Эти технологии не произвели революции. Почему? Возможно, проблема не в доступе к информации.",
        ],
        imageUrl: `${STORAGE_BASE_URL_VT}/600x338/2e1a1a/FF0000/png?text=Революции+Образования`,
        imageAlt: "Старые технологии, обещающие революцию в образовании",
      },
      {
        id: "two-systems",
        icon: "::FaBrain::",
        title: "Две Системы Мышления: Быстрая и Медленная",
        points: [
          "Даниэль Канеман: <strong class='text-brand-yellow'>Система 1</strong> (быстрая, интуитивная, автоматическая) и <strong class='text-brand-blue'>Система 2</strong> (медленная, сознательная, требует усилий).",
          "Примеры: задача с битой и мячом, Земля вокруг Солнца.",
          "Система 2 ленива и склонна принимать быстрые ответы Системы 1 без проверки.",
          "Цель обучения: развивать Систему 1 так, чтобы сложные задачи стали автоматическими.",
        ],
        imageUrl: `${STORAGE_BASE_URL_VT}/600x338/1a1a2e/FFEE00/png?text=Системы+Мышления`,
        imageAlt: "Две фигуры, символизирующие Систему 1 (быструю) и Систему 2 (медленную)",
      },
      {
        id: "cognitive-load",
        icon: "::FaWeightHanging::",
        title: "Пределы Рабочей Памяти: Когнитивная Нагрузка",
        points: [
          "Рабочая память Системы 2 очень ограничена (~4 элемента).",
          "Когнитивная нагрузка измеряется, например, расширением зрачков при интенсивном мышлении.",
          "Три типа нагрузки: <strong class='text-brand-red'>Внутренняя</strong> (сложность самой задачи), <strong class='text-brand-orange'>Внешняя</strong> (отвлекающие факторы), <strong class='text-brand-green'>Полезная</strong> (мышление о мышлении, осмысление для долгосрочного хранения).",
        ],
        imageUrl: `${STORAGE_BASE_URL_VT}/600x338/1a1a2e/FF9900/png?text=Когнитивная+Нагрузка`,
        imageAlt: "Схематичное изображение мозга с индикаторами нагрузки",
      },
      {
        id: "mastery-chunking",
        icon: "::FaDumbbell::",
        title: "Мастерство и Чанкинг: Как Эксперты Думают Быстрее",
        points: [
          "Эксперты (например, шахматисты) видят сложные паттерны ('чанки'), что позволяет им обходить ограничения рабочей памяти.",
          "Чанкинг – это объединение разрозненной информации в единую сущность, что делает её легче для запоминания.",
          "Например, 1945 – это не четыре цифры, а год окончания войны. Для физика уравнение — это один 'чанк'.",
          "Нет 'общего навыка мышления'; есть глубокие, специализированные сети долгосрочной памяти, которые Система 1 использует автоматически.",
        ],
        imageUrl: `${STORAGE_BASE_URL_VT}/600x338/1a1a2e/4682B4/png?text=Мастерство+и+Чанкинг`,
        imageAlt: "Шахматная доска с фигурами, показывающая паттерны",
      },
      {
        id: "implications",
        icon: "::FaGraduationCap::",
        title: "Приложения к Образованию",
        subSections: [
          {
            title: "1. Устранение Внешней Когнитивной Нагрузки",
            icon: "::FaEraser::",
            points: ["Обеспечьте комфортное место, читаемый текст, чистый звук.", "Уберите отвлекающие факторы, чтобы Система 2 могла сосредоточиться."],
            borderColor: "border-brand-pink", textColor: "text-brand-pink",
          },
          {
            title: "2. Ограничение Внутренней Когнитивной Нагрузки",
            icon: "::FaDivide::",
            points: ["Материал должен быть подан 'небольшими порциями' (bite-sized).", "Замедлите процесс обучения; позволяйте студентам играть знакомые мелодии для освоения инструмента."],
            borderColor: "border-brand-blue", textColor: "text-brand-blue",
          },
          {
            title: "3. Осторожность с 'Обучением Через Открытия'",
            icon: "::FaHandshakeSlash::",
            points: ["Слишком раннее удаление 'лесов' (поддержки) приводит к фрустрации.", "Используйте 'решенные примеры' и постепенно уменьшайте помощь, чтобы облегчить активацию Системы 2."],
            borderColor: "border-brand-yellow", textColor: "text-brand-yellow",
          },
          {
            title: "4. Продуктивная Сложность (Germane Load)",
            icon: "::FaPuzzlePiece::",
            points: ["Небольшие трудности могут заставить Систему 2 активироваться (например, трудный для чтения шрифт в тесте).", "Это заставляет мозг 'думать о мышлении' и формировать полезные паттерны."],
            borderColor: "border-neon-lime", textColor: "text-neon-lime",
          },
        ],
      },
      {
        id: "ais-role",
        icon: "::FaPeopleGroup::",
        title: "Истинная Роль ИИ и Суть Образования",
        points: [
          "<strong class='text-brand-green'>Позитивная роль ИИ:</strong> Мгновенная обратная связь, что критически важно для обучения любому навыку.",
          "<strong class='text-brand-red'>Главная опасность ИИ:</strong> Снижение необходимости в усилиях. Если ИИ делает работу за нас (написание эссе, рисование), мозг лишается необходимой 'болезненной, но полезной' практики.",
          "Образование – это не проблема доступа к информации (книги всегда были доступны).",
          "Образование – это <strong class='text-brand-purple'>социальная активность</strong>: Учитель, другие ученики, общение, ответственность.",
          "Учителя – это 'персональные тренеры' для ума, которые мотивируют и удерживают в процессе, заставляя 'делать повторения'.",
          "Поэтому никакая технология не произведет 'революции' в образовании; его суть остается человеческой и социальной.",
        ],
        imageUrl: `${STORAGE_BASE_URL_VT}/600x338/1a1a2e/9D00FF/png?text=Социальное+Обучение`,
        imageAlt: "Группа людей, взаимодействующих в процессе обучения",
      },
    ]
  },
  en: {
    pageTitle: "What Everyone Gets Wrong About AI and Learning",
    pageSubtitle: "Derek Muller (Veritasium) on why technology won't revolutionize education and how our brains learn.",
    source: "Based on Veritasium's lecture: What Everyone Gets Wrong About AI and Learning",
    sections: [
      {
        id: "intro-revolution",
        icon: "::FaRocket::",
        title: "The Promise of Revolution and Reality",
        points: [
          "AI tutors are impressive, but history is filled with promises of educational revolution (movies, radio, TV, computers, MOOCs).",
          "Thomas Edison in 1922 predicted motion pictures would supplant textbooks. It didn't happen.",
          "These technologies haven't revolutionized education. Why? Perhaps the problem isn't access to information.",
        ],
        imageUrl: `${STORAGE_BASE_URL_VT}/600x338/2e1a1a/FF0000/png?text=Education+Revolutions`,
        imageAlt: "Old technologies promising revolution in education",
      },
      {
        id: "two-systems",
        icon: "::FaBrain::",
        title: "Our Two Minds: System 1 & System 2",
        points: [
          "Daniel Kahneman: <strong class='text-brand-yellow'>System 1</strong> (fast, intuitive, automatic) and <strong class='text-brand-blue'>System 2</strong> (slow, conscious, effortful).",
          "Examples: The bat and ball problem, Earth around the Sun.",
          "System 2 is lazy and tends to accept System 1's quick answers without checking.",
          "The goal of education: to develop System 1 so that complex tasks become automatic.",
        ],
        imageUrl: `${STORAGE_BASE_URL_VT}/600x338/1a1a2e/FFEE00/png?text=Systems+of+Thought`,
        imageAlt: "Two figures symbolizing System 1 (fast) and System 2 (slow)",
      },
      {
        id: "cognitive-load",
        icon: "::FaWeightHanging::",
        title: "Limits of Working Memory: Cognitive Load",
        points: [
          "System 2's working memory is very limited (~4 items).",
          "Cognitive load can be measured by pupil dilation during intense thinking.",
          "Three types of load: <strong class='text-brand-red'>Intrinsic</strong> (inherent task difficulty), <strong class='text-brand-orange'>Extraneous</strong> (distractions), <strong class='text-brand-green'>Germane</strong> (thinking about thinking, processing for long-term storage).",
        ],
        imageUrl: `${STORAGE_BASE_URL_VT}/600x338/1a1a2e/FF9900/png?text=Cognitive+Load`,
        imageAlt: "Diagram of a brain with load indicators",
      },
      {
        id: "mastery-chunking",
        icon: "::FaDumbbell::",
        title: "Mastery & Chunking: How Experts Think Faster",
        points: [
          "Experts (e.g., chess masters) see complex patterns ('chunks'), overcoming working memory limitations.",
          "Chunking is grouping disparate information into a single entity, making it easier to remember.",
          "E.g., 1945 is not four digits, but the year WWII ended. For a physicist, an equation is one 'chunk'.",
          "There's no 'general thinking skill'; rather, deep, specialized long-term memory networks that System 1 uses automatically.",
        ],
        imageUrl: `${STORAGE_BASE_URL_VT}/600x338/1a1a2e/4682B4/png?text=Mastery+and+Chunking`,
        imageAlt: "Chess board with pieces illustrating patterns",
      },
      {
        id: "implications",
        icon: "::FaGraduationCap::",
        title: "Implications for Education",
        subSections: [
          {
            title: "1. Eliminate Extraneous Cognitive Load",
            icon: "::FaEraser::",
            points: ["Provide a comfortable seat, legible text, pristine sound.", "Remove distractions so System 2 can focus."],
            borderColor: "border-brand-pink", textColor: "text-brand-pink",
          },
          {
            title: "2. Limit Intrinsic Cognitive Load",
            icon: "::FaDivide::",
            points: ["Present material in 'bite-sized' chunks.", "Slow things down; allow students to play known songs to master an instrument."],
            borderColor: "border-brand-blue", textColor: "text-brand-blue",
          },
          {
            title: "3. Be Wary of 'Discovery Learning'",
            icon: "::FaHandshakeSlash::",
            points: ["Removing 'scaffolding' too early leads to frustration.", "Use 'worked examples' and gradually fade assistance to facilitate System 2 engagement."],
            borderColor: "border-brand-yellow", textColor: "text-brand-yellow",
          },
          {
            title: "4. Embrace Productive Difficulty (Germane Load)",
            icon: "::FaPuzzlePiece::",
            points: ["Slightly harder tasks can force System 2 activation (e.g., hard-to-read font in a test).", "This forces the brain to 'think about thinking' and form useful patterns."],
            borderColor: "border-neon-lime", textColor: "text-neon-lime",
          },
        ],
      },
      {
        id: "ais-role",
        icon: "::FaPeopleGroup::",
        title: "AI's True Role & The Core of Education",
        points: [
          "<strong class='text-brand-green'>Positive role of AI:</strong> Provides timely feedback, which is crucial for learning any skill.",
          "<strong class='text-brand-red'>Major concern with AI:</strong> Reduces the need for effort. If AI does work for us (essay writing, drawing), the brain is deprived of necessary 'painful but useful' practice.",
          "Education is not a problem of information access (books have always been available).",
          "Education is a <strong class='text-brand-purple'>social activity</strong>: Teacher, other learners, interaction, accountability.",
          "Teachers are 'personal trainers' for the mind, motivating and holding accountable, forcing 'reps'.",
          "Therefore, no technology will 'revolutionize' education; its essence remains human and social.",
        ],
        imageUrl: `${STORAGE_BASE_URL_VT}/600x338/1a1a2e/9D00FF/png?text=Social+Learning`,
        imageAlt: "A group of people interacting in a learning setting",
      },
    ]
  }
};

export default function VeritasiumPage() {
  const { user } = useAppContext();
  const [isMounted, setIsMounted] = useState(false);
  const [selectedLang, setSelectedLang] = useState<Language>('ru'); 
  const heroTriggerId = useId().replace(/:/g, "-") + "-veritasium-hero-trigger"; // Unique ID for this page

  useEffect(() => {
    setIsMounted(true);
    const browserLang = typeof navigator !== 'undefined' ? navigator.language.split('-')[0] : 'ru';
    const initialLang = user?.language_code === 'ru' || (!user?.language_code && browserLang === 'ru') ? 'ru' : 'en'; 
    setSelectedLang(initialLang);
    logger.log(`[VeritasiumPage] Mounted. Browser lang: ${browserLang}, Initial selected: ${initialLang}`);
  }, [user?.language_code]); 

  if (!isMounted) {
    return (
      <div className="flex justify-center items-center min-h-screen pt-20 bg-gradient-to-br from-gray-900 via-black to-gray-800">
        <p className="text-brand-cyan animate-pulse text-xl font-mono">Загрузка озарений Veritasium...</p>
      </div>
    );
  }

  const t = pageTranslations[selectedLang];
  
  // Adjusted theme palette for Veritasium, slightly different colors but still vibrant
  const themePalette = ["brand-cyan", "brand-yellow", "brand-red", "brand-blue", "brand-pink", "brand-green", "brand-purple", "neon-lime"];

  return (
    <div className="relative min-h-screen overflow-x-hidden pb-10 bg-gradient-to-br from-gray-900 via-black to-gray-800 text-gray-200">
      <div
        className="absolute inset-0 bg-repeat opacity-[0.03] z-0" 
        style={{
          backgroundImage: `linear-gradient(to right, rgba(0, 255, 255, 0.4) 1px, transparent 1px),
                            linear-gradient(to bottom, rgba(0, 255, 255, 0.4) 1px, transparent 1px)`,
          backgroundSize: '60px 60px', 
        }}
      ></div>

      <RockstarHeroSection
        triggerElementSelector={`#${heroTriggerId}`}
        backgroundImageObjectUrl="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/aPAQbwg_700b-62cff769-b043-4043-923d-76a1e9e4b71f.jpg"
      >
        <h1 className="text-3xl md:text-5xl font-bold text-brand-cyan cyber-text glitch" data-text={t.pageTitle}>
          {t.pageTitle}
        </h1>
        <p className="text-md md:text-lg text-gray-300 mt-3 font-mono">
          {t.pageSubtitle}
        </p>
        <p className="text-sm text-gray-400 mt-1">{t.source}</p>
        <div className="flex justify-center space-x-2 mt-4">
           <Button
             variant={selectedLang === 'ru' ? 'secondary' : 'outline'}
             size="sm"
             onClick={() => setSelectedLang('ru')}
             className={cn(
                 "border-brand-cyan/50 font-orbitron text-xs backdrop-blur-sm", 
                 selectedLang === 'ru' ? 'bg-brand-cyan/20 text-brand-cyan hover:bg-brand-cyan/30' : 'bg-black/30 text-gray-300 hover:bg-gray-700 hover:text-gray-100'
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

      <div className="relative z-10 container mx-auto px-4 pt-10">
        <Card className="max-w-4xl mx-auto bg-black/85 backdrop-blur-lg text-white rounded-2xl border border-brand-cyan/30 shadow-[0_0_30px_rgba(0,255,255,0.3)]">
          <CardContent className="space-y-12 p-4 md:p-8 pt-8">

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
                  <h2 className={cn(`flex items-center text-2xl md:text-3xl font-semibold mb-4 font-orbitron`, textColorClass)}>
                    <span className={cn('mr-3 text-current/80')}>
                      <VibeContentRenderer content={section.icon} />
                    </span>
                    <VibeContentRenderer content={section.title} />
                  </h2>

                  {section.intro && <p className="text-gray-300 leading-relaxed mb-4">{section.intro}</p>}

                   {section.subSections && section.subSections.map((sub, subIndex) => (
                       <div key={`${section.id}-sub-${subIndex}`} className={`ml-4 pl-4 border-l-2 ${sub.borderColor} space-y-3 mb-6`}>
                         <h3 className={`flex items-center text-xl font-semibold ${sub.textColor}`}>
                           <span className="mr-2">
                             <VibeContentRenderer content={sub.icon} />
                           </span>
                           <VibeContentRenderer content={sub.title} />
                         </h3>
                         <ul className="list-disc list-outside space-y-2 text-gray-300 pl-5 text-base md:text-lg leading-relaxed prose prose-sm md:prose-base prose-invert max-w-none prose-strong:font-orbitron prose-a:text-brand-blue hover:prose-a:text-brand-cyan prose-li:marker:text-current">
                           {sub.points.map((point, i) => (
                             <li key={`${section.id}-sub-${subIndex}-${i}`} dangerouslySetInnerHTML={{ __html: point }}></li>
                           ))}
                         </ul>
                         {sub.imageUrl && (
                           <div className={`my-4 p-1 border ${sub.borderColor}/30 rounded-md bg-black/20 max-w-sm mx-auto`}>
                             <Image
                               src={sub.imageUrl} alt={sub.imageAlt} width={600} height={338}
                               className="w-full h-auto object-cover rounded opacity-80" loading="lazy" placeholder="blur" blurDataURL={PLACEHOLDER_BLUR_URL}
                             />
                             <p className="text-xs text-center text-gray-400 mt-1 italic">{sub.imageAlt}</p>
                           </div>
                         )}
                       </div>
                   ))}

                  {/* Render main section points if no subSections */}
                  {!section.subSections && section.points.length > 0 && (
                    <ul className="list-disc list-outside space-y-2 text-gray-300 pl-5 text-base md:text-lg leading-relaxed prose prose-sm md:prose-base prose-invert max-w-none prose-strong:font-orbitron prose-a:text-brand-blue hover:prose-a:text-brand-cyan prose-li:marker:text-current">
                      {section.points.map((point, i) => (
                        <li key={`${section.id}-${i}`} dangerouslySetInnerHTML={{ __html: point }}></li>
                      ))}
                    </ul>
                  )}

                  {section.imageUrl && !section.subSections && (
                    <div className={cn(`my-5 p-1 border rounded-md bg-black/20 max-w-sm mx-auto`, borderColorClass.replace('/60','/30'))}>
                       <div className="aspect-video w-full h-auto overflow-hidden rounded bg-gray-800/40 relative">
                        <Image
                            src={section.imageUrl} alt={section.imageAlt} width={600} height={338}
                            className="w-full h-full object-cover opacity-80 hover:opacity-100 transition-opacity duration-300"
                            loading="lazy" placeholder="blur" blurDataURL={PLACEHOLDER_BLUR_URL}
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                       </div>
                      <p className="text-xs text-center text-gray-400 mt-1 italic">{section.imageAlt}</p>
                    </div>
                  )}

                  {section.outro && <p className="text-gray-300 leading-relaxed mt-4 italic" dangerouslySetInnerHTML={{ __html: section.outro }}></p>}

                </motion.section>
              );
            })}

            <section className="text-center pt-10 border-t border-brand-cyan/20 mt-10">
               <VibeContentRenderer 
                  content={selectedLang === 'ru' 
                    ? "Уроки Дерека Мюллера напоминают нам: технологии – это инструменты, но сердце образования остается в человеческом взаимодействии, усилиях и социальной связи. <strong class='text-brand-cyan'>Прокачивай свой мозг, не ищи легких путей.</strong>"
                    : "Derek Muller's insights remind us: technology is a tool, but the heart of education remains in human interaction, effort, and social connection. <strong class='text-brand-cyan'>Train your brain, don't seek shortcuts.</strong>"
                  } 
                  className="text-lg text-gray-300 italic prose prose-invert max-w-none prose-strong:text-brand-cyan"
                />
                <div className="mt-8 flex flex-wrap justify-center gap-3">
                    <Button asChild variant="outline" className="border-brand-blue text-brand-blue hover:bg-brand-blue/10 font-orbitron">
                        <Link href="/expmind">Мышление Экспериментатора</Link>
                    </Button>
                     <Button asChild variant="outline" className="border-brand-yellow text-brand-yellow hover:bg-brand-yellow/10 font-orbitron">
                        <Link href="/cybervibe">КиберВайб Апгрейд</Link>
                    </Button>
                </div>
            </section>

          </CardContent>
        </Card>
      </div>
    </div>
  );
}