"use client"

import { useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { debugLogger } from "@/lib/debugLogger"
import { useAppContext } from "@/contexts/AppContext"

export default function Home() {
  const { dbUser, telegramUser, isAuthenticated, isLoading, error, isInTelegramContext } = useAppContext()

  useEffect(() => {
    debugLogger.log("Home component mounted", { isLoading, isInTelegramContext, telegramUser, dbUser, error })
  }, [isLoading, isInTelegramContext, telegramUser, dbUser, error])

  if (isLoading) {
    return <div className="min-h-screen bg-gray-100 text-gray-900 flex items-center justify-center">Загрузка...</div>
  }

  if (error) {
    debugLogger.error("Error in Home component:", error)
    return (
      <div className="min-h-screen bg-gray-100 text-gray-900 flex items-center justify-center">Ошибка: {error.message}</div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900 relative overflow-hidden">
      {/* Главная секция */}
      <main className="pt-20 relative min-h-[60vh] flex items-center justify-center bg-gradient-to-b from-gray-200 to-gray-100">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-100 to-green-100 mix-blend-overlay" />
        </div>
        <div className="relative container mx-auto px-4 text-center">
          <h2 className="text-5xl sm:text-6xl md:text-8xl font-bold text-blue-900 font-sans mb-8">
            ChinaCarRent
          </h2>
          <p className="text-green-700 text-md sm:text-xl md:text-2xl font-sans mb-8">
            Аренда китайских автомобилей в России. Надежность и доступность.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Button className="bg-blue-600 text-white hover:bg-blue-700 font-sans text-lg px-8 py-6">
              <Link href="/rent-car">Арендовать автомобиль</Link>
            </Button>
            <Button className="bg-green-600 text-white hover:bg-green-700 font-sans text-lg px-8 py-6">
              <Link href="/buy-subscription">Купить абонемент</Link>
            </Button>
            <Button className="bg-amber-500 text-white hover:bg-amber-600 font-sans text-lg px-8 py-6">
              <Link href="/supercar-test">Пройти тест на автомобиль</Link>
            </Button>
          </div>
        </div>
      </main>

      {/* Секция функций */}
      <div className="container mx-auto px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            {
              title: "Удобная оплата",
              icon: "💳",
              description: "Оплата картой или наличными при получении",
            },
            {
              title: "Доставка автомобиля",
              icon: "🚗",
              description: "Доставим автомобиль к вашему дому за дополнительную плату",
            },
            {
              title: "Отслеживание в реальном времени",
              icon: "📍",
              description: "Следите за местоположением вашего автомобиля",
            },
          ].map((feature, index) => (
            <div
              key={index}
              className="border border-gray-300 bg-white rounded-lg p-6 hover:border-blue-500 transition-colors"
            >
              <div className="text-4xl mb-4">{feature.icon}</div>
              <h3 className="text-blue-900 font-sans text-xl mb-2">{feature.title}</h3>
              <p className="text-gray-700 font-sans text-sm">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Иконка администратора */}
      {isAuthenticated && dbUser?.role === "admin" && (
        <div className="fixed bottom-4 right-4 z-50">
          <Link href="/admin">
            <Button variant="ghost" className="text-blue-900 hover:text-blue-700">
              🛠️ Панель администратора
            </Button>
          </Link>
        </div>
      )}
    </div>
  )
}

