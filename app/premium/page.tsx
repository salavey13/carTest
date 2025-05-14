"use client";
import { motion } from "framer-motion";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  FaStar, FaBrain, FaBolt, FaMicrochip, FaRocket, FaGem,
  FaHeadset, FaBookOpen, FaLockOpen
} from "react-icons/fa6";
import { useAppContext } from "@/contexts/AppContext";
import VibeContentRenderer from "@/components/VibeContentRenderer";

export default function PremiumPage() {
  const { dbUser } = useAppContext();
  const hasActivePremium = dbUser?.subscription_id && dbUser.subscription_id !== "basic_neural_net";

  const premiumFeatures = [
    { icon: <FaBrain className="text-brand-cyan" />, title: "Advanced Neural Pathways", description: "Глубокое погружение в продвинутые концепции CyberDev и Vibe-инженерии. Открой новые горизонты мышления." },
    { icon: <FaBolt className="text-brand-yellow" />, title: "Augmented Prompt Matrix", description: "Обширная библиотека эксклюзивных, высокоэффективных AI-промптов для ускорения твоей креативности и продуктивности." },
    { icon: <FaMicrochip className="text-brand-green" />, title: "High-Bandwidth AI Link", description: "Приоритетный доступ и увеличенные лимиты для взаимодействия с AI-ассистентами в CyberVibe Studio (концептуально)." },
    { icon: <FaRocket className="text-brand-orange" />, title: "Classified Mission Archives", description: "Доступ к закрытым уровням, уникальным квестам и челленджам для настоящих CyberDaemon-ов." },
    { icon: <FaHeadset className="text-brand-purple" />, title: "Direct Co-Pilot Support", description: "Приоритетная поддержка от AI Co-Pilot и команды CyberVibe для решения твоих задач." },
    { icon: <FaBookOpen className="text-brand-pink" />, title: "Exclusive Vibe Lore & Perks", description: "Ранний доступ к новым Vibe Perks, альфа-информации и углубленным материалам по вселенной CyberVibe." },
    { icon: <FaLockOpen className="text-neon-lime" />, title: "Zero Cognitive Friction Interface", description: "Полное отсутствие рекламы и отвлекающих факторов для максимальной концентрации на прокачке." },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-bg via-black to-dark-card text-light-text p-4 pt-24 pb-10">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="container mx-auto max-w-4xl"
      >
        <Card className="bg-dark-card/90 backdrop-blur-xl border border-brand-yellow/60 shadow-2xl shadow-yellow-glow overflow-hidden">
          <CardHeader className="text-center bg-gradient-to-r from-brand-purple/80 via-brand-pink/80 to-brand-orange/80 p-8 md:p-10">
            <FaStar className="text-6xl text-brand-yellow mx-auto mb-4 animate-pulse drop-shadow-[0_0_15px_theme(colors.brand-yellow)]" />
            <CardTitle className="text-4xl md:text-5xl font-orbitron font-bold text-white drop-shadow-lg cyber-text glitch" data-text="COGNITIVE OS: PREMIUM">
              COGNITIVE OS: PREMIUM
            </CardTitle>
            <p className="text-lg text-yellow-200 font-mono mt-2">
              Разблокируй свой максимальный нейро-потенциал!
            </p>
          </CardHeader>

          <CardContent className="p-6 md:p-8 space-y-8">
            {hasActivePremium ? (
                <div className="text-center p-6 bg-brand-green/20 border-2 border-dashed border-brand-green/70 rounded-lg shadow-md">
                    <h2 className="text-2xl font-orbitron font-semibold text-brand-green mb-2 text-shadow-cyber">ПРЕМИУМ ПРОТОКОЛЫ АКТИВИРОВАНЫ!</h2>
                    <p className="text-muted-foreground font-mono">Ты уже используешь все мощности CyberVibe OS. Твой путь к сингулярности открыт, Агент!</p>
                </div>
            ) : (
                <p className="text-center text-lg text-light-text/90 font-mono">
                Получи доступ к эксклюзивным инструментам и протоколам CyberVibe, которые ускорят твою эволюцию и помогут достичь мастерства в цифровой реальности.
                </p>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {premiumFeatures.map((feature, index) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.07 }}
                  className="flex items-start space-x-4 p-4 bg-dark-bg/60 rounded-lg border border-brand-purple/40 hover:border-brand-cyan/70 transition-colors duration-300 hover:shadow-lg hover:shadow-brand-cyan/20 transform hover:-translate-y-1"
                >
                  <div className="text-3xl mt-1 flex-shrink-0 w-8 text-center">{feature.icon}</div>
                  <div>
                    <h3 className="text-lg font-orbitron font-semibold text-light-text">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground font-mono">{feature.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>

            {!hasActivePremium && (
                <div className="text-center mt-10">
                <Link href="/buy-subscription" passHref legacyBehavior>
                    <Button 
                        size="lg" 
                        className="bg-gradient-to-r from-brand-yellow to-brand-orange text-black hover:shadow-yellow-glow font-orbitron text-lg px-10 py-3 shadow-lg transform hover:scale-105 transition-all duration-300 ease-out hover:brightness-110"
                        aria-label="Активировать Премиум ОС"
                    >
                    <FaGem className="mr-2.5" /> АКТИВИРОВАТЬ ПРЕМИУМ ОС
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