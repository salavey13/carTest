"use client"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { useAppContext } from "@/contexts/AppContext"
import { Paddock } from "@/components/Paddock"

export default function PaddockPage() {
  const { dbUser, isAdmin } = useAppContext()
  const router = useRouter()

  useEffect(() => {
    if (dbUser && !isAdmin()) {
      router.push("/")
    }
  }, [dbUser, isAdmin, router])

  return <Paddock />
}