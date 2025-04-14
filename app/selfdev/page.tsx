"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// import { Button } from "@/components/ui/button"; // Button не используется напрямую здесь
import SupportForm from "@/components/SupportForm"; // Keep if consulting is still offered
import { useAppContext } from "@/contexts/AppContext";
import { cn } from "@/lib/utils";
import {
  FaLightbulb, FaRoad, FaUsers, FaRocket, FaCodeBranch,
  FaArrowsSpin, FaNetworkWired, FaBookOpen, FaComments, FaBrain, FaEye, // fa6 icons (removed unused ones)
  FaFileCode // Replaced FaCog with FaCodeBranch
} from "react-icons/fa6";
import { debugLogger } from "@/lib/debugLogger";
import { logger } from "@/lib/logger";
import Link from "next/link";

// --- Component ---
export default function SelfDevLandingPage() {
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAppContext(); // user здесь не используется напрямую, но получаем для логгирования
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    // Any client-side specific logic can go here
    debugLogger.log("[SelfDevPage] Mounted. Auth loading:", isAuthLoading, "Is Authenticated:", isAuthenticated);
  }, [isAuthLoading, isAuthenticated]);

  // Render loading state or placeholder if not mounted or auth loading
  if (!isMounted || isAuthLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen pt-20 bg-gradient-to-br from-gray-900 via-black to-gray-800">
        <p className="text-brand-green animate-pulse text-xl font-mono">Загрузка философии VIBE...</p>
      </div>
    );
  }

  // Страница доступна всем, аутентификация нужна только для SupportForm
  // Поэтому нет необходимости в проверке !isAuthenticated здесь

  return (
    <div className="relative min-h-screen overflow-hidden pt-20 pb-10 bg-gradient-to-br from-gray-900 via-black to-gray-800 text-gray-200">
      {/* Subtle Background Grid */}
      <div
        className="absolute inset-0 bg-repeat opacity-5 z-0"
        style={{
          backgroundImage: `linear-gradient(to right, rgba(0, 255, 157, 0.2) 1px, transparent 1px),
                            linear-gradient(to bottom, rgba(0, 255, 157, 0.2) 1px, transparent 1px)`,
          backgroundSize: '50px 50px',
        }}
      ></div>

      <div className="relative z-10 container mx-auto px-4">
        <Card className="max-w-5xl mx-auto bg-black/80 backdrop-blur-md text-white rounded-2xl border border-brand-green/30 shadow-[0_0_25px_rgba(0,255,157,0.4)]">
          <CardHeader className="text-center border-b border-brand-green/20 pb-4">
            <CardTitle className="text-3xl md:text-5xl font-bold text-brand-green cyber-text glitch" data-text="SelfDev: Путь к Себе">
              SelfDev: Путь к Себе
            </CardTitle>
            <p className="text-md md:text-lg text-gray-300 mt-3 font-mono">
              Лучшая бизнес-модель — это не модель. Это образ жизни.
            </p>
          </CardHeader>

          <CardContent className="space-y-10 p-4 md:p-8">

            {/* Section 1: The Old Paradigm Trap */}
            <section className="space-y-4">
              <h2 className="flex items-center text-2xl md:text-3xl font-semibold text-brand-pink mb-4">
                <FaRoad className="mr-3 text-brand-pink/80" /> Ловушка Старой Парадигмы
              </h2>
              <p className="text-gray-300 text-base md:text-lg leading-relaxed">
                Многие новички слепо ищут "лучшие" навыки или бизнес-модели, чтобы заработать, уйти с работы, получить контроль. Они действуют из нужды, применяя школьный подход: найти "новую работу" (фриланс, агентство, eCom) и учиться по чужим правилам.
              </p>
              <div className="my-6 p-2 border border-brand-pink/30 rounded-lg bg-black/30">
                <img src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/s101.png" alt="Инфографика: Старый путь (ловушка) против Нового пути (свобода)" className="w-full h-auto rounded-md bg-gray-800/50 aspect-video object-cover" loading="lazy" />
                <p className="text-xs text-center text-gray-400 mt-1 italic">Старый путь ведет в ловушку, Новый - к свободе.</p>
              </div>
              <p className="text-gray-300 text-base md:text-lg leading-relaxed">
                В итоге они строят себе новую клетку 9-5, чувствуют себя зажатыми, без рычагов влияния. Их доход нестабилен, а работа не приносит радости, потому что она не связана с их истинными интересами или жизненными целями. Фокус только на деньгах уводит от главного.
              </p>
            </section>

            {/* Section 2: The New Paradigm - Life First */}
            <section className="space-y-4">
              <h2 className="flex items-center text-2xl md:text-3xl font-semibold text-brand-blue mb-4">
                <FaLightbulb className="mr-3 text-brand-blue/80" /> Новый Путь: Жизнь Прежде Всего
              </h2>
              <p className="text-gray-300 text-base md:text-lg leading-relaxed">
                Настоящий путь начинается с вопроса: "Какую жизнь я хочу жить?". Вместо того чтобы выбирать нишу или модель, ты <strong className="text-brand-blue font-semibold">становишься нишей</strong>. Ты решаешь <strong className="text-brand-blue font-semibold">свои</strong> проблемы, помогаешь <strong className="text-brand-blue font-semibold">своему прошлому "я"</strong>, и строишь бизнес вокруг <strong className="text-brand-blue font-semibold">своей аутентичности и экспертизы</strong>.
              </p>
               <div className="my-6 p-2 border border-brand-blue/30 rounded-lg bg-black/30">
                <img src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/s201.png" alt="Майнд-карта: Построение бизнеса вокруг себя" className="w-full h-auto rounded-md bg-gray-800/50 aspect-video object-cover" loading="lazy" />
                 <p className="text-xs text-center text-gray-400 mt-1 italic">Твои интересы, навыки и решенные проблемы - основа бизнеса.</p>
              </div>
              <p className="text-gray-300 text-base md:text-lg leading-relaxed">
                Деньги — это важный <strong className="text-brand-blue font-semibold">ресурс</strong>, но не единственная <strong className="text-brand-blue font-semibold">цель</strong>. Цель — жить осмысленно, занимаясь тем, что важно для <strong className="text-brand-blue font-semibold">тебя</strong>. Твои ценности и интересы эволюционируют, и твой бизнес должен эволюционировать вместе с тобой.
              </p>
            </section>

            {/* Section 3: The Power of Audience & Content */}
            <section className="space-y-4">
              <h2 className="flex items-center text-2xl md:text-3xl font-semibold text-neon-lime mb-4">
                <FaUsers className="mr-3 text-neon-lime/80" /> Сила Аудитории и Контента
              </h2>
              <p className="text-gray-300 text-base md:text-lg leading-relaxed">
                Для новичка без капитала, самый <strong className="text-neon-lime font-semibold">высокорычажный</strong> старт — построение аудитории через контент. Почему?
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-300 pl-4 text-base md:text-lg leading-relaxed">
                <li><strong className="text-neon-lime font-semibold">Бесплатное Обучение:</strong> Создавая контент, ты <strong className="text-neon-lime font-semibold">учишься</strong> маркетингу, психологии, дизайну, копирайтингу — <strong className="text-neon-lime font-semibold">на практике и бесплатно</strong>.</li>
                <li><strong className="text-neon-lime font-semibold">Построение Доверия:</strong> Делясь своими интересами и экспертизой, ты строишь доверие и привлекаешь людей, которым <strong className="text-neon-lime font-semibold">резонируешь ты</strong>.</li>
                <li><strong className="text-neon-lime font-semibold">Рычаг Влияния:</strong> Аудитория — это твой актив. Ты можешь предлагать им продукты/услуги без агрессивных продаж, потому что они уже тебе доверяют.</li>
                <li><strong className="text-neon-lime font-semibold">Принцип T-Shaped:</strong> 80% контента — глубоко по твоей основной теме/истории. 20% — шире, о других интересах, чтобы экспериментировать и показать себя.</li>
              </ul>
              <div className="my-6 p-2 border border-neon-lime/30 rounded-lg bg-black/30">
                <img src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/s301.png" alt="Диаграмма: Контент -> Доверие -> Аудитория -> Продажи" className="w-full h-auto rounded-md bg-gray-800/50 aspect-video object-cover" loading="lazy" />
                <p className="text-xs text-center text-gray-400 mt-1 italic">Контент - двигатель доверия и роста.</p>
              </div>
              <p className="text-gray-300 text-base md:text-lg leading-relaxed">
                Создание контента — это не "быть контент-креатором", это <strong className="text-neon-lime font-semibold">необходимый элемент любого современного бизнеса</strong>. Это твой способ доказать свою ценность.
              </p>
            </section>

            {/* Section 4: Evolving Your Offers */}
            <section className="space-y-4">
               <h2 className="flex items-center text-2xl md:text-3xl font-semibold text-brand-orange mb-4">
                 <FaArrowsSpin className="mr-3 text-brand-orange/80" /> Эволюция Предложений
               </h2>
               <p className="text-gray-300 text-base md:text-lg leading-relaxed">
                 Твой бизнес и твои предложения должны расти вместе с тобой и твоей аудиторией.
               </p>
               <div className="my-6 p-2 border border-brand-orange/30 rounded-lg bg-black/30">
                 <img src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/s401.png" alt="Схема: Эволюция предложений с ростом аудитории" className="w-full h-auto rounded-md bg-gray-800/50 aspect-video object-cover" loading="lazy" />
                  <p className="text-xs text-center text-gray-400 mt-1 italic">От услуг к продуктам по мере роста.</p>
               </div>
               <ul className="list-disc list-inside space-y-2 text-gray-300 pl-4 text-base md:text-lg leading-relaxed">
                 <li><strong className="text-brand-orange font-semibold">Начало (Маленькая аудитория):</strong> Предлагай <strong className="text-brand-orange font-semibold">высокочековые услуги</strong> (фриланс, коучинг, консалтинг). Тебе нужно всего 2-4 клиента в месяц, чтобы заменить зарплату. Это требует навыков продаж и прямого общения.</li>
                 <li><strong className="text-brand-orange font-semibold">Рост (Аудитория растет):</strong> Постепенно создавай <strong className="text-brand-orange font-semibold">масштабируемые продукты</strong> (цифровые продукты, шаблоны, курсы, ПО, физические товары). Они могут продаваться, пока ты спишь, и требуют меньше твоего времени на каждого клиента.</li>
               </ul>
               <p className="text-gray-300 text-base md:text-lg leading-relaxed">
                 Эта эволюция позволяет тебе <strong className="text-brand-orange font-semibold">уменьшать время</strong>, затрачиваемое на выполнение работы, <strong className="text-brand-orange font-semibold">увеличивать доход</strong> и получать <strong className="text-brand-orange font-semibold">больше контроля</strong> над своим днем, используя растущую аудиторию как рычаг.
               </p>
            </section>

            {/* Section 5: How to Learn & Start (Intelligent Imitation) */}
            <section className="space-y-4">
              <h2 className="flex items-center text-2xl md:text-3xl font-semibold text-brand-purple mb-4">
                 <FaCodeBranch className="mr-3 text-brand-purple/80" /> Как Начать: Интеллектуальная Имитация
              </h2>
              <p className="text-gray-300 text-base md:text-lg leading-relaxed">
                Тебе не нужна книга инструкций. Ты <strong className="text-brand-purple font-semibold">уже</strong> окружен информацией. Научись учиться как художник: наблюдай и экспериментируй.
              </p>
               <div className="my-6 p-2 border border-brand-purple/30 rounded-lg bg-black/30">
                 <img src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/s501.png" alt="Инфографика: Процесс Интеллектуальной Имитации" className="w-full h-auto rounded-md bg-gray-800/50 aspect-video object-cover" loading="lazy" />
                 <p className="text-xs text-center text-gray-400 mt-1 italic">Учись, наблюдая, разбирая и пробуя.</p>
               </div>
              <ol className="list-decimal list-inside space-y-3 text-gray-300 pl-4 text-base md:text-lg leading-relaxed">
                <li><strong className="text-brand-purple font-semibold">Собери Вдохновение:</strong> <FaEye className="inline mr-1 mb-1 text-brand-purple/80"/> Найди 3-5 брендов, авторов, продуктов, которые тебе нравятся и которые успешны.</li>
                <li><strong className="text-brand-purple font-semibold">Разбери на Части:</strong> <FaFileCode className="inline mr-1 mb-1 text-brand-purple/80"/> Проанализируй их структуру, стиль, ключевые элементы (хуки, заголовки, формат контента, дизайн, УТП). Почему это работает?</li>
                <li><strong className="text-brand-purple font-semibold">Имитируй Маленький Кусочек:</strong> <FaCodeBranch className="inline mr-1 mb-1 text-brand-purple/80"/> Возьми <strong className="text-brand-purple font-semibold">один</strong> элемент (например, структуру поста, цветовую схему, тип заголовка) и попробуй применить его <strong className="text-brand-purple font-semibold">в своем</strong> контенте/продукте/профиле.</li>
                <li><strong className="text-brand-purple font-semibold">Повторяй и Сочетай:</strong> <FaArrowsSpin className="inline mr-1 mb-1 text-brand-purple/80"/> Сделай это снова с другим элементом. И еще раз. Постепенно ты создашь <strong className="text-brand-purple font-semibold">свой уникальный стиль</strong>.</li>
                <li><strong className="text-brand-purple font-semibold">Дополняй Знаниями:</strong> <FaBrain className="inline mr-1 mb-1 text-brand-purple/80"/> Параллельно изучай теорию (читай книги, смотри видео), чтобы понимать <strong className="text-brand-purple font-semibold">"почему"</strong> то, что ты делаешь, работает.</li>
              </ol>
              <h3 className="flex items-center text-xl font-semibold text-brand-purple mt-6 mb-2">
                 <FaNetworkWired className="mr-2 text-brand-purple/80" /> Внедряйся в "Племя"
              </h3>
              <p className="text-gray-300 text-base md:text-lg leading-relaxed">
                Найди 5-10 ключевых людей в своей нише. Сделай так, чтобы они тебя заметили:
              </p>
               <ul className="list-disc list-inside space-y-1 text-gray-300 pl-4 text-base md:text-lg leading-relaxed">
                 <li>Комментируй их посты (<strong className="text-brand-purple font-semibold">осмысленно!</strong>).</li>
                 <li>Вступай в их сообщества.</li>
                 <li>Делись их контентом (если он ценен).</li>
                 <li>Напиши им в ЛС, чтобы начать диалог (без продаж!).</li>
               </ul>
               <h3 className="flex items-center text-xl font-semibold text-brand-purple mt-6 mb-2">
                  <FaComments className="mr-2 text-brand-purple/80" /> Пиши Хорошие Комментарии
               </h3>
               <p className="text-gray-300 text-base md:text-lg leading-relaxed">
                 Самый простой способ выделиться. Забудь про "Отличный пост!". Начни с <strong className="text-brand-purple font-semibold">"Я помню, когда..."</strong> и расскажи короткую <strong className="text-brand-purple font-semibold">релевантную</strong> историю из своей жизни. Это вызывает любопытство к <strong className="text-brand-purple font-semibold">тебе</strong>.
               </p>
            </section>

             {/* Section 6: Cornerstone Content & Proof (Added) */}
            <section className="space-y-4">
              <h2 className="flex items-center text-2xl md:text-3xl font-semibold text-brand-green mb-4">
                <FaBookOpen className="mr-3 text-brand-green/80" /> Фундамент: Контент и Доказательство Ценности
              </h2>
              <p className="text-gray-300 text-base md:text-lg leading-relaxed">
                Тебе нужно создать <strong className="text-brand-green font-semibold">базовый уровень информации</strong>, чтобы люди могли понять, кто ты и чем можешь быть полезен, <strong className="text-brand-green font-semibold">прежде чем</strong> они тебе доверятся. Несколько постов недостаточно.
              </p>
               <div className="my-6 p-2 border border-brand-green/30 rounded-lg bg-black/30">
                 <img src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/s601.png" alt="Визуализация: Фундаментальный контент как основа" className="w-full h-auto rounded-md bg-gray-800/50 aspect-video object-cover" loading="lazy" />
                 <p className="text-xs text-center text-gray-400 mt-1 italic">Создай основу, на которую можно опереться.</p>
               </div>
              <p className="text-gray-300 text-base md:text-lg leading-relaxed">
                <strong className="text-brand-green font-semibold">Контент "Почему":</strong> Большая часть твоего контента (80%) должна объяснять <strong className="text-brand-green font-semibold">твою историю, основы твоей темы, почему это важно</strong>, и как это связано с твоей повседневной жизнью. Это контент для новичков и среднего уровня.
              </p>
              <p className="text-gray-300 text-base md:text-lg leading-relaxed">
                <strong className="text-brand-green font-semibold">Продукты "Как":</strong> Твои платные продукты и услуги (или бесплатные лид-магниты) должны содержать <strong className="text-brand-green font-semibold">конкретные инструкции "как"</strong> что-то сделать. Это для среднего и продвинутого уровня. Не путай!
              </p>
            </section>

            {/* Call to Action */}
            <section className="space-y-4 border-t border-brand-green/20 pt-8 mt-10">
              <h2 className="flex items-center justify-center text-2xl md:text-3xl font-semibold text-brand-green mb-4">
                <FaRocket className="mr-3 text-brand-green/80" /> Готов Начать Свой Путь?
              </h2>
              <p className="text-gray-300 text-base md:text-lg text-center leading-relaxed">
                 Этот новый путь — это марафон, а не спринт. Он требует работы, но это работа над <strong className="text-brand-green font-semibold">собой</strong> и <strong className="text-brand-green font-semibold">своей жизнью</strong>. Платформа <strong className="text-brand-green font-semibold">oneSitePls</strong> и инструменты вроде <Link href="/repo-xml" className="text-brand-blue hover:underline font-semibold">/repo-xml</Link> созданы, чтобы <strong className="text-brand-green font-semibold">ускорить</strong> этот процесс, используя AI как помощника.
              </p>
               <p className="text-gray-300 text-base md:text-lg text-center leading-relaxed mt-4">
                 Изучи <Link href="/about" className="text-brand-blue hover:underline font-semibold">мою историю</Link>, посмотри на <a href="https://github.com/salavey13/oneSitePls" target="_blank" rel="noopener noreferrer" className="text-brand-blue hover:underline font-semibold">репозиторий oneSitePls</a> как на пример VIBE-разработки, или свяжись со мной для менторства или консультации через форму ниже.
               </p>
               <div className="mt-8 max-w-md mx-auto">
                  <h3 className="text-xl font-semibold text-brand-green mb-4 text-center">Нужна Помощь или Консультация?</h3>
                  {/* Проверка на isMounted уже выполнена выше, так что SupportForm можно рендерить */}
                  <SupportForm />
               </div>
            </section>

          </CardContent>
        </Card>
      </div>

      {/* Add CSS for cyber-text and glitch if not defined globally in styles/globals.css */}
      <style jsx global>{`
        .cyber-text {
           text-shadow: 0 0 5px rgba(0, 255, 157, 0.7), 0 0 10px rgba(0, 255, 157, 0.5);
           /* filter: drop-shadow(0 0 8px rgba(0, 255, 157, 0.6)); */ /* Альтернатива для неона */
        }

        @keyframes glitch { 0% { text-shadow: 0.05em 0 0 rgba(255,0,0,.75), -0.05em -0.025em 0 rgba(0,255,0,.75), -0.025em 0.05em 0 rgba(0,0,255,.75); } 14% { text-shadow: 0.05em 0 0 rgba(255,0,0,.75), -0.05em -0.025em 0 rgba(0,255,0,.75), -0.025em 0.05em 0 rgba(0,0,255,.75); } 15% { text-shadow: -0.05em -0.025em 0 rgba(255,0,0,.75), 0.025em 0.025em 0 rgba(0,255,0,.75), -0.05em -0.05em 0 rgba(0,0,255,.75); } 49% { text-shadow: -0.05em -0.025em 0 rgba(255,0,0,.75), 0.025em 0.025em 0 rgba(0,255,0,.75), -0.05em -0.05em 0 rgba(0,0,255,.75); } 50% { text-shadow: 0.025em 0.05em 0 rgba(255,0,0,.75), 0.05em 0 0 rgba(0,255,0,.75), 0 -0.05em 0 rgba(0,0,255,.75); } 99% { text-shadow: 0.025em 0.05em 0 rgba(255,0,0,.75), 0.05em 0 0 rgba(0,255,0,.75), 0 -0.05em 0 rgba(0,0,255,.75); } 100% { text-shadow: -0.025em 0 0 rgba(255,0,0,.75), -0.025em -0.025em 0 rgba(0,255,0,.75), -0.025em -0.05em 0 rgba(0,0,255,.75); } }

        .glitch { position: relative; animation: glitch 1.5s linear infinite; }
        .glitch::before, .glitch::after { content: attr(data-text); position: absolute; left: 0; top: 0; width: 100%; height: 100%; background: inherit; overflow: hidden; clip: rect(0, 900px, 0, 0); color: inherit; } /* Inherit background and color */
        .glitch::before { left: 2px; text-shadow: -1px 0 rgba(255, 0, 255, 0.8); animation: glitch-anim-1 2s infinite linear alternate-reverse; } /* Magenta/Red shift */
        .glitch::after { left: -2px; text-shadow: -1px 0 rgba(0, 255, 255, 0.8); animation: glitch-anim-2 2.5s infinite linear alternate-reverse; } /* Cyan/Blue shift */

        @keyframes glitch-anim-1 { 0% { clip: rect(44px, 9999px, 49px, 0); transform: skew(0.3deg); } 5% { clip: rect(5px, 9999px, 100px, 0); transform: skew(0deg); } 10% { clip: rect(13px, 9999px, 60px, 0); transform: skew(-0.2deg); } 15% { clip: rect(80px, 9999px, 40px, 0); transform: skew(0.1deg); } 20% { clip: rect(22px, 9999px, 75px, 0); transform: skew(0.4deg); } 25% { clip: rect(90px, 9999px, 15px, 0); transform: skew(0deg); } 30% { clip: rect(50px, 9999px, 88px, 0); transform: skew(-0.3deg); } 35% { clip: rect(10px, 9999px, 45px, 0); transform: skew(0.2deg); } 40% { clip: rect(70px, 9999px, 30px, 0); transform: skew(0.5deg); } 45% { clip: rect(25px, 9999px, 95px, 0); transform: skew(-0.1deg); } 50% { clip: rect(60px, 9999px, 20px, 0); transform: skew(0deg); } 55% { clip: rect(5px, 9999px, 55px, 0); transform: skew(0.3deg); } 60% { clip: rect(75px, 9999px, 35px, 0); transform: skew(-0.4deg); } 65% { clip: rect(18px, 9999px, 80px, 0); transform: skew(0.1deg); } 70% { clip: rect(85px, 9999px, 22px, 0); transform: skew(0.2deg); } 75% { clip: rect(40px, 9999px, 65px, 0); transform: skew(-0.5deg); } 80% { clip: rect(3px, 9999px, 90px, 0); transform: skew(0deg); } 85% { clip: rect(68px, 9999px, 28px, 0); transform: skew(0.4deg); } 90% { clip: rect(33px, 9999px, 77px, 0); transform: skew(-0.2deg); } 95% { clip: rect(98px, 9999px, 10px, 0); transform: skew(0.1deg); } 100% { clip: rect(52px, 9999px, 58px, 0); transform: skew(-0.3deg); } }
        @keyframes glitch-anim-2 { 0% { clip: rect(6px, 9999px, 94px, 0); transform: skew(-0.4deg); } 5% { clip: rect(88px, 9999px, 12px, 0); transform: skew(0.1deg); } 10% { clip: rect(38px, 9999px, 68px, 0); transform: skew(0.3deg); } 15% { clip: rect(20px, 9999px, 85px, 0); transform: skew(-0.2deg); } 20% { clip: rect(72px, 9999px, 18px, 0); transform: skew(0deg); } 25% { clip: rect(10px, 9999px, 90px, 0); transform: skew(0.5deg); } 30% { clip: rect(58px, 9999px, 32px, 0); transform: skew(-0.1deg); } 35% { clip: rect(80px, 9999px, 8px, 0); transform: skew(0.2deg); } 40% { clip: rect(28px, 9999px, 78px, 0); transform: skew(-0.4deg); } 45% { clip: rect(42px, 9999px, 52px, 0); transform: skew(0.3deg); } 50% { clip: rect(92px, 9999px, 25px, 0); transform: skew(0deg); } 55% { clip: rect(15px, 9999px, 82px, 0); transform: skew(-0.2deg); } 60% { clip: rect(62px, 9999px, 42px, 0); transform: skew(0.5deg); } 65% { clip: rect(4px, 9999px, 70px, 0); transform: skew(0.1deg); } 70% { clip: rect(77px, 9999px, 10px, 0); transform: skew(-0.3deg); } 75% { clip: rect(22px, 9999px, 88px, 0); transform: skew(0.4deg); } 80% { clip: rect(50px, 9999px, 48px, 0); transform: skew(-0.1deg); } 85% { clip: rect(95px, 9999px, 38px, 0); transform: skew(0.2deg); } 90% { clip: rect(30px, 9999px, 60px, 0); transform: skew(0deg); } 95% { clip: rect(65px, 9999px, 15px, 0); transform: skew(-0.5deg); } 100% { clip: rect(8px, 9999px, 98px, 0); transform: skew(0.3deg); } }
      `}</style>
    </div>
  );
}