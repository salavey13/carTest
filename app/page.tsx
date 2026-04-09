"use client";

import React, { useState, useEffect } from "react";
import { motion, useScroll, useSpring } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { 
  Bike, 
  Target, 
  ShoppingBag, 
  ArrowUpRight, 
  User, 
  Settings,
  Zap,
  Activity,
  ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useAppContext } from "@/contexts/AppContext";

const PLACEHOLDER_AVATAR = "/placeholders/cyber-agent-avatar.png";

const quickLinks = [
  {
    title: "VIP Bike Rental",
    href: "/vipbikerental",
    description: "Премиум аренда мотоциклов и инвестиции в мотоиндустрию",
    icon: Bike,
    gradient: "from-amber-500/20 to-orange-500/20",
    borderColor: "border-amber-500/30",
    iconColor: "text-amber-400",
    badge: "Инвестиции"
  },
  {
    title: "WB Landing",
    href: "/wblanding",
    description: "Wildberries аналитика и инструменты для селлеров",
    icon: ShoppingBag,
    gradient: "from-purple-500/20 to-pink-500/20",
    borderColor: "border-purple-500/30",
    iconColor: "text-purple-400",
    badge: "E-com"
  },
  {
    title: "Strikeball",
    href: "/strikeball",
    description: "Тактические мероприятия и страйкбольные игры",
    icon: Target,
    gradient: "from-emerald-500/20 to-cyan-500/20",
    borderColor: "border-emerald-500/30",
    iconColor: "text-emerald-400",
    badge: "Активный отдых"
  }
];

const systemLinks = [
  { title: "Профиль", href: "/profile", icon: User },
  { title: "Настройки", href: "/nexus", icon: Settings },
  { title: "Активность", href: "/selfdev/gamified", icon: Activity },
];

export default function Home() {
  const { user: telegramUser, dbUser, isLoading } = useAppContext();
  const [mounted, setMounted] = useState(false);
  
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const userName = dbUser?.first_name || telegramUser?.first_name || 'Оператор';
  const userAvatar = dbUser?.avatar_url || telegramUser?.photo_url || PLACEHOLDER_AVATAR;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Progress Bar */}
      <motion.div
        className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-purple-500 to-amber-500 origin-left z-50"
        style={{ scaleX }}
      />
      
      {/* Background Effects */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black pointer-events-none" />
      <div className="fixed inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none" />

      <main className="relative z-10 pt-24 pb-32 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-12"
        >
          <div>
            <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-b from-white to-slate-400 bg-clip-text text-transparent">
              Привет, <span className="text-cyan-400">{userName}</span>
            </h1>
            <p className="text-slate-500 mt-1 font-mono text-sm">
              Выберите направление для работы
            </p>
          </div>
          
          <Link href="/profile" className="relative group">
            <div className="absolute inset-0 bg-cyan-500/20 rounded-full blur-lg opacity-0 group-hover:opacity-100 transition-opacity" />
            <Image 
              src={userAvatar} 
              alt={userName} 
              width={56} 
              height={56} 
              className="relative rounded-full border-2 border-slate-700 group-hover:border-cyan-500/50 transition-colors object-cover"
            />
            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-slate-950" />
          </Link>
        </motion.div>

        {/* Main Grid */}
        <div className="grid gap-6 mb-12">
          <motion.h2 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-sm font-semibold uppercase tracking-widest text-slate-500 mb-2"
          >
            Основные проекты
          </motion.h2>
          
          <div className="grid md:grid-cols-3 gap-4">
            {quickLinks.map((link, idx) => (
              <motion.div
                key={link.href}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
              >
                <Link href={link.href}>
                  <Card className={cn(
                    "group relative overflow-hidden border-0 bg-slate-900/60 backdrop-blur-xl transition-all duration-300 hover:scale-[1.02] cursor-pointer h-full",
                    "ring-1 ring-white/10 hover:ring-amber-500/30",
                    "hover:shadow-2xl hover:shadow-amber-500/10"
                  )}>
                    <div className={cn(
                      "absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity",
                      link.gradient
                    )} />
                    
                    <CardContent className="relative p-6 flex flex-col h-full">
                      <div className="flex items-start justify-between mb-4">
                        <div className={cn(
                          "p-3 rounded-xl bg-slate-800 border border-slate-700 group-hover:border-slate-600 transition-colors",
                          link.iconColor
                        )}>
                          <link.icon className="w-6 h-6" />
                        </div>
                        <span className={cn(
                          "px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border",
                          link.borderColor,
                          "bg-slate-950/50 text-slate-400 group-hover:text-white transition-colors"
                        )}>
                          {link.badge}
                        </span>
                      </div>
                      
                      <h3 className="text-xl font-bold text-white mb-2 group-hover:text-amber-400 transition-colors">
                        {link.title}
                      </h3>
                      <p className="text-sm text-slate-400 flex-1">
                        {link.description}
                      </p>
                      
                      <div className="mt-4 flex items-center text-sm font-medium text-slate-500 group-hover:text-amber-400 transition-colors">
                        Перейти 
                        <ArrowUpRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Secondary Links */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-3"
        >
          {systemLinks.map((link) => (
            <Link key={link.href} href={link.href}>
              <Button 
                variant="outline" 
                className="w-full justify-start gap-3 border-slate-800 bg-slate-900/50 text-slate-300 hover:bg-slate-800 hover:text-white hover:border-slate-700"
              >
                <link.icon className="w-4 h-4 text-cyan-500" />
                {link.title}
              </Button>
            </Link>
          ))}
          
          <Link href="/moto-investments">
            <Button 
              variant="outline" 
              className="w-full justify-start gap-3 border-amber-500/20 bg-amber-500/5 text-amber-400 hover:bg-amber-500/10 hover:text-amber-300"
            >
              <Zap className="w-4 h-4" />
              Инвестиции
            </Button>
          </Link>
        </motion.div>

        {/* Quick Stats Strip */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-12 p-4 rounded-xl bg-slate-900/40 border border-white/5 backdrop-blur-sm"
        >
          <div className="flex flex-wrap items-center justify-between gap-4 text-sm">
            <div className="flex items-center gap-2 text-slate-400">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Система активна
            </div>
            <div className="flex gap-6 text-slate-500 font-mono text-xs">
              <span>DB: <span className="text-cyan-400">ONLINE</span></span>
              <span>API: <span className="text-cyan-400">STABLE</span></span>
              <span>VER: <span className="text-amber-400">2.0.1</span></span>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}