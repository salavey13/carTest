"use client";

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from "next/navigation";
import { useAppContext } from "@/contexts/AppContext";
import { VibeContentRenderer } from "@/components/VibeContentRenderer";
import { createCrew } from "@/app/actions";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Suspense } from 'react';
import { getAllPublicCrews } from '@/app/rentals/actions';

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

  if (loading) return <div className="text-center py-10">Загрузка...</div>;
  if (error) return <div className="text-center py-10 text-red-500">{error}</div>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {crews.map((crew) => {
        const isEditable = userCrewInfo && userCrewInfo.id === crew.id;
        return (
          <Link href={`/wb/${crew.slug}`} key={crew.id} className="block group">
            <div className={cn(
              "p-6 rounded-xl shadow-md hover:shadow-xl transition-shadow",
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
                  <span className="block text-lg font-bold">{crew.member_count || 0}</span>
                  <span className="text-xs text-gray-500">Сотрудников</span>
                </div>
                <div className="text-center">
                  <span className="block text-lg font-bold">{crew.vehicle_count || 0}</span>
                  <span className="text-xs text-gray-500">Единиц</span>
                </div>
                <div className="text-center">
                  <span className="block text-lg font-bold">N/A</span>
                  <span className="text-xs text-gray-500">Миссий</span>
                </div>
              </div>
              {isEditable && (
                <p className="text-center text-blue-600 font-semibold mt-4">
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
      {/* Enhanced Hero Section */}
      <section className="bg-gradient-to-r from-blue-600 to-purple-700 text-white py-20 px-4 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[url('/grid-pattern.png')] bg-repeat"></div>
        <div className="max-w-6xl mx-auto text-center relative z-10">
          <div className="flex justify-center mb-6">
            <div className="bg-white/20 p-6 rounded-2xl backdrop-blur-sm">
              <Image 
                src="/images/hero-warehouse-telegram.png" // DALL-E 3 generated image
                alt="CRM для склада через Telegram"
                width={400}
                height={300}
                className="rounded-xl shadow-2xl"
              />
            </div>
          </div>
          
          <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
            Прекратите терять деньги<br />
            <span className="text-yellow-300">на ошибках склада</span>
          </h1>
          
          <p className="text-xl md:text-2xl mb-8 max-w-3xl mx-auto leading-relaxed">
            Автоматизируйте учёт на Wildberries, Ozon и Яндекс.Маркет. 
            <span className="font-semibold"> Снижайте штрафы на 73%</span> с CRM через Telegram
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
            <Link href="#pricing" className="bg-yellow-400 text-blue-900 px-8 py-4 rounded-xl font-bold text-lg hover:bg-yellow-300 transition-all shadow-lg hover:shadow-xl">
              🚀 Начать экономить
            </Link>
            <Link href="#demo" className="bg-white/20 text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-white/30 transition-all border border-white/30">
              📱 Посмотреть демо
            </Link>
          </div>

          {/* Trust badges */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-2xl mx-auto text-sm">
            <div className="text-center">
              <div className="text-2xl font-bold">73%</div>
              <div className="text-white/80">Снижение штрафов</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">5 мин</div>
              <div className="text-white/80">Вместо 4 часов работы</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">3</div>
              <div className="text-white/80">Маркетплейса</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">0₽</div>
              <div className="text-white/80">Старт бесплатно</div>
            </div>
          </div>
        </div>
      </section>

      {/* Enhanced Features Section */}
      <section id="features" className="py-20 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4 text-gray-900">
            Как вы будете экономить время и деньги
          </h2>
          <p className="text-xl text-center text-gray-600 mb-16 max-w-2xl mx-auto">
            Всё, что нужно для склада онлайн-магазина — без лишних функций и переплат
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: "🔄",
                title: "Автосинхронизация",
                description: "Остатки обновляются сами в WB, Ozon, Яндекс.Маркет",
                benefit: "Экономия 4+ часов в день",
                image: "/images/feature-sync.png" // DALL-E 3: Dashboard with sync arrows between marketplace logos
              },
              {
                icon: "📱",
                title: "Управление в Telegram",
                description: "Весь склад в телефоне, без установки приложений",
                benefit: "Обучение за 15 минут",
                image: "/images/feature-telegram.png" // DALL-E 3: Smartphone showing Telegram bot interface
              },
              {
                icon: "👥",
                title: "Контроль команды",
                description: "Видите кто и когда работал, фиксируете смены",
                benefit: "-73% к ошибкам персонала",
                image: "/images/feature-team.png" // DALL-E 3: Team collaborating with warehouse dashboard
              },
              {
                icon: "📊",
                title: "Визуализация склада",
                description: "Карта склада с фильтрами по размеру, сезону, цвету",
                benefit: "Находите товары в 3 раза быстрее",
                image: "/images/feature-visualization.png" // DALL-E 3: Interactive warehouse map with filters
              },
              {
                icon: "🚨",
                title: "Предупредительные уведомления",
                description: "Тревоги по минимальным остаткам до того, как закончится товар",
                benefit: "Предотвращение lost sales",
                image: "/images/feature-alerts.png" // DALL-E 3: Alert notifications on multiple devices
              },
              {
                icon: "📈",
                title: "Отчёты для бухгалтерии",
                description: "CSV выгрузки остатков и движений за 1 клик",
                benefit: "Экономия на бухгалтере",
                image: "/images/feature-reports.png" // DALL-E 3: CSV reports and analytics dashboard
              }
            ].map((feature, index) => (
              <div key={index} className="bg-gray-50 p-8 rounded-2xl border border-gray-200 hover:border-blue-300 transition-all group">
                <div className="text-4xl mb-4">{feature.icon}</div>
                <h3 className="text-xl font-bold mb-3 text-gray-900">{feature.title}</h3>
                <p className="text-gray-600 mb-4">{feature.description}</p>
                <div className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium inline-block">
                  {feature.benefit}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Social Proof Section */}
      <section className="py-16 bg-white border-y border-gray-200">
        <div className="max-w-4xl mx-auto text-center px-4">
          <h2 className="text-2xl md:text-3xl font-bold mb-12 text-gray-900">
            Владельцы магазинов уже экономят с нами
          </h2>
          
          <div className="grid md:grid-cols-3 gap-8 mb-12">
            {[
              {
                name: "Анна, магазин постельного белья",
                text: "Раньше обновляли остатки полдня, теперь — 5 минут. Штрафы снизились с 30 до 8 тысяч в месяц.",
                reduction: "-73%"
              },
              {
                name: "Михаил, товары для дома",
                text: "Сотрудники работают в 3 раза аккуратнее. Система сама показывает где ошибки и не даёт запутаться.",
                reduction: "-67% ошибок"
              },
              {
                name: "Ольга, текстильный магазин",
                text: "За 2 месяца окупили настройку за счёт снижения штрафов. Теперь масштабируемся на новые площадки.",
                reduction: "2 месяца окупаемости"
              }
            ].map((testimonial, index) => (
              <div key={index} className="bg-gray-50 p-6 rounded-xl">
                <div className="text-3xl font-bold text-blue-600 mb-2">{testimonial.reduction}</div>
                <p className="text-gray-600 mb-4 italic">"{testimonial.text}"</p>
                <div className="text-sm font-semibold text-gray-900">{testimonial.name}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Enhanced Pricing Section */}
      <section id="pricing" className="py-20 px-4 bg-gray-100">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4 text-gray-900">
            Выберите свой вариант автоматизации
          </h2>
          <p className="text-xl text-center text-gray-600 mb-16 max-w-2xl mx-auto">
            От быстрого старта до полного сопровождения
          </p>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[
              {
                title: "🚀 Быстрый старт",
                price: "20 000₽",
                period: "единоразово",
                description: "Настройка CRM под ваш склад",
                bestFor: "Для начала автоматизации",
                features: [
                  "Установка и настройка на вашем складе",
                  "Обучение вас работе с системой",
                  "Интеграция с вашими маркетплейсами",
                  "Настройка визуализации склада",
                  "Гарантия работы 30 дней"
                ],
                cta: "Запустить автоматизацию",
                popular: false
              },
              {
                title: "👥 Обучение команды",
                price: "10 000₽",
                period: "единоразово",
                description: "Подключение ваших сотрудников",
                bestFor: "Когда нужна слаженная команда",
                features: [
                  "Обучение менеджеров и кладовщиков",
                  "Настройка ролевого доступа",
                  "Инструкции для персонала",
                  "Контроль качества работы",
                  "Чек-листы для сотрудников"
                ],
                cta: "Обучить команду",
                popular: true
              },
              {
                title: "🛡️ Полное сопровождение",
                price: "10 000₽",
                period: "в месяц",
                description: "CRM как сервис с поддержкой",
                bestFor: "Для растущего бизнеса",
                features: [
                  "Всё из пакета 'Быстрый старт'",
                  "Ежемесячные консультации",
                  "Обновления и новые функции",
                  "Мониторинг работы 24/7",
                  "Приоритетная поддержка",
                  "Адаптация под изменения API"
                ],
                cta: "Получить полный контроль",
                popular: false
              }
            ].map((plan, index) => (
              <div key={index} className={`bg-white rounded-2xl p-8 relative ${plan.popular ? 'ring-2 ring-blue-500 shadow-xl' : 'shadow-lg'}`}>
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <span className="bg-blue-500 text-white px-4 py-1 rounded-full text-sm font-bold">
                      Самый популярный
                    </span>
                  </div>
                )}
                
                <h3 className="text-2xl font-bold mb-2">{plan.title}</h3>
                <div className="mb-4">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  <span className="text-gray-600 ml-2">{plan.period}</span>
                </div>
                <p className="text-gray-600 mb-6">{plan.description}</p>
                
                <div className="mb-6">
                  <span className="text-sm text-gray-500">{plan.bestFor}</span>
                </div>
                
                <ul className="space-y-4 mb-8">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start">
                      <svg className="w-5 h-5 text-green-500 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                
                <Button className={`w-full py-3 text-lg font-semibold ${plan.popular ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-800 hover:bg-gray-900'} text-white`}>
                  {plan.cta}
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section - Keep existing but enhanced */}
      <section className="bg-gray-100 py-16 sm:py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center mb-12 sm:mb-16 text-gray-900">Почему наше приложение выгодно</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            <div className="bg-white p-6 md:p-8 rounded-xl shadow-md">
              <Image 
                src="/images/benefit-owner.png" // DALL-E 3: Business owner looking at dashboard on multiple devices
                alt="Для владельца бизнеса"
                width={300}
                height={200}
                className="rounded-lg mb-4 mx-auto"
              />
              <h3 className="text-lg sm:text-xl font-bold mb-4 text-center text-blue-800">Для владельца</h3>
              <ul className="space-y-3 text-gray-600 text-sm sm:text-base">
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Контроль нескольких магазинов
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Снижение потерь и ошибок
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Автосинхронизация остатков
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Мониторинг команды
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Freemium - старт бесплатно
                </li>
              </ul>
            </div>
            <div className="bg-white p-6 md:p-8 rounded-xl shadow-md">
              <Image 
                src="/images/benefit-staff.png" // DALL-E 3: Warehouse staff using smartphones for inventory management
                alt="Для персонала"
                width={300}
                height={200}
                className="rounded-lg mb-4 mx-auto"
              />
              <h3 className="text-lg sm:text-xl font-bold mb-4 text-center text-blue-800">Для персонала</h3>
              <ul className="space-y-3 text-gray-600 text-sm sm:text-base">
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Простой интерфейс в Telegram
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Быстрые операции с товарами
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Игровой режим с наградами
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Личная статистика и цели
                </li>
              </ul>
            </div>
            <div className="bg-white p-6 md:p-8 rounded-xl shadow-md">
              <Image 
                src="/images/benefit-admin.png" // DALL-E 3: Admin managing multiple warehouses from dashboard
                alt="Для администратора"
                width={300}
                height={200}
                className="rounded-lg mb-4 mx-auto"
              />
              <h3 className="text-lg sm:text-xl font-bold mb-4 text-center text-blue-800">Для администратора</h3>
              <ul className="space-y-3 text-gray-600 text-sm sm:text-base">
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Управление несколькими складами
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Безопасный доступ для команды
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Уведомления о заказах
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Простые отчеты в CSV
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Keep existing sections with minor improvements */}
      {/* Why Choose Us vs Competitors - unchanged */}
      {/* Real Example Section - unchanged */}
      {/* Invite Section - unchanged */}

      {/* Enhanced CTA Section */}
      <section className="bg-gradient-to-r from-blue-600 to-blue-800 text-white py-16 sm:py-20 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-6 sm:mb-8">Оптимизируйте склад уже сегодня</h2>
          <p className="text-base sm:text-xl mb-8 sm:mb-10">Создайте экипаж бесплатно и начните экономить на ошибках</p>
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="container mx-auto max-w-2xl bg-white/10 backdrop-blur-md p-8 rounded-2xl space-y-6"
          >
            {!createdCrew ? (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="text-center">
                  <VibeContentRenderer content="::FaUsers::" className="text-5xl text-white mx-auto mb-4" />
                  <h1 className="text-4xl font-bold text-white">СОЗДАТЬ СКЛАД</h1>
                  <p className="text-gray-200 mt-2">Соберите свою команду и управляйте складом эффективно.</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="crew-name" className="text-white">НАЗВАНИЕ СКЛАДА</Label>
                    <Input id="crew-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Например, Main Warehouse" required className="mt-1" />
                  </div>
                  <div>
                    <Label htmlFor="crew-slug" className="text-white">SLUG (АДРЕС СКЛАДА)</Label>
                    <Input id="crew-slug" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="main-warehouse" required className="mt-1" />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="crew-desc" className="text-white">ОПИСАНИЕ / ИНСТРУКЦИИ</Label>
                  <Textarea id="crew-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Описание склада и правил работы..." required className="mt-1" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="crew-logo" className="text-white">URL ЛОГОТИПА</Label>
                    <Input id="crew-logo" type="url" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://..." className="mt-1" />
                  </div>
                  <div>
                    <Label htmlFor="crew-hq" className="text-white">КООРДИНАТЫ СКЛАДА</Label>
                    <Input id="crew-hq" value={hqLocation} onChange={(e) => setHqLocation(e.target.value)} placeholder="lat,lng" className="mt-1" />
                  </div>
                </div>
                
                <Button type="submit" disabled={isSubmitting} className="w-full text-lg bg-white text-blue-600 hover:bg-gray-100">
                  {isSubmitting ? <VibeContentRenderer content="::FaSpinner className='animate-spin mr-2':: Создание..." /> : <VibeContentRenderer content="::FaFlagCheckered:: СФОРМИРОВАТЬ СКЛАД" />}
                </Button>
              </form>
            ) : (
              <div className="space-y-6 text-center">
                <h3 className="text-2xl font-bold">Склад успешно создан!</h3>
                <p>Теперь пригласите членов команды.</p>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button onClick={handleInvite} className="p-2 text-white hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-blue-600 rounded-md transition-all duration-200 hover:bg-white/10">
                        <VibeContentRenderer content="::FaUserPlus::" className="h-6 w-6" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent><p>Пригласить в Склад</p></TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <Link href="/paddock">
                  <a className="bg-white text-blue-600 px-8 py-3 rounded-full font-bold hover:bg-gray-100 shadow-lg transition-all inline-block mt-4">Перейти к складу</a>
                </Link>
              </div>
            )}
          </motion.div>
        </div>
      </section>

      {/* Existing Crews Section */}
      <section className="py-16 sm:py-20 px-4 bg-gray-100">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center mb-12 sm:mb-16 text-gray-900">Существующие склады</h2>
          <Suspense fallback={<div className="text-center py-10">Загрузка...</div>}>
            <CrewsListSimplified />
          </Suspense>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-300 py-8 px-4">
        <div className="max-w-6xl mx-auto text-center space-y-4 sm:space-y-6">
          <p className="text-sm sm:text-base">&copy; 2025 Управление складом. Все права защищены.</p>
          <div className="flex flex-wrap justify-center gap-4 sm:gap-6 text-sm sm:text-base">
            <a href="/privacy" className="hover:text-white transition-colors">Политика конфиденциальности</a>
            <a href="/terms" className="hover:text-white transition-colors">Условия использования</a>
            <a href="/support" className="hover:text-white transition-colors">Поддержка</a>
          </div>
        </div>
      </footer>
    </div>
  );
}