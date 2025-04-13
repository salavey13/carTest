// /app/about/page.tsx
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
        {/* Updated Title & Description to reflect AI focus */}
        <title>Pavel Solovyov - Cyber-Alchemist | AI-Driven Development & Validation</title>
        <meta
          name="description"
          content="13+ years in coding, pioneering the VIBE methodology for AI-accelerated development and business validation. Secure, efficient web solutions."
        />
        <meta
          name="keywords"
          content="developer, TypeScript, VIBE, cyberpunk, security, Framer, Supabase, AI, AI development, AI validation, mentorship, Pavel Solovyov"
        />
      </Head>
      <div className="relative min-h-screen">
        {/* Enhanced Cyberpunk SVG Background */}
        <div className="absolute inset-0 z-0">
          {/* Existing SVG Background */}
          <svg
            className="w-full h-full opacity-70 animate-pulse-slow"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 1000 1000"
          >
            {/* SVG paths and elements */}
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
              {/* Personal Info (Keep as is) */}
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
                  {/* Contact Info (Keep as is) */}
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

              {/* Professional Overview - Enhanced with AI focus */}
              <Card className="bg-black text-white rounded-3xl shadow-[0_0_10px_#39FF14]">
                <CardHeader>
                  <CardTitle className="text-xl md:text-2xl font-semibold text-[#39FF14] font-orbitron">
                    Кто Я? Стратег AI-Эпохи
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm md:text-base text-gray-300">
                    Я — Павел Соловьёв, кибер-ветеран с 13+ годами в коде. От Java и C++ я эволюционировал до пионера AI-ассистированной разработки. Сегодня я не просто пишу код — я **архитектор цифровых решений**, использующий AI как "carry team lead" для автоматизации рутины и фокусировки на **стратегии, UX и бизнес-логике**. Мой флагман{" "}
                    <a
                      href="https://github.com/salavey13/carTest"
                      target="_blank"
                      className="text-[#39FF14] hover:underline"
                    >
                      carTest
                    </a>{" "}
                    — это полигон, где новички учатся кодить, взаимодействуя с AI через pull requests. Как основатель{" "}
                    <a
                      href="https://onesitepls.framer.ai"
                      target="_blank"
                      className="text-[#39FF14] hover:underline"
                    >
                      oneSitePls.framer.ai
                    </a>
                    , я делаю веб-разработку доступной, а через менторство помогаю другим оседлать волну AI-трансформации. Моя цель — не просто кодить быстрее, а **строить правильные вещи** эффективно.
                  </p>
                </CardContent>
              </Card>

              {/* Skills - Enhanced with AI skill */}
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
                      <p className="text-gray-300">Framer, Supabase, StackBlitz, Next.js</p> {/* Added Next.js */}
                    </div>
                    <div>
                      <h4 className="text-[#39FF14] font-bold">Веб-разработка</h4>
                      <p className="text-gray-300">React, HTML, CSS, RESTful APIs</p>
                    </div>
                    <div>
                      <h4 className="text-[#39FF14] font-bold">Инструменты и методологии</h4>
                      <p className="text-gray-300">GitHub, Grok, Agile, Scrum, VIBE, **AI-Assisted Development & Workflow Optimization**</p> {/* Added AI skill */}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* VIBE Methodology - Significantly Enhanced */}
              <Card className="bg-black text-white rounded-3xl shadow-[0_0_10px_#39FF14]">
                <CardHeader>
                  <CardTitle className="text-xl md:text-2xl font-semibold text-[#39FF14] font-orbitron">
                    Методология VIBE: За Пределами Кода
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm md:text-base text-gray-300 mb-4">
                    Мой метод VIBE — это не просто кодинг, это **парадигмальный сдвиг**. Это ответ на вопрос: как создавать ценность в эпоху, когда AI может генерировать код с **"near-perfect accuracy"**? VIBE — это **AI-усиленная алхимия**, где фокус смещается с написания строк кода на **архитектуру системы, UX-потоки и стратегическое видение**.
                  </p>
                  {/* --- Placeholder Image 1 --- */}
                  {/* Prompt for Image Generator:
                      "Cyberpunk visualization of the VIBE methodology. A central glowing brain/processor icon representing human strategy. Radiating outwards are streams of neon data flowing towards automated processes: 'AI Code Generation' (glowing code snippets), 'Automated Testing' (checkmarks), 'Business Validation' (graphs/charts), 'Deployment Pipelines' (gears/arrows). Dark, tech-infused background with subtle circuit traces. Dominant colors: #39FF14 green, electric blue, magenta accents. Aspect ratio 16:9."
                  */}
                  <img
                      src="/placeholder-image-vibe-concept.webp"
                      alt="VIBE Methodology Visualization - AI-assisted strategy and automation"
                      className="rounded-lg shadow-[0_0_10px_#39FF14] my-4 w-full object-cover"
                      style={{ aspectRatio: '16/9' }} // Enforce aspect ratio
                  />

                  <p className="text-sm md:text-base text-gray-300 mb-4">
                    **AI как Партнёр:** Я рассматриваю AI не как инструмент, а как **"God-tier genius who never sleeps"** — партнёра, который берёт на себя рутинные, трудоёмкие задачи кодирования, позволяя мне и команде концентрироваться на **высокоуровневом проектировании**. Мы можем генерировать целые подсистемы за дни, а не недели, освобождая ресурсы для инноваций.
                  </p>
                  <p className="text-sm md:text-base text-gray-300">
                    **Больше, чем Код — Валидация Идей:** VIBE выходит за рамки разработки. Зачем строить быстро, если строишь не то? Я интегрирую **AI-driven business validation**, чтобы **"fail faster"** на плохих идеях и **ускорять хорошие**. Используя AI для анализа рынка, поиска реальной **"боли"** пользователей, оценки конкурентов и тестирования MVP с минимальными затратами (как в 5-шаговом фреймворке), мы радикально **снижаем риск** создания продуктов, которые никому не нужны. Это не просто быстрее – это **"entirely different game"**. VIBE — это сердце моих проектов, от{" "}
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

             {/* VIBE CODING + SECURE DEVELOPMENT - Enhanced */}
              <Card className="bg-black text-white rounded-3xl shadow-[0_0_10px_#39FF14]">
                <CardHeader>
                  <CardTitle className="text-xl md:text-2xl font-semibold text-[#39FF14] font-orbitron">
                    VIBE CODING + SECURE DEVELOPMENT: Скорость и Надёжность
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="mb-4">
                    {/* Existing Video */}
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
                    <strong>VIBE CODING:</strong> Представьте генерацию 60kb рабочего кода за 48 часов. Это сила AI-ассистированной разработки. Но с великой силой приходит великая ответственность. Без должной **кибер-брони**, этот "vibe" может привести к катастрофам:
                  </p>
                   {/* Existing list of risks */}
                   <ul className="list-disc list-inside space-y-2 text-sm md:text-base mb-4 text-gray-300">
                     <li>API-ключи скрэйпятся ботами</li>
                     <li>Базы данных заполняются мусором</li>
                     <li>Подписки обходятся через уязвимости</li>
                   </ul>

                  {/* --- Placeholder Image 2 --- */}
                  {/* Prompt for Image Generator:
                      "Cyberpunk image depicting a secure AI development pipeline. Glowing green code streams flowing through holographic security shields (labeled OWASP, Static Analysis, Zero Trust). A robotic arm (representing AI) is coding, overseen by a vigilant human silhouette looking at security dashboards. Dark, server room background with neon blue and green lights. Style: Futuristic, secure, high-tech. Aspect ratio 16:9."
                  */}
                  <img
                      src="/placeholder-image-secure-ai-dev.webp"
                      alt="Secure AI Development Pipeline - VIBE Coding with Security"
                      className="rounded-lg shadow-[0_0_10px_#39FF14] my-4 w-full object-cover"
                      style={{ aspectRatio: '16/9' }} // Enforce aspect ratio
                  />

                   <p className="text-sm md:text-base mb-4 text-gray-300">
                    <strong>Мой подход:</strong> Мои 13 лет в **enterprise security** позволяют мне применять VIBE-методологию **безопасно**. Я интегрирую проверки на каждом шагу, чтобы AI-скорость не приводила к уязвимостям. Это **оптимизация ресурсов**: максимальная эффективность AI при сохранении человеческого контроля над критическими аспектами — безопасностью и стратегией.
                  </p>
                  {/* Existing Security Steps Grid */}
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

              {/* Кибер-Броня: 13 Лет Security Опыта (Keep structure, minor text tweaks if needed) */}
              <Card className="bg-black text-white rounded-3xl shadow-[0_0_10px_#39FF14]">
                 <CardHeader>
                   <CardTitle className="text-xl md:text-2xl font-semibold text-[#39FF14] font-orbitron">
                     Кибер-Броня: 13 Лет Опыта Безопасности
                   </CardTitle>
                 </CardHeader>
                 <CardContent>
                   {/* Content remains largely the same, emphasizing the *application* of security to modern AI workflows */}
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     {/* Security Experience */}
                     <div className="space-y-4">
                       <h3 className="font-bold text-[#39FF14]">Enterprise-Grade Protection</h3>
                       <ul className="list-disc list-inside space-y-2 text-sm text-gray-300">
                         <li>Разработал security-фичи для Avaya Aura AS5300 (C++)</li>
                         <li>Реализовал поддержку IPv6 с нулевым downtime</li>
                         <li>Сертифицированный специалист Qualys по управлению уязвимостями</li>
                         <li>4 успешных релиза механизма принятия решений ABRE (Java/Groovy)</li>
                         <li>Применение этого опыта для **безопасной интеграции AI** в разработку</li> {/* Added line */}
                       </ul>
                     </div>

                     {/* VIBE Security Framework */}
                     <div className="space-y-4">
                       <h3 className="font-bold text-[#39FF14]">VIBE Security Framework</h3>
                       <div className="flex items-start space-x-3">
                         <div className="text-[#39FF14] mt-1">⚡</div>
                         <div>
                           <p className="text-sm text-gray-300">
                             <strong>AI-Генерация → Авто-аудит:</strong>
                             <br />
                             Все AI-сгенерированные PR проходят через:
                           </p>
                           <ul className="list-[square] list-inside text-xs text-gray-300 mt-1">
                             <li>Статический анализ кода (SAST)</li> {/* Clarified SAST */}
                             <li>Проверку на OWASP Top 10</li>
                             <li>Тесты на инъекции и уязвимости</li> {/* Expanded */}
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
                       <h4 className="font-bold text-[#39FF14] text-sm">AI + Zero Trust</h4> {/* Updated */}
                       <p className="text-xs text-gray-300">Подход во всех проектах</p>
                     </div>
                   </div>
                 </CardContent>
              </Card>

              {/* Experience - Minor enhancement to reflect AI */}
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
                      Запустил платформу с **AI** для упрощённой веб-разработки. Создал{" "}
                      <a
                        href="https://github.com/salavey13/carTest"
                        target="_blank"
                        className="text-[#39FF14] hover:underline"
                      >
                        carTest
                      </a>{" "}
                      с функцией selfdev для обучения новичков **AI-ассистированному** кодингу.
                    </p>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-[#39FF14]">
                      Старший разработчик, Orion Innovation (Avaya) (2010 - 2023) {/* Clarified Avaya */}
                    </h3>
                    <ul className="list-disc list-inside text-gray-300 space-y-2">
                      <li>
                        <strong>Java-разработчик (2016-2023):</strong> Улучшил Avaya Business Rules Engine и микросервисы
                        для Avaya Aura AS5300, применяя принципы надёжности, актуальные и для **AI-эпохи**.
                      </li>
                      <li>
                        <strong>C++-разработчик (2010-2016):</strong> Поддерживал клиентское приложение Avaya Aura AS5300,
                        добавив IPv6 и **фундаментальные security-практики**.
                      </li>
                    </ul>
                  </div>
                </CardContent>
              </Card>

              {/* Certifications (Keep as is) */}
              <Card className="bg-black text-white rounded-3xl shadow-[0_0_10px_#39FF14]">
                 <CardHeader>
                   <CardTitle className="text-xl md:text-2xl font-semibold text-[#39FF14] font-orbitron">
                     Сертификации
                   </CardTitle>
                 </CardHeader>
                 <CardContent>
                   <ul className="list-disc list-inside text-gray-300 space-y-2">
                     <li>Qualys Advanced Vulnerability Management (2021)</li>
                   </ul>
                 </CardContent>
              </Card>

              {/* Education (Keep as is) */}
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

              {/* Mentorship - Enhanced */}
              <Card className="bg-black text-white rounded-3xl shadow-[0_0_10px_#39FF14]">
                <CardHeader>
                  <CardTitle className="text-xl md:text-2xl font-semibold text-[#39FF14] font-orbitron">
                    Менторство: Навигация в AI-Будущем
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm md:text-base text-gray-300">
                    Помогаю новичкам не просто кодить, а **мыслить стратегически** в мире AI. Обучение через практику на{" "}
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
                    , поддержка в Telegram и бесплатный стартовый план — всё для того, чтобы вы могли **эффективно использовать современные AI-инструменты** и сфокусироваться на создании ценности.
                  </p>
                </CardContent>
              </Card>

              {/* Paid Support (Keep as is) */}
              <Card className="bg-black text-white rounded-3xl shadow-[0_0_10px_#39FF14]">
                <CardHeader>
                  <CardTitle className="text-xl md:text-2xl font-semibold text-[#39FF14] font-orbitron">
                    Платная Поддержка
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm md:text-base text-gray-300 mb-4">
                    Нужен толчок в коде или стратегии? Хочешь внедрить VIBE? Заполни форму, и я помогу тебе оседлать AI-волны!
                  </p>
                  <SupportForm />
                </CardContent>
              </Card>

              {/* Project Overview - Enhanced */}
              <Card className="bg-black text-white rounded-3xl shadow-[0_0_10px_#39FF14]">
                <CardHeader>
                  <CardTitle className="text-xl md:text-2xl font-semibold text-[#39FF14] font-orbitron">
                    Проект: Твой Кибер-Гараж (AI-Powered)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                   {/* --- Placeholder Image 3 --- */}
                   {/* Prompt for Image Generator:
                       "Cyberpunk scene of a futuristic garage ('Кибер-Гараж'). Holographic interfaces display car diagnostics and rental schedules. AI assistants (represented by glowing orbs or abstract energy forms) interact with the system. Chinese electric cars are visible, perhaps with augmented reality overlays showing specs or tour points. Neon signs in Russian and English. Style: Blade Runner meets automotive tech. Aspect ratio 16:9."
                   */}
                  <img
                      src="/placeholder-image-cyber-garage.webp"
                      alt="Кибер-Гараж - AI-Powered Car Rental Ecosystem"
                      className="rounded-lg shadow-[0_0_10px_#39FF14] my-4 w-full object-cover"
                      style={{ aspectRatio: '16/9' }} // Enforce aspect ratio
                  />
                  <p className="text-sm md:text-base text-gray-300">
                    Это не просто страница — это **живая киберпанк-экосистема**, построенная на принципах VIBE. Здесь **AI-ассистенты** активно участвуют в разработке (через{" "}
                    <a href="/repo-xml" className="text-[#39FF14] hover:underline">
                      /repo-xml
                    </a>), Telegram-боты автоматизируют задачи, а сам кибер-гараж — это платформа для экспериментов с AI-валидацией и быстрой итерацией фич (например, AR-туры или AI-подбор авто). Это твой шанс внести вклад в проект, где **AI — не хайп, а рабочий инструмент**. Го расширять этот мир вместе!
                  </p>
                </CardContent>
              </Card>

              {/* How to Use /repo-xml (Keep as is, it already explains the AI workflow) */}
              <Card className="bg-black text-white rounded-3xl shadow-[0_0_10px_#39FF14]">
                 <CardHeader>
                   <CardTitle className="text-xl md:text-2xl font-semibold text-[#39FF14] font-orbitron">
                     Как Оседлать /repo-xml: AI-Ассистированный Контрибьют
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
                   {/* Existing numbered list explaining the process */}
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
                     Итог: GitHub почти не нужен! Весь воркфлоу построен вокруг **AI-ассистентов и автоматизации**. Бери ответ бота, разбирай, создавай PR, и я получаю оповещение. Обновляй страничку — и твоя версия уже в деле. Го кататься на этих AI-волнах вместе!
                   </p>
                 </CardContent>
               </Card>


              {/* Call to Action (Keep as is) */}
              <Card className="bg-black text-white rounded-3xl shadow-[0_0_10px_#39FF14]">
                <CardHeader>
                  <CardTitle className="text-xl md:text-2xl font-semibold text-[#39FF14] font-orbitron">
                    Ready to Collaborate?
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm md:text-base text-gray-300">
                    Want to build something epic using AI-driven methods or level up your team’s skills? Hit me up on{" "} {/* Added AI mention */}
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