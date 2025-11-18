"use client";
import { FixedHeader } from "./components/FixedHeader";
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from "next/navigation";
import { useAppContext } from "@/contexts/AppContext";
import { createCrew, sendServiceInvoice, notifyAdmin } from "@/app/actions";
import { sendComplexMessage } from '@/app/webhook-handlers/actions/sendComplexMessage';
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { CrewsListSimplified } from "./components/CrewsListSimplified";
import { WarehouseAuditTool } from "./components/WarehouseAuditTool";
import { ExitIntentPopup } from "./components/ExitIntentPopup";
import { FaSkullCrossbones, FaRocket, FaUserPlus, FaGhost, FaBolt, FaUsers, FaCheck, FaTimes, FaArrowRight } from 'react-icons/fa6';
import { Loader2, Zap, CheckCircle2, XCircle } from 'lucide-react';
import Image from 'next/image';

const generateSlug = (name: string) =>
  name.toLowerCase().trim().replace(/[\s_]+/g, '-').replace(/[^\w-]+/g, '').replace(/--+/g, '-').replace(/^-+|-+$/g, '');

// --- ANIMATION VARIANTS ---
const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } }
};

export default function WarehouseLandingPage() {
  const { dbUser, isLoading: appContextLoading } = useAppContext();
  const [showAudit, setShowAudit] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [hqLocation, setHqLocation] = useState("56.3269,44.0059"); // Nizhny Novgorod default
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdCrew, setCreatedCrew] = useState<{ slug: string; name: string } | null>(null);
  const [isSendingInvoice, setIsSendingInvoice] = useState(false);

  const auditRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setSlug(generateSlug(name)); }, [name]);

  const scrollToAudit = () => {
    setTimeout(() => {
      auditRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dbUser?.user_id) { toast.error("Сначала войдите в систему через Telegram"); return; }
    if (!slug) { toast.error("Slug не может быть пустым."); return; }
    setIsSubmitting(true);
    try {
      const result = await createCrew({
        name, slug, description, logo_url: logoUrl, owner_id: dbUser.user_id, hq_location: hqLocation,
      });
      if (result.success && result.data) {
        toast.success(`Склад "${result.data.name}" активирован!`);
        setCreatedCrew({ slug: result.data.slug, name: result.data.name });
        await notifyAdmin(`🎉 New Warehouse: ${result.data.name} by ${dbUser.username}`);
      } else { throw new Error(result.error); }
    } catch (error) { toast.error("Ошибка при создании склада."); } finally { setIsSubmitting(false); }
  };

  const handleInvite = async () => {
    if (!createdCrew) return;
    const inviteUrl = `https://t.me/oneBikePlsBot/app?startapp=crew_${createdCrew.slug}_join_crew`;
    window.open(`https://t.me/share/url?url=${encodeURIComponent(inviteUrl)}&text=${encodeURIComponent(`Присоединяйся к складу ${createdCrew.name}`)}`, "_blank");
  };

  const handleSendInvoice = async (serviceType: 'quick_setup' | 'team_training', amount: number) => {
    if (!dbUser?.user_id) { toast.error("Нужна авторизация"); return; }
    setIsSendingInvoice(true);
    try {
      const services = {
        quick_setup: { name: "🎯 Быстрый старт", description: "Настройка и интеграция за 24 часа", amount },
        team_training: { name: "👨‍🏫 Обучение команды", description: "Мастер-класс для персонала", amount }
      };
      const res = await sendServiceInvoice(dbUser.user_id, serviceType, services[serviceType].name, services[serviceType].description, amount);
      if (res.success) toast.success("Счет отправлен в Telegram!");
      else throw new Error(res.error);
    } catch (e) { toast.error("Ошибка отправки счета"); } finally { setIsSendingInvoice(false); }
  };

  const handlePlanAction = async (planType: string, action: () => void) => {
    action();
    if (dbUser?.user_id) await sendComplexMessage(dbUser.user_id, `Вы выбрали тариф ${planType}. Скоро свяжемся!`, []);
  };

  if (appContextLoading) return <div className="min-h-screen flex items-center justify-center bg-black text-white"><Loader2 className="animate-spin w-8 h-8 text-indigo-500" /></div>;

  return (
    <div className="min-h-screen bg-zinc-950 text-white font-sans selection:bg-indigo-500 selection:text-white">
      <FixedHeader />
      
      {/* --- HERO SECTION --- */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-black">
        <div className="absolute inset-0 w-full h-full z-0 opacity-50">
             <video className="w-full h-full object-cover" autoPlay loop muted playsInline 
                src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/grok-video-882e5db9-d256-42f2-a77a-da36b230f67e-0.mp4" 
             />
             <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/40 to-zinc-950" />
        </div>

        <div className="relative z-10 container mx-auto px-4 text-center pt-20">
          <motion.div 
             initial={{ opacity: 0, scale: 0.8 }} 
             animate={{ opacity: 1, scale: 1 }} 
             className="mb-6 inline-block"
          >
             <span className="px-4 py-1.5 rounded-full border border-indigo-500/50 bg-indigo-500/10 text-indigo-300 text-sm font-mono tracking-widest uppercase backdrop-blur-md">
                Vibe Coding v1.0
             </span>
          </motion.div>

          <motion.h1 
            className="text-5xl md:text-7xl lg:text-8xl font-black text-white mb-6 tracking-tighter leading-[1.1]"
            initial="hidden" animate="visible" variants={fadeInUp}
          >
            Хватит платить за <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 animate-gradient-x">
              Корпоративный Воздух.
            </span>
          </motion.h1>

          <motion.p 
            className="text-xl md:text-2xl text-gray-300 max-w-3xl mx-auto mb-10 leading-relaxed"
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ delay: 0.2 }}
          >
            Мы скопировали лучшие фичи дорогих WMS, выкинули лишнее и сделали это бесплатным.
            <br className="hidden md:block"/>
            <span className="text-white font-semibold">Срежь штрафы на 73%</span> без покупки энтерпрайз софта.
          </motion.p>

          <motion.div 
            className="flex flex-col sm:flex-row gap-4 justify-center items-center"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
          >
            <Button 
              onClick={() => { setShowAudit(true); scrollToAudit(); toast("Давай найдем твои потерянные деньги 💸"); }} 
              size="lg" 
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-6 text-lg rounded-full font-bold shadow-[0_0_20px_rgba(79,70,229,0.5)] hover:shadow-[0_0_30px_rgba(79,70,229,0.7)] transition-all transform hover:-translate-y-1"
            >
              <FaSkullCrossbones className="mr-2" /> ПОСЧИТАТЬ УБЫТКИ
            </Button>
            <Link href="https://t.me/oneBikePlsBot/app" target="_blank">
              <Button variant="outline" size="lg" className="border-white/20 text-white hover:bg-white/10 px-8 py-6 text-lg rounded-full font-medium backdrop-blur-sm">
                <FaRocket className="mr-2 text-indigo-400" /> Запуск (Telegram)
              </Button>
            </Link>
          </motion.div>
          
          <motion.p 
             initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}
             className="mt-6 text-sm text-gray-500 font-mono"
          >
             *Без кредитной карты. Без звонков менеджеров. Только код.
          </motion.p>
        </div>
      </section>

      {/* --- AUDIT TOOL --- */}
      {showAudit && (
        <section id="audit-tool" className="py-20 px-4 bg-zinc-900 border-y border-zinc-800" ref={auditRef}>
          <div className="container mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Цена Хаоса</h2>
              <p className="text-gray-400">Узнай точную сумму, которую ты сжигаешь каждый месяц в "ручном режиме".</p>
            </div>
            <WarehouseAuditTool />
          </div>
        </section>
      )}

      {/* --- MANIFESTO --- */}
      <section className="py-24 bg-white text-zinc-900">
        <div className="container mx-auto px-4 max-w-4xl">
          <motion.div 
            initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInUp}
            className="prose prose-lg prose-indigo mx-auto"
          >
            <h3 className="text-indigo-600 font-bold uppercase tracking-wide text-sm mb-2">Пиратский Манифест</h3>
            <h2 className="text-4xl font-black text-zinc-900 mb-8">Маркетплейсы доили нас как коров. Пока мы не сменили игру.</h2>
            
            <p className="text-xl text-zinc-600 mb-6">
              Мы были как вы. Остатки врали. Сотрудники "забывали". Excel таблицы умирали от нагрузки.
              Штрафы приходили так, будто мы лично оскорбили Wildberries.
            </p>
            
            <div className="bg-zinc-100 p-8 rounded-2xl border-l-4 border-indigo-500 my-8">
              <p className="italic font-medium text-zinc-800 text-lg m-0">
                "Почему склад — это такая жопа, если по сути там нужно просто знать, что где лежит и кто что трогал?"
              </p>
            </div>

            <p>
              Мы отключили эмоции и включили минимальный порядок.
              <br/>
              <strong>Хаос исчезает, когда ты перестаешь с ним дружить.</strong>
            </p>
            <p>
              Удивительно, но штрафы начали проседать… не потому что мы стали умнее, а потому что склад перестал жить как подпольный клуб без света.
              И вот фокус: <strong>Мы не покупали дорогую ERP за миллионы. Мы написали скрипт.</strong>
            </p>
            
            <p className="font-bold text-zinc-900">
              Теперь мы отдаем этот скрипт вам. Потому что платить за воздух — это преступление.
            </p>
          </motion.div>
        </div>
      </section>

      {/* --- COMPARISON --- */}
      <section className="py-24 bg-zinc-100 border-t border-zinc-200 text-zinc-900">
        <div className="container mx-auto px-4 max-w-6xl">
           <div className="text-center mb-16">
             <h2 className="text-3xl md:text-5xl font-black text-zinc-900 mb-6">Давид против Голиафа</h2>
             <p className="text-xl text-zinc-600">Они продают сложность. Мы даем ясность.</p>
           </div>

           <div className="grid md:grid-cols-2 gap-8 items-center">
              {/* The "Bad" Guys */}
              <motion.div 
                whileHover={{ scale: 0.98 }}
                className="bg-white p-8 rounded-3xl shadow-xl border border-red-100 relative overflow-hidden grayscale opacity-80 hover:grayscale-0 hover:opacity-100 transition-all duration-500"
              >
                 <div className="absolute top-0 right-0 bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-bl-xl">OLD SCHOOL</div>
                 <h3 className="text-2xl font-bold text-zinc-400 mb-6">Типичные ERP (МойСклад и др.)</h3>
                 <ul className="space-y-4">
                    <li className="flex items-center text-zinc-500 gap-3"><XCircle className="text-red-400 flex-shrink-0"/> Дорогие подписки (от 15к/мес)</li>
                    <li className="flex items-center text-zinc-500 gap-3"><XCircle className="text-red-400 flex-shrink-0"/> Интерфейс "из 2005 года"</li>
                    <li className="flex items-center text-zinc-500 gap-3"><XCircle className="text-red-400 flex-shrink-0"/> Нужно обучение 2 недели</li>
                    <li className="flex items-center text-zinc-500 gap-3"><XCircle className="text-red-400 flex-shrink-0"/> Техподдержка отвечает днями</li>
                 </ul>
              </motion.div>

              {/* The "Good" Guys */}
              <motion.div 
                whileHover={{ scale: 1.02 }}
                className="bg-zinc-900 p-8 rounded-3xl shadow-2xl border border-indigo-500/30 relative overflow-hidden group"
              >
                 <div className="absolute inset-0 bg-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity"/>
                 <div className="absolute top-0 right-0 bg-indigo-500 text-white text-xs font-bold px-3 py-1 rounded-bl-xl">VIBE CODED</div>
                 <h3 className="text-2xl font-bold text-white mb-6">WarehouseBot</h3>
                 <ul className="space-y-4 relative z-10">
                    <li className="flex items-center text-white gap-3"><CheckCircle2 className="text-green-400 flex-shrink-0"/> <span className="font-bold">Бесплатный старт</span></li>
                    <li className="flex items-center text-white gap-3"><CheckCircle2 className="text-green-400 flex-shrink-0"/> Работает в Telegram (Mobile First)</li>
                    <li className="flex items-center text-white gap-3"><CheckCircle2 className="text-green-400 flex-shrink-0"/> Обучение не требуется</li>
                    <li className="flex items-center text-white gap-3"><CheckCircle2 className="text-green-400 flex-shrink-0"/> Поддержка напрямую от фаундера</li>
                 </ul>
                 <div className="mt-8">
                    <Button className="w-full bg-white text-black hover:bg-indigo-50 font-bold rounded-xl py-6">
                       Перейти на Светлую Сторону <ArrowRight className="ml-2 w-4 h-4"/>
                    </Button>
                 </div>
              </motion.div>
           </div>
        </div>
      </section>

      {/* --- FEATURES --- */}
      <section id="features" className="py-24 bg-black text-white border-t border-zinc-800">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-5xl font-black text-center mb-16">
             Функции для <span className="text-indigo-500">Скорости</span>, а не для галочки.
          </h2>
          
          <div className="grid md:grid-cols-3 gap-8">
             {[
                { icon: FaBolt, title: "Моментальный Синк", desc: "API обновляет остатки WB/Ozon в реальном времени. Забудь про штрафы за отмену." },
                { icon: FaGhost, title: "Охотник за Ghost Stock", desc: "Визуальная карта склада. Находи потерянные товары за секунды." },
                { icon: FaUsers, title: "Геймификация", desc: "XP и стрики для сотрудников. Преврати скучную упаковку в соревнование." },
             ].map((f, i) => (
                <motion.div 
                  key={i} 
                  initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: i*0.1 }}
                  className="bg-zinc-900 p-8 rounded-2xl border border-zinc-800 hover:border-indigo-500 transition-colors group"
                >
                   <f.icon className="w-10 h-10 text-zinc-500 group-hover:text-indigo-400 mb-4 transition-colors"/>
                   <h3 className="text-xl font-bold mb-2">{f.title}</h3>
                   <p className="text-zinc-400">{f.desc}</p>
                </motion.div>
             ))}
          </div>
        </div>
      </section>

      {/* --- PRICING --- */}
      <section id="pricing" className="py-24 bg-zinc-50 text-zinc-900">
         <div className="container mx-auto px-4 max-w-5xl">
            <div className="text-center mb-16">
               <h2 className="text-3xl md:text-5xl font-black text-zinc-900 mb-4">Цены для Людей</h2>
               <p className="text-lg text-zinc-600">Мы берем деньги за сложность, а не за воздух. База — бесплатно.</p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
               {/* Free Tier */}
               <div className="bg-white p-8 rounded-2xl border-2 border-zinc-100 shadow-lg hover:border-zinc-300 transition-all">
                  <h3 className="text-xl font-bold text-zinc-900">Лицензия Пирата</h3>
                  <div className="text-4xl font-black mt-4 mb-2">0₽</div>
                  <p className="text-sm text-zinc-500 mb-6">Навсегда. Без карты.</p>
                  <ul className="space-y-3 mb-8 text-sm text-zinc-600">
                     <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-green-500"/> 1 Склад</li>
                     <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-green-500"/> 100 SKU</li>
                     <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-green-500"/> Базовый Telegram Бот</li>
                  </ul>
                  <Button 
                    onClick={() => handlePlanAction('free', () => toast.success("Добро пожаловать на борт!"))}
                    className="w-full bg-zinc-900 hover:bg-zinc-800 text-white font-bold"
                  >Начать Бесплатно</Button>
               </div>

               {/* Pro Tier */}
               <div className="bg-indigo-600 p-8 rounded-2xl shadow-2xl transform md:-translate-y-4 relative overflow-hidden">
                  <div className="absolute top-0 right-0 bg-white text-indigo-600 text-xs font-bold px-3 py-1">ХИТ</div>
                  <h3 className="text-xl font-bold text-white">Pro Автоматизация</h3>
                  <div className="text-4xl font-black text-white mt-4 mb-2">4,900₽</div>
                  <p className="text-sm text-indigo-200 mb-6">в месяц. Отмена в любой момент.</p>
                  <ul className="space-y-3 mb-8 text-sm text-white">
                     <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-indigo-300"/> 3 Склада</li>
                     <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-indigo-300"/> 500+ SKU</li>
                     <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-indigo-300"/> Полный API Синк (WB/Ozon)</li>
                     <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-indigo-300"/> Управление Сменами</li>
                  </ul>
                  <Button 
                     onClick={() => handlePlanAction('pro', () => toast.info("Выбор Pro тарифа..."))}
                     className="w-full bg-white text-indigo-600 hover:bg-indigo-50 font-bold"
                  >Выбрать Pro</Button>
               </div>

               {/* One-Time Service */}
               <div className="bg-white p-8 rounded-2xl border-2 border-green-100 shadow-lg hover:border-green-300 transition-all">
                  <h3 className="text-xl font-bold text-zinc-900">Быстрый Старт</h3>
                  <div className="text-4xl font-black mt-4 mb-2">10k₽</div>
                  <p className="text-sm text-zinc-500 mb-6">Разовый платеж.</p>
                  <ul className="space-y-3 mb-8 text-sm text-zinc-600">
                     <li className="flex gap-2"><Zap className="w-4 h-4 text-green-500"/> Настройка "под ключ"</li>
                     <li className="flex gap-2"><Zap className="w-4 h-4 text-green-500"/> Обучение персонала (2ч)</li>
                     <li className="flex gap-2"><Zap className="w-4 h-4 text-green-500"/> Интеграция API</li>
                  </ul>
                  <Button 
                     onClick={() => handleSendInvoice('quick_setup', 10000)}
                     disabled={isSendingInvoice}
                     className="w-full bg-green-600 hover:bg-green-700 text-white font-bold"
                  >
                     {isSendingInvoice ? <Loader2 className="animate-spin"/> : "Купить Настройку"}
                  </Button>
               </div>
            </div>
         </div>
      </section>

      {/* --- CREWS LIST --- */}
      <section className="py-20 px-4 bg-zinc-950 border-t border-zinc-800">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-16 text-white">
            Активные Экипажи (Public)
          </h2>
          <CrewsListSimplified />
        </div>
      </section>

      {/* --- CTA: CREATE WAREHOUSE --- */}
      <section id="invite" className="py-24 bg-gradient-to-br from-indigo-900 to-black text-white relative overflow-hidden border-t border-zinc-800">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20"></div>
        <div className="container mx-auto px-4 relative z-10 text-center">
           <motion.div initial={{ scale: 0.9 }} whileInView={{ scale: 1 }} viewport={{ once: true }}>
             <h2 className="text-4xl md:text-6xl font-black mb-8">Готов остановить кровотечение?</h2>
             
             {!createdCrew ? (
                <div className="max-w-md mx-auto bg-white/10 backdrop-blur-lg p-8 rounded-3xl border border-white/20 shadow-2xl">
                   <h3 className="text-2xl font-bold mb-6">Создать Штаб (HQ)</h3>
                   <form onSubmit={handleSubmit} className="space-y-4 text-left">
                      <div>
                         <Label className="text-white/80 text-xs uppercase tracking-wider">Название Склада</Label>
                         <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Напр: Главный Склад" className="bg-black/40 border-white/20 text-white focus:border-indigo-500" />
                      </div>
                      <div>
                         <Label className="text-white/80 text-xs uppercase tracking-wider">Уникальный Slug (ID)</Label>
                         <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="main-base" className="bg-black/40 border-white/20 text-white focus:border-indigo-500" />
                      </div>
                      <Button type="submit" disabled={isSubmitting} className="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-6 text-lg rounded-xl mt-4">
                         {isSubmitting ? <Loader2 className="animate-spin"/> : "Инициализировать Систему 🚀"}
                      </Button>
                   </form>
                </div>
             ) : (
                <div className="bg-green-500/20 p-8 rounded-3xl border border-green-500/50 max-w-lg mx-auto">
                   <h3 className="text-3xl font-bold text-green-400 mb-4">Система Активна!</h3>
                   <p className="mb-6 text-lg">Склад <strong>{createdCrew.name}</strong> готов к работе.</p>
                   <Button onClick={handleInvite} className="bg-white text-green-800 hover:bg-gray-100 font-bold py-4 px-8 rounded-full text-xl shadow-lg">
                      <FaUserPlus className="mr-2"/> Пригласить Команду (Telegram)
                   </Button>
                </div>
             )}
           </motion.div>
        </div>
      </section>

      {/* --- FOOTER --- */}
      <footer className="bg-black text-zinc-500 py-12 border-t border-zinc-900">
        <div className="container mx-auto px-4 flex flex-col md:flex-row justify-between items-center">
           <div className="mb-4 md:mb-0">
              <p className="font-mono text-sm">© {new Date().getFullYear()} CyberVibe / @SALAVEY13</p>
           </div>
           <div className="flex gap-6">
              <Link href="#" className="hover:text-indigo-400 transition-colors">Privacy</Link>
              <Link href="#" className="hover:text-indigo-400 transition-colors">Terms</Link>
              <Link href="https://github.com/salavey13/carTest" target="_blank" className="hover:text-indigo-400 transition-colors">Source Code</Link>
           </div>
        </div>
      </footer>

      <ExitIntentPopup />
    </div>
  );
}