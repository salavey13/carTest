"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { sendDonationInvoice } from "@/app/actions";
import { useTelegram } from "@/hooks/useTelegram";
import Footer from "@/components/Footer";

export default function DonationComponent() {
  const { dbUser } = useTelegram();
  const [starAmount, setStarAmount] = useState("10");
  const [feedbackText, setFeedbackText] = useState("");
  const [showDoubleButton, setShowDoubleButton] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [language, setLanguage] = useState("en"); // Default to English

  const handleDoubleIt = () => {
    setStarAmount((prev) => {
      const num = parseInt(prev);
      return isNaN(num) ? "10" : String(num * 2);
    });
  };

  const handleDonate = async () => {
    if (!dbUser) {
      alert("Пожалуйста, сначала войдите через Telegram!");
      return;
    }

    const amount = parseInt(starAmount);
    if (isNaN(amount) || amount <= 0) {
      alert("Пожалуйста, введите действительную сумму пожертвования!");
      return;
    }

    const result = await sendDonationInvoice(dbUser.user_id, amount, feedbackText);
    if (result.success) {
      alert("Счет на пожертвование отправлен! Пожалуйста, проверьте ваш Telegram, чтобы завершить платеж.");
    } else {
      alert(`Упс, что-то пошло не так: ${result.error}`);
    }
  };

  // English Guide
  const englishGuide = (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
      <p className="text-xl font-bold mb-2">
        Want to set up your own donation page in minutes? Here’s how!
      </p>
      <p className="mb-4">
        This is the easiest way to get your donation page live and start collecting stars—legally and tax-free!
      </p>

      <h3 className="text-2xl font-semibold mb-2">Quick Version</h3>
      <ol className="list-decimal ml-6 mb-4">
        <li>Create a blank GitHub repo.</li>
        <li>Fork the template from <a href="t.me/oneSitePlsBot/tips" className="text-blue-500 underline">t.me/oneSitePlsBot/tips</a>.</li>
        <li>Log into v0 with GitHub.</li>
        <li>Deploy to Vercel.</li>
        <li>Add secrets in Vercel.</li>
        <li>Redeploy.</li>
        <li>Activate webhook (subscription or Supabase).</li>
        <li>Set up web app in @BotFather.</li>
        <li>Pin the message in Telegram.</li>
      </ol>

      <h3 className="text-2xl font-semibold mb-2">Full Guide</h3>
      
      <p><strong>Step 1: Create a blank GitHub repo.</strong> This is your project’s home.</p>
      
      <p><strong>Step 2: Fork the template.</strong> Head to <a href="t.me/oneSitePlsBot/tips" className="text-blue-500 underline">t.me/oneSitePlsBot/tips</a>, find "Проект v0 + donate" in the footer, and fork it.</p>
      
      <p><strong>Step 3: Log into v0.</strong> Use your GitHub account to access the dashboard.</p>
      
      <p><strong>Step 4: Deploy to Vercel.</strong> Connect your repo and deploy to get a URL (e.g., <code>v0-donate.vercel.app</code>).</p>
      
      <p><strong>Step 5: Add secrets.</strong> In Vercel settings, add <code>TELEGRAM_BOT_TOKEN</code>, <code>ADMIN_CHAT_ID</code>, and <code>VERCEL_URL</code>.</p>
      
      <p><strong>Step 6: Redeploy.</strong> This applies your secrets.</p>
      
      <p><strong>Step 7: Activate webhook.</strong> In the admin UI, set the webhook. (Note: Needs subscription or Supabase setup.)</p>
      
      <p><strong>Step 8: Set up web app.</strong> In @BotFather, link your Vercel URL as a Telegram web app.</p>
      
      <p><strong>Step 9: Pin the message.</strong> Pin a message in Telegram with your web app link (e.g., <code>t.me/oneSitePlsBot/tips</code>) and a cool image.</p>

      <h3 className="text-2xl font-semibold mb-2">Recap</h3>
      <p>Create repo → Fork template → Log in → Deploy → Add secrets → Redeploy → Activate webhook → Set up web app → Pin message. Boom—you’re live!</p>
      <p className="mt-4 font-bold">Ready? Follow these steps and start collecting stars today!</p>
    </motion.div>
  );

  
// Define individual slides for the English guide
const englishSlides = [
  // Slide 1: Introduction
  (
    <div>
      <p className="text-xl font-bold mb-2">
        Want to set up your own donation page in minutes? Here’s how!
      </p>
      <p className="mb-4">
        This is the easiest way to get your donation page live and start collecting stars—legally and tax-free!
      </p>
    </div>
  ),
  // Slide 2: Quick Version
  (
    <div>
      <h3 className="text-2xl font-semibold mb-2">Quick Version</h3>
      <ol className="list-decimal ml-6 mb-4">
        <li>Create a blank GitHub repo.</li>
        <li>Fork the template from <a href="t.me/oneSitePlsBot/tips" className="text-blue-500 underline">t.me/oneSitePlsBot/tips</a>.</li>
        <li>Log into v0 with GitHub.</li>
        <li>Deploy to Vercel.</li>
        <li>Add secrets in Vercel.</li>
        <li>Redeploy.</li>
        <li>Activate webhook (subscription or Supabase).</li>
        <li>Set up web app in @BotFather.</li>
        <li>Pin the message in Telegram.</li>
      </ol>
    </div>
  ),
  // Slides 3-11: Full Guide Steps
  <p><strong>Step 1: Create a blank GitHub repo.</strong> This is your project’s home.</p>,
  <p><strong>Step 2: Fork the template.</strong> Head to <a href="t.me/oneSitePlsBot/tips" className="text-blue-500 underline">t.me/oneSitePlsBot/tips</a>, find "Проект v0 + donate" in the footer, and fork it.</p>,
  <p><strong>Step 3: Log into v0.</strong> Use your GitHub account to access the dashboard.</p>,
  <p><strong>Step 4: Deploy to Vercel.</strong> Connect your repo and deploy to get a URL (e.g., <code>v0-donate.vercel.app</code>).</p>,
  <p><strong>Step 5: Add secrets.</strong> In Vercel settings, add <code>TELEGRAM_BOT_TOKEN</code>, <code>ADMIN_CHAT_ID</code>, and <code>VERCEL_URL</code>.</p>,
  <p><strong>Step 6: Redeploy.</strong> This applies your secrets.</p>,
  <p><strong>Step 7: Activate webhook.</strong> In the admin UI, set the webhook. (Note: Needs subscription or Supabase setup.)</p>,
  <p><strong>Step 8: Set up web app.</strong> In @BotFather, link your Vercel URL as a Telegram web app.</p>,
  <p><strong>Step 9: Pin the message.</strong> Pin a message in Telegram with your web app link (e.g., <code>t.me/oneSitePlsBot/tips</code>) and a cool image.</p>,
  // Slide 12: Recap
  (
    <div>
      <h3 className="text-2xl font-semibold mb-2">Recap</h3>
      <p>Create repo → Fork template → Log in → Deploy → Add secrets → Redeploy → Activate webhook → Set up web app → Pin message. Boom—you’re live!</p>
      <p className="mt-4 font-bold">Ready? Follow these steps and start collecting stars today!</p>
    </div>
  ),
];

// Render the slideshow
const EnglishGuideSlideshow = (
  <div className="space-y-4">
    {englishSlides.map((slide, index) => (
      <motion.div
        key={index}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: index * 0.3 }}
        className="bg-[hsl(var(--card))] p-4 rounded-lg shadow"
      >
        {slide}
      </motion.div>
    ))}
  </div>
);

  // Russian Guide (Correctly Implemented JSX Constant)
  const russianGuide = (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
      <p className="text-xl font-bold mb-2">
        Хотите настроить свою страницу пожертвований за считанные минуты? Вот как это сделать!
      </p>
      <p className="mb-4">
        Это самый простой способ запустить страницу пожертвований и начать собирать звезды — законно и без налогов!
      </p>

      <h3 className="text-2xl font-semibold mb-2">Краткая версия</h3>
      <ol className="list-decimal ml-6 mb-4">
        <li>Создайте пустой репозиторий на GitHub.</li>
        <li>Сделайте форк шаблона с <a href="t.me/oneSitePlsBot/tips" className="text-blue-500 underline">t.me/oneSitePlsBot/tips</a>.</li>
        <li>Войдите в v0 с помощью GitHub.</li>
        <li>Разверните на Vercel.</li>
        <li>Добавьте секреты в Vercel.</li>
        <li>Переразверните.</li>
        <li>Активируйте вебхук (требуется подписка или Supabase).</li>
        <li>Настройте веб-приложение в @BotFather.</li>
        <li>Закрепите сообщение в Telegram.</li>
      </ol>

      <h3 className="text-2xl font-semibold mb-2">Полное руководство</h3>
      
      <p><strong>Шаг 1: Создайте пустой репозиторий на GitHub.</strong> Это основа вашего проекта.</p>
      
      <p><strong>Шаг 2: Сделайте форк шаблона.</strong> Перейдите на <a href="t.me/oneSitePlsBot/tips" className="text-blue-500 underline">t.me/oneSitePlsBot/tips</a>, найдите "Проект v0 + donate" в футере и сделайте форк.</p>
      
      <p><strong>Шаг 3: Войдите в v0.</strong> Используйте ваш аккаунт GitHub для доступа к панели управления.</p>
      
      <p><strong>Шаг 4: Разверните на Vercel.</strong> Подключите ваш репозиторий и разверните, чтобы получить URL (например, <code>v0-donate.vercel.app</code>).</p>
      
      <p><strong>Шаг 5: Добавьте секреты.</strong> В настройках Vercel добавьте <code>TELEGRAM_BOT_TOKEN</code>, <code>ADMIN_CHAT_ID</code> и <code>VERCEL_URL</code>.</p>
      
      <p><strong>Шаг 6: Переразверните.</strong> Это применит ваши секреты.</p>
      
      <p><strong>Шаг 7: Активируйте вебхук.</strong> В админской панели установите вебхук. (Примечание: требуется подписка или настройка Supabase.)</p>
      
      <p><strong>Шаг 8: Настройте веб-приложение.</strong> В @BotFather свяжите ваш URL Vercel как веб-приложение Telegram.</p>
      
      <p><strong>Шаг 9: Закрепите сообщение.</strong> Закрепите сообщение в Telegram с ссылкой на веб-приложение (например, <code>t.me/oneSitePlsBot/tips</code>) и крутой картинкой.</p>

      <h3 className="text-2xl font-semibold mb-2">Итог</h3>
      <p>Создайте репозиторий → Сделайте форк шаблона → Войдите → Разверните → Добавьте секреты → Переразверните → Активируйте вебхук → Настройте веб-приложение → Закрепите сообщение. Готово — вы в деле!</p>
      <p className="mt-4 font-bold">Готовы? Следуйте этим шагам и начните собирать звезды уже сегодня!</p>
    </motion.div>
  );

  
// Define individual slides for the Russian guide
const russianSlides = [
  // Slide 1: Introduction
  (
    <div>
      <p className="text-xl font-bold mb-2">
        Хотите настроить свою страницу пожертвований за считанные минуты? Вот как это сделать!
      </p>
      <p className="mb-4">
        Это самый простой способ запустить страницу пожертвований и начать собирать звезды — законно и без налогов!
      </p>
    </div>
  ),
  // Slide 2: Quick Version
  (
    <div>
      <h3 className="text-2xl font-semibold mb-2">Краткая версия</h3>
      <ol className="list-decimal ml-6 mb-4">
        <li>Создайте пустой репозиторий на GitHub.</li>
        <li>Сделайте форк шаблона с <a href="t.me/oneSitePlsBot/tips" className="text-blue-500 underline">t.me/oneSitePlsBot/tips</a>.</li>
        <li>Войдите в v0 с помощью GitHub.</li>
        <li>Разверните на Vercel.</li>
        <li>Добавьте секреты в Vercel.</li>
        <li>Переразверните.</li>
        <li>Активируйте вебхук (требуется подписка или Supabase).</li>
        <li>Настройте веб-приложение в @BotFather.</li>
        <li>Закрепите сообщение в Telegram.</li>
      </ol>
    </div>
  ),
  // Slides 3-11: Full Guide Steps
  <p><strong>Шаг 1: Создайте пустой репозиторий на GitHub.</strong> Это основа вашего проекта.</p>,
  <p><strong>Шаг 2: Сделайте форк шаблона.</strong> Перейдите на <a href="t.me/oneSitePlsBot/tips" className="text-blue-500 underline">t.me/oneSitePlsBot/tips</a>, найдите "Проект v0 + donate" в футере и сделайте форк.</p>,
  <p><strong>Шаг 3: Войдите в v0.</strong> Используйте ваш аккаунт GitHub для доступа к панели управления.</p>,
  <p><strong>Шаг 4: Разверните на Vercel.</strong> Подключите ваш репозиторий и разверните, чтобы получить URL (например, <code>v0-donate.vercel.app</code>).</p>,
  <p><strong>Шаг 5: Добавьте секреты.</strong> В настройках Vercel добавьте <code>TELEGRAM_BOT_TOKEN</code>, <code>ADMIN_CHAT_ID</code> и <code>VERCEL_URL</code>.</p>,
  <p><strong>Шаг 6: Переразверните.</strong> Это применит ваши секреты.</p>,
  <p><strong>Шаг 7: Активируйте вебхук.</strong> В админской панели установите вебхук. (Примечание: требуется подписка или настройка Supabase.)</p>,
  <p><strong>Шаг 8: Настройте веб-приложение.</strong> В @BotFather свяжите ваш URL Vercel как веб-приложение Telegram.</p>,
  <p><strong>Шаг 9: Закрепите сообщение.</strong> Закрепите сообщение в Telegram с ссылкой на веб-приложение (например, <code>t.me/oneSitePlsBot/tips</code>) и крутой картинкой.</p>,
  // Slide 12: Recap
  (
    <div>
      <h3 className="text-2xl font-semibold mb-2">Итог</h3>
      <p>Создайте репозиторий → Сделайте форк шаблона → Войдите → Разверните → Добавьте секреты → Переразверните → Активируйте вебхук → Настройте веб-приложение → Закрепите сообщение. Готово — вы в деле!</p>
      <p className="mt-4 font-bold">Готовы? Следуйте этим шагам и начните собирать звезды уже сегодня!</p>
    </div>
  ),
];

// Render the slideshow
const RussianGuideSlideshow = (
  <div className="space-y-4">
    {russianSlides.map((slide, index) => (
      <motion.div
        key={index}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: index * 0.3 }}
        className="bg-[hsl(var(--card))] p-4 rounded-lg shadow"
      >
        {slide}
      </motion.div>
    ))}
  </div>
);
  
  return (
    <>
      <div className="min-h-screen pt-24 flex items-center justify-center bg-[hsl(var(--background))] bg-grid-pattern">
        <motion.div
          className="p-10 bg-[hsl(var(--card))] rounded-xl shadow-2xl max-w-md w-full border border-[hsl(var(--border))]"
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        >
          <h2 className="text-4xl font-extrabold text-[hsl(var(--foreground))] mb-4 text-center tracking-tight cyber-text">
            Поддержите команду Tupabase!
          </h2>
          <p className="text-lg text-[hsl(var(--muted-foreground))] mb-8 text-center text-gradient">
            Ваша поддержка творит чудеса для нашего проекта!
          </p>

          {/* Feedback Input */}
          <motion.input
            type="text"
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
            placeholder="Скажите что-нибудь приятное команде Tupabase!"
            className="w-full p-4 mb-6 rounded-lg bg-[hsl(var(--card))] border border-[hsl(var(--input))] text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] placeholder-[hsl(var(--muted-foreground))]"
            whileFocus={{ boxShadow: "0 0 10px hsl(var(--ring))", scale: 1.02 }}
            transition={{ duration: 0.3 }}
          />

          {/* Star Amount and Double It */}
          <div className="flex items-center mb-8">
            <motion.input
              type="number"
              value={starAmount}
              onChange={(e) => setStarAmount(e.target.value)}
              onBlur={() => setShowDoubleButton(true)}
              min="1"
              className="w-28 p-4 rounded-lg bg-[hsl(var(--card))] border border-[hsl(var(--input))] text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] mr-4"
              whileFocus={{ boxShadow: "0 0 10px hsl(var(--ring))", scale: 1.02 }}
              transition={{ duration: 0.3 }}
            />
            {showDoubleButton && (
              <motion.button
                onClick={handleDoubleIt}
                className="px-5 py-3 bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] font-semibold rounded-lg hover:bg-[hsl(var(--accent),0.8)]"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
                whileHover={{ scale: 1.1, rotate: 5 }}
                whileTap={{ scale: 0.9, rotate: -5 }}
              >
                x2!
              </motion.button>
            )}
          </div>

          {/* Send Stars Button */}
          <motion.button
            onClick={handleDonate}
            className="w-full px-8 py-5 bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] text-2xl font-bold rounded-xl hover:bg-[hsl(var(--primary),0.8)] cyber-text"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            initial={{ boxShadow: "0 0 15px hsl(var(--ring))" }}
            animate={{ boxShadow: "0 0 25px hsl(var(--ring))" }}
            transition={{ repeat: Infinity, duration: 1.2, repeatType: "reverse" }}
          >
            Отправить звезды! ✨
          </motion.button>

          {/* Guide Button */}
          <div className="mt-6 text-center">
            <button
              onClick={() => setIsModalOpen(true)}
              className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] underline"
            >
              Learn how to set up your own donation page (Узнайте, как настроить свою страницу пожертвований)
            </button>
          </div>
        </motion.div>
      </div>

      {/* Modal for the Guide */}
      {isModalOpen && (
        <motion.div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setIsModalOpen(false)}
        >
          <motion.div
            className="bg-[hsl(var(--card))] p-8 rounded-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto border border-[hsl(var(--border))] relative"
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -50, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Language Toggle Button */}
            <div className="absolute top-4 right-4">
              <button
                onClick={() => setLanguage(language === "en" ? "ru" : "en")}
                className="px-3 py-1 bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] rounded-lg hover:bg-[hsl(var(--accent),0.8)]"
              >
                {language === "en" ? "Русский" : "English"}
              </button>
            </div>

            <h2 className="text-3xl font-bold mb-4 text-[hsl(var(--foreground))]">
              {language === "en" ? "How to Set Up Your Own Donation Page" : "Как настроить свою страницу пожертвований"}
            </h2>

            {/* Conditional Rendering of Guide }
            {language === "en" ? englishGuide : russianGuide*/}
            { language === 'en' ? EnglishGuideSlideshow : RussianGuideSlideshow}
            <button
              onClick={() => setIsModalOpen(false)}
              className="mt-6 px-4 py-2 bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] rounded-lg hover:bg-[hsl(var(--primary),0.8)]"
            >
              {language === "en" ? "Close" : "Закрыть"}
            </button>
          </motion.div>
        </motion.div>
      )}

      <Footer />
    </>
  );
}
