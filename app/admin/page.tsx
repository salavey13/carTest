"use client";
import { useEffect, useState } from "react";
import { useTelegram } from "@/hooks/useTelegram";
import { useRouter } from "next/navigation";
import { CarSubmissionForm } from "@/components/CarSubmissionForm";
import Link from "next/link";
import { motion } from "framer-motion";
import { Car, Zap } from "lucide-react";
import { toast } from "sonner";

export default function AdminPage() {
  const { dbUser, isAdmin } = useTelegram();
  const router = useRouter();
  const [isAdminChecked, setIsAdminChecked] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (dbUser) {
      const adminStatus = isAdmin();
      setIsAdminChecked(adminStatus);
      setIsLoading(false);
      if (adminStatus) {
        toast.success("Добро пожаловать в Центр Управления, командир!");
      } else {
        toast.error("Доступ запрещён. Перенаправляю в Матрицу...");
        router.push("/");
      }
    }
  }, [dbUser, isAdmin, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background bg-grid-pattern flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-12 h-12 border-4 border-t-primary border-muted rounded-full shadow-[0_0_15px_rgba(255,107,107,0.8)]"
        />
      </div>
    );
  }

  if (!isAdminChecked) return null;

  return (
    <div className="min-h-screen pt-24 bg-background bg-grid-pattern animate-[drift_30s_infinite]">
      <header className="fixed top-0 left-0 right-0 bg-card shadow-md p-6 z-10 border-b border-muted">
        <h1 className="text-4xl font-bold text-gradient cyber-text glitch" data-text="ЦЕНТР УПРАВЛЕНИЯ">
          ЦЕНТР УПРАВЛЕНИЯ
        </h1>
      </header>
      <main className="container mx-auto pt-10 px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-4xl mx-auto p-8 bg-card rounded-2xl shadow-[0_0_20px_rgba(255,107,107,0.3)] border border-muted"
        >
          <h2 className="text-3xl font-semibold text-secondary mb-6 cyber-text glitch flex items-center justify-center gap-3" data-text="КОНТРОЛЬ ФЛОТА">
            <Car className="h-8 w-8 animate-pulse" /> КОНТРОЛЬ ФЛОТА
          </h2>
          <p className="text-muted-foreground mb-8 text-lg font-mono text-center">
            Управляй кибер-флотом — добавляй новые машины в строй!
          </p>
          <CarSubmissionForm ownerId={dbUser.id} />
          <div className="mt-10 space-y-6 text-center">
            <Link
              href="/shadow-fleet-admin"
              className="block text-secondary hover:text-secondary/80 font-mono text-xl tracking-wide transition-colors text-glow"
            >
              Управление Теневым Флотом →
            </Link>
            <Link
              href="/"
              className="block text-primary hover:text-primary/80 font-mono text-xl tracking-wide transition-colors text-glow"
            >
              ← Назад в Матрицу
            </Link>
          </div>
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.6 }}
            className="fixed bottom-6 right-6 z-50"
          >
            <button
              onClick={() => toast.success("Система на полной мощности, командир!")}
              className="bg-primary text-primary-foreground hover:bg-secondary rounded-full w-14 h-14 flex items-center justify-center shadow-[0_0_15px_rgba(255,107,107,0.7)] transition-all hover:shadow-[0_0_25px_rgba(255,107,107,0.9)]"
            >
              <Zap className="h-7 w-7" />
            </button>
          </motion.div>
        </motion.div>
      </main>
    </div>
  );
}
