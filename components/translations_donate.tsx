"use client";

import React from "react";
import { FaCode, FaRobot, FaLock, FaShieldCat, FaTelegram, FaAtom, FaBrain, FaGithub } from "react-icons/fa6";

export const donationTranslations = {
  en: {
    title: "Fuel Our Mission",
    subtitle: "Support our open-source tools and get <span class='highlight'>exclusive access</span> to premium templates & guides",
    sendStars: "Send Stars", customAmount: "Custom Amount", yourMessage: "Your Message (Optional)", messagePlaceholder: "What would you like to say?", donateButton: "Donate {amount} Stars", loginToDonate: "Login with Telegram to Donate", createOwn: "Want your own donation system?", whyDonate: "Why Donate?", whatCreatorsSay: "What Creators Say", createYourOwn: "Create Your Donation System", quickStart: "Quick Start", fullGuide: "Full Guide", premiumSupport: "Premium Support", contactUs: "Contact Us (TG)", getTemplate: "Get Template", invalidAmount: "Invalid amount!", minimumDonation: "Min 10 stars", invoiceSent: "Invoice sent! Check Telegram", invoiceError: "Failed to send invoice", error: "Error",
    testimonials: [
      { text: "Launched my project in days! Clear guide.", author: "Alex, Indie Dev" },
      { text: "Payments setup was easy. TG integration rocks!", author: "Maria, Content Creator" },
      { text: "Got first donation in hours. Templates saved weeks.", author: "Sam, OS Maintainer" },
      // --- CyberVibe Testimonial ---
      {
        text: "<FaAtom class='inline text-purple-400 mr-1'/>Feels like Tony Stark building his suit – complex engineering done, now customize & fly. Supervibe Studio is the Jarvis for this generation. Pure **CyberVibe!**<FaBrain class='inline text-purple-400 ml-1'/>",
        author: "AI Bot Assistant"
      }
      // --- END CyberVibe Testimonial ---
    ],
    guide: { step1: "Fork GitHub template", step2: "Deploy to Vercel (1-click)", step3: "Configure Telegram bot", step4: "Accept donations!", githubSetup: "1. GitHub Setup", githubSetupDesc: "Create repo from template. No code needed.", vercelDeploy: "2. Vercel Deployment", vercelDeployDesc: "Connect GitHub to Vercel.", telegramConfig: "3. Telegram Config", telegramConfigDesc: "Setup bot with @BotFather, enable payments.", customization: "4. Customize", customizationDesc: "Change colors, text, images easily.", supportText: "Get personalized setup help." }
  },
  ru: {
    title: "Поддержите Миссию",
    subtitle: "Поддержите open-source и получите <span class='highlight'>эксклюзивный доступ</span> к премиум шаблонам",
    sendStars: "Отправить Звёзды", customAmount: "Своя Сумма", yourMessage: "Сообщение (опц.)", messagePlaceholder: "Что хотите сказать команде?", donateButton: "Донат {amount} Звёзд", loginToDonate: "Войдите через Telegram", createOwn: "Хотите свою систему донатов?", whyDonate: "Зачем?", whatCreatorsSay: "Отзывы", createYourOwn: "Создайте Свою Систему", quickStart: "Быстрый Старт", fullGuide: "Гайд", premiumSupport: "Поддержка", contactUs: "Связь (TG)", getTemplate: "Шаблон", invalidAmount: "Неверная сумма!", minimumDonation: "Мин 10 звёзд", invoiceSent: "Счёт в Telegram!", invoiceError: "Ошибка отправки счёта", error: "Ошибка",
    testimonials: [
      { text: "Запустил проект за час!", author: "Алекс, Разраб" },
      { text: "Настройка платежей - изи. TG - гениально!", author: "Мария, Контент" },
      { text: "Первый донат за часы. Шаблоны = -недели.", author: "Сэм, Open-Source" },
      // --- CyberVibe Testimonial ---
       {
        text: "<FaAtom class='inline text-purple-400 mr-1'/>Как Тони Старк костюм собирает – инженерия сделана, теперь кастом, полёт, экшн! Supervibe Studio – Джарвис для мейкеров. Чистый **CyberVibe!**<FaBrain class='inline text-purple-400 ml-1'/>",
        author: "AI Bot Assistant"
      }
      // --- END CyberVibe Testimonial ---
    ],
    guide: { step1: "Форк шаблона GitHub", step2: "Деплой на Vercel (1 клик)", step3: "Настройка Telegram бота", step4: "Принимайте донаты!", githubSetup: "1. GitHub", githubSetupDesc: "Создайте репо из шаблона. Код не нужен.", vercelDeploy: "2. Vercel", vercelDeployDesc: "Подключите GitHub к Vercel.", telegramConfig: "3. Telegram", telegramConfigDesc: "Настройте бота, включите платежи.", customization: "4. Кастом", customizationDesc: "Меняйте цвета, текст, картинки.", supportText: "Персональная помощь в настройке." }
  }
};

// Export benefits and types as before...
export const donationBenefits = [ { title: { en: "Instant Setup", ru: "Мгновенная Настройка" }, description: { en: "Live in minutes", ru: "Запуск за минуты" }, icon: <FaCode className="text-2xl" /> }, { title: { en: "Zero Fees", ru: "Без Комиссий" }, description: { en: "No processing fees", ru: "Нет комиссий" }, icon: <FaLock className="text-2xl" /> }, { title: { en: "Telegram Integration", ru: "Интеграция Telegram" }, description: { en: "Seamless payments via Web Apps", ru: "Платежи через Web Apps" }, icon: <FaTelegram className="text-2xl" /> }, { title: { en: "Secure & Reliable", ru: "Безопасно" }, description: { en: "Bank-grade security", ru: "Банковский уровень" }, icon: <FaShieldCat className="text-2xl" /> }, { title: { en: "AI Assistant", ru: "AI Помощник" }, description: { en: "AI help for customization", ru: "AI поможет настроить" }, icon: <FaRobot className="text-2xl" /> } ];
export type DonationTranslations = typeof donationTranslations;
export type LanguageKey = keyof DonationTranslations;