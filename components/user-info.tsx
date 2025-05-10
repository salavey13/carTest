"use client";
import { useState, useEffect } from "react";
import { User, Bot, Trophy, Car, Lock } from "lucide-react"; // Changed from FaUser, FaRobot etc. to Lucide icons
import Image from "next/image";
import Link from "next/link";
import { useAppContext } from "@/contexts/AppContext";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export default function UserInfo() {
  const { dbUser, user, isInTelegramContext, isMockUser, isLoading, error } = useAppContext();
  const [isFirstLoad, setIsFirstLoad] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && (dbUser || user)) setIsFirstLoad(false);
  }, [isLoading, dbUser, user]);

  if (isLoading) {
    return (
      <div className="w-11 h-11 bg-muted rounded-full animate-pulse shadow-[0_0_15px_rgba(var(--brand-orange-rgb),0.3)]" />
    );
  }

  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-destructive font-mono text-sm animate-[neon_2s_infinite]"
      >
        Auth Error!
      </motion.div>
    );
  }

  const telegramUser = dbUser || user;
  if (!telegramUser) {
    return (
      <button
        className="p-2 rounded-full text-primary hover:text-primary/80 bg-muted/20 hover:bg-muted/40 transition-all shadow-[0_0_10px_rgba(var(--brand-orange-rgb),0.3)]"
      >
        <User className="h-6 w-6" />
      </button>
    );
  }

  const displayName = telegramUser.username || telegramUser.full_name || telegramUser.first_name || "Юзер";
  const avatarUrl = dbUser?.avatar_url || user?.photo_url;

  return (
    <motion.div
      className="relative flex items-center gap-2 p-1 rounded-full hover:bg-gray-800/50 transition-all duration-200" // Adjusted padding and hover effect
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div
        className="relative group cursor-pointer w-9 h-9 sm:w-10 sm:h-10" // Standardized size
        onClick={() => setIsModalOpen(true)}
      >
        {avatarUrl ? (
          <div className="relative w-full h-full rounded-full overflow-hidden border-2 border-primary shadow-[0_0_12px_rgba(var(--brand-orange-rgb),0.5)] group-hover:scale-105 transition-transform duration-300">
            <Image
              src={avatarUrl}
              alt="Аватар"
              layout="fill"
              objectFit="cover" // Crucial for ensuring the image covers the circle
              className="rounded-full" // Ensures image itself is rounded, helps with potential border radius issues on Image directly
            />
          </div>
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center text-primary-foreground font-mono text-base sm:text-lg shadow-[0_0_15px_rgba(var(--brand-orange-rgb),0.5)] group-hover:scale-105 transition-transform duration-300">
            {getInitials(displayName)}
          </div>
        )}
        {isInTelegramContext && (
          <span className="absolute -top-0.5 -right-0.5 bg-accent text-accent-foreground text-[9px] px-1 rounded-full shadow-sm">TG</span>
        )}
        {isMockUser && (
          <Bot className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 text-accent shadow-[0_0_6px_rgba(var(--brand-yellow-rgb),0.5)]" />
        )}
      </div>

      <span className="hidden md:block text-primary font-mono text-sm truncate max-w-[120px] text-glow">
        {isFirstLoad ? (
          Array.from(displayName).map((char, i) => (
            <motion.span
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              {char}
            </motion.span>
          ))
        ) : (
          displayName
        )}
      </span>

      {/* Modal (conditionally rendered but logic exists if needed) */}
      {isModalOpen && false && ( // Kept the modal logic, but it's currently disabled by `false`
        <motion.div
          className="fixed inset-0 top-[69%] z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setIsModalOpen(false)}
        >
          <motion.div
            className="bg-card p-6 rounded-2xl shadow-[0_0_25px_rgba(var(--brand-orange-rgb),0.5)] border border-muted max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto scrollbar-thin scrollbar-thumb-primary scrollbar-track-muted"
            initial={{ scale: 0.8, y: 50 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.8, y: 50 }}
            transition={{ type: "spring", stiffness: 100 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-6">
              <div className="text-center">
                <p className="text-xl text-primary font-mono text-glow">{displayName}</p>
                {dbUser?.user_id && (
                  <p className="text-sm text-muted-foreground font-mono">ID: {dbUser.user_id}</p>
                )}
              </div>
              <Link href="/invoices" onClick={() => setIsModalOpen(false)}>
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  className="bg-gradient-to-r from-primary to-secondary p-4 rounded-lg flex items-center gap-4"
                >
                  <Trophy className="h-8 w-8 text-primary-foreground" />
                  <div>
                    <p className="text-primary-foreground font-mono font-bold">Зал Славы</p>
                    <p className="text-sm text-primary-foreground/80 font-mono">
                      Чекни свои подвиги и бабки в неоне!
                    </p>
                  </div>
                </motion.div>
              </Link>
              <Link href="/cyber-garage" onClick={() => setIsModalOpen(false)}>
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  className="bg-gradient-to-r from-muted to-primary p-4 rounded-lg flex items-center gap-4"
                >
                  <Lock className="h-8 w-8 text-primary" />
                  <div>
                    <p className="text-primary font-mono font-bold">Кибер-Гараж</p>
                    <p className="text-sm text-muted-foreground font-mono">
                      Секретный ангар для настоящих гонщиков!
                    </p>
                  </div>
                </motion.div>
              </Link>
            </div>
          </motion.div>
        </motion.div>
      )}
    </motion.div>
  );
};

function getInitials(name: string): string {
  if (!name || typeof name !== 'string') return "?";
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}