"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { VibeContentRenderer } from '@/components/VibeContentRenderer';
import { cn } from '@/lib/utils';
// DO NOT IMPORT - HALLUCINATED ICONS BRAKE THE BUILD! USE ICONS  ONLY THROUGH VibeContentRenderer! 
/*import { 
    FaUsersCog, FaUserFriends, FaBrain, FaShieldHalved, FaSearchDollar, 
    FaExternalLinkAlt, FaBinoculars, FaRobot, FaTasks, FaBullhorn, 
    FaProjectDiagram, FaCubes, FaComments, FaRocket, FaBolt, FaCodeBranch,
    FaFileSignature, FaDatabase, FaGithub, FaTelegramPlane, FaLightbulb, // FaSupabase -> FaDatabase
    FaChartLine, FaUserNinja, FaTools, FaUserSecret, FaLink, FaHeadset,
    FaFileUpload, FaTableList, FaBrainCircuit // Added for new sections FaBrainCircuit
} from 'react-icons/fa6'; 
*/
// Тип для переводов
type TranslationKeys = 
  | 'pageTitle' | 'pageSubtitle' | 'rolesTitle' | 'rolesSubtitle' 
  | 'carryRoleTitle' | 'carryRoleDesc' | 'carryRoleLink'
  | 'tanksRoleTitle' | 'tanksRoleDesc' | 'tanksRoleLeverages'
  | 'supportRoleTitle' | 'supportRoleDesc'
  | 'supportArsenalTitle' | 'supportArsenalSubtitle'
  | 'phase1Title' | 'phase1Point1' | 'phase1Point2' | 'phase1Point3'
  | 'kworkSearchLink1' | 'kworkSearchLink2' | 'kworkSearchLink3' | 'kworkSearchLink4'
  | 'leadsTableNote' | 'leadsTableTitle' | 'leadsTableDesc'
  | 'csvUploadTitle' | 'csvUploadDesc' | 'csvUploadButton'
  | 'aiLeadRatingTitle' | 'aiLeadRatingDesc' | 'aiLeadRatingPromptTitle'
  | 'phase2Title' | 'phase2Point1' | 'phase2Point2' | 'phase2Point3'
  | 'phase3Title' | 'phase3Point1' | 'phase3Point2' | 'phase3Point3'
  | 'offerTitle' | 'offerSubtitle' | 'offerP1' | 'offerP2'
  | 'promptObjective' | 'promptInputs' | 'promptInput1' | 'promptInput2' | 'promptInput3' | 'promptInput4'
  | 'promptBotAnalysis1' | 'promptBotAnalysis2' | 'promptBotAnalysis3' | 'promptBotAnalysis4' | 'promptBotAnalysis5'
  | 'promptUSPs' | 'promptUSP1' | 'promptUSP2' | 'promptUSP3' | 'promptUSP4' | 'promptUSP5' | 'promptUSP6' | 'promptUSP7'
  | 'promptOutputStructure' | 'promptOutput1' | 'promptOutput2' | 'promptOutput3' | 'promptOutput4' | 'promptOutput5' | 'promptOutput6'
  | 'promptTone' | 'promptExample' | 'promptExampleText'
  | 'workflowTitle' | 'workflowSubtitle' | 'workflowStep1' | 'workflowStep2' | 'workflowStep3' | 'workflowStep4' | 'workflowStep4Tank' | 'workflowStep4Carry' | 'workflowStep5' | 'workflowStep6'
  | 'assetsTitle' | 'assetsSubtitle'
  | 'assetJumpstartTitle' | 'assetJumpstartDesc'
  | 'assetStudioTitle' | 'assetStudioDesc'
  | 'assetPhilosophyTitle' | 'assetPhilosophyDesc'
  | 'assetPlansTitle' | 'assetPlansDesc'
  | 'assetTutorialsTitle' | 'assetTutorialsDesc'
  | 'assetCyberDevOSTitle' | 'assetCyberDevOSDesc'
  | 'zionTitle' | 'zionSubtitle' | 'zionP1' | 'zionList1' | 'zionList2' | 'zionList3' | 'zionList4' | 'zionLink'
  | 'ctaTitle' | 'ctaSubtitle' | 'ctaButtonText';

const translations: Record<'ru' | 'en', Record<TranslationKeys, string>> = {
  ru: {
    pageTitle: "КОЦ 'Сетевой Дозор'",
    pageSubtitle: "Бойцы КиберОтряда! Это ваш командный пункт для захвата лидов и доминации в Supervibe-стиле. Роли распределены, цели определены, VIBE активирован. Трансмутируем инфу в профит!",
    rolesTitle: "::FaUserFriends:: КиберОтряд: Роли и Боевые Задачи",
    rolesSubtitle: "Экипаж машины боевой, заряженный на VIBE-победу и тотальное превосходство.",
    carryRoleTitle: "::FaBrain:: Кэрри (Павел)",
    carryRoleDesc: "Верховный Архитектор, Движитель Инноваций. Создает и внедряет прорывные фичи в Supervibe Studio. Решает нетривиальные задачи разработки, определяя вектор эволюции платформы. Его код – закон.",
    carryRoleLink: "Личное дело Кэрри",
    tanksRoleTitle: "::FaShieldHalved:: Танки (Штурмовой Эшелон)",
    tanksRoleDesc: "Броневой кулак кастомизации и адаптации. Принимают на себя 'урон' от сложных клиентских запросов, AI-артефактов (галлюцинации иконок, замена медиа). Трансмутируют базовые модули в уникальные клиентские решения, используя реактивную мощь Supervibe Studio. Их девиз: 'Прорвемся!'",
    tanksRoleLeverages: "Основное вооружение: Замена Изображений, Деактивация Иконок-Мин, Видео-Интеграция, Inception Swap-Маневры.",
    supportRoleTitle: "::FaHeadset:: Саппорт (Снабженец и Связной)", // FaSearchDollar -> FaHeadset
    supportRoleDesc: "Информационно-логистический центр и голос отряда. Идентифицирует, фильтрует и обрабатывает входящие сигналы (лиды). Готовит разведданные и целеуказания для Танков и Кэрри. Ведет переговоры, обеспечивая бесперебойную связь и снабжение.",
    supportArsenalTitle: "::FaTools:: Арсенал Саппорта: Инструменты и Протоколы",
    supportArsenalSubtitle: "Высокотехнологичное снаряжение для информационной войны и эффективной вербовки.",
    phase1Title: "::FaBinoculars:: Протокол 'Крот': Kwork-Рекогносцировка и Сбор Данных",
    phase1Point1: "**Целевой Поиск и Сканирование:** Использовать предустановленные гиперссылки для Kwork (см. ниже) и разрабатывать новые для обнаружения актуальных запросов ('Telegram Web App', 'Mini App', 'TWA', 'Нейросети для бизнеса').",
    phase1Point2: "**Извлечение Разведданных (Ручное/Автоматизированное):** Копировать приоритетные описания проектов с Kwork (полный HTML для AI-анализа, текст для оперативной оценки). ::FaFileSignature:: **Фокус на свежих сигналах!**",
    phase1Point3: "**Интеграция в ЦОД (Центр Обработки Данных - Supabase):** Заносить классифицированные лиды в таблицу `public.leads` в Supabase. Фиксировать: источник, URL, описание, бюджет, временные метки.",
    kworkSearchLink1: "::FaExternalLinkAlt:: Telegram Web Apps",
    kworkSearchLink2: "::FaExternalLinkAlt:: Telegram Mini Apps",
    kworkSearchLink3: "::FaExternalLinkAlt:: Разработка TWA",
    kworkSearchLink4: "::FaExternalLinkAlt:: Telegram Боты + Нейросети",
    csvUploadTitle: "::FaFileUpload:: Протокол 'Загрузка Потока': Импорт CSV с Лидами",
    csvUploadDesc: "Для массовой обработки или импорта из других источников, Саппорт может загружать лиды в формате CSV напрямую в Supabase. (Эта функция в разработке, пока – ручное заполнение таблицы).",
    csvUploadButton: "ЗАГРУЗИТЬ CSV С ЛИДАМИ (WIP)",
    leadsTableTitle: "::FaTableList:: Панель Управления Лидами (Концепт)",
    leadsTableDesc: "Визуализация таблицы `public.leads` из Supabase для отслеживания статусов, назначений и прогресса по каждому лиду. (Интерактивная таблица будет добавлена здесь).",
    leadsTableNote: "Структура таблицы `public.leads` в Supabase:",
    aiLeadRatingTitle: "::FaBrainCircuit:: Протокол 'Оракул': AI-Скоринг и Приоритезация Лидов",
    aiLeadRatingDesc: "После загрузки в Supabase, Саппорт инициирует AI-анализ новых лидов. Используется специальный промпт для оценки каждого лида по ключевым параметрам.",
    aiLeadRatingPromptTitle: "Мастер-Промпт для AI-Оценки Лидов:",
    phase2Title: "::FaRobot:: Протокол 'Центурион': Квалификация Лидов (AI-Анализ)",
    phase2Point1: "**Скоринг Релевантности:** Подавать HTML/текст описаний лидов AI-Оракулу для оценки релевантности нашим ключевым компетенциям (AI-ускоренная разработка TWA). Это основа для фильтрации и определения приоритетов.",
    phase2Point2: "**Сопоставление Возможностей:** Оракул определяет, насколько фичи лида соответствуют <Link href='/jumpstart' class='text-brand-cyan hover:underline'>Jumpstart Kit</Link> или возможностям автоматической генерации Supervibe Studio.",
    phase2Point3: "**Оценка Затрат Ресурсов:** Оракул классифицирует запросы: 'Легкая Добыча (Высокий Потенциал Автоматизации)', 'Требует Усилий (Кастомизация Танками)', 'Вызов для Титана (Новый функционал для Кэрри)'.",
    phase3Title: "::FaTasks:: Протокол 'Координатор': Подготовка Задач для Отряда",
    phase3Point1: "**Для Танков (Кастомизация/Адаптация):** Генерировать прямые целеуказания (ссылки <Link href='/repo-xml' class='text-brand-cyan hover:underline'>Supervibe Studio</Link>) с параметрами `path` (к базовому модулю) и `idea` (спецификация клиента). Пример: `/repo-xml?path=/components/OrderForm.tsx&idea=Добавить опцию 'экспресс-доставка' с калькуляцией`. Сохранять в `supervibe_studio_links` (JSONB).",
    phase3Point2: "**Для Кэрри (R&D Новых Вооружений):** Если запрос требует создания принципиально новых модулей или расширения ядра Supervibe, формировать подробные Технические Задания (ТЗ) в виде GitHub Issues. Связывать их в `github_issue_links` (JSONB).",
    phase3Point3: "**Обновление Оперативной Обстановки:** Маркировать статус лида в ЦОД Supabase (например, 'обработан_оракулом', 'передан_танкам', 'в_разработке_кэрри').",
    offerTitle: "::FaBullhorn:: Протокол 'Сирена': Создание Убойного Предложения",
    offerSubtitle: "AI-заряженное послание, превращающее цели в союзников.",
    offerP1: "Саппорт, усиленный разведданными Оракула, использует этот мастер-промпт для генерации персонализированного первого контакта. Сообщение делает акцент на скорости, AI-преимуществах и молниеносном пути к MVP.",
    offerP2: "Предложение всегда должно показывать клиенту **'профит для него здесь и сейчас'** – быстрая проверка гипотез, минимизация рисков, фокус на его уникальной ценности. Философия <Link href='/jumpstart' class='text-brand-cyan hover:underline'>Jumpstart Kit</Link> – наш козырь.",
    promptObjective: "**Задача:** Сгенерировать персонализированное, неотразимое первое сообщение и предложение для потенциального клиента, основанное на его запросе и возможностях нашей Supervibe Studio.",
    promptInputs: "**Входные параметры для AI:**",
    promptInput1: "1. **Описание Проекта Клиента (из Kwork/Источника):** `{{project_description}}`",
    promptInput2: "2. **Имя Клиента (если есть):** `{{client_name}}`",
    promptInput3: "3. **Бюджет (если есть):** `{{budget_range}}`",
    promptInput4: "4. **Результаты Анализа AI-Оракула:**",
    promptBotAnalysis1: "*   **Оценка Релевантности (нашим ключевым предложениям):** `{{similarity_score}}`",
    promptBotAnalysis2: "*   **Ключевые Запрошенные Клиентом Фичи:** `{{key_features_requested_by_client}}`",
    promptBotAnalysis3: "*   **Фичи, Которые Supervibe Может Авто-Сгенерировать/Jumpstart:** `{{supervibe_jumpstart_features}}`",
    promptBotAnalysis4: "*   **Потенциальные Задачи для Кастомизации (Танкам):** `{{customization_points}}`",
    promptBotAnalysis5: "*   **Потенциальные Новые Ядерные Фичи (Кэрри):** `{{new_core_features}}`",
    promptUSPs: "5. **Наши Уникальные Боевые Преимущества (УБП):**",
    promptUSP1: "*   AI-Форсаж Разработки (Скорость, Эффективность x10)",
    promptUSP2: "*   Создание MVP/Прототипа на Сверхзвуковой (Мгновенная Валидация Идеи)",
    promptUSP3: "*   Фокус на Ударной Ценности, а не на Рутине Копипаста",
    promptUSP4: "*   Прозрачный VIBE-Протокол Работы",
    promptUSP5: "*   (Демо-полигон Supervibe Studio: /repo-xml)",
    promptUSP6: "*   (Программа 'Реактивный Старт' Jumpstart Kit: /jumpstart)",
    promptUSP7: "*   (Примеры боевого применения - туториалы, если релевантно: /tutorials/image-swap)",
    promptOutputStructure: "**Структура Ответного Сигнала (Клиенту):**",
    promptOutput1: "1. **Персональный Вызов (Приветствие):** Обратиться по имени, если известно. '{{client_name}}, ваш сигнал принят!'",
    promptOutput2: "2. **Подтверждение Задачи:** Кратко подтвердить суть его запроса. 'Зафиксирован запрос на создание Telegram Web App для {{их_цель_проекта}}...'",
    promptOutput3: "3. **Демонстрация Превосходства Supervibe:** 'Наша Supervibe Studio, усиленная AI, способна создавать TWA вашего класса на порядок быстрее. Например, по вашему ТЗ, мы можем развернуть функциональный прототип, включающий {{упомянуть 1-2 supervibe_jumpstart_features}}, в кратчайшие сроки.'",
    promptOutput4: "4. **Тактическое Преимущество для Клиента:** 'Это позволит вам валидировать ключевую идею с минимальными затратами времени и ресурсов. Мы же концентрируем наш человеческий гений на создании уникальных, прорывных фич, таких как {{упомянуть 1-2 customization_points или new_core_features}}.'",
    promptOutput5: "5. **Предложение о Сотрудничестве (Мягкий Захват):** 'Готовы ли вы увидеть AI-сгенерированный концепт по вашим требованиям или обсудить, как мы можем эффективно реализовать ваше видение в цифровой реальности?'",
    promptOutput6: "6. **(Опционально) Ссылка на Доп. Разведданные:** например, 'Оцените наш подход к разработке в Supervibe Studio: [ссылка на /repo-xml]' или 'Узнайте о программе 'Реактивный Старт': [ссылка на /jumpstart]'",
    promptTone: "**Стиль Коммуникации:** Уверенный, экспертный, инновационный, с нотками кибер-эстетики (VIBE).",
    promptExample: "**Тактический Пример для AI:**",
    promptExampleText: "Если project_description 'Нужен TWA для нейро-коучинга по управлению гневом', и supervibe_jumpstart_features включает 'модуль чата с AI, трекер прогресса', предложение может включать: '...мы можем оперативно развернуть прототип с AI-чатом для консультаций и системой отслеживания прогресса.'",
    workflowTitle: "::FaProjectDiagram:: Боевой Порядок: От Сигнала до VIBE-Победы",
    workflowSubtitle: "Скоординированная атака нашего КиберОтряда.",
    workflowStep1: "1. ::FaSearchDollar:: **Саппорт:** Обнаруживает сигнал (лид) на Kwork/др., собирает первичные данные, передает Оракулу для квалификации, готовит целеуказания.",
    workflowStep2: "2. ::FaRobot:: **Саппорт/AI-Оракул:** Генерирует и отправляет персонализированное предложение (возможно, с AI-сгенерированным концептом/макетом).",
    workflowStep3: "3. ::FaComments:: **Клиент:** При положительном ответе – сеанс связи (созвон) или доразведка. <Link href='/game-plan' class='text-brand-cyan hover:underline'>Гейм План</Link> – стратегическая карта для этих переговоров.",
    workflowStep4: "4. **Развертывание Сил:**",
    workflowStep4Tank: "::FaShieldHalved:: **Танки:** Берут на себя кастомизацию по целеуказаниям Саппорта (ссылки Supervibe Studio). Применяют всю огневую мощь <Link href='/repo-xml' class='text-brand-cyan hover:underline'>Студии</Link> для штурма клиентских задач.",
    workflowStep4Carry: "::FaBrain:: **Кэрри (Павел):** Работает по ТЗ от Саппорта (GitHub Issues) над созданием новых вооружений и улучшением ядра Supervibe Studio.",
    workflowStep5: "5. ::FaRocket:: **VIBE-Доставка:** Клиент получает свой AI-форсированный Telegram Web App, собранный с кибернетической скоростью и точностью.",
    workflowStep6: "6. ::FaBolt:: **Анализ Результатов и Адаптация:** <Link href='/repo-xml#cybervibe-section' class='text-brand-cyan hover:underline'>Петля CyberVibe</Link> обеспечивает непрерывную оптимизацию и адаптацию на основе боевого опыта и эволюции ваших технологий.",
    assetsTitle: "::FaCubes:: Использование Трофейных Активов CyberVibe",
    assetsSubtitle: "Наш внутренний арсенал для внешнего доминирования.",
    assetJumpstartTitle: "Jumpstart Kit: 'Первый Удар'",
    assetJumpstartDesc: "Наш главный таран для прорыва обороны. Предложите AI-сгенерированный каркас TWA на основе идеи клиента. Мгновенная демонстрация мощи и скорости.",
    assetStudioTitle: "SUPERVIBE Studio: 'Кузница Гефеста'",
    assetStudioDesc: "Ядерный реактор для Танков и Кэрри. Саппорт генерирует гиперссылки-целеуказания для конкретных операций по кастомизации.",
    assetPhilosophyTitle: "Кодекс SelfDev & Скрижали 'Цель и Прибыль'",
    assetPhilosophyDesc: "Идеологический фундамент. Определяет наш стиль коммуникации, акцентируя внимание на ценности, решении реальных проблем и создании аутентичных продуктов, а не бездушного кода.",
    assetPlansTitle: "Гейм План & VIBE План: 'Карты Войны'",
    assetPlansDesc: "Секретные стратегические директивы. Саппорт черпает из них тактические приемы для формирования предложений и построения долгосрочного видения для клиента.",
    assetTutorialsTitle: "Арсенал Приемов и Тактик (Туториалы)",
    assetTutorialsDesc: "Демонстрируют конкретные боевые возможности (замена медиа, деактивация мин). Можно показывать клиентам для иллюстрации простоты модификаций или использовать для подготовки новобранцев в отряд Танков.",
    assetCyberDevOSTitle: "CyberDev OS (Геймификация): 'Путь Воина'",
    assetCyberDevOSDesc: "Демонстрирует философию 'непрерывной прокачки'. Уникальное УБП – клиенты не просто заказывают приложение, они подключаются к саморазвивающейся экосистеме.",
    zionTitle: "::FaComments:: Цитадель 'Зион': Комьюнити-Реактор",
    zionSubtitle: "Ваш Telegram-канал/чат: узел связи КиберОтряда и вербовочный пункт для будущих VIBE-адептов.",
    zionP1: "**Зион (Ваш Telegram Канал/Чат):** Это не просто флудилка, это ваш оперативный штаб, центр поддержки и инкубатор гениальных идей.",
    zionList1: "**Координация Танков:** Обсуждение сложных маневров кастомизации, обмен боевым опытом, разработка новых тактик.",
    zionList2: "**Разведсводки от Саппорта:** Саппорт докладывает о ситуации на 'передовой' (общение с лидами), помогая корректировать предложения и выявлять новые потребности рынка.",
    zionList3: "**Прогрев Целей (Мягкая Сила):** Потенциальные клиенты (при стратегическом добавлении) наблюдают за боевой активностью, видят решение проблем и проникаются VIBE-атмосферой.",
    zionList4: "**Школа Молодого Бойца:** Перспективные члены комьюнити, проявившие талант, могут проходить подготовку для зачисления в отряд Танков.",
    zionLink: "::FaTelegramPlane className='mr-2':: Координаты 'Зиона': [t.me/salavey_channel]",
    ctaTitle: "АКТИВИРОВАТЬ ПРОТОКОЛ 'ДОЗОР'!",
    ctaSubtitle: "Система в боевой готовности. Отряд укомплектован. Время высылать Саппортов и начинать сбор трофеев. Да пребудет с нами VIBE!",
    ctaButtonText: "::FaBolt:: НАЧАТЬ ОХОТУ НА КИБЕР-ЛИДОВ!",
  },
  en: { // Fallback English translations (mostly placeholders, you'd fill these properly)
    pageTitle: "CNW 'CyberNetwork Watch'",
    pageSubtitle: "CyberParty Operatives! This is your command center for client acquisition and Supervibe-style domination. Roles assigned, targets identified, VIBE engaged. Let's transmute info into profit!",
    rolesTitle: "::FaUserFriends:: The CyberParty: Roles & Combat Objectives",
    rolesSubtitle: "The war machine crew, charged for VIBE-victory and total supremacy.",
    carryRoleTitle: "::FaBrain:: Carry (Pavel)",
    carryRoleDesc: "Supreme Architect, Engine of Innovation. Creates and implements breakthrough features in Supervibe Studio. Solves unconventional, complex development challenges, defining the platform's evolutionary vector. His code is law.",
    carryRoleLink: "Carry's Personal File",
    tanksRoleTitle: "::FaShieldHalved:: Tanks (Assault Echelon)",
    tanksRoleDesc: "The armored fist of customization and adaptation. They absorb the 'damage' from complex client requests, AI artifacts (icon hallucinations, media replacement). They transmute base modules into unique client solutions using Supervibe Studio's reactive power. Their motto: 'We'll break through!'",
    tanksRoleLeverages: "Primary Armament: Image Swap, Icon-Mine Deactivation, Video Integration, Inception Swap Maneuvers.",
    supportRoleTitle: "::FaHeadset:: Support (Quartermaster & Liaison)",
    supportRoleDesc: "Information-logistics center and voice of the squad. Identifies, filters, and processes incoming signals (leads). Prepares intel and target designations for Tanks and Carry. Conducts negotiations, ensuring seamless communication and supply.",
    supportArsenalTitle: "::FaTools:: Support's Arsenal: Instruments & Protocols",
    supportArsenalSubtitle: "High-tech gear for information warfare and effective recruitment.",
    phase1Title: "::FaBinoculars:: Protocol 'Mole': Kwork Reconnaissance & Data Collection",
    phase1Point1: "**Targeted Search & Scan:** Utilize pre-set Kwork hyperlinks (see below) and develop new ones to detect current requests ('Telegram Web App', 'Mini App', 'TWA', 'Neural Nets for Business').",
    phase1Point2: "**Intel Extraction (Manual/Automated):** Copy priority project descriptions from Kwork (full HTML for AI analysis, text for quick assessment). ::FaFileSignature:: **Focus on fresh signals!**",
    phase1Point3: "**Integration into DPC (Data Processing Center - Supabase):** Log classified leads into the `public.leads` table in Supabase. Record: source, URL, description, budget, timestamps.",
    kworkSearchLink1: "::FaExternalLinkAlt:: Telegram Web Apps",
    kworkSearchLink2: "::FaExternalLinkAlt:: Telegram Mini Apps",
    kworkSearchLink3: "::FaExternalLinkAlt:: TWA Development",
    kworkSearchLink4: "::FaExternalLinkAlt:: Telegram Bots + Neural Nets",
    csvUploadTitle: "::FaFileUpload:: Protocol 'Stream Upload': Import CSV with Leads",
    csvUploadDesc: "For bulk processing or importing from other sources, Support can upload leads in CSV format directly to Supabase. (This feature is under development; for now, manual table entry).",
    csvUploadButton: "UPLOAD CSV WITH LEADS (WIP)",
    leadsTableTitle: "::FaTableList:: Lead Management Dashboard (Concept)",
    leadsTableDesc: "Visualization of the `public.leads` table from Supabase for tracking statuses, assignments, and progress for each lead. (Interactive table will be added here).",
    leadsTableNote: "Structure of `public.leads` table in Supabase:",
    aiLeadRatingTitle: "::FaBrainCircuit:: Protocol 'Oracle': AI Lead Scoring & Prioritization",
    aiLeadRatingDesc: "After uploading to Supabase, Support initiates AI analysis of new leads. A special prompt is used to evaluate each lead on key parameters.",
    aiLeadRatingPromptTitle: "Master Prompt for AI Lead Evaluation:",
    phase2Title: "::FaRobot:: Protocol 'Centurion': Lead Qualification (AI Analysis)",
    phase2Point1: "**Relevance Scoring:** Feed HTML/text descriptions of leads to the AI-Oracle to assess relevance to our core competencies (AI-accelerated TWA development). This is the basis for filtering and prioritization.",
    phase2Point2: "**Capability Matching:** The Oracle determines how well lead features match <Link href='/jumpstart' class='text-brand-cyan hover:underline'>Jumpstart Kit</Link> offerings or Supervibe Studio's auto-generation capabilities.",
    phase2Point3: "**Resource Cost Assessment:** The Oracle classifies requests: 'Easy Prey (High Automation Potential)', 'Requires Effort (Tank Customization)', 'Challenge for a Titan (New functionality for Carry)'.",
    phase3Title: "::FaTasks:: Protocol 'Coordinator': Task Prep for the Squad",
    phase3Point1: "**For Tanks (Customization/Adaptation):** Generate direct target designations (<Link href='/repo-xml' class='text-brand-cyan hover:underline'>Supervibe Studio</Link> links) with `path` (to base module) and `idea` (client specification) parameters. Example: `/repo-xml?path=/components/OrderForm.tsx&idea=Add 'express-delivery' option with calculation`. Save in `supervibe_studio_links` (JSONB).",
    phase3Point2: "**For Carry (R&D of New Weapons):** If a request requires creating entirely new modules or expanding the Supervibe core, create detailed Technical Specifications (TS) as GitHub Issues. Link them in `github_issue_links` (JSONB).",
    phase3Point3: "**Update Operational Status:** Mark lead status in the DPC Supabase (e.g., 'oracle_processed', 'assigned_tanks', 'carry_dev_in_progress').",
    offerTitle: "::FaBullhorn:: Protocol 'Siren': Crafting the Killer Offer",
    offerSubtitle: "The AI-charged message that turns targets into allies.",
    offerP1: "Support, augmented by Oracle intel, uses this master prompt to generate a personalized first contact. The message emphasizes speed, AI advantages, and a lightning path to MVP.",
    offerP2: "The offer must always show the client **'what's in it for me, here and now'** – quick hypothesis testing, risk minimization, focus on their unique value. The <Link href='/jumpstart' class='text-brand-cyan hover:underline'>Jumpstart Kit</Link> philosophy is our trump card.",
    promptObjective: "**Objective:** Generate a personalized, compelling introductory message and offer to a potential client based on their project request and our Supervibe Studio capabilities.",
    promptInputs: "**Inputs for AI:**",
    promptInput1: "1. **Client's Project Description (from Kwork/Source):** `{{project_description}}`",
    promptInput2: "2. **Client's Name (if available):** `{{client_name}}`",
    promptInput3: "3. **Budget (if available):** `{{budget_range}}`",
    promptInput4: "4. **AI-Oracle Analysis Results:**",
    promptBotAnalysis1: "*   **Relevance Score (to our core offerings):** `{{similarity_score}}`",
    promptBotAnalysis2: "*   **Key Features Requested by Client:** `{{key_features_requested_by_client}}`",
    promptBotAnalysis3: "*   **Features Supervibe Can Auto-Generate/Jumpstart:** `{{supervibe_jumpstart_features}}`",
    promptBotAnalysis4: "*   **Potential Customization Tasks (for Tanks):** `{{customization_points}}`",
    promptBotAnalysis5: "*   **Potential New Core Features (for Carry):** `{{new_core_features}}`",
    promptUSPs: "5. **Our Unique Combat Advantages (UCAs):**",
    promptUSP1: "*   AI-Boosted Development (Speed, Efficiency x10)",
    promptUSP2: "*   Supersonic MVP/Prototype Creation (Instant Idea Validation)",
    promptUSP3: "*   Focus on Impact Value, Not Copy-Paste Routine",
    promptUSP4: "*   Transparent VIBE Work Protocol",
    promptUSP5: "*   (Supervibe Studio Demo Grounds: /repo-xml)",
    promptUSP6: "*   (Jumpstart Kit 'Reactive Start' Program: /jumpstart)",
    promptUSP7: "*   (Combat Application Examples - tutorials, if relevant: /tutorials/image-swap)",
    promptOutputStructure: "**Return Signal Structure (to Client):**",
    promptOutput1: "1. **Personal Call Sign (Greeting):** Address by name if known. '{{client_name}}, your signal is received!'",
    promptOutput2: "2. **Task Confirmation:** Briefly confirm the essence of their request. 'Request logged for creating a Telegram Web App for {{their_project_goal}}...'",
    promptOutput3: "3. **Supervibe Superiority Demo:** 'Our Supervibe Studio, AI-enhanced, can create TWAs of your class an order of magnitude faster. For example, based on your specs, we can deploy a functional prototype including {{mention 1-2 supervibe_jumpstart_features}} in the shortest possible time.'",
    promptOutput4: "4. **Tactical Advantage for Client:** 'This allows you to validate your key idea with minimal time and resource expenditure. We, on the other hand, concentrate our human genius on creating unique, breakthrough features like {{mention 1-2 customization_points or new_core_features}}.'",
    promptOutput5: "5. **Cooperation Proposal (Soft Seizure):** 'Are you ready to see an AI-generated concept based on your requirements or discuss how we can efficiently realize your vision in digital reality?'",
    promptOutput6: "6. **(Optional) Link to Additional Intel:** e.g., 'Evaluate our development approach at Supervibe Studio: [link to /repo-xml]' or 'Learn about the 'Reactive Start' program: [link to /jumpstart]'",
    promptTone: "**Communication Style:** Confident, expert, innovative, with a touch of cyber-aesthetics (VIBE).",
    promptExample: "**Tactical Example for AI:**",
    promptExampleText: "If project_description is 'Need TWA for neuro-coaching on anger management', and supervibe_jumpstart_features includes 'AI chat module, progress tracker', the offer might include: '...we can rapidly deploy a prototype with an AI chat for consultations and a progress tracking system.'",
    workflowTitle: "::FaProjectDiagram:: Combat Order: From Signal to VIBE-Victory",
    workflowSubtitle: "Coordinated strike of our CyberParty.",
    workflowStep1: "1. ::FaSearchDollar:: **Support:** Detects signal (lead) on Kwork/etc., gathers initial data, passes to Oracle for qualification, prepares target designations.",
    workflowStep2: "2. ::FaRobot:: **Support/AI-Oracle:** Generates and sends personalized offer (possibly with AI-generated concept/mockup).",
    workflowStep3: "3. ::FaComments:: **Client:** Positive response leads to a communication session (call) or further reconnaissance. <Link href='/game-plan' class='text-brand-cyan hover:underline'>Game Plan</Link> – strategic map for these negotiations.",
    workflowStep4: "4. **Force Deployment:**",
    workflowStep4Tank: "::FaShieldHalved:: **Tanks:** Take on customization based on Support's target designations (Supervibe Studio links). Apply full firepower of the <Link href='/repo-xml' class='text-brand-cyan hover:underline'>Studio</Link> to storm client tasks.",
    workflowStep4Carry: "::FaBrain:: **Carry (Pavel):** Works on TS from Support (GitHub Issues) to create new armaments and improve the Supervibe Studio core.",
    workflowStep5: "5. ::FaRocket:: **VIBE Delivery:** Client receives their AI-accelerated Telegram Web App, assembled with cybernetic speed and precision.",
    workflowStep6: "6. ::FaBolt:: **Results Analysis & Adaptation:** The <Link href='/repo-xml#cybervibe-section' class='text-brand-cyan hover:underline'>CyberVibe Loop</Link> ensures continuous optimization and adaptation based on combat experience and your evolving technologies.",
    assetsTitle: "::FaCubes:: Utilizing Captured CyberVibe Assets",
    assetsSubtitle: "Our internal arsenal for external domination.",
    assetJumpstartTitle: "Jumpstart Kit: 'First Strike'",
    assetJumpstartDesc: "Our main ram for breaching defenses. Offer an AI-generated TWA framework based on the client's idea. Instant demonstration of power and speed.",
    assetStudioTitle: "SUPERVIBE Studio: 'Hephaestus' Forge'",
    assetStudioDesc: "The nuclear reactor for Tanks and Carry. Support generates hyperlink target-designations for specific customization operations.",
    assetPhilosophyTitle: "SelfDev Codex & 'Purpose & Profit' Tablets",
    assetPhilosophyDesc: "Ideological foundation. Defines our communication style, emphasizing value, solving real problems, and creating authentic products, not soulless code.",
    assetPlansTitle: "Game Plan & VIBE Plan: 'War Maps'",
    assetPlansDesc: "Secret strategic directives. Support draws tactical maneuvers from them for offer formation and building long-term client vision.",
    assetTutorialsTitle: "Arsenal of Techniques & Tactics (Tutorials)",
    assetTutorialsDesc: "Demonstrate specific combat capabilities (media replacement, mine deactivation). Can be shown to clients to illustrate ease of modifications or used to train new recruits for the Tank squad.",
    assetCyberDevOSTitle: "CyberDev OS (Gamification): 'Warrior's Path'",
    assetCyberDevOSDesc: "Demonstrates the 'continuous leveling' philosophy. Unique UCA – clients don't just order an app, they connect to a self-developing ecosystem.",
    zionTitle: "::FaComments:: Citadel 'Zion': Community Reactor",
    zionSubtitle: "Your Telegram channel/chat: CyberParty communication hub and recruitment station for future VIBE adepts.",
    zionP1: "**Zion (Your Telegram Channel/Chat):** This isn't just a chat room, it's your operational HQ, support center, and incubator for brilliant ideas.",
    zionList1: "**Tank Coordination:** Discussion of complex customization maneuvers, exchange of combat experience, development of new tactics.",
    zionList2: "**Intel Reports from Support:** Support reports on the 'frontline' situation (lead communication), helping to adjust offers and identify new market needs.",
    zionList3: "**Target Warming (Soft Power):** Potential clients (if strategically added) observe combat activity, see problem-solving, and get imbued with the VIBE atmosphere.",
    zionList4: "**Boot Camp:** Promising community members who show talent can undergo training for enlistment in the Tank squad.",
    zionLink: "::FaTelegramPlane className='mr-2':: 'Zion' Coordinates: [t.me/your_supervibe_channel_here]",
    ctaTitle: "ACTIVATE PROTOCOL 'WATCH'!",
    ctaSubtitle: "System at combat readiness. Squad fully equipped. Time to deploy Support and begin harvesting trophies. May the VIBE be with us!",
    ctaButtonText: "::FaBolt:: INITIATE CYBER-LEAD HUNT!",
  }
};

const LeadGenerationHQPage = () => {
  const [lang, setLang] = useState<'ru' | 'en'>('ru');
  const t = translations[lang];

  const pageTheme = {
    primaryColor: "text-brand-orange", // Main theme color - vibrant orange
    secondaryColor: "text-brand-yellow", // For specific highlights within sections
    accentColor: "text-brand-cyan",     // For call-to-actions or specific UI elements
    borderColor: "border-brand-orange/50", // Matching border
    shadowColor: "shadow-[0_0_25px_rgba(255,108,0,0.5)]", // Orange glow
    buttonGradient: "bg-gradient-to-r from-brand-orange to-brand-yellow", // Button gradient
  };

  const kworkSearchLinks = [
    { name: t.kworkSearchLink1, url: "https://kwork.ru/projects?c=all&q=telegram+web+app" },
    { name: t.kworkSearchLink2, url: "https://kwork.ru/projects?c=all&q=telegram+mini+app" },
    { name: t.kworkSearchLink3, url: "https://kwork.ru/projects?c=all&q=TWA+разработка" },
    { name: t.kworkSearchLink4, url: "https://kwork.ru/projects?c=all&q=telegram+бот+нейросеть" },
  ];

  const supabaseLeadsTableStructure = `
    -- SQL для создания таблицы лидов в Supabase
    CREATE TABLE public.leads (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      source TEXT NOT NULL DEFAULT 'kwork', -- Источник: kwork, contra, direct и т.д.
      lead_url TEXT UNIQUE,                -- Ссылка на проект Kwork или профиль клиента
      client_name TEXT,                    -- Имя клиента (если известно)
      project_description TEXT NOT NULL,   -- Описание проекта клиентом
      raw_html_description TEXT,           -- Сырое HTML описание для обработки ботом
      budget_range TEXT,                   -- Бюджет (если указан)
      posted_at TIMESTAMPTZ,               -- Когда опубликован запрос
      similarity_score NUMERIC(5,2),       -- Оценка сходства от нашего бота
      status TEXT DEFAULT 'new',           -- Статус: new, contacted, interested, demo_generated, in_progress, closed_won, closed_lost
      assigned_to_tank TEXT,               -- ID пользователя Танка (бывший Medic)
      assigned_to_carry TEXT,              -- ID пользователя Кэрри
      notes TEXT,                          -- Заметки по лиду
      supervibe_studio_links JSONB,        -- JSON с ссылками в Supervibe Studio (path, idea)
      github_issue_links JSONB,            -- JSON с ссылками на GitHub Issues
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );

    -- Рекомендуется создать индексы для часто используемых полей (source, status, posted_at)
    CREATE INDEX idx_leads_status ON public.leads(status);
    CREATE INDEX idx_leads_posted_at ON public.leads(posted_at DESC);
  `;
  
  const aiLeadRatingPrompt = `
    **Задача:** Проанализировать список описаний проектов (лидов) и для КАЖДОГО выдать структурированную оценку.

    **Входные данные для каждого лида:**
    1.  \`lead_id\`: (Уникальный идентификатор лида, если есть)
    2.  \`project_description\`: (Полное описание проекта от клиента)
    3.  \`budget_range\`: (Бюджет, если указан)
    4.  \`source_platform\`: (Платформа, например, Kwork)

    **Ключевые компетенции Supervibe Studio:**
    *   Быстрая разработка Telegram Web Apps (TWA) / Mini Apps.
    *   AI-ассистированная генерация кода и контента.
    *   Создание MVP для быстрой валидации идей.
    *   Интеграция с Telegram ботами.
    *   Кастомизация UI/UX.
    *   Работа с Supabase (БД, Auth).
    *   Возможность быстрого прототипирования стандартных модулей (регистрация, профили, каталоги, простые формы, админ-панели).

    **Формат вывода для КАЖДОГО лида (JSON):**
    \`\`\`json
    {
      "lead_id": "ID_ЛИДА_ИЛИ_НОМЕР_ПО_ПОРЯДКУ",
      "relevance_score": ЧИСЛО_ОТ_0_ДО_10, // Насколько проект соответствует компетенциям Supervibe (10 = идеально)
      "automation_potential_score": ЧИСЛО_ОТ_0_ДО_10, // Насколько много можно автоматизировать с помощью Supervibe (10 = почти всё)
      "customization_level": "low" | "medium" | "high", // Уровень требуемой кастомизации/адаптации
      "new_features_needed_level": "low" | "medium" | "high", // Уровень потребности в принципиально новых фичах (для Кэрри)
      "estimated_value_score": ЧИСЛО_ОТ_0_ДО_10, // Субъективная оценка потенциальной ценности/бюджета проекта (10 = высокий)
      "key_requested_features": ["фича1", "фича2", ...], // Список ключевых фич, запрошенных клиентом
      "supervibe_match_features": ["фича_supervibe1", "фича_supervibe2", ...], // Фичи, которые хорошо ложатся на Supervibe
      "suggested_supervibe_studio_path": "/components/RelevantComponent.tsx", // Пример пути для кастомизации (если применимо)
      "summary_for_support": "Краткое резюме (1-2 предложения) для Саппорта с основной сутью и рекомендацией (контактировать, передать Танкам/Кэрри, низкий приоритет).",
      "warnings": ["возможная проблема1", "возможная проблема2", ...] // Потенциальные риски или неясности
    }
    \`\`\`

    **Инструкции по оценке:**
    *   **relevance_score:** Высокий, если это TWA/Mini App, подразумевает UI, возможно бот. Низкий, если это чисто бэкенд или не связано с Telegram.
    *   **automation_potential_score:** Высокий, если много стандартных UI элементов, форм, CRUD операций. Низкий, если много уникальной нестандартной логики.
    *   **customization_level:** Зависит от того, насколько уникальны требования к UI/UX по сравнению с тем, что Studio может сгенерировать "из коробки".
    *   **new_features_needed_level:** Высокий, если требуются сложные интеграции с внешними системами, уникальные алгоритмы, которых нет в Studio.
    *   **estimated_value_score:** Учитывай бюджет (если есть), сложность, потенциальную бизнес-ценность для клиента.
    *   **summary_for_support:** Должен быть предельно ясным и давать Саппорту четкое понимание, что делать дальше.

    Проанализируй следующий список лидов и предоставь JSON-массив с оценками для каждого:
    {{СПИСОК_ОПИСАНИЙ_ЛИДОВ_В_ТЕКСТОВОМ_ФОРМАТЕ_ИЛИ_МАССИВ_ОБЪЕКТОВ}}
  `;


  const personalizedOfferPromptStructure = `
    **${t.promptObjective}**

    **${t.promptInputs}**
    1.  ${t.promptInput1}
    2.  ${t.promptInput2}
    3.  ${t.promptInput3}
    4.  ${t.promptInput4}
        *   ${t.promptBotAnalysis1}
        *   ${t.promptBotAnalysis2}
        *   ${t.promptBotAnalysis3}
        *   ${t.promptBotAnalysis4}
        *   ${t.promptBotAnalysis5}
    5.  **${t.promptUSPs}**
        *   ${t.promptUSP1}
        *   ${t.promptUSP2}
        *   ${t.promptUSP3}
        *   ${t.promptUSP4}
        *   (${t.promptUSP5}: /repo-xml)
        *   (${t.promptUSP6}: /jumpstart)
        *   (${t.promptUSP7}: /tutorials/image-swap)

    **${t.promptOutputStructure}**
    1.  ${t.promptOutput1}
    2.  ${t.promptOutput2}
    3.  ${t.promptOutput3}
    4.  ${t.promptOutput4}
    5.  ${t.promptOutput5}
    6.  ${t.promptOutput6}

    **${t.promptTone}**

    **${t.promptExample}**
    ${t.promptExampleText}
  `;

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-gray-950 via-black to-purple-900/30 text-gray-200 pt-24 pb-20 overflow-x-hidden">
      <div
        className="absolute inset-0 bg-repeat opacity-[0.04] z-0"
        style={{
          backgroundImage: `linear-gradient(to right, hsl(var(--brand-orange-hsl)) 0.5px, transparent 0.5px),
                            linear-gradient(to bottom, hsl(var(--brand-orange-hsl)) 0.5px, transparent 0.5px)`,
          backgroundSize: '50px 50px',
        }}
      ></div>

      <div className="relative z-10 container mx-auto px-4">
        <header className="text-center mb-12 md:mb-16">
          <VibeContentRenderer content={`::FaUsersCog className="mx-auto text-7xl mb-5 ${pageTheme.primaryColor} animate-pulse"::`} />
          <h1 className={cn("text-4xl sm:text-5xl md:text-6xl font-orbitron font-bold cyber-text glitch mb-4", pageTheme.primaryColor)} data-text={t.pageTitle}>
            <VibeContentRenderer content={t.pageTitle} />
          </h1>
          <CardDescription className="text-md sm:text-lg md:text-xl text-gray-300 font-mono max-w-3xl mx-auto">
            <VibeContentRenderer content={t.pageSubtitle} />
          </CardDescription>
        </header>

        <div className="space-y-12 md:space-y-16">
          {/* Section 1: The CyberParty Roles */}
          <Card className={cn("bg-black/70 backdrop-blur-md border-2", pageTheme.borderColor, pageTheme.shadowColor)}>
            <CardHeader>
              <CardTitle className={cn("text-3xl font-orbitron flex items-center gap-3", pageTheme.primaryColor)}>
                <VibeContentRenderer content={t.rolesTitle} />
              </CardTitle>
              <CardDescription className="font-mono text-gray-400"><VibeContentRenderer content={t.rolesSubtitle} /></CardDescription>
            </CardHeader>
            <CardContent className="grid md:grid-cols-3 gap-6 font-mono">
              <div className={cn("p-5 border-2 rounded-xl bg-gray-950/50", pageTheme.borderColor, `hover:${pageTheme.shadowColor} transition-shadow duration-300`)}>
                <h3 className={cn("text-2xl font-bold mb-2 flex items-center gap-2", pageTheme.secondaryColor)}><VibeContentRenderer content={t.carryRoleTitle} /></h3>
                <p className="text-sm text-gray-300 leading-relaxed"><VibeContentRenderer content={t.carryRoleDesc} /></p>
                 <Link href="/about" className={cn("text-xs mt-3 inline-block hover:underline font-semibold", pageTheme.secondaryColor)}><VibeContentRenderer content={t.carryRoleLink} /></Link>
              </div>
              <div className={cn("p-5 border-2 rounded-xl bg-gray-950/50", pageTheme.borderColor, `hover:${pageTheme.shadowColor} transition-shadow duration-300`)}>
                <h3 className={cn("text-2xl font-bold mb-2 flex items-center gap-2", pageTheme.secondaryColor)}><VibeContentRenderer content={t.tanksRoleTitle} /></h3>
                <p className="text-sm text-gray-300 leading-relaxed"><VibeContentRenderer content={t.tanksRoleDesc} /></p>
                <p className={cn("text-xs text-gray-400 mt-2 pt-2 border-t", `${pageTheme.borderColor}/30`)}><VibeContentRenderer content={t.tanksRoleLeverages} /></p>
              </div>
              <div className={cn("p-5 border-2 rounded-xl bg-gray-950/50", pageTheme.borderColor, `hover:${pageTheme.shadowColor} transition-shadow duration-300`)}>
                <h3 className={cn("text-2xl font-bold mb-2 flex items-center gap-2", pageTheme.secondaryColor)}><VibeContentRenderer content={t.supportRoleTitle} /></h3>
                <p className="text-sm text-gray-300 leading-relaxed"><VibeContentRenderer content={t.supportRoleDesc} /></p>
              </div>
            </CardContent>
          </Card>

          {/* Section 2: Support's Arsenal & Workflow */}
          <Card className={cn("bg-black/70 backdrop-blur-md border-2", pageTheme.borderColor, pageTheme.shadowColor)}>
            <CardHeader>
              <CardTitle className={cn("text-3xl font-orbitron flex items-center gap-3", pageTheme.primaryColor)}>
                <VibeContentRenderer content={t.supportArsenalTitle} />
              </CardTitle>
              <CardDescription className="font-mono text-gray-400"><VibeContentRenderer content={t.supportArsenalSubtitle} /></CardDescription>
            </CardHeader>
            <CardContent className="space-y-10 font-mono">
              {/* Phase 1: Kwork Recon */}
              <div>
                <h4 className={cn("text-xl font-bold mb-4 flex items-center gap-2", pageTheme.accentColor)}><VibeContentRenderer content={t.phase1Title} /></h4>
                <ul className="list-none space-y-3 text-sm text-gray-300 pl-2">
                  <li className="flex items-start">
                    <VibeContentRenderer content="::FaChartLine className='mr-3 mt-1 text-xl flex-shrink-0'::" />
                    <div>
                      <VibeContentRenderer content={t.phase1Point1} />
                      <div className="flex flex-wrap gap-2 mt-3">
                        {kworkSearchLinks.map(link => (
                          <Button key={link.name} variant="outline" size="sm" asChild className={cn("text-xs py-1 px-2", pageTheme.borderColor, pageTheme.primaryColor, `hover:${pageTheme.primaryColor}/80 hover:bg-black/20`)}>
                            <a href={link.url} target="_blank" rel="noopener noreferrer"><VibeContentRenderer content={link.name} /></a>
                          </Button>
                        ))}
                      </div>
                    </div>
                  </li>
                  <li className="flex items-start"><VibeContentRenderer content="::FaFileSignature className='mr-3 mt-1 text-xl flex-shrink-0'::" /><VibeContentRenderer content={t.phase1Point2} /></li>
                  {/* CSV Upload Section */}
                  <li>
                    <VibeContentRenderer content="::FaFileUpload className='mr-3 mt-1 text-xl flex-shrink-0 text-brand-lime'::" />
                    <div>
                        <VibeContentRenderer content={`**${t.csvUploadTitle}**`} />
                        <p className="text-xs text-gray-400 mb-2"><VibeContentRenderer content={t.csvUploadDesc} /></p>
                        <Button variant="secondary" size="sm" className="text-xs py-1 px-2 bg-brand-lime/20 text-brand-lime border-brand-lime/50 hover:bg-brand-lime/30" disabled>
                            <VibeContentRenderer content={t.csvUploadButton} />
                        </Button>
                    </div>
                  </li>
                  {/* Supabase Table Structure */}
                  <li className="flex items-start">
                    <VibeContentRenderer content="::FaDatabase className='mr-3 mt-1 text-xl flex-shrink-0 text-brand-green'::" /> {/* Changed from FaSupabase */}
                    <div>
                      <VibeContentRenderer content={t.phase1Point3} />
                      <Card className={cn("mt-3 bg-black/50 p-3 border text-xs overflow-x-auto simple-scrollbar", `${pageTheme.borderColor}/70`)}>
                        <CardDescription className="text-xs text-gray-500 mb-1"><VibeContentRenderer content={t.leadsTableNote} /></CardDescription>
                        <pre className="text-gray-400 whitespace-pre-wrap text-[0.65rem] leading-snug">{supabaseLeadsTableStructure.trim()}</pre>
                      </Card>
                    </div>
                  </li>
                  {/* Conceptual Leads Table Display */}
                  <li>
                    <VibeContentRenderer content="::FaTableList className='mr-3 mt-1 text-xl flex-shrink-0 text-brand-cyan'::" />
                    <div>
                        <VibeContentRenderer content={`**${t.leadsTableTitle}**`} />
                        <p className="text-xs text-gray-400"><VibeContentRenderer content={t.leadsTableDesc} /></p>
                    </div>
                  </li>
                </ul>
              </div>
              
              {/* AI Lead Rating Section */}
              <div>
                <h4 className={cn("text-xl font-bold mb-4 flex items-center gap-2", pageTheme.accentColor)}><VibeContentRenderer content={t.aiLeadRatingTitle} /></h4>
                 <p className="text-sm text-gray-300 mb-3 pl-2"><VibeContentRenderer content={t.aiLeadRatingDesc} /></p>
                 <Card className={cn("bg-gray-950/60 p-4 border text-xs overflow-x-auto simple-scrollbar", `${pageTheme.borderColor}/70`)}>
                    <CardDescription className="text-xs text-gray-500 mb-1"><VibeContentRenderer content={t.aiLeadRatingPromptTitle} /></CardDescription>
                    <pre className="text-gray-400 whitespace-pre-wrap text-[0.7rem] leading-normal">{aiLeadRatingPrompt.trim()}</pre>
                </Card>
              </div>

              {/* Phase 2: Lead Qualification (Original) */}
              <div>
                <h4 className={cn("text-xl font-bold mb-4 flex items-center gap-2", pageTheme.accentColor)}><VibeContentRenderer content={t.phase2Title} /></h4>
                <ul className="list-none space-y-3 text-sm text-gray-300 pl-2">
                  <li className="flex items-start"><VibeContentRenderer content="::FaRobot className='mr-3 mt-1 text-xl flex-shrink-0'::" /><VibeContentRenderer content={t.phase2Point1} /></li>
                  <li className="flex items-start"><VibeContentRenderer content="::FaLightbulb className='mr-3 mt-1 text-xl flex-shrink-0'::" /><VibeContentRenderer content={t.phase2Point2} /></li>
                  <li className="flex items-start"><VibeContentRenderer content="::FaTasks className='mr-3 mt-1 text-xl flex-shrink-0'::" /><VibeContentRenderer content={t.phase2Point3} /></li>
                </ul>
              </div>

              {/* Phase 3: Task Preparation (Original) */}
              <div>
                <h4 className={cn("text-xl font-bold mb-4 flex items-center gap-2", pageTheme.accentColor)}><VibeContentRenderer content={t.phase3Title} /></h4>
                <ul className="list-none space-y-3 text-sm text-gray-300 pl-2">
                  <li className="flex items-start">
                    <VibeContentRenderer content="::FaUserSecret className='mr-3 mt-1 text-xl flex-shrink-0'::" />
                    <VibeContentRenderer content={t.phase3Point1} />
                  </li>
                  <li className="flex items-start">
                    <VibeContentRenderer content="::FaUserNinja className='mr-3 mt-1 text-xl flex-shrink-0'::" />
                    <VibeContentRenderer content={t.phase3Point2} />
                  </li>
                  <li className="flex items-start"><VibeContentRenderer content="::FaLink className='mr-3 mt-1 text-xl flex-shrink-0'::" /><VibeContentRenderer content={t.phase3Point3} /></li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Section 3: Crafting the Irresistible Offer (Original) */}
          <Card className={cn("bg-black/70 backdrop-blur-md border-2", pageTheme.borderColor, pageTheme.shadowColor)}>
            <CardHeader>
              <CardTitle className={cn("text-3xl font-orbitron flex items-center gap-3", pageTheme.primaryColor)}>
                <VibeContentRenderer content={t.offerTitle} />
              </CardTitle>
              <CardDescription className="font-mono text-gray-400"><VibeContentRenderer content={t.offerSubtitle} /></CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 font-mono">
              <p className="text-sm text-gray-300 leading-relaxed">
                <VibeContentRenderer content={t.offerP1} />
              </p>
              <Card className={cn("bg-gray-950/60 p-4 border text-xs overflow-x-auto simple-scrollbar", `${pageTheme.borderColor}/70`)}>
                <pre className="text-gray-400 whitespace-pre-wrap text-[0.7rem] leading-normal">{personalizedOfferPromptStructure.trim()}</pre>
              </Card>
              <p className="text-sm text-gray-300 leading-relaxed">
                <VibeContentRenderer content={t.offerP2} />
              </p>
            </CardContent>
          </Card>

          {/* Section 4: The Workflow (Original) */}
          <Card className={cn("bg-black/70 backdrop-blur-md border-2", pageTheme.borderColor, pageTheme.shadowColor)}>
            <CardHeader>
              <CardTitle className={cn("text-3xl font-orbitron flex items-center gap-3", pageTheme.primaryColor)}>
                <VibeContentRenderer content={t.workflowTitle} />
              </CardTitle>
              <CardDescription className="font-mono text-gray-400"><VibeContentRenderer content={t.workflowSubtitle} /></CardDescription>
            </CardHeader>
            <CardContent className="font-mono text-sm text-gray-300 space-y-4">
                <VibeContentRenderer content={`1. ${t.workflowStep1}`} />
                <VibeContentRenderer content={`2. ${t.workflowStep2}`} />
                <VibeContentRenderer content={`3. ${t.workflowStep3}`} />
                <div>
                    <VibeContentRenderer content={`4. ${t.workflowStep4}`} />
                    <ul className="list-disc list-inside pl-6 mt-1 space-y-1">
                        <li><VibeContentRenderer content={t.workflowStep4Tank} /></li>
                        <li><VibeContentRenderer content={t.workflowStep4Carry} /></li>
                    </ul>
                </div>
                <VibeContentRenderer content={`5. ${t.workflowStep5}`} />
                <VibeContentRenderer content={`6. ${t.workflowStep6}`} />
            </CardContent>
          </Card>

          {/* Section 5: Leveraging Existing Assets (Original) */}
          <Card className={cn("bg-black/70 backdrop-blur-md border-2", pageTheme.borderColor, pageTheme.shadowColor)}>
            <CardHeader>
              <CardTitle className={cn("text-3xl font-orbitron flex items-center gap-3", pageTheme.primaryColor)}>
                <VibeContentRenderer content={t.assetsTitle} />
              </CardTitle>
              <CardDescription className="font-mono text-gray-400"><VibeContentRenderer content={t.assetsSubtitle} /></CardDescription>
            </CardHeader>
            <CardContent className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 font-mono text-sm">
              {[
                { titleKey: 'assetJumpstartTitle', descKey: 'assetJumpstartDesc', link: '/jumpstart', icon: '::FaRocket::' },
                { titleKey: 'assetStudioTitle', descKey: 'assetStudioDesc', link: '/repo-xml', icon: '::FaWandMagicSparkles::' },
                { titleKey: 'assetPhilosophyTitle', descKey: 'assetPhilosophyDesc', link: '/selfdev', secondaryLink: '/purpose-profit', icon: '::FaBookOpen::' },
                { titleKey: 'assetPlansTitle', descKey: 'assetPlansDesc', link: '/game-plan', secondaryLink: '/p-plan', icon: '::FaClipboardList::' },
                { titleKey: 'assetTutorialsTitle', descKey: 'assetTutorialsDesc', link: '/start-training', icon: '::FaGraduationCap::' },
                { titleKey: 'assetCyberDevOSTitle', descKey: 'assetCyberDevOSDesc', link: '/selfdev/gamified', icon: '::FaGamepad::' },
              ].map(asset => (
                <div key={asset.titleKey} className={cn("p-4 border-2 rounded-xl bg-gray-950/50", pageTheme.borderColor, `hover:${pageTheme.shadowColor} transition-shadow duration-300`)}>
                  <h5 className={cn("font-bold mb-1.5 flex items-center gap-2", pageTheme.accentColor)}>
                    <VibeContentRenderer content={asset.icon} />
                    <Link href={asset.link} className="hover:underline"><VibeContentRenderer content={t[asset.titleKey as TranslationKeys]} /></Link>
                    {asset.secondaryLink && <Link href={asset.secondaryLink} className="hover:underline text-xs">(+)</Link>}
                  </h5>
                  <p className="text-gray-300 text-xs leading-snug"><VibeContentRenderer content={t[asset.descKey as TranslationKeys]} /></p>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Section 6: Building Zion (Original) */}
          <Card className={cn("bg-black/70 backdrop-blur-md border-2", pageTheme.borderColor, pageTheme.shadowColor)}>
            <CardHeader>
              <CardTitle className={cn("text-3xl font-orbitron flex items-center gap-3", pageTheme.primaryColor)}>
                <VibeContentRenderer content={t.zionTitle} />
              </CardTitle>
              <CardDescription className="font-mono text-gray-400"><VibeContentRenderer content={t.zionSubtitle} /></CardDescription>
            </CardHeader>
            <CardContent className="font-mono text-sm text-gray-300 space-y-3">
              <p><VibeContentRenderer content={t.zionP1} /></p>
              <ul className="list-disc list-inside pl-4 space-y-2">
                <li><VibeContentRenderer content={t.zionList1} /></li>
                <li><VibeContentRenderer content={t.zionList2} /></li>
                <li><VibeContentRenderer content={t.zionList3} /></li>
                <li><VibeContentRenderer content={t.zionList4} /></li>
              </ul>
              <p className="mt-3 text-xs text-gray-400">
                <VibeContentRenderer content={t.zionLink} />
              </p>
            </CardContent>
          </Card>

          {/* Call to Action (Original) */}
          <section className="text-center mt-16 py-10">
            <VibeContentRenderer content={`::FaRocket className="mx-auto text-7xl mb-8 ${pageTheme.primaryColor} animate-bounce"::`} />
            <h2 className={cn("text-4xl md:text-5xl font-orbitron font-bold mb-6 cyber-text glitch", pageTheme.primaryColor)} data-text={t.ctaTitle}>
              <VibeContentRenderer content={t.ctaTitle} />
            </h2>
            <p className="text-xl text-gray-300 font-mono max-w-2xl mx-auto mb-10">
              <VibeContentRenderer content={t.ctaSubtitle} />
            </p>
            <Button size="xl" className={cn("font-orbitron text-xl py-5 px-12 rounded-full text-black font-extrabold shadow-glow-lg hover:scale-105 transform transition duration-300 active:scale-95", pageTheme.buttonGradient, `hover:shadow-[0_0_30px_rgba(255,108,0,0.8)]`)}>
              <VibeContentRenderer content={t.ctaButtonText} />
            </Button>
          </section>
        </div>
      </div>
    </div>
  );
};

export default LeadGenerationHQPage;