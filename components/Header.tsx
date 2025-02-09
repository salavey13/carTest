"use client"
import Link from "next/link"
import { MapPin, Search } from "lucide-react"
import dynamic from "next/dynamic"
import { useState } from "react"
import UserInfo from "@/components/user-info"

const Button = dynamic(() => import("@/components/ui/button").then((mod) => mod.Button), { ssr: false })
const Input = dynamic(() => import("@/components/ui/input").then((mod) => mod.Input), { ssr: false })

export default function Header() {
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  // Removed: const { dbUser, isLoading } = useAppContext()

  return (
    <header className="border-b border-[#00ff9d]/20 bg-black/50 backdrop-blur-sm fixed w-full z-50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="text-3xl md:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#FF6B6B] to-[#4ECDC4] font-mono"
          >
            Ruli<span className="text-[#FFD93D]">Beri</span>
          </Link>

          <button
            className="md:hidden flex items-center gap-2 text-sm text-[#00ff9d]"
            onClick={() => setIsSearchOpen(!isSearchOpen)}
          >
            <Search className="h-4 w-4" />
            <span>Поиск</span>
          </button>

          <div className={`hidden md:flex flex-1 max-w-xl px-8 ${isSearchOpen ? "block" : "hidden"}`}>
            <div className="relative">
              <Input
                type="search"
                placeholder="ПОИСКОВЫЙ_ЗАПРОС//"
                className="w-full pl-10 bg-black/30 border-[#00ff9d]/30 text-[#00ff9d] font-mono"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#00ff9d]" />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <UserInfo />
            <Button variant="ghost" className="text-[#00ff9d] hover:text-[#00ffff]">
              <MapPin className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {isSearchOpen && (
          <div className="md:hidden mt-4">
            <div className="relative">
              <Input
                type="search"
                placeholder="ПОИСКОВЫЙ_ЗАПРОС//"
                className="w-full pl-10 bg-black/30 border-[#00ff9d]/30 text-[#00ff9d] font-mono"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#00ff9d]" />
            </div>
          </div>
        )}
      </div>
    </header>
  )
}

