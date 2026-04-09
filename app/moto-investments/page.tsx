"use client";

import React, { useState, useEffect } from "react";
import { motion, useScroll, useSpring } from "framer-motion";
import Link from "next/link";
import { 
  ArrowRight, 
  BadgePercent, 
  CalendarClock, 
  CircleDollarSign, 
  FileSignature, 
  HandCoins, 
  MessageCircle, 
  ShieldCheck, 
  TrendingUp,
  CheckCircle2,
  ArrowUpRight,
  Wallet,
  Clock,
  FileText,
  Users
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const contactLink = "https://t.me/I_O_S_NN";

const trustPoints = [
  { icon: TrendingUp, text: "Зарабатывай на мотоциклах 20–60% годовых" },
  { icon: Wallet, text: "Вход от 500 т₽" },
  { icon: FileText, text: "Работаем по договору" },
  { icon: CalendarClock, text: "Выплата процентов каждый месяц" },
  { icon: Clock, text: "Выход из проекта возможен в любое время с уведомлением за 1 месяц" },
  { icon: Users, text: "Формат сотрудничества обсуждается индивидуально" },
];

const modelCards = [
  {
    icon: CircleDollarSign,
    title: "Финансирование под доходность",
    description: "Подходит тем, кто рассматривает участие как инвестицию с понятными условиями и регулярными выплатами.",
    gradient: "from-amber-500/20 to-orange-500/20",
    borderColor: "border-amber-500/30",
    iconColor: "text-amber-400"
  },
  {
    icon: HandCoins,
    title: "Партнёрский формат",
    description: "Подходит тем, кто хочет участвовать в развитии мотопарка или отдельных направлений бизнеса вместе с командой.",
    gradient: "from-cyan-500/20 to-blue-500/20",
    borderColor: "border-cyan-500/30",
    iconColor: "text-cyan-400"
  },
  {
    icon: TrendingUp,
    title: "Индивидуальные условия",
    description: "Формат участия можно обсудить под бюджет, срок размещения средств и ожидаемую модель дохода.",
    gradient: "from-violet-500/20 to-purple-500/20",
    borderColor: "border-violet-500/30",
    iconColor: "text-violet-400"
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
  const [isMounted, setIsMounted] = useState(false);
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
  });

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) return null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 selection:bg-amber-500/30 selection:text-amber-200">
      {/* Progress Bar */}
      <motion.div
        className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-500 origin-left z-50"
        style={{ scaleX }}
      />
      
      {/* Background Effects */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black pointer-events-none" />
      <div className="fixed inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none" />

      {/* Hero Section */}
      <section className="relative isolate overflow-hidden pt-24 pb-16 md:pt-32 md:pb-24">
        {/* Gradient Background replacing Unsplash image */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-amber-950/30" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(251,191,36,0.15),transparent_50%),radial-gradient(circle_at_bottom_left,rgba(234,179,8,0.1),transparent_50%)]" />
        
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="space-y-8"
            >
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-sm font-medium text-amber-300 backdrop-blur-sm">
                <BadgePercent className="h-4 w-4" />
                <span className="uppercase tracking-wider text-xs">Инвестиции в Мотоиндустрию</span>
              </div>
              
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight bg-gradient-to-b from-white to-slate-400 bg-clip-text text-transparent">
                Любишь мотоциклы? <br />
                <span className="text-amber-400">Сделай их</span> источником дохода.
              </h1>
              
              <p className="text-lg md:text-xl text-slate-400 max-w-2xl leading-relaxed">
                Будем рады тебе в нашей команде. Обсудим подходящий формат участия, ожидаемую доходность и условия сотрудничества.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <Button 
                  asChild 
                  size="lg" 
                  className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold border-0 shadow-lg shadow-amber-500/25 transition-all hover:shadow-amber-500/40"
                >
                  <a href={contactLink} target="_blank" rel="noopener noreferrer" className="gap-2">
                    Написать Илье Сидорову 
                    <MessageCircle className="h-5 w-5" />
                  </a>
                </Button>
                
                <Button 
                  asChild 
                  size="lg" 
                  variant="outline" 
                  className="border-slate-700 bg-slate-900/50 text-slate-300 hover:bg-slate-800 hover:text-white hover:border-slate-600 backdrop-blur-sm"
                >
                  <Link href="/" className="gap-2">
                    На главную 
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </motion.div>

            {/* Trust Points Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <Card className="border-0 bg-slate-900/60 backdrop-blur-xl overflow-hidden shadow-2xl shadow-black/50 ring-1 ring-white/10">
                <CardContent className="p-6 md:p-8">
                  <div className="grid gap-4 sm:grid-cols-2">
                    {trustPoints.map((point, idx) => (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 + idx * 0.1 }}
                        className="flex items-start gap-3 p-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 hover:border-amber-500/30 transition-all group"
                      >
                        <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 group-hover:text-amber-300 group-hover:bg-amber-500/20 transition-colors">
                          <point.icon className="h-4 w-4" />
                        </div>
                        <span className="text-sm text-slate-300 leading-snug">{point.text}</span>
                      </motion.div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Cooperation Models Section */}
      <section className="relative py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-12 max-w-3xl"
          >
            <div className="text-sm font-semibold uppercase tracking-widest text-amber-400 mb-3">
              Варианты сотрудничества
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Формат участия под ваши задачи
            </h2>
            <p className="text-lg text-slate-400">
              Базовые варианты взаимодействия. Финальные условия обсуждаются индивидуально с учётом суммы, срока и желаемой модели участия.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            {modelCards.map((card, idx) => (
              <motion.div
                key={card.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
              >
                <Card className={cn(
                  "h-full border-0 bg-gradient-to-br backdrop-blur-xl transition-all duration-300 hover:scale-[1.02] group cursor-pointer",
                  card.gradient,
                  "bg-opacity-10",
                  "ring-1 ring-white/10 hover:ring-amber-500/30"
                )}>
                  <CardContent className="p-6 md:p-8 flex flex-col h-full relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                      <card.icon className="w-24 h-24" />
                    </div>
                    
                    <div className={cn(
                      "w-14 h-14 rounded-2xl flex items-center justify-center mb-6 transition-transform group-hover:scale-110",
                      "bg-slate-950/50 border",
                      card.borderColor
                    )}>
                      <card.icon className={cn("h-7 w-7", card.iconColor)} />
                    </div>
                    
                    <h3 className="text-xl font-bold text-white mb-3 group-hover:text-amber-400 transition-colors">
                      {card.title}
                    </h3>
                    <p className="text-slate-400 leading-relaxed flex-1">
                      {card.description}
                    </p>
                    
                    <div className="mt-6 flex items-center text-sm font-medium text-slate-500 group-hover:text-amber-400 transition-colors">
                      Подробнее 
                      <ArrowUpRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Proof Points Section */}
      <section className="relative py-16 bg-slate-900/30 border-y border-white/5">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {proofPoints.map((point, idx) => (
              <motion.div
                key={point.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
              >
                <Card className="h-full border-0 bg-slate-950/50 backdrop-blur-sm ring-1 ring-white/10 hover:ring-amber-500/20 transition-all hover:-translate-y-1">
                  <CardContent className="p-6">
                    <div className="p-3 rounded-xl bg-amber-500/10 w-fit mb-4 text-amber-400">
                      <point.icon className="h-6 w-6" />
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2">
                      {point.title}
                    </h3>
                    <p className="text-sm text-slate-400 leading-relaxed">
                      {point.text}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-amber-950/20 via-slate-950 to-orange-950/20" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(251,191,36,0.1),transparent_70%)]" />
        
        <div className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="space-y-6"
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-sm text-amber-300">
              <CheckCircle2 className="h-4 w-4" />
              Хочешь узнать больше?
            </div>
            
            <h2 className="text-3xl md:text-4xl font-bold text-white">
              Напиши мне, и я расскажу подробнее об условиях участия
            </h2>
            
            <p className="text-lg text-slate-400 max-w-2xl mx-auto">
              В чате можно обсудить сумму входа, формат договора, порядок выплат и удобный для вас вариант сотрудничества.
            </p>
            
            <div className="pt-4">
              <Button 
                asChild 
                size="lg" 
                className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold px-8 py-6 text-lg shadow-xl shadow-amber-500/20 hover:shadow-amber-500/40 transition-all hover:-translate-y-0.5"
              >
                <a href={contactLink} target="_blank" rel="noopener noreferrer" className="gap-3">
                  Перейти в чат с Ильёй Сидоровым
                  <MessageCircle className="h-5 w-5" />
                </a>
              </Button>
            </div>
            
            <p className="text-sm text-slate-500 pt-4">
              Обычно отвечаю в течение часа
            </p>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-slate-950 py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center gap-4 text-slate-500 text-sm">
          <p>© 2024 Мото Инвестиции. Все права защищены.</p>
          <Link href="/vipbikerental" className="hover:text-amber-400 transition-colors flex items-center gap-2">
            <ArrowRight className="h-4 w-4 rotate-180" />
            Вернуться на главную
          </Link>
        </div>
      </footer>
    </div>
  );
}