"use client";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FaBrain, FaBolt, FaLightbulb, FaAtom, FaFloppyDisk, FaCirclePlus, FaListCheck } from "react-icons/fa6"; 
import { useState } from "react";
import Modal from "@/components/ui/Modal"; 
import { toast } from "sonner";
import VibeContentRenderer from "@/components/VibeContentRenderer";

const cognitiveProtocols = [
  {
    id: "deep_work_sprint",
    name: "Протокол 'ТУРБО-МОЗГ'",
    icon: <FaBolt className="text-brand-orange text-2xl" />, 
    description: "Вруби нитро для своих идей и кода! Этот 90-минутный спринт выжмет из тебя максимум.",
    details: [
      "**ВЫГОДА:** Молниеносное завершение задач, генерация контента как из пулемета.",
      "**МЕХАНИКА:** 2x(40 мин чистейшего фокуса + 5 мин перезарядки). Безжалостно к прокрастинации.",
      "**АРСЕНАЛ:** ::FaAtom className='inline text-brand-purple mr-1 align-middle':: AI-ассистент (Perplexity, ChatGPT), глушители реальности (наушники), таймер-контроллер.", 
      "**ТОПЛИВО:** Кристальная вода, эликсир зеленого чая. Сахар – ЯД для кибер-воина."
    ],
    color: "border-brand-orange/60 bg-dark-card/70 hover:shadow-brand-orange/30",
    shadow: "shadow-brand-orange/20"
  },
  {
    id: "skill_acquisition_module",
    name: "Протокол 'VIBE-АПГРЕЙД'",
    icon: <FaLightbulb className="text-brand-yellow text-2xl" />, 
    description: "Загрузи новый скилл или Vibe Perk в свою нейросеть. Стань машиной обучения.",
    details: [
      "**ВЫГОДА:** Мгновенное расширение твоего Vibe-арсенала, доминация в новой нише.",
      "**МЕХАНИКА:** AI объясняет суть -> Ты практикуешь как одержимый -> Интервальное вбивание в мозг.",
      "**АРСЕНАЛ:** ::FaAtom className='inline text-brand-purple mr-1 align-middle':: AI-сенсей для квизов и разжевывания (ChatGPT), Anki/Quizlet для нейронных связей, сверхсекретные туториалы.", 
      "**ТОПЛИВО:** Высокооктановые углеводы для процессора (гречка, овсянка, киноа)."
    ],
    color: "border-brand-yellow/60 bg-dark-card/70 hover:shadow-brand-yellow/30",
    shadow: "shadow-brand-yellow/20"
  },
  {
    id: "mind_recharge_cycle",
    name: "Протокол 'НЕЙРО-ДЕТОКС'",
    icon: <FaBrain className="text-brand-cyan text-2xl" />, 
    description: "Перезагрузи матрицу сознания. Очисти кэш. Сгенерируй идеи, которые взорвут рынок.",
    details: [
      "**ВЫГОДА:** Сброс умственной усталости, кристальная ясность, поток гениальных (и прибыльных) идей.",
      "**МЕХАНИКА:** 15-20 мин медитации 'Нулевой Канал' или прогулка 'Альфа-Волны'. После – 10 мин 'Взрыв Идей' фрирайтингом.",
      "**АРСЕНАЛ:** Приложение для медитации (Calm, Headspace), священный манускрипт (блокнот) или цифровые скрижали.",
      "**ТОПЛИВО:** Эликсир травяного чая, орехи мудрости."
    ],
    color: "border-brand-cyan/60 bg-dark-card/70 hover:shadow-brand-cyan/30",
    shadow: "shadow-brand-cyan/20"
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
        <Card className="bg-dark-card/90 backdrop-blur-xl border border-brand-green/60 shadow-2xl shadow-green-glow">
          <CardHeader className="text-center p-6 md:p-8 border-b border-brand-green/40">
            <FaBrain className="text-6xl text-brand-green mx-auto mb-4 drop-shadow-[0_0_15px_theme(colors.brand-green)] animate-pulse" />
            <CardTitle className="text-3xl md:text-4xl font-orbitron font-bold text-brand-green cyber-text glitch" data-text="КОГНИТИВНОЕ ТОПЛИВО">
              КОГНИТИВНОЕ ТОПЛИВО
            </CardTitle>
            <CardDescription className="text-muted-foreground font-mono mt-1 text-sm md:text-base">
              Протоколы Зарядки Твоей Нейросети для Максимального ПРОФИТА.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-8 p-6 md:p-8">
            {cognitiveProtocols.map(protocol => (
              <motion.section 
                key={protocol.id} 
                className={`p-4 md:p-5 rounded-lg border ${protocol.color} shadow-lg ${protocol.shadow} transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:${protocol.shadow.replace('/20','/40')}`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + cognitiveProtocols.indexOf(protocol) * 0.1 }}
              >
                <h2 className="text-xl md:text-2xl font-orbitron mb-2.5 flex items-center gap-2.5">
                    {protocol.icon} <span className="ml-1">{protocol.name}</span>
                </h2>
                <p className="text-sm text-muted-foreground mb-4 font-mono">{protocol.description}</p>
                
                <ul className="space-y-2 text-xs text-gray-300 font-mono list-none pl-0">
                  {protocol.details.map((detail, index) => (
                    <li key={index} className="flex items-start leading-relaxed">
                      <FaBolt className="text-xs mr-2.5 text-gray-500 flex-shrink-0 mt-1 align-middle" />
                      <VibeContentRenderer content={detail} />
                    </li>
                  ))}
                </ul>
              </motion.section>
            ))}
            
            <section className="flex flex-col sm:flex-row gap-4 justify-center pt-8 border-t border-brand-green/30 mt-8">
              <Button onClick={() => { setIsSaveModalOpen(true); }} className="bg-gradient-to-r from-brand-green to-neon-lime text-black hover:brightness-110 font-orbitron flex-1 py-3 text-base transform hover:scale-105 transition-all shadow-lg hover:shadow-brand-green/40 flex items-center justify-center">
                <FaFloppyDisk className='mr-2.5 align-middle text-lg'/> <span>СОХРАНИТЬ МОЙ СТЕК!</span>
              </Button>
              <Button onClick={() => { setIsSuggestModalOpen(true); }} variant="outline" className="border-brand-cyan text-brand-cyan hover:bg-brand-cyan/20 hover:text-white font-orbitron flex-1 py-3 text-base transform hover:scale-105 transition-all shadow-lg hover:shadow-brand-cyan/30 flex items-center justify-center">
                <FaCirclePlus className='mr-2.5 align-middle text-lg'/> <span>ПРЕДЛОЖИТЬ ПРОТОКОЛ</span>
              </Button>
              <Button onClick={() => { setIsLogModalOpen(true); }} variant="outline" className="border-brand-purple text-brand-purple hover:bg-brand-purple/20 hover:text-white font-orbitron flex-1 py-3 text-base transform hover:scale-105 transition-all shadow-lg hover:shadow-brand-purple/30 flex items-center justify-center">
                <FaListCheck className='mr-2.5 align-middle text-lg'/> <span>АКТИВИРОВАТЬ & ЛОГИРОВАТЬ</span>
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
        dialogClassName="bg-dark-card border-brand-green text-light-text"
        titleClassName="text-brand-green"
        confirmButtonClassName="bg-brand-green hover:bg-brand-green/80 text-black"
        cancelButtonClassName="text-muted-foreground hover:bg-muted/50"
      >
        <p className="font-mono text-sm text-muted-foreground">Эта функция позволит сохранить текущий набор протоколов в вашем личном профиле Агента для быстрого доступа. Разрабатывается...</p>
      </Modal>
      <Modal 
        isOpen={isSuggestModalOpen} 
        onClose={() => setIsSuggestModalOpen(false)} 
        title="Предложение Нового Протокола" 
        confirmText="Отправить Предложение" 
        onConfirm={() => { handleAction("Предложить Протокол"); setIsSuggestModalOpen(false); }}
        dialogClassName="bg-dark-card border-brand-cyan text-light-text"
        titleClassName="text-brand-cyan"
        confirmButtonClassName="bg-brand-cyan hover:bg-brand-cyan/80 text-black"
        cancelButtonClassName="text-muted-foreground hover:bg-muted/50"
      >
        <p className="font-mono text-sm text-muted-foreground">Есть идея для нового когнитивного протокола? Опишите его здесь! Ваш вклад поможет расширить арсенал CyberVibe. Находится в разработке...</p>
      </Modal>
      <Modal 
        isOpen={isLogModalOpen} 
        onClose={() => setIsLogModalOpen(false)} 
        title="Логирование Когнитивной Активности" 
        confirmText="Записать в Лог" 
        onConfirm={() => { handleAction("Залогировать Активность"); setIsLogModalOpen(false); }}
        dialogClassName="bg-dark-card border-brand-purple text-light-text"
        titleClassName="text-brand-purple"
        confirmButtonClassName="bg-brand-purple hover:bg-brand-purple/80 text-black"
        cancelButtonClassName="text-muted-foreground hover:bg-muted/50"
        >
        <p className="font-mono text-sm text-muted-foreground">Отметьте завершение протокола, чтобы отслеживать свой прогресс и KiloVibes. Интеграция с CyberFitness Dashboard скоро...</p>
      </Modal>
    </div>
  );
}