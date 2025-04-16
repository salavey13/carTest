"use client";

"use client"
import React from "react"; // Import React if using JSX elements like icons
import { FaCode, FaRobot, FaLock, FaShieldCat, FaTelegram } from "react-icons/fa6"; // Corrected import, added FaShieldCat

export const donationTranslations = {
  en: {
    title: "Fuel Our Mission",
    subtitle: "Support our open-source tools and get <span class='highlight'>exclusive access</span> to our premium templates and guides",
    sendStars: "Send Stars",
    customAmount: "Custom Amount",
    yourMessage: "Your Message (Optional)",
    messagePlaceholder: "What would you like to say to our team?",
    donateButton: "Donate {amount} Stars",
    loginToDonate: "Login with Telegram to Donate",
    createOwn: "Want to create your own donation system like this?",
    whyDonate: "Why Donate?",
    whatCreatorsSay: "What Creators Say",
    createYourOwn: "Create Your Own Donation System",
    quickStart: "Quick Start",
    fullGuide: "Full Guide",
    premiumSupport: "Premium Support",
    contactUs: "Contact Us on Telegram",
    getTemplate: "Get the Template",
    invalidAmount: "Please enter a valid donation amount!",
    minimumDonation: "Minimum donation is 10 stars",
    invoiceSent: "Invoice sent! Check your Telegram to complete payment",
    invoiceError: "Failed to send invoice. Please try again.",
    error: "Error",
    testimonials: [
      {
        text: "This donation system helped me launch my project in days! The guide is crystal clear.",
        author: "Alex, Indie Developer"
      },
      {
        text: "Never thought setting up payments could be this easy. The Telegram integration is genius!",
        author: "Maria, Content Creator"
      },
      {
        text: "Got my first donation within hours of setting this up. The templates saved me weeks of work.",
        author: "Sam, Open Source Maintainer"
      },
      // --- NEW TESTIMONIAL ADDED ---
      {
        text: "This feels exactly like Tony Stark building his suit with Jarvis – the complex engineering is done, now it's time to customize, fly, and kick ass. The Supervibe Studio is the Jarvis for this generation of makers.",
        author: "AI Bot Assistant"
      }
      // --- END NEW TESTIMONIAL ---
    ],
    guide: {
      step1: "Fork our GitHub template repository",
      step2: "Deploy to Vercel with one click",
      step3: "Configure your Telegram bot",
      step4: "Start accepting donations!",
      githubSetup: "1. GitHub Setup",
      githubSetupDesc: "Create a new repository from our template. No coding experience needed.",
      vercelDeploy: "2. Vercel Deployment",
      vercelDeployDesc: "Connect your GitHub account to Vercel for instant hosting.",
      telegramConfig: "3. Telegram Configuration",
      telegramConfigDesc: "Set up your bot with @BotFather and enable payments.",
      customization: "4. Customization",
      customizationDesc: "Easily change colors, text, and images to match your brand.",
      supportText: "Get personalized help from our team to set up your donation system."
    }
  },
  ru: {
    title: "Поддержите Нашу Миссию",
    subtitle: "Поддержите наши open-source инструменты и получите <span class='highlight'>эксклюзивный доступ</span> к премиум шаблонам и руководствам",
    sendStars: "Отправить Звёзды",
    customAmount: "Своя Сумма",
    yourMessage: "Ваше Сообщение (Необязательно)",
    messagePlaceholder: "Что вы хотите сказать нашей команде?",
    donateButton: "Пожертвовать {amount} Звёзд",
    loginToDonate: "Войдите через Telegram чтобы пожертвовать",
    createOwn: "Хотите создать свою систему пожертвований как эта?",
    whyDonate: "Зачем Жертвовать?",
    whatCreatorsSay: "Что Говорят Создатели",
    createYourOwn: "Создайте Свою Систему Пожертвований",
    quickStart: "Быстрый Старт",
    fullGuide: "Полное Руководство",
    premiumSupport: "Премиум Поддержка",
    contactUs: "Связаться в Telegram",
    getTemplate: "Получить Шаблон",
    invalidAmount: "Пожалуйста, введите корректную сумму пожертвования!",
    minimumDonation: "Минимальное пожертвование - 10 звёзд",
    invoiceSent: "Счёт отправлен! Проверьте Telegram для оплаты",
    invoiceError: "Не удалось отправить счёт. Пожалуйста, попробуйте снова.",
    error: "Ошибка",
    testimonials: [
      {
        text: "Эта система пожертвований помогла мне запустить проект за час!",
        author: "Алекс, Независимый Разработчик"
      },
      {
        text: "Никогда не думала, что настройка платежей может быть такой простой. Интеграция с Telegram - гениально!",
        author: "Мария, Создатель Контента"
      },
      {
        text: "Получил первое пожертвование через несколько часов после настройки. Шаблоны сэкономили мне недели работы.",
        author: "Сэм, Разработчик Open-Source"
      },
      // --- NEW TESTIMONIAL ADDED ---
      {
        text: "Это как Тони Старк, собирающий свой костюм с Джарвисом – сложная инженерия уже сделана, теперь время кастомизировать, летать и надирать задницы. Supervibe Studio – это Джарвис для этого поколения мейкеров.",
        author: "AI Bot Assistant"
      }
      // --- END NEW TESTIMONIAL ---
    ],
    guide: {
      step1: "Сделайте форк нашего шаблона на GitHub",
      step2: "Разверните на Vercel в один клик",
      step3: "Настройте своего Telegram бота",
      step4: "Начинайте принимать пожертвования!",
      githubSetup: "1. Настройка GitHub",
      githubSetupDesc: "Создайте новый репозиторий из нашего шаблона. Без опыта программирования.",
      vercelDeploy: "2. Развертывание на Vercel",
      vercelDeployDesc: "Подключите ваш GitHub аккаунт к Vercel для мгновенного хостинга.",
      telegramConfig: "3. Настройка Telegram",
      telegramConfigDesc: "Настройте бота через @BotFather и включите платежи.",
      customization: "4. Кастомизация",
      customizationDesc: "Легко меняйте цвета, текст и изображения под ваш бренд.",
      supportText: "Получите персональную помощь от нашей команды для настройки вашей системы пожертвований."
    }
  }
};

export const donationBenefits = [
   {
    title: {
      en: "Instant Setup",
      ru: "Мгновенная Настройка"
    },
    description: {
      en: "Get your donation page live in minutes, not days",
      ru: "Запустите страницу пожертвований за минуты, а не дни"
    },
    icon: <FaCode className="text-2xl" />
  },
  {
    title: {
      en: "Zero Fees",
      ru: "Без Комиссий"
    },
    description: {
      en: "No payment processing fees eating into your donations",
      ru: "Никаких комиссий за обработку платежей"
    },
    icon: <FaLock className="text-2xl" />
  },
  {
    title: {
      en: "Telegram Integration",
      ru: "Интеграция с Telegram"
    },
    description: {
      en: "Seamless payments through Telegram Web Apps",
      ru: "Бесперебойные платежи через Telegram Web Apps"
    },
    icon: <FaTelegram className="text-2xl" />
  },
  {
    title: {
      en: "Secure & Reliable",
      ru: "Безопасно и Надёжно"
    },
    description: {
      en: "Bank-grade security for all transactions",
      ru: "Банковский уровень безопасности для всех транзакций"
    },
    icon: <FaShieldCat className="text-2xl" /> // Using FaShieldCat from fa6
  },
  {
    title: {
      en: "AI Assistant",
      ru: "AI Помощник"
    },
    description: {
      en: "Get help from our AI to customize your page",
      ru: "Получите помощь от нашего ИИ для настройки страницы"
    },
    icon: <FaRobot className="text-2xl" />
  }
];

export type DonationTranslations = typeof donationTranslations;
export type LanguageKey = keyof DonationTranslations;