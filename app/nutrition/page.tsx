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
    name: "Протокол 'ТУРБО-МОЗГ'",
    icon: <FaBolt className="text-brand-orange" />, 
    description: "Вруби нитро для своих идей и кода! Этот 90-минутный спринт выжмет из тебя максимум.",
    details: [
      "**ВЫГОДА:** Молниеносное завершение задач, генерация контента как из пулемета.",
      "**МЕХАНИКА:** 2x(40 мин чистейшего фокуса + 5 мин перезарядки). Безжалостно к прокрастинации.",
      "**АРСЕНАЛ:** <FaAtom className='inline text-brand-purple mr-1 align-middle'/> AI-ассистент (Perplexity, ChatGPT), глушители реальности (наушники), таймер-контроллер.", 
      "**ТОПЛИВО:** Кристальная вода, эликсир зеленого чая. Сахар – ЯД для кибер-воина."
    ],
    color: "border-brand-orange/50 bg-dark-card hover:shadow-brand-orange/20"
  },
  {
    id: "skill_acquisition_module",
    name: "Протокол 'VIBE-АПГРЕЙД'",
    icon: <FaLightbulb className="text-brand-yellow" />, 
    description: "Загрузи новый скилл или Vibe Perk в свою нейросеть. Стань машиной обучения.",
    details: [
      "**ВЫГОДА:** Мгновенное расширение твоего Vibe-арсенала, доминация в новой нише.",
      "**МЕХАНИКА:** AI объясняет суть -> Ты практикуешь как одержимый -> Интервальное вбивание в мозг.",
      "**АРСЕНАЛ:** <FaAtom className='inline text-brand-purple mr-1 align-middle'/> AI-сенсей для квизов и разжевывания (ChatGPT), Anki/Quizlet для нейронных связей, сверхсекретные туториалы.", 
      "**ТОПЛИВО:** Высокооктановые углеводы для процессора (гречка, овсянка, киноа)."
    ],
    color: "border-brand-yellow/50 bg-dark-card hover:shadow-brand-yellow/20"
  },
  {
    id: "mind_recharge_cycle",
    name: "Протокол 'НЕЙРО-ДЕТОКС'",
    icon: <FaBrain className="text-brand-cyan" />, 
    description: "Перезагрузи матрицу сознания. Очисти кэш. Сгенерируй идеи, которые взорвут рынок.",
    details: [
      "**ВЫГОДА:** Сброс умственной усталости, кристальная ясность, поток гениальных (и прибыльных) идей.",
      "**МЕХАНИКА:** 15-20 мин медитации 'Нулевой Канал' или прогулка 'Альфа-Волны'. После – 10 мин 'Взрыв Идей' фрирайтингом.",
      "**АРСЕНАЛ:** Приложение для медитации (Calm, Headspace), священный манускрипт (блокнот) или цифровые скрижали.",
      "**ТОПЛИВО:** Эликсир травяного чая, орехи мудрости."
    ],
    color: "border-brand-cyan/50 bg-dark-card hover:shadow-brand-cyan/20"
  },
];

export default function CognitiveFuelPage() {
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [isSuggestModalOpen, setIsSuggestModalOpen] = useState(false);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  
  const handleAction = (actionName: string) => {
    toast.info(`Функция "${actionName}" в разработке в лаборатории CyberVibe.`);
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
            <CardTitle className="text-3xl font-orbitron font-bold text-brand-green cyber-text glitch" data-text="КОГНИТИВНОЕ ТОПЛИВО">
              КОГНИТИВНОЕ ТОПЛИВО
            </CardTitle>
            <CardDescription className="text-muted-foreground font-mono mt-1">
              Протоколы Зарядки Твоей Нейросети для Максимального ПРОФИТА.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-8 p-6">
            {cognitiveProtocols.map(protocol => (
              <motion.section 
                key={protocol.id} 
                className={`p-4 rounded-lg border ${protocol.color} shadow-md transition-all duration-300 hover:scale-[1.01] hover:shadow-lg ${protocol.color.replace('border-','shadow-')}/40`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + cognitiveProtocols.indexOf(protocol) * 0.1 }}
              >
                <h2 className="text-xl font-orbitron mb-2 flex items-center">
                    {protocol.icon} <span className="ml-2">{protocol.name}</span>
                </h2>
                <p className="text-sm text-muted-foreground mb-3 font-mono">{protocol.description}</p>
                
                <ul className="space-y-1.5 text-xs text-gray-300 font-mono list-none pl-0"> {/* Use ul for semantic list */}
                  {protocol.details.map((detail, index) => (
                    <li key={index} className="flex items-start"> {/* Each detail is a list item */}
                      <FaBolt className="text-xs mr-2 text-gray-400 flex-shrink-0 mt-[3px] align-middle" /> 
                      <VibeContentRenderer content={detail} /> 
                    </li>
                  ))}
                </ul>
              </motion.section>
            ))}
            
            <section className="flex flex-col sm:flex-row gap-3 justify-center pt-6 border-t border-brand-green/20 mt-6">
              <Button onClick={() => { setIsSaveModalOpen(true); }} className="bg-brand-green text-black hover:bg-brand-green/80 font-orbitron flex-1 py-3 text-base transform hover:scale-105 transition-transform">
                <VibeContentRenderer content="<FaFloppyDisk className='mr-2 align-middle text-lg'/> СОХРАНИТЬ МОЙ СТЕК!" />
              </Button>
              <Button onClick={() => { setIsSuggestModalOpen(true); }} variant="outline" className="border-brand-cyan text-brand-cyan hover:bg-brand-cyan/20 hover:text-white font-orbitron flex-1 py-3 text-base transform hover:scale-105 transition-transform">
                <VibeContentRenderer content="<FaCirclePlus className='mr-2 align-middle text-lg'/> ПРЕДЛОЖИТЬ ПРОТОКОЛ" />
              </Button>
              <Button onClick={() => { setIsLogModalOpen(true); }} variant="outline" className="border-brand-purple text-brand-purple hover:bg-brand-purple/20 hover:text-white font-orbitron flex-1 py-3 text-base transform hover:scale-105 transition-transform">
                <VibeContentRenderer content="<FaListCheck className='mr-2 align-middle text-lg'/> АКТИВИРОВАТЬ & ЛОГИРОВАТЬ" />
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