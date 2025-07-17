"use client";

import React from "react";
import { FaRobot, FaLock, FaShieldCat, FaTelegram, FaAtom, FaBrain, FaGithub, FaCode, FaRocket } from "react-icons/fa6";

export const donationTranslations = {
  en: {
    title: "::FaRocket:: Fuel Our Mission",
    subtitle: "Support our open-source tools and get **exclusive access** to premium templates & guides.",
    sendStars: "Send Stars",
    customAmount: "Custom Amount",
    yourMessage: "Your Message (Optional)",
    messagePlaceholder: "What would you like to say?",
    donateButton: "Donate {amount} Stars",
    loginToDonate: "Login with Telegram to Donate",
    createOwn: "Want your own donation system?",
    whyDonate: "Why Donate?",
    whatCreatorsSay: "What Creators Say",
    createYourOwn: "Create Your Donation System",
    quickStart: "Quick Start",
    fullGuide: "Full Guide",
    premiumSupport: "Premium Support",
    contactUs: "Contact Us (TG)",
    getTemplate: "Get Template",
    invalidAmount: "Invalid amount!",
    minimumDonation: "Min 10 stars",
    invoiceSent: "Invoice sent! Check Telegram",
    invoiceError: "Failed to send invoice",
    error: "Error",
    testimonials: [
      { text: "Launched my project in days! The guide is crystal clear.", author: "Alex, Indie Dev" },
      { text: "Payments setup was a breeze. Telegram integration rocks!", author: "Maria, Content Creator" },
      { text: "Got my first donation within hours. The templates saved me weeks of work.", author: "Sam, OS Maintainer" },
      {
        text: "::FaAtom className='inline text-brand-purple mr-1':: This feels like Tony Stark building his suit – the complex engineering is done, now I can just customize and fly. This is the Jarvis for our generation. Pure **CyberVibe!** ::FaBrain className='inline text-brand-purple ml-1'::",
        author: "AI Assistant"
      }
    ],
    guide: { step1: "Fork GitHub template", step2: "Deploy to Vercel (1-click)", step3: "Configure Telegram bot", step4: "Accept donations!", githubSetup: "1. GitHub Setup", githubSetupDesc: "Create repo from template. No code needed.", vercelDeploy: "2. Vercel Deployment", vercelDeployDesc: "Connect GitHub to Vercel.", telegramConfig: "3. Telegram Config", telegramConfigDesc: "Setup bot with @BotFather, enable payments.", customization: "4. Customize", customizationDesc: "Change colors, text, images easily.", supportText: "Get personalized setup help." }
  },
  ru: {
    title: "::FaRocket:: Поддержите Нашу Миссию",
    subtitle: "Поддержите наши open-source инструменты и получите **эксклюзивный доступ** к премиум шаблонам и гайдам.",
    sendStars: "Отправить Звёзды",
    customAmount: "Своя Сумма",
    yourMessage: "Сообщение (опц.)",
    messagePlaceholder: "Что хотите сказать команде?",
    donateButton: "Донат {amount} Звёзд",
    loginToDonate: "Войдите через Telegram",
    createOwn: "Хотите свою систему донатов?",
    whyDonate: "Зачем Донатить?",
    whatCreatorsSay: "Что Говорят Создатели",
    createYourOwn: "Создайте Свою Систему Донатов",
    quickStart: "Быстрый Старт",
    fullGuide: "Полный Гайд",
    premiumSupport: "Премиум Поддержка",
    contactUs: "Связаться с нами (TG)",
    getTemplate: "Получить Шаблон",
    invalidAmount: "Неверная сумма!",
    minimumDonation: "Минимум 10 звёзд",
    invoiceSent: "Счёт отправлен в Telegram!",
    invoiceError: "Ошибка отправки счёта",
    error: "Ошибка",
    testimonials: [
      { text: "Запустил свой проект за пару дней! Гайд очень понятный.", author: "Алекс, Инди-разработчик" },
      { text: "Настройка платежей оказалась очень простой. Интеграция с Telegram – это нечто!", author: "Мария, Создатель контента" },
      { text: "Получил первый донат за несколько часов. Шаблоны сэкономили мне недели работы.", author: "Сэм, Мейнтейнер OS" },
      {
        text: "::FaAtom className='inline text-brand-purple mr-1':: Ощущение, будто я Тони Старк, собирающий свой костюм – вся сложная инженерия уже сделана, осталось только настроить и лететь. Это настоящий Джарвис для нашего поколения. Чистый **CyberVibe!** ::FaBrain className='inline text-brand-purple ml-1'::",
        author: "AI Ассистент"
      }
    ],
    guide: { step1: "Форк шаблона GitHub", step2: "Деплой на Vercel (1 клик)", step3: "Настройка Telegram бота", step4: "Принимайте донаты!", githubSetup: "1. GitHub", githubSetupDesc: "Создайте репо из шаблона. Код не нужен.", vercelDeploy: "2. Vercel", vercelDeployDesc: "Подключите GitHub к Vercel.", telegramConfig: "3. Telegram", telegramConfigDesc: "Настройте бота, включите платежи.", customization: "4. Кастомизация", customizationDesc: "Меняйте цвета, текст, картинки.", supportText: "Персональная помощь в настройке." }
  }
};

export const donationBenefits = [
    { title: { en: "Instant Setup", ru: "Мгновенная Настройка" }, description: { en: "Go live in minutes, not weeks.", ru: "Запуск за минуты, а не недели." }, icon: "::FaCode::" },
    { title: { en: "Zero Platform Fees", ru: "Нулевые Комиссии" }, description: { en: "You keep 100% of the donation.", ru: "100% доната остается вам." }, icon: "::FaLock::" },
    { title: { en: "Telegram Integrated", ru: "Интеграция с Telegram" }, description: { en: "Seamless payments via Web Apps.", ru: "Бесшовные платежи через Web Apps." }, icon: "::FaTelegram::" },
    { title: { en: "Secure & Reliable", ru: "Безопасно и Надежно" }, description: { en: "Powered by Stripe for bank-grade security.", ru: "На базе Stripe для банковского уровня безопасности." }, icon: "::FaShieldCat::" },
    { title: { en: "AI Co-pilot", ru: "AI-Помощник" }, description: { en: "Built-in AI to help you customize everything.", ru: "Встроенный AI для помощи в настройке." }, icon: "::FaRobot::" }
];

export type DonationTranslations = typeof donationTranslations;
export type LanguageKey = keyof DonationTranslations;