"use client";
import { motion } from "framer-motion";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FaStar, FaCalendarAlt, FaAppleAlt, FaChartPie, FaComments, FaAd, FaGem } from "react-icons/fa";
import { useAppContext } from "@/contexts/AppContext"; // To check current subscription

export default function PremiumPage() {
  const { dbUser } = useAppContext(); // Assuming subscription info might be in dbUser.metadata or dbUser.subscription_id

  // Dummy check for active premium, replace with actual logic
  const hasActivePremium = dbUser?.subscription_id || dbUser?.metadata?.is_premium;

  const premiumFeatures = [
    { icon: <FaCalendarAlt className="text-brand-blue" />, title: "Персональное расписание", description: "Адаптивные планы тренировок, созданные специально для вас." },
    { icon: <FaAppleAlt className="text-brand-green" />, title: "Продвинутые планы питания", description: "Детальные рационы и рецепты от диетологов." },
    { icon: <FaChartPie className="text-brand-pink" />, title: "Расширенная статистика", description: "Глубокий анализ вашего прогресса и достижений." },
    { icon: <FaComments className="text-brand-orange" />, title: "Консультации с тренером", description: "Получайте ответы и советы от профессионалов." },
    { icon: <FaAd className="text-red-500" />, title: "Без рекламы", description: "Наслаждайтесь приложением без отвлекающих баннеров." },
    { icon: <FaGem className="text-brand-purple" />, title: "Эксклюзивный контент", description: "Доступ к уникальным тренировкам, статьям и вебинарам." },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white p-4 pt-24">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="container mx-auto max-w-4xl"
      >
        <Card className="bg-card/80 backdrop-blur-md border-border shadow-xl overflow-hidden">
          <CardHeader className="text-center bg-gradient-to-r from-brand-purple via-brand-pink to-brand-orange p-8">
            <FaStar className="text-5xl text-yellow-400 mx-auto mb-3 drop-shadow-lg" />
            <CardTitle className="text-4xl font-bold text-white drop-shadow-md cyber-text">
              Fit10min PREMIUM
            </CardTitle>
            <p className="text-lg text-yellow-200 font-mono mt-1">
              Разблокируй свой максимальный потенциал!
            </p>
          </CardHeader>

          <CardContent className="p-6 md:p-8 space-y-8">
            {hasActivePremium ? (
                <div className="text-center p-6 bg-brand-green/10 border border-brand-green rounded-lg">
                    <h2 className="text-2xl font-semibold text-brand-green mb-2">Премиум Активен!</h2>
                    <p className="text-muted-foreground">Вы уже наслаждаетесь всеми преимуществами Fit10min PREMIUM. Спасибо, что вы с нами!</p>
                </div>
            ) : (
                <p className="text-center text-lg text-muted-foreground font-mono">
                Получите доступ ко всем эксклюзивным функциям и инструментам, которые помогут вам достичь результатов быстрее и эффективнее.
                </p>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {premiumFeatures.map((feature, index) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                  className="flex items-start space-x-4 p-4 bg-muted/30 rounded-lg border border-border"
                >
                  <div className="text-3xl mt-1">{feature.icon}</div>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground">{feature.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>

            {!hasActivePremium && (
                <div className="text-center mt-10">
                <Link href="/buy-subscription" passHref legacyBehavior>
                    <Button size="lg" className="bg-brand-green text-black hover:bg-brand-green/80 font-mono text-lg px-10 py-6 shadow-lg hover:shadow-xl transform hover:scale-105 transition-all">
                    <FaStar className="mr-2" /> Получить Премиум
                    </Button>
                </Link>
                </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}