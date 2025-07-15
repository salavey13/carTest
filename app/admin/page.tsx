// /app/admin/page.tsx
"use client";
import { useEffect, useState } from "react";
import { useAppContext } from "@/contexts/AppContext";
import { CarSubmissionForm } from "@/components/CarSubmissionForm";
import Link from "next/link";
import { motion } from "framer-motion";
import { VibeContentRenderer } from "@/components/VibeContentRenderer";
import { toast } from "sonner";
import { debugLogger as logger } from "@/lib/debugLogger";
import { Loading } from "@/components/Loading";
import Image from "next/image";

export default function AdminPage() {
  const { dbUser, isAdmin, isLoading: appContextLoading } = useAppContext();
  const [isTrulyAdmin, setIsTrulyAdmin] = useState<boolean>(false);

  useEffect(() => {
    logger.debug("[AdminPage] useEffect triggered", { dbUserExists: !!dbUser, appContextLoading });

    if (!appContextLoading && typeof isAdmin === 'function') {
      const adminStatus = isAdmin();
      setIsTrulyAdmin(adminStatus);
      if(adminStatus) {
        toast.success("Vibe Control Center: Все системы в норме, Командир.");
      }
    }
  }, [appContextLoading, isAdmin, dbUser]);

  if (appContextLoading) { 
    return <Loading text="ПРОВЕРКА ДОСТУПА..." />;
  }
  
  return (
    <div className="min-h-screen pt-24 bg-black relative overflow-hidden">
        <div className="fixed inset-0 z-[-1] opacity-20">
            <Image
            src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/21a9e79f-ab43-41dd-9603-4586fabed2cb-158b7f8c-86c6-42c8-8903-563ffcd61213.jpg"
            alt="Admin Background"
            fill
            className="object-cover animate-pan-zoom"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-transparent"></div>
        </div>

      <main className="container mx-auto pt-10 px-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-4xl mx-auto p-6 md:p-8 bg-dark-card/80 backdrop-blur-xl rounded-2xl shadow-2xl shadow-brand-purple/20 border border-brand-purple/50"
        >
          <h2
            className="text-3xl md:text-4xl font-semibold text-brand-purple mb-4 cyber-text glitch flex items-center justify-center gap-3"
            data-text="VIBE CONTROL CENTER"
          >
            <VibeContentRenderer content="::FaSatelliteDish::" className="h-8 w-8 animate-pulse text-shadow-cyber" /> VIBE CONTROL CENTER
          </h2>
          <p className="text-muted-foreground mb-8 text-base font-mono text-center">
            Добавь свой транспорт в систему и стань частью флота.
          </p>
          
          <CarSubmissionForm ownerId={dbUser?.user_id} />

          <div className="mt-10 pt-8 border-t-2 border-dashed border-brand-purple/20 space-y-4 md:space-y-0 md:flex md:justify-center md:items-center md:gap-6">
            <Link
              href="/rent-bike"
              className="group inline-flex items-center justify-center w-full md:w-auto px-6 py-3 border-2 border-brand-pink bg-brand-pink/10 text-brand-pink rounded-lg font-orbitron text-lg tracking-wider transition-all duration-300 hover:bg-brand-pink hover:text-black hover:shadow-pink-glow"
            >
              <VibeContentRenderer content="::FaMotorcycle::" className="mr-3 transition-transform group-hover:rotate-[-5deg]" />
              В МОТО-ГАРАЖ
            </Link>

            {isTrulyAdmin && (
                 <Link
                    href="/paddock"
                    className="group inline-flex items-center justify-center w-full md:w-auto px-6 py-3 border-2 border-brand-cyan bg-brand-cyan/10 text-brand-cyan rounded-lg font-orbitron text-lg tracking-wider transition-all duration-300 hover:bg-brand-cyan hover:text-black hover:shadow-cyan-glow"
                >
                    <VibeContentRenderer content="::FaWarehouse::" className="mr-3 transition-transform group-hover:-translate-x-1" />
                    МОЙ ПАДДОК
                 </Link>
            )}
          </div>
        </motion.div>
      </main>
    </div>
  );
}
