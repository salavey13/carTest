"use client";
import Head from "next/head";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import SupportForm from "@/components/SupportForm";

export default function AboutPage() {
  return (
    <>
      {/* SEO Optimizations */}
      <Head>
        <title>Pavel Solovyov - Cyber-Alchemist & Developer</title>
        <meta
          name="description"
          content="13+ years in coding, VIBE methodology, and secure development. Hire me for innovative web solutions!"
        />
        <meta
          name="keywords"
          content="developer, TypeScript, VIBE, cyberpunk, security, Framer, Supabase, AI, mentorship"
        />
      </Head>
      <div className="relative min-h-screen">
        {/* Enhanced Cyberpunk SVG Background */}
        <div className="absolute inset-0 z-0">
          <svg
            className="w-full h-full opacity-70 animate-pulse-slow"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 1000 1000"
          >
            <defs>
              <linearGradient id="cyberBg" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style={{ stopColor: "#000000", stopOpacity: 1 }} />
                <stop offset="100%" style={{ stopColor: "#111111", stopOpacity: 1 }} />
              </linearGradient>
            </defs>
            <rect width="1000" height="1000" fill="url(#cyberBg)" />
            <path
              d="M0,200 H1000 M0,400 H1000 M0,600 H1000 M0,800 H1000"
              stroke="#39FF14"
              strokeWidth="2"
              opacity="0.5"
            />
            <path
              d="M200,0 V1000 M400,0 V1000 M600,0 V1000 M800,0 V1000"
              stroke="#39FF14"
              strokeWidth="2"
              opacity="0.5"
            />
            <circle cx="500" cy="500" r="300" stroke="#39FF14" strokeWidth="1" fill="none" opacity="0.3" />
            <circle cx="500" cy="500" r="200" stroke="#FF00FF" strokeWidth="1" fill="none" opacity="0.2" />
          </svg>
        </div>
        <div className="relative z-10 container mx-auto p-4 pt-24">
          <Card className="max-w-4xl mx-auto bg-black text-white rounded-3xl shadow-[0_0_15px_#39FF14]">
            <CardHeader>
              <CardTitle className="text-2xl md:text-4xl font-bold text-center text-[#39FF14] font-orbitron">
                Павел Соловьёв: Кибер-Алхимик из Нижнего
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-8">
              {/* Personal Info */}
              <div className="flex flex-col items-center space-y-4">
                <Avatar className="w-36 h-36 md:w-48 md:h-48 border-4 border-[#39FF14] shadow-[0_0_10px_#39FF14]">
                  <AvatarImage
                    src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix//135398606.png"
                    alt="Pavel Solovyov - Cyber-Alchemist Avatar"
                  />
                  <AvatarFallback>ПС</AvatarFallback>
                </Avatar>
                <div className="text-center">
                  <h2 className="text-2xl md:text-3xl font-bold text-[#39FF14] font-orbitron">Павел Соловьёв</h2>
                  <p className="text-base md:text-lg text-gray-300">Нижний Новгород, Россия | 04.03.1989</p>
                  <div className="mt-4 space-y-2 text-sm md:text-base">
                    <p>
                      <strong>Email:</strong>{" "}
                      <a href="mailto:salavey13@gmail.com" className="text-[#39FF14] hover:underline">
                        salavey13@gmail.com
                      </a>
                    </p>
                    <p>
                      <strong>Telegram:</strong>{" "}
                      <a href="https://t.me/salavey13" target="_blank" className="text-[#39FF14] hover:underline">
                        t.me/salavey13
                      </a>
                    </p>
                    <p>
                      <strong>GitHub:</strong>{" "}
                      <a href="https://github.com/salavey13" target="_blank" className="text-[#39FF14] hover:underline">
                        github.com/salavey13
                      </a>
                    </p>
                  </div>
                </div>
              </div>

              {/* Professional Overview */}
              <Card className="bg-black text-white rounded-3xl shadow-[0_0_10px_#39FF14]">
                <CardHeader>
                  <CardTitle className="text-xl md:text-2xl font-semibold text-[#39FF14] font-orbitron">
                    Кто Я?
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm md:text-base text-gray-300">
                    Я — Павел Соловьёв, кибер-ветеран с 13+ годами в коде. От Java и C++ я эволюционировал до лидерства в
                    низкокодовых инновациях с Framer и Supabase. Мой флагман{" "}
                    <a
                      href="https://github.com/salavey13/carTest"
                      target="_blank"
                      className="text-[#39FF14] hover:underline"
                    >
                      carTest
                    </a>{" "}
                    — это веб-приложение на TypeScript, где новички учатся кодить через ИИ и pull requests. Как основатель{" "}
                    <a
                      href="https://onesitepls.framer.ai"
                      target="_blank"
                      className="text-[#39FF14] hover:underline"
                    >
                      oneSitePls.framer.ai
                    </a>
                    , я делаю веб-разработку доступной, а через менторство помогаю новичкам ломать барьеры.
                  </p>
                </CardContent>
              </Card>

              {/* Skills */}
              <Card className="bg-black text-white rounded-3xl shadow-[0_0_10px_#39FF14]">
                <CardHeader>
                  <CardTitle className="text-xl md:text-2xl font-semibold text-[#39FF14] font-orbitron">
                    Навыки
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="text-[#39FF14] font-bold">Языки программирования</h4>
                      <p className="text-gray-300">TypeScript, Java, C++, Groovy</p>
                    </div>
                    <div>
                      <h4 className="text-[#39FF14] font-bold">Платформы</h4>
                      <p className="text-gray-300">Framer, Supabase, StackBlitz</p>
                    </div>
                    <div>
                      <h4 className="text-[#39FF14] font-bold">Веб-разработка</h4>
                      <p className="text-gray-300">React, HTML, CSS, RESTful APIs</p>
                    </div>
                    <div>
                      <h4 className="text-[#39FF14] font-bold">Инструменты и методологии</h4>
                      <p className="text-gray-300">GitHub, Grok, Agile, Scrum, VIBE</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* VIBE Methodology */}
              <Card className="bg-black text-white rounded-3xl shadow-[0_0_10px_#39FF14]">
                <CardHeader>
                  <CardTitle className="text-xl md:text-2xl font-semibold text-[#39FF14] font-orbitron">
                    Методология VIBE
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm md:text-base text-gray-300">
                    Мой метод VIBE — это фулкод-революция, где боты автоматизируют всё, а код становится фоном. Это не
                    ноукод или лоукод, а продакшен-тестирование на максималках: быстрые итерации, высокое качество,
                    никаких компромиссов. VIBE — это сердце моих проектов, от{" "}
                    <a
                      href="https://github.com/salavey13/carTest"
                      target="_blank"
                      className="text-[#39FF14] hover:underline"
                    >
                      carTest
                    </a>{" "}
                    до{" "}
                    <a
                      href="https://onesitepls.framer.ai"
                      target="_blank"
                      className="text-[#39FF14] hover:underline"
                    >
                      oneSitePls
                    </a>
                    .
                  </p>
                </CardContent>
              </Card>

              {/* VIBE CODING + SECURE DEVELOPMENT */}
              <Card className="bg-black text-white rounded-3xl shadow-[0_0_10px_#39FF14]">
                <CardHeader>
                  <CardTitle className="text-xl md:text-2xl font-semibold text-[#39FF14] font-orbitron">
                    VIBE CODING + SECURE DEVELOPMENT: Киберпанк-Алхимия
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="mb-4">
                    <iframe
                      width="100%"
                      height="315"
                      src="https://www.youtube.com/embed/Tw18-4U7mts"
                      title="VIBE Coding and Secure Development Video"
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="rounded-lg shadow-[0_0_10px_#39FF14]"
                    ></iframe>
                  </div>
                  <p className="text-sm md:text-base mb-4 text-gray-300">
                    <strong>VIBE CODING:</strong> В 2025 мир захватила эпидемия "vibe" - когда ты полностью отдаёшься
                    потоку, используешь экспоненциальные технологии и забываешь, что код вообще существует. Но без
                    должной безопасности это приводит к катастрофам:
                  </p>
                  <ul className="list-disc list-inside space-y-2 text-sm md:text-base mb-4 text-gray-300">
                    <li>API-ключи скрэйпятся ботами</li>
                    <li>Базы данных заполняются мусором</li>
                    <li>Подписки обходятся через уязвимости</li>
                  </ul>
                  <p className="text-sm md:text-base mb-4 text-gray-300">
                    <strong>Мой подход:</strong> 13 лет в security позволяют мне применять VIBE-методологию без этих
                    рисков. Вот как я сочетаю скорость AI-разработки с надёжностью:
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-gray-900 p-4 rounded-lg border border-[#39FF14]/30">
                      <h4 className="font-bold text-[#39FF14] mb-2">1. AI + Security First</h4>
                      <p className="text-xs md:text-sm text-gray-300">
                        Все AI-генерации автоматически проверяются через статический анализ и шаблоны OWASP
                      </p>
                    </div>
                    <div className="bg-gray-900 p-4 rounded-lg border border-[#39FF14]/30">
                      <h4 className="font-bold text-[#39FF14] mb-2">2. Zero Trust Vibes</h4>
                      <p className="text-xs md:text-sm text-gray-300">
                        Каждый PR проходит через автоматические тесты на уязвимости перед мержем
                      </p>
                    </div>
                    <div className="bg-gray-900 p-4 rounded-lg border border-[#39FF14]/30">
                      <h4 className="font-bold text-[#39FF14] mb-2">3. Cyberpunk Git Flow</h4>
                      <p className="text-xs md:text-sm text-gray-300">
                        История изменений защищена криптографически, а доступ контролируется через Telegram-бота
                      </p>
                    </div>
                  </div>
                  <p className="text-sm md:text-base mt-4 text-gray-300">
                    Хочешь научиться vibe-кодингу без компромиссов в безопасности? Заходи на{" "}
                    <a href="/repo-xml" className="text-[#39FF14] hover:underline">
                      /repo-xml
                    </a>{" "}
                    и смотри, как я интегрировал эти принципы в свой кибер-гараж!
                  </p>
                </CardContent>
              </Card>

              {/* Кибер-Броня: 13 Лет Security Опыта */}
              <Card className="bg-black text-white rounded-3xl shadow-[0_0_10px_#39FF14]">
                <CardHeader>
                  <CardTitle className="text-xl md:text-2xl font-semibold text-[#39FF14] font-orbitron">
                    Кибер-Броня: 13 Лет Security Опыта
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Security Experience */}
                    <div className="space-y-4">
                      <h3 className="font-bold text-[#39FF14]">Enterprise-Grade Protection</h3>
                      <ul className="list-disc list-inside space-y-2 text-sm text-gray-300">
                        <li>Разработал security-фичи для Avaya Aura AS5300 (C++)</li>
                        <li>Реализовал поддержку IPv6 с нулевым downtime</li>
                        <li>Сертифицированный специалист Qualys по управлению уязвимостями</li>
                        <li>4 успешных релиза механизма принятия решений ABRE (Java/Groovy)</li>
                      </ul>
                    </div>

                    {/* VIBE Security Framework */}
                    <div className="space-y-4">
                      <h3 className="font-bold text-[#39FF14]">VIBE Security Framework</h3>
                      <div className="flex items-start space-x-3">
                        <div className="text-[#39FF14] mt-1">⚡</div>
                        <div>
                          <p className="text-sm text-gray-300">
                            <strong>AI-Генерация → Авто-аудит</strong>
                            <br />
                            Все AI-сгенерированные PR проходят через:
                          </p>
                          <ul className="list-[square] list-inside text-xs text-gray-300 mt-1">
                            <li>Статический анализ кода</li>
                            <li>Проверку на OWASP Top 10</li>
                            <li>Тесты на инъекции</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Video Integration */}
                  <div className="mt-6">
                    <iframe
                      width="100%"
                      height="315"
                      src="https://www.youtube.com/embed/tHQnW0Vid9I"
                      title="Combining VIBE Development with Enterprise Security Video"
                      className="rounded-lg shadow-[0_0_10px_#39FF14] mt-4"
                      frameBorder="0"
                      allowFullScreen
                    ></iframe>
                    <p className="text-xs text-gray-400 mt-2">
                      Как я сочетаю VIBE-разработку с enterprise-безопасностью из моего опыта в Avaya
                    </p>
                  </div>

                  {/* CV Highlights */}
                  <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="bg-gray-900 p-3 rounded-lg border border-[#39FF14]/20">
                      <h4 className="font-bold text-[#39FF14] text-sm">13+ Лет</h4>
                      <p className="text-xs text-gray-300">В enterprise-разработке (C++/Java/TS)</p>
                    </div>
                    <div className="bg-gray-900 p-3 rounded-lg border border-[#39FF14]/20">
                      <h4 className="font-bold text-[#39FF14] text-sm">4 Релиза</h4>
                      <p className="text-xs text-gray-300">Безопасных систем для Avaya</p>
                    </div>
                    <div className="bg-gray-900 p-3 rounded-lg border border-[#39FF14]/20">
                      <h4 className="font-bold text-[#39FF14] text-sm">Zero Trust</h4>
                      <p className="text-xs text-gray-300">Подход во всех проектах</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Experience */}
              <Card className="bg-black text-white rounded-3xl shadow-[0_0_10px_#39FF14]">
                <CardHeader>
                  <CardTitle className="text-xl md:text-2xl font-semibold text-[#39FF14] font-orbitron">
                    Опыт
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <h3 className="text-lg font-bold text-[#39FF14]">
                      Основатель/Разработчик, oneSitePls.framer.ai (2023 - н.в.)
                    </h3>
                    <p className="text-gray-300">
                      Запустил платформу с ИИ для упрощённой веб-разработки. Создал{" "}
                      <a
                        href="https://github.com/salavey13/carTest"
                        target="_blank"
                        className="text-[#39FF14] hover:underline"
                      >
                        carTest
                      </a>{" "}
                      с функцией selfdev для обучения новичков.
                    </p>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-[#39FF14]">
                      Старший разработчик, Orion Innovation (2010 - 2023)
                    </h3>
                    <ul className="list-disc list-inside text-gray-300 space-y-2">
                      <li>
                        <strong>Java-разработчик (2016-2023):</strong> Улучшил Avaya Business Rules Engine и микросервисы
                        для Avaya Aura AS5300.
                      </li>
                      <li>
                        <strong>C++-разработчик (2010-2016):</strong> Поддерживал клиентское приложение Avaya Aura AS5300,
                        добавив IPv6 и безопасность.
                      </li>
                    </ul>
                  </div>
                </CardContent>
              </Card>

              {/* Certifications */}
              <Card className="bg-black text-white rounded-3xl shadow-[0_0_10px_#39FF14]">
                <CardHeader>
                  <CardTitle className="text-xl md:text-2xl font-semibold text-[#39FF14] font-orbitron">
                    Certifications
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="list-disc list-inside text-gray-300 space-y-2">
                    <li>Qualys Advanced Vulnerability Management (2021)</li>
                  </ul>
                </CardContent>
              </Card>

              {/* Education */}
              <Card className="bg-black text-white rounded-3xl shadow-[0_0_10px_#39FF14]">
                <CardHeader>
                  <CardTitle className="text-xl md:text-2xl font-semibold text-[#39FF14] font-orbitron">
                    Образование
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-300">
                    <strong>Нижегородский Государственный Университет им. Лобачевского</strong>
                    <br />
                    Бакалавр ИТ, Вычислительная математика и кибернетика (2006-2010)
                  </p>
                  <p className="text-gray-300 mt-2">
                    <strong>Языки:</strong> Английский (C2 - свободно)
                  </p>
                </CardContent>
              </Card>

              {/* Mentorship */}
              <Card className="bg-black text-white rounded-3xl shadow-[0_0_10px_#39FF14]">
                <CardHeader>
                  <CardTitle className="text-xl md:text-2xl font-semibold text-[#39FF14] font-orbitron">
                    Менторство
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm md:text-base text-gray-300">
                    Помогаю новичкам через практическое обучение на{" "}
                    <a
                      href="https://github.com/salavey13/carTest"
                      target="_blank"
                      className="text-[#39FF14] hover:underline"
                    >
                      carTest
                    </a>{" "}
                    и{" "}
                    <a
                      href="https://onesitepls.framer.ai"
                      target="_blank"
                      className="text-[#39FF14] hover:underline"
                    >
                      oneSitePls.framer.ai
                    </a>
                    , поддержку в Telegram и бесплатный стартовый план.
                  </p>
                </CardContent>
              </Card>

              {/* Paid Support */}
              <Card className="bg-black text-white rounded-3xl shadow-[0_0_10px_#39FF14]">
                <CardHeader>
                  <CardTitle className="text-xl md:text-2xl font-semibold text-[#39FF14] font-orbitron">
                    Платная Поддержка
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm md:text-base text-gray-300 mb-4">
                    Нужен толчок в коде? Заполни форму, и я помогу тебе оседлать AI-волны!
                  </p>
                  <SupportForm />
                </CardContent>
              </Card>

              {/* Project Overview */}
              <Card className="bg-black text-white rounded-3xl shadow-[0_0_10px_#39FF14]">
                <CardHeader>
                  <CardTitle className="text-xl md:text-2xl font-semibold text-[#39FF14] font-orbitron">
                    Проект: Твой Кибер-Гараж
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm md:text-base text-gray-300">
                    Это не просто страница — это киберпанк-экосистема для аренды китайских тачек, где ты рулишь
                    будущим! ИИ-ассистенты пишут код, Telegram-боты принимают бабки и чатятся, а кибер-гараж управляет
                    автопарком. Хочешь внести свою лепту? Заходи на{" "}
                    <a href="/repo-xml" className="text-[#39FF14] hover:underline">
                      /repo-xml
                    </a>
                    , где мы вместе можем прикрутить AR-туры по машинам или нейросеть для подбора тачек по вайбу. Это
                    твой серфборд — прыгай на волну и го расширять этот мир, братан!
                  </p>
                </CardContent>
              </Card>

              {/* How to Use /repo-xml */}
              <Card className="bg-black text-white rounded-3xl shadow-[0_0_10px_#39FF14]">
                <CardHeader>
                  <CardTitle className="text-xl md:text-2xl font-semibold text-[#39FF14] font-orbitron">
                    Как Оседлать /repo-xml: Гайд для Кибер-Сёрферов
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm md:text-base text-gray-300">
                    Хочешь внести свой код в этот кибер-океан? Вот как работает подстраница{" "}
                    <a href="/repo-xml" className="text-[#39FF14] hover:underline">
                      /repo-xml
                    </a>{" "}
                    — твой пульт управления AI-волнами:
                  </p>
                  <ol className="list-decimal list-inside mt-2 space-y-2 text-sm md:text-base text-gray-300">
                    <li>
                      <strong>Кидай задачу боту:</strong> Открывай Telegram, находи <strong>oneSitePlsBot</strong>,
                      скидывай ему запрос прямо с Кворка или пиши, что хочешь добавить. Например: "Добавь AR-туры на
                      /repo-xml". Он отвечает: "Спасибо, ща разберусь!".
                    </li>
                    <li>
                      <strong>Спрашивай у Грока:</strong> Если лимит запросов в боте кончился, заходи на мою страничку
                      разработчика (кнопка внизу слева на{" "}
                      <a href="/repo-xml" className="text-[#39FF14] hover:underline">
                        /repo-xml
                      </a>
                      ). Там открывается Грок — копируй задачу, жми кнопку, и он выдаёт код с кнопкой "Скопировать".
                    </li>
                    <li>
                      <strong>Разбери файлы:</strong> Бери этот код, вставляй в поле на{" "}
                      <a href="/repo-xml" className="text-[#39FF14] hover:underline">
                        /repo-xml
                      </a>
                      , жми "Разобрать файлы". Они появляются в списке — ставь галочки на нужных (например, обновил два
                      файла).
                    </li>
                    <li>
                      <strong>Создай Pull Request:</strong> Жми "Создать request" — бот сам заполнит поля (что было, что
                      стало, как называется). Отправляй, и вуаля — ссылка на pull request готова. Я захожу, вижу твой
                      код, жму "Замёрджить", и изменения влетают в прод!
                    </li>
                    <li>
                      <strong>Кибер-Экстрактор:</strong> Внизу страницы есть фича — жми "Извлечь", и он сканирует все
                      файлы проекта для контекста. Потом можешь пихнуть это в Грока или oneSitePlsBot, чтобы
                      доработать. Дерево файлов тоже можно прикрутить — кидай идею!
                    </li>
                  </ol>
                  <p className="text-sm md:text-base mt-4 text-gray-300">
                    Итог: тебе даже GitHub не нужен! Бери ответ бота, разбирай, создавай PR, и я получаю оповещение (ну,
                    если оно прилетит, хех). Обновляй страничку — и твоя версия уже в деле. Го кататься на этих
                    AI-волнах вместе!
                  </p>
                </CardContent>
              </Card>

              {/* Call to Action */}
              <Card className="bg-black text-white rounded-3xl shadow-[0_0_10px_#39FF14]">
                <CardHeader>
                  <CardTitle className="text-xl md:text-2xl font-semibold text-[#39FF14] font-orbitron">
                    Ready to Collaborate?
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm md:text-base text-gray-300">
                    Want to build something epic or level up your team’s skills? Hit me up on{" "}
                    <a href="https://t.me/salavey13" target="_blank" className="text-[#39FF14] hover:underline">
                      Telegram
                    </a>{" "}
                    or drop a line at{" "}
                    <a href="mailto:salavey13@gmail.com" className="text-[#39FF14] hover:underline">
                      salavey13@gmail.com
                    </a>
                    .
                  </p>
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}