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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
      {/* Hero Section with Video Background */}
      <section className="relative min-h-[60vh] flex items-center justify-center text-white">
        <video
          className="absolute inset-0 w-full h-full object-cover brightness-50"
          autoPlay
          loop
          muted
          playsInline
          src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/grok-video-882e5db9-d256-42f2-a77a-da36b230f67e-0.mp4"
        />
        <div className="relative z-10 text-center px-4">
          <h1 className="text-4xl md:text-6xl font-bold mb-6 text-white drop-shadow-2xl">Автоматизация склада для MP</h1>
          <p className="text-xl md:text-2xl mb-8 text-white/90 drop-shadow-lg">Синхронизация, смены, визуализация. Без лишнего.</p>
          <Link href="#features">
            <a className="bg-white/90 text-blue-600 px-8 py-4 rounded-full font-bold hover:bg-white transition-all shadow-lg">Детали</a>
          </Link>
        </div>
      </section>

      {/* Second Video Section */}
      <section className="py-8 bg-gray-100">
        <hr className="border-gray-300 max-w-4xl mx-auto" />
        <div className="max-w-md mx-auto mt-8">
          <video
            className="w-full h-auto rounded-xl shadow-lg md:max-w-md mx-auto"
            autoPlay
            loop
            muted
            playsInline
          >
            <source src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/grok-video-c73d1434-fe01-4e30-ad74-3799fdce56eb-5-29a2a26b-c256-4dff-9c32-cc00a6847df5.mp4" type="video/mp4" />
          </video>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-16">Что внутри</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-gray-50 p-8 rounded-xl">
              <h3 className="text-xl font-bold mb-4">Синхронизация</h3>
              <p className="text-gray-600">Авто-обновление остатков на WB, Ozon, YM.</p>
            </div>
            <div className="bg-gray-50 p-8 rounded-xl">
              <h3 className="text-xl font-bold mb-4">Смены</h3>
              <p className="text-gray-600">Чекпоинты, статистика по сменам.</p>
            </div>
            <div className="bg-gray-50 p-8 rounded-xl">
              <h3 className="text-xl font-bold mb-4">Доступы</h3>
              <p className="text-gray-600">Роли, несколько складов.</p>
            </div>
            <div className="bg-gray-50 p-8 rounded-xl">
              <h3 className="text-xl font-bold mb-4">Telegram</h3>
              <p className="text-gray-600">Всё в чате, без установки.</p>
            </div>
            <div className="bg-gray-50 p-8 rounded-xl">
              <h3 className="text-xl font-bold mb-4">Карта</h3>
              <p className="text-gray-600">Фильтры по атрибутам товаров.</p>
            </div>
            <div className="bg-gray-50 p-8 rounded-xl">
              <h3 className="text-xl font-bold mb-4">Отчеты</h3>
              <p className="text-gray-600">CSV остатков и смен.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 px-4 bg-gray-100">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-16">Для кого</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-xl">
              <Image 
                src="/placeholder.svg"
                alt="Владелец"
                width={300}
                height={200}
                className="rounded-lg mb-4 mx-auto"
              />
              <h3 className="text-xl font-bold mb-4 text-center">Владельцу</h3>
              <ul className="space-y-2 text-gray-600">
                <li>Много магазинов</li>
                <li>Меньше потерь</li>
                <li>Авто-синх</li>
                <li>Мониторинг</li>
                <li>Бесплатный старт</li>
              </ul>
            </div>
            <div className="bg-white p-8 rounded-xl">
              <Image 
                src="/placeholder.svg"
                alt="Персонал"
                width={300}
                height={200}
                className="rounded-lg mb-4 mx-auto"
              />
              <h3 className="text-xl font-bold mb-4 text-center">Персоналу</h3>
              <ul className="space-y-2 text-gray-600">
                <li>Telegram UI</li>
                <li>Быстрые оп</li>
                <li>Игра + награды</li>
                <li>Статистика</li>
              </ul>
            </div>
            <div className="bg-white p-8 rounded-xl">
              <Image 
                src="/placeholder.svg"
                alt="Админ"
                width={300}
                height={200}
                className="rounded-lg mb-4 mx-auto"
              />
              <h3 className="text-xl font-bold mb-4 text-center">Админу</h3>
              <ul className="space-y-2 text-gray-600">
                <li>Много складов</li>
                <li>Доступы</li>
                <li>Уведомления</li>
                <li>CSV</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Tabs for Optional Sections */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <Tabs defaultValue="none" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="comparison">Сравнение</TabsTrigger>
              <TabsTrigger value="example">Кейс</TabsTrigger>
            </TabsList>
            <TabsContent value="comparison">
              <div className="overflow-x-auto mt-8">
                <table className="min-w-full bg-white border rounded-lg shadow-md text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="p-2">Аспект</th>
                      <th className="p-2">Мы</th>
                      <th className="p-2">YClients</th>
                      <th className="p-2">МойСклад</th>
                      <th className="p-2">TOPSELLER</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="p-2">Цена</td>
                      <td className="p-2">Freemium + %</td>
                      <td className="p-2">900+/мес</td>
                      <td className="p-2">1490+/мес</td>
                      <td className="p-2">990+/мес</td>
                    </tr>
                    <tr>
                      <td className="p-2">Фокус</td>
                      <td className="p-2">e-com склад</td>
                      <td className="p-2">Услуги CRM</td>
                      <td className="p-2">Общий учет</td>
                      <td className="p-2">MP продажи</td>
                    </tr>
                    <tr>
                      <td className="p-2">Интеграция MP</td>
                      <td className="p-2">WB/Ozon/YM</td>
                      <td className="p-2">Ограничено</td>
                      <td className="p-2">WB/Ozon/YM+</td>
                      <td className="p-2">WB/Ozon/YM</td>
                    </tr>
                    <tr>
                      <td className="p-2">Мобильность</td>
                      <td className="p-2">Telegram</td>
                      <td className="p-2">Веб/апп</td>
                      <td className="p-2">Веб/апп</td>
                      <td className="p-2">Облако</td>
                    </tr>
                    <tr>
                      <td className="p-2">Gamification</td>
                      <td className="p-2">Да</td>
                      <td className="p-2">Нет</td>
                      <td className="p-2">Нет</td>
                      <td className="p-2">Нет</td>
                    </tr>
                    <tr>
                      <td className="p-2">Смены</td>
                      <td className="p-2">Да</td>
                      <td className="p-2">Для услуг</td>
                      <td className="p-2">Базовое</td>
                      <td className="p-2">Нет</td>
                    </tr>
                    <tr>
                      <td className="p-2">Визуализация</td>
                      <td className="p-2">Карта+фильтры</td>
                      <td className="p-2">Базовая</td>
                      <td className="p-2">Таблицы</td>
                      <td className="p-2">Дашборды</td>
                    </tr>
                    <tr>
                      <td className="p-2">Отчеты</td>
                      <td className="p-2">CSV, стат</td>
                      <td className="p-2">Для услуг</td>
                      <td className="p-2">Расширенные</td>
                      <td className="p-2">Аналитика MP</td>
                    </tr>
                    <tr>
                      <td className="p-2">Обучение</td>
                      <td className="p-2">Мин</td>
                      <td className="p-2">Требуется</td>
                      <td className="p-2">Среднее</td>
                      <td className="p-2">Среднее</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </TabsContent>
            <TabsContent value="example">
              <div className="grid md:grid-cols-2 gap-8 mt-8">
                <div className="bg-gray-50 p-6 rounded-xl">
                  <h3 className="font-bold mb-4">До</h3>
                  <ul className="space-y-2 text-gray-600">
                    <li>Обновление - полдня</li>
                    <li>Штрафы 30k+</li>
                  </ul>
                </div>
                <div className="bg-gray-50 p-6 rounded-xl">
                  <h3 className="font-bold mb-4">После</h3>
                  <ul className="space-y-2 text-gray-600">
                    <li>Обновление - клик</li>
                    <li>Штрафы 8k (-73%)</li>
                  </ul>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 bg-gray-100 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Подписка</h2>
          <p className="text-center mb-8 text-gray-600">Настройка и менторство бесплатно.</p>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-xl shadow-md">
              <h3 className="text-xl font-bold mb-4">Месяц</h3>
              <p className="text-3xl font-bold mb-6">10 000₽</p>
              <Button className="w-full">Выбрать</Button>
            </div>
            <div className="bg-white p-8 rounded-xl shadow-md ring-2 ring-blue-500">
              <h3 className="text-xl font-bold mb-4">3 месяца</h3>
              <p className="text-3xl font-bold mb-2">25 000₽</p>
              <p className="text-sm text-gray-600 mb-6">~8 333/мес</p>
              <Button className="w-full bg-blue-600">Выбрать</Button>
            </div>
            <div className="bg-white p-8 rounded-xl shadow-md">
              <h3 className="text-xl font-bold mb-4">6 месяцев</h3>
              <p className="text-3xl font-bold mb-2">45 000₽</p>
              <p className="text-sm text-gray-600 mb-6">~7 500/мес</p>
              <Button className="w-full">Выбрать</Button>
            </div>
          </div>
        </div>
      </section>

      {/* Invite */}
      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Как запустить</h2>
          <div className="max-w-2xl mx-auto space-y-4 text-gray-600">
            <ol className="list-decimal pl-4 space-y-2">
              <li>Telegram, авторизация.</li>
              <li>Экипажи → +.</li>
              <li>Ссылка для команды.</li>
              <li>Заявка.</li>
              <li>Подтвердить.</li>
              <li>Роли.</li>
            </ol>
          </div>
        </div>
      </section>

      {/* CTA Form */}
      <section className="bg-gradient-to-r from-blue-600 to-blue-800 text-white py-16 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-12">Начните</h2>
          <p className="mb-8">Бесплатно. Без обязательств.</p>
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="max-w-2xl mx-auto bg-white/10 p-8 rounded-2xl space-y-6"
          >
            {!createdCrew ? (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="text-center">
                  <VibeContentRenderer content="::FaUsers::" className="text-5xl text-white mx-auto mb-4" />
                  <h1 className="text-3xl font-bold text-white mb-2">Создать склад</h1>
                  <p className="text-gray-200">Команда, управление.</p>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="crew-name" className="text-white">Название</Label>
                    <Input id="crew-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Main Warehouse" required />
                  </div>
                  <div>
                    <Label htmlFor="crew-slug" className="text-white">Slug</Label>
                    <Input id="crew-slug" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="main-warehouse" required />
                  </div>
                </div>
                <div>
                  <Label htmlFor="crew-desc" className="text-white">Описание</Label>
                  <Textarea id="crew-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Правила..." required />
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="crew-logo" className="text-white">Лого URL</Label>
                    <Input id="crew-logo" type="url" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://..." />
                  </div>
                  <div>
                    <Label htmlFor="crew-hq" className="text-white">Координаты</Label>
                    <Input id="crew-hq" value={hqLocation} onChange={(e) => setHqLocation(e.target.value)} placeholder="lat,lng" />
                  </div>
                </div>
                <Button type="submit" disabled={isSubmitting} className="w-full bg-white text-blue-600">
                  {isSubmitting ? 'Создание...' : 'Создать'}
                </Button>
              </form>
            ) : (
              <div className="space-y-6 text-center">
                <h3 className="text-2xl font-bold">Готово</h3>
                <p>Пригласите команду.</p>
                <Button onClick={handleInvite} className="bg-white text-blue-600">Пригласить</Button>
                <Link href={`/wb/${createdCrew.slug}`}>
                  <Button variant="ghost" className="text-white">К складу</Button>
                </Link>
              </div>
            )}
          </motion.div>
        </div>
      </section>

      {/* Crews */}
      <section className="py-16 bg-gray-100 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Склады</h2>
          <Suspense fallback={<div>Загрузка...</div>}>
            <CrewsListSimplified />
          </Suspense>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-300 py-8 px-4">
        <div className="max-w-6xl mx-auto text-center space-y-4">
          <p>&copy; 2025. Все права.</p>
          <div className="flex justify-center gap-4">
            <a href="/privacy">Конфиденциальность</a>
            <a href="/terms">Условия</a>
            <a href="/support">Поддержка</a>
          </div>
        </div>
      </footer>
    </div>
  );
}