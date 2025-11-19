"use client";
import { FixedHeader } from "./components/FixedHeader";
import { 
  ShieldCheck, Server, Lock, FileText, 
  Skull, Ban, Fingerprint, Key, 
  Zap, Database, Truck, BarChart3, Smartphone,
  ShieldQuestion, Github, ExternalLink, Heart
} from "lucide-react";
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useAppContext } from "@/contexts/AppContext";
import { createCrew, sendServiceInvoice, notifyAdmin } from "@/app/actions";
import { sendComplexMessage } from '@/app/webhook-handlers/actions/sendComplexMessage';
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CrewsListSimplified } from "./components/CrewsListSimplified";
import { WarehouseAuditTool } from "./components/WarehouseAuditTool";
import { ExitIntentPopup } from "./components/ExitIntentPopup";
import { WarehouseMigrator } from "@/app/wblanding/components/WarehouseMigrator";
import { FaCarBurst, FaChartLine, FaRocket, FaUsers, FaFlagCheckered, FaUserPlus, FaCalendarCheck, FaFire, FaPaperPlane, FaBell, FaStar, FaQuoteLeft, FaClock, FaSkullCrossbones, FaGithub } from 'react-icons/fa6';
import { Loader2 } from 'lucide-react';
import Image from 'next/image';
import { supabaseAdmin } from '@/hooks/supabase';

interface Testimonial {
  id: string;
  user_id: string;
  username?: string;
  avatar_url?: string;
  content: string;
  rating: number;
  created_at: string;
}

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
  const [isSendingInvoice, setIsSendingInvoice] = useState(false);
  
  // Testimonials state
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const auditRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setSlug(generateSlug(name)); }, [name]);

  // Load approved testimonials
  useEffect(() => {
    const loadTestimonials = async () => {
      const { data, error } = await supabaseAdmin
        .from('testimonials')
        .select('*')
        .eq('is_approved', true)
        .order('created_at', { ascending: false });
      
      if (!error && data) {
        setTestimonials(data as Testimonial[]);
      }
    };
    loadTestimonials();
  }, []);

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

  const handleSendInvoice = async (serviceType: 'quick_setup' | 'team_training', amount: number) => {
    if (!dbUser?.user_id) {
      toast.error("Пожалуйста, войдите в систему");
      return;
    }
    
    setIsSendingInvoice(true);
    try {
      const services = {
        quick_setup: {
          name: "🎯 Автоматизация склада за 1 день",
          description: "Полная настройка, интеграция со всеми маркетплейсами (API setup), обучение владельца (2 часа), гарантия 30 дней",
          amount: 10000
        },
        team_training: {
          name: "👨‍🏫 Обучение команды с нуля",
          description: "Обучение менеджеров и кладовщиков, чек-листы, ролевой доступ, контроль качества",
          amount: 10000
        }
      };
      
      const service = services[serviceType];
      const result = await sendServiceInvoice(
        dbUser.user_id,
        serviceType,
        service.name,
        service.description,
        service.amount
      );
      
      if (result.success) {
        toast.success(`✅ Счет на ${service.amount}₽ отправлен в Telegram!`, { duration: 5000 });
        await notifyAdmin(`💰 Новый заказ услуги!\nТип: ${service.name}\nКлиент: ${dbUser.username || dbUser.user_id}`);
      } else {
        throw new Error(result.error || "Ошибка при отправке счета");
      }
    } catch (error) {
      toast.error("Ошибка при отправке счета: " + (error instanceof Error ? error.message : "Неизвестная ошибка"));
    } finally {
      setIsSendingInvoice(false);
    }
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
      
      {/* HERO SECTION */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
        {/* Background Video - Restored */}
        <div className="absolute inset-0 w-full h-full z-0">
          <video className="w-full h-full object-cover brightness-[0.3] grayscale" autoPlay loop muted playsInline
            src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/grok-video-882e5db9-d256-42f2-a77a-da36b230f67e-0.mp4" />
           <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-transparent to-black"></div>
           {/* Cyber Overlay */}
           <div className="absolute inset-0 bg-[url('https://i.pinimg.com/originals/2b/2b/e4/2b2be452536454126e86014092321051.gif')] opacity-5 bg-cover bg-center mix-blend-overlay pointer-events-none"></div>
        </div>

        <div className="relative z-10 max-w-5xl mx-auto px-4 text-center">
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
            >
                <span className="inline-block py-1 px-3 rounded-full bg-red-500/20 border border-red-500/50 text-red-400 text-xs md:text-sm font-mono mb-6 backdrop-blur-md">
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
                className="text-lg md:text-2xl text-gray-300 max-w-3xl mx-auto mb-10 leading-relaxed font-mono drop-shadow-md"
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
                }} size="lg" className="bg-brand-cyan hover:bg-brand-cyan/80 text-black font-bold px-8 py-6 rounded-none skew-x-[-10deg] border-r-4 border-b-4 border-white transition-all active:translate-y-1 active:border-0 shadow-[0_0_20px_rgba(0,255,255,0.3)]">
                    <span className="skew-x-[10deg] flex items-center gap-2">
                        <FaFire /> СКОЛЬКО Я ТЕРЯЮ?
                    </span>
                </Button>
                <Link href="#migrator">
                    <Button variant="outline" size="lg" className="border-white/20 text-white hover:bg-white/10 px-8 py-6 rounded-none skew-x-[-10deg]">
                        <span className="skew-x-[10deg] flex items-center gap-2">
                            <FileText className="w-4 h-4" /> ЗАГРУЗИТЬ CSV
                        </span>
                    </Button>
                </Link>
            </motion.div>
        </div>
      </section>

      {/* SECURITY SECTION: Paranoid Level */}
      <section className="py-16 bg-zinc-900/80 border-y border-white/5 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4">
            <div className="flex flex-col md:flex-row items-center gap-8 mb-8">
                <div className="bg-red-500/10 p-4 rounded-full border border-red-500/30 shadow-[0_0_15px_rgba(255,0,0,0.2)]">
                    <ShieldCheck className="w-10 h-10 text-red-500" />
                </div>
                <div className="text-center md:text-left">
                    <h2 className="text-2xl md:text-3xl font-bold text-white font-orbitron mb-2">
                        ПАРАНОИДАЛЬНАЯ БЕЗОПАСНОСТЬ
                    </h2>
                    <p className="text-gray-400 font-mono text-sm md:text-base">
                        Почему мы не просим API ключи прямо сейчас? Потому что это тупо и опасно.
                    </p>
                </div>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
                <div className="bg-black p-6 rounded-lg border border-gray-800 hover:border-brand-cyan/50 transition-colors group">
                    <Server className="w-8 h-8 text-brand-cyan mb-4 group-hover:scale-110 transition-transform" />
                    <h3 className="text-lg font-bold text-white mb-2">ENV Storage Only</h3>
                    <p className="text-gray-400 text-sm">Ключи никогда не пишутся в базу данных Supabase. Они хранятся только в зашифрованных переменных окружения сервера (ENV).</p>
                </div>
                <div className="bg-black p-6 rounded-lg border border-gray-800 hover:border-neon-lime/50 transition-colors group">
                    <Key className="w-8 h-8 text-neon-lime mb-4 group-hover:scale-110 transition-transform" />
                    <h3 className="text-lg font-bold text-white mb-2">Manual Admin Setup</h3>
                    <p className="text-gray-400 text-sm">API подключает только Superadmin вручную. Это исключает утечки через веб-интерфейс или уязвимости фронтенда.</p>
                </div>
                <div className="bg-black p-6 rounded-lg border border-gray-800 hover:border-purple-500/50 transition-colors group">
                    <Lock className="w-8 h-8 text-purple-500 mb-4 group-hover:scale-110 transition-transform" />
                    <h3 className="text-lg font-bold text-white mb-2">Sandbox First</h3>
                    <p className="text-gray-400 text-sm">Сначала работайте с CSV. Привыкайте к интерфейсу. Подключайте боевой API только когда будете готовы на 100%.</p>
                </div>
            </div>
        </div>
      </section>

      {/* THE MIGRATOR (Anchor: #migrator) */}
      <section id="migrator" className="py-20 bg-black relative">
          <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-brand-cyan/50 to-transparent"></div>
          <div className="max-w-4xl mx-auto px-4">
              <div className="text-center mb-12">
                  <h2 className="text-3xl font-bold text-white mb-4 font-orbitron">Миграция через Excel / CSV</h2>
                  <p className="text-gray-400">Скачайте отчет остатков из МойСклад, Ozon или WB. Вставьте сюда. Получите базу.</p>
              </div>
              <WarehouseMigrator />
          </div>
      </section>

      {/* FEATURES: The Pirate Arsenal */}
      <section id="features" className="py-20 bg-zinc-900">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-16 text-white font-orbitron">
            АРСЕНАЛ БУНТАРЯ
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              { icon: Zap, title: "Синхронизация (позже)", description: "Авто-обновление остатков WB/Ozon/YM (доступно после верификации)." },
              { icon: FaClock, title: "Контроль смен", description: "Фиксация 'кто трогал коробку'. Чекпоинты и тайминг операций." },
              { icon: FaUsers, title: "Мульти-Крю", description: "Управление несколькими складами. Роли: Оунер, Менеджер, Кладовщик." },
              { icon: Smartphone, title: "Telegram Native", description: "Всё в телефоне. Не нужно покупать сканеры или ПК на склад." },
              { icon: BarChart3, title: "Визуализация", description: "Интерактивная карта склада. Видишь, где лежит товар (voxel_id)." },
              { icon: Database, title: "CSV Экспорт", description: "Забирай свои данные в любой момент. Мы не держим их в заложниках." }
            ].map((feature, index) => (
              <motion.div 
                key={index} 
                className="bg-black/50 p-8 rounded-xl border border-gray-800 hover:border-brand-cyan/40 transition-all duration-300 group"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <feature.icon className="w-10 h-10 text-brand-cyan mb-6 group-hover:scale-110 transition-transform" />
                <h3 className="text-xl font-bold mb-4 text-white">{feature.title}</h3>
                <p className="text-gray-400 leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* PAIN POINTS: The Comparison */}
      <section className="py-20 bg-black border-y border-white/10">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl md:text-5xl font-bold text-center mb-16 text-white font-orbitron">
            ПОЧЕМУ ОНИ ВАС БЕСЯТ
          </h2>
          
          <div className="grid md:grid-cols-3 gap-8">
             {/* Card 1 */}
             <div className="bg-zinc-900 border border-red-900/30 p-6 rounded-xl relative overflow-hidden group hover:border-red-500/50 transition-colors">
                <div className="absolute top-0 right-0 p-4 opacity-20 group-hover:opacity-100 transition-opacity">
                    <Ban className="w-16 h-16 text-red-600" />
                </div>
                <h3 className="text-xl font-bold text-red-500 mb-4">Жадность</h3>
                <ul className="space-y-3 text-gray-400 text-sm">
                    <li className="flex gap-2"><span className="text-red-500">✕</span> Тарифы растут внезапно</li>
                    <li className="flex gap-2"><span className="text-red-500">✕</span> Платишь за 100 функций, юзаешь 3</li>
                    <li className="flex gap-2"><span className="text-red-500">✕</span> Сложная отмена</li>
                </ul>
                <div className="mt-6 pt-6 border-t border-white/10">
                    <h4 className="text-brand-cyan font-bold mb-2">Наш ответ:</h4>
                    <p className="text-sm text-gray-300">Freemium. Плати только за услуги настройки. Софт — бесплатно.</p>
                </div>
             </div>

             {/* Card 2 */}
             <div className="bg-zinc-900 border border-red-900/30 p-6 rounded-xl relative overflow-hidden group hover:border-red-500/50 transition-colors">
                <div className="absolute top-0 right-0 p-4 opacity-20 group-hover:opacity-100 transition-opacity">
                    <Skull className="w-16 h-16 text-red-600" />
                </div>
                <h3 className="text-xl font-bold text-red-500 mb-4">Саппорт-Зомби</h3>
                <ul className="space-y-3 text-gray-400 text-sm">
                    <li className="flex gap-2"><span className="text-red-500">✕</span> Ответ через 24 часа</li>
                    <li className="flex gap-2"><span className="text-red-500">✕</span> "Это не баг, это фича"</li>
                    <li className="flex gap-2"><span className="text-red-500">✕</span> Шаблонные отписки</li>
                </ul>
                <div className="mt-6 pt-6 border-t border-white/10">
                    <h4 className="text-brand-cyan font-bold mb-2">Наш ответ:</h4>
                    <p className="text-sm text-gray-300">Чат с девами. Фикс багов за часы, а не месяцы.</p>
                </div>
             </div>

             {/* Card 3 */}
             <div className="bg-zinc-900 border border-red-900/30 p-6 rounded-xl relative overflow-hidden group hover:border-red-500/50 transition-colors">
                <div className="absolute top-0 right-0 p-4 opacity-20 group-hover:opacity-100 transition-opacity">
                    <Fingerprint className="w-16 h-16 text-red-600" />
                </div>
                <h3 className="text-xl font-bold text-red-500 mb-4">UI из 2005</h3>
                <ul className="space-y-3 text-gray-400 text-sm">
                    <li className="flex gap-2"><span className="text-red-500">✕</span> Нужен мощный ПК</li>
                    <li className="flex gap-2"><span className="text-red-500">✕</span> 1000 кликов для действия</li>
                    <li className="flex gap-2"><span className="text-red-500">✕</span> Не работает с телефона</li>
                </ul>
                <div className="mt-6 pt-6 border-t border-white/10">
                    <h4 className="text-brand-cyan font-bold mb-2">Наш ответ:</h4>
                    <p className="text-sm text-gray-300">Native TWA. Летает на любом тамогочи.</p>
                </div>
             </div>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="py-20 bg-zinc-900">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-16 text-white font-orbitron">
            ПЛАН ЗАХВАТА (ТАРИФЫ)
          </h2>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* FREE */}
            <motion.div className="bg-black border border-gray-700 rounded-2xl p-8 hover:border-white transition-all" whileHover={{ y: -10 }}>
                <h3 className="text-2xl font-bold text-white mb-2">ПАРТИЗАН</h3>
                <div className="text-4xl font-bold text-white mb-4">0 ₽ <span className="text-sm font-normal text-gray-500">/ навсегда</span></div>
                <p className="text-gray-400 mb-6 text-sm">Для старта и теста гипотез. Без обязательств.</p>
                <ul className="space-y-3 mb-8 text-sm text-gray-300">
                    <li className="flex gap-2"><Zap className="w-4 h-4 text-neon-lime"/> До 100 SKU</li>
                    <li className="flex gap-2"><Zap className="w-4 h-4 text-neon-lime"/> 1 Склад</li>
                    <li className="flex gap-2"><Zap className="w-4 h-4 text-neon-lime"/> CSV Импорт/Экспорт</li>
                    <li className="flex gap-2"><Zap className="w-4 h-4 text-neon-lime"/> Telegram Support</li>
                </ul>
                <Button onClick={() => {
                     window.scrollTo({ top: 0, behavior: 'smooth' });
                     setTimeout(() => document.getElementById('crew-name')?.focus(), 500);
                }} className="w-full bg-gray-800 hover:bg-gray-700 text-white font-bold py-3">НАЧАТЬ</Button>
            </motion.div>

            {/* PRO */}
            <motion.div className="bg-black border-2 border-brand-cyan rounded-2xl p-8 relative shadow-[0_0_30px_rgba(0,255,255,0.15)]" whileHover={{ y: -10 }}>
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-brand-cyan text-black px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wide">Рекомендовано</div>
                <h3 className="text-2xl font-bold text-brand-cyan mb-2">КАПИТАН</h3>
                <div className="text-4xl font-bold text-white mb-4">4 900 ₽ <span className="text-sm font-normal text-gray-500">/ мес</span></div>
                <p className="text-gray-400 mb-6 text-sm">Когда надоело играть в песочнице. Полная автоматизация.</p>
                <ul className="space-y-3 mb-8 text-sm text-gray-300">
                    <li className="flex gap-2"><Zap className="w-4 h-4 text-brand-cyan"/> До 500 SKU</li>
                    <li className="flex gap-2"><Zap className="w-4 h-4 text-brand-cyan"/> API Sync (WB/Ozon)</li>
                    <li className="flex gap-2"><Zap className="w-4 h-4 text-brand-cyan"/> Управление сменами</li>
                    <li className="flex gap-2"><Zap className="w-4 h-4 text-brand-cyan"/> Приоритетная поддержка</li>
                </ul>
                <Button className="w-full bg-brand-cyan hover:bg-brand-cyan/80 text-black font-bold py-3">В ЛИСТ ОЖИДАНИЯ</Button>
            </motion.div>

            {/* ENTERPRISE */}
            <motion.div className="bg-black border border-purple-500/50 rounded-2xl p-8 hover:border-purple-500 transition-all" whileHover={{ y: -10 }}>
                <h3 className="text-2xl font-bold text-purple-400 mb-2">ИМПЕРИЯ</h3>
                <div className="text-xl font-bold text-white mb-4">Индив. условия</div>
                <p className="text-gray-400 mb-6 text-sm">Для сетей и крупных брендов. Личный Архитектор.</p>
                <ul className="space-y-3 mb-8 text-sm text-gray-300">
                    <li className="flex gap-2"><Zap className="w-4 h-4 text-purple-400"/> Безлимитные SKU</li>
                    <li className="flex gap-2"><Zap className="w-4 h-4 text-purple-400"/> Выделенный сервер</li>
                    <li className="flex gap-2"><Zap className="w-4 h-4 text-purple-400"/> Кастомные доработки</li>
                    <li className="flex gap-2"><Zap className="w-4 h-4 text-purple-400"/> Личный менеджер 24/7</li>
                </ul>
                <Button variant="outline" className="w-full border-purple-500 text-purple-400 hover:bg-purple-500/10 font-bold py-3">ЗАПРОСИТЬ</Button>
            </motion.div>
          </div>

          {/* PAID SERVICES (One-Time) */}
          <div className="mt-20 max-w-4xl mx-auto">
             <h3 className="text-2xl font-bold text-center mb-8 text-gray-200">Услуги Настройки (One-Time)</h3>
             <div className="grid md:grid-cols-2 gap-6">
                <div className="border border-gray-700 p-6 rounded-xl bg-zinc-900/50 flex flex-col justify-between">
                    <div>
                        <h4 className="text-xl font-bold text-white mb-2">🎯 Настройка под ключ</h4>
                        <p className="text-gray-400 text-sm mb-4">Мы сами подключим API, загрузим товары и настроим склады. Вы получите готовую систему.</p>
                        <div className="text-2xl font-bold text-brand-cyan mb-4">10 000 ₽</div>
                    </div>
                    <Button 
                        onClick={() => handleSendInvoice('quick_setup', 10000)}
                        disabled={isSendingInvoice}
                        className="w-full bg-gray-800 hover:bg-brand-cyan hover:text-black transition-colors"
                    >
                        {isSendingInvoice ? <Loader2 className="animate-spin"/> : "ЗАКАЗАТЬ НАСТРОЙКУ"}
                    </Button>
                </div>
                <div className="border border-gray-700 p-6 rounded-xl bg-zinc-900/50 flex flex-col justify-between">
                    <div>
                        <h4 className="text-xl font-bold text-white mb-2">👨‍🏫 Обучение команды</h4>
                        <p className="text-gray-400 text-sm mb-4">Зум-колл с вашими кладовщиками. Научим не тупить и правильно пикать товары. Чек-листы в подарок.</p>
                        <div className="text-2xl font-bold text-brand-cyan mb-4">10 000 ₽</div>
                    </div>
                    <Button 
                        onClick={() => handleSendInvoice('team_training', 10000)}
                        disabled={isSendingInvoice}
                        className="w-full bg-gray-800 hover:bg-brand-cyan hover:text-black transition-colors"
                    >
                        {isSendingInvoice ? <Loader2 className="animate-spin"/> : "ЗАКАЗАТЬ ОБУЧЕНИЕ"}
                    </Button>
                </div>
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

      {/* FAQ */}
      <section className="py-20 bg-black">
          <div className="max-w-3xl mx-auto px-4">
            <h2 className="text-3xl font-bold text-center mb-12 text-white font-orbitron">Частые Вопросы</h2>
            <Accordion type="single" collapsible className="w-full space-y-4">
                <AccordionItem value="item-1" className="border-b border-gray-800">
                    <AccordionTrigger className="text-gray-200 hover:text-brand-cyan text-left">Почему так дешево/бесплатно?</AccordionTrigger>
                    <AccordionContent className="text-gray-400">Потому что мы не кормим штат из 500 менеджеров по продажам. Мы зарабатываем на доп. услугах и сложных внедрениях. Базовый софт должен быть доступен.</AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-2" className="border-b border-gray-800">
                    <AccordionTrigger className="text-gray-200 hover:text-brand-cyan text-left">Безопасно ли давать CSV?</AccordionTrigger>
                    <AccordionContent className="text-gray-400">Абсолютно. CSV обрабатывается в оперативной памяти и создает структуру базы. Мы не продаем ваши данные конкурентам (мы сами конкуренты старым системам).</AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-3" className="border-b border-gray-800">
                    <AccordionTrigger className="text-gray-200 hover:text-brand-cyan text-left">Как подключить API?</AccordionTrigger>
                    <AccordionContent className="text-gray-400">Напишите в поддержку после создания склада. Мы проводим верификацию и подключаем ключи вручную через защищенный канал.</AccordionContent>
                </AccordionItem>
            </Accordion>
          </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="py-20 bg-zinc-900">
        <div className="max-w-6xl mx-auto px-4">
            <h2 className="text-3xl font-bold text-center mb-12 text-white font-orbitron">ЧТО ГОВОРЯТ ПИРАТЫ</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {testimonials.length > 0 ? testimonials.map((t, i) => (
                    <div key={i} className="bg-black p-6 rounded-xl border border-gray-800">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center font-bold text-brand-cyan">
                                {t.username?.[0]?.toUpperCase() || 'U'}
                            </div>
                            <div>
                                <div className="font-bold text-white">{t.username || 'Аноним'}</div>
                                <div className="flex text-yellow-500 text-xs">{'★'.repeat(t.rating)}</div>
                            </div>
                        </div>
                        <p className="text-gray-400 text-sm italic">"{t.content}"</p>
                    </div>
                )) : (
                    <div className="col-span-full text-center text-gray-500 italic py-10">
                        Пока тихо... Станьте первым, кто нарушит молчание.
                    </div>
                )}
            </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="py-24 bg-gradient-to-b from-black to-zinc-900 text-center border-t border-gray-800">
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-8">Забирайте свой склад</h2>
          <p className="text-xl text-gray-400 mb-12 max-w-2xl mx-auto">Инструмент, который не шпионит за вами, не тупит и не требует ипотеку.</p>
          
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

      {/* FOOTER with Transparent Links */}
      <footer className="bg-black py-12 border-t border-white/10 text-gray-500 text-sm font-mono">
          <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-6">
              <div>
                  <p>© {new Date().getFullYear()} oneSitePls. Powered by CyberVibe.</p>
                  <p className="text-xs mt-1 text-gray-600">Created by @SALAVEY13</p>
              </div>
              <div className="flex items-center gap-6">
                  <Link href="https://github.com/salavey13/carTest" target="_blank" className="hover:text-white flex items-center gap-2 transition-colors">
                      <FaGithub className="w-5 h-5" /> GitHub Repo
                  </Link>
                  <Link href="https://github.com/salavey13/carTest/blob/main/README.md" target="_blank" className="hover:text-brand-cyan transition-colors flex items-center gap-1">
                      <ShieldQuestion className="w-4 h-4" /> Privacy & Terms
                  </Link>
                  <Link href="https://github.com/salavey13/carTest/blob/main/LICENSE" target="_blank" className="hover:text-brand-cyan transition-colors flex items-center gap-1">
                      <FileText className="w-4 h-4" /> License
                  </Link>
              </div>
          </div>
      </footer>


      <ExitIntentPopup />
    </div>
  );
}