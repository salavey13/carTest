import Link from "next/link";
import { ArrowRight, BadgePercent, CalendarClock, CircleDollarSign, FileSignature, HandCoins, MessageCircle, ShieldCheck, TrendingUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const contactLink = "https://t.me/salavey13";
const heroImage = "https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=1600&q=80";

const trustPoints = [
  "Зарабатывай на мотоциклах 20–60% годовых.",
  "Вход от 500 т₽.",
  "Работаем по договору.",
  "Выплата процентов каждый месяц.",
  "Выход из проекта возможен в любое время с уведомлением за 1 месяц.",
  "Формат сотрудничества обсуждается индивидуально.",
];

const modelCards = [
  {
    icon: CircleDollarSign,
    title: "Финансирование под доходность",
    description: "Подходит тем, кто рассматривает участие как инвестицию с понятными условиями и регулярными выплатами.",
  },
  {
    icon: HandCoins,
    title: "Партнёрский формат",
    description: "Подходит тем, кто хочет участвовать в развитии мотопарка или отдельных направлений бизнеса вместе с командой.",
  },
  {
    icon: TrendingUp,
    title: "Индивидуальные условия",
    description: "Формат участия можно обсудить под бюджет, срок размещения средств и ожидаемую модель дохода.",
  },
];

const proofPoints = [
  {
    icon: FileSignature,
    title: "Договорная основа",
    text: "Все основные условия фиксируются в договоре: сумма, срок, порядок выплат, формат участия и правила выхода.",
  },
  {
    icon: CalendarClock,
    title: "Ежемесячные выплаты",
    text: "Проценты выплачиваются ежемесячно в согласованном порядке, который заранее закрепляется в документах.",
  },
  {
    icon: ShieldCheck,
    title: "Понятный подход",
    text: "До старта можно обсудить цель инвестирования, сумму входа и выбрать подходящий вариант сотрудничества.",
  },
  {
    icon: BadgePercent,
    title: "Прямой контакт",
    text: "Если нужно, можно сразу перейти в личный диалог и обсудить детали без лишних шагов и формальностей.",
  },
];

export default function MotoInvestmentsPage() {
  return (
    <main className="min-h-screen bg-[#04070f] text-white">
      <section className="relative isolate overflow-hidden border-b border-white/10">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `linear-gradient(120deg, rgba(2,6,23,0.9), rgba(15,23,42,0.78), rgba(120,53,15,0.55)), url(${heroImage})` }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(251,191,36,0.18),transparent_28%),radial-gradient(circle_at_left,rgba(59,130,246,0.15),transparent_35%)]" />
        <div className="relative mx-auto flex max-w-7xl flex-col gap-8 px-4 py-16 sm:px-6 lg:flex-row lg:items-end lg:px-8 lg:py-24">
          <div className="max-w-3xl space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/25 bg-amber-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-amber-200">
              <BadgePercent className="h-3.5 w-3.5" /> Инвестиции в Мотоиндустрию
            </div>
            <h1 className="text-4xl font-black leading-tight sm:text-5xl lg:text-6xl">
              Любишь мотоциклы? <br className="hidden sm:block" /> Сделай их новым источником дохода.
            </h1>
            <p className="max-w-2xl text-lg text-white/80 sm:text-xl">
              Будем рады тебе в нашей команде. Если тебе интересны инвестиции в мотоиндустрию, можно обсудить подходящий формат участия, ожидаемую доходность и условия сотрудничества.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="bg-amber-400 text-slate-950 hover:bg-amber-300 font-semibold">
                <a href={contactLink} target="_blank" rel="noopener noreferrer">
                  Написать Илье Сидорову <MessageCircle className="ml-2 h-4 w-4" />
                </a>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white">
                <Link href="/">Вернуться на главную <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
            </div>
          </div>

          <Card className="w-full max-w-xl border-white/10 bg-slate-950/55 backdrop-blur-md">
            <CardContent className="grid gap-4 p-6 sm:grid-cols-2">
              {trustPoints.map((point) => (
                <div key={point} className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 text-sm text-white/80">
                  <div className="font-semibold text-white">{point}</div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-8 max-w-3xl">
          <div className="text-sm font-semibold uppercase tracking-[0.22em] text-amber-300">Варианты сотрудничества</div>
          <h2 className="mt-3 text-3xl font-bold">Формат участия можно обсудить под ваши задачи</h2>
          <p className="mt-3 text-white/70">
            Здесь собраны базовые варианты взаимодействия. Финальные условия обсуждаются индивидуально с учётом суммы, срока и желаемой модели участия.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {modelCards.map(({ icon: Icon, title, description }) => (
            <Card key={title} className="border-white/10 bg-white/[0.04]">
              <CardContent className="p-6">
                <Icon className="h-8 w-8 text-amber-300" />
                <h3 className="mt-4 text-xl font-semibold text-white">{title}</h3>
                <p className="mt-2 text-sm text-white/70">{description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-14 sm:px-6 lg:px-8">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {proofPoints.map(({ icon: Icon, title, text }) => (
            <Card key={title} className="border-white/10 bg-[#0b1220]">
              <CardContent className="p-6">
                <Icon className="h-7 w-7 text-amber-300" />
                <h3 className="mt-4 text-lg font-semibold">{title}</h3>
                <p className="mt-2 text-sm text-white/70">{text}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="border-t border-white/10 bg-white/[0.03]">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-12 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div>
            <div className="text-sm font-semibold uppercase tracking-[0.22em] text-amber-300">Хочешь узнать больше?</div>
            <h2 className="mt-2 text-3xl font-bold">Напиши мне, и я расскажу подробнее об условиях участия</h2>
            <p className="mt-2 max-w-3xl text-white/70">
              В чате можно обсудить сумму входа, формат договора, порядок выплат и удобный для вас вариант сотрудничества.
            </p>
          </div>
          <Button asChild size="lg" className="bg-amber-400 text-slate-950 hover:bg-amber-300 font-semibold">
            <a href={contactLink} target="_blank" rel="noopener noreferrer">
              Перейти в чат с Ильёй Сидоровым <MessageCircle className="ml-2 h-4 w-4" />
            </a>
          </Button>
        </div>
      </section>
    </main>
  );
}
