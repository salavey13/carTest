"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react'; // Added useCallback
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VibeContentRenderer } from '@/components/VibeContentRenderer';
import { useAppContext } from '@/contexts/AppContext';
import { debugLogger as logger } from '@/lib/debugLogger'; // Используем debugLogger как logger
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox'; 
import { Label } from '@/components/ui/label';   
// УДАЛЕНЫ ПРЯМЫЕ ИМПОРТЫ ИКОНОК ИЗ FA6

const pageTranslations: Record<string, Record<string, any>> = {
  ru: {
    pageTitle: "::FaGraduationCap:: Школа Арбитража: Гайд для Кибер-Волков",
    pageSubtitle: "Разбираем основы межбиржевого арбитража, логику работы сканеров и как выжать максимум профита в экосистеме oneSitePls.",
    
    tabBasics: "::FaRocket:: Основы & Философия",
    tabMonitoring: "::FaBoxOpen:: Механика Мониторинга",
    tabSettingsErrors: "::FaToolbox:: Настройки & Ошибки",
    tabBundleStructure: "::FaListOl:: Структура Связки",
    tabChecklist: "::FaTasks:: Чек-лист",

    realTimeSectionTitle: "::FaBolt:: Философия Реального Времени",
    realTimeSectionContent: [
        "В отличие от многих сканеров, которые обновляют данные периодически (например, раз в минуту), наш подход — это **непрерывный поток данных**. Информация поступает и обрабатывается постоянно.",
        "Это означает, что любая \"найденная\" связка потенциально может измениться или исчезнуть в течение миллисекунд. Скорость — это всё в арбитраже."
    ],
    
    publicVsPrivateTitle: "::FaShieldHalved:: Публичный бот vs. Персональный бот", // FaShieldAlt -> FaShieldHalved
    publicVsPrivateIntro: "Сравним типичного публичного Telegram-бота для арбитража (сигнальный канал) с тем, что мы стремимся создать (персональный инструмент). Публичные боты часто являются воронкой продаж, предлагая бесплатные, но не всегда практически применимые сигналы.",
    comparisonTableHeaders: ["Аспект", "Типичный Публичный Канал", "Твой Персональный Инструмент (Цель)"],
    comparisonTableRows: [
      ["Цель", "Привлечение массовой аудитории, лидогенерация.", "Ваш личный, приватный инструмент для извлечения прибыли."],
      ["Расчет Спреда", "Теоретический (по тикерам). Часто вводит в заблуждение.", "Реальный (по стаканам bid/ask). Максимально точный."],
      ["Учет Ликвидности", "Нет.", "Да, рассчитывает максимально возможный объем для сделки."],
      ["Учет Комиссий", "Нет или используется среднее значение.", "Да, учитывает ваши личные торговые комиссии и актуальные комиссии сети."],
      ["Скорость/Задержка", "Высокая. Сигнал приходит с опозданием.", "Минимальная. Уведомление приходит вам мгновенно."],
      ["Конкуренция", "Максимальная. Вы конкурируете со всеми.", "Нулевая. Это ваша эксклюзивная информация."],
      ["Гибкость Настроек", "Нет. Вы просто потребитель.", "Полная. Вы настраиваете всё."],
      ["Итог", "Информационный шум. Для обучения или развлечения.", "Профессиональный рабочий инструмент."],
    ],
    publicBotProblemsTitle: "::FaLockOpen:: Ключевые Проблемы Публичных Ботов:", // FaLock -> FaLockOpen
    publicBotProblems: [
      "**Теоретический спред:** Используют last price, а не реальные цены bid/ask из стакана.",
      "**Отсутствие учета ликвидности:** Неизвестно, какой объем можно прогнать.",
      "**Задержка и конкуренция:** Пока сигнал дойдет, возможность упущена.",
      "**Неучтенные издержки:** Ваши комиссии, актуальные сетевые сборы, время перевода.",
    ],
    ourBotGoal: "Этот симулятор и будущий бот создаются, чтобы дать тебе **конкурентное преимущество**, а не просто красивые цифры.",

    monitoringTitle: "::FaEye:: Мониторинг Связок: Принцип \"Сундука\"",
    monitoringIntro: "Чтобы не заваливать тебя уведомлениями каждую миллисекунду, мы используем интеллектуальную систему фильтрации и доставки уникальных возможностей, которую называем \"Сундук\".",
    monitoringChestTitle: "::FaBoxOpen:: Как работает \"Сундук\":",
    monitoringChestPoints: [
      "**Общий Поток Данных:** Представь, что бот видит ВСЕ возможные комбинации цен на ВСЕХ отслеживаемых биржах в каждый момент времени. Это гигантский, постоянно меняющийся \"массив\" потенциальных связок.",
      "**Твои Индивидуальные Настройки:** Это твой личный фильтр (минимальный спред, выбранные биржи, торговые пары, объем сделки, комиссии и т.д.). Ты задаешь критерии.",
      "**Первое Обнаружение и Доставка:** Когда связка из общего потока ВПЕРВЫЕ соответствует твоим настройкам, бот:",
      "  - Немедленно присылает тебе уведомление.",
      "  - **Помещает эту конкретную связку (например, BTC: Binance -> Bybit) в твой персональный \"Сундук\".**",
      "**Уникальность в Сундуке:** Пока эта связка (именно эта пара монет на этих биржах) находится в твоем \"Сундуке\", ты **НЕ получишь по ней повторное уведомление**, даже если ее спред будет колебаться (увеличиваться или уменьшаться), исчезать и появляться вновь. Мы предполагаем, что ты ее уже видел и либо работаешь по ней, либо она тебе не интересна.",
      "**Очистка Сундука:** Твой \"Сундук\" очищается, когда ты нажимаешь кнопку **\"Обновить Мониторинг\"** (или аналогичную, перезапускающую поиск с нуля) ИЛИ когда **останавливаешь мониторинг**."
    ],
    monitoringActionsTitle: "::FaHandPointer:: Взаимодействие со Связками в Сундуке:",
    monitoringActionsPoints: [
      "**Кнопка \"Обновить Связку\" (под конкретным уведомлением):** Позволяет тебе вручную проверить АКТУАЛЬНОЕ состояние связки, которая уже есть в твоем сундуке. Если спред все еще выгоден (или стал еще лучше) – отлично! Если связка \"умерла\" (спред исчез или стал отрицательным), она **автоматически удаляется из твоего сундука**. Если позже условия снова станут выгодными, эта связка (как новая возможность) снова сможет попасть в твой сундук и ты получишь уведомление.",
      "**Функция \"Переприсылать Связку\" (настраиваемая):** Если ты активировал эту опцию (например, \"переприслать, если спред увеличился на 0.2%\"), то бот будет следить за связками в твоем \"Сундуке\". Если спред по одной из них **значительно улучшится** (превысит предыдущий зафиксированный для тебя спред на указанный тобой порог), бот пришлет тебе **обновленное уведомление** по этой же связке.",
    ],
    monitoringWhyTitle: "::FaCircleQuestion:: Зачем такая логика?",
    monitoringWhyText: "Скорость рынка криптовалют такова, что без такой системы ты бы получал тысячи уведомлений в минуту. \"Сундук\" и ручное обновление конкретных связок дают тебе контроль и предотвращают информационный перегруз, позволяя сосредоточиться на действительно интересных возможностях.",
    monitoringSettingsImpact: "Любое изменение твоих настроек (фильтров) **немедленно** влияет на то, какие НОВЫЕ связки из общего потока будут попадать в твой \"Сундук\". Старые связки в сундуке остаются до их ручного обновления или общей очистки сундука.",
    monitoringDuration: "Мониторинг — это **непрерывный процесс** на выбранное тобой время (от 1 до 6 часов) и не останавливается после нахождения первой связки. Ваша цель – не просто много связок, а хорошие, отфильтрованные связки. Хочешь больше связок? Смягчай фильтры. Логично!",
    
    errorsTitle: "::FaTriangleExclamation:: Частые Ошибки Новичков в Настройках",
    errorsIntro: "Иногда связок нет не потому, что рынок мертв или бот сломался, а из-за слишком специфичных или противоречивых настроек. Давай разберем типичные фейлы:",
    errorExample1Title: "Кейс №1: \"Депозит Скромный, Аппетит Царский\"",
    errorExample1Points: [
      "**Настройки:** Депозит $150, Мин. спред 2%, Учет комиссии за вывод (включен).",
      "**Проблема:** Комиссия за вывод USDT в сети ERC20 может быть $5-$20. Даже если взять $5, это уже (5/150) * 100% = 3.33% от депозита. Бот ищет связки, где (Цена продажи * (1-Ком.ТейкераБ) - Цена покупки * (1+Ком.ТейкераА)) / (Цена покупки * (1+Ком.ТейкераА)) * 100 > 2%. Но после вычета $5 сетевой комиссии от этой прибыли, итоговый профит может стать отрицательным или мизерным. Бот честно скажет: \"Нет таких связок, бро\".",
      "**Вердикт:** С маленьким депозитом нужно либо искать сети с околонулевой комиссией (TRC20, BEP20 для стейблов, или нативные сети монет), либо временно отключать учет комиссии за вывод (но помнить о ней!), либо ставить очень высокий ожидаемый \"грязный\" спред.",
    ],
    errorExample2Title: "Кейс №2: \"Связка-Марафонец\"",
    errorExample2Points: [
      "**Настройки:** Минимальное время жизни связки = 1000 секунд (16.5 минут).",
      "**Проблема:** Требование, чтобы арбитражная возможность существовала и была прибыльной НЕПРЕРЫВНО более 16 минут до того, как бот тебе о ней сообщит, — это поиск единорога. Рынок слишком динамичен. Такие связки бывают, но крайне редко.",
      "**Вердикт:** Уменьши время жизни связки до разумных пределов (например, 30-120 секунд) или отключи этот фильтр для начала, чтобы понять текущую ситуацию на рынке.",
    ],
     errorExample3Title: "Кейс №3: \"Биткоин-Джетлаг\"",
    errorExample3Points: [
      "**Настройки:** Только BTC, Максимальное время перевода = 2 минуты.",
      "**Проблема:** Среднее время перевода BTC между биржами (с учетом подтверждений сети) — 20-60 минут. Требование 2 минуты невыполнимо для BTC.",
      "**Вердикт:** Либо выбирай более быстрые монеты/сети, либо увеличивай допустимое время перевода, либо используй стратегии без фактического перевода (например, хеджирование).",
    ],
    errorsSolutionTitle: "::FaTools:: Как Избежать Фейлов?",
    errorsSolutionPoints: [
      "**Начинай с Широкой Сети:** Не ставь сразу 10 фильтров. Начни с мин. спреда (например, 0.5%) и объема. Посмотри, что вообще есть на рынке.",
      "**Логика Прежде Всего:** Подумай, реалистичны ли твои ожидания. Если ты ищешь 5% спреда на BTC между Binance и Bybit с переводом за 1 минуту — это фантастика.",
      "**Изучай Инструменты:** Пойми, что означает каждая настройка. Для этого и создана эта страница!",
      "**Кнопка \"Сбросить Настройки\":** Если совсем запутался, всегда можно вернуться к заводским установкам и начать сначала (см. `/settings`).",
      "**Не Бойся Экспериментировать:** Это симулятор! Меняй настройки, наблюдай, как это влияет на результат. Это лучший способ обучения.",
    ],

    botOverviewTitle: "::FaRobot:: Наш Сканер: Краткий Обзор Возможностей",
    botOverviewIntro: "Этот симулятор и будущий реальный бот основаны на принципах скорости, точности и гибкости для поиска арбитражных возможностей.",
    botKeyFeatures: [
      "**Молниеносный Анализ:** Обработка данных и расчет спредов в реальном времени (цель для реального бота).",
      "**Гибкие Фильтры:** Настраивай всё — от мин. спреда до комиссий и времени жизни связки.",
      "**Учет Реальных Затрат:** Возможность включения комиссий бирж и сетей в расчет профита.",
      "**Умный Мониторинг:** Система \"Сундука\" и опциональная переотправка улучшенных связок.",
      "**Прозрачность Данных:** Подробная информация по каждой связке, включая объемы в стакане и детализацию комиссий (в будущем реальном боте).",
    ],
    whatInBundleTitle: "::FaBoxArchive:: Что в Связке? (Расшифровка)",
    bundlePoints: [
      "**Биржа и направление обмена:** (например, Gate.io: USDT → ATH).",
      "**Ссылки:** На спотовую пару, окно вывода/ввода (в реальном боте).",
      "**Курс:** Средний курс для вашего объема, кол-во ордеров в стакане, общий объем в этих ордерах. Если ордеров много – диапазон цен.",
      "**Хеджирование:** Значок ::FaUmbrellaBeach:: для маржи, ссылки на фьючерсы (если доступны).",
      "**Рейтинг CMC:** Ранг монеты и ссылка на CoinMarketCap.",
      "**Сеть перевода:** Название сети, комиссия за вывод (в монете и USDT), доступность ввода/вывода (::FaCheckCircle::/::FaTimesCircle::).", // Replaced checkmark/cross with icons
      "**Контракты:** Указание на совпадение контрактов (если информация доступна).",
      "**Время перевода:** Примерное время разлока монет (::FaHourglassStart className='text-green-500':: <15м, ::FaHourglassHalf className='text-yellow-500':: 15-60м, ::FaHourglassEnd className='text-red-500':: >60м).", // Replaced color text with icons
      "**Спред:** В % и $ по вашей рабочей сумме, с учетом комиссий (если включено).",
      "**Время жизни связки:** Как давно бот зафиксировал положительный спред.",
      "**Увеличение спреда:** Появляется, если включена функция переприсылки.",
    ],
    externalInstructionsLink: "Подробная инструкция от создателей BigBTC (внешний ресурс)",
    
    checklistTitle: "::FaTasks:: Чек-лист Понимания Арбитражной Магии",
    checklistItem1: "Я понимаю, что спред считается по ценам Ask (покупка) и Bid (продажа).",
    checklistItem2: "Я знаю, что комиссии (биржевые и сетевые) критически влияют на профит.",
    checklistItem3: "Я осознаю, что ликвидность в стакане определяет реальный объем сделки.",
    checklistItem4: "Я понимаю принцип \"Сундука\" и почему я не получаю одну и ту же связку постоянно.",
    checklistItem5: "Я готов(а) экспериментировать с настройками, чтобы найти свой \"золотой\" фильтр.",
    checklistConclusion: "::FaCheckDouble:: Отлично! Ты готов(а) к более глубокому погружению и реальным тестам!",
    backToSimulator: "::FaArrowLeft:: Назад к Симулятору Arbitrage Seeker",
  },
  // --- English Translations ---
  en: {
    pageTitle: "::FaGraduationCap:: Arbitrage School: A Cyber Wolf's Guide",
    pageSubtitle: "Understanding the basics of inter-exchange arbitrage, scanner logic, and how to maximize your profits in the oneSitePls ecosystem.",
    
    tabBasics: "::FaRocket:: Basics & Philosophy",
    tabMonitoring: "::FaBoxOpen:: Monitoring Mechanics",
    tabSettingsErrors: "::FaCogs:: Settings & Errors",
    tabBundleStructure: "::FaListOl:: Bundle Structure",
    tabChecklist: "::FaTasks:: Checklist",

    realTimeSectionTitle: "::FaBolt:: Real-Time Philosophy",
    realTimeSectionContent: [
        "Unlike many scanners that update data periodically (e.g., once a minute), our approach is a **continuous data stream**. Information flows and is processed constantly.",
        "This means any \"found\" bundle can potentially change or disappear within milliseconds. Speed is everything in arbitrage."
    ],
    
    publicVsPrivateTitle: "::FaShieldHalved:: Public Bot vs. Your Personal Bot",
    publicVsPrivateIntro: "Let's compare a typical public Telegram arbitrage bot (signal channel) with what we aim to create (a personal tool). Public bots are often sales funnels, offering free but not always actionable signals.",
    comparisonTableHeaders: ["Aspect", "Typical Public Channel", "Your Personal Tool (Target)"],
    comparisonTableRows: [
      ["Purpose", "Attract mass audience, lead generation.", "Your personal, private tool for profit extraction."],
      ["Spread Calculation", "Theoretical (by tickers). Often misleading.", "Real (by order book bid/ask). Maximally accurate."],
      ["Liquidity Accounting", "No.", "Yes, calculates max possible volume for the trade."],
      ["Fee Accounting", "No or uses average values.", "Yes, considers your personal trading fees and current network fees."],
      ["Speed/Delay", "High. Signal arrives late when opportunity is gone.", "Minimal. Notification arrives instantly TO YOU."],
      ["Competition", "Maximum. You compete with everyone.", "None. This is your exclusive information."],
      ["Settings Flexibility", "None. You are just a consumer.", "Full. You configure everything."],
      ["Outcome", "Informational noise. For learning or entertainment.", "Professional working tool."],
    ],
    publicBotProblemsTitle: "::FaLockOpen:: Key Problems with Public Bots:",
    publicBotProblems: [
      "**Theoretical Spread:** Uses last price, not actual bid/ask from the order book.",
      "**No Liquidity Consideration:** Unknown volume can be pushed through.",
      "**Delay and Competition:** By the time the signal arrives, the opportunity is missed.",
      "**Unaccounted Costs:** Your fees, current network charges, transfer times.",
    ],
    ourBotGoal: "This simulator and the future bot are designed to give you a **competitive edge**, not just pretty numbers.",

    monitoringTitle: "::FaEye:: Bundle Monitoring: The \"Chest\" Principle",
    monitoringIntro: "To avoid overwhelming you with notifications every millisecond, we use an intelligent filtering and delivery system for unique opportunities, which we call the \"Chest\".",
    monitoringChestTitle: "::FaBoxOpen:: How the \"Chest\" Works:",
    monitoringChestPoints: [
      "**General Data Stream:** Imagine the bot seeing ALL possible price combinations on ALL tracked exchanges at ALL times. This is a giant, constantly changing \"array\" of potential bundles.",
      "**Your Individual Settings:** This is your personal filter (minimum spread, selected exchanges, trading pairs, trade volume, fees, etc.). You set the criteria.",
      "**First Detection and Delivery:** When a bundle from the general stream FIRST matches your settings, the bot:",
      "  - Immediately sends you a notification.",
      "  - **Places this specific bundle (e.g., BTC: Binance -> Bybit) into your personal \"Chest\".**",
      "**Uniqueness in the Chest:** While this bundle (this exact coin pair on these exchanges) is in your \"Chest\", you **will NOT receive a repeat notification for it**, even if its spread fluctuates (increases or decreases), disappears, and reappears. We assume you've seen it and are either acting on it or it's not of interest.",
      "**Clearing the Chest:** Your \"Chest\" is cleared when you press the **\"Refresh Monitoring\"** button (or similar, restarting the search from scratch) OR when you **stop monitoring**."
    ],
    monitoringActionsTitle: "::FaHandPointer:: Interacting with Bundles in the Chest:",
    monitoringActionsPoints: [
      "**\"Update Bundle\" Button (under a specific notification):** Allows you to manually check the CURRENT state of a bundle already in your chest. If the spread is still favorable (or even better) – great! If the bundle is \"dead\" (spread disappeared or became negative), it's **automatically removed from your chest**. If favorable conditions return later, this bundle (as a new opportunity) can re-enter your chest, and you'll get a notification.",
      "**\"Resend Bundle\" Function (configurable):** If you've enabled this option (e.g., \"resend if spread increases by 0.2%\"), the bot will monitor bundles in your \"Chest\". If the spread on one of them **significantly improves** (exceeds the previously recorded spread for you by your set threshold), the bot will send you an **updated notification** for that same bundle.",
    ],
    monitoringWhyTitle: "::FaCircleQuestion:: Why This Logic?",
    monitoringWhyText: "The speed of the crypto market is such that without this system, you'd receive thousands of notifications per minute. The \"Chest\" and manual updating of specific bundles give you control and prevent information overload, allowing you to focus on genuinely interesting opportunities.",
    monitoringSettingsImpact: "Any change to your settings (filters) **immediately** affects which NEW bundles from the general stream will enter your \"Chest\". Old bundles in the chest remain until manually updated or the chest is cleared.",
    monitoringDuration: "Monitoring is a **continuous process** for your chosen duration (1 to 6 hours) and doesn't stop after finding the first bundle. Your goal isn't just many bundles, but good, filtered ones. Want more bundles? Loosen your filters. Makes sense!",
    
    errorsTitle: "::FaTriangleExclamation:: Common Novice Mistakes in Settings",
    errorsIntro: "Sometimes, bundles don't appear not because the market is dead or the bot is broken, but due to overly specific or contradictory settings. Let's look at typical fails:",
    errorExample1Title: "Case #1: \"Modest Deposit, Royal Appetite\"",
    errorExample1Points: [
      "**User Settings:** Deposit $150, Min. spread 2%, Withdrawal fee accounting ON.",
      "**Problem:** USDT withdrawal fee on ERC20 network can be $5-$20. Even at $5, that's (5/150)*100% = 3.33% of the deposit. The bot looks for ((SellPrice*(1-TakerFeeB) - BuyPrice*(1+TakerFeeA)) / (BuyPrice*(1+TakerFeeA)))*100 > 2%. But after deducting a $5 network fee, the final profit might be negative or tiny. The bot will honestly say: \"No such bundles, bro.\"",
      "**Verdict:** With a small deposit, either find networks with near-zero fees (TRC20, BEP20 for stables, or native coin networks), temporarily disable withdrawal fee accounting (but remember it!), or set a very high expected \"gross\" spread.",
    ],
    errorExample2Title: "Case #2: \"The Marathon Bundle\"",
    errorExample2Points: [
      "**Settings:** Minimum bundle lifespan = 1000 seconds (16.5 minutes).",
      "**Problem:** Requiring an arbitrage opportunity to exist and be profitable CONTINUOUSLY for over 16 minutes before the bot notifies you is like hunting for a unicorn. The market is too dynamic. Such bundles occur, but extremely rarely.",
      "**Verdict:** Reduce the bundle lifespan to reasonable limits (e.g., 30-120 seconds) or disable this filter initially to understand the current market situation.",
    ],
     errorExample3Title: "Case #3: \"Bitcoin Jet Lag\"",
    errorExample3Points: [
        "**Settings:** BTC only, Max transfer time = 2 minutes.",
        "**Problem:** Average BTC transfer time between exchanges (including network confirmations) is 20-60 minutes. A 2-minute requirement is unfeasible for BTC.",
        "**Verdict:** Either choose faster coins/networks, increase the allowable transfer time, or use strategies without actual transfers (e.g., hedging)."
    ],
    errorsSolutionTitle: "::FaTools:: How to Avoid Fails?",
    errorsSolutionPoints: [
      "**Start with a Wide Net:** Don't apply 10 filters at once. Begin with min. spread (e.g., 0.5%) and volume. See what's generally available.",
      "**Logic First:** Are your expectations realistic? If you're looking for a 5% BTC spread between Binance and Bybit with a 1-minute transfer, that's fantasy.",
      "**Study Your Tools:** Understand what each setting means. That's what this page is for!",
      "**\"Reset Settings\" Button:** If completely confused, you can always revert to factory defaults and start over (see `/settings`).",
      "**Don't Be Afraid to Experiment:** This is a simulator! Change settings, observe the impact. It's the best way to learn.",
    ],

    botOverviewTitle: "::FaRobot:: Our Scanner: A Brief Overview of Capabilities",
    botOverviewIntro: "This simulator and the future real bot are built on principles of speed, accuracy, and flexibility for finding arbitrage opportunities.",
    botKeyFeatures: [
      "**Lightning-Fast Analysis:** Real-time data processing and spread calculation (goal for the real bot).",
      "**Flexible Filters:** Customize everything—from min. spread to fees and bundle lifespan.",
      "**Real Cost Accounting:** Option to include exchange and network fees in profit calculations.",
      "**Smart Monitoring:** The \"Chest\" system and optional resending of improved bundles.",
      "**Data Transparency:** Detailed information for each bundle, including order book volumes and fee breakdowns (in the future real bot).",
    ],
    whatInBundleTitle: "::FaBoxArchive:: What's in a Bundle? (Decryption)",
    bundlePoints: [
      "**Exchange & Direction:** (e.g., Gate.io: USDT → ATH).",
      "**Links:** To spot pair, withdrawal/deposit window (in real bot).",
      "**Rate:** Average rate for your volume, no. of orders in book, total volume in these orders. If many orders – price range.",
      "**Hedging:** ::FaUmbrellaBeach:: icon for margin, links to futures (if available).",
      "**CMC Rank:** Coin rank & link to CoinMarketCap.",
      "**Transfer Network:** Network name, withdrawal fee (coin & USDT), deposit/withdrawal availability (::FaCheckCircle::/::FaTimesCircle::).",
      "**Contracts:** Indication of matching contracts (if info available).",
      "**Transfer Time:** Approx. coin unlock time (::FaHourglassStart className='text-green-500':: <15m, ::FaHourglassHalf className='text-yellow-500':: 15-60m, ::FaHourglassEnd className='text-red-500':: >60m).",
      "**Spread:** In % and $ for your working amount, considering fees (if enabled).",
      "**Bundle Lifespan:** How long ago the bot detected a positive spread.",
      "**Spread Increase:** Appears if resend function is active.",
    ],
    externalInstructionsLink: "Detailed Instructions from BigBTC creators (external resource)",
    
    checklistTitle: "::FaTasks:: Arbitrage Magic Comprehension Checklist",
    checklistItem1: "I understand that spread is calculated using Ask (buy) and Bid (sell) prices.",
    checklistItem2: "I know that fees (exchange & network) critically impact profit.",
    checklistItem3: "I realize that order book liquidity determines the real trade volume.",
    checklistItem4: "I understand the \"Chest\" principle and why I don't get the same bundle repeatedly.",
    checklistItem5: "I am ready to experiment with settings to find my \"golden\" filter.",
    checklistConclusion: "::FaCheckDouble:: Excellent! You're ready for a deeper dive and real tests!",
    backToSimulator: "::FaArrowLeft:: Back to Arbitrage Seeker Simulator",
  }
};


export default function ArbitrageExplainedPage() {
  const { user: tgUser } = useAppContext();
  const [currentLang, setCurrentLang] = useState<'ru' | 'en'>('ru');
  const [checklist, setChecklist] = useState({
    item1: false, item2: false, item3: false, item4: false, item5: false,
  });

  const handleChecklistChange = (item: keyof typeof checklist) => {
    setChecklist(prev => ({ ...prev, [item]: !prev[item] }));
  };

  const allChecked = useMemo(() => Object.values(checklist).every(Boolean), [checklist]);

  useEffect(() => {
    let langToSet: 'ru' | 'en' = 'en';
    if (tgUser?.language_code) {
        langToSet = tgUser.language_code.toLowerCase().startsWith('ru') ? 'ru' : 'en';
    }
    setCurrentLang(langToSet);
    logger.log(`[ArbitrageExplainedPage] Language set to: ${langToSet}`); // Corrected from logger.debug
  }, [tgUser?.language_code]);

  const t = useMemo(() => pageTranslations[currentLang] || pageTranslations['ru'], [currentLang]);

  const renderSection = (titleKey: string, contentKey: string | string[], icon?: string, listType: 'ul' | 'ol' = 'ul', contentClassName: string = "text-gray-300/90 leading-relaxed text-sm") => (
    <div className="mb-6 p-3 md:p-4 bg-gray-800/50 border border-gray-700/30 rounded-lg shadow-md">
      <h3 className="text-lg md:text-xl font-semibold text-brand-cyan mb-2 flex items-center">
        {icon && <VibeContentRenderer content={`${icon} mr-2`} />}
        {t[titleKey]}
      </h3>
      {typeof contentKey === 'string' ? (
        <VibeContentRenderer content={t[contentKey]} className={contentClassName} />
      ) : (
        React.createElement(listType, { className: `list-${listType === 'ul' ? 'disc' : 'decimal'} list-outside pl-4 space-y-1 ${contentClassName}` }, 
          contentKey.map((pointKeyOrString, index) => (
            <li key={index} className="pl-1">
                <VibeContentRenderer content={typeof pointKeyOrString === 'string' && t[pointKeyOrString] ? t[pointKeyOrString] : pointKeyOrString} />
            </li>
            ))
        )
      )}
    </div>
  );
  
  const renderComparisonTable = () => (
    <div className="overflow-x-auto simple-scrollbar my-6 text-sm">
        <table className="min-w-full divide-y divide-gray-700 bg-gray-800/40 rounded-lg shadow-md">
            <thead className="bg-gray-700/60">
                <tr>
                    {(t.comparisonTableHeaders as string[]).map((header: string, index: number) => (
                        <th key={index} scope="col" className="px-3 py-2.5 text-left text-xs font-orbitron font-medium text-brand-lime uppercase tracking-wider">{header}</th>
                    ))}
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/50">
                {(t.comparisonTableRows as string[][]).map((row: string[], rowIndex: number) => (
                    <tr key={rowIndex} className="hover:bg-gray-700/30 transition-colors">
                        {row.map((cell, cellIndex) => (
                            <td key={cellIndex} className={`px-3 py-2.5 ${cellIndex === 0 ? 'font-semibold text-gray-100' : 'text-gray-300'}`}>{cell}</td>
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
        <CardContent className="p-4 md:p-6 ">
          <Tabs defaultValue="basics" className="w-full">
            <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-1 bg-black/50 p-1 h-auto mb-6">
              <TabsTrigger value="basics" className="text-xs px-1 py-1.5 sm:py-2 data-[state=active]:bg-brand-blue/80 data-[state=active]:text-white font-orbitron"><VibeContentRenderer content="{t.tabBasics}"/></TabsTrigger>
              <TabsTrigger value="monitoring" className="text-xs px-1 py-1.5 sm:py-2 data-[state=active]:bg-brand-blue/80 data-[state=active]:text-white font-orbitron"><VibeContentRenderer content="{t.tabMonitoring}"/></TabsTrigger>
              <TabsTrigger value="settings_errors" className="text-xs px-1 py-1.5 sm:py-2 data-[state=active]:bg-brand-blue/80 data-[state=active]:text-white font-orbitron"><VibeContentRenderer content="{t.tabSettingsErrors}"/></TabsTrigger>
              <TabsTrigger value="bundle_structure" className="text-xs px-1 py-1.5 sm:py-2 data-[state=active]:bg-brand-blue/80 data-[state=active]:text-white font-orbitron"><VibeContentRenderer content="{t.tabBundleStructure}"/></TabsTrigger>
              <TabsTrigger value="checklist" className="text-xs px-1 py-1.5 sm:py-2 data-[state=active]:bg-brand-blue/80 data-[state=active]:text-white font-orbitron"><VibeContentRenderer content="{t.tabChecklist}"/></TabsTrigger>
            </TabsList>

            <TabsContent value="basics" className="space-y-6">
              {renderSection("realTimeSectionTitle", "realTimeSectionContent", "::FaBolt::")}
              {renderSection("publicVsPrivateTitle", "publicVsPrivateIntro", "::FaShieldHalved::")}
              {renderComparisonTable()}
              {renderSection("publicBotProblemsTitle", "publicBotProblems", "::FaLockOpen::", "ul", "text-red-400/90 leading-relaxed text-sm")}
              <VibeContentRenderer content={`**${t.ourBotGoal}**`} className="block mt-4 font-semibold text-brand-lime text-center" />
            </TabsContent>

            <TabsContent value="monitoring" className="space-y-6">
                <VibeContentRenderer content={t.monitoringIntro} className="mb-4 text-gray-300 text-sm" />
                {renderSection("monitoringChestTitle", "monitoringChestPoints", "::FaBoxOpen::")}
                {renderSection("monitoringActionsTitle", "monitoringActionsPoints", "::FaHandPointer::")}
                {renderSection("monitoringWhyTitle", "monitoringWhyText", "::FaCircleQuestion::")}
                <VibeContentRenderer content={`**${t.monitoringSettingsImpact}**`} className="block mt-4 font-semibold text-brand-lime" />
                <VibeContentRenderer content={t.monitoringDuration} className="block mt-2 text-gray-400 italic" />
            </TabsContent>

            <TabsContent value="settings_errors" className="space-y-6">
                <VibeContentRenderer content={t.errorsIntro} className="mb-4 text-gray-300 text-sm" />
                {renderSection("errorExample1Title", "errorExample1Points")}
                {renderSection("errorExample2Title", "errorExample2Points")}
                {renderSection("errorExample3Title", "errorExample3Points")}
                {renderSection("errorsSolutionTitle", "errorsSolutionPoints", "::FaTools::")}
            </TabsContent>

            <TabsContent value="bundle_structure" className="space-y-6">
                {renderSection("botOverviewTitle", "botOverviewIntro", "::FaRobot::")}
                {renderSection("", "botKeyFeatures", undefined, "ul")}
                <div className="mt-6">
                    <h3 className="text-lg font-semibold text-brand-lime mb-2 flex items-center">
                        <VibeContentRenderer content="::FaBoxArchive::" className="mr-2"/>
                        {t.whatInBundleTitle}
                    </h3>
                    <ul className="list-disc list-outside pl-5 space-y-1 text-gray-300/90 leading-relaxed text-sm">
                        {(t.bundlePoints as string[]).map((pointKey: string, index: number) => <li key={index} className="pl-1"><VibeContentRenderer content={t[pointKey] || pointKey}/></li>)}
                    </ul>
                </div>
            </TabsContent>
            
            <TabsContent value="checklist" className="space-y-6">
                <div className="mt-6 p-4 md:p-6 bg-gray-800/40 border border-brand-purple/30 rounded-xl shadow-lg">
                    <h2 className="text-xl md:text-2xl font-semibold text-brand-purple mb-4 text-center">
                        <VibeContentRenderer content={t.checklistTitle} />
                    </h2>
                    <div className="space-y-3">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <div key={`check-${i+1}`} className="flex items-center space-x-3 p-2.5 bg-black/30 rounded-md border border-gray-700/50 hover:border-purple-500/50 transition-colors">
                                <Checkbox 
                                    id={`checkItem${i+1}`} 
                                    checked={checklist[`item${i+1}` as keyof typeof checklist]} 
                                    onCheckedChange={() => handleChecklistChange(`item${i+1}` as keyof typeof checklist)}
                                    className="border-brand-purple data-[state=checked]:bg-brand-purple data-[state=checked]:text-black"
                                />
                                <Label htmlFor={`checkItem${i+1}`} className="text-sm text-gray-200 cursor-pointer flex-1">
                                   <VibeContentRenderer content={t[`checklistItem${i+1}`]} />
                                </Label>
                            </div>
                        ))}
                    </div>
                    {allChecked && (
                        <motion.p 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mt-5 text-center font-semibold text-brand-green text-lg">
                            <VibeContentRenderer content={t.checklistConclusion} />
                        </motion.p>
                    )}
                </div>
            </TabsContent>
          </Tabs>

          <div className="mt-10 text-center">
            <Button asChild className="bg-brand-blue hover:bg-blue-500 text-white font-semibold">
              <Link href="https://bigbtc.store/instrukciya-po-ispolzovaniyu-telegam-bota-dlya-arbitrazha-mezhdu-birzhami" target="_blank" rel="noopener noreferrer">
                <VibeContentRenderer content="::FaExternalLinkAlt className='mr-2':: {t.externalInstructionsLink}" />
              </Link>
            </Button>
          </div>
          
           <div className="mt-12 text-center">
             <Link href="/elon#arbitrage_seeker" className="block" scroll={false}>
                <Button variant="outline" className="border-brand-purple text-brand-purple hover:bg-brand-purple/10 hover:text-white">
                   <VibeContentRenderer content="::FaArrowLeft className='mr-2':: {t.backToSimulator}"/>
                </Button>
            </Link>
          </div>

        </CardContent>
      </Card>
    </div>
  );
}