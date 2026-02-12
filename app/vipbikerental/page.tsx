"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, useScroll, useTransform } from "framer-motion";
import { FaFacebook, FaInstagram, FaTwitter } from "react-icons/fa6";

import { BikeShowcase } from "@/components/BikeShowcase";
import { VibeContentRenderer } from "@/components/VibeContentRenderer";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const InfoItem = ({ icon, children }: { icon: string; children: React.ReactNode }) => (
  <div className="flex items-start gap-3">
    <VibeContentRenderer content={icon} className="mt-1 flex-shrink-0 text-xl text-accent-text" />
    <p className="text-foreground/90">{children}</p>
  </div>
);

const StepItem = ({ num, title, icon, children }: { num: string; title: string; icon: string; children: React.ReactNode }) => (
  <div className="relative h-full min-w-[300px] snap-center rounded-2xl border border-border/60 bg-card/50 p-6 text-center backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/20">
    <div className="absolute -top-4 left-1/2 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full bg-primary font-orbitron font-bold text-primary-foreground">
      {num}
    </div>
    <VibeContentRenderer content={icon} className="mx-auto my-4 text-4xl text-primary" />
    <h4 className="mb-2 font-orbitron text-lg">{title}</h4>
    <p className="text-sm text-muted-foreground">{children}</p>
  </div>
);

const ServiceCard = ({
  title,
  icon,
  items,
  imageUrl,
  borderColorClass,
}: {
  title: string;
  icon: string;
  items: { icon: string; text: string }[];
  imageUrl?: string;
  borderColorClass?: string;
}) => (
  <Card className={cn("group relative overflow-hidden border bg-black", borderColorClass || "border-border")}>
    {imageUrl && (
      <Image
        src={imageUrl}
        alt={title}
        fill
        className="absolute inset-0 object-cover opacity-40 transition-opacity duration-300 group-hover:opacity-50"
      />
    )}
    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent/10" />
    <div className="relative flex h-full flex-col p-6">
      <CardHeader className="mb-4 p-0">
        <CardTitle className={cn("flex items-center gap-3 text-2xl", borderColorClass?.replace("border-", "text-"))}>
          <VibeContentRenderer content={icon} />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-grow space-y-4 p-0">
        {items.map((item, index) => (
          <InfoItem key={index} icon={item.icon}>
            {item.text}
          </InfoItem>
        ))}
      </CardContent>
    </div>
  </Card>
);

const actionCards = [
  {
    title: "Быстрый старт",
    desc: "Сразу к каталогу — выбирайте байк по стилю и сценарию поездки.",
    href: "/rent-bike",
    cta: "Открыть каталог",
    icon: "::FaMotorcycle::",
  },
  {
    title: "Контроль аренды",
    desc: "Отслеживайте свои текущие и завершенные сделки в центре управления.",
    href: "/rentals",
    cta: "Мои аренды",
    icon: "::FaTicket::",
  },
  {
    title: "Сделка по ID",
    desc: "Уже есть номер аренды? Быстро откройте карточку и продолжайте оформление.",
    href: "/rentals",
    cta: "Найти аренду",
    icon: "::FaMagnifyingGlass::",
  },
];

export default function HomePage() {
  const { scrollYProgress } = useScroll();
  const y = useTransform(scrollYProgress, [0, 1], [0, -100]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground dark">
      <div className="pointer-events-none fixed inset-0 z-[-2] bg-[radial-gradient(circle_at_top,rgba(255,106,0,0.15),transparent_35%),radial-gradient(circle_at_80%_20%,rgba(119,0,255,0.12),transparent_40%)]" />
      <div className="pointer-events-none fixed inset-0 z-[-3] bg-[linear-gradient(to_bottom,rgba(0,0,0,0.35),transparent_30%)]" />

      <section className="relative flex min-h-[760px] items-center justify-center overflow-hidden px-4 pb-14 pt-28 text-white sm:pt-32">
        <div className="absolute inset-0 z-0">
          <video autoPlay muted loop playsInline className="absolute inset-0 h-full w-full object-cover brightness-[0.4] saturate-150">
            <source src="https://videos.pexels.com/video-files/2519660/2519660-hd_1920_1080_25fps.mp4" type="video/mp4" />
            Your browser does not support the video tag.
          </video>
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/65 to-black/45" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(255,106,0,0.30),transparent_45%)]" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.75 }}
          className="relative z-10 mx-auto flex w-full max-w-6xl flex-col items-center text-center"
        >
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/25 bg-black/40 px-4 py-2 text-sm text-white/90 backdrop-blur-sm">
            <VibeContentRenderer content="::FaBolt::" className="text-brand-yellow" />
            <span>VIPBIKE PRO RENTAL EXPERIENCE</span>
          </div>

          <h1 className="bg-gradient-to-r from-brand-red-orange via-brand-yellow to-brand-deep-indigo bg-clip-text font-orbitron text-5xl font-black uppercase leading-none tracking-tight text-transparent text-shadow-neon sm:text-6xl md:text-7xl lg:text-8xl">
            <span className="block drop-shadow-lg">Больше чем аренда.</span>
            <span className="block drop-shadow-lg">Твоя байк-сцена.</span>
          </h1>

          <p className="mx-auto mt-6 max-w-3xl text-base font-light text-white/85 sm:text-lg md:text-xl">
            От импульсной городской поездки до длинного уикенда — VIPBIKE закрывает весь цикл: выбор техники,
            бронь, экип, сопровождение и удобное управление сделкой онлайн.
          </p>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg" variant="accent" className="font-orbitron text-base shadow-lg shadow-accent/30 transition-all hover:scale-105 hover:shadow-accent/60">
              <Link href="/rent-bike">
                <VibeContentRenderer content="::FaMotorcycle className='mr-2':: Выбрать байк" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-white/50 bg-black/20 font-orbitron text-white backdrop-blur-sm hover:bg-white hover:text-black">
              <Link href="/rentals">
                <VibeContentRenderer content="::FaTicket className='mr-2':: Мои аренды" />
              </Link>
            </Button>
          </div>

          <div className="mt-8 grid w-full max-w-4xl grid-cols-2 gap-3 text-left sm:grid-cols-4">
            {[
              "::FaStopwatch:: Бронь за пару минут",
              "::FaShieldHeart:: Экип + ОСАГО",
              "::FaRoute:: Прокат под маршрут",
              "::FaHeadset:: Поддержка 7 дней",
            ].map((chip) => (
              <div key={chip} className="rounded-xl border border-white/20 bg-black/35 px-3 py-2 text-sm text-white/90 backdrop-blur-sm">
                <VibeContentRenderer content={chip} />
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      <motion.section style={{ y }} className="relative">
        <BikeShowcase />
      </motion.section>

      <div className="container mx-auto max-w-7xl space-y-20 px-4 py-16 sm:space-y-24 sm:py-24">
        <section>
          <div className="mb-8 text-center">
            <h2 className="font-orbitron text-3xl sm:text-4xl">Прокат уже умный. Мы сделали его быстрее.</h2>
            <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
              В системе уже есть всё для прозрачной аренды: поиск сделок по ID, статусы, управление ролями арендатора и владельца.
              Ниже — короткий путь к этим возможностям.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {actionCards.map((card) => (
              <Card key={card.title} className="border-border/70 bg-card/60 backdrop-blur-sm transition-all hover:-translate-y-1 hover:border-primary/60 hover:shadow-lg hover:shadow-primary/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <VibeContentRenderer content={card.icon} className="text-primary" />
                    {card.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="mb-5 text-sm text-muted-foreground">{card.desc}</p>
                  <Button asChild variant="outline" className="w-full">
                    <Link href={card.href}>{card.cta}</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <motion.section
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="grid grid-cols-1 items-stretch gap-8 md:grid-cols-2 lg:grid-cols-3"
        >
          <ServiceCard
            title="Требования"
            icon="::FaClipboardList::"
            borderColorClass="border-secondary text-secondary"
            items={[
              { icon: "::FaUserClock::", text: "Возраст от 23 лет" },
              { icon: "::FaIdCard::", text: "Паспорт и В/У категории 'А' (есть скутеры без 'А')" },
              { icon: "::FaAward::", text: "Залог от 20 000 ₽" },
              { icon: "::FaCreditCard::", text: "Оплата любым удобным способом" },
            ]}
          />
          <ServiceCard
            title="Что вы получаете"
            icon="::FaGift::"
            borderColorClass="border-accent text-accent"
            imageUrl="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/81Dts9uMBXZXTKC7PjIbBRRRHYGQx_2TPEKFWvaUwDzzgSQPjxUf4GjAiRaDWIcWgwmeaZQTKppFn5VBS6yZeK7R-38bfc7fb-0d5a-4b62-b7e6-ca83950cb265.jpg"
            items={[
              { icon: "::FaCircleCheck::", text: "Полностью обслуженный и чистый мотоцикл" },
              { icon: "::FaFileSignature::", text: "Открытый полис ОСАГО" },
              { icon: "::FaUserShield::", text: "Полный комплект защитной экипировки" },
              { icon: "::FaTag::", text: "Скидка 10% на первую аренду по промокоду 'ЛЕТО2025'" },
            ]}
          />
          <ServiceCard
            title="Наши услуги"
            icon="::FaWrench::"
            borderColorClass="border-primary text-primary"
            imageUrl="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/IMG_bg-cf31dc2b-291b-440b-953b-6e1b4a838e4e.jpg"
            items={[
              { icon: "::FaTools::", text: "Обслуживание и ремонт вашего мотоцикла" },
              { icon: "::FaGamepad::", text: "Лаунж-зона с кальяном и игровыми приставками" },
              { icon: "::FaMapLocationDot::", text: "Новая удобная локация: Стригинский переулок 13Б" },
              { icon: "::FaBeerMugEmpty::", text: "Место, где можно встретить единомышленников" },
            ]}
          />
        </motion.section>

        <section>
          <h2 className="mb-10 text-center font-orbitron text-4xl">Как это работает</h2>
          <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 lg:grid lg:grid-cols-4 lg:overflow-visible">
            <StepItem num="1" title="Бронь" icon="::FaCalendarCheck::">
              Выберите модель в нашем{" "}
              <Link href="/rent-bike" className="text-accent-text hover:underline">
                каталоге
              </Link>{" "}
              и оформите бронь онлайн.
            </StepItem>
            <StepItem num="2" title="Подтверждение" icon="::FaPaperPlane::">
              Свяжитесь с нами для подтверждения. Возьмите с собой оригиналы документов и залог.
            </StepItem>
            <StepItem num="3" title="Получение" icon="::FaKey::">
              Приезжайте в наш новый дом на Стригинском переулке 13Б, подписываем договор и забираете байк.
            </StepItem>
            <StepItem num="4" title="Возврат и отдых" icon="::FaFlagCheckered::">
              Верните мотоцикл в срок. После поездки можно отдохнуть в нашей лаунж-зоне.
            </StepItem>
          </div>
        </section>

        <motion.section
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="mx-auto max-w-3xl"
        >
          <h2 className="mb-10 text-center font-orbitron text-4xl">Частые вопросы</h2>
          <Accordion type="single" collapsible className="w-full rounded-2xl border border-border/60 bg-card/40 px-4">
            <AccordionItem value="item-1">
              <AccordionTrigger>Можно ли арендовать мотоцикл без категории "А"?</AccordionTrigger>
              <AccordionContent>
                Да! У нас есть парк скутеров, для управления которыми достаточно категории "B" или "M". Для всех остальных мотоциклов категория "А" обязательна.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-2">
              <AccordionTrigger>Что будет, если я попаду в ДТП?</AccordionTrigger>
              <AccordionContent>
                Все мотоциклы застрахованы по ОСАГО. Ваша финансовая ответственность ограничена суммой залога, если нет серьезных нарушений с вашей стороны. Главное — немедленно связаться с нами.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-3">
              <AccordionTrigger>Что входит в стоимость аренды?</AccordionTrigger>
              <AccordionContent>
                В стоимость входит аренда мотоцикла на 24 часа, полис ОСАГО и полный комплект защитной экипировки. Пробег обычно ограничен (например, 300 км/сутки), превышение оплачивается отдельно.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-4">
              <AccordionTrigger>У вас есть свой сервис?</AccordionTrigger>
              <AccordionContent>
                Да, на нашей новой локации работает полноценный сервис. Вы можете пригнать своего верного друга к нам на обслуживание или ремонт.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </motion.section>
      </div>

      <footer className="border-t border-border/50 bg-card py-12 px-4">
        <div className="container mx-auto grid max-w-7xl grid-cols-1 gap-8 md:grid-cols-4">
          <div>
            <h3 className="mb-4 font-orbitron text-xl">VIPBIKE</h3>
            <p className="text-muted-foreground">Лидеры проката мотоциклов в Нижнем Новгороде.</p>
          </div>
          <div>
            <h3 className="mb-4 font-orbitron text-xl">Ссылки</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/rent-bike" className="text-accent-text hover:underline">
                  Каталог
                </Link>
              </li>
              <li>
                <Link href="/rentals" className="text-accent-text hover:underline">
                  Мои аренды
                </Link>
              </li>
              <li>
                <Link href="/vipbikerental" className="text-accent-text hover:underline">
                  VIP bike
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="mb-4 font-orbitron text-xl">Контакты</h3>
            <p className="text-muted-foreground">Стригинский переулок 13Б, Нижний Новгород</p>
            <p className="text-muted-foreground">Тел: +7 (XXX) XXX-XX-XX</p>
            <p className="text-muted-foreground">Email: info@vipbike.ru</p>
          </div>
          <div>
            <h3 className="mb-4 font-orbitron text-xl">Социальные сети</h3>
            <div className="flex space-x-4">
              <a href="#" className="text-accent-text transition-colors hover:text-primary" aria-label="Facebook">
                <FaFacebook size={24} />
              </a>
              <a href="#" className="text-accent-text transition-colors hover:text-primary" aria-label="Instagram">
                <FaInstagram size={24} />
              </a>
              <a href="#" className="text-accent-text transition-colors hover:text-primary" aria-label="Twitter">
                <FaTwitter size={24} />
              </a>
            </div>
          </div>
        </div>
        <div className="container mx-auto mt-8 max-w-7xl text-center text-muted-foreground">© 2025 VIPBIKE. Все права защищены.</div>
      </footer>
    </div>
  );
}
