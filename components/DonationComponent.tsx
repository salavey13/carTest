"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { sendDonationInvoice } from "@/app/actions";
import { useAppContext } from "@/contexts/AppContext";
import { FaStar, FaGithub, FaTelegram, FaCode } from "react-icons/fa";
import { toast } from "sonner";
import Confetti from 'react-dom-confetti';
import { donationTranslations, donationBenefits } from "@/components/translations_donate";

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

const presetAmounts = [10, 25, 50, 100, 250];

export default function DonationComponent() {
  const { dbUser, isAuthenticated } = useAppContext();
  const [starAmount, setStarAmount] = useState("10");
  const [feedbackText, setFeedbackText] = useState("");
  const [language, setLanguage] = useState<"en" | "ru">("en");
  const [activeTestimonial, setActiveTestimonial] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  const t = donationTranslations[language];
  const benefits = donationBenefits?.map(benefit => ({
  icon: benefit.icon,
  title: benefit.title[language],
  description: benefit.description[language]
}));

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveTestimonial(prev => (prev + 1) % t.testimonials.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [t.testimonials.length]);

  const handleDoubleIt = () => {
    setStarAmount(prev => {
      const num = parseInt(prev);
      return isNaN(num) ? "10" : String(num * 2);
    });
    toast.success(language === 'en' ? "Doubled your impact! ✨" : "Удвоили ваше влияние! ✨");
  };

  const handleDonate = async () => {
    if (!isAuthenticated) {
      toast.error(t.loginToDonate);
      return;
    }

    const amount = parseInt(starAmount);
    if (isNaN(amount)) {
      toast.error(t.invalidAmount);
      return;
    }

    if (amount < 10) {
      toast.error(t.minimumDonation);
      return;
    }

    try {
      const result = await sendDonationInvoice(dbUser.user_id, amount, feedbackText);
      if (result.success) {
        toast.success(t.invoiceSent);
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 3000);
      } else {
        toast.error(`${t.error}: ${result.error}`);
      }
    } catch (error) {
      toast.error(t.invoiceError);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-16 pt-24">
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
      <div className="text-center mb-16">
        <motion.h1 
          className="text-5xl md:text-7xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-yellow-300 to-yellow-500 mb-6"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          dangerouslySetInnerHTML={{ __html: t.title }}
        />
        <motion.p
          className="text-xl text-gray-300 max-w-3xl mx-auto"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          dangerouslySetInnerHTML={{ __html: t.subtitle }}
        />
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
            <h2 className="text-2xl font-bold text-white">{t.sendStars}</h2>
            <div className="flex items-center space-x-1">
              {[...Array(5)]?.map((_, i) => (
                <FaStar key={i} className="text-yellow-400" />
              ))}
            </div>
          </div>

          <div className="grid grid-cols-5 gap-3 mb-8">
            {presetAmounts.map(amount => (
              <motion.button
                key={amount}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`py-3 rounded-lg font-medium ${
                  starAmount === amount.toString() 
                    ? 'bg-yellow-500 text-gray-900' 
                    : 'bg-gray-700 hover:bg-gray-600'
                }`}
                onClick={() => setStarAmount(amount.toString())}
              >
                {amount}
              </motion.button>
            ))}
          </div>

          <div className="mb-8">
            <label className="block text-gray-400 mb-2">{t.customAmount}</label>
            <div className="flex items-center">
              <motion.input
                type="number"
                value={starAmount}
                onChange={(e) => setStarAmount(e.target.value)}
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

          <div className="mb-8">
            <label className="block text-gray-400 mb-2">{t.yourMessage}</label>
            <textarea
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              placeholder={t.messagePlaceholder}
              className="w-full p-4 rounded-lg bg-gray-700 border border-gray-600 text-white focus:outline-none focus:ring-2 focus:ring-yellow-500 min-h-[100px]"
            />
          </div>

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
                  {t.donateButton.replace("{amount}", starAmount)} <FaStar className="inline ml-2" />
                </>
              ) : (
                t.loginToDonate
              )}
            </motion.button>
          </div>

          <div className="mt-6 text-center">
            <button 
              onClick={() => setIsGuideOpen(true)}
              className="text-yellow-400 hover:text-yellow-300 underline text-sm"
            >
              {t.createOwn}
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
            <h3 className="text-2xl font-bold text-white mb-6">{t.whyDonate}</h3>
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
  {donationBenefits.map((benefit, index) => (
    <motion.div
      key={index}
      className="bg-gray-700 p-4 rounded-lg"
      whileHover={{ y: -5 }}
      transition={{ duration: 0.2 }}
    >
      <div className="flex items-start space-x-3">
        <div className="text-yellow-400 mt-1">{benefit.icon}</div>
        <div>
          <h4 className="font-bold text-white">{benefit.title[language]}</h4>
          <p className="text-gray-400 text-sm">{benefit.description[language]}</p>
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
            <h3 className="text-2xl font-bold text-white mb-6">{t.whatCreatorsSay}</h3>
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
                  <p className="text-gray-300 italic mb-4">"{t.testimonials[activeTestimonial].text}"</p>
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-yellow-400">
                      {t.testimonials[activeTestimonial].author}
                    </span>
                    <div className="flex items-center space-x-1">
                      {[...Array(5)].map((_, i) => (
                        <FaStar key={i} className="text-yellow-400" />
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
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
                  <h2 className="text-3xl font-bold text-white">{t.createYourOwn}</h2>
                  <button
                    onClick={() => setIsGuideOpen(false)}
                    className="text-gray-400 hover:text-white"
                  >
                    ✕
                  </button>
                </div>

             

                <div className="space-y-6">
                  {/* Guide Steps */}
<div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
  {/* Step 1 */}
  <motion.div 
    className="bg-gray-700 p-6 rounded-lg border border-gray-600"
    whileHover={{ scale: 1.02 }}
  >
    <div className="flex items-center mb-4">
      <div className="bg-yellow-600 text-white rounded-full w-8 h-8 flex items-center justify-center mr-3">
        1
      </div>
      <h3 className="text-xl font-bold text-white">{t.guide.step1}</h3>
    </div>
    <p className="text-gray-300 mb-4">{t.guide.githubSetupDesc}</p>
    <a 
      href="https://github.com/salavey13/carTest" 
      target="_blank" 
      rel="noopener noreferrer"
      className="inline-flex items-center text-yellow-400 hover:text-yellow-300"
    >
      <FaGithub className="mr-2" />
      {t.guide.githubSetup}
    </a>
  </motion.div>

  {/* Step 2 */}
  <motion.div 
    className="bg-gray-700 p-6 rounded-lg border border-gray-600"
    whileHover={{ scale: 1.02 }}
  >
    <div className="flex items-center mb-4">
      <div className="bg-yellow-600 text-white rounded-full w-8 h-8 flex items-center justify-center mr-3">
        2
      </div>
      <h3 className="text-xl font-bold text-white">{t.guide.step2}</h3>
    </div>
    <p className="text-gray-300 mb-4">{t.guide.vercelDeployDesc}</p>
    <a 
      href="https://vercel.com/docs" 
      target="_blank" 
      rel="noopener noreferrer"
      className="inline-flex items-center text-blue-400 hover:text-blue-300"
    >
      <FaCode className="mr-2" />
      {t.guide.vercelDeploy}
    </a>
  </motion.div>

  {/* Step 3 */}
  <motion.div 
    className="bg-gray-700 p-6 rounded-lg border border-gray-600"
    whileHover={{ scale: 1.02 }}
  >
    <div className="flex items-center mb-4">
      <div className="bg-yellow-600 text-white rounded-full w-8 h-8 flex items-center justify-center mr-3">
        3
      </div>
      <h3 className="text-xl font-bold text-white">{t.guide.step3}</h3>
    </div>
    <p className="text-gray-300 mb-4">{t.guide.telegramConfigDesc}</p>
    <a 
      href="https://core.telegram.org/bots/payments" 
      target="_blank" 
      rel="noopener noreferrer"
      className="inline-flex items-center text-blue-400 hover:text-blue-300"
    >
      <FaTelegram className="mr-2" />
      {t.guide.telegramConfig}
    </a>
  </motion.div>

  {/* Step 4 */}
  <motion.div 
    className="bg-gray-700 p-6 rounded-lg border border-gray-600"
    whileHover={{ scale: 1.02 }}
  >
    <div className="flex items-center mb-4">
      <div className="bg-yellow-600 text-white rounded-full w-8 h-8 flex items-center justify-center mr-3">
        4
      </div>
      <h3 className="text-xl font-bold text-white">{t.guide.step4}</h3>
    </div>
    <p className="text-gray-300 mb-4">{t.guide.customizationDesc}</p>
    <div className="text-yellow-400">
      {t.guide.customization}
    </div>
  </motion.div>
</div>

{/* Support Section */}
<div className="bg-gray-900 p-6 rounded-lg border border-yellow-600/50">
  <div className="flex flex-col md:flex-row items-center justify-between">
    <div className="mb-4 md:mb-0">
      <h3 className="text-xl font-bold text-white mb-2">{t.premiumSupport}</h3>
      <p className="text-gray-300">{t.guide.supportText}</p>
    </div>
    <a
      href="https://t.me/salavey13"
      target="_blank"
      rel="noopener noreferrer"
      className="bg-yellow-600 hover:bg-yellow-500 text-white font-bold py-3 px-6 rounded-lg flex items-center"
    >
      <FaTelegram className="mr-2" />
      {t.contactUs}
    </a>
  </div>
</div>

{/* Get Template Button */}
<div className="mt-8 text-center">
  <a
    href="https://github.com/your-repo-template/generate"
    target="_blank"
    rel="noopener noreferrer"
    className="inline-block bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-gray-900 font-bold text-lg py-4 px-8 rounded-lg"
  >
    {t.getTemplate} <FaGithub className="inline ml-2" />
  </a>
</div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}