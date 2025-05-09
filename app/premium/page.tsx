"use client";
import { motion } from "framer-motion";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FaStar, FaBrain, FaBolt, FaMicrochip, FaUsers, FaRocket, FaGem, FaNetworkWired, FaQuestionCircle } from "react-icons/fa"; // FaQuestionCircle is not Fa6
import { FaHeadset, FaBookOpen, FaLockOpen } from "react-icons/fa6"; // FaQuestionCircle -> FaHeadset, FaBookOpen, FaLockOpen
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
        <Card className="bg-dark-card/90 backdrop-blur-md border border-brand-yellow/50 shadow-xl shadow-brand-yellow/20 overflow-hidden">
          <CardHeader className="text-center bg-gradient-to-r from-brand-purple via-brand-pink to-brand-orange p-8">
            <FaStar className="text-5xl text-brand-yellow mx-auto mb-3 drop-shadow-[0_0_15px_theme(colors.brand-yellow)] animate-pulse" />
            <CardTitle className="text-4xl font-orbitron font-bold text-white drop-shadow-md cyber-text glitch" data-text="COGNITIVE OS: PREMIUM">
              COGNITIVE OS: PREMIUM
            </CardTitle>
            <p className="text-lg text-yellow-200 font-mono mt-1">
              Разблокируй свой максимальный нейро-потенциал!
            </p>
          </CardHeader>

          <CardContent className="p-6 md:p-8 space-y-8">
            {hasActivePremium ? (
                <div className="text-center p-6 bg-brand-green/10 border border-brand-green rounded-lg">
                    <h2 className="text-2xl font-orbitron font-semibold text-brand-green mb-2">ПРЕМИУМ ПРОТОКОЛЫ АКТИВИРОВАНЫ!</h2>
                    <p className="text-muted-foreground font-mono">Ты уже используешь все мощности CyberVibe OS. Твой путь к сингулярности открыт!</p>
                </div>
            ) : (
                <p className="text-center text-lg text-muted-foreground font-mono">
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
                  className="flex items-start space-x-4 p-4 bg-dark-bg/50 rounded-lg border border-brand-purple/30 hover:border-brand-cyan/70 transition-colors hover:shadow-md hover:shadow-brand-cyan/20"
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
                    <Button size="lg" className="bg-gradient-to-r from-brand-yellow to-brand-orange text-black hover:shadow-[0_0_20px_theme(colors.brand-yellow)] font-orbitron text-lg px-10 py-3 shadow-lg transform hover:scale-105 transition-all text-glow">
                    <FaGem className="mr-2" /> Активировать Премиум ОС
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