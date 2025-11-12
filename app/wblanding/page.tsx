"use client";

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from "next/navigation";
import { useAppContext } from "@/contexts/AppContext";
import { createCrew } from "@/app/actions";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { Suspense } from 'react';
import { getAllPublicCrews } from '@/app/rentals/actions';
import { FaCarBurst, FaChartLine, FaMoneyBillWave, FaRocket, FaUsers, FaSpinner, FaFlagCheckered, FaUserPlus, FaCalendarCheck, FaClock, FaFire } from 'react-icons/fa6';

// --- NEW: Warehouse Audit Tool Component (Lead Magnet) ---
const WarehouseAuditTool = () => {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [email, setEmail] = useState("");
  const [showResult, setShowResult] = useState(false);
  const [losses, setLosses] = useState(0);

  const questions = [
    { id: "skus", text: "Сколько артикулов вы держите на складе?", type: "number", placeholder: "100" },
    { id: "hours", text: "Сколько часов в месяц тратите на ручные обновления остатков?", type: "number", placeholder: "40" },
    { id: "penalties", text: "Сколько платите штрафов за ошибки в остатках (руб/мес)?", type: "number", placeholder: "30000" },
    { id: "stores", text: "На скольких маркетплейсах одновременно продаете?", type: "number", placeholder: "2" },
  ];

  const handleNext = () => {
    if (!currentAnswer && currentAnswer !== "0") return;
    const newAnswers = { ...answers, [questions[step].id]: parseInt(currentAnswer) || currentAnswer };
    setAnswers(newAnswers);
    
    if (step < questions.length - 1) {
      setStep(step + 1);
      setCurrentAnswer("");
    } else {
      const calcLosses = (data) => {
        const timeCost = data.hours * 1500;
        const penaltyCost = data.penalties;
        const missedSales = Math.floor(data.skus * data.stores * 0.05 * 1000);
        return timeCost + penaltyCost + missedSales;
      };
      const totalLosses = calcLosses(newAnswers);
      setLosses(totalLosses);
      setShowResult(true);
    }
  };

  const handleGetReport = () => {
    if (!email) { toast.error("Введите email для получения отчета"); return; }
    toast.success("Отчет отправлен! Проверьте почту.");
    console.log("Lead captured:", { email, answers, losses });
  };

  if (step === 0 && !showResult) return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl p-6 sm:p-8 shadow-xl max-w-2xl mx-auto">
      <div className="text-center mb-6">
        <h3 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">Рассчитайте ваши потери за 60 секунд</h3>
        <p className="text-gray-600 text-base sm:text-lg">Узнайте, сколько денег и времени теряет ваш склад сейчас</p>
      </div>
      <div className="text-center">
        <Button onClick={() => setStep(1)} size="lg" className="bg-red-500 hover:bg-red-600 text-white px-4 sm:px-6 py-3 sm:py-4 rounded-full font-bold text-base sm:text-lg w-full sm:w-auto">
          <FaRocket className="mr-2" /> НАЧАТЬ БЕСПЛАТНЫЙ АУДИТ
        </Button>
      </div>
    </motion.div>
  );

  if (showResult) return (
    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-2xl p-6 sm:p-8 shadow-xl max-w-2xl mx-auto">
      <div className="text-center mb-6">
        <FaChartLine className="text-5xl sm:text-6xl text-red-500 mx-auto mb-4" />
        <h3 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">Вы теряете: ~{losses.toLocaleString('ru-RU')}₽/мес</h3>
        <p className="text-gray-600 text-base sm:text-lg mb-4">И тратите {answers.hours} часов на рутину</p>
      </div>
      <div className="bg-red-50 p-5 sm:p-6 rounded-xl mb-6">
        <h4 className="font-bold text-lg sm:text-xl text-red-800 mb-3">Как это возможно?</h4>
        <ul className="space-y-2 text-red-700 text-sm sm:text-base">
          <li>• Штрафы за ошибки: {answers.penalties?.toLocaleString('ru-RU')}₽</li>
          <li>• Стоимость вашего времени: {(answers.hours * 1500).toLocaleString('ru-RU')}₽</li>
          <li>• Упущенные продажи из-за неточностей: ~{Math.floor(answers.skus * answers.stores * 0.05 * 1000).toLocaleString('ru-RU')}₽</li>
        </ul>
      </div>
      <div className="mb-6">
        <Label htmlFor="email" className="text-lg font-bold mb-2 block">Куда отправить план снижения потерь?</Label>
        <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ваш@email.ru" className="py-3 text-lg" />
      </div>
      <Button onClick={handleGetReport} className="w-full bg-green-600 hover:bg-green-700 text-white text-lg py-4">
        <FaMoneyBillWave className="mr-2" /> ПОЛУЧИТЬ ПЛАН ЭКОНОМИИ
      </Button>
    </motion.div>
  );

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl p-6 sm:p-8 shadow-xl max-w-2xl mx-auto">
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <span className="text-sm text-gray-500">Шаг {step} из {questions.length}</span>
          <Button variant="ghost" size="sm" onClick={() => { setStep(0); setCurrentAnswer(""); setAnswers({}); }}>Начать заново</Button>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div className="bg-red-500 h-2 rounded-full transition-all" style={{ width: `${(step / questions.length) * 100}%` }}></div>
        </div>
      </div>
      <div className="mb-6">
        <Label className="text-xl font-bold text-gray-900 mb-6 block">{questions[step].text}</Label>
        <Input
          type={questions[step].type}
          placeholder={questions[step].placeholder}
          value={currentAnswer}
          onChange={(e) => setCurrentAnswer(e.target.value)}
          onKeyPress={(e) => { if (e.key === 'Enter') handleNext(); }}
          className="py-5 text-lg"
          autoFocus
        />
      </div>
      <div className="flex gap-3">
        {step > 1 && <Button variant="outline" onClick={() => setStep(step - 1)} className="flex-1">Назад</Button>}
        <Button onClick={handleNext} className="flex-1 bg-red-500 hover:bg-red-600 text-white text-lg py-4">
          Далее
          <FaRocket className="ml-2" />
        </Button>
      </div>
    </motion.div>
  );
};

// --- NEW: Exit Intent Popup ---
const ExitIntentPopup = () => {
  const [show, setShow] = useState(false);
  const [email, setEmail] = useState("");

  useEffect(() => {
    const handleMouseLeave = (e) => {
      if (e.clientY <= 0) setShow(true);
    };
    document.addEventListener('mouseleave', handleMouseLeave);
    return () => document.removeEventListener('mouseleave', handleMouseLeave);
  }, []);

  if (!show) return null;

  const handleSubmit = () => {
    if (!email) { toast.error("Введите email"); return; }
    toast.success("Чек-лист отправлен! Проверьте почту.");
    setShow(false);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-2xl p-6 sm:p-8 max-w-lg w-full shadow-2xl mx-4">
        <h3 className="text-xl sm:text-2xl font-bold mb-4 text-gray-900">Уходите? Возьмите чек-лист!</h3>
        <p className="text-gray-600 mb-6 text-sm sm:text-base">Получите бесплатный чек-лист из 10 пунктов для мгновенного снижения штрафов на маркетплейсах.</p>
        <Input 
          placeholder="Ваш email" 
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mb-4"
        />
        <div className="flex gap-3">
          <Button className="flex-1 bg-blue-600 hover:bg-blue-700 text-white" onClick={handleSubmit}>
            Получить чек-лист
          </Button>
          <Button variant="outline" onClick={() => setShow(false)}>Нет, спасибо</Button>
        </div>
      </motion.div>
    </div>
  );
};

const generateSlug = (name: string) =>
  name.toLowerCase().trim().replace(/[\s_]+/g, '-').replace(/[^\w-]+/g, '').replace(/--+/g, '-').replace(/^-+|-+$/g, '');

function CrewsListSimplified() {
  const { userCrewInfo } = useAppContext();
  const [crews, setCrews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const crewsResult = await getAllPublicCrews();
        if (crewsResult.success && crewsResult.data) setCrews(crewsResult.data);
        else setError(crewsResult.error || "Не удалось загрузить список складов.");
      } catch (e) {
        setError(e.message || "Неизвестная ошибка на клиенте.");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) return <div className="text-center py-10 text-lg text-gray-600">Загрузка складов...</div>;
  if (error) return <div className="text-center py-10 text-red-500 font-medium">{error}</div>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {crews.map((crew) => {
        const isEditable = userCrewInfo && userCrewInfo.id === crew.id;
        return (
          <Link href={`/wb/${crew.slug}`} key={crew.id} className="block group">
            <div className={cn(
              "p-6 rounded-xl shadow-md hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1",
              isEditable ? "bg-blue-50 border-2 border-blue-500" : "bg-white"
            )}>
              <div className="flex items-start gap-4 mb-4">
                <Image 
                  src={crew.logo_url || '/placeholder.svg'} 
                  alt={`${crew.name} Logo`} 
                  width={64} 
                  height={64} 
                  className={cn(
                    "rounded-full border-2 transition-colors",
                    isEditable ? "border-blue-500" : "border-gray-200 group-hover:border-blue-500"
                  )}
                />
                <div>
                  <h2 className={cn(
                    "text-xl font-bold group-hover:text-blue-600",
                    isEditable ? "text-blue-600" : "text-blue-800"
                  )}>{crew.name}</h2>
                  <p className="text-xs text-gray-500">by @{crew.owner_username}</p>
                </div>
              </div>
              <p className="text-gray-600 text-sm mb-4">{crew.description}</p>
              <div className="grid grid-cols-3 gap-2 border-t pt-4">
                <div className="text-center">
                  <span className="block text-lg font-bold text-gray-900">{crew.member_count || 0}</span>
                  <span className="text-xs text-gray-500">Сотрудников</span>
                </div>
                <div className="text-center">
                  <span className="block text-lg font-bold text-gray-900">{crew.vehicle_count || 0}</span>
                  <span className="text-xs text-gray-500">Единиц</span>
                </div>
                <div className="text-center">
                  <span className="block text-lg font-bold text-blue-600">N/A</span>
                  <span className="text-xs text-gray-500">Миссий</span>
                </div>
              </div>
              {isEditable && (
                <p className="text-center text-blue-600 font-semibold mt-4 px-3 py-1 bg-blue-100 rounded-full text-sm">
                  {userCrewInfo.is_owner ? "Ваш склад (владелец)" : "Ваш склад (участник)"}
                </p>
              )}
            </div>
          </Link>
        );
      })}
    </div>
  );
}

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

  useEffect(() => { setSlug(generateSlug(name)); }, [name]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dbUser?.user_id) { toast.error("Ошибка: не удалось определить ID пользователя."); return; }
    if (!slug) { toast.error("Slug не может быть пустым. Введите название склада."); return; }
    setIsSubmitting(true);
    toast.info("Создание нового склада...");
    try {
      const result = await createCrew({
        name, slug, description, logo_url: logoUrl, owner_id: dbUser.user_id, hq_location: hqLocation,
      });
      if (result.success && result.data) {
        toast.success(`Склад "${result.data.name}" успешно создан!`);
        setCreatedCrew({ slug: result.data.slug, name: result.data.name });
      } else { throw new Error(result.error || "Неизвестная ошибка при создании склада."); }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Произошла ошибка.");
    } finally { setIsSubmitting(false); }
  };

  const handleInvite = () => {
    if (!createdCrew) return;
    const inviteUrl = `https://t.me/oneBikePlsBot/app?startapp=crew_ ${createdCrew.slug}_join_crew`;
    const text = `Присоединяйся к нашему складу '${createdCrew.name}' в приложении!`;
    const shareUrl = `https://t.me/share/url?url= ${encodeURIComponent(inviteUrl)}&text=${encodeURIComponent(text)}`;
    window.open(shareUrl, "_blank");
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 font-sans">
      {/* Hero Section with Adjusted Font Size */}
      <section className="relative min-h-[70vh] flex items-center justify-center text-white">
        <video
          className="absolute inset-0 w-full h-full object-cover brightness-50"
          autoPlay
          loop
          muted
          playsInline
          src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/grok-video-882e5db9-d256-42f2-a77a-da36b230f67e-0.mp4 "
        />
        <div className="relative z-10 text-center px-4 max-w-6xl mx-auto">
          <Image 
            src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/IMG_20250623_004400_844-152720e6-ad84-48d1-b4e7-e0f238b7442b.png "
            alt="Логотип приложения"
            width={120}
            height={120}
            className="mx-auto mb-8 rounded-full w-20 h-20 sm:w-24 sm:h-24 md:w-32 md:h-32"
          />
          {/* Font size reduced: text-3xl md:text-5xl lg:text-6xl (was text-4xl md:text-6xl lg:text-7xl) */}
          <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold mb-6 text-white drop-shadow-2xl leading-tight">
            Складской учет для онлайн-магазинов
          </h1>
          <p className="text-xl md:text-2xl lg:text-3xl mb-8 text-white/90 drop-shadow-lg max-w-4xl mx-auto leading-relaxed">
            Сократите недостачи на 73%, обновляйте остатки одним кликом. Для 2+ магазинов на WB, Ozon, YM с 100+ артикулами.
          </p>
          {/* CTAs with responsive button sizes */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            {/* Button width fixed: px-4 sm:px-6 md:px-8 and w-full sm:w-auto */}
            <Button onClick={() => setShowAudit(true)} size="lg" className="bg-red-500 hover:bg-red-600 text-white px-4 sm:px-6 py-3 sm:py-4 rounded-full font-bold text-base sm:text-lg w-full sm:w-auto">
              <FaChartLine className="mr-2" /> РАССЧИТАТЬ ПОТЕРИ ЗА 60 СЕК
            </Button>
            <span className="text-white/70">или</span>
            <Link href="#features">
              <Button variant="outline" size="lg" className="bg-transparent border-white text-white hover:bg-white hover:text-blue-600 px-4 sm:px-6 py-3 sm:py-4 rounded-full font-bold text-base sm:text-lg w-full sm:w-auto">
                Узнать больше
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Lead Magnet Section */}
      {showAudit && (
        <section id="audit-tool" className="py-16 px-4 bg-white">
          <WarehouseAuditTool />
        </section>
      )}

      {/* Second Video Section */}
      <section className="py-12 bg-gray-100">
        <div className="max-w-4xl mx-auto px-4">
          <video className="w-full h-auto rounded-2xl shadow-xl md:max-w-2xl mx-auto" autoPlay loop muted playsInline>
            <source src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/grok-video-c73d1434-fe01-4e30-ad74-3799fdce56eb-5-29a2a26b-c256-4dff-9c32-cc00a6847df5.mp4 " type="video/mp4" />
          </video>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-16 text-gray-900">Возможности приложения</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              { icon: "M13 10V3L4 14h7v7l9-11h-7z", title: "Синхронизация с маркетплейсами", description: "Автоматическое обновление остатков на WB, Ozon и Яндекс.Маркет в реальном времени." },
              { icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z", title: "Управление сменами", description: "Контроль работы персонала, чекпоинты и детальная статистика по сменам." },
              { icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z", title: "Мульти-доступ", description: "Управление несколькими складами, ролевой доступ для команды." },
              { icon: "M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z", title: "Telegram-интерфейс", description: "Удобный доступ через мессенджер, без установки приложений." },
              { icon: "M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z", title: "Визуализация склада", description: "Интерактивная карта склада с фильтрами по характеристикам товаров." },
              { icon: "M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z", title: "Отчеты", description: "Экспорт остатков и смен в удобных форматах, статистика продаж." }
            ].map((feature, index) => (
              <div key={index} className="bg-gray-50 p-8 rounded-xl shadow-md hover:shadow-xl transition-all duration-300 group border border-gray-200 hover:border-blue-300">
                <svg className="w-12 h-12 mx-auto mb-6 text-blue-600 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={feature.icon} />
                </svg>
                <h3 className="text-xl font-bold mb-4 text-center text-gray-900">{feature.title}</h3>
                <p className="text-center text-gray-600 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
          {/* CTA after features */}
          <div className="text-center mt-16">
            <Button onClick={() => setShowAudit(true)} className="bg-red-500 hover:bg-red-600 text-white px-6 sm:px-8 py-3 sm:py-4 rounded-full font-bold text-lg w-full sm:w-auto">
              <FaCarBurst className="mr-2" /> ПОСЧИТАТЬ МОИ ПОТЕРИ
            </Button>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 px-4 bg-gray-100">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-16 text-gray-900">Почему наше приложение выгодно</h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {[
              { title: "Для владельца бизнеса", benefits: ["Контроль нескольких магазинов", "Снижение потерь и ошибок", "Автосинхронизация остатков", "Мониторинг команды", "Freemium - старт бесплатно"], color: "text-blue-800" },
              { title: "Для персонала", benefits: ["Простой интерфейс в Telegram", "Быстрые операции с товарами", "Игровой режим с наградами", "Личная статистика и цели"], color: "text-blue-800" },
              { title: "Для администратора", benefits: ["Управление несколькими складами", "Безопасный доступ для команды", "Уведомления о заказах (в разработке)", "Простые отчеты в CSV"], color: "text-blue-800" }
            ].map((role, index) => (
              <div key={index} className="bg-white p-8 rounded-xl shadow-md hover:shadow-lg transition-shadow">
                <h3 className={`text-xl font-bold mb-6 text-center ${role.color}`}>{role.title}</h3>
                <ul className="space-y-4">
                  {role.benefits.map((benefit, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <svg className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-gray-600">{benefit}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison Section */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-16 text-gray-900">Сравнение с конкурентами</h2>
          <Tabs defaultValue="comparison" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-8">
              <TabsTrigger value="comparison" className="text-lg py-3">Сравнение функций</TabsTrigger>
              <TabsTrigger value="example" className="text-lg py-3">Реальный кейс</TabsTrigger>
            </TabsList>
            
            <TabsContent value="comparison">
              <div className="overflow-x-auto bg-white rounded-lg shadow-lg">
                <table className="min-w-full bg-white border border-gray-200 rounded-lg text-sm md:text-base">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-4 text-left font-bold text-gray-700 border-b">Аспект</th>
                      <th className="px-4 py-4 text-left font-bold text-gray-700 border-b">Наше решение</th>
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
                      ["Gamification", "Да", "Нет", "Нет", "Нет"],
                      ["Управление сменами", "Да", "Для услуг", "Базовое", "Нет"],
                      ["Визуализация склада", "Карта + фильтры", "Базовая", "Таблицы", "Дашборды"],
                      ["Отчеты", "CSV, статистика", "Для услуг", "Расширенные", "Аналитика MP"],
                      ["Обучение", "Минимальное", "Требуется", "Среднее", "Среднее"]
                    ].map((row, index) => (
                      <tr key={index} className="border-t hover:bg-gray-50">
                        {row.map((cell, cellIndex) => (
                          <td key={cellIndex} className="px-4 py-4 border-b">
                            {cellIndex === 0 ? <span className="font-medium">{cell}</span> : cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-8 text-center text-gray-600 max-w-3xl mx-auto text-lg">
                Наше приложение - специализированное решение для складов онлайн-магазинов. 
                Оно проще, дешевле и эффективнее для малого/среднего e-com.
              </p>
            </TabsContent>
            
            <TabsContent value="example">
              <div className="text-center max-w-4xl mx-auto">
                <h3 className="text-2xl font-bold mb-8 text-gray-900">Реальный кейс: Склад одеял</h3>
                <p className="text-lg mb-12 text-gray-600 max-w-2xl mx-auto">
                  Мы тестировали приложение на складе с одеялами: 4 размера, 2 сезона, 8 узоров - 64 артикула, &gt;500 единиц. 
                  Работало стабильно на бесплатном Supabase.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-2xl mx-auto">
                  <div className="bg-gray-50 p-8 rounded-xl shadow-md">
                    <h4 className="text-xl font-bold mb-6 text-blue-800">До приложения</h4>
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
                  </div>
                  <div className="bg-gray-50 p-8 rounded-xl shadow-md">
                    <h4 className="text-xl font-bold mb-6 text-blue-800">После</h4>
                    <ul className="space-y-4 text-left text-gray-600">
                      <li className="flex items-start gap-3">
                        <span className="text-green-500 font-bold">•</span>
                        Обновление - 1 клик
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="text-green-500 font-bold">•</span>
                        Штрафы - 8 тыс. руб/мес (снижение на 73%)
                      </li>
                    </ul>
                  </div>
                </div>
                <div className="mt-12 bg-blue-50 p-6 rounded-xl max-w-2xl mx-auto">
                  <p className="text-xl font-semibold text-blue-800 mb-4">
                    Сколько вы теряете? Проверьте за 60 секунд!
                  </p>
                  <Button onClick={() => setShowAudit(true)} className="bg-red-500 hover:bg-red-600 text-white px-6 sm:px-8 py-3 sm:py-4 rounded-full font-bold text-lg w-full sm:w-auto">
                    <FaRocket className="mr-2" /> РАССЧИТАТЬ МОИ ПОТЕРИ
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-4 bg-gray-100">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4 text-gray-900">
            Выберите план к нулевым потерям
          </h2>
          <p className="text-xl text-center text-gray-600 mb-16 max-w-2xl mx-auto">
            От бесплатного старта до полной автоматизации с гарантией результата
          </p>

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
                type: "free"
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
                type: "pro"
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
                type: "enterprise"
              }
            ].map((plan, index) => (
              <div key={index} className={`bg-white rounded-2xl p-6 sm:p-8 relative ${plan.popular ? 'ring-2 ring-blue-500 shadow-xl' : 'shadow-lg'} hover:shadow-xl transition-shadow duration-300`}>
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-10">
                    <span className="bg-blue-500 text-white px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2">
                      <FaFire className="animate-pulse" /> Самый популярный
                    </span>
                  </div>
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
                
                <Button className={`w-full py-3 text-base sm:text-lg font-semibold ${
                  plan.type === 'free' 
                    ? 'bg-gray-800 hover:bg-gray-900 text-white' 
                    : plan.popular 
                    ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                    : 'bg-green-600 hover:bg-green-700 text-white'
                } transition-colors duration-300`}>
                  {plan.cta}
                </Button>

                {plan.type === 'pro' && (
                  <div className="mt-4 p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-xs text-center text-yellow-800 font-medium">
                      <FaClock className="inline mr-1" /> Только 3 места по спеццене в ноябре!
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Services Section */}
          <div className="mt-16 bg-white rounded-2xl p-6 sm:p-8 shadow-lg">
            <h3 className="text-2xl font-bold text-center mb-8 text-gray-900">Дополнительные услуги (One-time)</h3>
            <div className="grid md:grid-cols-2 gap-8">
              <div className="border border-gray-200 rounded-xl p-6 hover:border-blue-300 transition-colors">
                <h4 className="text-xl font-bold mb-4 text-blue-800">🎯 Автоматизация склада за 1 день</h4>
                <p className="text-3xl font-bold mb-2">20 000₽</p>
                <p className="text-gray-600 mb-4">единоразово</p>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li>• Полная настройка под ваш склад</li>
                  <li>• Интеграция со всеми маркетплейсами</li>
                  <li>• Обучение владельца (2 часа)</li>
                  <li>• Гарантия 30 дней</li>
                </ul>
              </div>
              <div className="border border-green-200 rounded-xl p-6 hover:border-green-300 transition-colors">
                <h4 className="text-xl font-bold mb-4 text-green-800">👨‍🏫 Обучение команды с нуля</h4>
                <p className="text-3xl font-bold mb-2">10 000₽</p>
                <p className="text-gray-600 mb-4">единоразово</p>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li>• Обучение менеджеров и кладовщиков</li>
                  <li>• Чек-листы и инструкции</li>
                  <li>• Ролевой доступ и права</li>
                  <li>• Контроль качества работы</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Guarantee Section (unchanged) */}
          <div className="mt-12 text-center">
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 inline-block">
              <h4 className="text-xl font-bold text-blue-800 mb-2">💰 Гарантия результата</h4>
              <p className="text-gray-700 max-w-2xl mx-auto">
                Мы настолько уверены в результате, что предлагаем использовать систему за <strong>50% от вашей экономии на штрафах</strong>. 
                Если недостачи не снизятся на 50% в первый месяц - вернем деньги!
              </p>
              <Button onClick={() => setShowAudit(true)} className="mt-4 bg-green-600 hover:bg-green-700 text-white">
                <FaCalendarCheck className="mr-2" /> Проверить мои потери
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Invite Section (unchanged) */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-6xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-12 text-gray-900">Как начать работу и пригласить команду</h2>
          <div className="max-w-3xl mx-auto text-left space-y-6 text-lg text-gray-600">
            <ol className="list-decimal pl-6 space-y-6">
              <li className="pb-2">Откройте приложение в Telegram и авторизуйтесь.</li>
              <li className="pb-2">Перейдите в раздел "Экипажи" и создайте новый экипаж (кнопка "+").</li>
              <li className="pb-2">Поделитесь ссылкой приглашения: t.me/[ваш-бот]?start=crew_[ваш-slug]_join_crew</li>
              <li className="pb-2">Сотрудник перейдет по ссылке и подаст заявку.</li>
              <li className="pb-2">Подтвердите заявку в карточке экипажа.</li>
              <li>Назначьте роли и предоставьте доступ к складу.</li>
            </ol>
            <p className="text-center font-semibold text-xl mt-12 text-blue-800">
              Экипаж - это ваш склад. Приглашайте команду для совместной работы!
            </p>
          </div>
        </div>
      </section>

      {/* Enhanced CTA Section */}
      <section className="bg-gradient-to-r from-blue-600 to-blue-800 text-white py-20 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">Оптимизируйте склад уже сегодня</h2>
          <p className="text-xl mb-10">Создайте экипаж бесплатно и начните экономить на ошибках</p>
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="max-w-2xl mx-auto bg-white/10 backdrop-blur-md p-8 rounded-2xl space-y-6 shadow-2xl"
          >
            {!createdCrew ? (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="text-center">
                  <FaUsers className="text-5xl text-white mx-auto mb-4" />
                  <h1 className="text-4xl font-bold text-white mb-2">СОЗДАТЬ СКЛАД</h1>
                  <p className="text-gray-200">Соберите свою команду и управляйте складом эффективно.</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="crew-name" className="text-white text-lg">НАЗВАНИЕ СКЛАДА</Label>
                    <Input id="crew-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Например, Main Warehouse" required className="mt-2 text-lg py-3 bg-white/20 text-white placeholder-gray-300" />
                  </div>
                  <div>
                    <Label htmlFor="crew-slug" className="text-white text-lg">SLUG (АДРЕС СКЛАДА)</Label>
                    <Input id="crew-slug" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="main-warehouse" required className="mt-2 text-lg py-3 bg-white/20 text-white placeholder-gray-300" />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="crew-desc" className="text-white text-lg">ОПИСАНИЕ / ИНСТРУКЦИИ</Label>
                  <Textarea id="crew-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Описание склада и правил работы..." required className="mt-2 text-lg min-h-[100px] bg-white/20 text-white placeholder-gray-300" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="crew-logo" className="text-white text-lg">URL ЛОГОТИПА</Label>
                    <Input id="crew-logo" type="url" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://..." className="mt-2 text-lg py-3 bg-white/20 text-white placeholder-gray-300" />
                  </div>
                  <div>
                    <Label htmlFor="crew-hq" className="text-white text-lg">КООРДИНАТЫ СКЛАДА</Label>
                    <Input id="crew-hq" value={hqLocation} onChange={(e) => setHqLocation(e.target.value)} placeholder="lat,lng" className="mt-2 text-lg py-3 bg-white/20 text-white placeholder-gray-300" />
                  </div>
                </div>
                
                <Button type="submit" disabled={isSubmitting} className="w-full text-lg py-6 bg-white text-blue-600 hover:bg-gray-100 font-bold text-xl">
                  {isSubmitting ? (
                    <>
                      <FaSpinner className='animate-spin mr-2' /> Создание...
                    </>
                  ) : (
                    <>
                      <FaFlagCheckered className="mr-2" /> СФОРМИРОВАТЬ СКЛАД
                    </>
                  )}
                </Button>
              </form>
            ) : (
              <div className="space-y-6 text-center">
                <h3 className="text-3xl font-bold">Склад успешно создан!</h3>
                <p className="text-xl">Теперь пригласите членов команды.</p>
                <div className="flex justify-center gap-4">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button onClick={handleInvite} className="bg-white text-blue-600 hover:bg-gray-100 px-8 py-3 text-lg font-bold">
                          <FaUserPlus className="mr-2" /> Пригласить команду
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Поделиться ссылкой приглашения</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <Link href={`/wb/${createdCrew.slug}`}>
                    <Button variant="outline" className="text-white border-white hover:bg-white/10 px-8 py-3 text-lg font-bold">
                      Перейти к складу
                    </Button>
                  </Link>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </section>

      {/* Existing Crews Section (unchanged) */}
      <section className="py-20 px-4 bg-gray-100">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-16 text-gray-900">Существующие склады</h2>
          <Suspense fallback={<div className="text-center py-10 text-lg text-gray-600">Загрузка складов...</div>}>
            <CrewsListSimplified />
          </Suspense>
        </div>
      </section>

      {/* Footer (unchanged) */}
      <footer className="bg-gray-900 text-gray-300 py-12 px-4">
        <div className="max-w-6xl mx-auto text-center space-y-6">
          <p className="text-lg">&copy; 2025 Управление складом. Все права защищены.</p>
          <div className="flex flex-wrap justify-center gap-6 text-lg">
            <a href="/privacy" className="hover:text-white transition-colors duration-200">Политика конфиденциальности</a>
            <a href="/terms" className="hover:text-white transition-colors duration-200">Условия использования</a>
            <a href="/support" className="hover:text-white transition-colors duration-200">Поддержка</a>
          </div>
        </div>
      </footer>

      {/* Exit Intent Popup */}
      <ExitIntentPopup />
    </div>
  );
}