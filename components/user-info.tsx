"use client"
import { User, Bot } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useAppContext } from "@/contexts/AppContext"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

export default function UserInfo() {
  const { dbUser, telegramUser, isInTelegramContext, isMockUser, isLoading, error } = useAppContext()

  if (isLoading) return <div className="w-8 h-8 bg-gray-700 rounded-full animate-pulse" />
  if (error) return <div className="text-red-400 text-sm">Ошибка</div>

  const user = dbUser || telegramUser
  if (user) {
    const displayName = user.username || user.full_name || user.first_name || "Пользователь"
    return (
      <TooltipProvider>
        <div className="flex items-center gap-2 p-1.5 rounded-lg bg-gray-800/30 hover:bg-gray-700/30 transition-colors">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="relative">
                {dbUser ? (
                  <Image
                    src={dbUser.avatar_url || "/placeholder.svg"}
                    alt="Avatar"
                    width={32}
                    height={32}
                    className="rounded-full border border-[#4ECDC4]/50 shadow-sm"
                  />
                ) : (
                  <div className="w-8 h-8 bg-blue-600/80 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm">
                    {getInitials(displayName)}
                  </div>
                )}
                {isInTelegramContext && (
                  <Badge className="absolute -top-0.5 -right-0.5 bg-blue-500/80 text-[8px] px-1 py-0">TG</Badge>
                )}
                {isMockUser && (
                  <Bot className="absolute -bottom-0.5 -right-0.5 h-3 w-3 text-yellow-400" />
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent className="bg-gray-800 border-[#4ECDC4]/30 text-[#4ECDC4]">
              <p>{displayName}</p>
              {dbUser?.user_id && <p className="text-xs">ID: {dbUser.user_id}</p>}
              <Link href="/invoices" className="text-[#FF6B6B] hover:text-[#FF8E8E] text-sm mt-1 block">
                Зал Славы
              </Link>
            </TooltipContent>
          </Tooltip>
          <span className="text-[#4ECDC4]/90 font-mono text-sm truncate max-w-[120px]">
            {displayName}
          </span>
        </div>
      </TooltipProvider>
    )
  }

  return (
    <Button variant="ghost" className="text-[#FF6B6B]/80 hover:text-[#FF8E8E] p-2">
      <User className="h-4 w-4" />
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
