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
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-blue-600 to-blue-800 text-white py-16 sm:py-24 px-4 md:py-32 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[url('/grid-pattern.png')] bg-repeat"></div>
        <div className="max-w-6xl mx-auto text-center relative z-10">
          <Image 
            src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/IMG_20250623_004400_844-152720e6-ad84-48d1-b4e7-e0f238b7442b.png"
            alt="Логотип приложения"
            width={169}
            height={169}
            className="mx-auto mb-6 sm:mb-8 rounded-full w-24 h-24 sm:w-32 sm:h-32 md:w-40 md:h-40"
          />
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-bold mb-4 sm:mb-6 leading-tight">Складской учет для онлайн-магазинов</h1>
          <p className="text-base sm:text-xl md:text-2xl mb-8 sm:mb-10 max-w-xl sm:max-w-3xl mx-auto">Сократите недостачи на 73%, обновляйте остатки одним кликом. Для 2+ магазинов на WB, Ozon, YM с 100+ артикулами.</p>
          <Link href="#features">
            <a className="bg-white text-blue-600 px-6 py-3 sm:px-8 sm:py-4 rounded-full font-bold text-base sm:text-lg hover:bg-gray-100 shadow-md transition-all inline-block">Узнать больше</a>
          </Link>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-16 sm:py-20 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center mb-12 sm:mb-16 text-gray-900">Возможности приложения</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 sm:gap-8">
            <div className="bg-gray-50 p-4 sm:p-6 md:p-8 rounded-xl shadow-md hover:shadow-xl transition-shadow duration-300">
              <svg className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-4 sm:mb-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 text-center">Синхронизация с маркетплейсами</h3>
              <p className="text-center text-gray-600 text-sm sm:text-base">Автоматическое обновление остатков на WB, Ozon и Яндекс.Маркет в реальном времени.</p>
            </div>
            <div className="bg-gray-50 p-4 sm:p-6 md:p-8 rounded-xl shadow-md hover:shadow-xl transition-shadow duration-300">
              <svg className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-4 sm:mb-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 text-center">Управление сменами</h3>
              <p className="text-center text-gray-600 text-sm sm:text-base">Контроль работы персонала, чекпоинты и детальная статистика по сменам.</p>
            </div>
            <div className="bg-gray-50 p-4 sm:p-6 md:p-8 rounded-xl shadow-md hover:shadow-xl transition-shadow duration-300">
              <svg className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-4 sm:mb-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 text-center">Мульти-доступ</h3>
              <p className="text-center text-gray-600 text-sm sm:text-base">Управление несколькими складами, ролевой доступ для команды.</p>
            </div>
            <div className="bg-gray-50 p-4 sm:p-6 md:p-8 rounded-xl shadow-md hover:shadow-xl transition-shadow duration-300">
              <svg className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-4 sm:mb-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 text-center">Telegram-интерфейс</h3>
              <p className="text-center text-gray-600 text-sm sm:text-base">Удобный доступ через мессенджер, без установки приложений.</p>
            </div>
            <div className="bg-gray-50 p-4 sm:p-6 md:p-8 rounded-xl shadow-md hover:shadow-xl transition-shadow duration-300">
              <svg className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-4 sm:mb-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 text-center">Визуализация</h3>
              <p className="text-center text-gray-600 text-sm sm:text-base">Интерактивная карта склада с фильтрами по характеристикам товаров.</p>
            </div>
            <div className="bg-gray-50 p-4 sm:p-6 md:p-8 rounded-xl shadow-md hover:shadow-xl transition-shadow duration-300">
              <svg className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-4 sm:mb-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 text-center">Отчеты</h3>
              <p className="text-center text-gray-600 text-sm sm:text-base">Экспорт остатков и смен в удобных форматах, статистика продаж.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="bg-gray-100 py-16 sm:py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center mb-12 sm:mb-16 text-gray-900">Почему наше приложение выгодно</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            <div className="bg-white p-4 sm:p-6 md:p-8 rounded-xl shadow-md">
              <Image 
                src="/placeholder.svg"
                alt="Для владельца бизнеса"
                width={300}
                height={200}
                className="rounded-lg mb-4 mx-auto"
              />
              <h3 className="text-lg sm:text-xl font-bold mb-4 sm:mb-6 text-center text-blue-800">Для владельца</h3>
              <ul className="space-y-3 sm:space-y-4 text-gray-600 text-sm sm:text-base">
                <li className="flex items-start gap-2 sm:gap-3">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Контроль нескольких магазинов
                </li>
                <li className="flex items-start gap-2 sm:gap-3">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Снижение потерь и ошибок
                </li>
                <li className="flex items-start gap-2 sm:gap-3">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Автосинхронизация остатков
                </li>
                <li className="flex items-start gap-2 sm:gap-3">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Мониторинг команды
                </li>
                <li className="flex items-start gap-2 sm:gap-3">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Freemium - старт бесплатно
                </li>
              </ul>
            </div>
            <div className="bg-white p-4 sm:p-6 md:p-8 rounded-xl shadow-md">
              <Image 
                src="/placeholder.svg"
                alt="Для персонала"
                width={300}
                height={200}
                className="rounded-lg mb-4 mx-auto"
              />
              <h3 className="text-lg sm:text-xl font-bold mb-4 sm:mb-6 text-center text-blue-800">Для персонала</h3>
              <ul className="space-y-3 sm:space-y-4 text-gray-600 text-sm sm:text-base">
                <li className="flex items-start gap-2 sm:gap-3">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Простой интерфейс в Telegram
                </li>
                <li className="flex items-start gap-2 sm:gap-3">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Быстрые операции с товарами
                </li>
                <li className="flex items-start gap-2 sm:gap-3">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Игровой режим с наградами
                </li>
                <li className="flex items-start gap-2 sm:gap-3">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Личная статистика и цели
                </li>
              </ul>
            </div>
            <div className="bg-white p-4 sm:p-6 md:p-8 rounded-xl shadow-md">
              <Image 
                src="/placeholder.svg"
                alt="Для администратора"
                width={300}
                height={200}
                className="rounded-lg mb-4 mx-auto"
              />
              <h3 className="text-lg sm:text-xl font-bold mb-4 sm:mb-6 text-center text-blue-800">Для администратора</h3>
              <ul className="space-y-3 sm:space-y-4 text-gray-600 text-sm sm:text-base">
                <li className="flex items-start gap-2 sm:gap-3">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Управление несколькими складами
                </li>
                <li className="flex items-start gap-2 sm:gap-3">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Безопасный доступ для команды
                </li>
                <li className="flex items-start gap-2 sm:gap-3">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Уведомления о заказах (в разработке)
                </li>
                <li className="flex items-start gap-2 sm:gap-3">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Простые отчеты в CSV
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Why Choose Us vs Competitors */}
      <section id="why-us" className="py-16 sm:py-20 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center mb-12 sm:mb-16 text-gray-900">Сравнение с конкурентами</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white border border-gray-200 rounded-lg shadow-md table-auto text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-2 py-2 text-left font-bold text-gray-700">Аспект</th>
                  <th className="px-2 py-2 text-left font-bold text-gray-700">Наше</th>
                  <th className="px-2 py-2 text-left font-bold text-gray-700">YClients</th>
                  <th className="px-2 py-2 text-left font-bold text-gray-700">МойСклад</th>
                  <th className="px-2 py-2 text-left font-bold text-gray-700">TOPSELLER</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t">
                  <td className="px-2 py-2 font-medium">Ценообразование</td>
                  <td className="px-2 py-2">Freemium, % от экономии</td>
                  <td className="px-2 py-2">От 900 руб/мес</td>
                  <td className="px-2 py-2">От 1490 руб/мес</td>
                  <td className="px-2 py-2">От 990 руб/мес</td>
                </tr>
                <tr className="border-t">
                  <td className="px-2 py-2 font-medium">Фокус</td>
                  <td className="px-2 py-2">Склад для e-com</td>
                  <td className="px-2 py-2">CRM для услуг</td>
                  <td className="px-2 py-2">Общий учет</td>
                  <td className="px-2 py-2">Продажи на MP</td>
                </tr>
                <tr className="border-t">
                  <td className="px-2 py-2 font-medium">Интеграция с MP</td>
                  <td className="px-2 py-2">WB, Ozon, YM</td>
                  <td className="px-2 py-2">Ограниченная</td>
                  <td className="px-2 py-2">WB, Ozon, YM +</td>
                  <td className="px-2 py-2">WB, Ozon, YM</td>
                </tr>
                <tr className="border-t">
                  <td className="px-2 py-2 font-medium">Мобильность</td>
                  <td className="px-2 py-2">Telegram-бот</td>
                  <td className="px-2 py-2">Веб/моб. app</td>
                  <td className="px-2 py-2">Веб/моб. app</td>
                  <td className="px-2 py-2">Облако</td>
                </tr>
                <tr className="border-t">
                  <td className="px-2 py-2 font-medium">Gamification</td>
                  <td className="px-2 py-2">Да</td>
                  <td className="px-2 py-2">Нет</td>
                  <td className="px-2 py-2">Нет</td>
                  <td className="px-2 py-2">Нет</td>
                </tr>
                <tr className="border-t">
                  <td className="px-2 py-2 font-medium">Управление сменами</td>
                  <td className="px-2 py-2">Да</td>
                  <td className="px-2 py-2">Для услуг</td>
                  <td className="px-2 py-2">Базовое</td>
                  <td className="px-2 py-2">Нет</td>
                </tr>
                <tr className="border-t">
                  <td className="px-2 py-2 font-medium">Визуализация склада</td>
                  <td className="px-2 py-2">Карта + фильтры</td>
                  <td className="px-2 py-2">Базовая</td>
                  <td className="px-2 py-2">Таблицы</td>
                  <td className="px-2 py-2">Дашборды</td>
                </tr>
                <tr className="border-t">
                  <td className="px-2 py-2 font-medium">Отчеты</td>
                  <td className="px-2 py-2">CSV, статистика</td>
                  <td className="px-2 py-2">Для услуг</td>
                  <td className="px-2 py-2">Расширенные</td>
                  <td className="px-2 py-2">Аналитика MP</td>
                </tr>
                <tr className="border-t">
                  <td className="px-2 py-2 font-medium">Обучение</td>
                  <td className="px-2 py-2">Минимальное</td>
                  <td className="px-2 py-2">Требуется</td>
                  <td className="px-2 py-2">Среднее</td>
                  <td className="px-2 py-2">Среднее</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-8 text-center text-gray-600 max-w-3xl mx-auto text-sm sm:text-base">Наше приложение - специализированное решение для складов онлайн-магазинов. Оно проще, дешевле и эффективнее для малого/среднего e-com, где ключ - быстрый учет и снижение ошибок.</p>
        </div>
      </section>

      {/* Real Example Section */}
      <section className="bg-gray-100 py-16 sm:py-20 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-12 sm:mb-16 text-gray-900">Реальный кейс: Склад одеял</h2>
          <p className="text-base sm:text-lg mb-10 sm:mb-12 max-w-xl sm:max-w-3xl mx-auto">Мы тестировали приложение на складе с одеялами: 4 размера, 2 сезона, 8 узоров - 64 артикула, >500 единиц. Работало стабильно на бесплатном Supabase.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8 max-w-xl sm:max-w-4xl mx-auto">
            <div className="bg-white p-6 sm:p-8 rounded-xl shadow-md">
              <h3 className="text-lg sm:text-xl font-bold mb-4 sm:mb-6 text-blue-800">До приложения</h3>
              <ul className="space-y-3 sm:space-y-4 text-left text-gray-600 text-sm sm:text-base">
                <li>Обновление остатков - полдня работы</li>
                <li>Штрафы за ошибки - 30+ тыс. руб/мес</li>
              </ul>
            </div>
            <div className="bg-white p-6 sm:p-8 rounded-xl shadow-md">
              <h3 className="text-lg sm:text-xl font-bold mb-4 sm:mb-6 text-blue-800">После</h3>
              <ul className="space-y-3 sm:space-y-4 text-left text-gray-600 text-sm sm:text-base">
                <li>Обновление - 1 клик</li>
                <li>Штрафы - 8 тыс. руб/мес (снижение на 73%)</li>
              </ul>
            </div>
          </div>
          <p className="mt-10 sm:mt-12 text-base sm:text-lg font-semibold text-blue-800 max-w-xl mx-auto">Мы предлагаем использование за 50% от вашей экономии на штрафах - рассчитаем индивидуально!</p>
        </div>
      </section>

      {/* Invite Section */}
      <section className="py-16 sm:py-20 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-12 sm:mb-16 text-gray-900">Как начать работу и пригласить команду</h2>
          <div className="max-w-xl sm:max-w-3xl mx-auto text-left space-y-6 text-base sm:text-lg text-gray-600">
            <ol className="list-decimal pl-6 space-y-4 sm:space-y-6">
              <li>Откройте приложение в Telegram и авторизуйтесь.</li>
              <li>Перейдите в раздел "Экипажи" и создайте новый экипаж (кнопка "+").</li>
              <li>Поделитесь ссылкой приглашения: t.me/[ваш-бот]?start=crew_[ваш-slug]_join_crew</li>
              <li>Сотрудник перейдет по ссылке и подаст заявку.</li>
              <li>Подтвердите заявку в карточке экипажа.</li>
              <li>Назначьте роли и предоставьте доступ к складу.</li>
            </ol>
            <p className="text-center font-semibold mt-8 sm:mt-12">Экипаж - это ваш склад. Приглашайте команду для совместной работы!</p>
          </div>
        </div>
      </section>

      {/* CTA Section with Form */}
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