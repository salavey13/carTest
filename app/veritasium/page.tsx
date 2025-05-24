"use client";

import React, { useState, useEffect, useId, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAppContext } from "@/contexts/AppContext";
import { VibeContentRenderer } from "@/components/VibeContentRenderer";
import { debugLogger as logger } from "@/lib/debugLogger";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import RockstarHeroSection from "../tutorials/RockstarHeroSection";
import { Textarea } from "@/components/ui/textarea";
import { FaCircleInfo, FaTelegramPlane, FaBookmark, FaCheck } from "react-icons/fa6"; // Import FaCircleInfo, FaTelegramPlane, FaBookmark, FaCheck
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"; // Import Dialog components

type Language = 'en' | 'ru';

interface SectionQuestion {
  type: 'yes_no' | 'multiple_choice' | 'reflection';
  textRu: string;
  textEn: string;
  correctAnswer?: 'yes' | 'no' | string;
  optionsRu?: string[];
  optionsEn?: string[];
  tipRu?: string;
  tipEn?: string;
}

interface InfoDetail {
  titleRu: string;
  titleEn: string;
  contentRu: string;
  contentEn: string;
}

interface SectionContent {
  id: string;
  icon: string;
  title: string;
  points: string[];
  imageUrl?: string;
  imageAlt: string;
  question: SectionQuestion;
  notablePhrase?: {
    textRu: string;
    textEn: string;
  };
  infoDetails?: InfoDetail; // New field for additional info
}

const STORAGE_BASE_URL_VT = "https://placehold.co"; 
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
        question: {
          type: 'yes_no',
          textRu: "Томас Эдисон в начале 20 века точно предсказал, что кино полностью заменит учебники в образовании.",
          textEn: "Thomas Edison accurately predicted in the early 20th century that cinema would completely replace textbooks in education.",
          correctAnswer: 'no',
          tipRu: "На самом деле, его предсказание не сбылось. Технологии часто не революционизируют образование так, как ожидается.",
          tipEn: "Actually, his prediction didn't come true. Technologies often don't revolutionize education as expected.",
        },
        notablePhrase: {
          textRu: "Люди слишком возбуждены, слишком готовы поставить слово 'революционизировать' рядом с 'образованием'.",
          textEn: "People are all too excited, all too ready to put the word 'revolutionize' next to 'education'.",
        },
        infoDetails: {
          titleRu: "Почему 'революция' не произошла?",
          titleEn: "Why the 'revolution' didn't happen?",
          contentRu: "Дерек Мюллер указывает на историю, где каждая новая технология (кино, радио, ТВ, компьютеры, MOOCs) предсказывала 'революцию' в образовании, но по факту лишь становилась инструментом в руках учителей, не меняя фундаментальных принципов обучения.",
          contentEn: "Derek Muller points to history where every new technology (movies, radio, TV, computers, MOOCs) predicted an 'education revolution' but in reality only became a tool in the hands of teachers, without changing the fundamental principles of learning."
        }
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
        question: {
          type: 'multiple_choice',
          textRu: "Какой тип мышления, по Даниэлю Канеману, отвечает за быстрые, интуитивные ответы?",
          textEn: "Which type of thinking, according to Daniel Kahneman, is responsible for quick, intuitive answers?",
          optionsRu: ["Система 1", "Система 2", "Когнитивная нагрузка", "Чанкинг"],
          optionsEn: ["System 1", "System 2", "Cognitive Load", "Chunking"],
          correctAnswer: 'Система 1',
          tipRu: "Верно! Система 1 – это ваш 'автопилот' мышления.",
          tipEn: "Correct! System 1 is your thinking 'autopilot'."
        },
        notablePhrase: {
          textRu: "Наши мозги запрограммированы помогать нам быть эффективными в этом мире, а не обязательно понимать сложные концепции.",
          textEn: "Our brains are designed to help us be effective in this world, not necessarily to understand complex concepts.",
        },
        infoDetails: {
          titleRu: "Задача с битой и мячом / Земля вокруг Солнца",
          titleEn: "Bat and Ball / Earth and Sun Problems",
          contentRu: "Эти задачи демонстрируют, как Система 1 (быстрое, интуитивное мышление) склонна давать неверные ответы (10 центов; один день), потому что они кажутся легкими и 'правильными'. Система 2 (медленное, усилие) требуется для перепроверки и нахождения верного решения, но она ленива и часто не активируется без принуждения.",
          contentEn: "These problems demonstrate how System 1 (fast, intuitive thinking) tends to give incorrect answers (10 cents; one day) because they seem easy and 'right'. System 2 (slow, effortful) is required to re-check and find the correct solution, but it's lazy and often won't activate without prompting."
        }
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
        question: {
          type: 'yes_no',
          textRu: "Отвлекающие факторы во время обучения увеличивают полезную когнитивную нагрузку.",
          textEn: "Distractions during learning increase germane cognitive load.",
          correctAnswer: 'no',
          tipRu: "Наоборот, отвлекающие факторы увеличивают *внешнюю* когнитивную нагрузку, которая является нежелательной.",
          tipEn: "On the contrary, distractions increase *extraneous* cognitive load, which is undesirable.",
        },
        notablePhrase: {
          textRu: "Когнитивная нагрузка – это мера умственных усилий, которые вы вкладываете во что-то.",
          textEn: "Cognitive load is a measure of how much mental effort you are investing in something.",
        },
        infoDetails: {
          titleRu: "Эксперимент с расширением зрачков (Cognitive Load)",
          titleEn: "Pupil Dilation Experiment (Cognitive Load)",
          contentRu: "Дерек Мюллер продемонстрировал, что во время интенсивного умственного усилия (активации Системы 2), зрачки расширяются. Это показывает, насколько сильно мозг 'работает', и подтверждает ограниченность рабочей памяти. Чем больше усилий требует задача, тем сильнее зрачки реагируют.",
          contentEn: "Derek Muller demonstrated that during intense mental effort (System 2 activation), pupils dilate. This shows how hard the brain is 'working' and confirms the limited capacity of working memory. The more effort a task requires, the more the pupils react."
        }
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
        question: {
          type: 'yes_no',
          textRu: "Эксперты лучше запоминают случайное расположение шахматных фигур, чем новички, благодаря чанкингу.",
          textEn: "Experts remember random chess piece arrangements better than novices due to chunking.",
          correctAnswer: 'no',
          tipRu: "Чанкинг работает только с осмысленными паттернами. В случайных ситуациях эксперты не имеют преимущества.",
          tipEn: "Chunking only works with meaningful patterns. In random situations, experts have no advantage.",
        },
        notablePhrase: {
          textRu: "Мастерство – это когда навык становится доменом Системы 1, работая автоматически.",
          textEn: "Mastery is when a skill becomes a System 1 domain, operating automatically.",
        },
        infoDetails: {
          titleRu: "Исследование с шахматными мастерами (Чанкинг)",
          titleEn: "Chess Master Study (Chunking)",
          contentRu: "Исследование показало, что шахматные гроссмейстеры могли запомнить расположение 16 фигур на доске после 5 секунд просмотра, в то время как новички только 4. При случайном расположении фигур их способности выравнивались. Это демонстрирует, что эксперты 'чанкуют' информацию – объединяют её в осмысленные паттерны, хранящиеся в долгосрочной памяти, что позволяет Системе 1 обрабатывать её мгновенно.",
          contentEn: "A study showed that chess grandmasters could remember 16 pieces on a board after 5 seconds of viewing, while novices remembered only 4. With random piece arrangements, their abilities equalized. This demonstrates that experts 'chunk' information – grouping it into meaningful patterns stored in long-term memory, allowing System 1 to process it instantly."
        }
      },
      {
        id: "implications",
        icon: "::FaGraduationCap::",
        title: "Приложения к Образованию",
        points: [], // Main points moved to subSections for this section
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
            infoDetails: {
              titleRu: "Эксперимент с трудным для чтения шрифтом",
              titleEn: "Hard-to-Read Font Experiment",
              contentRu: "Исследование показало, что студенты, которым давали тест с трудночитаемым шрифтом, отвечали правильнее. Почему? Потому что это 'незначительное' усложнение заставляло их Систему 2 активироваться и работать более усердно, вместо того чтобы автоматически выплевывать первый попавшийся ответ. Это пример использования 'продуктивной сложности' для улучшения обучения.",
              contentEn: "A study showed that students given a test with a hard-to-read font answered more correctly. Why? Because this 'minor' difficulty forced their System 2 to activate and work harder, instead of automatically blurting out the first answer that came to mind. This is an example of using 'productive difficulty' to enhance learning."
            }
          },
        ],
        question: {
          type: 'yes_no',
          textRu: "Намеренное создание небольших трудностей в обучении может быть полезным для активации Системы 2.",
          textEn: "Intentionally creating minor difficulties in learning can be beneficial for activating System 2.",
          correctAnswer: 'yes',
          tipRu: "Именно так! Это увеличивает продуктивную когнитивную нагрузку, заставляя мозг активнее работать.",
          tipEn: "That's right! This increases germane cognitive load, prompting the brain to work more actively.",
        },
        notablePhrase: {
          textRu: "Незначительное усложнение задачи может 'включить' Систему 2.",
          textEn: "Slightly harder tasks can force System 2 activation.",
        }
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
        question: {
          type: 'multiple_choice',
          textRu: "Согласно Veritasium, основная проблема образования заключается в:",
          textEn: "According to Veritasium, the main problem in education is:",
          optionsRu: ["Недостаточном доступе к информации", "Отсутствии ИИ-тьюторов", "Недостатке усилий и социального взаимодействия", "Перегрузке информацией"],
          optionsEn: ["Lack of information access", "Absence of AI tutors", "Lack of effort and social interaction", "Information overload"],
          correctAnswer: 'Недостатке усилий и социального взаимодействия',
          tipRu: "Верно! Дерек Мюллер подчеркивает, что образование – это социальный процесс, требующий усилий и взаимодействия.",
          tipEn: "Correct! Derek Muller emphasizes that education is a social process requiring effort and interaction.",
        },
        notablePhrase: {
          textRu: "Самая большая опасность ИИ в образовании – это возможность избежать необходимой, но 'болезненной' практики.",
          textEn: "The biggest concern with AI in education is its opportunity to reduce effortful practice.",
        },
        infoDetails: {
          titleRu: "Концепция 'Un-рекламы'",
          titleEn: "'Un-advertising' Concept",
          contentRu: "Дерек Мюллер приводит пример 'Un-рекламы' (реклама страховой компании 'Un'), которая специально была сделана запутанной и неочевидной. Это заставляло Систему 2 зрителя активироваться, пытаясь понять, что это за реклама, вместо того чтобы Система 1 автоматически 'отфильтровывала' её как обычную рекламу. В результате, такая реклама становилась более запоминающейся и эффективной.",
          contentEn: "Derek Muller uses the example of 'Un-advertising' (an ad for the insurance company 'Un'), which was intentionally made confusing and non-obvious. This forced the viewer's System 2 to activate, trying to understand what the ad was about, instead of System 1 automatically 'filtering it out' as a regular ad. As a result, such advertising became more memorable and effective."
        }
      },
    ] as SectionContent[]
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
        question: {
          type: 'yes_no',
          textRu: "Томас Эдисон в начале 20 века точно предсказал, что кино полностью заменит учебники в образовании.",
          textEn: "Thomas Edison accurately predicted in the early 20th century that cinema would completely replace textbooks in education.",
          correctAnswer: 'no',
          tipRu: "На самом деле, его предсказание не сбылось. Технологии часто не революционизируют образование так, как ожидается.",
          tipEn: "Actually, his prediction didn't come true. Technologies often don't revolutionize education as expected.",
        },
        notablePhrase: {
          textRu: "Люди слишком возбуждены, слишком готовы поставить слово 'революционизировать' рядом с 'образованием'.",
          textEn: "People are all too excited, all too ready to put the word 'revolutionize' next to 'education'.",
        },
        infoDetails: {
          titleRu: "Почему 'революция' не произошла?",
          titleEn: "Why the 'revolution' didn't happen?",
          contentRu: "Дерек Мюллер указывает на историю, где каждая новая технология (кино, радио, ТВ, компьютеры, MOOCs) предсказывала 'революцию' в образовании, но по факту лишь становилась инструментом в руках учителей, не меняя фундаментальных принципов обучения.",
          contentEn: "Derek Muller points to history where every new technology (movies, radio, TV, computers, MOOCs) predicted an 'education revolution' but in reality only became a tool in the hands of teachers, without changing the fundamental principles of learning."
        }
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
        question: {
          type: 'multiple_choice',
          textRu: "Какой тип мышления, по Даниэлю Канеману, отвечает за быстрые, интуитивные ответы?",
          textEn: "Which type of thinking, according to Daniel Kahneman, is responsible for quick, intuitive answers?",
          optionsRu: ["Система 1", "Система 2", "Когнитивная нагрузка", "Чанкинг"],
          optionsEn: ["System 1", "System 2", "Cognitive Load", "Chunking"],
          correctAnswer: 'System 1',
          tipRu: "Верно! Система 1 – это ваш 'автопилот' мышления.",
          tipEn: "Correct! System 1 is your thinking 'autopilot'."
        },
        notablePhrase: {
          textRu: "Наши мозги запрограммированы помогать нам быть эффективными в этом мире, а не обязательно понимать сложные концепции.",
          textEn: "Our brains are designed to help us be effective in this world, not necessarily to understand complex concepts.",
        },
        infoDetails: {
          titleRu: "Задача с битой и мячом / Земля вокруг Солнца",
          titleEn: "Bat and Ball / Earth and Sun Problems",
          contentRu: "Эти задачи демонстрируют, как Система 1 (быстрое, интуитивное мышление) склонна давать неверные ответы (10 центов; один день), потому что они кажутся легкими и 'правильными'. Система 2 (медленное, усилие) требуется для перепроверки и нахождения верного решения, но она ленива и часто не активируется без принуждения.",
          contentEn: "These problems demonstrate how System 1 (fast, intuitive thinking) tends to give incorrect answers (10 cents; one day) because they seem easy and 'right'. System 2 (slow, effortful) is required to re-check and find the correct solution, but it's lazy and often won't activate without prompting."
        }
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
        question: {
          type: 'yes_no',
          textRu: "Отвлекающие факторы во время обучения увеличивают полезную когнитивную нагрузку.",
          textEn: "Distractions during learning increase germane cognitive load.",
          correctAnswer: 'no',
          tipRu: "Наоборот, отвлекающие факторы увеличивают *внешнюю* когнитивную нагрузку, которая является нежелательной.",
          tipEn: "On the contrary, distractions increase *extraneous* cognitive load, which is undesirable.",
        },
        notablePhrase: {
          textRu: "Когнитивная нагрузка – это мера умственных усилий, которые вы вкладываете во что-то.",
          textEn: "Cognitive load is a measure of how much mental effort you are investing in something.",
        },
        infoDetails: {
          titleRu: "Эксперимент с расширением зрачков (Cognitive Load)",
          titleEn: "Pupil Dilation Experiment (Cognitive Load)",
          contentRu: "Дерек Мюллер продемонстрировал, что во время интенсивного умственного усилия (активации Системы 2), зрачки расширяются. Это показывает, насколько сильно мозг 'работает', и подтверждает ограниченность рабочей памяти. Чем больше усилий требует задача, тем сильнее зрачки реагируют.",
          contentEn: "Derek Muller demonstrated that during intense mental effort (System 2 activation), pupils dilate. This shows how hard the brain is 'working' and confirms the limited capacity of working memory. The more effort a task requires, the more the pupils react."
        }
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
        question: {
          type: 'yes_no',
          textRu: "Эксперты лучше запоминают случайное расположение шахматных фигур, чем новички, благодаря чанкингу.",
          textEn: "Experts remember random chess piece arrangements better than novices due to chunking.",
          correctAnswer: 'no',
          tipRu: "Чанкинг работает только с осмысленными паттернами. В случайных ситуациях эксперты не имеют преимущества.",
          tipEn: "Chunking only works with meaningful patterns. In random situations, experts have no advantage.",
        },
        notablePhrase: {
          textRu: "Мастерство – это когда навык становится доменом Системы 1, работая автоматически.",
          textEn: "Mastery is when a skill becomes a System 1 domain, operating automatically.",
        },
        infoDetails: {
          titleRu: "Исследование с шахматными мастерами (Чанкинг)",
          titleEn: "Chess Master Study (Chunking)",
          contentRu: "Исследование показало, что шахматные гроссмейстеры могли запомнить расположение 16 фигур на доске после 5 секунд просмотра, в то время как новички только 4. При случайном расположении фигур их способности выравнивались. Это демонстрирует, что эксперты 'чанкуют' информацию – объединяют её в осмысленные паттерны, хранящиеся в долгосрочной памяти, что позволяет Системе 1 обрабатывать её мгновенно.",
          contentEn: "A study showed that chess grandmasters could remember 16 pieces on a board after 5 seconds of viewing, while novices remembered only 4. With random piece arrangements, their abilities equalized. This demonstrates that experts 'chunk' information – grouping it into meaningful patterns stored in long-term memory, allowing System 1 to process it instantly."
        }
      },
      {
        id: "implications",
        icon: "::FaGraduationCap::",
        title: "Implications for Education",
        points: [], // Main points moved to subSections for this section
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
            infoDetails: {
              titleRu: "Эксперимент с трудным для чтения шрифтом",
              titleEn: "Hard-to-Read Font Experiment",
              contentRu: "Исследование показало, что студенты, которым давали тест с трудночитаемым шрифтом, отвечали правильнее. Почему? Потому что это 'незначительное' усложнение заставляло их Систему 2 активироваться и работать более усердно, вместо того чтобы автоматически выплевывать первый попавшийся ответ. Это пример использования 'продуктивной сложности' для улучшения обучения.",
              contentEn: "A study showed that students given a test with a hard-to-read font answered more correctly. Why? Because this 'minor' difficulty forced their System 2 to activate and work harder, instead of automatically blurting out the first answer that came to mind. This is an example of using 'productive difficulty' to enhance learning."
            }
          },
        ],
        question: {
          type: 'multiple_choice',
          textRu: "Какой тип когнитивной нагрузки является желательным и способствует формированию полезных паттернов?",
          textEn: "Which type of cognitive load is desirable and contributes to forming useful patterns?",
          optionsRu: ["Внутренняя", "Внешняя", "Полезная", "Все типы"],
          optionsEn: ["Intrinsic", "Extraneous", "Germane", "All types"],
          correctAnswer: 'Полезная',
          tipRu: "Верно! Полезная нагрузка (Germane Load) заставляет мозг 'думать о мышлении' и закреплять знания.",
          tipEn: "Correct! Germane Load makes the brain 'think about thinking' and consolidate knowledge.",
        },
        notablePhrase: {
          textRu: "Намеренное усложнение задачи может 'включить' Систему 2.",
          textEn: "Intentionally making a task slightly harder can 'kick System 2 into action'.",
        }
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
        question: {
          type: 'reflection',
          textRu: "Как вы думаете, как можно использовать ИИ для обеспечения 'усиленной практики' в обучении, а не для избегания её?",
          textEn: "How do you think AI can be used to ensure 'effortful practice' in learning, rather than avoiding it?",
          tipRu: "Отличные идеи! ИИ может стать мощным инструментом для персонализированной практики и обратной связи, если использовать его с умом.",
          tipEn: "Great ideas! AI can be a powerful tool for personalized practice and feedback if used wisely.",
        },
        notablePhrase: {
          textRu: "Образование – это не проблема доступа к информации; это социальная активность, требующая усилий и взаимодействия.",
          textEn: "Education is not a problem of information access; it's a social activity requiring effort and interaction.",
        },
        infoDetails: {
          titleRu: "Концепция 'Un-рекламы'",
          titleEn: "'Un-advertising' Concept",
          contentRu: "Дерек Мюллер приводит пример 'Un-рекламы' (реклама страховой компании 'Un'), которая специально была сделана запутанной и неочевидной. Это заставляло Систему 2 зрителя активироваться, пытаясь понять, что это за реклама, вместо того чтобы Система 1 автоматически 'отфильтровывала' её как обычную рекламу. В результате, такая реклама становилась более запоминающейся и эффективной.",
          contentEn: "Derek Muller uses the example of 'Un-advertising' (an ad for the insurance company 'Un'), which was intentionally made confusing and non-obvious. This forced the viewer's System 2 to activate, trying to understand what the ad was about, instead of System 1 automatically 'filtering it out' as a regular ad. As a result, such advertising became more memorable and effective."
        }
      },
    ] as SectionContent[]
  }
};

export default function VeritasiumPage() {
  const { user, tg, isInTelegramContext } = useAppContext();
  const [isMounted, setIsMounted] = useState(false);
  const [selectedLang, setSelectedLang] = useState<Language>('ru'); 
  const heroTriggerId = useId().replace(/:/g, "-") + "-veritasium-hero-trigger"; 

  const [visibleSectionIds, setVisibleSectionIds] = useState<Set<string>>(new Set());
  const [answeredQuestions, setAnsweredQuestions] = useState<Record<string, { answered: boolean; correct?: boolean }>>({});
  const [currentActiveQuestionId, setCurrentActiveQuestionId] = useState<string | null>(null);
  const [showTipFor, setShowTipFor] = useState<string | null>(null);
  const [reflectionText, setReflectionText] = useState<string>("");
  const [savedNotes, setSavedNotes] = useState<string[]>([]);
  const [noteSavedFeedback, setNoteSavedFeedback] = useState<Record<string, boolean>>({});

  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [currentInfoModalContent, setCurrentInfoModalContent] = useState<InfoDetail | null>(null);

  useEffect(() => {
    setIsMounted(true);
    const browserLang = typeof navigator !== 'undefined' ? navigator.language.split('-')[0] : 'ru';
    const initialLang = user?.language_code === 'ru' || (!user?.language_code && browserLang === 'ru') ? 'ru' : 'en'; 
    setSelectedLang(initialLang);
    logger.log(`[VeritasiumPage] Mounted. Browser lang: ${browserLang}, Initial selected: ${initialLang}`);
  }, [user?.language_code]); 

  const t = pageTranslations[selectedLang];
  
  useEffect(() => {
    if (isMounted && t && t.sections.length > 0 && visibleSectionIds.size === 0) {
        setVisibleSectionIds(new Set([t.sections[0].id]));
        setCurrentActiveQuestionId(t.sections[0].id);
    }
  }, [isMounted, t, visibleSectionIds.size]);

  const handleAnswer = useCallback((sectionId: string, userAnswer: 'yes' | 'no' | string, questionType: SectionQuestion['type'], nextSectionId?: string) => {
    const section = t.sections.find(s => s.id === sectionId);
    if (!section || !section.question) return;

    let isCorrect: boolean | undefined;

    if (questionType === 'yes_no' || questionType === 'multiple_choice') {
        isCorrect = userAnswer === section.question.correctAnswer;
    } else if (questionType === 'reflection') {
        isCorrect = true; 
        setReflectionText(""); 
    }

    setAnsweredQuestions(prev => ({
        ...prev,
        [sectionId]: { answered: true, correct: isCorrect }
    }));

    if (isCorrect === false) { 
        setShowTipFor(sectionId);
    } else {
        setShowTipFor(null); 
    }

    if (nextSectionId) {
        setVisibleSectionIds(prev => new Set(prev.add(nextSectionId)));
        setCurrentActiveQuestionId(nextSectionId);
    } else {
        setCurrentActiveQuestionId(null); 
    }
  }, [t.sections]);

  const handleSaveNote = useCallback((noteText: string, sectionId: string) => {
    if (!savedNotes.includes(noteText)) {
      setSavedNotes(prevNotes => [...prevNotes, noteText]);
      setNoteSavedFeedback(prev => ({ ...prev, [sectionId]: true }));
      setTimeout(() => setNoteSavedFeedback(prev => ({ ...prev, [sectionId]: false })), 2000); 
    }
  }, [savedNotes]);

  const handleSendNotesToTelegram = useCallback(() => {
    if (savedNotes.length === 0) return;

    const notesHeader = selectedLang === 'ru' ? "📝 Ваши заметки из Озарений Veritasium:\n\n" : "📝 Your notes from Veritasium Insights:\n\n";
    const formattedNotes = savedNotes.map((note, index) => `${index + 1}. ${note}`).join('\n');
    const message = encodeURIComponent(notesHeader + formattedNotes + "\n\n#Veritasium #oneSitePls");

    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent("https://t.me/oneSitePlsBot/app")}&text=${message}`;

    if (isInTelegramContext && tg) {
      tg.openLink(shareUrl);
    } else {
      window.open(shareUrl, "_blank");
    }
  }, [savedNotes, selectedLang, isInTelegramContext, tg]);

  const openInfoModal = useCallback((content: InfoDetail) => {
    setCurrentInfoModalContent(content);
    setIsInfoModalOpen(true);
  }, []);

  const closeInfoModal = useCallback(() => {
    setIsInfoModalOpen(false);
    setCurrentInfoModalContent(null);
  }, []);

  if (!isMounted || !t) {
    return (
      <div className="flex justify-center items-center min-h-screen pt-20 bg-gradient-to-br from-gray-900 via-black to-gray-800">
        <p className="text-brand-cyan animate-pulse text-xl font-mono">Загрузка озарений Veritasium...</p>
      </div>
    );
  }
  
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
              const isSectionVisible = visibleSectionIds.has(section.id);
              const isQuestionAnswered = answeredQuestions[section.id]?.answered;
              const isCorrectAnswer = answeredQuestions[section.id]?.correct; 
              const nextSection = t.sections[index + 1];

              return (
                <motion.section 
                  key={section.id} 
                  id={section.id} 
                  className={cn(
                    `space-y-4 border-l-4 pl-4 md:pl-6 py-4 rounded-r-lg bg-dark-card/50 transition-shadow duration-300`,
                     borderColorClass,
                     shadowColorClass,
                     !isSectionVisible && 'opacity-30 pointer-events-none' 
                  )}
                  initial={{ opacity: 0, x: -30 }}
                  animate={{ opacity: isSectionVisible ? 1 : 0.3, x: isSectionVisible ? 0 : -30 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                >
                  <h2 className={cn(`flex items-center text-2xl md:text-3xl font-semibold mb-4 font-orbitron`, textColorClass)}>
                    <span className={cn('mr-3 text-current/80')}>
                      <VibeContentRenderer content={section.icon} />
                    </span>
                    <VibeContentRenderer content={section.title} />
                    {section.infoDetails && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="p-1 h-auto text-current/70 hover:text-current hover:bg-transparent ml-2"
                        onClick={() => openInfoModal(section.infoDetails!)}
                        aria-label={selectedLang === 'ru' ? "Подробнее" : "More info"}
                      >
                        <FaCircleInfo className="w-5 h-5" />
                      </Button>
                    )}
                  </h2>

                  {section.intro && <p className="text-gray-300 leading-relaxed mb-4">{section.intro}</p>}

                   {section.subSections?.map((sub, subIndex) => (
                       <div key={`${section.id}-sub-${subIndex}`} className={`ml-4 pl-4 border-l-2 ${sub.borderColor} space-y-3 mb-6`}>
                         <h3 className={`flex items-center text-xl font-semibold ${sub.textColor}`}>
                           <span className="mr-2">
                             <VibeContentRenderer content={sub.icon} />
                           </span>
                           <VibeContentRenderer content={sub.title} />
                           {sub.infoDetails && (
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="p-1 h-auto text-current/70 hover:text-current hover:bg-transparent ml-2"
                                onClick={() => openInfoModal(sub.infoDetails!)}
                                aria-label={selectedLang === 'ru' ? "Подробнее" : "More info"}
                              >
                                <FaCircleInfo className="w-5 h-5" />
                              </Button>
                            )}
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

                  {section.notablePhrase && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: 0.2 }}
                      className="my-6 p-4 rounded-lg bg-black/40 border border-brand-cyan/40 text-brand-cyan text-base md:text-lg italic font-semibold relative"
                    >
                      <p>{selectedLang === 'ru' ? section.notablePhrase.textRu : section.notablePhrase.textEn}</p>
                      <Button
                        onClick={() => handleSaveNote(selectedLang === 'ru' ? section.notablePhrase!.textRu : section.notablePhrase!.textEn, section.id)}
                        className={cn(
                          "absolute bottom-2 right-2 p-1.5 text-xs rounded-md font-mono",
                          noteSavedFeedback[section.id] ? "bg-brand-green/80 text-white" : "bg-brand-blue/30 text-brand-blue hover:bg-brand-blue/50"
                        )}
                        size="sm"
                      >
                        {noteSavedFeedback[section.id] ? (selectedLang === 'ru' ? "Сохранено! " : "Saved! ")}
                        <FaCheck className={cn("ml-1", noteSavedFeedback[section.id] ? "block" : "hidden")} />
                        {!noteSavedFeedback[section.id] && (selectedLang === 'ru' ? "Сохранить заметку" : "Save Note")}
                        {!noteSavedFeedback[section.id] && <FaBookmark className="ml-1" />}
                      </Button>
                    </motion.div>
                  )}

                  {section.outro && <p className="text-gray-300 leading-relaxed mt-4 italic" dangerouslySetInnerHTML={{ __html: section.outro }}></p>}

                  {section.question && !isQuestionAnswered && currentActiveQuestionId === section.id && (
                      <motion.div
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3 }}
                          className={cn("mt-6 p-4 rounded-lg border", "border-brand-yellow/50 bg-brand-yellow/10")}
                      >
                          <p className="text-lg font-semibold text-brand-yellow mb-4">
                              {selectedLang === 'ru' ? section.question.textRu : section.question.textEn}
                          </p>
                          {section.question.type === 'yes_no' && (
                              <div className="flex gap-4">
                                  <Button 
                                      onClick={() => handleAnswer(section.id, 'yes', 'yes_no', nextSection?.id)}
                                      className="bg-brand-green hover:bg-brand-green/80 text-white flex-1"
                                  >
                                      {selectedLang === 'ru' ? "Да" : "Yes"}
                                  </Button>
                                  <Button 
                                      onClick={() => handleAnswer(section.id, 'no', 'yes_no', nextSection?.id)}
                                      className="bg-brand-red hover:bg-brand-red/80 text-white flex-1"
                                  >
                                      {selectedLang === 'ru' ? "Нет" : "No"}
                                  </Button>
                              </div>
                          )}
                          {section.question.type === 'multiple_choice' && (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  {(selectedLang === 'ru' ? section.question.optionsRu : section.question.optionsEn)?.map((option, i) => (
                                      <Button
                                          key={i}
                                          onClick={() => handleAnswer(section.id, option, 'multiple_choice', nextSection?.id)}
                                          className="bg-brand-blue hover:bg-brand-blue/80 text-white"
                                      >
                                          {option}
                                      </Button>
                                  ))}
                              </div>
                          )}
                          {section.question.type === 'reflection' && (
                              <div className="flex flex-col gap-3">
                                  <Textarea 
                                      placeholder={selectedLang === 'ru' ? "Напишите здесь..." : "Write here..."}
                                      value={reflectionText}
                                      onChange={(e) => setReflectionText(e.target.value)}
                                      className="min-h-[80px] bg-black/30 border-brand-yellow/30 text-white placeholder-gray-500"
                                  />
                                  <Button 
                                      onClick={() => handleAnswer(section.id, reflectionText, 'reflection', nextSection?.id)}
                                      className="bg-brand-purple hover:bg-brand-purple/80 text-white font-orbitron"
                                      disabled={!reflectionText.trim()} 
                                  >
                                      {selectedLang === 'ru' ? "Готово" : "Done"}
                                  </Button>
                              </div>
                          )}
                      </motion.div>
                  )}

                  {section.question && isQuestionAnswered && (
                      <motion.div
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3, delay: 0.1 }}
                          className="mt-6 p-4 rounded-lg border border-gray-700 bg-gray-900/50"
                      >
                          {section.question.type !== 'reflection' && ( 
                              <p className={cn("font-bold text-lg", isCorrectAnswer ? "text-brand-green" : "text-brand-red")}>
                                  {isCorrectAnswer ? (selectedLang === 'ru' ? "Верно!" : "Correct!") : (selectedLang === 'ru' ? "Неверно." : "Incorrect.")}
                              </p>
                          )}
                          {(showTipFor === section.id || section.question.type === 'reflection' || isCorrectAnswer) && ( 
                              <p className="text-sm text-gray-400 mt-2">
                                  {selectedLang === 'ru' ? section.question.tipRu : section.question.tipEn}
                              </p>
                          )}
                          {nextSection && (
                              <Button 
                                  onClick={() => {
                                      document.getElementById(nextSection.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                      setShowTipFor(null); 
                                  }}
                                  className="mt-4 bg-brand-blue hover:bg-brand-blue/80 text-white font-orbitron"
                              >
                                  {selectedLang === 'ru' ? "Продолжить" : "Continue"}
                              </Button>
                          )}
                           {!nextSection && (
                              <p className="mt-4 text-sm text-gray-400">
                                  {selectedLang === 'ru' ? "Вы успешно завершили интерактивный курс!" : "You have successfully completed the interactive course!"}
                              </p>
                          )}
                      </motion.div>
                  )}
                </motion.section>
              );
            })}

            {savedNotes.length > 0 && (
                <motion.section
                    initial={{ opacity: 0, y: 50 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.3 }}
                    className="mt-12 p-6 rounded-lg border border-brand-green/50 bg-brand-green/10 shadow-lg space-y-4"
                >
                    <h3 className="text-2xl font-orbitron font-semibold text-brand-green">
                        {selectedLang === 'ru' ? "📝 Ваши Заметки" : "📝 Your Notes"}
                    </h3>
                    <ul className="list-disc list-inside space-y-2 text-gray-300">
                        {savedNotes.map((note, idx) => (
                            <li key={idx} className="text-base">
                                <VibeContentRenderer content={note} />
                            </li>
                        ))}
                    </ul>
                    <Button
                        onClick={handleSendNotesToTelegram}
                        className="w-full bg-brand-purple hover:bg-brand-purple/80 text-white font-orbitron mt-4 flex items-center justify-center gap-2"
                    >
                        <FaTelegramPlane className="h-5 w-5" />
                        {selectedLang === 'ru' ? "Отправить в Telegram" : "Send to Telegram"}
                    </Button>
                </motion.section>
            )}

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

      <Dialog open={isInfoModalOpen} onOpenChange={setIsInfoModalOpen}>
        <DialogContent className="sm:max-w-[425px] md:max-w-xl bg-dark-card border-brand-cyan/50 text-white shadow-[0_0_20px_rgba(0,255,255,0.4)]">
          <DialogHeader>
            <DialogTitle className="text-brand-cyan font-orbitron text-2xl">
              {currentInfoModalContent ? (selectedLang === 'ru' ? currentInfoModalContent.titleRu : currentInfoModalContent.titleEn) : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 text-gray-300 text-base leading-relaxed">
            {currentInfoModalContent ? (selectedLang === 'ru' ? currentInfoModalContent.contentRu : currentInfoModalContent.contentEn) : ""}
          </div>
          <Button onClick={closeInfoModal} className="mt-4 bg-brand-blue hover:bg-brand-blue/80 text-white font-orbitron">
            {selectedLang === 'ru' ? "Закрыть" : "Close"}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}