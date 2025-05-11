// /app/partner/page.tsx
"use client";
import { useAppContext } from "@/contexts/AppContext";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FaUsers, FaGift, FaLink, FaCopy } from "react-icons/fa";
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
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white p-4 pt-24">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="container mx-auto max-w-3xl"
      >
        <Card className="bg-card/80 backdrop-blur-md border-border shadow-xl">
          <CardHeader className="text-center">
            <FaUsers className="text-5xl text-brand-blue mx-auto mb-3 drop-shadow-lg" />
            <CardTitle className="text-3xl font-bold text-brand-blue cyber-text">
              Партнерская Программа
            </CardTitle>
            <CardDescription className="text-muted-foreground font-mono mt-1">
              Приглашай друзей и получай бонусы!
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-8 p-6">
            <section className="text-center">
              <p className="text-lg text-muted-foreground mb-4">
                За каждого приглашенного друга, который оформит подписку, ты и твой друг получите <strong className="text-brand-green">1 месяц Премиум</strong> доступа в подарок!
              </p>
            </section>

            {/* Stats Section */}
            <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Card className="bg-muted/30 p-4 text-center border-border">
                <FaUsers className="text-3xl text-brand-green mx-auto mb-2" />
                <p className="text-2xl font-bold text-foreground">{invitedCount}</p>
                <p className="text-sm text-muted-foreground font-mono">Приглашено друзей</p>
              </Card>
              <Card className="bg-muted/30 p-4 text-center border-border">
                <FaGift className="text-3xl text-brand-pink mx-auto mb-2" />
                <p className="text-2xl font-bold text-foreground">{bonusMonths}</p>
                <p className="text-sm text-muted-foreground font-mono">Бонусных месяцев</p>
              </Card>
            </section>

            {/* Referral Link Section */}
            <section>
              <h2 className="text-xl font-semibold text-brand-green mb-3">Ваша реферальная ссылка:</h2>
              <div className="flex items-center gap-2">
                <Input
                  type="text"
                  value={referralLink}
                  readOnly
                  className="bg-input border-border text-foreground font-mono flex-grow"
                  disabled={!user}
                />
                <Button onClick={handleCopyLink} variant="outline" size="icon" className="border-brand-green text-brand-green hover:bg-brand-green/10" disabled={!user}>
                  <FaCopy />
                </Button>
              </div>
            </section>
            
            <section className="text-center mt-6">
                <Button 
                    onClick={() => setIsMyReferralsModalOpen(true)} 
                    variant="default" 
                    className="bg-brand-blue text-black hover:bg-brand-blue/80 font-mono shadow-md hover:shadow-lg"
                    disabled={!user}
                >
                    Мои рефералы
                </Button>
            </section>
          </CardContent>
        </Card>
      </motion.div>

      <Modal
        isOpen={isMyReferralsModalOpen}
        onClose={() => setIsMyReferralsModalOpen(false)}
        title="Мои рефералы"
        showConfirmButton={false}
        cancelText="Закрыть"
      >
        {invitedCount > 0 ? (
            <div>
                <p>Список приглашенных вами пользователей:</p>
                {/* Placeholder for actual list */}
                <ul className="list-disc list-inside mt-2 text-sm">
                    <li>ReferralUser1 (активировал бонус)</li>
                    <li>ReferralUser2 (ожидает активации)</li>
                </ul>
            </div>
        ) : (
            <p>Вы пока никого не пригласили. Поделитесь своей ссылкой, чтобы начать получать бонусы!</p>
        )}
        <p className="mt-2 text-xs text-muted-foreground">Эта функция находится в разработке.</p>
      </Modal>
    </div>
  );
}