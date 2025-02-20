"use client"
import { User, Bot } from "lucide-react"
import Image from "next/image"
import { useAppContext } from "@/contexts/AppContext"
import { Button } from "@/components/ui/button"

export default function UserInfo() {
  const { dbUser, telegramUser, isInTelegramContext, isMockUser, isLoading, error } = useAppContext()

  if (isLoading) return <div className="w-8 h-8 bg-gray-500 rounded-full animate-pulse" />
  if (error) return <div className="text-red-500">Ошибка</div>

  const user = dbUser || telegramUser
  if (user) {
    const displayName = user.username || user.full_name || user.first_name || "Пользователь"
    return (
      <div className="flex items-center gap-2 max-w-[150px]">
        {isInTelegramContext && <span className="text-xs text-blue-400">TG</span>}
        {isMockUser && <Bot className="h-3 w-3 text-yellow-500" />}
        {dbUser ? (
          <Image
            src={dbUser.avatar_url || "/placeholder.svg"}
            alt="Avatar"
            width={32}
            height={32}
            className="rounded-full"
          />
        ) : (
          <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white">
            {getInitials(displayName)}
          </div>
        )}
        <span className="text-[#4ECDC4] font-mono text-sm truncate">{displayName}</span>
      </div>
    )
  }

  return (
    <Button variant="ghost" className="text-[#FF6B6B] hover:text-[#FF8E8E]">
      <User className="h-5 w-5" />
    </Button>
  )
}

function getInitials(name: string): string {
  return name.split(" ").map((word) => word[0]).join("").toUpperCase().slice(0, 2)
}

