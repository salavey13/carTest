"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import SupportForm from "@/components/SupportForm";

export default function AboutPage() {
  return (
    <div className="relative min-h-screen">
      {/* Cyberpunk SVG Background */}
      <div className="absolute inset-0 z-0">
        <svg className="w-full h-full opacity-70 animate-pulse-slow" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000">
          <defs>
            <linearGradient id="cyberBg" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style={{ stopColor: "#000000", stopOpacity: 1 }} />
              <stop offset="100%" style={{ stopColor: "#111111", stopOpacity: 1 }} />
            </linearGradient>
          </defs>
          <rect width="1000" height="1000" fill="url(#cyberBg)" />
          <path d="M0,200 H1000 M0,400 H1000 M0,600 H1000 M0,800 H1000" stroke="#39FF14" strokeWidth="2" opacity="0.5" />
          <path d="M200,0 V1000 M400,0 V1000 M600,0 V1000 M800,0 V1000" stroke="#39FF14" strokeWidth="2" opacity="0.5" />
          <circle cx="500" cy="500" r="300" stroke="#39FF14" strokeWidth="1" fill="none" opacity="0.3" />
        </svg>
      </div>
      <div className="relative z-10 container mx-auto p-4 pt-24">
        <Card className="max-w-3xl mx-auto bg-black text-white rounded-3xl shadow-[0_0_10px_#39FF14]">
          <CardHeader>
            <CardTitle className="text-2xl md:text-3xl font-bold text-center text-[#39FF14]">
              Павел Соловьёв: Ваш Навигатор в Киберпространстве
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Personal Info */}
            <div className="flex flex-col items-center space-y-4">
              <Avatar className="w-32 h-32 md:w-36 md:h-36 border-2 border-[#39FF14]">
                <AvatarImage src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix//135398606.png" alt="Павел Соловьёв" />
                <AvatarFallback>ПС</AvatarFallback>
              </Avatar>
              <div className="text-center">
                <h2 className="text-xl md:text-2xl font-bold text-[#39FF14]">Павел Соловьёв</h2>
                <p className="text-sm md:text-base">Россия</p>
                <div className="mt-4 space-y-2 text-sm md:text-base">
                  <p><strong>Email:</strong> <a href="mailto:salavey13@gmail.com" className="text-[#39FF14] hover:underline">salavey13@gmail.com</a></p>
                  <p><strong>Telegram:</strong> <a href="https://t.me/salavey13" target="_blank" className="text-[#39FF14] hover:underline">t.me/salavey13</a></p>
                  <p><strong>GitHub:</strong> <a href="https://github.com/salavey13" target="_blank" className="text-[#39FF14] hover:underline">salavey13</a></p>
                </div>
              </div>
            </div>

            {/* Professional Overview */}
            <Card className="bg-black text-white rounded-3xl shadow-[0_0_10px_#39FF14]">
              <CardHeader>
                <CardTitle className="text-lg md:text-xl font-semibold text-[#39FF14]">Кто Я Такой?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm md:text-base">
                  Я — Павел Соловьёв, кибер-алхимик с 13+ годами опыта, прошедший путь от суровых Java-джунглей до вершин низкокодовых платформ вроде Framer и Supabase. Мой флагманский проект <strong>carTest</strong> — это не просто приложение, это твой серфборд, чтобы оседлать волны AI-цунами! Здесь ты найдёшь всё: от базовых функций до уникальной подстраницы <a href="/repo-xml" className="text-[#39FF14] hover:underline">/repo-xml</a>, где новички могут творить страницы с помощью ИИ через pull requests. Я основал <a href="https://onesitepls.framer.ai" target="_blank" className="text-[#39FF14] hover:underline">oneSitePls.framer.ai</a> и наставляю начинающих кодеров, помогая им взломать матрицу разработки.
                </p>
              </CardContent>
            </Card>

            {/* VIBE Methodology */}
            <Card className="bg-black text-white rounded-3xl shadow-[0_0_10px_#39FF14]">
              <CardHeader>
                <CardTitle className="text-lg md:text-xl font-semibold text-[#39FF14]">Методология VIBE: Код Будущего</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm md:text-base">
                  Забудь про ноукод и лоукод — моя методология VIBE это фулкод на стероидах, где читать код необязательно. Это как серфинг на продакшен-волнах: всё держится на ботах, которые разгоняют разработку до скорости света. Быстро, эффективно, без тормозов — это VIBE, братан!
                </p>
              </CardContent>
            </Card>

            <Card className="bg-black text-white rounded-3xl shadow-[0_0_10px_#39FF14]">
  <CardHeader>
    <CardTitle className="text-lg md:text-xl font-semibold text-[#39FF14]">
      VIBE CODING + SECURE DEVELOPMENT: Киберпанк-Алхимия
    </CardTitle>
  </CardHeader>
  <CardContent>
    <div className="mb-4">
      <iframe 
        width="100%" 
        height="315" 
        src="https://www.youtube.com/embed/Tw18-4U7mts" 
        title="YouTube video player"
        frameBorder="0" 
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
        allowFullScreen
        className="rounded-lg shadow-[0_0_10px_#39FF14]"
      ></iframe>
    </div>

    <p className="text-sm md:text-base mb-4">
      <strong>VIBE CODING:</strong> В 2025 мир захватила эпидемия "vibe" - когда ты полностью отдаёшься потоку, 
      используешь экспоненциальные технологии и забываешь, что код вообще существует. Но без должной безопасности 
      это приводит к катастрофам:
    </p>

    <ul className="list-disc list-inside space-y-2 text-sm md:text-base mb-4">
      <li>API-ключи скрэйпятся ботами</li>
      <li>Базы данных заполняются мусором</li>
      <li>Подписки обходятся через уязвимости</li>
    </ul>

    <p className="text-sm md:text-base mb-4">
      <strong>Мой подход:</strong> 13 лет в security позволяют мне применять VIBE-методологию без этих рисков. 
      Вот как я сочетаю скорость AI-разработки с надёжностью:
    </p>

    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="bg-gray-900 p-4 rounded-lg border border-[#39FF14]/30">
        <h4 className="font-bold text-[#39FF14] mb-2">1. AI + Security First</h4>
        <p className="text-xs md:text-sm">Все AI-генерации автоматически проверяются через статический анализ и шаблоны OWASP</p>
      </div>
      <div className="bg-gray-900 p-4 rounded-lg border border-[#39FF14]/30">
        <h4 className="font-bold text-[#39FF14] mb-2">2. Zero Trust Vibes</h4>
        <p className="text-xs md:text-sm">Каждый PR проходит через автоматические тесты на уязвимости перед мержем</p>
      </div>
      <div className="bg-gray-900 p-4 rounded-lg border border-[#39FF14]/30">
        <h4 className="font-bold text-[#39FF14] mb-2">3. Cyberpunk Git Flow</h4>
        <p className="text-xs md:text-sm">История изменений защищена криптографически, а доступ контролируется через Telegram-бота</p>
      </div>
    </div>

    <p className="text-sm md:text-base mt-4">
      Хочешь научиться vibe-кодингу без компромиссов в безопасности? Заходи на <a href="/repo-xml" className="text-[#39FF14] hover:underline">/repo-xml </a> 
      и смотри, как я интегрировал эти принципы в свой кибер-гараж!
    </p>
  </CardContent>
</Card>

            {/* Paid Support */}
            <Card className="bg-black text-white rounded-3xl shadow-[0_0_10px_#39FF14]">
              <CardHeader>
                <CardTitle className="text-lg md:text-xl font-semibold text-[#39FF14]">Нужна Помощь? Платная Поддержка</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm md:text-base mb-4">
                  Застрял в коде или хочешь ускорить свой проект? Я тут, чтобы вытащить тебя из цифрового болота. Заполни форму ниже, и мы вместе покорим AI-волны!
                </p>
                <SupportForm />
              </CardContent>
            </Card>

            {/* Project Overview */}
            <Card className="bg-black text-white rounded-3xl shadow-[0_0_10px_#39FF14]">
              <CardHeader>
                <CardTitle className="text-lg md:text-xl font-semibold text-[#39FF14]">Проект: Твой Кибер-Гараж</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm md:text-base">
                  Это не просто страница — это киберпанк-экосистема для аренды китайских тачек, где ты рулишь будущим! ИИ-ассистенты пишут код, Telegram-боты принимают бабки и чатятся, а кибер-гараж управляет автопарком. Хочешь внести свою лепту? Заходи на <a href="/repo-xml" className="text-[#39FF14] hover:underline">/repo-xml</a>, где мы вместе можем прикрутить AR-туры по машинам или нейросеть для подбора тачек по вайбу. Это твой серфборд — прыгай на волну и го расширять этот мир, братан!
                </p>
              </CardContent>
            </Card>

            {/* How to Use /repo-xml */}
            <Card className="bg-black text-white rounded-3xl shadow-[0_0_10px_#39FF14]">
              <CardHeader>
                <CardTitle className="text-lg md:text-xl font-semibold text-[#39FF14]">Как Оседлать /repo-xml: Гайд для Кибер-Сёрферов</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm md:text-base">
                  Хочешь внести свой код в этот кибер-океан? Вот как работает подстраница <a href="/repo-xml" className="text-[#39FF14] hover:underline">/repo-xml</a> — твой пульт управления AI-волнами:
                </p>
                <ol className="list-decimal list-inside mt-2 space-y-2 text-sm md:text-base">
                  <li>
                    <strong>Кидай задачу боту:</strong> Открывай Telegram, находи <strong>oneSitePlsBot</strong>, скидывай ему запрос прямо с Кворка или пиши, что хочешь добавить. Например: "Добавь AR-туры на /repo-xml". Он отвечает: "Спасибо, ща разберусь!".
                  </li>
                  <li>
                    <strong>Спрашивай у Грока:</strong> Если лимит запросов в боте кончился, заходи на мою страничку разработчика (кнопка внизу слева на <a href="/repo-xml" className="text-[#39FF14] hover:underline">/repo-xml</a>). Там открывается Грок — копируй задачу, жми кнопку, и он выдаёт код с кнопкой "Скопировать".
                  </li>
                  <li>
                    <strong>Разбери файлы:</strong> Бери этот код, вставляй в поле на <a href="/repo-xml" className="text-[#39FF14] hover:underline">/repo-xml</a>, жми "Разобрать файлы". Они появляются в списке — ставь галочки на нужных (например, обновил два файла).
                  </li>
                  <li>
                    <strong>Создай Pull Request:</strong> Жми "Создать request" — бот сам заполнит поля (что было, что стало, как называется). Отправляй, и вуаля — ссылка на pull request готова. Я захожу, вижу твой код, жму "Замёрджить", и изменения влетают в прод!
                  </li>
                  <li>
                    <strong>Кибер-Экстрактор:</strong> Внизу страницы есть фича — жми "Извлечь", и он сканирует все файлы проекта для контекста. Потом можешь пихнуть это в Грока или oneSitePlsBot, чтобы доработать. Дерево файлов тоже можно прикрутить — кидай идею!
                  </li>
                </ol>
                <p className="text-sm md:text-base mt-4">
                  Итог: тебе даже GitHub не нужен! Бери ответ бота, разбирай, создавай PR, и я получаю оповещение (ну, если оно прилетит, хех). Обновляй страничку — и твоя версия уже в деле. Го кататься на этих AI-волнах вместе!
                </p>
              </CardContent>
            </Card>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
