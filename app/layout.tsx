// app/layout.tsx
"use client"; // ✅ Mark as a client component
import { AnimatePresence, motion } from 'framer-motion';
import { usePathname } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { AppProvider } from "@/contexts/AppContext"

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className="bg-gray-900 text-white min-h-screen flex flex-col">
        <AppProvider>
        {/* Header */}
        <Header />

        {/* Main Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="flex-grow"
          >
            {children}
          </motion.div>
        </AnimatePresence>

        {/* Footer */}
        <Footer />
        </AppProvider>
      </body>
    </html>
  );
}



import './globals.css'