"use client";

import React from "react";
import { FaCode, FaRobot, FaLock, FaShieldCat, FaTelegram, FaAtom, FaBrain, FaGithub, FaRocket, FaLightbulb, FaMoneyBillWave, FaHatWizard } from "react-icons/fa6"; // Added more icons for testimonials

export const donationTranslations = {
  en: {
    title: "Supercharge Our Digital Sorcery! <FaHatWizard className='inline text-brand-purple' />",
    subtitle: "Your generous star-dust fuels our open-source spellbook! Donate and unlock <span class='highlight'>LEGENDARY access</span> to forbidden templates & ancient guides of web-wisdom!",
    sendStars: "Conjure Stars", customAmount: "Custom Star Amount", yourMessage: "Incantation (Optional)", messagePlaceholder: "Whisper your desires to the dev-spirits...", donateButton: "Unleash {amount} Stars!", loginToDonate: "Login with Telegram to Donate", createOwn: "Forge your own donation altar?", whyDonate: "Why Channel Your Energy?", whatCreatorsSay: "Echoes from the Ether (Creators)", createYourOwn: "Summon Your Donation System", quickStart: "Quick Spell", fullGuide: "The Grand Grimoire", premiumSupport: "Archmage Support", contactUs: "Contact Us (TG Ether)", getTemplate: "Claim Template Artifact", invalidAmount: "Star-flux capacitor error!", minimumDonation: "Min 10 stars to bend reality", invoiceSent: "Star-invoice materialized! Check Telegram", invoiceError: "Failed to manifest invoice", error: "Chaos Error",
    testimonials: [
      {
        text: "<span>Literally, after donating, my WiFi speed increased by <strong>500%</strong>! My toaster now predicts the stock market! </span><FaMoneyBillWave className='inline text-green-400 mx-1 animate-pulse' /><span>This is not a drill!</span>",
        author: "Sir Reginald Moneybags IV, Esq."
      },
      {
        text: "<span>I clicked 'Donate', and a <FaRocket className='inline text-neon-lime mx-1 animate-bounce' /> ACTUAL ROCKET appeared in my backyard, ready to take me to Mars! The Telegram integration is smoother than a baby unicorn's mane.</span>",
        author: "Zara 'StarHopper' Quantumleap"
      },
      {
        text: "<span>My cat <FaShieldCat className='text-cyan-400 inline mx-1' /> started speaking fluent JavaScript and debugging my code after I sent some stars. The templates? They're like cheat codes for reality. 10/10, would donate my soul again.</span>",
        author: "Anonymous Catto-mancer"
      },
      {
        text: "<span>This isn't just a donation; it's an investment in interdimensional peace! <FaAtom className='inline text-purple-400 mr-1 animate-spin-slow'/> My startup went from zero to hero, acquired by aliens for a trillion space-credits. All thanks to this platform's cosmic vibe! Pure <strong>CyberVibe!</strong></span><FaBrain className='inline text-pink-400 ml-1 animate-ping' />",
        author: "Emperor Zorp Glorbax (Definitely Human)"
      },
      {
        text: "<span>I thought it was a joke, but then my rubber duck <FaLightbulb className='inline text-yellow-300 mx-1' /> started giving me S-tier startup ideas! This platform is a miracle, a blessing, a... a digital taco that grants wishes!</span>",
        author: "Dr. Quackentien Von Duckberg"
      }
    ],
    guide: { step1: "Fork GitHub template", step2: "Deploy to Vercel (1-click)", step3: "Configure Telegram bot", step4: "Accept donations!", githubSetup: "1. GitHub Setup", githubSetupDesc: "Create repo from template. No code needed.", vercelDeploy: "2. Vercel Deployment", vercelDeployDesc: "Connect GitHub to Vercel.", telegramConfig: "3. Telegram Config", telegramConfigDesc: "Setup bot with @BotFather, enable payments.", customization: "4. Customize", customizationDesc: "Change colors, text, images easily.", supportText: "Get personalized setup help." }
  },
  ru: {
    title: "Заряди Нашу Цифровую Магию! <FaHatWizard className='inline text-brand-purple' />",
    subtitle: "Ваша щедрая звездная пыль питает нашу книгу заклинаний с открытым исходным кодом! Пожертвуйте и откройте <span class='highlight'>ЛЕГЕНДАРНЫЙ доступ</span> к запретным шаблонам и древним руководствам веб-мудрости!",
    sendStars: "Сотворить Звёзды", customAmount: "Своя Сумма Звёзд", yourMessage: "Заклинание (опц.)", messagePlaceholder: "Прошепчите свои желания духам разработки...", donateButton: "Высвободить {amount} Звёзд!", loginToDonate: "Войдите через Telegram", createOwn: "Создать свой алтарь для донатов?", whyDonate: "Зачем Направлять Энергию?", whatCreatorsSay: "Эхо из Эфира (Создатели)", createYourOwn: "Призовите Свою Систему Донатов", quickStart: "Быстрое Заклинание", fullGuide: "Великий Гримуар", premiumSupport: "Поддержка Архимага", contactUs: "Связь (TG Эфир)", getTemplate: "Забрать Артефакт-Шаблон", invalidAmount: "Ошибка конденсатора звёздного потока!", minimumDonation: "Мин 10 звёзд, чтобы изменить реальность", invoiceSent: "Звёздный счёт материализован! Проверьте Telegram", invoiceError: "Не удалось материализовать счёт", error: "Ошибка Хаоса",
    testimonials: [
      {
        text: "<span>Буквально, после доната, моя скорость WiFi увеличилась на <strong>500%</strong>! Мой тостер теперь предсказывает фондовый рынок! </span><FaMoneyBillWave className='inline text-green-400 mx-1 animate-pulse' /><span>Это не учебная тревога!</span>",
        author: "Сэр Реджинальд ДенежныйМешок IV"
      },
      {
        text: "<span>Я нажал 'Донат', и <FaRocket className='inline text-neon-lime mx-1 animate-bounce' /> НАСТОЯЩАЯ РАКЕТА появилась у меня во дворе, готовая отвезти меня на Марс! Интеграция с Telegram гладкая, как грива младенца-единорога.</span>",
        author: "Зара 'Звездопрыг' Квантумскок"
      },
      {
        text: "<span>Мой кот <FaShieldCat className='text-cyan-400 inline mx-1' /> начал говорить на чистом JavaScript и дебажить мой код после того, как я отправил немного звёзд. А шаблоны? Это как чит-коды для реальности. 10/10, пожертвовал бы душу снова.</span>",
        author: "Анонимный Кото-мант"
      },
      {
        text: "<span>Это не просто донат; это инвестиция в межпространственный мир! <FaAtom className='inline text-purple-400 mr-1 animate-spin-slow'/> Мой стартап взлетел от нуля до героя, был куплен инопланетянами за триллион космо-кредитов. Всё благодаря космическому вайбу этой платформы! Чистый <strong>КиберВайб!</strong></span><FaBrain className='inline text-pink-400 ml-1 animate-ping' />",
        author: "Император Зорп Глорбакс (Точно Человек)"
      },
      {
        text: "<span>Я думал, это шутка, но потом моя резиновая уточка <FaLightbulb className='inline text-yellow-300 mx-1' /> начала выдавать мне S-티어 стартап-идеи! Эта платформа - чудо, благословение, ... цифровой тако, исполняющий желания!</span>",
        author: "Доктор Крякенштейн Фон Уткенбург"
      }
    ],
    guide: { step1: "Форк шаблона GitHub", step2: "Деплой на Vercel (1 клик)", step3: "Настройка Telegram бота", step4: "Принимайте донаты!", githubSetup: "1. GitHub", githubSetupDesc: "Создайте репо из шаблона. Код не нужен.", vercelDeploy: "2. Vercel", vercelDeployDesc: "Подключите GitHub к Vercel.", telegramConfig: "3. Telegram", telegramConfigDesc: "Настройте бота, включите платежи.", customization: "4. Кастом", customizationDesc: "Меняйте цвета, текст, картинки.", supportText: "Персональная помощь в настройке." }
  }
};

// Export benefits and types as before...
export const donationBenefits = [ { title: { en: "Instant Setup", ru: "Мгновенная Настройка" }, description: { en: "Live in minutes", ru: "Запуск за минуты" }, icon: <FaCode className="text-2xl" /> }, { title: { en: "Zero Fees", ru: "Без Комиссий" }, description: { en: "No processing fees", ru: "Нет комиссий" }, icon: <FaLock className="text-2xl" /> }, { title: { en: "Telegram Integration", ru: "Интеграция Telegram" }, description: { en: "Seamless payments via Web Apps", ru: "Платежи через Web Apps" }, icon: <FaTelegram className="text-2xl" /> }, { title: { en: "Secure & Reliable", ru: "Безопасно" }, description: { en: "Bank-grade security", ru: "Банковский уровень" }, icon: <FaShieldCat className="text-2xl" /> }, { title: { en: "AI Assistant", ru: "AI Помощник" }, description: { en: "AI help for customization", ru: "AI поможет настроить" }, icon: <FaRobot className="text-2xl" /> } ];
export type DonationTranslations = typeof donationTranslations;
export type LanguageKey = keyof DonationTranslations;