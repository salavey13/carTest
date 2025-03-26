"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { sendDonationInvoice } from "@/app/actions";
import { useAppContext } from "@/contexts/AppContext";
import { FaStar, FaGithub, FaTelegram, FaRobot, FaCode } from "react-icons/fa";
import { toast } from "sonner";
import Confetti from 'react-dom-confetti';

const testimonials = [
  {
    text: "This donation system helped me launch my project in days! The guide is crystal clear.",
    author: "Alex, Indie Developer",
    stars: 50
  },
  {
    text: "Never thought setting up payments could be this easy. The Telegram integration is genius!",
    author: "Maria, Content Creator",
    stars: 100
  },
  {
    text: "Got my first donation within hours of setting this up. The templates saved me weeks of work.",
    author: "Sam, Open Source Maintainer",
    stars: 200
  }
];

const benefits = [
  {
    title: "Instant Setup",
    description: "Get your donation page live in minutes, not days",
    icon: <FaCode className="text-2xl" />
  },
  {
    title: "Zero Fees",
    description: "No payment processing fees eating into your donations",
    icon: <FaStar className="text-2xl" />
  },
  {
    title: "Telegram Integration",
    description: "Seamless payments through Telegram Web Apps",
    icon: <FaTelegram className="text-2xl" />
  },
  {
    title: "Open Source",
    description: "Full access to customize and extend the code",
    icon: <FaGithub className="text-2xl" />
  }
];

export default function DonationComponent() {
  const { dbUser, isAuthenticated } = useAppContext();
  const [starAmount, setStarAmount] = useState("10");
  const [feedbackText, setFeedbackText] = useState("");
  const [showDoubleButton, setShowDoubleButton] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [language, setLanguage] = useState("en");
  const [activeTestimonial, setActiveTestimonial] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveTestimonial((prev) => (prev + 1) % testimonials.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleDoubleIt = () => {
    setStarAmount((prev) => {
      const num = parseInt(prev);
      return isNaN(num) ? "10" : String(num * 2);
    });
    toast.success("Doubled your impact! ✨");
  };

  const handleDonate = async () => {
    if (!isAuthenticated) {
      toast.error("Please login via Telegram first!");
      return;
    }

    const amount = parseInt(starAmount);
    if (isNaN(amount)) {
      toast.error("Please enter a valid donation amount!");
      return;
    }

    if (amount < 10) {
      toast.error("Minimum donation is 10 stars");
      return;
    }

    try {
      const result = await sendDonationInvoice(dbUser.user_id, amount, feedbackText);
      if (result.success) {
        toast.success("Invoice sent! Check your Telegram to complete payment");
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 3000);
      } else {
        toast.error(`Error: ${result.error}`);
      }
    } catch (error) {
      toast.error("Failed to send invoice. Please try again.");
    }
  };

  const presetAmounts = [10, 25, 50, 100, 250];

  const confettiConfig = {
    angle: 90,
    spread: 180,
    startVelocity: 40,
    elementCount: 100,
    dragFriction: 0.1,
    duration: 3000,
    stagger: 3,
    width: "10px",
    height: "10px",
    colors: ["#a864fd", "#29cdff", "#78ff44", "#ff718d", "#fdff6a"]
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-16">
      <div className="text-center mb-16">
        <motion.h1 
          className="text-5xl md:text-7xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-yellow-300 to-yellow-500 mb-6"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          Fuel Our Mission
        </motion.h1>
        <motion.p 
          className="text-xl text-gray-300 max-w-3xl mx-auto"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.6 }}
        >
          Support our open-source tools and get <span className="font-bold text-yellow-300">exclusive access</span> to our premium templates and guides
        </motion.p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Donation Card */}
        <motion.div 
          className="bg-gray-800 rounded-xl p-8 shadow-2xl border border-gray-700"
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-2xl font-bold text-white">Send Stars</h2>
            <div className="flex items-center space-x-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <FaStar key={i} className="text-yellow-400" />
              ))}
            </div>
          </div>

          {/* Preset Amounts */}
          <div className="grid grid-cols-5 gap-3 mb-8">
            {presetAmounts.map((amount) => (
              <motion.button
                key={amount}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`py-3 rounded-lg font-medium ${starAmount === amount.toString() ? 
                  'bg-yellow-500 text-gray-900' : 
                  'bg-gray-700 hover:bg-gray-600'}`}
                onClick={() => {
                  setStarAmount(amount.toString());
                  setShowDoubleButton(true);
                }}
              >
                {amount}
              </motion.button>
            ))}
          </div>

          {/* Custom Amount */}
          <div className="mb-8">
            <label className="block text-gray-400 mb-2">Custom Amount</label>
            <div className="flex items-center">
              <motion.input
                type="number"
                value={starAmount}
                onChange={(e) => setStarAmount(e.target.value)}
                onFocus={() => setShowDoubleButton(true)}
                min="10"
                step="5"
                className="w-full p-4 rounded-l-lg bg-gray-700 border border-gray-600 text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                whileFocus={{ boxShadow: "0 0 0 2px rgba(234, 179, 8, 0.5)" }}
              />
              <motion.button
                onClick={handleDoubleIt}
                className="px-5 py-4 bg-yellow-600 text-gray-900 font-bold rounded-r-lg hover:bg-yellow-500 transition-colors"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                x2
              </motion.button>
            </div>
          </div>

          {/* Message */}
          <div className="mb-8">
            <label className="block text-gray-400 mb-2">Your Message (Optional)</label>
            <textarea
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              placeholder="What would you like to say to our team?"
              className="w-full p-4 rounded-lg bg-gray-700 border border-gray-600 text-white focus:outline-none focus:ring-2 focus:ring-yellow-500 min-h-[100px]"
            />
          </div>

          {/* Donate Button */}
          <div className="relative">
            <Confetti active={showConfetti} config={confettiConfig} />
            <motion.button
              onClick={handleDonate}
              className="w-full py-5 bg-gradient-to-r from-yellow-500 to-yellow-600 text-gray-900 text-xl font-bold rounded-lg shadow-lg hover:shadow-yellow-500/30 transition-all"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              disabled={!isAuthenticated}
            >
              {isAuthenticated ? (
                <>
                  Donate {starAmount} Stars <FaStar className="inline ml-2" />
                </>
              ) : (
                "Login with Telegram to Donate"
              )}
            </motion.button>
          </div>

          <div className="mt-6 text-center">
            <button 
              onClick={() => setIsGuideOpen(true)}
              className="text-yellow-400 hover:text-yellow-300 underline text-sm"
            >
              Want to create your own donation system like this?
            </button>
          </div>
        </motion.div>

        {/* Benefits Section */}
        <div>
          <motion.div 
            className="bg-gray-800 rounded-xl p-8 mb-8 border border-gray-700"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <h3 className="text-2xl font-bold text-white mb-6">Why Donate?</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {benefits.map((benefit, index) => (
                <motion.div
                  key={index}
                  className="bg-gray-700 p-4 rounded-lg"
                  whileHover={{ y: -5 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="flex items-start space-x-3">
                    <div className="text-yellow-400 mt-1">{benefit.icon}</div>
                    <div>
                      <h4 className="font-bold text-white">{benefit.title}</h4>
                      <p className="text-gray-400 text-sm">{benefit.description}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Testimonials */}
          <motion.div 
            className="bg-gray-800 rounded-xl p-8 border border-gray-700"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <h3 className="text-2xl font-bold text-white mb-6">What Creators Say</h3>
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTestimonial}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5 }}
                className="relative min-h-[180px]"
              >
                <div className="absolute inset-0 bg-gray-800 rounded-lg p-6">
                  <p className="text-gray-300 italic mb-4">"{testimonials[activeTestimonial].text}"</p>
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-yellow-400">{testimonials[activeTestimonial].author}</span>
                    <div className="flex items-center space-x-1">
                      {[...Array(Math.min(5, Math.floor(testimonials[activeTestimonial].stars / 50))].map((_, i) => (
                        <FaStar key={i} className="text-yellow-400" />
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
            <div className="flex justify-center mt-4 space-x-2">
              {testimonials.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setActiveTestimonial(index)}
                  className={`w-2 h-2 rounded-full ${activeTestimonial === index ? 'bg-yellow-400' : 'bg-gray-600'}`}
                />
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Guide Modal */}
      <AnimatePresence>
        {isGuideOpen && (
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsGuideOpen(false)}
          >
            <motion.div
              className="bg-gray-800 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-gray-700 relative"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-8">
                <div className="flex justify-between items-start mb-6">
                  <h2 className="text-3xl font-bold text-white">
                    Create Your Own Donation System
                  </h2>
                  <button
                    onClick={() => setIsGuideOpen(false)}
                    className="text-gray-400 hover:text-white"
                  >
                    ✕
                  </button>
                </div>

                <div className="mb-6">
                  <div className="flex space-x-2 mb-4">
                    <button
                      onClick={() => setLanguage('en')}
                      className={`px-4 py-2 rounded-lg ${language === 'en' ? 'bg-yellow-600 text-white' : 'bg-gray-700 text-gray-300'}`}
                    >
                      English
                    </button>
                    <button
                      onClick={() => setLanguage('ru')}
                      className={`px-4 py-2 rounded-lg ${language === 'ru' ? 'bg-yellow-600 text-white' : 'bg-gray-700 text-gray-300'}`}
                    >
                      Русский
                    </button>
                  </div>
                </div>

                {language === 'en' ? (
                  <div className="space-y-6">
                    <div className="bg-gray-700 p-6 rounded-lg">
                      <h3 className="text-xl font-bold text-yellow-400 mb-3">Quick Start</h3>
                      <ol className="list-decimal pl-5 space-y-2">
                        <li>Fork our GitHub template repository</li>
                        <li>Deploy to Vercel with one click</li>
                        <li>Configure your Telegram bot</li>
                        <li>Start accepting donations!</li>
                      </ol>
                      <div className="mt-4">
                        <a 
                          href="https://github.com/your-repo" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="inline-flex items-center px-4 py-2 bg-gray-800 rounded-lg text-white hover:bg-gray-700"
                        >
                          <FaGithub className="mr-2" /> Get the Template
                        </a>
                      </div>
                    </div>

                    <div className="bg-gray-700 p-6 rounded-lg">
                      <h3 className="text-xl font-bold text-yellow-400 mb-3">Full Guide</h3>
                      <div className="space-y-4">
                        <div>
                          <h4 className="font-bold text-white">1. GitHub Setup</h4>
                          <p className="text-gray-300">Create a new repository from our template. No coding experience needed.</p>
                        </div>
                        <div>
                          <h4 className="font-bold text-white">2. Vercel Deployment</h4>
                          <p className="text-gray-300">Connect your GitHub account to Vercel for instant hosting.</p>
                        </div>
                        <div>
                          <h4 className="font-bold text-white">3. Telegram Configuration</h4>
                          <p className="text-gray-300">Set up your bot with @BotFather and enable payments.</p>
                        </div>
                        <div>
                          <h4 className="font-bold text-white">4. Customization</h4>
                          <p className="text-gray-300">Easily change colors, text, and images to match your brand.</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-gray-700 p-6 rounded-lg">
                      <h3 className="text-xl font-bold text-yellow-400 mb-3">Premium Support</h3>
                      <p className="text-gray-300 mb-4">
                        Get personalized help from our team to set up your donation system.
                      </p>
                      <a 
                        href="https://t.me/yourchannel" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center px-4 py-2 bg-yellow-600 rounded-lg text-gray-900 hover:bg-yellow-500 font-medium"
                      >
                        <FaTelegram className="mr-2" /> Contact Us on Telegram
                      </a>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="bg-gray-700 p-6 rounded-lg">
                      <h3 className="text-xl font-bold text-yellow-400 mb-3">Быстрый Старт</h3>
                      <ol className="list-decimal pl-5 space-y-2">
                        <li>Сделайте форк нашего шаблона на GitHub</li>
                        <li>Разверните на Vercel в один клик</li>
                        <li>Настройте своего Telegram бота</li>
                        <li>Начинайте принимать пожертвования!</li>
                      </ol>
                      <div className="mt-4">
                        <a 
                          href="https://github.com/your-repo" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="inline-flex items-center px-4 py-2 bg-gray-800 rounded-lg text-white hover:bg-gray-700"
                        >
                          <FaGithub className="mr-2" /> Получить Шаблон
                        </a>
                      </div>
                    </div>

                    <div className="bg-gray-700 p-6 rounded-lg">
                      <h3 className="text-xl font-bold text-yellow-400 mb-3">Полное Руководство</h3>
                      <div className="space-y-4">
                        <div>
                          <h4 className="font-bold text-white">1. Настройка GitHub</h4>
                          <p className="text-gray-300">Создайте новый репозиторий из нашего шаблона. Без опыта программирования.</p>
                        </div>
                        <div>
                          <h4 className="font-bold text-white">2. Развертывание на Vercel</h4>
                          <p className="text-gray-300">Подключите ваш GitHub аккаунт к Vercel для мгновенного хостинга.</p>
                        </div>
                        <div>
                          <h4 className="font-bold text-white">3. Настройка Telegram</h4>
                          <p className="text-gray-300">Настройте бота через @BotFather и включите платежи.</p>
                        </div>
                        <div>
                          <h4 className="font-bold text-white">4. Кастомизация</h4>
                          <p className="text-gray-300">Легко меняйте цвета, текст и изображения под ваш бренд.</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-gray-700 p-6 rounded-lg">
                      <h3 className="text-xl font-bold text-yellow-400 mb-3">Премиум Поддержка</h3>
                      <p className="text-gray-300 mb-4">
                        Получите персональную помощь от нашей команды для настройки вашей системы пожертвований.
                      </p>
                      <a 
                        href="https://t.me/yourchannel" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center px-4 py-2 bg-yellow-600 rounded-lg text-gray-900 hover:bg-yellow-500 font-medium"
                      >
                        <FaTelegram className="mr-2" /> Связаться в Telegram
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}