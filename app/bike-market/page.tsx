"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BadgeCheck,
  CreditCard,
  FileCheck2,
  FileText,
  ImagePlus,
  MessagesSquare,
  PlayCircle,
  Search,
  ShieldCheck,
  Star,
  Store,
  UploadCloud,
  Wallet,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

const highlights = [
  "Новые и Б/У мотоциклы в одном каталоге",
  "Синхронизация объявлений с Avito",
  "Видеообзоры VIP Bike прямо в карточке",
  "Документы, отчёты и безопасная сделка за 500₽",
];

const valueProps = [
  {
    icon: ShieldCheck,
    title: "Проверенные байки",
    text: "VIN, сервисная история, отчёт по ДТП, юридическая чистота и ручная модерация перед публикацией.",
  },
  {
    icon: PlayCircle,
    title: "Видеообзоры",
    text: "Каждое топ-объявление можно усилить роликом от VIP Bike: звук мотора, состояние пластика, посадка и тест-драйв.",
  },
  {
    icon: MessagesSquare,
    title: "Сделка внутри приложения",
    text: "Личный кабинет, чат покупателя с продавцом, бронь байка и сценарий безопасной оплаты без лишних переходов.",
  },
  {
    icon: CreditCard,
    title: "Монетизация 500₽",
    text: "Демо-экран оплаты открывает полный доступ к документам, отчётам, видео и расширенному описанию мотоцикла.",
  },
];

const sellerSteps = [
  {
    step: "01",
    title: "Создать объявление",
    text: "Заполнить бренд, модель, год, пробег, цену, VIN, характеристики, фото и базовое описание состояния.",
  },
  {
    step: "02",
    title: "Подтянуть Avito",
    text: "Импортировать существующее объявление по ссылке или ID, чтобы не дублировать контент и быстрее стартовать продажу.",
  },
  {
    step: "03",
    title: "Прикрепить медиа и документы",
    text: "Загрузить обзорное видео, ПТС, сервисную книжку, чеки по ТО, экспертизы и дополнительные фото деталей.",
  },
  {
    step: "04",
    title: "Принять лидов",
    text: "Получать сообщения, заявки на покупку, запросы на кредит и согласовывать сделку внутри платформы.",
  },
];

const reviews = [
  {
    author: "Илья, Нижний Новгород",
    score: "4.9/5",
    text: "Сначала посмотрел видеообзор, потом купил доступ к полному пакету за 500₽ — документы и отчёт реально сняли тревогу.",
  },
  {
    author: "Марина, Казань",
    score: "5.0/5",
    text: "Сценарий для продавца очень удобный: загрузила фото, сервисную книжку и сразу получила заявки в личный кабинет.",
  },
  {
    author: "Роман, Москва",
    score: "4.8/5",
    text: "Понравилось, что видно рейтинг продавца, историю обслуживания и помощь с постановкой на учёт в одном месте.",
  },
];

const dealerStats = [
  { label: "Активных объявлений", value: "148" },
  { label: "Средний рейтинг", value: "4.9" },
  { label: "Сделок с отчётом", value: "92%" },
  { label: "Время до ответа", value: "7 мин" },
];

const featuredBikes = [
  {
    name: "Ducati Monster+ 937",
    price: "1 340 000 ₽",
    meta: "2023 • 4 100 км • новый обзор VIP Bike",
    tag: "Проверен",
  },
  {
    name: "BMW R nineT Pure",
    price: "1 090 000 ₽",
    meta: "2021 • 8 700 км • полная сервисная история",
    tag: "Neo-retro",
  },
  {
    name: "Yamaha MT-09",
    price: "980 000 ₽",
    meta: "2022 • 6 300 км • Avito Sync активен",
    tag: "Hot lead",
  },
];

export default function BikeMarketPage() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(255,178,0,0.12),transparent_28%),linear-gradient(180deg,#05070b_0%,#090d14_38%,#0d111a_100%)] text-white">
      <section className="container mx-auto px-4 pb-14 pt-28 sm:px-6 sm:pt-32">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center"
        >
          <div>
            <Badge className="mb-4 border-yellow-400/30 bg-yellow-400/10 text-yellow-200 hover:bg-yellow-400/10">
              VIP BIKE MARKETPLACE
            </Badge>
            <h1 className="max-w-3xl text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">
              Новая вкладка для продажи и покупки мотоциклов — новых и Б/У.
            </h1>
            <p className="mt-5 max-w-2xl text-base text-white/70 sm:text-lg">
              Сервис собирает объявления, видеообзоры, документы, безопасную сделку и платный доступ к полному досье в
              один понятный поток. Пользователь может продавать, импортировать объявления из Avito и покупать байк без
              хаоса.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild size="lg" className="bg-yellow-400 text-black hover:bg-yellow-300">
                <a href="#create-listing">
                  Создать объявление <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-white/20 bg-white/5 hover:bg-white/10">
                <a href="#paid-access">Посмотреть paywall 500₽</a>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-cyan-400/30 bg-cyan-400/5 text-cyan-100 hover:bg-cyan-400/10">
                <Link href="/">Вернуться на главную</Link>
              </Button>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {highlights.map((item) => (
                <div key={item} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80 backdrop-blur">
                  {item}
                </div>
              ))}
            </div>
          </div>

          <Card className="border-white/10 bg-white/5 backdrop-blur-xl">
            <CardHeader>
              <CardDescription className="text-zinc-400">Главный сценарий платформы</CardDescription>
              <CardTitle className="text-2xl text-white">Что уже показывает экран нового раздела</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2">
                {dealerStats.map((stat) => (
                  <div key={stat.label} className="rounded-2xl border border-white/10 bg-black/30 p-4">
                    <div className="text-2xl font-bold text-yellow-300">{stat.value}</div>
                    <div className="mt-1 text-sm text-white/60">{stat.label}</div>
                  </div>
                ))}
              </div>

              <div className="rounded-3xl border border-cyan-400/20 bg-cyan-400/10 p-5">
                <div className="flex items-center gap-2 text-cyan-100">
                  <Store className="h-5 w-5" />
                  <span className="font-semibold">Avito Sync + VIP Bike Review</span>
                </div>
                <p className="mt-3 text-sm text-cyan-50/80">
                  Импортируй объявление, обогати его видео, документами и безопасной оплатой — и преврати обычную
                  карточку в premium lead machine.
                </p>
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between text-xs text-cyan-50/70">
                    <span>Готовность карточки к публикации</span>
                    <span>87%</span>
                  </div>
                  <Progress value={87} className="h-2 bg-white/10" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </section>

      <section className="container mx-auto grid gap-4 px-4 pb-8 sm:px-6 md:grid-cols-2 xl:grid-cols-4">
        {valueProps.map((item, index) => {
          const Icon = item.icon;
          return (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.08 * index }}
            >
              <Card className="h-full border-white/10 bg-white/[0.04] backdrop-blur">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3 text-white">
                    <Icon className="h-5 w-5 text-yellow-300" />
                    {item.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-6 text-white/65">{item.text}</p>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </section>

      <section id="create-listing" className="container mx-auto px-4 py-10 sm:px-6">
        <Tabs defaultValue="listing" className="space-y-6">
          <TabsList className="grid h-auto w-full grid-cols-2 rounded-2xl bg-white/5 p-1 md:grid-cols-4">
            <TabsTrigger value="listing">Объявление</TabsTrigger>
            <TabsTrigger value="avito">Avito</TabsTrigger>
            <TabsTrigger value="deal">Безопасная сделка</TabsTrigger>
            <TabsTrigger value="cabinet">Личный кабинет</TabsTrigger>
          </TabsList>

          <TabsContent value="listing" className="grid gap-6 lg:grid-cols-[1fr_0.95fr]">
            <Card className="border-white/10 bg-white/[0.04]">
              <CardHeader>
                <CardTitle className="text-white">Форма создания объявления</CardTitle>
                <CardDescription className="text-white/60">
                  Демонстрация структуры для новых и Б/У байков: характеристики, цена, фото, видео и документы.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="brand">Бренд и модель</Label>
                  <Input id="brand" defaultValue="BMW S 1000 RR" className="border-white/10 bg-black/30" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="price">Стоимость</Label>
                  <Input id="price" defaultValue="1 850 000 ₽" className="border-white/10 bg-black/30" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="year">Год / пробег</Label>
                  <Input id="year" defaultValue="2024 / 1 900 км" className="border-white/10 bg-black/30" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vin">VIN / состояние</Label>
                  <Input id="vin" defaultValue="WB10D... / без ДТП" className="border-white/10 bg-black/30" />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="description">Описание</Label>
                  <Textarea
                    id="description"
                    className="min-h-[120px] border-white/10 bg-black/30"
                    defaultValue="Один владелец, сервис у дилера, новая резина, полный комплект ключей, подготовлен к сезону."
                  />
                </div>
                <div className="rounded-2xl border border-dashed border-white/15 bg-black/20 p-4 sm:col-span-2">
                  <div className="flex flex-wrap items-center gap-3 text-sm text-white/70">
                    <ImagePlus className="h-4 w-4 text-yellow-300" />
                    Фото мотоцикла
                    <UploadCloud className="ml-4 h-4 w-4 text-cyan-300" />
                    Видеообзор VIP Bike
                    <FileText className="ml-4 h-4 w-4 text-emerald-300" />
                    ПТС / сервисная книжка / отчёты
                  </div>
                </div>
                <Button className="sm:col-span-2 bg-yellow-400 text-black hover:bg-yellow-300">Сохранить объявление</Button>
              </CardContent>
            </Card>

            <div className="space-y-4">
              {sellerSteps.map((item) => (
                <Card key={item.step} className="border-white/10 bg-white/[0.04]">
                  <CardContent className="flex gap-4 p-5">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-yellow-400 font-bold text-black">
                      {item.step}
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">{item.title}</h3>
                      <p className="mt-1 text-sm leading-6 text-white/65">{item.text}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="avito">
            <Card className="border-white/10 bg-white/[0.04]">
              <CardHeader>
                <CardTitle className="text-white">Интеграция с Avito</CardTitle>
                <CardDescription className="text-white/60">
                  UI для импорта объявления по ссылке/ID и последующего обогащения его контентом внутри приложения.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="avito-link">Ссылка или ID объявления</Label>
                    <div className="flex gap-2">
                      <Input id="avito-link" defaultValue="https://www.avito.ru/.../ducati_monster_937" className="border-white/10 bg-black/30" />
                      <Button className="shrink-0 bg-cyan-400 text-black hover:bg-cyan-300">
                        <Search className="mr-2 h-4 w-4" /> Импорт
                      </Button>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                      <div className="text-sm font-semibold text-white">Подтянуть поля</div>
                      <p className="mt-2 text-sm text-white/60">Название, цена, описание, фото, город, пробег, продавец.</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                      <div className="text-sm font-semibold text-white">Обогатить карточку</div>
                      <p className="mt-2 text-sm text-white/60">Добавить видео VIP Bike, документы и premium paywall.</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl border border-yellow-400/20 bg-yellow-400/10 p-5">
                  <div className="flex items-center gap-2 text-yellow-100">
                    <BadgeCheck className="h-5 w-5" />
                    <span className="font-semibold">Flow интеграции</span>
                  </div>
                  <ul className="mt-4 space-y-3 text-sm text-yellow-50/80">
                    <li>1. Пользователь вставляет ссылку или ID объявления.</li>
                    <li>2. Сервис подтягивает карточку с Avito API / parser layer.</li>
                    <li>3. Продавец добавляет missing-поля, видео и документы.</li>
                    <li>4. Объявление публикуется в нашем каталоге с richer UX.</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="deal">
            <div className="grid gap-6 lg:grid-cols-2">
              <Card id="paid-access" className="border-white/10 bg-white/[0.04]">
                <CardHeader>
                  <CardTitle className="text-white">Платный доступ к полному объявлению — 500₽</CardTitle>
                  <CardDescription className="text-white/60">
                    Демо-блок покупки: после оплаты открываются детальное описание, видео, документы и отчёты.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-3xl border border-emerald-400/20 bg-emerald-400/10 p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm uppercase tracking-[0.25em] text-emerald-200/70">Sandbox checkout</p>
                        <h3 className="mt-2 text-3xl font-bold text-white">500 ₽</h3>
                      </div>
                      <Wallet className="h-8 w-8 text-emerald-200" />
                    </div>
                    <p className="mt-4 text-sm text-white/65">
                      Можно подключить Stripe / ЮKassa в sandbox-режиме и выдавать доступ к protected контенту сразу после успешной оплаты.
                    </p>
                    <Button className="mt-5 w-full bg-emerald-300 text-black hover:bg-emerald-200">Оплатить и открыть полное досье</Button>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-white/10 bg-black/25 p-4 text-sm text-white/70">Полное описание и история владения</div>
                    <div className="rounded-2xl border border-white/10 bg-black/25 p-4 text-sm text-white/70">Видеообзор, сервисные документы и VIN-check</div>
                    <div className="rounded-2xl border border-white/10 bg-black/25 p-4 text-sm text-white/70">Отчёт по авариям, кредиту и постановке на учёт</div>
                    <div className="rounded-2xl border border-white/10 bg-black/25 p-4 text-sm text-white/70">Контакты продавца и безопасная покупка внутри кабинета</div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-white/10 bg-white/[0.04]">
                <CardHeader>
                  <CardTitle className="text-white">Преимущества безопасной сделки</CardTitle>
                  <CardDescription className="text-white/60">
                    Отдельный смысловой блок прямо на странице мотоцикла, чтобы объяснить доверие и ценность доступа.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {[
                    "Полный отчёт по байку: VIN, сервисная история, аварии, владельцы и пробег.",
                    "Проверка документов и юридической чистоты перед выдачей полного доступа покупателю.",
                    "Помощь с кредитом, страховкой, доставкой и постановкой на учёт.",
                    "Поддержка сделки командой VIP Bike и фиксация этапов внутри кабинета.",
                  ].map((item) => (
                    <div key={item} className="flex gap-3 rounded-2xl border border-white/10 bg-black/20 p-4">
                      <FileCheck2 className="mt-0.5 h-5 w-5 shrink-0 text-yellow-300" />
                      <p className="text-sm leading-6 text-white/70">{item}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="cabinet">
            <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
              <Card className="border-white/10 bg-white/[0.04]">
                <CardHeader>
                  <CardTitle className="text-white">Покупка через приложение</CardTitle>
                  <CardDescription className="text-white/60">
                    Форма связи с продавцом + зачаток кабинета со статусами диалога и сделки.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="buyer-name">Ваше имя</Label>
                    <Input id="buyer-name" defaultValue="Алексей" className="border-white/10 bg-black/30" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="buyer-phone">Телефон / Telegram</Label>
                    <Input id="buyer-phone" defaultValue="+7 999 123-45-67" className="border-white/10 bg-black/30" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="buyer-message">Сообщение продавцу</Label>
                    <Textarea id="buyer-message" className="min-h-[120px] border-white/10 bg-black/30" defaultValue="Хочу забронировать байк и обсудить кредит/доставку. Когда можно созвониться?" />
                  </div>
                  <Button className="w-full bg-yellow-400 text-black hover:bg-yellow-300">Отправить заявку на покупку</Button>
                </CardContent>
              </Card>

              <Card className="border-white/10 bg-white/[0.04]">
                <CardHeader>
                  <CardTitle className="text-white">Отзывы и рейтинг продавца/байка</CardTitle>
                  <CardDescription className="text-white/60">
                    Социальное доказательство для лучшего пользовательского опыта и мобильной конверсии.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-3">
                    {reviews.map((review) => (
                      <div key={review.author} className="rounded-2xl border border-white/10 bg-black/20 p-4 sm:col-span-1">
                        <div className="flex items-center gap-2 text-yellow-300">
                          <Star className="h-4 w-4 fill-current" />
                          <span className="font-semibold">{review.score}</span>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-white/70">{review.text}</p>
                        <p className="mt-4 text-xs uppercase tracking-[0.2em] text-white/40">{review.author}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </section>

      <section className="container mx-auto px-4 pb-20 pt-8 sm:px-6">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-white/40">Featured bikes</p>
            <h2 className="mt-2 text-3xl font-bold">Примеры карточек для витрины</h2>
          </div>
          <Button asChild variant="outline" className="border-white/15 bg-white/5 hover:bg-white/10">
            <Link href="/franchize/vip-bike">Открыть текущий каталог VIP Bike</Link>
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {featuredBikes.map((bike) => (
            <Card key={bike.name} className="border-white/10 bg-white/[0.04]">
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="outline" className="border-yellow-400/30 text-yellow-200">{bike.tag}</Badge>
                  <span className="text-sm text-white/45">Видео + документы</span>
                </div>
                <CardTitle className="text-xl text-white">{bike.name}</CardTitle>
                <CardDescription className="text-white/55">{bike.meta}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-300">{bike.price}</div>
                <p className="mt-3 text-sm text-white/65">
                  Карточка рассчитана на mobile-first просмотр: короткие статусы, paywall CTA и быстрый вход в чат с продавцом.
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
