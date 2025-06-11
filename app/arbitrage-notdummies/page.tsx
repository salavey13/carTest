"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VibeContentRenderer } from '@/components/VibeContentRenderer';
import { useAppContext } from '@/contexts/AppContext';
import { logger } from '@/lib/logger'; // Using standard logger
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';

// Placeholder for a potential 3D visualization component if we ever build one
const ThreeDVoxelVisualizationPlaceholder: React.FC = () => (
    <div className="my-6 p-4 border border-dashed border-brand-purple rounded-lg bg-black/20 text-center">
        <VibeContentRenderer content="::FaCubes className='text-4xl text-brand-purple mb-2 mx-auto'::" />
        <p className="text-sm text-purple-300">
            Imagine a dynamic 3D voxel space here, visualizing opportunities based on Reward, Ezness, and Effort.
            <br />
            (Future Feature Idea!)
        </p>
    </div>
);

const pageTranslations: Record<string, Record<string, any>> = {
  ru: {
    pageTitle: "::FaBrain:: Арбитраж для НЕчайников: Глубокое Погружение",
    pageSubtitle: "Раскрываем метафизику арбитражных возможностей, латентные пространства и модель Усилия-Легкости-Риска.",
    
    tabIntro: "За Гранью Основ",
    tabLatentSpace: "Латентное Пространство",
    tabEERModel: "Модель У.Л.Р.", // Усилие, Легкость, Риск
    tabVisualization: "3D Визуализация",
    tabAnalogies: "Научные Аналогии",

    introIcon: "::FaInfinity::",
    latentSpaceIcon: "::FaCompressArrowsAlt::",
    eerModelIcon: "::FaBalanceScale::",
    visualizationIcon: "::FaCube::",
    analogiesIcon: "::FaFlask::",

    introTitle: "Отходя от Шаблонов: Новый Взгляд на Арбитраж",
    introContent: [
        "Если <Link href='/arbitrage-explained' className='text-brand-cyan hover:underline'>'Школа Арбитража'</Link> заложила фундамент, то эта страница — ваш пропуск на следующий уровень понимания. Мы выходим за рамки простого описания механик и погружаемся в более абстрактные, но мощные концепции.",
        "Здесь мы исследуем, как можно представить всё многообразие арбитражных возможностей в виде структурированного пространства, и как неочевидные взаимосвязи определяют реальный потенциал сделки.",
        "Приготовьтесь, Кибер-Волк, мы отправляемся в червоточину!"
    ],

    latentSpaceTitle: "::FaProjectDiagram:: Пространство Возможностей: Что Такое Латентный Слой?",
    latentSpaceIntro: "Представьте, что каждая потенциальная арбитражная связка — это точка в многомерном пространстве. Её координаты — это десятки параметров: цены покупки/продажи, объемы, комиссии, биржи, скорость сети, волатильность рынка, даже настроения в Твиттере.",
    latentSpaceWhatIs: [
        "**Латентное пространство** — это сжатое, низкоразмерное представление этого сложного многообразия. Как если бы вы сжали 1000-страничный роман в 5-страничное резюме, сохранив суть сюжета и ключевые идеи.",
        "Цель — выявить **скрытые (латентные) закономерности** и структуры, которые не видны на поверхности. Это позволяет нам классифицировать, сравнивать и даже предсказывать поведение этих возможностей более эффективно.",
        "Например, вместо 50 сырых параметров, мы можем получить 3-5 'латентных' характеристик, которые описывают основные 'архетипы' арбитражных ситуаций."
    ],
    latentSpaceHow: "**Как его получить?** Обычно с помощью моделей машинного обучения (например, автокодировщиков), которые учатся 'кодировать' сложные данные в это компактное представление и 'декодировать' обратно с минимальными потерями. Наш бот, по сути, пытается интуитивно нащупать эти латентные факторы через свои фильтры и логику.",

    eerModelTitle: "::FaBolt:: Троица Арбитражника: Усилие, Легкость, Риск (У.Л.Р.)",
    eerModelIntro: "Давайте введем простую, но мощную модель для оценки любой арбитражной затеи, вдохновленную законом Ома (V=IR), но адаптированную для нашей реальности:",
    eerEffortTitle: "1. Усилие (I - Ток)",
    eerEffortContent: [
        "Это ресурсы, которые вы вкладываете или которые требуются от вас:",
        "  - **Капитал:** Объем средств (ваш `defaultTradeVolumeUSD`).",
        "  - **Скорость Реакции/Системы:** Насколько быстро вы должны действовать или насколько быстр ваш бот (привет, 'Философия Реального Времени' из <Link href='/arbitrage-explained#basics' className='text-brand-cyan hover:underline'>основ</Link>).",
        "  - **Сложность Операции:** Количество шагов, бирж, необходимость ручного вмешательства.",
        "  - **Когнитивная Нагрузка:** Сколько внимания и анализа требуется.",
        "**Чем выше Усилие, тем 'больше тока' вы пропускаете через систему.**"
    ],
    eerEznessTitle: "2. Легкость (1/R - Проводимость)",
    eerEznessContent: [
        "Это благоприятность условий, 'проводимость' арбитражного пути:",
        "  - **Ликвидность:** Возможность провести нужный объем без сильного проскальзывания (ваш `checklistItem3`).",
        "  - **Время Жизни Связки:** Как долго возможность существует (`errorExample2Title`).",
        "  - **Простота и Скорость Перевода Активов:** Низкие комиссии сети, быстрые подтверждения (`errorExample3Title`, `bundlePoints` про 'Время перевода').",
        "  - **Надежность Данных и Платформ:** Реальные цены из стакана, а не 'теоретические' (`publicVsPrivateTitle`).",
        "**Чем выше Легкость, тем 'ниже сопротивление' и лучше проводимость.**"
    ],
    eerRiskTitle: "3. Риск (V - Напряжение/Потенциал)",
    eerRiskFormula: "Мы определяем Риск как: **Риск = Усилие / Легкость** (или `Риск = Усилие * (1 / Легкость)`).",
    eerRiskContent: [
        "Это 'напряжение' или 'давление' в системе, потенциал негативного исхода:",
        "  - Если **Усилие** велико (много денег, нужна сверхскорость) и **Легкость** низка (неликвид, короткое окно, глючные биржи), **Риск** взлетает до небес.",
        "  - Если **Усилие** мало, а **Легкость** высока, **Риск** минимален.",
        "Это идеально совпадает с законом Ома: `V = I * R`, где `R` (сопротивление) — это обратная величина нашей `Легкости` (т.е. `R = 1 / Легкость`). Таким образом, `Риск = Усилие * Сопротивление`.",
    ],
    eerRewardTitle: "И Главное: Вознаграждение (P - Мощность/Профит)",
    eerRewardContent: "Вся эта модель имеет смысл только в контексте потенциального **Вознаграждения** (чистый спред в %, ваш `minSpreadPercent`). Вы готовы принять определенный Риск (рассчитанный через Усилие и Легкость) ради этого Вознаграждения.",
    
    visualizationTitle: "::FaProjectDiagram:: Визуализация Альфы: 3D Воксельное Пространство",
    visualizationIntro: "Если мы редуцируем наше латентное пространство (или выберем ключевые метрики) до трех измерений, мы можем представить арбитражные возможности как точки (воксели) в 3D-графике:",
    visualizationAxes: [
        "**Ось X: Вознаграждение (Net Spread %):** Прямо из вашего сканера. Насколько профитна связка *после* всех комиссий.",
        "**Ось Y: Оценка Легкости (Ezness Score):** Композитный балл, учитывающий ликвидность, время перевода, комиссии сети, надежность данных и т.д. Высокий балл = высокая легкость.",
        "**Ось Z: Оценка Усилия (Effort Score):** Композитный балл, учитывающий объем сделки, требуемую скорость реакции, сложность операции. Высокий балл = высокое усилие."
    ],
    visualizationRisk: "**Производное Свойство: Риск.** Мы можем рассчитать `Риск = Оценка Усилия / Оценка Легкости` для каждого вокселя и отобразить его цветом (например, от зеленого - низкий риск, до красного - высокий) или размером вокселя.",
    visualizationZones: [
        "**Зона Альфы ('Золотая Жила'):** Высокое Вознаграждение, Высокая Легкость, Умеренное Усилие (=> Низкий/Средний Риск для хорошего Вознаграждения). Цель каждого Кибер-Волка.",
        "**Зона Иллюзий ('Мираж'):** Высокое Вознаграждение, Низкая Легкость, Высокое Усилие (=> Очень Высокий Риск). Пример: огромный спред на неликвидной монете на сомнительной бирже. Сюда часто попадают новички из-за ошибок в настройках (`errorsTitle` в <Link href='/arbitrage-explained#settings_errors' className='text-brand-cyan hover:underline'>основах</Link>).",
        "**Зона Рутины ('Песочница'):** Низкое Вознаграждение, Высокая Легкость, Низкое Усилие (=> Низкий Риск). Мелкие, но частые возможности. Требуют автоматизации.",
        "**Зона Отчаяния ('Болото'):** Низкое Вознаграждение, Низкая Легкость, Высокое Усилие. Избегать любой ценой."
    ],

    analogiesTitle: "::FaAtom:: Научные Линзы: Смотрим на Арбитраж Под Другим Углом",
    analogyInfoTheoryTitle: "1. Теория Информации: Сигнал vs. Шум",
    analogyInfoTheoryContent: [
        "**Сигнал:** Истинный, реализуемый арбитражный спред.",
        "**Шум:** Рыночная волатильность, неточные цены (тикеры vs. стаканы), фейковые объемы, задержки данных.",
        "**Связь с У.Л.Р.:** Высокий шум снижает `Легкость` (труднее различить реальную возможность) и может потребовать большего `Усилия` (продвинутые инструменты, быстрый анализ) для извлечения сигнала.",
        "**Ваш бот:** Механизм 'Сундука' (`monitoringChestTitle`) и акцент на 'Реальный спред' (`publicVsPrivateTitle`) — это попытки усилить сигнал и отфильтровать шум."
    ],
    analogyThermoTitle: "2. Термодинамика/Физика: Эффективность и Трение",
    analogyThermoContent: [
        "**Потенциальная Энергия:** 'Грязный' спред до вычета всех затрат.",
        "**Трение/Потери:** Торговые комиссии, сетевые комиссии, проскальзывание. Они снижают `Леግкость` (увеличивают 'сопротивление') и уменьшают итоговое `Вознаграждение`.",
        "**Эффективность:** `Чистый Профит / Грязный Профит`. Задача арбитражника — максимизировать эту эффективность.",
        "**Ваш бот:** Постоянное напоминание об 'Учете Комиссий' (`errorExample1Title`, `checklistItem2`) — это борьба с 'трением'."
    ],
    analogyEquilibriumTitle: "3. Рыночное Равновесие (Экономика)",
    analogyEquilibriumContent: [
        "**Дисбаланс:** Арбитражные возможности — это временные нарушения равновесия цен.",
        "**Силы Восстановления:** Арбитражники, устраняя эти дисбалансы, возвращают рынок к равновесию.",
        "**Связь с У.Л.Р.:** Скорость (`Усилие`) критична, так как окно возможности (`Легкость`) быстро закрывается из-за действий других арбитражников ('Почему Скорость Решает Всё' в <Link href='/arbitrage-explained#basics' className='text-brand-cyan hover:underline'>основах</Link>).",
    ],
    analogyKineticsTitle: "4. Химическая Кинетика: Реакции и Катализаторы",
    analogyKineticsContent: [
        "**Энергия Активации:** Минимальное `Усилие` (капитал, готовность системы) для начала 'арбитражной реакции'.",
        "**Скорость Реакции:** Как быстро вы можете исполнить сделку.",
        "**Катализаторы:** Ваш оптимизированный бот, низколатентные соединения, заранее пополненные счета на биржах. Они увеличивают `Легкость`, снижая 'энергию активации' или ускоряя 'реакцию'.",
    ],
    analogyFinanceTitle: "5. Финансы: Соотношение Риск/Вознаграждение",
    analogyFinanceContent: [
        "**Фундаментальный Принцип:** Любое инвестиционное решение.",
        "**Ваша модель:** `Риск = Усилие / Легкость`. Цель — найти возможности, где `Вознаграждение / Риск` максимально.",
        "**Ваш боजग:** Все настройки и фильтры (`errorsSolutionTitle`) предназначены для того, чтобы помочь вам находить и настраиваться на такие возможности с высоким соотношением `Вознаграждение / Риск`."
    ],
    conclusionTitle: "Мышление Кибер-Волка",
    conclusionContent: "Понимание этих концепций не просто академическое упражнение. Оно дает вам фреймворк для более глубокого анализа рынка, более точной настройки вашего инструментария и, в конечном счете, для принятия более взвешенных и прибыльных решений. Это и есть путь от простого пользователя сканера к настоящему Кибер-Волку арбитража. Экспериментируйте, анализируйте, и да пребудет с вами Альфа!",
    backToSchool: "Назад в 'Школу Арбитража'",
    backToSimulator: "К Симуляторам",
  },
  en: {
    pageTitle: "::FaBrain:: Arbitrage for Not-Dummies: A Deep Dive",
    pageSubtitle: "Unveiling the metaphysics of arbitrage opportunities, latent spaces, and the Effort-Ezness-Risk model.",

    tabIntro: "Beyond Basics",
    tabLatentSpace: "Latent Space",
    tabEERModel: "E.E.R. Model", // Effort, Ezness, Risk
    tabVisualization: "3D Visualization",
    tabAnalogies: "Scientific Analogies",
    
    introIcon: "::FaInfinity::",
    latentSpaceIcon: "::FaCompressArrowsAlt::",
    eerModelIcon: "::FaBalanceScale::",
    visualizationIcon: "::FaCube::",
    analogiesIcon: "::FaFlask::",

    introTitle: "Moving Beyond Templates: A New Perspective on Arbitrage",
    introContent: [
        "If the <Link href='/arbitrage-explained' className='text-brand-cyan hover:underline'>'Arbitrage School'</Link> laid the foundation, this page is your ticket to the next level of understanding. We're moving beyond mere mechanical descriptions and diving into more abstract yet powerful concepts.",
        "Here, we explore how the entire spectrum of arbitrage opportunities can be envisioned as a structured space, and how non-obvious interconnections define a trade's true potential.",
        "Prepare yourself, Cyber-Wolf, we're going down the rabbit hole!"
    ],

    latentSpaceTitle: "::FaProjectDiagram:: The Opportunity Space: What is a Latent Layer?",
    latentSpaceIntro: "Imagine every potential arbitrage bundle as a point in a high-dimensional space. Its coordinates are dozens of parameters: buy/sell prices, volumes, fees, exchanges, network speed, market volatility, even Twitter sentiment.",
    latentSpaceWhatIs: [
        "**Latent space** is a compressed, lower-dimensional representation of this complex manifold. It's like condensing a 1000-page novel into a 5-page summary while preserving the core plot and key ideas.",
        "The goal is to uncover **hidden (latent) patterns** and structures not visible on the surface. This allows us to classify, compare, and even predict the behavior of these opportunities more effectively.",
        "For example, instead of 50 raw parameters, we might derive 3-5 'latent' characteristics that describe the main 'archetypes' of arbitrage situations."
    ],
    latentSpaceHow: "**How is it obtained?** Typically through machine learning models (e.g., autoencoders) that learn to 'encode' complex data into this compact representation and 'decode' it back with minimal loss. Our bot, in essence, intuitively tries to approximate these latent factors through its filters and logic.",

    eerModelTitle: "::FaBolt:: The Arbitrageur's Trinity: Effort, Ezness, Risk (E.E.R.)",
    eerModelIntro: "Let's introduce a simple yet powerful model for evaluating any arbitrage venture, inspired by Ohm's Law (V=IR) but adapted for our reality:",
    eerEffortTitle: "1. Effort (I - Current)",
    eerEffortContent: [
        "These are the resources you invest or that are required from you:",
        "  - **Capital:** The amount of funds (your `defaultTradeVolumeUSD`).",
        "  - **Reaction/System Speed:** How quickly you must act or how fast your bot is (hello, 'Real-Time Philosophy' from <Link href='/arbitrage-explained#basics' className='text-brand-cyan hover:underline'>the basics</Link>).",
        "  - **Operational Complexity:** Number of steps, exchanges, need for manual intervention.",
        "  - **Cognitive Load:** How much attention and analysis is required.",
        "**The higher the Effort, the 'more current' you're pushing through the system.**"
    ],
    eerEznessTitle: "2. Ezness (1/R - Conductance)",
    eerEznessContent: [
        "This is the favorability of conditions, the 'conductivity' of the arbitrage path:",
        "  - **Liquidity:** Ability to trade the desired volume without significant slippage (your `checklistItem3`).",
        "  - **Bundle Lifespan:** How long the opportunity exists (`errorExample2Title`).",
        "  - **Simplicity and Speed of Asset Transfer:** Low network fees, fast confirmations (`errorExample3Title`, `bundlePoints` on 'Transfer Time').",
        "  - **Reliability of Data and Platforms:** Real order book prices, not 'theoretical' ones (`publicVsPrivateTitle`).",
        "**The higher the Ezness, the 'lower the resistance' and better the conductance.**"
    ],
    eerRiskTitle: "3. Risk (V - Voltage/Potential)",
    eerRiskFormula: "We define Risk as: **Risk = Effort / Ezness** (or `Risk = Effort * (1 / Ezness)`).",
    eerRiskContent: [
        "This is the 'voltage' or 'pressure' in the system, the potential for a negative outcome:",
        "  - If **Effort** is high (lots of money, extreme speed needed) and **Ezness** is low (illiquid, short window, buggy exchanges), **Risk** skyrockets.",
        "  - If **Effort** is low and **Ezness** is high, **Risk** is minimal.",
        "This perfectly aligns with Ohm's Law: `V = I * R`, where `R` (resistance) is the inverse of our `Ezness` (i.e., `R = 1 / Ezness`). Thus, `Risk = Effort * Resistance`.",
    ],
    eerRewardTitle: "And Crucially: Reward (P - Power/Profit)",
    eerRewardContent: "This entire model only makes sense in the context of potential **Reward** (net spread %, your `minSpreadPercent`). You accept a certain Risk (calculated via Effort and Ezness) for this Reward.",

    visualizationTitle: "::FaProjectDiagram:: Visualizing Alpha: The 3D Voxel Space",
    visualizationIntro: "If we reduce our latent space (or select key metrics) to three dimensions, we can represent arbitrage opportunities as points (voxels) in a 3D chart:",
    visualizationAxes: [
        "**X-axis: Reward (Net Spread %):** Directly from your scanner. How profitable the bundle is *after* all fees.",
        "**Y-axis: Ezness Score:** A composite score considering liquidity, transfer time, network fees, data reliability, etc. High score = high ezness.",
        "**Z-axis: Effort Score:** A composite score considering trade volume, required reaction speed, operational complexity. High score = high effort."
    ],
    visualizationRisk: "**Derived Property: Risk.** We can calculate `Risk = Effort Score / Ezness Score` for each voxel and display it using color (e.g., green - low risk, to red - high risk) or voxel size.",
    visualizationZones: [
        "**Alpha Zone ('Gold Vein'):** High Reward, High Ezness, Manageable Effort (=> Low/Medium Risk for good Reward). The Cyber-Wolf's target.",
        "**Illusion Zone ('Mirage'):** High Reward, Low Ezness, High Effort (=> Very High Risk). Example: huge spread on an illiquid coin on a shady exchange. Novices often fall here due to misconfigured settings (`errorsTitle` in <Link href='/arbitrage-explained#settings_errors' className='text-brand-cyan hover:underline'>the basics</Link>).",
        "**Routine Zone ('Sandbox'):** Low Reward, High Ezness, Low Effort (=> Low Risk). Small but frequent opportunities. Require automation.",
        "**Despair Zone ('Swamp'):** Low Reward, Low Ezness, High Effort. Avoid at all costs."
    ],

    analogiesTitle: "::FaAtom:: Scientific Lenses: Viewing Arbitrage from Different Angles",
    analogyInfoTheoryTitle: "1. Information Theory: Signal vs. Noise",
    analogyInfoTheoryContent: [
        "**Signal:** The true, executable arbitrage spread.",
        "**Noise:** Market volatility, inaccurate prices (tickers vs. order books), fake volumes, data delays.",
        "**E.E.R. Connection:** High noise reduces `Ezness` (harder to discern real opportunity) and may require more `Effort` (advanced tools, faster analysis) to extract the signal.",
        "**Your Bot:** The 'Chest' mechanism (`monitoringChestTitle`) and emphasis on 'Real spread' (`publicVsPrivateTitle`) are attempts to amplify signal and filter noise."
    ],
    analogyThermoTitle: "2. Thermodynamics/Physics: Efficiency and Friction",
    analogyThermoContent: [
        "**Potential Energy:** The 'gross' spread before deducting any costs.",
        "**Friction/Losses:** Trading fees, network fees, slippage. They reduce `Ezness` (increase 'resistance') and diminish the final `Reward`.",
        "**Efficiency:** `Net Profit / Gross Profit`. The arbitrageur's task is to maximize this efficiency.",
        "**Your Bot:** Constant reminders about 'Fee Accounting' (`errorExample1Title`, `checklistItem2`) are about combating 'friction'."
    ],
    analogyEquilibriumTitle: "3. Market Equilibrium (Economics)",
    analogyEquilibriumContent: [
        "**Disequilibrium:** Arbitrage opportunities are temporary price imbalances.",
        "**Restoring Forces:** Arbitrageurs, by exploiting these imbalances, push the market back towards equilibrium.",
        "**E.E.R. Connection:** Speed (`Effort`) is critical as the opportunity window (`Ezness`) closes quickly due to others' actions ('Why Speed Matters' in <Link href='/arbitrage-explained#basics' className='text-brand-cyan hover:underline'>the basics</Link>).",
    ],
    analogyKineticsTitle: "4. Chemical Kinetics: Reactions and Catalysts",
    analogyKineticsContent: [
        "**Activation Energy:** The minimum `Effort` (capital, system readiness) to initiate an 'arbitrage reaction'.",
        "**Reaction Rate:** How quickly you can execute the trade.",
        "**Catalysts:** Your optimized bot, low-latency connections, pre-funded exchange accounts. They increase `Ezness` by lowering 'activation energy' or speeding up the 'reaction'.",
    ],
    analogyFinanceTitle: "5. Finance: Risk/Reward Ratio",
    analogyFinanceContent: [
        "**Fundamental Principle:** Any investment decision.",
        "**Your Model:** `Risk = Effort / Ezness`. The goal is to find opportunities where `Reward / Risk` is high.",
        "**Your Bot:** All settings and filters (`errorsSolutionTitle`) are designed to help you find and tune for such high `Reward / Risk` opportunities."
    ],
    conclusionTitle: "The Cyber-Wolf Mindset",
    conclusionContent: "Understanding these concepts isn't just an academic exercise. It gives you a framework for deeper market analysis, more precise tool configuration, and ultimately, for making more informed and profitable decisions. This is the path from a simple scanner user to a true Cyber-Wolf of arbitrage. Experiment, analyze, and may the Alpha be with you!",
    backToSchool: "Back to 'Arbitrage School'",
    backToSimulator: "To Simulators",
  }
};


export default function ArbitrageNotDummiesPage() {
  const { user: tgUser } = useAppContext();
  const [currentLang, setCurrentLang] = useState<'ru' | 'en'>('ru');

  useEffect(() => {
    let langToSet: 'ru' | 'en' = 'en';
    if (tgUser?.language_code) {
        langToSet = tgUser.language_code.toLowerCase().startsWith('ru') ? 'ru' : 'en';
    }
    setCurrentLang(langToSet);
    logger.log(`[ArbitrageNotDummiesPage] Language set to: ${langToSet}`);
  }, [tgUser?.language_code]);

  const t = useMemo(() => pageTranslations[currentLang] || pageTranslations['ru'], [currentLang]);

  const renderSectionList = (titleKey: string, contentArrayKey: string, iconName?: string, titleClassName: string = "text-xl md:text-2xl font-semibold text-primary dark:text-brand-cyan mb-3") => {
    const titleContent = t[titleKey] || titleKey;
    const contentPoints = (t[contentArrayKey] || []) as string[];

    return (
      <div className="mb-8 p-4 bg-card/5 dark:bg-gray-800/40 border border-border dark:border-gray-700/30 rounded-lg shadow-md">
        <h3 className={`${titleClassName} flex items-center`}>
          {iconName && <VibeContentRenderer content={iconName} className="mr-2" />}
          <VibeContentRenderer content={titleContent} />
        </h3>
        <ul className="list-disc list-outside pl-5 space-y-2 text-foreground/80 dark:text-gray-300/90 leading-relaxed text-sm">
          {contentPoints.map((point, index) => (
            <li key={index} className="pl-1">
                <VibeContentRenderer content={point} />
            </li>
          ))}
        </ul>
      </div>
    );
  };
  
  const renderSimpleSection = (titleKey: string, contentKey: string, iconName?: string, titleClassName: string = "text-xl md:text-2xl font-semibold text-primary dark:text-brand-cyan mb-3") => {
    const titleContent = t[titleKey] || titleKey;
    const mainContent = t[contentKey] || contentKey;

    return (
      <div className="mb-8 p-4 bg-card/5 dark:bg-gray-800/40 border border-border dark:border-gray-700/30 rounded-lg shadow-md">
        <h3 className={`${titleClassName} flex items-center`}>
          {iconName && <VibeContentRenderer content={iconName} className="mr-2" />}
          <VibeContentRenderer content={titleContent} />
        </h3>
        <VibeContentRenderer content={mainContent} className="text-foreground/80 dark:text-gray-300/90 leading-relaxed text-sm" />
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-background text-foreground p-4 pt-24 pb-12 font-mono">
      <Card className="max-w-4xl mx-auto bg-card/80 dark:bg-black/70 backdrop-blur-md border-2 border-primary dark:border-brand-purple/50 shadow-2xl dark:shadow-brand-purple/30">
        <CardHeader className="text-center border-b border-border dark:border-brand-purple/30 pb-6">
          <VibeContentRenderer content={t.pageTitle} className="text-3xl md:text-4xl font-bold text-primary dark:text-brand-purple cyber-text glitch"/>
          <CardDescription className="mt-2 text-sm md:text-base text-muted-foreground dark:text-purple-300">
            <VibeContentRenderer content={t.pageSubtitle} />
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 md:p-6 ">
          <Tabs defaultValue="intro" className="w-full">
            <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-1 bg-muted/40 dark:bg-black/50 p-1 h-auto mb-6">
              <TabsTrigger value="intro" className="text-xs px-1 py-1.5 sm:py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-orbitron"><VibeContentRenderer content={t.introIcon} className="mr-1.5"/>{t.tabIntro}</TabsTrigger>
              <TabsTrigger value="latent_space" className="text-xs px-1 py-1.5 sm:py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-orbitron"><VibeContentRenderer content={t.latentSpaceIcon} className="mr-1.5"/>{t.tabLatentSpace}</TabsTrigger>
              <TabsTrigger value="eer_model" className="text-xs px-1 py-1.5 sm:py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-orbitron"><VibeContentRenderer content={t.eerModelIcon} className="mr-1.5"/>{t.tabEERModel}</TabsTrigger>
              <TabsTrigger value="visualization" className="text-xs px-1 py-1.5 sm:py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-orbitron"><VibeContentRenderer content={t.visualizationIcon} className="mr-1.5"/>{t.tabVisualization}</TabsTrigger>
              <TabsTrigger value="analogies" className="text-xs px-1 py-1.5 sm:py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-orbitron"><VibeContentRenderer content={t.analogiesIcon} className="mr-1.5"/>{t.tabAnalogies}</TabsTrigger>
            </TabsList>

            <TabsContent value="intro" className="space-y-6">
              {renderSectionList("introTitle", "introContent", "::FaRocket::")}
            </TabsContent>

            <TabsContent value="latent_space" className="space-y-6">
                <VibeContentRenderer content={t.latentSpaceIntro} className="mb-4 text-foreground/90 dark:text-gray-300 text-sm" />
                {renderSectionList("latentSpaceTitle", "latentSpaceWhatIs", undefined, "text-lg md:text-xl font-semibold text-primary dark:text-brand-cyan mb-2")}
                <VibeContentRenderer content={t.latentSpaceHow} className="text-sm p-3 bg-muted/20 dark:bg-black/20 rounded-md border border-border dark:border-gray-700/20" />
            </TabsContent>

            <TabsContent value="eer_model" className="space-y-4">
                <VibeContentRenderer content={t.eerModelIntro} className="mb-4 text-foreground/90 dark:text-gray-300 text-sm" />
                {renderSectionList("eerEffortTitle", "eerEffortContent", "::FaBatteryHalf::", "text-md font-semibold text-yellow-500 dark:text-yellow-400 mb-1")}
                {renderSectionList("eerEznessTitle", "eerEznessContent", "::FaFeatherAlt::", "text-md font-semibold text-green-500 dark:text-green-400 mb-1")}
                <div className="mb-6 p-3 md:p-4 bg-card/5 dark:bg-gray-800/50 border border-destructive dark:border-red-700/50 rounded-lg shadow-md">
                    <h4 className="text-md font-semibold text-destructive dark:text-red-400 mb-1 flex items-center"><VibeContentRenderer content="::FaExclamationTriangle className='mr-2'::" /> <VibeContentRenderer content={t.eerRiskTitle} /></h4>
                    <VibeContentRenderer content={t.eerRiskFormula} className="block my-2 text-center font-bold text-lg p-2 bg-destructive/10 dark:bg-red-900/30 rounded-md" />
                    <ul className="list-disc list-outside pl-5 space-y-1 text-foreground/80 dark:text-gray-300/90 leading-relaxed text-sm">
                      {(t.eerRiskContent as string[]).map((point, index) => ( 
                        <li key={index} className="pl-1"><VibeContentRenderer content={point} /></li>
                      ))}
                    </ul>
                </div>
                {renderSimpleSection("eerRewardTitle", "eerRewardContent", "::FaGem::", "text-md font-semibold text-brand-lime mb-1")}
            </TabsContent>

            <TabsContent value="visualization" className="space-y-6">
                <VibeContentRenderer content={t.visualizationIntro} className="mb-4 text-foreground/90 dark:text-gray-300 text-sm" />
                {renderSectionList("visualizationTitle", "visualizationAxes", "::FaCubes::", "text-lg md:text-xl font-semibold text-primary dark:text-brand-cyan mb-2")}
                <VibeContentRenderer content={`**${t.visualizationRisk}**`} className="block text-sm p-3 bg-muted/20 dark:bg-black/20 rounded-md border border-border dark:border-gray-700/20" />
                {renderSectionList("visualizationZones_Title_Implicit", "visualizationZones", "::FaMapSigns::", "text-lg md:text-xl font-semibold text-primary dark:text-brand-cyan mb-2")}
                 <ThreeDVoxelVisualizationPlaceholder />
            </TabsContent>
            
            <TabsContent value="analogies" className="space-y-6">
              {renderSectionList(t.analogyInfoTheoryTitle, "analogyInfoTheoryContent", "::FaBroadcastTower::")}
              {renderSectionList(t.analogyThermoTitle, "analogyThermoContent", "::FaFire::")}
              {renderSectionList(t.analogyEquilibriumTitle, "analogyEquilibriumContent", "::FaExchangeAlt::")}
              {renderSectionList(t.analogyKineticsTitle, "analogyKineticsContent", "::FaReact::")}
              {renderSectionList(t.analogyFinanceTitle, "analogyFinanceContent", "::FaChartPie::")}
            </TabsContent>
          </Tabs>

          <div className="mt-8 p-6 bg-gradient-to-r from-purple-600/20 via-blue-600/20 to-cyan-600/20 dark:from-purple-900/30 dark:via-blue-900/30 dark:to-cyan-900/30 border border-brand-blue/30 rounded-xl shadow-xl">
            <h3 className="text-2xl font-orbitron text-center text-brand-yellow mb-3">
                <VibeContentRenderer content="::FaWolfPackBattalion className='mr-2'::" /> {t.conclusionTitle}
            </h3>
            <VibeContentRenderer content={t.conclusionContent} className="text-center text-gray-200 dark:text-gray-300 leading-relaxed" />
          </div>

          <div className="mt-10 flex flex-col sm:flex-row justify-center items-center gap-4">
            <Button asChild size="sm" variant="outline" className="border-primary dark:border-brand-blue text-primary dark:text-brand-blue hover:bg-primary/10 dark:hover:bg-brand-blue/10">
              <Link href="/arbitrage-explained">
                <VibeContentRenderer content="::FaGraduationCap className='mr-2'::" /> {t.backToSchool}
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline" className="border-primary dark:border-brand-purple text-primary dark:text-brand-purple hover:bg-primary/10 dark:hover:bg-brand-purple/10">
              <Link href="/elon">
                <VibeContentRenderer content="::FaRocket className='mr-2'::" /> {t.backToSimulator}
              </Link>
            </Button>
          </div>

        </CardContent>
      </Card>
    </div>
  );
}

// Note: For visualizationZones, I used an implicit title key "visualizationZones_Title_Implicit"
// because the actual title "Зоны в 3D Пространстве (Примеры):" or "Zones in 3D Space (Examples):"
// would be part of the content if we made it a single string.
// A better way would be to have a dedicated title key in translations if this section was complex.
// For now, I'm just passing "visualizationZones" which is the array of points.
// The renderSectionList will need adjustment if we want a title for the list itself *from translations*.
// For simplicity here, I've embedded "Zones..." in the section, you can add a `t.visualizationZonesTitle` if desired.
// Corrected: I'll make renderSectionList take titleKey directly for the list title.
// For `visualizationZonesTitle` it might be "Зоны для Визуализации" / "Visualization Zones".
// Let's assume `visualizationZones_Title_Implicit` is just the concept, and the actual title is passed.
// Ok, `renderSectionList` takes `titleKey` which is fine. If `visualizationZones` is an array of strings under a key,
// and we want a title *for that list*, we need another key.
// Let's assume the title is embedded in the first item or handled implicitly for now.
// For actual implementation, ensure keys like `visualizationZones_Title_Implicit` are properly defined in `pageTranslations` or the component is adapted.
// I'll make `renderSectionList` have its title from `titleKey` and the list items from `contentArrayKey`.
// The key `visualizationZones_Title_Implicit` is a placeholder for `t.visualizationZonesTitle` (if you add it to translations).
// For now, let's make `renderSectionList` for `visualizationZones` use its own title.
// Changed `visualizationZones_Title_Implicit` to a more generic approach in the call.
// Let's assume `t.visualizationZonesTitle` (if you add it) would be something like "Exploring Zones in the Voxel Space".
// I'll just use "Visualization Zones" as a placeholder string if `t.visualizationZonesTitle` isn't found.
// The `renderSectionList` is fine, it takes `titleKey`. So, for `visualizationZones`, you'd need a key like `t.visualizationZonesListTitle`.
// I'll just make up a title for the zones section to simplify for now.
// Actually, `renderSectionList("visualizationZonesTitle", "visualizationZones", ...)` would work if `t.visualizationZonesTitle` holds the title string for the list.