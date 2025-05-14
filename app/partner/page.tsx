"use client";
import { useAppContext } from "@/contexts/AppContext";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FaUsers, FaGift, FaLink, FaCopy } from "react-icons/fa6";
import { toast } from "sonner";
import { useState } from "react";
import Modal from "@/components/ui/Modal";

export default function PartnerPage() {
  const { user, dbUser } = useAppContext();
  const [isMyReferralsModalOpen, setIsMyReferralsModalOpen] = useState(false);

  const referralLink = user ? `${window.location.origin}/join?ref=${dbUser?.username || user.id}` : "Авторизуйтесь для получения ссылки";
  const invitedCount = dbUser?.metadata?.invited_friends_count || 0;
  const bonusMonths = dbUser?.metadata?.bonus_premium_months || 0;

  const handleCopyLink = () => {
    if (!user) {
      toast.error("Необходимо авторизоваться для копирования ссылки.");
      return;
    }
    navigator.clipboard.writeText(referralLink)
      .then(() => {
        toast.success("Реферальная ссылка скопирована!");
      })
      .catch(err => {
        toast.error("Не удалось скопировать ссылку.");
        console.error("Failed to copy referral link: ", err);
      });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-bg via-black to-dark-card text-light-text p-4 pt-24 pb-16">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="container mx-auto max-w-3xl"
      >
        <Card className="bg-dark-card/90 backdrop-blur-xl border border-brand-blue/50 shadow-2xl shadow-brand-blue/20">
          <CardHeader className="text-center p-6 md:p-8 border-b border-brand-blue/30">
            <FaUsers className="text-6xl text-brand-blue mx-auto mb-4 drop-shadow-[0_0_10px_theme(colors.brand-blue)]" />
            <CardTitle className="text-3xl md:text-4xl font-orbitron font-bold text-brand-blue cyber-text glitch" data-text="ПАРТНЕРСКАЯ ПРОГРАММА">
              ПАРТНЕРСКАЯ ПРОГРАММА
            </CardTitle>
            <CardDescription className="text-muted-foreground font-mono mt-1 text-sm md:text-base">
              Приглашай друзей и получай VIBE-бонусы!
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-8 p-6 md:p-8">
            <section className="text-center">
              <p className="text-lg text-light-text/90 mb-4 font-mono">
                За каждого приглашенного агента, который активирует <strong className="text-brand-green">Премиум ОС</strong>, ты и твой друг получите <strong className="text-brand-yellow">1 месяц Премиум</strong> доступа в подарок!
              </p>
            </section>

            <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Card className="bg-muted/40 p-4 text-center border border-brand-green/50 shadow-md">
                <FaUsers className="text-4xl text-brand-green mx-auto mb-2" />
                <p className="text-3xl font-orbitron font-bold text-light-text">{invitedCount}</p>
                <p className="text-sm text-muted-foreground font-mono">Приглашено Агентов</p>
              </Card>
              <Card className="bg-muted/40 p-4 text-center border border-brand-pink/50 shadow-md">
                <FaGift className="text-4xl text-brand-pink mx-auto mb-2" />
                <p className="text-3xl font-orbitron font-bold text-light-text">{bonusMonths}</p>
                <p className="text-sm text-muted-foreground font-mono">Бонусных Месяцев</p>
              </Card>
            </section>

            <section>
              <h2 className="text-xl font-orbitron text-brand-green mb-3">Твоя Реферальная Ссылка:</h2>
              <div className="flex items-center gap-3">
                <Input
                  type="text"
                  value={referralLink}
                  readOnly
                  className="input-cyber flex-grow text-sm"
                  disabled={!user}
                />
                <Button 
                    onClick={handleCopyLink} 
                    variant="outline" 
                    size="icon" 
                    className="border-brand-green text-brand-green hover:bg-brand-green/20 hover:text-white shadow-sm hover:shadow-md" 
                    disabled={!user}
                    aria-label="Скопировать ссылку"
                >
                  <FaCopy className="h-5 w-5" />
                </Button>
              </div>
            </section>
            
            <section className="text-center mt-8">
                <Button 
                    onClick={() => setIsMyReferralsModalOpen(true)} 
                    variant="default" 
                    className="bg-brand-blue text-black hover:bg-brand-blue/80 font-orbitron text-lg px-8 py-3 shadow-lg hover:shadow-brand-blue/40 transform hover:scale-105 transition-all"
                    disabled={!user}
                >
                    Мои Рефералы
                </Button>
            </section>
          </CardContent>
        </Card>
      </motion.div>

      <Modal
        isOpen={isMyReferralsModalOpen}
        onClose={() => setIsMyReferralsModalOpen(false)}
        title="Мои Рефералы"
        showConfirmButton={false}
        cancelText="Закрыть"
        dialogClassName="bg-dark-card border-brand-blue text-light-text"
        titleClassName="text-brand-blue"
        cancelButtonClassName="text-muted-foreground hover:bg-muted/50"
      >
        {invitedCount > 0 ? (
            <div className="space-y-2">
                <p className="font-mono text-light-text">Список приглашенных вами пользователей:</p>
                {/* Placeholder for actual list */}
                <ul className="list-disc list-inside mt-2 text-sm text-muted-foreground font-mono simple-scrollbar max-h-48 overflow-y-auto pr-2">
                    <li>ReferralUser1 (активировал бонус)</li>
                    <li>ReferralUser2 (ожидает активации)</li>
                     <li>ReferralUser3 (активировал бонус)</li>
                    <li>ReferralUser4 (активировал бонус)</li>
                </ul>
            </div>
        ) : (
            <p className="font-mono text-muted-foreground p-4 text-center">Вы пока никого не пригласили. Поделитесь своей ссылкой, чтобы начать получать бонусы!</p>
        )}
        <p className="mt-4 text-xs text-brand-yellow font-mono animate-pulse text-center">Эта функция находится в стадии альфа-тестирования...</p>
      </Modal>
    </div>
  );
}