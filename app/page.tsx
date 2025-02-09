// app/page.tsx
"use client";

import { useTelegram } from "@/hooks/useTelegram";
import Link from "next/link";
import dynamic from "next/dynamic";

const Button = dynamic(() => import("@/components/ui/button").then((mod) => mod.Button), { ssr: false });

export default function Home() {
  const { user, dbUser, isAuthenticated, isLoading } = useTelegram();

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      {/* Binary Background */}
      <div className="absolute inset-0 opacity-10 pointer-events-none select-none overflow-hidden whitespace-nowrap text-[8px] leading-none binary-background">
        {Array(100).fill("01").join("")}
      </div>

      {/* Main Section */}
      <main className="pt-20 relative min-h-[60vh] flex items-center justify-center bg-gradient-to-b from-black via-black/95 to-black">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-[#00ff9d]/10 to-[#ff00ff]/10 mix-blend-overlay" />
          <div className="absolute inset-0 bg-grid-white/[0.02] bg-grid-pattern" />
        </div>
        <div className="relative container mx-auto px-4 text-center">
          <h2 className="text-5xl sm:text-6xl md:text-8xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#FF6B6B] to-[#4ECDC4] font-mono mb-8">
            Ruli<span className="text-[#FFD93D]">Beri</span>
          </h2>
          <p className="text-[#00ff9d] text-md sm:text-xl md:text-2xl font-mono mb-8">
            АРЕНДА_МАШИН,_ВСЕ_ПРОСТО:_БЕРИ_И_РУЛИ!
          </p>
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
      </main>

      {/* Features Grid */}
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

      {/* Admin Icon */}
      {isAuthenticated && dbUser?.role === "admin" && (
        <div className="fixed bottom-4 right-4 z-50">
          <Link href="/admin">
            <Button variant="ghost" className="text-[#FFD93D] hover:text-[#FFE566]">
              🛠️ Admin Panel
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}

