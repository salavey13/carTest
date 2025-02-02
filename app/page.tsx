"use client"
 import { MapPin, ShoppingCart, Search } from "lucide-react"
import Link from "next/link"
import dynamic from "next/dynamic"
import { useTelegram } from '@/hooks/useTelegram';

const Button = dynamic(() => import("@/components/ui/button").then((mod) => mod.Button), { ssr: false })
const Input = dynamic(() => import("@/components/ui/input").then((mod) => mod.Input), { ssr: false })
const Sheet = dynamic(() => import("@/components/ui/sheet").then((mod) => mod.Sheet), { ssr: false })
const SheetContent = dynamic(() => import("@/components/ui/sheet").then((mod) => mod.SheetContent), { ssr: false })
const SheetHeader = dynamic(() => import("@/components/ui/sheet").then((mod) => mod.SheetHeader), { ssr: false })
const SheetTitle = dynamic(() => import("@/components/ui/sheet").then((mod) => mod.SheetTitle), { ssr: false })
const SheetTrigger = dynamic(() => import("@/components/ui/sheet").then((mod) => mod.SheetTrigger), { ssr: false })
import UserInfo from "@/components/user-info"

export default function Home() {
  const { user } = useTelegram()


  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      <div className="absolute inset-0 opacity-10 pointer-events-none select-none overflow-hidden whitespace-nowrap text-[8px] leading-none binary-background">
        {Array(100).fill("01").join("")}
      </div>
      {/* Шапка */}
      <header className="border-b border-[#00ff9d]/20 bg-black/50 backdrop-blur-sm fixed w-full z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-8">
              {/* Логотип */}
              <Link
                href="/"
                className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#FF6B6B] to-[#4ECDC4] font-mono"
              >
                Ruli<span className="text-[#FFD93D]">Beri</span>
              </Link>

              {/* Выбор местоположения */}
              <button className="flex items-center gap-2 text-sm text-[#00ff9d]">
                <MapPin className="h-4 w-4" />
                <span className="font-mono">ВЫБОР_ЛОКАЦИИ</span>
              </button>
            </div>

            {/* Поиск */}
            <div className="flex-1 max-w-xl px-8">
              <div className="relative">
                <Input
                  type="search"
                  placeholder="ПОИСКОВЫЙ_ЗАПРОС//"
                  className="w-full pl-10 bg-black/30 border-[#00ff9d]/30 text-[#00ff9d] font-mono"
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#00ff9d]" />
              </div>
            </div>

            {/* Действия */}
            <div className="flex items-center gap-4">
              <UserInfo user={user} />
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" className="text-[#00ff9d] hover:text-[#00ffff] relative">
                    <ShoppingCart className="h-5 w-5" />
                    <span className="absolute -top-1 -right-1 bg-[#ff00ff] text-white text-xs rounded-full h-4 w-4 flex items-center justify-center font-mono">
                      0
                    </span>
                  </Button>
                </SheetTrigger>
                <SheetContent className="bg-black/95 border-[#00ff9d]/20">
                  <SheetHeader>
                    <SheetTitle className="text-[#00ff9d] font-mono">СТАТУС_КОРЗИНЫ</SheetTitle>
                  </SheetHeader>
                  <div className="mt-4">
                    <p className="text-center text-[#00ff9d]/60 font-mono">КОРЗИНА_ПУСТА</p>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </header>

      {/* Главный раздел */}
      <div className="pt-20 relative min-h-[60vh] flex items-center justify-center bg-gradient-to-b from-black via-black/95 to-black">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-[#00ff9d]/10 to-[#ff00ff]/10 mix-blend-overlay" />
          <div className="absolute inset-0 bg-grid-white/[0.02] bg-grid-pattern" />
        </div>
        <div className="relative container mx-auto px-4 text-center">
          <h2 className="text-6xl md:text-8xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#FF6B6B] to-[#4ECDC4] font-mono mb-8">
            Ruli<span className="text-[#FFD93D]">Beri</span>
          </h2>
          <p className="text-[#00ff9d] text-xl md:text-2xl font-mono mb-8">АРЕНДА_МАШИН,_ВСЕ_ПРОСТО:_БЕРИ_И_РУЛИ!</p>
          <div className="flex flex-wrap justify-center gap-4">
            <Button className="bg-[#FF6B6B] text-black hover:bg-[#FF8E8E] font-mono text-lg px-8 py-6">
              <Link href="/rent-car">АРЕНДА_МАШИНЫ//</Link>
            </Button>
            <Button className="bg-[#4ECDC4] text-black hover:bg-[#6BDED6] font-mono text-lg px-8 py-6">
              <Link href="/buy-subscription">КУПИТЬ_АБОНЕМЕНТ//</Link>
            </Button>
            <Button className="bg-[#FFD93D] text-black hover:bg-[#FFE566] font-mono text-lg px-8 py-6">
              <Link href="/supercar-test">ТЕСТ_НА_СУПЕРКАР//</Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Сетка функций */}
      <div className="container mx-auto px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            {
              title: "КВАНТОВАЯ_ОПЛАТА",
              icon: "💫",
              description: "ОБМЕН_ЗВЕЗД_ТЕЛЕГРАМ_НА_АБОНЕМЕНТ",
            },
            {
              title: "БЕЗОПАСНАЯ_ДОСТАВКА",
              icon: "🚚",
              description: "ДОСТАВКА_МАШИНЫ_К_ДОМУ_ЗА_ДОПЛАТУ",
            },
            {
              title: "МГНОВЕННОЕ_ОТСЛЕЖИВАНИЕ",
              icon: "🔍",
              description: "ПРОСМОТР_МЕСТОПОЛОЖЕНИЯ_МАШИН",
            },
          ].map((feature, index) => (
            <div
              key={index}
              className="border border-[#FF6B6B]/20 bg-black/50 backdrop-blur-sm rounded-lg p-6 hover:border-[#FF6B6B] transition-colors"
            >
              <div className="text-4xl mb-4">{feature.icon}</div>
              <h3 className="text-[#FF6B6B] font-mono text-xl mb-2">{feature.title}</h3>
              <p className="text-[#4ECDC4] font-mono text-sm">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>

      <footer className="mt-auto p-4 text-center text-sm text-gray-400">
        Powered by Supercar Match © {new Date().getFullYear()}
      </footer>
    </div>
  )
}

