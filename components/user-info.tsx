"use client"

import Link from "next/link"
//import { useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import { User } from "lucide-react"
import type { TelegramWebApp, WebAppUser } from "@/types/telegram";
const Button = dynamic(() => import("@/components/ui/button").then((mod) => mod.Button), { ssr: false })


export default function UserInfo(user : WebAppUser) {
  //const router = useRouter()

  if (user) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-[#4ECDC4] font-mono text-sm">{user.id}</span>
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

