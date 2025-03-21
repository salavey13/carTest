// /app/shadow-fleet-admin/page.tsx
"use client"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { useAppContext } from "@/contexts/AppContext"
import { ShadowFleetAdmin } from "@/components/ShadowFleetAdmin"

export default function ShadowFleetAdminPage() {
  const { dbUser, isAdmin } = useAppContext()
  const router = useRouter()

  useEffect(() => {
    if (dbUser && !isAdmin()) {
      router.push("/")
    }
  }, [dbUser, isAdmin, router])

  return <ShadowFleetAdmin />
}

