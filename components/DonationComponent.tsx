"use client";

import { useState, useEffect, useTransition } from "react"; // Добавлен useTransition
import { motion, AnimatePresence } from "framer-motion";
import { sendDonationInvoice } from "@/app/actions";
import { useAppContext } from "@/contexts/AppContext";
import { FaStar, FaGithub, FaTelegram, FaCode, FaSpinner } from "react-icons/fa"; // Добавлен FaSpinner
import { toast } from "sonner";
import Confetti from 'react-dom-confetti';
import { donationTranslations, donationBenefits } from "@/components/translations_donate";
import { Button } from "@/components/ui/button"; // Используем Shadcn Button
import { Input } from "@/components/ui/input"; // Используем Shadcn Input
import { Textarea } from "@/components/ui/textarea"; // Используем Shadcn Textarea
import { Label } from "@/components/ui/label"; // Используем Shadcn Label
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"; // Используем Shadcn Card
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose, // Добавлен DialogClose
} from "@/components/ui/dialog"; // Используем Shadcn Dialog

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
  const [language, setLanguage] = useState<"en" | "ru">(
    dbUser?.language_code === 'ru' ? 'ru' : 'en'
  );
  const [activeTestimonial, setActiveTestimonial] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);
  // const [isGuideOpen, setIsGuideOpen] = useState(false); // Заменено на Dialog
  const [isPending, startTransition] = useTransition(); // Состояние загрузки

  useEffect(() => {
    if (dbUser?.language_code) {
      setLanguage(dbUser.language_code === 'ru' ? 'ru' : 'en');
    }
  }, [dbUser?.language_code]);

  const t = donationTranslations[language];
  const benefits = donationBenefits.map(benefit => ({
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
    toast.info(language === 'en' ? "Doubled your impact! ✨" : "Удвоили ваше влияние! ✨"); // Изменено на info для разнообразия
  };

  const handleDonate = () => {
    if (!isAuthenticated || !dbUser) { // Добавлена проверка dbUser
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

    startTransition(async () => {
      try {
        const result = await sendDonationInvoice(dbUser.user_id, amount, feedbackText);
        if (result.success) {
          toast.success(t.invoiceSent);
          setShowConfetti(true);
          setTimeout(() => setShowConfetti(false), 3000); // Конфетти остается
          // Очистка полей после успеха
          setStarAmount("10");
          setFeedbackText("");
        } else {
          toast.error(`${t.error}: ${result.error}`);
        }
      } catch (error) {
        toast.error(t.invoiceError);
        console.error("Donation Error:", error); // Логируем ошибку
      }
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-16 pt-24 text-light-text">
      {/* Переключатель языка */}
      <div className="mb-6 flex justify-center md:justify-start">
        <div className="flex space-x-2 mb-4 bg-dark-card p-1 rounded-lg border border-gray-700">
          <Button
            variant={language === 'en' ? 'secondary' : 'ghost'}
            onClick={() => setLanguage('en')}
            className={`px-4 py-2 rounded-md ${language === 'en' ? 'bg-brand-green/20 text-brand-green' : 'text-gray-400 hover:text-white'}`}
          >
            English
          </Button>
          <Button
            variant={language === 'ru' ? 'secondary' : 'ghost'}
            onClick={() => setLanguage('ru')}
            className={`px-4 py-2 rounded-md ${language === 'ru' ? 'bg-brand-green/20 text-brand-green' : 'text-gray-400 hover:text-white'}`}
          >
            Русский
          </Button>
        </div>
      </div>

      {/* Заголовок */}
      <div className="text-center mb-16">
        <motion.h1
          className="text-5xl md:text-7xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-brand-green via-neon-lime to-brand-blue mb-6 font-orbitron" // Обновлен градиент и шрифт
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
        {/* Карточка пожертвования */}
        <Card className="bg-dark-card border-brand-green/30 shadow-[0_0_15px_rgba(0,255,157,0.2)]">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="text-2xl font-bold text-brand-green font-orbitron">{t.sendStars}</CardTitle>
              <div className="flex items-center space-x-1">
                {[...Array(5)]?.map((_, i) => (
                  <FaStar key={i} className="text-yellow-400" />
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Пресеты */}
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
              {presetAmounts.map(amount => (
                <Button
                  key={amount}
                  variant={starAmount === amount.toString() ? "default" : "secondary"}
                  className={`py-3 font-medium w-full transition-all ${
                    starAmount === amount.toString()
                      ? 'bg-brand-green text-black hover:bg-brand-green/90 ring-2 ring-brand-green/50'
                      : 'bg-gray-700 hover:bg-gray-600 text-white'
                  }`}
                  onClick={() => setStarAmount(amount.toString())}
                  size="lg" // Увеличим размер кнопок
                >
                  {amount}
                </Button>
              ))}
            </div>

            {/* Кастомная сумма */}
            <div className="space-y-2">
              <Label htmlFor="customAmount" className="text-gray-400">{t.customAmount}</Label>
              <div className="flex items-center">
                <Input
                  id="customAmount"
                  type="number"
                  value={starAmount}
                  onChange={(e) => setStarAmount(e.target.value)}
                  min="10"
                  step="5" // Шаг 5 удобен для донатов
                  className="rounded-r-none focus-visible:ring-brand-green" // Shadcn стиль фокуса
                  placeholder="≥ 10"
                />
                <Button
                  onClick={handleDoubleIt}
                  variant="outline"
                  className="rounded-l-none border-l-0 px-5 py-[22px] text-lg bg-gray-600 hover:bg-gray-500 text-white" // Стилизация кнопки x2
                  aria-label={language === 'en' ? "Double amount" : "Удвоить сумму"}
                >
                  x2
                </Button>
              </div>
            </div>

            {/* Сообщение */}
            <div className="space-y-2">
              <Label htmlFor="feedbackMessage" className="text-gray-400">{t.yourMessage}</Label>
              <Textarea
                id="feedbackMessage"
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                placeholder={t.messagePlaceholder}
                className="min-h-[100px] focus-visible:ring-brand-green"
              />
            </div>

            {/* Кнопка доната */}
            <div className="relative">
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                  <Confetti active={showConfetti} config={confettiConfig} />
              </div>
              <Button
                onClick={handleDonate}
                className="w-full py-6 text-xl font-bold bg-gradient-to-r from-brand-green to-neon-lime text-black hover:from-neon-lime hover:to-brand-green transition-all duration-300 shadow-lg hover:shadow-brand-green/40"
                disabled={!isAuthenticated || isPending} // Блокировка при отправке
                size="lg"
              >
                {isPending ? (
                  <FaSpinner className="animate-spin mr-2" />
                ) : (
                   isAuthenticated ? (
                    <>
                      {t.donateButton.replace("{amount}", starAmount)} <FaStar className="inline ml-2 text-yellow-400" />
                    </>
                  ) : (
                    t.loginToDonate
                  )
                )}
              </Button>
            </div>

            {/* Ссылка на гайд */}
            <div className="mt-4 text-center">
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="link" className="text-brand-green hover:text-neon-lime underline text-xs width-[100%]">
                    {t.createOwn}
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-dark-card border-brand-green/30 text-light-text max-w-4xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="text-3xl font-bold text-brand-green font-orbitron">{t.createYourOwn}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-6 mt-4">
                    {/* Шаги гайда */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                      {[
                        { step: 1, title: t.guide.step1, desc: t.guide.githubSetupDesc, linkText: t.guide.githubSetup, link: "https://github.com/salavey13/carTest", icon: FaGithub },
                        { step: 2, title: t.guide.step2, desc: t.guide.vercelDeployDesc, linkText: t.guide.vercelDeploy, link: "https://vercel.com/docs", icon: FaCode },
                        { step: 3, title: t.guide.step3, desc: t.guide.telegramConfigDesc, linkText: t.guide.telegramConfig, link: "https://core.telegram.org/bots/payments", icon: FaTelegram },
                        { step: 4, title: t.guide.step4, desc: t.guide.customizationDesc, text: t.guide.customization },
                      ].map(item => (
                        <Card key={item.step} className="bg-gray-700 border-gray-600 hover:border-brand-green/50 transition-colors duration-300">
                          <CardHeader>
                            <div className="flex items-center">
                              <div className="bg-brand-green text-black rounded-full w-8 h-8 flex items-center justify-center mr-3 font-bold">
                                {item.step}
                              </div>
                              <CardTitle className="text-xl font-bold text-white">{item.title}</CardTitle>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <p className="text-gray-300">{item.desc}</p>
                            {item.link && item.icon && (
                                <a
                                  href={item.link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center text-brand-green hover:text-neon-lime font-medium"
                                >
                                  <item.icon className="mr-2" />
                                  {item.linkText}
                                </a>
                            )}
                             {item.text && !item.link && (
                               <p className="text-brand-green font-medium">{item.text}</p>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>

                    {/* Поддержка */}
                    <Card className="bg-gray-900 border-brand-green/50">
                      <CardContent className="p-6">
                        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                          <div className="flex-1">
                            <h3 className="text-xl font-bold text-white mb-2">{t.premiumSupport}</h3>
                            <p className="text-gray-300">{t.guide.supportText}</p>
                          </div>
                          <Button asChild variant="outline" className="bg-brand-blue/80 hover:bg-brand-blue text-white border-brand-blue hover:border-brand-blue">
                            <a
                              href="https://t.me/salavey13"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center"
                            >
                              <FaTelegram className="mr-2" />
                              {t.contactUs}
                            </a>
                          </Button>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Кнопка шаблона */}
                    <div className="mt-6 text-center">
                     <Button asChild size="lg" className="bg-gradient-to-r from-brand-green to-neon-lime text-black hover:from-neon-lime hover:to-brand-green font-bold">
                        <a
                            // TODO: Заменить URL на реальный репозиторий-шаблон, если он есть
                            href="https://github.com/salavey13/carTest" // Пока ссылка на основной репо
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {t.getTemplate} <FaGithub className="inline ml-2" />
                        </a>
                     </Button>
                    </div>
                    <DialogClose asChild>
                        <Button variant="outline" className="w-full mt-4">Закрыть</Button>
                    </DialogClose>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>

        {/* Секция преимуществ и отзывов */}
        <div className="space-y-8">
          {/* Преимущества */}
          <Card className="bg-dark-card border-brand-green/30 shadow-[0_0_15px_rgba(0,255,157,0.2)]">
            <CardHeader>
              <CardTitle className="text-2xl font-bold text-brand-green font-orbitron">{t.whyDonate}</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {benefits.map((benefit, index) => (
                        <motion.div
                        key={index}
                        className="bg-gray-700 p-4 rounded-lg border border-transparent hover:border-brand-green/50 transition-colors"
                        whileHover={{ y: -3 }} // Небольшой подъем при наведении
                        transition={{ duration: 0.2 }}
                        >
                        <div className="flex items-start space-x-3">
                            <div className="text-yellow-400 text-xl mt-1">{benefit.icon}</div> {/* Увеличен размер иконки */}
                            <div>
                            <h4 className="font-semibold text-white text-lg">{benefit.title}</h4> {/* Увеличен заголовок */}
                            <p className="text-gray-300 text-sm">{benefit.description}</p>
                            </div>
                        </div>
                        </motion.div>
                    ))}
                </div>
            </CardContent>
          </Card>

          {/* Отзывы */}
          <Card className="bg-dark-card border-brand-green/30 shadow-[0_0_15px_rgba(0,255,157,0.2)]">
             <CardHeader>
                <CardTitle className="text-2xl font-bold text-brand-green font-orbitron">{t.whatCreatorsSay}</CardTitle>
             </CardHeader>
             <CardContent>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTestimonial}
                    initial={{ opacity: 0, y: 10 }} // Анимация появления снизу
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }} // Анимация исчезновения вверх
                    transition={{ duration: 0.5 }}
                    className="relative min-h-[160px] p-6 bg-gray-700 rounded-lg" // Фон для отзыва
                  >
                    <p className="text-gray-200 italic mb-4 text-lg">"{t.testimonials[activeTestimonial].text}"</p>
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-yellow-400">
                        — {t.testimonials[activeTestimonial].author}
                      </span>
                      <div className="flex items-center space-x-1">
                        {[...Array(5)].map((_, i) => (
                          <FaStar key={i} className="text-yellow-400" />
                        ))}
                      </div>
                    </div>
                  </motion.div>
                </AnimatePresence>
             </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
