"use client";
import { FixedHeader } from "./components/FixedHeader";
import { 
  ShieldCheck, Server, Lock, FileText, 
  Skull, Ban, Fingerprint, Key 
} from "lucide-react";
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useAppContext } from "@/contexts/AppContext";
import { createCrew, notifyAdmin } from "@/app/actions";
import { sendComplexMessage } from '@/app/webhook-handlers/actions/sendComplexMessage';
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { WarehouseAuditTool } from "./components/WarehouseAuditTool";
import { ExitIntentPopup } from "./components/ExitIntentPopup";
// UPDATED IMPORT PATH
import { WarehouseMigrator } from "@/app/wblanding/components/WarehouseMigrator"; 
import { FaRocket, FaUserPlus, FaFire, FaSkullCrossbones } from 'react-icons/fa6';
import { Loader2 } from 'lucide-react';
import Image from 'next/image';

const generateSlug = (name: string) =>
  name.toLowerCase().trim().replace(/[\s_]+/g, '-').replace(/[^\w-]+/g, '').replace(/--+/g, '-').replace(/^-+|-+$/g, '');

export default function WarehouseLandingPage() {
  const { dbUser, isLoading: appContextLoading } = useAppContext();
  const [showAudit, setShowAudit] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [hqLocation, setHqLocation] = useState("56.3269,44.0059");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdCrew, setCreatedCrew] = useState<{ slug: string; name: string } | null>(null);
  
  const auditRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setSlug(generateSlug(name)); }, [name]);

  const scrollToAudit = () => {
    setTimeout(() => {
      auditRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dbUser?.user_id) { 
      toast.error("Ошибка: не удалось определить ID пользователя."); 
      return; 
    }
    if (!slug) { 
      toast.error("Slug не может быть пустым."); 
      return; 
    }
    setIsSubmitting(true);
    toast.info("Создание нового склада...");
    try {
      const result = await createCrew({
        name, slug, description, logo_url: logoUrl, owner_id: dbUser.user_id, hq_location: hqLocation,
      });
      if (result.success && result.data) {
        toast.success(`Склад "${result.data.name}" успешно создан!`);
        setCreatedCrew({ slug: result.data.slug, name: result.data.name });
        
        await notifyAdmin(`🎉 Новый склад создан!\nНазвание: ${result.data.name}\nВладелец: ${dbUser.username || dbUser.user_id}`);
        
        await sendComplexMessage(dbUser.user_id, `🎉 Поздравляем! Ваш склад "${result.data.name}" создан. Теперь загрузите CSV или пригласите команду.`, []);
      } else { 
        throw new Error(result.error || "Неизвестная ошибка."); 
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Произошла ошибка.");
    } finally { 
      setIsSubmitting(false); 
    }
  };

  const handleInvite = async () => {
    if (!createdCrew) return;
    const inviteUrl = `https://t.me/oneBikePlsBot/app?startapp=crew_${createdCrew.slug}_join_crew`;
    const text = `Присоединяйся к нашему складу '${createdCrew.name}' в приложении!`;
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(inviteUrl)}&text=${encodeURIComponent(text)}`;
    window.open(shareUrl, "_blank");
  };

  if (appContextLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <Loader2 className="animate-spin w-8 h-8 text-neon-lime" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-gray-100 font-sans overflow-x-hidden">
      <FixedHeader />
      
      {/* HERO */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
        <div className="absolute inset-0 z-0">
           <div className="absolute inset-0 bg-[url('https://i.pinimg.com/originals/2b/2b/e4/2b2be452536454126e86014092321051.gif')] opacity-10 bg-cover bg-center mix-blend-overlay"></div>
           <div className="absolute inset-0 bg-gradient-to-b from-black via-transparent to-black"></div>
        </div>

        <div className="relative z-10 max-w-5xl mx-auto px-4 text-center">
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
            >
                <span className="inline-block py-1 px-3 rounded-full bg-red-500/20 border border-red-500/50 text-red-400 text-xs md:text-sm font-mono mb-6">
                    <FaSkullCrossbones className="inline mr-2 mb-0.5"/>
                    МЫ УКРАЛИ ИДЕЮ У МОЙСКЛАД, ЧТОБЫ ВЫ НЕ ПЛАТИЛИ
                </span>
            </motion.div>

            <motion.h1 
                className="text-4xl md:text-7xl font-bold mb-6 leading-tight font-orbitron"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1, type: "spring" }}
            >
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-gray-100 to-gray-400">Ваши данные.</span>
                <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-cyan via-blue-500 to-purple-600 glitch" data-text="ВАШИ ПРАВИЛА">ВАШИ ПРАВИЛА</span>
            </motion.h1>

            <motion.p 
                className="text-lg md:text-2xl text-gray-400 max-w-3xl mx-auto mb-10 leading-relaxed font-mono"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
            >
                Импорт из Excel за секунды. Песочница для тестов. 
                <br className="hidden md:block"/>
                Никаких API ключей на старте — <span className="text-neon-lime font-bold">мы не просим ключи от квартиры</span>, пока вы не решите там жить.
            </motion.p>

            <motion.div 
                className="flex flex-col sm:flex-row gap-4 justify-center items-center"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
            >
                <Button onClick={() => {
                    setShowAudit(true);
                    scrollToAudit();
                }} size="lg" className="bg-brand-cyan hover:bg-brand-cyan/80 text-black font-bold px-8 py-6 rounded-none skew-x-[-10deg] border-r-4 border-b-4 border-white transition-all active:translate-y-1 active:border-0">
                    <span className="skew-x-[10deg] flex items-center gap-2">
                        <FaFire /> СКОЛЬКО Я ТЕРЯЮ?
                    </span>
                </Button>
            </motion.div>
        </div>
      </section>

      {/* SECURITY SECTION: Paranoid Level */}
      <section className="py-16 bg-zinc-900/50 border-y border-white/5">
        <div className="max-w-5xl mx-auto px-4">
            <div className="flex flex-col md:flex-row items-center gap-8 mb-8">
                <div className="bg-red-500/10 p-4 rounded-full border border-red-500/30">
                    <ShieldCheck className="w-10 h-10 text-red-500" />
                </div>
                <div>
                    <h2 className="text-2xl md:text-3xl font-bold text-white font-orbitron mb-2">
                        ПАРАНОИДАЛЬНАЯ БЕЗОПАСНОСТЬ
                    </h2>
                    <p className="text-gray-400 font-mono text-sm md:text-base">
                        Почему мы не просим API ключи прямо сейчас? Потому что это тупо.
                    </p>
                </div>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
                <div className="bg-black p-6 rounded-lg border border-gray-800 hover:border-brand-cyan/50 transition-colors">
                    <Server className="w-8 h-8 text-brand-cyan mb-4" />
                    <h3 className="text-lg font-bold text-white mb-2">ENV Storage Only</h3>
                    <p className="text-gray-400 text-sm">Ключи никогда не пишутся в базу данных Supabase. Они хранятся только в зашифрованных переменных окружения сервера (ENV).</p>
                </div>
                <div className="bg-black p-6 rounded-lg border border-gray-800 hover:border-brand-cyan/50 transition-colors">
                    <Key className="w-8 h-8 text-neon-lime mb-4" />
                    <h3 className="text-lg font-bold text-white mb-2">Manual Admin Setup</h3>
                    <p className="text-gray-400 text-sm">API подключает только Superadmin вручную. Это исключает утечки через веб-интерфейс или уязвимости фронтенда.</p>
                </div>
                <div className="bg-black p-6 rounded-lg border border-gray-800 hover:border-brand-cyan/50 transition-colors">
                    <Lock className="w-8 h-8 text-purple-500 mb-4" />
                    <h3 className="text-lg font-bold text-white mb-2">Sandbox First</h3>
                    <p className="text-gray-400 text-sm">Сначала работайте с CSV. Привыкайте к интерфейсу. Подключайте API только когда будете готовы на 100%.</p>
                </div>
            </div>
        </div>
      </section>

      {/* THE MIGRATOR */}
      <section className="py-20 bg-black">
          <div className="max-w-4xl mx-auto px-4">
              <div className="text-center mb-12">
                  <h2 className="text-3xl font-bold text-white mb-4 font-orbitron">Миграция через Excel / CSV</h2>
                  <p className="text-gray-400">Скачайте отчет остатков из МойСклад, Ozon или WB. Вставьте сюда. Получите базу.</p>
              </div>
              <WarehouseMigrator />
          </div>
      </section>

      {/* PAIN POINTS GRID (Keep existing logic but maybe simplify visual noise if needed) */}
      <section className="py-20 bg-zinc-900">
         {/* ... (Same Pain Points content as before) ... */}
         <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl md:text-5xl font-bold text-center mb-16 text-white font-orbitron">
            ПОЧЕМУ ВАС БЕСЯТ СТАРЫЕ СИСТЕМЫ
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
             <div className="bg-black border border-red-900/30 p-6 rounded-xl relative overflow-hidden group hover:border-red-500/50 transition-colors">
                <div className="absolute top-0 right-0 p-4 opacity-20 group-hover:opacity-100 transition-opacity">
                    <Ban className="w-16 h-16 text-red-600" />
                </div>
                <h3 className="text-xl font-bold text-red-500 mb-4">Жадность Гигантов</h3>
                <ul className="space-y-3 text-gray-400 text-sm">
                    <li className="flex gap-2"><span className="text-red-500">✕</span> Тарифы растут без предупреждения</li>
                    <li className="flex gap-2"><span className="text-red-500">✕</span> Платишь за 100 функций, юзаешь 3</li>
                </ul>
             </div>
             {/* More cards... */}
             <div className="bg-black border border-red-900/30 p-6 rounded-xl relative overflow-hidden group hover:border-red-500/50 transition-colors">
                <div className="absolute top-0 right-0 p-4 opacity-20 group-hover:opacity-100 transition-opacity">
                    <Skull className="w-16 h-16 text-red-600" />
                </div>
                <h3 className="text-xl font-bold text-red-500 mb-4">Техподдержка-Зомби</h3>
                <ul className="space-y-3 text-gray-400 text-sm">
                    <li className="flex gap-2"><span className="text-red-500">✕</span> Ответ через 24 часа шаблоном</li>
                    <li className="flex gap-2"><span className="text-red-500">✕</span> "Это не баг, это фича"</li>
                </ul>
             </div>
             <div className="bg-black border border-red-900/30 p-6 rounded-xl relative overflow-hidden group hover:border-red-500/50 transition-colors">
                <div className="absolute top-0 right-0 p-4 opacity-20 group-hover:opacity-100 transition-opacity">
                    <Fingerprint className="w-16 h-16 text-red-600" />
                </div>
                <h3 className="text-xl font-bold text-red-500 mb-4">UI из 2005 года</h3>
                <ul className="space-y-3 text-gray-400 text-sm">
                    <li className="flex gap-2"><span className="text-red-500">✕</span> Нужен PC, чтобы работать</li>
                    <li className="flex gap-2"><span className="text-red-500">✕</span> 1000 кликов для одной операции</li>
                </ul>
             </div>
          </div>
        </div>
      </section>

      {/* Lead Magnet Section */}
      {showAudit && (
        <section id="audit-tool" className="py-16 px-4 bg-white/5 backdrop-blur-sm" ref={auditRef}>
          <WarehouseAuditTool />
        </section>
      )}

      {/* CTA */}
      <section className="py-24 bg-gradient-to-b from-black to-zinc-900 text-center">
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-8">Забирайте свой склад</h2>
          <p className="text-xl text-gray-400 mb-12">Инструмент, который не шпионит за вами.</p>
          
          {!createdCrew ? (
              <Button onClick={() => {
                window.scrollTo({ top: 0, behavior: 'smooth' });
                setTimeout(() => document.getElementById('crew-name')?.focus(), 500);
              }} size="lg" className="bg-neon-lime text-black hover:bg-neon-lime/80 text-xl px-12 py-8 font-bold rounded-full shadow-[0_0_20px_rgba(100,255,100,0.4)] animate-pulse-slow">
                  СОЗДАТЬ ЭКИПАЖ
              </Button>
          ) : (
              <Button onClick={handleInvite} className="bg-brand-cyan text-black font-bold px-10 py-6 rounded-full">
                  ПРИГЛАСИТЬ БАНДУ
              </Button>
          )}
      </section>

      <ExitIntentPopup />
    </div>
  );
}