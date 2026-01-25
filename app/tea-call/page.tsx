"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { notifyAdmin } from "@/app/actions";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Wand2, X, Coffee, Code, Bot, Zap } from "lucide-react";

// GitHub Raw URL for the instructions
const INSTRUCTIONS_URL =
  "https://raw.githubusercontent.com/salavey13/carTest/main/docs/%D0%BC%D0%B0%D0%B3%D0%B8%D1%87%D0%B5%D1%81%D0%BA%D0%B0%D1%8F_%D0%BA%D0%BD%D0%BE%D0%BF%D0%BA%D0%B0_%D0%B2_cyber_vibe_studio_%D1%82%D1%83%D1%82%D0%BE%D1%80%D0%B8%D0%B0%D0%BB_%D0%B4%D0%BB%D1%8F_%D0%BD%D0%BE%D0%B2%D0%B8%D1%87%D0%BA%D0%BE%D0%B2(imgs).md";

export default function TeaCallPage() {
  const [isSending, setIsSending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  
  // Modal & Instructions State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [mdContent, setMdContent] = useState<string>("");
  const [isLoadingMd, setIsLoadingMd] = useState(false);

  // Fetch instructions on mount (or lazily when opening modal, doing it on mount here for speed)
  useEffect(() => {
    const loadInstructions = async () => {
      try {
        setIsLoadingMd(true);
        const response = await fetch(INSTRUCTIONS_URL);
        if (!response.ok) throw new Error("Failed to load instructions");
        const text = await response.text();
        setMdContent(text);
      } catch (error) {
        console.error("Error loading MD:", error);
        setMdContent("# Ошибка загрузки\nНе удалось загрузить инструкции из репозитория.");
      } finally {
        setIsLoadingMd(false);
      }
    };

    // Only load if we don't have content yet
    if (!mdContent && !isLoadingMd) {
      loadInstructions();
    }
  }, [mdContent, isLoadingMd]);

  const handleCallClick = async () => {
    try {
      setIsSending(true);
      setStatus(null);

      const res = await notifyAdmin("Админ, принеси чай.");

      if (res?.success) {
        setStatus("Админ уведомлён, жди чай.");
      } else {
        setStatus("Не удалось уведомить админа, попробуй ещё раз.");
      }
    } catch {
      setStatus("Произошла ошибка при вызове админа.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark-bg text-white flex flex-col items-center justify-center px-4 py-12 relative overflow-hidden">
      
      {/* Background Accents */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-brand-pink/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-brand-cyan/10 rounded-full blur-[100px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 120 }}
        className="text-center space-y-6 max-w-2xl w-full"
      >
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-4xl sm:text-6xl font-orbitron font-bold text-transparent bg-clip-text bg-gradient-to-r from-brand-yellow via-white to-brand-pink drop-shadow-lg">
            Вызвать админа
          </h1>
          <p className="text-muted-foreground font-mono text-sm sm:text-base">
            Нажми кнопку — и в телеграм прилетит команда.
          </p>
        </div>

        {/* Action Buttons Area */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          <Button
            onClick={handleCallClick}
            disabled={isSending}
            size="lg"
            className="bg-brand-pink hover:bg-brand-pink/90 text-white px-10 py-7 text-xl rounded-full shadow-[0_0_20px_rgba(236,72,153,0.5)] hover:shadow-[0_0_30px_rgba(236,72,153,0.8)] transition-all duration-300 border-2 border-white/10 w-full sm:w-auto"
          >
            {isSending ? (
              <span className="flex items-center gap-2">
                <Coffee className="animate-pulse" /> Зову админа...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Coffee /> Позвать за чаем
              </span>
            )}
          </Button>

          {/* NEW MAGIC BUTTON */}
          <Button
            onClick={() => setIsModalOpen(true)}
            variant="outline"
            size="icon"
            className="rounded-full h-14 w-14 border-brand-yellow/50 text-brand-yellow hover:bg-brand-yellow hover:text-black transition-all duration-300"
            title="Посмотреть инструкции"
          >
            <Wand2 className="h-6 w-6" />
          </Button>
        </div>

        {status && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-xs sm:text-sm font-mono text-brand-cyan mt-2 bg-brand-cyan/10 px-4 py-2 rounded-lg inline-block border border-brand-cyan/20"
          >
            {status}
          </motion.p>
        )}

        {/* SMALL AD SECTION */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-12 p-4 bg-zinc-900/50 backdrop-blur-sm border border-zinc-800 rounded-xl text-left overflow-hidden relative group"
        >
          <div className="absolute top-0 right-0 p-2 opacity-20 group-hover:opacity-100 transition-opacity">
             <Zap className="w-6 h-6 text-brand-yellow" />
          </div>
          
          <div className="flex gap-3 items-start">
             <div className="bg-brand-yellow text-black p-2 rounded-lg">
                <Bot className="w-5 h-5" />
             </div>
             <div className="space-y-1">
                <h3 className="text-sm font-bold font-orbitron text-white">Нужен автомат или склад?</h3>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Привет! Я Павел. Делаю телеграм-ботов и веб-приложения (не на Python). 
                  Заменю платный "МойСклад" и помогу с автоматизацией от 2000₽.
                </p>
             </div>
          </div>
        </motion.div>
      </motion.div>

      {/* INSTRUCTIONS MODAL (Rich Text Shower) */}
      <AnimatePresence>
        {isModalOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
            />
            
            {/* Modal Content */}
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="bg-zinc-900 border border-zinc-700 w-full max-w-2xl max-h-[85vh] rounded-2xl shadow-2xl overflow-hidden pointer-events-auto flex flex-col"
              >
                {/* Header */}
                <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-950/50">
                  <h2 className="font-orbitron text-lg text-brand-yellow flex items-center gap-2">
                    <Wand2 className="w-4 h-4" /> Инструкция
                  </h2>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsModalOpen(false)}
                    className="text-gray-400 hover:text-white"
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>

                {/* Scrollable Content */}
                <div className="p-6 overflow-y-auto prose prose-invert prose-sm max-w-none">
                  {isLoadingMd ? (
                    <div className="flex items-center justify-center h-40 text-gray-500 font-mono">
                      Загрузка данных из GitHub...
                    </div>
                  ) : (
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {mdContent}
                    </ReactMarkdown>
                  )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-zinc-800 bg-zinc-950/50 text-center">
                  <Button onClick={() => setIsModalOpen(false)} variant="outline" className="border-zinc-700 hover:bg-zinc-800">
                    Понятно, закрыть
                  </Button>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}