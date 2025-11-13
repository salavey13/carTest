"use client";

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from "next/navigation";
import { useAppContext } from "@/contexts/AppContext";
import { createCrew, sendServiceInvoice, notifyAdmin, sendComplexMessage } from "@/app/actions";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CrewsListSimplified } from "./components/CrewsListSimplified";
import { WarehouseAuditTool } from "./components/WarehouseAuditTool";
import { ExitIntentPopup } from "./components/ExitIntentPopup";
import { FaCarBurst, FaChartLine, FaRocket, FaUsers, FaSpinner, FaFlagCheckered, FaUserPlus, FaCalendarCheck, FaClock, FaFire, FaMoneyBillWave, FaRedo, FaPaperPlane, FaBell } from 'react-icons/fa6';
import { FaKeyboard, FaExclamationTriangle, FaSyncAlt } from 'react-icons/fa';
import { Loader2, AlertTriangle, TrendingUp, Zap } from 'lucide-react';
import Image from 'next/image';
import { FaCheckCircle, FaSparkles } from 'react-icons/fa';

const generateSlug = (name: string) =>
  name.toLowerCase().trim().replace(/[\s_]+/g, '-').replace(/[^\w-]+/g, '').replace(/--+/g, '-').replace(/^-+|-+$/g, '');

export default function WarehouseLandingPage() {
  const { dbUser, isLoading: appContextLoading } = useAppContext();
  const router = useRouter();
  const [showAudit, setShowAudit] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [hqLocation, setHqLocation] = useState("56.3269,44.0059");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdCrew, setCreatedCrew] = useState<{ slug: string; name: string } | null>(null);
  const [isSendingInvoice, setIsSendingInvoice] = useState(false);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  
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
      toast.error("Slug не может быть пустым. Введите название склада."); 
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
        
        // Уведомление администратора о новом складе
        await notifyAdmin(`🎉 Новый склад создан!\nНазвание: ${result.data.name}\nВладелец: ${dbUser.username || dbUser.user_id}`);
        
        // Отправляем персональное уведомление в Telegram
        await sendComplexMessage(dbUser.user_id, `🎉 Поздравляем! Ваш склад "${result.data.name}" успешно создан! Теперь пригласите команду и начните оптимизацию.`, []);
      } else { 
        throw new Error(result.error || "Неизвестная ошибка при создании склада."); 
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Произошла ошибка.");
    } finally { 
      setIsSubmitting(false); 
    }
  };

  const handleInvite = async () => {
    if (!createdCrew) return;
    
    // Фикс: убираем лишние пробелы в URL
    const inviteUrl = `https://t.me/oneBikePlsBot/app?startapp=crew_${createdCrew.slug}_join_crew`;
    const text = `Присоединяйся к нашему складу '${createdCrew.name}' в приложении!`;
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(inviteUrl)}&text=${encodeURIComponent(text)}`;
    
    // Открываем share URL
    window.open(shareUrl, "_blank");
    
    // Отправляем уведомление владельцу через Telegram
    if (dbUser?.user_id) {
      await sendComplexMessage(
        dbUser.user_id, 
        `✅ Приглашение для склада "${createdCrew.name}" готово!\n\nСсылка: ${inviteUrl}\n\nПоделитесь ею с командой.`, 
        []
      );
      toast.success("Приглашение отправлено! Проверьте Telegram.");
      
      // Уведомляем администратора о приглашении
      await notifyAdmin(`📧 Пользователь ${dbUser.username || dbUser.user_id} создал приглашение для склада "${createdCrew.name}"`);
    }
  };

  // Функция для отправки счета за услугу
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
          description: "Полная настройка, интеграция со всеми маркетплейсами, обучение владельца (2 часа), гарантия 30 дней",
          amount: 10000 // ИСПРАВЛЕНО: снижено с 20000 до 10000 (лимит Telegram Stars)
        },
        team_training: {
          name: "👨‍🏫 Обучение команды с нуля",
          description: "Обучение менеджеров и кладовщиков, чек-листы, ролевой доступ, контроль качества",
          amount: 10000
        }
      };
      
      const service = services[serviceType];
      
      // Отправляем счет в Telegram
      const result = await sendServiceInvoice(
        dbUser.user_id,
        serviceType,
        service.name,
        service.description,
        service.amount
      );
      
      if (result.success) {
        toast.success(`✅ Счет на ${service.amount}₽ отправлен в Telegram!`, {
          duration: 5000,
          icon: '📨'
        });
        
        // Отправляем детальное уведомление пользователю
        await sendComplexMessage(
          dbUser.user_id,
          `💰 Счет на оплату услуги "${service.name}" отправлен!\n\nСумма: ${service.amount}₽\nОписание: ${service.description}\n\nОплатите его в Telegram для продолжения.`,
          []
        );
        
        // Уведомляем администратора
        await notifyAdmin(`💰 Новый заказ услуги!\nТип: ${service.name}\nКлиент: ${dbUser.username || dbUser.user_id}\nСумма: ${service.amount}₽`);
      } else {
        throw new Error(result.error || "Ошибка при отправке счета");
      }
    } catch (error) {
      toast.error("Ошибка при отправке счета: " + (error instanceof Error ? error.message : "Неизвестная ошибка"));
    } finally {
      setIsSendingInvoice(false);
    }
  };

  // Функция для массовой рассылки уведомлений
  const handleBroadcast = async () => {
    if (!dbUser?.user_id) {
      toast.error("Ошибка: пользователь не авторизован");
      return;
    }
    
    const message = prompt("Введите сообщение для рассылки:");
    if (!message) {
      toast.info("Рассылка отменена");
      return;
    }
    
    const confirmBroadcast = confirm(`Отправить сообщение "${message}" всем пользователям?`);
    if (!confirmBroadcast) {
      toast.info("Рассылка отменена");
      return;
    }
    
    setIsBroadcasting(true);
    toast.info("📢 Запуск рассылки...");
    
    try {
      const result = await fetch('/api/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, senderId: dbUser.user_id })
      });
      
      if (result.ok) {
        const data = await result.json();
        toast.success(`✅ Рассылка успешно отправлена ${data.recipients || ''} пользователям!`, {
          duration: 4000,
          icon: '📨'
        });
        await notifyAdmin(`📢 Массовая рассылка от ${dbUser.username || dbUser.user_id}:\n${message}\n\nРезультат: успешно отправлено ${data.recipients || ''} пользователям`);
      } else {
        throw new Error(`HTTP ${result.status}: ${result.statusText}`);
      }
    } catch (error) {
      toast.error("❌ Ошибка рассылки: " + (error instanceof Error ? error.message : "Неизвестная ошибка"), {
        duration: 5000,
        icon: '❌'
      });
      await notifyAdmin(`⚠️ Ошибка рассылки от ${dbUser.username || dbUser.user_id}:\n${message}\n\nОшибка: ${error instanceof Error ? error.message : 'Неизвестная'}`);
    } finally {
      setIsBroadcasting(false);
    }
  };

  // Улучшенные обработчики для кнопок планов
  const handlePlanAction = async (planType: 'free' | 'pro' | 'enterprise', action: () => void) => {
    // Сначала выполняем действие (показать тост)
    action();
    
    // Затем уведомляем администратора о выборе плана
    if (dbUser?.user_id) {
      const planNames = {
        free: '🚀 Путь к нулевым потерям (Бесплатно)',
        pro: '⚡ Полная автоматизация (Профессионал)',
        enterprise: '🏢 Экспоненциальный рост (Предприятие)'
      };
      
      // Отправляем персональное сообщение пользователю
      await sendComplexMessage(
        dbUser.user_id,
        `🎯 Вы выбрали тариф "${planNames[planType]}"! Мы подготовим для вас персональное предложение. Ожидайте деталей в Telegram.`,
        []
      );
      
      await notifyAdmin(`💼 Пользователь выбрал тариф!\nПользователь: ${dbUser.username || dbUser.user_id}\nТариф: ${planNames[planType]}\nВремя: ${new Date().toLocaleString('ru-RU')}`);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 text-gray-800 font-sans">
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center text-white overflow-hidden">
        <div className="absolute inset-0 w-full h-full">
          <video className="w-full h-full object-cover brightness-50" autoPlay loop muted playsInline
            src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/grok-video-882e5db9-d256-42f2-a77a-da36b230f67e-0.mp4" />
        </div>
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/30 to-indigo-600/30" />
        <motion.div 
          className="relative z-10 text-center px-4 max-w-6xl mx-auto"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, type: "spring" }}
          >
            <Image src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/IMG_20250623_004400_844-152720e6-ad84-48d1-b4e7-e0f238b7442b.png"
              alt="Логотип приложения" width={142} height={69}
              className="mx-auto mb-8 rounded-full w-20 h-20 sm:w-24 sm:h-24 md:w-32 md:h-32 shadow-2xl ring-4 ring-white/10" />
          </motion.div>
          <motion.h1 
            className="text-3xl md:text-5xl lg:text-6xl font-bold mb-6 text-white leading-tight"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            Складской учет для онлайн-магазинов
          </motion.h1>
          <motion.p 
            className="text-xl md:text-2xl lg:text-3xl mb-8 text-white/90 max-w-4xl mx-auto leading-relaxed"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            Сократите недостачи на 73%, обновляйте остатки одним кликом. Для 2+ магазинов на WB, Ozon, YM с 100+ артикулами.
          </motion.p>
          <motion.div 
            className="flex flex-col sm:flex-row gap-4 justify-center items-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button onClick={() => {
                setShowAudit(true);
                scrollToAudit();
                // Агрессивное всплывающее уведомление
                toast.info("🔥 УЗНАЙТЕ СВОИ ПОТЕРИ ПРЯМО СЕЙЧАС!", {
                  icon: "⚡",
                  duration: 3000
                });
              }} size="lg" className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white px-6 sm:px-8 py-3 sm:py-4 rounded-full font-bold text-base sm:text-lg w-full sm:w-auto shadow-xl">
                <FaChartLine className="mr-2" /> УЗНАТЬ ЭФФЕКТИВНОСТЬ
              </Button>
            </motion.div>
            <span className="text-white/70">или</span>
            <Link href="#features">
              <Button variant="outline" size="lg" className="bg-transparent border-2 border-white text-white hover:bg-white hover:text-blue-600 px-4 sm:px-6 py-3 sm:py-4 rounded-full font-bold text-base sm:text-lg w-full sm:w-auto transition-all">
                Узнать больше
              </Button>
            </Link>
          </motion.div>
        </motion.div>
      </section>

      {/* Lead Magnet Section */}
      {showAudit && (
        <section id="audit-tool" className="py-16 px-4 bg-gradient-to-br from-white to-gray-50" ref={auditRef}>
          <WarehouseAuditTool />
        </section>
      )}

      {/* Second Video Section */}
      <section className="py-12 bg-gray-100">
        <div className="max-w-4xl mx-auto px-4">
          <motion.div 
            className="w-full h-auto rounded-2xl shadow-2xl md:max-w-2xl mx-auto overflow-hidden"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
          >
            <video 
              className="w-full h-auto" 
              autoPlay loop muted playsInline
            >
              <source src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/grok-video-c73d1434-fe01-4e30-ad74-3799fdce56eb-5-29a2a26b-c256-4dff-9c32-cc00a6847df5.mp4" type="video/mp4" />
            </video>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <motion.h2 
            className="text-3xl md:text-4xl font-bold text-center mb-16 text-gray-900"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            Возможности приложения
          </motion.h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              { icon: "M13 10V3L4 14h7v7l9-11h-7z", title: "Синхронизация с маркетплейсами", description: "Автоматическое обновление остатков на WB, Ozon и Яндекс.Маркет в реальном времени." },
              { icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z", title: "Управление сменами", description: "Контроль работы персонала, чекпоинты и детальная статистика по сменам." },
              { icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z", title: "Мульти-доступ", description: "Управление несколькими складами, ролевой доступ для команды." },
              { icon: "M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z", title: "Telegram-интерфейс", description: "Удобный доступ через мессенджер, без установки приложений." },
              { icon: "M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z", title: "Визуализация склада", description: "Интерактивная карта склада с фильтрами по характеристикам товаров." },
              { icon: "M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z", title: "Отчеты", description: "Экспорт остатков и смен в удобных форматах, статистика продаж." }
            ].map((feature, index) => (
              <motion.div 
                key={index} 
                className="bg-gray-50 p-8 rounded-xl shadow-md hover:shadow-2xl transition-all duration-300 group border border-gray-200 hover:border-blue-300"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ scale: 1.02 }}
              >
                <motion.svg 
                  className="w-12 h-12 mx-auto mb-6 text-blue-600 group-hover:scale-110 transition-transform" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                  whileHover={{ rotate: 5 }}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={feature.icon} />
                </motion.svg>
                <h3 className="text-xl font-bold mb-4 text-center text-gray-900">{feature.title}</h3>
                <p className="text-center text-gray-600 leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </div>
          <motion.div 
            className="text-center mt-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <Button onClick={() => {
              setShowAudit(true);
              scrollToAudit();
              toast.info("🚀 Анализ начался! Не закрывайте страницу", { icon: "⏳" });
            }} className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white px-6 sm:px-8 py-3 sm:py-4 rounded-full font-bold text-lg shadow-lg">
              <FaRocket className="mr-2" /> ПРОАНАЛИЗИРОВАТЬ СКЛАД
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 px-4 bg-gradient-to-br from-gray-100 to-gray-200">
        <div className="max-w-6xl mx-auto">
          <motion.h2 
            className="text-3xl md:text-4xl font-bold text-center mb-16 text-gray-900"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            Преимущества для вашего бизнеса
          </motion.h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {[
              { title: "Для владельца бизнеса", benefits: ["Полный контроль операций", "Рост эффективности на 70%+", "Автоматизация рутины", "Прозрачность процессов", "Бесплатный старт"], color: "text-blue-800" },
              { title: "Для персонала", benefits: ["Простой интерфейс в Telegram", "Быстрые операции с товарами", "Игровой режим с наградами", "Личная статистика и цели"], color: "text-blue-800" },
              { title: "Для администратора", benefits: ["Управление несколькими складами", "Безопасный доступ для команды", "Уведомления о заказах (в разработке)", "Простые отчеты в CSV"], color: "text-blue-800" }
            ].map((role, index) => (
              <motion.div 
                key={index} 
                className="bg-white p-8 rounded-xl shadow-md hover:shadow-xl transition-all duration-300 border border-gray-200"
                initial={{ opacity: 0, x: index % 2 === 0 ? -30 : 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.2 }}
                whileHover={{ y: -5 }}
              >
                <h3 className={`text-xl font-bold mb-6 text-center ${role.color}`}>{role.title}</h3>
                <ul className="space-y-4">
                  {role.benefits.map((benefit, idx) => (
                    <motion.li 
                      key={idx} 
                      className="flex items-start gap-3"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.2 + idx * 0.1 }}
                    >
                      <motion.svg 
                        className="w-6 h-6 text-green-500 mr-3 mt-0.5 flex-shrink-0" 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                        whileHover={{ scale: 1.1 }}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </motion.svg>
                      <span className="text-gray-600">{benefit}</span>
                    </motion.li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison Section */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <motion.h2 
            className="text-3xl md:text-4xl font-bold text-center mb-16 text-gray-900"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            Почему наше решение лучше подходит именно вам
          </motion.h2>
          <Tabs defaultValue="comparison" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-8">
              <TabsTrigger value="comparison" className="text-lg py-3">Сравнение возможностей</TabsTrigger>
              <TabsTrigger value="example" className="text-lg py-3">Реальный кейс</TabsTrigger>
            </TabsList>
            
            <TabsContent value="comparison">
              <motion.div 
                className="overflow-x-auto bg-white rounded-lg shadow-2xl"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <table className="min-w-full bg-white border border-gray-200 rounded-lg text-sm md:text-base">
                  <thead className="bg-gradient-to-r from-blue-50 to-indigo-50">
                    <tr>
                      <th className="px-4 py-4 text-left font-bold text-gray-700 border-b">Аспект</th>
                      <th className="px-4 py-4 text-left font-bold text-blue-700 border-b">Наше решение</th>
                      <th className="px-4 py-4 text-left font-bold text-gray-700 border-b">YClients</th>
                      <th className="px-4 py-4 text-left font-bold text-gray-700 border-b">МойСклад</th>
                      <th className="px-4 py-4 text-left font-bold text-gray-700 border-b">TOPSELLER</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["Ценообразование", "Freemium, % от экономии", "От 900 руб/мес", "От 1490 руб/мес", "От 990 руб/мес"],
                      ["Фокус", "Склад для e-com", "CRM для услуг", "Общий учет", "Продажи на MP"],
                      ["Интеграция с MP", "WB, Ozon, YM", "Ограниченная", "WB, Ozon, YM +", "WB, Ozon, YM"],
                      ["Мобильность", "Telegram-бот", "Веб/моб. app", "Веб/моб. app", "Облако"],
                      ["Gamification", "✅ Да", "❌ Нет", "❌ Нет", "❌ Нет"],
                      ["Управление сменами", "✅ Да", "Для услуг", "Базовое", "❌ Нет"],
                      ["Визуализация склада", "✅ Карта + фильтры", "Базовая", "Таблицы", "Дашборды"],
                      ["Отчеты", "CSV, статистика", "Для услуг", "Расширенные", "Аналитика MP"],
                      ["Обучение", "Минимальное", "Требуется", "Среднее", "Среднее"]
                    ].map((row, index) => (
                      <motion.tr 
                        key={index} 
                        className="border-t hover:bg-blue-50/20"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        {row.map((cell, cellIndex) => (
                          <td key={cellIndex} className="px-4 py-4 border-b">
                            {cellIndex === 1 ? <span className="font-medium text-blue-700">{cell}</span> : cell}
                          </td>
                        ))}
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </motion.div>
              <motion.p 
                className="mt-8 text-center text-gray-600 max-w-3xl mx-auto text-lg"
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
              >
                Специализация на e-commerce даёт нам преимущество: мы проще, гибче и эффективнее для ваших задач
              </motion.p>
            </TabsContent>
            
            <TabsContent value="example">
              <motion.div 
                className="text-center max-w-4xl mx-auto"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <h3 className="text-2xl font-bold mb-8 text-gray-900">Реальный кейс: Склад одеял</h3>
                <p className="text-lg mb-12 text-gray-600 max-w-2xl mx-auto">
                  64 артикула, 500+ единиц. Работало стабильно на бесплатном Supabase.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-2xl mx-auto">
                  <motion.div 
                    className="bg-gradient-to-br from-red-50 to-red-100 p-8 rounded-xl shadow-md border border-red-200"
                    whileHover={{ scale: 1.02 }}
                  >
                    <h4 className="text-xl font-bold mb-6 text-red-800">До приложения</h4>
                    <ul className="space-y-4 text-left text-gray-600">
                      <li className="flex items-start gap-3">
                        <span className="text-red-500 font-bold">•</span>
                        Обновление остатков - полдня работы
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="text-red-500 font-bold">•</span>
                        Штрафы за ошибки - 30+ тыс. руб/мес
                      </li>
                    </ul>
                  </motion.div>
                  <motion.div 
                    className="bg-gradient-to-br from-green-50 to-green-100 p-8 rounded-xl shadow-md border border-green-200"
                    whileHover={{ scale: 1.02 }}
                  >
                    <h4 className="text-xl font-bold mb-6 text-green-800">После внедрения</h4>
                    <ul className="space-y-4 text-left text-gray-600">
                      <li className="flex items-start gap-3">
                        <span className="text-green-500 font-bold">•</span>
                        Обновление - 1 клик
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="text-green-500 font-bold">•</span>
                        Штрафы снижены на 73% → 8 тыс. руб/мес
                      </li>
                    </ul>
                  </motion.div>
                </div>
                <motion.div 
                  className="mt-12 bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-xl max-w-2xl mx-auto border border-blue-200"
                  whileHover={{ scale: 1.02 }}
                >
                  <p className="text-xl font-semibold text-blue-800 mb-4">
                    Готовы к таким результатам?
                  </p>
                  <Button onClick={() => {
                    setShowAudit(true);
                    scrollToAudit();
                  }} className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white px-6 sm:px-8 py-3 sm:py-4 rounded-full font-bold text-lg shadow-lg">
                    <FaRocket className="mr-2" /> ПОВЫСИТЬ ЭФФЕКТИВНОСТЬ
                  </Button>
                </motion.div>
              </motion.div>
            </TabsContent>
          </Tabs>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-4 bg-gradient-to-br from-gray-100 to-gray-200">
        <div className="max-w-6xl mx-auto">
          <motion.h2 
            className="text-3xl md:text-4xl font-bold text-center mb-4 text-gray-900"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            Выберите план к нулевым потерям
          </motion.h2>
          <motion.p 
            className="text-xl text-center text-gray-600 mb-16 max-w-2xl mx-auto"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
          >
            От бесплатного старта до полной автоматизации с гарантией результата
          </motion.p>

          {/* Кнопка массовой рассылки (только для админов) */}
          {dbUser?.role === 'admin' && (
            <motion.div 
              className="text-center mb-8"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <Button 
                onClick={handleBroadcast} 
                disabled={isBroadcasting}
                className="bg-gradient-to-r from-purple-500 to-pink-600 text-white px-6 py-3 rounded-full font-bold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isBroadcasting ? (
                  <motion.span className="flex items-center">
                    <Loader2 className="animate-spin mr-2" /> Отправка...
                  </motion.span>
                ) : (
                  <motion.span className="flex items-center">
                    <FaBell className="mr-2" /> МАССОВАЯ РАССЫЛКА
                  </motion.span>
                )}
              </Button>
            </motion.div>
          )}

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[
              {
                title: "🚀 Путь к нулевым потерям (Бесплатно)",
                price: "0₽",
                period: "навсегда",
                description: "Начните снижать потери прямо сейчас",
                bestFor: "Для тестирования и первых 100 артикулов",
                features: [
                  "До 100 артикулов",
                  "1 склад и 3 сотрудника",
                  "Базовая синхронизация с WB",
                  "Telegram-интерфейс",
                  "Отчеты в CSV",
                  "Поддержка по email"
                ],
                cta: "Начать бесплатно",
                popular: false,
                type: "free",
                action: () => handlePlanAction('free', () => {
                  toast.success("✅ Бесплатный план активирован! Проверьте Telegram", {
                    duration: 4000,
                    icon: '🎁'
                  });
                })
              },
              {
                title: "⚡ Полная автоматизация (Профессионал)",
                price: "4 900₽",
                period: "в месяц",
                description: "Экономьте 20+ часов и 30+ тыс. руб/мес",
                bestFor: "2-3 магазина, 500+ артикулов",
                features: [
                  "До 500 артикулов",
                  "3 склада и 10 сотрудников",
                  "Полная WB/Ozon/YM синхронизация",
                  "Управление сменами",
                  "Расширенные отчеты",
                  "Визуализация склада",
                  "Приоритетная поддержка",
                  "Обучение команды (1 час)"
                ],
                cta: "Попробовать 14 дней бесплатно",
                popular: true,
                type: "pro",
                action: () => handlePlanAction('pro', () => {
                  toast.info("💳 Пробный период начат! Счет будет выставлен через 14 дней", {
                    duration: 5000,
                    icon: '⏳'
                  });
                })
              },
              {
                title: "🏢 Экспоненциальный рост (Предприятие)",
                price: "14 900₽",
                period: "в месяц",
                description: "Безлимитный рост с персональным сопровождением",
                bestFor: "Крупные сети и высокие обороты",
                features: [
                  "Безлимитные артикулы",
                  "Неограниченное количество складов",
                  "Все маркетплейсы + кастомные интеграции",
                  "AI-аналитика и прогнозирование",
                  "Dedicated менеджер",
                  "Индивидуальные доработки",
                  "Обучение команды (5 часов)",
                  "Гарантия снижения недостач на 50%+"
                ],
                cta: "Запросить демо",
                popular: false,
                type: "enterprise",
                action: () => handlePlanAction('enterprise', async () => {
                  toast.loading("📞 Запрос демо отправлен...", { id: 'demo-request' });
                  try {
                    await notifyAdmin(`🎯 ЗАПРОС ДЕМО!\nПользователь: ${dbUser?.username || dbUser?.user_id}\nВремя: ${new Date().toLocaleString('ru-RU')}\nСтатус: ожидает обратного звонка`);
                    toast.success("✅ Менеджер свяжется с вами в течение 15 минут!", {
                      id: 'demo-request',
                      duration: 5000,
                      icon: '📞'
                    });
                  } catch (error) {
                    toast.error("❌ Ошибка запроса демо", { id: 'demo-request' });
                  }
                })
              }
            ].map((plan, index) => (
              <motion.div 
                key={index} 
                className={`bg-white rounded-2xl p-6 sm:p-8 relative ${plan.popular ? 'ring-2 ring-blue-500 shadow-2xl' : 'shadow-lg'} hover:shadow-2xl transition-all duration-300`}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.2 }}
                whileHover={{ y: -10 }}
              >
                {plan.popular && (
                  <motion.div 
                    className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-10"
                    initial={{ y: -20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ type: "spring" }}
                  >
                    <span className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2 shadow-lg">
                      <FaFire className="animate-pulse" /> Самый популярный
                    </span>
                  </motion.div>
                )}
                
                <h3 className="text-xl sm:text-2xl font-bold mb-2 text-gray-900">{plan.title}</h3>
                <div className="mb-4">
                  <span className="text-3xl sm:text-4xl font-bold text-gray-900">{plan.price}</span>
                  <span className="text-gray-600 ml-2">{plan.period}</span>
                </div>
                <p className="text-gray-600 mb-6">{plan.description}</p>
                
                <div className="mb-6">
                  <span className="text-sm text-gray-500 font-medium">{plan.bestFor}</span>
                </div>
                
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start">
                      <svg className="w-5 h-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-gray-600 text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
                
                <Button 
                  onClick={plan.action}
                  className={`w-full py-3 text-base sm:text-lg font-semibold transition-all duration-300 ${
                    plan.type === 'free' 
                      ? 'bg-gradient-to-r from-gray-700 to-gray-900 hover:from-gray-800 hover:to-black text-white' 
                      : plan.popular 
                      ? 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white' 
                      : 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white'
                  }`}
                >
                  <motion.span className="flex items-center justify-center">
                    {plan.cta}
                    {plan.type !== 'free' && <FaPaperPlane className="ml-2" />}
                  </motion.span>
                </Button>

                {plan.type === 'pro' && (
                  <motion.div 
                    className="mt-4 p-2 bg-yellow-50 border border-yellow-200 rounded-lg"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1 }}
                  >
                    <p className="text-xs text-center text-yellow-800 font-medium">
                      <FaClock className="inline mr-1" /> Только 3 места по спеццене в ноябре!
                    </p>
                  </motion.div>
                )}
              </motion.div>
            ))}
          </div>

          {/* Services Section */}
          <motion.div 
            className="mt-16 bg-white rounded-2xl p-6 sm:p-8 shadow-lg"
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h3 className="text-2xl font-bold text-center mb-8 text-gray-900">Дополнительные услуги (One-time)</h3>
            <div className="grid md:grid-cols-2 gap-8">
              <motion.div 
                className="border border-gray-200 rounded-xl p-6 hover:border-blue-300 transition-colors"
                whileHover={{ scale: 1.02 }}
              >
                <h4 className="text-xl font-bold mb-4 text-blue-800">🎯 Автоматизация склада за 1 день</h4>
                <p className="text-3xl font-bold mb-2">10 000₽</p>
                <p className="text-gray-600 mb-4">единоразово</p>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li>• Полная настройка под ваш склад</li>
                  <li>• Интеграция со всеми маркетплейсами</li>
                  <li>• Обучение владельца (2 часа)</li>
                  <li>• Гарантия 30 дней</li>
                </ul>
                <Button 
                  onClick={() => handleSendInvoice('quick_setup', 10000)}
                  disabled={isSendingInvoice}
                  className="w-full mt-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSendingInvoice ? (
                    <motion.span className="flex items-center justify-center">
                      <Loader2 className="animate-spin mr-2" /> Отправка...
                    </motion.span>
                  ) : (
                    <motion.span className="flex items-center justify-center">
                      <FaPaperPlane className="mr-2" /> ОПЛАТИТЬ СЕЙЧАС
                    </motion.span>
                  )}
                </Button>
              </motion.div>
              <motion.div 
                className="border border-green-200 rounded-xl p-6 hover:border-green-300 transition-colors"
                whileHover={{ scale: 1.02 }}
              >
                <h4 className="text-xl font-bold mb-4 text-green-800">👨‍🏫 Обучение команды с нуля</h4>
                <p className="text-3xl font-bold mb-2">10 000₽</p>
                <p className="text-gray-600 mb-4">единоразово</p>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li>• Обучение менеджеров и кладовщиков</li>
                  <li>• Чек-листы и инструкции</li>
                  <li>• Ролевой доступ и права</li>
                  <li>• Контроль качества работы</li>
                </ul>
                <Button 
                  onClick={() => handleSendInvoice('team_training', 10000)}
                  disabled={isSendingInvoice}
                  className="w-full mt-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSendingInvoice ? (
                    <motion.span className="flex items-center justify-center">
                      <Loader2 className="animate-spin mr-2" /> Отправка...
                    </motion.span>
                  ) : (
                    <motion.span className="flex items-center justify-center">
                      <FaPaperPlane className="mr-2" /> ОПЛАТИТЬ СЕЙЧАС
                    </motion.span>
                  )}
                </Button>
              </motion.div>
            </div>
          </motion.div>

          {/* Guarantee Section */}
          <motion.div 
            className="mt-12 text-center"
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
          >
            <motion.div 
              className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-6 inline-block"
              whileHover={{ scale: 1.02 }}
            >
              <h4 className="text-xl font-bold text-blue-800 mb-2">💰 Гарантия результата</h4>
              <p className="text-gray-700 max-w-2xl mx-auto">
                Мы настолько уверены в результате, что предлагаем использовать систему за <strong>50% от вашей экономии на штрафах</strong>. 
                Если недостачи не снизятся на 50% в первый месяц - вернем деньги!
              </p>
              <Button onClick={() => {
                setShowAudit(true);
                scrollToAudit();
              }} className="mt-4 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white px-6 sm:px-8 py-3 sm:py-4 rounded-full font-bold text-lg shadow-lg">
                <FaCalendarCheck className="mr-2" /> Узнать потенциал экономии
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Invite Section */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-6xl mx-auto text-center">
          <motion.h2 
            className="text-3xl md:text-4xl font-bold mb-12 text-gray-900"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            Как начать работу и пригласить команду
          </motion.h2>
          <div className="max-w-3xl mx-auto text-left space-y-6 text-lg text-gray-600">
            <motion.ol className="list-decimal pl-6 space-y-6">
              {[
                "Откройте приложение в Telegram и авторизуйтесь.",
                'Перейдите в раздел "Экипажи" и создайте новый экипаж (кнопка "+").',
                "Поделитесь ссылкой приглашения: t.me/[ваш-бот]?start=crew_[ваш-slug]_join_crew",
                "Сотрудник перейдет по ссылке и подаст заявку.",
                "Подтвердите заявку в карточке экипажа.",
                "Назначьте роли и предоставьте доступ к складу."
              ].map((step, index) => (
                <motion.li 
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="pb-2"
                >
                  {step}
                </motion.li>
              ))}
            </motion.ol>
            <motion.p 
              className="text-center font-semibold text-xl mt-12 text-blue-800"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              Экипаж - это ваш склад. Приглашайте команду для совместной работы!
            </motion.p>
          </div>
        </div>
      </section>

      {/* Enhanced CTA Section */}
      <section className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white py-20 px-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-white/10 via-transparent to-white/10 animate-pulse" />
        <div className="max-w-6xl mx-auto text-center relative z-10">
          <motion.h2 
            className="text-3xl md:text-4xl font-bold mb-6"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            Оптимизируйте склад уже сегодня
          </motion.h2>
          <motion.p 
            className="text-xl mb-10 max-w-2xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
          >
            Создайте экипаж бесплатно и начните экономить время и ресурсы
          </motion.p>
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4 }}
            className="max-w-2xl mx-auto bg-white/10 backdrop-blur-md p-8 rounded-2xl space-y-6 shadow-2xl border border-white/20"
          >
            {!createdCrew ? (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="text-center">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                    className="inline-block"
                  >
                    <FaUsers className="text-5xl text-white mx-auto mb-4" />
                  </motion.div>
                  <h1 className="text-4xl font-bold text-white mb-2">СОЗДАТЬ СКЛАД</h1>
                  <p className="text-gray-200">Соберите свою команду и управляйте складом эффективно.</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="crew-name" className="text-white text-lg">НАЗВАНИЕ СКЛАДА</Label>
                    <Input id="crew-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Например, Main Warehouse" required className="mt-2 text-lg py-3 bg-white/20 text-white placeholder-gray-300 border-white/30 focus:border-white/50" />
                  </div>
                  <div>
                    <Label htmlFor="crew-slug" className="text-white text-lg">SLUG (АДРЕС СКЛАДА)</Label>
                    <Input id="crew-slug" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="main-warehouse" required className="mt-2 text-lg py-3 bg-white/20 text-white placeholder-gray-300 border-white/30 focus:border-white/50" />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="crew-desc" className="text-white text-lg">ОПИСАНИЕ / ИНСТРУКЦИИ</Label>
                  <Textarea id="crew-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Описание склада и правил работы..." required className="mt-2 text-lg min-h-[100px] bg-white/20 text-white placeholder-gray-300 border-white/30 focus:border-white/50" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="crew-logo" className="text-white text-lg">URL ЛОГОТИПА</Label>
                    <Input id="crew-logo" type="url" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://..." className="mt-2 text-lg py-3 bg-white/20 text-white placeholder-gray-300 border-white/30 focus:border-white/50" />
                  </div>
                  <div>
                    <Label htmlFor="crew-hq" className="text-white text-lg">КООРДИНАТЫ СКЛАДА</Label>
                    <Input id="crew-hq" value={hqLocation} onChange={(e) => setHqLocation(e.target.value)} placeholder="lat,lng" className="mt-2 text-lg py-3 bg-white/20 text-white placeholder-gray-300 border-white/30 focus:border-white/50" />
                  </div>
                </div>
                
                <Button type="submit" disabled={isSubmitting} className="w-full text-lg py-6 bg-gradient-to-r from-white to-gray-100 text-blue-600 hover:from-gray-100 hover:to-gray-200 font-bold text-xl rounded-xl shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                  {isSubmitting ? (
                    <AnimatePresence mode="wait">
                      <motion.span
                        key="loading"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex items-center justify-center"
                      >
                        <Loader2 className='animate-spin mr-2' /> Создание...
                      </motion.span>
                    </AnimatePresence>
                  ) : (
                    <>
                      <FaFlagCheckered className="mr-2" /> СФОРМИРОВАТЬ СКЛАД
                    </>
                  )}
                </Button>
              </form>
            ) : (
              <motion.div 
                className="space-y-6 text-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <h3 className="text-3xl font-bold">Склад успешно создан!</h3>
                <p className="text-xl">Теперь пригласите членов команды.</p>
                <div className="flex justify-center gap-4 flex-col sm:flex-row">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <motion.div whileHover={{ scale: 1.05 }}>
                          <Button onClick={handleInvite} className="bg-gradient-to-r from-white to-gray-100 text-blue-600 hover:from-gray-100 hover:to-gray-200 px-8 py-3 text-lg font-bold rounded-xl shadow-lg">
                            <FaUserPlus className="mr-2" /> Пригласить команду
                          </Button>
                        </motion.div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Поделиться ссылкой приглашения</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <Link href={`/wb/${createdCrew.slug}`}>
                    <motion.div whileHover={{ scale: 1.05 }}>
                      <Button variant="outline" className="text-white border-2 border-white hover:bg-white/10 px-8 py-3 text-lg font-bold rounded-xl">
                        Перейти к складу
                      </Button>
                    </motion.div>
                  </Link>
                </div>
              </motion.div>
            )}
          </motion.div>
        </div>
      </section>

      {/* Existing Crews Section */}
      <section className="py-20 px-4 bg-gray-100">
        <div className="max-w-6xl mx-auto">
          <motion.h2 
            className="text-3xl md:text-4xl font-bold text-center mb-16 text-gray-900"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            Существующие склады
          </motion.h2>
          <CrewsListSimplified />
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gradient-to-r from-gray-900 to-gray-800 text-gray-300 py-12 px-4">
        <div className="max-w-6xl mx-auto text-center space-y-6">
          <motion.p 
            className="text-lg"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            &copy; 2025 Управление складом. Все права защищены.
          </motion.p>
          <motion.div 
            className="flex flex-wrap justify-center gap-6 text-lg"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
          >
            <a href="/privacy" className="hover:text-white transition-colors duration-200">Политика конфиденциальности</a>
            <a href="/terms" className="hover:text-white transition-colors duration-200">Условия использования</a>
            <a href="/support" className="hover:text-white transition-colors duration-200">Поддержка</a>
          </motion.div>
        </div>
      </footer>

      <ExitIntentPopup />
    </div>
  );
}