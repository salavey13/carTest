"use client";

import React from 'react'; // Explicit import for older setups
import { FaLightbulb, FaUsers, FaGlasses, FaBolt, FaRobot, FaBrain, FaCode, FaTools, FaChartLine, FaHandshake, FaNetworkWired, FaFilm, FaGamepad } from 'react-icons/fa6';
import { FaMoneyBillWave, FaKey, FaRocket, FaBomb, FaUserAstronaut, FaSignature, FaMobile, FaEye, FaCarBurst, FaUpLong } from 'react-icons/fa6';


const GamePlanPage = () => {
  const pageTitle = "Supervibe Game Plan: Взломай Матрицу";
  const userName = "Павел"; // Можно будет сделать динамическим, если нужно

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
          type: "image_prompt_heading",
          text: "Промпт для Изображения (Акт I):"
        },
        {
          type: "image_prompt",
          prompt: "A lone figure in a dark, chaotic digital landscape of glitching code and tangled data streams, reaching towards a pair of sleek, glowing cybernetic glasses that emit a clear, focused beam of light, piercing through the noise. Cyberpunk aesthetic, neon blues and purples, dramatic lighting, sense of revelation. --ar 16:9 --style raw --v 6.0"
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
          type: "image_prompt_heading",
          text: "Промпт для Изображения (Акт II):"
        },
        {
          type: "image_prompt",
          prompt: "Dynamic scene of an individual in a high-tech workshop, surrounded by holographic blueprints and assisted by sleek AI robotic arms, constructing a personalized, glowing digital interface that forms around them like an Iron Man suit. Cyberpunk, vibrant energy, focused intensity, workshop clutter with advanced tech. --ar 16:9 --style raw --v 6.0"
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
          type: "image_prompt_heading",
          text: "Промпт для Изображения (Акт III):"
        },
        {
          type: "image_prompt",
          prompt: "Energetic scene of a charismatic figure orchestrating a 'VIBE trading floor,' digital screens showing rapidly validated ideas and launching projects as branching light trails that multiply exponentially. Upbeat, ethical high-tech finance, controlled chaos, network growth visualization, cyberpunk office. --ar 16:9 --style raw --v 6.0"
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
          type: "image_prompt_heading",
          text: "Промпт для Изображения (Акт IV):"
        },
        {
          type: "image_prompt",
          prompt: "A stunning wide shot of a glowing, interconnected global network. Diverse user avatars as nodes of light, linked by vibrant data streams, collaborating on a shared digital platform that pulses with creative energy. Sense of community, innovation, and global scale. Cosmic cyberpunk. --ar 16:9 --style raw --v 6.0"
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
          type: "image_prompt_heading",
          text: "Промпт для Изображения (Акт V):"
        },
        {
          type: "image_prompt",
          prompt: "A visionary figure, seen from behind or in profile, calmly overlooking a vast and intricate digital cityscape representing the Supervibe OS ecosystem. Clean lines, organized complexity, flowing data rivers, a sense of immense scale and future potential. Sophisticated cyberpunk, serene but powerful. --ar 16:9 --style raw --v 6.0"
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
                if (item.type === "image_prompt_heading") {
                  return <h4 key={itemIndex} className="text-lg font-semibold mt-6 mb-1 text-yellow-400" dangerouslySetInnerHTML={{ __html: item.text }} />;
                }
                if (item.type === "image_prompt") {
                  return (
                    <div key={itemIndex} className="bg-gray-800 p-3 rounded-md border border-gray-600 text-sm text-gray-400 italic">
                      <p className="font-courier">{item.prompt}</p>
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