"use client"
import Link from "next/link"
import dynamic from "next/dynamic"
import { User } from "lucide-react"
import Image from "next/image"
import { useAppContext } from "@/contexts/AppContext"

const Button = dynamic(() => import("@/components/ui/button").then((mod) => mod.Button), { ssr: false })

export default function UserInfo() {
  const { dbUser, isLoading } = useAppContext()

  if (isLoading) {
    return <div>Loading...</div>
  }

  if (dbUser) {
    return (
      <div className="flex items-center gap-2">
        {dbUser.avatar_url && (
          <Image
            src={dbUser.avatar_url || "/placeholder.svg"}
            alt="Avatar"
            width={32}
            height={32}
            className="rounded-full"
          />
        )}
        <span className="text-[#4ECDC4] font-mono text-sm">{dbUser.username || dbUser.full_name}</span>
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

