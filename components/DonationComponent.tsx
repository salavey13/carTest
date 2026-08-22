"use client";

import { useState, useEffect, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { sendDonationInvoice } from "@/app/actions";
import { useAppContext } from "@/contexts/AppContext";
import { FaStar, FaGithub, FaTelegram, FaCode, FaSpinner } from "react-icons/fa";
import { toast } from "sonner";
import Confetti from 'react-dom-confetti';
import { donationTranslations, donationBenefits } from "@/components/translations_donate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { VibeContentRenderer } from "@/components/VibeContentRenderer";

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
  const [isPending, startTransition] = useTransition();

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
    toast.info(language === 'en' ? "Doubled your impact! ✨" : "Удвоили ваше влияние! ✨");
  };

  const handleDonate = () => {
    if (!isAuthenticated || !dbUser) {
      toast.error(t.loginToDonate);
      return;
    }

    const amount = parseInt(starAmount);
    if (isNaN(amount) || amount < 10) {
      toast.error(t.minimumDonation);
      return;
    }

    startTransition(async () => {
      try {
        const result = await sendDonationInvoice(dbUser.user_id, amount, feedbackText);
        if (result.success) {
          toast.success(t.invoiceSent);
          setShowConfetti(true);
          setTimeout(() => setShowConfetti(false), 3000);
          setStarAmount("10");
          setFeedbackText("");
        } else {
          toast.error(`${t.error}: ${result.error}`);
        }
      } catch (error) {
        toast.error(t.invoiceError);
        console.error("Donation Error:", error);
      }
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-16 pt-24 text-foreground">
      {/* Language Switcher */}
      <div className="mb-12 flex justify-center">
        <div className="flex space-x-1 bg-card p-1 rounded-full border border-border shadow-inner">
          <Button
            variant="ghost"
            onClick={() => setLanguage('en')}
            className={cn(
                "px-5 py-2 rounded-full transition-colors duration-200 ease-in-out",
                language === 'en'
                ? 'bg-brand-green/20 text-brand-green font-semibold shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            )}
            size="sm"
          >
            English
          </Button>
          <Button
            variant="ghost"
            onClick={() => setLanguage('ru')}
            className={cn(
                "px-5 py-2 rounded-full transition-colors duration-200 ease-in-out",
                language === 'ru'
                ? 'bg-brand-green/20 text-brand-green font-semibold shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            )}
            size="sm"
          >
            Русский
          </Button>
        </div>
      </div>

      {/* Header */}
      <div className="text-center mb-16">
        <motion.h1
          className="text-5xl md:text-7xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-brand-green via-brand-lime to-brand-blue mb-6 font-orbitron"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <VibeContentRenderer content={t.title} />
        </motion.h1>
        <motion.div
          className="text-xl text-muted-foreground max-w-3xl mx-auto"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.6 }}
        >
          <VibeContentRenderer content={t.subtitle} />
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
        {/* Donation Card */}
        <Card className="bg-card border-brand-green/30 shadow-green-glow rounded-2xl">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="text-2xl font-bold text-brand-green font-orbitron">{t.sendStars}</CardTitle>
              <div className="flex items-center space-x-1">
                {[...Array(5)]?.map((_, i) => (
                  <FaStar key={i} className="text-brand-yellow" />
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Presets */}
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
              {presetAmounts.map(amount => (
                <Button
                  key={amount}
                  variant={starAmount === amount.toString() ? "default" : "secondary"}
                  className={cn(
                    "py-3 font-medium w-full transition-all duration-200 ease-in-out rounded-full text-base",
                    starAmount === amount.toString()
                      ? 'bg-brand-green text-black hover:bg-brand-green/90 ring-2 ring-offset-2 ring-offset-card ring-brand-green/70 scale-105 shadow-md'
                      : 'bg-muted hover:bg-muted/80 text-foreground hover:scale-105'
                  )}
                  onClick={() => setStarAmount(amount.toString())}
                  size="lg"
                >
                  {amount}
                </Button>
              ))}
            </div>

            {/* Custom Amount */}
            <div className="space-y-2">
              <Label htmlFor="customAmount" className="text-muted-foreground">{t.customAmount}</Label>
              <div className="flex items-center rounded-full border border-border focus-within:ring-2 focus-within:ring-brand-green focus-within:ring-offset-2 focus-within:ring-offset-card transition-all duration-200 bg-input">
                <span className="pl-4 pr-2 text-muted-foreground"><FaStar/></span>
                <Input
                  id="customAmount"
                  type="number"
                  value={starAmount}
                  onChange={(e) => setStarAmount(e.target.value)}
                  min="10"
                  step="5"
                  className="flex-grow bg-transparent border-none focus:ring-0 focus:outline-none text-foreground placeholder:text-muted-foreground h-12"
                  placeholder="≥ 10"
                />
                <Button
                  onClick={handleDoubleIt}
                  variant="ghost"
                  className="rounded-full m-1 px-4 py-2 text-lg bg-muted hover:bg-muted/80 text-foreground h-10 flex-shrink-0"
                  aria-label={language === 'en' ? "Double amount" : "Удвоить сумму"}
                >
                  x2
                </Button>
              </div>
            </div>

            {/* Message */}
            <div className="space-y-2">
              <Label htmlFor="feedbackMessage" className="text-muted-foreground">{t.yourMessage}</Label>
              <Textarea
                id="feedbackMessage"
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                placeholder={t.messagePlaceholder}
                className="min-h-[100px] focus:ring-brand-green focus:border-brand-green rounded-xl bg-input border-border text-foreground placeholder:text-muted-foreground simple-scrollbar"
              />
            </div>

            {/* Donate Button */}
            <div className="relative pt-2">
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10">
                  <Confetti active={showConfetti} config={confettiConfig} />
              </div>
              <Button
                onClick={handleDonate}
                className="w-full py-6 text-xl font-bold bg-gradient-to-r from-brand-green to-brand-lime text-black hover:from-brand-lime hover:to-brand-green transition-all duration-300 shadow-lg hover:shadow-green-glow rounded-full relative overflow-hidden group disabled:opacity-60 disabled:cursor-not-allowed"
                disabled={!isAuthenticated || isPending}
                size="lg"
              >
                <span className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity duration-300"></span>
                <span className="relative z-10 flex items-center justify-center">
                  {isPending ? (
                    <FaSpinner className="animate-spin mr-2" />
                  ) : (
                    isAuthenticated ? (
                      <>
                        {t.donateButton.replace("{amount}", starAmount)} <FaStar className="inline ml-2 text-yellow-600" />
                      </>
                    ) : (
                      t.loginToDonate
                    )
                  )}
                </span>
              </Button>
            </div>

            {/* Guide Link */}
            <div className="mt-4 text-center">
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="link" className="text-brand-green/80 hover:text-brand-green underline text-xs font-normal">
                    {t.createOwn}
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-card border-brand-green/30 text-foreground max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl simple-scrollbar">
                  <DialogHeader>
                    <DialogTitle className="text-3xl font-bold text-brand-green font-orbitron">{t.createYourOwn}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-6 mt-4 p-1">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                      {[
                        { step: 1, title: t.guide.step1, desc: t.guide.githubSetupDesc, linkText: t.guide.githubSetup, link: "https://github.com/salavey13/carTest", icon: FaGithub },
                        { step: 2, title: t.guide.step2, desc: t.guide.vercelDeployDesc, linkText: t.guide.vercelDeploy, link: "https://vercel.com/docs", icon: FaCode },
                        { step: 3, title: t.guide.step3, desc: t.guide.telegramConfigDesc, linkText: t.guide.telegramConfig, link: "https://core.telegram.org/bots/payments", icon: FaTelegram },
                        { step: 4, title: t.guide.step4, desc: t.guide.customizationDesc, text: t.guide.customization },
                      ].map(item => (
                        <Card key={item.step} className="bg-muted border-border hover:border-brand-green/50 transition-all duration-300 rounded-xl shadow-sm hover:shadow-md">
                          <CardHeader>
                            <div className="flex items-center">
                              <div className="bg-brand-green text-black rounded-full w-8 h-8 flex items-center justify-center mr-3 font-bold flex-shrink-0">
                                {item.step}
                              </div>
                              <CardTitle className="text-xl font-semibold text-foreground">{item.title}</CardTitle>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <p className="text-muted-foreground text-sm">{item.desc}</p>
                            {item.link && item.icon && (
                                <Button asChild variant="link" className="text-brand-green hover:text-brand-lime p-0 h-auto font-medium">
                                    <a
                                      href={item.link}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center text-sm"
                                    >
                                      <item.icon className="mr-1.5" />
                                      {item.linkText}
                                    </a>
                                </Button>
                            )}
                             {item.text && !item.link && (
                               <p className="text-brand-green font-medium text-sm">{item.text}</p>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>

                    <Card className="bg-background border-brand-blue/50 rounded-xl shadow-inner">
                      <CardContent className="p-6">
                        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                          <div className="flex-1">
                            <h3 className="text-xl font-semibold text-foreground mb-2">{t.premiumSupport}</h3>
                            <p className="text-muted-foreground text-sm">{t.guide.supportText}</p>
                          </div>
                          <Button asChild variant="outline" className="bg-brand-blue/80 hover:bg-brand-blue text-white border-brand-blue hover:border-brand-blue rounded-full transition-colors duration-200 ease-in-out">
                            <a
                              href="https://t.me/salavey13"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center px-6 py-2"
                            >
                              <FaTelegram className="mr-2" />
                              {t.contactUs}
                            </a>
                          </Button>
                        </div>
                      </CardContent>
                    </Card>

                    <div className="mt-8 text-center">
                     <Button asChild size="lg" className="bg-gradient-to-r from-brand-green to-brand-lime text-black hover:from-brand-lime hover:to-brand-green font-bold rounded-full shadow-lg hover:scale-105 transform transition-all duration-300">
                        <a
                            href="https://github.com/salavey13/carTest"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-8 py-3 inline-flex items-center"
                          >
                            {t.getTemplate} <FaGithub className="ml-2" />
                        </a>
                     </Button>
                    </div>
                    <DialogClose asChild>
                        <Button variant="outline" className="w-full mt-6 rounded-full text-muted-foreground border-border hover:bg-muted hover:text-foreground hover:border-border/80 transition-colors duration-200 ease-in-out">Закрыть</Button>
                    </DialogClose>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>

        {/* Benefits & Testimonials Section */}
        <div className="space-y-8">
          <Card className="bg-card border-brand-green/30 shadow-green-glow rounded-2xl">
            <CardHeader>
              <CardTitle className="text-2xl font-bold text-brand-green font-orbitron">{t.whyDonate}</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {benefits.map((benefit, index) => (
                        <motion.div
                        key={index}
                        className="bg-gradient-to-br from-muted/50 to-muted/20 p-5 rounded-xl border border-border hover:border-brand-green/50 transition-all duration-300 hover:shadow-lg hover:bg-muted/40"
                        whileHover={{ y: -4, scale: 1.03 }}
                        transition={{ duration: 0.25, type: 'spring', stiffness: 250, damping: 15 }}
                        >
                        <div className="flex items-start space-x-4">
                            <VibeContentRenderer content={benefit.icon} className="text-brand-yellow text-3xl mt-0.5 flex-shrink-0" />
                            <div>
                              <h4 className="font-semibold text-foreground text-lg mb-1">{benefit.title}</h4>
                              <p className="text-muted-foreground text-sm leading-relaxed">{benefit.description}</p>
                            </div>
                        </div>
                        </motion.div>
                    ))}
                </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-brand-green/30 shadow-green-glow rounded-2xl">
             <CardHeader>
                <CardTitle className="text-2xl font-bold text-brand-green font-orbitron">{t.whatCreatorsSay}</CardTitle>
             </CardHeader>
             <CardContent>
                <AnimatePresence mode="wait">
                  <motion.blockquote
                    key={activeTestimonial}
                    initial={{ opacity: 0, y: 20, filter: "blur(5px)" }}
                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    exit={{ opacity: 0, y: -20, filter: "blur(5px)" }}
                    transition={{ duration: 0.5, ease: "circOut" }}
                    className="relative min-h-[180px] p-6 bg-gradient-to-br from-muted to-background rounded-xl border border-border shadow-inner"
                  >
                    <VibeContentRenderer content={t.testimonials[activeTestimonial].text} className="text-foreground/90 italic mb-5 text-lg leading-relaxed" />
                    <footer className="flex justify-between items-center pt-4 border-t border-border/50">
                      <cite className="font-medium text-brand-yellow not-italic text-sm">
                        — {t.testimonials[activeTestimonial].author}
                      </cite>
                      <div className="flex items-center space-x-1">
                        {[...Array(5)].map((_, i) => (
                          <FaStar key={i} className="text-brand-yellow text-sm" />
                        ))}
                      </div>
                    </footer>
                  </motion.blockquote>
                </AnimatePresence>
             </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}