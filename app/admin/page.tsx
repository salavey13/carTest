// app/admin/page.tsx
"use client"
import { useEffect } from "react"
import { useTelegram } from "@/hooks/useTelegram"
import { useRouter } from "next/navigation"
import { CarSubmissionForm } from "@/components/CarSubmissionForm"
import Link from "next/link"

export default function AdminPage() {
  const { dbUser, isAdmin } = useTelegram()
  const router = useRouter()

  useEffect(() => {
    if (dbUser && !isAdmin()) {
      router.push("/")
    }
  }, [dbUser, isAdmin, router])

  if (!dbUser || !isAdmin()) {
    return <div className="min-h-screen bg-gray-900" />
  }

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      {/* Binary Background */}
      <div className="absolute inset-0 opacity-10 pointer-events-none select-none overflow-hidden whitespace-nowrap text-[8px] leading-none binary-background">
        {Array(100).fill("01").join("")}
      </div>

      <div className="pt-20 relative container mx-auto px-4">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#FF6B6B] to-[#4ECDC4] font-mono mb-8">
          Admin Panel
        </h1>
        <CarSubmissionForm />
        <Link href="/" className="mt-4 inline-block text-cyan-400">
          ← Back to Main Page
        </Link>
      </div>
    </div>
  )
}

