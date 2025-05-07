"use client";
import { useAppContext } from "@/contexts/AppContext";
import { motion } from "framer-motion";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FaUser, FaDumbbell, FaFire, FaCalendarCheck, FaChartLine, FaTrophy, FaEdit } from "react-icons/fa";
import { useState } from "react";
import Modal from "@/components/ui/Modal"; // Import the Modal component

export default function ProfilePage() {
  const { user, dbUser, isLoading } = useAppContext();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAchievementsModalOpen, setIsAchievementsModalOpen] = useState(false);

  const userProfile = dbUser || user; // Prefer dbUser if available

  const stats = [
    { label: "Тренировок", value: dbUser?.metadata?.workouts_completed || 0, icon: <FaDumbbell className="text-brand-blue" /> },
    { label: "Калорий сожжено", value: dbUser?.metadata?.calories_burned || 0, icon: <FaFire className="text-brand-orange" /> },
    { label: "Дней подряд", value: dbUser?.metadata?.streak_days || 0, icon: <FaCalendarCheck className="text-brand-pink" /> },
  ];

  const details = [
    { label: "Уровень", value: dbUser?.metadata?.level || "Новичок", icon: <FaChartLine /> },
    { label: "Цель", value: dbUser?.metadata?.goal || "Похудение", icon: <FaTrophy /> },
    { label: "Вес", value: `${dbUser?.metadata?.weight || 70} кг`, icon: <FaUser /> }, // Placeholder icon
    { label: "Рост", value: `${dbUser?.metadata?.height || 175} см`, icon: <FaUser /> }, // Placeholder icon
  ];

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center"><p className="text-brand-green animate-pulse">Загрузка профиля...</p></div>;
  }

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
            <div className="relative w-32 h-32 mx-auto mb-4 rounded-full overflow-hidden border-4 border-brand-green shadow-lg">
              <Image
                src={userProfile?.avatar_url || userProfile?.photo_url || "/placeholders/avatar.png"}
                alt={userProfile?.username || "User Avatar"}
                layout="fill"
                objectFit="cover"
                className="transform hover:scale-110 transition-transform duration-300"
              />
            </div>
            <CardTitle className="text-3xl font-bold text-brand-green cyber-text">
              {userProfile?.full_name || userProfile?.username || "Имя Пользователя"}
            </CardTitle>
            <CardDescription className="text-muted-foreground font-mono">
              @{userProfile?.username || userProfile?.id}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-8">
            {/* Stats Section */}
            <section>
              <h2 className="text-xl font-semibold text-brand-pink mb-4 flex items-center"><FaChartLine className="mr-2"/>Статистика</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {stats.map((stat) => (
                  <Card key={stat.label} className="bg-muted/30 p-4 text-center border-border hover:shadow-brand-blue/20 hover:shadow-md transition-shadow">
                    <div className="text-3xl mb-1">{stat.icon}</div>
                    <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                    <p className="text-sm text-muted-foreground font-mono">{stat.label}</p>
                  </Card>
                ))}
              </div>
            </section>

            {/* Details Section */}
            <section>
              <h2 className="text-xl font-semibold text-brand-blue mb-4 flex items-center"><FaUser className="mr-2"/>Мои Данные</h2>
              <div className="space-y-3">
                {details.map((detail) => (
                  <div key={detail.label} className="flex justify-between items-center p-3 bg-muted/30 rounded-md border-border font-mono">
                    <span className="text-muted-foreground flex items-center">{detail.icon}<span className="ml-2">{detail.label}:</span></span>
                    <span className="font-semibold text-foreground">{detail.value}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* Actions Section */}
            <section className="flex flex-col sm:flex-row gap-4 mt-8">
              <Button 
                onClick={() => setIsEditModalOpen(true)}
                className="flex-1 bg-brand-green text-black hover:bg-brand-green/80 font-mono shadow-md hover:shadow-lg transition-all"
              >
                <FaEdit className="mr-2" /> Изменить данные
              </Button>
              <Button 
                onClick={() => setIsAchievementsModalOpen(true)}
                variant="outline" 
                className="flex-1 border-brand-pink text-brand-pink hover:bg-brand-pink/10 hover:text-brand-pink font-mono shadow-md hover:shadow-lg transition-all"
              >
                <FaTrophy className="mr-2" /> Мои достижения
              </Button>
            </section>
          </CardContent>
        </Card>
      </motion.div>

      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Редактирование данных"
        confirmText="Сохранить"
        onConfirm={() => {
          // Add logic to save data
          setIsEditModalOpen(false);
        }}
      >
        <p>Здесь будет форма для редактирования данных профиля (уровень, цель, вес, рост).</p>
        <p className="mt-2 text-xs text-muted-foreground">Эта функция находится в разработке.</p>
      </Modal>

      <Modal
        isOpen={isAchievementsModalOpen}
        onClose={() => setIsAchievementsModalOpen(false)}
        title="Мои достижения"
        showConfirmButton={false}
        cancelText="Закрыть"
      >
        <p>Здесь будут отображаться ваши достижения и награды.</p>
        <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
            <li>Значок "Первая тренировка"</li>
            <li>Значок "Неделя без пропусков"</li>
        </ul>
        <p className="mt-2 text-xs text-muted-foreground">Эта функция находится в разработке.</p>
      </Modal>
    </div>
  );
}