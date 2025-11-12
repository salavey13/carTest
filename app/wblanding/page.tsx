"use client";

import { useState, useEffect } from 'react';
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
import { CrewsListSimplified } from "./components/CrewsListSimplified";
import { WarehouseAuditTool } from "./components/WarehouseAuditTool";
import { ExitIntentPopup } from "./components/ExitIntentPopup";
import { FaCarBurst, FaChartLine, FaRocket, FaUsers, FaSpinner, FaFlagCheckered, FaUserPlus } from 'react-icons/fa6';
import Image from 'next/image';

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
    const inviteUrl = `https://t.me/oneBikePlsBot/app?startapp=crew_${createdCrew.slug}_join_crew`;
    const text = `Присоединяйся к нашему складу '${createdCrew.name}' в приложении!`;
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(inviteUrl)}&text=${encodeURIComponent(text)}`;
    window.open(shareUrl, "_blank");
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 font-sans">
      {/* Hero Section */}
      <section className="relative min-h-[70vh] flex items-center justify-center text-white">
        <video className="absolute inset-0 w-full h-full object-cover brightness-50" autoPlay loop muted playsInline
          src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/grok-video-882e5db9-d256-42f2-a77a-da36b230f67e-0.mp4" />
        <div className="relative z-10 text-center px-4 max-w-6xl mx-auto">
          <Image src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/IMG_20250623_004400_844-152720e6-ad84-48d1-b4e7-e0f238b7442b.png"
            alt="Логотип приложения" width={120} height={120}
            className="mx-auto mb-8 rounded-full w-20 h-20 sm:w-24 sm:h-24 md:w-32 md:h-32" />
          <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold mb-6 text-white drop-shadow-2xl leading-tight">
            Складской учет для онлайн-магазинов
          </h1>
          <p className="text-xl md:text-2xl lg:text-3xl mb-8 text-white/90 drop-shadow-lg max-w-4xl mx-auto leading-relaxed">
            Сократите недостачи на 73%, обновляйте остатки одним кликом. Для 2+ магазинов на WB, Ozon, YM с 100+ артикулами.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
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
              {/* Comparison table */}
            </TabsContent>
            <TabsContent value="example">
              {/* Case study */}
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
            {/* Pricing cards */}
          </div>
        </div>
      </section>

      {/* Invite Section */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-6xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-12 text-gray-900">Как начать работу и пригласить команду</h2>
          {/* Instructions */}
        </div>
      </section>

      {/* Enhanced CTA Section */}
      <section className="bg-gradient-to-r from-blue-600 to-blue-800 text-white py-20 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">Оптимизируйте склад уже сегодня</h2>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto bg-white/10 backdrop-blur-md p-8 rounded-2xl space-y-6 shadow-2xl">
            {/* Form */}
          </motion.div>
        </div>
      </section>

      {/* Existing Crews Section */}
      <section className="py-20 px-4 bg-gray-100">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-16 text-gray-900">Существующие склады</h2>
          <CrewsListSimplified />
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-300 py-12 px-4">
        <div className="max-w-6xl mx-auto text-center space-y-6">
          <p className="text-lg">&copy; 2025 Управление складом. Все права защищены.</p>
        </div>
      </footer>

      <ExitIntentPopup />
    </div>
  );
}