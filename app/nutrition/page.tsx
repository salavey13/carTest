"use client";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FaBrain, FaBolt, FaLightbulb } from "react-icons/fa6"; 
import { useState } from "react";
import Modal from "@/components/ui/Modal"; 
import { toast } from "sonner";
import VibeContentRenderer from "@/components/VibeContentRenderer";

const cognitiveProtocols = [
  {
    id: "deep_work_sprint",
    name: "Протокол: Deep Work Sprint (90 мин)",
    icon: <FaBolt className="text-brand-orange" />, 
    description: "Концентрированный блок работы с использованием техники Pomodoro и AI-ассистента для максимальной продуктивности.",
    details: [
      "Цель: Завершение критической задачи, генерация контента.",
      "Метод: 2x(40 мин фокус + 5 мин отдых).",
      "Инструменты: <FaAtom className='inline text-brand-purple mr-1 align-middle'/> AI-ассистент (Perplexity, ChatGPT), шумоподавляющие наушники, трекер времени.", 
      "Топливо: Вода, зеленый чай. Избегать сахара."
    ],
    color: "border-brand-orange/50 bg-dark-card hover:shadow-brand-orange/20"
  },
  {
    id: "skill_acquisition_module",
    name: "Протокол: Skill Acquisition Module (SAM)",
    icon: <FaLightbulb className="text-brand-yellow" />, 
    description: "Целевая сессия для изучения нового Vibe Perk или навыка с применением техник активного обучения.",
    details: [
      "Цель: Освоение нового навыка, расширение Vibe-арсенала.",
      "Метод: Объяснение концепции (AI), практика, интервальное повторение.",
      "Инструменты: <FaAtom className='inline text-brand-purple mr-1 align-middle'/> AI для объяснений/квизов (ChatGPT), Anki/Quizlet, релевантные туториалы.", 
      "Топливо: Сложные углеводы для энергии (гречка, овсянка)."
    ],
    color: "border-brand-yellow/50 bg-dark-card hover:shadow-brand-yellow/20"
  },
  {
    id: "mind_recharge_cycle",
    name: "Протокол: Mind Recharge & Ideation",
    icon: <FaBrain className="text-brand-cyan" />, 
    description: "Восстановление когнитивной энергии через медитацию или легкую активность, стимулирование генерации идей.",
    details: [
      "Цель: Снижение умственной усталости, генерация новых идей.",
      "Метод: 15-20 мин медитации осознанности или прогулка на свежем воздухе. После – 10 мин фрирайтинга идей.",
      "Инструменты: Приложение для медитации (Calm, Headspace), блокнот или цифровые заметки.",
      "Топливо: Травяной чай, орехи."
    ],
    color: "border-brand-cyan/50 bg-dark-card hover:shadow-brand-cyan/20"
  },
];

export default function CognitiveFuelPage() {
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [isSuggestModalOpen, setIsSuggestModalOpen] = useState(false);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  
  const handleAction = (actionName: string) => {
    toast.info(`Функция "${actionName}" находится в разработке в лаборатории CyberVibe.`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-bg via-black to-dark-card text-light-text p-4 pt-24 pb-10">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="container mx-auto max-w-3xl"
      >
        <Card className="bg-dark-card/80 backdrop-blur-md border border-brand-green/50 shadow-xl shadow-brand-green/20">
          <CardHeader className="text-center p-6 border-b border-brand-green/30">
            <FaBrain className="text-5xl text-brand-green mx-auto mb-3 drop-shadow-[0_0_10px_theme(colors.brand-green)] animate-pulse" />
            <CardTitle className="text-3xl font-orbitron font-bold text-brand-green cyber-text glitch" data-text="COGNITIVE FUEL">
              COGNITIVE FUEL
            </CardTitle>
            <CardDescription className="text-muted-foreground font-mono mt-1">
              Протоколы для оптимизации твоей нейросети.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-8 p-6">
            {cognitiveProtocols.map(protocol => (
              <motion.section 
                key={protocol.id} 
                className={`p-4 rounded-lg border ${protocol.color} shadow-md transition-all duration-300 hover:scale-[1.02]`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + cognitiveProtocols.indexOf(protocol) * 0.1 }}
              >
                <h2 className="text-xl font-orbitron mb-2 flex items-center">
                    {protocol.icon} <span className="ml-2">{protocol.name}</span>
                </h2>
                <p className="text-sm text-muted-foreground mb-3 font-mono">{protocol.description}</p>
                
                <div className="space-y-1 text-xs text-gray-400 font-mono">
                  {protocol.details.map((detail, index) => (
                    <div key={index} className="flex items-start">
                      {/* Render list item marker directly */}
                      <FaBolt className="text-xs mr-1.5 text-gray-500 flex-shrink-0 mt-0.5 align-middle" /> 
                      {/* VibeContentRenderer handles the rest of the detail string, which might contain its own icons */}
                      <VibeContentRenderer content={detail.substring(detail.indexOf("/>") + 2).trim()} /> 
                    </div>
                  ))}
                </div>
              </motion.section>
            ))}
            
            <section className="flex flex-col sm:flex-row gap-3 justify-center pt-4 border-t border-brand-green/20">
              <Button onClick={() => { setIsSaveModalOpen(true); }} className="bg-brand-green text-black hover:bg-brand-green/90 font-orbitron flex-1">
                <VibeContentRenderer content="<FaFloppyDisk className='mr-2 align-middle'/> Сохранить Стек Протоколов" />
              </Button>
              <Button onClick={() => { setIsSuggestModalOpen(true); }} variant="outline" className="border-brand-cyan text-brand-cyan hover:bg-brand-cyan/20 hover:text-white font-orbitron flex-1">
                <VibeContentRenderer content="<FaCirclePlus className='mr-2 align-middle'/> Предложить Протокол" />
              </Button>
              <Button onClick={() => { setIsLogModalOpen(true); }} variant="outline" className="border-brand-purple text-brand-purple hover:bg-brand-purple/20 hover:text-white font-orbitron flex-1">
                <VibeContentRenderer content="<FaListCheck className='mr-2 align-middle'/> Залогировать Активность" />
              </Button>
            </section>
          </CardContent>
        </Card>
      </motion.div>

      <Modal 
        isOpen={isSaveModalOpen} 
        onClose={() => setIsSaveModalOpen(false)} 
        title="Сохранение Стека Протоколов" 
        confirmText="Сохранить в Нейробанк" 
        onConfirm={() => { handleAction("Сохранить Стек"); setIsSaveModalOpen(false); }}
      >
        <p className="font-mono text-sm text-muted-foreground">Эта функция позволит сохранить текущий набор протоколов в вашем личном профиле Агента для быстрого доступа. Разрабатывается...</p>
      </Modal>
      <Modal 
        isOpen={isSuggestModalOpen} 
        onClose={() => setIsSuggestModalOpen(false)} 
        title="Предложение Нового Протокола" 
        confirmText="Отправить Предложение" 
        onConfirm={() => { handleAction("Предложить Протокол"); setIsSuggestModalOpen(false); }}
      >
        <p className="font-mono text-sm text-muted-foreground">Есть идея для нового когнитивного протокола? Опишите его здесь! Ваш вклад поможет расширить арсенал CyberVibe. Находится в разработке...</p>
      </Modal>
      <Modal 
        isOpen={isLogModalOpen} 
        onClose={() => setIsLogModalOpen(false)} 
        title="Логирование Когнитивной Активности" 
        confirmText="Записать в Лог" 
        onConfirm={() => { handleAction("Залогировать Активность"); setIsLogModalOpen(false); }}
        >
        <p className="font-mono text-sm text-muted-foreground">Отметьте завершение протокола, чтобы отслеживать свой прогресс и KiloVibes. Интеграция с CyberFitness Dashboard скоро...</p>
      </Modal>
    </div>
  );
}