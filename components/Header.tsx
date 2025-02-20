"use client"
import Link from "next/link"
import { Menu, X } from "lucide-react"
import { useState } from "react"
import UserInfo from "@/components/user-info"
import SemanticSearch from "@/components/SemanticSearch"
import { Button } from "@/components/ui/button"

export default function Header() {
  const [isSearchOpen, setIsSearchOpen] = useState(false)

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

          <div className="hidden md:block flex-1 max-w-xl px-8">
            <SemanticSearch />
          </div>

          <div className="flex items-center gap-4">
            <UserInfo />
            <button
              className="md:hidden flex items-center gap-2 text-sm text-[#00ff9d]"
              onClick={() => setIsSearchOpen(!isSearchOpen)}
            >
              {isSearchOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
              <span>{isSearchOpen ? "Закрыть" : "Поиск"}</span>
            </button>
          </div>
        </div>

        {isSearchOpen && (
          <div className="md:hidden mt-4">
            <SemanticSearch compact />
          </div>
        )}
      </div>
    </header>
  )
}

