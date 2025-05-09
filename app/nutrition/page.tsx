// /app/nutrition/page.tsx
"use client";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FaAppleAlt, FaSave, FaThumbsUp, FaPlusCircle } from "react-icons/fa";
import { useState } from "react";
import Modal from "@/components/ui/Modal"; // Import the Modal component
import { toast } from "sonner";

export default function NutritionPage() {
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [isRateModalOpen, setIsRateModalOpen] = useState(false);
  const [isNewPlanModalOpen, setIsNewPlanModalOpen] = useState(false);
  
  // Placeholder data for a nutrition plan
  const currentPlan = {
    name: "Сбалансированный план на 1800 ккал",
    description: "Этот план нацелен на поддержание здорового веса и обеспечение организма всеми необходимыми нутриентами.",
    meals: [
      { time: "Завтрак (08:00)", items: ["Овсянка на молоке с ягодами и орехами", "Зеленый чай"] },
      { time: "Перекус (11:00)", items: ["Яблоко", "Горсть миндаля"] },
      { time: "Обед (14:00)", items: ["Куриная грудка на гриле", "Бурый рис", "Салат из свежих овощей"] },
      { time: "Перекус (17:00)", items: ["Натуральный йогурт без добавок"] },
      { time: "Ужин (20:00)", items: ["Запеченная рыба (лосось/треска)", "Овощи на пару (брокколи, цветная капуста)"] },
    ],
  };

  const handleAction = (actionName: string) => {
    toast.info(`Функция "${actionName}" находится в разработке.`);
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
            <FaAppleAlt className="text-5xl text-brand-pink mx-auto mb-3 drop-shadow-lg" />
            <CardTitle className="text-3xl font-bold text-brand-pink cyber-text">
              План Питания
            </CardTitle>
            <CardDescription className="text-muted-foreground font-mono mt-1">
              Ваш персональный гид по здоровому питанию.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6 p-6">
            <section className="p-4 bg-muted/30 rounded-lg border-border">
              <h2 className="text-xl font-semibold text-brand-green mb-2">{currentPlan.name}</h2>
              <p className="text-sm text-muted-foreground mb-4">{currentPlan.description}</p>
              
              <div className="space-y-3">
                {currentPlan.meals.map(meal => (
                  <div key={meal.time}>
                    <h3 className="font-semibold text-foreground">{meal.time}</h3>
                    <ul className="list-disc list-inside pl-4 text-sm text-muted-foreground">
                      {meal.items.map(item => <li key={item}>{item}</li>)}
                    </ul>
                  </div>
                ))}
              </div>
            </section>

            <section className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button onClick={() => { setIsSaveModalOpen(true); }} className="bg-brand-green text-black hover:bg-brand-green/80 font-mono">
                <FaSave className="mr-2" /> Сохранить План
              </Button>
              <Button onClick={() => { setIsRateModalOpen(true); }} variant="outline" className="border-brand-blue text-brand-blue hover:bg-brand-blue/10">
                <FaThumbsUp className="mr-2" /> Оценить План
              </Button>
              <Button onClick={() => { setIsNewPlanModalOpen(true); }} variant="outline" className="border-brand-orange text-brand-orange hover:bg-brand-orange/10">
                <FaPlusCircle className="mr-2" /> Новый План
              </Button>
            </section>
          </CardContent>
        </Card>
      </motion.div>

      {/* Modals for actions */}
      <Modal isOpen={isSaveModalOpen} onClose={() => setIsSaveModalOpen(false)} title="Сохранить План" confirmText="Сохранить" onConfirm={() => { handleAction("Сохранить План"); setIsSaveModalOpen(false); }}>
        <p>Эта функция позволит сохранить текущий план питания в вашем профиле. Находится в разработке.</p>
      </Modal>
      <Modal isOpen={isRateModalOpen} onClose={() => setIsRateModalOpen(false)} title="Оценить План" confirmText="Отправить оценку" onConfirm={() => { handleAction("Оценить План"); setIsRateModalOpen(false); }}>
        <p>Здесь вы сможете оценить текущий план питания. Это поможет нам улучшать рекомендации. Находится в разработке.</p>
        {/* Placeholder for rating stars or form */}
      </Modal>
      <Modal isOpen={isNewPlanModalOpen} onClose={() => setIsNewPlanModalOpen(false)} title="Запросить Новый План" confirmText="Запросить" onConfirm={() => { handleAction("Новый План"); setIsNewPlanModalOpen(false); }}>
        <p>Хотите сгенерировать новый план питания на основе ваших предпочтений и целей? Эта функция скоро будет доступна. Находится в разработке.</p>
      </Modal>
    </div>
  );
}