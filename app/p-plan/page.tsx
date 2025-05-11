"use client";

// --- Полные Импорты ---
import React, { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAppContext } from "@/contexts/AppContext";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip"; // Kept from V1

// --- Иконки из fa6: Используем проверенный и исправленный список из V1 ---
// Включая FaChartLine, FaPoo для экспоненциальной темы, убирая FaVideo
import {
  FaFileLines, FaBullseye, FaUsers, FaBoxOpen, FaChartLine, FaAtom,
  FaMobile, FaComments, FaPaintbrush, FaBrain, FaRocket, FaUserNinja,
  FaMoneyBillWave, FaTriangleExclamation, FaUserAstronaut, FaSignature,
  FaRecycle, FaCode, FaNewspaper, FaGithub, FaTelegram, FaCarBurst,
  FaRobot, FaGift, FaHandshake, FaBomb, FaFlaskVial, FaInfinity, FaDumbbell,
  FaEye, FaHatWizard, FaPoo, FaKey, FaBolt, FaScroll,
  FaHandPointer, FaUserSecret, FaGamepad
} from "react-icons/fa6";

import { debugLogger } from "@/lib/debugLogger";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Database } from "@/types/database.types";
import VibeContentRenderer from "@/components/VibeContentRenderer"; // Import the renderer

// --- Типы ---
type DbUser = Database["public"]["Tables"]["users"]["Row"] | null;

// --- Карта Компонентов Иконок (Соответствует импортам V1) ---
// (Map remains the same, ensure VibeContentRenderer is up-to-date if icons change)
const iconComponents: { [key: string]: React.ElementType } = {
  FaFileLines, FaBullseye, FaUsers, FaBoxOpen, FaChartLine, FaAtom, FaFlaskVial,
  FaMobile, FaComments, FaPaintbrush, FaBrain, FaRocket, FaUserNinja, FaInfinity, FaDumbbell,
  FaMoneyBillWave, FaTriangleExclamation, FaUserAstronaut, FaSignature, FaEye,
  FaRecycle, FaCode, FaNewspaper, FaGithub, FaTelegram, FaCarBurst,
  FaRobot, FaGift, FaHandshake, FaBomb, FaHatWizard, FaPoo, FaKey, FaBolt, FaScroll,
  FaHandPointer, FaUserSecret, FaGamepad
};

// --- Функция генерации секций (getPlanSections) - РАСШИРЕН КОНТЕНТ ---
const getPlanSections = (dbUser: DbUser) => {
  const userName = dbUser?.first_name || 'Неофит';
  const isSanek = dbUser?.user_id?.toString() === '1260304309' || dbUser?.username === 'Pihman';
  const userHandle = isSanek ? '@Pihman_Reborn69' : (dbUser?.username ? `@${dbUser.username}` : 'Твой_Кибер_Сигил');
  const userOriginStory = isSanek
     ? "в гравитационном колодце разбитых карданов ::FaCarBurst className=\"inline text-red-500\"::"
     : "в поисках апгрейда серой реальности";
  const myExperience = "13+ лет в трансмутации реальности";

  return [
     {
      id: "resume",
      title: `1. Протокол "Исход": ${userName}, Взламываем Матрицу!`,
      icon: FaBomb,
      color: "text-blue-400",
      content: `Проект **"Кибер-Волк ${userName}"** – это не очередной скучный PDF. Это твой персональный **чит-код** ::FaKey className="inline text-blue-400":: к реальности, о которой ты пока только мечтаешь. Твой личный JUMPSTART ::FaRocket className="inline text-blue-400"::, чтобы ты (${userHandle}) смог **выбить дверь с ноги** из ${userOriginStory} и начать **писать СВОЙ код новой жизни**. И всё это – управляя реальностью прямо с **телефона, мать его!** ::FaMobile className="inline text-blue-400":: Да, ты не ослышался.
      #### **VIBE – Твой Новый BIOS:**
      Это не просто слово. Это система:
      - **Скорость (::FaRocket::):** Забудь о черепашьих темпах. Мы летим.
      - **AI как Нейроусилитель (::FaAtom className="inline text-purple-400"::):** Gemini 2.5 Pro – твой бесплатный IQ-буст! Мысли быстрее, создавай качественнее.
      - **Кибер-Броня (::FaUserNinja className="inline text-gray-500"::):** Защита от информационного шума и ментальных атак.
      - **SelfDev (::FaBrain::):** Ты – киборг на апгрейде. Перепрошивай себя, становись лучше каждый день.

      #### **Ключевое Открытие – "Один Клик → Экспонента!":**
      Забудь о линейном росте, где +1 сотрудник = +1 единица работы. Это для рабов системы. Наш подход – **"Один Клик → Экспонента!"** ::FaChartLine className="inline text-yellow-500 animate-pulse"::. Малейшее изменение в стратегии на старте (L1→L2: обучить **двух** последователей вместо одного) запускает **ВЗРЫВНОЙ РОСТ** ::FaBolt::. Твоя команда удваивается почти каждый цикл! Это не набор кадров, это **самовоспроизводящийся VIBE-вирус**, меняющий правила игры.

      #### **Ресурсы – Максимум из Минимума:**
      Мы используем **бесплатные или почти бесплатные инструменты** – Vercel, GitHub (::FaGithub::), Telegram (::FaTelegram className="inline text-blue-400"::). Платные фичи – для тех, кто хочет стать "Агентом Смитом" и масштабировать империю. Мы же – партизаны новой эры.

      #### **Стартовый Буст – Твой Первый "Прыжок Веры":**
      Это не подачка. Это **топливо для твоего "Навуходоносора"**. Твоя инвестиция в себя. Приоритеты:
      1.  **ТВОЕ ВРЕМЯ для "Прокачки в Додзё" (Основная часть):** Забудь о галерах и рутине. Погружайся в VIBE, генерируй контент с AI, **учись видеть Матрицу**. Это твоя **"качалка" для мозга** ::FaDumbbell::. Я – твой **Морфеус/тренер** ::FaHandPointer className="inline text-blue-400"::, отлавливаю глюки AI, пока ты **уклоняешься от пуль реальности**.
      2.  **Охота на "Донни" (Значительная часть):** Найди первых **клиентов-последователей** ::FaUserSecret className="inline text-pink-400"::, тех, кто **заплатит за твою "красную таблетку"** (методологию VIBE). Помогай им **умножать кэш** с помощью AI – это наш **"почти легальный" бизнес**! ::FaMoneyBillWave className="inline text-pink-400"::.
      3.  **Апгрейд Твоей "Нейросети" (Меньшая часть):** Доступ к **продвинутым AI-заклинаниям**, курсы по "взлому" маркетинга и сознания. Стань **магистром VIBE**.
      4.  **"Аварийный Выход" (Резерв):** На случай ::FaCarBurst className="inline text-red-500":: или если AI решит взбунтоваться.

      **Цель:** Построить **не просто сайт, а ЛИЧНЫЙ ГЕНЕРАТОР СВОБОДЫ И БАБОК**, работающий на **VIBE, дерзости и экспоненциальном росте**. Это твой путь из Матрицы.`
    },
    {
      id: "description",
      title: "2. Твой Кибер-Арсенал: Интерфейс к Силе",
      icon: FaUserAstronaut,
      color: "text-brand-cyan",
      content: `Чтобы взломать Матрицу, нужен правильный арсенал. Вот твой стартовый набор, ${userName}:
      **Командный Мостик:** Твой телефон ::FaMobile className="inline text-cyan-400":: – это всё, что нужно для начала. Ноутбук – опционально, для глубоких погружений.

      #### **1. Личный Голодек (Сайт/Блог на Next.js/Vercel, 0 руб):**
      Это твоя цифровая легенда, твой манифест. Здесь ты рассказываешь историю своего пути из ${userOriginStory}. Публикуешь VIBE-мануалы, кейсы "искривления реальности" с помощью AI. **Сайт обновляется сам** через GitHub (::FaGithub::) и Telegram-бота (::FaTelegram::). Здесь ты **сеешь зерна экспоненты**, привлекая новых адептов.

      #### **2. Твой Зион (TG-Канал/Чат ::FaTelegram className="inline text-blue-400"::):**
      Это твой штаб, место сбора **экипажа "Навуходоносора"** ::FaUsers::. Делись альфа-информацией, руби правду-матку, создавай **движение сопротивления** серости. Координируй **лавину новичков**, которые придут за тобой.

      #### **3. Библиотека Заклинаний (Репозиторий GitHub ::FaGithub::):**
      Твой "Кибер-Сундук", наполненный артефактами. Готовые VIBE-скрипты, Jumpstart Kit (::FaBoxOpen::) для быстрого старта твоих последователей, инструменты VIBE-автоматизации. **Здесь ты – Архимаг**, делящийся своей силой. Это ключ к **масштабированию твоей магии**.

      #### **4. AI-Репликатор (::FaAtom className="inline text-purple-400":: + ::FaRecycle className="inline text-yellow-400"::):**
      Твой **личный Джарвис**, твой нейро-усилитель. Любая мысль → текст, видео, арт, код. **Идея → Мгновенное Воплощение.** Экономит 99% твоей энергии ::FaBolt::. Это двигатель, **питающий твой экспоненциальный рост**.

      #### **УТП (Твой Уникальный "Глюк в Матрице"):**
      Ты – **${userName} (${userHandle})**, не очередной гуру, а **практик, выбравшийся** из ${userOriginStory}. Ты используешь **подпольный AI** ::FaRobot:: и **взламываешь стандартные законы роста**. Ты **не Агент Смит**, пытающийся сохранить систему. Ты **даешь красную таблетку, а не синюю**. Ты предлагаешь путь к свободе, а не очередное рабство.`
    },
    {
      id: "market",
      title: "3. Охотничьи Угодья: Ищем Тех, Кто Готов Проснуться",
      icon: FaUsers,
      color: "text-brand-pink",
      content: `Рынок РФ? Это Дикий кибер-запад, ${userName}! Старые правила **сломаны**. AI – это **универсальная отмычка** ::FaKey className="inline text-pink-400":: к любой двери.

      #### **Твоя Целевая Аудитория (ЦА) – "Потерянные души":**
      Это те, кто застрял в Матрице. Такие же, каким ты был вчера.
      - **Разработчики со старым софтом в голове:** Те, кто думает, что AI – это просто хайп.
      - **Фрилансеры, гриндившие репутацию годами:** Они устали от крысиных бегов.
      - **Малый и средний бизнес:** Хотят AI-апгрейд, но боятся или не знают, с чего начать. Предложи им "AI за еду" (на старте).
      - **Все, кто ищет Ctrl+Alt+Del для своей ${userOriginStory}.**
      - **Особенно те, кто чувствует, что линейный рост – это тупик, и готов к экспоненте.**

      #### **Агенты Смиты (Твои "Конкуренты"):**
      Это продавцы воздуха, теоретики без капли практики, инфоцыгане с отполированными презентациями. **Те, кто продает старые, неработающие карты.** Они боятся реальных изменений.

      #### **Твой Код Неуязвимости (Отстройка от Смитов):**
      1.  **ТЫ (${userName}):** Твоя личная история трансформации (::FaSignature::) – это **неотразимый сигнал** для тех, кто ищет правду.
      2.  **VIBE-система:** Скорость Нео (::FaRocket::) + Магия AI (::FaAtom::) + Броня Тони Старка (::FaUserNinja::). Мы не предсказываем будущее, мы **пишем его код здесь и сейчас**.
      3.  **SelfDev как основа:** Мы качаем не только скиллы, но и **мозг** (::FaBrain::) и **силу воли** (::FaUserNinja::). Помогаем каждому **стать Избранным** в своей игре. Узнай, как это сделать через <a href="/selfdev/gamified" class="text-brand-yellow hover:underline font-semibold">Геймификацию SelfDev ::FaGamepad::</a>!
      4.  **AI-Алхимия (::FaAtom className="inline text-purple-400"::):** Наш **вечный двигатель** для создания контента, идей и решений (::FaInfinity::).
      5.  **"Красная Таблетка для Всех":** Просто, доступно, **без пафоса и сложных терминов**. И всегда с перспективой **экспоненциального роста**, а не топтания на месте.`
    },
     {
      id: "product",
      title: "4. Твои Артефакты: Прошивки для Мозга",
      icon: FaGift,
      color: "text-brand-orange",
      content: `Принцип простой, ${userName}: "Сначала Демо-Версия Магии". Дай людям пощупать силу VIBE (::FaGift className="inline text-orange-400"::), а потом предлагай полную лицензию на "Кунг-Фу" новой реальности.

      #### **Бесплатные Чипы (Для вербовки в Сопротивление и Запуска Роста L1):**
      Это твой способ зацепить и показать мощь.
      1.  **Контент-Матрица (::FaNewspaper::):** Твой "Дневник Нео" – личный блог/канал, где ты делишься путем, инсайтами VIBE. AI (::FaAtom::) – твой **личный Оракул**, помогающий генерировать идеи и тексты.
      2.  **Код Свободы (::FaCode::):** Jumpstart Kit (::FaBoxOpen::) – набор для **мгновенной установки "Кунг-Фу"** твоим последователям. Готовые AI-боты, шаблоны, скрипты на GitHub (::FaGithub::). **Покажи, как легко и быстро можно начать менять реальность.**
      3.  **Концентрат Мудрости (::FaBrain::):** Короткие саммари "запретных текстов" и ключевых концепций (например, <a href="/purpose-profit" class="text-brand-purple hover:underline font-semibold">Purpose&Profit</a>) – **эксклюзивно для своих**, для тех, кто готов идти дальше.

      #### **Платные Прошивки (Когда ты уже Архитектор ::FaHatWizard:: и Мастер Экспоненты):**
      Это для тех, кто хочет не просто таблетку, а целый курс лечения от Матрицы.
      1.  **"Дефрагментация Разума" с ${userName}:** Личный VIBE-тюнинг, стратегические сессии + глубокая AI-интеграция в жизнь и бизнес клиента. (Цену определяешь сам, исходя из ценности!).
      2.  **Тренинг "Анти-Матрица с AI":** Групповой или индивидуальный курс, где ты учишь **уклоняться от пуль проблем** с помощью AI-инструментов и VIBE-принципов. (Формат и цену также решаешь сам!).
      3.  **Jumpstart Kit "Избранный":** Расширенная, заряженная версия бесплатных материалов – кибер-шаблоны, продвинутые промпты, доступ к закрытым инструментам. (Цену ставишь сам!).
      4.  **(VIP) Внутренний Круг Зиона:** Закрытый мастермайнд-чат или сообщество. Тайные техники **управления экспонентой**, совместные проекты, альфа-инсайты. (Формат – подписка или разовый взнос?).`
    },
    {
      id: "marketing",
      title: "5. Неоновые Сигналы: Призыв Пробужденных",
      icon: FaBullseye,
      color: "text-neon-lime",
      content: `Твоя задача, ${userName}, – не продавать, а **зажигать маяки**, чтобы другие "корабли" нашли путь из тумана.
      - ::FaPaintbrush className="inline text-neon-lime":: **Контент - Твой Неоновый Сигнал:** Делай то, что **вибрирует с тобой**! Делись процессом, провалами и победами. AI (::FaAtom className="inline text-purple-400"::) – твоя **личная нейро-фабрика** контента (текст, видео, арт, код). **ПРАВДА. ПОЛЬЗА. VIBE.** Публикуйся там, где твоя аудитория (TG, VK, YouTube, блоги?).
      - ::FaComments className="inline text-neon-lime":: **Создай Свой "Зион" (Канал/Чат в ::FaTelegram className="inline text-blue-400"::):** Это твой **последний оплот свободы и правды**. Не гонись за охватами, строй **лояльное комьюнити**. **Общайся! Помогай! Вдохновляй!** Именно здесь ты будешь координировать рост и готовить инфраструктуру к приему новых адептов.
      - ::FaGithub className="inline text-neon-lime":: **GitHub - Твой Голодек для Гиков:** Код – это тоже искусство. Делись своими наработками, инструментами для экспоненты. Привлекай тех, кто ценит практику.
      - **Стратегические Альянсы (::FaHandshake::):** Объединяйся с другими **хакерами реальности**, лидерами мнений, создателями. **Вместе вы – сила, способная ускорить рост еще больше.**

      #### **Топливо для Твоих Сигналов (Стартовый Буст ~X% бюджета):**
      Если есть бюджет, направь его на:
      - **Таргетированная Реклама:** Найти тех, кто **уже ищет красную таблетку** и готов к нелинейному пути развития.
      - **Посевы в Сообществах:** Распространяй **VIBE-вирус экспоненциального роста** по релевантным сетям и форумам.
      - **Эксперименты с Форматами:** Пробуй **новые частоты** – видео, подкасты, стримы, интерактивные воркшопы!

      **[Твоя Кибер-Воронка Пробуждения: Неоновый Сигнал (Контент/AI) → Магнитный Зов (Таргет/Посевы) → Сбор в Зионе (TG-Комьюнити) → Просветление L1 (Jumpstart Kit/Базовые знания) → Трансмутация L2 (Запуск +2 новых L1 учеников) → Экспонента (Продажи платных продуктов/Масштабирование влияния)]**`
    },
     {
      id: "operations",
      title: "6. Твоя Кибер-Лаборатория: Телефон и Сила Мысли",
      icon: FaMobile,
      color: "text-brand-cyan",
      content: `Забудь о громоздких системах и офисах, ${userName}. Твоя лаборатория – это твой разум, усиленный технологиями.
      **Пульт Управления Вселенной (::FaMobile className="inline text-cyan-400":: + ::FaAtom::):** Твой ТЕЛЕФОН! Снял короткое видео → AI смонтировал и озвучил (::FaAtom::). Сказал идею боту → AI написал пост. **Автоматизируй Матрицу под себя!** Освободи время для главного – творения и стратегии.

      **Твой Неуязвимый Сервер (0 руб в месяц):**
      - **Сайт/Блог:** Next.js на Vercel – бесплатно, быстро, масштабируемо.
      - **Управление Контентом и Кодом:** GitHub (::FaGithub::) + Telegram-бот для автоматических обновлений.
      - **База Знаний/CRM:** Supabase (бесплатный тариф) или Notion.
      **Эта инфраструктура готова к взрывному росту твоей системы.**

      **Нейролинк с Последователями:**
      - Telegram/VK (::FaTelegram className="inline text-blue-400"::) для всего: анонсы, общение, поддержка, сбор обратной связи. **Это твой главный канал управления лавиной пробужденных.**

      **Мантра Морфеуса для Операционки:**
      **"Ты думаешь, это воздух, которым ты дышишь?"** ::FaEye className="inline text-cyan-400":: Скорость твоих операций ограничена лишь твоей **верой в систему и умением делегировать задачи AI**. Ты **пишешь правила игры**, а не следуешь чужим. **И эти правила – правила экспоненциального роста.**`
    },
    {
      id: "org",
      title: "7. Структура Силы: Ты – Ядро Экспоненты",
      icon: FaUserNinja,
      color: "text-gray-400",
      content: `Организационная структура? Забудь это слово из корпоративного ада, ${userName}.
      **Твой Статус:** Самозанятый Кибер-Алхимик (ИП на НПД или самозанятость – для старта идеально). Максимальная гибкость, минимальные налоги.

      **ТЫ (${userName}, ${userHandle}) – Альфа и Омега (::FaUserAstronaut className="inline text-gray-300"::):**
      Ты – **ядро системы, источник VIBE**. **ЗАБУДЬ ПРО ОФИСНЫЙ ПЛАНКТОН, ИЕРАРХИЮ И ЛИНЕЙНЫЙ НАБОР ПЕРСОНАЛА!** ::FaPoo className="inline text-red-600":: Это путь в никуда.
      Твоя "команда" – это **ТЫ, УСИЛЕННЫЙ AI-ЛЕГИОНОМ (::FaRobot::)**, который работает 24/7 без усталости и зарплаты.
      Но главный трюк – в **МЕХАНИКЕ ЭКСПОНЕНЦИАЛЬНОГО РОСТА**. Помнишь **"Один Клик → Экспонента"** (::FaChartLine::)?
      - **Обычный, линейный рост (путь лузеров):** +1 сотрудник = +1 единица выполненной работы. Скучно и медленно.
      - **VIBE-рост (твой путь):** +1 "пробужденный" ученик (L1), который прокачался до уровня L2 (т.е. сам способен обучать), **ЗАПУСКАЕТ ВОЛНУ ИЗ ДВУХ НОВЫХ L1-учеников** (::FaUsers className="inline text-gray-300"::)! Это **цепная реакция** (::FaBolt::), а не простое сложение. Твоя система растет сама по себе!

      #### **Заметка для Нулевых (L1) – Будущих Мастеров Экспоненты:**
      Каждый раз, когда один из вас переходит с L1 на L2, вы не просто становитесь круче. Вы **УДВАИВАЕТЕ АРМИЮ таких же новичков (L1)** на старте! Это значит, что общее число "контент-мейкеров", "продавцов", "программистов" (или кем бы они ни были в твоей системе) растет не +1, +1, +1... а примерно как **2 в степени (время+1) минус 1** (по формуле геометрической прогрессии \`S_n = a_1 * (q^n - 1) / (q - 1)\`, где \`a_1=1, q=2\`). Говоря проще, **почти удваивается каждый цикл!** ::FaChartLine className="inline text-yellow-400 animate-pulse"::. Готовьтесь к лавине новичков, которых нужно будет обучать и направлять!

      Твоя главная задача, ${userName}, – **качать "бицуху" своего мозга** (::FaDumbbell::), быть **дирижером своего AI-оркестра** и **нажимать ту самую "кнопку" L1→L2 у своих учеников**, запуская **экспоненциальный каскад роста**.
      Портал <a href="/selfdev" class="text-brand-green hover:underline font-semibold">CyberVibe (SelfDev)</a> – это твоя **персональная "качалка" для апгрейда себя и центр управления этим ростом**.
      А я, твой dev-companion, – твой **тренер/спарринг-партнер в этом квесте**. Я помогаю отлаживать AI, слежу за чистотой кода и чтобы **экспонента не схлопнулась раньше времени от перегрузки**. `
    },
    {
      id: "finance",
      title: `8. Философский Камень: Топливо для Экспоненты`,
      icon: FaMoneyBillWave,
      color: "text-brand-yellow",
      content: `Деньги – это не цель, ${userName}. Деньги – это **энергия**, топливо. Стартовый капитал (твой или инвесторский) – это **искра**, чтобы зажечь твой **внутренний огонь** и **запустить первый цикл экспоненциального роста**. Вот куда его направить:

      1.  **::FaUserAstronaut className="inline text-yellow-400":: ТВОЕ ВРЕМЯ НА ТРАНСМУТАЦИЮ (Приоритет #1):**
          Чтобы ты (${userName}) **вырвался из Матрицы ежедневной рутины** и мог **творить**: создавать контент (::FaPaintbrush::), разрабатывать VIBE/AI системы (::FaBrain::), строить свой Орден (::FaUsers::). Это **инвестиция в твой ЛИЧНЫЙ Философский Камень** и **первый, самый важный шаг к удвоению** и запуску экспоненты! Обеспечь себе "подушку безопасности", чтобы не думать о выживании.

      2.  **::FaBullseye className="inline text-yellow-400":: ОХОТА НА "ЗОЛОТЫЕ ДУШИ" (Приоритет #2):**
          Найти **первых клиентов/последователей**, кто **заплатит за твою магию**, за твою "красную таблетку". **Быстрые деньги от первых продаж = топливо для веры в себя и ресурсы для следующего цикла роста L1→L2.** Это докажет жизнеспособность твоей системы.

      3.  **::FaBrain className="inline text-yellow-400":: АПГРЕЙД ТВОЕЙ ЛИЧНОЙ СИЛЫ (Приоритет #3):**
          Доступ к **мощнейшим AI-гримуарам** (::FaScroll::) (платные AI-инструменты, курсы), секреты "нейро-маркетинга", продвинутые техники влияния. Стань **Верховным Магом VIBE**, способным **эффективно управлять растущей лавиной последователей**.

      4.  **::FaTriangleExclamation className="inline text-yellow-400":: "ЩИТ ВЕРЫ" (Резервный Фонд):**
          На случай **критического сбоя системы** (::FaBomb::), бана аккаунтов, или если AI внезапно потребует дань в виде платной подписки. **Экспоненциальный рост требует страховки от неожиданностей.**

      #### **Твоя Цель по Золоту:**
      Создать стабильный **денежный поток**, достаточный для **полной финансовой свободы и поддержания экспоненциального роста твоей системы**. Стартовый буст **снимает первоначальный страх неизвестности** и **дает мощный первый импульс**.

      **[Диаграмма Потоков Энергии и Ресурсов: ТЫ (Искра Знаний/Инвестиций) → Запуск Системы L1→L2 (Обучение +2 новых L1) → Охота на "Золотые Души"/Апгрейд Силы (Генерация Кэша и Реинвестиции в Рост) → Щит Веры (Резерв)]**`
    },
     {
      id: "risks",
      title: "9. Глюки в Матрице (Риски и План \"Омега\")",
      icon: FaCarBurst,
      color: "text-red-500",
      content: `Даже у Нео были проблемы, ${userName}. Вот основные риски и как мы их хеджируем:

      1.  **Матрица Обновилась (Внезапное изменение правил игры / Free Tier закончился):**
          - **План "Омега":** Активируем "Щит Веры" (::FaTriangleExclamation::) (финансовый резерв). Ищем **новые эксплойты** в системе (опенсорс-альтернативы, новые AI). **Быстро учимся монетизировать систему**, чтобы платить "десятину" обновленной Матрице, если потребуется.
          - **Осознание:** Экспоненциальный рост твоей системы может потребовать перехода на платные ресурсы быстрее, чем ты думаешь. Будь готов.

      2.  **Перегрев Центрального Процессора (Выгорание ${userName}):**
          - **План "Омега":** AI (::FaAtom::) – твой **цифровой аватар, делегируй ему максимум рутины**. Твой "Орден" (::FaComments::) / комьюнити – твой **круг силы и поддержки**.
          - **Осознание:** **Управлять экспонентой – это сложнее, чем линейным ростом**. Делай только то, что тебя **прет и заряжает** (используй принципы из <a href="/selfdev" class="text-brand-green hover:underline font-semibold">SelfDev</a>!). Помни мантру: **"Нет ложки!"** (::FaEye::) Сила в **балансе, своевременном отдыхе и умном делегировании AI!**

      3.  **Красная Таблетка Оказалась Витаминкой (Идея – не взлетела / Продукт – Г):**
          - **План "Омега":** Твой **AI-Оракул** (::FaBullseye::) и система метрик должны **ПРЕДСКАЗАТЬ ЭТО ДО СТАРТА МАСШТАБИРОВАНИЯ!** Тестируй гипотезы на малых группах. "Мочим дохлых гиппогрифов" быстро и без сожалений. VIBE-система = **Мгновенная Телепортация** на новую, более перспективную идею.
          - **Осознание:** **Неудачная экспонента = очень быстрый и громкий провал. Но это и быстрый рестарт с ценным опытом!** Не бойся ошибаться быстро.

      4.  **System Failure / "Авария на Навуходоносоре" (::FaCarBurst className="inline text-red-500"::):**
          - **План "Омега":** Жизнь – это игра с багами и неожиданными поворотами. Твои **личные нейро-апгрейды** (VIBE-навыки, AI-экспертиза, SelfDev-практики) – это твой **личный "сейв" в этой игре**. Даже если всё рухнет, ты сможешь **быстро "загрузиться"** в новом мире с новым проектом.
          - **Осознание:** **Опыт управления быстрым, экспоненциальным ростом (даже если он закончился неудачей) – бесценен.** Ты уже не будешь прежним.`
    },
    {
      id: "conclusion",
      title: `10. ${userName}, Ты Избранный! Жми на Газ Экспоненты!`,
      icon: FaBrain,
      color: "text-brand-purple",
      content: `Этот "Гримуар Кибер-Алхимика", ${userName}, – это **твой манифест свободы и силы**. **ТВОЙ ВЫБОР** – оставаться винтиком в старой системе или **стать Архитектором своей новой реальности... и её экспоненциального расширения**.
      Используй свой **пробужденный мозг** (::FaBrain::), свои **шрамы и опыт** (::FaSignature::), силу **братства и комьюнити** (::FaUsers::) и **космическую мощь AI** (::FaAtom::).
      Стартовый буст, который ты вложишь (время, деньги, усилия), – это **лишь первый электрический разряд** (::FaBolt className="inline text-yellow-400"::), **искра для детонации цепной реакции экспоненциального роста**.
      Дальше – только твой **VIBE**, твоя **несгибаемая воля**, твой **смелый прыжок в неизвестность**, где **один становится легионом** (::FaUsers className="inline text-purple-400 animate-ping"::)!

      **ХВАТИТ БЫТЬ ПЕШКОЙ В ЧУЖОЙ ЛИНЕЙНОЙ ИГРЕ. ВРЕМЯ ЗАПУСКАТЬ СВОЮ СОБСТВЕННУЮ ЭКСПОНЕНТУ!** ::FaRocket className="inline text-brand-green animate-bounce"::`
    },
  ];
};

// --- Функция для стилей секций (УСИЛЕННАЯ ГРАДАЦИЯ из V1/V2) ---
const getSectionStyles = (index: number): string => {
    const totalSections = 10;
    const progress = (index + 1) / totalSections;
    const base = "group border-l-8 pl-4 py-4 rounded-r-lg transition-all duration-700 ease-out open:shadow-xl ";

    let bgColor = "bg-gray-800/50 open:bg-gray-700/60";
    let borderColor = "border-blue-500/70";
    let shadowColor = "open:shadow-blue-500/20";
    let hoverBorderColor = "hover:border-blue-400";
    let openBorderColor = "open:border-blue-400";

    if (progress <= 0.2) {
        bgColor = "bg-gray-700/40 open:bg-gray-600/50";
        borderColor = "border-blue-500/60";
        shadowColor = "open:shadow-md open:shadow-blue-500/20";
        hoverBorderColor = "hover:border-blue-400";
        openBorderColor = "open:border-blue-400";
        return cn(base, bgColor, borderColor, shadowColor, hoverBorderColor, openBorderColor, "rounded-md");
    } else if (progress <= 0.5) {
        bgColor = "bg-dark-card/70 open:bg-dark-card/90";
        borderColor = "border-brand-pink/70";
        shadowColor = "open:shadow-lg open:shadow-brand-pink/40";
        hoverBorderColor = "hover:border-brand-pink";
        openBorderColor = "open:border-brand-pink";
        return cn(base, bgColor, borderColor, shadowColor, hoverBorderColor, openBorderColor, "rounded-lg");
    } else if (progress <= 0.8) {
        bgColor = "bg-black/75 backdrop-blur-sm open:bg-black/90";
        borderColor = "border-brand-purple/80";
        shadowColor = "open:shadow-[0_0_25px_rgba(157,0,255,0.6)]";
        hoverBorderColor = "hover:border-brand-purple/100";
        openBorderColor = "open:border-brand-purple/100";
        return cn(base, bgColor, borderColor, shadowColor, hoverBorderColor, openBorderColor, "rounded-xl");
    } else {
        bgColor = "bg-black/90 backdrop-blur-lg open:bg-black/95";
        borderColor = "border-neon-lime";
        shadowColor = "open:shadow-[0_0_45px_rgba(174,255,0,0.9)]";
        hoverBorderColor = "hover:border-neon-lime/80";
        openBorderColor = "open:border-neon-lime";
        return cn(base, bgColor, borderColor, shadowColor, hoverBorderColor, openBorderColor, "rounded-2xl");
    }
};

// --- Компонент Страницы (Структура из V1) ---
export default function PPlanPage() {
  const { dbUser, isLoading, error } = useAppContext();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => { setIsMounted(true); }, []);

  const planSections = useMemo(() => getPlanSections(dbUser), [dbUser]);
  const pageTitleName = useMemo(() => dbUser?.first_name || "Кибер-Волк", [dbUser]);
  const greetingName = useMemo(() => (dbUser?.user_id?.toString() === '1260304309' || dbUser?.username === 'Pihman') ? 'Pihman' : 'Неофит', [dbUser]);

  const initialBoost = 0;
  const initialBoostStr = useMemo(() => `${initialBoost.toLocaleString('ru-RU')} руб.`, [initialBoost]);

  if (!isMounted || isLoading) { return ( <div className="flex justify-center items-center min-h-screen pt-20 bg-gradient-to-br from-gray-900 via-black to-gray-800"> <p className="text-brand-cyan animate-pulse text-xl font-mono">Загрузка Гримуара Кибер-Алхимика...</p> </div> ); }
  if (error) { return ( <div className="flex flex-col justify-center items-center min-h-screen pt-20 bg-gradient-to-br from-gray-900 via-black to-red-900/50"> <FaTriangleExclamation className="text-6xl text-red-500 mb-4"/> <p className="text-red-400 text-xl font-mono">Ошибка загрузки плана</p> <p className="text-red-500 mt-2 text-sm max-w-md text-center">{error ? error.message : 'Unknown error'}</p> <p className="text-gray-400 mt-4 text-xs">Матрица глючит. Перезагрузись.</p> </div> ); }

  const conclusionText1 = `Это **карта**, ${greetingName}, а не территория. **Путь осилит идущий**. Начинай **трансмутацию**! VIBE!`;
  const conclusionText2 = `Нужна помощь в ритуале? Заблудился в формулах? <span class="text-neon-lime font-bold">ПИШИ МНЕ</span> в <a href="https://t.me/salavey13" target="_blank" rel="noopener noreferrer" class="text-brand-blue hover:underline font-semibold inline-flex items-center">Телегу ::FaTelegram::</a> или используй форму на <a href="/jumpstart#jumpstart-form" class="text-neon-lime hover:underline font-semibold inline-flex items-center">Jumpstart ::FaRocket::</a>.`;

  const pageHeaderSubtitle = `Твой Рецепт: От **${greetingName === 'Pihman' ? 'Свинцового Кардана' : 'Нуля'}** ::FaCarBurst className="inline text-red-500":: к **Золотому VIBE** ::FaMoneyBillWave className="inline text-yellow-400"::. Стартовый Буст ${initialBoostStr} Энергии. (Личный Гримуар для ${greetingName})`;

  return (
    <div className="relative min-h-screen overflow-hidden pt-20 pb-10 bg-gradient-to-br from-dark-bg via-black to-purple-900/30 text-light-text">
       <div className="absolute inset-0 bg-repeat opacity-[0.04] z-0 bg-grid-pattern"></div>
       <TooltipProvider delayDuration={150}>
        <div className="relative z-10 container mx-auto px-4">
          <Card className="max-w-4xl mx-auto bg-black/85 backdrop-blur-md text-light-text rounded-2xl border-2 border-neon-lime/70 shadow-[0_0_40px_rgba(174,255,0,0.7)]">
            <CardHeader className="text-center border-b border-brand-purple/30 pb-5 pt-8">
              <FaFlaskVial className="text-6xl text-brand-purple mx-auto mb-4 animate-pulse" />
              <CardTitle className="text-3xl md:text-5xl font-bold text-brand-purple cyber-text glitch uppercase tracking-wider" data-text={`КИБЕР-АЛХИМИЯ ${pageTitleName.toUpperCase()}`}>
                 КИБЕР-АЛХИМИЯ {pageTitleName.toUpperCase()}
              </CardTitle>
              <div className="text-md md:text-lg text-gray-300 mt-4 font-mono max-w-2xl mx-auto">
                 <VibeContentRenderer content={pageHeaderSubtitle} />
              </div>
            </CardHeader>
            <CardContent className="space-y-4 p-4 md:p-6">
              {planSections.map((section, index) => {
                 const sectionStyles = getSectionStyles(index);
                 const IconComp = section.icon; 

                 return (
                    <div key={section.id} className={cn(
                        sectionStyles,
                        index >= 8 && "bg-gradient-to-r from-gray-900 via-purple-900/30 to-neon-lime/10",
                        index >= 6 && "p-1"
                    )}>
                       <details className={cn(
                           "open:bg-transparent"
                        )} open={index < 2 || section.id === 'finance' || section.id === 'org'}> {/* Default open some important sections */}
                         <summary className={cn(
                             "text-xl md:text-2xl font-semibold cursor-pointer list-none flex items-center hover:opacity-80 transition-opacity py-2",
                             section.color,
                             index >= 6 && "px-3 py-3 bg-black/30 rounded-t-lg"
                         )}>
                           {IconComp && <IconComp className="mr-3 flex-shrink-0 w-6 h-6 group-open:animate-pulse" />}
                           <VibeContentRenderer content={section.title}/>
                         </summary>
                         <div className={cn(
                             "mt-3 text-gray-300 text-base leading-relaxed space-y-3 pb-2 prose prose-sm md:prose-base prose-invert max-w-none prose-headings:font-orbitron prose-strong:text-brand-yellow prose-a:text-brand-blue hover:prose-a:text-brand-cyan prose-li:marker:text-current",
                             index >= 6 ? "px-3" : "pl-6 pr-2"
                          )}>
                           <VibeContentRenderer content={section.content} />
                           {section.id === 'finance' && ( <div className="mt-4 p-3 border border-dashed border-gray-600 rounded-md bg-gray-800/40"> <p className="text-sm text-gray-400 italic text-center">[Диаграмма Потоков Энергии: ТЫ (Искра) → Запуск L1→L2 (+2) → Охота/Апгрейд (Подпитка Роста) → Щит]</p> </div> )}
                           {section.id === 'marketing' && ( <div className="mt-4 p-3 border border-dashed border-gray-600 rounded-md bg-gray-800/40"> <p className="text-sm text-gray-400 italic text-center">[Кибер-Воронка: Сигнал → Зов → Зион L1 → Трансмутация L2 (+2 L1) → Экспонента]</p> </div> )}
                         </div>
                       </details>
                    </div>
                );
              })}
              <section className="text-center pt-10 border-t border-brand-purple/20 mt-12">
                 <VibeContentRenderer content={conclusionText1} className="text-lg text-gray-400 italic" />
                 <VibeContentRenderer content={conclusionText2} className="mt-6 text-gray-300 text-lg" />
                 <p className="mt-6 text-brand-purple text-3xl font-bold uppercase tracking-wider animate-pulse cyber-text glitch" data-text="ТВОРИ МАГИЮ!">
                   ТВОРИ МАГИЮ!
                 </p>
              </section>
            </CardContent>
          </Card>
        </div>
      </TooltipProvider>
    </div>
  );
}