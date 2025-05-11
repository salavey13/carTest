"use client";
import { useEffect, useState } from "react";
import { useAppContext } from "@/contexts/AppContext";
import { useRouter } from "next/navigation";
import { CarSubmissionForm } from "@/components/CarSubmissionForm";
import { QuickSetWebhookButton } from "@/components/QuickSetWebhookButton";
import Link from "next/link";
import { motion } from "framer-motion";
import { Car, Zap } from "lucide-react";
import { toast } from "sonner";
import { debugLogger as logger } from "@/lib/debugLogger";

export default function AdminPage() {
  const { dbUser, isAdmin, isLoading: appContextLoading } = useAppContext();
  const router = useRouter();
  const [isAdminChecked, setIsAdminChecked] = useState<boolean | null>(null);

  useEffect(() => {
    logger.debug("[AdminPage] useEffect triggered", { 
      dbUserExists: !!dbUser, 
      appContextLoading, 
      isAdminFunctionExists: typeof isAdmin === 'function' 
    });

    if (appContextLoading) {
      logger.debug("[AdminPage] AppContext is loading, admin check deferred.");
      setIsAdminChecked(null); // Explicitly set to null while loading to show spinner
      return; 
    }

    logger.debug("[AdminPage] AppContext loaded. Proceeding with admin check.");
    
    if (typeof isAdmin !== 'function') {
        logger.error("[AdminPage] isAdmin is not a function in AppContext after loading. This should not happen.");
        setIsAdminChecked(false); // Fallback to not admin if function is missing
        // No redirect here yet, let the !isAdminChecked block handle it after this effect.
        return;
    }
    
    const adminStatus = isAdmin();
    logger.debug("[AdminPage] isAdmin function called, status:", adminStatus);
    setIsAdminChecked(adminStatus);

    if (adminStatus) {
      if (dbUser) {
          toast.success("Добро пожаловать в Центр Управления, командир!");
      } else {
          logger.warn("[AdminPage] Admin status true, but dbUser not yet available for welcome toast.");
      }
    } else {
      // This check is now more reliable as it runs after appContextLoading is false AND isAdmin is confirmed to be a function
      toast.error("Доступ запрещён. Перенаправляю в Матрицу...");
      logger.warn("[AdminPage] Access denied (appContextLoaded: true, adminStatus: false). Redirecting to /");
      router.push("/");
    }

  }, [dbUser, isAdmin, router, appContextLoading]);

  if (appContextLoading || isAdminChecked === null) { 
    logger.debug("[AdminPage] Rendering loading state", { appContextLoading, isAdminChecked });
    return (
      <div className="min-h-screen bg-background bg-grid-pattern flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-12 h-12 border-4 border-t-primary border-muted rounded-full shadow-[0_0_15px_rgba(var(--brand-orange-rgb),0.8)]"
        />
      </div>
    );
  }

  if (!isAdminChecked) {
    logger.debug("[AdminPage] Not admin after checks, rendering null (redirection should have occurred).");
    // This state should ideally not be reached if redirection works, but as a fallback:
    return (
        <div className="min-h-screen bg-background flex items-center justify-center">
            <p className="text-red-500">Перенаправление...</p>
        </div>
    ); 
  }
  
  logger.debug("[AdminPage] Rendering admin content.");
  return (
    <div className="min-h-screen pt-24 bg-background bg-grid-pattern animate-[drift_30s_infinite]">
      <main className="container mx-auto pt-10 px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-4xl mx-auto p-8 bg-card rounded-2xl shadow-[0_0_20px_rgba(var(--brand-orange-rgb),0.3)] border border-muted"
        >
          <h2
            className="text-3xl font-semibold text-secondary mb-6 cyber-text glitch flex items-center justify-center gap-3"
            data-text="КОНТРОЛЬ ФЛОТА"
          >
            <Car className="h-8 w-8 animate-pulse" /> КОНТРОЛЬ ФЛОТА
          </h2>
          <p className="text-muted-foreground mb-8 text-lg font-mono text-center">
            Управляй кибер-флотом — добавляй новые машины в строй!
          </p>
          <CarSubmissionForm ownerId={dbUser?.user_id} />

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mt-10"
          >
            <h3 className="text-2xl font-semibold text-secondary mb-4 cyber-text">
              Быстрые действия
            </h3>
            <QuickSetWebhookButton />
          </motion.div>

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
              onClick={() =>
                toast.success("Система на полной мощности, командир!")
              }
              className="bg-primary text-primary-foreground hover:bg-secondary rounded-full w-14 h-14 flex items-center justify-center shadow-[0_0_15px_rgba(var(--brand-orange-rgb),0.7)] transition-all hover:shadow-[0_0_25px_rgba(var(--brand-orange-rgb),0.9)]"
            >
              <Zap className="h-7 w-7" />
            </button>
          </motion.div>
        </motion.div>
      </main>
    </div>
  );
}