"use client"
import Link from "next/link"
import { User } from "lucide-react"
import Image from "next/image"
import { useAppContext } from "@/contexts/AppContext"
import { Button } from "@/components/ui/button"
import { useTelegram } from "@/hooks/useTelegram"

export default function UserInfo() {
  const { dbUser, isLoading, error } = useAppContext()
  const { user: telegramUser } = useTelegram()

  if (isLoading) {
    return <div>Loading...</div>
  }

  if (error) {
    console.error("Error in UserInfo:", error)
    return <div>Error loading user data</div>
  }

  if (dbUser) {
    return (
      <div className="flex items-center gap-2">
        {dbUser.avatar_url ? (
          <Image
            src={dbUser.avatar_url || "/placeholder.svg"}
            alt="Avatar"
            width={32}
            height={32}
            className="rounded-full"
          />
        ) : (
          <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white">
            {getInitials(dbUser.full_name || dbUser.username)}
          </div>
        )}
        <span className="text-[#4ECDC4] font-mono text-sm">{dbUser.username || dbUser.full_name}</span>
      </div>
    )
  }

  if (telegramUser) {
    return (
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white">
          {getInitials(telegramUser.first_name)}
        </div>
        <span className="text-[#4ECDC4] font-mono text-sm">{telegramUser.username || telegramUser.first_name}</span>
      </div>
    )
  }

  return (
    <Link href="/buy-subscription">
      <Button variant="ghost" className="text-[#FF6B6B] hover:text-[#FF8E8E]">
        <User className="h-5 w-5" />
      </Button>
    </Link>
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

