"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VibeContentRenderer } from '@/components/VibeContentRenderer';
import { useAppContext } from '@/contexts/AppContext';
import { debugLogger as logger } from '@/lib/debugLogger';
import Link from 'next/link';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox'; 
import { Label } from '@/components/ui/label';   
import { motion } from "framer-motion"; 

const PLACEHOLDER_IMAGE_URL = "https://placehold.co/600x300/1a1a2e/7f7f7f/png?text=Infographic+Placeholder";

const pageTranslations: Record<string, Record<string, any>> = {
  ru: {
    pageTitle: "::FaGraduationCap:: Школа Арбитража: Гайд для Кибер-Волков",
    pageSubtitle: "Разбираем основы межбиржевого арбитража, логику работы сканеров и как выжать максимум профита в экосистеме oneSitePls.",
    
    tabBasics: "Основы & Философия",
    tabMonitoring: "Механика Мониторинга",
    tabSettingsErrors: "Настройки & Ошибки",
    tabBundleStructure: "Структура Связки",
    tabChecklist: "Чек-лист",

    basicsIcon: "::FaRocket::",
    monitoringIcon: "::FaBoxOpen::",
    settingsErrorsIcon: "::FaToolbox::",
    bundleStructureIcon: "::FaListOl::",
    checklistIcon: "::FaTasks::",

    realTimeSectionTitle: "::FaBolt:: Философия Реального Времени",
    realTimeSectionContent: [
        "В отличие от многих сканеров, которые обновляют данные периодически (например, раз в минуту), наш подход — это **непрерывный поток данных**. Информация поступает и обрабатывается постоянно.",
        "Это означает, что любая \"найденная\" связка потенциально может измениться или исчезнуть в течение миллисекунд. Скорость — это всё в арбитраже.",
        "**Пример:** Если цена BTC на Binance изменилась на $0.01, наша система это видит почти мгновенно, а не ждет следующего минутного тика."
    ],
    whySpeedMattersTitle: "::FaShippingFast:: Почему Скорость Решает Всё?",
    whySpeedMattersContent: [
        "Арбитражные возможности (спреды) крайне недолговечны. Как только появляется выгодная разница цен, другие трейдеры и боты тут же начинают её использовать, выравнивая цены.",
        "Если ваш сканер обновляется раз в минуту, то к моменту получения сигнала спред, скорее всего, уже исчезнет. Это как пытаться поймать молнию сачком для бабочек.",
        "**Пример из жизни:** Нашли спред в 1% на паре ETH/USDT. Пока ваш медленный сканер это обработал и прислал вам, быстрые боты уже совершили сделки, и спред сократился до 0.1% или вовсе исчез. Ваш профит улетучился.",
        "Наш целевой бот стремится к миллисекундным задержкам, чтобы вы были среди первых, кто видит и может использовать возможность."
    ],
    altRealtimeFlowRu: "Инфографика: Поток данных по арбитражу в реальном времени, показывающий быстрое обновление цен на разных биржах и их анализ.",
    altRealtimeFlowEn: "Infographic: Real-time arbitrage data flow, showing rapid price updates across exchanges and their analysis.",
    
    publicVsPrivateTitle: "::FaShieldHalved:: Публичный бот vs. Персональный бот",
    publicVsPrivateIntro: "Сравним типичного публичного Telegram-бота для арбитража (сигнальный канал) с тем, что мы стремимся создать (персональный инструмент). Публичные боты часто являются воронкой продаж, предлагая бесплатные, но не всегда практически применимые сигналы.",
    comparisonTableHeaders: ["Аспект", "Типичный Публичный Канал", "Твой Персональный Инструмент (Цель)"],
    comparisonTableRows: [
      ["Цель", "Привлечение массовой аудитории, лидогенерация.", "Ваш личный, приватный инструмент для извлечения прибыли."],
      ["Расчет Спреда", "Теоретический (по тикерам). Часто вводит в заблуждение.", "Реальный (по стаканам bid/ask). Максимально точный."],
      ["Ликвидность", "Нет.", "Да, рассчитывает максимально возможный объем для сделки."],
      ["Учет Комиссий", "Нет или используется среднее значение.", "Да, учитывает ваши личные торговые комиссии и актуальные комиссии сети."],
      ["Скорость/Задержка", "Высокая. Сигнал приходит с опозданием.", "Минимальная. Уведомление приходит вам мгновенно."],
      ["Конкуренция", "Максимальная. Вы конкурируете со всеми.", "Нулевая. Это ваша эксклюзивная информация."],
      ["Гибкость Настроек", "Нет. Вы просто потребитель.", "Полная. Вы настраиваете всё."],
      ["Итог", "Информационный шум. Для обучения или развлечения.", "Профессиональный рабочий инструмент."],
    ],
    publicBotProblemsTitle: "::FaLockOpen:: Ключевые Проблемы Публичных Ботов:",
    publicBotProblems: [
      "**Теоретический спред:** Используют last price, а не реальные цены bid/ask из стакана. Не учитывается, что для покупки используется цена Ask, а для продажи - цена Bid.",
      "**Отсутствие учета ликвидности:** Неизвестно, какой объем можно реально прогнать по указанной цене. В стакане может быть объем на $200, а спред указан для $10,000.",
      "**Задержка и конкуренция:** Пока сигнал дойдет до подписчиков (секунды, а то и минуты), возможность уже использована тысячами других ботов и трейдеров.",
      "**Неучтенные издержки:** Публичный бот не знает ваших персональных торговых комиссий (taker/maker), актуальных комиссий сети за перевод актива (которые могут колебаться от $1 до $50), и времени перевода (криптовалюта может идти 20-40 минут, за это время спред исчезнет).",
    ],
    ourBotGoal: "Этот симулятор и будущий бот создаются, чтобы дать тебе **конкурентное преимущество**, основанное на точности, скорости и персонализации, а не просто красивые цифры.",

    monitoringTitle: "::FaEye:: Мониторинг Связок: Принцип \"Сундука\"",
    monitoringIntro: "Чтобы не заваливать тебя уведомлениями каждую миллисекунду, мы используем интеллектуальную систему фильтрации и доставки уникальных возможностей, которую называем \"Сундук\". Она гарантирует, что ты видишь только релевантные и еще не отработанные тобой связки.",
    monitoringChestTitle: "::FaBoxOpen:: Как работает \"Сундук\":",
    monitoringChestPoints: [
      "**Общий Поток Данных:** Представь, что бот видит ВСЕ возможные комбинации цен на ВСЕХ отслеживаемых биржах в каждый момент времени. Это гигантский, постоянно меняющийся \"массив\" потенциальных связок.",
      "**Твои Индивидуальные Настройки:** Это твой личный фильтр (минимальный спред, выбранные биржи, торговые пары, объем сделки, комиссии и т.д.). Ты задаешь критерии.",
      "**Первое Обнаружение и Доставка:** Когда связка из общего потока ВПЕРВЫЕ соответствует твоим настройкам, бот:",
      "  - Немедленно присылает тебе уведомление.",
      "  - **Помещает эту конкретную связку (например, BTC: Binance -> Bybit) в твой персональный \"Сундук\".**",
      "**Уникальность в Сундуке:** Пока эта связка (именно эта пара монет на этих биржах) находится в твоем \"Сундуке\", ты **НЕ получишь по ней повторное уведомление**, даже если ее спред будет колебаться (увеличиваться или уменьшаться), исчезать и появляться вновь. Мы предполагаем, что ты ее уже видел и либо работаешь по ней, либо она тебе не интересна и ты ждешь другую.",
      "**Очистка Сундука:** Твой \"Сундук\" очищается, когда ты нажимаешь кнопку **\"Обновить Мониторинг\"** (или аналогичную, перезапускающую поиск с нуля) ИЛИ когда **останавливаешь мониторинг**. Это позволяет системе заново находить связки, которые могли стать неактуальными и потом снова появиться."
    ],
    altChestMechanismRu: "Инфографика: Принцип работы \"Сундука\" для арбитражных связок. Показывает поток связок, фильтр и попадание в персональный сундук.",
    altChestMechanismEn: "Infographic: \"Chest\" principle for arbitrage bundles, showing flow, filter, and personal chest.",
    monitoringActionsTitle: "::FaHandPointer:: Взаимодействие со Связками в Сундуке:",
    monitoringActionsPoints: [
      "**Кнопка \"Обновить Связку\" (под конкретным уведомлением):** Позволяет тебе вручную проверить АКТУАЛЬНОЕ состояние связки, которая уже есть в твоем сундуке. Если спред все еще выгоден (или стал еще лучше) – отлично! Если связка \"умерла\" (спред исчез или стал отрицательным), она **автоматически удаляется из твоего сундука**. Если позже условия снова станут выгодными, эта связка (как новая возможность) снова сможет попасть в твой сундук и ты получишь уведомление.",
      "**Функция \"Переприсылать Связку\" (настраиваемая):** Если ты активировал эту опцию (например, \"переприслать, если спред увеличился на 0.2%\"), то бот будет следить за связками в твоем \"Сундуке\". Если спред по одной из них **значительно улучшится** (превысит предыдущий зафиксированный для тебя спред на указанный тобой порог), бот пришлет тебе **обновленное уведомление** по этой же связке.",
    ],
    monitoringWhyTitle: "::FaCircleQuestion:: Зачем такая логика?",
    monitoringWhyText: "Скорость рынка криптовалют такова, что без такой системы ты бы получал тысячи уведомлений в минуту. \"Сундук\" и ручное обновление конкретных связок дают тебе контроль и предотвращают информационный перегруз, позволяя сосредоточиться на действительно интересных возможностях. Главное – не количество, а качество и актуальность информации.",
    monitoringSettingsImpact: "Любое изменение твоих настроек (фильтров) **немедленно** влияет на то, какие НОВЫЕ связки из общего потока будут попадать в твой \"Сундук\". Старые связки в сундуке остаются до их ручного обновления или общей очистки сундука.",
    monitoringDuration: "Мониторинг — это **непрерывный процесс** на выбранное тобой время (от 1 до 6 часов) и не останавливается после нахождения первой связки. Ваша цель – не просто много связок, а хорошие, отфильтрованные связки. Хочешь больше связок? Смягчай фильтры. Логично!",
    
    errorsTitle: "::FaTriangleExclamation:: Частые Ошибки Новичков в Настройках",
    errorsIntro: "Иногда связок нет не потому, что рынок мертв или бот сломался, а из-за слишком специфичных или противоречивых настроек. Давай разберем типичные фейлы:",
    errorCaseAccordionTitle: "Кейс #",
    errorExample1Title: "Депозит Скромный, Аппетит Царский",
    errorExample1Points: [
        "**Настройки Пользователя:** Депозит $150. Минимальный спред 2%. Учет комиссии за вывод включен.",
        "**Проблема:** Допустим, комиссия за вывод USDT в сети ERC20 составляет $10 (может быть и больше!). Это (10/150) * 100% = **6.67%** от депозита только на вывод! Чтобы после такой комиссии остался еще и 2% спред, изначальный \"грязный\" спред между биржами должен быть более 8.67%. Это очень много.",
        "**Пример Расчета:** Ты хочешь купить на $150. Цена покупки $100. Цена продажи $103 (спред 3%). Твоя прибыль \"грязными\" = $150 * 0.03 = $4.5. Вычитаем комиссию сети $10. Итог: $4.5 - $10 = **-$5.5 убытка**.",
        "**Вердикт:** С маленьким депозитом ищи сети с низкой комиссией (TRC20, BEP20 для стейблов, или нативные сети монет, где комиссия центы). Либо временно отключай учет комиссии сети (но держи ее в уме!), либо ставь высокий \"грязный\" спред, осознавая, что чистый будет меньше. Или увеличивай депозит.",
    ],
    errorExample2Title: "Связка-Марафонец",
    errorExample2Points: [
        "**Настройки Пользователя:** Минимальное время жизни связки = 1000 секунд (16.5 минут).",
        "**Проблема:** Требование, чтобы арбитражная возможность существовала и была прибыльной НЕПРЕРЫВНО более 16 минут до того, как бот тебе о ней сообщит, — это поиск единорога. Рынок слишком динамичен. Такие связки бывают, но крайне редко.",
        "**Вердикт:** Уменьши время жизни связки до разумных пределов (например, 30-120 секунд) или отключи этот фильтр для начала, чтобы понять текущую ситуацию на рынке.",
    ],
    errorExample3Title: "Биткоин-Джетлаг",
    errorExample3Points: [
        "**Настройки Пользователя:** Только BTC, Максимальное время перевода = 2 минуты.",
        "**Проблема:** Среднее время перевода BTC между биржами (с учетом подтверждений сети) — 20-60 минут. Требование 2 минуты невыполнимо для BTC. Пока BTC дойдет, спреда уже не будет.",
        "**Вердикт:** Либо выбирай более быстрые монеты/сети, либо увеличивай допустимое время перевода, либо используй стратегии без фактического перевода (например, хеджирование фьючерсами, если ты это умеешь).",
    ],
    altSettingsImpactRu: "Инфографика: Влияние настроек на количество и качество арбитражных связок. Слева - жесткие фильтры и 0 связок, справа - гибкие фильтры и качественные связки.",
    altSettingsImpactEn: "Infographic: Impact of settings on arbitrage bundle quantity and quality. Left: strict filters, 0 bundles. Right: flexible filters, quality bundles.",
    errorsSolutionTitle: "::FaTools:: Как Избежать Фейлов и Найти Профит?",
    errorsSolutionPoints: [
        "**Начинай с Широкой Сети:** Не ставь сразу 10 фильтров. Начни с реалистичного мин. спреда (например, 0.3% - 0.7% для начала) и твоего рабочего объема. Посмотри, что вообще есть на рынке. Запиши найденные связки.",
        "**Анализируй Найденное:** Какие монеты/пары чаще появляются? Какие биржи? Какие сети для перевода используются? Это даст тебе понимание текущей конъюнктуры.",
        "**Логика Прежде Всего:** Подумай, реалистичны ли твои ожидания. Если ты ищешь 5% спреда на BTC между Binance и Bybit с переводом за 1 минуту — это близко к фантастике для стабильного заработка.",
        "**Изучай Инструменты:** Пойми, что означает каждая настройка. **Эта страница – твой первый шаг к этому!**",
        "**Комиссии – Твой Враг и Друг:** Узнай свои реальные торговые комиссии на биржах (Taker/Maker). Изучи комиссии за вывод разных монет в разных сетях. USDT в ERC20 – дорого, в TRC20/BEP20 – дешево. Нативные монеты (SOL, TRX, ATOM) часто имеют дешевые и быстрые переводы.",
        "**Кнопка \"Сбросить Настройки\":** Если совсем запутался, всегда можно вернуться к заводским установкам на странице `/settings` и начать сначала.",
        "**Не Бойся Экспериментировать:** Это симулятор! Меняй настройки, наблюдай, как это влияет на результат. Записывай успешные комбинации. Это лучший способ обучения.",
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
      "**Сеть перевода:** Название сети, комиссия за вывод (в монете и USDT), доступность ввода/вывода (::FaCheckCircle::/::FaCircleXmark::).", 
      "**Контракты:** Указание на совпадение контрактов (если информация доступна).",
      "**Время перевода:** Примерное время разлока монет (::FaHourglassStart className='text-green-500':: <15м, ::FaHourglassHalf className='text-yellow-500':: 15-60м, ::FaHourglassEnd className='text-red-500':: >60м).", 
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
    backToSimulator: "Назад к Симулятору Arbitrage Seeker",
  },
  en: { // ... English translations would go here, similar structure
    pageTitle: "::FaGraduationCap:: Arbitrage School: A Cyber Wolf's Guide",
    pageSubtitle: "Understanding the basics of inter-exchange arbitrage, scanner logic, and how to maximize your profits in the oneSitePls ecosystem.",
    tabBasics: "Basics & Philosophy",
    tabMonitoring: "Monitoring Mechanics",
    tabSettingsErrors: "Settings & Errors",
    tabBundleStructure: "Bundle Structure",
    tabChecklist: "Checklist",
    basicsIcon: "::FaRocket::",
    monitoringIcon: "::FaBoxOpen::",
    settingsErrorsIcon: "::FaToolbox::",
    bundleStructureIcon: "::FaListOl::",
    checklistIcon: "::FaTasks::",
    realTimeSectionTitle: "::FaBolt:: Real-Time Philosophy",
    realTimeSectionContent: [
        "Unlike many scanners that update data periodically (e.g., once a minute), our approach is a **continuous data stream**. Information flows and is processed constantly.",
        "This means any \"found\" bundle can potentially change or disappear within milliseconds. Speed is everything in arbitrage.",
        "**Example:** If the BTC price on Binance changes by $0.01, our system sees it almost instantly, not waiting for the next minute's tick."
    ],
    whySpeedMattersTitle: "::FaShippingFast:: Why Speed Matters",
    whySpeedMattersContent: [
        "Arbitrage opportunities (spreads) are extremely short-lived. As soon as a profitable price difference appears, other traders and bots immediately start exploiting it, equalizing prices.",
        "If your scanner updates once a minute, by the time you receive the signal, the spread will likely have disappeared. It's like trying to catch lightning with a butterfly net.",
        "**Real-life example:** You found a 1% spread on ETH/USDT. By the time your slow scanner processed and sent it to you, fast bots had already made trades, and the spread shrank to 0.1% or vanished. Your profit is gone.",
        "Our target bot aims for millisecond delays so you're among the first to see and potentially use an opportunity."
    ],
    altRealtimeFlowEn: "Infographic: Real-time arbitrage data flow, showing rapid price updates across exchanges and their analysis.",
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
      "**Theoretical Spread:** Uses last price, not actual bid/ask from the order book. Doesn't account for buying at Ask and selling at Bid.",
      "**No Liquidity Consideration:** Unknown what volume can actually be traded at the advertised price. The order book might only have $200 at that price, while the spread is shown for $10,000.",
      "**Delay and Competition:** By the time the signal reaches subscribers (seconds or even minutes), thousands of other bots and traders have already exploited the opportunity.",
      "**Unaccounted Costs:** Public bots don't know your personal trading fees (taker/maker), current network fees for asset transfer (which can range from $1 to $50), or transfer times (crypto can take 20-40 minutes, by which time the spread is gone).",
    ],
    ourBotGoal: "This simulator and the future bot are designed to give you a **competitive edge** based on accuracy, speed, and personalization, not just pretty numbers.",
    monitoringTitle: "::FaEye:: Bundle Monitoring: The \"Chest\" Principle",
    monitoringIntro: "To avoid overwhelming you with notifications every millisecond, we use an intelligent filtering and delivery system for unique opportunities, which we call the \"Chest\". It ensures you only see relevant bundles you haven't acted on yet.",
    monitoringChestTitle: "::FaBoxOpen:: How the \"Chest\" Works:",
    monitoringChestPoints: [
      "**General Data Stream:** Imagine the bot seeing ALL possible price combinations on ALL tracked exchanges at ALL times. This is a giant, constantly changing \"array\" of potential bundles.",
      "**Your Individual Settings:** This is your personal filter (minimum spread, selected exchanges, trading pairs, trade volume, fees, etc.). You set the criteria.",
      "**First Detection and Delivery:** When a bundle from the general stream FIRST matches your settings, the bot:",
      "  - Immediately sends you a notification.",
      "  - **Places this specific bundle (e.g., BTC: Binance -> Bybit) into your personal \"Chest\".**",
      "**Uniqueness in the Chest:** While this bundle (this exact coin pair on these exchanges) is in your \"Chest\", you **will NOT receive a repeat notification for it**, even if its spread fluctuates, disappears, and reappears. We assume you've seen it and are either acting on it or it's not of interest and you're waiting for another.",
      "**Clearing the Chest:** Your \"Chest\" is cleared when you press the **\"Refresh Monitoring\"** button (or similar) OR when you **stop monitoring**. This allows the system to re-discover bundles that might have become inactive and then active again."
    ],
    altChestMechanismEn: "Infographic: \"Chest\" principle for arbitrage bundles, showing flow, filter, and personal chest.",
    monitoringActionsTitle: "::FaHandPointer:: Interacting with Bundles in the Chest:",
    monitoringActionsPoints: [
      "**\"Update Bundle\" Button (under a specific notification):** Manually check the CURRENT state of a bundle in your chest. If still good (or better) – great! If \"dead\" (spread gone/negative), it's **auto-removed from your chest**. If it becomes favorable again later, it can re-enter your chest as a new opportunity.",
      "**\"Resend Bundle\" Function (configurable):** If enabled (e.g., \"resend if spread up by 0.2%\"), the bot monitors your Chest. If a bundle's spread **significantly improves** (exceeds your threshold over the last notified spread), you get an **updated notification**.",
    ],
    monitoringWhyTitle: "::FaCircleQuestion:: Why This Logic?",
    monitoringWhyText: "The crypto market's speed means without this, you'd get thousands of notifications per minute. The \"Chest\" and manual updates give you control, prevent overload, and let you focus on truly interesting opportunities. Quality and relevance over quantity.",
    monitoringSettingsImpact: "Any change to your settings (filters) **immediately** affects which NEW bundles from the general stream enter your \"Chest\". Old bundles in the chest remain until manually updated or the chest is cleared.",
    monitoringDuration: "Monitoring is a **continuous process** for your chosen duration (1 to 6 hours). It doesn't stop after the first find. The goal is quality, filtered opportunities, not just quantity. Want more? Loosen filters. Logical!",
    errorsTitle: "::FaTriangleExclamation:: Common Novice Mistakes in Settings",
    errorsIntro: "Sometimes, no bundles appear not because the market is dead or the bot is broken, but due to overly specific or contradictory settings. Let's review typical fails:",
    errorCaseAccordionTitle: "Case #",
    errorExample1Title: "Modest Deposit, Royal Appetite",
    errorExample1Points: [/* ... as in RU ... */],
    errorExample2Title: "The Marathon Bundle",
    errorExample2Points: [/* ... as in RU ... */],
    errorExample3Title: "Bitcoin Jet Lag",
    errorExample3Points: [/* ... as in RU ... */],
    altSettingsImpactEn: "Infographic: Impact of settings on arbitrage bundle quantity and quality. Left: strict filters, 0 bundles. Right: flexible filters, quality bundles.",
    errorsSolutionTitle: "::FaTools:: How to Avoid Fails & Find Profit?",
    errorsSolutionPoints: [/* ... as in RU ... */],
    botOverviewTitle: "::FaRobot:: Our Scanner: A Brief Overview of Capabilities",
    botOverviewIntro: "This simulator and the future real bot are built on principles of speed, accuracy, and flexibility for finding arbitrage opportunities.",
    botKeyFeatures: [/* ... as in RU ... */],
    whatInBundleTitle: "::FaBoxArchive:: What's in a Bundle? (Decryption)",
    bundlePoints: [/* ... as in RU, but translated ... */],
    externalInstructionsLink: "Detailed Instructions from BigBTC creators (external resource)",
    checklistTitle: "::FaTasks:: Arbitrage Magic Comprehension Checklist",
    checklistItem1: "I understand that spread is calculated using Ask (buy) and Bid (sell) prices.",
    checklistItem2: "I know that fees (exchange & network) critically impact profit.",
    checklistItem3: "I realize that order book liquidity determines the real trade volume.",
    checklistItem4: "I understand the \"Chest\" principle and why I don't get the same bundle repeatedly.",
    checklistItem5: "I am ready to experiment with settings to find my \"golden\" filter.",
    checklistConclusion: "::FaCheckDouble:: Excellent! You're ready for a deeper dive and real tests!",
    backToSimulator: "Back to Arbitrage Seeker Simulator",
  }
};

const ImagePlaceholder: React.FC<{altTextKey: string; placeholderUrl?: string; currentLang: 'ru' | 'en'}> = ({altTextKey, placeholderUrl = PLACEHOLDER_IMAGE_URL, currentLang}) => {
    const altText = pageTranslations[currentLang]?.[altTextKey] || pageTranslations['en']?.[altTextKey] || "Infographic placeholder";
    return (
        <div className="my-6 p-2 border border-gray-700/50 rounded-lg bg-black/30 max-w-md mx-auto">
          <div className="aspect-video w-full h-auto overflow-hidden rounded-md bg-gray-800/50 relative">
            <Image
              src={placeholderUrl} alt={altText} width={600} height={300}
              className="w-full h-full object-contain opacity-90"
              loading="lazy"
            />
          </div>
          <p className="text-xs text-center text-gray-400 mt-1 italic">{altText}</p>
        </div>
    );
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
    logger.log(`[ArbitrageExplainedPage] Language set to: ${langToSet}`);
  }, [tgUser?.language_code]);

  const t = useMemo(() => pageTranslations[currentLang] || pageTranslations['ru'], [currentLang]);

  const renderSection = (titleKey: string, contentKey: string | string[], icon?: string, listType: 'ul' | 'ol' = 'ul', contentClassName: string = "text-gray-300/90 leading-relaxed text-sm") => {
    const titleContent = t[titleKey] || titleKey; // Fallback to key if translation missing
    const mainContent = t[contentKey as string] || contentKey; // Fallback for single string content

    return (
      <div className="mb-6 p-3 md:p-4 bg-gray-800/50 border border-gray-700/30 rounded-lg shadow-md">
        <h3 className="text-lg md:text-xl font-semibold text-brand-cyan mb-2 flex items-center">
          {icon && <VibeContentRenderer content={`${icon} mr-2`} />}
          <VibeContentRenderer content={titleContent} />
        </h3>
        {typeof mainContent === 'string' ? (
          <VibeContentRenderer content={mainContent} className={contentClassName} />
        ) : (
          React.createElement(listType, { className: `list-${listType === 'ul' ? 'disc' : 'decimal'} list-outside pl-4 space-y-1 ${contentClassName}` }, 
            (mainContent as string[]).map((point, index) => ( 
              <li key={index} className="pl-1">
                  <VibeContentRenderer content={point} /> 
              </li>
              ))
          )
        )}
      </div>
    );
  };
  
  const renderComparisonTable = () => (
    <div className="overflow-x-auto simple-scrollbar my-6">
        <table className="min-w-full divide-y divide-gray-700 bg-gray-800/40 rounded-lg shadow-md">
            <thead className="bg-gray-700/60">
                <tr>
                    {(t.comparisonTableHeaders as string[]).map((header: string, index: number) => (
                        <th key={index} scope="col" className="px-3 py-2.5 text-left text-xs sm:text-sm font-orbitron font-medium text-brand-lime uppercase tracking-wider">{header}</th>
                    ))}
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/50">
                {(t.comparisonTableRows as string[][]).map((row: string[], rowIndex: number) => (
                    <tr key={rowIndex} className="hover:bg-gray-700/30 transition-colors">
                        {row.map((cell, cellIndex) => (
                            <td key={cellIndex} className={`px-3 py-2.5 text-xs sm:text-sm ${cellIndex === 0 ? 'font-semibold text-gray-100 w-1/5 md:w-1/6 lg:w-1/6' : 'text-gray-300'}`}>{cell}</td>
                        ))}
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
  );

  const errorCases = [
    { titleKey: "errorExample1Title", contentKey: "errorExample1Points"},
    { titleKey: "errorExample2Title", contentKey: "errorExample2Points"},
    { titleKey: "errorExample3Title", contentKey: "errorExample3Points"},
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-blue-950 text-gray-200 p-4 pt-24 pb-12 font-mono">
      <Card className="max-w-4xl mx-auto bg-black/70 backdrop-blur-md border-2 border-brand-blue/50 shadow-2xl shadow-brand-blue/30">
        <CardHeader className="text-center border-b border-brand-blue/30 pb-6">
          <VibeContentRenderer content={t.pageTitle} className="text-3xl md:text-4xl font-bold text-brand-blue cyber-text glitch"/>
          <CardDescription className="mt-2 text-sm md:text-base text-blue-300">
            <VibeContentRenderer content={t.pageSubtitle} />
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 md:p-6 ">
          <Tabs defaultValue="basics" className="w-full">
            <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-1 bg-black/50 p-1 h-auto mb-6">
              <TabsTrigger value="basics" className="text-xs px-1 py-1.5 sm:py-2 data-[state=active]:bg-brand-blue/80 data-[state=active]:text-white dark:data-[state=inactive]:text-gray-400 data-[state=inactive]:text-gray-500 hover:data-[state=inactive]:text-gray-700 dark:hover:data-[state=inactive]:text-gray-200 font-orbitron"><VibeContentRenderer content={t.basicsIcon} className="mr-1.5"/>{t.tabBasics}</TabsTrigger>
              <TabsTrigger value="monitoring" className="text-xs px-1 py-1.5 sm:py-2 data-[state=active]:bg-brand-blue/80 data-[state=active]:text-white dark:data-[state=inactive]:text-gray-400 data-[state=inactive]:text-gray-500 hover:data-[state=inactive]:text-gray-700 dark:hover:data-[state=inactive]:text-gray-200 font-orbitron"><VibeContentRenderer content={t.monitoringIcon} className="mr-1.5"/>{t.tabMonitoring}</TabsTrigger>
              <TabsTrigger value="settings_errors" className="text-xs px-1 py-1.5 sm:py-2 data-[state=active]:bg-brand-blue/80 data-[state=active]:text-white dark:data-[state=inactive]:text-gray-400 data-[state=inactive]:text-gray-500 hover:data-[state=inactive]:text-gray-700 dark:hover:data-[state=inactive]:text-gray-200 font-orbitron"><VibeContentRenderer content={t.settingsErrorsIcon} className="mr-1.5"/>{t.tabSettingsErrors}</TabsTrigger>
              <TabsTrigger value="bundle_structure" className="text-xs px-1 py-1.5 sm:py-2 data-[state=active]:bg-brand-blue/80 data-[state=active]:text-white dark:data-[state=inactive]:text-gray-400 data-[state=inactive]:text-gray-500 hover:data-[state=inactive]:text-gray-700 dark:hover:data-[state=inactive]:text-gray-200 font-orbitron"><VibeContentRenderer content={t.bundleStructureIcon} className="mr-1.5"/>{t.tabBundleStructure}</TabsTrigger>
              <TabsTrigger value="checklist" className="text-xs px-1 py-1.5 sm:py-2 data-[state=active]:bg-brand-blue/80 data-[state=active]:text-white dark:data-[state=inactive]:text-gray-400 data-[state=inactive]:text-gray-500 hover:data-[state=inactive]:text-gray-700 dark:hover:data-[state=inactive]:text-gray-200 font-orbitron"><VibeContentRenderer content={t.checklistIcon} className="mr-1.5"/>{t.tabChecklist}</TabsTrigger>
            </TabsList>

            <TabsContent value="basics" className="space-y-6">
              {renderSection("realTimeSectionTitle", "realTimeSectionContent", "::FaBolt::")}
              {renderSection("whySpeedMattersTitle", "whySpeedMattersContent", "::FaShippingFast::", "ul", "text-gray-300/90 leading-relaxed text-sm")}
              <ImagePlaceholder altTextKey={currentLang === 'ru' ? "altRealtimeFlowRu" : "altRealtimeFlowEn" } currentLang={currentLang} />
              {renderSection("publicVsPrivateTitle", "publicVsPrivateIntro", "::FaShieldHalved::")}
              {renderComparisonTable()}
              {renderSection("publicBotProblemsTitle", "publicBotProblems", "::FaLockOpen::", "ul", "text-red-400/90 leading-relaxed text-sm")}
              <VibeContentRenderer content={`**${t.ourBotGoal}**`} className="block mt-4 font-semibold text-brand-lime text-center" />
            </TabsContent>

            <TabsContent value="monitoring" className="space-y-6">
                <VibeContentRenderer content={t.monitoringIntro} className="mb-4 text-gray-300 text-sm" />
                {renderSection("monitoringChestTitle", "monitoringChestPoints", "::FaBoxOpen::")}
                <ImagePlaceholder altTextKey={currentLang === 'ru' ? "altChestMechanismRu" : "altChestMechanismEn"} currentLang={currentLang} />
                {renderSection("monitoringActionsTitle", "monitoringActionsPoints", "::FaHandPointer::")}
                {renderSection("monitoringWhyTitle", "monitoringWhyText", "::FaCircleQuestion::")}
                <VibeContentRenderer content={`**${t.monitoringSettingsImpact}**`} className="block mt-4 font-semibold text-brand-lime" />
                <VibeContentRenderer content={t.monitoringDuration} className="block mt-2 text-gray-400 italic" />
            </TabsContent>

            <TabsContent value="settings_errors" className="space-y-6">
                <VibeContentRenderer content={t.errorsIntro} className="mb-4 text-gray-300 text-sm" />
                <Accordion type="single" collapsible className="w-full space-y-2">
                    {errorCases.map((ec, index) => (
                        <AccordionItem value={`error-case-${index+1}`} key={`error-case-${index+1}`} className="border-brand-red/30 bg-gray-800/40 rounded-lg overflow-hidden">
                            <AccordionTrigger className="hover:no-underline text-md text-brand-red hover:text-red-400 py-2.5 px-4 data-[state=open]:bg-brand-red/10">
                                <VibeContentRenderer content={`::FaTriangleExclamation className='mr-2 text-base':: ${t.errorCaseAccordionTitle} ${index+1}: ${t[ec.titleKey]}`} />
                            </AccordionTrigger>
                            <AccordionContent className="pt-1 pb-3 px-4 text-sm bg-black/20">
                                <VibeContentRenderer 
                                  content={ (t[ec.contentKey] && Array.isArray(t[ec.contentKey])) 
                                            ? (t[ec.contentKey] as string[]).join('<br/><br/>') 
                                            : "Content not available or not an array."
                                          } 
                                  className="text-gray-300/90 leading-relaxed" />
                            </AccordionContent>
                        </AccordionItem>
                    ))}
                </Accordion>
                <ImagePlaceholder altTextKey={currentLang === 'ru' ? "altSettingsImpactRu" : "altSettingsImpactEn"} currentLang={currentLang} />
                {renderSection("errorsSolutionTitle", "errorsSolutionPoints", "::FaTools::")}
            </TabsContent>

            <TabsContent value="bundle_structure" className="space-y-6">
                {renderSection("botOverviewTitle", "botOverviewIntro", "::FaRobot::")}
                {renderSection("", "botKeyFeatures", undefined, "ul")}
                <div className="mt-6">
                    <h3 className="text-lg font-semibold text-brand-lime mb-2 flex items-center">
                        <VibeContentRenderer content="::FaBoxArchive::" className="mr-2"/>
                        <VibeContentRenderer content={t.whatInBundleTitle} />
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
            <Button asChild size="sm" className="bg-brand-blue hover:bg-blue-500 text-white font-semibold text-xs px-3 py-1.5">
              <Link href="https://bigbtc.store/instrukciya-po-ispolzovaniyu-telegam-bota-dlya-arbitrazha-mezhdu-birzhami" target="_blank" rel="noopener noreferrer">
                <VibeContentRenderer content="::FaArrowUpRightFromSquare className='mr-2'::" /> 
                <VibeContentRenderer content={t.externalInstructionsLink} />
              </Link>
            </Button>
          </div>
          
           <div className="mt-12 text-center">
             <Link href="/elon#arbitrage_seeker" className="block" scroll={false}>
                <Button variant="outline" className="border-brand-purple text-brand-purple hover:bg-brand-purple/10 hover:text-white">
                   <VibeContentRenderer content="::FaArrowLeft className='mr-2'::" /> <VibeContentRenderer content={t.backToSimulator} />
                </Button>
            </Link>
          </div>

        </CardContent>
      </Card>
    </div>
  );
}