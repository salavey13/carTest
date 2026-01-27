"use client";

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useAppContext } from "@/contexts/AppContext";
import { purchaseWbService } from "./actions_invoicing"; 
import { getDiscountedPrice } from "./actions_referral";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { 
  Loader2, ShieldCheck, Server, Lock, Zap, Clock, Users, 
  Smartphone, BarChart3, Database, Ban, Skull, Fingerprint, 
  Key, Anchor, ArrowRight, FileText, GitFork, Code2,
  Target, Cpu
} from 'lucide-react';

// Components
import { FixedHeader } from "./components/FixedHeader";
import { HeroSection } from "./components/HeroSection";
import { WarehouseMigrator } from "./components/WarehouseMigrator";
import { WarehouseAuditTool } from "./components/WarehouseAuditTool";
import { CrewCreationForm } from "./components/CrewCreationForm";
import { CrewsListSimplified } from "./components/CrewsListSimplified"; 
import { ReferralPirateCard } from "./components/ReferralPirateCard";
import { WbFooter } from "./components/WbFooter";
import { ExitIntentPopup } from "./components/ExitIntentPopup";
import { ReviewsSection } from "./components/ReviewsSection";
import { SovereigntyPanel } from "./components/SovereigntyPanel";

export default function WarehouseLandingPage() {
  const { dbUser, isLoading: appContextLoading } = useAppContext();
  const [showAudit, setShowAudit] = useState(false);
  const [isSendingInvoice, setIsSendingInvoice] = useState(false);
  const [setupPrice, setSetupPrice] = useState({ price: 10000, discount: 0 });
  
  const auditRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (dbUser?.user_id) {
        getDiscountedPrice(dbUser.user_id, 10000).then(res => {
            setSetupPrice({ price: res.finalPrice, discount: res.discountApplied });
        });
    }
  }, [dbUser]);

  const scrollToAudit = () => {
    setTimeout(() => {
      auditRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const handleSendInvoice = async (serviceType: 'quick_setup' | 'team_training') => {
    if (!dbUser?.user_id) { toast.error("Пожалуйста, войдите в систему"); return; }
    setIsSendingInvoice(true);
    try {
      const result = await purchaseWbService(dbUser.user_id, serviceType);
      
      if (result.success) {
        toast.success(`✅ Счет отправлен в Telegram! Проверьте чат с ботом.`);
      } else throw new Error(result.error);
    } catch (error) { 
        toast.error("Ошибка: " + (error as Error).message); 
    } finally { 
        setIsSendingInvoice(false); 
    }
  };

  if (appContextLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-black"><Loader2 className="animate-spin w-8 h-8 text-neon-lime" /></div>;
  }

  return (
    <div className="min-h-screen bg-black text-gray-100 font-sans overflow-x-hidden">
      <FixedHeader />
      
      {/* 1. HERO */}
      <HeroSection onAuditClick={() => { setShowAudit(true); scrollToAudit(); }} />

      {/* 2. SECURITY */}
      <section className="py-16 bg-zinc-900/80 border-y border-white/5 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4">
            <div className="flex flex-col md:flex-row items-center gap-8 mb-8">
                <div className="bg-red-500/10 p-4 rounded-full border border-red-500/30">
                    <ShieldCheck className="w-10 h-10 text-red-500" />
                </div>
                <div className="text-center md:text-left">
                    <h2 className="text-2xl md:text-3xl font-bold text-white font-orbitron mb-2">ПАРАНОИДАЛЬНАЯ БЕЗОПАСНОСТЬ</h2>
                    <p className="text-gray-400 font-mono text-sm md:text-base">Мы не просим ключи от квартиры. Мы даем отмычку.</p>
                </div>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
                <div className="bg-black p-6 rounded-lg border border-gray-800 hover:border-brand-cyan/50 transition-colors group">
                    <Server className="w-8 h-8 text-brand-cyan mb-4" />
                    <h3 className="text-lg font-bold text-white mb-2">ENV Storage Only</h3>
                    <p className="text-gray-400 text-sm">Ключи в зашифрованных ENV переменных. База данных их не видит.</p>
                </div>
                <div className="bg-black p-6 rounded-lg border border-gray-800 hover:border-neon-lime/50 transition-colors group">
                    <Key className="w-8 h-8 text-neon-lime mb-4" />
                    <h3 className="text-lg font-bold text-white mb-2">Manual Admin Setup</h3>
                    <p className="text-gray-400 text-sm">API подключает только Архитектор вручную. Никаких веб-форм для секретов.</p>
                </div>
                <div className="bg-black p-6 rounded-lg border border-gray-800 hover:border-purple-500/50 transition-colors group">
                    <Lock className="w-8 h-8 text-purple-500 mb-4" />
                    <h3 className="text-lg font-bold text-white mb-2">No Vendor Lock</h3>
                    <p className="text-gray-400 text-sm">Данные твои. Экспортируй CSV. Форкай код. Будь свободен.</p>
                </div>
            </div>
        </div>
      </section>

      {/* 3. SOVEREIGNTY PANEL */}
      <section className="py-16 bg-black border-y border-white/5">
         <div className="max-w-4xl mx-auto px-4">
            <div className="flex flex-col md:flex-row items-center gap-8 mb-8">
               <div className="bg-brand-cyan/10 p-4 rounded-full border border-brand-cyan/30">
                   <Database className="w-10 h-10 text-brand-cyan" />
               </div>
               <div className="text-center md:text-left">
                   <h2 className="text-2xl md:text-3xl font-bold text-white font-orbitron mb-2">СУВЕРЕНИТЕТ ДАННЫХ</h2>
                   <p className="text-gray-400 font-mono text-sm md:text-base">
                      Ты арендуешь квартиру? Нет. Ты владеешь домом. 
                      Весь код и данные — экспортируемы в один клик.
                   </p>
               </div>
            </div>
            
            <div className="grid md:grid-cols-2 gap-8 items-start">
               <SovereigntyPanel />
               
               <div className="space-y-4 flex flex-col justify-center h-full">
                  <div className="p-5 bg-zinc-900/50 border border-zinc-800 rounded-xl hover:border-brand-cyan/50 transition-colors">
                     <h4 className="text-white font-bold mb-2 flex items-center gap-2 font-orbitron">
                        <Server className="w-5 h-5 text-brand-cyan" />
                        Self-Hosted Mode
                     </h4>
                     <p className="text-sm text-zinc-400 leading-relaxed">
                        Разверни на своем сервере. Полный контроль. 
                        Мы даем Docker-контейнер, миграции и исходники.
                     </p>
                  </div>
                  
                  <div className="p-5 bg-zinc-900/50 border border-zinc-800 rounded-xl hover:border-green-500/50 transition-colors">
                     <h4 className="text-white font-bold mb-2 flex items-center gap-2 font-orbitron">
                        <FileText className="w-5 h-5 text-green-500" />
                        Zero-Lock Export
                     </h4>
                     <p className="text-sm text-zinc-400 leading-relaxed">
                        Любые данные в CSV/JSON за 10 секунд. 
                        Никаких «дайте нам 30 дней на выгрузку».
                     </p>
                  </div>

                  <div className="p-5 bg-zinc-900/50 border border-zinc-800 rounded-xl hover:border-red-500/50 transition-colors">
                     <h4 className="text-white font-bold mb-2 flex items-center gap-2 font-orbitron">
                        <Lock className="w-5 h-5 text-red-500" />
                        Right to Erasure (GDPR/152-ФЗ)
                     </h4>
                     <p className="text-sm text-zinc-400 leading-relaxed">
                        Полное удаление по запросу. Никаких следов в бэкапах.
                     </p>
                  </div>
               </div>
            </div>
         </div>
      </section>

      {/* 4. MIGRATOR */}
      <section id="migrator" className="py-20 bg-black relative border-b border-white/5">
          <div className="max-w-4xl mx-auto px-4">
              <div className="text-center mb-12">
                  <h2 className="text-3xl font-bold text-white mb-4 font-orbitron">Миграция без боли</h2>
                  <p className="text-gray-400">Загрузи CSV. Получи склад за 10 секунд.</p>
              </div>
              <WarehouseMigrator />
          </div>
      </section>

      {/* 5. POWER RANGERS MODEL */}
      <section id="collaboration" className="py-20 bg-gradient-to-b from-zinc-900 to-black border-y border-white/5">
         <div className="max-w-5xl mx-auto px-4">
            <div className="text-center mb-12">
               <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full border border-neon-lime/30 bg-neon-lime/10 text-neon-lime font-mono text-xs mb-6">
                  КОЛЛАБОРАЦИЯ
               </div>
               <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 font-orbitron">
                  МОГУЧИЕ РЕЙНДЖЕРЫ
               </h2>
               <p className="text-gray-400 max-w-2xl mx-auto">
                  Не надо учиться кодить. Найди боль — мы превратим её в софт за вечер.
               </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8 items-stretch">
               <div className="bg-zinc-900 border border-red-500/30 p-8 rounded-2xl relative overflow-hidden group hover:border-red-500/60 transition-all">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 blur-[60px] rounded-full group-hover:bg-red-500/20 transition-all"></div>
                  <div className="relative z-10">
                     <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mb-6 border-2 border-red-500 shadow-lg shadow-red-500/20">
                        <Target className="w-8 h-8 text-red-500" />
                     </div>
                     <h3 className="text-2xl font-bold text-white mb-2 font-orbitron">ОПЕРАТОР</h3>
                     <p className="text-red-400 font-mono text-sm mb-4 uppercase tracking-wider">Ты в поле</p>
                     <ul className="space-y-3 text-sm text-gray-300">
                        <li className="flex items-start gap-3">
                           <span className="text-red-500 mt-1">►</span>
                           <span>Видишь, где люди теряют время и деньги</span>
                        </li>
                        <li className="flex items-start gap-3">
                           <span className="text-red-500 mt-1">►</span>
                           <span>Знаешь язык клиента (сленг, не код)</span>
                        </li>
                        <li className="flex items-start gap-3">
                           <span className="text-red-500 mt-1">►</span>
                           <span>Говоришь: «Нужно считать залог водителю»</span>
                        </li>
                     </ul>
                  </div>
               </div>

               <div className="bg-zinc-900 border border-brand-cyan/30 p-8 rounded-2xl relative overflow-hidden group hover:border-brand-cyan/60 transition-all">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-brand-cyan/10 blur-[60px] rounded-full group-hover:bg-brand-cyan/20 transition-all"></div>
                  <div className="relative z-10">
                     <div className="w-16 h-16 bg-brand-cyan/20 rounded-full flex items-center justify-center mb-6 border-2 border-brand-cyan shadow-lg shadow-brand-cyan/20">
                        <Cpu className="w-8 h-8 text-brand-cyan" />
                     </div>
                     <h3 className="text-2xl font-bold text-white mb-2 font-orbitron">АРХИТЕКТОР</h3>
                     <p className="text-brand-cyan font-mono text-sm mb-4 uppercase tracking-wider">У станка</p>
                     <ul className="space-y-3 text-sm text-gray-300">
                        <li className="flex items-start gap-3">
                           <span className="text-brand-cyan mt-1">►</span>
                           <span>Превращает «надо» в работающий код</span>
                        </li>
                        <li className="flex items-start gap-3">
                           <span className="text-brand-cyan mt-1">►</span>
                           <span>CyberVibe Studio: 3 минуты на фичу</span>
                        </li>
                        <li className="flex items-start gap-3">
                           <span className="text-brand-cyan mt-1">►</span>
                           <span>Деплоит сразу, без бюрократии</span>
                        </li>
                     </ul>
                  </div>
               </div>
            </div>

            <div className="mt-12 p-6 bg-black border border-zinc-800 rounded-2xl relative overflow-hidden">
               <div className="absolute inset-0 bg-gradient-to-r from-red-500/5 via-transparent to-brand-cyan/5"></div>
               <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
                  <div className="flex-1 space-y-1">
                     <p className="text-zinc-600 font-mono text-[10px] uppercase tracking-widest">15:00</p>
                     <p className="text-white font-bold font-orbitron text-lg">Боль</p>
                     <p className="text-sm text-zinc-400">«Водила торчит на 50к»</p>
                  </div>
                  <div className="text-zinc-700 font-mono text-2xl hidden md:block">→</div>
                  <div className="flex-1 space-y-1 border-t md:border-t-0 md:border-l border-zinc-800 pt-4 md:pt-0 md:pl-6">
                     <p className="text-zinc-600 font-mono text-[10px] uppercase tracking-widest">15:05</p>
                     <p className="text-white font-bold font-orbitron text-lg">Vibe Coding</p>
                     <p className="text-sm text-zinc-400">AI генерит код</p>
                  </div>
                  <div className="text-zinc-700 font-mono text-2xl hidden md:block">→</div>
                  <div className="flex-1 space-y-1 border-t md:border-t-0 md:border-l border-zinc-800 pt-4 md:pt-0 md:pl-6">
                     <p className="text-zinc-600 font-mono text-[10px] uppercase tracking-widest">15:10</p>
                     <p className="text-white font-bold font-orbitron text-lg">Deploy</p>
                     <p className="text-sm text-zinc-400">У водилы красный алерт</p>
                  </div>
               </div>
            </div>
         </div>
      </section>

      {/* 6. PRICING */}
      <section id="pricing" className="py-20 bg-zinc-900">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-16 text-white font-orbitron">СИСТЕМА (ТАРИФЫ)</h2>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto items-start">
            
            <div className="bg-zinc-900 border border-gray-800 rounded-2xl p-8 hover:border-white transition-all">
                <h3 className="text-2xl font-bold text-white mb-2">ПАРТИЗАН</h3>
                <div className="text-4xl font-bold text-white mb-4">0 ₽ <span className="text-sm text-gray-500 font-normal">/ мес</span></div>
                <p className="text-xs text-gray-400 mb-6 h-10">Для тех, кто готов делать всё руками. Полный функционал, но без API.</p>
                <ul className="space-y-3 text-sm text-gray-300 mb-8">
                    <li className="flex gap-2"><Zap className="w-4 h-4 text-zinc-500"/> До 100 SKU</li>
                    <li className="flex gap-2"><Users className="w-4 h-4 text-zinc-500"/> 1 Склад</li>
                    <li className="flex gap-2"><Database className="w-4 h-4 text-zinc-500"/> CSV Импорт</li>
                </ul>
                <Button onClick={() => { window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }); }} className="w-full bg-gray-800 hover:bg-gray-700">СОЗДАТЬ СКЛАД</Button>
            </div>

            <div className="bg-black border-2 border-brand-cyan rounded-2xl p-8 relative shadow-[0_0_30px_rgba(0,255,255,0.15)] transform scale-105 z-10">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-brand-cyan text-black px-4 py-1 rounded-full text-xs font-bold tracking-wider">РЕКОМЕНДУЕМ</div>
                <h3 className="text-2xl font-bold text-brand-cyan mb-2">ФОРСАЖ</h3>
                <div className="flex items-baseline gap-2 mb-4">
                     {setupPrice.discount > 0 && (
                        <span className="text-lg text-gray-500 line-through decoration-red-500">10 000</span>
                     )}
                     <span className="text-4xl font-bold text-white">{setupPrice.price.toLocaleString()} ₽</span>
                     <span className="text-sm text-gray-500 font-normal">/ разово</span>
                </div>
                
                {setupPrice.discount > 0 && (
                    <div className="mb-4 text-xs text-neon-lime bg-neon-lime/10 px-3 py-1 rounded border border-neon-lime/20 animate-pulse">
                        🎉 Скидка Синдиката активирована!
                    </div>
                )}

                <p className="text-xs text-gray-400 mb-6 h-10">Мы всё настроим. Подключим API WB/Ozon. Обучим персонал.</p>
                <ul className="space-y-3 text-sm text-gray-300 mb-8">
                    <li className="flex gap-2"><Zap className="w-4 h-4 text-brand-cyan"/> <strong>API Синхронизация</strong></li>
                    <li className="flex gap-2"><Users className="w-4 h-4 text-brand-cyan"/> Обучение команды</li>
                    <li className="flex gap-2"><Server className="w-4 h-4 text-brand-cyan"/> Приоритетный саппорт</li>
                </ul>
                <Button onClick={() => handleSendInvoice('quick_setup')} disabled={isSendingInvoice} className="w-full bg-brand-cyan hover:bg-brand-cyan/80 text-black font-bold h-12">
                    {isSendingInvoice ? <Loader2 className="animate-spin"/> : "ЗАКАЗАТЬ НАСТРОЙКУ"}
                </Button>
            </div>

            <div className="bg-zinc-900 border border-purple-500/30 rounded-2xl p-8 hover:border-purple-500 transition-all">
                <h3 className="text-2xl font-bold text-purple-400 mb-2">CYBERSCHOOL</h3>
                <div className="text-4xl font-bold text-white mb-4">Бесценно</div>
                <p className="text-xs text-gray-400 mb-6 h-10">Выросли из облака? Мы поможем развернуть свой инстанс.</p>
                <ul className="space-y-3 text-sm text-gray-300 mb-8">
                    <li className="flex gap-2"><GitFork className="w-4 h-4 text-purple-500"/> Fork Repo on GitHub</li>
                    <li className="flex gap-2"><Database className="w-4 h-4 text-purple-500"/> Own Supabase Instance</li>
                    <li className="flex gap-2"><Code2 className="w-4 h-4 text-purple-500"/> Full Code Control</li>
                </ul>
                <Link href="https://github.com/salavey13/carTest" target="_blank">
                    <Button variant="outline" className="w-full border-purple-500 text-purple-400 hover:bg-purple-500/10">GITHUB REPO</Button>
                </Link>
            </div>
          </div>
        </div>
      </section>
      
      {/* 7. REFERRAL SYSTEM */}
      
      <section className="py-20 bg-gradient-to-r from-indigo-900/20 to-purple-900/20 border-y border-indigo-500/20">
         <div className="max-w-3xl mx-auto px-4 text-center">
            <div className="flex items-center justify-center gap-3 mb-6">
               <Anchor className="w-8 h-8 text-indigo-400" />
               <h2 className="text-3xl md:text-4xl font-bold text-white font-orbitron">СИНДИКАТ</h2>
            </div>
            <p className="text-gray-400 mb-8 text-lg">
                Не плати за софт. Пусть за него платят другие.
            </p>
            <ReferralPirateCard />
            <div className="mt-8">
               <Link href="/wblanding/referral" className="inline-flex items-center text-indigo-400 hover:text-indigo-300 hover:underline font-mono text-sm">
                  Манифест Синдиката (Как это работает) <ArrowRight className="ml-2 w-4 h-4" />
               </Link>
            </div>
         </div>
      </section>

      {/* 6. PAIN POINTS */}
      <section className="py-20 bg-black border-y border-white/10">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl md:text-5xl font-bold text-center mb-16 text-white font-orbitron">ПОЧЕМУ ОНИ ВАС БЕСЯТ</h2>
          <div className="grid md:grid-cols-3 gap-8">
             <div className="bg-zinc-900 border border-red-900/30 p-6 rounded-xl hover:border-red-500/50 transition-colors">
                <Ban className="w-12 h-12 text-red-600 mb-4 opacity-50" />
                <h3 className="text-xl font-bold text-red-500 mb-4">Жадность</h3>
                <p className="text-gray-400 text-sm">Тарифы растут. Платишь за воздух. <br/><span className="text-brand-cyan font-bold mt-2 block">Ответ: Freemium.</span></p>
             </div>
             <div className="bg-zinc-900 border border-red-900/30 p-6 rounded-xl hover:border-red-500/50 transition-colors">
                <Skull className="w-12 h-12 text-red-600 mb-4 opacity-50" />
                <h3 className="text-xl font-bold text-red-500 mb-4">Саппорт-Зомби</h3>
                <p className="text-gray-400 text-sm">Ответ через 24ч. Шаблоны. <br/><span className="text-brand-cyan font-bold mt-2 block">Ответ: Чат с девами.</span></p>
             </div>
             <div className="bg-zinc-900 border border-red-900/30 p-6 rounded-xl hover:border-red-500/50 transition-colors">
                <Fingerprint className="w-12 h-12 text-red-600 mb-4 opacity-50" />
                <h3 className="text-xl font-bold text-red-500 mb-4">UI из 2005</h3>
                <p className="text-gray-400 text-sm">Нужен ПК. 1000 кликов. <br/><span className="text-brand-cyan font-bold mt-2 block">Ответ: Native TWA.</span></p>
             </div>
          </div>
        </div>
      </section>

      {/* 7. AUDIT */}
      {showAudit && (
        <section id="audit-tool" className="py-16 px-4 bg-white/5 backdrop-blur-sm" ref={auditRef}>
          <WarehouseAuditTool />
        </section>
      )}

      {/* 8. REVIEWS */}
      <ReviewsSection />

      {/* 9. CREW CREATION & LIST */}
      <section className="py-24 bg-zinc-900 text-center border-t border-gray-800">
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-8 font-orbitron">ТВОЙ СКЛАД ЖДЕТ</h2>
          <CrewCreationForm />
          
          <div className="mt-20 max-w-6xl mx-auto px-4">
              <h3 className="text-xl font-bold text-gray-500 mb-8 font-orbitron uppercase tracking-widest">/// Active Sectors</h3>
              <CrewsListSimplified />
          </div>
      </section>

      <WbFooter />
      <ExitIntentPopup />
    </div>
  );
}