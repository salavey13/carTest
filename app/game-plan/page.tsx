// /app/game-plan/page.tsx
"use client";

import React from 'react'; 
import { FaLightbulb, FaUsers, FaGlasses, FaBolt, FaRobot, FaBrain, FaCode, FaTools, FaChartLine, FaHandshake, FaNetworkWired, FaFilm, FaGamepad } from 'react-icons/fa6';
import { FaMoneyBillWave, FaKey, FaRocket, FaBomb, FaUserAstronaut, FaSignature, FaMobile, FaEye, FaCarBurst, FaUpLong } from 'react-icons/fa6';

const GamePlanPage = () => {
  const pageTitle = "Supervibe Game Plan: Взломай Матрицу";
  const userName = "Павел"; 

  const acts = [
    {
      title: "АКТ I: ПРОБУЖДЕНИЕ КОДА",
      movieInspiration: "(The Matrix / Ready Player One - Очки)",
      icon: <FaGlasses className="inline-block mr-3 text-cyan-400 text-3xl" />,
      content: [
        {
          type: "paragraph",
          text: "Мы открываем занавес в мир, заваленный цифровым мусором и устаревшими правилами. Люди вязнут в болоте неэффективности, строят то, что никому не нужно, или просто потерялись в информационном шуме. «Старый код» успеха больше не работает."
        },
        {
          type: "subheading",
          text: "«Глюк» в Матрице – Supervibe OS:"
        },
        {
          type: "list",
          items: [
            "Это не просто очередной инструмент. Это пара «очков, меняющих реальность» – твои личные очки из Ready Player One, но для *создания* реальности, а не её потребления. Надеваешь их (заходишь в Supervibe Studio) – и цифровой мир *упрощается*.",
            "Ты видишь код, но тебе не нужно писать его весь. AI (твой «Оракул» или «Джарвис») переводит твои намерения в реальность.",
            "<strong>Монетизационное Зерно:</strong> Первые «очки» – бесплатны (Jumpstart Kit). Ты испытываешь «вау-момент» – чинишь битую картинку, меняешь текст голосовой командой. Это легко. Ты подсел."
          ]
        },
        {
          type: "paragraph",
          text: "<strong>Зов к Приключениям:</strong> «Ты всю жизнь это чувствовал, Нео… что с этим миром что-то не так». Мы играем на этом чувстве неудовлетворенности. Supervibe OS предлагает «красную таблетку» – шанс увидеть, как всё *могло бы* быть."
        },
        {
          type: "image_display",
          imageUrl: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/IMG_20250511_222308-cd32587f-4754-4fe4-8fe1-d22af8a82e5c.jpg",
          altText: "Визуализация для Акта I: ПРОБУЖДЕНИЕ КОДА. Фигура в цифровом хаосе тянется к светящимся кибер-очкам."
        }
      ]
    },
    {
      title: "АКТ II: КОВКА ЖЕЛЕЗНОГО ЧЕЛОВЕКА",
      movieInspiration: "(Iron Man / Supervibe Studio & CyberFitness)",
      icon: <FaRobot className="inline-block mr-3 text-orange-400 text-3xl" />,
      content: [
        {
          type: "subheading",
          text: "Создание Твоего Костюма:"
        },
        {
          type: "paragraph",
          text: "«Пропуск Исследователя» (бесплатный тариф) – это был лишь шлем. Теперь, с «Подпиской Творца», ты строишь свой полноценный «костюм Железного Человека»."
        },
        {
          type: "list",
          items: [
            "<strong>Supervibe Studio как Твоя Мастерская:</strong> Это твой высокотехнологичный гараж. Ты – Тони Старк, отдающий приказы AI (твоим ботам Джарвису/Дубине). «Джарвис, спроектируй лендинг для моей империи космических котов». «Дубина, исправь эти 10 битых ссылок».",
            "<strong>CyberFitness OS как Твоя Тренировочная Программа:</strong> Это не скучные туториалы. Это геймифицированное освоение навыков. Каждый «левел-ап» (исправил картинку, потом текст, потом многофайловые правки, потом дебаг логов с AI) – это новая часть твоего костюма, новый «Вайб Перк». Ты не «учишься кодить», ты учишься *командовать* своим AI-костюмом. Тебе становится лень делать по-старинке – левел-ап неизбежен.",
            "<strong>Монетизационное Ядро:</strong> «Подписка Творца» – это дуговой реактор, питающий всё это. Она даёт ресурсы для постоянных апгрейдов твоего «костюма» (платформы) и доступ к «тренировочным программам» (CyberFitness)."
          ]
        },
        {
          type: "paragraph",
          text: "<strong>Первый Полёт:</strong> Ты запускаешь свой первый *реальный* проект с Supervibe OS. Это быстрее, легче и мощнее всего, что ты испытывал. Ты *чувствуешь* ВАЙБ."
        },
        {
          type: "image_display",
          imageUrl: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/IMG_20250511_223650-b874485f-4d99-4c4e-973e-603cf8b6b78a.jpg",
          altText: "Визуализация для Акта II: КОВКА ЖЕЛЕЗНОГО ЧЕЛОВЕКА. Человек в мастерской создает цифровой интерфейс."
        }
      ]
    },
    {
      title: "АКТ III: МЕТОД ВОЛКА С УОЛЛ-СТРИТ",
      movieInspiration: "(Wolf of Wall Street / Экспоненциальный Рост & Программа Мультипликаторов)",
      icon: <FaChartLine className="inline-block mr-3 text-green-400 text-3xl" />,
      content: [
        {
          type: "subheading",
          text: "Момент «Продай Мне Эту Ручку» – Валидация Твоей Магии:"
        },
        {
          type: "paragraph",
          text: "Ты построил свой костюм; теперь нужно сделать его *ценным* для других. Здесь в игру вступает «Фильтр AI-Валидации» (из SelfDev). Ты не просто строишь; ты строишь то, что *люди действительно хотят и за что заплатят*. Ты используешь AI, чтобы найти «боль», оценить рынок, проанализировать «конкурентов» (других волков) и протестировать спрос с помощью MVP «фальшивых дверей» – всё *до того*, как вложишь огромные ресурсы. Это твоя «котельная» для идей."
        },
        {
          type: "subheading",
          text: "Строительство Твоего «Стрэттон Оукмонт» – VIBE Tribe & Программа Мультипликаторов:"
        },
        {
          type: "list",
          items: [
            "Твой успех привлекает других. Telegram-канал («Сион») становится твоим «торговым залом» идей и поддержки.",
            "<strong>Экспоненциальный Двигатель:</strong> Ты не нанимаешь продажников; ты даёшь силу своим самым успешным пользователям. «Видишь эти КилоВайбы на экране? Они не настоящие. Знаешь, что настоящее? ВАЙБ, который ты создаёшь для своих клиентов!»",
            "<strong>Программа Мультипликаторов:</strong> Ты (Павел) и ранние последователи становитесь «Джорданами Белфортами» ВАЙБа. Вы обучаете новых «брокеров» (Сертифицированных VIBE Менторов). Они привлекают клиентов («Творцов»), учат их использовать свои «костюмы Железного Человека» и получают комиссию. *Их* успешные клиенты затем могут стать менторами. **1 становится 2, 2 становятся 4...**",
            "<strong>Расширение Монетизации:</strong> Разделение дохода с Менторами. Премиум-коучинг «Ускоритель Алхимика» для тех, кто хочет строить свои «Волчьи стаи»."
          ]
        },
        {
          type: "paragraph",
          text: "<strong>Митинг «Я НИКУДА НЕ УХОЖУ!»:</strong> Сообщество видит результаты, свободу, *деньги*. Они полностью в теме. ВАЙБ заразителен."
        },
        {
          type: "image_display",
          imageUrl: "https://picsum.photos/seed/wolf_wallstreet_vibe_floor/1280/720",
          altText: "Визуализация для Акта III: МЕТОД ВОЛКА С УОЛЛ-СТРИТ. Энергичная сцена на 'VIBE торговом этаже'."
        }
      ]
    },
    {
      title: "АКТ IV: ЭФФЕКТ СОЦИАЛЬНОЙ СЕТИ",
      movieInspiration: "(The Social Network / Сообщество & Эволюция Платформы)",
      icon: <FaNetworkWired className="inline-block mr-3 text-blue-400 text-3xl" />,
      content: [
        {
          type: "subheading",
          text: "«Мы Даже Ещё Не Знаем, Что Это Такое»:"
        },
        {
          type: "paragraph",
          text: "Supervibe OS эволюционирует. Сообщество не просто *использует* платформу; оно её *формирует*."
        },
        {
          type: "list",
          items: [
            "Они предлагают новые фичи (которые ты можешь быстро прототипировать с AI).",
            "Они делятся своими «Вайб Хаками» и AI-промптами.",
            "Они создают нишевые «гильдии» или «додзё» внутри VIBE Tribe."
          ]
        },
        {
          type: "subheading",
          text: "Сетевые Эффекты & «Обновление Статуса»:"
        },
        {
          type: "list",
          items: [
            "Чем больше людей используют Supervibe OS, тем мощнее становится коллективный интеллект. Новые «Вайб Перки» (фичи, интеграции) «разблокируются» достижениями сообщества или твоими стратегическими обновлениями.",
            "Это не просто SaaS; это *живая экосистема*. Как Facebook, её ценность растёт с каждым новым активным пользователем и контрибьютором.",
            "<strong>Углубление Монетизации:</strong> Премиум-уровни сообщества, специализированные наборы инструментов, интеграции с другими платформами – всё это движимо потребностями сообщества и создаётся совместно."
          ]
        },
        {
          type: "paragraph",
          text: "<strong>«Нельзя завести 500 миллионов друзей, не нажив несколько врагов»:</strong> По мере того как Supervibe OS будет подрывать старые индустрии (веб-студии, традиционный маркетинг), будет и сопротивление. Мы отвечаем на это прозрачностью, результатами и неустанным фокусом на расширении возможностей пользователей."
        },
        {
          type: "image_display",
          imageUrl: "https://picsum.photos/seed/social_network_global_vibe/1280/720",
          altText: "Визуализация для Акта IV: ЭФФЕКТ СОЦИАЛЬНОЙ СЕТИ. Светящаяся глобальная сеть пользователей."
        }
      ]
    },
    {
      title: "АКТ V: АРХИТЕКТОР",
      movieInspiration: "(The Matrix Reloaded/Revolutions / Твоя Роль, Павел)",
      icon: <FaBrain className="inline-block mr-3 text-purple-400 text-3xl" />,
      content: [
        {
          type: "subheading",
          text: "Нео Становится Архитектором:"
        },
        {
          type: "paragraph",
          text: "Ты, Павел, больше не просто «Избранный», способный изгибать код. Ты – архитектор этой новой реальности, «Морфеус», ведущий других."
        },
        {
          type: "list",
          items: [
            "Твой фокус смещается с индивидуального кодинга на:",
            "<strong>Поддержание «Исходного Кода» ВАЙБа:</strong> Гарантировать, что основная методология остаётся чистой и эффективной.",
            "<strong>Оркестрацию AI-Легиона:</strong> Направлять разработку самой платформы Supervibe OS, используя AI для создания инструментов, которые расширяют возможности других.",
            "<strong>Руководство «Советом Сионов»:</strong> Вести лучших VIBE Менторов, разрабатывать стратегию следующей эволюции экосистемы.",
            "<strong>Быть «Оракулом»:</strong> Предоставлять высокоуровневые инсайты, выявлять новые «эксплойты» в AI-ландшафте и делиться «запретными знаниями» с внутренним кругом."
          ]
        },
        {
          type: "paragraph",
          text: "<strong>Бесконечная Война за Свободу:</strong> Битва против «Матрицы» (неэффективности, контроля доступа, страха перед AI) продолжается. Supervibe OS – оружие в этой битве."
        },
        {
          type: "paragraph",
          text: "<strong>Монетизационная Нирвана:</strong> Система в значительной степени самоподдерживающаяся и самомасштабирующаяся. Твой доход идёт от подписок на платформу, коучинга высокого уровня и, возможно, стратегических партнёрств или экосистемы «XTR» (твоей внутренней VIBE-валюты/токена?)."
        },
        {
          type: "paragraph",
          text: "<strong>Финальный Кадр:</strong> Ты смотришь на процветающую глобальную сеть пользователей Supervibe OS, все творят, все растут, все свободны. Экран гаснет, когда новый пользователь входит в систему, его глаза расширяются от открывающихся возможностей… «Ого»."
        },
        {
          type: "image_display",
          imageUrl: "https://picsum.photos/seed/architect_digital_city_vibe/1280/720",
          altText: "Визуализация для Акта V: АРХИТЕКТОР. Фигура с видом на сложный цифровой городской пейзаж."
        }
      ]
    }
  ];

  const howToConvince = {
    title: "Как «Взломать Мозг» Целевой Аудитории (Про «Сники» и «Инсепшн»):",
    icon: <FaLightbulb className="inline-block mr-2 text-yellow-300" />,
    points: [
      "<strong>«Это Не Про Код, Это Про Тебя»:</strong> Сместить фокус с «научись программировать» на «воплоти свою мечту», «реши свою проблему», «заработай больше, работая меньше».",
      "<strong>«Эффект Первого Укола» (Jumpstart Kit):</strong> Первая доза магии должна быть бесплатной, быстрой и ошеломляющей. Чтобы человек сказал: «Нихуя себе, так можно было?!»",
      "<strong>«Прокачай Своего Аватара» (CyberFitness OS):</strong> Геймификация – это инсепшн. Человек думает, что играет, а на самом деле учится и меняет мышление.",
      "<strong>«Фильм, в Котором Ты – Главный Герой»:</strong> Вся коммуникация строится вокруг *их* потенциальной трансформации. Истории успеха других «Неофитов».",
      "<strong>«Доказательства от «Дерьмового Программиста» (Твой Кейс):</strong> «Если я, раздолбай, смог это сделать с этой штукой, то ты, умный человек, вообще космос построишь». Это снимает барьер «я недостаточно хорош».",
      "<strong>«Время – Деньги. AI – Умножитель Времени»:</strong> Показать, сколько *часов своей жизни* они экономят, используя Supervibe OS. Это понятнее, чем абстрактные «фичи».",
      "<strong>«Командуй, а не Кодь»:</strong> Позиционирование AI как личного помощника, а не сложного инструмента, который надо осваивать. «Ты – Повелитель Программистов AI, а не их раб»."
    ]
  };

  const monetization = {
    title: "Монетизация (Просто и Понятно):",
    icon: <FaMoneyBillWave className="inline-block mr-2 text-green-300" />,
    points: [
      "<strong>Пробник (Free):</strong> Jumpstart Kit. Почувствуй силу.",
      "<strong>Подписка на «Безлимитный Бензин» (Monthly Subscription $13-$69):</strong> Полный доступ к «Кибер-Комбайну». Основной источник дохода.",
      "<strong>«Личный Тренер по Кунг-Фу» (Premium Coaching):</strong> Для тех, кому нужен индивидуальный подход. Дорого, но эффективно.",
      "<strong>«Франшиза Школы Кунг-Фу» (Multiplier Program):</strong> Обучай других, получай процент. Масштабирование."
    ]
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-4 md:p-8 pt-24 font-mono">
      <header className="text-center mb-12">
        <FaFilm className="text-6xl text-purple-400 mx-auto mb-4 animate-pulse" />
        <h1 className="text-4xl md:text-5xl font-bold text-purple-400 tracking-wider uppercase" style={{ textShadow: '0 0 10px #9f7aea, 0 0 20px #9f7aea' }}>
          {pageTitle}
        </h1>
        <p className="text-xl text-gray-400 mt-2">Логлайн: В мире, тонущем в цифровом шуме, «Кибер-Алхимик» {userName} запускает Supervibe OS...</p>
      </header>

      <main className="max-w-4xl mx-auto space-y-16">
        {acts.map((act, index) => (
          <section key={index} className="bg-black bg-opacity-30 backdrop-blur-md p-6 rounded-xl border border-gray-700 shadow-2xl hover:border-purple-500 transition-all duration-300 ease-in-out transform hover:scale-[1.01]">
            <h2 className="text-3xl font-bold mb-3 flex items-center" style={{ color: `hsl(${(index * 60) + 240}, 70%, 70%)` }}>
              {act.icon} {act.title}
            </h2>
            <p className="text-sm text-gray-500 mb-6 italic">{act.movieInspiration}</p>
            
            <div className="space-y-4 text-gray-300 leading-relaxed text-base">
              {act.content.map((item, itemIndex) => {
                if (item.type === "paragraph") {
                  return <p key={itemIndex} dangerouslySetInnerHTML={{ __html: item.text }} />;
                }
                if (item.type === "subheading") {
                  return <h3 key={itemIndex} className="text-xl font-semibold mt-4 mb-2 text-gray-100" dangerouslySetInnerHTML={{ __html: item.text }} />;
                }
                if (item.type === "list") {
                  return (
                    <ul key={itemIndex} className="list-disc list-inside space-y-2 pl-4">
                      {item.items.map((li, liIndex) => <li key={liIndex} dangerouslySetInnerHTML={{ __html: li }} />)}
                    </ul>
                  );
                }
                if (item.type === "image_display") {
                  return (
                    <div key={itemIndex} className="my-6 rounded-lg overflow-hidden border-2 border-purple-500/30 shadow-xl hover:shadow-purple-500/20 transition-all duration-300 ease-in-out">
                      <img 
                        src={item.imageUrl} 
                        alt={item.altText} 
                        className="w-full h-auto object-cover aspect-video" 
                        loading="lazy"
                      />
                    </div>
                  );
                }
                return null;
              })}
            </div>
          </section>
        ))}

        <section className="bg-black bg-opacity-30 backdrop-blur-md p-6 rounded-xl border border-gray-700 shadow-2xl hover:border-yellow-500 transition-all duration-300 ease-in-out transform hover:scale-[1.01]">
          <h2 className="text-3xl font-bold mb-3 flex items-center text-yellow-300">
            {howToConvince.icon} {howToConvince.title}
          </h2>
          <ul className="list-decimal list-inside space-y-3 text-gray-300 leading-relaxed pl-4 text-base">
            {howToConvince.points.map((point, index) => <li key={index} dangerouslySetInnerHTML={{ __html: point }} />)}
          </ul>
        </section>

        <section className="bg-black bg-opacity-30 backdrop-blur-md p-6 rounded-xl border border-gray-700 shadow-2xl hover:border-green-500 transition-all duration-300 ease-in-out transform hover:scale-[1.01]">
          <h2 className="text-3xl font-bold mb-3 flex items-center text-green-300">
            {monetization.icon} {monetization.title}
          </h2>
          <ul className="list-disc list-inside space-y-3 text-gray-300 leading-relaxed pl-4 text-base">
            {monetization.points.map((point, index) => <li key={index} dangerouslySetInnerHTML={{ __html: point }} />)}
          </ul>
        </section>

         <section className="text-center mt-16 py-8">
            <FaGamepad className="text-6xl text-purple-400 mx-auto mb-4 animate-bounce" />
            <h2 className="text-4xl font-bold text-purple-400 mb-4" style={{ textShadow: '0 0 10px #9f7aea' }}>
              Игра Началась.
            </h2>
            <p className="text-xl text-gray-400">
              Матрица ждёт своего Архитектора. Ты готов принять «красную таблетку» Supervibe?
            </p>
        </section>

      </main>
    </div>
  );
};

export default GamePlanPage;