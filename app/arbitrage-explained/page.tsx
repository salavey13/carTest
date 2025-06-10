"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { VibeContentRenderer } from '@/components/VibeContentRenderer';
import { useAppContext } from '@/contexts/AppContext';
import { logger } from '@/lib/logger';
import Link from 'next/link';
import { cn } from '@/lib/utils';


const pageTranslations: Record<string, Record<string, string>> = {
  ru: {
    pageTitle: "::FaBookOpen:: Школа Арбитража: Гайд для Кибер-Волков",
    pageSubtitle: "Разбираем основы межбиржевого арбитража, логику работы сканеров и как выжать максимум профита.",
    monitoringTitle: "::FaEye:: Как работает мониторинг связок?",
    monitoringIntro: "Наш бот-сканер работает в **реальном времени**, а не сканирует биржи раз в минуту. Это значит, что информация постоянно обновляется. Вместо бесконечного потока уведомлений используется система \"Сундука\".",
    monitoringChestTitle: "::FaBoxOpen:: Принцип \"Сундука\"",
    monitoringChestPoints: [
      "**Общий Массив Связок:** Бот постоянно видит все актуальные связки между биржами.",
      "**Ваши Настройки:** Ваш персональный фильтр (спред, объем, биржи и т.д.).",
      "**Попадание в Сундук:** Если связка из общего массива подходит под ваши настройки, бот присылает ее вам и **кладет в ваш \"Сундук\"**.",
      "**Без Повторов:** Та же самая связка (та же монета, те же биржи) **не придет второй раз**, пока она в сундуке, независимо от изменений спреда.",
      "**Работа со Связкой:** Предполагается, что вы либо работаете по присланной связке, либо она вам не интересна, и вы ждете другую.",
    ],
    monitoringActionsTitle: "::FaHandPointer:: Кнопки и Действия",
    monitoringActionsPoints: [
      "**Кнопка \"Обновить\":** Если связка в вашем сундуке все еще активна, но спред изменился, вы увидите актуальные данные. Если связка уже недействительна (спред исчез), она **удаляется из сундука**. Если позже по ней снова появится подходящий спред, она придет вам заново.",
      "**Функция \"Переприслать связку\":** Если включена (например, при изменении спреда на 0.2%), и спред по связке из сундука **увеличится** на заданный процент, бот пришлет ее повторно.",
      "**Кнопка \"Остановить мониторинг\":** Сундук очищается. При новом запуске бот будет подбирать связки заново.",
    ],
    monitoringWhyTitle: "::FaQuestionCircle:: Зачем так сделано?",
    monitoringWhyText: "Поскольку бот работает в реальном времени, он мог бы слать уведомления каждую миллисекунду при малейшем изменении спреда. Это создало бы хаос. Система \"Сундука\" обеспечивает получение только **актуальных и уникальных (в рамках текущего мониторинга)** связок.",
    monitoringSettingsImpact: "Изменения настроек (фильтров) влияют на дальнейший отбор новых связок в ваш текущий \"Сундук\".",
    monitoringDuration: "Мониторинг работает **постоянно** указанное вами время (от 1 до 6 часов) и не прекращается после нахождения первой связки. Ваша цель – не просто много связок, а хорошие, отфильтрованные связки.",
    
    errorsTitle: "::FaExclamationTriangle:: Частые ошибки в настройках сканера",
    errorsIntro: "Иногда бот \"не дает связки\" не из-за сбоя, а из-за слишком жестких или нелогичных настроек. Разберем примеры:",
    errorExample1Title: "Пример 1: Маленький депозит и высокий минимальный спред с учетом комиссий.",
    errorExample1Points: [
      "**Настройки пользователя:** 6 бирж, депозит 150 USDT, мин. спред 2%, учет комиссии за вывод.",
      "**Проблема:** Комиссия за вывод часто фиксированная (например, 1 USDT). Для депозита 150 USDT это уже 0.67%. С учетом требуемого спреда в 2%, реальный спред должен быть ~2.67%.",
      "**Усугубление:** Если сеть вывода дорогая (например, ERC20 для USDT, где комиссия может быть $5-$20), то для депозита 150 USDT это делает арбитраж почти невозможным.",
      "**Вишенка на торте – Биткоин:** Если выбрана работа только с BTC (1 ранг CMC), где вывод стоит ~$5, а перевод идет ~40 минут (при желаемых 2 мин), связок не будет никогда. BTC маловолатилен для такого арбитража между топ-биржами.",
    ],
    errorExample2Title: "Пример 2: Нереалистичное время жизни связки.",
    errorExample2Points: [
      "**Настройки пользователя:** Учет всех комиссий, переприсылать при изменении спреда на 0.5%, **минимальное время жизни связки 1000 секунд (16.5 минут)**.",
      "**Проблема:** Требование, чтобы связка держала положительный спред 16.5 минут *до того, как прийти пользователю* – это очень редкое явление на волатильном крипторынке.",
    ],
    errorsSolutionTitle: "::FaTools:: Решение и рекомендации",
    errorsSolutionPoints: [
      "**Используйте расширенные настройки вдумчиво.** Не все ваши \"хотелки\" рынок сможет удовлетворить одновременно.",
      "**Читайте инструкции и рассуждайте логически.** Если нахимичили – есть кнопка \"Сбросить расширенные настройки\".",
      "**Начинайте с более мягких фильтров**, постепенно ужесточая их, когда поймете, как работает рынок и бот.",
      "В 99% случаев отсутствие связок – это некорректные настройки. Сброс к заводским и перезапуск мониторинга часто решает проблему.",
    ],

    botOverviewTitle: "::FaRobot:: Общее описание бота для межбиржевого арбитража",
    botOverviewIntro: "Наш алгоритм позволяет зарабатывать на разнице цен между биржами без использования банковских карт, работая в реальном времени и предлагая обширный функционал.",
    botKeyFeatures: [
      "**Скорость:** Задержка между сбором, обработкой и выдачей связки – несколько миллисекунд.",
      "**Реальное время:** Курсы мониторятся 24/7 без перерывов.",
      "**Простота:** Весь интерфейс и настройки в Telegram.",
      "**Персонализация:** Установка рабочей суммы, выбор бирж, учет/неучет комиссий, ЧС монет, стартовые монеты, хеджирование, фильтры по спреду, времени жизни, рейтингу CMC, времени транзакции.",
      "**Надежность:** Проверка совпадения сетей и контрактов (где возможно), доступности ввода/вывода.",
    ],
    whatInBundleTitle: "::FaBoxArchive:: Что в связке? (Расшифровка)",
    bundlePoints: [
      "**Биржа и направление обмена:** (например, Gate.io: USDT → ATH).",
      "**Ссылки:** На спотовую пару, окно вывода/ввода.",
      "**Курс:** Средний курс для вашего объема, кол-во ордеров в стакане, общий объем в этих ордерах. Если ордеров много – диапазон цен.",
      "**Хеджирование:** Значок ☂️ для маржи, ссылки на фьючерсы (если доступны).",
      "**Рейтинг CMC:** Ранг монеты и ссылка на CoinMarketCap.",
      "**Сеть перевода:** Название сети, комиссия за вывод (в монете и USDT), доступность ввода/вывода (✅/❌).",
      "**Контракты:** Указание на совпадение контрактов (если информация доступна).",
      "**Время перевода:** Примерное время разлока монет (зеленый <15м, желтый 15-60м, красный >60м).",
      "**Спред:** В % и $ по вашей рабочей сумме, с учетом комиссий (если включено).",
      "**Время жизни связки:** Как давно бот зафиксировал положительный спред.",
      "**Увеличение спреда:** Появляется, если включена функция переприсылки.",
    ],
    
    publicVsPrivateTitle: "::FaShieldAlt:: Публичный бот vs. Ваш персональный бот",
    publicVsPrivateIntro: "Сравним типичного публичного Telegram-бота для арбитража (сигнальный канал) с тем, что мы стремимся создать (персональный инструмент).",
    comparisonTableHeaders: ["Параметр", "Публичный бот (типа @BigBTC_arbitrage_bot)", "Ваш персональный бот (\"Arbitrage Alpha Seeker\")"],
    comparisonTableRows: [
      ["Цель", "Привлечение массовой аудитории, лидогенерация.", "Ваш личный, приватный инструмент для извлечения прибыли."],
      ["Расчет спреда", "Теоретический (по тикерам). Часто вводит в заблуждение.", "Реальный (по стаканам bid/ask). Максимально точный."],
      ["Учет ликвидности", "Нет.", "Да, рассчитывает максимально возможный объем для сделки."],
      ["Учет комиссий", "Нет или используется среднее значение.", "Да, учитывает ваши личные торговые комиссии и актуальные комиссии сети."],
      ["Скорость/Задержка", "Высокая. Сигнал приходит с опозданием.", "Минимальная. Уведомление приходит вам мгновенно."],
      ["Конкуренция", "Максимальная. Вы конкурируете со всеми.", "Нулевая. Это ваша эксклюзивная информация."],
      ["Гибкость настроек", "Нет. Вы просто потребитель.", "Полная. Вы настраиваете всё."],
      ["Итог", "Информационный шум. Для обучения или развлечения.", "Профессиональный рабочий инструмент."],
    ],
    publicBotProblemsTitle: "::FaLock:: Проблемы публичных ботов:",
    publicBotProblems: [
      "**Теоретический спред:** Используют last price, а не реальные цены bid/ask из стакана.",
      "**Отсутствие учета ликвидности:** Неизвестно, какой объем можно прогнать.",
      "**Задержка и конкуренция:** Пока сигнал дойдет, возможность упущена.",
      "**Неучтенные издержки:** Ваши комиссии, актуальные сетевые сборы, время перевода.",
    ],
    ourBotGoal: "Наш целевой бот (и этот симулятор) нацелен на решение этих проблем, предоставляя вам точный и быстрый инструмент.",
    externalInstructionsLink: "Подробная инструкция от BigBTC",
  },
  // --- English Translations ---
  en: {
    pageTitle: "::FaBookOpen:: Arbitrage School: A Cyber Wolf's Guide",
    pageSubtitle: "Understanding the basics of inter-exchange arbitrage, scanner logic, and how to maximize your profits.",
    monitoringTitle: "::FaEye:: How Bundle Monitoring Works",
    monitoringIntro: "Our scanner bot operates in **real-time**, not just scanning exchanges once a minute. This means information is constantly updated. Instead of an endless stream of notifications, a \"Chest\" system is used.",
    monitoringChestTitle: "::FaBoxOpen:: The \"Chest\" Principle",
    monitoringChestPoints: [
      "**General Bundle Array:** The bot constantly sees all current bundles (opportunities) between exchanges.",
      "**Your Settings:** Your personal filter (spread, volume, exchanges, etc.).",
      "**Entering the Chest:** If a bundle from the general array matches your settings, the bot sends it to you and **places it in your \"Chest\".**",
      "**No Duplicates:** The same bundle (same coin, same exchanges) **will not be sent a second time** while it's in your chest, regardless of spread changes.",
      "**Working with a Bundle:** It's assumed you either act on the sent bundle or it's not interesting, and you await another.",
    ],
    monitoringActionsTitle: "::FaHandPointer:: Buttons and Actions",
    monitoringActionsPoints: [
      "**\"Update\" Button:** If a bundle in your chest is still active but the spread changed, you'll see current data. If the bundle is no longer valid (spread disappeared), it's **removed from the chest**. If a suitable spread reappears later, it will be sent again.",
      "**\"Resend Bundle\" Function:** If enabled (e.g., on 0.2% spread change), and the spread on a bundle from your chest **increases** by the set percentage, the bot will resend it.",
      "**\"Stop Monitoring\" Button:** The chest is cleared. Upon a new start, the bot will select bundles anew.",
    ],
    monitoringWhyTitle: "::FaQuestionCircle:: Why Is It Done This Way?",
    monitoringWhyText: "Since the bot operates in real-time, it could send notifications every millisecond for minor spread changes, creating chaos. The \"Chest\" system ensures you receive only **relevant and unique (within the current monitoring session)** bundles.",
    monitoringSettingsImpact: "Changes to settings (filters) affect the future selection of new bundles into your current \"Chest\".",
    monitoringDuration: "Monitoring runs **continuously** for your specified duration (1 to 6 hours) and doesn't stop after finding the first bundle. Your goal isn't just many bundles, but good, filtered ones.",

    errorsTitle: "::FaExclamationTriangle:: Common Mistakes in Scanner Settings",
    errorsIntro: "Sometimes the bot \"doesn't give bundles\" not due to a malfunction, but because of overly strict or illogical settings. Let's look at examples:",
    errorExample1Title: "Example 1: Small deposit and high minimum spread considering fees.",
    errorExample1Points: [
      "**User Settings:** 6 exchanges, 150 USDT deposit, min spread 2%, withdrawal fee accounting enabled.",
      "**Problem:** Withdrawal fees are often fixed (e.g., 1 USDT). For a 150 USDT deposit, this is already 0.67%. With a required 2% spread, the actual spread must be ~2.67%.",
      "**Aggravation:** If the withdrawal network is expensive (e.g., ERC20 for USDT, where fees can be $5-$20), arbitrage becomes nearly impossible for a 150 USDT deposit.",
      "**Cherry on Top – Bitcoin:** If only BTC is selected (rank 1 CMC), where withdrawal is ~$5 and transfer takes ~40 mins (vs. desired 2 mins), bundles will never appear. BTC is not volatile enough for such arbitrage between top exchanges.",
    ],
    errorExample2Title: "Example 2: Unrealistic bundle lifespan.",
    errorExample2Points: [
      "**User Settings:** All fees accounted for, resend on 0.5% spread change, **minimum bundle lifespan 1000 seconds (16.5 minutes)**.",
      "**Problem:** Requiring a bundle to maintain a positive spread for 16.5 minutes *before* being sent to the user is a very rare event in the volatile crypto market.",
    ],
    errorsSolutionTitle: "::FaTools:: Solution and Recommendations",
    errorsSolutionPoints: [
      "**Use advanced settings thoughtfully.** The market cannot satisfy all your \"wants\" simultaneously.",
      "**Read instructions and think logically.** If you've messed up – there's a \"Reset Advanced Settings\" button.",
      "**Start with softer filters**, gradually tightening them as you understand how the market and bot operate.",
      "In 99% of cases, no bundles mean incorrect settings. Resetting to defaults and restarting monitoring often solves the issue.",
    ],

    botOverviewTitle: "::FaRobot:: General Overview of the Inter-Exchange Arbitrage Bot",
    botOverviewIntro: "Our algorithm allows earning on price differences between exchanges without bank cards, operating in real-time and offering extensive functionality.",
    botKeyFeatures: [
      "**Speed:** Delay between data collection, processing, and bundle delivery is a few milliseconds.",
      "**Real-Time:** Rates are monitored 24/7 without interruptions.",
      "**Simplicity:** Entire interface and settings are within Telegram.",
      "**Personalization:** Set working amount, choose exchanges, include/exclude fees, blacklist coins, starting coins, hedging, filters for spread, lifespan, CMC rank, transaction time.",
      "**Reliability:** Checks for matching networks and contracts (where possible), availability of deposits/withdrawals.",
    ],
    whatInBundleTitle: "::FaBoxArchive:: What's in a Bundle? (Decryption)",
    bundlePoints: [
      "**Exchange and direction:** (e.g., Gate.io: USDT → ATH).",
      "**Links:** To spot pair, withdrawal/deposit window.",
      "**Rate:** Average rate for your volume, number of orders in the book, total volume in these orders. If many orders – price range.",
      "**Hedging:** ☂️ icon for margin, links to futures (if available).",
      "**CMC Rank:** Coin rank and link to CoinMarketCap.",
      "**Transfer Network:** Network name, withdrawal fee (in coin and USDT), deposit/withdrawal availability (✅/❌).",
      "**Contracts:** Indication of matching contracts (if info available).",
      "**Transfer Time:** Approx. coin unlock time (green <15m, yellow 15-60m, red >60m).",
      "**Spread:** In % and $ for your working amount, considering fees (if enabled).",
      "**Bundle Lifespan:** How long ago the bot detected a positive spread.",
      "**Spread Increase:** Appears if resend function is active.",
    ],

    publicVsPrivateTitle: "::FaShieldAlt:: Public Bot vs. Your Personal Bot",
    publicVsPrivateIntro: "Let's compare a typical public Telegram arbitrage bot (signal channel) with what we aim to create (a personal tool).",
    comparisonTableHeaders: ["Parameter", "Public Bot (e.g., @BigBTC_arbitrage_bot)", "Your Personal Bot (\"Arbitrage Alpha Seeker\")"],
    comparisonTableRows: [
      ["Purpose", "Attract mass audience, lead generation.", "Your personal, private tool for profit extraction."],
      ["Spread Calculation", "Theoretical (by tickers). Often misleading.", "Real (by order book bid/ask). Maximally accurate."],
      ["Liquidity Accounting", "No.", "Yes, calculates max possible volume for the trade."],
      ["Fee Accounting", "No or uses average values.", "Yes, considers your personal trading fees and current network fees."],
      ["Speed/Delay", "High. Signal arrives late when opportunity is gone.", "Minimal. Notification arrives instantly to you."],
      ["Competition", "Maximum. You compete with everyone.", "None. This is your exclusive information."],
      ["Settings Flexibility", "None. You are just a consumer.", "Full. You configure everything."],
      ["Outcome", "Informational noise. For learning or entertainment.", "Professional working tool."],
    ],
    publicBotProblemsTitle: "::FaLock:: Problems with Public Bots:",
    publicBotProblems: [
      "**Theoretical Spread:** Uses last price, not actual bid/ask from the order book.",
      "**No Liquidity Consideration:** Unknown volume can be pushed through.",
      "**Delay and Competition:** By the time the signal arrives, the opportunity is missed.",
      "**Unaccounted Costs:** Your fees, current network charges, transfer times.",
    ],
    ourBotGoal: "Our target bot (and this simulator) aims to solve these issues, providing you with an accurate and fast tool.",
    externalInstructionsLink: "Detailed Instructions from BigBTC",
  }
};


export default function ArbitrageExplainedPage() {
  const { user: tgUser } = useAppContext();
  const [currentLang, setCurrentLang] = useState<'ru' | 'en'>('ru');

  useEffect(() => {
    let langToSet: 'ru' | 'en' = 'en';
    if (tgUser?.language_code) {
        langToSet = tgUser.language_code.toLowerCase().startsWith('ru') ? 'ru' : 'en';
    }
    setCurrentLang(langToSet);
    logger.debug(`[ArbitrageExplainedPage] Language set to: ${langToSet}`);
  }, [tgUser?.language_code]);

  const t = useMemo(() => pageTranslations[currentLang] || pageTranslations['ru'], [currentLang]);

  const renderSection = (titleKey: string, contentKey: string | string[], icon?: string, listType: 'ul' | 'ol' = 'ul') => (
    <div className="mb-8 p-4 md:p-6 bg-gray-800/30 border border-gray-700/50 rounded-xl shadow-lg">
      <h2 className="text-xl md:text-2xl font-semibold text-brand-cyan mb-3 flex items-center">
        {icon && <VibeContentRenderer content={`${icon} mr-3`} />}
        {t[titleKey]}
      </h2>
      {typeof contentKey === 'string' ? (
        <VibeContentRenderer content={t[contentKey]} className="text-gray-300 leading-relaxed" />
      ) : (
        React.createElement(listType, { className: `list-${listType === 'ul' ? 'disc' : 'decimal'} list-outside pl-5 space-y-1 text-gray-300 leading-relaxed` }, 
          contentKey.map((pointKey, index) => <li key={index}><VibeContentRenderer content={t[pointKey]} /></li>)
        )
      )}
    </div>
  );
  
  const renderComparisonTable = () => (
    <div className="overflow-x-auto simple-scrollbar my-6">
        <table className="min-w-full divide-y divide-gray-700 bg-gray-800/30 rounded-lg shadow-md">
            <thead className="bg-gray-700/50">
                <tr>
                    {t.comparisonTableHeaders.map((header: string, index: number) => (
                        <th key={index} scope="col" className="px-4 py-3 text-left text-xs font-orbitron font-medium text-brand-lime uppercase tracking-wider">{header}</th>
                    ))}
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/70">
                {t.comparisonTableRows.map((row: string[], rowIndex: number) => (
                    <tr key={rowIndex} className="hover:bg-gray-700/20 transition-colors">
                        {row.map((cell, cellIndex) => (
                            <td key={cellIndex} className={`px-4 py-3 text-sm ${cellIndex === 0 ? 'font-semibold text-gray-200' : 'text-gray-300'}`}>{cell}</td>
                        ))}
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
  );


  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-blue-950 text-gray-200 p-4 pt-24 pb-12 font-mono">
      <Card className="max-w-4xl mx-auto bg-black/70 backdrop-blur-md border-2 border-brand-blue/50 shadow-2xl shadow-brand-blue/30">
        <CardHeader className="text-center border-b border-brand-blue/30 pb-6">
          <VibeContentRenderer content={t.pageTitle} className="text-3xl md:text-4xl font-bold text-brand-blue cyber-text glitch"/>
          <CardDescription className="mt-2 text-sm md:text-base text-blue-300">
            {t.pageSubtitle}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 md:p-6 space-y-10">
          
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="monitoring" className="border-brand-cyan/20">
              <AccordionTrigger className="hover:no-underline text-lg md:text-xl font-semibold text-brand-cyan hover:text-cyan-300 py-3">
                <VibeContentRenderer content={`${t.monitoringTitle} mr-2`} />
              </AccordionTrigger>
              <AccordionContent className="pt-2 pb-4 px-1 text-sm">
                <VibeContentRenderer content={t.monitoringIntro} className="mb-4 text-gray-300" />
                {renderSection("monitoringChestTitle", "monitoringChestPoints", "::FaBoxOpen::")}
                {renderSection("monitoringActionsTitle", "monitoringActionsPoints", "::FaHandPointer::")}
                {renderSection("monitoringWhyTitle", "monitoringWhyText", "::FaQuestionCircle::")}
                <VibeContentRenderer content={`**${t.monitoringSettingsImpact}**`} className="block mt-4 font-semibold text-brand-lime" />
                <VibeContentRenderer content={t.monitoringDuration} className="block mt-2 text-gray-400 italic" />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="errors" className="border-brand-red/20">
              <AccordionTrigger className="hover:no-underline text-lg md:text-xl font-semibold text-brand-red hover:text-red-400 py-3">
                <VibeContentRenderer content={`${t.errorsTitle} mr-2`} />
              </AccordionTrigger>
              <AccordionContent className="pt-2 pb-4 px-1 text-sm">
                <VibeContentRenderer content={t.errorsIntro} className="mb-4 text-gray-300" />
                {renderSection("errorExample1Title", "errorExample1Points")}
                {renderSection("errorExample2Title", "errorExample2Points")}
                {renderSection("errorsSolutionTitle", "errorsSolutionPoints", "::FaTools::")}
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="overview" className="border-brand-green/20">
              <AccordionTrigger className="hover:no-underline text-lg md:text-xl font-semibold text-brand-green hover:text-green-400 py-3">
                 <VibeContentRenderer content={`${t.botOverviewTitle} mr-2`} />
              </AccordionTrigger>
              <AccordionContent className="pt-2 pb-4 px-1 text-sm">
                <VibeContentRenderer content={t.botOverviewIntro} className="mb-4 text-gray-300" />
                {renderSection("", "botKeyFeatures", undefined, "ul")}
                <div className="mt-6">
                    <h3 className="text-lg font-semibold text-brand-lime mb-2 flex items-center">
                        <VibeContentRenderer content="::FaBoxArchive::" className="mr-2"/>
                        {t.whatInBundleTitle}
                    </h3>
                    <ul className="list-disc list-outside pl-5 space-y-1 text-gray-300 leading-relaxed">
                        {t.bundlePoints.map((pointKey: string, index: number) => <li key={index}><VibeContentRenderer content={t[pointKey]}/></li>)}
                    </ul>
                </div>
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="comparison" className="border-brand-yellow/20">
              <AccordionTrigger className="hover:no-underline text-lg md:text-xl font-semibold text-brand-yellow hover:text-yellow-300 py-3">
                 <VibeContentRenderer content={`${t.publicVsPrivateTitle} mr-2`} />
              </AccordionTrigger>
              <AccordionContent className="pt-2 pb-4 px-1 text-sm">
                <VibeContentRenderer content={t.publicVsPrivateIntro} className="mb-4 text-gray-300" />
                {renderComparisonTable()}
                {renderSection("publicBotProblemsTitle", "publicBotProblems", "::FaLock::")}
                <VibeContentRenderer content={`**${t.ourBotGoal}**`} className="block mt-4 font-semibold text-brand-lime" />
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          <div className="mt-10 text-center">
            <Button asChild className="bg-brand-blue hover:bg-blue-500 text-white font-semibold">
              <Link href="https://bigbtc.store/instrukciya-po-ispolzovaniyu-telegam-bota-dlya-arbitrazha-mezhdu-birzhami" target="_blank" rel="noopener noreferrer">
                <VibeContentRenderer content="::FaExternalLinkAlt className='mr-2':: {t.externalInstructionsLink}" />
              </Link>
            </Button>
          </div>
          
           <div className="mt-12 text-center">
             <Link href="/elon?tab=arbitrage_seeker" className="block">
                <Button variant="outline" className="border-brand-purple text-brand-purple hover:bg-brand-purple/10 hover:text-white">
                   <VibeContentRenderer content="::FaArrowLeft className='mr-2':: Назад к Симулятору Arbitrage Seeker"/>
                </Button>
            </Link>
          </div>

        </CardContent>
      </Card>
    </div>
  );
}