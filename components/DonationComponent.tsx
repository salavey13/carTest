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
      <p className="text-xl font-bold mb-2 text-[hsl(var(--foreground))]">
        Want to set up your own donation page in minutes? Here’s how!
      </p>
      <p className="mb-4 text-[hsl(var(--muted-foreground))]">
        This is the easiest way to get your donation page live and start collecting stars—legally and tax-free!
      </p>

      <h3 className="text-2xl font-semibold mb-2 text-[hsl(var(--primary))]">Quick Version</h3>
      <ol className="list-decimal ml-6 mb-4 text-[hsl(var(--foreground))]">
        <li>Create a blank GitHub repo.</li>
        <li>Fork the template from <a href="t.me/oneSitePlsBot/tips" className="text-blue-500 underline">t.me/oneSitePlsBot/tips</a>.</li>
        <li>Log into v0 with GitHub.</li>
        <li>Deploy to Vercel.</li>
        <li>Add secrets in Vercel.</li>
        <li>Redeploy.</li>
        <li>Activate webhook (subscription or Supabase).</li>
        <li>Set up web app in BotFather.</li>
        <li>Pin the message in Telegram.</li>
      </ol>

      <h3 className="text-2xl font-semibold mb-2 text-[hsl(var(--primary))]">Full Guide</h3>
      <p className="text-[hsl(var(--foreground))]">
        <strong>Step 1: Create a blank GitHub repo.</strong> This is your project’s home.
      </p>
      <p className="text-[hsl(var(--foreground))]">
        <strong>Step 2: Fork the template.</strong> Head to <a href="t.me/oneSitePlsBot/tips" className="text-blue-500 underline">t.me/oneSitePlsBot/tips</a>, find "Проект v0 + donate" in the footer, and fork it.
      </p>
      <p className="text-[hsl(var(--foreground))]">
        <strong>Step 3: Log into v0.</strong> Use your GitHub account to access the dashboard.
      </p>
      <p className="text-[hsl(var(--foreground))]">
        <strong>Step 4: Deploy to Vercel.</strong> Connect your repo and deploy to get a URL (e.g., <code>v0-donate.vercel.app</code>).
      </p>
      <p className="text-[hsl(var(--foreground))]">
        <strong>Step 5: Add secrets.</strong> In Vercel settings, add <code>TELEGRAM_BOT_TOKEN</code>, <code>ADMIN_CHAT_ID</code>, and <code>VERCEL_URL</code>.
      </p>
      <p className="text-[hsl(var(--foreground))]">
        <strong>Step 6: Redeploy.</strong> This applies your secrets.
      </p>
      <p className="text-[hsl(var(--foreground))]">
        <strong>Step 7: Activate webhook.</strong> In the admin UI, set the webhook to <code>v0-donate.vercel.app/api/telegramWebhook</code>. (Note: Needs subscription or Supabase setup.)
      </p>
      <p className="text-[hsl(var(--foreground))]">
        <strong>Step 8: Set up web app.</strong> In BotFather, link your Vercel URL as a Telegram web app.
      </p>
      <p className="text-[hsl(var(--foreground))]">
        <strong>Step 9: Pin the message.</strong> Pin a message in Telegram with your web app link (e.g., <code>t.me/oneSitePlsBot/tips</code>) and a cool image.
      </p>

      <h3 className="text-2xl font-semibold mb-2 text-[hsl(var(--primary))]">Recap</h3>
      <p className="text-[hsl(var(--foreground))]">
        Create repo → Fork template → Log in → Deploy → Add secrets → Redeploy → Activate webhook → Set up web app → Pin message. Boom—you’re live!
      </p>
      <p className="mt-4 font-bold text-[hsl(var(--foreground))]">
        Ready? Follow these steps and start collecting stars today!
      </p>
    </motion.div>
  );

  // Russian Guide
  const russianGuide = (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
      <p className="text-xl font-bold mb-2 text-[hsl(var(--foreground))]">
        Хотите настроить свою страницу пожертвований за считанные минуты? Вот как это сделать!
      </p>
      <p className="mb-4 text-[hsl(var(--muted-foreground))]">
        Это самый простой способ запустить страницу пожертвований и начать собирать звезды — законно и без налогов!
      </p>

      <h3 className="text-2xl font-semibold mb-2 text-[hsl(var(--primary))]">Краткая версия</h3>
      <ol className="list-decimal ml-6 mb-4 text-[hsl(var(--foreground))]">
        <li>Создайте пуст
