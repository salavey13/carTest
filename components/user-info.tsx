// components/UserInfo.tsx
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

  if (isLoading) return <div className="w-10 h-10 bg-gray-500 rounded-full animate-pulse" />
  if (error) return <div className="text-red-500 font-semibold">Ошибка</div>

  const user = dbUser || telegramUser
  if (user) {
    const displayName = user.username || user.full_name || user.first_name || "Пользователь"
    return (
      <TooltipProvider>
        <div className="flex items-center gap-3 max-w-[200px] p-2 rounded-lg bg-gray-800/50 hover:bg-gray-700/50 transition-colors">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="relative">
                {dbUser ? (
                  <Image
                    src={dbUser.avatar_url || "/placeholder.svg"}
                    alt="Avatar"
                    width={40}
                    height={40}
                    className="rounded-full border-2 border-[#4ECDC4] shadow-lg"
                  />
                ) : (
                  <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg">
                    {getInitials(displayName)}
                  </div>
                )}
                {isInTelegramContext && (
                  <Badge className="absolute -top-1 -right-1 bg-blue-500">TG</Badge>
                )}
                {isMockUser && (
                  <Bot className="absolute -bottom-1 -right-1 h-4 w-4 text-yellow-400" />
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>{displayName}</p>
              {dbUser?.user_id && <p className="text-xs">ID: {dbUser.user_id}</p>}
            </TooltipContent>
          </Tooltip>
          <div className="flex flex-col">
            <span className="text-[#4ECDC4] font-mono text-sm truncate">{displayName}</span>
            <Link href="/invoices">
              <Button variant="link" size="sm" className="text-[#FF6B6B] p-0 h-auto">
                Glory Hall
              </Button>
            </Link>
          </div>
        </div>
      </TooltipProvider>
    )
  }

  return (
    <Button variant="ghost" className="text-[#FF6B6B] hover:text-[#FF8E8E]">
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
