"use client";

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useAppContext } from "@/contexts/AppContext";
import { sendServiceInvoice, notifyAdmin } from "@/app/actions";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { 
  Loader2, ShieldCheck, Server, Lock, Zap, Clock, Users, 
  Smartphone, BarChart3, Database, Ban, Skull, Fingerprint, 
  Key, Anchor, ArrowRight 
} from 'lucide-react';

// --- Components ---
import { FixedHeader } from "./components/FixedHeader";
import { HeroSection } from "./components/HeroSection";
import { WarehouseMigrator } from "./components/WarehouseMigrator";
import { WarehouseAuditTool } from "./components/WarehouseAuditTool";
import { CrewCreationForm } from "./components/CrewCreationForm";
import { ReferralPirateCard } from "./components/ReferralPirateCard";
import { WbFooter } from "./components/WbFooter";
import { ExitIntentPopup } from "./components/ExitIntentPopup";

// --- Actions ---
import { getApprovedTestimonials } from "./actions_view";

interface Testimonial {
  id: string;
  username?: string;
  content: string;
  rating: number;
}

export default function WarehouseLandingPage() {
  const { dbUser, isLoading: appContextLoading } = useAppContext();
  const [showAudit, setShowAudit] = useState(false);
  const [isSendingInvoice, setIsSendingInvoice] = useState(false);
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const auditRef = useRef<HTMLDivElement>(null);

  // Load Social Proof
  useEffect(() => {
    getApprovedTestimonials().then(res => {
       if(res.success && res.data) setTestimonials(res.data as any);
    });
  }, []);

  const scrollToAudit = () => {
    setTimeout(() => {
      auditRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const handleSendInvoice = async (serviceType: 'quick_setup' | 'team_training', amount: number) => {
    if (!dbUser?.user_id) { toast.error("Пожалуйста, войдите в систему"); return; }
    setIsSendingInvoice(true);
    try {
      const services = {
        quick_setup: { name: "🎯 Автоматизация склада за 1 день", description: "Полная настройка, API setup, обучение (2 часа)", amount: 10000 },
        team_training: { name: "👨‍🏫 Обучение команды с нуля", description: "Обучение менеджеров и кладовщиков, чек-листы", amount: 10000 }
      };
      const service = services[serviceType];
      const result = await sendServiceInvoice(dbUser.user_id, serviceType, service.name, service.description, service.amount);
      if (result.success) {
        toast.success(`✅ Счет на ${service.amount}₽ отправлен в Telegram!`);
        await notifyAdmin(`💰 Order: ${service.name} by ${dbUser.username}`);
      } else throw new Error(result.error);
    } catch (error) { toast.error("Ошибка: " + (error as Error).message); } 
    finally { setIsSendingInvoice(false); }
  };

  if (appContextLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-black"><Loader2 className="animate-spin w-8 h-8 text-neon-lime" /></div>;
  }

  return (
    <div className="min-h-screen bg-black text-gray-100 font-sans overflow-x-hidden">
      <FixedHeader />
      
      {/* 1. HERO SECTION (Video + Hook) */}
      <HeroSection onAuditClick={() => { setShowAudit(true); scrollToAudit(); }} />

      {/* 2. SECURITY & TRUST (Anti-Fear) */}
      <section className="py-16 bg-zinc-900/80 border-y border-white/5 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4">
            <div className="flex flex-col md:flex-row items-center gap-8 mb-8">
                <div className="bg-red-500/10 p-4 rounded-full border border-red-500/30 shadow-[0_0_15px_rgba(255,0,0,0.2)]">
                    <ShieldCheck className="w-10 h-10 text-red-500" />
                </div>
                <div className="text-center md:text-left">
                    <h2 className="text-2xl md:text-3xl font-bold text-white font-orbitron mb-2">ПАРАНОИДАЛЬНАЯ БЕЗОПАСНОСТЬ</h2>
                    <p className="text-gray-400 font-mono text-sm md:text-base">Почему мы не просим API ключи прямо сейчас? Потому что это тупо и опасно.</p>
                </div>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
                <div className="bg-black p-6 rounded-lg border border-gray-800 hover:border-brand-cyan/50 transition-colors group">
                    <Server className="w-8 h-8 text-brand-cyan mb-4 group-hover:scale-110 transition-transform" />
                    <h3 className="text-lg font-bold text-white mb-2">ENV Storage Only</h3>
                    <p className="text-gray-400 text-sm">Ключи никогда не пишутся в БД. Они хранятся только в зашифрованных ENV переменных сервера.</p>
                </div>
                <div className="bg-black p-6 rounded-lg border border-gray-800 hover:border-neon-lime/50 transition-colors group">
                    <Key className="w-8 h-8 text-neon-lime mb-4 group-hover:scale-110 transition-transform" />
                    <h3 className="text-lg font-bold text-white mb-2">Manual Admin Setup</h3>
                    <p className="text-gray-400 text-sm">API подключает только Superadmin вручную. Исключает утечки через веб.</p>
                </div>
                <div className="bg-black p-6 rounded-lg border border-gray-800 hover:border-purple-500/50 transition-colors group">
                    <Lock className="w-8 h-8 text-purple-500 mb-4 group-hover:scale-110 transition-transform" />
                    <h3 className="text-lg font-bold text-white mb-2">Sandbox First</h3>
                    <p className="text-gray-400 text-sm">Сначала CSV. Привыкайте к UI. API только по готовности.</p>
                </div>
            </div>
        </div>
      </section>

      {/* 3. CSV MIGRATOR (The "Hook") */}
      <section id="migrator" className="py-20 bg-black relative border-b border-white/5">
          <div className="max-w-4xl mx-auto px-4">
              <div className="text-center mb-12">
                  <h2 className="text-3xl font-bold text-white mb-4 font-orbitron">Миграция через Excel / CSV</h2>
                  <p className="text-gray-400">Скачайте отчет остатков из МойСклад/WB. Вставьте. Получите базу.</p>
              </div>
              <WarehouseMigrator />
          </div>
      </section>

      {/* 4. FEATURES (The Value) */}
      <section id="features" className="py-20 bg-zinc-900">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-16 text-white font-orbitron">АРСЕНАЛ БУНТАРЯ</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              { icon: Zap, title: "Синхронизация (Alpha)", description: "Авто-обновление остатков WB/Ozon/YM (после верификации)." },
              { icon: Clock, title: "Контроль смен", description: "Фиксация 'кто трогал коробку'. Чекпоинты." },
              { icon: Users, title: "Мульти-Крю", description: "Управление несколькими складами. Роли: Оунер, Менеджер." },
              { icon: Smartphone, title: "Telegram Native", description: "Всё в телефоне. Не нужно покупать сканеры." },
              { icon: BarChart3, title: "Визуализация", description: "Интерактивная карта склада. Видишь, где лежит товар." },
              { icon: Database, title: "CSV Экспорт", description: "Забирай свои данные в любой момент." }
            ].map((f, i) => (
              <motion.div key={i} className="bg-black/50 p-8 rounded-xl border border-gray-800 hover:border-brand-cyan/40 transition-all duration-300 group"
                initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}>
                <f.icon className="w-10 h-10 text-brand-cyan mb-6 group-hover:scale-110 transition-transform" />
                <h3 className="text-xl font-bold mb-4 text-white">{f.title}</h3>
                <p className="text-gray-400 leading-relaxed">{f.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. PAIN POINTS (The Enemy) */}
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

      {/* 6. PRICING (The Offer) */}
      <section id="pricing" className="py-20 bg-zinc-900">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-16 text-white font-orbitron">ТАРИФЫ</h2>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* FREE */}
            <div className="bg-black border border-gray-700 rounded-2xl p-8 hover:border-white transition-all">
                <h3 className="text-2xl font-bold text-white mb-2">ПАРТИЗАН</h3>
                <div className="text-4xl font-bold text-white mb-4">0 ₽</div>
                <ul className="space-y-2 text-sm text-gray-300 mb-8">
                    <li>• До 100 SKU</li>
                    <li>• 1 Склад</li>
                    <li>• CSV Импорт</li>
                </ul>
                <Button onClick={() => { window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }); }} className="w-full bg-gray-800">НАЧАТЬ</Button>
            </div>
            {/* PRO */}
            <div className="bg-black border-2 border-brand-cyan rounded-2xl p-8 relative shadow-[0_0_30px_rgba(0,255,255,0.15)]">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-brand-cyan text-black px-4 py-1 rounded-full text-xs font-bold">TOP</div>
                <h3 className="text-2xl font-bold text-brand-cyan mb-2">КАПИТАН</h3>
                <div className="text-4xl font-bold text-white mb-4">4 900 ₽</div>
                <ul className="space-y-2 text-sm text-gray-300 mb-8">
                    <li>• 500 SKU</li>
                    <li>• API Sync (WB/Ozon)</li>
                    <li>• Приоритет Support</li>
                </ul>
                <Button className="w-full bg-brand-cyan hover:bg-brand-cyan/80 text-black font-bold">В ЛИСТ ОЖИДАНИЯ</Button>
            </div>
            {/* ENTERPRISE */}
            <div className="bg-black border border-purple-500/50 rounded-2xl p-8">
                <h3 className="text-2xl font-bold text-purple-400 mb-2">ИМПЕРИЯ</h3>
                <div className="text-xl font-bold text-white mb-4">Индив.</div>
                <ul className="space-y-2 text-sm text-gray-300 mb-8">
                    <li>• Безлимит</li>
                    <li>• Выделенный сервер</li>
                    <li>• Личный менеджер</li>
                </ul>
                <Button variant="outline" className="w-full border-purple-500 text-purple-400">ЗАПРОСИТЬ</Button>
            </div>
          </div>
        </div>
      </section>

      {/* 7. SERVICES (Upsell) */}
      <section className="py-16 bg-black">
         <div className="max-w-4xl mx-auto px-4 text-center">
            <h3 className="text-2xl font-bold text-gray-200 mb-8">Нужна помощь? (One-Time)</h3>
            <div className="grid md:grid-cols-2 gap-6">
                <div className="border border-gray-700 p-6 rounded-xl bg-zinc-900/50">
                    <h4 className="text-xl font-bold text-white mb-2">🎯 Настройка под ключ</h4>
                    <div className="text-2xl font-bold text-brand-cyan mb-4">10 000 ₽</div>
                    <Button onClick={() => handleSendInvoice('quick_setup', 10000)} disabled={isSendingInvoice} className="w-full bg-gray-800 hover:bg-brand-cyan hover:text-black">
                        {isSendingInvoice ? <Loader2 className="animate-spin"/> : "ЗАКАЗАТЬ"}
                    </Button>
                </div>
                <div className="border border-gray-700 p-6 rounded-xl bg-zinc-900/50">
                    <h4 className="text-xl font-bold text-white mb-2">👨‍🏫 Обучение команды</h4>
                    <div className="text-2xl font-bold text-brand-cyan mb-4">10 000 ₽</div>
                    <Button onClick={() => handleSendInvoice('team_training', 10000)} disabled={isSendingInvoice} className="w-full bg-gray-800 hover:bg-brand-cyan hover:text-black">
                        {isSendingInvoice ? <Loader2 className="animate-spin"/> : "ЗАКАЗАТЬ"}
                    </Button>
                </div>
            </div>
         </div>
      </section>
      
      {/* 8. REFERRAL SYSTEM (The Virus) */}
      <section className="py-20 bg-gradient-to-r from-indigo-900/20 to-purple-900/20 border-y border-indigo-500/20">
         <div className="max-w-3xl mx-auto px-4 text-center">
            <div className="flex items-center justify-center gap-3 mb-6">
               <Anchor className="w-8 h-8 text-indigo-400" />
               <h2 className="text-3xl md:text-4xl font-bold text-white font-orbitron">СИНДИКАТ (Referral)</h2>
            </div>
            <p className="text-gray-400 mb-8 text-lg">
               Не плати за софт. Пусть за него платят другие. 
               <br/>Получи <span className="text-white font-bold">личный промокод (твой ник)</span> и зарабатывай на каждом приглашенном.
            </p>
            <ReferralPirateCard />
            
            <div className="mt-8">
               <Link href="/wblanding/referral" className="inline-flex items-center text-indigo-400 hover:text-indigo-300 hover:underline font-mono">
                  Читать манифест синдиката <ArrowRight className="ml-2 w-4 h-4" />
               </Link>
            </div>
         </div>
      </section>

      {/* 9. AUDIT TOOL (The Lead Magnet) */}
      {showAudit && (
        <section id="audit-tool" className="py-16 px-4 bg-white/5 backdrop-blur-sm" ref={auditRef}>
          <WarehouseAuditTool />
        </section>
      )}

      {/* 10. TESTIMONIALS (Social Proof) */}
      <section className="py-20 bg-zinc-900">
        <div className="max-w-6xl mx-auto px-4">
            <h2 className="text-3xl font-bold text-center mb-12 text-white font-orbitron">ЭФИР (ОТЗЫВЫ)</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {testimonials.length > 0 ? testimonials.map((t, i) => (
                    <div key={i} className="bg-black p-6 rounded-xl border border-gray-800">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center font-bold text-brand-cyan text-xs">
                                {t.username?.[0]?.toUpperCase() || 'U'}
                            </div>
                            <div className="font-bold text-white text-sm">{t.username || 'Аноним'}</div>
                        </div>
                        <p className="text-gray-400 text-sm italic">"{t.content}"</p>
                    </div>
                )) : (
                    <div className="col-span-full text-center text-gray-500 italic">Пока тихо...</div>
                )}
            </div>
        </div>
      </section>

      {/* 11. FAQ */}
      <section className="py-20 bg-black">
          <div className="max-w-3xl mx-auto px-4">
            <h2 className="text-3xl font-bold text-center mb-8 text-white font-orbitron">FAQ</h2>
            <Accordion type="single" collapsible className="w-full space-y-2">
                <AccordionItem value="item-1" className="border-b border-gray-800">
                    <AccordionTrigger className="text-gray-200 hover:text-brand-cyan text-left">Где подвох (бесплатно)?</AccordionTrigger>
                    <AccordionContent className="text-gray-400">Нет подвоха. Мы зарабатываем на сложных внедрениях и Enterprise. База — бесплатно.</AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-2" className="border-b border-gray-800">
                    <AccordionTrigger className="text-gray-200 hover:text-brand-cyan text-left">Безопасно ли?</AccordionTrigger>
                    <AccordionContent className="text-gray-400">Да. CSV парсится в RAM. API ключи в ENV.</AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-3" className="border-b border-gray-800">
                    <AccordionTrigger className="text-gray-200 hover:text-brand-cyan text-left">Как работает рефералка?</AccordionTrigger>
                    <AccordionContent className="text-gray-400">Ты даешь другу код. Он получает скидку 1000р. Ты получаешь 2000р (20% от чека) при его оплате настройки.</AccordionContent>
                </AccordionItem>
            </Accordion>
          </div>
      </section>

      {/* 12. CREW CREATION (Final CTA) */}
      <section className="py-24 bg-zinc-900 text-center border-t border-gray-800">
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-8 font-orbitron">ТВОЙ СКЛАД ЖДЕТ</h2>
          <CrewCreationForm />
      </section>

      <WbFooter />
      <ExitIntentPopup />
    </div>
  );
}