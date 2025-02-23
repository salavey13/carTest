"use client"
import { useState, useEffect } from "react"
import { User, Bot } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useTelegram } from "@/hooks/useTelegram"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { motion } from "framer-motion"

export default function UserInfo() {
  const { dbUser, user, isInTelegramContext, isMockUser, isLoading, error } = useTelegram()
  const [isFirstLoad, setIsFirstLoad] = useState(true)

  useEffect(() => {
    if (!isLoading && (dbUser || user)) {
      setIsFirstLoad(false)
    }
  }, [isLoading, dbUser, user])

  if (isLoading) {
    return (
      <div className="w-10 h-10 bg-gradient-to-br from-gray-700 to-gray-800 rounded-full animate-pulse shadow-[0_0_10px_rgba(0,255,157,0.2)]" />
    )
  }

  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-red-400 text-sm font-mono"
      >
        Ошибка
      </motion.div>
    )
  }

  const telegramUser = dbUser || user // Fallback to user if dbUser is null
  if (telegramUser) {
    const displayName =
      telegramUser.username || telegramUser.full_name || telegramUser.first_name || "Пользователь"

    return (
      <TooltipProvider>
        <motion.div
          className="flex items-center gap-3 p-2 rounded-xl transition-all hover:shadow-[0_0_15px_rgba(0,255,157,0.3)]"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="relative group cursor-pointer">
                {dbUser && dbUser.avatar_url ? (
                  <Image
                    src={dbUser.avatar_url}
                    alt="Avatar"
                    width={40}
                    height={40}
                    className="rounded-full border-2 border-[#4ECDC4]/60 shadow-[0_0_8px_rgba(0,255,157,0.4)] group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-10 h-10 bg-gradient-to-br from-[#4ECDC4] via-[#FF6B6B] to-[#ff00ff] rounded-full flex items-center justify-center text-white font-bold text-lg shadow-[0_0_12px_rgba(0,255,157,0.5)] group-hover:scale-105 transition-transform duration-300 relative overflow-hidden">
                    <span className="relative z-10">{getInitials(displayName)}</span>
                    <div className="absolute inset-0 bg-gradient-to-tr from-transparent to-[#00ff9d]/20 opacity-50 animate-pulse" />
                  </div>
                )}
                {isInTelegramContext && (
                  <Badge className="absolute -top-1 -right-1 bg-blue-500/90 text-[9px] px-1 py-0 shadow-sm">
                    TG
                  </Badge>
                )}
                {isMockUser && (
                  <Bot className="absolute -bottom-1 -right-1 h-4 w-4 text-yellow-400 shadow-[0_0_4px_rgba(255,215,0,0.5)]" />
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent className="bg-gradient-to-br from-gray-800 to-gray-900 border-[#4ECDC4]/40 text-[#4ECDC4] shadow-[0_0_10px_rgba(0,255,157,0.2)]">
              <p className="font-mono">{displayName}</p>
              {dbUser?.user_id && (
                <p className="text-xs font-mono opacity-80">ID: {dbUser.user_id}</p>
              )}
              <Link
                href="/invoices"
                className="text-[#FF6B6B] hover:text-[#FF8E8E] text-sm mt-2 block font-mono transition-colors"
              >
                Зал Славы
              </Link>
            </TooltipContent>
          </Tooltip>
          <motion.span
            className="text-[#4ECDC4] font-['Orbitron'] text-sm md:text-base truncate max-w-[140px] drop-shadow-[0_0_5px_rgba(0,255,157,0.3)]"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.6,
              delay: isFirstLoad ? 0.3 : 0,
              ease: "easeOut",
              type: "spring",
              stiffness: 100,
            }}
          >
            {isFirstLoad
              ? Array.from(displayName).map((char, index) => (
                  <motion.span
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                  >
                    {char}
                  </motion.span>
                ))
              : displayName}
          </motion.span>
        </motion.div>
      </TooltipProvider>
    )
  }

  return (
    <Button
      variant="ghost"
      className="text-[#FF6B6B]/80 hover:text-[#FF8E8E] p-2 hover:bg-gray-700/20 rounded-full transition-all"
    >
      <User className="h-5 w-5" />
    </Button>
  )
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}
