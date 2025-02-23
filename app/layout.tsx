"use client"
import type React from "react"
import Script from "next/script"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import { AppProvider } from "@/contexts/AppContext"
import { motion, AnimatePresence } from "framer-motion"
import { useState, useRef } from "react"

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [toastMessages, setToastMessages] = useState<{ id: number; message: string; type: "success" | "error" }[]>([])
  const toastIdRef = useRef(0)

  const showToast = (message: string, type: "success" | "error") => {
    const id = toastIdRef.current++
    setToastMessages((prev) => [...prev, { id, message, type }])
    setTimeout(() => {
      setToastMessages((prev) => prev.filter((toast) => toast.id !== id))
    }, 3000)
  }

  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <Script id="telegram-webapp" src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
      </head>
      <body className="bg-gradient-to-br from-gray-900 to-gray-950 text-white min-h-screen flex flex-col">
        <AppProvider>
          <Header />
          {children}
          <Footer />
          {/* Local Toaster */}
          <div className="fixed bottom-4 right-4 z-50 space-y-2">
            <AnimatePresence>
              {toastMessages.map(({ id, message, type }) => (
                <motion.div
                  key={id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg shadow-[0_0_10px_rgba(0,0,0,0.5)] font-mono text-sm ${
                    type === "success"
                      ? "bg-green-900/80 text-[#00ff9d] border-[#00ff9d]/40"
                      : "bg-red-900/80 text-red-400 border-red-400/40"
                  }`}
                >
                  {type === "success" ? "✓" : "✗"} {message}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </AppProvider>
      </body>
    </html>
  )
}
